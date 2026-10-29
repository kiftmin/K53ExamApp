# Gemini prompt — suggest sign card ↔ question links

Attach `sign-cards.json` plus **one** question file per chat:

- `sign-cards.json` — 293 road-sign cards
- `batches/remaining-XX.json` — 35–40 questions per file (**recommended**), or
- `sign-questions.json` — all 275 questions (only if the model can reliably return all 275 in one answer)

The first successful run already covered 40 questions, so the six `batches/remaining-XX.json` files cover the other 235. Run one chat per batch.

Then paste the prompt below.

**Critical:** question ids are not contiguous and are not row numbers. Never infer an id from the previous id, never renumber, and never add ids that are not in the attached question file. Copy every `question_id` exactly from the input.

---

You are helping link a South African K53 learner's-licence question bank to road-sign study cards. Attached are:

- `sign-cards.json` — 293 sign cards. Fields: `id`, `codes` (official sign codes on the card), `name`, `heading`, `subheading`, `where`, `purpose`, `action`, `short_meaning`, `short_action`, `temporary`, `image_codes`.
- One questions file — either a `batches/remaining-XX.json` batch or `sign-questions.json`. Fields: `id`, `question_number`, `question_text`, `license_code`, `contains_image`, `image_link`, `is_duplicate`, `correct_answer`, `options` (each has `answer_number`, `answer_text`, `correct_answer`), `currently_linked_sign_ids`.

TASK
For every question, suggest the sign card(s) it should link to. A question usually links to one card; a card will normally be linked to many questions. Only suggest a link when the question is genuinely about that sign.

HOW TO DECIDE
1. The correct answer is the strongest evidence. It describes what the sign means or what the driver must do — match it against the card's `name`, `purpose`, `action`, `short_meaning` and `short_action`. The question text is often generic ("When you see this road sign you…"), so do not rely on it alone.
2. The other (incorrect) options can help you distinguish similar signs, but they are wrong answers — never link a card because of an incorrect option.
3. `image_link` is not viewable, but it may contain the official sign code:
   - Wikimedia URLs like `.../SADC_road_sign_R2.1.svg` → code `R2.1`
   - Cloudinary filenames like `Sign_RM5_...png`, `Signs_W208-IN11.1-IN11.2_...png`, `Sign_GS501_...png` → codes such as `RM5`, `W208`, `IN11.1`, `IN11.2`, `GS501`
   If a code is clearly visible, match it against the card's `codes` / `image_codes`. Treat this as strong evidence, but still sanity-check that the correct answer is consistent with the card.
4. Cards can cover several codes or variants (e.g. a card with `codes: ["W403","W404"]` or `["R4.1","R4.2","R4.3"]`). A question about any variant belongs to that card.
5. `temporary` cards (T-prefixed codes) are separate cards. Link a temporary card only when the code or the correct answer clearly refers to the temporary version. Do not link a permanent-sign question to a temporary card when both versions exist, unless the card itself lists both codes.
6. Precision matters more than recall. Do NOT link a question merely because both are "warning signs" or "regulatory signs". If the correct answer is generic, or you cannot identify the exact sign, return an empty `sign_ids` array rather than guessing.
7. Duplicate questions (`is_duplicate: true`) still need their own suggestion — do not skip them.
8. If `currently_linked_sign_ids` is non-empty, do not repeat those ids; suggest only additional links (usually none).

OUTPUT
Return ONLY a valid JSON array — no prose, no markdown fences, no trailing commas. Return exactly one object for every question in the attached file, using the exact `id` values from that file. If you process a 40-question batch, return exactly 40 objects. Do not add, invent, renumber, or skip ids.

[
  {
    "question_id": 75,
    "sign_ids": [9],
    "confidence": "high",
    "reason": "Image code R2.1 and answer both match 'Yield to pedestrians'."
  },
  {
    "question_id": 73,
    "sign_ids": [],
    "confidence": "low",
    "reason": "Correct answer does not identify a single matching card."
  }
]

Field rules:
- `question_id`: integer from the questions file.
- `sign_ids`: array of unique integer ids from the cards file, ascending. Empty when there is no confident match.
- `confidence`: `"high"` (exact code match or unambiguous answer), `"medium"` (strong semantic match, no code), `"low"` (uncertain — the reviewer should check carefully).
- `reason`: one short sentence, at most 20 words, naming the evidence (code match, meaning match, etc.). No markdown.

Before answering, check yourself:
- Every question id in the attached file appears exactly once, with no extra ids.
- Every `sign_ids` value exists in `sign-cards.json`.
- No known card is included through a category-only guess.
- Known sign codes in URLs have been used where present.

If you cannot finish the attached file in one response, stop and say so. Do not silently skip questions or fill gaps with invented ids.
