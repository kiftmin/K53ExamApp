# K53ExamApp — Rules of the Road Study Module: Build Spec

Second of the three cold-study modules. Follows the pattern set by the Road
Signs module (see `road-signs-study-module-spec.md`) but adapted for prose
rules with per-learner-code applicability instead of code+image records.

---

## 1. The core problem this spec solves

The manual is not naturally card-sized. A subsection like 6.1 (Lights)
contains 5-6 independently testable facts; a subsection like 6.24
(Emergency Warning Triangles) is one continuous procedure that shouldn't
be split. So this is not a mechanical one-record-per-heading import like
the signs JSON was — it needs **atomization**: breaking each numbered
subsection into one or more self-contained rule statements, each tagged
with which learner code(s) it applies to.

## 2. Code-tagging rule

Four tags, stored as an array so a card can carry more than one:

| Code | Meaning |
|---|---|
| `0` | Code-agnostic — applies to every learner regardless of licence code |
| `1` | Motorcycle-specific |
| `2` | Light Motor Vehicle-specific |
| `3` | Heavy Motor Vehicle-specific |

**Tagging source of truth:** where the manual itself splits a subsection
by vehicle class (e.g. "6.1.1 Motorcycles" vs "6.1.2 Light and Heavy
Motor Vehicles"), tag accordingly. Where it doesn't split and the rule
plainly applies to all drivers (general conduct, intersections,
pedestrians, accidents), tag `0`. Where a subsection covers light AND
heavy together under one heading (as most do — "Light and Heavy Motor
Vehicles"), tag it `[2, 3]`, not `[0]` — a motorcycle-only learner
doesn't need windscreen-wiper specs.

**Filtering rule (query-time, not a tagging rule):** because Code 3
covers both light and heavy vehicles per the manual's own Section 5.1
table, expand the learner's selected code before filtering:

```
code 1 (motorcycle)  → show cards tagged 0 or 1
code 2 (light)        → show cards tagged 0 or 2
code 3 (light+heavy)  → show cards tagged 0, 2, or 3
```

Don't store the expansion — store what the source text actually says,
expand in the API query. That keeps the data auditable against the PDF.

**Flagged ambiguity — needs your call, not an assumption:** Section 5.1's
three licence-code descriptions (minimum age, what each code authorises)
read as general licensing knowledge every learner is tested on, not
motorcycle/LMV/HMV-specific operating rules. Recommend tagging all three
as `0` (every learner should know all three codes exist and what they
require) rather than tagging "Code 1 requirements" as `[1]` only. Flag
this to your coding agent explicitly rather than letting it guess either
way — it changes what a Code 2 learner sees.

## 3. Heading taxonomy

Maps the manual's own structure to `heading`/`subheading`:

| heading | subheading source | code default |
|---|---|---|
| Definitions | Section 2 acronyms/definitions | mostly `0`; vehicle-class-specific terms (goods vehicle, GCM, GVM, articulated) → `[3]`; motorcycle/tricycle/quadrucycle terms → `[1]` |
| Licensing & Codes | Sections 4-5 | `0` (see ambiguity note above for 5.1) |
| Road Traffic Rules | Section 6, by its own numbered subsections (6.1 Lights, 6.17 Seatbelts, etc.) — each subsection number becomes the `subheading` | per-card, from atomization |

`section_ref` (e.g. `"6.17.1"`) is stored on every card for traceability
back to the source manual — useful for admin review and for citing "see
manual section X" in the app if ever needed.

## 4. Schema

```ts
export const studyRules = pgTable('study_rules', {
  id: serial('id').primaryKey(),
  section_ref: text('section_ref').notNull(),        // "6.17.1"
  heading: text('heading').notNull(),                  // "Road Traffic Rules"
  subheading: text('subheading').notNull(),            // "Seatbelts"
  title: text('title'),                                 // short card label, optional
  body: text('body').notNull(),                         // the atomic rule statement
  applicable_codes: jsonb('applicable_codes').notNull(),// e.g. [0], [1], [2,3], [3]
  is_verified_exam_question: boolean('is_verified_exam_question')
    .default(false).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const ruleQuestions = pgTable('rule_questions', {
  id: serial('id').primaryKey(),
  rule_id: integer('rule_id')
    .references(() => studyRules.id, { onDelete: 'cascade' }).notNull(),
  question_id: integer('question_id')
    .references(() => questions.id, { onDelete: 'cascade' }).notNull(),
});
```

Same pattern as `study_signs`/`sign_questions`, now including the join
table: a rule card can link to more than one question bank entry, and a
question can be relevant to more than one rule card (e.g. a single exam
question about following distance might reasonably link to both the
2-second/3-second rule card and the "increase distance in poor
conditions" card).

No `favourite` column — confirmed: favourites stay client-side in
`localStorage` (`k53_favorite_rules`), consistent with Signs and with
the rest of the app's stateless, no-login server design.

## 5. Worked atomization examples

Use these as the pattern for your coding agent to replicate across the
rest of Section 6 — don't hand-atomize all 66 subsections in this spec;
have the agent (or an LLM-assisted extraction pass — see Section 7) do
the mechanical work against the rule above, and spot-check against these.

**6.1 Lights** →

| body | applicable_codes |
|---|---|
| "A motorcycle's lamps must be undamaged, properly secured, and capable of being lit at all times." | `[1]` |
| "A motorcycle's headlamp must be lit at all times, day and night." | `[1]` |
| "On a light or heavy motor vehicle, all lamps must be undamaged, unobscured, properly secured and capable of being lit at all times." | `[2,3]` |
| "Headlamps, rear lamps and number-plate lamps must be lit between sunset and sunrise, and at any other time when persons and vehicles aren't clearly visible at 150 metres." | `[2,3]` |
| "These lighting rules don't apply to a vehicle parked off the roadway, in a demarcated parking place, or within 12 metres of a lit street lamp." | `[2,3]` |

**6.17 Seatbelts** →

| body | applicable_codes |
|---|---|
| "Seatbelts are compulsory for children and adults aged 3 and older when the vehicle is moving forward." | `[0]` |
| "If seatbelts are fitted, rear-seat passengers must wear them while the vehicle is being driven." | `[0]` |
| "A child is defined as aged 3–14, unless taller than 1.5 metres, in which case they're treated as an adult regardless of age." | `[0]` |
| "An adult may not occupy a seat without a seatbelt if a seatbelt-equipped seat on that row is available." | `[0]` |
| "A driver must ensure a child uses an appropriate child restraint where available, or a seatbelt if no restraint is available." | `[0]` |
| "It is not compulsory to wear a seatbelt while reversing or moving in/out of a parking bay." | `[0]` |

(Seatbelt rules don't split by vehicle class in the source text, so
everything here is `[0]`.)

**6.61 Tyres** →

| body | applicable_codes |
|---|---|
| "A light motor vehicle's tyres must show a clearly visible tread pattern across the full width and circumference, at least 1mm deep." | `[2,3]` |
| "A motorcycle with an engine over 50cc must have tyres with a visible tread pattern at least 1mm deep across the full width and circumference." | `[1]` |
| "A motorcycle with an engine of 50cc or under must not run a tyre with less than 80% visible tread pattern across the tread width." | `[1]` |
| "A motorcycle may not be fitted with a retreaded tyre." | `[1]` |

---

## 6. API routes

Same shape as the signs module:

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/rules` | List, with `?code=1\|2\|3`, `?heading=`, `?subheading=`, `?search=`, `?verified=` |
| GET | `/api/rules/:id` | Single card, with linked question if any |
| POST | `/api/rules` | Create (admin) |
| PATCH | `/api/rules/:id` | Update (admin) |
| DELETE | `/api/rules/:id` | Delete (admin) |
| POST | `/api/rules/import` | Bulk insert from a structured import file (admin) |
| GET | `/api/rules/:id/questions` | Linked question bank entries |
| POST | `/api/rules/:id/questions` | Link a question (`{ question_id }`) (admin) |
| DELETE | `/api/rules/:id/questions/:questionId` | Unlink (admin) |

`?code=` on the mobile-facing GET applies the expansion rule from
Section 2 server-side, so the client just sends the learner's selected
code and gets back the correct set.

## 7. Import approach

Doing this atomization by hand for ~60 remaining subsections is real
work, not a paste job — recommend an LLM-assisted first pass rather than
fully manual transcription:

1. Split the manual text by numbered subsection (6.1, 6.2, ... 6.66,
   plus Sections 2, 4, 5).
2. For each subsection, prompt an LLM with the tagging rule from Section 2
   and the worked examples from Section 5, asking it to return atomized
   `{section_ref, subheading, body, applicable_codes}` records as JSON.
3. **Do not auto-publish the output.** Route it into the same kind of
   reconciliation review the signs image-matching used: an admin screen
   listing generated cards grouped by subsection, editable inline, with
   an "approve" action per card or per subsection before it becomes live
   content. Exam-relevant numeric thresholds (150 metres, 45 metres, 30
   km/h, etc.) are exactly the kind of detail an automated pass can subtly
   mangle, and this is graded content — it needs a human check.
4. Definitions (Section 2) are a reasonable one-pass exception since
   they're already atomic (one term = one card) — lower review priority
   than Section 6.

## 8. Admin: Rules section

Adds to the same nav shell as Signs/Question Bank/Sources/Access
Codes/Import.

- **List view** — table/cards grouped by subheading, code-tag chips
  instead of thumbnails, verified checkmark, search + code filter +
  "missing question link" filter.
- **Edit form** — section_ref, heading/subheading, body text, a
  multi-select for `applicable_codes` (checkboxes: Code-agnostic /
  Motorcycle / Light / Heavy — not mutually exclusive), a searchable
  multi-select question-bank picker (reuse the same component built for
  Signs — it's already generic against a `{parent_id, question_id}` join
  table, just point it at `rule_questions` instead of `sign_questions`),
  verified toggle.
- **Import & review queue** — the reconciliation view from Section 7:
  generated cards awaiting approval, editable before publish.

Components: `RulesSection`, `RuleCard`, `RuleEditForm`, `RuleImportReview`
(mirrors `SignsSection`/`SignEditForm`/`ImageReconcilePanel` structurally).

## 9. Mobile: Study module integration

Extends the "Study" module picker already built for Road Signs — Rules
of the Road moves from "coming soon" to active, sharing the same landing
screen.

- **Session start:** before entering Rules study (browse or flashcards),
  prompt for licence code (1/2/3) if not already set for this session —
  a simple 3-option picker, remembered in `localStorage` for the session
  (not tied to any account, consistent with the rest of the app's
  no-login design). Re-selectable from within the module at any time.
- **Browse & Filter** (`StudyRulesBrowse`) — grouped by subheading, a
  code badge per card showing which code(s) it applies to (useful even
  though the list is pre-filtered, so the learner understands *why* a
  card is showing them), search by keyword.
- **Flashcards** (`StudyRulesFlashcards`) — front: the rule statement (or
  a short title if you populate `title`); back: nothing further needed
  since these are already atomic, but show `section_ref` in small text
  for learners who want to cross-check the source manual. Same session
  controls as Signs flashcards: shuffle, favourites-only, unseen-only —
  reuse `lib/sign-storage.ts`'s pattern as `lib/rule-storage.ts` with its
  own localStorage keys.

No new components needed for the module picker itself — just unlock the
existing "Rules of the Road" tile and point it at these new screens.

## 10. What's deliberately left for Vehicle Controls later

Same note as the signs spec: don't try to generalize `study_rules` into
a fully generic "study item" table in anticipation of the Vehicle
Controls book. Wait until you have that source material — it's likely
closer to the signs shape (labelled diagrams of dashboard/pedal
components) than to this prose-rule shape, and forcing both patterns
into one table now would cost more than it saves.
