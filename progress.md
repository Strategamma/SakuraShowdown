Original prompt: Target all UI issues on the gameplay page and landing page, add a wallpaper background, and add + / - zoom controls for the board.

- Initialized progress tracking.
- Added zoom controls in toolbar (+/-), wired to renderer.
- Added renderer zoom support (clamped) and camera fit adjustment.
- Added deterministic hooks: window.render_game_to_text + window.advanceTime.
- Added extra padding and zoom button styling.
