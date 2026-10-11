# Goal
Unify match dialogs and controls with the Decadence/Sakura style, and make LAN rivalry rewarding and reliable.

# Scope
- Refresh result, exit, settings, lobby, and board controls.
- Add per-room session wins, clear piece ownership, and a two-sided rematch invitation.
- Use Expert move selection for hints and clarify the host/join entry point.

# Approach
- Reuse the menu's amber/coral physical-button language in the match UI.
- Keep score on the room server and broadcast it to both players after each win.
- Keep both players in the result state until a rematch is accepted or they leave.

# Risks
- Win and rematch events may arrive in quick succession; score and prompts must remain synchronized.
- Live parent-site logo cannot be assumed if the site certificate cannot be verified.

# Verification
- Check two-client rematch invitation, decline, acceptance, and score persistence.
- Run lint, tests, typechecks, production build, and responsive browser checks where available.
