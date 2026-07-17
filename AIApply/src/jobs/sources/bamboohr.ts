import type { JobPosting } from "./types.js";

interface BambooHrJob {
  id: string | number;
  jobOpeningName: string;
  departmentLabel?: string;
  location?: { city?: string | null; state?: string | null };
  isRemote?: boolean | null;
}

interface BambooHrResponse {
  result: BambooHrJob[];
}

/**
 * Fetches all open postings for a company's BambooHR careers page via its
 * public JSON listing endpoint (no auth required). `subdomain` is the
 * identifier BambooHR uses in the company's careers URL, e.g. for
 * acme.bamboohr.com/careers, the subdomain is "acme".
 *
 * Confirmed against a live company board (elkgrove.bamboohr.com): `id`,
 * `jobOpeningName`, and `departmentLabel` are correct, but there is no flat
 * `locationLabel` field — location comes nested as `location: {city, state}`
 * (an earlier version of this file assumed a flat field and silently dropped
 * location from the description on every posting).
 */
export async function fetchBambooHrJobs(subdomain: string, companyName: string): Promise<JobPosting[]> {
  const url = `https://${subdomain}.bamboohr.com/careers/list`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`BambooHR fetch failed for company "${subdomain}" (${response.status})`);
  }

  const data = (await response.json()) as BambooHrResponse;

  return data.result.map((job) => {
    const locationLabel = [job.location?.city, job.location?.state].filter(Boolean).join(", ");
    return {
      company: companyName,
      title: job.jobOpeningName,
      url: `https://${subdomain}.bamboohr.com/careers/${job.id}`,
      source: "bamboohr" as const,
      description: [job.departmentLabel, locationLabel].filter(Boolean).join(" · ") || undefined,
      location: locationLabel || undefined,
      sourceRemoteFlag: job.isRemote === true,
    };
  });
}
