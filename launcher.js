/*
 * Release data and page controls for the Vib-launcher article.
 *
 * The vib-MC page pins its stable tag because that project ships prereleases
 * between stable ones. Vib-launcher does not, so this asks GitHub for the
 * latest release and follows it. Every field it fills already holds the
 * current value in the markup, so a rate-limited or blocked request leaves the
 * page correct rather than showing "fetching" forever.
 */
(() => {
  "use strict";

  const REPO = "vib-studios/viblauncher";
  const API = `https://api.github.com/repos/${REPO}/releases/latest`;
  const FALLBACK_TAG = "v0.1.1";
  const FALLBACK_ZIP =
    `https://github.com/${REPO}/releases/download/${FALLBACK_TAG}/VibLauncher-${FALLBACK_TAG.slice(1)}-win-x64.zip`;

  const downloadBtns = [
    document.getElementById("download-btn"),
    document.getElementById("download-btn-cta"),
  ].filter(Boolean);
  const downloadLabel = document.getElementById("download-label");
  const releaseTag = document.getElementById("release-tag");
  const releaseDate = document.getElementById("release-date");
  const releaseSize = document.getElementById("release-size");
  const releaseNotes = document.getElementById("release-notes");
  const versionStable = document.getElementById("version-stable");

  const fmtSize = (bytes) => {
    if (!Number.isFinite(bytes)) return "-";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const fmtDate = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : "-");

  const firstZip = (release) => {
    const assets = (release && release.assets) || [];
    return assets.find((a) => /win-x64\.zip$/.test(a.name)) || assets.find((a) => a.name.endsWith(".zip")) || null;
  };

  const notesExcerpt = (body) => {
    if (!body) return "";
    const text = body.replace(/^#+\s*/gm, "").replace(/\*\*/g, "").trim();
    return text.slice(0, 140) + (text.length > 140 ? "..." : "");
  };

  const applyRelease = (release, zip) => {
    const tag = (release && release.tag_name) || FALLBACK_TAG;
    const href = zip ? zip.browser_download_url : FALLBACK_ZIP;

    downloadBtns.forEach((btn) => { btn.href = href; });
    if (downloadLabel) downloadLabel.textContent = `Download ${tag}`;
    if (releaseTag) releaseTag.textContent = tag;
    if (releaseDate) releaseDate.textContent = fmtDate(release && release.published_at);
    if (releaseSize) releaseSize.textContent = fmtSize(zip && zip.size);
    if (releaseNotes) {
      releaseNotes.textContent =
        notesExcerpt(release && release.body) || `${tag} is the current release.`;
    }
    if (versionStable) versionStable.textContent = tag;
  };

  window.fetch(API)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((release) => applyRelease(release, firstZip(release)))
    .catch(() => applyRelease(null, null));

  /* -- copy controls ------------------------------------------------------ */

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  };

  const copyBtn = document.getElementById("copy-btn");
  const copyLabel = document.getElementById("copy-label");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      await copyText("dotnet build -c Release\ndotnet run --project src/VibLauncher.App");
      if (copyLabel) {
        const prev = copyLabel.textContent;
        copyLabel.textContent = "copied ✓";
        window.setTimeout(() => { copyLabel.textContent = prev; }, 1600);
      }
    });
  }

  document.querySelectorAll(".copy-cmd").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const cmd = btn.textContent.trim();
      await copyText(cmd);
      const prev = btn.textContent;
      btn.textContent = "copied ✓";
      window.setTimeout(() => { btn.textContent = prev; }, 1200);
    });
  });

  /* -- bug report, opened as a pre-written issue --------------------------- */

  const bugForm = document.getElementById("bug-form");
  if (!bugForm) return;

  const bugTitle = document.getElementById("bug-title");
  const bugWhat = document.getElementById("bug-what");
  const bugSteps = document.getElementById("bug-steps");
  const bugVersion = document.getElementById("bug-version");
  const bugLog = document.getElementById("bug-log");

  bugForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = (bugTitle && bugTitle.value.trim()) || "bug report";
    const body = [
      "# What's the issue?",
      (bugWhat && bugWhat.value.trim()) || "",
      "",
      "# How did it occur?",
      (bugSteps && bugSteps.value.trim()) || "",
      "",
      "# Version & log",
      `Release: ${(bugVersion && bugVersion.value.trim()) || FALLBACK_TAG}`,
      `Log: ${(bugLog && bugLog.value.trim()) || "not provided"}`,
    ].join("\n");
    const url = `https://github.com/${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    window.open(url, "_blank", "noopener");
  });
})();
