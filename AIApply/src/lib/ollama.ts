import "dotenv/config";

const BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL ?? "llama3.1";

/**
 * Sends a prompt to the local Ollama instance and returns the raw text response.
 * Throws a clear error if Ollama isn't running locally.
 */
export async function ollamaGenerate(prompt: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, prompt, stream: false }),
    });
  } catch {
    throw new Error(
      `Could not reach Ollama at ${BASE_URL}. Is it running? Start it with \`ollama serve\` ` +
        `(or the Ollama desktop app), and make sure you've pulled a model: \`ollama pull ${MODEL}\`.`,
    );
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama request failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as { response: string };
  return data.response;
}

/**
 * Same as ollamaGenerate, but asks for JSON and parses it. Strips markdown code
 * fences if the model wraps its output in ```json ... ``` despite instructions not to.
 */
export async function ollamaGenerateJson<T>(prompt: string): Promise<T> {
  const raw = await ollamaGenerate(prompt);
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    throw new Error(
      `Ollama did not return valid JSON. Raw response:\n${raw}\n\nParse error: ${(err as Error).message}`,
    );
  }
}
