---
description: Show OLLAMA connection status, active model, and recent jobs
argument-hint: '[job-id] [--all]'
allowed-tools: Bash(node:*)
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ollama-companion.mjs" status --json $ARGUMENTS
```

Present connection status, active model, and job list clearly.
