import { isDesignTitle, matchesCityFilter } from "./shared/jobFilters.js";

// Mirrors PIPELINE_STAGES in src/db/client.ts — the server validates against
// its own copy, so this only controls what the dropdown offers, not what's
// actually accepted.
const PIPELINE_STAGES = ["applied", "recruiter", "interview", "offer", "ghosted"];

const jobsEl = document.getElementById("jobs");
const emptyEl = document.getElementById("empty");
const scanBtn = document.getElementById("scan-btn");
const undoBtn = document.getElementById("undo-btn");
const dummyBtn = document.getElementById("dummy-btn");
const dummyBtnLabel = document.getElementById("dummy-btn-label");
const timeRangeFilter = document.getElementById("time-range-filter");
const cityFilter = document.getElementById("city-filter");
const radiusFilter = document.getElementById("radius-filter");
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
const applyNoticeEl = document.getElementById("apply-notice");
const applyNoticeTextEl = document.getElementById("apply-notice-text");
const applyNoticeDismissBtn = document.getElementById("apply-notice-dismiss");
const addJobModal = document.getElementById("add-job-modal");
const addJobUrlInput = document.getElementById("add-job-url-input");
const addJobError = document.getElementById("add-job-error");
const addJobCancelBtn = document.getElementById("add-job-cancel-btn");
const addJobSubmitBtn = document.getElementById("add-job-submit-btn");
const settingsGearBtn = document.getElementById("settings-gear-btn");
const settingsMenu = document.getElementById("settings-menu");
const jobSettingsBtn = document.getElementById("job-settings-btn");
const userSettingsBtn = document.getElementById("user-settings-btn");
const jobSettingsOverlay = document.getElementById("job-settings-overlay");
const jobSettingsCloseBtn = document.getElementById("job-settings-close-btn");
const jobSettingsSaveBtn = document.getElementById("job-settings-save-btn");
const jobSettingsClearAllCheck = document.getElementById("job-settings-clear-all-check");
const drawerTabButtons = document.querySelectorAll(".drawer-tab-btn");
const userSettingsOverlay = document.getElementById("user-settings-overlay");
const userSettingsCloseBtn = document.getElementById("user-settings-close-btn");
const userScanCityInput = document.getElementById("user-scan-city-input");
const userScanRadiusSelect = document.getElementById("user-scan-radius-select");
const userSettingsSaveBtn = document.getElementById("user-settings-save-btn");
const userSettingsClearAllCheck = document.getElementById("user-settings-clear-all-check");
const resumeCurrentRow = document.getElementById("resume-current-row");
const resumeCurrentLink = document.getElementById("resume-current-link");
const resumeRemoveBtn = document.getElementById("resume-remove-btn");
const resumeFileInput = document.getElementById("resume-file-input");
const resumeUploadBtn = document.getElementById("resume-upload-btn");
const resumeError = document.getElementById("resume-error");
let currentTab = "current";
// The job.id most recently added via URL import — pinned above the usual
// priority/favorite sort in renderJobs() so it's guaranteed visible at the
// very top of New Jobs, matching the point of importing it in the first
// place. Stays pinned for the rest of the session (or until the next
// import replaces it); resets naturally on reload.
let justImportedJobId = null;
let currentPage = 1;
let pageSize = Number(pageSizeSelect.value);
// Hours back from now that counts as "New Jobs" — the complement (older
// than this) is "Past Jobs". Driven by the time-range dropdown instead of
// being a fixed same-calendar-day check.
let timeRangeHours = Number(timeRangeFilter.value);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

applyNoticeDismissBtn.addEventListener("click", () => {
  applyNoticeEl.hidden = true;
});

