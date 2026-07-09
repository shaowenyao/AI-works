import type { Page } from "playwright";
import type { AutofillContext } from "../fieldMatcher.js";
import { tryFill, tryUpload } from "./helpers.js";

/**
 * Layer 2 recipe for Greenhouse (job-boards.greenhouse.io / boards.greenhouse.io).
 * These IDs are stable across every company using Greenhouse's standard
 * application form — verified against a live posting.
 */
export async function fillGreenhouse(page: Page, ctx: AutofillContext): Promise<void> {
  const [firstName, ...rest] = ctx.profile.name.split(" ");

  await tryFill(page, "#first_name", firstName ?? "");
  await tryFill(page, "#last_name", rest.join(" "));
  await tryFill(page, "#email", ctx.profile.email);
  await tryFill(page, "#phone", ctx.profile.phone);
  await tryFill(page, "#candidate-location", ctx.profile.location ?? "");

  await tryUpload(page, "#resume", ctx.resumePath);
  // Some Greenhouse boards have an optional separate cover letter upload.
  await tryUpload(page, "#cover_letter", ctx.coverLetterPdfPath);
}
