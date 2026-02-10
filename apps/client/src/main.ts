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
const playerLabel = document.getElementById("player-label") as HTMLElement;
const playerNameEl = document.getElementById("player-name") as HTMLElement;
const opponentNameEl = document.getElementById("opponent-name") as HTMLElement;
const playerSection = document.getElementById("player-section") as HTMLElement;
const opponentSection = document.getElementById("opponent-section") as HTMLElement;
const toggleViewBtn = document.getElementById("toggle-view") as HTMLButtonElement;
const handEl = document.getElementById("hand") as HTMLElement;
const opponentHandEl = document.getElementById("opponent-hand") as HTMLElement;
const poolEl = document.getElementById("pool") as HTMLElement;
const canvasContainer = document.getElementById("canvas-container") as HTMLElement;
const customizeBtn = document.getElementById("customize-cards") as HTMLButtonElement;
const overlay = document.getElementById("customize-overlay") as HTMLElement;
const closeBtn = document.getElementById("customize-close") as HTMLButtonElement;
const cardListEl = document.getElementById("card-list") as HTMLElement;
const cardNameInput = document.getElementById("card-name") as HTMLInputElement;
const moveListEl = document.getElementById("move-list") as HTMLElement;
const moveXInput = document.getElementById("move-x") as HTMLInputElement;
const moveYInput = document.getElementById("move-y") as HTMLInputElement;
const moveAddBtn = document.getElementById("move-add") as HTMLButtonElement;
const cardAddBtn = document.getElementById("card-add") as HTMLButtonElement;
const cardRemoveBtn = document.getElementById("card-remove") as HTMLButtonElement;
const cardsApplyBtn = document.getElementById("cards-apply") as HTMLButtonElement;
const cardsResetBtn = document.getElementById("cards-reset") as HTMLButtonElement;
const cardsExportBtn = document.getElementById("cards-export") as HTMLButtonElement;

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

