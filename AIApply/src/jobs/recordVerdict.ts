import { recordCompanyVerdict } from "../db/client.js";

// Usage: npm run record-verdict -- "Company Name" true "Series B, ~200 employees, solid reputation"
const [company, decentArg, note] = process.argv.slice(2);

if (!company || !decentArg) {
  console.error('Usage: npm run record-verdict -- "Company Name" <true|false> ["note"]');
  process.exit(1);
}

const decent = decentArg.toLowerCase() === "true";
recordCompanyVerdict(company, decent, note);
console.log(`Recorded: ${company} → ${decent ? "decent (priority)" : "not worth tailoring"}${note ? ` — ${note}` : ""}`);
