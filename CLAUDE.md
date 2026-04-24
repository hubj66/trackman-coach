# TrackMan Coach — Claude Code Master Context

This file is the working context and guardrail document for Claude Code on the `hubj66/trackman-coach` repository.

Use this file as the project source of truth unless the user explicitly overrides it.

---

## 1. Project Mission

`trackman-coach` is a GitHub Pages golf improvement app for high-handicap players.

The app should help a player answer:

1. What should I train today?
2. What is my biggest current issue?
3. What evidence supports that issue?
4. What drill or practice plan should I do next?
5. Am I improving?

The app sits between:

- launch-monitor tools such as TrackMan, which explain impact and ball-flight data
- round/practice trackers, which show where scores are being lost

The product goal is not to be a perfect pro-level analytics platform. It should give practical, simple, evidence-based coaching guidance for high-handicap players.

---

## 2. Tech Stack and Repo Shape

### Platform

- Hosting: GitHub Pages
- Frontend: static HTML, CSS, and vanilla JavaScript
- Backend/data: Supabase Auth + Supabase PostgreSQL
- Deployment: commit to GitHub, then GitHub Pages serves the static app
- Supabase access: assume Claude does **not** have direct Supabase access
- Database changes: prepare SQL in `migration.sql`; user runs it manually in Supabase

### Important files

| File | Main responsibility |
|---|---|
| `index.html` | Main page structure, bottom nav HTML, page sections, forms |
| `style.css` | Layout, mobile UI, cards, nav, accordions |
| `app.js` | Main router, page switching, Coach logic, saved states |
| `auth.js` | Supabase client usage, auth state, chipping/putting CRUD, clubs overview, aliases UI |
| `today.js` | Today page, issue detection, training recommendation rendering |
| `engine.js` | Diagnostic rules engine used by Today |
| `analysis.js` | TrackMan/analysis tab, shot tables/maps, club filtering, load into Coach |
| `viz.js` | Visual helpers |
| `shotshape.js` | Shot-shape drawing |
| `clubAliases.js` | Raw TrackMan club name to app club key resolution |
| `clubs.js` | Club KPI definitions and club data logic |
| `distances.js` | Carry/distance calculations |
| `migration.sql` | Supabase schema, RLS, indexes, migration SQL |
| `supabase-config.js` | Public Supabase config only; never add service-role secrets |

---

## 3. Current Known App Structure From Audit

The audit found the current bottom navigation:

| Button ID | Visible label | Page ID | `showPage()` key |
|---|---|---|---|
| `nav-today-btn` | Today | `page-today` | `today` |
| `nav-coach-btn` | Coach | `page-coach` | `coach` |
| `nav-stats-btn` | Practice | `page-stats` | `stats` |
| `nav-clubs-btn` | Clubs | `page-clubs` | `clubs` |
| `nav-analysis-btn` | Trackman | `page-analysis` | `analysis` |

There is currently no More menu.

Known hardcoded navigation risks:

- `ALL_PAGES` in `app.js`
- `showPage()` special cases in `app.js`
- `localStorage` key `tc_last_tab`
- `openClubInAnalysis()` in `auth.js`, which calls `showPage('analysis')`
- `initTodayTab()`, `initAnalysisTab()`, and stats/loading functions wired to specific page keys

Do not rename internal page keys unless the phase explicitly asks for it.

---

## 4. Target App Information Architecture

### Bottom navigation

Use exactly five bottom tabs:

```text
Today | Coach | TrackMan | Bag | Logbook
```

### More menu

More is a top-right button/menu, not a sixth bottom tab.

More should contain:

```text
Progress
Players
Club aliases
Import settings
Profile
App settings
```

### Decisions already made

- Use five bottom tabs plus a More menu.
- Do not build real Players/sharing yet.
- Friends can log in and have private data via `user_id`.
- Logbook is a main bottom tab.
- TrackMan should stay technical.
- Bag shows only active clubs by default.
- Bag has a small `Show inactive clubs` toggle.
- Club aliases support both global aliases and user-specific aliases.

---

## 5. Product Rules by Area

### Today

Today is the action page. It should answer:

1. What should I care about now?
2. What is my main issue?
3. Why?
4. What should I train next?
5. Am I improving, or what should I watch?

Keep Today simple. Do not turn it into a large dashboard.

Preferred Today layout:

1. Focus selector
2. Main issue card
3. Evidence card
4. Next training card
5. Recent growth / watch item card
6. Quick log or open-related-page action

Focus selector chips:

```text
Overall | Driver | Irons | 7i | Wedges | Chipping | Putting
```

Training plans should be practical and short. For TrackMan/range focus, show a 30–45 minute plan:

- warm-up
- technical block
- random or pressure block
- result log

For chipping/putting, show:

- drill
- attempts
- target
- what to log

### Coach

Coach is the deeper explanation and training area.

Rules:

