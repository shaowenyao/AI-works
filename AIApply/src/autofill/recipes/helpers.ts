import type { Page } from "playwright";

/** Fills a field by selector if present, and tags it so Layer 1 skips it afterward. */
export async function tryFill(page: Page, selector: string, value: string): Promise<void> {
  if (!value) return;
  const locator = page.locator(selector);
  if ((await locator.count()) === 0) return;
  await locator.fill(value);
  await tagBestEffort(locator);
}

/** Uploads a file by selector if present, and tags it so Layer 1 skips it afterward. */
export async function tryUpload(page: Page, selector: string, filePath: string): Promise<void> {
  const locator = page.locator(selector);
  if ((await locator.count()) === 0) return;
  await locator.setInputFiles(filePath);
  await tagBestEffort(locator);
}

/**
 * Some forms re-render after a value/file is set (e.g. swapping the upload
 * button for a "file selected" state), which can detach the element we just
 * filled. The fill itself already succeeded, so a failed tag here is fine to
 * ignore — worst case Layer 1 double-checks a field that's already correct.
 */
async function tagBestEffort(locator: ReturnType<Page["locator"]>): Promise<void> {
  try {
    await locator.evaluate((el) => el.setAttribute("data-job-assistant-filled", "true"), undefined, {
      timeout: 2000,
    });
  } catch {
    // ignore
  }
}
