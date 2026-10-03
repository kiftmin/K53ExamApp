# K53ExamApp — Road Signs Study Module: Build Spec

Adds the first of three planned cold-study modules (Road Signs now; Rules of
the Road and Vehicle Controls later, on the pattern established here).
Covers DB schema, import/reconciliation, API, admin editor, and mobile
browse + flashcards.

---

## 1. Database

### 1.1 New tables (`server/db.ts`)

```ts
export const studySigns = pgTable('study_signs', {
  id: serial('id').primaryKey(),
  heading: text('heading').notNull(),
  subheading: text('subheading').notNull(),
  name: text('name').notNull(),
  codes: jsonb('codes').notNull(),                 // string[]
  images: jsonb('images').notNull().default('[]'), // { code: string; image_url: string }[]
  where_text: text('where_text'),
  purpose_text: text('purpose_text'),
  action_text: text('action_text'),
  is_verified_exam_question: boolean('is_verified_exam_question').default(false).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const signQuestions = pgTable('sign_questions', {
  id: serial('id').primaryKey(),
  sign_id: integer('sign_id').references(() => studySigns.id, { onDelete: 'cascade' }).notNull(),
  question_id: integer('question_id').references(() => questions.id, { onDelete: 'cascade' }).notNull(),
});
```

Add the matching `CREATE TABLE IF NOT EXISTS` statements to the `/api/seed`
route in `api/index.ts`, following the existing pattern for `questions`.

### 1.2 Zod schema (`shared/schema.ts`)

```ts
export const signImageSchema = z.object({
  code: z.string(),
  image_url: z.string(),
});

export const studySignSchema = z.object({
  id: z.number().optional(),
  heading: z.string(),
  subheading: z.string(),
  name: z.string(),
  codes: z.array(z.string()).min(1),
  images: z.array(signImageSchema).default([]),
  where_text: z.string().nullable().optional(),
  purpose_text: z.string().nullable().optional(),
  action_text: z.string().nullable().optional(),
  is_verified_exam_question: z.boolean().default(false),
});

export type StudySign = z.infer<typeof studySignSchema> & { id: number };
export type InsertStudySign = Omit<z.infer<typeof studySignSchema>, "id">;

export type SignQuestionLink = { id: number; sign_id: number; question_id: number };
```

Raw import format (matches `Allsigns.json` verbatim, for the seed/import
step before images are matched):

```ts
export const rawSignImportSchema = z.object({
  Heading: z.string(),
  Subheading: z.string(),
  Name: z.string(),
  Codes: z.array(z.string()),
  Where: z.string().optional(),
  Purpose: z.string().optional(),
  Action: z.string().optional(),
});
```

---

## 2. Image matching strategy

Codes contain characters that aren't filename-safe (`(R)511`, `GA5.011`,
`R321-P`). Normalize both sides with the same slug function before
comparing:

```ts
function slugifyCode(code: string): string {
  return code.replace(/[^A-Za-z0-9]/g, "_");
}
```

Import flow (`Import` section of admin, or a dedicated "Signs Import" flow):

1. Upload `Allsigns.json` → bulk-insert into `study_signs` with `images: []`.
2. Upload a batch of image files. For each file, strip the extension and
   compare against `slugifyCode(code)` for every code across every sign.
3. Auto-attach confident matches (exact slug match) directly into that
   sign's `images` array.
4. Everything else — unmatched images, and signs/codes with no image at
   all — goes into a **reconciliation list**: two columns (unmatched
   images / codes still needing an image), admin manually pairs them by
   clicking one from each side, or uploads a fresh file directly against
   a specific code. This step is required, not optional — expect roughly
   a third of images to need manual pairing based on the sample set.
5. Store final images as static assets under
   `client/public/assets/signs/{slugified-code}.{ext}`, referenced in the
   DB as `/assets/signs/{slugified-code}.{ext}` — same relative-path
   convention `question_modal.tsx` already uses for `image_link`.

---

