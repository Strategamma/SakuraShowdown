Original prompt: Target all UI issues on the gameplay page and landing page, add a wallpaper background, and add + / - zoom controls for the board.

- Initialized progress tracking.
- Added zoom controls in toolbar (+/-), wired to renderer.
- Added renderer zoom support (clamped) and camera fit adjustment.
- Added deterministic hooks: window.render_game_to_text + window.advanceTime.
- Added extra padding and zoom button styling.
- Added zoom slider + percent label in toolbar; wired to renderer get/set zoom.
- Reworked card rail sizing: min-height tied to card grid, larger readable cards, rails padded.
- Updated board sizing to use available console space and derive card grid size from board size.
- Mobile layout now stacks pool under player cards and scales card grid for smaller screens.
- Focus start-random button when local start overlay opens (helps automated testing start match).
- Lowered zoom minimum to 50% and updated slider min accordingly.
- Landing overlay layout reworked: full-width tabs, two-column online panel (public/private) with responsive stack, larger lobby list.
- Removed floating sakura blossoms from board decoration.
- Fixed card pattern orientation by flipping Y like X (aligns with board move resolution).
