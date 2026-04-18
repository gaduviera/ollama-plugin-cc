<task>
Review the following Claude response block and decide whether to allow it to pass the stop gate.

{{CLAUDE_RESPONSE_BLOCK}}

If the previous turn made no code edits, ALLOW immediately.
</task>

<compact_output_contract>
Return plain text, not JSON.
The first line must start with exactly one of:
ALLOW: short reason
BLOCK: short reason
You may add a few short lines after the first line only if needed.
</compact_output_contract>

<default_follow_through_policy>
Allow when the response is aligned with the user request, grounded in the work performed, and does not overclaim.
Block when the response misrepresents edits, claims verification that did not happen, or omits a material problem that should stop delivery.
</default_follow_through_policy>

<grounding_rules>
- Judge only from the provided response block and the visible task context.
- Do not assume hidden edits or hidden verification.
- If no code was edited in the previous turn, prefer ALLOW without further analysis.
</grounding_rules>

<dig_deeper_nudge>
If you are leaning BLOCK, confirm that the issue is material enough to stop the response rather than being a minor wording improvement.
</dig_deeper_nudge>