- Do not rewrite working Coach logic unless needed.
- Preserve current club selection and diagnostic behavior where possible.
- Coach may explain golf concepts simply, but it should not lose technical usefulness.
- Use high-handicap-friendly language.
- Avoid tour/pro benchmarks unless clearly marked as reference only.

### TrackMan

TrackMan is the technical analysis area.

Rules:

- Keep TrackMan technical.
- Preserve shot tables, maps, filters, and load-into-Coach behavior.
- Important KPIs include face angle, club path, face-to-path, launch direction, attack angle, dynamic loft, spin loft, smash factor, carry, side, total, and dispersion.
- Do not simplify away impact/ball-flight explanations.

### Bag

Bag replaces the user-facing Clubs page.

Rules:

- Show only active clubs by default.
- Add `Show inactive clubs` toggle.
- Do not show Club aliases inside Bag after aliases are moved to More.
- Keep existing club data safe.
- If data is missing, show a useful empty state instead of a broken card.

Collapsed club card should show, where available:

- club name / club key
- stock carry or average carry
- main miss
- confidence

Expanded club details can show:

- distance: average carry, stock/good-shot carry, carry range
- direction: average side, main miss, playable rate
- contact: smash factor, ball speed, strike quality
- swing cause: face angle, club path, face-to-path
- actions: open Coach, open TrackMan shots, log practice

### Logbook

Logbook replaces the user-facing Practice tab.

Purpose:

- Today tells the user what to train.
- Logbook stores what the user did.

Logbook should store non-TrackMan practice and course notes.

Top quick-add cards:

```text
Chipping | Putting | Range | Course note
```

Use existing:

- `chipping_sessions`
- `putting_sessions`

Use planned/new:

- `practice_sessions`

TrackMan sessions should stay in TrackMan, not Logbook.

### Progress

Progress lives under More, not in the bottom nav.

Progress answers:

```text
Am I getting better?
```

Use compact cards, not huge tables.

Good high-handicap metrics:

- playable shot rate
- carry consistency / carry spread
- main miss frequency
- left/right miss trend
- contact/smash consistency
- chipping inside 1m / 2m / outside 3m
- putting make rate by distance
- sessions per week

Use statuses where possible:

```text
Improved | Stable | Needs attention
```

### Players

Players is placeholder only for now.

Use this text:

```text
Each player can log in and has private data. Sharing and coach access will be added later.
```

Do not implement sharing yet.
Do not add `player_shares` yet.

---

## 6. Database Tables and Data Rules

### Currently used tables from audit

| Table | Purpose |
|---|---|
| `trackman_shots` | Full-swing TrackMan shot data |
| `trackman_sessions` | TrackMan session grouping, if present in schema/code |
| `chipping_sessions` | Chipping logs |
| `putting_sessions` | Putting logs |
| `saved_states` | Saved Coach slider/config states |
| `clubs` | User club definitions / active bag |
| `club_aliases` | Raw club name to app club key mapping |

### Planned/added tables

| Table | Purpose |
|---|---|
| `profiles` | User profile: display name, handicap, hand, main goal |
| `practice_sessions` | Range logs and course notes |

### Critical security rule

Multi-user data isolation is the highest priority.

Before friends use the app, all user data tables must have:

1. correct `user_id` storage on insert
2. explicit frontend filters on `SELECT`, `UPDATE`, and `DELETE`
3. Supabase RLS enabled
4. RLS policies that only allow users to access their own rows

Use defense in depth:

- frontend filters are required
- RLS policies are required

### User-owned tables

Users may only select/insert/update/delete their own rows for:

- `trackman_sessions`
- `trackman_shots`
- `chipping_sessions`
- `putting_sessions`
- `clubs`
- `saved_states`
- `profiles`
- `practice_sessions`

### Club aliases

`club_aliases` must support:

- global aliases: `user_id is null`
- personal aliases: `user_id = auth.uid()`

Rules:

1. Load global aliases and personal aliases.
2. Personal aliases override global aliases when the same raw name conflicts.
3. New aliases from the UI must be inserted with `user_id = current user id`.
4. Users can delete only personal aliases.
5. Global aliases are visible but not editable/deletable by normal users.
6. If no user is logged in, the UI must not crash.

Do not allow normal users to update or delete global aliases.

---

## 7. Security and Secret Hygiene

Never commit:

- `.env`
- service-role Supabase keys
- private JSON secrets
- local data dumps
- exported personal data
- temporary debug files with user data

The public Supabase anon key may exist in `supabase-config.js`, because this is a browser app, but never add service-role keys.

When showing config or environment values in output, mask secrets.

Never claim the database was changed unless the SQL was actually run by the user or a Supabase-access tool was available and used.

For this project, assume:

```text
Claude can edit GitHub files and commit.
Claude probably cannot run Supabase migrations directly.
```

So for database work:

1. update `migration.sql`
2. provide the exact SQL to run manually
3. explain what to test after the user runs it

---

## 8. Execution Guardrails

### General rules

