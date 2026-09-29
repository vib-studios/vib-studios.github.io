# Vib Studios site

Static site for two projects: **vib-MC** (a Minecraft server written by AI) and
**Vib-launcher** (a native launcher and server control panel). No backend, no
analytics, no cookies. Four pages: `index.html`, `docs.html`, `privacy.html`,
`terms.html`.

## Build

`styles.css` is generated. It is committed because GitHub Pages serves the
repository as-is, but it must never be edited by hand.

```sh
npm install        # once
npm run build      # src/input.css -> styles.css (minified)
npm run watch      # rebuild on change while working
```

The source of truth is `src/input.css`:

| File | What it holds |
|---|---|
| `src/input.css` | Theme tokens, base styles, components. Start here. |
| `src/phosphor.css` | Phosphor icon font, generated class → codepoint map. |
| `styles.css` | Build output. Do not edit. |

Tailwind v4 needs no config file: the theme lives in an `@theme` block inside
`src/input.css`, and `@source` tells the scanner where the markup is.

## Before the last redesign

`styles.css` used to be a Tailwind build with no `package.json`, no config and
no build script anywhere in the repository, so the tool that produced it was
gone. Adding a new utility class to the markup did nothing. The build is now
reproducible, which is the whole reason it exists.

## Checking your work

```sh
npm start                  # serve, then in another terminal:
npm run check              # crawl every page, fetch every local link and asset
node tools/check-links.mjs https://vib-studios.github.io   # or a deployed copy
```

`check` fetches over HTTP rather than only testing the filesystem, because a
file can exist on disk and still 404 when a `../` segment is wrong. It skips
HTML comments, so the image-slot notes below are not reported as broken links.

## Images

Originals live in `photos/`. The site serves re-encoded WebP from `files/`,
because the source screenshots are far too heavy to ship: `photos/vibmc.png` is
4.2 MB and becomes 128 KB at 21:9.

| Page | Source | Served | Size |
|---|---|---|---|
| `index.html` hero | `photos/vibmc.png` (3840×2160) | `files/hero.webp` (2100×900) | 128 KB |
| `index.html` launcher | `photos/viblauncher.png` (1883×1047) | `files/launcher.webp` (1600×890) | 20 KB |

Regenerate after replacing a source:

```sh
magick photos/vibmc.png -resize 2100x -gravity center -crop 2100x900+0+0 +repage \
  -quality 80 -define webp:method=6 files/hero.webp
magick photos/viblauncher.png -resize 1600x -quality 82 -define webp:method=6 \
  files/launcher.webp
```

The vib-MC band below the hero carries no image on purpose: it is the same
world as the hero, and repeating it a few hundred pixels lower reads as a
mistake rather than a motif. If you want a third image there, a different
screenshot of the Nether or the End would work far better than a second crop of
the same overworld.

`.shot` reserves the frame and rounds the corners. `.shot-empty` draws the
hatched placeholder and is what `data-note` labels — drop it once a real image
is in place.

## Release data

Version numbers, dates and download sizes are fetched from the GitHub API at
runtime by `site.js`, not baked in. Each project is a `[data-release]` block
that describes itself:

```html
<div data-release
     data-repo="vib-studios/vib-MC"
     data-tag="v0.0.7"          <!-- omit to follow the latest release -->
     data-asset="jar"           <!-- jar | linux | winzip -->
     data-fallback-tag="v0.0.7"
     data-fallback-url="https://github.com/.../vib-mc.jar"
     data-issue-repo="vib-studios/vib-MC">
```

Everything the script writes already holds its current value in the markup, so
a rate-limited or blocked request leaves the page correct instead of showing
"fetching" forever.

`data-asset` matters more than it looks. Vib-launcher v0.2.0 ships Linux
tarballs where v0.1.1 shipped a Windows zip, so a matcher that only understood
`.zip` would find nothing, fall back to a hardcoded URL, and label the button
`v0.2.0` while linking the `v0.1.1` build. Keep the matcher set in step with
what a release actually publishes.

## Contributors

`contributors.js` renders into any `[data-contributors]` element from the
`vib-studios/vib-MC` contributors endpoint.

Hand-written entries in its `FALLBACK` and `EXTRA` lists need a numeric `id` as
well as a `login`. **The id is required.** A login is a name the account owner
can change, and once they do the old one stops resolving — that is exactly how a
contributor's avatar silently disappeared when `usekiko` became `7kimchi`. The
numeric id never changes, so keying on it keeps the avatar and the dedupe
working across a rename. There is a test for this behaviour; see the comment on
the `EXTRA` list.

## Legal pages

`privacy.html` and `terms.html` are accurate to the current build and load no
scripts at all. If you add a third-party request, a new local storage key, or
any analytics, that page has to change with it.
