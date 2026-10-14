// Applies Gemini-formatted text (documents/formatted-*.json) to study_rules / study_signs.
// Usage:
//   node scripts/apply-formatted-texts.cjs verify   -> checks only, reports reworded rows
//   node scripts/apply-formatted-texts.cjs apply    -> writes rows that pass verification
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const sql = neon(process.env.DATABASE_URL);

const FILES = [
  'documents/formatted-rules-body.json',
  'documents/formatted-signs-where.json',
  'documents/formatted-signs-purpose.json',
  'documents/formatted-signs-action.json',
];

function words(s) {
  if (!s) return [];
  return String(s)
    .replace(/\*\*/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\(\s*[ivxl]+\)\s*/gi, ' ')
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

// Zero-reword rule: everything after the intro clause / first list marker must use
// exactly the raw words (any order, any **bold**, any numbering/newlines). Extra
// words are tolerated only in an intro clause (<= 10 words before the first (i)).
function checkFaithful(raw, out) {
  const text = String(out);
  const m = /\(\s*[ivxl]+\)\s*/i.exec(text);
  const beforeWords = m ? words(text.slice(0, m.index)).length : 0;
  const hasIntro = !!m && beforeWords > 0 && beforeWords <= 10;
  const rawCounts = {};
  for (const w of words(raw)) rawCounts[w] = (rawCounts[w] || 0) + 1;
  const contentWords = hasIntro ? words(text).slice(beforeWords) : words(text);
  const extras = [];
  for (const w of contentWords) {
    if (rawCounts[w] > 0) rawCounts[w]--;
    else extras.push(w);
  }
  const dropped = Object.entries(rawCounts).filter(([, c]) => c > 0).map(([w, c]) => `${w}x${c}`);
  return { ok: extras.length === 0 && dropped.length === 0, extras: extras.slice(0, 5), dropped: dropped.slice(0, 5) };
}

(async () => {
  const mode = process.argv[2] === 'apply' ? 'apply' : 'verify';
  let total = 0, failed = 0;
  for (const f of FILES) {
    if (!fs.existsSync(f)) { console.log('skip missing', f); continue; }
    let items;
    try { items = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) {
      console.error('bad JSON in', f, e.message); continue;
    }
    const idToRaw = {};
    for (const it of items) {
      if (!it.formatted_text || !it.id || !it.table || !it.field) continue;
      let raw;
      if (it.table === 'study_rules' && it.field === 'body') {
        raw = (await sql.query(`SELECT body_raw FROM study_rules WHERE id = ${it.id}`).then((r) => r.rows ?? r))[0]?.body_raw;
      } else if (it.table === 'study_signs' && ['where_text', 'purpose_text', 'action_text'].includes(it.field)) {
        raw = (await sql.query(`SELECT ${it.field.replace(/[^a-z_]/g, '')}_raw FROM study_signs WHERE id = ${it.id}`).then((r) => r.rows ?? r))[0]?.[`${it.field}_raw`];
      }
      if (raw == null) { console.log('skip (no raw backup)', f, it.table, it.field, it.id); continue; }
      const chk = checkFaithful(raw, it.formatted_text);
      if (!chk.ok) {
        failed++;
        console.log('REJECT', f, it.table, it.field, 'id', it.id,
          chk.extras.length ? `added: ${chk.extras.join(', ')}` : `dropped: ${chk.dropped.join(', ')}`);
        continue;
      }
      if (mode === 'apply') {
        if (it.table === 'study_rules') {
          await sql.query(`UPDATE study_rules SET body = '${it.formatted_text.replace(/'/g, "''")}' WHERE id = ${it.id}`);
        } else {
          await sql.query(`UPDATE study_signs SET ${it.field.replace(/[^a-z_]/g, '')} = '${it.formatted_text.replace(/'/g, "''")}' WHERE id = ${it.id}`);
        }
        total++;
      }
    }
    console.log('done', f);
  }
  console.log(`${mode}: ${total} rows ${mode === 'apply' ? 'updated' : 'would update'}, ${failed} rejected`);
})();
