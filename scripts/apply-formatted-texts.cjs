// Verifies and applies Gemini-formatted card text against the ORIGINAL *_raw columns.
// Strict rule: after removing **, line-start (i)/(ii)/... markers, ":" and collapsing
// whitespace, the formatted text must equal the original exactly.
// Usage:
//   node scripts/apply-formatted-texts.cjs verify   -> report only
//   node scripts/apply-formatted-texts.cjs apply    -> write passing rows
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
require('dotenv').config();
const sql = neon(process.env.DATABASE_URL);

const FILES = [
  'documents/formatted-rules-body.json',
  'documents/formatted-signs-where.json',
  'documents/formatted-signs-purpose.json',
  'documents/formatted-signs-action.json',
];

function normalize(s) {
  return String(s || '')
    .replace(/\*\*/g, '')
    .replace(/^[ \t]*\(\s*[ivxlcdm]+\)[ \t]*/gim, '')
    .replace(/:/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

(async () => {
  const mode = process.argv[2] === 'apply' ? 'apply' : 'verify';
  const q = async (s) => { const r = await sql.query(s); return r.rows ?? r; };

  const rules = await q(`SELECT id, body_raw FROM study_rules WHERE body_raw IS NOT NULL`);
  const signs = await q(`SELECT id, where_text_raw, purpose_text_raw, action_text_raw FROM study_signs`);
  const raw = {};
  for (const r of rules) raw[`study_rules|${r.id}|body`] = r.body_raw;
  for (const s of signs) {
    raw[`study_signs|${s.id}|where_text`] = s.where_text_raw;
    raw[`study_signs|${s.id}|purpose_text`] = s.purpose_text_raw;
    raw[`study_signs|${s.id}|action_text`] = s.action_text_raw;
  }

  let pass = 0, fail = 0, missing = 0;
  const rejects = [];
  for (const file of FILES) {
    if (!fs.existsSync(file)) { console.log('skip missing', file); continue; }
    let items;
    try { items = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
      console.error('bad JSON in', file, e.message); continue;
    }
    for (const it of items) {
      if (!it.formatted_text || !it.id || !it.table || !it.field) continue;
      const original = raw[`${it.table}|${it.id}|${it.field}`];
      if (original == null) { missing++; console.log('NO ORIGINAL', it.table, it.field, it.id); continue; }
      const a = normalize(original);
      const b = normalize(it.formatted_text);
      if (a !== b) {
        fail++;
        rejects.push({ table: it.table, field: it.field, id: it.id, original, formatted: it.formatted_text });
        continue;
      }
      pass++;
      if (mode === 'apply') {
        const col = it.field.replace(/[^a-z_]/g, '');
        const tbl = it.table === 'study_rules' ? 'study_rules' : 'study_signs';
        await q(`UPDATE ${tbl} SET ${col} = '${it.formatted_text.replace(/'/g, "''")}' WHERE id = ${it.id}`);
      }
    }
    console.log('done', file);
  }

  fs.writeFileSync('documents/formatting-rejects.json', JSON.stringify(rejects, null, 1));
  console.log(`${mode}: pass ${pass}, fail ${fail}, no-original ${missing}`);
  console.log('rejects written to documents/formatting-rejects.json');
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
