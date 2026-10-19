// Merges Gemini batch replies into the four formatted-*.json files and verifies them.
// Usage: node scripts/merge-format-batches.cjs
// Reads documents/batches/output/batch-*.json (content-based, filename order irrelevant).
// Repairs common Gemini artifacts: ```json fences, [cite: N], unescaped quotes.
// Auto-reconciles only trailing-period discrepancies; everything else must pass strict check.
const fs = require('fs');
const path = require('path');

const inputDir = path.join('documents', 'batches', 'input');
const outputDir = path.join('documents', 'batches', 'output');
const fixedDir = path.join('documents', 'batches', 'fixed');
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

function clean(raw) {
  let s = raw.replace(/^\uFEFF/, '').trim();
  s = s.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '');
  s = s.replace(/\[cite:\s*\d+\]/g, '');
  return s.trim();
}

function repairFormattedText(raw) {
  const re = /"formatted_text"\s*:\s*"/;
  let out = '';
  let i = 0;
  for (;;) {
    const m = raw.slice(i).match(re);
    if (!m) { out += raw.slice(i); break; }
    const start = i + m.index + m[0].length;
    out += raw.slice(i, start);
    let j = start;
    while (j < raw.length) {
      const ch = raw[j];
      if (ch === '\\') { out += raw.slice(j, j + 2); j += 2; continue; }
      if (ch === '"') {
        let k = j + 1;
        while (k < raw.length && /\s/.test(raw[k])) k++;
        const next = raw[k];
        const isEnd = next === '}' || (next === ',' && /^\s*"/.test(raw.slice(k + 1)));
        if (isEnd) { out += '"'; j++; break; }
        out += '\\"'; j++; continue;
      }
      out += ch; j++;
    }
    i = j;
  }
  return out;
}

function load(file) {
  let s = clean(fs.readFileSync(file, 'utf8'));
  try { return JSON.parse(s); } catch (e) { s = repairFormattedText(s); }
  const arr = JSON.parse(s);
  fs.mkdirSync(fixedDir, { recursive: true });
  fs.writeFileSync(path.join(fixedDir, path.basename(file)), JSON.stringify(arr, null, 1));
  return arr;
}

// Only reconcile periods at the very end of the text.
function autoFix(original, formatted, log, id) {
  const a = normalize(original);
  const b = normalize(formatted);
  if (a === b) return formatted;
  const suffix = /^(.*?)(\.+)$/s;
  const ma = a.match(suffix);
  const mb = b.match(suffix);
  const abase = ma ? ma[1] : a;
  const bbase = mb ? mb[1] : b;
  if (abase === bbase) {
    const f = formatted.replace(/\s*$/, '').replace(/\.+$/, '') + (ma ? ma[2] : '');
    if (normalize(f) === a) {
      log.push({ id, original: a, before: b, after: normalize(f) });
      return f;
    }
  }
  return null;
}

const expected = JSON.parse(fs.readFileSync('documents/card-texts-to-format.json', 'utf8'));
const originals = new Map(expected.map((x) => [`${x.table}|${x.field}|${x.id}`, x.text]));

const merged = {};
for (const key of Object.keys(FILES)) merged[key] = new Map();

const files = fs.readdirSync(outputDir).filter((f) => /^batch-.*\.json$/.test(f)).sort();
if (!files.length) {
  console.log('no output files found in', outputDir);
  process.exit(1);
}

const autofixed = [];
let bad = 0, dupes = 0, conflicts = 0, replaced = 0, failed = 0;
for (const f of files) {
  let arr;
  try { arr = load(path.join(outputDir, f)); } catch (e) {
    console.log('UNREPAIRABLE', f, e.message); bad++; continue;
  }
  if (!Array.isArray(arr)) { console.log('NOT AN ARRAY', f); bad++; continue; }
  const before = Object.values(merged).reduce((n, m) => n + m.size, 0);
  for (const it of arr) {
    const key = `${it.table}.${it.field}`;
    if (!merged[key]) { console.log('unknown field', key, 'in', f); bad++; continue; }
    if (!it.id || !it.formatted_text) continue;
    const k = `${it.table}|${it.field}|${it.id}`;
    const original = originals.get(k);
    if (original && normalize(original) !== normalize(it.formatted_text)) {
      const fixed = autoFix(original, it.formatted_text, autofixed, k);
      if (fixed) it.formatted_text = fixed;
    }
    const passes = original ? normalize(original) === normalize(it.formatted_text) : false;
    if (merged[key].has(k)) {
      dupes++;
      const cur = merged[key].get(k);
      const curPasses = original ? normalize(original) === normalize(cur.formatted_text) : false;
      if (!curPasses && passes) { merged[key].set(k, it); replaced++; }
      else if (cur.formatted_text !== it.formatted_text) conflicts++;
      continue;
    }
    if (!passes) failed++;
    merged[key].set(k, it);
  }
  console.log(`${f}: ${arr.length} items (${Object.values(merged).reduce((n, m) => n + m.size, 0) - before} new)`);
}

let total = 0;
for (const [key, file] of Object.entries(FILES)) {
  const items = [...merged[key].values()];
  if (!items.length) { console.log('no items for', key); continue; }
  fs.writeFileSync(file, JSON.stringify(items, null, 1));
  total += items.length;
  console.log(`${file}: ${items.length} items`);
}
fs.writeFileSync('documents/batches/autofixed-periods.json', JSON.stringify(autofixed, null, 1));
console.log(`merged ${total} unique items from ${files.length} files, ${bad} bad, ${dupes} duplicates (${replaced} upgraded, ${conflicts} conflicting), ${autofixed.length} period-autofixed, ${failed} still failing`);
console.log('period reconciliations logged to documents/batches/autofixed-periods.json');

if (bad || total !== expected.length) {
  const got = new Set();
  for (const m of Object.values(merged)) for (const it of m.values()) got.add(`${it.table}|${it.field}|${it.id}`);
  const missing = expected.filter((x) => !got.has(`${x.table}|${x.field}|${x.id}`));
  const groups = {};
  for (const x of missing) (groups[`${x.table}.${x.field}`] ||= []).push(x.id);
  console.log(`MISSING ${missing.length} items:`);
  for (const [k, ids] of Object.entries(groups)) console.log(`  ${k}: ${ids.length} -> ids ${ids[0]}..${ids[ids.length - 1]}`);
  console.log('Re-run the corresponding input batch(es) in Gemini, save under any batch-*-out.json name.');
}
