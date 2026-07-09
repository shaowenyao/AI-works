import type { JobPosting } from "./types.js";

interface LeverPosting {
  text: string;
  hostedUrl: string;
  descriptionPlain?: string;
}

/**
 * Fetches all open postings for a company's Lever job board.
 * `company` is the identifier Lever uses in the board's public URL,
 * e.g. for jobs.lever.co/acme, the identifier is "acme".
 */
export async function fetchLeverJobs(company: string, companyName: string): Promise<JobPosting[]> {
  const url = `https://api.lever.co/v0/postings/${company}?mode=json`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Lever fetch failed for company "${company}" (${response.status})`);
  }

  const postings = (await response.json()) as LeverPosting[];

  return postings.map((posting) => ({
    company: companyName,
    title: posting.text,
    url: posting.hostedUrl,
    source: "lever" as const,
    description: posting.descriptionPlain,
  }));
}
