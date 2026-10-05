import { applyMove, listLegalMoves } from "./engine.js";
import type { GameConfig, GameState, LegalMove, Piece } from "./types.js";

export type AiDifficulty = "beginner" | "standard" | "expert";
const WIN_SCORE = 1_000_000;

function masterTypeIds(config: GameConfig) {
  return new Set(config.pieceTypes.filter((type) => type.tag === "king" || type.id === "master").map((type) => type.id));
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function legalMovesFor(state: GameState, playerId: string, config: GameConfig) {
  return listLegalMoves({ ...state, activePlayerId: playerId, winnerId: undefined }, config);
}

function isWinningMove(move: LegalMove, state: GameState, config: GameConfig, masters: Set<string>) {
  const piece = state.pieces.find((candidate) => candidate.id === move.pieceId);
  const target = state.pieces.find((candidate) => candidate.alive && candidate.x === move.to.x && candidate.y === move.to.y);
  if (target && target.ownerId !== move.playerId && masters.has(target.typeId)) return true;
  const enemyTemple = config.players.find((player) => player.id !== move.playerId)?.temple;
  return Boolean(piece && masters.has(piece.typeId) && enemyTemple && enemyTemple.x === move.to.x && enemyTemple.y === move.to.y);
}

function stateKey(state: GameState, depth: number) {
  const pieces = state.pieces.map((piece) => `${piece.id}:${piece.alive ? `${piece.x},${piece.y}` : "x"}`).join("|");
  const hands = state.players.map((player) => `${player.id}:${player.hand.join(",")}`).join("|");
  return `${depth}:${state.activePlayerId}:${state.poolCard}:${hands}:${pieces}`;
}

function evaluateState(state: GameState, rootId: string, config: GameConfig, masters: Set<string>) {
  if (state.winnerId) return state.winnerId === rootId ? WIN_SCORE : -WIN_SCORE;
  const opponentId = config.players.find((player) => player.id !== rootId)?.id;
  if (!opponentId) return 0;
  let score = 0;
  const center = { x: (config.board.width - 1) / 2, y: (config.board.height - 1) / 2 };
  let rootMaster: Piece | undefined;
  let enemyMaster: Piece | undefined;
  for (const piece of state.pieces) {
    if (!piece.alive) continue;
    const side = piece.ownerId === rootId ? 1 : -1;
    const isMaster = masters.has(piece.typeId);
    score += side * (isMaster ? 10_000 : 120);
    score += side * Math.max(0, 4 - distance(piece, center)) * (isMaster ? 1.5 : 3);
    if (isMaster && side === 1) rootMaster = piece;
    if (isMaster && side === -1) enemyMaster = piece;
  }
  const rootTemple = config.players.find((player) => player.id === rootId)?.temple;
  const enemyTemple = config.players.find((player) => player.id === opponentId)?.temple;
  if (rootMaster && enemyTemple) score += (config.board.width + config.board.height - distance(rootMaster, enemyTemple)) * 18;
  if (enemyMaster && rootTemple) score -= (config.board.width + config.board.height - distance(enemyMaster, rootTemple)) * 22;
  const rootMoves = legalMovesFor(state, rootId, config);
  const enemyMoves = legalMovesFor(state, opponentId, config);
  score += (rootMoves.length - enemyMoves.length) * 2.5;
  score += rootMoves.filter((move) => move.capture).length * 8;
  score -= enemyMoves.filter((move) => move.capture).length * 10;
  if (rootMoves.some((move) => isWinningMove(move, state, config, masters))) score += 40_000;
  if (enemyMoves.some((move) => isWinningMove(move, state, config, masters))) score -= 55_000;
  return score;
}

function orderedMoves(state: GameState, config: GameConfig, masters: Set<string>) {
  return listLegalMoves(state, config).sort((a, b) => {
    const priority = (move: LegalMove) => {
      if (isWinningMove(move, state, config, masters)) return 100_000;
      const target = state.pieces.find((piece) => piece.alive && piece.x === move.to.x && piece.y === move.to.y);
      return move.capture ? (target && masters.has(target.typeId) ? 50_000 : 2_000) : 0;
    };
    return priority(b) - priority(a);
  });
}

type SearchResult = { score: number; complete: boolean };

function minimax(state: GameState, depth: number, alpha: number, beta: number, rootId: string, config: GameConfig, masters: Set<string>, deadline: number, cache: Map<string, number>): SearchResult {
  if (performance.now() >= deadline) return { score: evaluateState(state, rootId, config, masters), complete: false };
  if (state.winnerId || depth === 0) {
    const score = evaluateState(state, rootId, config, masters);
    return { score: state.winnerId ? score + Math.sign(score) * depth * 100 : score, complete: true };
  }
  const key = stateKey(state, depth);
  const cached = cache.get(key);
  if (cached !== undefined) return { score: cached, complete: true };
  const moves = orderedMoves(state, config, masters);
  if (!moves.length) return { score: evaluateState(state, rootId, config, masters), complete: true };
  const maximizing = state.activePlayerId === rootId;
  let best = maximizing ? -Infinity : Infinity;
  for (const move of moves) {
    const result = minimax(applyMove(state, move, config), depth - 1, alpha, beta, rootId, config, masters, deadline, cache);
    if (!result.complete) return result;
    best = maximizing ? Math.max(best, result.score) : Math.min(best, result.score);
    if (maximizing) alpha = Math.max(alpha, best);
    else beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  cache.set(key, best);
  return { score: best, complete: true };
}

function rankImmediateMoves(moves: LegalMove[], state: GameState, config: GameConfig) {
  const masters = masterTypeIds(config);
  return [...moves].sort((a, b) => evaluateState(applyMove(state, b, config), state.activePlayerId, config, masters) - evaluateState(applyMove(state, a, config), state.activePlayerId, config, masters));
}

export function chooseAiMove(moves: LegalMove[], state: GameState, config: GameConfig, difficulty: AiDifficulty): LegalMove | undefined {
  if (!moves.length) return undefined;
  if (difficulty === "beginner") return moves[Math.floor(Math.random() * moves.length)];
  const immediate = rankImmediateMoves(moves, state, config);
  const rootId = state.activePlayerId;
  const masters = masterTypeIds(config);
  const ordered = orderedMoves(state, config, masters);
  const forcedWin = ordered.find((move) => isWinningMove(move, state, config, masters));
  if (forcedWin) return forcedWin;

  if (difficulty === "standard") {
    const deadline = performance.now() + 90;
    const cache = new Map<string, number>();
    let bestMove = immediate[0] ?? ordered[0];
    let bestScore = -Infinity;
    for (const move of ordered) {
      const result = minimax(applyMove(state, move, config), 1, -Infinity, Infinity, rootId, config, masters, deadline, cache);
      if (!result.complete) return bestMove;
      if (result.score > bestScore) {
        bestScore = result.score;
        bestMove = move;
      }
    }
    return bestMove;
  }

  const deadline = performance.now() + 240;
  const maxDepth = moves.length <= 18 ? 4 : 3;
  let bestMove = immediate[0] ?? ordered[0];
  for (let depth = 2; depth <= maxDepth; depth += 1) {
    let iterationBest = bestMove;
    let iterationScore = -Infinity;
    let complete = true;
    const cache = new Map<string, number>();
    for (const move of ordered) {
      const result = minimax(applyMove(state, move, config), depth - 1, -Infinity, Infinity, rootId, config, masters, deadline, cache);
      if (!result.complete) { complete = false; break; }
      if (result.score > iterationScore) { iterationScore = result.score; iterationBest = move; }
    }
    if (!complete) break;
    bestMove = iterationBest;
    if (iterationScore >= WIN_SCORE) break;
  }
  return bestMove;
}
