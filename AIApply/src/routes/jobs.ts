import { Router } from "express";
import {
  db,
  listJobs,
  markJobRequested,
  markJobApplied,
  dismissJob,
  undoLastDismiss,
  unhideJob,
  excludeJob,
  insertDummyJob,
  insertJobIfNew,
  pruneOldArchivedJobs,
  hideDuplicates,
  setPipelineStage,
  PIPELINE_STAGES,
  setFavorite,
} from "../db/client.js";
import type { JobRow } from "../db/client.js";
import { scanJobs, resolvePriority } from "../jobs/scan.js";
import { isRemoteConfirmed, isLocalToSf } from "../jobs/locationClassifier.js";
import { isDesignTitle } from "../../public/shared/jobFilters.js";

export const jobsRouter = Router();

// Only design-role postings are ever shown in the UI (see isDesignTitle),
// so filtering here — not just client-side — keeps the response small: the
// scanner pulls every posting from each tracked company, and most aren't
// design roles at all. manually_imported jobs (added by exact URL via
// POST /import) are exempt — the user explicitly chose that one posting,
// so it should always show regardless of title. Excluded jobs (see
// excludeJob) are filtered out here too — the row stays in the DB (so a
// rescan can't resurrect it), it just never reaches the client at all, in
// any tab.
jobsRouter.get("/", (_req, res) => {
  pruneOldArchivedJobs();
  res.json(
    hideDuplicates(listJobs())
      .filter((job) => job.manually_imported || isDesignTitle(job))
      .filter((job) => job.status !== "excluded"),
  );
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
    markJobRequested(id);
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
// again — moves it into the "Hidden Jobs" tab instead of the tab it was in.
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

// The per-card "Unhide" button — restores one specific job, as opposed to
// undo-dismiss above which always targets whichever was hidden most recently.
jobsRouter.post("/:id/unhide", (req, res) => {
  const id = Number(req.params.id);
  try {
    const restored = unhideJob(id);
    res.json({ restored: restored ?? null });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// The status dropdown on Applied Jobs cards — tracks where the application
// actually stands in the hiring pipeline, separate from this app's own
// found/requested/applied lifecycle.
jobsRouter.post("/:id/pipeline-stage", (req, res) => {
  const id = Number(req.params.id);
  const stage = req.body?.stage;
  if (!PIPELINE_STAGES.includes(stage)) {
    res.status(400).json({ error: `Invalid stage. Must be one of: ${PIPELINE_STAGES.join(", ")}` });
    return;
  }
  try {
    setPipelineStage(id, stage);
    res.json({ pipeline_stage: stage });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// The star toggle on job cards.
jobsRouter.post("/:id/favorite", (req, res) => {
  const id = Number(req.params.id);
  const favorited = req.body?.favorited === true;
  try {
    setFavorite(id, favorited);
    res.json({ favorited });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// The "Exclude" button on New Jobs — a permanent, non-reversible-from-the-UI
// "this is a bad fit, never show it again" flag. See excludeJob() for why
// the row is kept (not hard-deleted) despite never appearing in the UI again.
jobsRouter.post("/:id/exclude", (req, res) => {
  const id = Number(req.params.id);
  try {
    excludeJob(id);
    res.json({ status: "excluded" });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// "Add job" (outside demo mode) — imports one specific posting by URL
// instead of scanning a whole company board. See jobs/importByUrl.ts for
// which job boards are actually supported.
jobsRouter.post("/import", async (req, res) => {
  const url = req.body?.url;
  if (typeof url !== "string" || !url.trim()) {
    res.status(400).json({ error: "A URL is required." });
    return;
  }
  try {
    const { importJobFromUrl } = await import("../jobs/importByUrl.js");
    const posting = await importJobFromUrl(url.trim());
    const inserted = insertJobIfNew({
      ...posting,
      priority: resolvePriority(posting.company, posting.priority),
      isRemote: isRemoteConfirmed(posting),
      isLocalSf: isLocalToSf(posting),
      manuallyImported: true,
    });
    if (!inserted) {
      res.status(409).json({ error: "That job is already in your list." });
      return;
    }
    // The client needs is_remote/is_local_sf back so it can switch the
    // Remote/Local filter to whichever actually matches this posting —
    // otherwise a freshly imported job can silently fail to appear if it
    // doesn't match whatever filter happened to be selected.
    const job = db.prepare("SELECT * FROM jobs WHERE url = ?").get(posting.url) as JobRow;
    res.json({ status: "imported", job });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});
