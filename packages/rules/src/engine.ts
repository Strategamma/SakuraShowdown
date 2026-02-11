import { validateConfig } from "./config.js";
import { applyAfterMoveMechanics, applyMoveFilters, checkMechanicWinners } from "./mechanics.js";
import { mulberry32, shuffle } from "./rng.js";
import type {
  Card,
  GameConfig,
  GameState,
  LegalMove,
  Move,
  Piece,
  PlayerState,
  Vec2
} from "./types.js";

export function createInitialState(rawConfig: unknown, seed = Date.now()): GameState {
  const config = validateConfig(rawConfig);

  const pieceTypeIds = new Set(config.pieceTypes.map((p: GameConfig["pieceTypes"][number]) => p.id));
  const playerIds = new Set(config.players.map((p: GameConfig["players"][number]) => p.id));
  const cardIds = new Set(config.cards.map((c: Card) => c.id));

  config.startingPieces.forEach((piece: GameConfig["startingPieces"][number], index) => {
    if (!pieceTypeIds.has(piece.typeId)) {
      throw new Error(`Unknown piece typeId at startingPieces[${index}]: ${piece.typeId}`);
    }
    if (!playerIds.has(piece.ownerId)) {
      throw new Error(`Unknown ownerId at startingPieces[${index}]: ${piece.ownerId}`);
    }
    if (piece.x < 0 || piece.x >= config.board.width || piece.y < 0 || piece.y >= config.board.height) {
      throw new Error(`Starting piece out of bounds at startingPieces[${index}].`);
    }
  });

  config.deck.forEach((cardId: string, index) => {
    if (!cardIds.has(cardId)) {
      throw new Error(`Unknown card id at deck[${index}]: ${cardId}`);
    }
  });

  const rng = mulberry32(seed);
  const deck = shuffle(config.deck, rng);
  const totalNeeded = config.players.length * config.handSize + 1;
  if (deck.length < totalNeeded) {
    throw new Error(`Deck has ${deck.length} cards, but needs ${totalNeeded}.`);
  }

  const players: PlayerState[] = config.players.map((player: GameConfig["players"][number]) => ({
    id: player.id,
    hand: deck.splice(0, config.handSize)
  }));

  const poolCard = deck.shift();
  if (!poolCard) throw new Error("Deck did not provide a pool card.");

  const pieces: Piece[] = config.startingPieces.map((piece: GameConfig["startingPieces"][number], index) => ({
    id: `${piece.ownerId}:${piece.typeId}:${index}`,
    typeId: piece.typeId,
    ownerId: piece.ownerId,
    x: piece.x,
    y: piece.y,
    alive: true
  }));

  return {
    turn: 1,
    activePlayerId: config.players[0].id,
    pieces,
    players,
    poolCard,
    history: []
  };
}

export function listLegalMoves(state: GameState, config: GameConfig): LegalMove[] {
  if (state.winnerId) return [];

  const player = config.players.find((p: GameConfig["players"][number]) => p.id === state.activePlayerId);
  if (!player) return [];

  const playerState = state.players.find((p: PlayerState) => p.id === player.id);
  if (!playerState) return [];

  const cardById = new Map<string, Card>(config.cards.map((card: Card) => [card.id, card]));
  const alivePieces = state.pieces.filter((p: Piece) => p.alive && p.ownerId === player.id);

  let moves: LegalMove[] = [];

  for (const piece of alivePieces) {
    for (const cardId of playerState.hand) {
      const card = cardById.get(cardId);
      if (!card) continue;
      for (const offset of card.moves) {
        const to = resolveMove(piece, offset, player.forward);
        if (!isOnBoard(to, config)) continue;

        const occupant = getPieceAt(state, to);
        const isCapture = occupant && occupant.ownerId !== player.id;
        const isBlocked = occupant && occupant.ownerId === player.id;

        if (isBlocked) continue;
        if (isCapture && card.allowCapture === false) continue;
        if (!isCapture && card.allowNonCapture === false) continue;

        moves.push({
          playerId: player.id,
          pieceId: piece.id,
          cardId,
          to,
          capture: Boolean(isCapture)
        });
      }
    }
  }

  moves = applyMoveFilters(moves, { config, state }, config.mechanics);

  return moves;
}

export function applyMove(state: GameState, move: Move, config: GameConfig): GameState {
  const legalMoves = listLegalMoves(state, config);
  const match = legalMoves.find(
    (candidate) =>
      candidate.playerId === move.playerId &&
      candidate.pieceId === move.pieceId &&
      candidate.cardId === move.cardId &&
      candidate.to.x === move.to.x &&
      candidate.to.y === move.to.y
  );

  if (!match) {
    throw new Error("Illegal move.");
  }

  const next = structuredClone(state) as GameState;
  const piece = next.pieces.find((p: Piece) => p.id === move.pieceId);
  if (!piece) throw new Error("Piece not found.");

  const target = getPieceAt(next, move.to);
  let capturedMaster = false;
  if (target && target.ownerId !== piece.ownerId) {
    target.alive = false;
    if (target.typeId === "master") capturedMaster = true;
  }

  piece.x = move.to.x;
  piece.y = move.to.y;

  for (const other of next.pieces) {
    if (other.id === piece.id) continue;
    if (!other.alive) continue;
    if (other.x === piece.x && other.y === piece.y && other.ownerId !== piece.ownerId) {
      other.alive = false;
      if (other.typeId === "master") capturedMaster = true;
    }
  }

  const ctx = { config, state: next };
  const withMechanics = applyAfterMoveMechanics(next, move, ctx, config.mechanics);

  withMechanics.lastMove = move;
  withMechanics.history.push(move);
  withMechanics.turn += 1;
  withMechanics.activePlayerId = nextPlayerId(config, move.playerId);

  if (capturedMaster) {
    withMechanics.winnerId = move.playerId;
  } else {
    const winner = checkMechanicWinners(withMechanics, { config, state: withMechanics }, config.mechanics);
    if (winner) withMechanics.winnerId = winner;
  }

  return withMechanics;
}

export function getPieceAt(state: GameState, position: Vec2): Piece | undefined {
  return state.pieces.find(
    (piece) => piece.alive && piece.x === position.x && piece.y === position.y
  );
}

export function isOnBoard(position: Vec2, config: GameConfig): boolean {
  return (
    position.x >= 0 &&
    position.x < config.board.width &&
    position.y >= 0 &&
    position.y < config.board.height
  );
}

export function resolveMove(piece: Piece, offset: Vec2, forward: 1 | -1): Vec2 {
  const xMul = -forward;
  return {
    x: piece.x + offset.x * xMul,
    y: piece.y + offset.y * forward
  };
}

export function nextPlayerId(config: GameConfig, currentId: string): string {
  const index = config.players.findIndex((p) => p.id === currentId);
  if (index === -1) return config.players[0].id;
  const nextIndex = (index + 1) % config.players.length;
  return config.players[nextIndex].id;
}
