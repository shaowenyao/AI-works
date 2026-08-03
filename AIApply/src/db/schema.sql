CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  description TEXT,
  date_found TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'found',
  resume_path TEXT,
  cover_letter_path TEXT,
  applied_date TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  location TEXT,
  is_remote INTEGER NOT NULL DEFAULT 0,
  is_local_sf INTEGER NOT NULL DEFAULT 0
);

-- Cached verdicts for companies not on the static auto-priority list. Checked
-- once by Claude (a quick web search on company size/legitimacy), then
-- applied automatically to every future posting from that company.
CREATE TABLE IF NOT EXISTS company_verdicts (
  company TEXT PRIMARY KEY COLLATE NOCASE,
  decent INTEGER NOT NULL,
  note TEXT,
  checked_at TEXT NOT NULL
);

-- Companies flagged as a scam/bad-actor via the "Flag company" button on
-- Applied Jobs. Every existing posting from that company is excluded
-- immediately, and insertJobIfNew() refuses to add any future ones.
CREATE TABLE IF NOT EXISTS blocked_companies (
  company TEXT PRIMARY KEY COLLATE NOCASE,
  blocked_at TEXT NOT NULL
);

-- The Job Settings panel's Job Title tab. A job whose title contains an
-- include term is shown even if isDesignTitle() would otherwise reject it;
-- a job whose title contains an exclude term is hidden even if it would
-- otherwise pass (manually_imported jobs still bypass both, same as every
-- other content filter).
CREATE TABLE IF NOT EXISTS title_include_terms (
  term TEXT PRIMARY KEY COLLATE NOCASE
);
CREATE TABLE IF NOT EXISTS title_exclude_terms (
  term TEXT PRIMARY KEY COLLATE NOCASE
);

-- The User Settings panel's "Job titles" pill list — roles the user is
-- personally targeting. Display/reference only for now, not wired into any
-- scan/filter logic (that's what the Job Settings title_include_terms are
-- for).
CREATE TABLE IF NOT EXISTS target_job_titles (
  term TEXT PRIMARY KEY COLLATE NOCASE
);
