const fs = require('fs');

function normalize(s) {
  if (!s) return '';
  return String(s)
    .replace(/\*\*/g, '')
    .replace(/\r/g, '')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\(\s*[ivxl]+\)\s*/gi, '')
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const items = JSON.parse(fs.readFileSync('documents/card-texts-to-format.json', 'utf8'));
const map = new Map();
for (const it of items) map.set(`${it.table}|${it.field}|${it.id}`, it.text);

const files = [
  'documents/formatted-rules-body.json',
  'documents/formatted-signs-where.json',
  'documents/formatted-signs-purpose.json',
  'documents/formatted-signs-action.json',
];

let total = 0, mismatched = 0;
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const arr = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const it of arr) {
    total++;
    const raw = map.get(`${it.table}|${it.field}|${it.id}`);
    if (raw === undefined) { console.log('ORPHAN', it.table, it.field, it.id); mismatched++; continue; }
    if (normalize(raw) !== normalize(it.formatted_text)) {
      mismatched++;
      if (mismatched <= 12) {
        console.log('--- MISMATCH', it.table, it.field, 'id', it.id);
        console.log('RAW:', normalize(raw).slice(0, 200));
        console.log('NEW:', normalize(it.formatted_text).slice(0, 200));
      }
    }
  }
}
console.log(`checked ${total} rows, ${mismatched} rows differ beyond numbering/highlights`);
