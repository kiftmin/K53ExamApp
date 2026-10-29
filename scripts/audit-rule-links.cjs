// Audit existing rule-question links with a stricter, polarity-aware review.
// Usage:
//   node scripts/audit-rule-links.cjs
//   node scripts/audit-rule-links.cjs --qids 529,509,301,39,58,5,18,339,523
//   node scripts/audit-rule-links.cjs --limit 40
// Reads .env, study_rules/rule_questions/questions, and writes
// documents/rule-question-links/output/current-links-audit.json plus suspects.

const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'documents', 'rule-question-links');
const OUTDIR = path.join(DATA_DIR, 'output');
const RULES_PATH = path.join(DATA_DIR, 'rules.json');
const QUESTIONS_PATH = path.join(DATA_DIR, 'rule-questions.json');
const AUDIT_PATH = path.join(OUTDIR, 'current-links-audit.json');
const SUSPECT_PATH = path.join(OUTDIR, 'current-links-suspects.json');
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const PAIRS_PER_BATCH = 20;
const API_DELAY_MS = 1200;

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const LIMIT = Number(argValue('--limit', '0')) || 0;
const QIDS = new Set(
  String(argValue('--qids', ''))
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0)
);

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
};

const PROMPT = `You are a strict precision auditor for a South African K53 study app.

Each pair is an EXISTING link between an exam question and a rule card. Decide whether the rule card belongs on that question.

First identify what the question asks:
- A normal question wants the true statement/definition/value/procedure.
- A negative question asks which statement is wrong, incorrect, not correct, false, or not allowed. Here the selected correct option is the WRONG statement. A rule that directly contradicts that selected statement is a valid supporting rule.
- A combination or "all of the above" question has several correct statements in the selected option. A rule that directly supports at least one of those correct statements is valid, even if other rules cover the rest.
- "None of the above" means every listed statement is false. A rule that directly contradicts one of those false statements is valid.

ACCEPT when:
- The rule directly entails the selected answer, using different wording, word order, voice, or tense.
- The question asks for a wrong statement and the rule directly contradicts the selected wrong statement.
- The answer is a combination and the rule directly supports one correct part.
- The rule states the same fact with different detail, without adding a condition that changes the answer.

REJECT when:
- The link is based only on a shared topic, heading, subheading, keyword, or general subject.
- The rule is only a general definition of a term used in the question, without stating the fact asked.
- The rule gives a different number, unit, threshold, time, distance, age, vehicle class, or condition.
- The rule supports only an option that is NOT part of the correct answer.
- The rule is about a different scenario, even if it uses similar words.
- The rule adds an exception or condition that changes the meaning of the answer.
- The question asks for a wrong statement but the rule agrees with that wrong statement instead of contradicting it.

Numbers must match exactly. A rule that says 2.5 m does not support an answer of 2.4 m. A rule that says 900 mm does not support 850 mm. A general rule about stopping near a bridge does not support a specific "5 m from a bridge" ban unless it states that distance.

Be strict. A false link is worse than a missing link. Do not reward a plausible topic match.

Return ONLY a JSON array with one object for every pair, in the same order. Use the exact question_id and rule_id.
[
  {
    "question_id": 529,
    "rule_id": 175,
    "question_type": "specific_value",
    "supported": false,
    "confidence": "high",
    "reason": "Rule 175 only defines a bridge; it does not state the 5 m stopping prohibition."
  },
  {
    "question_id": 58,
    "rule_id": 46,
    "question_type": "which_is_wrong",
    "supported": true,
    "confidence": "high",
    "reason": "The question asks for the wrong statement; rule 46 states the opposite duty."
  }
]

Field rules:
- question_type: one of normal, which_is_wrong, combination, none_of_the_above.
- supported: boolean.
- confidence: high, medium, or low.
- reason: one short sentence, maximum 25 words.
- No markdown, no extra fields.`;

async function connectDb() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set in .env');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

async function loadPairs() {
  const rules = readJson(RULES_PATH);
  const questions = readJson(QUESTIONS_PATH);
  const ruleMap = new Map(rules.map((rule) => [rule.id, rule]));
  const questionMap = new Map(questions.map((question) => [question.id, question]));
  const client = await connectDb();
  let rows;
  try {
    ({ rows } = await client.query('SELECT id, rule_id, question_id FROM rule_questions ORDER BY question_id, rule_id'));
  } finally {
    await client.end();
  }
  const pairs = [];
  for (const link of rows) {
    const question = questionMap.get(link.question_id);
    const rule = ruleMap.get(link.rule_id);
    if (!question || !rule) continue;
    if (QIDS.size > 0 && !QIDS.has(question.question_number)) continue;
    pairs.push({
      link_id: link.id,
      question_id: question.id,
      rule_id: rule.id,
      question_number: question.question_number,
      license_code: question.license_code,
      question_text: question.question_text,
      options: question.options,
      correct_answer: question.correct_answer,
      rule: {
        section_ref: rule.section_ref,
        heading: rule.heading,
        subheading: rule.subheading,
        title: rule.title,
        body: rule.body,
      },
    });
  }
  return LIMIT > 0 ? pairs.slice(0, LIMIT) : pairs;
}

