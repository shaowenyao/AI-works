import { pathToFileURL } from "node:url";
import { insertJobIfNew, getCompanyVerdict } from "../db/client.js";
import { fetchGreenhouseJobs } from "./sources/greenhouse.js";
import { fetchLeverJobs } from "./sources/lever.js";
import { fetchAshbyJobs } from "./sources/ashby.js";
import { fetchSmartRecruitersJobs } from "./sources/smartrecruiters.js";
import { fetchBambooHrJobs } from "./sources/bamboohr.js";
import { watchedCompanies, type WatchedCompany } from "./sources/config.js";
import { isKnownPriorityCompany } from "./priorityCompanies.js";
import type { JobPosting } from "./sources/types.js";

/**
 * Manual config flag, OR an automatically-recognized major company (MAANGA,
 * Fortune 50, etc), OR a cached verdict from a prior Claude legitimacy check
 * (see db/client.ts recordCompanyVerdict). Anything else stays unflagged and
 * shows up in listUncheckedCompanies() for a future check.
 */
function resolvePriority(companyName: string, manualPriority: boolean | undefined): boolean {
  if (manualPriority || isKnownPriorityCompany(companyName)) return true;
  const verdict = getCompanyVerdict(companyName);
  return verdict ? Boolean(verdict.decent) : false;
}

interface SourceDefinition {
  label: string;
  entries: WatchedCompany[];
  fetch: (boardId: string, companyName: string) => Promise<JobPosting[]>;
}

/**
 * Fetches one company's board. If it fails, the board is silently skipped —
 * its jobs just don't show up in the dashboard this run. No retry, no
 * error surfaced to the user; try scanning again later if it matters.
 */
async function fetchSilently(
  source: SourceDefinition,
  boardId: string,
  companyName: string,
): Promise<JobPosting[]> {
  try {
    return await source.fetch(boardId, companyName);
  } catch (err) {
    console.error(`Skipping ${source.label} board "${boardId}" (${companyName}): ${(err as Error).message}`);
    return [];
  }
}

export async function scanJobs(): Promise<{ found: number; new: number }> {
  const results: JobPosting[] = [];

  const sources: SourceDefinition[] = [
    { label: "Greenhouse", entries: watchedCompanies.greenhouse, fetch: fetchGreenhouseJobs },
    { label: "Lever", entries: watchedCompanies.lever, fetch: fetchLeverJobs },
    { label: "Ashby", entries: watchedCompanies.ashby, fetch: fetchAshbyJobs },
    { label: "SmartRecruiters", entries: watchedCompanies.smartrecruiters, fetch: fetchSmartRecruitersJobs },
    { label: "BambooHR", entries: watchedCompanies.bamboohr, fetch: fetchBambooHrJobs },
  ];

  for (const source of sources) {
    for (const { name, boardId, priority } of source.entries) {
      const jobs = await fetchSilently(source, boardId, name);
      results.push(...jobs.map((job) => ({ ...job, priority: resolvePriority(name, priority) })));
    }
  }

  let newCount = 0;
  for (const job of results) {
    if (insertJobIfNew(job)) newCount++;
  }

  return { found: results.length, new: newCount };
}

async function main() {
  const totalWatched =
    watchedCompanies.greenhouse.length +
    watchedCompanies.lever.length +
    watchedCompanies.ashby.length +
    watchedCompanies.smartrecruiters.length +
    watchedCompanies.bamboohr.length;

  if (totalWatched === 0) {
    console.log(
      "No companies configured yet. Edit src/jobs/sources/config.ts to add companies to watch.",
    );
    return;
  }

  console.log(`Scanning ${totalWatched} configured job board(s)...`);
  const { found, new: newCount } = await scanJobs();
  console.log(`Found ${found} postings, ${newCount} new.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("Job scan failed:", err.message);
    process.exit(1);
  });
}
