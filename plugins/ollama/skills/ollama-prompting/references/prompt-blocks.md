# Reusable Prompt Blocks

## `task` block

```xml
<task>
  <description>CONCRETE_TASK_DESCRIPTION</description>
  <context>REPO_OR_FILE_CONTEXT</context>
</task>
```

## `structured_output_contract` block

```xml
<structured_output_contract>
Return ONLY valid JSON with this shape:
{
  "result": "string",
  "confidence": 0,
  "next_steps": ["string"]
}
</structured_output_contract>
```

## `compact_output_contract` block

```xml
<compact_output_contract>
First line: STATUS
Subsequent lines: supporting evidence
</compact_output_contract>
```

## `default_follow_through_policy` block

```xml
<default_follow_through_policy>
If context is missing but inferrable, proceed with the most reasonable assumption.
If context is not inferrable, state what is missing and stop.
Do not ask clarifying questions for routine decisions.
</default_follow_through_policy>
```

## `verification_loop` block

```xml
<verification_loop>
1. Read back changed files.
2. Confirm the change matches the requirement.
3. List side effects or follow-up work.
</verification_loop>
```

## `grounding_rules` block

```xml
<grounding_rules>
Every claim must be defensible from the provided repo context or tool outputs.
Do not invent files, functions, or runtime behavior.
If a conclusion depends on an assumption, state the assumption.
</grounding_rules>
```

## `action_safety` block

```xml
<action_safety>
Only modify files directly related to the task.
Do not refactor, rename, or restructure code outside the stated scope.
If you notice a related issue, note it but do not fix it.
</action_safety>
```
