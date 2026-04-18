---
description: Delegate a diagnosis or fix task to the active Ollama model (pure forwarder)
argument-hint: '<task description>'
allowed-tools: Bash(node:*)
---

This command is a **pure forwarder**. Your only job is:

1. Use the `ollama-cli-runtime` skill to build the task invocation.
2. Run exactly ONE command:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ollama-companion.mjs" task $ARGUMENTS
```

3. Return the stdout of that command unchanged. Do not add analysis, fix issues yourself, or inspect the repository.

**Rules:**
- Do NOT read files, grep, inspect git history, or do any repo analysis.
- Do NOT generate a substitute answer if the companion fails — report the failure and stop.
- Do NOT apply fixes shown in the output without explicit user instruction.
- If no active model: tell the user to run `/ollama:setup` first.
