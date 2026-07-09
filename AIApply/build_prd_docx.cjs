const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType, ShadingType,
} = require("docx");

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { after: 100 },
    children: [new TextRun(text)],
  });
}

function body(text) {
  return new Paragraph({ spacing: { after: 200 }, children: [new TextRun(text)] });
}

function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
}

function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
}

function headerCell(text, width) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: "D5E8F0", type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
  });
}

function cell(text, width) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text, size: 20 })] })],
  });
}

const tableHeaders = ["Feature", "Jobright", "Careerflow AI", "ApplyKit", "Your tool"];
const tableRows = [
  ["Job discovery/scanning", "Yes — AI copilot finds and scores jobs", "No — user finds jobs themselves", "No — focused on tailoring", "Yes — scans top job sites"],
  ["Legitimacy check", "No", "No", "No", "Yes — check vs static list"],
  ["Resume tailoring", "Yes — AI-tailored per job", "AI resume scoring/suggestions only", "Yes — local LLM (Ollama) tailors per job description", "Yes — Claude-written"],
  ["Tailoring engine", "Proprietary model", "Proprietary model", "Local model via Ollama", "Claude (chat-based, on request)"],
  ["Autofill", "Yes — 1-click autofill extension", "No", "Yes (per description)", "Yes — two-layer (platform recipe + generic label matcher)"],
  ["Final submit control", "Manual", "Manual (app doesn't submit anything)", "Not confirmed", "Always manual — never auto-submits"],
  ["Pricing", "Freemium, 10/day free", "Free tier for tracking/scoring", "Free/open-source", "Free (local) + user's own Claude usage"],
  ["Data storage/privacy", "Cloud-hosted (SaaS)", "Cloud-hosted (SaaS)", "Fully local", "Fully local"],
];

const colWidths = [1700, 2100, 2100, 2100, 2260]; // sums to 10260... adjust below
const totalWidth = 9360;
const widths = [1900, 1865, 1865, 1865, 1865]; // sums to 9360

