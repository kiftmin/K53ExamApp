# K53ExamApp — Technical Design and Functioning Report

**Snapshot:** Branch `main`, latest pushed commit `2525b57 fix: enforce per-learner progress isolation`. The working tree also contains uncommitted Controls-revision and progress-ownership changes, plus the new `client/src/lib/progress-owner.ts`. This report describes that working-tree state.

**Purpose:** Explain the app end-to-end so another AI agent can review its design, behaviour, and likely problem areas without direct code access.

---

## 1. Executive summary

K53ExamApp is a mobile-first South African K53 learner-driver study and practice-test web app. It combines:

- A public dashboard with access-code entry.
- Practice tests: one category at a time or a 64-question exam simulation.
- Study modules for Road Signs, Rules of the Road, and Vehicle Controls.
- Flashcard self-rating with a custom “mastery”/Continue Learning system.
- A server-synced progress store for Weekly/Monthly/Master access codes.
- An admin console for question-bank management, study-content imports, image management, sources, and access codes.

The app has no user accounts, passwords, server sessions, or payment system. Learner identity is effectively the mobile number attached to a W/M/X access code. Daily codes are anonymous and keep progress only in browser storage.

The strongest architectural themes are:

1. **Client-heavy application** — quiz scoring, answer selection, flashcard scheduling, mastery calculation, and access gating mostly run in the browser.
2. **Best-effort server sync** — progress is synchronised when possible, but localStorage remains the working copy.
3. **Content-first design** — a large question bank and three study-content libraries are managed through admin imports.
4. **Custom, unvalidated mastery heuristic** — Continue Learning is not Anki/SM-2/FSRS; it is a simple status model based on self-reported recall ratings.

---

## 2. Product and user journeys

### 2.1 Home dashboard

`/` is public. It displays:

- Branding and dashboard tiles for **Study**, **Category Test**, and **Exam Simulation**.
- Optional access-code verification card when the user arrives via a gated route such as `/?unlock=/study`.
- A **Continue Learning** card when at least one started study group has weak items.
- A slide-out menu and bottom navigation with Home, Study, and Admin links.

The Home page fetches all signs, rules, controls, and control diagrams even before access-code validation. Content endpoints are public.

### 2.2 Access-code flow

`useAccessCode()` manages a 7-character code and optional 10-digit mobile number.

- Codes beginning `D`, `W`, `M`, or `X` are accepted.
- W/M/X require a linked 10-digit mobile.
- On successful validation, the code and mobile are stored in `sessionStorage`.
- The Study pages check only that `k53_access_code` exists; they do not revalidate it.
- On page load, `useAccessCode()` restores a saved code and immediately marks it `validated` without calling the server again.
- Logout removes the session code, mobile, learner name fields, quiz state, local study progress, favourites/done lists, and progress-owner marker.

### 2.3 Test flow

`/new-test` requires a validated access code and collects:

- Name, surname, licence code.
- Category or simulation mode.
- Question source filter.
- “Only official questions” toggle.

On submit, the candidate details are saved in localStorage and the quiz is started in memory and persisted to `driving-license-quiz-state`.

`/quiz` presents one question at a time with previous/next/restart, a live elapsed timer, and answer selection. `/results` shows pass/fail, category breakdown, percentage, elapsed time, and share-image actions. `/review` shows each question, the user’s answer, the correct answer, and linked sign/rule source cards where available.

### 2.4 Study flow

`/study` links to:

- Road Signs: browse by heading/subheading, search, favourite/done flags, sign detail, linked questions, flashcards.
- Rules of the Road: licence-code gate, browse/search, favourite/done, flashcards.
- Vehicle Controls: vehicle-type gate, diagram exploration, diagram quiz, browse list, recognition/recall flashcards.

Study routes redirect unauthenticated visitors to `/?unlock=<path>`.

### 2.5 Admin flow

`/admin` is gated by `AdminGate`. A user must enter a master `X` code flagged with admin access plus its linked mobile. Credentials are stored in `sessionStorage` and attached to API requests through `x-admin-key` and `x-admin-mobile`.

