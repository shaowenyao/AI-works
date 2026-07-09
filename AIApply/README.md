# AI Application Assistant — Manual Tasks Reference

This lists every command or manual step needed to run this tool, and whether
it has a corresponding button/action on the web dashboard (`npm run dev` →
http://localhost:3000) or has to be done outside the app.

## One-time setup (no UI equivalent)

| Command | What it does |
|---|---|
| `npm install` | Installs dependencies. |
| `npx playwright install chromium` | Downloads the browser used for autofill. |
| Place resume PDF at `data/input-resume.pdf` | Manual file placement — no upload button in the dashboard. |
| `npm run parse-resume` | Parses the resume PDF into `data/profile.json` (requires a local Ollama instance running). No UI equivalent — must be re-run manually any time the resume changes. |

## Watch list & prioritization (no UI equivalent)

| Task | What it does |
|---|---|
| Edit `src/jobs/sources/config.ts` | Add or remove companies from the watch list. The dashboard has no "add company" form — this is a source-code edit. |
| Edit `priority: true` in `src/jobs/sources/config.ts` | Manually flag a specific company as priority regardless of the automatic classification. Same file, no UI equivalent. |
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
| Click **"Generate Resume"** on a job | Flags that job as `requested`. No AI call happens here. | This part *is* on the dashboard. |
| Tell Claude "generate the pending ones" | Claude reads every job flagged `requested` (via `npm run list-requested`), writes the tailored resume + cover letter, and saves them. This is what actually produces the downloadable documents — it's a chat instruction, not a button. | None — this step only happens through a Claude conversation. |
| `npm run list-requested` | Lists jobs waiting for Claude to write documents. | None. |
| `npm run list-unchecked` | Lists companies with no legitimacy verdict yet. | None. |
| Tell Claude to check unchecked companies | Claude researches each company (funding, headcount, reputation) and records a verdict. | None. |
| `npm run record-verdict -- "Company" true/false "reason"` | Saves a company's legitimacy verdict permanently. Run by Claude after a check — not typically run by the user directly. | None. |

## Fully in-app (no manual step needed)

| Action | Where |
|---|---|
| Scan for new postings | **"Scan for new jobs"** button |
| Auto-flagging known major employers | Automatic — no action needed |
| Open & autofill a prepared application | **"Open & Auto-fill Application"** button (enabled once documents are ready) |
| Personal data staying local | Automatic/passive — enforced via `.gitignore` |

## Maintenance / dev only (no UI equivalent)

| Command | What it does |
|---|---|
| `npm run typecheck` | Verifies the TypeScript compiles with no errors. |
| `npm run build` | Compiles to `dist/`. |
| `npm run start` | Runs the compiled build instead of the dev server. |
