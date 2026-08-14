// Backs the "Add a category" reference labels on the Companies section
// (onboarding welcome screen + Job Settings) — the user only ever sees the
// category names, via the <datalist> built from these keys in app.js, plus
// this list shown as a live preview. Purely informational: picking a
// category does NOT add any of these companies to Included Companies (see
// addCategoryFromInput in app.js) — this file is just a reference seed
// list, not a persisted or user-editable structure.
export const COMPANY_CATEGORIES = {
  Tech: [
    "Google",
    "Meta",
    "Apple",
    "Microsoft",
    "Amazon",
    "Netflix",
    "Salesforce",
    "Adobe",
    "Airbnb",
    "Uber",
    "Stripe",
    "OpenAI",
  ],
  Finance: [
    "JPMorgan Chase",
    "Goldman Sachs",
    "Morgan Stanley",
    "Bank of America",
    "Visa",
    "Mastercard",
    "PayPal",
    "American Express",
    "Capital One",
  ],
  Healthcare: [
    "UnitedHealth Group",
    "CVS Health",
    "Pfizer",
    "Johnson & Johnson",
    "Moderna",
    "Cigna",
    "Anthem",
    "Mayo Clinic",
  ],
  Retail: ["Walmart", "Target", "Costco", "The Home Depot", "Nike", "Lowe's", "Best Buy", "Kroger"],
  Construction: [
    "Turner Construction",
    "Bechtel",
    "AECOM",
    "Skanska",
    "Kiewit",
    "DPR Construction",
    "Clark Construction",
  ],
  Automotive: ["Tesla", "Ford", "General Motors", "Rivian", "Toyota", "Honda", "Stellantis"],
  "Media & Entertainment": [
    "The Walt Disney Company",
    "Warner Bros. Discovery",
    "Spotify",
    "Netflix",
    "NBCUniversal",
    "Paramount",
  ],
  Consulting: ["McKinsey & Company", "Deloitte", "Accenture", "Boston Consulting Group", "PwC", "EY"],
  "Travel & Hospitality": ["Marriott International", "Airbnb", "Delta Air Lines", "Booking.com", "Hilton", "United Airlines"],
  "Food & Beverage": ["Starbucks", "McDonald's", "Coca-Cola", "PepsiCo", "Chipotle", "Nestlé"],
  Telecom: ["Verizon", "AT&T", "T-Mobile", "Comcast", "Charter Communications"],
  Manufacturing: ["Boeing", "General Electric", "3M", "Caterpillar", "Honeywell"],
  "Real Estate": ["CBRE", "Zillow", "Compass", "JLL", "Redfin"],
  Energy: ["ExxonMobil", "Chevron", "NextEra Energy", "Shell", "ConocoPhillips"],
  Education: ["Coursera", "Chegg", "2U", "Duolingo", "Khan Academy"],
  // Deliberately empty — picking this pulls in zero companies. It exists so
  // "none of these fit" is a real, explicit choice in the datalist rather
  // than the user assuming there's no way to opt out of the preset
  // categories; app.js special-cases an empty list to say so plainly (both
  // in the live preview and after adding), rather than silently doing
  // nothing when it's picked.
  Other: [],
};
