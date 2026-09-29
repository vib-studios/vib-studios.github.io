/*
 * Validates the Discord component-embed payload in the page head against the
 * rules in discord/discord-api-docs#8606. The docs warn that a single invalid
 * component or a stray key on a button invalidates the whole payload, and
 * Discord fails silently: the page just falls back to the og tags. That makes
 * this worth checking here rather than by pasting a link in Discord.
 *
 *   node tools/check-embed.mjs
 *
 * Exits non-zero on any violation, so it can join `npm run check`.
 */

import { readFileSync } from "node:fs";

const PAGES = ["index.html"];

/* The read-only subset a component embed accepts. Anything outside it
   invalidates the payload. */
const ALLOWED = new Set([1, 2, 9, 10, 11, 12, 14, 17]);

/* A button in a component embed carries only link fields. `id` and
   `custom_id` in particular are what a normal interactive button has, and
   including either kills the whole payload. */
const BUTTON_KEYS = new Set([
  "type",
  "url",
  "style",
  "label",
  "emoji",
  "disabled",
]);

const MEDIA_FORMATS = /\.(png|gif|jpe?g|webp|avif)(\?|#|$)/i;
const MAX_COMPONENTS = 40;
const MAX_LINKED_JSON_BYTES = 3000;

const errors = [];
const check = (page, cond, message) => {
  if (!cond) errors.push(`${page}: ${message}`);
};

for (const page of PAGES) {
  const html = readFileSync(new URL(`../${page}`, import.meta.url), "utf8");

  const match = html.match(
    /<script id="discord:component-embed" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match) {
    errors.push(`${page}: no component-embed payload found`);
    continue;
  }

  let payload;
  try {
    payload = JSON.parse(match[1]);
  } catch (err) {
    errors.push(`${page}: payload is not valid JSON, ${err.message}`);
    continue;
  }

  check(
    page,
    Object.keys(payload).length === 1 && payload.component,
    "payload must be a single `component` key",
  );

  const root = payload.component ?? {};
  check(page, root.type === 17, "the root must be a container, type 17");

  let count = 0;

  const walk = (components, path) => {
    for (const component of components) {
      count++;
      const at = `${path} > type ${component.type}`;

      check(page, ALLOWED.has(component.type), `${at} is not a compatible component`);

      /* Buttons must be links, and may carry nothing else. */
      if (component.type === 2) {
        for (const key of Object.keys(component)) {
          check(page, BUTTON_KEYS.has(key), `${at} has the key \`${key}\`, which invalidates the payload`);
        }
        check(page, component.style === 5, `${at} must use link style 5, found ${component.style}`);
        check(
          page,
          Boolean(component.label || component.emoji),
          `${at} needs a label or an emoji`,
        );
        check(page, /^https:\/\//.test(component.url ?? ""), `${at} url must be absolute https`);
      }

      /* Media is an unfurled media item with only `url`; Discord fetches the
         asset itself and fills in dimensions, type and the proxy url. */
      if (component.type === 11 || component.type === 12) {
        const items = component.type === 11 ? [component] : (component.items ?? []);
        for (const item of items) {
          const keys = Object.keys(item.media ?? {});
          check(page, keys.length === 1 && keys[0] === "url", `${at} media must set only \`url\`, found ${keys.join(", ") || "nothing"}`);
          const url = item.media?.url ?? "";
          check(page, /^https?:\/\//.test(url), `${at} media url must be http or https, found ${url}`);
          check(page, MEDIA_FORMATS.test(url), `${at} media must be PNG, GIF, JPEG, WebP or AVIF, found ${url}`);
          check(page, !url.startsWith("attachment://"), `${at} attachment:// is not valid here`);
        }
      }

      if (Array.isArray(component.components)) walk(component.components, at);

      /* A section's thumbnail or button sits under `accessory`, not
         `components`, so it has to be walked separately or the media rules
         below never run on the one image a preview actually shows. */
      if (component.accessory) {
        const at2 = `${at} > accessory`;
        check(page, ALLOWED.has(component.accessory.type), `${at2} is not a compatible component`);
        walk([component.accessory], at2);
      }
    }
  };

  walk(root.components ?? [], "container");

  check(page, count <= MAX_COMPONENTS, `payload has ${count} components, the limit is ${MAX_COMPONENTS}`);

  const linked = html.match(/<link[^>]+rel="discord:component-embed"[^>]*>/);
  if (linked && match[1].length > MAX_LINKED_JSON_BYTES) {
    errors.push(`${page}: inline payload is present, so the <link> is ignored and its size does not matter`);
  }

  const raw = Buffer.byteLength(match[1]);
  console.log(
    `  ${page}  ${count} components, ${raw} bytes, accent ${root.accent_color ?? "none"}`,
  );
}

if (errors.length) {
  console.error("component embed is invalid, Discord would ignore it:");
  for (const err of errors) console.error(`  x ${err}`);
  process.exit(1);
}

console.log("component embed payload is valid");
