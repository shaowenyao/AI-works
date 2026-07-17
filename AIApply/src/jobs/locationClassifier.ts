import type { JobPosting } from "./sources/types.js";

const SF_LAT = 37.7749;
const SF_LNG = -122.4194;
const RADIUS_MILES = 25;

// City/area names within roughly 25 miles of San Francisco, for sources that
// only give a free-text location (no coordinates). Matched as a substring,
// case-insensitively, against the posting's location text.
const BAY_AREA_LOCATIONS = [
  "san francisco",
  "oakland",
  "berkeley",
  "daly city",
  "south san francisco",
  "san bruno",
  "millbrae",
  "burlingame",
  "san mateo",
  "redwood city",
  "belmont",
  "san carlos",
  "foster city",
  "emeryville",
  "alameda",
  "richmond",
  "el cerrito",
  "albany",
  "sausalito",
  "mill valley",
  "corte madera",
  "larkspur",
  "tiburon",
  "pacifica",
  "brisbane",
  "colma",
  "san leandro",
  "piedmont",
  "menlo park",
  "sf bay area",
  "bay area",
];

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

/** True if the job is confirmed remote — from an explicit source flag, or the word "remote" appearing in the location or description. */
export function isRemoteConfirmed(job: Pick<JobPosting, "location" | "description" | "sourceRemoteFlag">): boolean {
  if (job.sourceRemoteFlag) return true;
  const text = `${job.location ?? ""} ${job.description ?? ""}`.toLowerCase();
  return text.includes("remote");
}

/** True if the job's location is within ~25 miles of San Francisco — exact distance when coordinates are available, otherwise a known-city-name fallback. */
export function isLocalToSf(job: Pick<JobPosting, "location" | "lat" | "lng">): boolean {
  if (typeof job.lat === "number" && typeof job.lng === "number") {
    return haversineMiles(SF_LAT, SF_LNG, job.lat, job.lng) <= RADIUS_MILES;
  }
  const location = (job.location ?? "").toLowerCase();
  return BAY_AREA_LOCATIONS.some((city) => location.includes(city));
}
