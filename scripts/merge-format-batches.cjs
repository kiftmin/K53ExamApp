// Merges Gemini batch replies into the four formatted-*.json files and verifies them.
// Usage: node scripts/merge-format-batches.cjs
// Reads documents/batches/output/batch-*-out.json
const fs = require('fs');
const path = require('path');

const inputDir = path.join('documents', 'batches', 'input');
const outputDir = path.join('documents', 'batches', 'output');
const FILES = {
  'study_rules.body': 'documents/formatted-rules-body.json',
  'study_signs.where_text': 'documents/formatted-signs-where.json',
  'study_signs.purpose_text': 'documents/formatted-signs-purpose.json',
  'study_signs.action_text': 'documents/formatted-signs-action.json',
};

function normalize(s) {
  return String(s || '')
    .replace(/\*\*/g, '')
    .replace(/^[ \t]*\(\s*[ivxlcdm]+\)[ \t]*/gim, '')
    .replace(/:/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const merged = {};
for (const key of Object.keys(FILES)) merged[key] = [];

const files = fs.readdirSync(outputDir).filter((f) => /^batch-\d+-out\.json$/.test(f)).sort();
if (!files.length) {
  console.log('no output files found in', outputDir);
  process.exit(1);
}

let bad = 0, missing = 0;
for (const f of files) {
  let arr;
  try { arr = JSON.parse(fs.readFileSync(path.join(outputDir, f), 'utf8')); } catch (e) {
    console.log('BAD JSON', f, e.message); bad++; continue;
  }
  if (!Array.isArray(arr)) { console.log('NOT AN ARRAY', f); bad++; continue; }
  for (const it of arr) {
    if (!it.id || !it.table || !it.field || !it.formatted_text) { missing++; continue; }
    const key = `${it.table}.${it.field}`;
    if (!merged[key]) { console.log('unknown field', key, 'in', f); bad++; continue; }
    merged[key].push(it);
  }
}

let total = 0;
for (const [key, file] of Object.entries(FILES)) {
  const items = merged[key];
  if (!items.length) { console.log('no items for', key); continue; }
  fs.writeFileSync(file, JSON.stringify(items, null, 1));
  total += items.length;
  console.log(`${file}: ${items.length} items`);
}
console.log(`merged ${total} items from ${files.length} batch files, ${bad} bad files, ${missing} malformed items`);
console.log('next: node scripts/apply-formatted-texts.cjs verify');
