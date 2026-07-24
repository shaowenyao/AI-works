import { Router } from "express";
import {
  listJobs,
  markJobRequested,
  markJobApplied,
  dismissJob,
  undoLastDismiss,
  insertDummyJob,
  pruneOldArchivedJobs,
  hideDuplicates,
} from "../db/client.js";
import { scanJobs } from "../jobs/scan.js";

export const jobsRouter = Router();

jobsRouter.get("/", (_req, res) => {
  pruneOldArchivedJobs();
  res.json(hideDuplicates(listJobs()));
});

// Adds a fake, unverified job for testing the UI (e.g. the "Legit company"
// checkbox flow) without needing a real scan.
jobsRouter.post("/dummy", (req, res) => {
  try {
    const locationType = req.body?.locationType === "local" ? "local" : "remote";
    const job = insertDummyJob(locationType);
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

jobsRouter.post("/scan", async (_req, res) => {
  try {
    const result = await scanJobs();
    pruneOldArchivedJobs();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// No AI call here — this just flags the job so a human can ask Claude (in a
// Cowork/Claude Code session) to write the tailored resume and cover letter.
// See src/documents/manualGenerate.ts for the other half of this flow.
jobsRouter.post("/:id/request-generation", (req, res) => {
  const id = Number(req.params.id);
  try {
    markJobRequested(id, req.body?.demoMode === true);
    res.json({ status: "requested" });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Wired up to the real Playwright autofill once it's built.
jobsRouter.post("/:id/apply", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const { applyToJob } = await import("../autofill/apply.js");
    await applyToJob(id);
    res.json({ status: "opened" });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Lets the user mark a posting as applied once they've actually submitted it
// (via the built-in autofill or externally, e.g. Simplify). This only updates
// the tracked status/applied_date — it never submits anything itself.
jobsRouter.post("/:id/mark-applied", (req, res) => {
  const id = Number(req.params.id);
  try {
    markJobApplied(id);
    res.json({ status: "applied" });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Marks a posting as dismissed (decided not to pursue). Kept in the
// database (not deleted) so it won't reappear if the same URL is scanned
// again, but hidden from the default job list.
jobsRouter.post("/:id/dismiss", (req, res) => {
  const id = Number(req.params.id);
  try {
    dismissJob(id);
    res.json({ status: "dismissed" });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Restores whichever job was most recently deleted, in case that was a
// misclick — see undoLastDismiss() for how "most recent" is determined.
jobsRouter.post("/undo-dismiss", (_req, res) => {
  try {
    const restored = undoLastDismiss();
    res.json({ restored: restored ?? null });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