## 3. API routes (`server/routes.ts`)

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/signs` | List, with `?heading=`, `?subheading=`, `?search=`, `?verified=` filters |
| GET | `/api/signs/:id` | Single sign, including linked question ids |
| POST | `/api/signs` | Create (admin) |
| PATCH | `/api/signs/:id` | Update fields / images array (admin) |
| DELETE | `/api/signs/:id` | Delete (admin) |
| POST | `/api/signs/import` | Bulk insert from raw JSON (admin) |
| POST | `/api/signs/:id/images` | Attach/replace an image for a specific code (admin) |
| GET | `/api/signs/unmatched-images` | List uploaded images not yet paired to a code (admin) |
| GET | `/api/signs/:id/questions` | Linked question bank entries |
| POST | `/api/signs/:id/questions` | Link a question (`{ question_id }`) (admin) |
| DELETE | `/api/signs/:id/questions/:questionId` | Unlink (admin) |

Mobile-facing endpoints only need `GET /api/signs` (with filters) and
`GET /api/signs/:id/questions` — no auth beyond the existing access-code
gate. The rest sit behind the same admin session check used elsewhere in
`admin.tsx`/`admin-gate.tsx`.

---

## 4. Admin: Signs section

Slots into the nav shell from the admin console redesign as a new item
alongside Question Bank / Sources / Access Codes / Import.

**4.1 List view** — grid of cards (thumbnail of first available image,
name, heading badge, code chips, verified checkmark). Filter bar: heading
dropdown, subheading dropdown (dependent on heading), search, "missing
image" toggle, "unverified" toggle.

**4.2 Edit form** (reuse the `QuestionModal` dialog pattern) — heading,
subheading, name, codes (tag input, add/remove), Where/Purpose/Action
(textareas), a linked-questions picker (searchable multi-select against
`/api/questions`, writes to `sign_questions`), `is_verified_exam_question`
checkbox, and one image slot per code with upload/replace.

**4.3 Import & reconcile view** — the two-step flow from Section 2: JSON
upload → bulk insert, then image batch upload → auto-match table +
manual-pairing panel for leftovers.

Components: `SignsSection`, `SignCard`, `SignEditForm`, `SignImportPanel`,
`ImageReconcilePanel`.

---

## 5. Mobile: Study module

New top-level nav entry from the home screen, alongside the existing quiz
flow — "Study" — landing on a module picker (Road Signs active now; Rules
of the Road / Vehicle Controls shown as "coming soon" so the IA doesn't
need rework later).

**5.1 Browse & Filter** (`StudySignsBrowse`)
- Sticky heading filter chips (the 7 top-level categories) + subheading
  sub-filter once a heading is picked.
- Search bar (name + code).
- List grouped by subheading, each row: thumbnail (or placeholder if no
  image yet), name, code chips.
- Tap → detail sheet: image(s) full-size, Where/Purpose/Action, a
  favorite toggle (writes to `localStorage["k53_favorite_signs"]`, an
  array of sign ids — no backend change needed), and, if linked questions
  exist, a "Practice this in a quiz" link.

**5.2 Flashcards** (`StudySignsFlashcards`)
- Deck built from the current filter selection (heading/subheading/
  favorites-only), shuffled by default.
- Front: image (falls back to codes as text if no image matched yet).
  Back: name + Where/Purpose/Action. Tap or swipe up/down to flip; swipe
  left/right to advance.
- Session controls: shuffle toggle, favorites-only toggle, and an
  "unseen only" toggle backed by a locally-tracked `k53_seen_signs` id
  set in `localStorage` — same storage pattern `quiz-context.tsx` already
  uses for quiz state, so no new persistence layer.
- Progress indicator (`12 / 84`) for the current deck.

Components: `StudyModulePicker`, `StudySignsBrowse`, `SignDetailSheet`,
`StudySignsFlashcards`, `FlashcardControls`, plus a small
`lib/sign-storage.ts` for the favorites/seen-ids localStorage helpers.

---

## 6. Rollout note for the other two books

Rules of the Road and Vehicle Controls are prose-based, not
code+image records, so they won't fit `study_signs` as-is. When you get
to them: keep the *pattern* (a dedicated table per module, a shared
localStorage convention for favorites/seen, a module picker screen that
already has the slot reserved) but expect a different table shape —
likely heading/subheading/title/body rather than codes/images. Worth
revisiting this spec's Section 1 and 5 as a template once you have that
book's source material in hand, rather than trying to force one generic
"study item" table across all three now.
