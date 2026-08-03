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
app.use(express.static(path.resolve("public")));
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
