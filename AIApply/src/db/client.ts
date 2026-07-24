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

// Lets a delete be undone: dismissJob() stashes the status a job had right
// before deletion here, along with when, so undoLastDismiss() can find the
// most recent one and put it back.
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

// Whether THIS job's "Optimize CV" click happened while demo mode was on
// (see markJobRequested). Scoped per-job and set once, so toggling demo
// mode later never retroactively unlocks "Apply with AI fill" for jobs
// that were started for real — only jobs actually begun in demo mode get
// the early-unlock behavior while demo mode is active.
try {
  db.exec("ALTER TABLE jobs ADD COLUMN demo_started INTEGER");
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
  /** 1 if this company has a company_verdicts row (i.e. was checked/set via the "Legit company" checkbox, as opposed to being auto-flagged from the static priority list). */
  has_verdict: number;
  location: string | null;
  /** Computed via locationClassifier.isRemoteConfirmed() at scan time. */
  is_remote: number;
  /** Computed via locationClassifier.isLocalToSf() at scan time. */
  is_local_sf: number;
  /** When "Optimize CV" was clicked for this job — see markJobRequested(). */
  requested_at: string | null;
  /** Permanent "apply Nth" number, assigned once — see markJobRequested(). */
  apply_order: number | null;
  /** 1 if this job's "Optimize CV" click happened while demo mode was on. */
  demo_started: number | null;
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
  const byFirstFound = [...jobs].sort((a, b) => a.date_found.localeCompare(b.date_found));
  const keep = new Set<number>();

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
}

/** Inserts a job if its URL isn't already known. Returns true if a new row was inserted. */
export function insertJobIfNew(job: NewJob): boolean {
  const existing = db.prepare("SELECT id FROM jobs WHERE url = ?").get(job.url);
  if (existing) return false;

  db.prepare(
    `INSERT INTO jobs (company, title, url, source, description, date_found, status, priority, location, is_remote, is_local_sf)
     VALUES (?, ?, ?, ?, ?, ?, 'found', ?, ?, ?, ?)`,
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
  );

  return true;
}

const DUMMY_COMPANIES = ["Northwind Robotics", "Fernbank Health", "Vector Analytics", "Bluepeak Systems"];
// Plain IC design titles only — the app's job list filters out "manager",
// "director", "staff", "principal", "senior product", and non-design roles,
// so anything else here would silently never show up after being added.
const DUMMY_TITLES = ["Product Designer", "UX Designer", "Visual Designer", "Brand Designer"];
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
  });

  return db.prepare("SELECT * FROM jobs WHERE url = ?").get(url) as unknown as JobRow;
}

const ARCHIVE_RETENTION_DAYS = 7;

/**
 * Keeps the Archived tab to a rolling 1-week window: permanently removes
 * jobs found more than 7 days ago, except applied ones (a permanent record
 * of what you've applied to) and already-dismissed ones (a separate,
 * soft-deleted bucket this shouldn't interfere with). Run on every page
 * load and on every scan, not just once, since "7 days ago" keeps moving.
 */
export function pruneOldArchivedJobs(): number {
  const cutoff = new Date(Date.now() - ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const result = db
    .prepare("DELETE FROM jobs WHERE status NOT IN ('applied', 'dismissed') AND date_found < ?")
    .run(cutoff);
  return Number(result.changes);
}

/** Priority companies first, then newest first within each group. Excludes dismissed postings. */
export function listJobs(): JobRow[] {
  return db
    .prepare(
      `SELECT j.*, CASE WHEN v.company IS NULL THEN 0 ELSE 1 END AS has_verdict
       FROM jobs j
       LEFT JOIN company_verdicts v ON v.company = j.company COLLATE NOCASE
       WHERE j.status != 'dismissed'
       ORDER BY (j.url LIKE 'https://example.com/dummy-job/%') DESC, j.priority DESC, j.date_found DESC`,
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
 *
 * `isDemo` records whether this specific click happened with demo mode on
 * (see demo_started) — set once, like apply_order, so it reflects how the
 * job was actually started rather than whatever demo mode is toggled to
 * later.
 */
export function markJobRequested(id: number, isDemo: boolean): void {
  db.prepare(
    `UPDATE jobs SET
       status = 'requested',
       requested_at = COALESCE(requested_at, ?),
       apply_order = COALESCE(apply_order, (SELECT COALESCE(MAX(apply_order), 0) FROM jobs) + 1),
       demo_started = COALESCE(demo_started, ?)
     WHERE id = ?`,
  ).run(new Date().toISOString(), isDemo ? 1 : 0, id);
}

export function setJobDocuments(id: number, resumePath: string, coverLetterPath: string): void {
  db.prepare(
    "UPDATE jobs SET resume_path = ?, cover_letter_path = ?, status = 'prepared' WHERE id = ?",
  ).run(resumePath, coverLetterPath, id);
}

export function markJobApplied(id: number): void {
  db.prepare("UPDATE jobs SET status = 'applied', applied_date = ? WHERE id = ?").run(
    new Date().toISOString(),
    id,
  );
}

/**
 * Marks a posting as dismissed (decided not to pursue). Kept in the
 * database (not deleted) so it won't reappear if the same URL is scanned
 * again, but hidden from the default job list.
 *
 * A hard-delete variant was tried instead (a prior version of this file) and
 * reverted: deleting the row outright meant the exact-URL dedup in
 * insertJobIfNew() had nothing left to match against, so a dismissed job
 * would silently resurface as "new" on the very next scan of that company —
 * confirmed live (deleted a real posting, rescanned, the identical job came
 * back with a new ID). Soft-dismiss avoids that.
 */
export function dismissJob(id: number): void {
  const job = getJob(id);
  if (!job) return;
  db.prepare(
    "UPDATE jobs SET status = 'dismissed', previous_status = ?, dismissed_at = ? WHERE id = ?",
  ).run(job.status, new Date().toISOString(), id);
}

/**
 * Restores whichever job was dismissed most recently, putting its status
 * back to whatever it was right before deletion. Only one level of undo —
 * good enough for "oops, wrong button" recovery, not a full history.
 */
export function undoLastDismiss(): JobRow | undefined {
  const job = db
    .prepare(
      "SELECT * FROM jobs WHERE status = 'dismissed' AND dismissed_at IS NOT NULL ORDER BY dismissed_at DESC LIMIT 1",
    )
    .get() as JobRow | undefined;
  if (!job) return undefined;

  db.prepare(
    "UPDATE jobs SET status = ?, previous_status = NULL, dismissed_at = NULL WHERE id = ?",
  ).run(job.previous_status ?? "found", job.id);

  return getJob(job.id);
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
