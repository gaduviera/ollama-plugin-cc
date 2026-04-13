---
description: Cancel a running OLLAMA task
argument-hint: '[job-id]'
allowed-tools: Bash(node:*)
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ollama-companion.mjs" cancel --json $ARGUMENTS
```

Parse the JSON result and confirm cancellation to the user.
If no job-id was provided, use the most recently active job.
If no active job is found, check `/ollama:status` for available job IDs.
