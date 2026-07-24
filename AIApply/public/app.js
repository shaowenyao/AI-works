const jobsEl = document.getElementById("jobs");
const emptyEl = document.getElementById("empty");
const scanBtn = document.getElementById("scan-btn");
const undoBtn = document.getElementById("undo-btn");
const dummyBtn = document.getElementById("dummy-btn");
const locationFilter = document.getElementById("location-filter");
const seniorFilter = document.getElementById("senior-filter");
const tabButtons = document.querySelectorAll(".tab-btn");
const searchInput = document.getElementById("search-input");
const filterNoteEl = document.getElementById("filter-note");
const demoModeToggle = document.getElementById("demo-mode-toggle");
let currentTab = "current";

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
// Each tab keeps its own search text — switching tabs never carries a query
// over to (or clears one from) another tab.
const searchQueries = { current: "", applied: "", archived: "" };

function isToday(dateString) {
  const d = new Date(dateString);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/** Current = found today, not yet applied. Applied = applied regardless of date. Archived = found before today, not applied. */
function matchesTab(job) {
  if (currentTab === "applied") return job.status === "applied";
  if (job.status === "applied") return false;
  return currentTab === "current" ? isToday(job.date_found) : !isToday(job.date_found);
}

/** Computed server-side at scan time — see src/jobs/locationClassifier.ts. */
function isRemoteJob(job) {
  return Boolean(job.is_remote);
}

function isLocalJob(job) {
  return Boolean(job.is_local_sf);
}

const icons = {
  check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
  external: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
};

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function jobCard(job) {
  const hasDocs = job.resume_path && job.cover_letter_path;
  const isApplied = job.status === "applied";
  const statusLabel = job.status === "found" || job.status === "requested" ? job.company : job.status;

  const generateControl =
    hasDocs || isApplied
      ? ""
      : job.status === "requested"
        ? `<button class="request-btn btn-dark" disabled>CV In Claude</button>`
        : `<button class="request-btn btn-dark">Optimize CV</button>`;

  const dateBadge = `<span class="date-badge">${new Date(job.date_found).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>`;
  const priorityBadge = job.priority ? `<span class="priority">Priority</span>` : "";
  const markAppliedControl = !isApplied
    ? `<button class="applied-btn">${icons.check} Mark as applied</button>`
    : "";
  // Shown for any company that isn't auto-flagged from the static priority
  // list (job.priority with no verdict behind it) or that you've already
  // toggled yourself (has_verdict) — a manual way to mark a company as
  // legitimate (or not), toggable either direction. Only disappears once
  // you've actually applied, since the legitimacy call stops mattering then.
  const legitControl = (!job.priority || job.has_verdict) && !isApplied
    ? `<label class="legit-check"><input type="checkbox" class="legit-checkbox" ${job.priority ? "checked" : ""} /> Legit company</label>`
    : "";

  // Set once, permanently, the moment "Optimize CV" is clicked (see
  // markJobRequested in db/client.ts) — shown until the job is marked
  // applied, so it's clear which one to tackle next without the number
  // ever shifting as other jobs get applied to or removed.
  const applyOrderBadge =
    job.apply_order && !isApplied
      ? `<span class="apply-order-badge">Apply ${String(job.apply_order).padStart(4, "0")}</span>`
      : "";

  // Normally "Apply with AI fill" stays disabled until real tailored docs
  // exist (hasDocs) — those only show up once someone's actually asked
  // Claude to generate them (see manualGenerate.ts). In demo mode, jobs
  // whose "Optimize CV" click itself happened in demo mode (job.demo_started,
  // set once in markJobRequested) skip that wait instead. This is keyed off
  // the job's own history, not just the current toggle state — a job
  // started for real before demo mode was ever turned on stays gated on
  // hasDocs even while demo mode is on, so toggling it never retroactively
  // unlocks jobs that were already in progress.
  const applyEnabled = hasDocs || (demoMode && job.demo_started === 1);

  return `
    <div class="card ${job.priority ? "priority-card" : ""}" data-id="${job.id}" data-company="${escapeHtml(job.company)}" data-url="${escapeHtml(job.url)}">
      <div class="card-header">
        <h3 class="card-title"><a href="${escapeHtml(job.url)}" target="_blank" rel="noopener" class="title-link">${escapeHtml(job.title)}</a> — <span class="company">${escapeHtml(job.company)}</span></h3>
        <div class="card-badges">
          ${legitControl}
          ${priorityBadge}
          ${dateBadge}
          <span class="status">${escapeHtml(statusLabel)}</span>
        </div>
      </div>
      <div class="meta"></div>
      <div class="actions">
        ${generateControl}
        <button class="apply-btn" ${applyEnabled ? "" : "disabled"}>Apply with AI fill</button>
        ${markAppliedControl}
        <button class="dismiss-btn btn-danger">${icons.trash} Delete</button>
        <span class="links">
          ${applyOrderBadge}
          <a href="${escapeHtml(job.url)}" target="_blank" rel="noopener">View posting ${icons.external}</a>
          ${hasDocs ? `<a href="/files/${encodeURIComponent(job.resume_path.split("/").slice(-2).join("/"))}" target="_blank">Resume</a>` : ""}
          ${hasDocs ? `<a href="/files/${encodeURIComponent(job.cover_letter_path.split("/").slice(-2).join("/"))}" target="_blank">Cover letter</a>` : ""}
        </span>
      </div>
    </div>
  `;
}

let allJobs = [];

// Narrows the (potentially huge) scanned job list down to design roles only.
// Broader than a plain "designer" match (catches "Product Design Manager",
// "Design Lead", etc.) but excludes "engineer"/"recruiter"/"sourcer" titles
// that mention design without being a design role (Design Engineer,
// mechanical design roles, design recruiters, design sourcers), "model
// designer" (AI model-behavior design, not product/UX design), and a few
// titles explicitly opted out of: "lead product" (design), "vectorworks
// designer", "head of design".
function isDesignTitle(job) {
  const title = job.title.toLowerCase();
  return (
    title.includes("design") &&
    !title.includes("engineer") &&
    !title.includes("recruiter") &&
    !title.includes("sourcer") &&
    !title.includes("model designer") &&
    !title.includes("manager") &&
    !title.includes("director") &&
    !title.includes("content designer") &&
    !title.includes("industrial designer") &&
    !title.includes("bim designer") &&
    !title.includes("lead product") &&
    !title.includes("vectorworks designer") &&
    !title.includes("head of design")
  );
}

function renderJobs() {
  const query = searchQueries[currentTab].trim().toLowerCase();

  const jobs = allJobs
    .filter(matchesTab)
    .filter((job) => (locationFilter.value === "remote" ? isRemoteJob(job) : isLocalJob(job)))
    .filter(isDesignTitle)
    .filter(
      (job) =>
        seniorFilter.checked ||
        (!/\b(staff|principal|senior product)\b/i.test(job.title) && !/^sr\.?\s*product designer/i.test(job.title)),
    )
    .filter(
      (job) => !query || job.title.toLowerCase().includes(query) || job.company.toLowerCase().includes(query),
    );

  // Unlike Current/Archived (which just reflect date_found), "applied" is an
  // explicit action with its own timestamp (applied_date, set by
  // markJobApplied) — so show the most recently applied-to job first,
  // ignoring the priority-company grouping the other tabs use, so it
  // actually reflects the order you applied in.
  if (currentTab === "applied") {
    jobs.sort((a, b) => (b.applied_date ?? "").localeCompare(a.applied_date ?? ""));
  }

  const emptyMessages = {
    current: `No jobs yet. Ask Claude to add the companies you want to track, then click "Scan for new jobs".`,
    applied: "Nothing here yet — jobs you mark as applied will show up in this tab.",
    archived: "Nothing archived yet — jobs land here automatically once they're no longer from today.",
  };
  emptyEl.textContent = emptyMessages[currentTab];
  emptyEl.hidden = jobs.length > 0;

  const filterNotes = {
    current: "Last 24 hours",
    applied: "",
    archived: `Last cleared ${daysAgo(ARCHIVE_RETENTION_DAYS).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`,
  };
  filterNoteEl.textContent = filterNotes[currentTab];

  jobsEl.innerHTML = jobs.map(jobCard).join("");
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
        // demoMode is recorded permanently on the job (see demo_started) so
        // it's tied to how this job was actually started, not whatever the
        // toggle happens to be set to later.
        await fetch(`/api/jobs/${id}/request-generation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ demoMode }),
        });
        await loadJobs();
        // Same backend flag as regular mode (status "requested" + apply_order
        // assigned) — demo mode only adds this popup on top, standing in for
        // the real "Claude wrote your resume" moment for UX-testing purposes.
        if (demoMode) alert("Resume ready");
      } catch (err) {
        alert(`Failed to request generation: ${err.message}`);
        e.target.disabled = false;
        e.target.textContent = "Optimize CV";
      }
    });

    card.querySelector(".apply-btn").addEventListener("click", (e) => {
      // Same treatment as "CV In Claude" the moment the button is pressed
      // (while it's enabled) — dark, disabled pill — in both modes, so it's
      // visually clear the click registered instead of staying pressable.
      e.target.disabled = true;
      e.target.classList.add("btn-dark");

      // "Apply with AI fill" doesn't own any backend flag in regular mode
      // either — it's purely client-side (opens the listing). Marking a job
      // applied is a separate, deliberate action via "Mark as applied", so
      // demo mode must not call that here — it just skips the real
      // navigation and pops a message instead.
      if (demoMode) {
        alert("Job applied");
        return;
      }
      window.open(url, "_blank", "noopener");
    });

    const appliedBtn = card.querySelector(".applied-btn");
    appliedBtn?.addEventListener("click", async (e) => {
      e.target.disabled = true;
      e.target.textContent = "Marking...";
      try {
        await fetch(`/api/jobs/${id}/mark-applied`, { method: "POST" });
        await loadJobs();
      } catch (err) {
        alert(`Failed to mark as applied: ${err.message}`);
        e.target.disabled = false;
        e.target.textContent = "Mark as applied";
      }
    });

    card.querySelector(".dismiss-btn")?.addEventListener("click", async (e) => {
      e.target.disabled = true;
      try {
        await fetch(`/api/jobs/${id}/dismiss`, { method: "POST" });
        await loadJobs();
      } catch (err) {
        alert(`Failed to delete: ${err.message}`);
        e.target.disabled = false;
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

locationFilter.addEventListener("change", renderJobs);
seniorFilter.addEventListener("change", renderJobs);

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    currentTab = btn.dataset.tab;
    tabButtons.forEach((b) => b.classList.toggle("active", b === btn));
    searchInput.value = searchQueries[currentTab];
    renderJobs();
  });
});

searchInput.addEventListener("input", () => {
  searchQueries[currentTab] = searchInput.value;
  renderJobs();
});

loadJobs();
