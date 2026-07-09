import type { Page } from "playwright";
import type { Profile } from "../profile/types.js";

export interface AutofillContext {
  profile: Profile;
  resumePath: string;
  coverLetterPdfPath: string;
  coverLetterText: string;
}

interface ScannedField {
  index: number;
  tag: "input" | "textarea";
  inputType: string | null;
  label: string;
}

/**
 * Layer 1 — generic field matcher.
 *
 * Scans every input/textarea on the page and matches each one by its *label
 * text* (label element, aria-label, or placeholder) against known field types,
 * never by position — field order varies across job sites. Elements already
 * handled by a platform recipe (Layer 2) are tagged with
 * data-job-assistant-filled and skipped here.
 *
 * Anything that doesn't match a known pattern is left untouched — there is no
 * AI fallback for custom questions; the user fills those in by hand.
 */
export async function runGenericFieldMatcher(page: Page, ctx: AutofillContext): Promise<void> {
  const fields = await scanFields(page);

  for (const field of fields) {
    const rule = matchRule(field);
    if (!rule) continue;

    const locator = locatorForIndex(page, field.index);
    try {
      await rule.fill(locator, ctx);
      await tagAsFilled(page, field.index);
    } catch {
      // Best-effort autofill — if a single field fails (hidden, disabled, unexpected
      // widget), skip it and let the user fill it in manually rather than aborting.
    }
  }
}

async function scanFields(page: Page): Promise<ScannedField[]> {
  // NOTE: no named intermediate functions/consts inside this callback. esbuild's
  // "keep names" transform (used by tsx) wraps named function bindings in a
  // `__name(...)` helper call — fine within the Node process, but Playwright
  // ships only this callback's own source to the browser, where that helper
  // doesn't exist, causing a ReferenceError. Anonymous inline callbacks (passed
  // directly as arguments, never assigned to a name) aren't wrapped, so we
  // stick to those throughout.
  //
  // Each scanned element is tagged with data-autofill-scan-id right here, and
  // every later lookup goes through that attribute rather than nth(index).
  // Filling one field can mutate the DOM (e.g. an autocomplete dropdown
  // inserting new elements before others in document order), which shifts
  // positional indices — a stable per-element marker avoids landing on the
  // wrong field when that happens.
  return page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll("input, textarea")).filter(
      (el) => !el.hasAttribute("data-job-assistant-filled"),
    );

    return elements.map((el, index) => {
      el.setAttribute("data-autofill-scan-id", String(index));

      let label = el.getAttribute("aria-label") ?? "";

      if (!label) {
        const id = el.getAttribute("id");
        if (id) {
          const labelEl = document.querySelector(`label[for="${CSS.escape(id)}"]`);
          if (labelEl?.textContent) label = labelEl.textContent;
        }
      }

      if (!label) {
        const closestLabel = el.closest("label");
        if (closestLabel?.textContent) label = closestLabel.textContent;
      }

      if (!label) {
        label = el.getAttribute("placeholder") ?? "";
      }

      return {
        index,
        tag: el.tagName.toLowerCase() as "input" | "textarea",
        inputType: el.getAttribute("type"),
        label: label.trim().slice(0, 200),
      };
    });
  });
}

function locatorForIndex(page: Page, index: number) {
  return page.locator(`[data-autofill-scan-id="${index}"]`);
}

async function tagAsFilled(page: Page, index: number): Promise<void> {
  await locatorForIndex(page, index).evaluate(
    (el) => el.setAttribute("data-job-assistant-filled", "true"),
    undefined,
    { timeout: 2000 },
  );
}

interface FieldRule {
  test: (field: ScannedField) => boolean;
  fill: (locator: ReturnType<Page["locator"]>, ctx: AutofillContext) => Promise<void>;
}

function isFileInput(field: ScannedField): boolean {
  return field.tag === "input" && field.inputType === "file";
}

function isTextlike(field: ScannedField): boolean {
  if (field.tag === "textarea") return true;
  return field.tag === "input" && ["text", "email", "tel", "url", null].includes(field.inputType);
}

// Order matters — more specific patterns are checked first.
const rules: FieldRule[] = [
  {
    test: (f) => /cover.?letter/i.test(f.label) && isFileInput(f),
    fill: async (locator, ctx) => locator.setInputFiles(ctx.coverLetterPdfPath),
  },
  {
    test: (f) => /cover.?letter/i.test(f.label) && isTextlike(f),
    fill: async (locator, ctx) => locator.fill(ctx.coverLetterText),
  },
  {
    test: (f) => /(resume|\bcv\b)/i.test(f.label) && isFileInput(f),
    fill: async (locator, ctx) => locator.setInputFiles(ctx.resumePath),
  },
  {
    // Excludes "Preferred First Name" and similar — that's a distinct nickname
    // field, not necessarily the same as your legal first name.
    test: (f) => /first\s*name|given\s*name/i.test(f.label) && !/preferred/i.test(f.label) && isTextlike(f),
    fill: async (locator, ctx) => locator.fill(ctx.profile.name.split(" ")[0] ?? ""),
  },
  {
    test: (f) => /last\s*name|surname|family\s*name/i.test(f.label) && !/preferred/i.test(f.label) && isTextlike(f),
    fill: async (locator, ctx) => locator.fill(ctx.profile.name.split(" ").slice(1).join(" ")),
  },
  {
    test: (f) => /^\s*(full\s*name|name)\s*\*?\s*$/i.test(f.label) && isTextlike(f),
    fill: async (locator, ctx) => locator.fill(ctx.profile.name),
  },
  {
    test: (f) => /e-?mail/i.test(f.label) && isTextlike(f),
    fill: async (locator, ctx) => locator.fill(ctx.profile.email),
  },
  {
    test: (f) => /phone|mobile/i.test(f.label) && isTextlike(f),
    fill: async (locator, ctx) => locator.fill(ctx.profile.phone),
  },
  {
    test: (f) => /linkedin/i.test(f.label) && isTextlike(f),
    fill: async (locator, ctx) => locator.fill(ctx.profile.linkedinUrl ?? ""),
  },
  {
    test: (f) => /^\s*(location|city)\s*\*?\s*$/i.test(f.label) && isTextlike(f),
    fill: async (locator, ctx) => locator.fill(ctx.profile.location ?? ""),
  },
];

function matchRule(field: ScannedField): FieldRule | undefined {
  if (!field.label) return undefined;
  return rules.find((rule) => rule.test(field));
}
