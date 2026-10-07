const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
require('dotenv').config();
const sql = neon(process.env.DATABASE_URL);

(async () => {
  const rules = await sql.query(`SELECT id, body FROM study_rules WHERE body NOT LIKE '%**%' AND body NOT LIKE '%(i)%'`).then(r => r.rows ?? r);
  const signs = await sql.query(`SELECT id, where_text, purpose_text, action_text FROM study_signs WHERE action_text NOT LIKE '%**%' AND action_text NOT LIKE '%(i)%'`).then(r => r.rows ?? r);

  const items = [];
  for (const r of rules) items.push({ id: r.id, table: 'study_rules', field: 'body', text: r.body });
  for (const s of signs) {
    if (s.where_text) items.push({ id: s.id, table: 'study_signs', field: 'where_text', text: s.where_text });
    if (s.purpose_text) items.push({ id: s.id, table: 'study_signs', field: 'purpose_text', text: s.purpose_text });
    if (s.action_text) items.push({ id: s.id, table: 'study_signs', field: 'action_text', text: s.action_text });
  }

  fs.writeFileSync('documents/card-texts-to-format.json', JSON.stringify(items, null, 1));
  console.log('rules rows:', rules.length, 'signs rows:', signs.length, 'total items:', items.length);
})();