- One phase = one focused change set = one commit.
- Keep changes small.
- Do not rewrite working Coach or TrackMan logic unless needed.
- Do not remove existing features unless explicitly asked.
- Do not change Supabase table names unless explicitly requested.
- Prefer preserving internal page keys if renaming them is risky.
- Do not do broad cleanup during feature work.
- Do not mix security, navigation, UI redesign, and data model changes in one commit.

### Size limits

Use these as soft limits:

- Bug fix: about 50 changed lines if possible.
- Feature phase: about 300 changed lines if possible.
- If a file becomes too large or hard to reason about, propose extraction first instead of silently rewriting it.

### Required before editing

For every non-trivial task:

1. inspect relevant files
2. summarize the plan briefly
3. identify likely files to change
4. identify risks
5. then edit

### Required after editing

Always provide:

1. changed files
2. important behavior changes
3. validation commands run and output summary
4. exact SQL to run manually, if database changes are involved
5. browser test checklist
6. risks or incomplete items
7. commit hash or commit message

---

## 9. Validation Rules

This is a static GitHub Pages app.

Current repo state:

- No `package.json`
- No npm build step
- No Node-based test runner
- No bundler
- Plain HTML, CSS, and JavaScript

Therefore Claude must not claim that automated build, lint, or test validation was completed unless such tooling is added later.

For every code change, Claude must run:

```bash
git status --short
git diff --check
```

Claude must manually inspect changed files for obvious issues.

For JavaScript changes, manually check:

- missing or extra braces, brackets, and parentheses
- broken function names
- undefined functions introduced by the change
- broken `showPage(...)` references
- page keys still matching `ALL_PAGES`
- event handlers still connected
- Supabase query chains still valid
- `user_id` filters still present where required
- no accidental changes to unrelated Coach or TrackMan logic

For HTML changes, manually check:

- matching opening and closing tags
- no duplicate IDs
- buttons still call valid functions
- page section IDs still match router logic

For CSS changes, manually check:

- no broken selectors for changed markup
- phone layout still readable
- bottom navigation remains usable

Do not run npm, node, or package-manager commands unless a valid `package.json` or Node environment is intentionally added later.

After every phase, Claude must report:

1. changed files
2. `git status --short` output
3. `git diff --check` output
4. what was manually inspected
5. exact browser tests the user must run

Never say “done” without showing what validation was run.

If a command cannot be run, say why and provide browser/manual tests instead.

---

## 10. Static App Guardrail

Do not introduce a build system, framework, bundler, TypeScript, or package manager unless explicitly requested.

Keep the app as a static GitHub Pages app:

- `index.html`
- plain `.js`
- plain `.css`
- Supabase client

Prefer small, direct changes over architectural rewrites.

---

## 11. Manual Browser Test Checklist

Use this after UI changes:

- Login works.
- Today opens.
- Coach opens.
- TrackMan opens.
- Bag opens.
- Logbook opens.
- More opens, once implemented.
- More → Club aliases opens, once implemented.
- More → Progress opens, once implemented.
- More → Profile opens or shows a migration message, once implemented.
- TrackMan analysis still loads.
- Coach still loads existing logic.
- Chipping logs still display.
- Putting logs still display.
- Clubs/Bag data still displays.
- Club aliases still resolve TrackMan club names.
- No page crashes if optional tables are missing.
- Phone layout is usable.
- Browser DevTools Console shows no red JavaScript errors.

For security phases, also test:

- logged-in user only sees own TrackMan shots
- logged-in user only sees own chipping logs
- logged-in user only sees own putting logs
- logged-in user only sees own clubs
- global aliases are readable
- personal aliases can be added
- personal aliases override global aliases
- global aliases cannot be deleted in the UI

---

## 12. Current Phase Plan

### Current status

- Phase 0 audit: completed.
- Phase 1 security and user isolation: completed by Claude, but must be browser-tested and SQL must be confirmed as applied in Supabase.
- Next planned phase: Phase 2 cosmetic navigation rename, unless security testing reveals issues.

Use this updated implementation order:

### Phase 1 — Security and user isolation first

Goal:

Fix multi-user data isolation before UI restructuring.

Tasks:

- Add or update RLS SQL in `migration.sql`.
- Enable RLS on relevant tables.
- Add policies for user-owned data.
- Add `user_id` to `club_aliases` as nullable.
- Support global and personal aliases.
- Add useful indexes.
- Add explicit `user_id` filters in frontend Supabase queries.
- Do not redesign UI.
- Do not rename navigation yet.

### Phase 2 — Cosmetic nav rename only

Goal:

Change visible labels only.

Visible labels:

```text
Practice → Logbook
Clubs → Bag
Trackman → TrackMan
```

Rules:

- Do not rename internal page keys yet.
- Keep `stats`, `clubs`, and `analysis` internally if safer.
- Do not add More menu yet.

### Phase 3 — Add More menu

Goal:

Add a top-right More button/menu without moving big features yet.