// Demo mode: everything works exactly like normal mode (real API calls,
// real apply_order assignment, real navigation) — the one difference is
// "Apply with AI fill" unlocks right after "Optimize CV" is clicked instead
// of waiting for someone to actually generate the tailored documents (see
// applyEnabled in jobCard). Lets the flow be demoed end-to-end without that
// generation step. Persisted so it survives a reload. It also swaps "Add
// job" to "Add demo job" and keeps that button on the old fake-data insert
// instead of the real URL-import flow (see dummyBtn's click handler).
let demoMode = localStorage.getItem("demoMode") === "true";
demoModeToggle.checked = demoMode;
dummyBtnLabel.textContent = demoMode ? "Add demo job" : "Add job";
demoModeToggle.addEventListener("change", () => {
  demoMode = demoModeToggle.checked;
  localStorage.setItem("demoMode", String(demoMode));
  dummyBtnLabel.textContent = demoMode ? "Add demo job" : "Add job";
  renderJobs();
});

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
  x: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  flag: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="3"/></svg>`,
};

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function jobCard(job) {
  const hasDocs = Boolean(job.resume_path && job.cover_letter_path);
  const isHidden = job.status === "dismissed";
  // A hidden job's real status is "dismissed", which would otherwise make
  // it look like it was never applied to — previous_status (stashed by
  // dismissJob, see db/client.ts) is what it actually was right before
  // hiding, so the card keeps rendering the same controls (and the star in
  // the same position) it had in its original tab.
  const effectiveStatus = isHidden ? (job.previous_status ?? job.status) : job.status;
  const isApplied = effectiveStatus === "applied";
  // For found/requested jobs this would just repeat the company name the
  // title already shows ("Title — Company") — only worth a badge once it's
  // saying something the title doesn't. Hidden Jobs already has its own tab
  // label for that, so "dismissed" doesn't need repeating here either —
  // only "applied"/"prepared" actually add information.
  const statusBadge =
    job.status === "found" || job.status === "requested" || job.status === "dismissed"
      ? ""
      : `<span class="status">${escapeHtml(job.status)}</span>`;
  const favoriteControl = `<button class="favorite-btn" data-favorited="${job.favorited ? "true" : "false"}" title="${job.favorited ? "Unfavorite" : "Favorite"}">${job.favorited ? icons.starFilled : icons.starOutline}</button>`;
  // On every tab — a permanent, non-reversible delete (see excludeJob in
  // db/client.ts), distinct from Hide (which is reversible and keeps the
  // job around in Hidden Jobs).
  const excludeControl = `<button class="exclude-btn" title="Delete — this job cannot be fetched again" aria-label="Delete">${icons.x}</button>`;

  // Toggles between the two actions instead of being two separate buttons —
  // "Hide" (dismissJob) stashes the job's current status so "Unhide"
  // (unhideJob) can put it back in whatever tab it came from, per-card
  // rather than only being able to undo the single most recent hide.
  const hideControl = isHidden
    ? `<button class="hide-btn" data-hidden="true" title="Unhide" aria-label="Unhide">${icons.eye}</button>`
    : `<button class="hide-btn" data-hidden="false" title="Hide" aria-label="Hide">${icons.eyeOff}</button>`;

  // On every tab — flags the whole company as a scam (see blockCompany in
  // db/client.ts), not just this one posting: every job of theirs already
  // tracked gets excluded too, and future scans/imports skip the company
  // entirely. Distinct from Exclude/Delete, which only ever touches the
  // single job it's clicked on.
  const flagCompanyControl = `<button class="flag-company-btn" title="Flag company — block ${escapeHtml(job.company)} as a scam company" aria-label="Flag company">${icons.flag}</button>`;

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
  const priorityBadge = job.priority ? `<span class="priority">Verified</span>` : "";
  // A manual way to mark a not-yet-verified company as legitimate. Checking
  // it does nothing on its own — the verdict only actually saves at the
  // moment "Apply with AI prefill" is clicked (see that handler below).
  // Checked state is tracked in pendingVerifiedJobIds, not just left on the
  // DOM element, so it survives Generate Resume/Hide/favorite/etc. — all of
  // which re-render this card from scratch. Hidden once the company is
  // already priority (redundant with the "Verified" badge above) or once
  // you've actually applied, since the legitimacy call stops mattering then.
  const legitControl = !job.priority && !isApplied
    ? `<label class="legit-check"><input type="checkbox" class="legit-checkbox" ${pendingVerifiedJobIds.has(job.id) ? "checked" : ""} /> Verify Company</label>`
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

  // Pill order/contents differ by tab: New Jobs swaps source before date;
  // Applied Jobs drops the date pill entirely and shows source before the
  // "applied" status pill; Past/Hidden keep the original status-date-source
  // order.
  const badgeGroup =
    currentTab === "applied"
      ? `${sourceBadge}${statusBadge}`
      : currentTab === "current"
        ? `${statusBadge}${sourceBadge}${dateBadge}`
        : `${statusBadge}${dateBadge}${sourceBadge}`;

  return `
    <div class="card ${job.priority ? "priority-card" : ""}" data-id="${job.id}" data-company="${escapeHtml(job.company)}" data-url="${escapeHtml(job.url)}">
      <div class="card-header">
        <h3 class="card-title"><a href="${escapeHtml(job.url)}" target="_blank" rel="noopener" class="title-link">${escapeHtml(job.title)}</a> — <span class="company">${escapeHtml(job.company)}</span></h3>
        <div class="card-badges">
          ${priorityBadge}
          ${badgeGroup}
        </div>
      </div>
      <div class="meta">
        ${[isApplied && job.applied_date ? formatAppliedWhen(job.applied_date) : "", isLocalJob(job) && job.location ? escapeHtml(job.location) : ""]
          .filter(Boolean)
          .join(" · ")}
      </div>
      <div class="actions">
        ${generateControl}
        ${isApplied ? favoriteControl : ""}
        ${applyControl}
        ${isApplied ? "" : favoriteControl}
        ${hideControl}
        ${flagCompanyControl}
        ${excludeControl}
        <span class="links">
          ${applyOrderBadge}
          ${legitControl}
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
// Job ids whose "Verify Company" checkbox is currently checked but not yet
// saved (that only happens at apply-time — see the apply-btn handler).
// Every other action on a card (Generate Resume, Hide, favoriting, etc.)
// re-fetches and re-renders the whole card from scratch, which would wipe a
// plain unattached checkbox back to unchecked — tracking it here instead of
// relying on the DOM element's own state means jobCard() can always render
// the box in whatever state the user actually left it in, regardless of how
// many re-renders happen in between.
const pendingVerifiedJobIds = new Set();

