---
description: Code review of current changes using the active OLLAMA model
argument-hint: '[--scope <auto|working-tree|branch>] [--base <ref>] [--background]'
allowed-tools: Bash(node:*)
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ollama-companion.mjs" review --json $ARGUMENTS
```

If no active model: tell the user to run `/ollama:setup` first.
Present the review results clearly.
