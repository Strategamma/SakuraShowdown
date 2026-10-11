# Goal
Make a win feel memorable and give the winner a result worth sharing.

# Scope
- Give Master captures and temple wins distinct result headlines and visual treatment.
- Add a winner-only share action, preserving the existing rematch and session score flow.

# Approach
- Derive the finish from the final board position and show winner identity beneath the headline.
- Share a compact text result through native sharing or clipboard fallback.

# Risks
- Do not celebrate an opponent's win from the loser's device or expose room codes in shared text.
- Keep the result usable on small screens and with reduced motion.

# Verification
- Check both win conditions, winner/loser/spectator copy, share fallback, and rematch state.
- Run the prescribed game client, lint, tests, typecheck, build, and diff checks.
