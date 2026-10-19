// Splits the original-text export into paste-sized batches for Gemini.
// Usage: node scripts/make-format-batches.cjs [batchSize]
// Writes documents/batches/input/batch-001.json ... and clears old output.
const fs = require('fs');
const path = require('path');

const size = Number(process.argv[2]) || 50;
const items = JSON.parse(fs.readFileSync('documents/card-texts-to-format.json', 'utf8'));
const inputDir = path.join('documents', 'batches', 'input');
const outputDir = path.join('documents', 'batches', 'output');

for (const dir of [inputDir, outputDir]) {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
}

let n = 0;
const groups = {};
for (const it of items) {
  const key = `${it.table}.${it.field}`;
  (groups[key] ||= []).push(it);
}
for (const [key, group] of Object.entries(groups)) {
  for (let i = 0; i < group.length; i += size) {
    n++;
    const chunk = group.slice(i, i + size);
    const name = `batch-${String(n).padStart(3, '0')}.json`;
    fs.writeFileSync(path.join(inputDir, name), JSON.stringify(chunk, null, 1));
    console.log(`${name}: ${key}, ${chunk.length} items`);
  }
}

console.log(`created ${n} input batches of up to ${size} items in ${inputDir}`);
console.log(`save each Gemini reply as ${outputDir}\\batch-XXX-out.json (same number)`);
console.log('then run: node scripts/merge-format-batches.cjs');
