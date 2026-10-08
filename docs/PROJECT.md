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
- The Three.js renderer pauses while hidden and owns explicit GPU/resource cleanup.
- Multiplayer networking is lazy-loaded and production builds enforce gzip budgets for entry, networking, and Three.js chunks.
- `npm run host:lan` serves the client and server on one LAN origin, with name-based discovery and invite codes. Render never lists private LAN rooms.
- Multiplayer reconnect credentials and private-room context persist locally so a refreshed player can reclaim the same seat within the server's reconnection window.
- Local, Same Wi-Fi, and Internet have separate entry panels. Online boards orient from the assigned player's side.
- The landing layer is the non-dismissible app home for website and PWA launches. Decadence arrivals get a compact introduction and opt-in tutorial; Solo, Same Wi-Fi, Pass & Play, focused setup navigation, and phone install remain immediate.

## Current major state

- Local pass-and-play, online public/private rooms, spectator/rematch flows, custom card creation, 2D/3D views, rotate and zoom controls exist.
- Consumer entry includes a branded app home, first-run onboarding, solo AI, hints, persistent preferences and solo records, protected match exit, install/update UX, and PWA/offline-shell metadata.
- Mobile uses a board-first portrait flow, visible compact zoom controls, safe-area action dock, two-column card selection, pinch zoom, and a dedicated short-landscape composition.
- A pre-bootstrap recovery layer reports offline state without blocking local play and provides versioned, privacy-safe diagnostics for unexpected client failures.
- The installable PWA uses generated 192/512 PNG icons, native install prompts plus iOS guidance, Solo/Together shortcuts, and versioned offline caches that bypass HTTP caches for fresh releases.
- Procedural pieces distinguish Masters and Students.
- Solo AI has three tiers; Standard checks the opponent's reply, while Expert uses time-bounded iterative-deepening minimax with alpha-beta pruning and tactical/temple-aware evaluation.
- Production internet multiplayer uses `wss://sakurashowdown.onrender.com`; `/health` and `/lobby` were live on 2026-10-08. Keep the service single-instance while room state remains in memory.
