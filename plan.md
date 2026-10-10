# Goal
Make the five-card deck picker bright, legible, and inviting without breaking the Decadence × dojo language.

# Scope
- Separate the parchment card-selection surface from the dark application shell.
- Strengthen card names, movement grids, selected order, disabled state, and the sticky action bar.
- Preserve the existing selection behavior and phone grid.

# Approach
- Treat the modal body as a lit dojo deck table with ivory cards and dark readable ink.
- Keep the header/footer dark for Decadence continuity and use amber/coral depth on the primary action.
- Use jade selection borders and numbered seals that remain obvious without animation.

# Risks
- Global button/card rules currently cascade into draft tiles and must be overridden only inside this modal.
- Selected and unavailable cards must remain distinguishable in high-contrast and reduced-motion modes.
- Browser screenshot verification remains dependent on the unavailable Chromium runtime.

# Verification
- Verify card names, patterns, selection order, five-card cap, disabled Start state, and responsive grid.
- Run the required Playwright draft flow when launch succeeds.
- Run tests, typechecks, production build, bundle budgets, and diff checks.
