// Imports Gemini-generated flashcard questions into study_rules.question.
// Usage: node scripts/import-rule-questions.cjs [apply]
// Without "apply" it only validates coverage.
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);
const FILE = 'documents/rules-with-questions.json';

(async () => {
  const apply = process.argv[2] === 'apply';
  const items = JSON.parse(fs.readFileSync(FILE, 'utf8'));

  const bad = items.filter((r) => typeof r.question !== 'string' || !r.question.trim() || !r.question.trim().endsWith('?'));
  if (bad.length) throw new Error(`invalid questions for ids: ${bad.map((r) => r.id).join(',')}`);
  if (new Set(items.map((r) => r.id)).size !== items.length) throw new Error('duplicate ids in source file');

  if (!apply) {
    console.log(`validated ${items.length} questions in ${FILE} (dry run)`);
    return;
  }

  await sql`ALTER TABLE study_rules ADD COLUMN IF NOT EXISTS question TEXT`;
  const dbRows = await sql`SELECT id FROM study_rules ORDER BY id`;
  const dbIds = new Set(dbRows.map((r) => r.id));
  const absent = items.filter((r) => !dbIds.has(r.id)).map((r) => r.id);
  if (absent.length) throw new Error(`rules not found in DB: ${absent.join(',')}`);

  let updated = 0;
  for (const r of items) {
    await sql`UPDATE study_rules SET question = ${r.question.trim()}, updated_at = NOW() WHERE id = ${r.id}`;
    updated++;
  }

  const [{ total, with_question }] = await sql`
    SELECT COUNT(*)::int AS total, COUNT(NULLIF(question, ''))::int AS with_question
    FROM study_rules
  `;
  const missing = await sql`SELECT id FROM study_rules WHERE question IS NULL OR question = '' ORDER BY id`;
  console.log(`updated ${updated} rules`);
  console.log(`study_rules: ${with_question}/${total} have a question`);
  if (missing.length) console.log(`still missing: ${missing.map((r) => r.id).join(',')}`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
