# Vehicle Controls — Simplification Prompt: Remove Automatic-Gearbox Variants

## Context

The Vehicle Controls module currently covers five diagrams/variants:
motorcycle (code 01), LMV manual (02), LMV **automatic**, HMV manual (03),
and HMV **automatic**. The automatic variants exist only because the
controls manual happens to contain material for them, and were inferred
(HMV auto is flagged `is_inferred`) or ambiguous (LMV manual/auto) during
import. Codes 01/02/03 exams only require the manual vehicle controls.

All `study_controls` rows should be linkable to the three real vehicle
license codes: **01 (motorcycle), 02 (light motor vehicle), 03 (heavy
motor vehicle)**.

## What to do

1. **Data removal (DB)**
   - Delete `study_controls` rows whose `diagram_id` belongs to the LMV-automatic
     and HMV-automatic diagrams (and their `control_questions` links first).
   - Delete the LMV-automatic and HMV-automatic rows from `control_diagrams`.
   - Review any sample questions (`questions.category = 3`) that referenced
     only removed controls: delete or unlink them as appropriate, keeping
     ones still linked to surviving controls.
   - Reassign/verify `applicable_codes` on surviving controls to the correct
     subset of `{1, 2, 3}`.

2. **Admin UI**
   - Remove all references to "automatic" from the admin controls UI
     (diagram labels/selects, filters, import notes).
   - Remove the two now-meaningless review-flag chips from
     `control-review.tsx`: "HMV-auto inferred" and "LMV manual/auto
     ambiguity". Keep "Generated distractors".
   - The Diagrams placement tab, Browse list, and flashcards should only
     ever surface the three remaining diagrams.

3. **Learner UI**
   - `ControlsStudyGate` and the browse/flashcards queries should no longer
     offer an automatic gearbox option — code 01 has no gearbox choice,
     codes 02/03 are manual only. Simplify the gate accordingly.

4. **Regenerate the import bundle**
   - Re-export/trim the controls import bundle so it contains only
     motorcycle + LMV manual + HMV manual diagrams, controls, and sample
     questions. A future re-import must NOT silently bring the automatic
     variants back. Keep the bundle format identical to the current one
     (`rawControlBundleSchema`), minus the two automatic variants.

5. **Verify**
   - `control_diagrams` has exactly 3 rows (motorcycle, LMV manual, HMV manual).
   - Every `study_controls.diagram_id` points at one of those 3.
   - No `questions` row with `category = 3` is linked (via `control_questions`)
     to a deleted control.
   - Admin UI shows no "automatic" strings; review queue shows no HMV-auto
     or LMV-ambiguity filters.
   - `npx tsx script/build.ts` succeeds.