const table = new Table({
  width: { size: totalWidth, type: WidthType.DXA },
  columnWidths: widths,
  rows: [
    new TableRow({ tableHeader: true, children: tableHeaders.map((t, i) => headerCell(t, widths[i])) }),
    ...tableRows.map((row) => new TableRow({ children: row.map((t, i) => cell(t, widths[i])) })),
  ],
});

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: "1A1A1A" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: "1A1A1A" },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
      ] },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    children: [
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: "AI Application Assistant — Product Requirements", bold: true, size: 40 })],
      }),
      new Paragraph({
        spacing: { after: 300 },
        children: [new TextRun({
          text: "Restructured per Carlin Yuen's Product PRD framework: Problem → Users & Use Cases → Landscape → Solution → Goals → MVP Requirements. Grounded against the actual implementation in this repo — package.json, db/schema.sql, jobs/, documents/, autofill/, profile/, routes/, server.ts.",
          italics: true, size: 20, color: "666666",
        })],
      }),

      h1("1. Problem / Opportunity"),
      body("Job hunting takes too much manual work: finding good postings, writing a tailored resume and cover letter for each one, filling out application forms, and figuring out which companies are worth the effort. Companies use AI recruiters to screen candidates, stall on responses, and post ghost jobs. Now job applicants get the same: a semi-automatic dashboard for job discovery, prioritization, and tailoring, with full user control, that shows the user what the recruiter already sees, so they can decide what's worth applying to before doing the work, not after — and still click Apply themselves."),

      h1("2. Target Users & Use Cases"),
      body("Personal offline job application dashboard for local computer use — no accounts needed. The use case is burned-out job applicants who want to automate the job application process with semi-automated AI assistance, where it seeks out jobs and qualifies them, then produces customized resume materials tailored to the job description if flagged as necessary. The user can manually apply for the job with the resume tailoring and job authenticity steps completed for them. This is more authentic, and the company's AI screening system, if it exists, is less likely to flag it than an AI auto-applying on the user's behalf."),

      h1("3. Current Journeys / Landscape (optional)"),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "TODO: find/attach 2-3 screenshots of each competitor (Jobright, Careerflow AI, ApplyKit) showing what they do well, for visual reference alongside the table below.", italics: true, color: "886666" })],
      }),
      new Paragraph({ spacing: { after: 150 }, children: [new TextRun({ text: "Feature comparison vs. closest analogs:", bold: true })] }),
      table,
      new Paragraph({ text: "", spacing: { after: 200 } }),

      h1("4. Proposed Solution / Elevator Pitch"),
      body("An offline webapp for frustrated job searchers navigating a frustrating employment environment filled with employer-side AI tools and ghost job postings. This tool emulates the recruiter's actionable events in reverse, giving job postings features like genuine verification, resume customization, and user-taken actions."),
      new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "Top 3 value props:", bold: true })] }),
      bullet("Never miss or forget a relevant posting from companies you actually care about."),
      bullet("Get a tailored resume + cover letter without paying per-job API costs or accepting lower-quality free-model output."),
      bullet("Cut down the mechanical part of filling out application forms, while the user stays in full control of what's said and what's submitted."),
      new Paragraph({ text: "", spacing: { after: 100 } }),
      new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "Conceptual model (as built):", bold: true })] }),
      bullet("Watched companies (config.ts) → npm run scan-jobs / “Scan for new jobs” → priority resolved per posting: manual config flag, OR static known-major-employer list (priorityCompanies.ts), OR a cached company_verdicts row from a prior Claude check → jobs land in SQLite-backed list (db/schema.sql), priority badged in the web UI at localhost:3000"),
      bullet("User clicks “Generate Resume” on a job → job marked requested (no AI call happens here) → user tells Claude “generate the pending ones” → Claude reads npm run list-requested, writes resume.docx + cover_letter.docx, saves them via finalizeManualDocuments() into data/applications/<date>_<company>_<title>/, job marked prepared"),
      bullet("User refreshes the page → download links + “Open & Auto-fill Application” button appear"),
      bullet("EITHER: click “Open & Auto-fill” → visible (headless: false) Playwright browser opens the real job URL, clicks Apply if present, runs a platform-specific recipe (greenhouse/lever/ashby) then a generic label-based field matcher as a fallback layer, uploads resume/cover letter, fills contact fields, leaves custom questions blank, and never calls Submit or closes the browser"),
      bullet("OR: download the .docx files and drop them into Simplify instead"),
      bullet("User reviews and clicks Submit themselves, always"),
      new Paragraph({ text: "", spacing: { after: 100 } }),
      body("Separately: npm run list-unchecked surfaces companies with no verdict yet; user tells Claude to check them; Claude records a permanent verdict via npm run record-verdict."),

      h1("5. Goals / Measurable Outcomes"),
      bullet("Are we finding the right jobs for the user?"),
      bullet("Is the resume tailored well for ATS parsing and the job description?"),
      bullet("Does the user actually find this better than applying manually?"),

      h1("6. MVP / Functional Requirements"),
      body("Organized into 3 phases/milestones by priority, covering the full lifecycle from first-time setup through ongoing use to retiring old postings — not just the happy path of discovery through autofill. P0 = required for MVP adoption, P1 = high-value addition for a min-delightful product, P2 = nice-to-have."),

      h2("Phase 1 — From Resume to Application"),
      bullet("[P0] First-time user can convert their resume into a structured profile without retyping their work history."),
      bullet("[P0] User can flag postings to receive tailored resumes and cover letters, generated on request and downloadable once ready."),
      bullet("[P0] User can open a real job application in a visible browser window."),
      bullet("[P1] User can scan watched companies for new job postings on demand."),
      bullet("[P1] The tool must fill application fields by matching their meaning, not their position."),
      bullet("[P1] The tool must leave custom or open-ended questions blank for the user to answer."),

      h2("Phase 2 — Staying Organized Over Time"),
      bullet("[P0] User can mark a posting as applied to separate it from postings still awaiting action."),
      bullet("[P0] User can find postings across five ATS platforms: Greenhouse, Lever, Ashby, SmartRecruiters, and BambooHR."),
      bullet("[P1] User can see well-known major employers automatically flagged as priority."),
      bullet("[P1] User can check a box to manually mark an unrecognized company as legitimate, remembered permanently."),
      bullet("[P1] User can manually mark a specific company as priority."),
      bullet("[P1] User can delete a posting they've decided not to pursue."),
      bullet("[P1] The tool only shows the first instance of a duplicate posting; the rest are hidden automatically."),
      bullet("[P2] User can customize things (watch list, profile) whenever they need to."),

      h2("Phase 3 — Reaching More Jobs, Smoother Edges"),
      bullet("[P2] User can review and edit a company's recorded legitimacy verdict from within the app."),
      bullet("[P2] User can monitor and visualize counts of new postings, pending tailoring, and applications sent."),
    ],
  }],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync("AI_Application_Assistant_PRD.docx", buffer);
  console.log("done");
});
