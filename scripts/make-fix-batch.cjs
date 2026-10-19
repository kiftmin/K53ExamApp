// Builds a repair batch from documents/formatting-rejects.json.
// Usage: node scripts/make-fix-batch.cjs
const fs = require('fs');

const rejects = JSON.parse(fs.readFileSync('documents/formatting-rejects.json', 'utf8'));

function normalize(s) {
  return String(s || '')
    .replace(/\*\*/g, '')
    .replace(/^[ \t]*\(\s*[ivxlcdm]+\)[ \t]*/gim, '')
    .replace(/:/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function diffWords(a, b) {
  const A = a.split(' ');
  const B = b.split(' ');
  const n = A.length, m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const removed = [], added = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) removed.push(A[i++]);
    else added.push(B[j++]);
  }
  while (i < n) removed.push(A[i++]);
  while (j < m) added.push(B[j++]);
  return { removed, added };
}

const items = rejects.map((r) => {
  const a = normalize(r.original), b = normalize(r.formatted);
  const d = diffWords(a, b);
  return {
    id: r.id,
    table: r.table,
    field: r.field,
    original_text: r.original,
    previous_attempt: r.formatted,
    problem: `removed [${d.removed.join(' | ')}]; added [${d.added.join(' | ')}]`,
  };
});

fs.writeFileSync('documents/batches/input/fix-001.json', JSON.stringify(items, null, 1));
console.log(`wrote ${items.length} repair items to documents/batches/input/fix-001.json`);
