/* Wiki chrome: the theme switch, the contents toggle and the in-page section
   search. Everything the release data needs still lives in website.js. */
(() => {
  "use strict";

  /* -- Light and dark ------------------------------------------------------

     Three states. With nothing stored the page follows the operating system,
     which is what the stylesheet does on its own. Choosing a theme stamps
     data-theme on <html> and that choice sticks. The same one-liner runs in
     <head> before paint, so this only has to keep the control in step. */

  const THEME_KEY = "vibmc-wiki-theme";
  const root = document.documentElement;
  const themeBtn = document.getElementById("theme-toggle");

  const systemDark = () =>
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

  const activeTheme = () => root.getAttribute("data-theme") || (systemDark() ? "dark" : "light");

  const paintThemeControl = () => {
    if (!themeBtn) return;
    const dark = activeTheme() === "dark";
    const label = themeBtn.querySelector(".mcw-tool__label");
    if (label) label.textContent = dark ? "Light" : "Dark";
    themeBtn.setAttribute("aria-pressed", String(dark));
    themeBtn.setAttribute("title", dark ? "Switch to the light theme" : "Switch to the dark theme");

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#15171a" : "#303030");
  };

  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const next = activeTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch (e) {
        /* private browsing: the theme still applies, it just will not persist */
      }
      paintThemeControl();
    });
  }

  // Someone who never picked a theme should follow the system if it changes
  // while the page is open.
  if (window.matchMedia) {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => { if (!root.hasAttribute("data-theme")) paintThemeControl(); };
    if (query.addEventListener) query.addEventListener("change", onChange);
    else if (query.addListener) query.addListener(onChange);
  }

  paintThemeControl();

  /* -- Contents box, collapsed the way MediaWiki does it ------------------ */

  const toc = document.getElementById("toc");
  const tocToggle = document.getElementById("toc-toggle");

  if (toc && tocToggle) {
    tocToggle.addEventListener("click", () => {
      const collapsed = toc.getAttribute("data-collapsed") === "true";
      toc.setAttribute("data-collapsed", String(!collapsed));
      tocToggle.setAttribute("aria-expanded", String(collapsed));
      tocToggle.textContent = collapsed ? "[hide]" : "[show]";
    });
  }

  /* -- In-page search ----------------------------------------------------- */

  const form = document.getElementById("page-search");
  if (!form) return;

  const input = document.getElementById("search-input");
  const msg = document.getElementById("search-msg");

  // Search only what is genuinely on the page: headings first, so a hit lands
  // on a section rather than mid-paragraph.
  const headings = Array.from(
    document.querySelectorAll(".mcw-sheet h2[id], .mcw-sheet h3[id], .mcw-sheet h4[id]")
  );

  const textOf = (el) => {
    const clone = el.cloneNode(true);
    clone.querySelectorAll(".mcw-editsection").forEach((n) => n.remove());
    return clone.textContent.trim();
  };

  const say = (text) => { if (msg) msg.textContent = text; };

  const jumpTo = (el) => {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    // Move the caret there too, so keyboard users continue from the heading.
    el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = (input.value || "").trim().toLowerCase();

    if (!query) {
      say("");
      return;
    }

    const heading = headings.find((h) => textOf(h).toLowerCase().includes(query));
    if (heading) {
      say(`Section: ${textOf(heading)}`);
      jumpTo(heading);
      return;
    }

    // Fall back to the first paragraph, list item or table row that mentions it.
    const blocks = Array.from(
      document.querySelectorAll(".mcw-sheet p, .mcw-sheet li, .mcw-sheet dd, .mcw-sheet tr")
    );
    const block = blocks.find((b) => b.textContent.toLowerCase().includes(query));

    if (block) {
      const section = block.closest("section") || block;
      say("Found in the article text.");
      jumpTo(section === block ? block : section);
      return;
    }

    say(`No match for "${input.value.trim()}" on this page.`);
  });

  if (input) {
    input.addEventListener("input", () => { if (!input.value) say(""); });
  }
})();
