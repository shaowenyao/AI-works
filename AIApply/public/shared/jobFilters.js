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
