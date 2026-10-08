// Literal-formatting formatter. Only splits on hard punctuation, numbers points,
// and bolds short exact keyword spans that appear in the original text. No paraphrase.
const { neon } = require('@neondatabase/serverless'); require('dotenv').config();
const sql = neon(process.env.DATABASE_URL);

const ROMAN = ['(i)', '(ii)', '(iii)', '(iv)', '(v)', '(vi)', '(vii)', '(viii)', '(ix)', '(x)'];
const BOLD_KEYWORDS = [
  'may not', 'must', 'minimum age', 'direct supervision', 'valid for 24 months',
  'tare', 'GVM', 'GCM', '3500kg', '125cc', 'sidecar', 'freeway', 'headlights',
  'traffic officer', 'emergency', 'accident', 'fire', 'pedestrian', 'intersection',
];

function boldKeywords(text) {
  let out = text;
  for (const kw of BOLD_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, 'i');
    if (re.test(out) && !out.includes(`**${kw}**`)) {
      out = out.replace(re, `**${kw}**`);
      return out; // bold one factual keyword only
    }
  }
  return out;
}

function splitLiteral(text) {
  const t = text.trim();
  const parts = t.split(/(?<=[.!?;])\s+/).map((s) => s.trim()).filter(Boolean);
  return parts;
}

function format(text) {
  if (!text) return text;
  const points = splitLiteral(text);
  if (points.length <= 1) return boldKeywords(points[0] ?? text);
  return points
    .map((p, i) => `${ROMAN[i] ?? `(${i + 1})`} ${boldKeywords(p.replace(/[.;]$/, ''))}`)
    .join('\n');
}

async function main() {
  const mode = process.argv[2] === 'apply' ? 'apply' : 'preview';
  const rules = await sql.query('SELECT id, body FROM study_rules').then((r) => r.rows ?? r);
  const signs = await sql.query('SELECT id, where_text, purpose_text, action_text FROM study_signs').then((r) => r.rows ?? r);

  const samples = [];
  for (const r of rules.concat([])) {
    const next = format(r.body);
    if (mode === 'apply' && next !== r.body) await sql.query(`UPDATE study_rules SET body = '${next.replace(/'/g, "''")}' WHERE id = ${r.id}`);
    if (samples.length < 5 && next !== r.body) samples.push(`RULE ${r.id}:\n${next.slice(0, 220)}`);
  }
  for (const s of signs) {
    for (const [col, raw] of [['where_text', s.where_text], ['purpose_text', s.purpose_text], ['action_text', s.action_text]]) {
      const next = format(raw);
      if (mode === 'apply' && next !== raw) await sql.query(`UPDATE study_signs SET ${col} = '${next.replace(/'/g, "''")}' WHERE id = ${s.id}`);
      if (samples.length < 10 && next !== raw) samples.push(`SIGN ${s.id} ${col}:\n${next.slice(0, 220)}`);
    }
  }
  console.log(mode === 'apply' ? 'applied' : 'preview — run with "apply" to write');
  console.log(samples.join('\n\n---\n\n'));
}

main().catch((e) => { console.error(e.message); process.exit(1); });
