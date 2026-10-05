import type { GameConfig, GameState, LegalMove } from "@game/rules";

export type AiDifficulty = "beginner" | "standard" | "expert";

function scoreMove(move: LegalMove, state: GameState, config: GameConfig) {
  const piece = state.pieces.find((candidate) => candidate.id === move.pieceId);
  const target = state.pieces.find(
    (candidate) => candidate.alive && candidate.x === move.to.x && candidate.y === move.to.y
  );
  const masterIds = new Set(
    config.pieceTypes.filter((type) => type.tag === "king" || type.id === "master").map((type) => type.id)
  );
  const enemyTemple = config.players.find((player) => player.id !== move.playerId)?.temple;
  let score = Math.random() * 0.25;
  if (target && target.ownerId !== move.playerId) {
    score += masterIds.has(target.typeId) ? 1000 : 24;
  }
  if (piece && masterIds.has(piece.typeId) && enemyTemple?.x === move.to.x && enemyTemple.y === move.to.y) {
    score += 1000;
  }
  if (piece) {
    const centerX = (config.board.width - 1) / 2;
    const centerY = (config.board.height - 1) / 2;
    score += 4 - (Math.abs(move.to.x - centerX) + Math.abs(move.to.y - centerY)) * 0.4;
  }
  return score;
}

export function chooseAiMove(
  moves: LegalMove[],
  state: GameState,
  config: GameConfig,
  difficulty: AiDifficulty
): LegalMove | undefined {
  if (!moves.length) return undefined;
  if (difficulty === "beginner") {
    return moves[Math.floor(Math.random() * moves.length)];
  }
  const ranked = [...moves].sort((a, b) => scoreMove(b, state, config) - scoreMove(a, state, config));
  if (difficulty === "standard" && ranked.length > 1 && Math.random() < 0.3) {
    return ranked[Math.min(ranked.length - 1, 1 + Math.floor(Math.random() * 2))];
  }
  return ranked[0];
}
