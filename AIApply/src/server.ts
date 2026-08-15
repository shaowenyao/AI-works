import "dotenv/config";
import express from "express";
import path from "node:path";
import { jobsRouter } from "./routes/jobs.js";
import { verdictsRouter } from "./routes/verdicts.js";
import { userSettingsRouter } from "./routes/userSettings.js";

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

// Default 100kb is too small for a resume upload (sent as base64 JSON, see
// routes/userSettings.ts) — 15mb covers any realistic resume with headroom.
app.use(express.json({ limit: "15mb" }));
// no-store on the frontend assets specifically — this app is under active
// development and a stale cached app.js/index.html (browsers can serve
// these from disk without revalidating, since there's no cache-busting
// query string on the <script> tag) has caused real confusion where a
// just-shipped fix looked like it wasn't working. Not worth the perf
// tradeoff here since this is a local personal tool, not something serving
// real traffic.
app.use(
  express.static(path.resolve("public"), {
    setHeaders: (res) => res.setHeader("Cache-Control", "no-store"),
  }),
);
// Serve generated resumes/cover letters so the UI can link/download them directly.
app.use("/files", express.static(path.resolve("toapply-docs")));
// Serve the uploaded resume from User Settings (see routes/userSettings.ts).
app.use("/webapp-docs", express.static(path.resolve("webapp-docs")));

app.use("/api/jobs", jobsRouter);
app.use("/api/verdicts", verdictsRouter);
app.use("/api/user-settings", userSettingsRouter);

app.listen(PORT, () => {
  console.log(`Job assistant running at http://localhost:${PORT}`);
});
