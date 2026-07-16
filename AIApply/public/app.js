const jobsEl = document.getElementById("jobs");
const emptyEl = document.getElementById("empty");
const scanBtn = document.getElementById("scan-btn");
const undoBtn = document.getElementById("undo-btn");
const dummyBtn = document.getElementById("dummy-btn");

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

const sourceLabels = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
  bamboohr: "BambooHR",
};

function jobCard(job) {
  const hasDocs = job.resume_path && job.cover_letter_path;
  const isApplied = job.status === "applied";
  const statusLabel = job.status === "found" || job.status === "requested"
    ? sourceLabels[job.source] || job.source
    : job.status;

  const generateControl =
    hasDocs || isApplied ? "" : `<button class="request-btn btn-dark">Generate resume</button>`;

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

  return `
    <div class="card ${job.priority ? "priority-card" : ""}" data-id="${job.id}" data-company="${escapeHtml(job.company)}">
      <div class="card-header">
        <h3 class="card-title">${escapeHtml(job.title)} — <span class="company">${escapeHtml(job.company)}</span></h3>
        <div class="card-badges">
          ${legitControl}
          ${priorityBadge}
          ${dateBadge}
          <span class="status">${escapeHtml(statusLabel)}</span>
        </div>
      </div>
      <div class="meta">${escapeHtml(job.source)}</div>
      <div class="actions">
        ${generateControl}
        <button class="apply-btn" ${hasDocs ? "" : "disabled"}>Open and auto-fill application</button>
        ${markAppliedControl}
        <button class="dismiss-btn btn-danger">${icons.trash} Delete</button>
        <span class="links">
          <a href="${escapeHtml(job.url)}" target="_blank" rel="noopener">View posting ${icons.external}</a>
          ${hasDocs ? `<a href="/files/${encodeURIComponent(job.resume_path.split("/").slice(-2).join("/"))}" target="_blank">Resume</a>` : ""}
          ${hasDocs ? `<a href="/files/${encodeURIComponent(job.cover_letter_path.split("/").slice(-2).join("/"))}" target="_blank">Cover letter</a>` : ""}
        </span>
      </div>
    </div>
  `;
}

async function loadJobs() {
  const res = await fetch("/api/jobs");
  const jobs = await res.json();

  emptyEl.hidden = jobs.length > 0;
  jobsEl.innerHTML = jobs.map(jobCard).join("");

  jobsEl.querySelectorAll(".card").forEach((card) => {
    const id = card.dataset.id;
    const company = card.dataset.company;

    const requestBtn = card.querySelector(".request-btn");
    requestBtn?.addEventListener("click", async (e) => {
      e.target.disabled = true;
      e.target.textContent = "Requesting...";
      try {
        await fetch(`/api/jobs/${id}/request-generation`, { method: "POST" });
        await loadJobs();
      } catch (err) {
        alert(`Failed to request generation: ${err.message}`);
        e.target.disabled = false;
        e.target.textContent = "Generate resume";
      }
    });

    card.querySelector(".apply-btn").addEventListener("click", async (e) => {
      e.target.disabled = true;
      try {
        await fetch(`/api/jobs/${id}/apply`, { method: "POST" });
      } catch (err) {
        alert(`Failed to open application: ${err.message}`);
      } finally {
        e.target.disabled = false;
      }
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
      if (!confirm("Delete this posting? You can undo this with the \"Undo delete\" button.")) return;
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
    await fetch("/api/jobs/dummy", { method: "POST" });
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

loadJobs();
