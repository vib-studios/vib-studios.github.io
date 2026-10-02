/*
 * Site behaviour: release data, copy buttons, bug reports, scroll reveal.
 *
 * Release data used to live in two near-identical scripts, website.js for
 * vib-MC and launcher.js for Vib-launcher, each hardcoded to one repository
 * and each reaching for the same element ids (download-btn, bug-form,
 * copy-btn, ...). That worked only because the two projects lived on separate
 * pages. The landing page now carries both in one document, where a second
 * element with the same id is invalid and getElementById would silently return
 * the wrong project's controls.
 *
 * So both are driven from one script, scoped to a block instead of to ids.
 * Each project section declares itself with data-release and the script only
 * ever touches descendants of that block, so any number of projects can share a
 * page. The ids are gone from the markup entirely.
 *
 *   <section data-release
 *            data-repo="vib-studios/vib-MC"
 *            data-tag="v0.0.7"
 *            data-asset="jar"
 *            data-fallback-tag="v0.0.7"
 *            data-fallback-url="https://.../vib-mc.jar"
 *            data-copy-cmd="./gradlew build"
 *            data-issue-repo="vib-studios/vib-MC">
 *
 * data-tag pins a known-good release. Omit it to follow the latest release,
 * which is what Vib-launcher wants because it ships continuously. Every value
 * the script writes is already present in the markup at its current value, so a
 * rate-limited, blocked or failed request leaves the page correct rather than
 * showing "fetching" forever.
 */
