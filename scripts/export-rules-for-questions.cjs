// Exports every rule (plain original text) for Gemini question generation,
// and splits it into paste-sized batch files.
// Usage: node scripts/export-rules-for-questions.cjs [batchSize]
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const sql = neon(process.env.DATABASE_URL);

(async () => {
  const q = async (s) => { const r = await sql.query(s); return r.rows ?? r; };
  const rows = await q(`
    SELECT id, section_ref, heading, subheading, title, body_raw AS body, applicable_codes
    FROM study_rules
    ORDER BY id
  `);

  const items = rows.map((r) => ({
    id: r.id,
    section_ref: r.section_ref,
    heading: r.heading,
    subheading: r.subheading,
    ...(r.title ? { title: r.title } : {}),
    body: r.body,
    applicable_codes: r.applicable_codes,
  }));

  fs.writeFileSync('documents/rules-data.json', JSON.stringify(items, null, 1));
  console.log(`wrote ${items.length} rules to documents/rules-data.json`);

  const size = Number(process.argv[2]) || 50;
  const inputDir = path.join('documents', 'rule-question-batches', 'input');
  const outputDir = path.join('documents', 'rule-question-batches', 'output');
  for (const dir of [inputDir, outputDir]) {
    fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
  }

  let n = 0;
  for (let i = 0; i < items.length; i += size) {
    n++;
    const name = `batch-${String(n).padStart(3, '0')}.json`;
    fs.writeFileSync(path.join(inputDir, name), JSON.stringify(items.slice(i, i + size), null, 1));
    console.log(`${name}: ${items.slice(i, i + size).length} rules`);
  }
  console.log(`created ${n} batches in ${inputDir}`);
})();
