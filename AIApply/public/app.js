import { isDesignTitle, matchesCityFilter } from "./shared/jobFilters.js";
import { COMPANY_CATEGORIES } from "./shared/companyCategories.js";

// Mirrors PIPELINE_STAGES in src/db/client.ts — the server validates against
// its own copy, so this only controls what the dropdown offers, not what's
// actually accepted.
const PIPELINE_STAGES = ["applied", "recruiter", "interview", "offer", "ghosted"];

const jobsEl = document.getElementById("jobs");
const emptyEl = document.getElementById("empty");
const scanBtn = document.getElementById("scan-btn");
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
const profileGateNotice = document.getElementById("profile-gate-notice");
const profileGateDismissBtn = document.getElementById("profile-gate-dismiss");
const addJobModal = document.getElementById("add-job-modal");
const addJobUrlInput = document.getElementById("add-job-url-input");
const addJobError = document.getElementById("add-job-error");
const addJobCancelBtn = document.getElementById("add-job-cancel-btn");
const addJobSubmitBtn = document.getElementById("add-job-submit-btn");
const jobSettingsBtn = document.getElementById("job-settings-btn");
const jobSettingsOverlay = document.getElementById("job-settings-overlay");
const jobSettingsCloseBtn = document.getElementById("job-settings-close-btn");
const jobSettingsSaveBtn = document.getElementById("job-settings-save-btn");
const jobSettingsClearAllCheck = document.getElementById("job-settings-clear-all-check");
const jobSettingsMessage = document.getElementById("job-settings-message");
const drawerTabButtons = document.querySelectorAll(".drawer-tab-btn");
const userFirstNameInput = document.getElementById("user-first-name-input");
const userLastNameInput = document.getElementById("user-last-name-input");
const userEmailInput = document.getElementById("user-email-input");
const userScanCityInput = document.getElementById("user-scan-city-input");
const userScanRadiusSelect = document.getElementById("user-scan-radius-select");
const userScanLocationCurrentRow = document.getElementById("user-scan-location-current");
const userScanLocationCurrentLabel = document.getElementById("user-scan-location-current-label");
const userScanLocationRemoveBtn = document.getElementById("user-scan-location-remove-btn");
const resumeCurrentRow = document.getElementById("resume-current-row");
const resumeCurrentLink = document.getElementById("resume-current-link");
const resumeRemoveBtn = document.getElementById("resume-remove-btn");
const resumeFileInput = document.getElementById("resume-file-input");
const resumeUploadBtn = document.getElementById("resume-upload-btn");
const resumeError = document.getElementById("resume-error");
const userAiOptoutCheck = document.getElementById("user-ai-optout-check");
const getStartedBtn = document.getElementById("get-started-btn");
const onboardingPanel = document.getElementById("onboarding-panel");
const onboardingFinishBtn = document.getElementById("onboarding-finish-btn");
const onboardingSkipBtn = document.getElementById("onboarding-skip-btn");
const onboardingFormSection = document.getElementById("onboarding-form-section");
const onboardingLoading = document.getElementById("onboarding-loading");
const onboardingProgressFill = document.getElementById("onboarding-progress-fill");
const onboardingLoadingMessage = document.getElementById("onboarding-loading-message");
const onboardingFirstNameInput = document.getElementById("onboarding-first-name-input");
const onboardingLastNameInput = document.getElementById("onboarding-last-name-input");
const onboardingEmailInput = document.getElementById("onboarding-email-input");
const onboardingResumeCurrentRow = document.getElementById("onboarding-resume-current-row");
const onboardingResumeCurrentLink = document.getElementById("onboarding-resume-current-link");
const onboardingResumeRemoveBtn = document.getElementById("onboarding-resume-remove-btn");
const onboardingResumeFileInput = document.getElementById("onboarding-resume-file-input");
const onboardingResumeUploadBtn = document.getElementById("onboarding-resume-upload-btn");
const onboardingResumeError = document.getElementById("onboarding-resume-error");
const onboardingAiOptoutCheck = document.getElementById("onboarding-ai-optout-check");
const onboardingScanCityInput = document.getElementById("onboarding-scan-city-input");
const onboardingScanRadiusSelect = document.getElementById("onboarding-scan-radius-select");
const onboardingScanLocationCurrentRow = document.getElementById("onboarding-scan-location-current");
const onboardingScanLocationCurrentLabel = document.getElementById("onboarding-scan-location-current-label");
const onboardingScanLocationRemoveBtn = document.getElementById("onboarding-scan-location-remove-btn");
const onboardingCompaniesRequired = document.getElementById("onboarding-companies-required");
const onboardingTitleRequired = document.getElementById("onboarding-title-required");
const onboardingResumeRequired = document.getElementById("onboarding-resume-required");
const onboardingLocationRequired = document.getElementById("onboarding-location-required");
const onboardingError = document.getElementById("onboarding-error");
const filterRowEl = document.querySelector(".filter-row");
const pageFooterEl = document.querySelector(".page-footer");
// Gates the job list on every tab behind the onboarding panel once "Get
// Started" is clicked — see openOnboarding/closeOnboarding and the guard at
// the top of renderJobs().
let onboardingActive = false;
// Which of the 4 steps get a red "*" and are enforced on Finish setup —
// decided once, at the moment the panel opens, per step: a step already has
// "existing user information" (some companies, some title terms, a resume,
// a location) isn't required even if it gets cleared back out during this
// session, but a step that started empty must be filled in before Finish
// setup succeeds. See openOnboarding and the validation in the finish-btn
// handler below.
let onboardingRequired = { companies: false, title: false, resume: false, location: false };
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

// The single page-level "message below" banner every button/action reports
// through instead of a browser alert() popup — green for success, red for
// error (see .apply-notice.tone-error). Auto-dismisses after a few seconds;
// errors linger a bit longer since they're more worth actually reading.
let bannerTimer = null;
function showBanner(text, tone = "success") {
  applyNoticeEl.classList.toggle("tone-error", tone === "error");
  applyNoticeTextEl.textContent = text;
  applyNoticeEl.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => {
    applyNoticeEl.hidden = true;
  }, tone === "error" ? 6000 : 4000);
}

applyNoticeDismissBtn.addEventListener("click", () => {
  clearTimeout(bannerTimer);
  applyNoticeEl.hidden = true;
});

// Per-card feedback (Generate Resume, Apply-not-ready, pipeline status,
// Favorite) reports into that same card's .card-message slot instead of the
// page banner, so it stays next to the button that triggered it.
//
// renderJobs() reuses every existing card untouched except the ones that
// were just acted on (see justActedJobIds there) — so a message is never
// tracked, looked up, or reapplied by job id on some later, unrelated
// render. It's just an ordinary DOM node with its own timer that stays
// exactly as it was until its own card is the one that gets rebuilt.
// justActedJobIds/pendingCardMessages are a one-shot batch, not a
// persistent store: whatever's in them gets consumed and wiped the instant
// the next renderJobs() runs, whether that's several actions' worth (two
// favorites fired close enough together to land in the same batch) or one.
// Either way nothing "expires" or gets dropped for being 3rd/4th/Nth — a
// plain Set/object has no notion of a cap.
let pendingCardMessages = {}; // jobId (string) -> { text, tone }
let justActedJobIds = new Set();

function cardMessageDuration(tone) {
  return tone === "error" ? 6000 : 4000;
}

function renderCardMessageEl(msgEl, text, tone) {
  msgEl.innerHTML = `<span>${escapeHtml(text)}</span><button class="dismiss-error-btn" aria-label="Dismiss">&times;</button>`;
  msgEl.classList.toggle("tone-success", tone === "success");
  msgEl.hidden = false;
  msgEl.querySelector(".dismiss-error-btn").addEventListener("click", () => {
    msgEl.hidden = true;
  });
  clearTimeout(msgEl._dismissTimer);
  msgEl._dismissTimer = setTimeout(() => {
    msgEl.hidden = true;
  }, cardMessageDuration(tone));
}

