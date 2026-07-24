import path from "node:path";

/**
 * `applyOrder` is the job's permanent apply_order number (see
 * db/client.ts markJobRequested) — prefixed as "apply-0001_" etc. (4 digits,
 * so it keeps sorting correctly even past 9999 applications) so folders sort
 * by application priority in a plain directory listing, rather than
 * alphabetically by date/company.
 */
export function applicationFolderName(
  company: string,
  title: string,
  applyOrder: number,
  date = new Date(),
): string {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  const dateStr = date.toISOString().slice(0, 10);
  const orderStr = String(applyOrder).padStart(4, "0");
  return `apply-${orderStr}_${dateStr}_${slug(company)}_${slug(title)}`;
}

export function applicationFolderPath(
  company: string,
  title: string,
  applyOrder: number,
  date = new Date(),
): string {
  return path.join("toapply-docs", applicationFolderName(company, title, applyOrder, date));
}
