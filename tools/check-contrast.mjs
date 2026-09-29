/*
 * Contrast checks for the pairs that must hold in both themes.
 *
 * This exists because a theme flip breaks contrast quietly. The colour utilities
 * resolve through variables, which is what makes the flip possible at all, and
 * that same indirection is how a label ends up near-white on a white fill: every
 * individual declaration looked correct. The download button on the vib-MC band
 * sat at 1.10:1 in dark mode, invisible until hovered, and nothing reported it.
 *
 * These are hand-maintained invariants, not a general audit. If you add a filled
 * control, add its pair here. Declarations that do not flip are the risk, so the
 * rule of thumb is: a fill that stays light in both themes needs a label that
 * also stays dark in both, and --color-ink must never label it.
 *
 *   node tools/check-contrast.mjs
 */

const AA = 4.5; // WCAG AA for normal text
const AA_LARGE = 3.0; // WCAG AA for text at 18.66px+ bold or 24px+

const srgb = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

const luminance = (hex) => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  if (h.length !== 6) throw new Error(`not a hex colour: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => srgb(parseInt(h.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/*
 * oklch to sRGB, so the numbers describe the colours the browser actually paints
 * rather than a hex approximation of them.
 *
 * This matters. The first version of this file assumed oklch(52% 0 0) was about
 * #7a7a7a and reported 4.29:1 for it, failing the check. The true value is
 * 5.51:1 and it passes. For an achromatic colour oklab collapses to linear RGB =
 * L^3 on every channel, so relative luminance is exactly L^3 and the guess was
 * out by a wide margin. These numbers are only trustworthy because they are now
 * derived rather than assumed.
 */
const oklchToHex = (L, C = 0, H = 0) => {
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return (
    "#" +
    lin
      .map((v) => {
        const c = Math.max(0, Math.min(1, v));
        const e = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
        return Math.round(e * 255).toString(16).padStart(2, "0");
      })
      .join("")
  );
};

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/*
 * Colours per theme, exactly as src/input.css declares them. Keep these in step
 * with @theme and the [data-theme="dark"] block, or this checks a fiction.
 * Written as oklch so they are converted, not guessed.
 */
const light = {
  paper: oklchToHex(1, 0, 0),
  ink: "#0b0b0c",
  body: oklchToHex(0.28),
  muted: oklchToHex(0.52),
  faint: oklchToHex(0.56),
  onInk: "#ffffff",
  onEmber: "#0b0b0c",
  onVoid: "#ffffff",
  sunken: oklchToHex(0.97),
  ember: oklchToHex(0.68, 0.19, 45),
  void: "#0b0b0c",
  voidBody: oklchToHex(0.78),
  voidMuted: oklchToHex(0.62),
};

const dark = {
  paper: "#0d0d0e",
  ink: "#f4f4f5",
  body: oklchToHex(0.84),
  muted: oklchToHex(0.66),
  faint: oklchToHex(0.60),
  onInk: "#0b0b0c",
  onEmber: "#0b0b0c",
  onVoid: "#ffffff",
  sunken: oklchToHex(0.21),
  ember: oklchToHex(0.72, 0.18, 48),
  void: "#1e1e23",
  voidBody: oklchToHex(0.84),
  voidMuted: oklchToHex(0.64),
};

/*
 * Each pair is [label, foreground, background, minimum]. The last entry is the
 * one that was actually broken: a white fill that stayed white in both themes,
 * labelled with --color-ink, which does not.
 */
const PAIRS = [
  ["body text on the page", "body", "paper", AA],
  ["muted text on the page", "muted", "paper", AA],
  // 11px uppercase mono. That is small text, so it is held to AA, not the
  // 3:1 large-text allowance, even though it would pass that.
  ["faint micro-label on the page", "faint", "paper", AA],
  ["heading ink on the page", "ink", "paper", AA],
  ["button label", "onInk", "ink", AA],
  ["inverted button label", "void", "onVoid", AA],
  ["selection label", "onEmber", "ember", AA],
  ["band body text", "voidBody", "void", AA],
  ["band muted text", "voidMuted", "void", AA],
  ["code text on the sunken fill", "body", "sunken", AA],
  ["ink on the sunken fill", "ink", "sunken", AA],
];

let failures = 0;

for (const [themeName, theme] of [["light", light], ["dark", dark]]) {
  console.log(`\n  ${themeName}`);
  for (const [label, fg, bg, min] of PAIRS) {
    const r = contrast(theme[fg], theme[bg]);
    const ok = r >= min;
    if (!ok) failures++;
    console.log(
      `    ${ok ? "ok  " : "FAIL"}  ${label.padEnd(30)} ${r.toFixed(2).padStart(6)}:1  (min ${min})`
    );
  }
}

console.log(failures ? `\n  ${failures} pair(s) below target` : "\n  all pairs meet target");
process.exit(failures ? 1 : 0);
