// Generate rule-card ↔ rule-question link suggestions with Gemini.
// Usage:
//   node scripts/suggest-rule-links.cjs --export-only
//   node scripts/suggest-rule-links.cjs --export-package
//   node scripts/suggest-rule-links.cjs --export-empty
//   node scripts/suggest-rule-links.cjs --limit 8 --outdir C:\temp\rule-link-test
//   node scripts/suggest-rule-links.cjs
// --export-package also writes gemini-input.json and gemini-prompt.md for an
// external agent. --export-empty writes a focused package for the questions
// that still have no rule linked.
// Requires DATABASE_URL (and GEMINI_API_KEY unless exporting only) in .env.

const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Client } = require('pg');
const {
  buildPrompt,
  buildStandalonePrompt,
  buildEmptyPassPrompt,
} = require('./lib/rule-link-prompt.cjs');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'documents', 'rule-question-links');
const DEFAULT_OUTDIR = path.join(DATA_DIR, 'output');
const RULES_PATH = path.join(DATA_DIR, 'rules.json');
const QUESTIONS_PATH = path.join(DATA_DIR, 'rule-questions.json');
const DEFAULT_VERIFIED_PATH = path.join(DEFAULT_OUTDIR, 'suggestions-verified.json');
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const BATCH_SIZE = 12;
const API_DELAY_MS = 1500;

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(name);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const LIMIT = Number(argValue('--limit', '0')) || 0;
const OUTDIR = path.resolve(argValue('--outdir', DEFAULT_OUTDIR));
const EXPORT_ONLY = hasFlag('--export-only');
const EXPORT_PACKAGE = hasFlag('--export-package');
const EXPORT_EMPTY = hasFlag('--export-empty');
const VERIFIED_PATH = path.resolve(argValue('--suggestions', DEFAULT_VERIFIED_PATH));
const FORCE = hasFlag('--force');

