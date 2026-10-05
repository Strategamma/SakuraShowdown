import test from "node:test";
import assert from "node:assert/strict";
import {
  checkRulePackCompatibility,
  computeConfigHash,
  getRulePackMetadata,
  validateConfig
} from "../dist/index.js";

const sampleConfig = validateConfig({
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
  startingPieces: [
    { typeId: "master", ownerId: "p1", x: 2, y: 4 },
    { typeId: "master", ownerId: "p2", x: 2, y: 0 }
  ],
  cards: [
    { id: "step", name: "Step", moves: [{ x: 0, y: 1 }] },
    { id: "side", name: "Side", moves: [{ x: 1, y: 0 }] },
    { id: "diag", name: "Diag", moves: [{ x: 1, y: 1 }] }
  ],
  deck: ["step", "side", "diag"],
  handSize: 1,
  mechanics: [{ id: "swap_with_pool" }]
});

test("rule pack hash is stable for equivalent object clones", () => {
  const first = computeConfigHash(sampleConfig);
  const second = computeConfigHash(structuredClone(sampleConfig));
  assert.equal(first, second);
});

test("metadata exposes version + hash", () => {
  const metadata = getRulePackMetadata(sampleConfig);
  assert.equal(metadata.rulePackVersion, "sakura.v1.0.0");
  assert.equal(typeof metadata.configHash, "string");
  assert.equal(metadata.configHash.length, 8);
});

test("compatibility rejects mismatched hash", () => {
  const expected = getRulePackMetadata(sampleConfig);
  const result = checkRulePackCompatibility(expected, {
    rulePackVersion: expected.rulePackVersion,
    configHash: "deadbeef"
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "hash_mismatch");
});