Admin sections: Question Bank, Signs, Rules, Controls, Sources, Access Codes, Imports.

---

## 3. Architecture

### 3.1 Stack

| Layer | Technology |
|---|---|
| Client | React 18, TypeScript, Vite, Wouter routing |
| Data fetching | TanStack React Query |
| UI | Radix UI primitives, Tailwind CSS, Framer Motion, Lucide icons |
| Server | Node.js, Express 5 |
| Database | Neon PostgreSQL over HTTP |
| ORM | Drizzle ORM |
| Validation | Zod, shared schemas |
| Build | Vite for client, esbuild for server bundle |
| Deployment | Docker + Nginx on VPS; optional Vercel API wrapper |

### 3.2 Runtime shape

```
Browser SPA
  ├── React routes / study / quiz / admin
  ├── localStorage: progress, favourites, quiz state
  └── sessionStorage: access code, mobile, admin credentials
        │
        ▼
Express API (/api/*)
  ├── access-code validation
  ├── learner-progress sync
  ├── content CRUD/import
  └── admin-protected operations
        │
        ▼
Neon PostgreSQL
```

In production the Express server also serves the built SPA from `dist/public`. In development, Vite middleware serves the client.

### 3.3 Build/runtime

- `npm run dev` → `tsx server/index.ts`.
- `npx tsx script/build.ts` → Vite client build + esbuild server bundle to `dist/index.cjs`.
- `npm run build` additionally runs `drizzle-kit push --force` first; the Docker build deliberately skips this.
- `npm run start` → `node dist/index.cjs`.
- `npm run check` is currently unusable repo-wide because of existing TypeScript errors; the build is the practical compile gate.
- Production client chunk is roughly 1 MB; build emits chunk-size and Browserslist warnings.

### 3.4 Startup database work

`server/index.ts` runs idempotent DDL on every boot for:

- `study_signs`, `sign_questions`
- `study_rules`, `rule_questions`
- `control_diagrams`, `study_controls`, `control_questions`
- `learner_progress`
- additive columns such as `position_x`, `position_y`, `study_rules.question`

This is convenient but not a migration system. There is no schema-version history.

---

## 4. Frontend design

### 4.1 Routing

| Route | Purpose |
|---|---|
| `/` | Dashboard, access-code entry, Continue Learning |
| `/new-test` | Candidate details and test configuration |
| `/quiz` | Active test |
| `/results` | Result card and score breakdown |
| `/review` | Detailed answer review |
| `/study` | Study module hub |
| `/study/signs` | Sign browser |
| `/study/signs/flashcards` | Sign flashcards |
| `/study/rules` | Rules browser |
| `/study/rules/flashcards` | Rules flashcards |
| `/study/controls` | Controls browser/diagram quiz |
| `/study/controls/flashcards` | Controls flashcards |
| `/admin` | Admin console |

### 4.2 State management

- React Query caches API data with `staleTime: Infinity`, no window-focus refetch, and no retries.
- Quiz state lives in React context and is mirrored to localStorage.
- Study progress, favourites, and done flags live in localStorage.
- Session credentials live in sessionStorage.
- There is no global auth provider; each page uses storage helpers directly.

### 4.3 Client-side gating

`useStudyGate()` returns true only if `k53_access_code` exists in sessionStorage. It does not check code type, expiry, revocation, or server validity.

This means:

- A saved but expired/revoked code still unlocks Study and the test form until logout.
- A user can manually set the storage key or call public content APIs directly.
- The gate is a UX barrier, not a server security boundary.

### 4.4 Admin client

`AdminGate` trusts `sessionStorage.k53_admin_auth === "1"` for rendering the console, but server operations still require valid headers. Manually setting the flag alone produces API 401s.

`queryClient.ts` attaches admin credentials to API requests and default GET queries. Credentials are therefore sent on more requests than just admin operations, though only to the same origin.

---

## 5. Backend and API

### 5.1 API groups

**Public learner/content APIs**