// Immediate display — for when the card is guaranteed to still be on screen
// right now (no loadJobs() about to tear it down), e.g. a validation error.
function showCardMessage(cardEl, text, tone = "success") {
  const msgEl = cardEl?.querySelector(".card-message");
  if (!msgEl) return;
  renderCardMessageEl(msgEl, text, tone);
}

// Some card actions (Generate Resume, pipeline status) call loadJobs()
// right after succeeding, which rebuilds that one card from scratch (see
// justActedJobIds in renderJobs) — so the message is only registered here
// and actually rendered once the matching card exists again in the fresh
// DOM. If that job's card isn't part of the freshly rendered page (moved
// tabs, moved off-page), it's dropped there rather than falling back to a
// page banner — it only ever shows attached to its own card. Favorite
// doesn't use this — see its handler, which updates in place instead of
// reloading, so it never needs to survive a rebuild at all.
function queueCardMessage(jobId, text, tone = "success") {
  const key = String(jobId);
  pendingCardMessages[key] = { text, tone };
  justActedJobIds.add(key);
}

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
// The onboarding walkthrough (see openOnboarding below) is only offered in
// Demo mode — it's for testing/demoing the first-run setup flow, not a real
// account-onboarding feature yet.
getStartedBtn.hidden = !demoMode;
demoModeToggle.addEventListener("change", () => {
  demoMode = demoModeToggle.checked;
  localStorage.setItem("demoMode", String(demoMode));
  dummyBtnLabel.textContent = demoMode ? "Add demo job" : "Add job";
  if (!onboardingActive) getStartedBtn.hidden = !demoMode;
  renderJobs();
});

// Cached copy of the Profile fields (Job Settings' User tab / onboarding) —
// applying to a job needs a name and email, so the Apply button checks this
// before ever hitting the server (see isProfileComplete). The server
// enforces the same gate independently (see PROFILE_INCOMPLETE_ERROR in
// src/routes/jobs.ts) in case this cache is stale; this is purely to avoid
// a round trip — and to avoid window.open()'ing a job's posting tab — for
// the common case.
let userProfile = { firstName: "", lastName: "", email: "" };
function isProfileComplete() {
  return Boolean(userProfile.firstName.trim() && userProfile.lastName.trim() && userProfile.email.trim());
}
// The AI opt-out toggle (Job Settings' User tab / onboarding welcome
// screen) — read by jobCard() to decide whether Generate Resume exists at
// all and whether Apply is gated on a ready resume or always open. Defaults
// to true (AI on) so a page load that hasn't heard back from the server yet
// renders the same as today's behavior.
let aiGenerationEnabled = true;
// Set right before a renderJobs() call whose change isn't about any
// specific job (e.g. the AI opt-out toggle) — the normal reconciliation in
// renderJobs() reuses every existing card untouched except ones in
// justActedJobIds, which is exactly wrong for a global setting change that
// needs every card's markup (Generate Resume button, Apply label) rebuilt
// at once. Consumed and reset to false by renderJobs() itself.
let forceFullRerender = false;
// The value onboarding's AI opt-out checkbox actually loaded with (see
// openOnboarding) — compared against on every toggle so the confirm below
// only fires on a genuine change, and so canceling has something to revert
// to. Unlike the Job Settings drawer's version of this checkbox, this one
// doesn't apply immediately: it's saved (and the reset actually happens)
// along with everything else on Finish setup, same as Companies/Job
// Title/Profile.
let onboardingAiGenerationInitial = true;
// A persistent, top-level heads-up (visible on every tab, since it sits
// above the tab-specific content) — unlike showBanner's messages, this
// doesn't auto-hide and doesn't get cleared on tab switches. Only
// disappears when the user dismisses it or the profile becomes complete on
// a later refreshUserProfile() call (e.g. after saving it) — reappears on
// the next full page load if it's still incomplete, same as any other
// closeable banner.
function updateProfileGateNotice() {
  profileGateNotice.hidden = isProfileComplete();
}
profileGateDismissBtn.addEventListener("click", () => {
  profileGateNotice.hidden = true;
});

// Every job-action button (Generate Resume, Apply, Favorite, Exclude, Flag
// company, pipeline status, Scan, Add job) calls this first — re-checks
// isProfileComplete() fresh on every click (not just on page load), and if
// it's still incomplete, re-surfaces the persistent top notice (even if the
// user had dismissed it) instead of letting the action through. Returns
// true/false so callers can just `if (!requireProfile()) return;`.
function requireProfile() {
  if (isProfileComplete()) return true;
  profileGateNotice.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
  return false;
}
async function refreshUserProfile() {
  try {
    const settings = await (await fetch("/api/user-settings")).json();
    userProfile = settings.profile ?? { firstName: "", lastName: "", email: "" };
    aiGenerationEnabled = settings.aiGenerationEnabled ?? true;
  } catch {
    // Best-effort — the server-side gate on apply/mark-applied is the real
    // enforcement, this cache just saves a round trip in the common case.
  }
  updateProfileGateNotice();
}
refreshUserProfile();

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
const searchQueries = { current: "", applied: "", archived: "" };

function withinTimeRange(dateString) {
  const ageMs = Date.now() - new Date(dateString).getTime();
  return ageMs <= timeRangeHours * 60 * 60 * 1000;
}

/**
 * New Jobs = found within the selected time range, not yet applied. Applied
 * Jobs = applied regardless of date. Past Jobs = found before that range,
 * not applied.
 */
