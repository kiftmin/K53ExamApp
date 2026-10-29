# K53ExamApp — Remediation Prompt for a Working Agent

You are an agent asked to fix a set of known, pre-audited issues in the K53 learner's licence app. This prompt is self-contained: the findings below were verified against the live database and code on 2026-10-27. Work through the phases **in order** — Phase 1 must land before anything triggers `npm run build` (reason in Phase 1).

## Repo and environment

- Repository: `https://github.com/kiftmin/k53examapp` (local working copy expected at `C:\projects\K53ExamApp`; work from a clone if you don't have it).
- Stack: Express 5 + Drizzle ORM (neon-http driver, **no transactions**) on Neon Postgres; React 18 + Vite + wouter + TanStack Query + shadcn/ui client served by the same Express app.
- Run the app: `npm run dev` (tsx, port **5000**, no watch — restart after server file edits). API base is same-origin `/api`.
- `.env` is **not** in git; it must contain `DATABASE_URL` (Neon) and `ACCESS_CODE_SECRET`, plus SMTP vars. Never print or commit credential values. For DB inspection, use small Node scripts with `@neondatabase/serverless` (already a dependency) — example pattern:

```js
require('C:/projects/K53ExamApp/node_modules/dotenv').config({ path: 'C:/projects/K53ExamApp/.env' });
const { neon } = require('C:/projects/K53ExamApp/node_modules/@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
const rows = await sql.query('select ...', [params]);
```

## Ground rules

1. **Never run `npm run build` until Phase 1 is complete.** `npm run build` currently runs `db:push` = `printf "n\n" | drizzle-kit push --force`, and `server/db.ts` is missing several live, populated columns — the push would DROP them (details in Phase 1).
2. Do not commit or push unless the owner explicitly asks. Do not delete or move untracked files you did not create.
3. Release gate for UI work: `npx --no-install vite build` succeeds, and the feature is verified in a real browser against the dev server on port 5000.
4. `npx --no-install tsc --noEmit` currently reports ~12–13 pre-existing errors (migration/type drift, e.g. `InsertQuestion.is_reviewed`). That is the baseline — your changes must not add errors; Phase 3 will fix the baseline.
5. Test learner for QA: use the shared QA master code and its linked mobile (kept out of the repo; ask the owner). It is a **shared account** — verify read paths freely, but never leave test data behind; if you create throwaway users/codes, delete them afterwards and confirm zero leftover rows.
6. Learner-facing wording is restricted: only "Learned" / "Not learned" / "I know this" (never "Again", "Hard", "Good", "Easy", "shaky", "mastered", "revision", "Favourites"). Learned items use a green accent bar + solid badge, never strikethrough. Every drill-in screen needs a visible way back. No horizontal overflow on mobile widths.
7. DB credential values must never appear in code, logs, or your replies.

## Verified findings (the "why" for each fix)

### A. Data
- **License-code split (the "6 categories" bug).** `questions.license_code` holds `00/01/02/03` for 567 rows but `1/2/3` for **80 controls questions** (category 3). Root cause: the controls import in `server/storage.ts:1366` maps `vehicle_type` to `'1'/'2'/'3'` while every other code path (admin modal `client/src/components/question-modal.tsx:405`, quiz filters) uses `'00'..'03'`.
  Consequences (all verified):
  - New Test license dropdown derives options from live data (`client/src/pages/new-test.tsx:36-40`), so learners see **six** options: `01, 02, 03, 1, 2, 3`.
  - Quiz pool filter is an exact string match (`client/src/lib/quiz-context.tsx:138-139`), so the 80 short-code questions only ever appear for a learner who picks `1`, `2` or `3` — and a learner picking `2` misses the 18 `02` questions and vice versa.
  - The license badge is hidden for short codes (`getLicenseLabel` in `client/src/pages/quiz.tsx:55-62` and `review.tsx:20-27` only know `01/02/03`).
  - Admin Question Bank "ALL CODES" filter shows 7 values.
  - Exactly **3** question texts overlap between the two styles (case-insensitive), so a blind UPDATE would create 3 duplicate rows — the dedupe step in Phase 2 handles this. The historical insert dedupe key is `question_text#license_code#category` (`server/storage.ts:1359`).
- **24 questions have `contains_image = true` but an empty `image_link`** (mostly category 2 signs questions, ids 1446–1517 range, plus category 3). They render as text-only questions that read "This sign indicates ..." with no sign.
- **299 question images are external hotlinks**: 214 `res.cloudinary.com`, 85 `upload.wikimedia.org`. Fragile (hotlink policies, deletion). Only 1 question uses the local `/assets/` store.
- Minor: `study_signs` has one row missing each of `where_text_raw`/`purpose_text_raw`/`action_text_raw`; two signs named "Reduced visibility"; `01` controls rows contain 3 same-text variants (11 distinct of 14).
- `learner_progress` (326 rows) and all link tables verified **orphan-free** today.

### B. Database / backend design
- **Schema is defined in three places that disagree**: `server/db.ts` (Drizzle), hand-written boot DDL in `server/index.ts` (~lines 64–207, `CREATE TABLE IF NOT EXISTS` + `ADD COLUMN IF NOT EXISTS` only), and `drizzle-kit push --force` from `npm run build`. There is no `drizzle/` migrations folder and no migration history.
- `server/db.ts` is **missing live populated columns**: `questions.source` (text), `questions.is_reviewed` (boolean), `study_signs.where_text_raw/purpose_text_raw/action_text_raw`, `study_rules.body_raw`. `drizzle-kit push` treats unmodeled columns as droppable → data-loss landmine wired into the build script.
- `learner_progress.item_id` is polymorphic (`sign|rule|control|question`) with no FK — integrity is only by convention.
- `upsertLearnerProgress` is read-then-write (non-atomic) on a driver without transactions.
- `server/storage.ts` is a ~1400-line god object with 30+ `as unknown as` casts; typecheck baseline errors come from this drift (e.g. `InsertQuestion` missing `is_reviewed`).
- `api/index.ts` + `vercel.json` are a dead alternate deployment entry that re-registers all routes **and an unauthenticated `/api/seed`** (see security).

### C. Security (from a dedicated review; verified file:line)
- **CRITICAL — unauthenticated `/api/seed`**: `api/index.ts:37-74` inserts the full question bank into the DB with no auth; `/api/seed/signs` runs DDL. `vercel.json` routes all `/api/*` to it. Safe only because the primary deploy is the VPS — remove it.
- **HIGH — no rate limiting anywhere** on `POST /api/access-code/validate` (`server/routes.ts:381`) or `/api/access-codes/validate-admin` (`routes.ts:758`). Code space is 36^6 ≈ 2.2×10⁹ per prefix; master keys never expire (`server/access-code.ts:102`), so a guessed X key with admin access is a permanent admin credential. No `express-rate-limit`, no lockout.
- **HIGH — enumeration oracle**: `server/admin-auth.ts:28-34` + `routes.ts:769` return distinct messages per failure cause and echo `mobileMatch`, letting an attacker confirm a key's validity and key↔mobile linkage without full credentials.
- **MEDIUM — permanent admin credential in `sessionStorage`** (`client/src/components/admin-gate.tsx:68-69`, attached to every request in `client/src/lib/queryClient.ts:14-17`): one XSS = permanent admin. (Full token exchange is a larger project — at minimum add the quick wins below.)
- **MEDIUM — full API response bodies logged**, including freshly generated access codes (`server/index.ts:49-57` logs `JSON.stringify(response)`; codes returned at `routes.ts:590`, `routes.ts:666`). Worse: `server.log`, `server_err.log`, `server_out.log` are **git-tracked**.
- **MEDIUM — SVG uploads allowed** (`server/sign-images.ts:9`) written into the same-origin static dir; navigating to one executes script same-origin and can read `k53_admin_key` from sessionStorage.
- **MEDIUM — HTTP-only nginx** (`nginx-k53exam.conf:3-5`, "Certbot will add TLS"): credentials cross the wire in cleartext if deployed as-is.
- LOW: public `/api/admin/contact` + `/api/admin/request-key` (unlimited mail relay, `routes.ts:778-813`); raw `err` objects echoed to clients (~20 places); unbounded zod string/array inputs (`shared/schema.ts:15-28`, no `.max()`); admin can revoke/delete their own master key via `/api/access-codes/:id/revoke|DELETE` (`routes.ts:597,610`) — self-guards exist only on the Users routes.
- Clean areas (do not "fix"): all SQL is parameterized; no `dangerouslySetInnerHTML` on user data; IDOR blocked by `validateCodeAndMobile` (`server/access-code.ts:179-181`); suspension checked on every learner route; CORS is default-deny (no middleware — adding `cors({origin:'*'})` would be a regression); `.env` gitignored, no secrets in tracked files.

---

## Work plan

### Phase 0 — Safety net (do first)

1. Create a recovery point in the **Neon console** (branch or snapshot) before any data-changing step. Note its name in your final report.
2. Export the tables you will touch to local JSON as a second safety copy, e.g. a script that dumps `questions`, `learner_progress` to `documents/backup-2026-10-*.json` (untracked area is fine — you created the files).
3. Read `package.json` and confirm: **do not run `npm run build`** until Phase 1 is merged.

### Phase 1 — Defuse the build and the dead entry point (no data changes)

1. Remove `db:push` from the `build` script in `package.json` (build becomes just the bundler step: `tsx script/build.ts`). Schema changes now happen only via explicit, reviewed commands. Also change `db:push` itself to drop `--force` and the piped `"n"` so it can never silently delete columns (it may simply fail loudly until Phase 3 gives it a correct schema — that is intended).
2. Delete `api/index.ts` and `vercel.json` (dead Vercel entry with the unauthenticated `/api/seed`). Verify nothing references them: `grep -rn "vercel\|api/index" --include="*.ts" --include="*.json" .` excluding `node_modules`.
3. Untrack the log files without deleting the owner's local copies: `git rm --cached server.log server_err.log server_out.log` and add `*.log` to `.gitignore`. (Committing is only on explicit request — stage nothing further.)
4. Stop logging response bodies: in `server/index.ts:49-57`, log method, path, status and duration only; drop the JSON body capture entirely.
5. Verify: restart `npm run dev`; exercise a login + a question fetch; confirm the log line no longer contains response bodies; `npx --no-install vite build` now runs without touching the DB (confirm from the output that no drizzle step ran).

### Phase 2 — Data normalization (the "6 categories" fix)

Order matters: fix the writer first, then the data, then the readers.

1. **Fix the writer** — `server/storage.ts:1366`: map `motorcycle → '01'`, `lmv → '02'`, `hmv → '03'` (default `'02'`). While there, `applicable_codes` at line 1344 uses `[1]/[2,3]/[3]` — leave the numbers (they are diagram metadata, not the license_code strings) but add a one-line comment clarifying they are numeric codes, not the text format.
2. **Preview the collision set** before updating:

```sql
select a.id short_id, b.id long_id, a.license_code short_code, a.question_text
from questions a join questions b
  on b.category = a.category and a.question_text = b.question_text
where a.license_code in ('1','2','3') and b.license_code = '0' || a.license_code;
```
   Expected: 3 rows.
3. **Merge**: for the colliding short-code rows, keep the long-code row and delete the short-code row **only after** migrating its links:
   - copy `sign_questions`/`rule_questions`/`control_questions` rows pointing at the short id to the surviving id (skip if the link already exists), then delete the originals;
   - migrate any `learner_progress` rows with `item_type='question'` and `item_id = short id` to the surviving id (skip if that `(mobile_number,item_type,item_id)` already exists, else delete the duplicate);
   - then delete the short-code question row.
4. **Normalize the rest**: `update questions set license_code = '0' || license_code where license_code in ('1','2','3');` (should affect 77 rows after step 3).
5. **Fix stale saved learner choices**: `client/src/pages/new-test.tsx:79` reads `localStorage.k53_license_code`, and existing learners may have `1/2/3` saved. Normalize at read time (map `1→01, 2→02, 3→03`, default `'02'`) and re-write the normalized value. `client/src/pages/study-signs.tsx:290` reads the same key — apply the same normalization there (a tiny shared helper in `client/src/lib` is fine).
6. **Hardcode the dropdown**: replace the data-derived `availableLicenseCodes` (`new-test.tsx:36-40`) with the fixed list `['01','02','03']` labelled "Code 01/02/03".
7. **Admin filter**: `client/src/components/admin/question-bank-section.tsx` license filter should offer `00/01/02/03` from the same constant (add it to `shared/schema.ts` next to `CATEGORY_NAMES`, e.g. `LICENSE_CODES`).
8. **contains_image audit (data)**: run
```sql
select id, question_number, category, question_text from questions
where contains_image and (image_link is null or trim(image_link) = '');
```
   For each of the 24 rows decide by category: category 3 rows legitimately use `ControlQuestionDiagram` instead of `image_link` — set `contains_image = false` for those only if the quiz actually renders the diagram regardless (check `client/src/pages/quiz.tsx:241-252`); category 2 rows are genuinely broken sign questions — either attach the right image via the admin "Pick from signs" flow or set `contains_image = false` and flag them in your report for the owner to review. Do not guess sign images.
9. **Verify (browser, port 5000)**: New Test shows exactly 3 license options; start a Controls test as the QA test learner and confirm questions from both old styles appear; quiz badge shows "Code 01/02/03" on category-3 specific questions; Admin Question Bank filter shows 4 code values; `select distinct license_code from questions` returns `00,01,02,03`; counts: `01=57 (36+21), 02=78 (48+30), 03=71 (42+29)` within rounding of the merge.
10. Clean up any throwaway data you created.

### Phase 3 — Schema parity and migration hygiene

1. Add the missing columns to `server/db.ts`: `questions.source` (text, nullable), `questions.is_reviewed` (boolean default false), `study_signs.where_text_raw/purpose_text_raw/action_text_raw` (text, nullable), `study_rules.body_raw` (text, nullable). Cross-check every table against the live catalog with an information_schema query — model **everything** that exists, including `study_controls.position_x/position_y` (already modeled? verify) — until `drizzle-kit push` (without `--force`, run manually with `--dry-run` first) reports **no changes**.
2. Remove the duplicate boot DDL from `server/index.ts` once parity is proven (it only ever created tables/columns that now match `db.ts`; keep a minimal "fail fast if a table is missing" health check if you want, but no DDL).
3. Adopt real migrations: `npx drizzle-kit generate` from the corrected `db.ts` into `drizzle/`, and apply with `drizzle-kit migrate` (or documented `push` without force) as an explicit, reviewed step — never inside `npm run build`.
4. Fix the typecheck baseline: after `db.ts` gains `is_reviewed`/`source`, the `InsertQuestion`/`Question` type errors (`client/src/components/question-modal.tsx:46`, `client/src/pages/new-test.tsx:117`, `server/storage.ts:1387`, `server/access-code.ts:163-183`, `server/storage.ts:1040/1328`) should collapse. Target: `npx --no-install tsc --noEmit` exits **0** or with a documented, owner-approved remainder.
5. Optional but recommended (only if time allows, and do not refactor beyond this): split `storage.ts` admin-user/progress/sign/rule/control concerns into modules re-exported from one index so imports don't change. No behavior changes.
6. Verify: `npx --no-install vite build`; restart dev; run the app through one learner session and one admin session; confirm no DDL runs at boot; `drizzle-kit push --dry-run` shows zero diffs.

### Phase 4 — Security hardening

1. **Rate limiting**: add `express-rate-limit` (new dependency — tell the owner before installing). Two limiters on the public auth surface: `/api/access-code/validate` and `/api/access-codes/validate-admin` (e.g. 10 requests/15min per IP, with `trust proxy` configured since nginx fronts the app). Return HTTP 429 with a generic message.
2. **Kill the enumeration oracle**: in `server/admin-auth.ts` collapse all failure branches of `validateAdminAccess` to one message (`"Invalid admin credentials."`), keep the distinct messages only in server logs; drop `mobileMatch` from the `/api/access-codes/validate-admin` response (`routes.ts:758-780`) — check the admin-gate client doesn't rely on it first (`client/src/components/admin-gate.tsx`).
3. **Self-revoke guard**: in `/api/access-codes/:id/revoke` and `DELETE /api/access-codes/:id` (`routes.ts:597,610`), reject when the code's `mobile_number` equals the `x-admin-mobile` header (mirror the guards at `routes.ts:639-641`).
4. **SVG**: remove `.svg` from `ALLOWED_EXTS` in `server/sign-images.ts:9` (existing SVGs in `/assets/signs` keep serving; optionally re-encode later).
5. **Logging redaction**: covered in Phase 1 item 4 — confirm nothing else logs codes (`grep -rn "console.*code" server/`).
6. **Contact endpoints** (`routes.ts:778-813`): rate-limit `/api/admin/request-key` (shared limiter), cap body length (e.g. 500 chars), remove the SMTP config details from the `/api/admin/contact` response.
7. **Input caps**: add `.max()` bounds to the admin question/sign/rule zod schemas (`shared/schema.ts`) and `.int().positive()` to `learnerProgressUpsertSchema.item_id`; cap import arrays (e.g. `.max(500)`).
8. **Error responses**: replace `error: err` echoes with `details: err.issues` only for zod errors; everything else returns a generic message and logs server-side.
9. **TLS**: do not modify the server, but flag in your final report that `nginx-k53exam.conf` must get its certbot HTTPS block + redirect before public launch (owner action).
10. Verify by hand: hit `/api/access-codes/validate-admin` 11 times with a wrong key from curl → 11th returns 429 and an identical message to a "wrong mobile" attempt; try revoking your own master key → 400; upload an `.svg` via the sign image admin → rejected; regular learner flow unaffected.

### Phase 5 — Nice-to-haves (ask the owner first, in that order)

1. Migrate the 85 Wikimedia + review the 214 Cloudinary question images into `/assets/images` (or one owned Cloudinary account) so question images stop being hotlinks. Keep `imageSrc()` in `client/src/components/question-modal.tsx:64` behavior in mind (bare filename → `/assets/images/`).
2. Server-issued short-lived admin session token to replace the permanent master key in sessionStorage.
3. `upsertLearnerProgress` → single-statement `ON CONFLICT` upsert once the table has a proper unique key `(mobile_number, item_type, item_id)` (add via migration; also gives `learner_progress` real integrity).
4. The remaining data nits: duplicate "Reduced visibility" sign rows, the sign missing `*_text_raw` fields, the 3 same-text `01` controls variants — list them for the owner rather than auto-fixing.

## Definition of done

- `select distinct license_code from questions` → `00,01,02,03`; New Test offers exactly 3 license codes.
- No unauthenticated `/api/seed`; no `vercel.json`/`api/index.ts`.
- `npm run build` performs no DB schema operations; `drizzle-kit push --dry-run` reports no diffs; boot performs no DDL.
- `npx --no-install tsc --noEmit` at or below the documented remainder; `npx --no-install vite build` green.
- Rate limiting + generic admin-auth errors + self-revoke guard + SVG ban verified by curl/browser.
- Log files untracked; no response bodies in logs.
- No test residue in the DB; every change verified in the browser on port 5000.
- Final report to the owner: what changed, the Neon recovery point name, remaining owner actions (TLS, image migration, master-token project), and anything you deliberately left alone.