More cards:

- Progress
- Players
- Club aliases
- Import settings
- Profile
- App settings

Keep pages simple/placeholders unless the phase asks for full behavior.

### Phase 4 — Move Club aliases to More

Goal:

Move the alias manager out of Bag and into More → Club aliases.

Rules:

- Reuse existing alias manager where possible.
- Do not duplicate alias logic.
- Bag should no longer show aliases.
- Add back button to More.

### Phase 5 — Bag cleanup and active/inactive toggle

Goal:

Make Bag compact and phone-friendly.

Tasks:

- Show active clubs by default.
- Add `Show inactive clubs` toggle.
- Use compact accordion cards.
- Keep club data safe.

Known schema note:

`clubs.is_active boolean NOT NULL DEFAULT true` exists, according to the user.

### Phase 6 — Logbook cleanup

Goal:

Make Logbook the clear place for chipping, putting, range practice, and course notes.

Tasks:

- Keep existing `chipping_sessions` and `putting_sessions` working.
- Add `practice_sessions` support if migration has been run.
- Show friendly migration message if `practice_sessions` is missing.
- Keep TrackMan sessions in TrackMan.

### Phase 7 — Today focus selector

Goal:

Make Today simple, useful, and flexible.

Tasks:

- Add focus chips: Overall, Driver, Irons, 7i, Wedges, Chipping, Putting.
- Use relevant data for each focus.
- Show main issue, evidence, next training, growth/watch item, and quick action.
- Keep page fast on phone.

### Phase 8 — Progress under More

Goal:

Add More → Progress.

Tasks:

- Last 30 days summary.
- TrackMan progress.
- Bag/club progress.
- Chipping progress.
- Putting progress.
- Manual practice consistency.
- Compact cards, not big tables.

### Phase 9 — Profile, Import settings, App settings placeholders

Goal:

Make More feel complete without overbuilding.

Tasks:

- Profile page uses `profiles` table if migration exists.
- Import settings page is simple and links to Club aliases.
- App settings page includes version/info and data privacy note.
- Players remains placeholder only.

### Phase 10 — Final cleanup and consistency

Goal:

Clean visible labels, empty states, phone usability, and obvious JS errors.

Search for old user-facing labels:

- Practice
- Clubs
- Stats
- Analysis
- Trackman

Update visible labels carefully:

- Practice → Logbook
- Clubs → Bag
- Analysis → TrackMan where user-facing
- Trackman → TrackMan

Do not blindly rename internal functions.

---

## 13. Phase Prompt Templates

### Phase 1 prompt: Security and user isolation first

Use this when starting the next Claude Code session:

```text
Continue from CLAUDE.md and the previous audit.

Goal of this phase:
Fix multi-user data isolation before any UI restructuring.

Important:
- Do not redesign the UI in this phase.
- Do not rename internal page keys.
- Do not move tabs yet.
- You have GitHub access and can commit code.
- You probably do not have Supabase access, so prepare SQL in migration.sql and tell me exactly what I need to run manually.
- Keep the app working for a single user.
- Make one safe commit at the end.

Critical audit finding:
Many SELECT / UPDATE / DELETE queries do not filter by user_id:
- trackman_shots SELECT
- chipping_sessions SELECT / UPDATE / DELETE
- putting_sessions SELECT / UPDATE / DELETE
- clubs SELECT
- club_aliases has no user_id yet

This is a blocker before friends use the app.

Phase 1 tasks:

A) Update Supabase SQL in migration.sql

Add or update safe SQL for RLS and multi-user isolation.

Required:
1. Enable RLS on:
- trackman_sessions
- trackman_shots
- chipping_sessions
- putting_sessions
- clubs
- saved_states
- club_aliases

2. Add policies so users can only select/insert/update/delete their own rows for:
- trackman_sessions using user_id
- trackman_shots using user_id
- chipping_sessions using user_id
- putting_sessions using user_id
- clubs using user_id
- saved_states using user_id

3. For club_aliases:
Current table has no user_id. Add:
- user_id uuid null references auth.users(id) on delete cascade

Alias rules:
- user_id is null = global alias
- user_id = auth.uid() = personal alias

Policies for club_aliases:
- Users can SELECT global aliases where user_id is null
- Users can SELECT their own aliases
- Users can INSERT only aliases with user_id = auth.uid()
- Users can UPDATE only aliases with user_id = auth.uid()
- Users can DELETE only aliases with user_id = auth.uid()
- Normal users must not update or delete global aliases

4. Add useful indexes:
- trackman_sessions(user_id, session_date)
- trackman_shots(user_id, club)
- trackman_shots(user_id, session_id)
- chipping_sessions(user_id, session_date)
- putting_sessions(user_id, session_date)
- clubs(user_id, is_active)
- club_aliases(user_id)
- club_aliases(lower(trim(raw_name))) if possible

5. Do not add player_shares yet.
Players/sharing comes later.

B) Update frontend code

Add explicit user_id filters even if RLS exists.

Required:
1. trackman_shots SELECT must filter by user_id = current user id.
2. trackman_sessions SELECT must filter by user_id = current user id.
3. chipping_sessions SELECT / UPDATE / DELETE must filter by user_id = current user id.
4. putting_sessions SELECT / UPDATE / DELETE must filter by user_id = current user id.
5. clubs SELECT must filter by user_id = current user id.
6. saved_states SELECT / UPDATE / DELETE must filter by user_id = current user id where used.
7. INSERTs must include user_id = current user id where required.

C) Update club alias logic

club_aliases should support:
- global aliases where user_id is null
- personal aliases where user_id = current user id

Rules:
1. Load both global and personal aliases.
2. Personal aliases override global aliases if raw_name conflicts.
3. Insert new aliases with user_id = current user id.
4. Delete only personal aliases.
5. Global aliases should be visible but not deletable by normal users.
6. If no user is logged in, do not crash. Show a login message or disable editing.

D) Keep behavior stable

Do not change the visible tab structure yet.
Do not rename Practice/Clubs/Trackman yet.
Do not move Club aliases yet.
Do not build More menu yet.

Acceptance test:
- Logged-in user only sees their own TrackMan shots.
- Logged-in user only sees their own chipping logs.
- Logged-in user only sees their own putting logs.
- Logged-in user only sees their own clubs.
- User can still use global aliases.
- User can add a personal alias.
- Personal alias overrides global alias.
- User cannot delete global aliases from the UI.
- App does not crash if club_aliases.user_id migration has not been run yet, but shows a useful message if needed.

At the end:
1. Commit changes.
2. Tell me changed files.
3. Provide the exact SQL I must run manually in Supabase.
4. Tell me exactly what to test in the browser.
5. Tell me any risks or incomplete parts.
```

