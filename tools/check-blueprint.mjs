/*
 * Blueprint build-script check.
 *
 * The generated build.sh/build.bat used to assume javac and jar were on PATH,
 * so a JRE-only machine failed with "javac: command not found" even when a JDK
 * was sitting in JAVA_HOME or a launcher's private runtime folder. This renders
 * the scripts, parses build.sh, and runs it with stub javac/jar tools so the
 * lookup and the argument wiring cannot regress silently.
 *
 *   node tools/check-blueprint.mjs
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { generate, buildScripts } = require("../blueprint-codegen.js");

const plugin = generate({
  name: "Kickme",
  package: "com.example",
  version: "1.0.0",
  description: "A blueprint command",
  commands: [{ name: "kickme", actions: [] }],
  listeners: [],
});
assert.equal(plugin.className, "Kickme");
assert.equal(plugin.packageName, "com.example");

const scripts = buildScripts({
  className: plugin.className,
  packageName: plugin.packageName,
  jarUrl: "https://example.invalid/vib-mc.jar",
});

assert.match(scripts.sh, /find_java_tool javac/);
assert.match(scripts.sh, /JAVA_HOME/);
assert.match(scripts.sh, /No JDK found/);
assert.doesNotMatch(scripts.sh, /javac and jar on PATH/);
assert.match(scripts.sh, /src\/com\/example\/Kickme\.java/);
assert.match(scripts.bat, /:no_jdk/);
assert.match(scripts.bat, /src\\com\\example\\Kickme\.java/);

// Parsing catches broken quoting without needing a JDK.
execFileSync("sh", ["-n"], { input: scripts.sh });

// Run the real script with stub tools. This exercises the JAVA_HOME lookup and
// the exact javac/jar arguments rather than only looking for strings.
const root = mkdtempSync(join(tmpdir(), "vib-blueprint-"));
const jdkBin = join(root, "jdk", "bin");
mkdirSync(jdkBin, { recursive: true });
const toolLog = join(root, "tools.log");
for (const tool of ["javac", "jar"]) {
  const path = join(jdkBin, tool);
  writeFileSync(path, `#!/bin/sh\nprintf '%s %s\\n' "${tool}" "$*" >> "${toolLog}"\n`);
  chmodSync(path, 0o755);
}
mkdirSync(join(root, "src", "com", "example"), { recursive: true });
writeFileSync(join(root, "src", "com", "example", "Kickme.java"), plugin.java);
writeFileSync(join(root, "plugin.yml"), plugin.yml);
writeFileSync(join(root, "build.sh"), scripts.sh);
writeFileSync(join(root, "vib-mc.jar"), "");

const output = execFileSync("sh", ["build.sh"], {
  cwd: root,
  env: { ...process.env, JAVA_HOME: join(root, "jdk"), PATH: "/usr/bin:/bin" },
  encoding: "utf8",
});
assert.match(output, /Built Kickme\.jar/);

const calls = readFileSync(toolLog, "utf8");
assert.match(calls, /^javac -cp vib-mc\.jar -d out src\/com\/example\/Kickme\.java$/m);
assert.match(calls, /^jar cf Kickme\.jar -C out \. plugin\.yml$/m);

console.log("blueprint build scripts look good");