function matchesTab(job) {
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
  starOutline: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  starFilled: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  x: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  thumbsDown: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h4v12h-4"/></svg>`,
  globe: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/></svg>`,
  checkBadge: `<svg class="verified-check" width="15" height="15" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#007aff"/><path d="M8 12.5l2.5 2.5L16 9" stroke="white" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function jobCard(job) {
  const hasDocs = Boolean(job.resume_path && job.cover_letter_path);
  const isApplied = job.status === "applied";
  // For found/requested jobs this would just repeat the company name the
  // title already shows ("Title — Company") — only worth a badge once it's
  // saying something the title doesn't.
  const statusBadge =
    job.status === "found" || job.status === "requested" ? "" : `<span class="status">${escapeHtml(job.status)}</span>`;
  const favoriteControl = `<button class="favorite-btn" data-favorited="${job.favorited ? "true" : "false"}" title="${job.favorited ? "Unfavorite" : "Favorite"}">${job.favorited ? icons.starFilled : icons.starOutline}</button>`;
  // On every tab — a permanent, non-reversible delete (see excludeJob in
  // db/client.ts).
  const excludeControl = `<button class="exclude-btn" title="Delete — this job cannot be fetched again" aria-label="Delete">${icons.x}</button>`;

  // On every tab — flags the whole company as a scam (see blockCompany in
  // db/client.ts), not just this one posting: every job of theirs already
  // tracked gets excluded too, and future scans/imports skip the company
  // entirely. Distinct from Exclude/Delete, which only ever touches the
  // single job it's clicked on.
  const flagCompanyControl = `<button class="flag-company-btn" title="Flag company — block ${escapeHtml(job.company)} as a scam company" aria-label="Flag company">${icons.thumbsDown}</button>`;

  // AI off means there's no resume-generation step at all — the button
  // never renders, regardless of status (see the AI opt-out toggle).
  const generateControl =
    !aiGenerationEnabled || hasDocs || isApplied
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
  const sourceBadge = `<span class="source-badge" title="Job board source">${icons.globe}${escapeHtml(SOURCE_LABELS[job.source] ?? job.source)}</span>`;
  // Priority companies get a blue checkmark right on their name instead of a
  // separate "Verified" badge in the pill row — see the company span below.
  const companyCheck = job.priority ? `${icons.checkBadge} ` : "";
  // A manual way to mark a not-yet-verified company as trusted. Checking it
  // does nothing on its own — the verdict only actually saves at the moment
  // "Apply with AI prefill" is clicked (see that handler below). Checked
  // state is tracked in pendingVerifiedJobIds, not just left on the DOM
  // element, so it survives Generate Resume/Hide/favorite/etc. — all of
  // which re-render this card from scratch. Hidden once the company is
  // already priority (redundant with the checkmark above) or once you've
  // actually applied, since the trust call stops mattering then.
  const legitControl = !job.priority && !isApplied
    ? `<label class="legit-check"><input type="checkbox" class="legit-checkbox" ${pendingVerifiedJobIds.has(job.id) ? "checked" : ""} /> Trust</label>`
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
  // which can take a while, so a request in flight is enough. With AI off
  // there's no resume step to wait on at all, so Apply is always ready.
  const applyReady = !aiGenerationEnabled || hasDocs || job.status === "requested";

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
    : `<button class="apply-btn btn-dark" data-ready="${applyReady}">${aiGenerationEnabled ? "Apply with AI prefill" : "Apply"}</button>`;

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
        <h3 class="card-title"><a href="${escapeHtml(job.url)}" target="_blank" rel="noopener" class="title-link">${escapeHtml(job.title)}</a> - <span class="company">${companyCheck}${escapeHtml(job.company)}</span></h3>
        <div class="card-badges">
          ${badgeGroup}
          ${excludeControl}
        </div>
      </div>
      <div class="meta">
        <span>${[isApplied && job.applied_date ? formatAppliedWhen(job.applied_date) : "", isLocalJob(job) && job.location ? escapeHtml(job.location) : ""]
          .filter(Boolean)
          .join(" · ")}</span>
        ${applyOrderBadge}
      </div>
      <div class="actions">
        ${generateControl}
        ${isApplied ? favoriteControl : ""}
        ${applyControl}
        ${isApplied ? "" : favoriteControl}
        ${flagCompanyControl}
        <span class="links">
          ${legitControl}
          <a href="${escapeHtml(job.url)}" target="_blank" rel="noopener">View posting ${icons.external}</a>
          ${hasDocs ? `<a href="/files/${encodeURIComponent(job.resume_path.split("/").slice(-2).join("/"))}" target="_blank">Resume</a>` : ""}
          ${hasDocs ? `<a href="/files/${encodeURIComponent(job.cover_letter_path.split("/").slice(-2).join("/"))}" target="_blank">Cover letter</a>` : ""}
        </span>
      </div>
      <div class="card-message" hidden></div>
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
  // The onboarding panel replaces the job list on every tab until "Finish
  // setup" — everything else (filter-row, jobs, pagination) stays hidden
  // and untouched by whatever triggered this render (tab switch, filter
  // change, reload) rather than fighting that visibility.
  if (onboardingActive) return;
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

  // Unlike Current/Archived (which just reflect date_found), "applied" is an
  // explicit action with its own timestamp (applied_date) — so show the
  // most recent application first, ignoring the priority-company grouping
  // the other tabs use, so it actually reflects the order things happened in.
  if (currentTab === "applied") {
    jobs.sort((a, b) => (b.applied_date ?? "").localeCompare(a.applied_date ?? ""));
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

  // Reconcile instead of a full teardown+rebuild: every existing card is
  // reused completely untouched (position aside) — including whatever
  // message it's currently showing — except the one job that was just
  // acted on, which gets freshly regenerated markup. This is the whole
  // fix: a card's message is never tracked, looked up, or reapplied by job
  // id anywhere: it simply isn't destroyed by an unrelated action's
  // render, so there's nothing to "tie to the card" and no cap on how many
  // can be showing at once — each one is just an ordinary, untouched DOM
  // node with its own timer until its own card is the one that changes.
  const existingById = new Map();
  jobsEl.querySelectorAll(".card").forEach((card) => existingById.set(card.dataset.id, card));

  const frag = document.createDocumentFragment();
  const freshCards = []; // only these get event listeners — reused cards already have theirs
  pageJobs.forEach((job) => {
    const key = String(job.id);
    const existing = existingById.get(key);
    existingById.delete(key);
    if (existing && !justActedJobIds.has(key) && !forceFullRerender) {
      frag.appendChild(existing);
    } else {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = jobCard(job);
      const newCard = wrapper.firstElementChild;
      frag.appendChild(newCard);
      freshCards.push(newCard);
    }
  });
  jobsEl.innerHTML = "";
  jobsEl.appendChild(frag);
  // Only the freshly (re)created cards need wiring — reused ones already
  // have their listeners from whenever they were originally created; rewiring
  // them here would stack a second, third, ... set of listeners on top with
  // every render they survive, firing each click multiple times over.
  wireJobCardEvents(freshCards);

  justActedJobIds.forEach((jobId) => {
    const targetCard = jobsEl.querySelector(`.card[data-id="${jobId}"]`);
    if (!targetCard) return;
    const msg = pendingCardMessages[jobId];
    if (msg) renderCardMessageEl(targetCard.querySelector(".card-message"), msg.text, msg.tone);
    // Favoriting (and some other actions) re-sorts the job, sometimes to
    // the very top of the page — occasionally that lands the card outside
    // the viewport entirely.
    if (!isElementVisible(targetCard)) targetCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  pendingCardMessages = {};
  justActedJobIds = new Set();
  forceFullRerender = false;
}

function isElementVisible(el) {
  const rect = el.getBoundingClientRect();
  return rect.top >= 0 && rect.bottom <= window.innerHeight;
}

async function loadJobs() {
  const res = await fetch("/api/jobs");
  allJobs = await res.json();
  renderJobs();
}

function wireJobCardEvents(cards = jobsEl.querySelectorAll(".card")) {

  cards.forEach((card) => {
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
      if (!requireProfile()) return;
      const btn = e.currentTarget;
      const originalHTML = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = useSpinner ? `<span class="spinner"></span> ${originalHTML}` : "Requesting...";
      try {
        const task = fetch(`/api/jobs/${id}/request-generation`, { method: "POST" });
        await (useSpinner ? Promise.all([task, sleep(1000)]) : task);
        // Real backend flag either way (status "requested" + apply_order
        // assigned) — that's what unlocks Apply (see applyReady below), so
        // "ready" is accurate in both modes even though the real mode's
        // actual resume file gets written afterward, by Claude, elsewhere.
        queueCardMessage(
          id,
          demoMode ? "Your optimized resume is ready — go get that job!" : "Your resume is ready — go get that job!",
          "success",
        );
        await loadJobs();
      } catch (err) {
        showCardMessage(card, `Couldn't request your resume: ${err.message}`, "error");
        btn.disabled = false;
        btn.innerHTML = originalHTML;
      }
    });

    card.querySelector(".apply-btn")?.addEventListener("click", async (e) => {
      // A whole-account gate, not a per-job issue, so it re-surfaces the
      // top-level notice rather than a per-card message — and blocks before
      // the job posting even opens in a new tab.
      if (!requireProfile()) return;
      const btn = e.currentTarget;
      // Always clickable now — if no resume is ready yet, show the inline
      // dismissible error instead of doing anything, rather than disabling
      // the button up front.
      if (btn.dataset.ready !== "true") {
        showCardMessage(card, "Generate a resume for this one first, then you're ready to apply.", "error");
        return;
      }
      card.querySelector(".card-message").hidden = true;

      const originalHTML = btn.innerHTML;
      btn.disabled = true;
      if (useSpinner) btn.innerHTML = `<span class="spinner"></span> ${originalHTML}`;

      // window.open returns null (or an inaccessible window) when the
      // browser's popup blocker steps in — the only new-tab mechanism on
      // this page where that's actually detectable (a plain <a target=
      // "_blank"> click, like "View posting" below, is a direct user
      // gesture browsers don't block, so it's always a safe fallback here).
      const openedTab = window.open(url, "_blank", "noopener");
      const popupBlocked = !openedTab;

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
        const markPromise = fetch(`/api/jobs/${id}/mark-applied`, { method: "POST" });
        const task = Promise.all([markPromise, verdictTask]);
        const [[markRes]] = await (useSpinner ? Promise.all([task, sleep(1000)]) : Promise.all([task]));
        if (!markRes.ok) {
          const body = await markRes.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to mark as applied.");
        }
        // Wording differs slightly by tab (New Jobs is the only place the
        // job visibly leaves the current view), but the confirmation shows
        // everywhere now instead of only for demo mode.
        showBanner(
          popupBlocked
            ? "Marked as applied, but your browser blocked the new tab — allow pop-ups for this site, then use \"View posting\" on the card to open it."
            : currentTab === "current"
              ? "Opened in a new tab and moved to your Applied Jobs — you're on a roll!"
              : "Marked as applied — you're one step closer!",
          popupBlocked ? "error" : "success",
        );
        await loadJobs();
        if (currentTab === "current") window.scrollTo(0, 0);
      } catch (err) {
        showCardMessage(card, `Couldn't mark this as applied: ${err.message}`, "error");
        btn.disabled = false;
        btn.innerHTML = originalHTML;
      }
    });

    card.querySelector(".pipeline-select")?.addEventListener("change", async (e) => {
      const stage = e.target.value;
      const previousStage = e.target.dataset.current;
      if (!requireProfile()) {
        e.target.value = previousStage;
        return;
      }
      e.target.disabled = true;
      try {
        await fetch(`/api/jobs/${id}/pipeline-stage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage }),
        });
        queueCardMessage(id, `Updated — now tracking as "${stage}".`, "success");
        await loadJobs();
      } catch (err) {
        showCardMessage(card, `Couldn't update the status: ${err.message}`, "error");
        e.target.value = previousStage;
        e.target.disabled = false;
      }
    });

    card.querySelector(".favorite-btn")?.addEventListener("click", async (e) => {
      if (!requireProfile()) return;
      const btn = e.currentTarget;
      const favorited = btn.dataset.favorited !== "true";
      btn.disabled = true;
      try {
        await fetch(`/api/jobs/${id}/favorite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ favorited }),
        });
        // Updates this one card and the shared allJobs data in place —
        // deliberately NOT calling loadJobs()/renderJobs() here. Favorited
        // jobs still float to the top, just the next time the list is
        // naturally rebuilt (switching tabs, reloading, another action's
        // own loadJobs()) rather than immediately reshuffling whatever's
        // currently on screen out from under you. Since nothing rebuilds,
        // there's no card-message reconciliation needed either — the
        // message goes straight onto the card that's already right here.
        const job = allJobs.find((j) => j.id === Number(id));
        if (job) job.favorited = favorited;
        btn.dataset.favorited = String(favorited);
        btn.title = favorited ? "Unfavorite" : "Favorite";
        btn.innerHTML = favorited ? icons.starFilled : icons.starOutline;
        if (favorited) {
          showCardMessage(card, "Added to your favorites!", "success");
        } else {
          // Unfavoriting just clears whatever message was already showing
          // on this card rather than announcing its own removal.
          card.querySelector(".card-message").hidden = true;
        }
      } catch (err) {
        showCardMessage(card, `Couldn't ${favorited ? "favorite" : "unfavorite"} this job: ${err.message}`, "error");
      } finally {
        btn.disabled = false;
      }
    });

    card.querySelector(".exclude-btn")?.addEventListener("click", async (e) => {
      if (!requireProfile()) return;
      if (!confirm("Delete this job? Once it's gone, we can't pull it back in again.")) return;
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        await fetch(`/api/jobs/${id}/exclude`, { method: "POST" });
        // The card itself is gone after this (excluded jobs never render
        // again, in any tab) — no container left to put the message in, so
        // this is one of the few actions that still reports via the page
        // banner.
        showBanner("Deleted — that one's gone for good.", "success");
        await loadJobs();
      } catch (err) {
        showCardMessage(card, `Couldn't delete this job: ${err.message}`, "error");
        btn.disabled = false;
      }
    });

    card.querySelector(".flag-company-btn")?.addEventListener("click", async (e) => {
      if (!requireProfile()) return;
      if (!confirm(`Flag ${company} as a scam company? We'll clear out all of their postings and won't add new ones.`)) return;
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        await fetch(`/api/jobs/${id}/flag-company`, { method: "POST" });
        // Every job from this company (not just this card) is gone after
        // this, so — same reasoning as Exclude above — the page banner is
        // the only place left to report it.
        showBanner(`Flagged ${company} and cleared out all their postings.`, "success");
        await loadJobs();
      } catch (err) {
        showCardMessage(card, `Couldn't flag ${company}: ${err.message}`, "error");
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
  if (!requireProfile()) return;

  dummyBtn.disabled = true;
  try {
    landOnNewJobsTab();
    await fetch("/api/jobs/dummy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationType: locationFilter.value }),
    });
    showBanner("Demo job added — right at the top of your list!", "success");
    await loadJobs();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    showBanner(`Couldn't add that demo job: ${err.message}`, "error");
  } finally {
    dummyBtn.disabled = false;
  }
});

addJobCancelBtn.addEventListener("click", () => {
  addJobModal.hidden = true;
});

// --- Job Settings drawer -----------------------------------------------
// Includes what used to be the separate User Settings drawer (Scan location
// + Resume, now the "User" tab) — see the third drawer-pane below.

// The in-progress edit — loaded fresh from the server each time the drawer
// opens, only written back on Save (so closing without saving discards it).
let jobSettingsDraft = { priorityCompanies: [], bannedCompanies: [], includeTerms: [], excludeTerms: [] };
// Which categories are currently "added" — session-only, not sent to the
// server (the server only ever sees the companies a category expanded
// into, via priorityCompanies). Reset on every drawer/onboarding open, same
// as jobSettingsDraft, so re-opening never shows a category as added that
// wasn't actually re-selected this session.
let selectedCategories = [];
// Every Job Settings accordion (Companies' add/ban, Job Title's
// include/exclude) has its own search box, scoped to just that list — with
// 126+ companies possible in "Included Companies" alone, finding one by
// scrolling isn't practical, and a single shared search box made searching
// one list hide unrelated matches in the others. Filters the rendered
// chips only, never the underlying draft, so it can't accidentally remove
// anything from what gets saved.
const termSearchQueries = { priorityCompanies: "", bannedCompanies: "", includeTerms: "", excludeTerms: "" };

// The Companies/Job Title accordions each appear twice in the DOM now — once
// in the Job Settings drawer, once in the onboarding panel (same `key`s,
// both driven off the one shared jobSettingsDraft) — so every render/count/
// collapse helper here updates *all* matching instances via querySelectorAll,
// not just the first one, to keep both in sync automatically.
function renderTermList(key) {
  const isBanList = key === "bannedCompanies" || key === "excludeTerms";
  const allItems = jobSettingsDraft[key];
  const query = termSearchQueries[key];
  const items = query ? allItems.filter((item) => item.toLowerCase().includes(query)) : allItems;
  const html =
    allItems.length === 0
      ? `<span class="term-empty">None yet</span>`
      : items.length === 0
        ? `<span class="term-empty">No matches</span>`
        : items
            .map(
              (item) => `
        <span class="term-chip ${isBanList ? "ban-color" : "add-color"}">
          ${escapeHtml(item)}
          <button class="term-chip-remove" data-remove="${key}" data-value="${escapeHtml(item)}" aria-label="Remove ${escapeHtml(item)}">${icons.x}</button>
        </span>
      `,
            )
            .join("");
  document.querySelectorAll(`[data-list-el="${key}"]`).forEach((container) => {
    container.innerHTML = html;
  });
}

function updateTermCount(key) {
  document.querySelectorAll(`[data-count="${key}"]`).forEach((countEl) => {
    countEl.textContent = `(${jobSettingsDraft[key].length})`;
  });
}

// Every accordion is collapsed by default every time the drawer/onboarding
// panel opens — with 100+ companies possible in "Included Companies" alone,
// showing every list expanded made it unusably long. Search box and "+" add
// button only make sense (and only show, since they're inside the same
// body) once a section is actually open.
function setSectionCollapsed(key, collapsed) {
  document.querySelectorAll(`[data-collapse-toggle="${key}"]`).forEach((toggle) => {
    toggle.setAttribute("aria-expanded", String(!collapsed));
  });
  document.querySelectorAll(`[data-accordion-body="${key}"]`).forEach((body) => {
    body.hidden = collapsed;
  });
}

document.querySelectorAll(".term-collapse-toggle").forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const key = toggle.dataset.collapseToggle;
    const isExpanded = toggle.getAttribute("aria-expanded") === "true";
    setSectionCollapsed(key, isExpanded);
  });
});

