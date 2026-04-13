---
description: Delegate a coding task to the active OLLAMA model
argument-hint: '<task description> [--write] [--background]'
allowed-tools: Bash(node:*)
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ollama-companion.mjs" task --json $ARGUMENTS
```

If a background job was started: show the `jobId` and remind the user to check `/ollama:result <jobId>`.
If no active model: tell the user to run `/ollama:setup` first.
