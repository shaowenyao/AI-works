import type { JobPosting } from "./types.js";

interface SmartRecruitersPosting {
  id: string;
  name: string;
  company: { identifier: string };
  location?: {
    city?: string;
    region?: string;
    country?: string;
    remote?: boolean;
    fullLocation?: string;
    latitude?: string;
    longitude?: string;
  };
}

interface SmartRecruitersResponse {
  totalFound: number;
  content: SmartRecruitersPosting[];
}

/**
 * Fetches all open postings for a company's SmartRecruiters job board via the
 * public Posting API (no auth required for public postings). `company` is the
 * identifier SmartRecruiters uses in the API path, e.g. for
 * api.smartrecruiters.com/v1/companies/acme/postings, the identifier is "acme".
 *
 * The list endpoint has no `postingUrl`/`applyUrl` field (an earlier version
 * of this file assumed one and produced empty URLs for every posting) — the
 * public job page is only constructable from `company.identifier` + `id` as
 * jobs.smartrecruiters.com/{identifier}/{id}, confirmed against a live Visa
 * posting.
 *
 * NOTE: the list endpoint doesn't return full job descriptions in one call —
 * that requires a second request per posting to
 * /v1/companies/{company}/postings/{id}. Left out for now to keep this at
 * parity with a single request per scan, same tradeoff as not enriching every
 * posting with a detail fetch.
 */
export async function fetchSmartRecruitersJobs(
  company: string,
  companyName: string,
): Promise<JobPosting[]> {
  const url = `https://api.smartrecruiters.com/v1/companies/${company}/postings`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`SmartRecruiters fetch failed for company "${company}" (${response.status})`);
  }

  const data = (await response.json()) as SmartRecruitersResponse;

  return data.content.map((posting) => {
    const lat = Number(posting.location?.latitude);
    const lng = Number(posting.location?.longitude);
    return {
      company: companyName,
      title: posting.name,
      url: `https://jobs.smartrecruiters.com/${posting.company.identifier}/${posting.id}`,
      source: "smartrecruiters" as const,
      location: posting.location?.fullLocation,
      sourceRemoteFlag: posting.location?.remote === true,
      lat: Number.isFinite(lat) ? lat : undefined,
      lng: Number.isFinite(lng) ? lng : undefined,
    };
  });
}
