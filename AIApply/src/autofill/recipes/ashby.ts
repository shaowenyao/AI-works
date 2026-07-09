import type { Page } from "playwright";
import type { AutofillContext } from "../fieldMatcher.js";
import { tryFill, tryUpload } from "./helpers.js";

/**
 * Layer 2 recipe for Ashby (jobs.ashbyhq.com). Standard fields use stable
 * `_systemfield_*` ids across every company — verified against a live posting.
 * Ashby's "Cover letter"/"LinkedIn" questions use per-posting random ids with
 * a plain label, so those are left to the Layer 1 generic matcher instead.
 */
export async function fillAshby(page: Page, ctx: AutofillContext): Promise<void> {
  await tryFill(page, "#_systemfield_name", ctx.profile.name);
  await tryFill(page, "#_systemfield_email", ctx.profile.email);

  await tryUpload(page, "#_systemfield_resume", ctx.resumePath);
}
