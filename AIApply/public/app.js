import { isDesignTitle } from "./shared/jobFilters.js";

// Mirrors PIPELINE_STAGES in src/db/client.ts — the server validates against
// its own copy, so this only controls what the dropdown offers, not what's
// actually accepted.
const PIPELINE_STAGES = ["applied", "recruiter", "interview", "offer", "ghosted"];

const jobsEl = document.getElementById("jobs");
const emptyEl = document.getElementById("empty");
const scanBtn = document.getElementById("scan-btn");
const undoBtn = document.getElementById("undo-btn");
const dummyBtn = document.getElementById("dummy-btn");
const timeRangeFilter = document.getElementById("time-range-filter");
const locationFilter = document.getElementById("location-filter");
const tabButtons = document.querySelectorAll(".tab-btn");
const searchInput = document.getElementById("search-input");
const filterNoteEl = document.getElementById("filter-note");
const demoModeToggle = document.getElementById("demo-mode-toggle");
const prevPageBtn = document.getElementById("prev-page-btn");
const nextPageBtn = document.getElementById("next-page-btn");
const pageIndicatorEl = document.getElementById("page-indicator");
const pageSizeSelect = document.getElementById("page-size-select");
const paginationEl = document.getElementById("pagination");
let currentTab = "current";
let currentPage = 1;
let pageSize = Number(pageSizeSelect.value);
// Hours back from now that counts as "New Jobs" — the complement (older
// than this) is "Past Jobs". Driven by the time-range dropdown instead of
// being a fixed same-calendar-day check.
let timeRangeHours = Number(timeRangeFilter.value);

// Demo mode: everything works exactly like normal mode (real API calls,
// real apply_order assignment, real navigation) — the one difference is
// "Apply with AI fill" unlocks right after "Optimize CV" is clicked instead
// of waiting for someone to actually generate the tailored documents (see
// applyEnabled in jobCard). Lets the flow be demoed end-to-end without that
// generation step. Persisted so it survives a reload.
let demoMode = localStorage.getItem("demoMode") === "true";
demoModeToggle.checked = demoMode;
demoModeToggle.addEventListener("change", () => {
  demoMode = demoModeToggle.checked;
  localStorage.setItem("demoMode", String(demoMode));
  renderJobs();
});

const ARCHIVE_RETENTION_DAYS = 7;

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

// "Applied {when}" on the second line of an applied card. Relative ("2 days
// ago") inside the last week so it's easy to scan at a glance; beyond that a
// relative count stops being useful, so it falls back to an absolute date
// and time.
function formatAppliedWhen(appliedDateString) {
  const applied = new Date(appliedDateString);
  const diffDays = Math.floor((Date.now() - applied.getTime()) / (24 * 60 * 60 * 1000));
  // The exact timestamp always shows, even within the relative-day window —
  // "2 days ago" alone doesn't tell you whether that was 8am or 11pm.
  const time = applied.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (diffDays < 1) return `Applied today at ${time}`;
  if (diffDays < 7) return `Applied ${diffDays} day${diffDays === 1 ? "" : "s"} ago at ${time}`;
  const date = applied.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `Applied ${date} at ${time}`;
}
// Each tab keeps its own search text — switching tabs never carries a query
// over to (or clears one from) another tab.
const searchQueries = { current: "", applied: "", archived: "", hidden: "" };

function withinTimeRange(dateString) {
  const ageMs = Date.now() - new Date(dateString).getTime();
  return ageMs <= timeRangeHours * 60 * 60 * 1000;
}

/**
 * Hidden Jobs = dismissed, regardless of anything else — checked first so a
 * hidden job never also shows up in whatever tab it originally lived in.
 * New Jobs = found within the selected time range, not yet applied. Applied
 * Jobs = applied regardless of date. Past Jobs = found before that range,
 * not applied.
 */
function matchesTab(job) {
  if (currentTab === "hidden") return job.status === "dismissed";
  if (job.status === "dismissed") return false;
  if (currentTab === "applied") return job.status === "applied";
  if (job.status === "applied") return false;
  return currentTab === "current" ? withinTimeRange(job.date_found) : !withinTimeRange(job.date_found);
}

/** Computed server-side at scan time — see src/jobs/locationClassifier.ts. */
function isRemoteJob(job) {
  return Boolean(job.is_remote);
}

