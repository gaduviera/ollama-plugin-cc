---
description: Download a model from Ollama hub to use locally
argument-hint: '<model-name> (e.g. mistral, deepseek-coder, llama3)'
allowed-tools: Bash(node:*)
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ollama-companion.mjs" run-model --json $ARGUMENTS
```

Parse the JSON result:
- If download started in background: show the jobId and tell user to check progress with `/ollama:result <jobId>`.
- After download completes, the model can be activated with `/ollama:switch <model-name>`.
- If OLLAMA is not running: tell user to start it with `ollama serve`.
