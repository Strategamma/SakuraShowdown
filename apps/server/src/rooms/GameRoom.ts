import { Room, Client } from "colyseus";
import { applyMove, createInitialState, listLegalMoves } from "@game/rules";
import type { GameConfig, GameState, Move } from "@game/rules";
import { loadConfig } from "../config";

export class GameRoom extends Room {
  maxClients = 2;
  private config!: GameConfig;
  private stateData!: GameState;
  private playerByClient = new Map<string, string>();

  onCreate() {
    this.config = loadConfig();
    this.stateData = createInitialState(this.config);

    this.onMessage("move", (client, move: Move) => {
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

  onJoin(client: Client) {
    const assigned = this.config.players[this.clients.length - 1]?.id;
    if (assigned) this.playerByClient.set(client.sessionId, assigned);

    client.send("player", { playerId: assigned });
    client.send("config", this.config);
    client.send("state", this.stateData);
  }

  onLeave(client: Client) {
    this.playerByClient.delete(client.sessionId);
  }
}
