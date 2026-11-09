import { test } from "node:test";
import assert from "node:assert/strict";
import { settingsSources, loadSettingsFile, parseRule } from "../src/settings.js";

test("settingsSources: 4 layers in documented order", () => {
  const s = settingsSources({ projectDir: "/tmp/proj", home: "/home/x" });
  assert.deepEqual(
    s.map((x) => x.label),
    ["managed", "project-local", "project", "user"],
  );
  const managed = process.platform === "darwin"
    ? "/Library/Application Support/ClaudeCode/managed-settings.json"
    : process.platform === "win32"
      ? "C:\\ProgramData\\ClaudeCode\\managed-settings.json"
      : "/etc/claude-code/managed-settings.json";
  assert.equal(s[0].file, managed);
  assert.equal(s[1].file, path.resolve("/tmp/proj", ".claude", "settings.local.json"));
  assert.equal(s[2].file, path.resolve("/tmp/proj", ".claude", "settings.json"));
  assert.equal(s[3].file, path.resolve("/home/x", ".claude", "settings.json"));
});

import path from "node:path";

test("loadSettingsFile: missing file is null (normal), broken JSON is an error", () => {
  assert.equal(loadSettingsFile("/nonexistent/settings.json"), null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pd-"));
  const bad = path.join(dir, "settings.json");
  fs.writeFileSync(bad, "{ not json");
  const r = loadSettingsFile(bad);
  assert.ok(r.error && r.error.includes("JSON"));
  fs.rmSync(dir, { recursive: true });
});

import fs from "node:fs";
import os from "node:os";

test("loadSettingsFile: allow/ask/deny rules parsed with tool+specifier", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pd-"));
  const f = path.join(dir, "settings.json");
  fs.writeFileSync(
    f,
    JSON.stringify({
      permissions: {
        allow: ["Bash(npm run *)", "WebFetch"],
        deny: ["Bash(git push *)"],
        notAList: "ignored",
      },
    }),
  );
  const r = loadSettingsFile(f);
  assert.equal(r.permissions.allow.length, 2);
  assert.equal(r.permissions.allow[0].tool, "Bash");
  assert.equal(r.permissions.allow[0].specifier, "npm run *");
  assert.equal(r.permissions.deny[0].raw, "Bash(git push *)");
  fs.rmSync(dir, { recursive: true });
});

test("parseRule: with and without specifier", () => {
  assert.deepEqual(parseRule("WebFetch"), { tool: "WebFetch", specifier: null });
  assert.deepEqual(parseRule("Bash(npm run *)"), { tool: "Bash", specifier: "npm run *" });
  // parens in specifiers are literal
  assert.deepEqual(parseRule("Bash(echo (hi))"), { tool: "Bash", specifier: "echo (hi)" });
});
