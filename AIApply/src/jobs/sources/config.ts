/**
 * Companies to scan for new postings. Add entries here for the companies you're
 * interested in. `boardId` is the identifier from that company's public job
 * board URL (see the comment on each fetcher for how to find it).
 *
 * Set `priority: true` for companies where a tailored resume is obviously
 * worth the effort (e.g. Meta) — priority jobs sort to the top of the list
 * and are badged in the UI, so you can tell at a glance which "Generate
 * Resume" clicks are worth your time vs. some unknown small company.
 */
export interface WatchedCompany {
  name: string;
  boardId: string;
  priority?: boolean;
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
    { name: "Anthropic", boardId: "anthropic", priority: true },
    { name: "Disney", boardId: "disney", priority: true },
    { name: "Block", boardId: "block", priority: true },
    { name: "Figma", boardId: "figma", priority: true },
    { name: "Stripe", boardId: "stripe", priority: true },
    { name: "Airbnb", boardId: "airbnb", priority: true },
    { name: "Dropbox", boardId: "dropbox", priority: true },
    { name: "Robinhood", boardId: "robinhood", priority: true },
    { name: "Discord", boardId: "discord", priority: true },
    { name: "Asana", boardId: "asana", priority: true },
    { name: "Coinbase", boardId: "coinbase", priority: true },
    { name: "Affirm", boardId: "affirm", priority: true },
    { name: "Pinterest", boardId: "pinterest", priority: true },
    { name: "Twitch", boardId: "twitch", priority: true },
    { name: "Peloton", boardId: "peloton", priority: true },
    { name: "Nextdoor", boardId: "nextdoor", priority: true },
    { name: "Cloudflare", boardId: "cloudflare", priority: true },
    { name: "Databricks", boardId: "databricks", priority: true },
    { name: "GitLab", boardId: "gitlab", priority: true },
    { name: "Elastic", boardId: "elastic", priority: true },
    { name: "Reddit", boardId: "reddit", priority: true },
    { name: "Instacart", boardId: "instacart", priority: true },
    { name: "Squarespace", boardId: "squarespace", priority: true },
    { name: "Lyft", boardId: "lyft", priority: true },
    { name: "Twilio", boardId: "twilio", priority: true },
    { name: "Okta", boardId: "okta", priority: true },
    { name: "Datadog", boardId: "datadog", priority: true },
    { name: "Brex", boardId: "brex", priority: true },
    { name: "Webflow", boardId: "webflow", priority: true },
    { name: "Duolingo", boardId: "duolingo", priority: true },
    { name: "Roblox", boardId: "roblox", priority: true },
    { name: "Samsara", boardId: "samsara", priority: true },
    { name: "Toast", boardId: "toast", priority: true },
    { name: "Udemy", boardId: "udemy", priority: true },
    { name: "Calendly", boardId: "calendly", priority: true },
    { name: "Carta", boardId: "carta", priority: true },
    { name: "DoorDash", boardId: "doordashusa", priority: true },
    { name: "Gusto", boardId: "gusto", priority: true },

    // Added beyond the curated priority set, per user request, to broaden
    // coverage past the pre-vetted list above. Deliberately NOT marked
    // priority here — each gets a recorded legitimacy verdict instead (see
    // recordCompanyVerdict calls), which sets their priority flag while
    // keeping the "Legit company" checkbox visible so the user can still
    // confirm or override the call themselves.
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
    { name: "Netflix", boardId: "netflix", priority: true },
    { name: "Spotify", boardId: "spotify", priority: true },
    { name: "Ro", boardId: "ro", priority: true },
    { name: "Palantir", boardId: "palantir", priority: true },

    { name: "Wealthfront", boardId: "wealthfront" },
    { name: "Whoop", boardId: "whoop" },
  ] as WatchedCompany[],
  ashby: [
    { name: "OpenAI", boardId: "openai", priority: true },
    { name: "Ramp", boardId: "ramp", priority: true },
    { name: "Linear", boardId: "linear", priority: true },
    { name: "Vercel", boardId: "vercel", priority: true },
    { name: "Mercury", boardId: "mercury", priority: true },
    { name: "Deel", boardId: "deel", priority: true },
    { name: "Watershed", boardId: "watershed", priority: true },
    { name: "Modern Treasury", boardId: "moderntreasury", priority: true },
    { name: "Runway", boardId: "runway", priority: true },
    { name: "Render", boardId: "render", priority: true },
    { name: "PostHog", boardId: "posthog", priority: true },
    { name: "Replit", boardId: "replit", priority: true },
    { name: "Cursor", boardId: "cursor", priority: true },

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
