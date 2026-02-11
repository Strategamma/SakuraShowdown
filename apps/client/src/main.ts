import "./styles.css";
import { validateConfig } from "@game/rules";
import type { GameConfig, GameState, LegalMove } from "@game/rules";
import { GameController } from "./game/controller";
import { GameRenderer } from "./game/renderer";
import defaultConfig from "./game/defaultConfig";

const BASE_URL = import.meta.env.BASE_URL || "/";
const DEFAULT_CONFIG_URL = `${BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`}game.json`;
const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "ws://localhost:2567";
const DERIVED_CONFIG_URL = SERVER_URL.startsWith("ws")
  ? `${SERVER_URL.replace(/^ws/, "http")}/config`
  : undefined;
const CONFIG_URL = import.meta.env.VITE_CONFIG_URL ?? DERIVED_CONFIG_URL ?? DEFAULT_CONFIG_URL;
const LOBBY_URL = SERVER_URL.startsWith("ws")
  ? `${SERVER_URL.replace(/^ws/, "http")}/lobby`
  : `${SERVER_URL.replace(/\/$/, "")}/lobby`;
const STORAGE_KEY = "sakura.customConfig";
const LOCAL_NAME_KEY = "sakura.localName";
const LOCAL_OPPONENT_NAME_KEY = "sakura.localOpponentName";
const LOCAL_START_KEY = "sakura.localStartingPlayer";
const VIEW_MODE_KEY = "sakura.viewMode";

const statusEl = document.getElementById("status") as HTMLElement;
const appEl = document.getElementById("app") as HTMLElement;
const modeSelect = document.getElementById("mode") as HTMLSelectElement;
const connectBtn = document.getElementById("connect") as HTMLButtonElement;
const roomInput = document.getElementById("room") as HTMLInputElement;
const roomInfoEl = document.getElementById("room-info") as HTMLElement;
const copyRoomBtn = document.getElementById("copy-room") as HTMLButtonElement;
const quickOnlineBtn = document.getElementById("quick-online") as HTMLButtonElement;
const restartLocalBtn = document.getElementById("restart-local") as HTMLButtonElement;
const localNameInput = document.getElementById("local-name") as HTMLInputElement;
const localOpponentNameInput = document.getElementById("local-opponent-name") as HTMLInputElement;
const startingPlayerSelect = document.getElementById("starting-player") as HTMLSelectElement;
const namesEditBtn = document.getElementById("names-edit") as HTMLButtonElement;
const namesEditLabel = namesEditBtn?.querySelector(".icon-label") as HTMLElement;
const playerLabel = document.getElementById("player-label") as HTMLElement;
const playerNameEl = document.getElementById("player-name") as HTMLElement;
const opponentNameEl = document.getElementById("opponent-name") as HTMLElement;
const playerSection = document.getElementById("player-section") as HTMLElement;
const opponentSection = document.getElementById("opponent-section") as HTMLElement;
const cardChoiceHint = document.getElementById("card-choice-hint") as HTMLElement;
const playerNameEditBtn = document.getElementById("player-name-edit") as HTMLButtonElement | null;
const toggleViewBtn = document.getElementById("toggle-view") as HTMLButtonElement;
const openCustomizeBtn = document.getElementById("open-customize") as HTMLButtonElement;
const newGameBtn = document.getElementById("new-game") as HTMLButtonElement;
const handEl = document.getElementById("hand") as HTMLElement;
const opponentHandEl = document.getElementById("opponent-hand") as HTMLElement;
const poolEl = document.getElementById("pool") as HTMLElement;
const opponentCapturedEl = document.getElementById("opponent-captured") as HTMLElement;
const playerCapturedEl = document.getElementById("player-captured") as HTMLElement;
const canvasContainer = document.getElementById("canvas-container") as HTMLElement;
const customizeBtn = document.getElementById("customize-cards") as HTMLButtonElement;
const overlay = document.getElementById("customize-overlay") as HTMLElement;
const closeBtn = document.getElementById("customize-close") as HTMLButtonElement;
const cardListEl = document.getElementById("card-list") as HTMLElement;
const cardNameInput = document.getElementById("card-name") as HTMLInputElement;
const moveListEl = document.getElementById("move-list") as HTMLElement;
const cardGridEl = document.getElementById("card-grid") as HTMLElement;
const moveXInput = document.getElementById("move-x") as HTMLInputElement;
const moveYInput = document.getElementById("move-y") as HTMLInputElement;
const moveAddBtn = document.getElementById("move-add") as HTMLButtonElement;
const cardAddBtn = document.getElementById("card-add") as HTMLButtonElement;
const cardRemoveBtn = document.getElementById("card-remove") as HTMLButtonElement;
const cardsApplyBtn = document.getElementById("cards-apply") as HTMLButtonElement;
const cardsResetBtn = document.getElementById("cards-reset") as HTMLButtonElement;
const cardsExportBtn = document.getElementById("cards-export") as HTMLButtonElement;
const victoryOverlay = document.getElementById("victory-overlay") as HTMLElement;
const victoryTitle = document.getElementById("victory-title") as HTMLElement;
const victorySubtitle = document.getElementById("victory-subtitle") as HTMLElement;
const victoryCloseBtn = document.getElementById("victory-close") as HTMLButtonElement;
const victoryRandomBtn = document.getElementById("victory-random") as HTMLButtonElement;
const victoryChooseBtn = document.getElementById("victory-choose") as HTMLButtonElement;
const startOverlay = document.getElementById("start-overlay") as HTMLElement;
const startRandomBtn = document.getElementById("start-random") as HTMLButtonElement;
const startChooseBtn = document.getElementById("start-choose") as HTMLButtonElement;
const draftOverlay = document.getElementById("draft-overlay") as HTMLElement;
const draftGrid = document.getElementById("draft-grid") as HTMLElement;
const draftCount = document.getElementById("draft-count") as HTMLElement;
const draftStartBtn = document.getElementById("draft-start") as HTMLButtonElement;
const draftCloseBtn = document.getElementById("draft-close") as HTMLButtonElement;
const draftSelectedEl = document.getElementById("draft-selected") as HTMLElement | null;
const landingOverlay = document.getElementById("landing-overlay") as HTMLElement;
const landingCloseBtn = document.getElementById("landing-close") as HTMLButtonElement;
const landingLocalBtn = document.getElementById("landing-local") as HTMLButtonElement;
const landingOnlineBtn = document.getElementById("landing-online") as HTMLButtonElement;
const landingCustomizeBtn = document.getElementById("landing-customize") as HTMLButtonElement;
const landingTabPlay = document.getElementById("landing-tab-play") as HTMLButtonElement | null;
const landingTabRules = document.getElementById("landing-tab-rules") as HTMLButtonElement | null;
const landingPanelPlay = document.getElementById("landing-panel-play") as HTMLElement | null;
const landingPanelRules = document.getElementById("landing-panel-rules") as HTMLElement | null;
const lobbyListEl = document.getElementById("lobby-list") as HTMLElement;
const lobbyRefreshBtn = document.getElementById("lobby-refresh") as HTMLButtonElement;
const lobbyQuickBtn = document.getElementById("lobby-quick") as HTMLButtonElement;
const lobbyCreateBtn = document.getElementById("lobby-create") as HTMLButtonElement;

appEl.dataset.started = "false";

let latestConfig: GameConfig | undefined;
let latestState: GameState | undefined;
let latestMoves: LegalMove[] = [];
let previousHand: string[] = [];
let previousPoolCard: string | undefined;
let editableConfig: GameConfig | undefined;
let selectedCardIndex = 0;
let currentRoomId: string | undefined;
let baseConfig: GameConfig | undefined;
let localName = localStorage.getItem(LOCAL_NAME_KEY) ?? "";
let localOpponentName = localStorage.getItem(LOCAL_OPPONENT_NAME_KEY) ?? "";
let localStartingPlayer = localStorage.getItem(LOCAL_START_KEY) ?? "random";
let viewMode = (localStorage.getItem(VIEW_MODE_KEY) as "2d" | "3d" | null) ?? "3d";
let draftSelection = new Set<string>();
let lastWinnerId: string | undefined;
let pendingMove:
  | { pieceId: string; to: { x: number; y: number }; cardIds: string[] }
  | undefined;
let startChoiceResolved = false;
let namesEditing = false;
let lobbyTimer: number | undefined;
let returnToLandingOnCustomizeClose = false;
let lastSwapAnimationKey: string | undefined;

const controller = new GameController({
  onState: (state) => {
    latestState = state;
    latestMoves = controller.getLegalMoves();
    renderAll();
  },
  onConfig: (config) => {
    latestConfig = config;
    renderer.setConfig(config);
    renderAll();
  },
  onStatus: (message) => {
    statusEl.textContent = message;
  },
  onRoom: (roomId) => {
    currentRoomId = roomId;
    roomInput.value = roomId;
    roomInfoEl.textContent = `Room code: ${roomId}`;
    statusEl.textContent = `Online match ready · Room ${roomId}`;
  },
  onPlayer: (playerId) => {
    if (!playerId) {
      playerLabel.textContent = "Spectator";
      return;
    }
    const label = latestConfig?.players.find((p) => p.id === playerId)?.name ?? playerId;
    playerLabel.textContent = label;
  }
});

function handleCellTap(x: number, y: number) {
  if (!latestState || !latestConfig) return;
  if (!controller.canAct()) return;
  const selection = controller.getSelection();
  const movesForCell = latestMoves.filter(
    (move) =>
      move.to.x === x &&
      move.to.y === y &&
      move.playerId === latestState.activePlayerId
  );
  if (movesForCell.length === 0) return;

  if (!selection.selectedPieceId) {
    const uniquePieces = Array.from(new Set(movesForCell.map((move) => move.pieceId)));
    if (uniquePieces.length === 1) {
      const pieceId = uniquePieces[0];
      controller.selectPiece(pieceId);
      if (movesForCell.length === 1) {
        const only = movesForCell[0];
        controller.selectCard(only.cardId);
        controller.tryMove(x, y);
        controller.clearSelection();
        pendingMove = undefined;
        renderAll();
        return;
      }
      pendingMove = {
        pieceId,
        to: { x, y },
        cardIds: Array.from(new Set(movesForCell.map((move) => move.cardId)))
      };
      statusEl.textContent = "Choose a card to play this move.";
      renderAll();
      return;
    }
    statusEl.textContent = "Select a piece to play this move.";
    return;
  }

  const filteredMoves = movesForCell.filter(
    (move) => move.pieceId === selection.selectedPieceId
  );
  if (filteredMoves.length === 0) return;

  if (filteredMoves.length === 1) {
    const only = filteredMoves[0];
    controller.selectCard(only.cardId);
    controller.tryMove(x, y);
    controller.clearSelection();
    pendingMove = undefined;
    renderAll();
    return;
  }

  pendingMove = {
    pieceId: selection.selectedPieceId,
    to: { x, y },
    cardIds: filteredMoves.map((move) => move.cardId)
  };
  statusEl.textContent = "Choose a card to play this move.";
  renderAll();
}

const renderer = new GameRenderer(canvasContainer, {
  onCellTap: (x, y) => {
    handleCellTap(x, y);
  },
  onPieceTap: (pieceId) => {
    if (!latestState || !latestConfig) return;
    if (!controller.canAct()) return;

    const piece = latestState.pieces.find((p) => p.id === pieceId);
    if (!piece || !piece.alive) return;

    if (piece.ownerId !== latestState.activePlayerId) {
      handleCellTap(piece.x, piece.y);
      return;
    }

    pendingMove = undefined;
    controller.selectPiece(pieceId);
    renderAll();
  }
});
renderer.setViewMode(viewMode);

function renderAll() {
  if (!latestConfig || !latestState) return;
  renderCards();

  const selection = controller.getSelection();
  const moves = filterMoves(latestMoves, selection.selectedCardId, selection.selectedPieceId);
  renderer.render(latestState, moves, selection);

  const viewPlayerId = controller.getPlayerId() ?? latestState.activePlayerId;
  const primaryId = latestConfig.players[0]?.id;
  const flip = Boolean(primaryId && viewPlayerId !== primaryId);
  renderer.setBoardFlip(flip);

  if (latestState.winnerId) {
    const winnerName =
      latestConfig.players.find((p) => p.id === latestState.winnerId)?.name ??
      latestState.winnerId;
    statusEl.textContent = `Winner: ${winnerName}`;
    if (lastWinnerId !== latestState.winnerId) {
      showVictory(winnerName);
      lastWinnerId = latestState.winnerId;
    }
  } else {
    const activeName =
      latestConfig.players.find((p) => p.id === latestState.activePlayerId)?.name ??
      latestState.activePlayerId;
    statusEl.textContent = `Turn ${latestState.turn} · ${activeName}`;
    lastWinnerId = undefined;
  }

  updateStartedUI();
}

function updateStartedUI() {
  const started = Boolean(latestState && !latestState.winnerId);
  appEl.dataset.started = started ? "true" : "false";
  if (!started) {
    pendingMove = undefined;
  }
}

function setLandingTab(tab: "play" | "rules") {
  if (!landingTabPlay || !landingTabRules || !landingPanelPlay || !landingPanelRules) return;
  const playActive = tab === "play";
  landingTabPlay.classList.toggle("active", playActive);
  landingTabRules.classList.toggle("active", !playActive);
  landingPanelPlay.classList.toggle("hidden", !playActive);
  landingPanelRules.classList.toggle("hidden", playActive);
}

function showLanding() {
  landingOverlay.classList.remove("hidden");
  setLandingTab("play");
  refreshLobby();
  if (lobbyTimer) window.clearInterval(lobbyTimer);
  lobbyTimer = window.setInterval(refreshLobby, 8000);
}

function hideLanding() {
  landingOverlay.classList.add("hidden");
  if (lobbyTimer) window.clearInterval(lobbyTimer);
  lobbyTimer = undefined;
}

async function refreshLobby() {
  if (!lobbyListEl) return;
  lobbyListEl.innerHTML = "";
  try {
    const response = await fetch(LOBBY_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed");
    const payload = (await response.json()) as {
      rooms?: { roomId: string; clients: number; maxClients: number }[];
    };
    const rooms = payload.rooms ?? [];
    if (!rooms.length) {
      const empty = document.createElement("div");
      empty.className = "lobby-empty";
      empty.textContent = "No public rooms yet. Start a quick match.";
      lobbyListEl.appendChild(empty);
      return;
    }
    for (const room of rooms) {
      const row = document.createElement("div");
      row.className = "lobby-item";
      const meta = document.createElement("div");
      meta.className = "room-meta";
      const id = document.createElement("div");
      id.className = "room-id";
      id.textContent = `Room ${room.roomId.slice(0, 6)}`;
      const count = document.createElement("div");
      count.className = "room-count";
      count.textContent = `${room.clients}/${room.maxClients} players`;
      meta.appendChild(id);
      meta.appendChild(count);
      const join = document.createElement("button");
      join.className = "ghost-button";
      join.textContent = "Join";
      join.addEventListener("click", async () => {
        modeSelect.value = "online";
        setMode("online");
        await controller.connectOnline(SERVER_URL, room.roomId);
        hideLanding();
      });
      row.appendChild(meta);
      row.appendChild(join);
      lobbyListEl.appendChild(row);
    }
  } catch {
    const empty = document.createElement("div");
    empty.className = "lobby-empty";
    empty.textContent = "Lobby unavailable. Try again.";
    lobbyListEl.appendChild(empty);
  }
}

function setMode(mode: "local" | "online") {
  appEl.dataset.mode = mode;
  controller.setMode(mode);
  if (mode === "local") {
    currentRoomId = undefined;
    roomInfoEl.textContent = "Not connected";
    if (baseConfig) {
      const withName = applyLocalName(baseConfig);
      latestConfig = withName;
      controller.setConfig(withName);
      renderer.setConfig(withName);
      startChoiceResolved = false;
      playerLabel.textContent = localName || "You";
    }
  }
}

function resolveStartingPlayer(config: GameConfig): string | undefined {
  if (!config.players.length) return undefined;
  if (localStartingPlayer === "p1") return config.players[0]?.id;
  if (localStartingPlayer === "p2") return config.players[1]?.id;
  const index = Math.random() < 0.5 ? 0 : 1;
  return config.players[index]?.id;
}

function startLocalMatch() {
  if (!latestConfig) return;
  const startingId = resolveStartingPlayer(latestConfig);
  controller.startLocal({ startingPlayerId: startingId });
  renderAll();
  maybeShowStartOverlay();
}

function applyLocalName(config: GameConfig): GameConfig {
  const next = structuredClone(config) as GameConfig;
  const displayName = localName.trim();
  const displayOpponent = localOpponentName.trim();
  if (displayName && next.players[0]) {
    next.players[0].name = displayName;
  }
  if (displayOpponent && next.players[1]) {
    next.players[1].name = displayOpponent;
  }
  return next;
}

function renderCards() {
  if (!latestState || !latestConfig) return;

  const selection = controller.getSelection();
  const viewPlayerId = controller.getPlayerId() ?? latestState.activePlayerId;
  const playerState = latestState.players.find((p) => p.id === viewPlayerId);
  const opponentState = latestState.players.find((p) => p.id !== viewPlayerId);
  const playerMeta = latestConfig.players.find((p) => p.id === viewPlayerId);
  const opponentMeta = latestConfig.players.find((p) => p.id !== viewPlayerId);
  const playerName = playerMeta?.name ?? "You";
  const opponentName = opponentMeta?.name ?? "Opponent";
  const primaryId = latestConfig.players[0]?.id;
  const viewerId = viewPlayerId;
  const viewerFlip = primaryId && viewerId && viewerId !== primaryId ? -1 : 1;
  const getCardOrientation = (ownerId?: string) => {
    // Card moves are defined in player-local coords (x right, y forward).
    // Render from viewer perspective: own cards unflipped, opponent rotated 180.
    const ownerForward = latestConfig.players.find((p) => p.id === ownerId)?.forward ?? 1;
    const mul = -ownerForward * viewerFlip;
    return { xMul: mul, yMul: mul };
  };
  playerNameEl.textContent = playerName;
  opponentNameEl.textContent = opponentName;
  const playerId = latestConfig.players.find((p) => p.id === viewPlayerId)?.id;
  const opponentId = latestConfig.players.find((p) => p.id !== viewPlayerId)?.id;
  setNameClass(playerNameEl, playerId === primaryId ? "primary" : "secondary");
  setNameClass(opponentNameEl, opponentId === primaryId ? "primary" : "secondary");
  const isPlayerActive = latestState.activePlayerId === viewPlayerId;
  const hasWinner = Boolean(latestState.winnerId);
  playerSection.classList.toggle("active", !hasWinner && isPlayerActive);
  opponentSection.classList.toggle("active", !hasWinner && !isPlayerActive);
  renderCaptured(viewPlayerId);

  const lastMove = latestState.lastMove;
  const swapKey = lastMove ? `${latestState.turn}:${lastMove.playerId}:${lastMove.cardId}` : undefined;
  let swapFromRect: DOMRect | null = null;
  if (lastMove && swapKey !== lastSwapAnimationKey) {
    const currentCardEl = handEl.querySelector(`[data-card-id="${lastMove.cardId}"]`) as HTMLElement | null;
    if (currentCardEl) {
      swapFromRect = currentCardEl.getBoundingClientRect();
    }
  }

  handEl.innerHTML = "";
  opponentHandEl.innerHTML = "";
  if (playerState) {
    const playerOrientation = getCardOrientation(playerState.id);
    for (const cardId of playerState.hand) {
      const card = latestConfig.cards.find((c) => c.id === cardId);
      const cardEl = document.createElement("div");
      cardEl.className = "card";
      cardEl.dataset.cardId = cardId;
      const title = document.createElement("div");
      title.className = "card-title";
      title.textContent = card?.name ?? cardId;
      cardEl.appendChild(title);
      if (!previousHand.includes(cardId)) {
        cardEl.classList.add("reveal");
      }
      if (selection.selectedCardId === cardId) {
        cardEl.classList.add("active");
      }
      if (pendingMove) {
        if (pendingMove.cardIds.includes(cardId)) {
          cardEl.classList.add("choice");
        } else {
          cardEl.classList.add("disabled");
        }
      }
      if (previousPoolCard && previousPoolCard !== latestState.poolCard && cardId === previousPoolCard) {
        cardEl.classList.add("swap-in");
      }
      if (card) {
        const pattern = drawCardPattern(card.moves, playerOrientation.xMul, playerOrientation.yMul);
        cardEl.appendChild(pattern);
      }
      cardEl.addEventListener("click", () => {
        if (pendingMove && pendingMove.cardIds.includes(cardId)) {
          controller.selectCard(cardId);
          controller.tryMove(pendingMove.to.x, pendingMove.to.y);
          controller.clearSelection();
          pendingMove = undefined;
          renderAll();
          return;
        }

        const next = selection.selectedCardId === cardId ? undefined : cardId;
        pendingMove = undefined;
        controller.selectCard(next);
        renderAll();
      });
      handEl.appendChild(cardEl);
    }
  }

  if (opponentState) {
    const opponentOrientation = getCardOrientation(opponentState.id);
    for (const cardId of opponentState.hand) {
      const card = latestConfig.cards.find((c) => c.id === cardId);
      const cardEl = document.createElement("div");
      cardEl.className = "card";
      cardEl.dataset.cardId = cardId;
      const title = document.createElement("div");
      title.className = "card-title";
      title.textContent = card?.name ?? cardId;
      cardEl.appendChild(title);
      if (card) {
        const pattern = drawCardPattern(card.moves, opponentOrientation.xMul, opponentOrientation.yMul);
        cardEl.appendChild(pattern);
      }
      opponentHandEl.appendChild(cardEl);
    }
  }

  poolEl.innerHTML = "";
  const poolCard = latestConfig.cards.find((c) => c.id === latestState.poolCard);
  const poolCardEl = document.createElement("div");
  poolCardEl.className = "card disabled";
  const poolTitle = document.createElement("div");
  poolTitle.className = "card-title";
  poolTitle.textContent = poolCard?.name ?? latestState.poolCard;
  poolCardEl.appendChild(poolTitle);
  if (previousPoolCard && previousPoolCard !== latestState.poolCard) {
    poolCardEl.classList.add("swap-out");
  }
  if (poolCard) {
    const viewerOrientation = getCardOrientation(viewerId);
    const pattern = drawCardPattern(poolCard.moves, viewerOrientation.xMul, viewerOrientation.yMul);
    poolCardEl.appendChild(pattern);
  }
  poolEl.appendChild(poolCardEl);

  if (swapFromRect && lastMove && swapKey) {
    const toRect = poolCardEl.getBoundingClientRect();
    animateCardSwap(lastMove.cardId, swapFromRect, toRect);
    lastSwapAnimationKey = swapKey;
  }

  previousHand = playerState?.hand ?? [];
  previousPoolCard = latestState.poolCard;

  if (cardChoiceHint) {
    const showHint = Boolean(pendingMove);
    cardChoiceHint.classList.toggle("hidden", !showHint);
  }
}

function setNamesEditing(enabled: boolean) {
  namesEditing = enabled;
  appEl.dataset.editing = enabled ? "true" : "false";
  localNameInput.disabled = !enabled;
  localOpponentNameInput.disabled = !enabled;
  startingPlayerSelect.disabled = !enabled;
  if (namesEditBtn) {
    namesEditBtn.setAttribute("aria-pressed", String(enabled));
    namesEditBtn.classList.toggle("active", enabled);
  }
  if (namesEditLabel) {
    namesEditLabel.textContent = enabled ? "Done" : "Edit";
  }

  if (playerNameEditBtn) {
    playerNameEditBtn.setAttribute("aria-pressed", String(enabled));
    playerNameEditBtn.classList.toggle("active", enabled);
  }
}

function renderCaptured(viewPlayerId: string) {
  if (!latestState || !latestConfig) return;
  opponentCapturedEl.innerHTML = "";
  playerCapturedEl.innerHTML = "";

  const deadPieces = latestState.pieces.filter((p) => !p.alive);
  const playerCaptured = deadPieces.filter((p) => p.ownerId !== viewPlayerId);
  const opponentCaptured = deadPieces.filter((p) => p.ownerId === viewPlayerId);
  const primaryId = latestConfig.players[0]?.id;

  for (const piece of playerCaptured) {
    const token = document.createElement("div");
    token.className = "captured-token";
    if (piece.ownerId === primaryId) {
      token.classList.add("primary");
    } else {
      token.classList.add("secondary");
    }
    token.title = piece.typeId;
    playerCapturedEl.appendChild(token);
  }

  for (const piece of opponentCaptured) {
    const token = document.createElement("div");
    token.className = "captured-token";
    if (piece.ownerId === primaryId) {
      token.classList.add("primary");
    } else {
      token.classList.add("secondary");
    }
    token.title = piece.typeId;
    opponentCapturedEl.appendChild(token);
  }
}

function setNameClass(el: HTMLElement, role: "primary" | "secondary") {
  el.classList.remove("primary", "secondary");
  el.classList.add(role);
}

function filterMoves(
  moves: LegalMove[],
  selectedCardId?: string,
  selectedPieceId?: string
): LegalMove[] {
  if (!selectedCardId && !selectedPieceId) return [];
  return moves.filter((move) => {
    if (selectedCardId && move.cardId !== selectedCardId) return false;
    if (selectedPieceId && move.pieceId !== selectedPieceId) return false;
    return true;
  });
}

function drawCardPattern(moves: { x: number; y: number }[], xMul = 1, yMul = 1) {
  const size = 120;
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement("canvas");
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  canvas.className = "card-pattern";
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(dpr, dpr);

  const grid = 5;
  const cell = size / grid;
  const center = { x: 2, y: 2 };

  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(80, 70, 80, 0.5)";
  ctx.lineWidth = 1.4;

  for (let i = 0; i <= grid; i += 1) {
    ctx.beginPath();
    ctx.moveTo(0, i * cell);
    ctx.lineTo(size, i * cell);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i * cell, 0);
    ctx.lineTo(i * cell, size);
    ctx.stroke();
  }

  ctx.fillStyle = "#f3b6c6";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 6.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#9a5d42";
  ctx.strokeStyle = "rgba(65, 40, 30, 0.6)";
  for (const move of moves) {
    const mx = move.x * xMul;
    const my = move.y * yMul;
    const x = center.x + mx;
    const y = center.y - my;
    if (x < 0 || x >= grid || y < 0 || y >= grid) continue;
    const inset = cell * 0.12;
    const sizeCell = cell * 0.76;
    ctx.fillRect(x * cell + inset, y * cell + inset, sizeCell, sizeCell);
    ctx.strokeRect(x * cell + inset, y * cell + inset, sizeCell, sizeCell);
  }

  return canvas;
}

function animateCardSwap(cardId: string, fromRect: DOMRect, toRect: DOMRect) {
  const ghost = document.createElement("div");
  ghost.className = "card card-fly";
  ghost.style.left = `${fromRect.left}px`;
  ghost.style.top = `${fromRect.top}px`;
  ghost.style.width = `${fromRect.width}px`;
  ghost.style.height = `${fromRect.height}px`;
  ghost.style.opacity = "0.95";
  const title = document.createElement("div");
  title.className = "card-title";
  const card = latestConfig?.cards.find((c) => c.id === cardId);
  title.textContent = card?.name ?? cardId;
  ghost.appendChild(title);
  if (card) {
    ghost.appendChild(drawCardPattern(card.moves));
  }
  document.body.appendChild(ghost);

  const dx = toRect.left + (toRect.width - fromRect.width) / 2 - fromRect.left;
  const dy = toRect.top + (toRect.height - fromRect.height) / 2 - fromRect.top;

  requestAnimationFrame(() => {
    ghost.style.transform = `translate(${dx}px, ${dy}px) scale(0.92)`;
    ghost.style.opacity = "0.6";
  });

  const cleanup = () => {
    ghost.remove();
  };
  ghost.addEventListener("transitionend", cleanup, { once: true });
  window.setTimeout(cleanup, 600);
}

function cloneConfig<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function openCustomize() {
  if (!latestConfig) return;
  returnToLandingOnCustomizeClose = false;
  editableConfig = cloneConfig(latestConfig);
  selectedCardIndex = 0;
  renderCustomize();
  overlay.classList.remove("hidden");
}

function closeCustomize() {
  overlay.classList.add("hidden");
  if (returnToLandingOnCustomizeClose) {
    returnToLandingOnCustomizeClose = false;
    showLanding();
  }
}

function renderCustomize() {
  if (!editableConfig) return;
  renderCardList();
  renderCardEditor();
}

function renderCardList() {
  if (!editableConfig) return;
  cardListEl.innerHTML = "";
  editableConfig.cards.forEach((card, index) => {
    const pill = document.createElement("div");
    pill.className = "card-pill";
    if (index === selectedCardIndex) pill.classList.add("active");
    pill.textContent = card.name || card.id;
    pill.addEventListener("click", () => {
      selectedCardIndex = index;
      renderCustomize();
    });
    cardListEl.appendChild(pill);
  });
}

function renderCardEditor() {
  if (!editableConfig) return;
  const card = editableConfig.cards[selectedCardIndex];
  if (!card) return;
  cardNameInput.value = card.name;
  moveListEl.innerHTML = "";
  renderCardGrid(card);

  card.moves.forEach((move, index) => {
    const row = document.createElement("div");
    row.className = "move-row";
    row.textContent = `(${move.x}, ${move.y})`;
    const remove = document.createElement("button");
    remove.className = "ghost-button";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      card.moves.splice(index, 1);
      renderCardEditor();
    });
    row.appendChild(remove);
    moveListEl.appendChild(row);
  });
}

const GRID_VALUES = [-2, -1, 0, 1, 2];

function renderCardGrid(card: { moves: { x: number; y: number }[] }) {
  cardGridEl.innerHTML = "";
  const moveSet = new Set(card.moves.map((m) => `${m.x},${m.y}`));

  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const moveX = GRID_VALUES[col];
      const moveY = GRID_VALUES[4 - row];
      const key = `${moveX},${moveY}`;
      const cell = document.createElement("div");
      cell.className = "grid-cell";
      if (moveSet.has(key)) {
        cell.classList.add("active");
      }
      cell.addEventListener("click", () => {
        const index = card.moves.findIndex((m) => m.x === moveX && m.y === moveY);
        if (index >= 0) {
          card.moves.splice(index, 1);
        } else {
          card.moves.push({ x: moveX, y: moveY });
        }
        renderCardEditor();
      });
      cardGridEl.appendChild(cell);
    }
  }
}

function addMove() {
  if (!editableConfig) return;
  const card = editableConfig.cards[selectedCardIndex];
  if (!card) return;
  const x = Number(moveXInput.value);
  const y = Number(moveYInput.value);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  card.moves.push({ x: Math.trunc(x), y: Math.trunc(y) });
  moveXInput.value = "";
  moveYInput.value = "";
  renderCardEditor();
}

function createCardId(baseName: string, existing: Set<string>) {
  let id = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!id) id = "card";
  let unique = id;
  let suffix = 2;
  while (existing.has(unique)) {
    unique = `${id}_${suffix}`;
    suffix += 1;
  }
  return unique;
}

function addCard() {
  if (!editableConfig) return;
  const name = `New Card ${editableConfig.cards.length + 1}`;
  const existingIds = new Set(editableConfig.cards.map((c) => c.id));
  const id = createCardId(name, existingIds);
  editableConfig.cards.push({
    id,
    name,
    moves: [{ x: 0, y: 1 }]
  });
  editableConfig.deck = editableConfig.cards.map((c) => c.id);
  selectedCardIndex = editableConfig.cards.length - 1;
  renderCustomize();
}

function removeCard() {
  if (!editableConfig) return;
  if (editableConfig.cards.length <= 1) return;
  const removed = editableConfig.cards.splice(selectedCardIndex, 1)[0];
  editableConfig.deck = editableConfig.deck.filter((id) => id !== removed.id);
  selectedCardIndex = Math.max(0, selectedCardIndex - 1);
  renderCustomize();
}

function applyCardChanges() {
  if (!editableConfig) return;
  try {
    editableConfig.deck = editableConfig.cards.map((card) => card.id);
    const validated = validateConfig(editableConfig);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
    baseConfig = validated;
    const localConfig = applyLocalName(validated);
    latestConfig = localConfig;
    controller.setConfig(localConfig);
    renderer.setConfig(localConfig);
    startChoiceResolved = true;
    startLocalMatch();
    playerLabel.textContent = localName || "You";
    previousHand = [];
    previousPoolCard = undefined;
    closeCustomize();
  } catch (error) {
    statusEl.textContent = "Invalid card configuration.";
  }
}

function resetCardChanges() {
  localStorage.removeItem(STORAGE_KEY);
  editableConfig = undefined;
  bootstrap();
  closeCustomize();
}

function exportConfig() {
  if (!editableConfig) return;
  const data = JSON.stringify(editableConfig, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "game-config.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function showVictory(winnerName: string) {
  victoryTitle.textContent = `${winnerName} Wins!`;
  victorySubtitle.textContent = "A masterful duel.";
  victoryOverlay.classList.remove("hidden");
  triggerConfetti();
}

function hideVictory() {
  victoryOverlay.classList.add("hidden");
}

function triggerConfetti() {
  let container = document.getElementById("confetti");
  if (!container) {
    container = document.createElement("div");
    container.id = "confetti";
    document.body.appendChild(container);
  }
  container.innerHTML = "";
  const colors = ["#f472b6", "#f97316", "#facc15", "#34d399", "#60a5fa"];
  for (let i = 0; i < 80; i += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    const left = Math.random() * 100;
    const delay = Math.random() * 0.4;
    const duration = 1.2 + Math.random() * 0.8;
    piece.style.left = `${left}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${delay}s`;
    piece.style.animationDuration = `${duration}s`;
    container.appendChild(piece);
  }
  setTimeout(() => {
    container?.remove();
  }, 2200);
}

function createConfigWithDeck(deck: string[]): GameConfig {
  if (!baseConfig) throw new Error("Missing base config.");
  const next = structuredClone(baseConfig) as GameConfig;
  next.deck = deck;
  return validateConfig(next);
}

function startWithDeck(deck: string[]) {
  try {
    const validated = createConfigWithDeck(deck);
    baseConfig = validated;
    const localConfig = applyLocalName(validated);
    latestConfig = localConfig;
    controller.setConfig(localConfig);
    renderer.setConfig(localConfig);
    startChoiceResolved = true;
    startLocalMatch();
    playerLabel.textContent = localName || "You";
    previousHand = [];
    previousPoolCard = undefined;
    hideVictory();
    draftOverlay.classList.add("hidden");
    startOverlay.classList.add("hidden");
  } catch {
    statusEl.textContent = "Deck selection invalid.";
  }
}

function startRandomFive() {
  if (modeSelect.value !== "local") {
    statusEl.textContent = "Random deck is available for local matches only.";
    return;
  }
  if (!baseConfig) return;
  startChoiceResolved = true;
  const candidates = [...baseConfig.cards];
  const selection: string[] = [];
  while (selection.length < 5 && candidates.length > 0) {
    const index = Math.floor(Math.random() * candidates.length);
    const [card] = candidates.splice(index, 1);
    if (card) selection.push(card.id);
  }
  startWithDeck(selection);
}

function openDraft() {
  if (modeSelect.value !== "local") {
    statusEl.textContent = "Deck selection is available for local matches only.";
    return;
  }
  if (!baseConfig) return;
  startChoiceResolved = true;
  draftSelection = new Set();
  renderDraft();
  draftOverlay.classList.remove("hidden");
}

function maybeShowStartOverlay() {
  if (modeSelect.value !== "local") return;
  if (startChoiceResolved) return;
  startOverlay.classList.remove("hidden");
}

function renderDraft() {
  if (!baseConfig) return;
  draftGrid.innerHTML = "";
  if (draftSelectedEl) {
    draftSelectedEl.innerHTML = "";
  }
  for (const card of baseConfig.cards) {
    const item = document.createElement("div");
    item.className = "draft-item";
    if (draftSelection.has(card.id)) item.classList.add("selected");
    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = card.name;
    const pattern = drawCardPattern(card.moves);
    item.appendChild(title);
    item.appendChild(pattern);
    item.addEventListener("click", () => {
      if (draftSelection.has(card.id)) {
        draftSelection.delete(card.id);
      } else if (draftSelection.size < 5) {
        draftSelection.add(card.id);
      }
      renderDraft();
    });
    draftGrid.appendChild(item);
  }
  draftCount.textContent = `${draftSelection.size} / 5 selected`;
  draftStartBtn.disabled = draftSelection.size !== 5;

  if (draftSelectedEl) {
    for (const cardId of draftSelection) {
      const card = baseConfig.cards.find((c) => c.id === cardId);
      if (!card) continue;
      const item = document.createElement("div");
      item.className = "draft-selected-item";
      const title = document.createElement("div");
      title.className = "card-title";
      title.textContent = card.name;
    const pattern = drawCardPattern(card.moves);
      item.appendChild(title);
      item.appendChild(pattern);
      draftSelectedEl.appendChild(item);
    }
  }
}

async function bootstrap() {
  try {
    const fallback = validateConfig(defaultConfig);
    baseConfig = fallback;
    const localFallback = applyLocalName(fallback);
    latestConfig = localFallback;
    controller.setConfig(localFallback);
    renderer.setConfig(localFallback);
    playerLabel.textContent = localName || "You";

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = validateConfig(JSON.parse(stored));
      baseConfig = parsed;
      const localParsed = applyLocalName(parsed);
      latestConfig = localParsed;
      controller.setConfig(localParsed);
      renderer.setConfig(localParsed);
      startChoiceResolved = false;
      playerLabel.textContent = localName || "You";
    } else {
      try {
        await controller.loadConfig(CONFIG_URL);
        const loaded = controller.getConfig();
        if (loaded) {
          baseConfig = loaded;
          const localLoaded = applyLocalName(loaded);
          latestConfig = localLoaded;
          controller.setConfig(localLoaded);
          renderer.setConfig(localLoaded);
          if (modeSelect.value === "local") {
            startChoiceResolved = false;
            playerLabel.textContent = localName || "You";
          }
        }
      } catch {
        statusEl.textContent = "Using local defaults.";
      }
    }
  } catch (error) {
    statusEl.textContent = "Failed to load config.";
  }
}

modeSelect.addEventListener("change", () => {
  const mode = modeSelect.value === "online" ? "online" : "local";
  setMode(mode);
  if (mode === "local") {
    startChoiceResolved = false;
  } else {
    startOverlay.classList.add("hidden");
  }
});

connectBtn.addEventListener("click", async () => {
  if (modeSelect.value === "local") {
    startChoiceResolved = false;
    startOverlay.classList.remove("hidden");
    return;
  }

  await controller.connectOnline(SERVER_URL, roomInput.value.trim() || undefined);
  hideLanding();
});

quickOnlineBtn.addEventListener("click", async () => {
  modeSelect.value = "online";
  setMode("online");
  roomInput.value = "";
  await controller.connectOnline(SERVER_URL);
  hideLanding();
});

copyRoomBtn.addEventListener("click", async () => {
  if (!currentRoomId) {
    statusEl.textContent = "No room code yet.";
    return;
  }
  try {
    await navigator.clipboard.writeText(currentRoomId);
    statusEl.textContent = "Room code copied.";
  } catch {
    statusEl.textContent = "Copy failed. Select and copy the room code.";
  }
});

restartLocalBtn.addEventListener("click", () => {
  startChoiceResolved = false;
  startOverlay.classList.remove("hidden");
});

newGameBtn.addEventListener("click", () => {
  roomInfoEl.textContent = "Not connected";
  roomInput.value = "";
  controller.disconnectOnline();
  statusEl.textContent = "Choose how you want to play.";
  startOverlay.classList.add("hidden");
  draftOverlay.classList.add("hidden");
  victoryOverlay.classList.add("hidden");
  overlay.classList.add("hidden");
  showLanding();
});

landingCloseBtn.addEventListener("click", hideLanding);
landingTabPlay?.addEventListener("click", () => setLandingTab("play"));
landingTabRules?.addEventListener("click", () => setLandingTab("rules"));
landingLocalBtn.addEventListener("click", () => {
  modeSelect.value = "local";
  setMode("local");
  startChoiceResolved = false;
  startOverlay.classList.remove("hidden");
  hideLanding();
});
landingOnlineBtn.addEventListener("click", () => {
  modeSelect.value = "online";
  setMode("online");
  refreshLobby();
});
landingCustomizeBtn.addEventListener("click", () => {
  returnToLandingOnCustomizeClose = true;
  hideLanding();
  openCustomize();
});
lobbyRefreshBtn.addEventListener("click", refreshLobby);
lobbyQuickBtn.addEventListener("click", async () => {
  modeSelect.value = "online";
  setMode("online");
  await controller.connectOnline(SERVER_URL);
  hideLanding();
});
lobbyCreateBtn.addEventListener("click", async () => {
  modeSelect.value = "online";
  setMode("online");
  await controller.connectOnline(SERVER_URL);
  hideLanding();
});

toggleViewBtn.textContent = viewMode === "3d" ? "2D View" : "3D View";
toggleViewBtn.addEventListener("click", () => {
  viewMode = viewMode === "3d" ? "2d" : "3d";
  localStorage.setItem(VIEW_MODE_KEY, viewMode);
  renderer.setViewMode(viewMode);
  toggleViewBtn.textContent = viewMode === "3d" ? "2D View" : "3D View";
});

localNameInput.value = localName;
playerNameEl.textContent = localName || "You";
opponentNameEl.textContent = localOpponentName || "Opponent";
setNamesEditing(!localName && !localOpponentName);
namesEditBtn?.addEventListener("click", () => {
  setNamesEditing(!namesEditing);
});
playerNameEditBtn?.addEventListener("click", () => {
  setNamesEditing(!namesEditing);
});
localNameInput.addEventListener("input", () => {
  localName = localNameInput.value;
  localStorage.setItem(LOCAL_NAME_KEY, localName);
  if (baseConfig) {
    const localConfig = applyLocalName(baseConfig);
    latestConfig = localConfig;
    controller.setConfig(localConfig);
    renderer.setConfig(localConfig);
    playerLabel.textContent = localName || "You";
    renderAll();
  }
});

localOpponentNameInput.value = localOpponentName;
opponentNameEl.textContent = localOpponentName || "Opponent";
localOpponentNameInput.addEventListener("input", () => {
  localOpponentName = localOpponentNameInput.value;
  localStorage.setItem(LOCAL_OPPONENT_NAME_KEY, localOpponentName);
  if (baseConfig) {
    const localConfig = applyLocalName(baseConfig);
    latestConfig = localConfig;
    controller.setConfig(localConfig);
    renderer.setConfig(localConfig);
    renderAll();
  }
});

startingPlayerSelect.value = localStartingPlayer;
startingPlayerSelect.addEventListener("change", () => {
  localStartingPlayer = startingPlayerSelect.value;
  localStorage.setItem(LOCAL_START_KEY, localStartingPlayer);
});

customizeBtn.addEventListener("click", openCustomize);
openCustomizeBtn.addEventListener("click", openCustomize);
closeBtn.addEventListener("click", closeCustomize);
overlay.addEventListener("click", (event) => {
  if (event.target === overlay) closeCustomize();
});
cardNameInput.addEventListener("input", () => {
  if (!editableConfig) return;
  const card = editableConfig.cards[selectedCardIndex];
  if (!card) return;
  card.name = cardNameInput.value;
  renderCardList();
});
moveAddBtn.addEventListener("click", addMove);
cardAddBtn.addEventListener("click", addCard);
cardRemoveBtn.addEventListener("click", removeCard);
cardsApplyBtn.addEventListener("click", applyCardChanges);
cardsResetBtn.addEventListener("click", resetCardChanges);
cardsExportBtn.addEventListener("click", exportConfig);

victoryCloseBtn.addEventListener("click", hideVictory);
victoryRandomBtn.addEventListener("click", startRandomFive);
victoryChooseBtn.addEventListener("click", openDraft);
victoryOverlay.addEventListener("click", (event) => {
  if (event.target === victoryOverlay) hideVictory();
});

startRandomBtn.addEventListener("click", startRandomFive);
startChooseBtn.addEventListener("click", openDraft);

draftCloseBtn.addEventListener("click", () => {
  draftOverlay.classList.add("hidden");
});
draftOverlay.addEventListener("click", (event) => {
  if (event.target === draftOverlay) draftOverlay.classList.add("hidden");
});
draftStartBtn.addEventListener("click", () => {
  if (draftSelection.size !== 5) return;
  startWithDeck([...draftSelection]);
});

appEl.dataset.mode = "local";
bootstrap();
showLanding();
