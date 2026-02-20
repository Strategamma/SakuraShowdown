import test from "node:test";
import assert from "node:assert/strict";
import { applyMove, createInitialState, listLegalMoves } from "../dist/index.js";

const baseConfig = {
  board: { width: 5, height: 5 },
  players: [
    { id: "p1", name: "Red", forward: -1, temple: { x: 2, y: 4 } },
    { id: "p2", name: "Blue", forward: 1, temple: { x: 2, y: 0 } }
  ],
  pieceTypes: [
    { id: "master", name: "Master", tag: "king" },
    { id: "student", name: "Student" }
  ],
  startingPieces: [],
  cards: [
    { id: "step", name: "Step", moves: [{ x: 0, y: 1 }] },
    { id: "side", name: "Side", moves: [{ x: 1, y: 0 }] }
  ],
  deck: ["step", "side", "step", "side", "step"],
  handSize: 1,
  mechanics: [
    { id: "swap_with_pool" },
    { id: "win_capture_piece", params: { pieceTypeId: "master" } },
    { id: "win_reach_temple", params: { pieceTypeId: "master" } }
  ]
};

function makeState(pieces, poolCard = "side") {
  return {
    turn: 1,
    activePlayerId: "p1",
    pieces,
    players: [
      { id: "p1", hand: ["step"] },
      { id: "p2", hand: ["step"] }
    ],
    poolCard,
    history: []
  };
}

test("capture removes enemy piece", () => {
  const config = {
    ...baseConfig,
    startingPieces: [
      { typeId: "student", ownerId: "p1", x: 2, y: 4 },
      { typeId: "student", ownerId: "p2", x: 2, y: 3 },
      { typeId: "master", ownerId: "p1", x: 0, y: 4 },
      { typeId: "master", ownerId: "p2", x: 0, y: 0 }
    ]
  };
  const state = makeState([
    { id: "p1:student:0", typeId: "student", ownerId: "p1", x: 2, y: 4, alive: true },
    { id: "p2:student:0", typeId: "student", ownerId: "p2", x: 2, y: 3, alive: true },
    { id: "p1:master:0", typeId: "master", ownerId: "p1", x: 0, y: 4, alive: true },
    { id: "p2:master:0", typeId: "master", ownerId: "p2", x: 0, y: 0, alive: true }
  ]);
  const next = applyMove(state, { playerId: "p1", pieceId: "p1:student:0", cardId: "step", to: { x: 2, y: 3 } }, config);
  const captured = next.pieces.find((p) => p.id === "p2:student:0");
  assert.equal(captured?.alive, false);
  assert.equal(next.winnerId, undefined);
});

test("capturing master ends the game", () => {
  const config = {
    ...baseConfig,
    startingPieces: [
      { typeId: "student", ownerId: "p1", x: 2, y: 4 },
      { typeId: "master", ownerId: "p2", x: 2, y: 3 }
    ]
  };
  const state = makeState([
    { id: "p1:student:0", typeId: "student", ownerId: "p1", x: 2, y: 4, alive: true },
    { id: "p2:master:0", typeId: "master", ownerId: "p2", x: 2, y: 3, alive: true }
  ]);
  const next = applyMove(state, { playerId: "p1", pieceId: "p1:student:0", cardId: "step", to: { x: 2, y: 3 } }, config);
  assert.equal(next.winnerId, "p1");
});

test("reaching temple ends the game", () => {
  const config = {
    ...baseConfig,
    startingPieces: [{ typeId: "master", ownerId: "p1", x: 2, y: 1 }]
  };
  const state = makeState([
    { id: "p1:master:0", typeId: "master", ownerId: "p1", x: 2, y: 1, alive: true }
  ]);
  const next = applyMove(state, { playerId: "p1", pieceId: "p1:master:0", cardId: "step", to: { x: 2, y: 0 } }, config);
  assert.equal(next.winnerId, "p1");
});

test("swap with pool after move", () => {
  const config = {
    ...baseConfig,
    startingPieces: [{ typeId: "student", ownerId: "p1", x: 2, y: 4 }]
  };
  const state = makeState([
    { id: "p1:student:0", typeId: "student", ownerId: "p1", x: 2, y: 4, alive: true }
  ], "side");
  const next = applyMove(state, { playerId: "p1", pieceId: "p1:student:0", cardId: "step", to: { x: 2, y: 3 } }, config);
  assert.deepEqual(next.players.find((p) => p.id === "p1")?.hand, ["side"]);
  assert.equal(next.poolCard, "step");
});

test("legal moves exclude moving onto own piece", () => {
  const config = {
    ...baseConfig,
    startingPieces: [
      { typeId: "student", ownerId: "p1", x: 2, y: 4 },
      { typeId: "student", ownerId: "p1", x: 2, y: 3 }
    ]
  };
  const state = makeState([
    { id: "p1:student:0", typeId: "student", ownerId: "p1", x: 2, y: 4, alive: true },
    { id: "p1:student:1", typeId: "student", ownerId: "p1", x: 2, y: 3, alive: true }
  ]);
  const moves = listLegalMoves(state, config);
  const blockedMove = moves.find(
    (move) => move.pieceId === "p1:student:0" && move.to.x === 2 && move.to.y === 3
  );
  assert.equal(blockedMove, undefined);
});

test("illegal moves throw", () => {
  const config = {
    ...baseConfig,
    startingPieces: [{ typeId: "student", ownerId: "p1", x: 2, y: 4 }]
  };
  const state = makeState([
    { id: "p1:student:0", typeId: "student", ownerId: "p1", x: 2, y: 4, alive: true }
  ]);
  assert.throws(() =>
    applyMove(state, { playerId: "p1", pieceId: "p1:student:0", cardId: "step", to: { x: 2, y: 2 } }, config)
  );
});

test("initial state validates deck size", () => {
  const badConfig = { ...baseConfig, deck: ["step"], startingPieces: [] };
  assert.throws(() => createInitialState(badConfig));
});
