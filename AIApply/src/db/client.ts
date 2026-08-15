import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isRemoteConfirmed, isLocalToSf } from "../jobs/locationClassifier.js";

const DATA_DIR = path.resolve("data");
mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, "jobs.db");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(path.join(__dirname, "schema.sql"), "utf-8");

export const db = new DatabaseSync(DB_PATH);
db.exec(schema);

// Lightweight migration for existing local databases created before the
// `priority` column existed. SQLite has no "ADD COLUMN IF NOT EXISTS", so we
// just try it and ignore the "duplicate column" error on a database that's
// already up to date.
try {
  db.exec("ALTER TABLE jobs ADD COLUMN priority INTEGER NOT NULL DEFAULT 0");
} catch {
  // column already exists
}

// previous_status/dismissed_at supported the old Hide/Unhide feature (since
// removed) — left in place rather than dropped, per this file's
// additive-only migration convention; always NULL now.
try {
  db.exec("ALTER TABLE jobs ADD COLUMN previous_status TEXT");
} catch {
  // column already exists
}
try {
  db.exec("ALTER TABLE jobs ADD COLUMN dismissed_at TEXT");
} catch {
  // column already exists
}

// Location classification (see locationClassifier.ts), computed once at
// scan time and stored rather than recomputed on every read.
try {
  db.exec("ALTER TABLE jobs ADD COLUMN location TEXT");
} catch {
  // column already exists
}
try {
  db.exec("ALTER TABLE jobs ADD COLUMN is_remote INTEGER NOT NULL DEFAULT 0");
} catch {
  // column already exists
}
try {
  db.exec("ALTER TABLE jobs ADD COLUMN is_local_sf INTEGER NOT NULL DEFAULT 0");
} catch {
  // column already exists
}

// Timestamp of when "Optimize CV" was clicked (see markJobRequested).
try {
  db.exec("ALTER TABLE jobs ADD COLUMN requested_at TEXT");
} catch {
  // column already exists
}

// Permanent "apply Nth" number, assigned once in markJobRequested() and
// never recomputed — so it can't shift if an earlier job is later applied
// to, dismissed, or pruned. Drives both the application folder suffix and
// the "Apply 01" badge in the UI.
try {
  db.exec("ALTER TABLE jobs ADD COLUMN apply_order INTEGER");
} catch {
  // column already exists
}

// Where an applied job stands in the actual hiring pipeline (as opposed to
// `status`, which just tracks this app's own found/requested/applied
// lifecycle) — set via the status dropdown on Applied Jobs cards.
try {
  db.exec("ALTER TABLE jobs ADD COLUMN pipeline_stage TEXT");
} catch {
  // column already exists
}

