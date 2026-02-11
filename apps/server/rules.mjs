import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadConfig() {
  const overridePath = process.env.GAME_CONFIG_PATH;
  const configPath = overridePath
    ? path.resolve(overridePath)
    : path.resolve(__dirname, "./config/game.json");

  const raw = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(raw);
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, rng) {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createInitialState(config, seed = Date.now()) {
  const pieceTypeIds = new Set(config.pieceTypes.map((p) => p.id));
  const playerIds = new Set(config.players.map((p) => p.id));
  const cardIds = new Set(config.cards.map((c) => c.id));

  config.startingPieces.forEach((piece, index) => {
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

  config.deck.forEach((cardId, index) => {
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

  const players = config.players.map((player) => ({
    id: player.id,
    hand: deck.splice(0, config.handSize)
  }));

  const poolCard = deck.shift();
  if (!poolCard) throw new Error("Deck did not provide a pool card.");

  const pieces = config.startingPieces.map((piece, index) => ({
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

export function listLegalMoves(state, config) {
  if (state.winnerId) return [];

  const player = config.players.find((p) => p.id === state.activePlayerId);
  if (!player) return [];

  const playerState = state.players.find((p) => p.id === player.id);
  if (!playerState) return [];

  const cardById = new Map(config.cards.map((card) => [card.id, card]));
  const alivePieces = state.pieces.filter((p) => p.alive && p.ownerId === player.id);

  let moves = [];

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

export function applyMove(state, move, config) {
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

  const next = structuredClone(state);
  const piece = next.pieces.find((p) => p.id === move.pieceId);
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

function getPieceAt(state, position) {
  return state.pieces.find(
    (piece) => piece.alive && piece.x === position.x && piece.y === position.y
  );
}

function isOnBoard(position, config) {
  return (
    position.x >= 0 &&
    position.x < config.board.width &&
    position.y >= 0 &&
    position.y < config.board.height
  );
}

function resolveMove(piece, offset, forward) {
  const xMul = -forward;
  return {
    x: piece.x + offset.x * xMul,
    y: piece.y + offset.y * forward
  };
}

function nextPlayerId(config, currentId) {
  const index = config.players.findIndex((p) => p.id === currentId);
  if (index === -1) return config.players[0].id;
  const nextIndex = (index + 1) % config.players.length;
  return config.players[nextIndex].id;
}

const MECHANICS = {
  swap_with_pool: {
    afterMove(state, move) {
      const next = structuredClone(state);
      const player = next.players.find((p) => p.id === move.playerId);
      if (!player) return next;

      const cardIndex = player.hand.indexOf(move.cardId);
      if (cardIndex === -1) return next;

      const usedCard = player.hand.splice(cardIndex, 1)[0];
      player.hand.push(next.poolCard);
      next.poolCard = usedCard;
      return next;
    }
  },
  win_capture_piece: {
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
  },
  win_reach_temple: {
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
  }
};

function applyAfterMoveMechanics(state, move, ctx, mechanicIds) {
  let next = state;
  for (const mechanic of mechanicIds) {
    const impl = MECHANICS[mechanic.id];
    if (!impl?.afterMove) continue;
    next = impl.afterMove(next, move, ctx, mechanic.params);
  }
  return next;
}

function applyMoveFilters(moves, ctx, mechanicIds) {
  let next = moves;
  for (const mechanic of mechanicIds) {
    const impl = MECHANICS[mechanic.id];
    if (!impl?.modifyMoves) continue;
    next = impl.modifyMoves(next, ctx, mechanic.params);
  }
  return next;
}

function checkMechanicWinners(state, ctx, mechanicIds) {
  for (const mechanic of mechanicIds) {
    const impl = MECHANICS[mechanic.id];
    if (!impl?.checkWinner) continue;
    const winner = impl.checkWinner(state, ctx, mechanic.params);
    if (winner) return winner;
  }
  return undefined;
}
