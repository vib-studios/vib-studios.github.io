/*
 * Layout switch, shared by both skins.
 *
 * The wiki pages live at the root and set <html data-skin="wiki">; the original
 * design lives in classic/ and sets data-skin="classic". This script remembers
 * which one a visitor picked and sends them there on the next visit, so someone
 * who prefers the old site keeps getting it.
 *
 * It runs from <head> so the swap happens before anything is painted.
 *
 * The portal at the site root and the Vib-launcher article exist in one layout
 * only, so neither loads this script and neither is ever redirected.
 */
(() => {
  "use strict";

  const KEY = "vibmc-skin";
  const HOP = "vibmc-skin-hop";

  // Every page that exists in both layouts, as [wiki page, classic page]. The
  // two names differ for the vib-MC article: it is vibmc.html in the wiki
  // layout, because the root index.html is the portal, and index.html in the
  // classic layout, which has no portal above it.
  const PAIRS = [
    ["vibmc.html", "index.html"],
    ["docs.html", "docs.html"],
    ["privacy.html", "privacy.html"],
    ["terms.html", "terms.html"],
  ];

  // Where a skin lands when the current page has no counterpart in it.
  const HOME = { wiki: "vibmc.html", classic: "index.html" };

  const current = document.documentElement.getAttribute("data-skin") || "wiki";

  const read = (store, key) => {
    try { return window[store].getItem(key); } catch (e) { return null; }
  };
  const write = (store, key, value) => {
    try { window[store].setItem(key, value); } catch (e) { /* storage blocked */ }
  };
  const drop = (store, key) => {
    try { window[store].removeItem(key); } catch (e) { /* storage blocked */ }
  };

  const pageName = () => {
    const last = window.location.pathname.split("/").pop();
    return last === "" ? HOME[current] : last;
  };

  const urlFor = (skin, page) => (skin === "classic" ? "classic/" + page : "../" + page);

  // The same page in the other layout, or null when this page exists in one
  // layout only.
  const counterpart = (skin, page) => {
    const mine = skin === "wiki" ? 0 : 1;
    const pair = PAIRS.find((p) => p[mine] === page);
    return pair ? pair[1 - mine] : null;
  };

  /* -- an explicit ?skin= wins over the stored preference ------------------ */

  const forced = new URLSearchParams(window.location.search).get("skin");
  if (forced === "wiki" || forced === "classic") {
    write("localStorage", KEY, forced);
  }

  /* -- send a returning visitor to the layout they chose ------------------- */

  const preferred = read("localStorage", KEY);
  const page = pageName();
  const twin = counterpart(current, page);

  if (preferred && preferred !== current && twin) {
    // If a hop has just happened, clear the marker and stay put rather than
    // risk bouncing between two pages that disagree about which skin they are.
    if (read("sessionStorage", HOP)) {
      drop("sessionStorage", HOP);
    } else {
      write("sessionStorage", HOP, "1");
      window.location.replace(urlFor(preferred, twin));
      return;
    }
  } else {
    drop("sessionStorage", HOP);
  }

  /* -- wire the switch controls ------------------------------------------- */

  const other = current === "wiki" ? "classic" : "wiki";

  const wire = () => {
    document.querySelectorAll("[data-skin-switch]").forEach((el) => {
      const target = el.getAttribute("data-skin-switch") || other;
      // Keep the href honest, so the control still works without JavaScript
      // and so its destination shows in the status bar on hover.
      if (el.tagName === "A" && target !== current) {
        el.setAttribute("href", urlFor(target, twin || HOME[target]));
      }
      el.addEventListener("click", () => {
        write("localStorage", KEY, target);
        drop("sessionStorage", HOP);
      });
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
