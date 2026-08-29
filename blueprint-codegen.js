/*
 * Turns a blueprint (a plain object describing scripts) into the files of a plugin.
 *
 * Deliberately free of the DOM: the builder page hands it a model and gets text back,
 * which means the generated Java can be checked by compiling it, rather than by reading
 * it and hoping. Every snippet below targets the real vib-MC plugin API.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BlueprintCodegen = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const jq = (s) => JSON.stringify(String(s));
  /** A chat-component JSON document, as a Java string literal. */
  const msg = (s) => jq(JSON.stringify({ text: String(s) }));

  const EVENTS = {
    join: { event: "PlayerJoinEvent", method: "onJoin", cls: "JoinListener" },
    quit: { event: "PlayerQuitEvent", method: "onQuit", cls: "QuitListener" },
    chat: { event: "ChatEvent", method: "onChat", cls: "ChatListener" },
  };

  /**
   * Every action the palette offers.
   *
   * `code` returns the Java lines for one action. `player` is an expression for the
   * ServerPlayer, `tell` is how to send that player a message - they differ between a
   * command (where the sender may be the console) and an event (where there is always a
   * player). `needsPlayer` marks the actions a console cannot perform, so a command that
   * uses one gets a guard.
   */
  const ACTIONS = {
    say: {
      label: "say",
      imports: [],
      code: (a, ctx) => [`${ctx.tell}(${msg(a.value || "Hello!")});`],
    },
    broadcast: {
      label: "tell everyone",
      imports: ["net.vibmc.server.VibMC"],
      code: (a) => [
        `VibMC.getInstance().getPlayerManager().broadcastMessage(${msg(a.value || "Hello, everyone!")});`,
      ],
    },
    gamemode: {
      label: "set game mode",
      needsPlayer: true,
      imports: ["net.vibmc.player.GameMode"],
      code: (a, ctx) => [
        `${ctx.player}.setGameMode(GameMode.${(a.value || "creative").toUpperCase()});`,
      ],
    },
    give: {
      label: "give item",
      needsPlayer: true,
      imports: [
        "com.github.retrooper.packetevents.protocol.item.ItemStack",
        "com.github.retrooper.packetevents.protocol.item.type.ItemTypes",
      ],
      code: (a, ctx) => [
        // v0.0.6 dropped net.vibmc.item.* in favour of PacketEvents item types.
        `${ctx.player}.addItem(ItemStack.builder()`,
        `    .type(ItemTypes.getByName(${jq("minecraft:" + String(a.value || "diamond").toLowerCase())}))`,
        `    .amount(${clampInt(a.amount, 1, 64, 1)})`,
        `    .build());`,
      ],
    },
    teleport: {
      label: "teleport",
      needsPlayer: true,
      imports: [],
      code: (a, ctx) => [
        `${ctx.player}.teleport(${num(a.x, 0)}, ${num(a.y, 80)}, ${num(a.z, 0)});`,
      ],
    },
    heal: {
      label: "heal",
      needsPlayer: true,
      imports: [],
      code: (a, ctx) => [
        `${ctx.player}.setHealth(${ctx.player}.getMaxHealth());`,
        `${ctx.player}.setFoodLevel(20);`,
        // v0.0.7 made sendHealth() public, so the client's hearts update immediately.
        `${ctx.player}.sendHealth();`,
      ],
    },
    time: {
      label: "set time",
      needsPlayer: true,
      imports: [],
      code: (a, ctx) => [
        `${ctx.player}.getWorld().setTimeOfDay(${a.value === "night" ? 13000 : 1000}L);`,
      ],
    },
    weather: {
      label: "set weather",
      needsPlayer: true,
      imports: [],
      code: (a, ctx) => [
        `${ctx.player}.getWorld().weatherSystem().setWeather(${jq(a.value || "clear")});`,
      ],
    },
    kick: {
      label: "kick",
      needsPlayer: true,
      imports: [],
      code: (a, ctx) => [`${ctx.player}.disconnect(${jq(a.value || "Bye!")});`],
    },
    log: {
      label: "log to console",
      imports: [],
      code: (a) => [`getLogger().info(${jq(a.value || "something happened")});`],
    },
    cancel: {
      label: "cancel the chat",
      chatOnly: true,
      imports: [],
      code: () => ["event.setCancelled(true);"],
    },
  };

  function num(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? String(n) : String(fallback);
  }

  function clampInt(value, min, max, fallback) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  /** Strips a name down to something Java will accept as a class. */
  function className(raw) {
    const cleaned = String(raw || "").replace(/[^a-zA-Z0-9_]/g, "");
    if (!cleaned) return "MyPlugin";
    const head = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    return /^[0-9]/.test(head) ? "Plugin" + head : head;
  }

  function packageName(raw) {
    const cleaned = String(raw || "")
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, "")
      .replace(/\.+/g, ".")
      .replace(/^\.|\.$/g, "");
    if (!cleaned) return "com.example";
    // A package part may not start with a digit, and "class" and friends are reserved.
    return cleaned
      .split(".")
      .map((part) => (/^[0-9]/.test(part) ? "p" + part : part))
      .join(".");
  }

  function commandName(raw) {
    return String(raw || "").replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
  }

  /** Actions that a console-run command cannot perform. */
  function needsPlayer(actions) {
    return actions.some((a) => ACTIONS[a.action] && ACTIONS[a.action].needsPlayer);
  }

  function collectImports(model, hasListeners) {
    const imports = new Set(["net.vibmc.plugin.VibMCPlugin"]);
    if (model.commands.length) {
      imports.add("net.vibmc.command.Command");
      imports.add("net.vibmc.command.CommandSender");
    }
    if (hasListeners) {
      imports.add("net.vibmc.plugin.EventHandler");
      imports.add("net.vibmc.plugin.Listener");
    }
    model.listeners.forEach((l) => {
      const spec = EVENTS[l.event];
      if (spec) imports.add("net.vibmc.plugin.event." + spec.event);
    });
    model.commands.forEach((c) => {
      if (needsPlayer(c.actions)) imports.add("net.vibmc.entity.ServerPlayer");
    });
    const all = model.commands.concat(model.listeners);
    all.forEach((unit) => {
      unit.actions.forEach((a) => {
        const spec = ACTIONS[a.action];
        if (spec) spec.imports.forEach((i) => imports.add(i));
      });
    });
    return [...imports].sort();
  }

  function commandBody(cmd) {
    const lines = [];
    const guarded = needsPlayer(cmd.actions);
    if (guarded) {
      lines.push("if (!sender.isPlayer()) {");
      lines.push(`    sender.sendMessage(${msg("Only a player can use /" + cmd.name)});`);
      lines.push("    return true;");
      lines.push("}");
      lines.push("ServerPlayer player = sender.getPlayer();");
    }
    const ctx = { player: "player", tell: guarded ? "player.sendMessage" : "sender.sendMessage" };
    cmd.actions.forEach((a) => {
      const spec = ACTIONS[a.action];
      if (!spec || spec.chatOnly) return;  // "cancel" makes no sense in a command
      spec.code(a, ctx).forEach((l) => lines.push(l));
    });
    lines.push("return true;");
    return lines;
  }

  function listenerBody(listener) {
    const ctx = { player: "event.getPlayer()", tell: "event.getPlayer().sendMessage" };
    const lines = [];
    listener.actions.forEach((a) => {
      const spec = ACTIONS[a.action];
      if (!spec) return;
      if (spec.chatOnly && listener.event !== "chat") return;
      spec.code(a, ctx).forEach((l) => lines.push(l));
    });
    return lines;
  }

  /**
   * @param {object} model {name, package, version, description, commands[], listeners[]}
   * @return {{yml: string, java: string, className: string, packageName: string,
   *           path: string, warnings: string[]}}
   */
  function generate(model) {
    const cls = className(model.name);
    const pkg = packageName(model.package);
    const version = String(model.version || "1.0.0").trim() || "1.0.0";
    const description = String(model.description || "").replace(/\r?\n/g, " ").trim();

    const commands = (model.commands || [])
      .map((c) => ({ name: commandName(c.name), actions: c.actions || [] }))
      .filter((c) => c.name);
    const listeners = (model.listeners || [])
      .filter((l) => EVENTS[l.event])
      .map((l) => ({ event: l.event, actions: l.actions || [] }));

    const warnings = [];
    const seen = new Set();
    commands.forEach((c) => {
      if (seen.has(c.name)) warnings.push(`Two scripts both answer /${c.name} - the second one wins.`);
      seen.add(c.name);
      if (!c.actions.length) warnings.push(`/${c.name} does nothing yet - snap a "do" piece onto it.`);
    });
    listeners.forEach((l) => {
      if (!l.actions.length) warnings.push(`The "when player ${l.event}s" script does nothing yet.`);
    });

    const ymlLines = [`name=${cls}`, `version=${version}`, `main=${pkg}.${cls}`];
    if (description) ymlLines.push(`description=${description}`);

    const out = [`package ${pkg};`, ""];
    collectImports({ commands, listeners }, listeners.length).forEach((i) => out.push(`import ${i};`));
    out.push("", "/** Generated by the vib-MC plugin blueprint. Edit freely. */");
    out.push(`public class ${cls} extends VibMCPlugin {`, "    @Override", "    public void onEnable() {");

    commands.forEach((c) => {
      out.push(
        `        getCommandManager().register(new Command(${jq(c.name)}, ${jq(description || "A blueprint command")}, ${jq("/" + c.name)}, null) {`,
        "            @Override",
        "            public boolean execute(CommandSender sender, String[] args) {"
      );
      commandBody(c).forEach((l) => out.push("                " + l));
      out.push("            }", "        });");
    });

    const definitions = [];
    listeners.forEach((l, index) => {
      const spec = EVENTS[l.event];
      const suffix = index === 0 ? "" : String(index + 1);
      const lsnCls = spec.cls + suffix;
      out.push(`        getPluginManager().registerEvents(new ${lsnCls}(), this);`);

      // An inner class, not a static one: listeners get to call the plugin's own
      // methods, which is what makes "log to console" work inside an event.
      const def = [
        `    private class ${lsnCls} implements Listener {`,
        "        @EventHandler",
        `        public void ${spec.method}(${spec.event} event) {`,
      ];
      listenerBody(l).forEach((line) => def.push("            " + line));
      def.push("        }", "    }");
      definitions.push(def.join("\n"));
    });

    if (!commands.length && !listeners.length) {
      out.push(`        getLogger().info(${jq(cls + " enabled")});`);
    }
    out.push("    }");
    definitions.forEach((d) => out.push("", d));
    out.push("}");

    return {
      yml: ymlLines.join("\n") + "\n",
      java: out.join("\n") + "\n",
      className: cls,
      packageName: pkg,
      path: "src/" + pkg.split(".").join("/") + "/" + cls + ".java",
      warnings,
    };
  }

  return { generate, ACTIONS, EVENTS };
});
