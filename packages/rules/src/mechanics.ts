import type { GameState, Mechanic, MechanicContext, Move } from "./types";

const swapWithPool: Mechanic = {
  id: "swap_with_pool",
  afterMove(state, move) {
    const next = structuredClone(state) as GameState;
    const player = next.players.find((p) => p.id === move.playerId);
    if (!player) return next;

    const cardIndex = player.hand.indexOf(move.cardId);
    if (cardIndex === -1) return next;

    const usedCard = player.hand.splice(cardIndex, 1)[0];
    player.hand.push(next.poolCard);
    next.poolCard = usedCard;
    return next;
  }
};

const winCapturePiece: Mechanic = {
  id: "win_capture_piece",
  checkWinner(state, ctx, params) {
    const pieceTypeId = typeof params?.pieceTypeId === "string" ? params.pieceTypeId : "master";
    for (const player of ctx.config.players) {
      const alive = state.pieces.some(
        (piece) => piece.alive && piece.ownerId === player.id && piece.typeId === pieceTypeId
      );
      if (!alive) {
        const opponent = ctx.config.players.find((p) => p.id !== player.id);
        return opponent?.id;
      }
    }
    return undefined;
  }
};

const winReachTemple: Mechanic = {
  id: "win_reach_temple",
  checkWinner(state, ctx, params) {
    const pieceTypeId = typeof params?.pieceTypeId === "string" ? params.pieceTypeId : "master";
    for (const player of ctx.config.players) {
      const targetTemple = ctx.config.players.find((p) => p.id !== player.id)?.temple;
      if (!targetTemple) continue;
      const reached = state.pieces.some(
        (piece) =>
          piece.alive &&
          piece.ownerId === player.id &&
          piece.typeId === pieceTypeId &&
          piece.x === targetTemple.x &&
          piece.y === targetTemple.y
      );
      if (reached) return player.id;
    }
    return undefined;
  }
};

export const MECHANICS: Record<string, Mechanic> = {
  [swapWithPool.id]: swapWithPool,
  [winCapturePiece.id]: winCapturePiece,
  [winReachTemple.id]: winReachTemple
};

export function applyAfterMoveMechanics(
  state: GameState,
  move: Move,
  ctx: MechanicContext,
  mechanicIds: { id: string; params?: Record<string, unknown> }[]
): GameState {
  let next = state;
  for (const mechanic of mechanicIds) {
    const impl = MECHANICS[mechanic.id];
    if (!impl?.afterMove) continue;
    next = impl.afterMove(next, move, ctx, mechanic.params);
  }
  return next;
}

export function applyMoveFilters(
  moves: Move[],
  ctx: MechanicContext,
  mechanicIds: { id: string; params?: Record<string, unknown> }[]
): Move[] {
  let next = moves as Move[];
  for (const mechanic of mechanicIds) {
    const impl = MECHANICS[mechanic.id];
    if (!impl?.modifyMoves) continue;
    next = impl.modifyMoves(next, ctx, mechanic.params);
  }
  return next;
}

export function checkMechanicWinners(
  state: GameState,
  ctx: MechanicContext,
  mechanicIds: { id: string; params?: Record<string, unknown> }[]
): string | undefined {
  for (const mechanic of mechanicIds) {
    const impl = MECHANICS[mechanic.id];
    if (!impl?.checkWinner) continue;
    const winner = impl.checkWinner(state, ctx, mechanic.params);
    if (winner) return winner;
  }
  return undefined;
}
