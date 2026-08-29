(() => {
  "use strict";

  const REPO = "vib-studios/vib-MC";
  const STABLE_TAG = "v0.0.7";
  const API = `https://api.github.com/repos/${REPO}/releases/tags/${STABLE_TAG}`;
  const FALLBACK_JAR = `https://github.com/${REPO}/releases/download/${STABLE_TAG}/vib-mc.jar`;

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
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const fmtDate = (iso) => {
    if (!iso) return "-";
    return new Date(iso).toISOString().slice(0, 10);
  };

  const firstJar = (release) => {
    const assets = release.assets || [];
    return assets.find((a) => a.name === "vib-mc.jar") || assets.find((a) => a.name.endsWith(".jar")) || null;
  };

  const notesExcerpt = (body) => {
    if (!body) return "";
    const text = body.replace(/^#+\s*/gm, "").replace(/\*\*/g, "").trim();
    return text.slice(0, 140) + (text.length > 140 ? "..." : "");
  };

  const applyRelease = (release, jar) => {
    const href = jar ? jar.browser_download_url : FALLBACK_JAR;
    downloadBtns.forEach((btn) => {
      if (btn) {
        btn.href = href;
        btn.removeAttribute("data-fallback");
      }
    });
    if (downloadLabel) downloadLabel.textContent = `Download ${STABLE_TAG}`;
    if (releaseTag) releaseTag.textContent = STABLE_TAG;
    if (releaseDate) releaseDate.textContent = fmtDate(release && release.published_at);
    if (releaseSize) releaseSize.textContent = fmtSize(jar && jar.size);
    if (releaseNotes) releaseNotes.textContent = notesExcerpt(release && release.body) || `${STABLE_TAG} is the current stable baseline.`;
    if (versionStable) versionStable.textContent = STABLE_TAG;
  };

  window.fetch(API)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((release) => {
      if (!release || release.draft || release.prerelease || release.tag_name !== STABLE_TAG) {
        throw new Error("stable release unavailable");
      }
      applyRelease(release, firstJar(release));
    })
    .catch(() => {
      applyRelease(null, null);
    });

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
      await copyText("./gradlew build\njava -jar build/libs/vib-mc.jar");
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

  const bugForm = document.getElementById("bug-form");
  if (bugForm) {
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
        `Release: ${(bugVersion && bugVersion.value.trim()) || STABLE_TAG}`,
        `Log: ${(bugLog && bugLog.value.trim()) || "not provided"}`,
      ].join("\n");
      const url = `https://github.com/vib-studios/vib-MC/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
      window.open(url, "_blank", "noopener");
    });
  }

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!prefersReduced && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll(".reveal:not(.is-visible)").forEach((el) => io.observe(el));
  } else {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
  }
})();
