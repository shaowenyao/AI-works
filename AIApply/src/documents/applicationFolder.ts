import path from "node:path";

export function applicationFolderName(company: string, title: string, date = new Date()): string {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  const dateStr = date.toISOString().slice(0, 10);
  return `${dateStr}_${slug(company)}_${slug(title)}`;
}

export function applicationFolderPath(company: string, title: string, date = new Date()): string {
  return path.join("data", "applications", applicationFolderName(company, title, date));
}
