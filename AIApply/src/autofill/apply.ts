import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { getJob } from "../db/client.js";
import type { Profile } from "../profile/types.js";
import type { TailoredContent } from "../documents/types.js";
import { runGenericFieldMatcher, type AutofillContext } from "./fieldMatcher.js";
import { fillGreenhouse } from "./recipes/greenhouse.js";
import { fillLever } from "./recipes/lever.js";
import { fillAshby } from "./recipes/ashby.js";

const PROFILE_PATH = path.join("data", "profile.json");

/**
 * Opens the job's real application page in a visible browser and fills in
 * whatever it can (personal info, resume, cover letter). It NEVER clicks
 * Submit — the browser stays open on screen for manual review and submission.
 */
export async function applyToJob(jobId: number): Promise<void> {
  const job = getJob(jobId);
  if (!job) throw new Error(`No job found with id ${jobId}`);

  if (!job.resume_path || !job.cover_letter_path) {
    throw new Error(
      `No tailored documents for this job yet. Click "Generate Resume" first, then ask Claude to generate it, and try again.`,
    );
  }

  if (!existsSync(PROFILE_PATH)) {
    throw new Error(`No profile found at ${PROFILE_PATH}. Run \`npm run parse-resume\` first.`);
  }

  const profile = JSON.parse(await readFile(PROFILE_PATH, "utf-8")) as Profile;

  const tailoredContentPath = path.join(path.dirname(job.resume_path), "tailored_content.json");
  const coverLetterText = existsSync(tailoredContentPath)
    ? (JSON.parse(await readFile(tailoredContentPath, "utf-8")) as TailoredContent).coverLetterBody
    : "";

  const ctx: AutofillContext = {
    profile,
    resumePath: path.resolve(job.resume_path),
    coverLetterPdfPath: path.resolve(job.cover_letter_path),
    coverLetterText,
  };

  // headless: false — the whole point is that you watch this happen and take over.
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(job.url, { waitUntil: "domcontentloaded" });
  // Best-effort extra settle time for client-side rendered SPAs (e.g. Ashby),
  // where the Apply button doesn't exist in the DOM until well after
  // domcontentloaded. Some sites (e.g. Lever) keep background network activity
  // alive indefinitely, so this is allowed to time out rather than block forever.
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});

  await clickApplyIfPresent(page);
  await page.waitForTimeout(1500); // let any client-rendered form finish mounting

  switch (job.source) {
    case "greenhouse":
      await fillGreenhouse(page, ctx);
      break;
    case "lever":
      await fillLever(page, ctx);
      break;
    case "ashby":
      await fillAshby(page, ctx);
      break;
  }

  // Layer 1 catches anything the platform recipe didn't (e.g. LinkedIn/cover-letter
  // fields on Ashby, or any other site not covered by a recipe at all).
  await runGenericFieldMatcher(page, ctx);

  // Deliberately not calling browser.close() or clicking Submit — this is where
  // the tool stops. The window stays open for you to review and submit yourself.
}

async function clickApplyIfPresent(page: import("playwright").Page): Promise<void> {
  const applyControl = page.locator('a:has-text("Apply"), button:has-text("Apply")').first();
  if ((await applyControl.count()) === 0) return;
  try {
    await applyControl.click({ timeout: 5000 });
  } catch {
    // No visible/clickable Apply control — assume the form is already on the page.
  }
}
