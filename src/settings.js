// Settings sources, in the precedence order Claude Code documents: managed
// settings always win, then CLI args (not visible to us), then project local,
// then project shared, then user. Rules from every layer are collected with
// their source — the report shows which file each verdict came from.
// Docs: https://code.claude.com/docs/en/permissions

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export function settingsSources({ projectDir = process.cwd(), home = os.homedir() } = {}) {
  const proj = path.resolve(projectDir);
  return [
    {
      label: "managed",
      level: 5,
      // documented per-platform managed-settings locations
      file: process.platform === "darwin"
        ? "/Library/Application Support/ClaudeCode/managed-settings.json"
        : process.platform === "win32"
          ? "C:\\ProgramData\\ClaudeCode\\managed-settings.json"
          : "/etc/claude-code/managed-settings.json",
    },
    { label: "project-local", level: 3, file: path.join(proj, ".claude", "settings.local.json") },
    { label: "project", level: 2, file: path.join(proj, ".claude", "settings.json") },
    { label: "user", level: 1, file: path.join(home, ".claude", "settings.json") },
  ];
}

// Parse one settings file into { allow: Rule[], ask: Rule[], deny: Rule[] }.
// Rule = { raw, tool, specifier, pattern } where pattern is the parsed
// specifier (see parseRule in match.js). Broken JSON or a non-object yields
// { error } so the report can say so instead of silently skipping a layer.
export function loadSettingsFile(file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return null; // source absent — normal
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { file, error: `JSON 解析失败: ${e.message}`, permissions: { allow: [], ask: [], deny: [] } };
  }
  const perms = json.permissions || {};
  const out = { file, permissions: {} };
  for (const listName of ["allow", "ask", "deny"]) {
    const list = perms[listName];
    if (!Array.isArray(list)) {
      out.permissions[listName] = [];
      continue;
    }
    out.permissions[listName] = list
      .filter((r) => typeof r === "string")
      .map((raw) => ({ raw, ...parseRule(raw) }));
  }
  return out;
}

// "Tool" | "Tool(specifier)" → { tool, specifier }
export function parseRule(raw) {
  const at = raw.indexOf("(");
  if (at === -1 || !raw.endsWith(")")) {
    return { tool: raw, specifier: null };
  }
  return { tool: raw.slice(0, at), specifier: raw.slice(at + 1, -1) };
}
