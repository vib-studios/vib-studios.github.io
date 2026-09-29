/*
 * Link and asset check for the built site.
 *
 * Verifies every local href/src in every page actually resolves, by fetching it
 * over HTTP rather than only testing the filesystem. That distinction matters:
 * a file can exist on disk and still 404 in production if a path is written
 * with the wrong number of ../ segments, and that is exactly the mistake that is
 * easy to make when pages move.
 *
 *   npm start        # terminal 1
 *   npm run check    # terminal 2
 *
 * Pass a base URL to check a deployed copy instead:
 *   node tools/check-links.mjs https://vib-studios.github.io
 */

const BASE = (process.argv[2] || "http://127.0.0.1:8000").replace(/\/$/, "") + "/";

const seen = new Set();
const queue = ["/"];
const broken = [];
let ok = 0;

/*
 * Stylesheets too, not just markup.
 *
 * A url() inside CSS is invisible to an href/src scan, and that is exactly how
 * a font path can point one directory above the site root, 404 on every page,
 * and leave a whole icon font silently missing with nothing in the build log.
 * The compiled stylesheet sits at the site root, so its own relative paths are
 * resolved from there.
 */
const checkStylesheets = async () => {
  for (const sheet of ["/styles.css", "/src/input.css", "/src/phosphor.css"]) {
    let body;
    try {
      const res = await fetch(BASE + sheet.slice(1));
      if (!res.ok) {
        broken.push([sheet, `HTTP ${res.status}`]);
        continue;
      }
      body = await res.text();
    } catch (err) {
      broken.push([sheet, `unreachable: ${err.message}`]);
      continue;
    }
    for (const [, value] of body.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
      if (/^(https?:|data:|\/\/|#)/.test(value)) continue;
      const target = new URL(value, BASE);
      if (target.origin !== new URL(BASE).origin) continue;
      try {
        const r = await fetch(target);
        await r.arrayBuffer();
        if (r.ok) ok++;
        else broken.push([sheet, `${value} -> HTTP ${r.status}`]);
      } catch (err) {
        broken.push([sheet, `${value} -> ${err.message}`]);
      }
    }
  }
};

const crawl = async () => {
  while (queue.length) {
    const path = queue.shift();
    if (seen.has(path)) continue;
    seen.add(path);

    let res, body;
    try {
      res = await fetch(BASE + path.replace(/^\//, ""));
      body = await res.text();
    } catch (err) {
      broken.push([path, `unreachable: ${err.message}`]);
      continue;
    }
    if (!res.ok) {
      broken.push([path, `HTTP ${res.status}`]);
      continue;
    }

    // Strip comments before scanning. The pages carry commented-out notes about
    // image slots and markup contracts, and those mention paths that are meant
    // to be filled in later. Reading them as live references reports them as
    // broken, which is noise that trains you to ignore the output.
    const scannable = body.replace(/<!--[\s\S]*?-->/g, "");

    for (const [, value] of scannable.matchAll(/\b(?:href|src)\s*=\s*"([^"]*)"/g)) {
      if (/^(https?:|mailto:|data:|\/\/|#)/.test(value)) continue;
      const target = new URL(value, BASE + path.replace(/^\//, ""));
      if (target.origin !== new URL(BASE).origin) continue;
      const rel = decodeURIComponent(target.pathname);
      try {
        const r = await fetch(target);
        // Drain the body. Leaving a response unread keeps the connection paused
        // and trips an assertion inside undici, which is how this check first
        // appeared to "crash" rather than report a result.
        await r.arrayBuffer();
        if (r.ok) ok++;
        else broken.push([path, `${value} -> HTTP ${r.status}`]);
      } catch (err) {
        broken.push([path, `${value} -> ${err.message}`]);
      }
      if (rel.endsWith(".html") && !seen.has(rel)) queue.push(rel);
    }
    // "/" and "/index.html" are the same document; only crawl it once.
    if (path === "/") seen.add("/index.html");
  }
};

await crawl();
await checkStylesheets();

console.log(`base:   ${BASE}`);
console.log(`pages:  ${seen.size}`);
console.log(`fetched: ${ok} local links and assets, all OK`);
console.log(`broken:  ${broken.length}`);
for (const [page, why] of broken) console.log(`  ${page}  ${why}`);
process.exit(broken.length ? 1 : 0);
