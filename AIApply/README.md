# AI Application Assistant — Manual Tasks Reference

This lists every command or manual step needed to run this tool, and whether
it has a corresponding button/action on the web dashboard (`npm run dev` →
http://localhost:3000) or has to be done outside the app.

## One-time setup (no UI equivalent)

| Command | What it does |
|---|---|
| `npm install` | Installs dependencies. |
| `npx playwright install chromium` | Downloads the browser used for autofill. |
| `npm run parse-resume` | Parses a resume into `data/profile.json` (requires a local Ollama instance running) — used for autofill's field-matching profile, separate from the tailored-document resume below. No UI equivalent — must be re-run manually any time this changes. |

Resume upload for tailored documents (the one Claude reads when writing a
resume/cover letter for a job) is no longer a manual file placement — see
**Settings — gear icon** under Fully in-app below.

## Watch list & prioritization (no UI equivalent)

| Task | What it does |
|---|---|
| Edit `src/jobs/sources/config.ts` | Add or remove a company's scan source entirely (company name + board ID) — the dashboard has no "add a new company to scan" form, this is still a source-code edit. Priority flagging and banning for companies already in this list is now handled in-app (see Settings below), not by editing this file. |
| Edit `.env` | Set Ollama URL/model and the app's port. No UI equivalent. |

## Recurring commands (some overlap with the dashboard)

| Command | What it does | Dashboard equivalent |
|---|---|---|
| `npm run dev` | Starts the local web app. | This *is* how you open the dashboard. |
| `npm run scan-jobs` | Scans watched companies for new postings. | Same as clicking **"Scan for new jobs"** on the dashboard — this CLI command is a redundant alternative, not required if you're using the app. |
| `npm run parse-resume` | Re-parses an updated resume into `data/profile.json`. | No UI equivalent — must be run manually whenever the resume changes. |

## Claude-assisted workflow (no UI equivalent — requires a chat with Claude)

| Step | What it does | Dashboard equivalent |
|---|---|---|
| Click **"Generate resume"** on a job | Flags that job as `requested` behind the scenes. No AI call happens here, and the dashboard no longer shows a distinct "requested" badge — the button just disappears once documents exist or the job is marked applied. | This part *is* on the dashboard. |
| Tell Claude "generate the pending ones" | Claude reads every job flagged `requested` (via `npm run list-requested`), writes the tailored resume + cover letter, and saves them into `toapply-docs/`. This is what actually produces the downloadable documents — it's a chat instruction, not a button. | None — this step only happens through a Claude conversation. |
| `npm run list-requested` | Lists jobs waiting for Claude to write documents. | None. |
| `npm run list-unchecked` | Lists companies with no legitimacy verdict yet. | Largely superseded by the **"Legit company"** checkbox below — checking/unchecking it records a verdict yourself, no Claude research step required. |
| Tell Claude to check unchecked companies | Claude researches each company (funding, headcount, reputation) and records a verdict. | None — optional if you'd rather do the quick manual check yourself via the checkbox. |
| `npm run record-verdict -- "Company" true/false "reason"` | Saves a company's legitimacy verdict permanently. Run by Claude after a check — not typically run by the user directly. | None. |

## Fully in-app (no manual step needed)

| Action | Where |
|---|---|
| Scan for new postings | **"Scan for new jobs"** button |
| Auto-flagging known major employers | Automatic — no action needed |
| Toggle a company's legitimacy on/off | **"Legit company"** checkbox on any job whose company isn't already priority-flagged — a real two-way toggle, stays visible/checked until the job is marked applied |
| Hiding duplicate postings (same company + title) | Automatic — only the first one found is shown |
| Open & autofill a prepared application | **"Open and auto-fill application"** button (enabled once documents are ready) |
| Mark a posting as applied | **"Mark as applied"** button (shown once a job isn't already applied) |
| Delete a posting | **"Delete"** button — soft-delete, recoverable |
| Undo the most recent delete | **"Undo delete"** button (top of the page) — restores the job to its exact prior status; one level of undo only |
| Add a fake job to test the UI | **"Add dummy job"** button (top of the page) — inserts an unverified test posting without running a real scan; dev/testing use only |
| Personal data staying local | Automatic/passive — enforced via `.gitignore` (now also covers `toapply-docs/` and `webapp-docs/`) |
| Flag/ban a company from a job card | **"Flag company"** button on any card — same underlying ban list as the Settings drawer below; banning excludes every tracked job from that company and blocks future scans/URL imports from it |

### Settings (gear icon, next to "Scan for new jobs")

Opens a dropdown with **Job settings** and **User settings**, each a slide-out
drawer from the right.

| Drawer | Tab / field | What it does |
|---|---|---|
| Job settings | Companies to add | Green-chip list — priority companies, badged **Verified** and sorted to the top. |
| Job settings | Companies to ban | Red-chip list — blocks a company entirely, same list as the per-card **Flag company** button. |
| Job settings | Title terms to add | Shows a job even if its title fails the built-in design-role filter. |
| Job settings | Title terms to ban | Hides a job even if it passes the filter — this is also where the old hardcoded Senior/Staff/Principal exclusion now lives. |
| User settings | Job titles you want | Reference-only chip list for now — not wired into scan/filter logic. |
| User settings | Resume | Upload/remove the resume Claude reads from when writing tailored documents. Saved to `webapp-docs/` (gitignored); replaces the old `data/input-resume.pdf` manual placement. Only one resume is kept at a time. |

Both drawers share one **Save** button per drawer and a **"Clear all
existing job history"** checkbox (off by default). Saving always triggers a
full rescan so the new settings apply to fresh postings immediately —
the button shows "Saving & scanning..." and the app lands back on New Jobs
with a confirmation banner when done. Checking "clear all existing job
history" before saving asks for confirmation, then **permanently deletes**
every tracked job (New, Applied, Hidden, Past) with no undo — generated
files already in `toapply-docs/` aren't touched, only the database rows.

Company priority and the Senior/Staff/Principal title exclusion used to
live only in source code (`src/jobs/priorityCompanies.ts`, now deleted,
and a hardcoded regex in `app.js`, also removed) — both are now fully
editable through this UI and stored in `data/jobs.db` (gitignored), never
pushed to GitHub.

## Planned UI (not yet built)

| Feature | What it would do | Status |
|---|---|---|
| Remote/Local filter row | A single-row dropdown (Remote / Local) above the job cards, with "Last 24 hours" right-aligned in the same row. | Documented only — see `Documents/case-study.txt` item 2. Not implemented in `index.html`/`app.js`. |

## Maintenance / dev only (no UI equivalent)

| Command | What it does |
|---|---|
| `npm run typecheck` | Verifies the TypeScript compiles with no errors. |
| `npm run build` | Compiles to `dist/`. |
| `npm run start` | Runs the compiled build instead of the dev server. |

Settings API routes (back the gear-icon drawers above):

| Route | What it does |
|---|---|
| `GET /api/jobs/job-settings` | Current Companies/Job Title lists. |
| `POST /api/jobs/job-settings` | Saves all four lists, optional `clearAll` flag, triggers rescan. |
| `GET /api/user-settings` | Current job titles + resume filename. |
| `POST /api/user-settings/job-titles` | Saves job-titles list, optional `clearAll` flag, triggers rescan. |
| `POST /api/user-settings/resume` | Uploads resume (base64 JSON body). |
| `DELETE /api/user-settings/resume` | Removes the current resume. |
