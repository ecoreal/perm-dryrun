# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| latest on `main` | ✅ |

## Reporting a vulnerability

Use GitHub's **private vulnerability reporting** — never a public issue.

Especially valuable: any case where perm-dryrun's verdict disagrees with real
Claude Code behaviour on the same command and settings.

## By design (not vulnerabilities)

- perm-dryrun is read-only: it parses settings files and simulates matching.
- It does not enforce anything — Claude Code itself decides at runtime. A
  mismatch between the simulation and reality is a bug, not a bypass, but do
  not treat this tool as the security boundary (the docs say the same about
  Claude Code's own permission rules).