document.querySelectorAll("[data-term-search]").forEach((input) => {
  input.addEventListener("input", () => {
    const key = input.dataset.termSearch;
    termSearchQueries[key] = input.value.trim().toLowerCase();
    renderTermList(key);
  });
});

function renderAllTermLists() {
  ["priorityCompanies", "bannedCompanies", "includeTerms", "excludeTerms"].forEach((key) => {
    renderTermList(key);
    updateTermCount(key);
  });
}

// Auto-expands any accordion with fewer than 5 entries when the drawer/
// onboarding panel opens — a short list doesn't need to start collapsed the
// way the 100+-company lists this pattern was built for do. Only makes
// sense once jobSettingsDraft is actually loaded, so callers run this after
// their fetch, not before.
function applyDefaultCollapse() {
  ["priorityCompanies", "bannedCompanies", "includeTerms", "excludeTerms"].forEach((key) => {
    setSectionCollapsed(key, jobSettingsDraft[key].length >= 5);
  });
}

async function openJobSettingsDrawer() {
  jobSettingsClearAllCheck.checked = false;
  jobSettingsMessage.hidden = true;
  ["priorityCompanies", "bannedCompanies", "includeTerms", "excludeTerms"].forEach((key) => {
    termSearchQueries[key] = "";
  });
  document.querySelectorAll("[data-term-search]").forEach((input) => {
    input.value = "";
  });
  selectedCategories = [];
  document.querySelectorAll("[data-category-input]").forEach((input) => {
    input.value = "";
  });
  document.querySelectorAll("[data-category-preview]").forEach((preview) => {
    preview.hidden = true;
  });
  renderCategoryList();
  resumeError.hidden = true;
  resumeFileInput.value = "";
  try {
    jobSettingsDraft = await (await fetch("/api/jobs/job-settings")).json();
    renderAllTermLists();
    applyDefaultCollapse();
    const settings = await (await fetch("/api/user-settings")).json();
    const city = settings.scanLocation?.city ?? "";
    const radiusMiles = settings.scanLocation?.radiusMiles ?? 0;
    userScanCityInput.value = city;
    userScanRadiusSelect.value = String(radiusMiles);
    renderScanLocationChip(city, radiusMiles);
    renderResumeState(settings.resumeFilename);
    userFirstNameInput.value = settings.profile?.firstName ?? "";
    userLastNameInput.value = settings.profile?.lastName ?? "";
    userEmailInput.value = settings.profile?.email ?? "";
    aiGenerationEnabled = settings.aiGenerationEnabled ?? true;
    userAiOptoutCheck.checked = !aiGenerationEnabled;
  } catch (err) {
    showBanner(`Couldn't load your settings: ${err.message}`, "error");
    return;
  }
  jobSettingsOverlay.hidden = false;
}

