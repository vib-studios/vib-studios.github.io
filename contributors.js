(() => {
  "use strict";

  const REPO = "vib-studios/vib-MC";
  const API = `https://api.github.com/repos/${REPO}/contributors?per_page=24`;

  // The unauthenticated GitHub API allows 60 requests/hour per IP, so a visitor
  // can genuinely get rate-limited. Keep a baked-in list so the rail still
  // renders something real when the fetch fails.
  const FALLBACK = [
    { id: 168933756, login: "gabytz777", contributions: 53 },
    { id: 175139208, login: "anmvc", contributions: 5 },
  ];

  // People the /contributors endpoint will never return. It only counts commits
  // reachable from the default branch, so work that shipped on a tag but was
  // never merged into main is invisible to it — see 7kimchi's bd56159
  // ("add world saving so chunks actually persist"), which lives only under
  // v0.0.4-hotfix.3. Entries here are merged in; if the API ever does report
  // one of them, the API's own numbers win.
  //
  // `id` is the GitHub numeric user id and is REQUIRED here, not optional
  // decoration. A login is a name the account owner can change at any time, and
  // the old one then stops resolving: when this user went from "usekiko" to
  // "7kimchi", both https://github.com/usekiko.png and
  // https://api.github.com/users/usekiko started returning 404 and their avatar
  // silently vanished. The numeric id never changes, so keying off it keeps the
  // picture and the dedupe working across a rename.
  const EXTRA = [
    { id: 204347579, login: "7kimchi", contributions: 1 },
  ];

  const mounts = Array.from(document.querySelectorAll("[data-contributors]"));
  if (!mounts.length) return;

  // Order matters: prefer the id-based URL, which is stable across a rename.
  // The login-based URL is only a last resort and will 404 the moment the
  // account's username changes.
  const avatarFor = (c) => {
    if (c.avatar_url)
      return `${c.avatar_url}${c.avatar_url.includes("?") ? "&" : "?"}s=96`;
    if (c.id) return `https://avatars.githubusercontent.com/u/${c.id}?s=96`;
    return `https://github.com/${encodeURIComponent(c.login)}.png?size=96`;
  };

  const profileFor = (c) => c.html_url || `https://github.com/${encodeURIComponent(c.login)}`;

  const plural = (n) => `${n} commit${n === 1 ? "" : "s"}`;

  const buildItem = (c) => {
    const li = document.createElement("li");

    const a = document.createElement("a");
    a.className = "contrib-link";
    a.href = profileFor(c);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.setAttribute("aria-label", `${c.login} on GitHub — ${plural(c.contributions)}`);

    const img = document.createElement("img");
    img.className = "contrib-link__img";
    img.src = avatarFor(c);
    img.alt = "";                  // decorative; the link carries the label
    img.loading = "lazy";
    img.decoding = "async";
    img.width = 40;
    img.height = 40;

    const tip = document.createElement("span");
    tip.className = "contrib-link__tip";
    tip.setAttribute("aria-hidden", "true");
    const name = document.createElement("b");
    name.textContent = c.login;
    tip.appendChild(name);
    tip.appendChild(document.createTextNode(` · ${plural(c.contributions)}`));

    a.appendChild(img);
    a.appendChild(tip);
    li.appendChild(a);
    return li;
  };

  const render = (contributors) => {
    if (!contributors.length) {
      mounts.forEach((m) => {
        const host = m.closest(".contrib-rail, .contrib-inline") || m;
        host.hidden = true;
      });
      return;
    }
    mounts.forEach((mount) => {
      const frag = document.createDocumentFragment();
      contributors.forEach((c) => frag.appendChild(buildItem(c)));
      mount.replaceChildren(frag);
      const host = mount.closest(".contrib-rail, .contrib-inline") || mount;
      host.hidden = false;
    });
  };

  // Identity for dedupe/matching. Prefer the numeric id so a hand-written entry
  // still matches the same person once the API reports them under a new login.
  const identity = (c) => (c.id ? `id:${c.id}` : `login:${c.login.toLowerCase()}`);

  // Merge EXTRA in without letting it shadow a real API entry for the same person.
  const withExtras = (list) => {
    const seen = new Set(list.map(identity));
    return list.concat(EXTRA.filter((c) => !seen.has(identity(c))));
  };

  const clean = (list) =>
    withExtras(
      list.filter((c) => c && c.login && c.type !== "Bot" && !/\[bot\]$/i.test(c.login))
    ).sort((a, b) => (b.contributions || 0) - (a.contributions || 0));

  window
    .fetch(API, { headers: { Accept: "application/vnd.github+json" } })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((list) => {
      if (!Array.isArray(list)) throw new Error("unexpected payload");
      const cleaned = clean(list);
      render(cleaned.length ? cleaned : clean(FALLBACK));
    })
    .catch(() => render(clean(FALLBACK)));

  /* -- Rail open/close ---------------------------------------------------- */

  const STORAGE_KEY = "vibmc:contributors-collapsed";
  const rail = document.querySelector(".contrib-rail");
  const toggle = rail && rail.querySelector(".contrib-rail__toggle");

  if (rail && toggle) {
    // Private browsing / blocked storage throws on access, so never let a
    // preference lookup take the toggle down with it.
    const readPref = () => {
      try {
        return window.localStorage.getItem(STORAGE_KEY) === "1";
      } catch {
        return false;
      }
    };
    const writePref = (collapsed) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
      } catch {
        /* preference simply will not persist */
      }
    };

    const apply = (collapsed) => {
      rail.classList.toggle("is-collapsed", collapsed);
      toggle.setAttribute("aria-expanded", String(!collapsed));
      toggle.setAttribute(
        "aria-label",
        collapsed ? "Show contributors" : "Hide contributors"
      );
    };

    apply(readPref());

    toggle.addEventListener("click", () => {
      const collapsed = !rail.classList.contains("is-collapsed");
      apply(collapsed);
      writePref(collapsed);
    });
  }
})();
