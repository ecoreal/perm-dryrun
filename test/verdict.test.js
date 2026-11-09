import { test } from "node:test";
import assert from "node:assert/strict";
import { dryRun } from "../src/verdict.js";
import { parseRule } from "../src/settings.js";

// Synthetic sources — one user layer, one project layer.
function sources() {
  const mk = (label, level, file, perms) => ({
    label,
    level,
    file,
    permissions: {
      allow: (perms.allow || []).map((raw) => ({ raw, ...parseRule(raw) })),
      ask: (perms.ask || []).map((raw) => ({ raw, ...parseRule(raw) })),
      deny: (perms.deny || []).map((raw) => ({ raw, ...parseRule(raw) })),
    },
  });
  return [
    mk("user", 1, "/home/x/.claude/settings.json", {
      allow: ["Bash(npm run *)", "Bash(git *)", "Bash(ls *)"],
      deny: ["Bash(git push *)", "Bash(rm *)"],
    }),
    mk("project", 2, "/tmp/proj/.claude/settings.json", {
      allow: ["Bash(npm test*)"],
      ask: ["Bash(npm publish)"],
      deny: ["Bash(curl *)"],
    }),
  ];
}

test("allow: simple prefix rule", () => {
  const r = dryRun("npm run build", sources());
  assert.equal(r.overall, "allow");
  assert.equal(r.segments[0].rule, "Bash(npm run *)");
});

test("deny at ANY layer beats allow at ANY layer (documented order)", () => {
  // user allows git *, project denies nothing git — but user denies git push *
  const r = dryRun("git push --force", sources());
  assert.equal(r.overall, "deny");
  assert.equal(r.segments[0].rule, "Bash(git push *)");
  // project-level deny vs user-level allow
  const s2 = dryRun("curl example.com", sources());
  assert.equal(s2.overall, "deny");
  assert.equal(s2.segments[0].source, "/tmp/proj/.claude/settings.json");
});

test("ask sits between deny and allow", () => {
  const r = dryRun("npm publish", sources());
  assert.equal(r.overall, "ask");
  assert.equal(r.segments[0].rule, "Bash(npm publish)");
});

test("compound: every subcommand must be allowed, else ask", () => {
  // npm run build allowed; ls allowed → allow
  assert.equal(dryRun("npm run build && ls", sources()).overall, "allow");
  // one unmatched subcommand → ask
  assert.equal(dryRun("npm run build && whoami", sources()).overall, "ask");
});

test("compound: any subcommand hitting deny → deny", () => {
  assert.equal(dryRun("git commit -m x && git push --force", sources()).overall, "deny");
});

test("compound: any subcommand hitting ask → ask (even with allow elsewhere)", () => {
  assert.equal(dryRun("npm run build && npm publish", sources()).overall, "ask");
});

test("wrappers are stripped before matching", () => {
  assert.equal(dryRun("timeout 30 npm test", sources()).overall, "allow");
  const r = dryRun("NODE_ENV=test npm run build", sources());
  assert.equal(r.overall, "allow");
});

test("no match at all → default (Claude Code asks)", () => {
  const r = dryRun("whoami", sources());
  assert.equal(r.overall, "ask"); // unmatched = default ask
  assert.equal(r.segments[0].rule, null);
});

test("rm is denied even when a broader allow exists", () => {
  assert.equal(dryRun("rm -rf /tmp/x", sources()).overall, "deny");
});

test("generic tool rules: bare deny, exact specifier, mcp wildcards", () => {
  const s = [
    {
      label: "user",
      level: 1,
      file: "u",
      permissions: {
        allow: [],
        ask: [],
        deny: ["WebFetch", "mcp__*"].map((raw) => ({ raw, ...parseRule(raw) })),
      },
    },
  ];
  const w = dryRun("https://example.com", s, { tool: "WebFetch", specifier: "https://example.com" });
  assert.equal(w.overall, "deny");
  assert.equal(w.tool, "WebFetch");
  const mcp = dryRun("puppeteer_navigate", s, { tool: "mcp__puppeteer__puppeteer_navigate", specifier: "puppeteer_navigate" });
  assert.equal(mcp.overall, "deny");
});