function renderJobs() {
  const query = searchQueries[currentTab].trim().toLowerCase();

  // Any job added via URL import (job.manually_imported, persisted — not
  // just the one from this page session) is exempt from every content
  // filter below (location, design-title, search): the user explicitly
  // chose to add that exact posting, so it should always stay visible, full
  // stop, regardless of what it's about, how it's worded, or how much later
  // this page gets reloaded. Only matchesTab still applies. Separately, the
  // most recently imported one (justImportedJobId, session-only) also gets
  // pinned to the very top of New Jobs — see the sort below — as immediate
  // feedback right after adding it. Note isDesignTitle here is a second,
  // redundant pass over what the server already filtered — kept only
  // because search/location filtering happens client-side too and this
  // keeps the combined logic in one place; the server's own copy (plus its
  // includeTerms/excludeTerms from Job Settings, which have no client-side
  // equivalent) is what actually keeps non-design/senior/etc. titles out of
  // allJobs in the first place.
  const city = cityFilter.value.trim().toLowerCase();
  const radiusMiles = Number(radiusFilter.value);
  const jobs = allJobs
    .filter(matchesTab)
    .filter(
      (job) =>
        job.manually_imported ||
        (locationFilter.value === "remote" ? isRemoteJob(job) : isLocalJob(job)),
    )
    .filter((job) => job.manually_imported || matchesCityFilter(job.location, city, radiusMiles))
    .filter((job) => job.manually_imported || isDesignTitle(job))
    .filter(
      (job) =>
        job.manually_imported ||
        !query ||
        job.title.toLowerCase().includes(query) ||
        job.company.toLowerCase().includes(query),
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

  // Favorited jobs always float to the top of whichever tab they're in —
  // Array.sort is stable, so this only reorders by favorited status and
  // otherwise keeps the ordering already established above (survives
  // reloads since it's derived from the persisted `favorited` column, not
  // any client-side state).
  jobs.sort((a, b) => (b.favorited ? 1 : 0) - (a.favorited ? 1 : 0));

  // A job just added via URL import goes to the very top of New Jobs,
  // above even priority/favorited — that's the whole point of adding it.
  if (currentTab === "current" && justImportedJobId !== null) {
    jobs.sort((a, b) => (b.id === justImportedJobId ? 1 : 0) - (a.id === justImportedJobId ? 1 : 0));
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

  // The actual cutoff date/time the time-range dropdown implies — Past Jobs
  // is everything found before this point.
  const cutoffDate = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const filterNotes = {
    current: `Pulled ${jobs.length} job${jobs.length === 1 ? "" : "s"} over ${durationLabel}`,
    applied: "",
    archived: `All jobs before ${cutoffDate}`,
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

    // 1-second minimum spinner on New Jobs specifically — purely a UX
    // touch (Promise.all with a timer means it shows for at least 1s even
    // if the request itself is instant), scoped to that tab since it's the
    // only place these two buttons were asked to animate.
    const useSpinner = currentTab === "current";

    const requestBtn = card.querySelector(".request-btn");
    requestBtn?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const originalHTML = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = useSpinner ? `<span class="spinner"></span> ${originalHTML}` : "Requesting...";
      try {
        const task = fetch(`/api/jobs/${id}/request-generation`, { method: "POST" });
        await (useSpinner ? Promise.all([task, sleep(1000)]) : task);
        await loadJobs();
        // Real backend flag either way (status "requested" + apply_order
        // assigned) — demo mode only adds this popup on top, standing in for
        // the real "Claude wrote your resume" moment for UX-testing purposes.
        if (demoMode) alert("Resume ready");
      } catch (err) {
        alert(`Failed to request generation: ${err.message}`);
        btn.disabled = false;
        btn.innerHTML = originalHTML;
      }
    });

    const applyErrorEl = card.querySelector(".apply-error");
    card.querySelector(".dismiss-error-btn")?.addEventListener("click", () => {
      applyErrorEl.hidden = true;
    });

    card.querySelector(".apply-btn")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      // Always clickable now — if no resume is ready yet, show the inline
      // dismissible error instead of doing anything, rather than disabling
      // the button up front.
      if (btn.dataset.ready !== "true") {
        applyErrorEl.hidden = false;
        return;
      }
      applyErrorEl.hidden = true;

      const originalHTML = btn.innerHTML;
      btn.disabled = true;
      if (useSpinner) btn.innerHTML = `<span class="spinner"></span> ${originalHTML}`;

      window.open(url, "_blank", "noopener");
      if (demoMode) alert("Job applied");

      // "Verify Company" (if present and checked) only actually saves right
      // here, at the moment of applying — see the checkbox's own comment
      // for why it does nothing on its own.
      const verdictTask = pendingVerifiedJobIds.has(Number(id))
        ? fetch(`/api/verdicts/${encodeURIComponent(company)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ decent: true }),
          })
        : Promise.resolve();
      pendingVerifiedJobIds.delete(Number(id));

      // Applying is now considered done the moment you click through —
      // moves the job straight to the Applied Jobs tab.
      try {
        const task = Promise.all([fetch(`/api/jobs/${id}/mark-applied`, { method: "POST" }), verdictTask]);
        await (useSpinner ? Promise.all([task, sleep(1000)]) : task);
        // Only New Jobs cards get this banner — Hidden Jobs also has an
        // apply-btn (for a not-yet-applied job that was hidden), and that
        // flow shouldn't claim credit for a "New Jobs" confirmation.
        if (currentTab === "current") {
          applyNoticeTextEl.textContent = "The applied job opened in a new tab — it's now in your Applied Jobs tab.";
          applyNoticeEl.hidden = false;
        }
        await loadJobs();
        if (currentTab === "current") window.scrollTo(0, 0);
      } catch (err) {
        alert(`Failed to mark as applied: ${err.message}`);
        btn.disabled = false;
        btn.innerHTML = originalHTML;
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

    card.querySelector(".exclude-btn")?.addEventListener("click", async (e) => {
      if (!confirm("Delete this job? It cannot be fetched again.")) return;
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        await fetch(`/api/jobs/${id}/exclude`, { method: "POST" });
        await loadJobs();
      } catch (err) {
        alert(`Failed to exclude: ${err.message}`);
        btn.disabled = false;
      }
    });

    card.querySelector(".flag-company-btn")?.addEventListener("click", async (e) => {
      if (!confirm(`Flag ${company} as a scam company? All of their postings will be removed and they won't be added again.`)) return;
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        await fetch(`/api/jobs/${id}/flag-company`, { method: "POST" });
        await loadJobs();
      } catch (err) {
        alert(`Failed to flag company: ${err.message}`);
        btn.disabled = false;
      }
    });

    // "Verify Company" doesn't fire anything on its own — checking it here
    // is purely a local, unsaved intention (see pendingVerifiedJobIds). The
    // verdict only actually gets recorded when "Apply with AI prefill" is
    // clicked (see that handler below). Checking it and then never applying
    // — or unchecking it again before applying — has no effect at all, by
    // design. This listener's only job is remembering the checked state
    // across re-renders (Generate Resume, Hide, favoriting, etc. all
    // rebuild this card from scratch, which would otherwise silently wipe a
    // plain checkbox back to unchecked).
    card.querySelector(".legit-checkbox")?.addEventListener("change", (e) => {
      if (e.target.checked) pendingVerifiedJobIds.add(Number(id));
      else pendingVerifiedJobIds.delete(Number(id));
    });
  });
}

