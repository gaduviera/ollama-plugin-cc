---
description: Adversarial code review — finds reasons the change should NOT ship
argument-hint: '[--target <working-tree|staged|branch>] [--focus <area>]'
allowed-tools: Bash(node:*)
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ollama-companion.mjs" adversarial-review $ARGUMENTS
```

Presents structured findings ordered by severity (critical → high → medium → low).
After showing results: **STOP. Ask the user which findings, if any, they want fixed. Do NOT auto-apply changes.**

If no active model: tell the user to run `/ollama:setup` first.
