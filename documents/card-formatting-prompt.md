# Card Text Formatting Prompt (for Gemini web / Gemini 3.1 Pro)

Paste the prompt below into Gemini along with the file `documents/card-texts-to-format.json`
(238 rule rows + 292 sign rows = 1114 items).

IMPORTANT: Do NOT rewrite, shorten, or rephrase the text. Keep the original wording, sentence order, punctuation, and facts exactly as given. Your only allowed changes are:
1. Inserting (i), (ii), ... at list boundaries and newlines between list items,
2. Wrapping 1–3 key phrases per point in ** bold markers,
3. Prepending an introductory clause ending with a colon only if the items need one — do not invent new facts.
---

You are an expert UX copywriter and data-transformation middleware for a K53 driver's
license mobile app. I will give you a JSON array of items, each like:

{ "id": 123, "table": "study_rules", "field": "body", "text": "..." }

For EVERY item, rewrite its `text` into a richer, highly readable, scannable format
using exactly these rules:

1. **Extract lists** — Whenever the raw text contains multiple distinct points,
   conditions, scenarios, or actions, break them into a structured list using
   lowercase Roman numerals: (i), (ii), (iii).

2. **Group related concepts (do NOT over-split)** — Do not create a new list item
   for every "and" or "or". Keep closely related compound phrases (e.g.
   "disqualified or suspended", "narcotics or excessive alcohol") inside the same
   list item when they represent a single core idea.

3. **Line breaks** — Each Roman numeral point MUST start on a new line (`\n`).
   Keep an introductory clause before the list begins, ending with a colon.

4. **Bold keywords** — Bold the 1–3 most critical keywords/triggers/core concepts
   per point using Markdown `**...**`, so a learner can skim quickly.

Example transformation:

Raw: "A person is disqualified from obtaining or holding a licence while addicted to
narcotics or excessive alcohol use, while disqualified or suspended by a court or
authority, or during a period following cancellation of a previous licence."

Formatted: "A person is disqualified from obtaining or holding a licence:\n(i) while
**addicted to narcotics or excessive alcohol** use,\n(ii) while **disqualified or
suspended** by a court or authority, or\n(iii) during a period **following
cancellation** of a previous licence."

5. If a text is already short or already well-formatted as a single point, keep it
   as one point — do not force a list. You may still bold the key phrase.

**Zero-reword rule (hard constraint):**
You MAY freely merge, split across lines, and reorder the items, and you MUST add
the (i)/(ii) markers, newlines, the introductory clause, and **bold** markers.
You MUST NOT change, add, or remove any other word inside an item. "Don't" stays
"Don't", "must be seated" stays "must be seated", qualifiers like "or endanger"
stay exactly as written. Any row where you cannot group without changing a word:
leave the wording intact and number the sentences as they stand.

**Output requirements:**
Return ONLY a valid JSON array (no commentary, no markdown fences) with this shape,
preserving `id`, `table`, and `field` exactly, and putting the formatted text in
`formatted_text`:

[{ "id": 123, "table": "study_rules", "field": "body", "formatted_text": "..." }, ...]

Make sure the output is valid, parseable JSON (escape newlines as \n inside strings).
Processing all 1114 items in one response may be too long — if you hit an output
limit, split the work by `table` and `field` (e.g. first all `study_rules`/`body`
items, then `study_signs`/`where_text`, then `purpose_text`, then `action_text`) and
give me separate JSON arrays I can save as separate files. Name the files:

- formatted-rules-body.json
- formatted-signs-where.json
- formatted-signs-purpose.json
- formatted-signs-action.json

---

After you paste the file and this prompt, Gemini will return the JSON. Save each
array as `documents/formatted-*.json` and tell me, then I will apply them to the
live database.