export const PIPELINE_STAGES = ["applied", "recruiter", "interview", "offer", "ghosted"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

// The star toggle on job cards. Independent of status/hiding — survives a
// job being hidden and unhidden, since it's just a separate flag.
try {
  db.exec("ALTER TABLE jobs ADD COLUMN favorited INTEGER NOT NULL DEFAULT 0");
} catch {
  // column already exists
}

// Set on jobs added via the "Add job" URL-import flow (see importByUrl.ts).
// The user explicitly chose to add that exact posting, so it's exempt from
// the isDesignTitle filter below (and the client's own isSeniorTitle/
// location/search filters) — unlike scanned jobs, which are pulled in bulk
// from a whole company board and need filtering down to design roles.
try {
  db.exec("ALTER TABLE jobs ADD COLUMN manually_imported INTEGER NOT NULL DEFAULT 0");
} catch {
  // column already exists
}

export interface JobRow {
  id: number;
  company: string;
  title: string;
  url: string;
  source: string;
  description: string | null;
  date_found: string;
  status: string;
  resume_path: string | null;
  cover_letter_path: string | null;
  applied_date: string | null;
  priority: number;
  previous_status: string | null;
  dismissed_at: string | null;
  location: string | null;
  /** Computed via locationClassifier.isRemoteConfirmed() at scan time. */
  is_remote: number;
  /** Computed via locationClassifier.isLocalToSf() at scan time. */
  is_local_sf: number;
  /** When "Optimize CV" was clicked for this job — see markJobRequested(). */
  requested_at: string | null;
  /** Permanent "apply Nth" number, assigned once — see markJobRequested(). */
  apply_order: number | null;
  /** Hiring-pipeline stage for an applied job — see setPipelineStage(). */
  pipeline_stage: string | null;
  /** 1 if starred — see setFavorite(). Independent of status/hiding. */
  favorited: number;
  /** 1 if added via the "Add job" URL-import flow — see insertJobIfNew(). */
  manually_imported: number;
}

function normalizeForDuplicateCheck(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Hides likely duplicate postings instead of just badging them — same
 * company + title (normalized; exact-URL dedup already caught anything with
 * the same URL), e.g. the same role listed separately per office/location.
 * Only the first instance found (earliest date_found) is kept in the
 * result; the rest are dropped entirely. Computed at read time, not stored,
 * since "duplicate" is a relationship between rows, not a fact about one.
 */
export function hideDuplicates(jobs: JobRow[]): JobRow[] {
  const seen = new Set<string>();
  const keep = new Set<number>();

  const byFirstFound = [...jobs].sort((a, b) => a.date_found.localeCompare(b.date_found));
  for (const job of byFirstFound) {
    const key = `${normalizeForDuplicateCheck(job.company)}::${normalizeForDuplicateCheck(job.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    keep.add(job.id);
  }

  // Preserve the caller's original ordering (priority-first, newest-first).
  return jobs.filter((job) => keep.has(job.id));
}

export interface NewJob {
  company: string;
  title: string;
  url: string;
  source: string;
  description?: string;
  priority?: boolean;
  location?: string;
  isRemote?: boolean;
  isLocalSf?: boolean;
  manuallyImported?: boolean;
}

/**
 * Inserts a job if its URL isn't already known and its company isn't
 * blocked (see blockCompany). Returns true if a new row was inserted.
 */
export function insertJobIfNew(job: NewJob): boolean {
  const existing = db.prepare("SELECT id FROM jobs WHERE url = ?").get(job.url);
  if (existing) return false;
  if (isCompanyBlocked(job.company)) return false;

  db.prepare(
    `INSERT INTO jobs (company, title, url, source, description, date_found, status, priority, location, is_remote, is_local_sf, manually_imported)
     VALUES (?, ?, ?, ?, ?, ?, 'found', ?, ?, ?, ?, ?)`,
  ).run(
    job.company,
    job.title,
    job.url,
    job.source,
    job.description ?? null,
    new Date().toISOString(),
    job.priority ? 1 : 0,
    job.location ?? null,
    job.isRemote ? 1 : 0,
    job.isLocalSf ? 1 : 0,
    job.manuallyImported ? 1 : 0,
  );

  return true;
}

// Made-up names only, entirely separate from the real watch list in
// jobs/sources/config.ts — this pool never touches live scanning or the
// design-title filter (shared/jobFilters.js), it only feeds insertDummyJob()
// below. hideDuplicates() collapses jobs sharing the same (company, title),
// keeping only the earliest — correct for real postings (same role listed
// under multiple offices), but it means a small pool here risks a repeat
// click landing on a combo an earlier dummy job already used and silently
// vanishing behind it. Kept large enough (100 x 10 = 1000 combos) that a
// collision is unlikely even across a long testing session, without
// needing to tag titles with anything that gives away it's a dummy entry.
const DUMMY_COMPANIES = [
  "Northwind Robotics",
  "Fernbank Health",
  "Vector Analytics",
  "Bluepeak Systems",
  "Cascade Dynamics",
  "Harbor Labs",
  "Ridgeline Health",
  "Solstice Systems",
  "Meridian Analytics",
  "Brightwell Technologies",
  "Ironclad Systems",
  "Pinecrest Labs",
  "Amberlight Robotics",
  "Silverbrook Health",
  "Crestline Analytics",
  "Woodhaven Systems",
  "Cobalt Dynamics",
  "Fairwind Labs",
  "Granite Peak Health",
  "Lucid Networks",
  "Timberline Systems",
  "Nova Ridge Robotics",
  "Clearwater Analytics",
  "Highbridge Technologies",
  "Sable Point Labs",
  "Windrose Health",
  "Basalt Dynamics",
  "Everline Systems",
  "Copperfield Robotics",
  "Aldergate Health",
  "Northstar Analytics",
  "Millbrook Labs",
  "Greywolf Systems",
  "Sunhaven Technologies",
  "Rockford Dynamics",
  "Emberline Health",
  "Kestrel Robotics",
  "Palisade Analytics",
  "Thornfield Labs",
  "Brightridge Systems",
  "Cinderpine Health",
  "Vantage Point Technologies",
  "Hollowbrook Dynamics",
  "Larkspur Robotics",
  "Wrenfield Analytics",
  "Stonebridge Labs",
  "Foxglove Health",
  "Marrow Systems",
  "Ashgrove Technologies",
  "Deepwell Dynamics",
  "Silverline Robotics",
  "Brackenridge Analytics",
  "Windmere Labs",
  "Copperline Health",
  "Ravenwood Systems",
  "Hearthstone Technologies",
  "Blackfern Dynamics",
  "Wolfridge Robotics",
  "Amberfield Analytics",
  "Southgate Labs",
  "Ironwood Health",
  "Highmoor Systems",
  "Cloudpeak Technologies",
  "Redstone Dynamics",
  "Willowmere Robotics",
  "Thistledown Analytics",
  "Graystone Labs",
  "Fallowfield Health",
  "Bramblewood Systems",
  "Duskridge Technologies",
  "Elmsworth Dynamics",
  "Farrowgate Robotics",
  "Hazelbrook Analytics",
  "Ironvale Labs",
  "Juniper Ridge Health",
  "Kettlewell Systems",
  "Longshadow Technologies",
  "Moorland Dynamics",
  "Nightingale Robotics",
  "Oakhollow Analytics",
  "Pemberton Labs",
  "Quarryfield Health",
  "Rimwood Systems",
  "Silverpine Technologies",
  "Thornwell Dynamics",
  "Underhill Robotics",
  "Vesperfield Analytics",
  "Westbrooke Labs",
  "Yewgrove Health",
  "Zephyrline Systems",
  "Ashcombe Technologies",
  "Briarcliff Dynamics",
  "Coldwater Robotics",
  "Driftwood Analytics",
  "Eastmere Labs",
  "Frostwick Health",
  "Gladewell Systems",
  "Hartmoor Technologies",
  "Ironbridge Dynamics",
  "Juniper Falls Robotics",
];
// Plain IC design titles only — the app's job list filters out "manager",
// "director", "staff", "principal", "senior product", and non-design roles,
// so anything else here would silently never show up after being added.
const DUMMY_TITLES = [
  "Product Designer",
  "UX Designer",
  "Visual Designer",
  "Brand Designer",
  "UI Designer",
  "Junior Product Designer",
  "Growth Designer",
  "Web Designer",
  "Interaction Designer",
  "Motion Designer",
];
const DUMMY_REMOTE_LOCATIONS = ["Remote (US)", "Remote"];
const DUMMY_LOCAL_LOCATIONS = ["San Francisco, CA", "Oakland, CA"];

/**
 * Inserts a fake, unverified (priority=0) job for exercising the UI without
 * a real scan — e.g. testing the "Legit company" checkbox flow. `locationType`
 * picks a location that actually matches the requested bucket (remote or
 * SF-local) so the job is guaranteed to show up under whichever filter is
 * currently active, instead of landing in a random bucket the user isn't
 * looking at. Defaults to remote if not specified.
 */
export function insertDummyJob(locationType: "remote" | "local" = "remote"): JobRow {
  const company = DUMMY_COMPANIES[Math.floor(Math.random() * DUMMY_COMPANIES.length)];
  const title = DUMMY_TITLES[Math.floor(Math.random() * DUMMY_TITLES.length)];
  const pool = locationType === "local" ? DUMMY_LOCAL_LOCATIONS : DUMMY_REMOTE_LOCATIONS;
  const location = pool[Math.floor(Math.random() * pool.length)];
  const url = `https://example.com/dummy-job/${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  insertJobIfNew({
    company,
    title,
    url,
    source: "greenhouse",
    description: "Dummy job posting for testing the UI — not a real listing.",
    location,
    isRemote: isRemoteConfirmed({ location }),
    isLocalSf: isLocalToSf({ location }),
    // Same bypass URL-imported jobs get — otherwise a persistent Scan
    // location (User Settings) can silently hide a dummy job whose fake
    // location doesn't happen to match it, breaking the "guaranteed to
    // show up" promise above.
    manuallyImported: true,
  });

  return db.prepare("SELECT * FROM jobs WHERE url = ?").get(url) as unknown as JobRow;
}

const ARCHIVE_RETENTION_DAYS = 7;

/**
 * Keeps the Archived tab to a rolling 1-week window: permanently removes
 * jobs found more than 7 days ago, except applied ones (a permanent record
 * of what you've applied to). Run on every page load and on every scan, not
 * just once, since "7 days ago" keeps moving.
 */
export function pruneOldArchivedJobs(): number {
  const cutoff = new Date(Date.now() - ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const result = db
    .prepare("DELETE FROM jobs WHERE status NOT IN ('applied', 'excluded') AND date_found < ?")
    .run(cutoff);
  return Number(result.changes);
}

/** Priority companies first, then newest first within each group. */
export function listJobs(): JobRow[] {
  return db
    .prepare(
      `SELECT * FROM jobs
       ORDER BY (url LIKE 'https://example.com/dummy-job/%') DESC, priority DESC, date_found DESC`,
    )
    .all() as unknown as JobRow[];
}

/** Jobs flagged via markJobRequested(), waiting for Claude to generate their documents. */
export function listRequestedJobs(): JobRow[] {
  return db
    .prepare("SELECT * FROM jobs WHERE status = 'requested' ORDER BY date_found ASC")
    .all() as unknown as JobRow[];
}

export function getJob(id: number): JobRow | undefined {
  return db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow | undefined;
}

/**
 * Flags a job as waiting for you to ask Claude to generate its tailored
 * documents, and — the first time only — permanently assigns it the next
 * "apply Nth" number (one past the highest ever assigned). Because this
 * only reads/writes apply_order and never recomputes from the current set
 * of rows, a job's number can't shift later just because an earlier job
 * gets applied to, dismissed, or pruned — it only ever counts up.
 */
export function markJobRequested(id: number): void {
  db.prepare(
    `UPDATE jobs SET
       status = 'requested',
       requested_at = COALESCE(requested_at, ?),
       apply_order = COALESCE(apply_order, (SELECT COALESCE(MAX(apply_order), 0) FROM jobs) + 1)
     WHERE id = ?`,
  ).run(new Date().toISOString(), id);
}

export function setJobDocuments(id: number, resumePath: string, coverLetterPath: string): void {
  db.prepare(
    "UPDATE jobs SET resume_path = ?, cover_letter_path = ?, status = 'prepared' WHERE id = ?",
  ).run(resumePath, coverLetterPath, id);
}

export function markJobApplied(id: number): void {
  db.prepare(
    "UPDATE jobs SET status = 'applied', applied_date = ?, pipeline_stage = COALESCE(pipeline_stage, 'applied') WHERE id = ?",
  ).run(new Date().toISOString(), id);
}

/** Updates where an applied job stands in the hiring pipeline — see the status dropdown on Applied Jobs cards. */
export function setPipelineStage(id: number, stage: PipelineStage): void {
  db.prepare("UPDATE jobs SET pipeline_stage = ? WHERE id = ?").run(stage, id);
}

/** Toggles the star on a card. */
export function setFavorite(id: number, favorited: boolean): void {
  db.prepare("UPDATE jobs SET favorited = ? WHERE id = ?").run(favorited ? 1 : 0, id);
}

/**
 * Permanently excludes a job as a bad fit — the "Exclude" button on New
 * Jobs. Not reversible from the UI, and the job never appears in any tab
 * again (see the GET / route filtering out 'excluded'). The row is kept,
 * not hard-deleted, and is exempted from pruneOldArchivedJobs: exact-URL
 * dedup in insertJobIfNew needs the row to still exist, or the same
 * posting would just resurface as "new" on the next scan.
 */
export function excludeJob(id: number): void {
  db.prepare("UPDATE jobs SET status = 'excluded' WHERE id = ?").run(id);
}

/**
 * The "Clear all existing job history" checkbox on Job/User Settings —
 * a full, permanent wipe of every job row, including Applied history, not
 * just New Jobs. Unlike excludeJob/blockCompany this is a real
 * DELETE, not a status change — there is no undo. Only ever called right
 * before a fresh scan (see the settings save routes), so the table doesn't
 * stay empty.
 */
export function clearAllJobs(): void {
  db.exec("DELETE FROM jobs");
}

export function isCompanyBlocked(company: string): boolean {
  return Boolean(
    db.prepare("SELECT 1 FROM blocked_companies WHERE company = ? COLLATE NOCASE").get(company),
  );
}

/**
 * "Flag company" on Applied Jobs — for a company you've decided is a scam,
 * not just a bad-fit single posting (that's excludeJob). Excludes every
 * existing job from that company right away (same 'excluded' status and
 * same reasoning as excludeJob: kept in the DB, not hard-deleted, so a
 * rescan's exact-URL dedup still works and the company can't resurface),
 * and insertJobIfNew() checks blocked_companies so future scans skip it
 * entirely rather than needing to exclude each new posting one at a time.
 */
export function blockCompany(company: string): void {
  db.prepare("INSERT OR IGNORE INTO blocked_companies (company, blocked_at) VALUES (?, ?)").run(
    company,
    new Date().toISOString(),
  );
  db.prepare("UPDATE jobs SET status = 'excluded' WHERE company = ? COLLATE NOCASE").run(company);
}

/** Un-bans a company (Job Settings panel) — does not un-exclude jobs already excluded by blockCompany(). */
export function unblockCompany(company: string): void {
  db.prepare("DELETE FROM blocked_companies WHERE company = ? COLLATE NOCASE").run(company);
}

export function listBlockedCompanies(): string[] {
  const rows = db.prepare("SELECT company FROM blocked_companies ORDER BY company COLLATE NOCASE ASC").all() as {
    company: string;
  }[];
  return rows.map((r) => r.company);
}

export interface CompanyVerdict {
  company: string;
  decent: number;
  note: string | null;
  checked_at: string;
}

export function getCompanyVerdict(company: string): CompanyVerdict | undefined {
  return db.prepare("SELECT * FROM company_verdicts WHERE company = ?").get(company) as
    | CompanyVerdict
    | undefined;
}

/**
 * Records Claude's legitimacy verdict for a company and retroactively applies
 * it to every job already in the database from that company, not just future
 * scans — so checking a company once fixes all its existing postings too.
 * This applies in both directions: flipping an existing verdict from decent
 * to not-decent (e.g. via the in-app verdicts editor) un-flags priority on
 * that company's jobs too, not just the initial "true" recording.
 */
export function recordCompanyVerdict(company: string, decent: boolean, note?: string): void {
  db.prepare(
    `INSERT INTO company_verdicts (company, decent, note, checked_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(company) DO UPDATE SET decent = excluded.decent, note = excluded.note, checked_at = excluded.checked_at`,
  ).run(company, decent ? 1 : 0, note ?? null, new Date().toISOString());

  db.prepare("UPDATE jobs SET priority = ? WHERE company = ? COLLATE NOCASE").run(decent ? 1 : 0, company);
}

/** Companies added on the Job Settings panel's Companies tab (via recordCompanyVerdict(company, true)). */
export function listPriorityCompanies(): string[] {
  const rows = db
    .prepare("SELECT company FROM company_verdicts WHERE decent = 1 ORDER BY company COLLATE NOCASE ASC")
    .all() as { company: string }[];
  return rows.map((r) => r.company);
}

/**
 * Distinct companies that showed up in a scan but aren't on the static
 * auto-priority list, weren't manually flagged, and have no cached verdict
 * yet — i.e. genuinely waiting for Claude to do a quick legitimacy check.
 */
export function listUncheckedCompanies(): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT j.company FROM jobs j
       LEFT JOIN company_verdicts v ON v.company = j.company COLLATE NOCASE
       WHERE j.priority = 0 AND v.company IS NULL
       ORDER BY j.company ASC`,
    )
    .all() as { company: string }[];
  return rows.map((r) => r.company);
}

type TermTable = "title_include_terms" | "title_exclude_terms";

function listTerms(table: TermTable): string[] {
  const rows = db.prepare(`SELECT term FROM ${table} ORDER BY term COLLATE NOCASE ASC`).all() as {
    term: string;
  }[];
  return rows.map((r) => r.term);
}

/** Replaces the whole contents of one term list — Save on the Job/User Settings panels is a batch operation, not per-item. */
function replaceTerms(table: TermTable, terms: string[]): void {
  db.exec(`DELETE FROM ${table}`);
  const insert = db.prepare(`INSERT OR IGNORE INTO ${table} (term) VALUES (?)`);
  for (const term of terms) {
    const trimmed = term.trim();
    if (trimmed) insert.run(trimmed);
  }
}

export interface JobSettings {
  priorityCompanies: string[];
  bannedCompanies: string[];
  includeTerms: string[];
  excludeTerms: string[];
}

export function getJobSettings(): JobSettings {
  return {
    priorityCompanies: listPriorityCompanies(),
    bannedCompanies: listBlockedCompanies(),
    includeTerms: listTerms("title_include_terms"),
    excludeTerms: listTerms("title_exclude_terms"),
  };
}

/**
 * Saves the Job Settings panel in one shot. Companies are diffed against
 * the current state (recordCompanyVerdict/blockCompany/unblockCompany all
 * have side effects on existing jobs, so only actually calling them for
 * what changed avoids redundant work); title terms are simple table
 * replacements since matching them has no side effects to worry about.
 */
export function saveJobSettings(settings: JobSettings): void {
  const before = getJobSettings();

  const beforePriority = new Set(before.priorityCompanies.map((c) => c.toLowerCase()));
  const afterPriority = new Set(settings.priorityCompanies.map((c) => c.toLowerCase()));
  for (const company of settings.priorityCompanies) {
    if (!beforePriority.has(company.toLowerCase())) recordCompanyVerdict(company, true);
  }
  for (const company of before.priorityCompanies) {
    if (!afterPriority.has(company.toLowerCase())) recordCompanyVerdict(company, false);
  }

  const beforeBanned = new Set(before.bannedCompanies.map((c) => c.toLowerCase()));
  const afterBanned = new Set(settings.bannedCompanies.map((c) => c.toLowerCase()));
  for (const company of settings.bannedCompanies) {
    if (!beforeBanned.has(company.toLowerCase())) blockCompany(company);
  }
  for (const company of before.bannedCompanies) {
    if (!afterBanned.has(company.toLowerCase())) unblockCompany(company);
  }

  replaceTerms("title_include_terms", settings.includeTerms);
  replaceTerms("title_exclude_terms", settings.excludeTerms);
}

export interface ScanLocation {
  city: string;
  radiusMiles: number;
}

/** User Settings' scan location — always returns a row (defaults to no restriction: empty city, 0 radius). */
export function getScanLocation(): ScanLocation {
  const row = db.prepare("SELECT city, radius_miles FROM scan_location_setting WHERE id = 1").get() as
    | { city: string; radius_miles: number }
    | undefined;
  return row ? { city: row.city, radiusMiles: row.radius_miles } : { city: "", radiusMiles: 0 };
}

export function saveScanLocation(location: ScanLocation): void {
  db.prepare(
    `INSERT INTO scan_location_setting (id, city, radius_miles) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET city = excluded.city, radius_miles = excluded.radius_miles`,
  ).run(location.city.trim(), location.radiusMiles);
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
}

/** Identity info from Job Settings' User tab / the onboarding welcome screen — always returns a row (defaults to empty). */
export function getUserProfile(): UserProfile {
  const row = db.prepare("SELECT first_name, last_name, email FROM user_profile WHERE id = 1").get() as
    | { first_name: string; last_name: string; email: string }
    | undefined;
  return row
    ? { firstName: row.first_name, lastName: row.last_name, email: row.email }
    : { firstName: "", lastName: "", email: "" };
}

export function saveUserProfile(profile: UserProfile): void {
  db.prepare(
    `INSERT INTO user_profile (id, first_name, last_name, email) VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET first_name = excluded.first_name, last_name = excluded.last_name, email = excluded.email`,
  ).run(profile.firstName.trim(), profile.lastName.trim(), profile.email.trim());
}

/** Gates applying to jobs (see POST /:id/apply and /:id/mark-applied) — an application needs at least a name and email to go out. */
export function isProfileComplete(): boolean {
  const profile = getUserProfile();
  return Boolean(profile.firstName.trim() && profile.lastName.trim() && profile.email.trim());
}

/** The AI opt-out toggle (Job Settings' User tab / onboarding welcome screen) — defaults to enabled. */
export function getAiGenerationEnabled(): boolean {
  const row = db.prepare("SELECT enabled FROM ai_generation_setting WHERE id = 1").get() as
    | { enabled: number }
    | undefined;
  return row ? Boolean(row.enabled) : true;
}

export function setAiGenerationEnabled(enabled: boolean): void {
  db.prepare(
    `INSERT INTO ai_generation_setting (id, enabled) VALUES (1, ?)
     ON CONFLICT(id) DO UPDATE SET enabled = excluded.enabled`,
  ).run(enabled ? 1 : 0);
}

/**
 * Wipes every job's application-progress fields back to a clean 'found'
 * state — generated documents, applied status/date, hiring-pipeline stage,
 * the whole "Optimize CV" request/apply-order trail. Run whenever the AI
 * opt-out setting actually changes (see setAiGenerationEnabled's caller):
 * once AI generation is toggled, a job's existing resume/cover-letter link
 * or "ready to apply" state no longer matches the new mode, so it's cleared
 * rather than left in a state the UI can't represent. Leaves favorited,
 * priority, and manually_imported alone — those are curation flags, not
 * application progress. Also leaves excluded jobs (see excludeJob/
 * blockCompany) untouched — resetting status to 'found' would silently
 * un-exclude a bad-fit posting or scam company's job, which has nothing to
 * do with AI generation.
 */
export function resetAllJobsForAiToggle(): void {
  db.exec(
    `UPDATE jobs SET
       status = 'found',
       resume_path = NULL,
       cover_letter_path = NULL,
       applied_date = NULL,
       requested_at = NULL,
       apply_order = NULL,
       pipeline_stage = NULL
     WHERE status != 'excluded'`,
  );
}
