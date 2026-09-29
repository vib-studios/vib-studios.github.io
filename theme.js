/*
 * Light/dark toggle.
 *
 * The theme is a single attribute on <html>. The CSS side does the work: all
 * the colour utilities compile to var(--color-*), so [data-theme="dark"] just
 * reassigns those names and the whole page flips. Nothing here touches styles.
 *
 * There are two parts, and the split matters:
 *
 *   theme-boot.js  runs inline in <head>, before anything is painted, and only
 *                  decides which theme to start on. A deferred script that did
 *                  this would show a white flash on every load for anyone who
 *                  chose dark, which is the whole reason people distrust
 *                  theme toggles.
 *
 *   theme.js      wires the button. Loaded at the end of <body>, so it never
 *                  competes with first paint.
 *
 * Preference order: an explicit choice stored in local storage, then the OS
 * setting, then light. An explicit choice is cleared by the "system" option so
 * the toggle can go back to following the OS.
 */
(() => {
  "use strict";

  const KEY = "vibmc:theme";
  const root = document.documentElement;

  const stored = () => {
    try {
      return window.localStorage.getItem(KEY);
    } catch {
      // Private browsing, or storage blocked. Theme still works for this page
      // view; it just will not be remembered.
      return null;
    }
  };

  const store = (value) => {
    try {
      if (value === null) window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, value);
    } catch {
      /* preference simply will not persist */
    }
  };

  const system = () =>
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";

  const resolve = () => {
    const choice = stored();
    return choice === "dark" || choice === "light" ? choice : system();
  };

  // Exposed so the button and the inline boot script agree on the rules
  // instead of each keeping their own copy.
  window.VibTheme = { KEY, resolve, store, system, root };

  const apply = (theme) => {
    root.dataset.theme = theme;
    // Keeps native widgets, scrollbars and form controls in step with the page.
    root.style.colorScheme = theme;
  };

  window.VibTheme.apply = apply;
  apply(resolve());

  /* The button. Two states, and every press visibly changes the page. */
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    const describe = () => {
      const theme = root.dataset.theme;
      // Say so when the theme is the system default rather than a choice: the
      // dashed border on the button carries the same information visually.
      return stored() ? theme : `${theme} (following your system)`;
    };

    const sync = () => {
      const what = describe();
      btn.setAttribute("aria-label", `Colour theme: ${what}. Activate to switch.`);
      btn.setAttribute("title", `Theme: ${what}`);
      btn.dataset.state = stored() || "system";
      // The icon shows the theme in effect now, not what the next press does.
      const icon = btn.querySelector("[data-icon]");
      if (icon) icon.textContent = root.dataset.theme === "dark" ? "☾" : "☀";
    };

    btn.addEventListener("click", () => {
      // Plain light <-> dark. A three-state rotation through "system" was tried
      // and abandoned: because "system" resolves to whatever the OS already
      // shows, one of the three states became unreachable and the sequence
      // oscillated between two. The system preference remains the default until
      // the first press, and the dashed border marks that you have not chosen.
      const next = root.dataset.theme === "dark" ? "light" : "dark";
      store(next);
      apply(next);
      sync();
    });

    // Keep following the OS while the user has not made an explicit choice.
    if (window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = () => {
        if (!stored()) {
          apply(system());
          sync();
        }
      };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }

    sync();
  });
})();