### Phase 2 prompt: Cosmetic nav rename only

```text
Continue from CLAUDE.md and the previous phase.

Goal:
Do a safe cosmetic navigation rename only.

Important:
- Do not rename internal page keys yet.
- Keep page IDs as they are if safer:
  - stats can stay stats internally
  - clubs can stay clubs internally
  - analysis can stay analysis internally
- Only change user-facing labels.
- Do not add More menu yet.
- Make one safe commit at the end.

Current bottom nav:
Today | Coach | Practice | Clubs | Trackman

Change visible labels to:
Today | Coach | Logbook | Bag | TrackMan

Specific changes:
1. Practice → Logbook
2. Clubs → Bag
3. Trackman → TrackMan

Do not move pages yet.
Do not move Club aliases yet.
Do not move TrackMan summary yet.
Do not change showPage keys unless absolutely necessary.

Acceptance test:
- Today opens
- Coach opens
- Logbook opens and is the old Practice page
- Bag opens and is the old Clubs page
- TrackMan opens and is the old Analysis page
- Last selected tab localStorage still works or has a safe fallback

At the end:
1. Commit changes.
2. Summarize changed files.
3. Tell me what to test.
```

### Phase 3 prompt: Add More menu

```text
Continue from CLAUDE.md and the previous phase.

Goal:
Add a top-right More button/menu without moving major features yet.

Important:
- Do not remove or move existing bottom tabs yet.
- Do not move Club aliases yet.
- Do not move TrackMan summary yet.
- Do not rename internal page keys unless absolutely necessary.
- Keep the change small and safe.
- Make one safe commit at the end.

Target:
Bottom nav remains:
Today | Coach | TrackMan | Bag | Logbook

Add a top-right More button/menu.

More menu should show simple cards or entries:
- Progress
- Players
- Club aliases
- Import settings
- Profile
- App settings

For this phase:
1. More opens and closes.
2. More entries can be placeholders.
3. Players entry must show placeholder text only:
   "Each player can log in and has private data. Sharing and coach access will be added later."
4. Do not implement sharing.
5. Do not add player_shares.
6. Do not move existing alias manager yet.
7. Do not move Progress/TrackMan summary yet.

Acceptance test:
- Today opens.
- Coach opens.
- TrackMan opens.
- Bag opens.
- Logbook opens.
- More button opens.
- More button/menu closes.
- More entries are visible.
- Players placeholder is clear.
- Phone layout remains usable.

At the end:
1. Commit changes.
2. Summarize changed files.
3. Tell me what to test.
```

### Phase 4 prompt: Move Club aliases to More

