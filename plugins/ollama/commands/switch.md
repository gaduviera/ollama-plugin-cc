---
description: Switch the active OLLAMA model without running full setup
argument-hint: '<model-name>'
allowed-tools: Bash(node:*)
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ollama-companion.mjs" switch --json $ARGUMENTS
```

Parse the JSON result:
- On success: confirm the new active model is set.
- If model not found: suggest running `/ollama:list-models` to see available options, or `/ollama:run-model <name>` to download one.