async function callGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set in .env');
  let attempt = 0;
  for (;;) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0,
              topP: 0.7,
              maxOutputTokens: 8192,
              thinkingConfig: { thinkingBudget: 0 },
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    question_id: { type: 'INTEGER' },
                    rule_id: { type: 'INTEGER' },
                    question_type: {
                      type: 'STRING',
                      enum: ['normal', 'which_is_wrong', 'combination', 'none_of_the_above'],
                    },
                    supported: { type: 'BOOLEAN' },
                    confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
                    reason: { type: 'STRING' },
                  },
                  required: ['question_id', 'rule_id', 'question_type', 'supported', 'confidence', 'reason'],
                },
              },
            },
          }),
        }
      );
      if (res.status === 429 || res.status === 503) {
        attempt += 1;
        if (attempt > 6) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
        await new Promise((resolve) => setTimeout(resolve, 3000 * attempt));
        continue;
      }
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.map((part) => part.text || '').join('') || '';
      if (!text) throw new Error(`Gemini returned no text (finishReason: ${candidate?.finishReason || 'unknown'})`);
      return { text, finishReason: candidate?.finishReason || 'unknown' };
    } catch (error) {
      attempt += 1;
      if (attempt > 6) throw error;
      await new Promise((resolve) => setTimeout(resolve, 3000 * attempt));
    }
  }
}

function parseResponse(text) {
  const raw = String(text || '').trim();
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start === -1 || end <= start) throw new Error('Gemini did not return a JSON array.');
    return JSON.parse(raw.slice(start, end + 1));
  }
}

function normalize(rows, batch) {
  const expected = new Map(batch.map((pair) => [`${pair.question_id}:${pair.rule_id}`, pair]));
  const seen = new Set();
  const out = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = `${Number(row?.question_id)}:${Number(row?.rule_id)}`;
    const pair = expected.get(key);
    if (!pair || seen.has(key)) continue;
    seen.add(key);
    out.push({
      link_id: pair.link_id,
      question_id: pair.question_id,
      rule_id: pair.rule_id,
      question_number: pair.question_number,
      question_type: ['normal', 'which_is_wrong', 'combination', 'none_of_the_above'].includes(row.question_type)
        ? row.question_type
        : 'normal',
      supported: row.supported === true,
      confidence: ['high', 'medium', 'low'].includes(row.confidence) ? row.confidence : 'low',
      reason: typeof row.reason === 'string' ? row.reason.trim() : '',
      question_text: pair.question_text,
      correct_answer: pair.correct_answer,
      rule_section_ref: pair.rule.section_ref,
      rule_subheading: pair.rule.subheading,
      rule_body: pair.rule.body,
    });
  }
  for (const pair of batch) {
    const key = `${pair.question_id}:${pair.rule_id}`;
    if (seen.has(key)) continue;
    out.push({
      link_id: pair.link_id,
      question_id: pair.question_id,
      rule_id: pair.rule_id,
      question_number: pair.question_number,
      question_type: 'normal',
      supported: false,
      confidence: 'low',
      reason: 'No audit result returned for this link.',
      question_text: pair.question_text,
      correct_answer: pair.correct_answer,
      rule_section_ref: pair.rule.section_ref,
      rule_subheading: pair.rule.subheading,
      rule_body: pair.rule.body,
    });
  }
  return out;
}

async function main() {
  const pairs = await loadPairs();
  const batches = [];
  for (let index = 0; index < pairs.length; index += PAIRS_PER_BATCH) {
    batches.push(pairs.slice(index, index + PAIRS_PER_BATCH));
  }
  console.log(`Auditing ${pairs.length} existing links in ${batches.length} batch(es) using ${MODEL}.`);

  const audit = [];
  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    const prompt = `${PROMPT}\n\nPAIRS:\n${JSON.stringify(batch)}\n\nReturn exactly ${batch.length} objects.`;
    let verified = null;
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const result = await callGemini(prompt);
      try {
        const rows = parseResponse(result.text);
        if (!Array.isArray(rows)) throw new Error('Gemini returned JSON that is not an array.');
        if (rows.length < batch.length) {
          throw new Error(`Gemini returned ${rows.length}/${batch.length} rows (finishReason: ${result.finishReason}).`);
        }
        verified = normalize(rows, batch);
        break;
      } catch (error) {
        lastError = error;
        console.warn(`Audit batch ${index + 1}, attempt ${attempt} failed: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, 2500 * attempt));
      }
    }
    if (!verified) throw new Error(`Audit batch ${index + 1} failed: ${lastError?.message}`);
    audit.push(...verified);
    const rejected = verified.filter((row) => !row.supported).length;
    console.log(`Audit batch ${index + 1}/${batches.length}: ${verified.length} links, ${rejected} suspect.`);
    await new Promise((resolve) => setTimeout(resolve, API_DELAY_MS));
  }

  audit.sort((a, b) => a.question_number - b.question_number || a.rule_id - b.rule_id);
  const suspects = audit.filter((row) => !row.supported);
  writeJson(AUDIT_PATH, audit);
  writeJson(SUSPECT_PATH, suspects);
  console.log(
    `Done: ${audit.length - suspects.length}/${audit.length} supported, ${suspects.length} suspect. Wrote ${path.basename(AUDIT_PATH)}.`
  );
  for (const row of suspects) {
    console.log(`  Q${row.question_number} id=${row.question_id} R${row.rule_id} [${row.rule_subheading}] ${row.reason}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