function closeJobSettingsDrawer() {
  jobSettingsOverlay.hidden = true;
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
    document.getElementById("drawer-pane-user").hidden = btn.dataset.drawerTab !== "user";
  });
});

// Unlike every other Job Settings field, this applies immediately on
// toggle instead of waiting for the drawer's Save button — it's a
// destructive, whole-database change (every job's generated documents,
// applied status, and pipeline stage get wiped — see resetAllJobsForAiToggle
// server-side), so it gets its own explicit confirm() right at the moment
// of the click, same pattern as the "Clear all existing job history"
// checkbox below. A cancel reverts the checkbox without calling the server.
userAiOptoutCheck.addEventListener("change", async (e) => {
  const checkbox = e.currentTarget;
  const wantsEnabled = !checkbox.checked;
  if (wantsEnabled === aiGenerationEnabled) return; // no actual change (e.g. drawer just opened)

  const confirmed = confirm(
    wantsEnabled
      ? "Turning AI-generated resumes back on resets EVERY job — including ones you've already applied to — back to a clean state. Any in-progress or completed application work will be lost. Continue?"
      : "Opting out of AI-generated resumes resets EVERY job — including ones you've already applied to — back to a clean state. Any in-progress or completed application work will be lost. Continue?",
  );
  if (!confirmed) {
    checkbox.checked = !aiGenerationEnabled;
    return;
  }

  checkbox.disabled = true;
  try {
    const res = await fetch("/api/user-settings/ai-generation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: wantsEnabled }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Couldn't save this setting.");
    aiGenerationEnabled = wantsEnabled;
    // Every job just got wiped server-side — any leftover client-side
    // per-card state (a pending "Trust this company" checkbox, an
    // in-flight card message) refers to a state that no longer exists, so
    // it's cleared here too rather than surviving into the next render.
    pendingVerifiedJobIds.clear();
    pendingCardMessages = {};
    justActedJobIds = new Set();
    // Every card's markup depends on aiGenerationEnabled now, not just the
    // job it represents — force renderJobs() to rebuild all of them instead
    // of reusing the (now-stale) existing DOM nodes.
    forceFullRerender = true;
    await loadJobs();
    showBanner(
      wantsEnabled
        ? "AI-generated resumes are back on — every job was reset to a clean state."
        : "AI-generated resumes are off — every job was reset to a clean state. Apply now opens the posting directly.",
      "success",
    );
  } catch (err) {
    checkbox.checked = !aiGenerationEnabled;
    showBanner(`Couldn't update this setting: ${err.message}`, "error");
  } finally {
    checkbox.disabled = false;
  }
});

// The search box doubles as the add box: typing filters the existing chips
// live (see the [data-term-search] "input" listener above), and "+"/Enter
// adds whatever's typed if it isn't already in the list. Replaces an
// earlier two-step flow (click + to reveal a second input, type the same
// thing again, click Add) that people found confusing. Scoped to whichever
// accordion instance (drawer vs. onboarding) was actually used — via
// .closest(".term-accordion-body") — rather than a global lookup by key,
// since two instances share the same key and a global lookup would always
// resolve to whichever one happens to be first in the DOM.
function addTermFromSearch(key, scope) {
  const input = scope.querySelector(`[data-term-search="${key}"]`);
  const value = input.value.trim();
  if (!value) return;
  const exists = jobSettingsDraft[key].some((v) => v.toLowerCase() === value.toLowerCase());
  if (!exists) jobSettingsDraft[key].push(value);
  input.value = "";
  termSearchQueries[key] = "";
  renderTermList(key);
  updateTermCount(key);
}

// [data-list] excludes the "Add a category" button below — it also has
// .term-add-btn for identical styling, but isn't inside a
// .term-accordion-body (so .closest() would return null and crash) and has
// its own dedicated handler.
document.querySelectorAll(".term-add-btn[data-list]").forEach((btn) => {
  btn.addEventListener("click", () => addTermFromSearch(btn.dataset.list, btn.closest(".term-accordion-body")));
});

document.querySelectorAll("[data-term-search]").forEach((input) => {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTermFromSearch(input.dataset.termSearch, input.closest(".term-accordion-body"));
    }
  });
});

// The category names populate this <datalist> — the company lists behind
// each one stay in public/shared/companyCategories.js and are never
// rendered anywhere in bulk, only surfaced one category at a time via the
// live preview below, for whichever category is actually typed.
const companyCategoriesDatalist = document.getElementById("company-categories");
companyCategoriesDatalist.innerHTML = Object.keys(COMPANY_CATEGORIES)
  .map((name) => `<option value="${escapeHtml(name)}"></option>`)
  .join("");