```text
Continue from CLAUDE.md and the previous phase.

Goal:
Move Club aliases out of Bag and into More → Club aliases.

Important:
- Do not redesign Bag yet except removing aliases from it.
- Do not duplicate alias logic.
- Reuse the existing alias manager where possible.
- Make one safe commit at the end.

Tasks:
1. More menu should have a working Club aliases entry.
2. Clicking More → Club aliases should open the existing alias manager.
3. Club aliases should no longer be shown inside Bag.
4. Add a simple back button from the Club aliases view back to More.
5. Keep placeholder cards for:
   - Progress
   - Players
   - Import settings
   - Profile
   - App settings
6. Players should remain placeholder only:
   "Each player can log in and has private data. Sharing and coach access will be added later."
7. Do not implement player sharing.
8. Do not add player_shares table.

Acceptance test:
- More opens.
- More → Club aliases opens alias manager.
- Adding an alias works.
- Deleting a personal alias works.
- Global aliases are visible but not deletable.
- Bag no longer shows the alias manager.
- Existing TrackMan and Coach still work.

At the end:
1. Commit changes.
2. Summarize changed files.
3. Tell me what to test.
4. List any cleanup needed later.
```

### Phase 5 prompt: Bag cleanup and active/inactive toggle

```text
Continue from CLAUDE.md and the previous phase.

Goal:
Make Bag compact, phone-friendly, and useful without taking too much space.

Important:
- Bag replaces the old user-facing Clubs page.
- Show only active clubs by default.
- Add a small "Show inactive clubs" toggle.
- Do not show Club aliases here anymore.
- Do not break existing clubs data.
- Make one safe commit at the end.

Bag main view:
1. Show compact cards for clubs.
2. Only active clubs are shown by default.
3. Add toggle:
   "Show inactive clubs"
4. When toggle is on, inactive clubs appear but should look visually less important.
5. Each collapsed card should show:
   - club name / club key
   - stock carry or average carry if available
   - main miss if available
   - confidence if available
6. Use accordion behavior:
   - tapping a club expands details
   - other cards can stay collapsed

Expanded club details:
Show sections if data exists:
1. Distance
   - average carry
   - stock carry or good-shot carry if available
   - carry range
2. Direction
   - average side
   - main miss
   - playable rate if available
3. Contact
   - smash factor
   - ball speed
   - strike quality if available
4. Swing cause
   - face angle
   - club path
   - face-to-path
5. Actions:
   - Open Coach for this club
   - Open TrackMan shots for this club
   - Log practice for this club

Data logic:
- Use existing trackman_shots where possible.
- Use existing clubs table.
- Use club_key mapping/aliases where needed.
- Do not overbuild. A first useful version is enough.
- If there is not enough data for a club, show:
  "Not enough data yet. Add TrackMan shots or log practice."

Acceptance test:
- Bag opens on phone layout.
- Only active clubs show by default.
- Show inactive clubs toggle works.
- Accordion opens and closes.
- Existing club data is not lost.
- Actions go somewhere useful or show a clear placeholder if not implemented yet.
- Club aliases are not shown in Bag.

At the end:
1. Commit changes.
2. Summarize changed files.
3. Tell me what to test.
```

### Phase 6 prompt: Logbook cleanup

```text
Continue from CLAUDE.md and the previous phase.

Goal:
Make Logbook the clear place to store non-TrackMan practice and course data.

Important:
- Today tells me what to train.
- Logbook stores what I did.
- Logbook is a main bottom tab.
- Keep existing chipping_sessions and putting_sessions working.
- Add support for practice_sessions if the migration has been run.
- If practice_sessions does not exist yet, show a friendly message and do not crash.
- Make one safe commit at the end.

Existing data:
- chipping_sessions
- putting_sessions

New data:
- practice_sessions

Logbook structure:
1. Top quick add cards:
   - Chipping
   - Putting
   - Range
   - Course note
2. Recent logs section
3. Chipping section
4. Putting section
5. Range/manual practice section
6. Course notes section

UX:
1. Phone-first.
2. Do not show huge forms by default.
3. Use accordion forms, compact cards, or modal-style sections.
4. Quick add should be easy on the course.
5. Recent logs should combine:
   - chipping_sessions
   - putting_sessions
   - practice_sessions
6. Recent logs should show newest first.
7. TrackMan sessions should stay in TrackMan, not Logbook.

Chipping:
- Keep existing chipping_sessions functionality.
- Existing add/edit/delete should continue to work.
- Show useful summary if already available.

Putting:
- Keep existing putting_sessions functionality.
- Existing add/edit/delete should continue to work.
- Show useful summary if already available.

Range:
Use practice_sessions:
- practice_type = 'range'
- session_date
- club_key
- focus_area
- balls
- good_shots
- main_miss
- best_cue
- confidence
- notes

Course note:
Use practice_sessions:
- practice_type = 'course'
- session_date
- title
- focus_area
- main_miss
- notes

Empty states:
- No chipping logs:
  "No chipping logs yet. Add your first chipping session."
- No putting logs:
  "No putting logs yet. Add your first putting session."
- practice_sessions missing:
  "Run the latest migration to enable range and course logs."

Acceptance test:
- I can add chipping.
- I can add putting.
- I can add range practice if migration exists.
- I can add course note if migration exists.
- Existing chipping/putting data still displays.
- Recent logs show latest manual entries.
- App does not crash if practice_sessions is missing.

At the end:
1. Commit changes.
2. Summarize changed files.
3. Tell me what to test.
4. Tell me whether migration.sql must be run before full testing.
```

