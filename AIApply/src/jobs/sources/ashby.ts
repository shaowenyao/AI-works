import type { JobPosting } from "./types.js";

interface AshbyJob {
  title: string;
  jobUrl?: string;
  applyUrl?: string;
  descriptionPlain?: string;
}

interface AshbyResponse {
  jobs: AshbyJob[];
}

/**
 * Fetches all open postings for a company's Ashby job board.
 * `boardName` is the identifier Ashby uses in the board's public URL,
 * e.g. for jobs.ashbyhq.com/acme, the identifier is "acme".
 */
export async function fetchAshbyJobs(boardName: string, companyName: string): Promise<JobPosting[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${boardName}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Ashby fetch failed for board "${boardName}" (${response.status})`);
  }

  const data = (await response.json()) as AshbyResponse;

  return data.jobs
    .filter((job) => job.jobUrl ?? job.applyUrl)
    .map((job) => ({
      company: companyName,
      title: job.title,
      url: (job.jobUrl ?? job.applyUrl)!,
      source: "ashby" as const,
      description: job.descriptionPlain,
    }));
}
