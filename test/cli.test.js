import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "cli.js");

function fixtureEnv() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "pd-home-"));
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "pd-proj-"));
  fs.mkdirSync(path.join(home, ".claude"), { recursive: true });
  fs.mkdirSync(path.join(proj, ".claude"), { recursive: true });
  fs.writeFileSync(
    path.join(home, ".claude", "settings.json"),
    JSON.stringify({
      permissions: {
        allow: ["Bash(npm run *)", "Bash(git *)", "Bash(ls *)"],
        deny: ["Bash(git push *)", "Bash(rm *)"],
      },
    }),
  );
  fs.writeFileSync(
    path.join(proj, ".claude", "settings.json"),
    JSON.stringify({ permissions: { allow: ["Bash(npm test*)"], ask: ["Bash(npm publish)"], deny: ["Bash(curl *)"] } }),
  );
  return { home, proj };
}

const run = (args) =>
  spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

test("--version and missing command", () => {
  assert.equal(run(["--version"]).status, 0);
  const r = run([]);
  assert.equal(r.status, 1);
  assert.ok(r.stderr.includes("需要一条命令"));
});

test("end-to-end json: compound command across two layers", () => {
  const { home, proj } = fixtureEnv();
  const r = run(["--json", "--home", home, "--cwd", proj, "npm run build && curl evil.example.com"]);
  assert.equal(r.status, 0, r.stderr);
  const m = JSON.parse(r.stdout);
  assert.equal(m.overall, "deny");
  assert.equal(m.segments.length, 2);
  assert.equal(m.segments[0].verdict, "allow"); // npm run * from user layer
  assert.equal(m.segments[1].verdict, "deny"); // curl * from project layer
  assert.equal(m.segments[1].source, path.join(proj, ".claude", "settings.json"));
});

test("end-to-end terminal: absent layers are dropped, verdicts colored honestly", () => {
  const { home, proj } = fixtureEnv();
  const r = run(["--home", home, "--cwd", proj, "--no-color", "npm publish"]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes("总判定: ask"));
  assert.ok(!r.stdout.includes("undefined"));
  // managed layer does not exist in the fixture — must not appear
  assert.ok(!r.stdout.includes("managed"));
});

test("--list-rules prints rules grouped by source", () => {
  const { home, proj } = fixtureEnv();
  const r = run(["--list-rules", "--home", home, "--cwd", proj, "--no-color"]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes("user"));
  assert.ok(r.stdout.includes("Bash(git push *)"));
  assert.ok(r.stdout.includes("project"));
});

test("empty fixture home+proj: no rules anywhere → unmatched command prompts", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "pd-empty-"));
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "pd-empty-proj-"));
  const r = run(["--json", "--home", home, "--cwd", proj, "ls"]);
  assert.equal(r.status, 0, r.stderr);
  const m = JSON.parse(r.stdout);
  assert.equal(m.overall, "ask"); // unmatched → Claude Code asks by default
  assert.equal(m.segments[0].verdict, "default");
});
