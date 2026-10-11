import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { Client } from "colyseus.js";
import { getRulePackMetadata } from "@game/rules";

const port = 28000 + Math.floor(Math.random() * 10000);
const endpoint = `http://127.0.0.1:${port}`;
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
  startingPieces: [
    { typeId: "student", ownerId: "p1", x: 2, y: 4 },
    { typeId: "master", ownerId: "p1", x: 0, y: 4 },
    { typeId: "master", ownerId: "p2", x: 2, y: 3 }
  ],
  cards: [{ id: "step", name: "Step", moves: [{ x: 0, y: 1 }] }],
  deck: ["step", "step", "step", "step", "step"],
  handSize: 2,
  mechanics: [
    { id: "swap_with_pool" },
    { id: "win_capture_piece", params: { pieceTypeId: "master" } },
    { id: "win_reach_temple", params: { pieceTypeId: "master" } }
  ]
};

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(read, label, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await read();
    if (value) return value;
    await pause(20);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function main() {
  const server = spawn(process.execPath, ["apps/server/index.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1" },
    stdio: "ignore"
  });
  let first;
  let second;
  try {
    await waitFor(async () => {
      try { return (await fetch(`${endpoint}/health`)).ok; } catch { return false; }
    }, "server startup", 5000);

    const rulePack = getRulePackMetadata(config);
    const joinOptions = {
      expectedRulePackVersion: rulePack.rulePackVersion,
      expectedConfigHash: rulePack.configHash
    };
    const client = new Client(endpoint.replace("http:", "ws:"));
    first = await client.create("onitama", { ...joinOptions, private: true, config, name: "A" });
    second = await client.joinById(first.roomId, { ...joinOptions, name: "B" });

    const events = { first: [], second: [] };
    for (const [key, room] of [["first", first], ["second", second]]) {
      for (const type of ["state", "session_score", "rematch_pending", "rematch_cancelled", "rematch_start", "game_start", "error"]) {
        room.onMessage(type, (payload) => events[key].push({ type, payload }));
      }
    }
    const count = (key, type) => events[key].filter((event) => event.type === type).length;
    const last = (key, type) => events[key].filter((event) => event.type === type).at(-1)?.payload;

    first.send("ready", { ready: true });
    second.send("ready", { ready: true });
    await waitFor(() => count("first", "game_start"), "both players ready");

    const win = () => first.send("move", {
      playerId: "p1",
      pieceId: "p1:student:0",
      cardId: "step",
      to: { x: 2, y: 3 }
    });
    win();
    await waitFor(() => last("second", "session_score")?.wins?.p1 === 1, "first session win");
    assert.equal(last("first", "state")?.winnerId, "p1");

    first.send("rematch_request");
    await waitFor(() => last("second", "rematch_pending")?.name === "A", "opponent invitation");
    second.send("rematch_cancel");
    await waitFor(() => last("first", "rematch_cancelled")?.reason === "declined", "decline response");

    first.send("rematch_request");
    await waitFor(() => count("second", "rematch_pending") === 2, "second invitation");
    second.send("rematch_request");
    await waitFor(() => count("first", "rematch_start") === 1 && count("second", "rematch_start") === 1, "accepted rematch");
    assert.equal(last("first", "state")?.winnerId, undefined);

    win();
    await waitFor(() => last("first", "session_score")?.wins?.p1 === 2 && last("second", "session_score")?.wins?.p1 === 2, "persistent session score");
    assert.equal(count("first", "error"), 0);
    assert.equal(count("second", "error"), 0);
    console.log("Rematch smoke passed: invite, decline, accept, and persistent session wins.");
  } finally {
    await Promise.allSettled([first?.leave(), second?.leave()]);
    server.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
