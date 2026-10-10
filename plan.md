# Goal
Restore board readability and character appeal while making overlapping-card moves self-explanatory.

# Scope
- Brighten the board and figure materials without losing the Decadence twilight mood.
- Orient teams toward each other and add subtle pose variation among Disciples.
- Make the two-valid-cards state explicitly ask which card moves to the Pool.
- Preserve team recognition, picking, movement animation, and mobile performance.

# Approach
- Raise woven-tile midtones, warm the lacquer frame, and rebalance ambient/key lighting.
- Store a stable base facing angle per figure and layer movement spins over it.
- Add a persistent choice banner plus an on-card “Discard to Pool” badge for overlap decisions.

# Risks
- Piece facing must remain correct after board flip, rotation, capture, and animated moves.
- Brighter materials must retain red/blue contrast and readable highlights.
- Choice guidance must not imply that both cards are lost or change rules behavior.
- Browser screenshot verification remains dependent on the unavailable Chromium runtime.

# Verification
- Verify initial facing, movement/capture rotation, selection/check rings, and overlap-card accessibility labels.
- Run the required Playwright gameplay flow when launch succeeds.
- Run tests, typechecks, production build, bundle budgets, and diff checks.
