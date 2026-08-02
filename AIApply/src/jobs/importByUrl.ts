import type { JobPosting } from "./sources/types.js";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Imports a single job posting directly from its URL — the "Add job" ->
 * paste-a-URL flow. Only Greenhouse and Lever are supported: those are the
 * only two of the five scan sources with a public API for fetching one
 * posting by its own URL rather than a whole company board (Ashby/
 * SmartRecruiters/BambooHR don't expose that cleanly). LinkedIn is
 * explicitly rejected up front since it has no public API this can use at
 * all — pasting a LinkedIn link would otherwise just fail confusingly deep
 * in a fetch call.
 */
export async function importJobFromUrl(rawUrl: string): Promise<JobPosting> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }

  if (parsed.hostname.includes("linkedin.com")) {
    throw new Error("LinkedIn postings aren't supported — paste the Greenhouse, Lever, etc. listing directly instead.");
  }

  if (parsed.hostname === "boards.greenhouse.io" || parsed.hostname === "job-boards.greenhouse.io") {
    return importFromGreenhouse(parsed);
  }
  if (parsed.hostname === "jobs.lever.co") {
    return importFromLever(parsed);
  }

  throw new Error(
    "Unsupported job board — this only works with a direct Greenhouse (boards.greenhouse.io) or Lever (jobs.lever.co) posting URL right now.",
  );
}

async function importFromGreenhouse(parsed: URL): Promise<JobPosting> {
  // e.g. https://boards.greenhouse.io/acme/jobs/1234567
  const match = parsed.pathname.match(/^\/([^/]+)\/jobs\/(\d+)/);
  if (!match) throw new Error("Couldn't find a job ID in that Greenhouse URL — make sure it's a link to a specific posting.");
  const [, boardToken, jobId] = match;

  const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs/${jobId}?content=true`);
  if (!response.ok) {
    throw new Error(`Greenhouse lookup failed (${response.status}) — check the URL points to a real, still-open posting.`);
  }

  const job = (await response.json()) as {
    title: string;
    absolute_url: string;
    content?: string;
    location?: { name?: string };
    company_name?: string;
  };

  return {
    company: job.company_name ?? boardToken,
    title: job.title,
    url: job.absolute_url,
    source: "greenhouse",
    description: job.content ? stripHtml(job.content) : undefined,
    location: job.location?.name,
  };
}

async function importFromLever(parsed: URL): Promise<JobPosting> {
  // e.g. https://jobs.lever.co/acme/<posting-id>
  const [company, postingId] = parsed.pathname.split("/").filter(Boolean);
  if (!company || !postingId) {
    throw new Error("Couldn't find a posting ID in that Lever URL — make sure it's a link to a specific posting.");
  }

  const response = await fetch(`https://api.lever.co/v0/postings/${company}/${postingId}?mode=json`);
  if (!response.ok) {
    throw new Error(`Lever lookup failed (${response.status}) — check the URL points to a real, still-open posting.`);
  }

  const posting = (await response.json()) as {
    text: string;
    hostedUrl: string;
    descriptionPlain?: string;
    categories?: { location?: string };
    workplaceType?: string;
  };

  return {
    company,
    title: posting.text,
    url: posting.hostedUrl,
    source: "lever",
    description: posting.descriptionPlain,
    location: posting.categories?.location,
    sourceRemoteFlag: posting.workplaceType === "remote",
  };
}