function matchCategory(typed) {
  return Object.keys(COMPANY_CATEGORIES).find((name) => name.toLowerCase() === typed.trim().toLowerCase());
}

// Purely informational — these companies never get added to Included
// Companies (see addCategoryFromInput), so the wording always makes that
// explicit rather than implying anything gets added automatically. "Other"
// (and any future category with no companies behind it) gets its own
// message instead of an empty list.
function categoryPreviewHtml(categoryName) {
  const companies = COMPANY_CATEGORIES[categoryName];
  return companies.length === 0
    ? `<strong>${escapeHtml(categoryName)}:</strong> No commonly-tracked companies for this one — add your own manually via Included Companies below.`
    : `<strong>${escapeHtml(categoryName)}:</strong> ${escapeHtml(companies.join(", "))} — none of these are added automatically; exclude any you don't want via Excluded Companies below.`;
}

// Shows which companies are commonly tracked in a category, live as it's
// typed — so "see what's included as you type" (the info box above this
// input) is true
// before the user commits to anything.
document.querySelectorAll("[data-category-input]").forEach((input) => {
  const preview = input.closest(".onboarding-step, .drawer-pane").querySelector("[data-category-preview]");
  input.addEventListener("input", () => {
    const categoryName = matchCategory(input.value);
    if (!categoryName) {
      preview.hidden = true;
      return;
    }
    preview.innerHTML = categoryPreviewHtml(categoryName);
    preview.hidden = false;
  });
});

// Renders selectedCategories as always-open blocks — not a pill/chip, since
// the whole point is the user can actually read the company list to decide
// what to exclude, not just see a name they'd have to retype to inspect
// again. Each block stays visible the whole time it's selected; only the X
// removes it. Not tied to Included Companies (see addCategoryFromInput
// below for why). Broadcasts to every matching instance (onboarding vs.
// drawer), since they share this one array.
function renderCategoryList() {
  const html =
    selectedCategories.length === 0
      ? `<span class="term-empty">None yet</span>`
      : selectedCategories
          .map((name) => {
            const companies = COMPANY_CATEGORIES[name];
            const companiesText =
              companies.length === 0
                ? "No commonly-tracked companies for this one — add your own manually via Included Companies below."
                : companies.join(", ");
            return `
        <div class="category-block">
          <div class="category-block-header">
            <span>${escapeHtml(name)}</span>
            <button class="category-block-remove" data-remove-category="${escapeHtml(name)}" aria-label="Remove ${escapeHtml(name)}">${icons.x}</button>
          </div>
          <p class="category-block-companies">${escapeHtml(companiesText)}</p>
        </div>
      `;
          })
          .join("");
  document.querySelectorAll(`[data-list-el="categories"]`).forEach((container) => {
    container.innerHTML = html;
  });
}

// "Add a category" is reference-only — it does NOT add any company to
// Included Companies. It just keeps a "Tech ×"-style label around so you
// can see which categories you've looked at, with the live preview (see
// categoryPreviewHtml) showing what's actually in it. If you want to keep
// a specific company out of your results, add it to Excluded Companies
// yourself — categories never do that automatically either. Scoped to
// whichever instance (onboarding vs. drawer) was actually used, same
// reasoning as the .term-add-btn handlers above.
function addCategoryFromInput(triggerEl) {
  const scope = triggerEl.closest(".onboarding-step, .drawer-pane");
  const input = scope.querySelector("[data-category-input]");
  const categoryName = matchCategory(input.value);
  if (!categoryName || selectedCategories.includes(categoryName)) return;
  selectedCategories.push(categoryName);
  input.value = "";
  scope.querySelector("[data-category-preview]").hidden = true;
  renderCategoryList();
}
document.querySelectorAll("[data-category-add]").forEach((btn) => {
  btn.addEventListener("click", () => addCategoryFromInput(btn));
});
document.querySelectorAll("[data-category-input]").forEach((input) => {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCategoryFromInput(input);
    }
  });
});

// Delegated globally, same reasoning as the company/term chip remover below.
// Just drops the label — there's nothing in priorityCompanies to undo,
// since adding never touched it in the first place.
document.addEventListener("click", (e) => {
  const removeBtn = e.target.closest("[data-remove-category]");
  if (!removeBtn) return;
  selectedCategories = selectedCategories.filter((name) => name !== removeBtn.dataset.removeCategory);
  renderCategoryList();
});

// Delegated globally (rather than scoped to .drawer-body) so it also covers
// the onboarding panel's copy of these chips.
document.addEventListener("click", (e) => {
  const removeBtn = e.target.closest("[data-remove]");
  if (!removeBtn) return;
  const key = removeBtn.dataset.remove;
  const value = removeBtn.dataset.value;
  jobSettingsDraft[key] = jobSettingsDraft[key].filter((v) => v !== value);
  renderTermList(key);
  updateTermCount(key);
});

jobSettingsSaveBtn.addEventListener("click", async () => {
  const clearAll = jobSettingsClearAllCheck.checked;
  if (
    clearAll &&
    !confirm(
      "This will permanently delete ALL jobs — including your Applied job history — before rescanning. This can't be undone. Continue?",
    )
  ) {
    return;
  }

  const originalHTML = jobSettingsSaveBtn.innerHTML;
  jobSettingsSaveBtn.disabled = true;
  // Saving now also triggers a full rescan (see the server route) so
  // changed criteria apply to fresh postings right away — that takes a lot
  // longer than a plain save, so show it's actually working. Also saves the
  // User tab's scan location alongside companies/terms — one Save button
  // for the whole drawer now that User Settings isn't a separate drawer.
  jobSettingsSaveBtn.innerHTML = `<span class="spinner"></span> Saving & scanning...`;
  try {
    let res = await fetch("/api/jobs/job-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...jobSettingsDraft, clearAll }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Save failed.");
    res = await fetch("/api/user-settings/scan-location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        city: userScanCityInput.value.trim(),
        radiusMiles: Number(userScanRadiusSelect.value),
      }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Save failed.");
    res = await fetch("/api/user-settings/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: userFirstNameInput.value.trim(),
        lastName: userLastNameInput.value.trim(),
        email: userEmailInput.value.trim(),
      }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Save failed.");
    await refreshUserProfile();
    closeJobSettingsDrawer();
    landOnNewJobsTab();
    await loadJobs();
    showBanner(
      clearAll
        ? "All clear! Job history wiped and fresh jobs pulled in."
        : "Settings saved! Fresh jobs pulled in to match — take a look.",
      "success",
    );
    window.scrollTo(0, 0);
  } catch (err) {
    // Drawer stays open on failure, so the message goes inline here instead
    // of the page-level banner, which would be out of view behind it.
    jobSettingsMessage.textContent = `Couldn't save your job settings: ${err.message}`;
    jobSettingsMessage.hidden = false;
  } finally {
    jobSettingsSaveBtn.disabled = false;
    jobSettingsSaveBtn.innerHTML = originalHTML;
  }
});

// Updates both the Job Settings drawer's User tab and the onboarding panel's
// copy together — same underlying resume, shown in two places.
function renderResumeState(resumeFilename) {
  [
    [resumeCurrentRow, resumeCurrentLink],
    [onboardingResumeCurrentRow, onboardingResumeCurrentLink],
  ].forEach(([row, link]) => {
    if (resumeFilename) {
      link.href = `/webapp-docs/${encodeURIComponent(resumeFilename)}`;
      link.textContent = resumeFilename;
      row.hidden = false;
    } else {
      row.hidden = true;
    }
  });
}

