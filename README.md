# Sakura Showdown (Onitama-like)

Production-ready, data-driven board game foundation inspired by Onitama.
This repository now contains the web game stack only:

- browser client (`apps/client`)
- multiplayer server (`apps/server`)
- shared rules engine (`packages/rules`)

## Quick start (local development)

1. Install dependencies:

```bash
npm install
```

2. Start the server:

```bash
npm run dev:server
```

3. Start the web client in a second terminal:

```bash
npm run dev
```

Local URLs:

- Client: `http://localhost:5173`
- Server: `http://localhost:2567`

## Workspace structure

- `apps/client`: Three.js web game UI, match flow, card editor UI.
- `apps/server`: Node multiplayer server and config endpoint.
- `packages/rules`: Shared deterministic game logic and contracts.

## Quality checks

Run full local quality gate:

```bash
npm run quality:ci
```

What this runs:

- `npm run quality`:
  - rules build + tests (`packages/rules`)
  - typechecks (`packages/rules`, `apps/server`, `apps/client`)
- `npm run test:server:health`:
  - server health/config contract check (`scripts/server-health-check.mjs`)

Rule-engine tests live in `packages/rules/test`.

## Public hosting (GitHub Pages)

This repo includes a GitHub Actions workflow that builds and deploys the client to GitHub Pages.

Steps:

1. Push this project to `main`.
2. In GitHub, open **Settings -> Pages**.
3. Set **Source** to **GitHub Actions**.
4. Push a commit; deployment runs automatically.

Site URL format:

```text
https://<your-username>.github.io/<repo-name>/
```

Workflow file:

- `/Users/farzan/Documents/Codex/SakuraShowdown/.github/workflows/deploy.yml`

## Config-first game logic

All rules, cards, and board settings are defined in JSON.
Server config path:

- `/Users/farzan/Documents/Codex/SakuraShowdown/apps/server/config/game.json`

Override config at runtime:

```bash
GAME_CONFIG_PATH=/absolute/path/to/game.json npm run dev:server
```

Client config behavior:

- local/dev multiplayer: reads `/config` from the server
- GitHub Pages build: reads static `/game.json` from `apps/client/public`

## Rule-pack compatibility contract

`GameConfig` includes a required `rulePackVersion`.
Server and clients compute deterministic `configHash` values and exchange them at room join.
If values do not match, join is rejected with `RULEPACK_MISMATCH`.

Shared contracts:

- `/Users/farzan/Documents/Codex/SakuraShowdown/packages/rules/src/rulePack.ts`
- `/Users/farzan/Documents/Codex/SakuraShowdown/packages/rules/src/network.ts`

## Customize cards (browser)

Use the **Customize Cards** panel in the client UI to edit card names and movement patterns.
Changes persist to browser storage and apply immediately.
Use **Export JSON** to download config.

Production behavior:

- card customization is hidden by default in production web sessions
- enable in dev with `VITE_ENABLE_DEV_CARD_EDITOR=1` or `?devCardEditor=1`

## 3D assets (optional)

You can replace procedural pieces with custom GLTF models:

- `/Users/farzan/Documents/Codex/SakuraShowdown/apps/client/public/models/master.glb`
- `/Users/farzan/Documents/Codex/SakuraShowdown/apps/client/public/models/student.glb`

Model guidance:

- center at origin
- keep scale around a 1x1x1 volume

## Adding mechanics

Mechanics are pluggable rule hooks.
Add implementations in:

- `/Users/farzan/Documents/Codex/SakuraShowdown/packages/rules/src/mechanics.ts`

Reference mechanics in `game.json`:

```json
{ "id": "your_mechanic_id", "params": { "yourParam": 123 } }
```

Available hooks:

- `modifyMoves`
- `afterMove`
- `checkWinner`

## Notes

- This project avoids copying Onitama art/names.
- The server is authoritative for multiplayer.
- Android-specific app/build assets were removed to keep this repository web-only.
