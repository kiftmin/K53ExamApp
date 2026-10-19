// Exports the ORIGINAL card text from the *_raw backup columns for Gemini formatting.
// Usage: node scripts/export-card-texts.cjs [--all]
//   default: all original items (recommended when redoing formatting from scratch)
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
require('dotenv').config();
const sql = neon(process.env.DATABASE_URL);

(async () => {
  const q = async (s) => { const r = await sql.query(s); return r.rows ?? r; };
  const rules = await q(`SELECT id, body_raw FROM study_rules WHERE body_raw IS NOT NULL ORDER BY id`);
  const signs = await q(`SELECT id, where_text_raw, purpose_text_raw, action_text_raw FROM study_signs ORDER BY id`);

  const items = [];
  for (const r of rules) items.push({ id: r.id, table: 'study_rules', field: 'body', text: r.body_raw });
  for (const s of signs) {
    if (s.where_text_raw) items.push({ id: s.id, table: 'study_signs', field: 'where_text', text: s.where_text_raw });
    if (s.purpose_text_raw) items.push({ id: s.id, table: 'study_signs', field: 'purpose_text', text: s.purpose_text_raw });
    if (s.action_text_raw) items.push({ id: s.id, table: 'study_signs', field: 'action_text', text: s.action_text_raw });
  }

  fs.writeFileSync('documents/card-texts-to-format.json', JSON.stringify(items, null, 1));
  const counts = {};
  for (const it of items) counts[`${it.table}.${it.field}`] = (counts[`${it.table}.${it.field}`] || 0) + 1;
  console.log('rules rows:', rules.length, 'signs rows:', signs.length, 'total items:', items.length);
  console.log(JSON.stringify(counts));
})();
