// Shared prompt text for rule-card <-> rule-question matching.
// Used by the Gemini API pipeline (scripts/suggest-rule-links.cjs) and by the
// external-agent package export (--export-package).

const MATCHING_RULES = `PRECISION RULES (follow strictly):
1. The correct answer is the primary evidence. Link only when the rule body states the same requirement, permission, prohibition, definition, value, or procedure.
2. Paraphrase, voice, tense, word order, and singular/plural differences are acceptable. Topic similarity is NOT enough.
3. If the answer contains a number, unit, threshold, time, distance, or age, the rule must contain the same value and unit. Never link a rule with a different value.
4. Never link a rule merely because the question and rule share a heading, subheading, keyword, or general subject.
5. Incorrect options are distractors. Never use them as evidence.
6. Prefer the single most specific matching rule. Return multiple rule ids only when each rule independently supports a distinct necessary part of the correct answer (for example a split procedure or a composite "all of the above" answer).
7. If the correct answer is generic, or no rule clearly supports it, return an empty rule_ids array. Precision is more important than recall.
8. Do not return any id listed in currently_linked_rule_ids.
9. The reason must be one short sentence (maximum 25 words) that names the shared requirement or paraphrased evidence. Do not invent facts.
10. Check every candidate against the rule body before including it. If you cannot point to the supporting clause, omit it.
11. If the question asks which statement is wrong, incorrect, not correct, or false, the selected answer is the false statement. Link a rule that states the true requirement contradicted by that statement. Never link a rule that agrees with the false statement.
12. For "all of the above" and combination answers, link each rule that independently supports a selected correct statement. Do not link a rule that supports only an unselected statement.
13. For "none of the above" answers, usually return an empty rule_ids array. Link only when a rule explicitly enumerates the conditions and shows why every option is disallowed.
14. Questions with identical question_text and correct_answer must receive the same rule_ids.
15. A rule that only defines a term used in the question is not a link unless the question itself asks for that definition.`;

const CODE_RULES = `CODE APPLICABILITY:
- A question with license_code "00" is general and may link to any rule.
- Otherwise, link only when the rule's applicable_codes contains 0 (all) or the question's code (1 = motorcycle, 2 = light motor vehicle, 3 = heavy motor vehicle).
- Both the question and every rule carry these fields. Apply this as a hard filter before matching meaning.`;

const OUTPUT_RULES = `OUTPUT
Return ONLY a valid JSON array, one object for every question in the batch, in the same order. Do not add, skip, renumber, or invent question ids.
Example only (ids are placeholders; do not copy them):
[
  {
    "question_id": 9001,
    "rule_ids": [999],
    "confidence": "high",
    "reason": "Both state the same requirement in different words."
  },
  {
    "question_id": 9002,
    "rule_ids": [],
    "confidence": "low",
    "reason": "No rule directly supports the complete answer."
  }
]

Field rules:
- question_id: exact integer from questions[].
- rule_ids: unique integers from rules[], ascending. Empty when there is no direct match.
- confidence: "high", "medium", or "low".
- reason: one short sentence, no markdown.

If the full result would exceed your output limit, process the questions in batches (for example 25 questions at a time) and return one JSON array per batch. Never omit or renumber questions. Each batch can be saved as a separate file and imported together.`;

// Prompt used by the API pipeline: rules and questions are inlined.
const PROMPT_INTRO = `You are matching South African K53 learner's-licence exam questions to atomic study-rule cards.

The attached RULES array contains every study-rule card. The QUESTIONS array contains the exam questions to process. Each question includes its options and the correct answer.

Your job: for every question, return the rule card id(s) whose body directly supports the correct answer. The wording may be completely different, reordered, or paraphrased. Match meaning, not shared words.

${MATCHING_RULES}

${CODE_RULES}

CONFIDENCE:
- high: exact requirement or value, including a clear paraphrase.
- medium: clear semantic match but some wording must be interpreted.
- low: plausible but not directly stated; reviewers should check carefully.
`;

function buildPrompt(rules, questions) {
  return `${PROMPT_INTRO}\nRULES:\n${JSON.stringify(rules)}\n\nQUESTIONS:\n${JSON.stringify(questions)}\n\n${OUTPUT_RULES}`;
}

