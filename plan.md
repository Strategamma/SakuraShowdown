# Upgrade plan

**Goal:** Make the current web game reliable, clearer to play, and more polished.

**Scope:** First upgrade slice: local startup/play flow, card editor, workspace build, interaction feedback, palette, transitions, accessibility.

**Approach:** Decouple local config from multiplayer; repair missing styles/scripts; add state-derived guidance and restrained motion; refine existing visual tokens instead of restructuring the app.

**Risks:** Large pre-existing uncommitted changes; online hosting is external; browser automation is restricted on this host.

**Verification:** Rules tests, typecheck, root build, server health, CSS/DOM inspection, prescribed Playwright attempt and available screenshot review.

## Status

First upgrade slice implemented and build/quality verified. Fresh browser visual QA is environment-blocked. Online hosting and lint tooling remain for the next slice.