function isLocalJob(job) {
  return Boolean(job.is_local_sf);
}

const icons = {
  external: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  eye: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>`,
  eyeOff: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a20.32 20.32 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
  starOutline: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  starFilled: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
};

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function jobCard(job) {
  const hasDocs = job.resume_path && job.cover_letter_path;
  const isHidden = job.status === "dismissed";
  // A hidden job's real status is "dismissed", which would otherwise make
  // it look like it was never applied to — previous_status (stashed by
  // dismissJob, see db/client.ts) is what it actually was right before
  // hiding, so the card keeps rendering the same controls (and the star in
  // the same position) it had in its original tab.
  const effectiveStatus = isHidden ? (job.previous_status ?? job.status) : job.status;
  const isApplied = effectiveStatus === "applied";
  const statusLabel = job.status === "found" || job.status === "requested" ? job.company : job.status;
  const favoriteControl = `<button class="favorite-btn" data-favorited="${job.favorited ? "true" : "false"}" title="${job.favorited ? "Unfavorite" : "Favorite"}">${job.favorited ? icons.starFilled : icons.starOutline}</button>`;

  // Toggles between the two actions instead of being two separate buttons —
  // "Hide" (dismissJob) stashes the job's current status so "Unhide"
  // (unhideJob) can put it back in whatever tab it came from, per-card
  // rather than only being able to undo the single most recent hide.
  const hideControl = isHidden
    ? `<button class="hide-btn" data-hidden="true">${icons.eye} Unhide</button>`
    : `<button class="hide-btn" data-hidden="false">${icons.eyeOff} Hide</button>`;

  const generateControl =
    hasDocs || isApplied
      ? ""
      : job.status === "requested"
        ? `<button class="request-btn btn-dark" disabled>Resume In Claude</button>`
        : `<button class="request-btn btn-dark">Generate Resume</button>`;

  const dateBadge = `<span class="date-badge">${new Date(job.date_found).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>`;
  const SOURCE_LABELS = {
    greenhouse: "Greenhouse",
    lever: "Lever",
    ashby: "Ashby",
    smartrecruiters: "SmartRecruiters",
    bamboohr: "BambooHR",
  };
  const sourceBadge = `<span class="source-badge">${escapeHtml(SOURCE_LABELS[job.source] ?? job.source)}</span>`;
  const priorityBadge = job.priority ? `<span class="priority">Verify</span>` : "";
  // Shown for any company that isn't auto-flagged from the static priority
  // list (job.priority with no verdict behind it) or that you've already
  // toggled yourself (has_verdict) — a manual way to mark a company as
  // legitimate (or not), toggable either direction. Checking it saves
  // immediately (see the legit-checkbox handler below), adding the company
  // to the persistent verdicts list right away — independent of whether
  // "Apply with AI prefill" ever gets clicked afterward. Only disappears
  // once you've actually applied, since the legitimacy call stops mattering
  // then.
  const legitControl = (!job.priority || job.has_verdict) && !isApplied
    ? `<label class="legit-check"><input type="checkbox" class="legit-checkbox" ${job.priority ? "checked" : ""} /> Verify Company</label>`
    : "";

  // Set once, permanently, the moment "Optimize CV" is clicked (see
  // markJobRequested in db/client.ts) — shown until the job is marked
  // applied, so it's clear which one to tackle next without the number
  // ever shifting as other jobs get applied to or removed.
  const applyOrderBadge =
    job.apply_order && !isApplied
      ? `<span class="apply-order-badge">Apply ${String(job.apply_order).padStart(4, "0")}</span>`
      : "";

  // "Apply with AI fill" is always clickable now — if a resume isn't ready
  // yet, the click handler shows an inline dismissible error instead of the
  // button being disabled (see wireJobCardEvents). "Ready" means either real
  // tailored docs exist (hasDocs) or "Generate Resume" has at least been
  // clicked (status "requested") — waiting on hasDocs alone would mean this
  // never unlocks until someone's manually generated the real documents,
  // which can take a while, so a request in flight is enough.
  const applyReady = hasDocs || job.status === "requested";

  // Once a job is applied, "Apply with AI prefill" is the only way it gets
  // here in the first place (see wireJobCardEvents) — showing it again on
  // an already-applied card would just invite a redundant click. In its
  // place, an applied card gets a pipeline-stage dropdown instead — tracks
  // where the application actually stands (recruiter screen, interview,
  // offer, ghosted), separate from this app's own applied/hidden lifecycle.
  const pipelineStage = job.pipeline_stage ?? "applied";
  const applyControl = isApplied
    ? `<select class="pipeline-select" data-current="${pipelineStage}">${PIPELINE_STAGES.map(
        (s) => `<option value="${s}" ${s === pipelineStage ? "selected" : ""}>${s[0].toUpperCase()}${s.slice(1)}</option>`,
      ).join("")}</select>`
    : `<button class="apply-btn btn-dark" data-ready="${applyReady}">Apply with AI prefill</button>`;

  return `
    <div class="card ${job.priority ? "priority-card" : ""}" data-id="${job.id}" data-company="${escapeHtml(job.company)}" data-url="${escapeHtml(job.url)}">
      <div class="card-header">
        <h3 class="card-title"><a href="${escapeHtml(job.url)}" target="_blank" rel="noopener" class="title-link">${escapeHtml(job.title)}</a> — <span class="company">${escapeHtml(job.company)}</span></h3>
        <div class="card-badges">
          ${legitControl}
          ${priorityBadge}
          <span class="status">${escapeHtml(statusLabel)}</span>
          ${dateBadge}
          ${sourceBadge}
        </div>
      </div>
      <div class="meta">${isApplied && job.applied_date ? formatAppliedWhen(job.applied_date) : ""}</div>
      <div class="actions">
        ${generateControl}
        ${isApplied ? favoriteControl : ""}
        ${applyControl}
        ${isApplied ? "" : favoriteControl}
        ${hideControl}
        <span class="links">
          ${applyOrderBadge}
          <a href="${escapeHtml(job.url)}" target="_blank" rel="noopener">View posting ${icons.external}</a>
          ${hasDocs ? `<a href="/files/${encodeURIComponent(job.resume_path.split("/").slice(-2).join("/"))}" target="_blank">Resume</a>` : ""}
          ${hasDocs ? `<a href="/files/${encodeURIComponent(job.cover_letter_path.split("/").slice(-2).join("/"))}" target="_blank">Cover letter</a>` : ""}
        </span>
      </div>
      <div class="apply-error" hidden>
        Generate a resume for this first.
        <button class="dismiss-error-btn" aria-label="Dismiss">&times;</button>
      </div>
    </div>
  `;
}

let allJobs = [];

// Excludes senior-tier titles unconditionally — no UI toggle for this
// (there used to be a "Senior positions" checkbox; it's gone, and so is
// showing these at all). "senior"/"staff"/"principal" catches the modifier
// wherever it appears in the title (Senior Brand Designer, Staff Product
// Designer, etc.); the "sr." check catches the abbreviated form separately
// since it's not spelled out as a whole word.
function isSeniorTitle(job) {
  const title = job.title;
  return /\b(senior|staff|principal)\b/i.test(title) || /^sr\.?\s/i.test(title);
}

function renderJobs() {
  const query = searchQueries[currentTab].trim().toLowerCase();

  const jobs = allJobs
    .filter(matchesTab)
    .filter((job) => (locationFilter.value === "remote" ? isRemoteJob(job) : isLocalJob(job)))
    .filter(isDesignTitle)
    .filter((job) => !isSeniorTitle(job))
    .filter(
      (job) => !query || job.title.toLowerCase().includes(query) || job.company.toLowerCase().includes(query),
    );

  // Unlike Current/Archived (which just reflect date_found), "applied" and
  // "hidden" are explicit actions with their own timestamps (applied_date /
  // dismissed_at) — so show the most recent action first, ignoring the
  // priority-company grouping the other tabs use, so it actually reflects
  // the order things happened in.
  if (currentTab === "applied") {
    jobs.sort((a, b) => (b.applied_date ?? "").localeCompare(a.applied_date ?? ""));
  } else if (currentTab === "hidden") {
    jobs.sort((a, b) => (b.dismissed_at ?? "").localeCompare(a.dismissed_at ?? ""));
  }

  const emptyMessages = {
    current: `No jobs yet. Ask Claude to add the companies you want to track, then click "Scan for new jobs".`,
    applied: "Nothing here yet — jobs you mark as applied will show up in this tab.",
    archived: "Nothing archived yet — jobs land here automatically once they're no longer from today.",
    hidden: "Nothing hidden — jobs you hide will show up here.",
  };
  emptyEl.textContent = emptyMessages[currentTab];
  emptyEl.hidden = jobs.length > 0;

  // e.g. "Last 24 hours" -> "the last 24 hours", so it reads naturally
  // inline instead of duplicating a separate hours->label map that could
  // drift out of sync with the dropdown's own option text.
  const durationLabel = timeRangeFilter.options[timeRangeFilter.selectedIndex].text.replace(/^Last/, "the last");

  const filterNotes = {
    current: `Pulled ${jobs.length} job${jobs.length === 1 ? "" : "s"} over ${durationLabel}`,
    applied: "",
    archived: `Last cleared ${daysAgo(ARCHIVE_RETENTION_DAYS).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`,
    hidden: "",
  };
  filterNoteEl.textContent = filterNotes[currentTab];

  // Slice for the current page after all filtering/sorting above, so page
  // numbers stay relative to what's actually being looked at. Clamp instead
  // of resetting to 1 whenever possible, so e.g. deleting the last job on
  // page 3 drops you to the new last page rather than back to page 1.
  const totalPages = Math.max(1, Math.ceil(jobs.length / pageSize));
  currentPage = Math.min(currentPage, totalPages);
  const pageJobs = jobs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  paginationEl.hidden = jobs.length === 0;
  pageIndicatorEl.textContent = `Page ${currentPage} of ${totalPages}`;
  prevPageBtn.disabled = currentPage <= 1;
  nextPageBtn.disabled = currentPage >= totalPages;

  jobsEl.innerHTML = pageJobs.map(jobCard).join("");
  wireJobCardEvents();
}

async function loadJobs() {
  const res = await fetch("/api/jobs");
  allJobs = await res.json();
  renderJobs();
}

function wireJobCardEvents() {

  jobsEl.querySelectorAll(".card").forEach((card) => {
    const id = card.dataset.id;
    const company = card.dataset.company;
    const url = card.dataset.url;

    const requestBtn = card.querySelector(".request-btn");
    requestBtn?.addEventListener("click", async (e) => {
      e.target.disabled = true;
      e.target.textContent = "Requesting...";
      try {
        await fetch(`/api/jobs/${id}/request-generation`, { method: "POST" });
        await loadJobs();
        // Real backend flag either way (status "requested" + apply_order
        // assigned) — demo mode only adds this popup on top, standing in for
        // the real "Claude wrote your resume" moment for UX-testing purposes.
        if (demoMode) alert("Resume ready");
      } catch (err) {
        alert(`Failed to request generation: ${err.message}`);
        e.target.disabled = false;
        e.target.textContent = "Generate Resume";
      }
    });

    const applyErrorEl = card.querySelector(".apply-error");
    card.querySelector(".dismiss-error-btn")?.addEventListener("click", () => {
      applyErrorEl.hidden = true;
    });

    card.querySelector(".apply-btn")?.addEventListener("click", async (e) => {
      // Always clickable now — if no resume is ready yet, show the inline
      // dismissible error instead of doing anything, rather than disabling
      // the button up front.
      if (e.target.dataset.ready !== "true") {
        applyErrorEl.hidden = false;
        return;
      }
      applyErrorEl.hidden = true;

      // Disabled the moment it's pressed (already styled dark by default)
      // so it's visually clear the click registered instead of staying
      // pressable.
      e.target.disabled = true;

      if (demoMode) {
        alert("Job applied");
      } else {
        window.open(url, "_blank", "noopener");
      }

      // Applying is now considered done the moment you click through —
      // moves the job straight to the Applied Jobs tab.
      try {
        await fetch(`/api/jobs/${id}/mark-applied`, { method: "POST" });
        await loadJobs();
      } catch (err) {
        alert(`Failed to mark as applied: ${err.message}`);
        e.target.disabled = false;
      }
    });

    card.querySelector(".pipeline-select")?.addEventListener("change", async (e) => {
      const stage = e.target.value;
      const previousStage = e.target.dataset.current;
      e.target.disabled = true;
      try {
        await fetch(`/api/jobs/${id}/pipeline-stage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage }),
        });
        await loadJobs();
      } catch (err) {
        alert(`Failed to update status: ${err.message}`);
        e.target.value = previousStage;
        e.target.disabled = false;
      }
    });

    card.querySelector(".favorite-btn")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const favorited = btn.dataset.favorited !== "true";
      btn.disabled = true;
      try {
        await fetch(`/api/jobs/${id}/favorite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ favorited }),
        });
        await loadJobs();
      } catch (err) {
        alert(`Failed to ${favorited ? "favorite" : "unfavorite"}: ${err.message}`);
        btn.disabled = false;
      }
    });

    card.querySelector(".hide-btn")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const wasHidden = btn.dataset.hidden === "true";
      btn.disabled = true;
      try {
        await fetch(`/api/jobs/${id}/${wasHidden ? "unhide" : "dismiss"}`, { method: "POST" });
        await loadJobs();
      } catch (err) {
        alert(`Failed to ${wasHidden ? "unhide" : "hide"}: ${err.message}`);
        btn.disabled = false;
      }
    });

    const legitCheckbox = card.querySelector(".legit-checkbox");
    legitCheckbox?.addEventListener("change", async (e) => {
      const decent = e.target.checked;
      e.target.disabled = true;
      try {
        await fetch(`/api/verdicts/${encodeURIComponent(company)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decent }),
        });
        await loadJobs();
      } catch (err) {
        alert(`Failed to save: ${err.message}`);
        e.target.disabled = false;
        e.target.checked = !decent;
      }
    });
  });
}

