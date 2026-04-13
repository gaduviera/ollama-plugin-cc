---
description: List all available OLLAMA models (local and cloud)
allowed-tools: Bash(node:*)
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ollama-companion.mjs" list-models --json $ARGUMENTS
```

Present the results in two sections:
- **Local models** — installed on this machine, with size info
- **Cloud models** — available via API credentials (shows which env var is needed)

If OLLAMA is not running, inform the user to start it with `ollama serve`.
