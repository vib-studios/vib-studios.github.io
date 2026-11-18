/* Vib Studios preview behaviour: reveal on scroll, release data, copy buttons,
 * code tabs and two small canvas fields. No framework, no dependencies. */
(() => {
  "use strict";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Scroll reveal ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("in");
      io.unobserve(entry.target);
    });
  }, { threshold: 0.06, rootMargin: "0px 0px -36px 0px" });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  /* ---------- Live release data, with a static fallback ---------- */
  const release = document.querySelector("[data-release]");
  if (release) {
    const repo = release.dataset.repo;
    const assetMatch = release.dataset.asset || "jar";
    const url = `https://api.github.com/repos/${repo}/releases/latest`;

    fetch(url, { headers: { Accept: "application/vnd.github+json" } })
      .then((response) => { if (!response.ok) throw new Error(response.status); return response.json(); })
      .then((data) => {
        const assets = Array.isArray(data.assets) ? data.assets : [];
        const asset = assets.find((a) => a.name && a.name.includes(assetMatch)) || assets[0];
        if (asset && asset.browser_download_url) {
          document.querySelectorAll("[data-download]").forEach((link) => {
            link.href = asset.browser_download_url;
            link.removeAttribute("data-fallback");
          });
          const label = document.querySelector("[data-download-label]");
          if (label) label.textContent = "Download latest";
        }
        const set = (selector, value) => {
          const el = release.querySelector(selector);
          if (el && value) el.textContent = value;
        };
        set("[data-release-title]", data.name || "Latest build");
        set("[data-release-date]", data.published_at ? data.published_at.slice(0, 10) : null);
        set("[data-release-size]", asset ? `${(asset.size / 1024 / 1024).toFixed(1)} MB` : null);
        if (data.body) {
          const firstLine = data.body.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
          if (firstLine) set("[data-release-notes]", firstLine.replace(/`/g, "").replace(/^#+\s*/, ""));
        }
      })
      .catch(() => { /* Markup already holds the fallback values. */ });
  }

  /* ---------- Copy buttons ---------- */
  async function writeClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  document.querySelectorAll("[data-copy]").forEach((button) => {
    const original = button.textContent;
    button.addEventListener("click", async () => {
      const target = button.dataset.copyTarget;
      const source = target ? document.querySelector(target) : null;
      const text = source ? source.textContent : (button.dataset.copy || button.textContent);
      if (!text) return;
      try {
        await writeClipboard(text.trim());
        button.textContent = "copied";
        button.classList.add("copied");
        setTimeout(() => {
          button.textContent = original;
          button.classList.remove("copied");
        }, 1400);
      } catch {
        button.textContent = "select and copy";
        setTimeout(() => { button.textContent = original; }, 1400);
      }
    });
  });

  /* ---------- Plugin example tabs ---------- */
  const tabs = [...document.querySelectorAll("[data-code-tab]")];
  if (tabs.length) {
    const panels = [...document.querySelectorAll("[data-code-panel]")];
    const copyButton = document.querySelector(".code-window [data-copy]");
    const name = document.querySelector("[data-code-name]");
    tabs.forEach((tab) => tab.addEventListener("click", () => {
      const key = tab.dataset.codeTab;
      tabs.forEach((t) => {
        const on = t === tab;
        t.classList.toggle("on", on);
        t.setAttribute("aria-selected", String(on));
      });
      panels.forEach((panel) => { panel.hidden = panel.dataset.codePanel !== key; });
      if (name) name.textContent = tab.textContent;
      if (copyButton) copyButton.dataset.copyTarget = `#code-${key}`;
    }));
  }

  /* ---------- Hero block field ---------- */
  const cubes = document.getElementById("cubes");
  if (cubes && !reduce && matchMedia("(hover: hover)").matches) {
    const ctx = cubes.getContext("2d");
    let width = 0, height = 0, frame = 0, pointer = null;
    let nextPulse = performance.now() + 3500;
    const heat = new Map();
    const step = 14, size = 8;

    function resize() {
      const rect = cubes.getBoundingClientRect();
      width = Math.round(rect.width);
      height = Math.round(rect.height);
      cubes.width = width;
      cubes.height = height;
    }
    resize();
    addEventListener("resize", resize, { passive: true });

    function ring(x, y, strength) {
      for (let gy = 0; gy < height; gy += step) {
        for (let gx = 0; gx < width; gx += step) {
          const distance = Math.hypot(gx - x, gy - y);
          if (distance < 150) {
            const key = `${gx},${gy}`;
            heat.set(key, Math.max(heat.get(key) || 0, strength * (1 - distance / 150)));
          }
        }
      }
    }
    addEventListener("pointermove", (event) => {
      const rect = cubes.getBoundingClientRect();
      pointer = event.clientY <= rect.bottom ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : null;
      if (!frame) frame = requestAnimationFrame(tick);
    }, { passive: true });
    addEventListener("pointerdown", (event) => {
      const rect = cubes.getBoundingClientRect();
      if (event.clientY <= rect.bottom) ring(event.clientX - rect.left, event.clientY - rect.top, 1);
      if (!frame) frame = requestAnimationFrame(tick);
    }, { passive: true });

    function tick(now) {
      frame = 0;
      ctx.clearRect(0, 0, width, height);
      if (pointer) {
        for (let gy = 0; gy < height; gy += step) {
          for (let gx = 0; gx < width; gx += step) {
            const distance = Math.hypot(gx - pointer.x, gy - pointer.y);
            const intensity = distance < 40 ? 1 : distance < 80 ? 0.5 : distance < 120 ? 0.24 : 0;
            if (intensity) {
              const key = `${gx},${gy}`;
              heat.set(key, Math.max(heat.get(key) || 0, intensity));
            }
          }
        }
      }
      if (now > nextPulse) {
        ring(Math.random() * width, Math.random() * height * 0.6, 0.65);
        nextPulse = now + 9000 + Math.random() * 12000;
      }
      for (const [key, value] of heat) {
        if (value < 0.02) { heat.delete(key); continue; }
        const [x, y] = key.split(",").map(Number);
        ctx.fillStyle = `rgb(249 115 22 / ${(value * 0.8).toFixed(3)})`;
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = `rgb(249 115 22 / ${(value * 0.22).toFixed(3)})`;
        ctx.fillRect(x + 2, y - 2, size, 2);
        heat.set(key, value - 0.012 - Math.random() * 0.009);
      }
      if (heat.size || pointer || now > nextPulse - 100) frame = requestAnimationFrame(tick);
    }
    ring(width * 0.72, height * 0.24, 0.7);
    frame = requestAnimationFrame(tick);
  }

  /* ---------- Final CTA block field ---------- */
  const blocks = document.getElementById("blocks");
  if (blocks && !reduce) {
    const ctx = blocks.getContext("2d");
    let width = 0, height = 0, frame = 0;
    const pieces = Array.from({ length: 46 }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: 3 + Math.random() * 7,
      speed: 0.00016 + Math.random() * 0.00042,
      drift: Math.random() * Math.PI * 2,
      alpha: 0.12 + Math.random() * 0.4,
    }));

    function resize() {
      const rect = blocks.getBoundingClientRect();
      width = Math.round(rect.width);
      height = Math.round(rect.height);
      blocks.width = width;
      blocks.height = height;
    }
    resize();
    addEventListener("resize", resize, { passive: true });

    function draw() {
      frame = 0;
      ctx.clearRect(0, 0, width, height);
      const centerX = width / 2;
      const centerY = height * 0.58;
      const reach = Math.min(width * 0.56, 620);
      for (const p of pieces) {
        p.y -= p.speed;
        p.drift += 0.004;
        if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
        const x = centerX + (p.x - 0.5) * reach * 2 + Math.sin(p.drift) * 16;
        const y = p.y * height;
        const distance = Math.hypot((x - centerX) / reach, (y - centerY) / (height * 0.7));
        const alpha = Math.max(0, p.alpha * (1 - distance));
        if (!alpha) continue;
        ctx.fillStyle = `rgb(249 115 22 / ${alpha.toFixed(3)})`;
        ctx.fillRect(Math.round(x), Math.round(y), p.size, p.size);
        ctx.fillStyle = `rgb(255 255 255 / ${(alpha * 0.22).toFixed(3)})`;
        ctx.fillRect(Math.round(x), Math.round(y) - 2, p.size, 2);
      }
      frame = requestAnimationFrame(draw);
    }
    const seen = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !frame) frame = requestAnimationFrame(draw);
      else if (!entry.isIntersecting && frame) { cancelAnimationFrame(frame); frame = 0; }
    });
    seen.observe(blocks);
  }
})();