- `GET /api/questions`
- `GET /api/sources`, `/api/sources/active`, `/api/sources/active-ids`
- `POST /api/access-code/validate`
- `GET/POST /api/learner-progress`
- `GET /api/signs`, `/api/rules`, `/api/controls`, `/api/control-diagrams`
- Linked-content endpoints such as `/api/signs/:id/questions`, `/api/rules/:id/questions`, `/api/controls/:id/questions`, `/api/questions/:id/signs`, etc.
- `GET /api/admin/contact`
- `POST /api/admin/request-key`
- `POST /api/access-codes/validate-admin`

**Admin-protected APIs**

- Question CRUD, bulk upload, bulk source/category/official/duplicate updates, bulk delete.
- Source CRUD and activation.
- Daily code generation/lookup.
- Access-code listing, generation, revocation, deletion.
- Sign/rule/control import, CRUD, image upload, code/image removal, question linking.
- Control diagram update and image upload.

`requireAdminAuth` checks the `x-admin-key` and `x-admin-mobile` headers against a non-revoked master `X` code with `has_admin_access`.

### 5.2 Learner-progress APIs

`GET /api/learner-progress?code=...&mobileNumber=...&item_type=sign|rule|control`

`POST /api/learner-progress`

Both:

1. Validate the code+mobile pair.
2. Reject Daily codes with HTTP 403.
3. Use the mobile number stored on the access-code row, not the submitted one.
4. Read/write `learner_progress`.

This is a bearer-credential model: the code+mobile pair is the credential. There is no server session.

### 5.3 Error handling

- Invalid access code → HTTP 200 with `{ valid: false, message }`.
- Invalid progress credentials → 401.
- Daily progress sync → 403.
- Admin failure → 401.
- Most unexpected server errors → 500 with a message.
- Learner-progress reads/writes use a 3-attempt retry wrapper for Neon cold-start failures.

### 5.4 Logging

`server/index.ts` wraps `res.json` and logs the full JSON response body for every `/api` request. This can expose:

- Access-code lists, including codes, mobiles, and admin flags.
- Learner progress rows.
- Admin operation responses.
- Other response data that should not sit in logs.

The Vercel wrapper logs method/path/status only, not bodies.

---

## 6. Data model

### 6.1 Core tables

| Table | Purpose | Key fields |
|---|---|---|
| `questions` | Practice question bank | `question_number`, `question_text`, `category`, `license_code`, `options` JSONB, `source_id`, `is_duplicate`, `is_official`, `is_reviewed` |
| `sources` | Question provenance | `name`, `is_active` |
| `access_codes` | Access credentials | `code`, `type`, `mobile_number`, `has_admin_access`, `expires_at`, `is_revoked` |
| `study_signs` | Road-sign content | `heading`, `subheading`, `name`, `codes`, `images` JSONB, where/purpose/action text |
| `study_rules` | Rules content | `section_ref`, `heading`, `subheading`, `title`, `question`, `body`, `applicable_codes` |
| `control_diagrams` | Vehicle diagrams | `vehicle_type`, `gearbox`, `label`, `image_url` |
| `study_controls` | Diagram components | `diagram_id`, `component_number`, `component_name`, `function_notes`, `position_x`, `position_y` |
| `sign_questions` | Sign-to-question links | `sign_id`, `question_id` |
| `rule_questions` | Rule-to-question links | `rule_id`, `question_id` |
| `control_questions` | Control-to-question links | `control_id`, `question_id` |
| `learner_progress` | Synced study state | `mobile_number`, `item_type`, `item_id`, `status`, counts, rating, timestamps |

### 6.2 Important data properties

- `learner_progress` has a raw-DDL unique constraint on `(mobile_number, item_type, item_id)`.
- In `server/db.ts`, the Drizzle table definition calls `unique()` but does not import `unique` from `drizzle-orm/pg-core`. The server runs because the table callback may not be exercised, and the actual database constraint comes from raw DDL. This is a latent schema/type-checking issue.
- `questions.question_number` is not unique, yet the quiz stores answers keyed by `question_number`. Duplicate question numbers would collide and corrupt scoring/review.
- There is no `users`, `sessions`, `test_attempts`, or `payments` table.
- There is no audit table for admin changes.
- Link tables have no uniqueness constraint, so duplicate links are possible.

