import http from "node:http";
import express from "express";
import cors from "cors";
import { Server } from "colyseus";
import { Room } from "colyseus";
import { createInitialState, applyMove, listLegalMoves, loadConfig } from "./rules.mjs";

const PORT = Number(process.env.PORT ?? 2567);

class GameRoom extends Room {
  maxClients = 2;
  config;
  stateData;
  playerByClient = new Map();

  onCreate() {
    this.config = loadConfig();
    this.stateData = createInitialState(this.config);

    this.onMessage("move", (client, move) => {
      const playerId = this.playerByClient.get(client.sessionId);
      if (!playerId) return;
      if (this.stateData.winnerId) return;
      if (move.playerId !== playerId) return;

      try {
        this.stateData = applyMove(this.stateData, move, this.config);
        this.broadcast("state", this.stateData);
      } catch {
        client.send("error", { message: "Illegal move." });
      }
    });

    this.onMessage("request_legal_moves", (client) => {
      const playerId = this.playerByClient.get(client.sessionId);
      if (!playerId) return;
      if (this.stateData.activePlayerId !== playerId) return;
      const moves = listLegalMoves(this.stateData, this.config);
      client.send("legal_moves", moves);
    });
  }

  onJoin(client) {
    const assigned = this.config.players[this.clients.length - 1]?.id;
    if (assigned) this.playerByClient.set(client.sessionId, assigned);

    client.send("player", { playerId: assigned });
    client.send("config", this.config);
    client.send("state", this.stateData);
  }

  onLeave(client) {
    this.playerByClient.delete(client.sessionId);
  }
}

const app = express();
app.use(cors());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/config", (_req, res) => {
  try {
    const config = loadConfig();
    res.json(config);
  } catch {
    res.status(500).json({ error: "Failed to load config." });
  }
});

const server = http.createServer(app);
const gameServer = new Server({ server });

gameServer.define("onitama", GameRoom);

gameServer.listen(PORT);
console.log(`Game server listening on ws/http://localhost:${PORT}`);
