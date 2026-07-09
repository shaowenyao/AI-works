import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import pdfParse from "pdf-parse";
import { ollamaGenerateJson } from "../lib/ollama.js";
import type { Profile } from "./types.js";

const DATA_DIR = path.resolve("data");
const DEFAULT_INPUT = path.join(DATA_DIR, "input-resume.pdf");
const OUTPUT_PATH = path.join(DATA_DIR, "profile.json");

function buildPrompt(resumeText: string): string {
  return `You are extracting structured data from a resume. Read the resume text below and output ONLY a JSON object (no markdown fences, no commentary) matching this exact shape:

{
  "name": string,
  "email": string,
  "phone": string,
  "linkedinUrl": string | null,
  "location": string | null,
  "summary": string,
  "workExperience": [
    { "company": string, "title": string, "startDate": string, "endDate": string, "bullets": string[] }
  ],
  "education": [
    { "institution": string, "degree": string, "graduationDate": string }
  ],
  "skills": string[]
}

If a field isn't present in the resume, use an empty string, empty array, or null as appropriate — do not invent information.

RESUME TEXT:
"""
${resumeText}
"""`;
}

export async function parseResume(inputPath: string = DEFAULT_INPUT): Promise<Profile> {
  if (!existsSync(inputPath)) {
    throw new Error(
      `No resume found at ${inputPath}. Place your resume PDF there (or pass a path as an argument) and try again.`,
    );
  }

  const buffer = await readFile(inputPath);
  const { text } = await pdfParse(buffer);

  if (!text.trim()) {
    throw new Error(`Could not extract any text from ${inputPath}. Is it a scanned/image-only PDF?`);
  }

  const profile = await ollamaGenerateJson<Profile>(buildPrompt(text));

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(profile, null, 2), "utf-8");

  return profile;
}

async function main() {
  const inputArg = process.argv[2];
  console.log(`Parsing resume from ${inputArg ?? DEFAULT_INPUT}...`);
  const profile = await parseResume(inputArg);
  console.log(`Profile saved to ${OUTPUT_PATH}`);
  console.log(JSON.stringify(profile, null, 2));
}

// Only run when executed directly (e.g. `npm run parse-resume`), not when imported.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("Failed to parse resume:", err.message);
    process.exit(1);
  });
}
