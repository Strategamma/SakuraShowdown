import { applyMove, createInitialState, listLegalMoves } from "@game/rules";
import type { GameConfig, GameState, LegalMove, Move } from "@game/rules";
import { OnlineSession } from "./network";

export type GameMode = "local" | "online";

export type ControllerCallbacks = {
  onState: (state: GameState) => void;
  onConfig: (config: GameConfig) => void;
  onStatus: (message: string) => void;
  onPlayer: (playerId?: string) => void;
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

  constructor(callbacks: ControllerCallbacks) {
    this.callbacks = callbacks;
  }

  setMode(mode: GameMode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.disconnectOnline();
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

  startLocal(seed?: number) {
    if (!this.config) throw new Error("Config not loaded.");
    this.state = createInitialState(this.config, seed);
    this.playerId = undefined;
    this.recalculateMoves();
    this.callbacks.onState(this.state);
    this.callbacks.onStatus("Local match ready.");
  }

  async connectOnline(endpoint: string, roomId?: string) {
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
      onPlayer: (playerId) => {
        this.playerId = playerId;
        this.callbacks.onPlayer(playerId);
      },
      onError: (message) => this.callbacks.onStatus(message)
    });

    await this.online.connect(roomId);
    this.callbacks.onStatus("Connected.");
  }

  disconnectOnline() {
    this.online?.disconnect();
    this.online = undefined;
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
    if (this.mode === "local") return true;
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
