// Merges Gemini rule-question batches into documents/rules-with-questions.json.
// Usage: node scripts/merge-rule-questions.cjs
const fs = require('fs');
const path = require('path');

const INPUT_DIR = 'documents/rule-question-batches/input';
const OUTPUT_DIR = 'documents/rule-question-batches/output';
const RULES_FILE = 'documents/rules-data.json';
const MERGED_FILE = 'documents/rules-with-questions.json';

// Manual overrides for compound/ambiguous Gemini questions.
const OVERRIDES = {
  1: "What does a learner's licence test cover?",
  41: "Which vehicles are classified as emergency vehicles?",
  99: "On which side must a vehicle pass another?",
  137: "On which side must a sidecar be attached?",
  191: "What is a licence disc?",
};

function clean(raw) {
  return raw.replace(/^\uFEFF/, '').trim()
    .replace(/^```[a-zA-Z]*\s*/, '')
    .replace(/\s*```$/, '')
    .trim();
}

const rules = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
const rulesById = new Map(rules.map((r) => [r.id, r]));

const expected = new Map();
for (const f of fs.readdirSync(INPUT_DIR).sort()) {
  for (const r of JSON.parse(fs.readFileSync(path.join(INPUT_DIR, f), 'utf8'))) expected.set(r.id, r);
}

const questions = new Map();
for (const f of fs.readdirSync(OUTPUT_DIR).sort()) {
  if (!/^batch-.*-out\.json$/.test(f)) continue;
  const items = JSON.parse(clean(fs.readFileSync(path.join(OUTPUT_DIR, f), 'utf8')));
  if (!Array.isArray(items)) throw new Error(`${f} is not an array`);
  for (const it of items) {
    if (typeof it.id !== 'number' || typeof it.question !== 'string') {
      throw new Error(`${f}: bad item ${JSON.stringify(it)}`);
    }
    if (questions.has(it.id)) throw new Error(`duplicate id ${it.id} in ${f}`);
    questions.set(it.id, it.question.trim());
  }
}

const missing = [...expected.keys()].filter((id) => !questions.has(id));
const extra = [...questions.keys()].filter((id) => !expected.has(id));
if (missing.length) throw new Error(`missing ids: ${missing.join(',')}`);
if (extra.length) throw new Error(`unexpected ids: ${extra.join(',')}`);
if (rules.length !== expected.size) throw new Error(`rule count mismatch: ${rules.length} vs ${expected.size}`);

for (const [id, q] of Object.entries(OVERRIDES)) questions.set(Number(id), q);

const merged = rules.map((r) => {
  const q = questions.get(r.id);
  if (!q) throw new Error(`no question for rule ${r.id}`);
  if (!q.endsWith('?')) throw new Error(`question for ${r.id} does not end with ?`);
  if ((q.match(/\?/g) || []).length > 1) throw new Error(`question for ${r.id} contains multiple ?`);
  if (/\*\*|\n|\r/.test(q)) throw new Error(`question for ${r.id} contains markdown/newline`);
  if (!rulesById.has(r.id)) throw new Error(`unknown rule ${r.id}`);
  return { ...r, question: q };
});

fs.writeFileSync(MERGED_FILE, JSON.stringify(merged, null, 2));
console.log(`merged ${merged.length} rules -> ${MERGED_FILE}`);
console.log(`overrides applied: ${Object.keys(OVERRIDES).join(', ')}`);
