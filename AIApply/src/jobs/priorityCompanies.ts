/**
 * Companies that are automatically flagged as priority — no manual config
 * entry needed. Combines MAANGA (Meta, Amazon, Apple, Netflix, Google,
 * Anthropic) with the current Fortune 500 top 50 by revenue, plus a handful
 * of other majors that are universally recognizable employers even where
 * they don't crack the top 50 by raw revenue (e.g. Netflix, OpenAI).
 *
 * A company not on this list isn't necessarily a bad fit — it just isn't
 * an automatic "obviously worth tailoring" case. You can still manually set
 * `priority: true` on a specific company in sources/config.ts, or ask Claude
 * to look up a specific company you're unsure about.
 *
 * Sourced from the Fortune 500 2026 ranking (see us500.com/fortune-500-companies).
 */

// Maps common brand/legal-name variants to a single canonical form so
// "Google" and "Alphabet" (etc.) both match the same underlying entry.
const ALIASES: Record<string, string> = {
  google: "alphabet",
  facebook: "meta",
  "meta platforms": "meta",
};

const KNOWN_PRIORITY_COMPANIES = new Set(
  [
    // MAANGA
    "meta",
    "amazon",
    "apple",
    "netflix",
    "alphabet",
    "anthropic",

    // Fortune 500 2026 — top 50 by revenue
    "walmart",
    "unitedhealth group",
    "cvs health",
    "berkshire hathaway",
    "mckesson",
    "exxon mobil",
    "cencora",
    "microsoft",
    "jpmorgan chase",
    "costco wholesale",
    "cigna group",
    "cardinal health",
    "nvidia",
    "elevance health",
    "centene",
    "bank of america",
    "chevron",
    "ford motor",
    "general motors",
    "citigroup",
    "home depot",
    "fannie mae",
    "kroger",
    "verizon communications",
    "phillips 66",
    "marathon petroleum",
    "stonex group",
    "state farm insurance",
    "freddie mac",
    "humana",
    "at&t",
    "goldman sachs group",
    "comcast",
    "wells fargo",
    "morgan stanley",
    "valero energy",
    "dell technologies",
    "target",
    "tesla",
    "walt disney",
    "johnson & johnson",
    "pepsico",
    "boeing",
    "ups",
    "rtx",
    "fedex",

    // Other widely-recognized majors not in the top 50 by raw revenue
    "openai",
    "salesforce",
    "adobe",
    "airbnb",
    "uber",
    "spotify",
    "stripe",
    "figma",
    "atlassian",
    "servicenow",
    "intuit",
    "paypal",
    "block",
    "snowflake",
    "palantir",
    "ibm",
    "oracle",
    "sap",
    "samsung",
    "sony",
    "linkedin",
    "pinterest",
    "reddit",
    "shopify",
    "square",
    "twilio",
    "zoom",
    "dropbox",
    "doordash",
    "instacart",
    "coinbase",
    "robinhood",
    "datadog",
    "mongodb",
    "hubspot",
    "asana",
    "notion",
    "canva",
  ].map((name) => name.toLowerCase()),
);

function canonicalize(name: string): string {
  const normalized = name.trim().toLowerCase();
  return ALIASES[normalized] ?? normalized;
}

/** True if `companyName` is a well-known large company worth tailoring for by default. */
export function isKnownPriorityCompany(companyName: string): boolean {
  return KNOWN_PRIORITY_COMPANIES.has(canonicalize(companyName));
}
