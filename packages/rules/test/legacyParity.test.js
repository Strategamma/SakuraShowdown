import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyMove, createInitialState, listLegalMoves, validateConfig } from "../dist/index.js";

// Resolve paths from this test file so the check is stable regardless of current working directory.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

const LEGACY_SERVER_CONFIG_PATH = path.join(repoRoot, "apps/server/config/game.json");
const LEGACY_WEB_CONFIG_PATH = path.join(repoRoot, "apps/client/public/game.json");

function loadConfig(configPath) {
  // Validate every fixture through the shared schema so parity checks only run on valid game configs.
  const raw = fs.readFileSync(configPath, "utf-8");
  return validateConfig(JSON.parse(raw));
}

function stableNormalize(value) {
  // Deterministic normalization lets us compare JSON semantically without depending on key order.
  if (Array.isArray(value)) {
    return value.map((entry) => stableNormalize(entry));
  }
  if (value && typeof value === "object") {
    const sortedEntries = Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => [key, stableNormalize(nested)]);
    return Object.fromEntries(sortedEntries);
  }
  return value;
}

function stableJson(value) {
  // Shared serializer keeps assertion output readable and consistent across environments.
  return JSON.stringify(stableNormalize(value));
}

function summarizeMoves(moves) {
  // Sort moves into a canonical order so move-list comparisons are deterministic.
  return moves
    .map((move) => ({
      playerId: move.playerId,
      pieceId: move.pieceId,
      cardId: move.cardId,
      to: { x: move.to.x, y: move.to.y },
      capture: Boolean(move.capture)
    }))
    .sort((a, b) =>
      `${a.playerId}|${a.pieceId}|${a.cardId}|${a.to.x},${a.to.y}`.localeCompare(
        `${b.playerId}|${b.pieceId}|${b.cardId}|${b.to.x},${b.to.y}`
      )
    );
}

function summarizeState(state) {
  // Keep only rule-relevant fields in a sorted structure for precise, low-noise state comparison.
  return {
    turn: state.turn,
    activePlayerId: state.activePlayerId,
    winnerId: state.winnerId,
    poolCard: state.poolCard,
    pieces: state.pieces
      .map((piece) => ({
        id: piece.id,
        ownerId: piece.ownerId,
        typeId: piece.typeId,
        x: piece.x,
        y: piece.y,
        alive: piece.alive
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    players: state.players
      .map((player) => ({
        id: player.id,
        hand: [...player.hand]
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    history: state.history.map((move) => ({
      playerId: move.playerId,
      pieceId: move.pieceId,
      cardId: move.cardId,
      to: { x: move.to.x, y: move.to.y }
    }))
  };
}

function sameMove(a, b) {
  // Move equality for cross-config matching.
  return (
    a.playerId === b.playerId &&
    a.pieceId === b.pieceId &&
    a.cardId === b.cardId &&
    a.to.x === b.to.x &&
    a.to.y === b.to.y
  );
}

function pickDeterministicMove(moves) {
  // Fixed move selection makes parity simulation reproducible while still exercising real rules.
  const ordered = summarizeMoves(moves);
  const first = ordered[0];
  if (!first) return undefined;
  return moves.find((move) => sameMove(move, first));
}

const legacyServerConfig = loadConfig(LEGACY_SERVER_CONFIG_PATH);
const webClientConfig = loadConfig(LEGACY_WEB_CONFIG_PATH);

test("web client config stays identical to server config", () => {
  // Keep web and server rule definitions in lockstep so local/dev/prod behavior stays deterministic.
  assert.equal(
    stableJson(webClientConfig),
    stableJson(legacyServerConfig),
    "Web client config diverged from server config."
  );
});

test("web and server rules match runtime behavior across seeded simulations", () => {
  // Run multiple seeded games and compare every state transition + legal move set turn by turn.
  for (let seed = 1; seed <= 40; seed += 1) {
    let legacyState = createInitialState(legacyServerConfig, seed);
    let webState = createInitialState(webClientConfig, seed);

    for (let ply = 0; ply < 80; ply += 1) {
      assert.deepEqual(
        summarizeState(webState),
        summarizeState(legacyState),
        `State mismatch before move at seed=${seed}, ply=${ply}.`
      );

      const legacyMoves = listLegalMoves(legacyState, legacyServerConfig);
      const webMoves = listLegalMoves(webState, webClientConfig);

      assert.deepEqual(
        summarizeMoves(webMoves),
        summarizeMoves(legacyMoves),
        `Legal move mismatch at seed=${seed}, ply=${ply}.`
      );

      const chosenLegacyMove = pickDeterministicMove(legacyMoves);
      if (!chosenLegacyMove) break;

      const matchingWebMove = webMoves.find((move) => sameMove(move, chosenLegacyMove));
      assert.ok(matchingWebMove, `Missing mirrored move at seed=${seed}, ply=${ply}.`);

      legacyState = applyMove(legacyState, chosenLegacyMove, legacyServerConfig);
      webState = applyMove(webState, matchingWebMove, webClientConfig);

      if (legacyState.winnerId || webState.winnerId) {
        assert.equal(
          webState.winnerId,
          legacyState.winnerId,
          `Winner mismatch at seed=${seed}, ply=${ply}.`
        );
        break;
      }
    }
  }
});