const renderer = new GameRenderer(canvasContainer, {
  onCellTap: (x, y) => {
    controller.tryMove(x, y);
    controller.clearSelection();
    renderAll();
  },
  onPieceTap: (pieceId) => {
    if (!latestState || !latestConfig) return;
    if (!controller.canAct()) return;

    const piece = latestState.pieces.find((p) => p.id === pieceId);
    if (!piece || !piece.alive) return;
    if (piece.ownerId !== latestState.activePlayerId) return;

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

  if (modeSelect.value === "local" && latestConfig.players[0]) {
    const flip = latestState.activePlayerId !== latestConfig.players[0].id;
    renderer.setBoardFlip(flip);
  } else {
    renderer.setBoardFlip(false);
  }

  if (latestState.winnerId) {
    const winnerName =
      latestConfig.players.find((p) => p.id === latestState.winnerId)?.name ??
      latestState.winnerId;
    statusEl.textContent = `Winner: ${winnerName}`;
  } else {
    const activeName =
      latestConfig.players.find((p) => p.id === latestState.activePlayerId)?.name ??
      latestState.activePlayerId;
    statusEl.textContent = `Turn ${latestState.turn} · ${activeName}`;
  }

  updateStartedUI();
}

function updateStartedUI() {
  const started = Boolean(latestState && !latestState.winnerId);
  appEl.dataset.started = started ? "true" : "false";
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
      startLocalMatch();
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
  const playerName = latestConfig.players.find((p) => p.id === viewPlayerId)?.name ?? "You";
  const opponentName = latestConfig.players.find((p) => p.id !== viewPlayerId)?.name ?? "Opponent";
  playerNameEl.textContent = playerName;
  opponentNameEl.textContent = opponentName;
  const isPlayerActive = latestState.activePlayerId === viewPlayerId;
  const hasWinner = Boolean(latestState.winnerId);
  playerSection.classList.toggle("active", !hasWinner && isPlayerActive);
  opponentSection.classList.toggle("active", !hasWinner && !isPlayerActive);

  handEl.innerHTML = "";
  opponentHandEl.innerHTML = "";
  if (playerState) {
    for (const cardId of playerState.hand) {
      const card = latestConfig.cards.find((c) => c.id === cardId);
      const cardEl = document.createElement("div");
      cardEl.className = "card";
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
      if (previousPoolCard && previousPoolCard !== latestState.poolCard && cardId === previousPoolCard) {
        cardEl.classList.add("swap-in");
      }
      if (card) {
        const pattern = drawCardPattern(card.moves);
        cardEl.appendChild(pattern);
      }
      cardEl.addEventListener("click", () => {
        const next = selection.selectedCardId === cardId ? undefined : cardId;
        controller.selectCard(next);
        renderAll();
      });
      handEl.appendChild(cardEl);
    }
  }

  if (opponentState) {
    const revealOpponent = controller.getPlayerId() === undefined;
    for (const cardId of opponentState.hand) {
      const card = latestConfig.cards.find((c) => c.id === cardId);
      const cardEl = document.createElement("div");
      cardEl.className = "card";
      if (!revealOpponent) {
        cardEl.classList.add("back");
        const title = document.createElement("div");
        title.className = "card-title";
        title.textContent = "Hidden";
        cardEl.appendChild(title);
      } else {
        const title = document.createElement("div");
        title.className = "card-title";
        title.textContent = card?.name ?? cardId;
        cardEl.appendChild(title);
        if (card) {
          const pattern = drawCardPattern(card.moves);
          cardEl.appendChild(pattern);
        }
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
    const pattern = drawCardPattern(poolCard.moves);
    poolCardEl.appendChild(pattern);
  }
  poolEl.appendChild(poolCardEl);

  previousHand = playerState?.hand ?? [];
  previousPoolCard = latestState.poolCard;
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

function drawCardPattern(moves: { x: number; y: number }[]) {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas.className = "card-pattern";
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const center = { x: 2, y: 2 };
  const cell = size / 5;

  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(220, 170, 200, 0.25)";
  ctx.lineWidth = 1;

  for (let i = 0; i <= 5; i += 1) {
    ctx.beginPath();
    ctx.moveTo(0, i * cell);
    ctx.lineTo(size, i * cell);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i * cell, 0);
    ctx.lineTo(i * cell, size);
    ctx.stroke();
  }

  ctx.fillStyle = "#7b4d3a";
  ctx.beginPath();
  ctx.arc((center.x + 0.5) * cell, (center.y + 0.5) * cell, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#c6463a";
  for (const move of moves) {
    const x = center.x + move.x;
    const y = center.y - move.y;
    if (x < 0 || x > 4 || y < 0 || y > 4) continue;
    ctx.beginPath();
    ctx.arc((x + 0.5) * cell, (y + 0.5) * cell, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

function cloneConfig<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function openCustomize() {
  if (!latestConfig) return;
  editableConfig = cloneConfig(latestConfig);
  selectedCardIndex = 0;
  renderCustomize();
  overlay.classList.remove("hidden");
}

function closeCustomize() {
  overlay.classList.add("hidden");
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

async function bootstrap() {
  try {
    const fallback = validateConfig(defaultConfig);
    baseConfig = fallback;
    const localFallback = applyLocalName(fallback);
    latestConfig = localFallback;
    controller.setConfig(localFallback);
    renderer.setConfig(localFallback);
    startLocalMatch();
    playerLabel.textContent = localName || "You";

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = validateConfig(JSON.parse(stored));
      baseConfig = parsed;
      const localParsed = applyLocalName(parsed);
      latestConfig = localParsed;
      controller.setConfig(localParsed);
      renderer.setConfig(localParsed);
      startLocalMatch();
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
            startLocalMatch();
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
});

connectBtn.addEventListener("click", async () => {
  if (modeSelect.value === "local") {
    startLocalMatch();
    return;
  }

  await controller.connectOnline(SERVER_URL, roomInput.value.trim() || undefined);
});

quickOnlineBtn.addEventListener("click", async () => {
  modeSelect.value = "online";
  setMode("online");
  roomInput.value = "";
  await controller.connectOnline(SERVER_URL);
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
  startLocalMatch();
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

appEl.dataset.mode = "local";
bootstrap();
