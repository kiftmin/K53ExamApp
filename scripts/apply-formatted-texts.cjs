// Applies Gemini-formatted text (documents/formatted-*.json) to study_rules / study_signs.
// Usage: node scripts/apply-formatted-texts.cjs
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

(async () => {
  let total = 0;
  for (const f of FILES) {
    if (!fs.existsSync(f)) { console.log('skip missing', f); continue; }
    let items;
    try { items = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) {
      console.error('bad JSON in', f, e.message); continue;
    }
    for (const it of items) {
      if (!it.formatted_text || !it.id || !it.table || !it.field) continue;
      if (it.table === 'study_rules' && it.field === 'body') {
        await sql.query(`UPDATE study_rules SET body = '${it.formatted_text.replace(/'/g, "''")}' WHERE id = ${it.id}`);
        total++;
      } else if (it.table === 'study_signs' && ['where_text', 'purpose_text', 'action_text'].includes(it.field)) {
        const col = `${it.field}_formatted`;
        // update the live column directly; it was reverted to raw already
        await sql.query(`UPDATE study_signs SET ${it.field.replace(/[^a-z_]/g, '')} = '${it.formatted_text.replace(/'/g, "''")}' WHERE id = ${it.id}`);
        total++;
      }
    }
    console.log('applied', f);
  }
  console.log('total rows updated:', total);
})();
