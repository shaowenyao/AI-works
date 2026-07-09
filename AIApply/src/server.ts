import "dotenv/config";
import express from "express";
import path from "node:path";
import { jobsRouter } from "./routes/jobs.js";
import { verdictsRouter } from "./routes/verdicts.js";

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

app.use(express.json());
app.use(express.static(path.resolve("public")));
// Serve generated resumes/cover letters so the UI can link/download them directly.
app.use("/files", express.static(path.resolve("data", "applications")));

app.use("/api/jobs", jobsRouter);
app.use("/api/verdicts", verdictsRouter);

app.listen(PORT, () => {
  console.log(`Job assistant running at http://localhost:${PORT}`);
});
