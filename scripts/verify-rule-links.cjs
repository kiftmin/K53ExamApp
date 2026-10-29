// Strict second-pass review of rule-link suggestions.
// Usage: node scripts/verify-rule-links.cjs
// Reads documents/rule-question-links/output/suggestions-all.json and writes
// suggestions-verified.json, verification-report.json, suggestions-rejected.json.

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'documents', 'rule-question-links');
const OUTDIR = path.join(DATA_DIR, 'output');
const RULES_PATH = path.join(DATA_DIR, 'rules.json');
const QUESTIONS_PATH = path.join(DATA_DIR, 'rule-questions.json');
const SUGGESTIONS_PATH = path.join(OUTDIR, 'suggestions-all.json');
const VERIFIED_PATH = path.join(OUTDIR, 'suggestions-verified.json');
const REPORT_PATH = path.join(OUTDIR, 'verification-report.json');
const REJECTED_PATH = path.join(OUTDIR, 'suggestions-rejected.json');
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const PAIRS_PER_BATCH = 20;
const API_DELAY_MS = 1200;

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
};

const PROMPT = `You are a strict precision reviewer for a South African K53 study app.

Each pair contains an exam question and one proposed rule-card link. Decide whether the rule body directly supports the question's correct answer.

First identify what the question asks:
- A normal question wants the true statement, definition, value, or procedure.
- A "which is wrong/incorrect/not correct/false" question selects the false statement. A rule that states the true requirement contradicted by that statement is valid.
- A combination or "all of the above" question has several correct statements. A rule that directly supports one of those correct statements is valid.
- "None of the above" means every listed statement is false. A rule that directly contradicts one of them is valid.

ACCEPT when:
- The rule states the same requirement, permission, prohibition, definition, value, or procedure as the correct answer, even if the wording, word order, voice, or tense is completely different.
- The correct answer is a combination or says "all of the above", and the rule directly supports one of the correct statements in that combination.
- The question asks for a wrong statement and the rule directly contradicts the selected wrong statement.
- The rule states the same fact at a different level of detail, as long as it does not add a contradictory condition or omit a necessary condition that changes the answer.

REJECT when:
- The link is based only on a shared topic, heading, subheading, keyword, or general subject.
- The rule is merely a general definition and does not state the specific fact in the answer (unless the question asks for that definition).
- The rule states a different number, unit, threshold, time, distance, age, vehicle class, or condition.
- The rule supports only an incorrect option.
- The rule is about a different scenario, even if it uses similar words.
- The question asks for a wrong statement but the rule agrees with that wrong statement.
- The rule only partially covers a narrow answer, or adds a condition that changes its meaning.

Do not be generous. A plausible topic match is not enough. If the rule body does not directly entail the correct answer (or contradict a selected wrong statement), mark supported=false.

Return ONLY a JSON array with one object for every pair, in the same order. Use the exact question_id and rule_id.
[
  {
    "question_id": 24,
    "rule_id": 102,
    "supported": true,
    "confidence": "high",
    "reason": "The rule requires a following distance that lets the driver stop without swerving."
  },
  {
    "question_id": 6,
    "rule_id": 107,
    "supported": false,
    "confidence": "high",
    "reason": "Rule 107 covers traffic islands, not yielding to oncoming traffic when turning right."
  }
]

Field rules:
- supported: boolean.
- confidence: high, medium, or low.
- reason: one short sentence, maximum 25 words, naming the supporting clause or the reason for rejection.
- No markdown, no extra fields.`;

function buildPairs(suggestions, rules, questions) {
  const ruleMap = new Map(rules.map((rule) => [rule.id, rule]));
  const questionMap = new Map(questions.map((question) => [question.id, question]));
  const pairs = [];
  for (const suggestion of suggestions) {
    const question = questionMap.get(suggestion.question_id);
    if (!question) continue;
    for (const ruleId of suggestion.rule_ids) {
      const rule = ruleMap.get(ruleId);
      if (!rule) continue;
      pairs.push({
        question_id: question.id,
        rule_id: rule.id,
        question_number: question.question_number,
        question_text: question.question_text,
        options: question.options,
        correct_answer: question.correct_answer,
        rule: {
          id: rule.id,
          section_ref: rule.section_ref,
          subheading: rule.subheading,
          body: rule.body,
        },
      });
    }
  }
  return pairs;
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
                    supported: { type: 'BOOLEAN' },
                    confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
                    reason: { type: 'STRING' },
                  },
                  required: ['question_id', 'rule_id', 'supported', 'confidence', 'reason'],
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

