import { Client, Room } from "colyseus.js";
import type { GameConfig, GameState, Move } from "@game/rules";

export type OnlineHandlers = {
  onState: (state: GameState) => void;
  onConfig: (config: GameConfig) => void;
  onRoom?: (roomId: string) => void;
  onRoomInfo?: (info: { roomId: string; code?: string; private?: boolean; started?: boolean }) => void;
  onPlayer: (playerId: string | undefined) => void;
  onError: (message: string) => void;
  onReconnectToken?: (token?: string) => void;
  onNotice?: (message: string) => void;
  onRematchStart?: () => void;
  onRematchCancel?: () => void;
  onLeave?: (code?: number) => void;
  onReadyState?: (payload: { ready: string[]; started: boolean }) => void;
  onGameStart?: () => void;
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
      this.room.onLeave((code) => this.handlers.onLeave?.(code));
      this.room.onMessage("state", (state: GameState) => this.handlers.onState(state));
      this.room.onMessage("config", (config: GameConfig) => this.handlers.onConfig(config));
      this.room.onMessage("player", (payload: { playerId?: string }) =>
        this.handlers.onPlayer(payload.playerId)
      );
      this.room.onMessage(
        "room_info",
        (payload: { roomId: string; code?: string; private?: boolean; started?: boolean }) =>
        this.handlers.onRoomInfo?.(payload)
      );
      this.room.onMessage("error", (payload: { message: string }) =>
        this.handlers.onError(payload.message)
      );
      this.room.onMessage("rematch_start", () => {
        this.handlers.onRematchStart?.();
      });
      this.room.onMessage("rematch_cancelled", () => {
        this.handlers.onRematchCancel?.();
      });
      this.room.onMessage("rematch_pending", (payload: { name?: string }) => {
        if (payload?.name) {
          this.handlers.onNotice?.(`${payload.name} wants a rematch.`);
        } else {
          this.handlers.onNotice?.("Opponent wants a rematch.");
        }
      });
      this.room.onMessage("player_joined", (payload: { name?: string }) => {
        if (payload?.name) {
          this.handlers.onNotice?.(`${payload.name} joined the room.`);
        }
      });
      this.room.onMessage("spectator_joined", () => {
        this.handlers.onNotice?.("A spectator joined the room.");
      });
      this.room.onMessage("ready_state", (payload: { ready: string[]; started: boolean }) => {
        this.handlers.onReadyState?.(payload);
      });
      this.room.onMessage("game_start", () => {
        this.handlers.onGameStart?.();
      });
      if (name) {
        this.room.send("set_name", { name });
      }
      if (this.room.reconnectionToken) {
        this.handlers.onReconnectToken?.(this.room.reconnectionToken);
      }
    } catch (error) {
      this.handlers.onError("Failed to connect.");
      throw error;
    }
  }

  async reconnect(reconnectToken: string, name?: string) {
    try {
      this.room = await this.client.reconnect(reconnectToken);
      this.handlers.onRoom?.(this.room.id);
      this.room.onLeave((code) => this.handlers.onLeave?.(code));
      this.room.onMessage("state", (state: GameState) => this.handlers.onState(state));
      this.room.onMessage("config", (config: GameConfig) => this.handlers.onConfig(config));
      this.room.onMessage("player", (payload: { playerId?: string }) =>
        this.handlers.onPlayer(payload.playerId)
      );
      this.room.onMessage(
        "room_info",
        (payload: { roomId: string; code?: string; private?: boolean; started?: boolean }) =>
        this.handlers.onRoomInfo?.(payload)
      );
      this.room.onMessage("error", (payload: { message: string }) =>
        this.handlers.onError(payload.message)
      );
      this.room.onMessage("rematch_start", () => {
        this.handlers.onRematchStart?.();
      });
      this.room.onMessage("rematch_cancelled", () => {
        this.handlers.onRematchCancel?.();
      });
      this.room.onMessage("rematch_pending", (payload: { name?: string }) => {
        if (payload?.name) {
          this.handlers.onNotice?.(`${payload.name} wants a rematch.`);
        } else {
          this.handlers.onNotice?.("Opponent wants a rematch.");
        }
      });
      this.room.onMessage("player_joined", (payload: { name?: string }) => {
        if (payload?.name) {
          this.handlers.onNotice?.(`${payload.name} joined the room.`);
        }
      });
      this.room.onMessage("spectator_joined", () => {
        this.handlers.onNotice?.("A spectator joined the room.");
      });
      this.room.onMessage("ready_state", (payload: { ready: string[]; started: boolean }) => {
        this.handlers.onReadyState?.(payload);
      });
      this.room.onMessage("game_start", () => {
        this.handlers.onGameStart?.();
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

  async create(
    name?: string,
    options?: { spectator?: boolean; private?: boolean; config?: GameConfig; sandboxName?: string }
  ) {
    try {
      const joinOptions = {
        ...(options ?? {})
      } as {
        spectator?: boolean;
        name?: string;
        private?: boolean;
        config?: GameConfig;
        sandboxName?: string;
      };
      if (name) joinOptions.name = name;
      this.room = await this.client.create("onitama", joinOptions);

      this.handlers.onRoom?.(this.room.id);
      this.room.onLeave((code) => this.handlers.onLeave?.(code));
      this.room.onMessage("state", (state: GameState) => this.handlers.onState(state));
      this.room.onMessage("config", (config: GameConfig) => this.handlers.onConfig(config));
      this.room.onMessage("player", (payload: { playerId?: string }) =>
        this.handlers.onPlayer(payload.playerId)
      );
      this.room.onMessage(
        "room_info",
        (payload: { roomId: string; code?: string; private?: boolean; started?: boolean }) =>
        this.handlers.onRoomInfo?.(payload)
      );
      this.room.onMessage("error", (payload: { message: string }) =>
        this.handlers.onError(payload.message)
      );
      this.room.onMessage("rematch_start", () => {
        this.handlers.onRematchStart?.();
      });
      this.room.onMessage("rematch_cancelled", () => {
        this.handlers.onRematchCancel?.();
      });
      this.room.onMessage("rematch_pending", (payload: { name?: string }) => {
        if (payload?.name) {
          this.handlers.onNotice?.(`${payload.name} wants a rematch.`);
        } else {
          this.handlers.onNotice?.("Opponent wants a rematch.");
        }
      });
      this.room.onMessage("player_joined", (payload: { name?: string }) => {
        if (payload?.name) {
          this.handlers.onNotice?.(`${payload.name} joined the room.`);
        }
      });
      this.room.onMessage("spectator_joined", () => {
        this.handlers.onNotice?.("A spectator joined the room.");
      });
      this.room.onMessage("ready_state", (payload: { ready: string[]; started: boolean }) => {
        this.handlers.onReadyState?.(payload);
      });
      this.room.onMessage("game_start", () => {
        this.handlers.onGameStart?.();
      });
      if (name) {
        this.room.send("set_name", { name });
      }
      if (this.room.reconnectionToken) {
        this.handlers.onReconnectToken?.(this.room.reconnectionToken);
      }
    } catch (error) {
      this.handlers.onError("Failed to create room.");
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

  requestRematch() {
    this.room?.send("rematch_request");
  }

  cancelRematch() {
    this.room?.send("rematch_cancel");
  }

  setReady(ready: boolean) {
    this.room?.send("ready", { ready });
  }
}