// Always lands on the New Jobs tab, matching whichever of Remote/Local is
// active, so a freshly added job is guaranteed to be visible immediately.
function landOnNewJobsTab() {
  currentTab = "current";
  tabButtons.forEach((b) => b.classList.toggle("active", b.dataset.tab === "current"));
  searchInput.value = searchQueries.current;
  currentPage = 1;
}

dummyBtn.addEventListener("click", async () => {
  // Demo mode keeps the old fake-data button entirely — outside demo mode,
  // "Add job" now imports a real posting by URL instead (see the modal
  // handlers below).
  if (!demoMode) {
    addJobError.hidden = true;
    addJobUrlInput.value = "";
    addJobModal.hidden = false;
    addJobUrlInput.focus();
    return;
  }

  dummyBtn.disabled = true;
  try {
    landOnNewJobsTab();
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

addJobCancelBtn.addEventListener("click", () => {
  addJobModal.hidden = true;
});

// The gear menu by "Scan for new jobs" — Facebook-style dropdown, closes on
// an outside click, Escape, or picking an item. "User settings" doesn't go
// anywhere yet; "Job settings" opens the slide-out drawer below.
function closeSettingsMenu() {
  settingsMenu.hidden = true;
  settingsGearBtn.setAttribute("aria-expanded", "false");
}

settingsGearBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const willOpen = settingsMenu.hidden;
  settingsMenu.hidden = !willOpen;
  settingsGearBtn.setAttribute("aria-expanded", String(willOpen));
});

document.addEventListener("click", (e) => {
  if (!settingsMenu.hidden && !e.target.closest(".settings-wrap")) closeSettingsMenu();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !settingsMenu.hidden) closeSettingsMenu();
});