function normalizeReport(rows, batch) {
  const valid = new Set(batch.map((pair) => `${pair.question_id}:${pair.rule_id}`));
  const seen = new Set();
  const out = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = `${Number(row?.question_id)}:${Number(row?.rule_id)}`;
    if (!valid.has(key) || seen.has(key)) continue;
    out.push({
      question_id: Number(row.question_id),
      rule_id: Number(row.rule_id),
      supported: row.supported === true,
      confidence: ['high', 'medium', 'low'].includes(row.confidence) ? row.confidence : 'low',
      reason: typeof row.reason === 'string' ? row.reason.trim() : '',
    });
    seen.add(key);
  }
  for (const pair of batch) {
    const key = `${pair.question_id}:${pair.rule_id}`;
    if (!seen.has(key)) {
      out.push({
        question_id: pair.question_id,
        rule_id: pair.rule_id,
        supported: false,
        confidence: 'low',
        reason: 'No verification result returned for this pair.',
      });
    }
  }
  return out;
}

async function main() {
  if (!fs.existsSync(SUGGESTIONS_PATH)) throw new Error(`Missing ${SUGGESTIONS_PATH}`);
  const suggestions = readJson(SUGGESTIONS_PATH);
  const rules = readJson(RULES_PATH);
  const questions = readJson(QUESTIONS_PATH);
  const pairs = buildPairs(suggestions, rules, questions);
  const batches = [];
  for (let index = 0; index < pairs.length; index += PAIRS_PER_BATCH) {
    batches.push(pairs.slice(index, index + PAIRS_PER_BATCH));
  }
  console.log(`Verifying ${pairs.length} suggested pairs in ${batches.length} batch(es) using ${MODEL}.`);

  const report = [];
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
        verified = normalizeReport(rows, batch);
        break;
      } catch (error) {
        lastError = error;
        console.warn(`Verification batch ${index + 1}, attempt ${attempt} failed: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, 2500 * attempt));
      }
    }
    if (!verified) throw new Error(`Verification batch ${index + 1} failed: ${lastError?.message}`);
    report.push(...verified);
    const accepted = verified.filter((row) => row.supported).length;
    console.log(`Verification batch ${index + 1}/${batches.length}: ${accepted}/${verified.length} accepted.`);
    await new Promise((resolve) => setTimeout(resolve, API_DELAY_MS));
  }

  const reportMap = new Map(report.map((row) => [`${row.question_id}:${row.rule_id}`, row]));
  const verifiedRows = [];
  const rejectedRows = [];
  for (const suggestion of suggestions) {
    const accepted = [];
    for (const ruleId of suggestion.rule_ids) {
      const result = reportMap.get(`${suggestion.question_id}:${ruleId}`);
      if (result?.supported) accepted.push(result);
      else if (result) rejectedRows.push(result);
    }
    if (accepted.length === 0) {
      verifiedRows.push({
        question_id: suggestion.question_id,
        rule_ids: [],
        confidence: 'low',
        reason: suggestion.rule_ids.length
          ? 'Second-pass verification rejected every proposed rule for this question.'
          : suggestion.reason,
      });
      continue;
    }
    const confidence = accepted.some((row) => row.confidence === 'low')
      ? 'low'
      : accepted.some((row) => row.confidence === 'medium')
        ? 'medium'
        : 'high';
    verifiedRows.push({
      question_id: suggestion.question_id,
      rule_ids: accepted.map((row) => row.rule_id).sort((a, b) => a - b),
      confidence,
      reason: accepted.map((row) => `R${row.rule_id}: ${row.reason}`).join(' '),
    });
  }

  writeJson(VERIFIED_PATH, verifiedRows);
  writeJson(REPORT_PATH, report);
  writeJson(REJECTED_PATH, rejectedRows);
  const acceptedPairs = report.filter((row) => row.supported).length;
  console.log(
    `Done: ${acceptedPairs}/${report.length} pairs accepted, ${rejectedRows.length} rejected. Wrote ${path.basename(VERIFIED_PATH)}.`
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