// Prompt for an external agent (for example the Gemini web app) that receives
// documents/rule-question-links/gemini-input.json as an attachment.
function buildStandalonePrompt({ ruleCount = 0, questionCount = 0 } = {}) {
  const counts =
    ruleCount && questionCount
      ? `The file contains ${ruleCount} rule cards and ${questionCount} questions.`
      : 'The file contains every rule card and every question to process.';

  return `You are matching South African K53 learner's-licence exam questions to atomic study-rule cards.

INPUT
- Attached file: gemini-input.json. ${counts}
- rules[]: id, section_ref, heading, subheading, title, question, body, applicable_codes.
- questions[]: id, question_number, question_text, license_code, correct_answer, options, currently_linked_rule_ids, is_duplicate.
- Match each question to the rule card id(s) whose body directly supports the correct answer.
- The rule card body is the authority. The rule card question/title is context only.
- Wording may be reordered, paraphrased, passive or active, singular or plural, or use synonyms. Match meaning, not shared words.

${MATCHING_RULES}

${CODE_RULES}

MANDATORY SECOND PASS
After building the first draft, review every proposed link as a strict reviewer:
- Keep a link only when you can point to the exact clause in body that states the same requirement, value, definition, or procedure as correct_answer.
- Remove topic-only, heading-only, keyword-only, and distractor-based matches.
- Remove links where a number, unit, threshold, age, distance, or time differs.
- Remove links that support only an incorrect option.
- Remove links that add a contradictory condition or omit a condition that changes the answer.
Return the cleaned result, not the draft.

CONFIDENCE:
- high: the rule states the same requirement or value, including a clear paraphrase.
- medium: a clear semantic match where some wording must be interpreted.
- low: plausible but not directly stated; reviewers must check carefully.

${OUTPUT_RULES}`;
}

// Prompt for a focused recall pass over questions that still have no link.
// The first pass is precision-first, so this pass looks for genuine matches it
// may have missed while keeping the same false-positive guardrails.
function buildEmptyPassPrompt({ ruleCount = 0, questionCount = 0 } = {}) {
  const counts =
    ruleCount && questionCount
      ? `The file contains ${ruleCount} rule cards and ${questionCount} questions that currently have no rule linked.`
      : 'The file contains every rule card and the questions that currently have no rule linked.';

  return `You are matching South African K53 learner's-licence exam questions to atomic study-rule cards.

CONTEXT
- Attached file: gemini-input-empty.json. ${counts}
- A precision-first first pass found no new rule link for these questions. This is a focused recall retry, not a fresh start.
- Look harder for genuine matches that the first pass missed, especially where the rule uses different wording, a more general definition, or a legal term instead of everyday wording.
- Precision still wins. An empty rule_ids array is a valid and expected answer. Never invent a link just to fill a row.

${MATCHING_RULES}

${CODE_RULES}

RECALL GUIDANCE (use only when the rule body genuinely states the fact):
1. Translate everyday exam wording into the rule's wording. Examples: robot = traffic light/signal; yield = give way; traffic circle = roundabout; blind spot = check before moving off or changing lanes; hooter = horn; emergency lane = shoulder.
2. A rule may state the same fact at a different level of detail. Accept only when it does not add a contradictory condition or omit a condition that changes the answer.
3. Definition and purpose links count when the question asks what a term means or why a rule exists. For example, a rule that sets a safe following distance supports an answer about being able to stop safely if the vehicle ahead stops.
4. A rule that imposes a duty on other road users, or says they may proceed or finish crossing, supports a right-of-way answer even when the words "right of way" do not appear.
5. "All of the above" answers: link each rule that independently supports at least one of the correct statements. Do not link a rule that supports only an unselected statement.
6. "(i) and (ii) only" answers: link rules supporting the selected statements; do not link rules that only support unselected statements.
7. "None of the above" answers: normally return an empty rule_ids array. Link only when a rule explicitly enumerates the conditions and shows why every listed option fails.
8. "Which statement is wrong/incorrect?" questions: the correct answer is the false statement. Link the rule that states the true requirement contradicted by that statement.
9. If several questions have identical question_text and correct_answer, give them the same rule_ids for consistency.
10. A broad safe-driving rule that does not state the specific fact in the answer is not enough.

MANDATORY SECOND PASS
After building the first draft, review every proposed link as a strict reviewer:
- Keep a link only when you can point to the exact clause in body that states the same requirement, value, definition, procedure, duty, or permission as the answer.
- Remove topic-only, heading-only, keyword-only, and distractor-based matches.
- Remove links where a number, unit, threshold, age, distance, time, or vehicle class differs.
- Remove links that support only an incorrect option.
- Leave the array empty when the evidence is only plausible.
Return the cleaned result, not the draft.

CONFIDENCE:
- high: the rule states the same requirement or value, including a clear paraphrase.
- medium: a clear semantic match where some wording must be interpreted.
- low: plausible but not directly stated; reviewers must check carefully.

${OUTPUT_RULES}`;
}

module.exports = {
  MATCHING_RULES,
  CODE_RULES,
  PROMPT_INTRO,
  OUTPUT_RULES,
  buildPrompt,
  buildStandalonePrompt,
  buildEmptyPassPrompt,
};
