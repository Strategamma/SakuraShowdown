export type Vec2 = { x: number; y: number };

export type BoardConfig = {
  width: number;
  height: number;
};

export type PlayerConfig = {
  id: string;
  name: string;
  forward: 1 | -1;
  temple: Vec2;
};

export type PieceType = {
  id: string;
  name: string;
  tag?: string;
};

export type StartingPiece = {
  typeId: string;
  ownerId: string;
  x: number;
  y: number;
};

export type Card = {
  id: string;
  name: string;
  moves: Vec2[];
  allowCapture?: boolean;
  allowNonCapture?: boolean;
  tags?: string[];
};

export type MechanicConfig = {
  id: string;
  params?: Record<string, unknown>;
};

export type GameConfig = {
  board: BoardConfig;
  players: PlayerConfig[];
  pieceTypes: PieceType[];
  startingPieces: StartingPiece[];
  cards: Card[];
  deck: string[];
  handSize: number;
  mechanics: MechanicConfig[];
};

export type Piece = {
  id: string;
  typeId: string;
  ownerId: string;
  x: number;
  y: number;
  alive: boolean;
};

export type PlayerState = {
  id: string;
  hand: string[];
};

export type Move = {
  playerId: string;
  pieceId: string;
  cardId: string;
  to: Vec2;
};

export type GameState = {
  turn: number;
  activePlayerId: string;
  pieces: Piece[];
  players: PlayerState[];
  poolCard: string;
  winnerId?: string;
  lastMove?: Move;
  history: Move[];
};

export type LegalMove = Move & {
  capture?: boolean;
};

export type MechanicContext = {
  config: GameConfig;
  state: GameState;
};

export type Mechanic = {
  id: string;
  modifyMoves?: (moves: LegalMove[], ctx: MechanicContext, params?: Record<string, unknown>) => LegalMove[];
  afterMove?: (state: GameState, move: Move, ctx: MechanicContext, params?: Record<string, unknown>) => GameState;
  checkWinner?: (state: GameState, ctx: MechanicContext, params?: Record<string, unknown>) => string | undefined;
};
