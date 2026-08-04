import { Router } from "express";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { listTargetJobTitles, saveTargetJobTitles, pruneOldArchivedJobs, clearAllJobs } from "../db/client.js";
import { scanJobs } from "../jobs/scan.js";

export const userSettingsRouter = Router();

// Sits directly under the project root (not data/, which is for the SQLite
// DB) so it's easy to find on disk — a personal resume file, never
// committed (see .gitignore). Only one resume is kept at a time: uploading
// a new one replaces whatever was there, since a single local user only
// ever has one "current" resume to reference.
const RESUME_DIR = path.resolve("webapp-docs");

function currentResumeFilename(): string | null {
  try {
    const files = readdirSync(RESUME_DIR);
    return files[0] ?? null;
  } catch {
    return null;
  }
}

userSettingsRouter.get("/", (_req, res) => {
  res.json({
    jobTitles: listTargetJobTitles(),
    resumeFilename: currentResumeFilename(),
  });
});

userSettingsRouter.post("/job-titles", async (req, res) => {
  const jobTitles = Array.isArray(req.body?.jobTitles)
    ? req.body.jobTitles.filter((t: unknown) => typeof t === "string")
    : [];
  try {
    saveTargetJobTitles(jobTitles);
    // "Clear all existing job history" — a full, permanent wipe
    // (including Applied/Hidden history), confirmed client-side before this
    // request is even sent.
    if (req.body?.clearAll === true) clearAllJobs();
    // Same as saving Job Settings — re-run the full scan so a changed
    // preference is reflected against fresh postings right away.
    await scanJobs();
    pruneOldArchivedJobs();
    res.json({ jobTitles: listTargetJobTitles() });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Body is JSON with the file as base64 rather than multipart/form-data —
// keeps this dependency-free (no multer/busboy) for what's a small,
// occasional upload on a personal local app.
userSettingsRouter.post("/resume", (req, res) => {
  const { filename, dataBase64 } = req.body ?? {};
  if (typeof filename !== "string" || !filename.trim() || typeof dataBase64 !== "string" || !dataBase64) {
    res.status(400).json({ error: "A filename and file content are required." });
    return;
  }
  // Reject anything that isn't a plain filename — no path traversal via ../.
  const safeName = path.basename(filename);
  try {
    mkdirSync(RESUME_DIR, { recursive: true });
    for (const existing of readdirSync(RESUME_DIR)) {
      rmSync(path.join(RESUME_DIR, existing));
    }
    writeFileSync(path.join(RESUME_DIR, safeName), Buffer.from(dataBase64, "base64"));
    res.json({ resumeFilename: safeName });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

userSettingsRouter.delete("/resume", (_req, res) => {
  try {
    for (const existing of readdirSync(RESUME_DIR)) {
      rmSync(path.join(RESUME_DIR, existing));
    }
    res.json({ resumeFilename: null });
  } catch {
    res.json({ resumeFilename: null });
  }
});
