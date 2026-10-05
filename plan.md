# Upgrade plan

**Goal:** Make the current web game reliable, clearer to play, and more polished.

**Scope:** First upgrade slice: local startup/play flow, card editor, workspace build, interaction feedback, palette, transitions, accessibility.

**Approach:** Decouple local config from multiplayer; repair missing styles/scripts; add state-derived guidance and restrained motion; refine existing visual tokens instead of restructuring the app.

**Risks:** Large pre-existing uncommitted changes; online hosting is external; browser automation is restricted on this host.

**Verification:** Rules tests, typecheck, root build, server health, CSS/DOM inspection, prescribed Playwright attempt and available screenshot review.

## Status

First upgrade slice implemented and build/quality verified. Fresh browser visual QA is environment-blocked. Online hosting and lint tooling remain for the next slice.

## Current UI redesign

**Goal:** Replace the cramped, left-weighted gameplay screen with a balanced, premium board-game composition.

**Scope:** Gameplay layout, toolbar hierarchy, board scale, hand/pool cards, active-turn presentation, desktop/tablet/mobile adaptation.

**Approach:** Use a three-zone desktop grid (hands / board / exchange), compute board size from its actual center stage, compact the toolbar, and reduce decorative noise while preserving existing controls and game logic.

**Risks:** Three.js hit coordinates depend on correct canvas sizing; existing browser automation is restricted.

**Verification:** Typecheck/build/rules tests, layout-source review, Playwright attempt, and screenshot inspection where available.
