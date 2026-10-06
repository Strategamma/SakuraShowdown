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

## 9.5 reliability milestone 1

**Goal:** Make startup and unexpected client failures understandable and recoverable.

**Scope:** Pre-bootstrap error recovery, offline status, build identity, and safe diagnostics.

**Approach:** Load a small recovery module before the game entrypoint; preserve local play while offline and expose only non-personal diagnostic fields.

**Risks:** Error handling must not depend on the main application successfully loading or mislabel ordinary offline play as a crash.

**Verification:** Full quality/build gates, served-markup smoke check, offline/error source review, and prescribed Playwright attempt.

## 9.5 renderer milestone

**Goal:** Make the board renderer type-safe, lifecycle-aware, and dependable across long sessions.

**Scope:** Three.js typing, animation-loop suspension, GPU cleanup, and page teardown.

**Approach:** Replace the local `any` shim with matching official types, include the renderer in normal typechecks, and give created resources explicit ownership and disposal.

**Risks:** Shared model/texture resources must not be disposed while still in use; background-tab suspension must resume exactly one loop.

**Verification:** Renderer typecheck, full quality/build gates, resource-lifecycle source review, and prescribed browser attempt.

## 9.5 expert AI milestone

**Goal:** Make Expert anticipate replies, convert winning tactics, and avoid elementary losses.

**Scope:** Shared AI search/evaluation, difficulty behavior, performance budget, and tactical regression tests.

**Approach:** Use iterative-deepening minimax with alpha-beta pruning, tactical move ordering, transposition caching, and a mobile-safe time limit; keep Beginner intentionally random and Standard shallow.

**Risks:** Search must remain responsive at high branching factors and must evaluate card exchange, Master safety, and both victory conditions from the correct player perspective.

**Verification:** Forced capture, temple-win, and immediate-threat tests plus full quality/build gates and prescribed browser attempt.

## 9.5 initial-load milestone

**Goal:** Reduce what local players download initially and prevent bundle regressions.

**Scope:** Multiplayer code splitting, stable vendor boundaries, and automated JavaScript budgets.

**Approach:** Dynamically import networking only when an online action begins, isolate Three.js as a cacheable vendor chunk, and fail production builds when gzip budgets are exceeded.

**Risks:** Dynamic loading must preserve connect/create/reconnect behavior and type safety.

**Verification:** Client typecheck, production chunk inspection/budgets, full quality gate, and prescribed browser attempt.

## 9.5 open-board milestone

**Goal:** Turn the board into the dominant play surface and reclaim space lost to nested framing and conservative camera margins.

**Scope:** Center-column allocation, canvas sizing, camera fit, default zoom, selection feedback, and phone overrides.

**Approach:** Let the canvas fill the entire rectangular stage, tighten side rails and camera margins, remove duplicated borders/backgrounds, and retain interaction state through ambient glow.

**Risks:** Raycasting and renderer aspect must remain aligned after rectangular resizing; maximum zoom must remain intentionally user-controlled.

**Verification:** Responsive source audit, typecheck/full build, gameplay tests, and prescribed browser attempt.

## 9.5 phone composition milestone

**Goal:** Make the phone board dominant and every action comfortably tappable without crowded controls.

**Scope:** Phone content order, header height, action dock, board zoom, board overlays, hand/pool density, and extra-small widths.

**Approach:** Lead with the board, place the active hand next, demote opponent/pool information, reduce redundant labels, and use a fixed equal-column action dock with safe-area clearance.

**Risks:** Pass-and-play must still expose both hands clearly; fixed actions must never cover scrollable game content.

**Verification:** 320–520px source audit, full quality/build gates, and prescribed browser attempt.

## 9.5 mobile board gestures

**Goal:** Make the expanded phone board controllable without restoring a cramped row of desktop controls.

**Scope:** Pinch zoom, touch gesture arbitration, scroll compatibility, and accidental-tap prevention.

**Approach:** Track two touch pointers inside the renderer, map their distance to bounded camera zoom, preserve one-finger page scrolling, and suppress click resolution after any pinch.

**Risks:** Pointer capture must release cleanly and a pinch must never execute the final finger-up as a board move.

**Verification:** Renderer typecheck, gesture source audit, full quality/build gates, and prescribed browser attempt.

## 9.5 board control hierarchy

**Goal:** Decongest the match header while keeping board tools close to the surface they manipulate.

**Scope:** Board controls, hint placement, header actions, and phone/landscape breakpoints.

**Approach:** Move rotate, zoom, and view controls into a compact bar below the canvas; float an accessible icon-only hint action at the board's top-right; retain match actions and status in the header.

**Risks:** Existing mobile rules must not hide the relocated controls, and the added control row must not make the canvas unusably short in landscape.

**Verification:** Responsive source audit, full quality/build gates, and prescribed browser attempt.

## 9.5 actionable hints

**Goal:** Turn Hint into clear, ranked guidance the player can act on immediately.

**Scope:** Move ranking, board markers, card highlighting, and hinted-move interaction.

**Approach:** Rank two distinct destinations, preselect the leading move, number both board targets and their cards, and let either numbered target execute its exact suggested move.

**Risks:** Suggestions may use different pieces/cards; tapping a marker must execute the matching full move without leaving stale hint state.

**Verification:** Typecheck/build, rules regression suite, source-level interaction audit, and prescribed browser attempt.

## 9.5 mobile-first final pass

**Goal:** Make phone gameplay feel intentionally composed rather than a compressed desktop interface.

**Scope:** Phone header, board sizing, board controls, touch targets, cards, fixed match actions, setup overlays, and short landscape.

**Approach:** Consolidate conflicting phone overrides, reserve the top bar for live status, keep a visible compact zoom track, and validate the complete flow at 320–430px before tuning dense overlays.

**Risks:** Fixed actions must not cover content; additional board controls must not reduce the playable surface or create horizontal overflow.

**Verification:** Responsive source audit, client typecheck/build, gameplay tests, overflow checks, and prescribed browser attempt.
