---
description: View the output of a completed OLLAMA task or review
argument-hint: '[job-id]'
allowed-tools: Bash(node:*)
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ollama-companion.mjs" result --json $ARGUMENTS
```

Present the stored result. If job not found: tell the user to check `/ollama:status` for valid job IDs.
