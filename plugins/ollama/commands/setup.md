---
description: Detect OLLAMA server, list available models, and set active model
argument-hint: '[--model <name>]'
allowed-tools: Bash(node:*), AskUserQuestion
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ollama-companion.mjs" setup --json $ARGUMENTS
```

Parse the JSON result:
- If `ollamaRunning` is `false`: tell the user to run `ollama serve` in a terminal. Do not proceed.
- If `ollamaRunning` is `true` and no `--model` was passed and there are available models: use `AskUserQuestion` to present the list (`localModels` + `cloudModels`) and ask the user to choose one. Then re-run with `--model <chosen>`.
- If `--model` was provided: confirm setup is complete and show the active model.
- Always show the full list of available models.