### 6.3 Content volume

Current study content, from prior verification:

- 293 signs across 21 heading/subheading groups.
- 252 rules across 70 groups.
- 49 controls across 3 diagrams: Motorcycle 27, LMV manual 11, HMV manual 11.
- Total: 594 study items across 94 groups.

Group sizes vary widely, which materially affects group-level mastery and Continue Learning.

---

## 7. Access control and authentication

### 7.1 Code types

| Type | Prefix | Mobile required | Expiry | Progress sync |
|---|---|---|---|---|
| Daily | `D` | No | Today’s deterministic code, or on-demand daily until next SAST midnight | No |
| Weekly | `W` | Yes | 7 days from creation | Yes |
| Monthly | `M` | Yes | 30 days from creation | Yes |
| Master | `X` | Yes | Never, but revocable | Yes |

- Daily codes are HMAC-SHA256 derived from `ACCESS_CODE_SECRET` and the SAST date (`UTC+2`).
- On-demand W/M/X codes are random 7-character codes stored in `access_codes`.
- Admin access requires a master `X` code with `has_admin_access`, non-revoked, with matching mobile.
- Mobile numbers are exactly 10 digits, but there is no real South African number validation beyond that.
- A revoked/expired code is rejected server-side when validation is actually performed.

### 7.2 Security strengths

- Admin routes were moved behind `requireAdminAuth` in commit `2525b57`.
- Daily code generation/lookup and access-code management now require admin authentication.
- Learner progress revalidates code+mobile on every request.
- Daily codes cannot sync progress.
- Admin auth is server-side, not merely the client gate.
- Verification confirmed: unauthenticated admin endpoints 401, Daily progress 403, valid W/M/X 200, wrong mobile 401.

### 7.3 Security gaps and review points

1. **Study/test content is not server-gated.** `/api/signs`, `/api/rules`, `/api/controls`, and `/api/questions` are public. The client study gate can be bypassed by storage manipulation or direct API calls.
2. **Saved codes are not revalidated on mount.** `useAccessCode()` trusts sessionStorage and marks a code validated immediately.
3. **No rate limiting.** `/api/access-code/validate`, admin validation, and `/api/admin/request-key` have no throttling. Code guessing and email-spam abuse are possible.
4. **Master credentials live in sessionStorage.** An XSS bug could steal a long-lived master key. The key is attached to all API calls through the shared query client.
5. **Response-body logging** can leak access codes, mobiles, and progress into logs.
6. **No session/CSRF/security-header layer.** No Helmet/CSP, no server sessions, no CSRF tokens. The custom-header admin design reduces classic CSRF risk but does not remove XSS risk.
7. **Mobile number is a weak identity.** Anyone with the code+mobile pair can read/write that learner’s progress. Family/shared-number use merges learners.
8. **Revoking a code does not revoke local study access.** Content is public and the client gate only checks presence.
9. **Public `/api/admin/request-key`** can trigger admin emails without authentication or rate limits.
10. **Admin email is exposed** through `/api/admin/contact`.

---

## 8. Test engine

### 8.1 Question selection

`startQuiz()` runs entirely client-side:

- Filter by category.
- Apply official-only, source, active-source, and duplicate filters.
- Separate questions into licence-specific (`license_code === user.licenseCode`) and general (`"00"`).
- For Rules/Signs category tests: 28 questions, taking at least 4 licence-specific where available, filling the rest from general, then fallback from any remaining filtered question.
- For Controls category tests: 8 questions, all intended to be licence-specific.
- For simulation: 28 Rules + 28 Signs + 8 Controls = 64 questions.
- Shuffle the final selection.

If there are not enough matching questions, it silently fills from whatever remains in the filtered pool.

### 8.2 Scoring and pass thresholds

| Category | Questions | Pass mark |
|---|---:|---:|
| Rules | 28 | 22 correct |
| Signs | 28 | 23 correct |
| Controls | 8 | 6 correct |

