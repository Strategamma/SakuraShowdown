import test from "node:test";
import assert from "node:assert/strict";
import { chooseAiMove, listLegalMoves } from "../dist/index.js";

const config = {
  rulePackVersion: "sakura.v1.0.0",
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
    { id: "forward", name: "Forward", moves: [{ x: 0, y: 1 }] },
    { id: "side", name: "Side", moves: [{ x: 1, y: 0 }] },
    { id: "back", name: "Back", moves: [{ x: 0, y: -1 }] }
  ],
  deck: ["forward", "side", "back"],
  handSize: 1,
  mechanics: [
    { id: "swap_with_pool" },
    { id: "win_capture_piece", params: { pieceTypeId: "master" } },
    { id: "win_reach_temple", params: { pieceTypeId: "master" } }
  ]
};

function state(pieces, hand = ["forward"], poolCard = "side") {
  return {
    turn: 8,
    activePlayerId: "p2",
    pieces,
    players: [
      { id: "p1", hand: ["forward"] },
      { id: "p2", hand }
    ],
    poolCard,
    history: []
  };
}

test("expert takes an immediate master capture", () => {
  const current = state([
    { id: "p2:student:0", typeId: "student", ownerId: "p2", x: 2, y: 2, alive: true },
    { id: "p2:master:0", typeId: "master", ownerId: "p2", x: 0, y: 0, alive: true },
    { id: "p1:master:0", typeId: "master", ownerId: "p1", x: 2, y: 3, alive: true }
  ]);
  const move = chooseAiMove(listLegalMoves(current, config), current, config, "expert");
  assert.equal(move?.pieceId, "p2:student:0");
  assert.deepEqual(move?.to, { x: 2, y: 3 });
});

test("expert takes an immediate temple victory", () => {
  const current = state([
    { id: "p2:master:0", typeId: "master", ownerId: "p2", x: 2, y: 3, alive: true },
    { id: "p1:master:0", typeId: "master", ownerId: "p1", x: 4, y: 0, alive: true }
  ]);
  const move = chooseAiMove(listLegalMoves(current, config), current, config, "expert");
  assert.equal(move?.pieceId, "p2:master:0");
  assert.deepEqual(move?.to, { x: 2, y: 4 });
});

test("expert answers an immediate threat to its master", () => {
  const current = state([
    { id: "p2:master:0", typeId: "master", ownerId: "p2", x: 2, y: 3, alive: true },
    { id: "p2:student:0", typeId: "student", ownerId: "p2", x: 0, y: 1, alive: true },
    { id: "p1:student:0", typeId: "student", ownerId: "p1", x: 2, y: 4, alive: true },
    { id: "p1:master:0", typeId: "master", ownerId: "p1", x: 4, y: 0, alive: true }
  ], ["forward", "side"], "back");
  const move = chooseAiMove(listLegalMoves(current, config), current, config, "expert");
  assert.equal(move?.pieceId, "p2:master:0");
});

test("standard answers an immediate threat instead of making a random blunder", () => {
  const current = state([
    { id: "p2:master:0", typeId: "master", ownerId: "p2", x: 2, y: 3, alive: true },
    { id: "p2:student:0", typeId: "student", ownerId: "p2", x: 0, y: 1, alive: true },
    { id: "p1:student:0", typeId: "student", ownerId: "p1", x: 2, y: 4, alive: true },
    { id: "p1:master:0", typeId: "master", ownerId: "p1", x: 4, y: 0, alive: true }
  ], ["forward", "side"], "back");
  const move = chooseAiMove(listLegalMoves(current, config), current, config, "standard");
  assert.equal(move?.pieceId, "p2:master:0");
});
