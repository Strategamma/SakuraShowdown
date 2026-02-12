import { applyMove, createInitialState, listLegalMoves } from "@game/rules";
import type { GameConfig, GameState, LegalMove, Move } from "@game/rules";
import { OnlineSession } from "./network";

export type GameMode = "local" | "online";

export type ControllerCallbacks = {
  onState: (state: GameState) => void;
  onConfig: (config: GameConfig) => void;
  onStatus: (message: string) => void;
  onPlayer: (playerId?: string) => void;
  onRoom?: (roomId: string) => void;
  onRoomInfo?: (info: { roomId: string; code?: string; private?: boolean; started?: boolean }) => void;
  onReconnectToken?: (token?: string) => void;
  onNotice?: (message: string) => void;
  onRematchStart?: () => void;
  onRematchCancel?: () => void;
  onLeave?: (code?: number) => void;
  onReadyState?: (payload: { ready: string[]; started: boolean }) => void;
  onGameStart?: () => void;
};

export class GameController {
  private mode: GameMode = "local";
  private config?: GameConfig;
  private state?: GameState;
  private legalMoves: LegalMove[] = [];
  private selectedCardId?: string;
  private selectedPieceId?: string;
  private callbacks: ControllerCallbacks;
  private online?: OnlineSession;
  private playerId?: string;
  private onlineStarted = true;

  constructor(callbacks: ControllerCallbacks) {
    this.callbacks = callbacks;
  }

  setMode(mode: GameMode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.disconnectOnline();
    this.onlineStarted = true;
  }