(() => {
  "use strict";

  /* -- scroll reveal ------------------------------------------------------ */

  /* First thing in this file, on purpose. theme-boot.js has already put .js on
     <html>, which is what arms the hidden state in src/input.css, so from this
     moment on every .reveal is invisible until it is revealed. That makes this
     the one block that must not be allowed to strand the page: a throw anywhere
     below would leave the whole document at opacity 0. So it runs before
     anything else can fail. */
  const revealables = document.querySelectorAll(".reveal:not(.is-visible)");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!reduced && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealables.forEach((el) => io.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add("is-visible"));
  }

  /* -- formatting --------------------------------------------------------- */

  const fmtSize = (bytes) => {
    if (!Number.isFinite(bytes)) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const fmtDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toISOString().slice(0, 10);
  };

  // Strip markdown heading marks and emphasis so the excerpt reads as prose.
  const notesExcerpt = (body) => {
    if (!body) return "";
    const text = body.replace(/^#+\s*/gm, "").replace(/\*\*/g, "").trim();
    return text.slice(0, 160) + (text.length > 160 ? "…" : "");
  };

  /* -- asset selection ---------------------------------------------------- */

  // Each project ships a differently named artefact, so the caller says what to
  // look for rather than this script guessing from the repository name.
  const ASSET_MATCHERS = {
    // vib-MC: one jar, and it is called vib-mc.jar.
    jar: (a) => (a.name === "vib-mc.jar" || a.name.endsWith(".jar") ? 1 : 0),
    // Vib-launcher: Linux tarballs, one per architecture. x64 ranks above
    // arm64 because it is the common case.
    linux: (a) =>
      /linux.*x64.*\.tar\.gz$/i.test(a.name) ? 2 : /linux.*arm64.*\.tar\.gz$/i.test(a.name) ? 1 : 0,
    // The Windows build, for releases that still ship one.
    winzip: (a) => (/win-x64\.zip$/i.test(a.name) ? 2 : /\.zip$/i.test(a.name) ? 1 : 0),
  };

  /*
   * Ranked rather than first-match, so a project always resolves to the
   * artefact it actually published instead of quietly falling back to a
   * hardcoded download URL pointing at some other version.
   *
   * This is not hypothetical: Vib-launcher v0.2.0 ships Linux tarballs, where
   * v0.1.1 shipped a Windows zip. A matcher set that only knew about .zip
   * would find nothing in v0.2.0, fall through to the fallback URL, and link
   * the v0.1.1 build while labelling the button v0.2.0.
   */
  const pickAsset = (release, kind) => {
    const assets = (release && release.assets) || [];
    const match = ASSET_MATCHERS[kind];
    if (match) {
      const ranked = assets
        .map((a) => ({ a, rank: match(a) }))
        .filter((r) => r.rank > 0)
        // Higher rank is the better match, so sort descending.
        .sort((x, y) => y.rank - x.rank);
      if (ranked.length) return ranked[0].a;
    }
    // Last resort: any archive at all, then any asset the release has.
    return (
      assets.find((a) => /\.(jar|zip|tar\.gz|exe|dmg)$/i.test(a.name)) || assets[0] || null
    );
  };

  /* -- one project block -------------------------------------------------- */

  const initProject = (block) => {
    const repo = block.dataset.repo;
    if (!repo) return;

    const tag = block.dataset.tag || null;
    const fallbackTag = block.dataset.fallbackTag || tag || "latest";
    const fallbackUrl = block.dataset.fallbackUrl || "";
    const issueRepo = block.dataset.issueRepo || repo;
    const kind = block.dataset.asset || "";

    // Every lookup is scoped to this block.
    const find = (sel) => block.querySelector(`[data-${sel}]`);
    const findAll = (sel) => Array.from(block.querySelectorAll(`[data-${sel}]`));

    const downloadBtns = findAll("download");
    const downloadLabel = find("download-label");
    const releaseTag = find("release-tag");
    const releaseDate = find("release-date");
    const releaseSize = find("release-size");
    const releaseNotes = find("release-notes");
    const versionStable = find("version-stable");

    const apply = (release, asset) => {
      const href = (asset && asset.browser_download_url) || fallbackUrl;
      const shownTag = (release && release.tag_name) || fallbackTag;

      if (href) {
        downloadBtns.forEach((btn) => {
          btn.href = href;
          btn.removeAttribute("data-fallback");
        });
      }
      if (downloadLabel) downloadLabel.textContent = `Download ${shownTag}`;
      if (releaseTag) releaseTag.textContent = shownTag;
      if (releaseDate) releaseDate.textContent = fmtDate(release && release.published_at);
      if (releaseSize) releaseSize.textContent = fmtSize(asset && asset.size);
      if (releaseNotes) {
        releaseNotes.textContent =
          notesExcerpt(release && release.body) || `${shownTag} is the current release.`;
      }
      if (versionStable) versionStable.textContent = shownTag;
    };

    const api = tag
      ? `https://api.github.com/repos/${repo}/releases/tags/${tag}`
      : `https://api.github.com/repos/${repo}/releases/latest`;

    window
      .fetch(api)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((release) => {
        if (!release || release.draft) throw new Error("no usable release");
        // A pinned tag must still be the tag that was asked for, otherwise the
        // "stable" number on the page and the artefact being linked disagree.
        if (tag && release.tag_name !== tag) throw new Error("pinned tag unavailable");
        apply(release, pickAsset(release, kind));
      })
      .catch(() => apply(null, null));

    /* Bug report -> prefilled GitHub issue. */
    const form = find("bug-form");
    if (form) {
      const field = (n) => find(`bug-${n}`);
      const version = field("version");
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const title = (field("title") && field("title").value.trim()) || "bug report";
        const body = [
          "# What's the issue?",
          (field("what") && field("what").value.trim()) || "",
          "",
          "# How did it occur?",
          (field("steps") && field("steps").value.trim()) || "",
          "",
          "# Version & log",
          `Release: ${(version && version.value.trim()) || fallbackTag}`,
          `Log: ${(field("log") && field("log").value.trim()) || "not provided"}`,
        ].join("\n");
        const url = `https://github.com/${issueRepo}/issues/new?title=${encodeURIComponent(
          title
        )}&body=${encodeURIComponent(body)}`;
        window.open(url, "_blank", "noopener");
      });
    }

    /* Copy a command, with a brief confirmation in the button itself. */
    const copyBtn = find("copy-btn");
    if (copyBtn && block.dataset.copyCmd) {
      copyBtn.addEventListener("click", async () => {
        await copyText(block.dataset.copyCmd);
        const label = find("copy-label");
        if (label) flash(label, "copied");
      });
    }
  };

  /* -- clipboard ---------------------------------------------------------- */

  // navigator.clipboard needs a secure context, and this site is also served
  // over plain http on a LAN, so keep the execCommand path as a real fallback
  // rather than a token one.
  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      /* fall through to the textarea approach */
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    } catch {
      /* clipboard unavailable; nothing useful to do here */
    }
  };

  const flash = (el, text, ms = 1600) => {
    if (!el) return;
    const prev = el.textContent;
    el.textContent = text;
    window.setTimeout(() => {
      el.textContent = prev;
    }, ms);
  };

  /* -- inline code blocks ------------------------------------------------- */

  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const src = btn.dataset.copy;
      // data-copy with no value means "copy the text of this code element".
      const text = src || (btn.closest("[data-code]") || {}).textContent || "";
      if (!text.trim()) return;
      await copyText(text.trim());
      flash(btn, "copied", 1200);
    });
  });

  /* -- go ----------------------------------------------------------------- */

  document.querySelectorAll("[data-release]").forEach(initProject);
})();
