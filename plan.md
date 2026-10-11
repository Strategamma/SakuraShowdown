# Goal
Keep the rewarding win result while removing its unwanted sharing action.

# Scope
- Remove the share control and supporting code only.
- Preserve finish-specific results, rematch, and session scores.

# Approach
- Delete the share UI, handler, icon, and stale styling/memory references.

# Risks
- Do not disturb the existing victory and rematch flow.

# Verification
- Confirm no share action remains; run targeted typecheck, lint, build, and prescribed game client.
