import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
}

/** Inserts a job if its URL isn't already known. Returns true if a new row was inserted. */
export function insertJobIfNew(job: NewJob): boolean {
  const existing = db.prepare("SELECT id FROM jobs WHERE url = ?").get(job.url);
  if (existing) return false;

  db.prepare(
    `INSERT INTO jobs (company, title, url, source, description, date_found, status, priority)
     VALUES (?, ?, ?, ?, ?, ?, 'found', ?)`,
  ).run(
    job.company,
    job.title,
    job.url,
    job.source,
    job.description ?? null,
    new Date().toISOString(),
    job.priority ? 1 : 0,
  );

  return true;
}

const DUMMY_COMPANIES = ["Northwind Robotics", "Fernbank Health", "Vector Analytics", "Bluepeak Systems"];
const DUMMY_TITLES = ["Senior Product Designer", "Growth Marketing Lead", "Software Engineer", "Operations Manager"];

/**
 * Inserts a fake, unverified (priority=0) job for exercising the UI without
 * a real scan — e.g. testing the "Legit company" checkbox flow.
 */
export function insertDummyJob(): JobRow {
  const company = DUMMY_COMPANIES[Math.floor(Math.random() * DUMMY_COMPANIES.length)];
  const title = DUMMY_TITLES[Math.floor(Math.random() * DUMMY_TITLES.length)];
  const url = `https://example.com/dummy-job/${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  insertJobIfNew({
    company,
    title,
    url,
    source: "greenhouse",
    description: "Dummy job posting for testing the UI — not a real listing.",
  });

  return db.prepare("SELECT * FROM jobs WHERE url = ?").get(url) as unknown as JobRow;
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

/** Flags a job as waiting for you to ask Claude to generate its tailored documents. */
export function markJobRequested(id: number): void {
  db.prepare("UPDATE jobs SET status = 'requested' WHERE id = ?").run(id);
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
