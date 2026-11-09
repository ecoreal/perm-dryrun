#!/usr/bin/env node
// perm-dryrun — dry-run Claude Code permission rules before you run anything.
// Read-only: parses settings files, simulates matching, executes nothing.

import { createRequire } from "node:module";
import path from "node:path";
import os from "node:os";
import { settingsSources, loadSettingsFile } from "./settings.js";
import { dryRun } from "./verdict.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

function usage(code = 0) {
  console.log(`🧴 perm-dryrun v${pkg.version} — Claude Code 权限规则模拟器

用法:
  perm-dryrun "<命令>"            模拟 Bash 命令命中哪条规则、落在 allow/ask/deny
  perm-dryrun --tool <名> "<内容>"  模拟非 Bash 工具（如 WebFetch、mcp__x__y）
  perm-dryrun --list-rules        列出全部已加载规则及其来源文件

选项:
  --cwd <dir>        项目目录（默认当前目录）
  --home <dir>       用户 home（测试/其他用户）
  --json             JSON 输出
  --no-color         纯文本
  -h, --help         帮助
  -v, --version      版本

只读工具：不执行命令、不修改文件。规则语义以
code.claude.com/docs/en/permissions 为准（启发式实现，边界见 README）。`);
  process.exit(code);
}

function parseArgv(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") usage(0);
    if (a === "-v" || a === "--version") {
      console.log(pkg.version);
      process.exit(0);
    }
    if (a === "--json") flags.json = true;
    else if (a === "--no-color") flags.color = false;
    else if (a === "--cwd") flags.cwd = argv[++i];
    else if (a === "--home") flags.home = argv[++i];
    else if (a === "--list-rules") flags.listRules = true;
    else if (a === "--tool") flags.tool = argv[++i];
    else if (a.startsWith("--")) {
      console.error(`perm-dryrun: 未知选项 ${a}`);
      usage(1);
    } else flags._.push(a);
  }
  return flags;
}

function collectSources(flags) {
  const sources = settingsSources({
    projectDir: flags.cwd ? path.resolve(flags.cwd) : process.cwd(),
    home: flags.home || os.homedir(),
  });
  // drop absent sources entirely — a missing layer must not reach the report
  return sources
    .map((s) => ({ ...s, ...loadSettingsFile(s.file) }))
    .filter((s) => s.permissions || s.error);
}

function listRules(sources, color) {
  const d = (s) => (color ? dim(s) : s);
  for (const src of sources) {
    console.log(bold(`${src.label}  `) + d(src.file));
    if (src.error) {
      console.log(red(`  ⚠ ${src.error}`));
      continue;
    }
    for (const listName of ["deny", "ask", "allow"]) {
      for (const r of src.permissions[listName]) console.log(`  ${listName.padEnd(6)} ${r.raw}`);
    }
    const empty = ["allow", "ask", "deny"].every((l) => !src.permissions[l].length);
    if (empty) console.log(d("  (no rules)"));
  }
}

function colorFor(verdict, color) {
  const map = { deny: red, ask: yellow, allow: green, default: (s) => s };
  const paint = map[verdict] || ((s) => s);
  return color ? paint(verdict) : verdict;
}

const flags = parseArgv(process.argv.slice(2));
const color = flags.color !== false && process.stdout.isTTY;
const sources = collectSources(flags);

if (flags.listRules) {
  listRules(sources, color);
  process.exit(0);
}

const command = flags._.join(" ");
if (!command) {
  console.error('perm-dryrun: 需要一条命令 —— perm-dryrun "npm run deploy"');
  process.exitCode = 1;
  process.exit(process.exitCode);
}

const tool = flags.tool || "Bash";
const result = dryRun(command, sources, { tool, specifier: command });

if (flags.json) {
  console.log(
    JSON.stringify(
      {
        sources: sources.map((s) => ({ label: s.label, file: s.file, error: s.error || undefined })),
        command,
        tool: result.tool,
        overall: result.overall,
        segments: result.segments,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

console.log(bold(`🧴 perm-dryrun · ${result.tool}`));
console.log(dim(`   命令: ${command}`));
console.log(
  `   总判定: ${colorFor(result.overall, color)}` +
    (result.overall === "ask" ? dim("（需要确认）") : "") +
    (result.overall === "default" ? dim("（无规则命中 → Claude Code 默认询问）") : ""),
);
console.log("");
for (const seg of result.segments) {
  console.log(`  ${colorFor(seg.verdict, color)}  ${seg.segment}`);
  console.log(dim(`      规则: ${seg.rule ?? "（无命中 → 默认行为）"}${seg.source ? ` ← ${seg.source}` : ""}`));
}
console.log("");
console.log(dim("   启发式实现，边界情况见 README；最终解释权在 Claude Code 本体。"));
