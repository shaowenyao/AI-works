import type { Page } from "playwright";
import type { AutofillContext } from "../fieldMatcher.js";
import { tryFill, tryUpload } from "./helpers.js";

/**
 * Layer 2 recipe for Lever (jobs.lever.co). Lever's standard form uses a
 * single full-name field (not split first/last) and `name` attributes rather
 * than ids — verified against a live posting.
 */
export async function fillLever(page: Page, ctx: AutofillContext): Promise<void> {
  await tryFill(page, 'input[name="name"]', ctx.profile.name);
  await tryFill(page, 'input[name="email"]', ctx.profile.email);
  await tryFill(page, 'input[name="phone"]', ctx.profile.phone);
  await tryFill(page, 'input[name="urls[LinkedIn]"]', ctx.profile.linkedinUrl ?? "");
  await tryFill(page, "#location-input", ctx.profile.location ?? "");

  await tryUpload(page, "#resume-upload-input", ctx.resumePath);
}
