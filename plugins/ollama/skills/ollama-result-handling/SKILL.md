# Ollama Result Handling

## Output preservation

- When the helper returns Ollama output, preserve the `verdict`, `summary`, `findings`, and `next_steps` structure.
- For review output, present findings first, ordered by severity: critical, high, medium, low.
- Use file paths and line numbers exactly as the helper reports them.
- Preserve evidence boundaries and model uncertainty markers.
- If there are no findings, say so explicitly and keep residual-risk notes brief.
- If the model made edits, say so and list the touched files.

## Rescue behavior

- For `ollama:rescue`, do not turn a failed run into a Claude-side implementation attempt.
- If the model was never invoked, do not generate a substitute answer.

## Stop gate for reviews

CRITICAL: After presenting review findings from `/ollama:review` or `/ollama:adversarial-review`, stop immediately. Do not make code changes. Do not fix issues. You must ask the user which findings they want fixed before touching any file. Auto-applying fixes is forbidden.

## Error handling

- If the helper reports malformed output, include the actionable error lines and stop.
- If setup or auth is required, direct the user to `/ollama:setup`.
