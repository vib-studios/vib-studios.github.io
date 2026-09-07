/*
 * The portal at the site root.
 *
 * Two jobs, both small. It replaces the release numbers on the cards with
 * whatever GitHub is actually serving, so the page cannot go stale while
 * nobody is looking, and it remembers which side was opened last so a
 * returning visitor is reminded rather than redirected.
 *
 * The markup already carries the current numbers, so a blocked or failed
 * request leaves the page correct rather than empty.
 */
(() => {
  "use strict";

  /* -- live release numbers ----------------------------------------------- */

  const fmtSize = (bytes) => {
    if (!Number.isFinite(bytes)) return null;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB zip`;
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB zip`;
  };

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el && text) el.textContent = text;
  };

  const latest = (repo) =>
    window.fetch(`https://api.github.com/repos/vib-studios/${repo}/releases/latest`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      });

  latest("vib-MC")
    .then((release) => setText("mc-tag", release.tag_name))
    .catch(() => { /* the card keeps the number in the markup */ });

  latest("viblauncher")
    .then((release) => {
      setText("vl-tag", release.tag_name);
      const zip = (release.assets || []).find((a) => a.name.endsWith(".zip"));
      if (zip) setText("vl-size", fmtSize(zip.size));
    })
    .catch(() => { /* likewise */ });

  /* -- which side was opened last ----------------------------------------- */

  const KEY = "vib-studios-side";

  const read = () => {
    try { return window.localStorage.getItem(KEY); } catch (e) { return null; }
  };

  const cards = Array.from(document.querySelectorAll("[data-side]"));
  const last = read();

  cards.forEach((card) => {
    if (card.getAttribute("data-side") === last) {
      const note = card.querySelector("[data-last]");
      if (note) note.hidden = false;
    }

    card.addEventListener("click", () => {
      try {
        window.localStorage.setItem(KEY, card.getAttribute("data-side"));
      } catch (e) {
        /* private browsing: the link still works, the note just will not show */
      }
    });
  });
})();
