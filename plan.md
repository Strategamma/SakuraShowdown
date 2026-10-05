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

## Interaction polish

**Goal:** Make each turn feel responsive and self-explanatory without changing the rules.

**Scope:** Turn transitions, selection feedback, invalid-action feedback, keyboard clearing, card affordances, and side-panel balance.

**Approach:** Reuse the renderer's piece/card motion, add lightweight DOM feedback around it, and derive all guidance from the current selection state.

**Risks:** Repeated state renders can restart transient effects; mobile overlays must not obscure board input.

**Verification:** Rules/type checks, production build, responsive source review, and the prescribed browser test attempt.

## Consumer readiness programme

**Goal:** Make Sakura Showdown understandable, enjoyable, installable, and dependable for players who arrive without prior rules knowledge or an available opponent.

**Scope:** Onboarding, solo AI, settings/accessibility, PWA, multiplayer reliability/matchmaking, profiles/statistics, replays/sharing, and production safeguards.

**Approach:** Ship in dependency order: consumer entry and solo play first; online infrastructure second; durable identity/history and sharing third; production analytics, policies, and moderation last.

**Risks:** Online features require a live authoritative server; account sync requires a storage/authentication decision; automated browser QA remains restricted on this host.

**Verification:** Pure rules/AI checks where possible, workspace quality gate and production build each phase, browser interaction and responsive checks when the host permits Chromium.

## Full UI state audit

**Goal:** Make every modal and setup flow usable and visually consistent across desktop and mobile, with priority on Choose 5 Cards.

**Scope:** Landing/rules, new-game setup, draft, editor, victory, tutorial, settings, confirmation, spectator, and lobby overlays.

**Approach:** Repair shared overlay sizing/scrolling first, then give dense task screens their own responsive grids and accessible controls.

**Risks:** Shared `.card-pattern` phone rules can leak into setup screens; rebuilding draft tiles can lose keyboard focus.

**Verification:** Typecheck, rules/server quality gate, production build, DOM/CSS source audit, and prescribed browser attempt.

## Cohesive interaction polish

**Goal:** Make controls, movement, typography, and feedback feel sleek and immediately understandable.

**Scope:** Global buttons/tooltips, gameplay guidance, movement/capture animation, type hierarchy, and responsive interaction states.

**Approach:** Refine the existing design system and renderer instead of changing rules or page structure; make motion communicate state and respect reduced-motion preferences.

**Risks:** Capture animation must not leave dead pieces interactive; tooltips must not obstruct coarse-pointer/mobile play.

**Verification:** Full quality/build gates, source-level state audit, and prescribed Playwright interaction attempt.