// --- Job Settings drawer ---------------------------------------------

// The in-progress edit — loaded fresh from the server each time the drawer
// opens, only written back on Save (so closing without saving discards it).
let jobSettingsDraft = { priorityCompanies: [], bannedCompanies: [], includeTerms: [], excludeTerms: [] };
// Each Companies accordion (add/ban) has its own search box now, scoped to
// just that list — with 126+ companies possible in "add" alone, finding
// one by scrolling isn't practical, and a single shared search box made
// searching one list hide unrelated matches in the other. Filters the
// rendered chips only, never the underlying draft, so it can't accidentally
// remove anything from what gets saved. Only set for the two company keys;
// the Job Title tab's lists (includeTerms/excludeTerms) are short enough
// not to need this.
const companySearchQueries = { priorityCompanies: "", bannedCompanies: "" };

function renderTermList(key) {
  const container = document.querySelector(`[data-list-el="${key}"]`);
  const isBanList = key === "bannedCompanies" || key === "excludeTerms";
  const allItems = jobSettingsDraft[key];
  const query = companySearchQueries[key];
  const items = query ? allItems.filter((item) => item.toLowerCase().includes(query)) : allItems;
  if (allItems.length === 0) {
    container.innerHTML = `<span class="term-empty">None yet</span>`;
    return;
  }
  if (items.length === 0) {
    container.innerHTML = `<span class="term-empty">No matches</span>`;
    return;
  }
  container.innerHTML = items
    .map(
      (item) => `
        <span class="term-chip ${isBanList ? "ban-color" : "add-color"}">
          ${escapeHtml(item)}
          <button class="term-chip-remove" data-remove="${key}" data-value="${escapeHtml(item)}" aria-label="Remove ${escapeHtml(item)}">${icons.x}</button>
        </span>
      `,
    )
    .join("");
}

