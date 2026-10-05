# Sakura Showdown

Web-only, Onitama-inspired tactical board game.

## Architecture

- `apps/client`: Vite + TypeScript + Three.js browser client.
- `apps/server`: Express + Colyseus authoritative multiplayer server.
- `packages/rules`: deterministic shared rules/config/network contracts.
- Canonical gameplay config is mirrored in `apps/client/public/game.json` and `apps/server/config/game.json`; parity is tested.

## Game

Two players each control one Master and four Students on a 5×5 board. Two movement cards are held per player and one sits in the pool. A played card swaps with the pool card. Win by capturing the opposing Master or reaching its temple.

## Conventions and constraints

- Keep rule behavior data-driven and deterministic.
- Server is authoritative online; local mode runs through the same shared rules engine.
- Clients and server exchange `rulePackVersion` and deterministic `configHash` values.
- Preserve local play when multiplayer is unavailable.
- Production hides card editing by default; enable via development mode or `?devCardEditor=1`.
- UI uses accessible DOM controls around a Three.js board and exposes `window.render_game_to_text` plus `window.advanceTime` for QA.
- The Three.js renderer is typechecked with version-matched official types, pauses while hidden, and owns explicit GPU/resource cleanup.
- Multiplayer networking is lazy-loaded and production builds enforce gzip budgets for entry, networking, and Three.js chunks.

## Current major state

- Local pass-and-play, online public/private rooms, spectator/rematch flows, custom card creation, 2D/3D views, rotate and zoom controls exist.
- Consumer entry includes first-run onboarding, solo AI, hints, persistent preferences and solo records, protected match exit, install/update UX, and PWA/offline-shell metadata.
- A pre-bootstrap recovery layer reports offline state without blocking local play and provides versioned, privacy-safe diagnostics for unexpected client failures.
- Procedural pieces distinguish Masters and Students.
- Solo AI has three tiers; Standard checks the opponent's reply, while Expert uses time-bounded iterative-deepening minimax with alpha-beta pruning and tactical/temple-aware evaluation.
- The previously configured Koyeb multiplayer endpoint is inactive as of 2026-10-05; online play requires a live replacement endpoint.
