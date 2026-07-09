import { Router } from "express";
import { recordCompanyVerdict } from "../db/client.js";

export const verdictsRouter = Router();

// Records/updates a company's legitimacy verdict — used by the "Legit
// company" checkbox on each job card. Manual only, no review/edit UI.
verdictsRouter.post("/:company", (req, res) => {
  const { company } = req.params;
  const { decent, note } = req.body as { decent?: boolean; note?: string };

  if (typeof decent !== "boolean") {
    res.status(400).json({ error: "Body must include a boolean 'decent' field." });
    return;
  }

  try {
    recordCompanyVerdict(company, decent, note);
    res.json({ status: "recorded" });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