function updateTermCount(key) {
  const countEl = document.querySelector(`[data-count="${key}"]`);
  if (countEl) countEl.textContent = `(${jobSettingsDraft[key].length})`;
}

// Companies to add/ban are collapsed by default every time the drawer
// opens — with 100+ companies possible in "add" alone, showing both lists
// expanded made the drawer unusably long. Search box and "+" add button
// only make sense (and only show, since they're inside the same body) once
// a section is actually open.
function setSectionCollapsed(key, collapsed) {
  const toggle = document.querySelector(`[data-collapse-toggle="${key}"]`);
  const body = document.querySelector(`[data-accordion-body="${key}"]`);
  toggle.setAttribute("aria-expanded", String(!collapsed));
  body.hidden = collapsed;
  if (collapsed) document.querySelector(`[data-input-for="${key}"]`).hidden = true;
}

document.querySelectorAll(".term-collapse-toggle").forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const key = toggle.dataset.collapseToggle;
    const isExpanded = toggle.getAttribute("aria-expanded") === "true";
    setSectionCollapsed(key, isExpanded);
  });
});

document.querySelectorAll("[data-company-search]").forEach((input) => {
  input.addEventListener("input", () => {
    const key = input.dataset.companySearch;
    companySearchQueries[key] = input.value.trim().toLowerCase();
    renderTermList(key);
  });
});

function renderAllTermLists() {
  ["priorityCompanies", "bannedCompanies", "includeTerms", "excludeTerms"].forEach((key) => {
    renderTermList(key);
    updateTermCount(key);
  });
}

async function openJobSettingsDrawer() {
  closeSettingsMenu();
  jobSettingsClearAllCheck.checked = false;
  companySearchQueries.priorityCompanies = "";
  companySearchQueries.bannedCompanies = "";
  document.querySelectorAll("[data-company-search]").forEach((input) => {
    input.value = "";
  });
  setSectionCollapsed("priorityCompanies", true);
  setSectionCollapsed("bannedCompanies", true);
  try {
    jobSettingsDraft = await (await fetch("/api/jobs/job-settings")).json();
  } catch (err) {
    alert(`Failed to load job settings: ${err.message}`);
    return;
  }
  renderAllTermLists();
  jobSettingsOverlay.hidden = false;
}

function closeJobSettingsDrawer() {
  jobSettingsOverlay.hidden = true;
  document.querySelectorAll(".term-input-row").forEach((row) => {
    row.hidden = true;
  });
}

jobSettingsBtn.addEventListener("click", openJobSettingsDrawer);
jobSettingsCloseBtn.addEventListener("click", closeJobSettingsDrawer);
jobSettingsOverlay.addEventListener("click", (e) => {
  if (e.target === jobSettingsOverlay) closeJobSettingsDrawer();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !jobSettingsOverlay.hidden) closeJobSettingsDrawer();
});

drawerTabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    drawerTabButtons.forEach((b) => b.classList.toggle("active", b === btn));
    document.getElementById("drawer-pane-companies").hidden = btn.dataset.drawerTab !== "companies";
    document.getElementById("drawer-pane-title").hidden = btn.dataset.drawerTab !== "title";
  });
});