function stripMarkdown(value) {
  return String(value || '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function correctAnswer(question) {
  return (question.options || []).find((option) => option.correct_answer)?.answer_text || '';
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function connectDb() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set in .env');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

async function exportData() {
  const client = await connectDb();
  try {
    const { rows: rules } = await client.query(`
      SELECT id, section_ref, heading, subheading, title, body, question, applicable_codes
      FROM study_rules
      ORDER BY id
    `);
    const { rows: questions } = await client.query(`
      SELECT id, question_number, question_text, license_code, contains_image, image_link,
             is_duplicate, options
      FROM questions
      WHERE category = 1
      ORDER BY question_number, id
    `);
    const { rows: links } = await client.query(`SELECT rule_id, question_id FROM rule_questions`);

    const linkedByQuestion = new Map();
    for (const link of links) {
      const list = linkedByQuestion.get(link.question_id) || [];
      list.push(link.rule_id);
      linkedByQuestion.set(link.question_id, list);
    }

    const rulesOut = rules.map((rule) => ({
      id: rule.id,
      section_ref: rule.section_ref,
      heading: rule.heading,
      subheading: rule.subheading,
      title: rule.title || null,
      question: stripMarkdown(rule.question),
      body: stripMarkdown(rule.body),
      applicable_codes: rule.applicable_codes || [],
    }));

    const questionsOut = questions.map((question) => ({
      id: question.id,
      question_number: question.question_number,
      question_text: stripMarkdown(question.question_text),
      license_code: question.license_code,
      contains_image: question.contains_image,
      image_link: question.image_link || null,
      is_duplicate: question.is_duplicate,
      correct_answer: stripMarkdown(correctAnswer(question)),
      options: (question.options || []).map((option) => ({
        answer_number: option.answer_number,
        answer_text: stripMarkdown(option.answer_text),
        correct_answer: option.correct_answer,
      })),
      currently_linked_rule_ids: (linkedByQuestion.get(question.id) || []).sort((a, b) => a - b),
    }));

    writeJson(RULES_PATH, rulesOut);
    writeJson(QUESTIONS_PATH, questionsOut);
    console.log(`Exported ${rulesOut.length} rules and ${questionsOut.length} category-1 questions.`);
    return { rules: rulesOut, questions: questionsOut };
  } finally {
    await client.end();
  }
}

function writePackage(rules, questions) {
  const bundlePath = path.join(DATA_DIR, 'gemini-input.json');
  const promptPath = path.join(DATA_DIR, 'gemini-prompt.md');
  writeJson(bundlePath, { rules, questions });
  fs.writeFileSync(
    promptPath,
    buildStandalonePrompt({ ruleCount: rules.length, questionCount: questions.length }) + '\n',
    'utf8'
  );
  console.log(`Wrote ${path.basename(bundlePath)} and ${path.basename(promptPath)} for an external agent.`);
}

function writeEmptyPackage(rules, questions) {
  if (!fs.existsSync(VERIFIED_PATH)) {
    throw new Error(
      `Missing ${VERIFIED_PATH}. Run the matcher and verifier first, or pass --suggestions <path>.`
    );
  }
  const suggestions = readJson(VERIFIED_PATH);
  const emptyIds = new Set(
    (Array.isArray(suggestions) ? suggestions : [])
      .filter((row) => Array.isArray(row?.rule_ids) && row.rule_ids.length === 0)
      .map((row) => Number(row.question_id))
  );
  const unmatched = questions.filter(
    (question) => emptyIds.has(question.id) && (question.currently_linked_rule_ids || []).length === 0
  );
  const alreadyLinked = questions.filter(
    (question) => emptyIds.has(question.id) && (question.currently_linked_rule_ids || []).length > 0
  );

  if (unmatched.length === 0) {
    console.log('No unmatched questions found; nothing to export.');
    return;
  }

  const bundlePath = path.join(DATA_DIR, 'gemini-input-empty.json');
  const promptPath = path.join(DATA_DIR, 'gemini-prompt-empty.md');
  writeJson(bundlePath, { rules, questions: unmatched });
  fs.writeFileSync(
    promptPath,
    buildEmptyPassPrompt({ ruleCount: rules.length, questionCount: unmatched.length }) + '\n',
    'utf8'
  );
  console.log(
    `Wrote ${path.basename(bundlePath)} and ${path.basename(promptPath)}: ` +
      `${unmatched.length} unmatched question(s)` +
      (alreadyLinked.length ? ` (skipped ${alreadyLinked.length} empty result row(s) that are already linked).` : '.')
  );
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
              temperature: 0.1,
              topP: 0.8,
              maxOutputTokens: 16384,
              thinkingConfig: { thinkingBudget: 0 },
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    question_id: { type: 'INTEGER' },
                    rule_ids: { type: 'ARRAY', items: { type: 'INTEGER' } },
                    confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
                    reason: { type: 'STRING' },
                  },
                  required: ['question_id', 'rule_ids', 'confidence', 'reason'],
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
      return { text, finishReason: candidate?.finishReason || 'unknown', usage: data.usageMetadata || null };
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

function normalizeRows(rows, batch, ruleIds) {
  const byQuestion = new Map(batch.map((question) => [question.id, question]));
  const seen = new Set();
  const out = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const questionId = Number(row?.question_id);
    if (!byQuestion.has(questionId) || seen.has(questionId)) continue;
    const question = byQuestion.get(questionId);
    const linked = new Set(question.currently_linked_rule_ids || []);
    const suggested = Array.from(
      new Set((Array.isArray(row?.rule_ids) ? row.rule_ids : []).map(Number))
    )
      .filter((id) => Number.isInteger(id) && ruleIds.has(id) && !linked.has(id))
      .sort((a, b) => a - b);
    const confidence = ['high', 'medium', 'low'].includes(row?.confidence) ? row.confidence : 'low';
    const reason = typeof row?.reason === 'string' ? row.reason.trim() : '';
    out.push({ question_id: questionId, rule_ids: suggested, confidence, reason });
    seen.add(questionId);
  }
  for (const question of batch) {
    if (!seen.has(question.id)) {
      out.push({
        question_id: question.id,
        rule_ids: [],
        confidence: 'low',
        reason: 'No valid suggestion returned for this question.',
      });
    }
  }
  return out.sort((a, b) => batch.findIndex((q) => q.id === a.question_id) - batch.findIndex((q) => q.id === b.question_id));
}

async function main() {
  if (EXPORT_ONLY || EXPORT_PACKAGE) {
    const exported = await exportData();
    if (EXPORT_PACKAGE) writePackage(exported.rules, exported.questions);
    return;
  }

  if (EXPORT_EMPTY) {
    if (!fs.existsSync(RULES_PATH) || !fs.existsSync(QUESTIONS_PATH)) {
      await exportData();
    }
    writeEmptyPackage(readJson(RULES_PATH), readJson(QUESTIONS_PATH));
    return;
  }

  if (!fs.existsSync(RULES_PATH) || !fs.existsSync(QUESTIONS_PATH)) {
    await exportData();
  }

  const rules = readJson(RULES_PATH);
  const questions = readJson(QUESTIONS_PATH);
  const ruleIds = new Set(rules.map((rule) => rule.id));
  const targetQuestions = (LIMIT > 0 ? questions.slice(0, LIMIT) : questions);
  const batches = [];
  for (let index = 0; index < targetQuestions.length; index += BATCH_SIZE) {
    batches.push(targetQuestions.slice(index, index + BATCH_SIZE));
  }

  fs.mkdirSync(OUTDIR, { recursive: true });
  console.log(`Matching ${targetQuestions.length} questions in ${batches.length} batch(es) using ${MODEL}.`);

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    const filePath = path.join(OUTDIR, `suggestions-batch-${String(index + 1).padStart(3, '0')}.json`);
    if (fs.existsSync(filePath) && !FORCE) {
      const existing = readJson(filePath);
      const covered = new Set(existing.map((row) => row.question_id));
      if (batch.every((question) => covered.has(question.id))) {
        console.log(`Batch ${index + 1}/${batches.length}: already exists, skipped.`);
        continue;
      }
    }

    const prompt = buildPrompt(rules, batch);
    let parsed = null;
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const result = await callGemini(prompt);
      try {
        const candidateRows = parseResponse(result.text);
        if (!Array.isArray(candidateRows)) throw new Error('Gemini returned JSON that is not an array.');
        if (candidateRows.length < batch.length) {
          throw new Error(`Gemini returned ${candidateRows.length}/${batch.length} rows (finishReason: ${result.finishReason}).`);
        }
        parsed = candidateRows;
        break;
      } catch (error) {
        lastError = error;
        const rawPath = path.join(
          OUTDIR,
          `raw-batch-${String(index + 1).padStart(3, '0')}-attempt-${attempt}.txt`
        );
        fs.writeFileSync(rawPath, result.text, 'utf8');
        console.warn(`Batch ${index + 1}, attempt ${attempt} failed: ${error.message}`);
        if (result.finishReason && result.finishReason !== 'STOP') {
          console.warn(`Gemini finishReason: ${result.finishReason}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 2500 * attempt));
      }
    }
    if (!parsed) throw new Error(`Batch ${index + 1} failed after 3 attempts: ${lastError?.message}`);
    const rows = normalizeRows(parsed, batch, ruleIds);
    writeJson(filePath, rows);
    const suggestions = rows.reduce((total, row) => total + row.rule_ids.length, 0);
    console.log(
      `Batch ${index + 1}/${batches.length}: ${rows.length} questions, ${suggestions} link(s) -> ${path.basename(filePath)}`
    );
    await new Promise((resolve) => setTimeout(resolve, API_DELAY_MS));
  }

  const combined = batches.flatMap((batch, index) => {
    const filePath = path.join(OUTDIR, `suggestions-batch-${String(index + 1).padStart(3, '0')}.json`);
    return fs.existsSync(filePath) ? readJson(filePath) : [];
  });
  writeJson(path.join(OUTDIR, 'suggestions-all.json'), combined);
  const totalLinks = combined.reduce((total, row) => total + row.rule_ids.length, 0);
  console.log(`Done: ${combined.length} question rows, ${totalLinks} link suggestions.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
