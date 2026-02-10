# Onitama-like

Production-ready, data-driven board game foundation inspired by Onitama.

## Quick start (local dev)

1. Install dependencies

```bash
npm install
```

2. Start server

```bash
npm run dev:server
```

3. Start client (new terminal)

```bash
npm run dev
```

Client runs at `http://localhost:5173` and server at `http://localhost:2567`.

## Public hosting (GitHub Pages)

This repo includes a GitHub Actions workflow that builds and deploys the client to GitHub Pages.

Steps:

1. Create a GitHub repo and push this project to the `main` branch.
2. In GitHub, go to Settings → Pages.
3. Under “Build and deployment”, set Source to “GitHub Actions”.
4. Push any commit to `main`. The site will deploy automatically.

Your site URL will be:

```
https://<your-username>.github.io/<repo-name>/
```

The game config is loaded from `/game.json`, so changes to:

`/Users/farzan/Documents/Codex/apps/client/public/game.json`

will be picked up after redeploying.

## Config-first game logic

All rules, cards, and board settings are defined in JSON. The server reads:

`/Users/farzan/Documents/Codex/apps/server/config/game.json`

You can override it with:

```bash
GAME_CONFIG_PATH=/absolute/path/to/game.json npm run dev:server
```

The client reads configuration from the server at `/config`.

For GitHub Pages hosting, the client reads `/game.json` instead (in `apps/client/public`).

### Editable values

- Board size
- Player orientation + temples
- Piece types + starting positions
- Card definitions (movement offsets)
- Deck composition + hand size
- Mechanics list (rule hooks)

## Adding new mechanics

Mechanics are pluggable rule hooks. Add a new mechanic implementation in:

`/Users/farzan/Documents/Codex/packages/rules/src/mechanics.ts`

Then reference it in `game.json` under `mechanics`:

```json
{ "id": "your_mechanic_id", "params": { "yourParam": 123 } }
```

Available hooks:

- `modifyMoves` (filter or transform legal moves)
- `afterMove` (apply state changes after a move)
- `checkWinner` (custom win conditions)

## Production path (no rebuild required)

The frontend is already PWA-friendly. If you later want App Store / Play Store builds,
add Capacitor without rebuilding the core game or rules engine.

## Notes

- This project avoids copying Onitama art/names. You can swap in original assets and card names.
- The server is authoritative for multiplayer, but anti-cheat is intentionally omitted for now.
