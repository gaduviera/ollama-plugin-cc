---
description: Diagnose OLLAMA connection, configuration, and recent job issues
allowed-tools: Bash(node:*)
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ollama-companion.mjs" rescue --json $ARGUMENTS
```

Present the diagnostic report clearly:
- OLLAMA server status (running / not running)
- Active model
- OLLAMA endpoint URL
- Config file location (`~/.ollama-plugin-cc/config.json`)
- Recent job errors (if any)

Based on the diagnosis, suggest specific remediation steps:
- If OLLAMA not running → `ollama serve`
- If no active model → `/ollama:setup`
- If model missing → `/ollama:run-model <name>`
