import { pendingRequests } from "./manualGenerate.js";

const jobs = pendingRequests();

if (jobs.length === 0) {
  console.log("No pending requests — nothing waiting for Claude to generate.");
} else {
  console.log(`${jobs.length} job(s) waiting for tailored documents:\n`);
  for (const job of jobs) {
    console.log(`#${job.id}  ${job.title} — ${job.company}  (${job.source})`);
    console.log(`   ${job.url}`);
  }
}
