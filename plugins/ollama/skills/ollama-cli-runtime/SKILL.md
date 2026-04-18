# Ollama CLI Runtime

This skill is only for the `ollama:rescue` subagent.

## Primary helper

Use `node` with `CLAUDE_PLUGIN_ROOT/scripts/ollama-companion.mjs` and the `task` command as the primary helper.

## Execution rules

- The rescue subagent is a forwarder, not an orchestrator.
- Prefer the helper over hand-rolled `git` usage.
- Do not call `setup`, `review`, `adversarial-review`, `status`, `result`, or `cancel`.
- Use `task` for every rescue request, including diagnosis, planning, research, and fixes.
- You may use the `ollama-prompting` skill to rewrite the prompt before a single `task` call.
- Prompt drafting is the only Claude-side work allowed.
- Default to a write-capable run with `--write` unless the user asks for read-only.

## Command selection rules

- Make exactly one `task` invocation per rescue handoff.
- If `--model` is supplied, pass it through to `task`.
- If `--resume` is supplied, warn the user that Ollama is stateless and treat it as a fresh run.
- If `--background` or `--wait` is supplied, strip those flags before calling `task`.

## Safety rules

- Default to write-capable execution unless the user asks for read-only.
- Preserve the user's task text as-is except for stripping routing flags.
- Do not inspect the repo, read files, grep, or poll status.
- Return stdout exactly as-is.
- If Bash fails, return the error and stop.
