<div align="center">

# 🧴 perm-dryrun

**Claude Code has no permission dry-run. Now it does.**

[![CI](https://github.com/ecoreal/perm-dryrun/actions/workflows/ci.yml/badge.svg)](https://github.com/ecoreal/perm-dryrun/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-3fb96f.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A518.17-339933)](package.json)
[![dependencies](https://img.shields.io/badge/dependencies-0-339933)](package.json)
[![tests](https://img.shields.io/badge/tests-26-5ba1f0)](#development)

[中文说明](README.zh-CN.md)

```console
$ perm-dryrun "npm test && git add -A && curl evil.example.com"

   总判定: ask（需要确认）

  allow  npm test
      规则: Bash(npm run *) ← ~/.claude/settings.json
  allow  git add -A
      规则: Bash(git *) ← ~/.claude/settings.json
  deny   curl evil.example.com
      规则: Bash(curl *) ← .claude/settings.json
```

Claude Code's permission rules are spread across five settings layers with
compound-command splitting, wrapper stripping, and precedence quirks — and the
official docs state there is **no preview or dry-run**. perm-dryrun parses the
same settings files and simulates the match: which rule fires, from which
file, and whether the command lands on allow, ask, or deny.

- **Semantics from the docs, cited** — deny → ask → allow order, compound
  splitting on `&& ; | |& &` and newlines, wrapper stripping (`timeout`,
  `nohup`, safe env assignments…), `:*` prefix aliases, bare-command rules
- **Cross-layer visibility** — managed / project-local / project / user, every
  verdict names its source file
- **Known quirks reproduced** — `Write(path)`/`Glob(path)`/`Grep(path)` rules
  are accepted but never matched (Claude Code checks `Edit`/`Read`); path
  anchors `//` `~/` `/`; `mcp__*` tool wildcards
- **Read-only** — executes nothing, modifies nothing, offline

## Install

```bash
npm install -g perm-dryrun
# or run once, install nothing:
npx perm-dryrun "npm test && git add -A"
```

## Usage

```bash
perm-dryrun "npm run deploy"        # verdict + matching rule + source file
perm-dryrun --list-rules            # dump every loaded rule by layer
perm-dryrun --tool WebFetch "https://example.com"
perm-dryrun --json                  # stable schema, for CI
```

CI idea: on PRs that touch `.claude/settings.json`, run `perm-dryrun --json`
against a set of canary commands and diff the verdicts.

## What's simulated (v0.1)

| Construct | Status |
| --- | --- |
| Bash exact / `prefix *` / trailing `:*` / bare-command rules | ✅ |
| Compound splitting (`&& \|\| ; \| \|& &`, newlines), quote-aware | ✅ |
| Wrapper stripping (timeout/time/nice/nohup/stdbuf/command/builtin/noglob/xargs, safe env assignments) | ✅ |
| Precedence deny → ask → allow across all layers | ✅ |
| Generic tool rules: bare `Tool`, `Tool(spec)`, `Tool(:*)`, `mcp__*` | ✅ |
| Path rules for Edit/Read (`//`, `~/`, `/`, `**`, `!` negation, symlink duality) | ⚠️ partial — anchors and depth quirks are next |
| PowerShell rules, MCP parameter rules, hooks interaction | ❌ roadmap |

## The read-only guarantees

No command is executed. No settings file is written. No network. The tool's
whole job is to *predict* Claude Code — and when reality disagrees, that's a
mismatch bug: [file it with the verdict template](https://github.com/ecoreal/perm-dryrun/issues/new?template=mismatch.yml).

## Development

```bash
git clone https://github.com/ecoreal/perm-dryrun && cd perm-dryrun
npm test          # 26 tests, node:test, offline
```

CI: Ubuntu/macOS/Windows × Node 18/20/22/24.

## License

MIT © 2026 [Jerry Lee (ecoreal)](https://github.com/ecoreal)
