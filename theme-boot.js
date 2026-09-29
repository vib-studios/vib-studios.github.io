/*
 * Applies the stored colour theme before first paint.
 *
 * This has to be inline in <head> and it has to be synchronous. Any other
 * arrangement — a deferred script, a script at the end of <body>, a blocking
 * external file — lets the browser paint the light theme first, so someone who
 * chose dark sees a white flash on every single page load. The cost is one
 * uncached read of a single localStorage key, which is far cheaper than the
 * flash, and this way there is no extra request at all.
 *
 * Kept deliberately minimal: it reads one key, checks prefers-color-scheme, and
 * sets one attribute. All the colour work is done by the stylesheet, where
 * [data-theme="dark"] reassigns the --color-* names. See src/input.css.
 *
 * theme.js reads the same key and the same media query, so the two agree on
 * which theme is in effect without a flash or a mismatch. If you change the
 * storage key, change it in both files.
 */
(function () {
  try {
    var KEY = "vibmc:theme";
    var stored = localStorage.getItem(KEY);
    var theme =
      stored === "dark" || stored === "light"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    var root = document.documentElement;
    root.dataset.theme = theme;
    // Native widgets, scrollbars and form controls follow along.
    root.style.colorScheme = theme;
  } catch (e) {
    // Storage blocked or matchMedia unavailable: light is a fine default.
  }
})();