document.querySelectorAll(".term-add-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.list;
    const row = document.querySelector(`[data-input-for="${key}"]`);
    row.hidden = !row.hidden;
    if (!row.hidden) row.querySelector("input").focus();
  });
});

function addTermFromInput(key) {
  const input = document.querySelector(`[data-input="${key}"]`);
  const value = input.value.trim();
  if (!value) return;
  const exists = jobSettingsDraft[key].some((v) => v.toLowerCase() === value.toLowerCase());
  if (!exists) jobSettingsDraft[key].push(value);
  input.value = "";
  document.querySelector(`[data-input-for="${key}"]`).hidden = true;
  renderTermList(key);
  updateTermCount(key);
}

document.querySelectorAll("[data-confirm]").forEach((btn) => {
  btn.addEventListener("click", () => addTermFromInput(btn.dataset.confirm));
});

document.querySelectorAll("[data-input]").forEach((input) => {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTermFromInput(input.dataset.input);
    }
  });
});

document.querySelectorAll(".drawer-body").forEach((body) => {
  body.addEventListener("click", (e) => {
    const removeBtn = e.target.closest("[data-remove]");
    if (!removeBtn) return;
    const key = removeBtn.dataset.remove;
    const value = removeBtn.dataset.value;
    jobSettingsDraft[key] = jobSettingsDraft[key].filter((v) => v !== value);
    renderTermList(key);
    updateTermCount(key);
  });
});

jobSettingsSaveBtn.addEventListener("click", async () => {
  const clearAll = jobSettingsClearAllCheck.checked;
  if (
    clearAll &&
    !confirm(
      "This will permanently delete ALL jobs — including your Applied and Hidden job history — before rescanning. This cannot be undone. Continue?",
    )
  ) {
    return;
  }

  const originalHTML = jobSettingsSaveBtn.innerHTML;
  jobSettingsSaveBtn.disabled = true;
  // Saving now also triggers a full rescan (see the server route) so
  // changed criteria apply to fresh postings right away — that takes a lot
  // longer than a plain save, so show it's actually working.
  jobSettingsSaveBtn.innerHTML = `<span class="spinner"></span> Saving & scanning...`;
  try {
    const res = await fetch("/api/jobs/job-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...jobSettingsDraft, clearAll }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Save failed.");
    closeJobSettingsDrawer();
    landOnNewJobsTab();
    await loadJobs();
    applyNoticeTextEl.textContent = "New jobs have been pulled based on your latest settings.";
    applyNoticeEl.hidden = false;
    window.scrollTo(0, 0);
  } catch (err) {
    alert(`Failed to save job settings: ${err.message}`);
  } finally {
    jobSettingsSaveBtn.disabled = false;
    jobSettingsSaveBtn.innerHTML = originalHTML;
  }
});

// --- User Settings drawer ---------------------------------------------

function renderResumeState(resumeFilename) {
  if (resumeFilename) {
    resumeCurrentLink.href = `/webapp-docs/${encodeURIComponent(resumeFilename)}`;
    resumeCurrentLink.textContent = resumeFilename;
    resumeCurrentRow.hidden = false;
  } else {
    resumeCurrentRow.hidden = true;
  }
}

async function openUserSettingsDrawer() {
  closeSettingsMenu();
  resumeError.hidden = true;
  resumeFileInput.value = "";
  userSettingsClearAllCheck.checked = false;
  try {
    const settings = await (await fetch("/api/user-settings")).json();
    userScanCityInput.value = settings.scanLocation?.city ?? "";
    userScanRadiusSelect.value = String(settings.scanLocation?.radiusMiles ?? 0);
    renderResumeState(settings.resumeFilename);
  } catch (err) {
    alert(`Failed to load user settings: ${err.message}`);
    return;
  }
  userSettingsOverlay.hidden = false;
}

function closeUserSettingsDrawer() {
  userSettingsOverlay.hidden = true;
}

userSettingsBtn.addEventListener("click", openUserSettingsDrawer);
userSettingsCloseBtn.addEventListener("click", closeUserSettingsDrawer);
userSettingsOverlay.addEventListener("click", (e) => {
  if (e.target === userSettingsOverlay) closeUserSettingsDrawer();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !userSettingsOverlay.hidden) closeUserSettingsDrawer();
});

