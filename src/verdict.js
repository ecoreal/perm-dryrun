// The verdict engine: given the collected rules from every settings source and
// a command, produce the documented outcome — deny, then ask, then allow; a
// compound command needs every subcommand allowed to run without a prompt.

import { splitCompound, stripWrappers, bashMatches } from "./bashmatch.js";
import { parseRule } from "./settings.js";

// Collect Bash rules across all sources: [{level, label, file, pattern}]
export function bashRules(sources) {
  const rules = [];
  for (const src of sources) {
    if (!src.permissions) continue;
    for (const listName of ["deny", "ask", "allow"]) {
      for (const rule of src.permissions[listName]) {
        if (rule.tool !== "Bash") continue;
        if (rule.specifier === null) continue; // bare Bash: not a Bash-command rule
        rules.push({
          level: src.level,
          label: src.label,
          file: src.file,
          list: listName,
          raw: rule.raw,
          specifier: rule.specifier,
        });
      }
    }
  }
  return rules;
}

// Generic (non-Bash) tool rules: bare Tool matches everything; Tool(spec)
// matches exact or :* prefix. Used for tools like WebFetch, Agent, mcp__*.
export function toolMatches(rule, tool, specifier) {
  // a trailing * on the TOOL name is a wildcard: mcp__* denies all MCP tools
  const toolOk = rule.tool.endsWith("*")
    ? tool.startsWith(rule.tool.slice(0, -1))
    : rule.tool === tool;
  if (!toolOk) return false;
  if (rule.specifier === null) return true; // bare Tool
  if (specifier == null) return false;
  if (rule.specifier === "*") return true;
  if (rule.specifier.endsWith(":*")) return specifier.startsWith(rule.specifier.slice(0, -2));
  return rule.specifier === specifier;
}

function firstMatch(rules, subcommand) {
  for (const r of rules) {
    if (bashMatches(subcommand, r.specifier)) return r;
  }
  return null;
}

// The dry-run for one command line. Returns per-segment verdicts and the
// overall verdict, following deny → ask → allow with the compound rule.
export function dryRun(command, sources, { tool = "Bash", specifier = null } = {}) {
  if (tool !== "Bash") {
    // generic tool rule: same precedence over every source's rules
    const all = [];
    for (const src of sources) {
      if (!src.permissions) continue;
      for (const listName of ["deny", "ask", "allow"]) {
        for (const rule of src.permissions[listName]) {
          // rules arrive pre-parsed from loadSettingsFile; tolerate raw strings
          const parsed = rule.tool ? rule : parseRule(rule.raw ?? rule);
          all.push({ list: listName, label: src.label, file: src.file, ...parsed });
        }
      }
    }
    for (const listName of ["deny", "ask", "allow"]) {
      const hit = all.find((r) => r.list === listName && toolMatches(r, tool, specifier));
      if (hit) {
        return {
          tool,
          overall: listName,
          segments: [{ segment: specifier ?? tool, verdict: listName, rule: hit.raw, source: hit.file }],
        };
      }
    }
    return {
      tool,
      overall: "default",
      segments: [{ segment: specifier ?? tool, verdict: "default", rule: null, source: null }],
    };
  }

  const rules = bashRules(sources);
  const deny = rules.filter((r) => r.list === "deny");
  const ask = rules.filter((r) => r.list === "ask");
  const allow = rules.filter((r) => r.list === "allow");

  const segments = splitCompound(command).map((rawSeg) => {
    const seg = stripWrappers(rawSeg);
    const denyHit = firstMatch(deny, seg);
    if (denyHit) return { segment: rawSeg, unwrapped: seg, verdict: "deny", rule: denyHit.raw, source: denyHit.file };
    const askHit = firstMatch(ask, seg);
    if (askHit) return { segment: rawSeg, unwrapped: seg, verdict: "ask", rule: askHit.raw, source: askHit.file };
    const allowHit = firstMatch(allow, seg);
    if (allowHit) return { segment: rawSeg, unwrapped: seg, verdict: "allow", rule: allowHit.raw, source: allowHit.file };
    return { segment: rawSeg, unwrapped: seg, verdict: "default", rule: null, source: null };
  });

  let overall;
  if (segments.some((s) => s.verdict === "deny")) overall = "deny";
  else if (segments.some((s) => s.verdict === "ask" || s.verdict === "default")) overall = "ask";
  else overall = "allow";

  return { tool: "Bash", overall, segments };
}
