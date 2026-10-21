# Gemini prompt — generate one flashcard question per rule

## Purpose
Create a `question` for every rule in `rules-data.json`. The question becomes the FRONT of the flashcard; the rule `body` is the BACK. The question must be answerable from that rule's body alone.

## Input
A JSON array of rule objects:
```json
{
  "id": 1,
  "section_ref": "3",
  "heading": "Licensing & Codes",
  "subheading": "Learner's Licence Test",
  "title": "Optional title when present",
  "body": "The full rule text (plain, no formatting markers).",
  "applicable_codes": [0]
}
```

## Task
For each rule, write ONE flashcard question that the `body` answers.

## Hard rules
1. The question must be answerable **only** from that rule's `body`. Add no outside facts, examples, or legal knowledge.
2. Do not reveal the answer. Do not include the key requirement, list, or values the body gives.
3. Preserve the body's scope and qualifiers. Never broaden or narrow it: keep distinctions such as "may not" vs "must not", "only", "except", "at least", "24 months", "heavy motor vehicle".
4. Use correct grammar and spelling. The body may contain typos or awkward wording — do not copy errors into the question.
5. One sentence only, maximum 25 words, ending with `?`.
6. Prefer open questions: **What / When / Where / Who / How / Why / Which / Under what circumstances**. Use a yes/no question only for a pure permission or prohibition that has no natural open form.
7. Ask about the rule's main requirement. If the body also contains secondary detail (for example a validity period), the back still shows the full body, so the question does not have to cover every detail.
8. Stay in the body's register: use "a person", "a driver", "you", or the body's own subject consistently. Never switch to "I".
9. Never write "According to the rule…", "What does the text say…", or "What is the rule about…". Ask about the real-world requirement.
10. No markdown, no quotation marks around the question, no answer, no numbering, no extra commentary.
11. Return every input `id` exactly once, in the same order as the input.
12. If a body is a bare list of requirements, ask for the requirements as a whole (for example "What are the requirements for a number plate?").

## Output format
Return a JSON array only — no markdown fences, no prose:
```json
[
  { "id": 1, "question": "What does a learner's licence test cover?" },
  { "id": 2, "question": "When is a person disqualified from obtaining or holding a licence?" }
]
```
Only `id` and `question` are needed; the importer joins them to the rules by `id`.

## Examples from this data
Good:
- id 1, body about the learner's licence test → `"What does a learner's licence test cover?"`
- id 2, body about disqualification → `"When is a person disqualified from obtaining or holding a licence?"`
- id 3, body about applying for a class already held → `"When may a person not apply for a licence?"`

Bad:
- `"What does the rule say about learner's licences?"` — vague; not answerable as a specific requirement.
- `"When is a person is disqualified from obtaining or holding a licence?"` — grammar error (double "is").
- `"What does a learner's licence test cover, and how long is it valid?"` — two questions in one.
- `"How long is a learner's licence valid?"` — targets only a secondary detail and misses the rule's main point.
- `"What are the requirements for a number plate: upright, legible, visible?"` — contains the answer.

## Batching (important)
The full file has 252 rules. Process it in the pre-split batches, one batch per fresh chat:
- `documents/rule-question-batches/input/batch-001.json` … `batch-006.json` (50 per batch; last has 2).
- Paste the batch contents after the rules above.
- Save each reply as `documents/rule-question-batches/output/batch-001-out.json` etc. (same number).
- Before saving, check: the reply is a JSON array, it has the same number of items as the batch, and every `id` appears once.
- If a reply is truncated or wrapped in ```json fences, ask Gemini to continue/re-send that batch; do not merge partial output.