userSettingsSaveBtn.addEventListener("click", async () => {
  const clearAll = userSettingsClearAllCheck.checked;
  if (
    clearAll &&
    !confirm(
      "This will permanently delete ALL jobs — including your Applied and Hidden job history — before rescanning. This cannot be undone. Continue?",
    )
  ) {
    return;
  }

  const originalHTML = userSettingsSaveBtn.innerHTML;
  userSettingsSaveBtn.disabled = true;
  // Saving also triggers a full rescan (see the server route), same as Job
  // Settings — show it's actually working, since that takes a while.
  userSettingsSaveBtn.innerHTML = `<span class="spinner"></span> Saving & scanning...`;
  try {
    const res = await fetch("/api/user-settings/scan-location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        city: userScanCityInput.value.trim(),
        radiusMiles: Number(userScanRadiusSelect.value),
        clearAll,
      }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Save failed.");
    closeUserSettingsDrawer();
    landOnNewJobsTab();
    await loadJobs();
    applyNoticeTextEl.textContent = "New jobs have been pulled based on your latest settings.";
    applyNoticeEl.hidden = false;
    window.scrollTo(0, 0);
  } catch (err) {
    alert(`Failed to save scan location: ${err.message}`);
  } finally {
    userSettingsSaveBtn.disabled = false;
    userSettingsSaveBtn.innerHTML = originalHTML;
  }
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

resumeUploadBtn.addEventListener("click", async () => {
  const file = resumeFileInput.files[0];
  if (!file) {
    resumeError.textContent = "Choose a file first.";
    resumeError.hidden = false;
    return;
  }
  resumeUploadBtn.disabled = true;
  resumeError.hidden = true;
  try {
    const dataBase64 = await fileToBase64(file);
    const res = await fetch("/api/user-settings/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, dataBase64 }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error ?? "Upload failed.");
    renderResumeState(result.resumeFilename);
    resumeFileInput.value = "";
  } catch (err) {
    resumeError.textContent = err.message;
    resumeError.hidden = false;
  } finally {
    resumeUploadBtn.disabled = false;
  }
});

resumeRemoveBtn.addEventListener("click", async () => {
  if (!confirm("Remove the uploaded resume?")) return;
  resumeRemoveBtn.disabled = true;
  try {
    await fetch("/api/user-settings/resume", { method: "DELETE" });
    renderResumeState(null);
  } catch (err) {
    alert(`Failed to remove resume: ${err.message}`);
  } finally {
    resumeRemoveBtn.disabled = false;
  }
});

addJobSubmitBtn.addEventListener("click", async () => {
  const url = addJobUrlInput.value.trim();
  if (!url) {
    addJobError.textContent = "Paste a job posting URL first.";
    addJobError.hidden = false;
    return;
  }
  addJobSubmitBtn.disabled = true;
  addJobError.hidden = true;
  try {
    const res = await fetch("/api/jobs/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error ?? "Import failed.");
    addJobModal.hidden = true;
    landOnNewJobsTab();
    // Bypasses the Remote/Local filter entirely (see renderJobs) and pins
    // to the top of New Jobs — guaranteed visible regardless of which
    // filter was active when it was imported, or how its location text
    // happens to classify.
    if (result.job) justImportedJobId = result.job.id;
    await loadJobs();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    addJobError.textContent = err.message;
    addJobError.hidden = false;
  } finally {
    addJobSubmitBtn.disabled = false;
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
cityFilter.addEventListener("input", () => {
  currentPage = 1;
  renderJobs();
});
radiusFilter.addEventListener("change", () => {
  currentPage = 1;
  renderJobs();
});

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    currentTab = btn.dataset.tab;
    tabButtons.forEach((b) => b.classList.toggle("active", b === btn));
    searchInput.value = searchQueries[currentTab];
    currentPage = 1;
    // The apply-notice banner is New Jobs-only — otherwise it stays
    // visible (nothing else hides it) as you switch to unrelated tabs.
    applyNoticeEl.hidden = true;
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