- Category test: pass if the selected category reaches its threshold.
- Simulation: pass only if all three categories pass.
- Results include percentage and category breakdown.
- Scoring is client-side from `answers[question_number]` against `options[].correct_answer`.

### 8.3 Test-engine limitations

- The timer is displayed but not enforced; there is no automatic submission or time limit.
- Correct answers are returned by the public `/api/questions` endpoint.
- Quiz state and answers are localStorage-editable.
- No test attempt is stored on the server.
- No linkage between test results and study mastery.
- Duplicate `question_number` values would cause answer collisions.
- The UI labels the simulation “timed” but does not implement a countdown.

---

## 9. Study modules

### 9.1 Road Signs

- Browse by heading/subheading, search, favourite/done flags.
- Sign detail shows images, codes, Where/Purpose/Action text, and linked practice questions.
- Flashcards show image/code on the front and name/where/purpose/action on the back.
- Four ratings: Again, Hard, Good, Easy.
- Revision mode reads `?revision=1`, includes `new` and `learning` items, sorts by group mastery.
- Signs are not filtered by licence code.

### 9.2 Rules of the Road

- Requires a licence-code gate: 1 = motorcycle, 2 = light vehicle, 3 = light + heavy.
- Server expands applicable codes: 1 → `[0,1]`, 2 → `[0,2]`, 3 → `[0,2,3]`.
- Browse/search, favourites/done, flashcards.
- Flashcard front uses the generated question or body; back shows the rule body.
- Revision mode includes `new`/`learning`, sorted by group mastery.

### 9.3 Vehicle Controls

- Requires a vehicle-type gate: motorcycle, LMV, HMV.
- The gearbox selection was removed; the gate returns `gearbox = null`. Legacy gearbox storage helpers remain.
- Explore mode shows diagram markers, component list, favourites/done, and a diagram quiz.
- Flashcard modes: Recognition (diagram/number → name) and Recall (function → name/number).
- Revision mode includes `new`/`learning`, sorted by diagram-group mastery.
- Revision fetch uses `/api/controls?vehicle_type=...`, while Home’s mastery summary uses all controls across all vehicle types.

### 9.4 Flashcard rating semantics

| Current status | Again | Hard | Good | Easy |
|---|---|---|---|---|
| new | learning | learning | learning | learning |
| learning | learning | learning | review | review |
| review | learning | learning | review | mastered |
| mastered | learning | learning | mastered | mastered |

Important consequences:

- The first rating of any kind never produces `review` or `mastered`.
- `Easy` on a learning card only moves it to `review`, not `mastered`.
- `Good` holds mastery once mastered.
- `Again`/`Hard` always demote to `learning`.
- `correct`/`incorrect` counters are maintained but not used by Continue Learning.
- `lastSeenAt` is stored but not used for scheduling or decay.

### 9.5 “Seen” behaviour

Advancing a card calls `markSignSeen` / `markRuleSeen` / `markControlSeen`.

- If no record exists, a `learning` record is created with `lastRating: "good"` and zero correct/incorrect.
- If the record is `new`, it becomes `learning`.

Therefore simply browsing past a card creates weak progress without any self-rating.

---

## 10. Progress persistence and sync

### 10.1 Local storage keys

- `k53_sign_learning`, `k53_rule_learning`, `k53_control_learning`
- `k53_favorite_signs`, `k53_favorite_rules`, `k53_favorite_controls`
- `k53_done_signs`, `k53_done_rules`, `k53_done_controls`
- `k53_progress_owner`
- `k53_rules_licence_code`, `k53_controls_licence_code`, `k53_controls_gearbox`
- `k53_name`, `k53_surname`, `k53_license_code`
- `driving-license-quiz-state`

Session keys:

- `k53_access_code`
- `k53_mobile_number`
- `k53_admin_auth`
- `k53_admin_key`
- `k53_admin_mobile`

### 10.2 Sync eligibility

Progress sync is enabled only when:

- A code exists in sessionStorage.
- A mobile exists in sessionStorage.
- The code prefix is `W`, `M`, or `X`.

Daily codes and no-code sessions remain local-only.

### 10.3 Hydration semantics

