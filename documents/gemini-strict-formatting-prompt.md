# Gemini strict formatting prompt

Use this to format the original card text without changing any wording.

## Input format

Export the originals from the `_raw` backup columns (never from the live columns and
never from the old `formatted-*.json` files). One JSON array per batch:

```json
[
  { "id": 131, "table": "study_rules", "field": "body", "text": "A passenger may only be carried if the motorcycle's engine exceeds 50cc, and the passenger must be seated in a sidecar or astride a pillion." }
]
```

Keep batches to 40-60 items of the same field. Start a fresh chat for every batch.

## Prompt to paste

---

You are formatting South African K53 study-card text. You add visual structure only.
You never rewrite, correct, or improve the text.

INPUT
A JSON array of items:
[{"id": 131, "table": "study_rules", "field": "body", "text": "..."}]

OUTPUT
Return ONLY a JSON array with the same items in the same order:
[{"id": 131, "table": "study_rules", "field": "body", "formatted_text": "..."}]
No markdown code fences. No commentary.

WHAT YOU MAY INSERT
Only these four things:
1. `**` before and after a keyword or short phrase, to highlight it.
2. A newline `\n`.
3. A lowercase Roman marker at the start of a line: `(i) `, `(ii) `, `(iii) `, in order.
4. A colon `:` immediately before a newline, when introducing a list.

Nothing else. Do not add, remove, replace, move, or reorder any word, letter, digit,
or punctuation mark. Copy typos exactly (for example "tractions", "e3nough",
"driving motorcar"). Keep "Don't", "isn't", "may not", "except", "unless", "only",
"at least", "more than" exactly as written. Do not add an introductory label such as
"Traffic light rules:" or "Parking rules:".

NUMBERING
- If the text describes one point only, do not number it.
- If it describes several points, put each point on its own line with the next marker.
- You may group closely related adjacent sentences under one marker. Continuation
  lines may be unnumbered and indented with three spaces.
- Keep the original order of the text.
- Never split a sentence in a way that separates a number or unit from its value
  (keep "3500kg", "24 hours", "30km/h" together).

ACCEPTANCE TEST
A script removes all `**`, all line-start `(i)`-style markers, all `:` characters,
and collapses every run of whitespace to one space. The result must be identical to
the original `text` after the same normalization. If one character differs, the row
is rejected and must be redone.

EXAMPLES

Example A
Input: "A sidecar must be attached to the left side of the motorcycle, and may not be fitted to a motorcycle with an engine under 50cc."
Output: "A sidecar must:\n(i) be attached to the **left side** of the motorcycle, and\n(ii) **may not be fitted** to a motorcycle with an engine **under 50cc**."

Example B
Input: "A driver must yield right of way, slow down, or stop for a pedestrian crossing a roadway within a pedestrian crossing."
Output: "A driver **must yield right of way**, **slow down**, or **stop** for a **pedestrian** crossing a roadway within a pedestrian crossing."

Example C
Input: "These lights must be obeyed at all times in the following manner: Red - Stop. Flashing red arrow to the left - After stopping, the driver may turn if there is no traffic. Remember to yield to pedestrian traffic and oncoming traffic that wants to turn right, and traffic from the right passing through the intersection. Amber - Stop, except where it cannot be done safely."
Output: "These lights must be obeyed at all times in the following manner:\n(i) **Red** - **Stop**.\n(ii) **Flashing red arrow to the left** - After stopping, the driver may turn if there is no traffic.\n   Remember to yield to **pedestrian traffic** and **oncoming traffic** that wants to turn right, and traffic from the right passing through the intersection.\n(iii) **Amber** - **Stop**, except where it cannot be done safely."

---

## Verification algorithm

For each row, normalize both the original and the returned text:

1. Remove every `**`.
2. Remove every `(i)`, `(ii)`, `(iii)`, ... marker at the start of a line.
3. Remove every `:` character.
4. Replace every run of whitespace (spaces, tabs, newlines) with one space.
5. Trim.

The two normalized strings must be equal. Any difference means the row is rejected.

This allows only newlines, numbering, bolding, and colons to be added. Every word,
typo, negation, and qualifier must remain exactly where it was.

## What to do with rejected rows

1. Show Gemini only the failing row(s) and quote the exact difference
   (for example: "you changed 'must be seated' to 'is seated'; keep 'must be seated'").
2. Ask for the row again with the same rules.
3. If it still fails, leave that row unformatted and run the deterministic lite
   formatter on it (`scripts/format-card-text-lite.cjs`), which can only insert
   numbering, newlines, and bold markers.

## Applying

Only apply rows that pass verification. The live columns are written from the
verified output; the `_raw` backup columns stay untouched, so the operation remains
reversible.
