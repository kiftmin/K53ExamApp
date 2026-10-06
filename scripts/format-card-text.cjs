const { neon } = require('@neondatabase/serverless');
require('dotenv').config();
const sql = neon(process.env.DATABASE_URL);

// Heuristic transformation matching the card-format prompt:
// - split multi-point text on ';' and sentence boundaries into (i),(ii),(iii) items
// - keep compound phrases together (do not split on 'and')
// - bold the leading trigger phrase of each point
// - newline-separated, with an introductory clause

const ROMAN = ['(i)', '(ii)', '(iii)', '(iv)', '(v)', '(vi)', '(vii)', '(viii)', '(ix)', '(x)'];

function splitPoints(text) {
  let t = text.trim();
  if (!t) return [];
  if (t.includes(';')) {
    const parts = t.split(';').map((s) => s.trim().replace(/[.\s]+$/, '')).filter(Boolean);
    if (parts.length >= 2) return parts;
  }
  // Split on sentence boundaries only when there are 2+ action-like sentences
  const sentences = t.split(/(?<=\.)\s+(?=[A-Z])/).map((s) => s.trim()).filter(Boolean);
  if (sentences.length >= 2) return sentences.map((s) => s.replace(/[.\s]+$/, ''));
  // Single point — leave as-is
  return [t.replace(/[.\s]+$/, '')];
}

function boldLead(point) {
  // Bold the first 2-4 significant words (up to first comma/verb boundary)
  const words = point.split(' ');
  const take = Math.min(words.length, 3);
  const lead = words.slice(0, take).join(' ');
  const rest = words.slice(take).join(' ');
  return `**${lead}**${rest ? ' ' + rest : ''}`;
}

function formatCardText(raw) {
  if (!raw) return raw;
  const text = raw.trim();
  if (text.includes('(i)') && text.includes('(ii)')) return text; // already formatted
  const points = splitPoints(text);
  if (points.length <= 1) {
    return formatSentence(text);
  }
  // Build "Intro clause:\n(i) ...\n(ii) ..." — first point often reads as a full clause;
  // derive intro by trimming the first point up to its verb is unreliable, so use a generic summary line.
  const intro = 'Key points:';
  return intro + '\n' + points.map((p, i) => `${ROMAN[i] ?? `(${i + 1})`} ${boldLead(p.replace(/[.;]+$/, ''))}${i < points.length - 1 ? ',' : '.'}`).join('\n');
}

function formatSentence(text) {
  // Bold the leading phrase up to the first comma or 6 words, whichever is first
  const commaIdx = text.indexOf(',');
  const words = text.split(' ');
  const cutAt = Math.min(commaIdx > 0 ? text.slice(0, commaIdx).split(' ').length : words.length, 6);
  const lead = words.slice(0, cutAt).join(' ');
  const rest = words.slice(cutAt).join(' ');
  return `**${lead}**${rest ? ' ' + rest : ''}`;
}

async function main() {
  // Backup originals once
  await sql.query(`ALTER TABLE study_rules ADD COLUMN IF NOT EXISTS body_raw TEXT`);
  await sql.query(`ALTER TABLE study_signs ADD COLUMN IF NOT EXISTS where_text_raw TEXT`);
  await sql.query(`ALTER TABLE study_signs ADD COLUMN IF NOT EXISTS purpose_text_raw TEXT`);
  await sql.query(`ALTER TABLE study_signs ADD COLUMN IF NOT EXISTS action_text_raw TEXT`);
  await sql.query(`UPDATE study_rules SET body_raw = body WHERE body_raw IS NULL`);
  await sql.query(`UPDATE study_signs SET where_text_raw = where_text WHERE where_text_raw IS NULL`);
  await sql.query(`UPDATE study_signs SET purpose_text_raw = purpose_text WHERE purpose_text_raw IS NULL`);
  await sql.query(`UPDATE study_signs SET action_text_raw = action_text WHERE action_text_raw IS NULL`);

  const rules = await sql.query('SELECT id, body FROM study_rules').then((r) => r.rows ?? r);
  for (const r of rules) {
    const formatted = formatCardText(r.body);
    if (formatted !== r.body) await sql.query(`UPDATE study_rules SET body = '${formatted.replace(/'/g, "''")}' WHERE id = ${r.id}`);
  }

  const signs = await sql.query('SELECT id, where_text, purpose_text, action_text FROM study_signs').then((r) => r.rows ?? r);
  for (const s of signs) {
    const w = formatCardText(s.where_text);
    const p = formatCardText(s.purpose_text);
    const a = formatCardText(s.action_text);
    await sql.query(
      `UPDATE study_signs SET where_text = '${(w ?? '').replace(/'/g, "''")}', purpose_text = '${(p ?? '').replace(/'/g, "''")}', action_text = '${(a ?? '').replace(/'/g, "''")}' WHERE id = ${s.id}`
    );
  }

  console.log('rules updated:', rules.length, 'signs updated:', signs.length);
  console.log('sample rule:', JSON.stringify(formatCardText(rules[0].body)).slice(0, 300));
  console.log('sample sign where:', JSON.stringify(formatCardText(signs[0].where_text)).slice(0, 300));
}

main().catch((e) => { console.error(e.message); process.exit(1); });
