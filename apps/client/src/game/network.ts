import { Client, Room } from "colyseus.js";
import type { GameConfig, GameState, Move } from "@game/rules";

export type OnlineHandlers = {
  onState: (state: GameState) => void;
  onConfig: (config: GameConfig) => void;
  onRoom?: (roomId: string) => void;
  onPlayer: (playerId: string | undefined) => void;
  onError: (message: string) => void;
  onReconnectToken?: (token?: string) => void;
  onNotice?: (message: string) => void;
};

export class OnlineSession {
  private client: Client;
  private room?: Room;
  private handlers: OnlineHandlers;

  constructor(endpoint: string, handlers: OnlineHandlers) {
    this.client = new Client(endpoint);
    this.handlers = handlers;
  }

  async connect(roomId?: string, name?: string, options?: { spectator?: boolean }) {
    try {
      const joinOptions = { ...(options ?? {}) } as { spectator?: boolean; name?: string };
      if (name) joinOptions.name = name;
      this.room = roomId
        ? await this.client.joinById(roomId, joinOptions)
        : await this.client.joinOrCreate("onitama", joinOptions);

      this.handlers.onRoom?.(this.room.id);
      this.room.onMessage("state", (state: GameState) => this.handlers.onState(state));
      this.room.onMessage("config", (config: GameConfig) => this.handlers.onConfig(config));
      this.room.onMessage("player", (payload: { playerId?: string }) =>
        this.handlers.onPlayer(payload.playerId)
      );
      this.room.onMessage("error", (payload: { message: string }) =>
        this.handlers.onError(payload.message)
      );
      this.room.onMessage("player_joined", (payload: { name?: string }) => {
        if (payload?.name) {
          this.handlers.onNotice?.(`${payload.name} joined the room.`);
        }
      });
      this.room.onMessage("spectator_joined", () => {
        this.handlers.onNotice?.("A spectator joined the room.");
      });
      if (name) {
        this.room.send("set_name", { name });
      }
      if (this.room.reconnectionToken) {
        this.handlers.onReconnectToken?.(this.room.reconnectionToken);
      }
    } catch (error) {
      this.handlers.onError("Failed to connect.");
    }
  }

  async reconnect(reconnectToken: string, name?: string) {
    try {
      this.room = await this.client.reconnect(reconnectToken);
      this.handlers.onRoom?.(this.room.id);
      this.room.onMessage("state", (state: GameState) => this.handlers.onState(state));
      this.room.onMessage("config", (config: GameConfig) => this.handlers.onConfig(config));
      this.room.onMessage("player", (payload: { playerId?: string }) =>
        this.handlers.onPlayer(payload.playerId)
      );
      this.room.onMessage("error", (payload: { message: string }) =>
        this.handlers.onError(payload.message)
      );
      this.room.onMessage("player_joined", (payload: { name?: string }) => {
        if (payload?.name) {
          this.handlers.onNotice?.(`${payload.name} joined the room.`);
        }
      });
      this.room.onMessage("spectator_joined", () => {
        this.handlers.onNotice?.("A spectator joined the room.");
      });
      if (name) {
        this.room.send("set_name", { name });
      }
      if (this.room.reconnectionToken) {
        this.handlers.onReconnectToken?.(this.room.reconnectionToken);
      }
    } catch (error) {
      this.handlers.onError("Failed to reconnect.");
      throw error;
    }
  }

  sendMove(move: Move) {
    this.room?.send("move", move);
  }

  requestLegalMoves() {
    this.room?.send("request_legal_moves");
  }

  disconnect() {
    this.room?.leave();
    this.room = undefined;
  }
}
