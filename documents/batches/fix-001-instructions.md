# Repair batch — strict formatting

17 items failed the exact-match test. For each item in `fix-001.json`, produce corrected formatting.

## Hard rules
- Start from `original_text`, NOT from `previous_attempt`.
- You may insert only: `**` around keywords, `\n` line breaks, line-start markers `(i) (ii) (iii)`, and one `:` immediately before a list.
- Every other character must match `original_text` exactly: words, typos, spelling, punctuation, capitalisation, repeated "if"/"and", double periods.
- Do NOT fix typos or grammar (`e3nough`, `of the road`, `are`, `midibuses. and`, `vehicle from both directions`).
- Do NOT reorder sentences.
- Do NOT add introductory labels.
- Output only a JSON array of `{id, table, field, formatted_text}` — no markdown fences, no commentary.

## Self-check (must pass)
Remove all `**`, all line-start markers, all `:`, collapse whitespace; the result must equal a similarly normalised `original_text` character-for-character.

The `problem` field tells you exactly what the previous attempt changed.

Paste the contents of `fix-001.json` after these rules, then save the reply as:
`documents/batches/output/batch-fix-001-out.json`
