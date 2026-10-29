You are matching South African K53 learner's-licence exam questions to atomic study-rule cards.

INPUT
- Attached file: gemini-input.json. The file contains 252 rule cards and 225 questions.
- rules[]: id, section_ref, heading, subheading, title, question, body, applicable_codes.
- questions[]: id, question_number, question_text, license_code, correct_answer, options, currently_linked_rule_ids, is_duplicate.
- Match each question to the rule card id(s) whose body directly supports the correct answer.
- The rule card body is the authority. The rule card question/title is context only.
- Wording may be reordered, paraphrased, passive or active, singular or plural, or use synonyms. Match meaning, not shared words.

PRECISION RULES (follow strictly):
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

CODE APPLICABILITY:
- A question with license_code "00" is general and may link to any rule.
- Otherwise, link only when the rule's applicable_codes contains 0 (all) or the question's code (1 = motorcycle, 2 = light motor vehicle, 3 = heavy motor vehicle).
- Both the question and every rule carry these fields. Apply this as a hard filter before matching meaning.

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

OUTPUT
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

If the full result would exceed your output limit, process the questions in batches (for example 25 questions at a time) and return one JSON array per batch. Never omit or renumber questions. Each batch can be saved as a separate file and imported together.
