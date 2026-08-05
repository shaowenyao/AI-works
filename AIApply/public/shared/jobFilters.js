// Shared between the browser (public/app.js) and the server
// (src/routes/jobs.ts) so the design-role rule only lives in one place.
// Plain ES module, no build step — Node imports it directly via a relative
// path, and the browser loads app.js as type="module" so it can too.

// Narrows the (potentially huge) scanned job list down to design roles only.
// Broader than a plain "designer" match (catches "Product Design Manager",
// "Design Lead", etc.) but excludes "engineer"/"recruiter"/"sourcer" titles
// that mention design without being a design role (Design Engineer,
// mechanical design roles, design recruiters, design sourcers), "model
// designer" (AI model-behavior design, not product/UX design), and a few
// titles explicitly opted out of: "lead product" (design), "vectorworks
// designer", "head of design".
export function isDesignTitle(job) {
  const title = job.title.toLowerCase();
  return (
    title.includes("design") &&
    !title.includes("engineer") &&
    !title.includes("recruiter") &&
    !title.includes("sourcer") &&
    !title.includes("model designer") &&
    !title.includes("manager") &&
    !title.includes("director") &&
    !title.includes("content designer") &&
    !title.includes("industrial designer") &&
    !title.includes("bim designer") &&
    !title.includes("lead product") &&
    !title.includes("vectorworks designer") &&
    !title.includes("head of design")
  );
}

// Job postings almost never literally say "San Francisco Bay Area" in their
// location text — they say "San Francisco, CA" or "Oakland, CA" or "Palo
// Alto". A plain substring match against a LinkedIn-style metro-area label
// would silently match nothing, so each grouped area here expands to the
// city names that actually show up in scraped location text. Anything typed
// that isn't a recognized metro label (e.g. a specific city typed by hand)
// just falls back to a plain substring match in matchesCityFilter below.
// Used by both the New Jobs City/radius filter (client-only) and the User
// Settings scan location (server-enforced, see GET /api/jobs) — one copy
// so the two can't quietly drift apart.
export const METRO_AREA_ALIASES = {
  "san francisco bay area": ["san francisco", "oakland", "san jose", "berkeley", "palo alto", "mountain view", "sunnyvale", "fremont", "bay area"],
  "greater new york city area": ["new york", "brooklyn", "queens", "jersey city", "manhattan", "nyc"],
  "greater los angeles area": ["los angeles", "santa monica", "pasadena", "long beach", "burbank"],
  "greater chicago area": ["chicago", "evanston", "naperville"],
  "greater boston area": ["boston", "cambridge", "somerville"],
  "washington dc-baltimore area": ["washington", "baltimore", "arlington", "alexandria"],
  "greater seattle area": ["seattle", "bellevue", "redmond", "tacoma"],
  "dallas-fort worth metroplex": ["dallas", "fort worth", "plano", "irving"],
  "greater houston area": ["houston", "sugar land", "the woodlands"],
  "greater atlanta area": ["atlanta", "sandy springs", "alpharetta"],
  "miami-fort lauderdale area": ["miami", "fort lauderdale", "boca raton"],
  "greater philadelphia area": ["philadelphia", "camden"],
  "phoenix metropolitan area": ["phoenix", "scottsdale", "tempe", "mesa"],
  "denver metropolitan area": ["denver", "boulder", "aurora"],
  "austin metropolitan area": ["austin", "round rock"],
  "san diego metropolitan area": ["san diego", "carlsbad"],
  "portland metropolitan area": ["portland"],
  "minneapolis-saint paul area": ["minneapolis", "saint paul", "st. paul"],
  "greater london area": ["london", "uk"],
  "toronto metropolitan area": ["toronto", "ontario"],
  "vancouver metropolitan area": ["vancouver", "british columbia"],
  "paris metropolitan area": ["paris", "france"],
  "berlin metropolitan area": ["berlin", "germany"],
  "greater tokyo area": ["tokyo", "japan"],
  "singapore": ["singapore"],
  "bengaluru area": ["bengaluru", "bangalore", "india"],
  "sydney metropolitan area": ["sydney", "australia"],
};

// Finds whichever metro group a plain typed city (e.g. "oakland, ca")
// belongs to, so a radius setting can widen the search to that group's
// other cities — there's no real geocoding here (see matchesCityFilter),
// this is purely "is this city one of the ones we already know are part of
// a bigger metro area".
export function findMetroGroupFor(city) {
  for (const aliases of Object.values(METRO_AREA_ALIASES)) {
    if (aliases.some((alias) => alias.includes(city) || city.includes(alias))) return aliases;
  }
  return null;
}

// radiusMiles is an approximation, not real distance math (no lat/lng is
// stored per job today) — "Exact match" (0) only ever does a plain
// substring/metro-label match. Any radius >0 additionally widens a plain
// city (not already a recognized metro label) out to its whole metro group
// via findMetroGroupFor, e.g. typing "Oakland, CA" with "Within 25 mi"
// selected also matches San Francisco, San Jose, etc. The radius tiers
// aren't currently differentiated (no data to differentiate them by) — all
// non-zero values behave the same for now. `location` is the job's raw
// location string (job.location); city/radiusMiles come from whichever
// filter is calling this (already lowercased/trimmed by the caller).
export function matchesCityFilter(location, city, radiusMiles) {
  if (!city) return true;
  const lowerLocation = (location ?? "").toLowerCase();
  const directAliases = METRO_AREA_ALIASES[city];
  if (directAliases) return directAliases.some((alias) => lowerLocation.includes(alias));
  if (radiusMiles > 0) {
    const group = findMetroGroupFor(city);
    if (group) return group.some((alias) => lowerLocation.includes(alias));
  }
  return lowerLocation.includes(city);
}