// Shows the currently saved scan location as a chip (same look as the
// Job Settings company/term chips) so it's clear at a glance whether one is
// set — with an X to clear it, since only ever one location applies here.
// Updates both the drawer's copy and the onboarding panel's copy.
function renderScanLocationChip(city, radiusMiles) {
  const label = radiusMiles ? `${city} · Within ${radiusMiles} mi` : city;
  [
    [userScanLocationCurrentRow, userScanLocationCurrentLabel],
    [onboardingScanLocationCurrentRow, onboardingScanLocationCurrentLabel],
  ].forEach(([row, labelEl]) => {
    if (!city) {
      row.hidden = true;
      return;
    }
    labelEl.textContent = label;
    row.hidden = false;
  });
}

function clearScanLocationInputs(cityInput, radiusSelect, currentRow) {
  cityInput.value = "";
  radiusSelect.value = "0";
  currentRow.hidden = true;
}

userScanLocationRemoveBtn.addEventListener("click", () =>
  clearScanLocationInputs(userScanCityInput, userScanRadiusSelect, userScanLocationCurrentRow),
);
onboardingScanLocationRemoveBtn.addEventListener("click", () =>
  clearScanLocationInputs(onboardingScanCityInput, onboardingScanRadiusSelect, onboardingScanLocationCurrentRow),
);

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Shared by the Job Settings drawer's resume upload (User tab) and the
// onboarding panel's copy of it — same endpoint, same behavior, different elements.
// Shared by every inline "message below" slot that isn't the page-level
// banner (resume upload/remove, add-job-by-URL) — same element, same
// dismiss-by-replacement behavior, just green or red text via .tone-success.
function showFieldMessage(el, text, tone = "error") {
  el.textContent = text;
  el.classList.toggle("tone-success", tone === "success");
  el.hidden = false;
}

async function uploadResume(fileInputEl, errorEl, uploadBtnEl) {
  const file = fileInputEl.files[0];
  if (!file) {
    showFieldMessage(errorEl, "Choose a resume file to upload first.", "error");
    return;
  }
  uploadBtnEl.disabled = true;
  errorEl.hidden = true;
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
    fileInputEl.value = "";
    showFieldMessage(errorEl, `${result.resumeFilename} uploaded — you're good to go!`, "success");
  } catch (err) {
    showFieldMessage(errorEl, `Couldn't upload your resume: ${err.message}`, "error");
  } finally {
    uploadBtnEl.disabled = false;
  }
}

async function removeResume(removeBtnEl, errorEl) {
  if (!confirm("Remove your uploaded resume?")) return;
  removeBtnEl.disabled = true;
  try {
    await fetch("/api/user-settings/resume", { method: "DELETE" });
    renderResumeState(null);
    showFieldMessage(errorEl, "Resume removed — all clear.", "success");
  } catch (err) {
    showFieldMessage(errorEl, `Couldn't remove your resume: ${err.message}`, "error");
  } finally {
    removeBtnEl.disabled = false;
  }
}

resumeUploadBtn.addEventListener("click", () => uploadResume(resumeFileInput, resumeError, resumeUploadBtn));
resumeRemoveBtn.addEventListener("click", () => removeResume(resumeRemoveBtn, resumeError));
onboardingResumeUploadBtn.addEventListener("click", () =>
  uploadResume(onboardingResumeFileInput, onboardingResumeError, onboardingResumeUploadBtn),
);
onboardingResumeRemoveBtn.addEventListener("click", () => removeResume(onboardingResumeRemoveBtn, onboardingResumeError));

// --- Onboarding panel (Demo mode only) ---------------------------------

// Loads the same data the Job Settings drawer shows, into the onboarding
// panel's copies of that same UI (see the render* broadcast helpers above),
// then hides the job list on every tab in favor of the panel until "Finish
// setup".
async function openOnboarding() {
  onboardingActive = true;
  getStartedBtn.hidden = true;
  filterRowEl.hidden = true;
  applyNoticeEl.hidden = true;
  emptyEl.hidden = true;
  jobsEl.hidden = true;
  pageFooterEl.hidden = true;
  onboardingPanel.hidden = false;
  // In case the panel was left mid-"Finish setup" from a prior open (a
  // successful run leaves the loading view showing) — always start a fresh
  // open on the actual form.
  stopOnboardingProgress();
  ["priorityCompanies", "bannedCompanies", "includeTerms", "excludeTerms"].forEach((key) => {
    termSearchQueries[key] = "";
  });
  document.querySelectorAll("[data-term-search]").forEach((input) => {
    input.value = "";
  });
  selectedCategories = [];
  document.querySelectorAll("[data-category-input]").forEach((input) => {
    input.value = "";
  });
  document.querySelectorAll("[data-category-preview]").forEach((preview) => {
    preview.hidden = true;
  });
  renderCategoryList();
  onboardingError.hidden = true;
  try {
    jobSettingsDraft = await (await fetch("/api/jobs/job-settings")).json();
    renderAllTermLists();
    applyDefaultCollapse();
    const settings = await (await fetch("/api/user-settings")).json();
    const city = settings.scanLocation?.city ?? "";
    const radiusMiles = settings.scanLocation?.radiusMiles ?? 0;
    onboardingScanCityInput.value = city;
    onboardingScanRadiusSelect.value = String(radiusMiles);
    renderScanLocationChip(city, radiusMiles);
    renderResumeState(settings.resumeFilename);
    onboardingFirstNameInput.value = settings.profile?.firstName ?? "";
    onboardingLastNameInput.value = settings.profile?.lastName ?? "";
    onboardingEmailInput.value = settings.profile?.email ?? "";
    onboardingAiGenerationInitial = settings.aiGenerationEnabled ?? true;
    onboardingAiOptoutCheck.checked = !onboardingAiGenerationInitial;
    // A step is only ever required because it started with nothing in it —
    // decided here, once, from what was just loaded, not re-checked against
    // "current" data later (see the comment on the declaration above).
    onboardingRequired = {
      companies: jobSettingsDraft.priorityCompanies.length === 0,
      title: jobSettingsDraft.includeTerms.length === 0,
      resume: !settings.resumeFilename,
      location: !city,
    };
    onboardingCompaniesRequired.hidden = !onboardingRequired.companies;
    onboardingTitleRequired.hidden = !onboardingRequired.title;
    onboardingResumeRequired.hidden = !onboardingRequired.resume;
    onboardingLocationRequired.hidden = !onboardingRequired.location;
  } catch (err) {
    onboardingError.textContent = `Couldn't load your setup data: ${err.message}`;
    onboardingError.hidden = false;
  }
  window.scrollTo(0, 0);
}

function closeOnboarding() {
  onboardingActive = false;
  onboardingPanel.hidden = true;
  filterRowEl.hidden = false;
  jobsEl.hidden = false;
  pageFooterEl.hidden = false;
  getStartedBtn.hidden = !demoMode;
}

// Same warning as the Job Settings drawer's version of this checkbox — even
// though this one doesn't take effect until Finish setup, the reset it
// triggers then is exactly as destructive, so the confirm needs to show
// right here too, not just in Job Settings.
onboardingAiOptoutCheck.addEventListener("change", (e) => {
  const checkbox = e.currentTarget;
  const wantsEnabled = !checkbox.checked;
  if (wantsEnabled === onboardingAiGenerationInitial) return;

  const confirmed = confirm(
    wantsEnabled
      ? "Turning AI-generated resumes back on resets EVERY job — including ones you've already applied to — back to a clean state. Any in-progress or completed application work will be lost. Continue?"
      : "Opting out of AI-generated resumes resets EVERY job — including ones you've already applied to — back to a clean state. Any in-progress or completed application work will be lost. Continue?",
  );
  if (!confirmed) checkbox.checked = !onboardingAiGenerationInitial;
});

getStartedBtn.addEventListener("click", openOnboarding);

// Bails out of setup entirely — no validation, no save. Whatever's already
// been filled in (a resume upload, a saved location) stays saved, since
// those save immediately on their own actions; only Companies/Job
// Title/Profile, which only save on Finish setup, are discarded.
onboardingSkipBtn.addEventListener("click", () => {
  closeOnboarding();
});

