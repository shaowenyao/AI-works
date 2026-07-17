import type { JobPosting } from "./types.js";

interface GreenhouseJob {
  title: string;
  absolute_url: string;
  content?: string;
  location?: { name?: string };
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[];
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fetches all open postings for a company's Greenhouse job board.
 * `boardToken` is the identifier Greenhouse uses in the board's public URL,
 * e.g. for boards.greenhouse.io/acme, the token is "acme".
 */
export async function fetchGreenhouseJobs(boardToken: string, companyName: string): Promise<JobPosting[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Greenhouse fetch failed for board "${boardToken}" (${response.status})`);
  }

  const data = (await response.json()) as GreenhouseResponse;

  return data.jobs.map((job) => ({
    company: companyName,
    title: job.title,
    url: job.absolute_url,
    source: "greenhouse" as const,
    description: job.content ? stripHtml(job.content) : undefined,
    location: job.location?.name,
  }));
}