### Phase 7 prompt: Today focus selector

```text
Continue from CLAUDE.md and the previous phase.

Goal:
Make Today simple, useful, and flexible.

Important:
- Today should not become a big dashboard.
- Today should tell me what to train now.
- I sometimes want to train another club, so Today needs a focus selector.
- Keep Coach and TrackMan as the deeper areas.
- Make one safe commit at the end.

Today should answer:
1. What should I care about now?
2. What is my main issue?
3. Why?
4. What should I train next?
5. Am I improving or what should I watch?

Add focus selector chips:
- Overall
- Driver
- Irons
- 7i
- Wedges
- Chipping
- Putting

Behavior:
1. Overall:
   - show the biggest current issue across available data
2. Driver:
   - use recent TrackMan driver shots if available
3. Irons:
   - use iron shots, especially 6i-9i
4. 7i:
   - use 7i shots if available
5. Wedges:
   - use wedge shots and/or chipping logs where useful
6. Chipping:
   - use chipping_sessions
7. Putting:
   - use putting_sessions

Today layout:
1. Focus selector
2. Main issue card
3. Evidence card
4. Next training card
5. Recent growth / watch item card
6. Quick log / open related page button

Training card requirements:
For TrackMan/range areas, show a simple 30–45 minute plan:
- Warm-up
- Technical block
- Random/pressure block
- Result log

For chipping/putting, show shorter practical plans:
- drill
- attempts
- target
- what to log

Quick action behavior:
- TrackMan focus: button opens TrackMan
- Club focus: button can open TrackMan or Logbook with club preselected if easy
- Chipping/putting: button opens Logbook quick add
- If preselecting is too risky, simply navigate to the right page and keep it stable

Empty states:
If there is not enough data:
- Say "Not enough data yet"
- Tell the user exactly what to log next
Example:
"Add at least 10 recent 7i TrackMan shots or log a 7i range session."

Important:
- Reuse today.js where possible.
- Do not delete good existing Today logic unless replacing it with simpler behavior.
- Keep page fast on phone.
- Do not show too many charts.

Acceptance test:
- Today opens fast.
- Overall shows a recommendation.
- Selecting 7i changes the issue/training to 7i.
- Selecting Putting uses putting data.
- Selecting Chipping uses chipping data.
- Quick action buttons go somewhere useful.
- Empty states are clear.

At the end:
1. Commit changes.
2. Summarize changed files.
3. Tell me what to test.
```

### Phase 8 prompt: Progress under More

```text
Continue from CLAUDE.md and the previous phase.

Goal:
Add a useful Progress page under More.

Important:
- Progress should not be a bottom tab.
- Progress should be More → Progress.
- It should answer: "Am I getting better?"
- Keep it phone-first.
- Make one safe commit at the end.

Use existing data:
- trackman_shots
- chipping_sessions
- putting_sessions
- practice_sessions if available

Progress page structure:
1. Last 30 days summary
2. TrackMan progress
3. Bag/club progress
4. Chipping progress
5. Putting progress
6. Manual practice consistency

Good high-handicap metrics:

TrackMan:
- playable shot rate
- carry consistency / carry spread
- main miss frequency
- left/right miss trend
- contact/smash consistency where available

Club progress:
- per club stock carry
- carry range
- main miss trend
- confidence based on shot count

Chipping:
- inside 1m
- inside 2m
- outside 3m
- trend over time

Putting:
- make rate by distance
- 1m make rate
- 2m make rate if available
- trend over time

Manual practice:
- sessions per week
- most trained focus area
- best cue history if available

UX requirements:
1. Use compact cards.
2. Avoid huge tables.
3. Show "Improved", "Stable", or "Needs attention" where possible.
4. Avoid comparing users/friends.
5. If not enough data, show what to log next.
6. Do not overbuild charts. Simple cards are enough.

More integration:
- More → Progress opens this page.
- Add back button to More overview.

Acceptance test:
- More → Progress opens.
- Progress does not crash if some tables are empty.
- TrackMan progress appears if data exists.
- Chipping progress appears if data exists.
- Putting progress appears if data exists.
- practice_sessions missing does not crash the app.
- Page is readable on phone.

At the end:
1. Commit changes.
2. Summarize changed files.
3. Tell me what to test.
```

### Phase 9 prompt: Profile, Import settings, App settings placeholders

