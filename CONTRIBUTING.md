# Contributing to perm-dryrun

## Ground rules

- **Semantics come from the docs.** Every matching behaviour must trace to
  https://code.claude.com/docs/en/permissions — cite the section in the PR.
- **Tests are the product.** This tool is a matcher; every rule syntax corner
  gets a test case. New behaviour without a test is rejected.
- **Zero dependencies** (Node stdlib only), **offline tests**, **read-only**.
- **Honest limits.** If a construct isn't supported (PowerShell, compound
  quoting edge cases…), say so in the README instead of guessing.

## Setup

```bash
git clone https://github.com/ecoreal/perm-dryrun && cd perm-dryrun
npm test          # node --test, offline
```
