/**
 * Companies to scan for new postings. Add entries here for the companies you're
 * interested in. `boardId` is the identifier from that company's public job
 * board URL (see the comment on each fetcher for how to find it).
 *
 * Which of these are "priority" (tailored-resume-worthy, badged and sorted
 * to the top) is managed entirely from the Job Settings panel's "Companies
 * to add" list now, not here — see company_verdicts in db/client.ts.
 */
export interface WatchedCompany {
  name: string;
  boardId: string;
}

// The ~50 companies below were requested as "top tech companies from
// Glassdoor" — but Glassdoor's actual current Tech & AI list only has ~25
// honorees, most of which (NVIDIA, ServiceNow, EPAM, Google, Bloomberg,
// Motorola Solutions, etc.) run proprietary/Workday-style career sites this
// app can't scan at all, since it only supports these 5 ATS platforms. This
// list is a substitute: well-known tech companies chosen instead because
// they're confirmed (via a live check against each API, not guessed) to
// actually run a public board on one of the 5 supported platforms.
export const watchedCompanies = {
  greenhouse: [
    // Real hits from MAANGA/Fortune-500 (checked live, not guessed) — most of
    // that list (Meta, Amazon, Apple, Google, Microsoft, NVIDIA, Tesla, etc.)
    // 404s on every platform below since they run proprietary/Workday-style
    // career sites this app can't reach at all. These are the exceptions.
    { name: "Anthropic", boardId: "anthropic" },
    { name: "Disney", boardId: "disney" },
    { name: "Block", boardId: "block" },
    { name: "Figma", boardId: "figma" },
    { name: "Stripe", boardId: "stripe" },
    { name: "Airbnb", boardId: "airbnb" },
    { name: "Dropbox", boardId: "dropbox" },
    { name: "Robinhood", boardId: "robinhood" },
    { name: "Discord", boardId: "discord" },
    { name: "Asana", boardId: "asana" },
    { name: "Coinbase", boardId: "coinbase" },
    { name: "Affirm", boardId: "affirm" },
    { name: "Pinterest", boardId: "pinterest" },
    { name: "Twitch", boardId: "twitch" },
    { name: "Peloton", boardId: "peloton" },
    { name: "Nextdoor", boardId: "nextdoor" },
    { name: "Cloudflare", boardId: "cloudflare" },
    { name: "Databricks", boardId: "databricks" },
    { name: "GitLab", boardId: "gitlab" },
    { name: "Elastic", boardId: "elastic" },
    { name: "Reddit", boardId: "reddit" },
    { name: "Instacart", boardId: "instacart" },
    { name: "Squarespace", boardId: "squarespace" },
    { name: "Lyft", boardId: "lyft" },
    { name: "Twilio", boardId: "twilio" },
    { name: "Okta", boardId: "okta" },
    { name: "Datadog", boardId: "datadog" },
    { name: "Brex", boardId: "brex" },
    { name: "Webflow", boardId: "webflow" },
    { name: "Duolingo", boardId: "duolingo" },
    { name: "Roblox", boardId: "roblox" },
    { name: "Samsara", boardId: "samsara" },
    { name: "Toast", boardId: "toast" },
    { name: "Udemy", boardId: "udemy" },
    { name: "Calendly", boardId: "calendly" },
    { name: "Carta", boardId: "carta" },
    { name: "DoorDash", boardId: "doordashusa" },
    { name: "Gusto", boardId: "gusto" },

    // Added beyond the original curated set, per user request, to broaden
    // coverage past the list above.
    { name: "Airtable", boardId: "airtable" },
    { name: "Intercom", boardId: "intercom" },
    { name: "Typeform", boardId: "typeform" },
    { name: "Amplitude", boardId: "amplitude" },
    { name: "SoFi", boardId: "sofi" },
    { name: "Faire", boardId: "faire" },
    { name: "Calm", boardId: "calm" },
    { name: "Coursera", boardId: "coursera" },
    { name: "Gemini", boardId: "gemini" },
  ] as WatchedCompany[],
  lever: [
    { name: "Netflix", boardId: "netflix" },
    { name: "Spotify", boardId: "spotify" },
    { name: "Ro", boardId: "ro" },
    { name: "Palantir", boardId: "palantir" },

    { name: "Wealthfront", boardId: "wealthfront" },
    { name: "Whoop", boardId: "whoop" },
  ] as WatchedCompany[],
  ashby: [
    { name: "OpenAI", boardId: "openai" },
    { name: "Ramp", boardId: "ramp" },
    { name: "Linear", boardId: "linear" },
    { name: "Vercel", boardId: "vercel" },
    { name: "Mercury", boardId: "mercury" },
    { name: "Deel", boardId: "deel" },
    { name: "Watershed", boardId: "watershed" },
    { name: "Modern Treasury", boardId: "moderntreasury" },
    { name: "Runway", boardId: "runway" },
    { name: "Render", boardId: "render" },
    { name: "PostHog", boardId: "posthog" },
    { name: "Replit", boardId: "replit" },
    { name: "Cursor", boardId: "cursor" },

    { name: "Notion", boardId: "notion" },
    { name: "Miro", boardId: "miro" },
    { name: "Amplitude", boardId: "amplitude" },
    { name: "Whoop", boardId: "whoop" },
    { name: "Handshake", boardId: "handshake" },
    { name: "Circle", boardId: "circle" },
    { name: "OpenSea", boardId: "opensea" },
    { name: "Perplexity", boardId: "perplexity" },
    { name: "Suno", boardId: "suno" },
    { name: "Harvey", boardId: "harvey" },
    { name: "Sierra", boardId: "sierra" },
  ] as WatchedCompany[],
  smartrecruiters: [
    // { name: "Acme Corp", boardId: "acme" },
  ] as WatchedCompany[],
  bamboohr: [
    // { name: "Acme Corp", boardId: "acme" },
  ] as WatchedCompany[],
};