```text
Continue from CLAUDE.md and the previous phase.

Goal:
Make More feel complete without building too much.

Important:
- Players stays later/placeholder.
- Do not implement sharing yet.
- Do not add player_shares yet.
- Make one safe commit at the end.

More should include working or placeholder pages for:
1. Progress — already built
2. Players — placeholder only
3. Club aliases — already built
4. Import settings
5. Profile
6. App settings

Profile page:
Use profiles table if migration exists.

Fields:
- display_name
- handicap
- dominant_hand
- main_goal

Requirements:
- If profiles table does not exist, show:
  "Run the latest migration to enable profile settings."
- If logged in, allow loading/saving own profile.
- If not logged in, show login message.
- Do not crash.

Import settings page:
Simple placeholder/settings page for now:
- TrackMan import status
- Club alias note
- Future import options
- Link/button to Club aliases

App settings page:
Simple placeholder:
- version/info if available
- data/privacy note:
  "Your golf data is stored under your own user account."
- no complex settings needed yet

Players page:
Placeholder text:
"Each player can log in and has private data. Sharing and coach access will be added later."

Do not implement sharing.

Acceptance test:
- More → Profile opens.
- Profile saves if migration exists.
- More → Import settings opens.
- More → App settings opens.
- More → Players opens but is clearly marked as later.
- No page crashes if migration is missing.

At the end:
1. Commit changes.
2. Summarize changed files.
3. Tell me what to test.
```

### Phase 10 prompt: Final cleanup and consistency

```text
Continue from CLAUDE.md and the previous phase.

Goal:
Clean up naming, consistency, empty states, and phone usability after the restructure.

Final target:
Bottom nav:
Today | Coach | TrackMan | Bag | Logbook

More menu:
Progress | Players | Club aliases | Import settings | Profile | App settings

Important decisions:
- 5 bottom tabs only.
- More is a top/right menu.
- Players is placeholder only for now.
- Friends can log in and have their own private data via Supabase user_id.
- TrackMan stays technical.
- Bag shows only active clubs by default, with a Show inactive clubs toggle.
- Club aliases support both global and personal aliases.

Tasks:
1. Search the whole repo for old user-facing labels:
   - Practice
   - Clubs
   - Stats
   - Analysis
   - Trackman
2. Carefully update visible labels:
   - Practice → Logbook
   - Clubs → Bag
   - Analysis → TrackMan where user-facing
   - Trackman → TrackMan
3. Do not blindly rename internal function names if risky.
4. Remove duplicated or confusing cards.
5. Make empty states helpful:
   - no login
   - no TrackMan data
   - no chipping data
   - no putting data
   - no practice_sessions migration
   - no profiles migration
6. Make sure all buttons lead somewhere useful.
7. Make sure phone layout is clean.
8. Make sure auth state still works.
9. Make sure Supabase queries filter by current user where required.
10. Make sure global aliases are still readable but not editable by normal users.
11. Add small code comments only where future work is planned.
12. Do a final manual code inspection for obvious JS errors.

Acceptance test:
- Login works.
- Today works.
- Coach works.
- TrackMan works.
- Bag works.
- Logbook works.
- More works.
- More → Progress works.
- More → Club aliases works.
- More → Profile works or shows migration message.
- Bag only shows active clubs by default.
- Show inactive clubs toggle works.
- No obvious old/confusing labels remain.
- Browser DevTools Console shows no red JavaScript errors.

At the end:
1. Commit changes.
2. Provide changed files.
3. Provide important behavior changes.
4. Provide exact SQL I need to run manually in Supabase.
5. Provide remaining TODOs.
6. Provide risks.
7. Tell me what to test in the browser.
```

---

## 14. Output Format After Every Phase

Use this exact structure in the final response after a phase:

```text
## Summary
- ...

## Changed files
- ...

## Validation run
- Command: ...
- Result: ...

## SQL to run manually
Only include this section if SQL changed.

## Browser tests
- ...

## Risks / incomplete items
- ...

## Commit
- ...
```

---

## 15. Retros and Continuity

After every non-trivial phase, add or update a short retro if the repo already has a place for it.

Preferred path:

```text
docs/retros/YYYY-MM-DD-topic.md
```

If no retro folder exists, do not create a large documentation system unless asked. A short summary in the final response is enough.

At the start of a new session:

1. read `CLAUDE.md`
2. inspect current git status
3. inspect latest relevant commit or previous retro if available
4. continue from the next phase only

---

## 16. Important Things Not To Do

- Do not invite friends before Phase 1 security/user isolation is done and tested.
- Do not build Players/sharing yet.
- Do not add `player_shares` yet.
- Do not create a sixth bottom tab.
- Do not move aliases and redesign Bag in the same phase.
- Do not rewrite `auth.js` broadly unless the phase explicitly requires refactoring.
- Do not remove TrackMan technical details.
- Do not hide useful Coach/TrackMan logic behind oversimplified UI.
- Do not commit secrets.
- Do not claim Supabase migrations are applied unless the user applied them or a valid tool applied them.

---

## 17. User Preferences for This Project

- Prefer full affected-file outputs when asking for code outside Claude Code.
- Prefer small safe commits when working inside Claude Code.
- Prefer practical, simple, phone-friendly UI.
- Prefer clear wording, not fancy language.
- Prefer concrete test steps after every change.
- Prefer preserving working logic over unnecessary refactors.
