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
