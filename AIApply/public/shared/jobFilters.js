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

// A typed 5-digit ZIP code can't be substring-matched against job.location
// directly — scraped postings say "San Francisco, CA", never a ZIP — so a
// ZIP has to resolve to a metro group first, the same way a metro-area label
// does. Keyed by the first 3 digits of the ZIP (the standard US "ZIP3"
// prefix), same approximation philosophy as METRO_AREA_ALIASES: not real
// geocoding, just enough coverage for the metros already listed above.
const ZIP3_METRO_GROUP = {
  // San Francisco Bay Area
  940: "san francisco bay area",
  941: "san francisco bay area",
  943: "san francisco bay area",
  944: "san francisco bay area",
  945: "san francisco bay area",
  946: "san francisco bay area",
  947: "san francisco bay area",
  948: "san francisco bay area",
  950: "san francisco bay area",
  951: "san francisco bay area",
  // Greater New York City Area
  100: "greater new york city area",
  101: "greater new york city area",
  102: "greater new york city area",
  103: "greater new york city area",
  104: "greater new york city area",
  110: "greater new york city area",
  111: "greater new york city area",
  112: "greater new york city area",
  113: "greater new york city area",
  114: "greater new york city area",
  // Greater Los Angeles Area
  900: "greater los angeles area",
  901: "greater los angeles area",
  902: "greater los angeles area",
  903: "greater los angeles area",
  904: "greater los angeles area",
  905: "greater los angeles area",
  906: "greater los angeles area",
  907: "greater los angeles area",
  908: "greater los angeles area",
  910: "greater los angeles area",
  911: "greater los angeles area",
  912: "greater los angeles area",
  913: "greater los angeles area",
  914: "greater los angeles area",
  915: "greater los angeles area",
  916: "greater los angeles area",
  917: "greater los angeles area",
  918: "greater los angeles area",
  // Greater Chicago Area
  606: "greater chicago area",
  607: "greater chicago area",
  608: "greater chicago area",
  // Greater Boston Area
  21: "greater boston area",
  22: "greater boston area",
  24: "greater boston area",
  // Washington DC-Baltimore Area
  200: "washington dc-baltimore area",
  201: "washington dc-baltimore area",
  202: "washington dc-baltimore area",
  203: "washington dc-baltimore area",
  204: "washington dc-baltimore area",
  205: "washington dc-baltimore area",
  206: "washington dc-baltimore area",
  207: "washington dc-baltimore area",
  208: "washington dc-baltimore area",
  209: "washington dc-baltimore area",
  210: "washington dc-baltimore area",
  211: "washington dc-baltimore area",
  212: "washington dc-baltimore area",
  // Greater Seattle Area
  980: "greater seattle area",
  981: "greater seattle area",
  // Dallas-Fort Worth Metroplex
  750: "dallas-fort worth metroplex",
  751: "dallas-fort worth metroplex",
  752: "dallas-fort worth metroplex",
  753: "dallas-fort worth metroplex",
  760: "dallas-fort worth metroplex",
  761: "dallas-fort worth metroplex",
  762: "dallas-fort worth metroplex",
  // Greater Houston Area
  770: "greater houston area",
  771: "greater houston area",
  772: "greater houston area",
  // Greater Atlanta Area
  300: "greater atlanta area",
  301: "greater atlanta area",
  302: "greater atlanta area",
  303: "greater atlanta area",
  311: "greater atlanta area",
  // Miami-Fort Lauderdale Area
  331: "miami-fort lauderdale area",
  332: "miami-fort lauderdale area",
  333: "miami-fort lauderdale area",
  334: "miami-fort lauderdale area",
  // Greater Philadelphia Area
  190: "greater philadelphia area",
  191: "greater philadelphia area",
  // Phoenix Metropolitan Area
  850: "phoenix metropolitan area",
  851: "phoenix metropolitan area",
  852: "phoenix metropolitan area",
  853: "phoenix metropolitan area",
  // Denver Metropolitan Area
  800: "denver metropolitan area",
  801: "denver metropolitan area",
  802: "denver metropolitan area",
  // Austin Metropolitan Area
  733: "austin metropolitan area",
  787: "austin metropolitan area",
  // San Diego Metropolitan Area
  919: "san diego metropolitan area",
  920: "san diego metropolitan area",
  921: "san diego metropolitan area",
  // Portland Metropolitan Area
  972: "portland metropolitan area",
  // Minneapolis-Saint Paul Area
  553: "minneapolis-saint paul area",
  554: "minneapolis-saint paul area",
  555: "minneapolis-saint paul area",
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
// filter is calling this (already lowercased/trimmed by the caller). The
// "Location" fields accept either a city name or a 5-digit US ZIP code — a
// ZIP resolves to its metro group via ZIP3_METRO_GROUP before matching,
// since job.location never contains a ZIP to substring-match against.
export function matchesCityFilter(location, city, radiusMiles) {
  if (!city) return true;
  const lowerLocation = (location ?? "").toLowerCase();
  if (/^\d{5}$/.test(city)) {
    const metroKey = ZIP3_METRO_GROUP[Number(city.slice(0, 3))];
    if (!metroKey) return false;
    return METRO_AREA_ALIASES[metroKey].some((alias) => lowerLocation.includes(alias));
  }
  const directAliases = METRO_AREA_ALIASES[city];
  if (directAliases) return directAliases.some((alias) => lowerLocation.includes(alias));
  if (radiusMiles > 0) {
    const group = findMetroGroupFor(city);
    if (group) return group.some((alias) => lowerLocation.includes(alias));
  }
  return lowerLocation.includes(city);
}