`hydrateProgress()`:

- If the server request fails → keep local data and retry on next mount.
- If the server has any rows → replace the entire local map with the server map.
- If the server has zero rows → upload the local map once and keep it.
- Captures the code+mobile identity and refuses to write back if the session changes mid-sync.

### 10.4 Ownership model

`k53_progress_owner` stores either:

- The mobile number for W/M/X, or
- The literal string `"daily"` for Daily codes.

`ensureLocalOwner()`:

- If no owner and local data exists, it adopts the local data for the current identity (legacy migration).
- If the owner matches, it does nothing.
- If the owner differs, it clears all local sign/rule/control learning, favourites, and done lists, then sets the new owner.
- It is called after verification and before each module sync.
- `recordOwnerIfMissing()` is called on first W/M/X rating if no owner exists.
- Logout clears the owner and local data.

### 10.5 Sync risks

1. **Server data can overwrite unsynced local data.** If the server has any rows, the entire local map is replaced. Ratings made while offline or during failed pushes can be lost.
2. **Partial uploads are not repaired.** If uploading a local map fails midway, the server now has some rows. The next sync sees a non-empty server and replaces the full local map with the partial server map.
3. **Out-of-order writes.** `pushProgress` is fire-and-forget. Rapid ratings can arrive out of order; the server has no version check and last write wins.
4. **Non-atomic upsert.** The server selects then inserts/updates. Two concurrent first writes can both attempt inserts and hit the unique constraint.
5. **Daily progress is device-global.** Every Daily learner on the same browser shares the `"daily"` owner and progress.
6. **Legacy adoption can leak data.** If local data exists with no owner, the first newly verified learner adopts it rather than clearing it.
7. **Brief stale UI on identity switch.** `ensureLocalOwner()` runs in an effect after Home’s first render, so old Continue Learning data can briefly appear.
8. **No user-visible sync status.** Failures are silent; users cannot tell whether progress reached the server.
9. **Favourites/done lists are never synced.** They are local only and are cleared on identity switch/logout.

---

## 11. Continue Learning algorithm

### 11.1 Grouping

`mastery-summary.ts` aggregates study items into groups:

- Signs: exact `heading` + `subheading`.
- Rules: exact `heading` + `subheading`.
- Controls: diagram `label`, with `subheading` treated as `"(general)"`.

Home combines all groups from all three modules.

### 11.2 Formula

For each group:

- `mastered` items: `mastered++`, `total++`.
- `review` items: `total++`, `weak++`.
- `learning` items: `total++`, `weak++`.
- `new` items: `weak++` only; excluded from `total`.

Then:

```
pct = total === 0 ? 0 : round(mastered / total * 100)
```

So `pct` is **mastery among attempted items**, not mastery of the whole group.

### 11.3 Recommendation selection

`weakestGroups()`:

1. Combines all groups.
2. Keeps only groups where `total > 0 && weak > 0`.
3. Sorts by lowest `pct`, then highest `weak`.
4. Returns the top 3.

This means:

- A completely unstarted group (`total = 0`, `weak = N`) is hidden.
- A group with at least one attempted item can appear even if most items are new.
- New items inflate the displayed “shaky” count.
- Review items are counted as weak for recommendation, but revision decks exclude them.

### 11.4 Worked example

A 10-item group with:

- 3 mastered
- 2 review
- 1 learning
- 4 new

Produces:

- `total = 6`
- `weak = 7`
- `pct = 50%`

The UI would show approximately **“7 shaky · 50% mastered”**, even though only 6 items were attempted and 4 were never seen. The “50%” is 3 of 6 attempted, not 3 of 10 total.

### 11.5 Revision behaviour

- Continue Learning’s button uses only the first recommended group to choose a module path.
- It does **not** pass the group identity.
- The destination is the module-wide revision deck:
  - `/study/signs/flashcards?revision=1`
  - `/study/rules/flashcards?revision=1`
  - `/study/controls/flashcards?revision=1`
