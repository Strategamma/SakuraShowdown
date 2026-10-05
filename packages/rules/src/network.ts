import type { GameConfig, GameState, LegalMove, Move } from "./types.js";
import type { RulePackMetadata } from "./rulePack.js";

export type ServerErrorCode =
  | "ILLEGAL_MOVE"
  | "INVALID_CONFIG"
  | "RULEPACK_MISMATCH"
  | "SPECTATOR_LOCKED"
  | "ROOM_ERROR";

export type ServerErrorPayload = {
  code: ServerErrorCode;
  message: string;
  details?: Record<string, unknown>;
};

export type JoinOptions = {
  name?: string;
  spectator?: boolean;
  reconnectionToken?: string;
  expectedRulePackVersion?: string;
  expectedConfigHash?: string;
};

export type RoomInfoPayload = {
  roomId: string;
  code?: string;
  private: boolean;
  started: boolean;
};

export type PlayerIdentityPayload = {
  playerId?: string;
  spectator: boolean;
};

export type ReadyStatePayload = {
  ready: string[];
  started: boolean;
};

export type RematchPendingPayload = {
  playerId: string;
  name: string;
};

export type RematchCancelledPayload = {
  reason: "cancelled" | "left" | "timeout";
};

export type HealthPayload = {
  ok: boolean;
  service: "sakura-server";
  version: string;
  environment: string;
  rulePack: RulePackMetadata;
  uptimeMs: number;
  timestamp: string;
};

export type ClientToServerEvents = {
  move: Move;
  request_legal_moves: Record<string, never>;
  ready: { ready: boolean };
  set_name: { name: string } | string;
  rematch_request: Record<string, never>;
  rematch_cancel: Record<string, never>;
  config_update: { config: GameConfig; sandboxName?: string } | GameConfig;
};

export type ServerToClientEvents = {
  player: PlayerIdentityPayload;
  room_info: RoomInfoPayload;
  config: GameConfig;
  state: GameState;
  legal_moves: LegalMove[];
  ready_state: ReadyStatePayload;
  rematch_pending: RematchPendingPayload;
  rematch_start: Record<string, never>;
  rematch_cancelled: RematchCancelledPayload;
  game_start: Record<string, never>;
  error: ServerErrorPayload;
  rule_pack: RulePackMetadata;
};
