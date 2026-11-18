# Vib Studios site

Static site for **vib-MC**, a Minecraft server written by AI. Four pages:
`index.html`, `docs.html`, `privacy.html` and `terms.html`.

GitHub Pages serves `main` as-is. There is no build step, no backend, no
analytics, no cookies and no accounts. Plugin examples in the docs are plain
source you can copy and compile yourself.

## Run locally

```sh
npm start
# open http://127.0.0.1:8000
```

`python3` is the only requirement. `npm start` is just a convenience wrapper.

## Files

| File | Role |
| --- | --- |
| `index.html` | Landing page: hero, capabilities, plugins, console, FAQ. |
| `docs.html` | Requirements, run instructions, commands, plugins and API. |
| `privacy.html` / `terms.html` | Legal pages. |
| `styles.css` | Hand-authored design system and all page styles. Source of truth. |
| `app.js` | Release lookup, copy buttons, code tabs, reveal and canvas fields. |
| `files/` | Brand mark, hero screenshot, social images and fonts. |
| `assets/fonts/` | Geist and DM Sans used by the design. |
| `tools/check-links.mjs` | Crawls the site over HTTP and checks local links and assets. |

`styles.css` is committed and edited directly. Do not add a CSS build step: it
would overwrite the design.

## Checks

```sh
npm start                                    # terminal 1
npm run check                                # terminal 2
node tools/check-links.mjs https://vibstudios.space
```

`npm run check` fetches every local link and asset over HTTP rather than only
looking at the filesystem, because a wrong `../` can pass on disk and still
404 in production. It also checks the brand SVG parses.

## Release data

Version numbers, dates and download sizes are fetched from the GitHub API at
runtime by `app.js`, not baked in. The download block declares itself with
`data-release`:

```html
<section data-release
         data-repo="vib-studios/vib-MC"
         data-tag="v0.0.7"
         data-asset="jar"
         data-fallback-tag="v0.0.7"
         data-fallback-url="https://github.com/.../vib-mc.jar">
```

Every value the script writes is already present in the markup at its current
value, so a rate-limited or blocked request leaves the page correct instead of
showing “fetching” forever. `data-asset` matches the published jar name.

## Images

The hero uses `files/hero.webp`, a 21:9 crop of the 3840×2160 screenshot in
`photos/vibmc.png`. Regenerate it with:

```sh
magick photos/vibmc.png -resize 2100x -gravity center -crop 2100x900+0+0 +repage \
  -quality 80 -define webp:method=6 files/hero.webp
```

## Legal

`privacy.html` and `terms.html` load no scripts. vib-MC is licensed
GPL-3.0-or-later and is an unofficial project, not affiliated with Mojang
Studios or Microsoft.
