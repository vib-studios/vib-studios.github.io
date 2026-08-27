/*
 * The plugin blueprint builder: click pieces, get a plugin.
 *
 * The scripts live in a plain state object and the DOM is rendered from it, rather than
 * the state living in the DOM and being scraped back out. That is what makes moving a
 * block, undoing to the last save, and the live code preview all work off one source.
 *
 * Code generation lives in blueprint-codegen.js, which knows nothing about the page.
 */
(() => {
  "use strict";

  const root = document.getElementById("blueprint");
  if (!root || !window.BlueprintCodegen) return;

  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = "vibmc-blueprint-v2";

  const GAME_MODES = ["creative", "survival", "adventure", "spectator"];
  const ITEMS = [
    "diamond", "diamond_pickaxe", "flint_and_steel", "water_bucket", "lava_bucket",
    "obsidian", "end_portal_frame", "ender_eye", "glowstone", "apple", "stick",
    "planks", "cobblestone", "stone", "coal", "quartz",
  ];

  /** Palette definition: what a piece is called, and what a fresh one looks like. */
  const HATS = [
    { piece: "cmd", cls: "sb-cmd", label: "when player runs /…" },
    { piece: "join", cls: "sb-lsn", label: "when player joins" },
    { piece: "quit", cls: "sb-lsn", label: "when player quits" },
    { piece: "chat", cls: "sb-lsn", label: "when player chats" },
  ];
  const DOS = [
    { action: "say", cls: "sb-act", label: "say …" },
    { action: "broadcast", cls: "sb-act", label: "tell everyone …" },
    { action: "gamemode", cls: "sb-act", label: "set game mode …" },
    { action: "give", cls: "sb-act", label: "give item …" },
    { action: "teleport", cls: "sb-act", label: "teleport to …" },
    { action: "heal", cls: "sb-act", label: "heal them" },
    { action: "time", cls: "sb-act", label: "set time …" },
    { action: "weather", cls: "sb-act", label: "set weather …" },
    { action: "kick", cls: "sb-cancel", label: "kick them …" },
    { action: "log", cls: "sb-act", label: "log to console …" },
    { action: "cancel", cls: "sb-cancel", label: "cancel the chat", chatOnly: true },
  ];

  const defaultsFor = (action) => {
    switch (action) {
      case "say": return { action, value: "Hello!" };
      case "broadcast": return { action, value: "Something happened!" };
      case "gamemode": return { action, value: "creative" };
      case "give": return { action, value: "diamond", amount: 1 };
      case "teleport": return { action, x: 0, y: 80, z: 0 };
      case "time": return { action, value: "day" };
      case "weather": return { action, value: "clear" };
      case "kick": return { action, value: "Bye!" };
      case "log": return { action, value: "something happened" };
      default: return { action };
    }
  };

  const starter = () => ({
    name: "MyPlugin",
    package: "com.example",
    version: "1.0.0",
    description: "",
    units: [
      { id: 1, kind: "cmd", name: "hello", actions: [defaultsFor("say")] },
      { id: 2, kind: "join", actions: [{ action: "say", value: "Welcome to the vibe!" }] },
    ],
    nextId: 3,
    activeId: 1,
  });

  let state = load() || starter();

  function load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.units)) return null;
      return parsed;
    } catch (e) {
      return null;  // corrupt or storage disabled; start fresh rather than break the page
    }
  }

  function save() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // private browsing, quota, whatever - the builder still works, it just forgets
    }
  }

  const unitById = (id) => state.units.find((u) => u.id === id) || null;
  const activeUnit = () => unitById(state.activeId);
  const isChat = (unit) => unit && unit.kind === "chat";

  // ---- model edits ----

  function addUnit(kind) {
    const unit = { id: state.nextId++, kind, actions: [] };
    if (kind === "cmd") unit.name = "hello";
    state.units.push(unit);
    state.activeId = unit.id;
    commit();
  }

  function addAction(action) {
    let unit = activeUnit();
    if (!unit) {
      addUnit("cmd");
      unit = activeUnit();
    }
    if (!unit) return;
    if (action === "cancel" && !isChat(unit)) return;
    unit.actions.push(defaultsFor(action));
    commit();
  }

  function moveAction(unit, index, delta) {
    const target = index + delta;
    if (target < 0 || target >= unit.actions.length) return;
    const [item] = unit.actions.splice(index, 1);
    unit.actions.splice(target, 0, item);
    commit();
  }

  function commit() {
    save();
    render();
  }

  // ---- rendering ----

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));

  const optionList = (values, selected) => values
    .map((v) => `<option value="${esc(v)}"${v === selected ? " selected" : ""}>${esc(v.replace(/_/g, " "))}</option>`)
    .join("");

  function hatHtml(unit) {
    if (unit.kind === "cmd") {
      return `when player runs <span class="sb-prefix">/</span><input class="sb-oval" type="text" data-field="name" value="${esc(unit.name || "")}" placeholder="hello" size="8">`;
    }
    return `when player <select class="sb-oval" data-field="kind">
      <option value="join"${unit.kind === "join" ? " selected" : ""}>joins</option>
      <option value="quit"${unit.kind === "quit" ? " selected" : ""}>quits</option>
      <option value="chat"${unit.kind === "chat" ? " selected" : ""}>chats</option>
    </select>`;
  }

  function actionHtml(a) {
    switch (a.action) {
      case "say": return `say <input class="sb-oval" type="text" data-field="value" value="${esc(a.value)}" size="16">`;
      case "broadcast": return `tell everyone <input class="sb-oval" type="text" data-field="value" value="${esc(a.value)}" size="16">`;
      case "log": return `log <input class="sb-oval" type="text" data-field="value" value="${esc(a.value)}" size="16">`;
      case "kick": return `kick them, saying <input class="sb-oval" type="text" data-field="value" value="${esc(a.value)}" size="12">`;
      case "gamemode": return `set game mode to <select class="sb-oval" data-field="value">${optionList(GAME_MODES, a.value)}</select>`;
      case "give": return `give <input class="sb-oval" type="number" data-field="amount" value="${esc(a.amount)}" min="1" max="64" size="2"> <select class="sb-oval" data-field="value">${optionList(ITEMS, a.value)}</select>`;
      case "teleport": return `teleport to
        <input class="sb-oval" type="number" data-field="x" value="${esc(a.x)}" size="3">
        <input class="sb-oval" type="number" data-field="y" value="${esc(a.y)}" size="3">
        <input class="sb-oval" type="number" data-field="z" value="${esc(a.z)}" size="3">`;
      case "time": return `set time to <select class="sb-oval" data-field="value">${optionList(["day", "night"], a.value)}</select>`;
      case "weather": return `set weather to <select class="sb-oval" data-field="value">${optionList(["clear", "rain"], a.value)}</select>`;
      case "heal": return "heal them";
      case "cancel": return "cancel the chat";
      default: return esc(a.action);
    }
  }

  function unitHtml(unit) {
    const blocks = unit.actions.map((a, i) => {
      const cls = a.action === "cancel" || a.action === "kick" ? "sb-cancel" : "sb-act";
      const stale = a.action === "cancel" && !isChat(unit);
      return `<div class="sb-row" data-index="${i}">
        <div class="sb-block ${cls}${stale ? " sb-stale" : ""}"><span>${actionHtml(a)}</span></div>
        <div class="sb-row-tools">
          <button type="button" class="sb-mini" data-act="up" aria-label="move up"${i === 0 ? " disabled" : ""}>&uarr;</button>
          <button type="button" class="sb-mini" data-act="down" aria-label="move down"${i === unit.actions.length - 1 ? " disabled" : ""}>&darr;</button>
          <button type="button" class="sb-mini" data-act="drop" aria-label="remove this piece">&times;</button>
        </div>
      </div>`;
    }).join("");

    const hatClass = unit.kind === "cmd" ? "sb-cmd" : "sb-lsn";
    return `<div class="sb-unit${unit.id === state.activeId ? " sb-active" : ""}" data-unit="${unit.id}">
      <div class="sb-unit-blocks">
        <div class="sb-block ${hatClass} sb-hat">${hatHtml(unit)}</div>
        ${blocks || '<p class="sb-empty">click a "do" piece to add a step</p>'}
      </div>
      <button type="button" class="sb-remove" data-act="drop-unit" aria-label="remove script">&times;</button>
    </div>`;
  }

  function render() {
    const commands = state.units.filter((u) => u.kind === "cmd");
    const listeners = state.units.filter((u) => u.kind !== "cmd");
    $("bp-commands").innerHTML = commands.map(unitHtml).join("")
      || '<p class="sb-empty">no commands yet</p>';
    $("bp-listeners").innerHTML = listeners.map(unitHtml).join("")
      || '<p class="sb-empty">no listeners yet</p>';

    // "cancel the chat" only means anything inside a chat script.
    const chatActive = isChat(activeUnit());
    root.querySelectorAll("[data-do]").forEach((btn) => {
      const disabled = btn.getAttribute("data-do") === "cancel" && !chatActive;
      btn.disabled = disabled;
      btn.classList.toggle("sb-disabled", disabled);
    });

    renderPreview();
  }

  function currentModel() {
    return {
      name: $("bp-name").value,
      package: $("bp-package").value,
      version: $("bp-version").value,
      description: $("bp-description").value,
      commands: state.units.filter((u) => u.kind === "cmd")
        .map((u) => ({ name: u.name, actions: u.actions })),
      listeners: state.units.filter((u) => u.kind !== "cmd")
        .map((u) => ({ event: u.kind, actions: u.actions })),
    };
  }

  let generated = null;

  function renderPreview() {
    generated = window.BlueprintCodegen.generate(currentModel());
    const tab = root.querySelector(".sb-tab.sb-tab-on");
    const which = tab ? tab.getAttribute("data-tab") : "java";
    const code = which === "yml" ? generated.yml : generated.java;
    $("bp-code").textContent = code;
    $("bp-filename").textContent = which === "yml" ? "plugin.yml" : generated.path;

    const warnings = $("bp-warnings");
    if (generated.warnings.length) {
      warnings.innerHTML = generated.warnings
        .map((w) => `<li>&#9888; ${esc(w)}</li>`).join("");
      warnings.hidden = false;
    } else {
      warnings.hidden = true;
      warnings.innerHTML = "";
    }
  }

  // ---- events ----

  HATS.forEach((h) => {
    const btn = root.querySelector(`[data-hat="${h.piece}"]`);
    if (btn) btn.addEventListener("click", () => addUnit(h.piece));
  });
  DOS.forEach((d) => {
    const btn = root.querySelector(`[data-do="${d.action}"]`);
    if (btn) btn.addEventListener("click", () => addAction(d.action));
  });

  ["bp-name", "bp-package", "bp-version", "bp-description"].forEach((id) => {
    $(id).addEventListener("input", () => {
      state.name = $("bp-name").value;
      state.package = $("bp-package").value;
      state.version = $("bp-version").value;
      state.description = $("bp-description").value;
      save();
      renderPreview();
    });
  });

  /** One delegated handler per stack, so re-rendering never leaves listeners behind. */
  ["bp-commands", "bp-listeners"].forEach((id) => {
    const host = $(id);

    host.addEventListener("click", (e) => {
      const unitEl = e.target.closest("[data-unit]");
      if (!unitEl) return;
      const unit = unitById(Number(unitEl.getAttribute("data-unit")));
      if (!unit) return;

      const button = e.target.closest("button");
      if (!button) {
        state.activeId = unit.id;
        commit();
        return;
      }
      const act = button.getAttribute("data-act");
      if (act === "drop-unit") {
        state.units = state.units.filter((u) => u !== unit);
        if (state.activeId === unit.id) state.activeId = state.units.length ? state.units[0].id : null;
        commit();
        return;
      }
      const row = button.closest("[data-index]");
      if (!row) return;
      const index = Number(row.getAttribute("data-index"));
      if (act === "drop") {
        unit.actions.splice(index, 1);
        commit();
      } else if (act === "up") {
        moveAction(unit, index, -1);
      } else if (act === "down") {
        moveAction(unit, index, 1);
      }
    });

    // Typing updates the model in place; the preview follows without a re-render, so
    // the caret stays where the user put it.
    host.addEventListener("input", (e) => {
      const field = e.target.getAttribute && e.target.getAttribute("data-field");
      if (!field) return;
      const unitEl = e.target.closest("[data-unit]");
      const unit = unitById(Number(unitEl.getAttribute("data-unit")));
      if (!unit) return;
      const row = e.target.closest("[data-index]");
      if (row) {
        unit.actions[Number(row.getAttribute("data-index"))][field] = e.target.value;
      } else if (field === "name") {
        unit.name = e.target.value;
      }
      save();
      renderPreview();
    });

    // A dropdown change can alter what is legal (a chat script allows "cancel"), so a
    // full re-render is right here.
    host.addEventListener("change", (e) => {
      const field = e.target.getAttribute && e.target.getAttribute("data-field");
      if (field !== "kind") return;
      const unitEl = e.target.closest("[data-unit]");
      const unit = unitById(Number(unitEl.getAttribute("data-unit")));
      if (!unit) return;
      unit.kind = e.target.value;
      state.activeId = unit.id;
      if (unit.kind !== "chat") unit.actions = unit.actions.filter((a) => a.action !== "cancel");
      commit();
    });
  });

  root.querySelectorAll(".sb-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      root.querySelectorAll(".sb-tab").forEach((t) => t.classList.remove("sb-tab-on"));
      tab.classList.add("sb-tab-on");
      renderPreview();
    });
  });

  $("bp-copy").addEventListener("click", () => {
    const text = $("bp-code").textContent;
    const done = () => {
      const label = $("bp-copy");
      label.textContent = "copied";
      window.setTimeout(() => { label.textContent = "copy"; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => {});
    }
  });

  $("bp-reset").addEventListener("click", () => {
    state = starter();
    $("bp-name").value = state.name;
    $("bp-package").value = state.package;
    $("bp-version").value = state.version;
    $("bp-description").value = state.description;
    commit();
  });

  // ---- zip (store method, no dependencies) ----

  const utf8 = (s) => new TextEncoder().encode(s);
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (bytes) => {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };

  function makeZip(files) {
    const now = new Date();
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const parts = [];
    const central = [];
    let offset = 0;

    for (const f of files) {
      const nameBytes = utf8(f.name);
      const crc = crc32(f.data);
      const size = f.data.length;
      const local = new Uint8Array(30);
      const dv = new DataView(local.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 0x0800, true);
      dv.setUint16(10, time, true);
      dv.setUint16(12, date, true);
      dv.setUint32(14, crc, true);
      dv.setUint32(18, size, true);
      dv.setUint32(22, size, true);
      dv.setUint16(26, nameBytes.length, true);
      parts.push(local, nameBytes, f.data);

      const cen = new Uint8Array(46);
      const cdv = new DataView(cen.buffer);
      cdv.setUint32(0, 0x02014b50, true);
      cdv.setUint16(4, 20, true);
      cdv.setUint16(6, 20, true);
      cdv.setUint16(8, 0x0800, true);
      cdv.setUint16(12, time, true);
      cdv.setUint16(14, date, true);
      cdv.setUint32(16, crc, true);
      cdv.setUint32(20, size, true);
      cdv.setUint32(24, size, true);
      cdv.setUint16(28, nameBytes.length, true);
      cdv.setUint32(42, offset, true);
      central.push(cen, nameBytes);
      offset += local.length + nameBytes.length + size;
    }

    const centralSize = central.reduce((n, b) => n + b.length, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    return new Blob([...parts, ...central, eocd], { type: "application/zip" });
  }

  $("bp-download").addEventListener("click", () => {
    const g = generated || window.BlueprintCodegen.generate(currentModel());
    const cls = g.className;
    const pkgPath = g.packageName.split(".").join("/");
    const jarUrl = "https://github.com/vib-studios/vib-MC/releases/latest/download/vib-mc.jar";

    const bat = `@echo off\r\nrem requires a JDK 8+ (javac and jar on PATH)\r\nif not exist vib-mc.jar (\r\n  echo Downloading vib-mc.jar...\r\n  powershell -NoProfile -Command "Invoke-WebRequest -Uri '${jarUrl}' -OutFile 'vib-mc.jar'"\r\n)\r\njavac -cp vib-mc.jar -d out src\\${pkgPath}\\${cls}.java\r\nif errorlevel 1 (\r\n  echo Compile failed - see the errors above\r\n  pause\r\n  exit /b 1\r\n)\r\njar cf ${cls}.jar -C out . plugin.yml\r\necho Built ${cls}.jar - drop it in plugins/ and restart the server\r\npause\r\n`;
    const sh = `#!/bin/sh\n# requires a JDK 8+ (javac and jar on PATH)\nif [ ! -f vib-mc.jar ]; then\n  echo "Downloading vib-mc.jar..."\n  curl -L -o vib-mc.jar ${jarUrl}\nfi\njavac -cp vib-mc.jar -d out src/${pkgPath}/${cls}.java || { echo "Compile failed"; exit 1; }\njar cf ${cls}.jar -C out . plugin.yml\necho "Built ${cls}.jar - drop it in plugins/ and restart the server"\n`;
    const readme = `${cls} - built with the vib-MC plugin blueprint\n\nFiles\n  plugin.yml                     the plugin descriptor\n  src/${pkgPath}/${cls}.java     your plugin\n  build.bat / build.sh           build scripts\n\nBuild\n  Windows:   double-click build.bat\n  Linux/Mac: sh build.sh\n\nThe scripts download the latest vib-mc.jar if it is not already in this folder.\nRequires a JDK 8 or newer. The result, ${cls}.jar, goes in <server>/plugins/.\n\nThis is ordinary Java - open the source and change whatever you like.\n`;

    const blob = makeZip([
      { name: "plugin.yml", data: utf8(g.yml) },
      { name: `src/${pkgPath}/${cls}.java`, data: utf8(g.java) },
      { name: "build.bat", data: utf8(bat) },
      { name: "build.sh", data: utf8(sh) },
      { name: "README.txt", data: utf8(readme) },
    ]);

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cls}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  });

  // ---- boot ----
  $("bp-name").value = state.name;
  $("bp-package").value = state.package;
  $("bp-version").value = state.version;
  $("bp-description").value = state.description;
  render();
})();
