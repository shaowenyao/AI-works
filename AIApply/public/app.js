const jobsEl = document.getElementById("jobs");
const emptyEl = document.getElementById("empty");
const scanBtn = document.getElementById("scan-btn");

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function jobCard(job) {
  const hasDocs = job.resume_path && job.cover_letter_path;
  const isRequested = job.status === "requested";
  const isApplied = job.status === "applied";

  let generateControl;
  if (hasDocs) {
    generateControl = "";
  } else if (isRequested) {
    generateControl = `<span class="hint">Requested — ask Claude in your Cowork session to generate this one</span>`;
  } else {
    generateControl = `<button class="request-btn">Generate Resume</button>`;
  }

  const priorityBadge = job.priority ? `<span class="priority">★ Priority</span>` : "";
  const markAppliedControl =
    hasDocs && !isApplied ? `<button class="applied-btn">Mark as Applied</button>` : "";
  // Only shown for companies with no priority flag yet — a manual, one-click
  // way to mark a company as legitimate yourself, no AI check required.
  const legitControl = !job.priority
    ? `<label class="legit-check"><input type="checkbox" class="legit-checkbox" /> Legit company</label>`
    : "";

  return `
    <div class="card ${job.priority ? "priority-card" : ""}" data-id="${job.id}" data-company="${escapeHtml(job.company)}">
      <h3>${escapeHtml(job.title)} — ${escapeHtml(job.company)}${priorityBadge}<span class="status">${escapeHtml(job.status)}</span></h3>
      <div class="meta">${escapeHtml(job.source)} · found ${new Date(job.date_found).toLocaleDateString()}</div>
      <div class="actions">
        ${generateControl}
        <button class="apply-btn" ${hasDocs ? "" : "disabled"}>Open &amp; Auto-fill Application</button>
        ${markAppliedControl}
        ${legitControl}
        <button class="dismiss-btn">Dismiss</button>
        <a href="${escapeHtml(job.url)}" target="_blank" rel="noopener">View posting</a>
        ${hasDocs ? `<a href="/files/${encodeURIComponent(job.resume_path.split("/").slice(-2).join("/"))}" target="_blank">Resume</a>` : ""}
        ${hasDocs ? `<a href="/files/${encodeURIComponent(job.cover_letter_path.split("/").slice(-2).join("/"))}" target="_blank">Cover letter</a>` : ""}
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
        e.target.textContent = "Generate Resume";
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
        e.target.textContent = "Mark as Applied";
      }
    });

    card.querySelector(".dismiss-btn")?.addEventListener("click", async (e) => {
      if (!confirm("Dismiss this posting? It'll be hidden from the list.")) return;
      e.target.disabled = true;
      try {
        await fetch(`/api/jobs/${id}/dismiss`, { method: "POST" });
        await loadJobs();
      } catch (err) {
        alert(`Failed to dismiss: ${err.message}`);
        e.target.disabled = false;
      }
    });

    const legitCheckbox = card.querySelector(".legit-checkbox");
    legitCheckbox?.addEventListener("change", async (e) => {
      if (!e.target.checked) return;
      e.target.disabled = true;
      try {
        await fetch(`/api/verdicts/${encodeURIComponent(company)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decent: true }),
        });
        await loadJobs();
      } catch (err) {
        alert(`Failed to save: ${err.message}`);
        e.target.disabled = false;
        e.target.checked = false;
      }
    });
  });
}

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
