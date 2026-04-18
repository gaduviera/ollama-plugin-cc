# Ollama Prompt Recipes

## 1. Debugging a failing test

```xml
<task>
  <description>Fix the failing test shown below.</description>
  <context>
    Test output: TEST_OUTPUT_PLACEHOLDER
    File path: FILE_PATH_PLACEHOLDER
  </context>
</task>
<completeness_contract>
The fix is complete when the failing test passes and no other tests are broken.
</completeness_contract>
<verification_loop>
After fixing, re-read the changed file and confirm the logic matches the test expectation.
</verification_loop>
<action_safety>
Only modify files required to fix the failing test.
Do not refactor surrounding code.
</action_safety>
```

## 2. Implementing a small feature

```xml
<task>
  <description>Implement this feature: FEATURE_DESCRIPTION</description>
  <context>Reference file: REFERENCE_FILE_PLACEHOLDER</context>
</task>
<default_follow_through_policy>
Use the existing code style.
Do not introduce new dependencies.
If a design decision is ambiguous, pick the simpler option.
</default_follow_through_policy>
<action_safety>
Only create or modify files needed for this feature.
Do not touch unrelated code.
</action_safety>
```

## 3. Diagnosing an error (read-only)

```xml
<task>
  <description>Diagnose this error without making changes.</description>
  <context>ERROR_OUTPUT_PLACEHOLDER</context>
</task>
<compact_output_contract>
CAUSE
LOCATION
FIX
</compact_output_contract>
<grounding_rules>
Ground the diagnosis in the error output and repo context.
Do not speculate about causes with no evidence.
</grounding_rules>
```
