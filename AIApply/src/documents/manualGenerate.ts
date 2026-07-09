import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getJob, listRequestedJobs, setJobDocuments, type JobRow } from "../db/client.js";
import { applicationFolderPath } from "./applicationFolder.js";

/**
 * The "Generate Resume" button in the webapp doesn't call any AI model — it
 * just flags a job as `requested` (see db/client.ts markJobRequested). A
 * human then asks Claude directly (in a Cowork/Claude Code session) to write
 * the tailored resume and cover letter for that job. This module is what
 * Claude uses to save its output back into the app once written, so the
 * webapp picks it up exactly like the old Ollama-generated documents did.
 */

/** Jobs currently waiting for a human to ask Claude to generate their documents. */
export function pendingRequests(): JobRow[] {
  return listRequestedJobs();
}

/**
 * Call this after writing the tailored resume/cover letter content — pass in
 * the actual file bytes (e.g. from a docx builder). Saves both files into
 * data/applications/<job-folder>/ and marks the job `prepared`, which is what
 * unlocks the "Open & Auto-fill Application" button and the download links.
 */
export async function finalizeManualDocuments(
  jobId: number,
  resumeBytes: Uint8Array,
  coverLetterBytes: Uint8Array,
  extension: "docx" | "pdf" = "docx",
): Promise<{ resumePath: string; coverLetterPath: string }> {
  const job = getJob(jobId);
  if (!job) throw new Error(`No job found with id ${jobId}`);

  const folder = applicationFolderPath(job.company, job.title);
  await mkdir(folder, { recursive: true });

  const resumePath = path.join(folder, `resume.${extension}`);
  const coverLetterPath = path.join(folder, `cover_letter.${extension}`);

  await writeFile(resumePath, resumeBytes);
  await writeFile(coverLetterPath, coverLetterBytes);
  await writeFile(path.join(folder, "job_description.txt"), job.description ?? "", "utf-8");

  setJobDocuments(jobId, resumePath, coverLetterPath);

  return { resumePath, coverLetterPath };
}