dummyBtn.addEventListener("click", async () => {
  dummyBtn.disabled = true;
  try {
    // Always land in the Current tab, matching whichever of Remote/Local is
    // active, so the new job is guaranteed to be visible immediately.
    currentTab = "current";
    tabButtons.forEach((b) => b.classList.toggle("active", b.dataset.tab === "current"));
    searchInput.value = searchQueries.current;
    currentPage = 1;

    await fetch("/api/jobs/dummy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationType: locationFilter.value }),
    });
    await loadJobs();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    alert(`Failed to add dummy job: ${err.message}`);
  } finally {
    dummyBtn.disabled = false;
  }
});

undoBtn.addEventListener("click", async () => {
  undoBtn.disabled = true;
  try {
    const res = await fetch("/api/jobs/undo-dismiss", { method: "POST" });
    const result = await res.json();
    if (result.restored) {
      await loadJobs();
    } else {
      alert("Nothing to undo — no recently deleted job found.");
    }
  } catch (err) {
    alert(`Failed to undo: ${err.message}`);
  } finally {
    undoBtn.disabled = false;
  }
});

scanBtn.addEventListener("click", async () => {
  scanBtn.disabled = true;
  scanBtn.textContent = "Scanning...";
  try {
    const res = await fetch("/api/jobs/scan", { method: "POST" });
    const result = await res.json();
    await loadJobs();
    if (result.new === 0) {
      alert(`Scan complete — no new postings (${result.found} total checked).`);
    }
  } catch (err) {
    alert(`Scan failed: ${err.message}`);
  } finally {
    scanBtn.disabled = false;
    scanBtn.textContent = "Scan for new jobs";
  }
});

timeRangeFilter.addEventListener("change", () => {
  timeRangeHours = Number(timeRangeFilter.value);
  currentPage = 1;
  renderJobs();
});
locationFilter.addEventListener("change", () => {
  currentPage = 1;
  renderJobs();
});

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    currentTab = btn.dataset.tab;
    tabButtons.forEach((b) => b.classList.toggle("active", b === btn));
    searchInput.value = searchQueries[currentTab];
    currentPage = 1;
    renderJobs();
  });
});

searchInput.addEventListener("input", () => {
  searchQueries[currentTab] = searchInput.value;
  currentPage = 1;
  renderJobs();
});

prevPageBtn.addEventListener("click", () => {
  currentPage = Math.max(1, currentPage - 1);
  renderJobs();
  window.scrollTo({ top: 0, behavior: "smooth" });
});
nextPageBtn.addEventListener("click", () => {
  currentPage += 1;
  renderJobs();
  window.scrollTo({ top: 0, behavior: "smooth" });
});
pageSizeSelect.addEventListener("change", () => {
  pageSize = Number(pageSizeSelect.value);
  currentPage = 1;
  renderJobs();
});

loadJobs();
