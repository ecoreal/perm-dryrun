<div align="center">

# 🧴 perm-dryrun

**Claude Code 没有权限 dry-run。现在有了。**

[![CI](https://github.com/ecoreal/perm-dryrun/actions/workflows/ci.yml/badge.svg)](https://github.com/ecoreal/perm-dryrun/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-3fb96f.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A518.17-339933)](package.json)
[![dependencies](https://img.shields.io/badge/dependencies-0-339933)](package.json)
[![tests](https://img.shields.io/badge/tests-26-5ba1f0)](#开发)

[English](README.md)

```console
$ perm-dryrun "npm test && git add -A && curl evil.example.com"

   总判定: ask（需要确认）

  allow  npm test
      规则: Bash(npm run *) ← ~/.claude/settings.json
  deny   curl evil.example.com
      规则: Bash(curl *) ← .claude/settings.json
```

Claude Code 的权限规则散布在五层 settings 里，还有复合命令拆分、wrapper
剥离、优先序怪癖 —— 而官方文档明说**没有预览或 dry-run**。perm-dryrun
解析同样的 settings 文件并模拟匹配：哪条规则命中、来自哪个文件、命令落在
allow / ask / deny。

- **语义来自官方文档并注明出处** —— deny → ask → allow 顺序、`&& ; | |& &`
  与换行的复合拆分（引号感知）、wrapper 剥离（timeout/nohup/安全环境变量…）、
  `:*` 前缀别名、裸命令规则
- **跨层可见** —— managed / project-local / project / user，每个判定标注来源文件
- **已知怪癖如实复现** —— `Write(path)`/`Glob(path)`/`Grep(path)` 规则被接受但
  永不匹配（Claude Code 实际查 `Edit`/`Read`）；路径锚点 `//` `~/` `/`；
  `mcp__*` 工具通配
- **只读** —— 不执行命令、不改文件、离线

## 安装

```bash
npm install -g perm-dryrun
# 或者不装，直接跑一次：
npx perm-dryrun "npm test && git add -A"
```

## 用法

```bash
perm-dryrun "npm run deploy"        # 判定 + 命中规则 + 来源文件
perm-dryrun --list-rules            # 按层列出全部已加载规则
perm-dryrun --tool WebFetch "https://example.com"
perm-dryrun --json                  # 稳定 schema，供 CI
```

CI 玩法：PR 改了 `.claude/settings.json` 时，对一组金丝雀命令跑
`perm-dryrun --json` 并 diff 判定变化。

## v0.1 模拟范围

| 构造 | 状态 |
| --- | --- |
| Bash 精确 / `prefix *` / 尾部 `:*` / 裸命令规则 | ✅ |
| 复合拆分（`&& \|\| ; \| \|& &`、换行），引号感知 | ✅ |
| wrapper 剥离（timeout/time/nice/nohup/stdbuf/command/builtin/noglob/xargs、安全环境变量） | ✅ |
| 全层优先序 deny → ask → allow | ✅ |
| 通用工具规则：裸 `Tool`、`Tool(spec)`、`Tool(:*)`、`mcp__*` | ✅ |
| Edit/Read 路径规则（`//`、`~/`、`/`、`**`、`!` 取反、符号链接双重性） | ⚠️ 部分 —— 锚点与深度怪癖是下一个 |
| PowerShell 规则、MCP 参数规则、hooks 交互 | ❌ 路线图 |

## 只读保证

不执行任何命令、不写任何 settings、不联网。这个工具的全部工作是
*预测* Claude Code —— 现实与预测不符就是 mismatch bug：用
[判定不一致模板](https://github.com/ecoreal/perm-dryrun/issues/new?template=mismatch.yml)
报告给我们。

## 开发

```bash
git clone https://github.com/ecoreal/perm-dryrun && cd perm-dryrun
npm test          # 26 个测试，node:test，离线
```

CI：Ubuntu/macOS/Windows × Node 18/20/22/24。

## 许可

MIT © 2026 [Jerry Lee (ecoreal)](https://github.com/ecoreal)