// Fun, rotating filler for the ~30s Finish setup wait (one full scan across
// every tracked company's job board) — cycles on a timer, loops back to the
// start if it outlasts the list. Purely cosmetic, no relation to what the
// scan is actually doing at any given moment.
const ONBOARDING_LOADING_MESSAGES = [
  "Scanning job boards for your perfect match...",
  "Knocking on career pages, politely...",
  "Cross-referencing every company on your list...",
  "Filtering out anything that smells like a scam...",
  "Sorting the good stuff to the top...",
  "Double-checking so nothing slips through the cracks...",
  "Matching titles to what you're actually looking for...",
  "Almost there — packing up your personalized list...",
];

let onboardingProgressTimer = null;
let onboardingMessageTimer = null;

// No real progress events exist for this (the scan is one long request, not
// a stream) — this fakes it: crawls toward a cap over time, slowing as it
// approaches, then the caller snaps it to 100% the moment the save+scan
// actually resolves. Swaps the whole form out for the progress view (see
// .onboarding-form-section) since a static "Saving..." label alone reads as
// hung across a wait this long.
function startOnboardingProgress() {
  onboardingFormSection.hidden = true;
  onboardingLoading.hidden = false;
  let progress = 6;
  const cap = 92;
  onboardingProgressFill.style.width = `${progress}%`;
  onboardingProgressTimer = setInterval(() => {
    progress += (cap - progress) * 0.06;
    onboardingProgressFill.style.width = `${Math.min(progress, cap)}%`;
  }, 400);

  let messageIndex = 0;
  onboardingLoadingMessage.textContent = ONBOARDING_LOADING_MESSAGES[0];
  onboardingMessageTimer = setInterval(() => {
    messageIndex = (messageIndex + 1) % ONBOARDING_LOADING_MESSAGES.length;
    onboardingLoadingMessage.textContent = ONBOARDING_LOADING_MESSAGES[messageIndex];
  }, 2600);
}

// Used on the error path — the form comes back so the user can fix
// whatever failed and retry. The success path handles its own progress ->
// 100% -> reveal sequence inline instead (see onboardingFinishBtn below),
// since it needs the fresh job list ready before switching away from this
// view, not just the bar to stop.
function stopOnboardingProgress() {
  clearInterval(onboardingProgressTimer);
  clearInterval(onboardingMessageTimer);
  onboardingLoading.hidden = true;
  onboardingFormSection.hidden = false;
  onboardingProgressFill.style.width = "6%";
}

onboardingFinishBtn.addEventListener("click", async () => {
  // Companies/Job Title/Resume/Location are only required if they started
  // empty (see onboardingRequired); Profile (name + email) is always
  // required, full stop — applying to a job needs it (see
  // isProfileComplete server-side), so there's no "started non-empty" case
  // to exempt it from.
  const missing = [];
  if (onboardingRequired.companies && jobSettingsDraft.priorityCompanies.length === 0) missing.push("Add companies");
  if (onboardingRequired.title && jobSettingsDraft.includeTerms.length === 0) missing.push("Add job title");
  if (onboardingRequired.resume && onboardingResumeCurrentRow.hidden) missing.push("Add resume");
  if (onboardingRequired.location && !onboardingScanCityInput.value.trim()) missing.push("Add locations");
  if (!onboardingFirstNameInput.value.trim() || !onboardingLastNameInput.value.trim()) missing.push("Add your name");
  if (!onboardingEmailInput.value.trim().includes("@")) missing.push("Add a valid email");
  if (missing.length > 0) {
    onboardingError.textContent = `Just a few more things before you're set: ${missing.join(", ")}.`;
    onboardingError.hidden = false;
    return;
  }
  onboardingError.hidden = true;

  onboardingFinishBtn.disabled = true;
  startOnboardingProgress();
  try {
    // Same three saves as the Job Settings drawer's own Save button, just
    // combined into one step here.
    let res = await fetch("/api/jobs/job-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jobSettingsDraft),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Save failed.");
    res = await fetch("/api/user-settings/scan-location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        city: onboardingScanCityInput.value.trim(),
        radiusMiles: Number(onboardingScanRadiusSelect.value),
      }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Save failed.");
    res = await fetch("/api/user-settings/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: onboardingFirstNameInput.value.trim(),
        lastName: onboardingLastNameInput.value.trim(),
        email: onboardingEmailInput.value.trim(),
      }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Save failed.");
    // Idempotent server-side (only resets jobs if the value is actually
    // changing — see the route) so it's safe to send unconditionally here,
    // even if onboarding gets re-run without touching this checkbox.
    res = await fetch("/api/user-settings/ai-generation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !onboardingAiOptoutCheck.checked }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Save failed.");
    clearInterval(onboardingProgressTimer);
    clearInterval(onboardingMessageTimer);
    onboardingProgressFill.style.width = "100%";
    onboardingLoadingMessage.textContent = "All set!";
    await sleep(400);
    // A full reload instead of closing the panel + re-rendering in place —
    // guarantees every card (and every other bit of cached state: profile,
    // aiGenerationEnabled, etc.) comes from a genuinely fresh fetch instead
    // of relying on this session's in-memory state and renderJobs()'s
    // card-reuse reconciliation to have caught every change. Picked up by
    // the sessionStorage check near the bottom of this file, which shows
    // the "all set" banner once the reloaded page finishes loading.
    sessionStorage.setItem("justFinishedOnboarding", "1");
    window.location.reload();
    return;
  } catch (err) {
    stopOnboardingProgress();
    onboardingError.textContent = `Couldn't finish setup: ${err.message}`;
    onboardingError.hidden = false;
  } finally {
    onboardingFinishBtn.disabled = false;
  }
});

addJobSubmitBtn.addEventListener("click", async () => {
  // The modal overlay sits on top of the page-level notice (see
  // requireProfile), so this checks isProfileComplete() directly and
  // reports inline via addJobError instead — otherwise the real message
  // would be invisible behind the modal.
  if (!isProfileComplete()) {
    addJobError.textContent = "Add your name and email in Job Settings before applying to jobs.";
    addJobError.hidden = false;
    return;
  }
  const url = addJobUrlInput.value.trim();
  if (!url) {
    addJobError.textContent = "Drop in a job posting URL to get started.";
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
    showBanner("Imported! Pinned to the top of New Jobs — go check it out.", "success");
  } catch (err) {
    addJobError.textContent = err.message;
    addJobError.hidden = false;
  } finally {
    addJobSubmitBtn.disabled = false;
  }
});

scanBtn.addEventListener("click", async () => {
  if (!requireProfile()) return;
  scanBtn.disabled = true;
  scanBtn.textContent = "Scanning...";
  try {
    const res = await fetch("/api/jobs/scan", { method: "POST" });
    const result = await res.json();
    await loadJobs();
    showBanner(
      result.new === 0
        ? `All caught up — no new postings this time (${result.found} checked).`
        : `Found ${result.new} new job${result.new === 1 ? "" : "s"} for you! (${result.found} checked total)`,
      "success",
    );
  } catch (err) {
    showBanner(`Couldn't complete the scan: ${err.message}`, "error");
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

// Waits for aiGenerationEnabled (and userProfile) to actually load before the
// very first renderJobs() — otherwise this races the /api/user-settings
// fetch above, and a first paint that loses the race renders every card
// against the wrong (default) aiGenerationEnabled value, with nothing to
// trigger a re-render once the real value comes in.
refreshUserProfile().then(loadJobs);

// The other half of onboardingFinishBtn's success path — it reloads the
// page instead of closing the panel in place, so the "all set" confirmation
// has to survive that reload rather than just being shown directly.
if (sessionStorage.getItem("justFinishedOnboarding")) {
  sessionStorage.removeItem("justFinishedOnboarding");
  showBanner("You're all set! We've pulled in jobs that match your settings — happy hunting!", "success");
  window.scrollTo(0, 0);
}
