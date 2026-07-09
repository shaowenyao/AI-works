import { listUncheckedCompanies } from "../db/client.js";

const companies = listUncheckedCompanies();

if (companies.length === 0) {
  console.log("No companies waiting for a legitimacy check.");
} else {
  console.log(`${companies.length} compan${companies.length === 1 ? "y" : "ies"} waiting for a check:\n`);
  for (const company of companies) {
    console.log(`- ${company}`);
  }
}