  async loadConfig(url: string) {
    this.callbacks.onStatus("Loading config...");
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to load config.");
    }
    const config = (await response.json()) as GameConfig;
    this.config = config;
    this.callbacks.onConfig(config);
  }

  setConfig(config: GameConfig) {
    this.config = config;
    this.callbacks.onConfig(config);
  }

  startLocal(options?: { seed?: number; startingPlayerId?: string }) {
    if (!this.config) throw new Error("Config not loaded.");
    this.state = createInitialState(this.config, options?.seed ?? Date.now());
    if (options?.startingPlayerId) {
      const exists = this.config.players.some((p) => p.id === options.startingPlayerId);
      if (exists && this.state) {
        this.state.activePlayerId = options.startingPlayerId;
      }
    }
    this.playerId = undefined;
    this.recalculateMoves();
    this.callbacks.onState(this.state);
    this.callbacks.onStatus("Local match ready.");
  }

  async connectOnline(
    endpoint: string,
    roomId?: string,
    name?: string,
    options?: { spectator?: boolean }
  ): Promise<boolean> {
    if (!this.config) throw new Error("Config not loaded.");

    this.callbacks.onStatus("Connecting...");

    this.online = new OnlineSession(endpoint, {
      onState: (state) => {
        this.state = state;
        this.recalculateMoves();
        this.callbacks.onState(state);
      },
      onConfig: (config) => {
        this.config = config;
        this.callbacks.onConfig(config);
      },
      onRoom: (roomId) => {
        this.callbacks.onRoom?.(roomId);
      },
      onRoomInfo: (info) => {
        this.callbacks.onRoomInfo?.(info);
        if (typeof info.started === "boolean") {
          this.onlineStarted = info.started;
        }
      },
      onPlayer: (playerId) => {
        this.playerId = playerId;
        this.callbacks.onPlayer(playerId);
      },
      onError: (message) => this.callbacks.onStatus(message),
      onNotice: (message) => this.callbacks.onNotice?.(message),
      onRematchStart: () => this.callbacks.onRematchStart?.(),
      onRematchCancel: () => this.callbacks.onRematchCancel?.(),
      onLeave: (code) => this.callbacks.onLeave?.(code),
      onReconnectToken: (token) => this.callbacks.onReconnectToken?.(token),
      onReadyState: (payload) => {
        this.onlineStarted = payload.started;
        this.callbacks.onReadyState?.(payload);
      },
      onGameStart: () => {
        this.onlineStarted = true;
        this.callbacks.onGameStart?.();
      }
    });

    try {
      await this.online.connect(roomId, name, options);
      this.callbacks.onStatus("Connected.");
      return true;
    } catch {
      return false;
    }
  }

  async reconnectOnline(
    endpoint: string,
    reconnectToken: string,
    name?: string
  ): Promise<boolean> {
    if (!this.config) throw new Error("Config not loaded.");

    this.callbacks.onStatus("Reconnecting...");

    this.online = new OnlineSession(endpoint, {
      onState: (state) => {
        this.state = state;
        this.recalculateMoves();
        this.callbacks.onState(state);
      },
      onConfig: (config) => {
        this.config = config;
        this.callbacks.onConfig(config);
      },
      onRoom: (roomId) => {
        this.callbacks.onRoom?.(roomId);
      },
      onRoomInfo: (info) => {
        this.callbacks.onRoomInfo?.(info);
        if (typeof info.started === "boolean") {
          this.onlineStarted = info.started;
        }
      },
      onPlayer: (playerId) => {
        this.playerId = playerId;
        this.callbacks.onPlayer(playerId);
      },
      onError: (message) => this.callbacks.onStatus(message),
      onNotice: (message) => this.callbacks.onNotice?.(message),
      onRematchStart: () => this.callbacks.onRematchStart?.(),
      onRematchCancel: () => this.callbacks.onRematchCancel?.(),
      onLeave: (code) => this.callbacks.onLeave?.(code),
      onReconnectToken: (token) => this.callbacks.onReconnectToken?.(token),
      onReadyState: (payload) => {
        this.onlineStarted = payload.started;
        this.callbacks.onReadyState?.(payload);
      },
      onGameStart: () => {
        this.onlineStarted = true;
        this.callbacks.onGameStart?.();
      }
    });

    try {
      await this.online.reconnect(reconnectToken, name);
      this.callbacks.onStatus("Connected.");
      return true;
    } catch {
      return false;
    }
  }

  async createOnline(
    endpoint: string,
    name?: string,
    options?: {
      spectator?: boolean;
      private?: boolean;
      config?: GameConfig;
      sandboxName?: string;
    }
  ): Promise<boolean> {
    if (!this.config) throw new Error("Config not loaded.");

    this.callbacks.onStatus("Creating room...");

    this.online = new OnlineSession(endpoint, {
      onState: (state) => {
        this.state = state;
        this.recalculateMoves();
        this.callbacks.onState(state);
      },
      onConfig: (config) => {
        this.config = config;
        this.callbacks.onConfig(config);
      },
      onRoom: (roomId) => {
        this.callbacks.onRoom?.(roomId);
      },
      onRoomInfo: (info) => {
        this.callbacks.onRoomInfo?.(info);
        if (typeof info.started === "boolean") {
          this.onlineStarted = info.started;
        }
      },
      onPlayer: (playerId) => {
        this.playerId = playerId;
        this.callbacks.onPlayer(playerId);
      },
      onError: (message) => this.callbacks.onStatus(message),
      onNotice: (message) => this.callbacks.onNotice?.(message),
      onRematchStart: () => this.callbacks.onRematchStart?.(),
      onRematchCancel: () => this.callbacks.onRematchCancel?.(),
      onLeave: (code) => this.callbacks.onLeave?.(code),
      onReconnectToken: (token) => this.callbacks.onReconnectToken?.(token),
      onReadyState: (payload) => {
        this.onlineStarted = payload.started;
        this.callbacks.onReadyState?.(payload);
      },
      onGameStart: () => {
        this.onlineStarted = true;
        this.callbacks.onGameStart?.();
      }
    });

    try {
      await this.online.create(name, options);
      this.callbacks.onStatus("Connected.");
      return true;
    } catch {
      return false;
    }
  }

  disconnectOnline() {
    this.online?.disconnect();
    this.online = undefined;
  }

  requestRematch() {
    this.online?.requestRematch();
  }

  cancelRematch() {
    this.online?.cancelRematch();
  }

  setReady(ready: boolean) {
    this.online?.setReady(ready);
  }

  updateOnlineConfig(config: GameConfig, sandboxName?: string) {
    this.online?.updateConfig(config, sandboxName);
  }

  selectCard(cardId?: string) {
    this.selectedCardId = cardId;
  }

  selectPiece(pieceId?: string) {
    this.selectedPieceId = pieceId;
  }

  clearSelection() {
    this.selectedCardId = undefined;
    this.selectedPieceId = undefined;
  }

  tryMove(x: number, y: number) {
    if (!this.state || !this.config) return;
    if (this.state.winnerId) return;
    if (!this.selectedCardId || !this.selectedPieceId) return;
    if (!this.canAct()) return;

    const move: Move = {
      playerId: this.state.activePlayerId,
      pieceId: this.selectedPieceId,
      cardId: this.selectedCardId,
      to: { x, y }
    };

    const legal = this.legalMoves.some(
      (candidate) =>
        candidate.playerId === move.playerId &&
        candidate.pieceId === move.pieceId &&
        candidate.cardId === move.cardId &&
        candidate.to.x === move.to.x &&
        candidate.to.y === move.to.y
    );

    if (!legal) return;

    if (this.mode === "local") {
      this.state = applyMove(this.state, move, this.config);
      this.recalculateMoves();
      this.callbacks.onState(this.state);
    } else {
      this.online?.sendMove(move);
    }
  }

  recalculateMoves() {
    if (!this.state || !this.config) return;
    this.legalMoves = listLegalMoves(this.state, this.config);
  }

  canAct() {
    if (!this.state) return false;
    if (this.state.winnerId) return false;
    if (this.mode === "local") return true;
    if (!this.onlineStarted) return false;
    return this.playerId === this.state.activePlayerId;
  }

  getState() {
    return this.state;
  }

  getConfig() {
    return this.config;
  }

  getLegalMoves() {
    return this.legalMoves;
  }

  getSelection() {
    return {
      selectedCardId: this.selectedCardId,
      selectedPieceId: this.selectedPieceId
    };
  }

  getPlayerId() {
    return this.playerId;
  }
}
