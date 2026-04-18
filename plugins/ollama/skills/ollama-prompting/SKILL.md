# Ollama Prompting

Use this skill when `ollama:rescue` needs to build a well-structured prompt for Ollama.

Prompt Ollama like an operator, not a collaborator. Keep prompts compact and block-structured with XML tags. State the task, output contract, follow-through defaults, and constraints.

## Core rules

- Prefer one clear task per run. Split unrelated asks.
- Tell the model what done looks like.
- For small local models under 13B, keep prompts under 2000 tokens.
- Use XML tags consistently.
- Prefer explicit output contracts.

## Default prompt recipe

Include:

- A `task` block for the concrete job and repo context.
- Either `structured_output_contract` or `compact_output_contract` for the exact response shape.
- `default_follow_through_policy` for what the model should do instead of asking routine questions.
- `verification_loop` or `completeness_contract` for debugging or risky fixes.
- `grounding_rules` for review, research, or anything that could drift.

## When to add blocks

- For coding or debugging, add `completeness_contract`, `verification_loop`, and `missing_context_gating`.
- For review, use the built-in `review` or `adversarial-review` commands.
- For research, add `research_mode` and `citation_rules`.
- For write-capable runs, add `action_safety`.

## How to choose

- Use the built-in `review` or `adversarial-review` commands when reviewing git changes.
- Use `task` for diagnosis, planning, research, and implementation.

## Working rules

- Prefer explicit prompt contracts.
- Do not raise reasoning complexity first; tighten the prompt and verification rules instead.
- Keep claims anchored to observed evidence.

See [references/prompt-blocks.md](references/prompt-blocks.md) and [references/ollama-prompt-recipes.md](references/ollama-prompt-recipes.md).