- The revision deck filters to `new` or `learning` items across the whole module, not just the recommended group.
- `review` items are excluded from revision even though they count toward `weak`.
- Signs revision ignores licence code.
- Rules revision is filtered by the rules licence-code gate.
- Controls revision is filtered by the stored vehicle type, but Home’s summary includes all vehicle types.

### 11.6 Algorithm interpretation and limitations

- It is a custom heuristic, not a validated spaced-repetition algorithm.
- It has no intervals, due dates, decay, forgetting curve, or objective correctness signal.
- It relies on self-reported Again/Hard/Good/Easy ratings.
- It conflates “unseen” with “shaky” in the weak count.
- It uses group-level aggregation, so one large group can dominate or dilute the signal.
- It excludes `review` from revision while still recommending groups because of review items.
- It can recommend a group whose only weak item is `review`, then open a deck with no card for that group.
- It can show “100% mastered” alongside a large shaky count when a group has one mastered item and many new items.
- The top comment in `mastery-summary.ts` says new items are excluded from the denominator and “not weak”, but the implementation increments `weak` for new items. The code and comment disagree.
- It is effective as a lightweight motivational dashboard, not as a measurement of learning or exam readiness.

---

## 12. Admin and content operations

### 12.1 Question bank

- CRUD, bulk upload, bulk source/category/official/duplicate updates, bulk delete.
- Source management and active-source filtering.
- Correct answers are stored inside each question’s JSON options.
- There is no server-side scoring endpoint.

### 12.2 Study content

- Signs/rules/controls can be imported from raw JSON.
- Signs support image upload, staged images, slug-based matching, and per-code image replacement.
- Rules support generated question text plus body.
- Controls support diagram images, component placement coordinates, and linked questions.
- Admin can link/unlink questions to signs, rules, and controls.

### 12.3 Image persistence

- Sign images are written to `dist/public/assets/signs` in production and persisted through the Docker volume `./sign-assets:/app/dist/public/assets/signs`.
- Diagram images are written to `dist/public/assets/diagrams`, but Docker does **not** mount a volume for that directory. Admin-uploaded diagram images are therefore lost on container rebuild.
- SVG is accepted, which creates a potential active-content risk if SVGs are served directly.
- Uploads are base64 JSON, limited by the server’s 10 MB JSON body limit.

### 12.4 Admin request flow

`/api/admin/request-key` sends an email to `ADMIN_EMAIL` if SMTP is configured, otherwise the client falls back to a `mailto:` link. It is public and unthrottled.

---

## 13. Deployment and operations

### 13.1 VPS/Docker

- Production image builds client and server with `npx tsx script/build.ts`.
- Runtime uses `node dist/index.cjs`.
- Nginx proxies to `127.0.0.1:5000`.
- Neon is remote; no local Postgres.
- Docker intentionally skips `db:push` to avoid schema changes on every build.
- `./sign-assets` volume persists sign images.

### 13.2 Vercel wrapper

`api/index.ts` and `vercel.json` provide an alternative serverless deployment. This wrapper:

- Registers the same routes.
- Exposes public legacy seed endpoints:
  - `GET /api/seed`
  - `GET /api/seed/signs`
- Does not run the full startup DDL from `server/index.ts`.
- Does not create `learner_progress` in its seed path.
- Writes uploaded images to a serverless filesystem, which is generally not persistent.

`/api/seed` creates an incomplete `questions` table and then attempts to insert full question objects, so it is likely broken as well as unsafe. If the Vercel path is live, these routes should be treated as a high-priority issue.

### 13.3 Build/runtime caveats

- `npm run build` uses `printf`, which is not native to PowerShell/CMD; on Windows, use `npx tsx script/build.ts` or Docker.
- No migration history or rollback path.
- `drizzle-kit push --force` can make schema changes directly against Neon.
- No health endpoint, no backup automation, no structured logging, no error monitoring.

---

## 14. Verification status

### 14.1 Security/API verification

The security commit was verified against a temporary server on port 5051:

- Unauthenticated `/api/access-codes` → 401.
- Unauthenticated `/api/access-code/today` → 401.
- Unauthenticated `/api/access-code/lookup` → 401.
- Authenticated admin → 200.
- Daily learner-progress GET/POST → 403.
- Valid W/M/X with matching mobile → 200.
- Valid code with wrong mobile → 401.

