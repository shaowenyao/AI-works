import type { JobPosting } from "./sources/types.js";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Imports a single job posting directly from its URL — the "Add job" ->
 * paste-a-URL flow. Covers all five scan sources: Greenhouse, Lever,
 * SmartRecruiters, and BambooHR all have a real single-posting API endpoint;
 * Ashby doesn't, so importFromAshby fetches the whole board and picks out
 * the one matching job ID instead (its list endpoint already includes full
 * descriptions, so that's still just one request). LinkedIn is explicitly
 * rejected up front since it has no public API this can use at all —
 * pasting a LinkedIn link would otherwise just fail confusingly deep in a
 * fetch call.
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
  if (parsed.hostname === "jobs.smartrecruiters.com") {
    return importFromSmartRecruiters(parsed);
  }
  if (parsed.hostname === "jobs.ashbyhq.com") {
    return importFromAshby(parsed);
  }
  if (parsed.hostname.endsWith(".bamboohr.com")) {
    return importFromBambooHr(parsed);
  }

  throw new Error(
    "Unsupported job board — this only works with a direct Greenhouse, Lever, SmartRecruiters, Ashby, or BambooHR posting URL right now.",
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

async function importFromSmartRecruiters(parsed: URL): Promise<JobPosting> {
  // e.g. https://jobs.smartrecruiters.com/acme/744000133907678-job-title
  const [company, idSegment] = parsed.pathname.split("/").filter(Boolean);
  const idMatch = idSegment?.match(/^(\d+)/);
  if (!company || !idMatch) {
    throw new Error("Couldn't find a posting ID in that SmartRecruiters URL — make sure it's a link to a specific posting.");
  }
  const postingId = idMatch[1];

  const response = await fetch(`https://api.smartrecruiters.com/v1/companies/${company}/postings/${postingId}`);
  if (!response.ok) {
    throw new Error(`SmartRecruiters lookup failed (${response.status}) — check the URL points to a real, still-open posting.`);
  }

  const posting = (await response.json()) as {
    name: string;
    company?: { name?: string };
    postingUrl: string;
    location?: {
      fullLocation?: string;
      remote?: boolean;
      latitude?: string;
      longitude?: string;
    };
    jobAd?: {
      sections?: Record<string, { text?: string }>;
    };
  };

  const description = Object.values(posting.jobAd?.sections ?? {})
    .map((section) => section.text)
    .filter(Boolean)
    .join("\n\n");
  const lat = Number(posting.location?.latitude);
  const lng = Number(posting.location?.longitude);

  return {
    company: posting.company?.name ?? company,
    title: posting.name,
    url: posting.postingUrl,
    source: "smartrecruiters",
    description: description ? stripHtml(description) : undefined,
    location: posting.location?.fullLocation,
    sourceRemoteFlag: posting.location?.remote === true,
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
  };
}

async function importFromAshby(parsed: URL): Promise<JobPosting> {
  // e.g. https://jobs.ashbyhq.com/acme/<job-uuid>. Ashby has no per-job
  // lookup endpoint, only the whole-board list — but that list already
  // includes each job's full description, so fetching it once and picking
  // out the matching id is still just one request.
  const [company, jobId] = parsed.pathname.split("/").filter(Boolean);
  if (!company || !jobId) {
    throw new Error("Couldn't find a posting ID in that Ashby URL — make sure it's a link to a specific posting.");
  }

  const response = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${company}`);
  if (!response.ok) {
    throw new Error(`Ashby fetch failed for board "${company}" (${response.status}) — check the company part of the URL.`);
  }

  const data = (await response.json()) as {
    jobs: Array<{
      id: string;
      title: string;
      jobUrl?: string;
      applyUrl?: string;
      descriptionPlain?: string;
      location?: string;
      isRemote?: boolean;
    }>;
  };
  const job = data.jobs.find((j) => j.id === jobId);
  if (!job) {
    throw new Error("That posting wasn't found on this company's Ashby board — it may have closed.");
  }

  return {
    company,
    title: job.title,
    url: (job.jobUrl ?? job.applyUrl)!,
    source: "ashby",
    description: job.descriptionPlain,
    location: job.location,
    sourceRemoteFlag: job.isRemote === true,
  };
}

async function importFromBambooHr(parsed: URL): Promise<JobPosting> {
  // e.g. https://acme.bamboohr.com/careers/64
  const subdomain = parsed.hostname.split(".")[0];
  const jobId = parsed.pathname.split("/").filter(Boolean).pop();
  if (!subdomain || !jobId || !/^\d+$/.test(jobId)) {
    throw new Error("Couldn't find a posting ID in that BambooHR URL — make sure it's a link to a specific posting.");
  }

  const response = await fetch(`https://${subdomain}.bamboohr.com/careers/${jobId}/detail`);
  if (!response.ok) {
    throw new Error(`BambooHR lookup failed (${response.status}) — check the URL points to a real, still-open posting.`);
  }

  const data = (await response.json()) as {
    result?: {
      jobOpening?: {
        jobOpeningName: string;
        jobOpeningShareUrl: string;
        description?: string;
        location?: { city?: string; state?: string };
      };
    };
  };
  const job = data.result?.jobOpening;
  if (!job) {
    throw new Error("That posting wasn't found — it may have closed.");
  }

  return {
    company: subdomain,
    title: job.jobOpeningName,
    url: job.jobOpeningShareUrl,
    source: "bamboohr",
    description: job.description ? stripHtml(job.description) : undefined,
    location: [job.location?.city, job.location?.state].filter(Boolean).join(", ") || undefined,
  };
}
