# Gemini prompt — draft short text for K53 signs

Attach `k53-signs-input.json` (293 records) to the Gemini chat, then paste the prompt below.

---

You are helping build a South African K53 learner's-licence study app. Attached is `k53-signs-input.json` — 293 road-sign records. For each record, draft two short pieces of learner-facing text and decide whether the record needs splitting.

INPUT FIELDS
- `id`: database id. Must be preserved exactly.
- `codes`: official sign code(s).
- `name`: official sign name.
- `heading` / `subheading`: administrative categories (not needed in the output).
- `where` / `purpose` / `action`: the full manual text. It may contain `**` markdown bold — ignore the asterisks.
- `temporary`: true for temporary signs.
- `image_codes`: codes of the images attached to the record. More than one entry may mean the record combines multiple signs.

OUTPUT
Return ONLY a valid JSON array — no prose, no markdown fences, no trailing commas — with one object per input record, in the same order:

[
  {
    "id": 3,
    "short_meaning": "You must come to a complete stop.",
    "short_action": "Stop behind the line, check both ways, and go only when safe.",
    "needs_split": false
  }
]

RULES
1. `short_meaning` — one line telling the driver what the sign means.
   - 4–15 words. Never more than 15.
   - Plain, simple South African English (British spelling). Short words, one idea.
   - Do not start with "This sign" and do not repeat the sign's name word-for-word; explain it.
   - Required for every record; never null or empty.
2. `short_action` — what the driver must do.
   - 5–20 words. Never more than 20. Start with a verb (Stop, Give way, Slow down, Keep left, …).
   - Use `null` ONLY when the sign genuinely requires no driver action (route markers, information signs). Do not invent an action.
3. `needs_split` — `true` only when the record clearly combines two or more distinct signs or messages that should be separate cards (e.g. unrelated codes or unrelated sign faces). Otherwise `false`. Be conservative; default to `false`. Multiple `image_codes` usually show variants of the same sign (e.g. arrow left/right/ahead) — do NOT mark those for splitting.
4. Accuracy: use the official South African road-sign meaning. Follow the K53 manual wording in the record when it is clear, but make it easier to read. Do not add rules that are not there. For temporary signs, describe the condition they warn about.
5. Style: no markdown, no asterisks, no quotation marks around the text, no emojis, no "probably / may / might" hedging, no reference to codes or categories, and avoid saying "the sign" more than necessary.
6. Include EVERY record exactly once, preserving its `id`. The output array must contain 293 objects.
7. The JSON contains no images — rely on `name`, `purpose` and `action` for meaning.
8. If you cannot finish all 293 objects in one response, do not truncate silently: say so, and I will ask you to continue with the next batch.

QUALITY BAR
A learner should understand the meaning in under 3 seconds and know exactly what to do. Prefer shorter over longer.