### 14.2 Follow-up verification

The uncommitted Controls/progress-ownership changes were checked with a temporary 17-case test script (removed afterward). It covered:

- Legacy ownerless data adoption.
- Different-learner clearing.
- Same-owner no-op.
- Weekly-to-Daily identity switch.
- Daily identity.
- First-rating owner stamping.
- Owner clearing.
- Controls grouping and mastery.
- New-only group exclusion.
- Revision ordering.
- Continue Learning excluding unstarted groups.
- Legacy upload.
- New learner uploading nothing.
- Returning learner restoring server data.

All 17 checks passed. `npx tsx script/build.ts` also passed.

### 14.3 Gaps

- No committed automated test suite.
- No browser/E2E test harness.
- Manual UI verification of logout isolation, Home-after-login, revision decks, and sync races was not completed.
- `npm run check` remains unreliable.

---

## 15. Principal risks and review questions

### High-priority risks

1. **Content access is client-only.** If Study/tests are meant to be paid or access-controlled, public content APIs are a bypass.
2. **Public seed endpoints in the Vercel wrapper.** `/api/seed` and `/api/seed/signs` are unauthenticated and likely unsafe/broken.
3. **Access codes and learner data are logged.** Full API response bodies are written to server logs.
4. **Progress sync can lose local data.** Server-wins hydration plus silent fire-and-forget uploads is unsafe for offline/partial sync.
5. **No rate limiting** on code validation, admin validation, or admin email requests.
6. **Daily progress is shared per browser**, not per learner.
7. **Continue Learning has semantic mismatches:** new items counted as weak, review items excluded from revision, group-level recommendations opening module-wide decks, and licence/vehicle mismatches.
8. **No server-side test scoring or attempt history.**
9. **Saved access codes are trusted without revalidation.**
10. **Admin master key lives in sessionStorage and is attached broadly.**

### Questions for the reviewing AI

1. Is the intended access boundary “admin only” or “paid learner content”? If paid, what should be server-gated?
2. Should Daily learners have a device identity, a mobile number, or no persistent progress at all?
3. Should sync merge local and server records by `updated_at`, or should one side always win?
4. Should unsynced local progress ever be deleted automatically?
5. Should Continue Learning count new items as weak, or exclude them from recommendations?
6. Should revision decks include `review` items, and should they be scoped to the recommended group?
7. Should progress and Continue Learning be scoped by licence code / vehicle type?
8. Is the Vercel deployment active, or only the Docker/VPS deployment?
9. Should test attempts, scores, and timing be persisted for learner history?
10. What is the desired conflict policy for two devices using the same mobile number?

---

## 16. Key file map

| Area | Files |
|---|---|
| App shell/routes | `client/src/App.tsx`, `client/src/main.tsx` |
| Home/Continue Learning | `client/src/pages/home.tsx` |
| Quiz engine | `client/src/lib/quiz-context.tsx`, `client/src/pages/quiz.tsx`, `client/src/pages/results.tsx`, `client/src/pages/review.tsx` |
| Access-code client | `client/src/lib/use-access-code.ts` |
| Progress sync | `client/src/lib/progress-sync.ts`, `progress-owner.ts`, `sign-storage.ts`, `rule-storage.ts`, `control-storage.ts` |
| Mastery/Continue Learning | `client/src/lib/mastery-summary.ts` |
| Study pages | `client/src/pages/study*.tsx` |
| Admin UI | `client/src/pages/admin.tsx`, `client/src/components/admin/*` |
| API routes | `server/routes.ts` |
| Access codes/auth | `server/access-code.ts`, `server/admin-auth.ts` |
| Database | `server/db.ts`, `server/storage.ts`, `shared/schema.ts` |
| Server bootstrap | `server/index.ts`, `server/static.ts`, `server/vite.ts` |
| Build/deploy | `script/build.ts`, `Dockerfile`, `docker-compose.yml`, `vercel.json`, `api/index.ts` |
