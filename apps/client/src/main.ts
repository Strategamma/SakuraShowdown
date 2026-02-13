import "./styles.css";
import { listLegalMoves, validateConfig } from "@game/rules";
import type { GameConfig, GameState, LegalMove } from "@game/rules";
import { GameController } from "./game/controller";
import { GameRenderer } from "./game/renderer";
import defaultConfig from "./game/defaultConfig";
import { sound } from "./sound";

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
const PRIVATE_URL = SERVER_URL.startsWith("ws")
  ? `${SERVER_URL.replace(/^ws/, "http")}/private`
  : `${SERVER_URL.replace(/\/$/, "")}/private`;
const STORAGE_KEY = "sakura.customConfig";
const LOCAL_NAME_KEY = "sakura.localName";
const LOCAL_OPPONENT_NAME_KEY = "sakura.localOpponentName";
const LOCAL_START_KEY = "sakura.localStartingPlayer";
const VIEW_MODE_KEY = "sakura.viewMode";
const ONLINE_NAME_KEY = "sakura.onlineName";
const RECONNECT_KEY = "sakura.reconnectToken";

const statusEl = document.getElementById("status") as HTMLElement;
const appEl = document.getElementById("app") as HTMLElement;
const localNameInput = document.getElementById("local-name") as HTMLInputElement;
const localOpponentNameInput = document.getElementById("local-opponent-name") as HTMLInputElement;
const startingPlayerSelect = document.getElementById("starting-player") as HTMLSelectElement;
const namesEditBtn = document.getElementById("names-edit") as HTMLButtonElement;
const namesEditLabel = namesEditBtn?.querySelector(".icon-label") as HTMLElement;
const namesSaveBtn = document.getElementById("names-save") as HTMLButtonElement | null;
const playerLabel = document.getElementById("player-label") as HTMLElement;
const roomCodeEl = document.getElementById("room-code") as HTMLElement;
const playerNameEl = document.getElementById("player-name") as HTMLElement;
const opponentNameEl = document.getElementById("opponent-name") as HTMLElement;
const playerSection = document.getElementById("player-section") as HTMLElement;
const opponentSection = document.getElementById("opponent-section") as HTMLElement;
const cardChoiceHint = document.getElementById("card-choice-hint") as HTMLElement;
const playerNameEditBtn = document.getElementById("player-name-edit") as HTMLButtonElement | null;
const playerNameSaveBtn = document.getElementById("player-name-save") as HTMLButtonElement | null;
const rotateBoardBtn = document.getElementById("rotate-board") as HTMLButtonElement | null;
const exitOnlineBtn = document.getElementById("exit-online") as HTMLButtonElement | null;
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
const victoryRematchBtn = document.getElementById("victory-rematch") as HTMLButtonElement | null;
const victoryLobbyBtn = document.getElementById("victory-lobby") as HTMLButtonElement | null;
const victoryWaitEl = document.getElementById("victory-wait") as HTMLElement | null;
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
const landingCustomizeBtn = document.getElementById("landing-customize") as HTMLButtonElement;
const landingActionsOnline = document.getElementById("landing-actions-online") as HTMLElement | null;
const spectatorOverlay = document.getElementById("spectator-overlay") as HTMLElement;
const spectatorBackBtn = document.getElementById("spectator-back") as HTMLButtonElement | null;
const spectatorContinueBtn = document.getElementById("spectator-continue") as HTMLButtonElement | null;
const spectatorCloseBtn = document.getElementById("spectator-close") as HTMLButtonElement | null;
const lobbyOverlay = document.getElementById("lobby-overlay") as HTMLElement | null;
const lobbyTitle = document.getElementById("lobby-title") as HTMLElement | null;
const lobbySubtitle = document.getElementById("lobby-subtitle") as HTMLElement | null;
const lobbyRoomCodeEl = document.getElementById("lobby-room-code") as HTMLElement | null;
const lobbyPlayersEl = document.getElementById("lobby-players") as HTMLElement | null;
const lobbyReadyToggle = document.getElementById("lobby-ready") as HTMLInputElement | null;
const lobbyBackBtn = document.getElementById("lobby-back") as HTMLButtonElement | null;
const lobbyCloseBtn = document.getElementById("lobby-close") as HTMLButtonElement | null;
const lobbySandboxEl = document.getElementById("lobby-sandbox") as HTMLElement | null;
const lobbySandboxNote = document.getElementById("lobby-sandbox-note") as HTMLElement | null;
const lobbyDeckWrap = document.getElementById("lobby-deck") as HTMLElement | null;
const lobbyDeckList = document.getElementById("lobby-deck-list") as HTMLElement | null;
const lobbyCustomizeBtn = document.getElementById("lobby-customize") as HTMLButtonElement | null;
const lobbyRandomBtn = document.getElementById("lobby-random") as HTMLButtonElement | null;
const lobbyChooseBtn = document.getElementById("lobby-choose") as HTMLButtonElement | null;
const onlineNameInput = document.getElementById("online-name") as HTMLInputElement | null;
const landingTabLocal = document.getElementById("landing-tab-local") as HTMLButtonElement | null;
const landingTabOnline = document.getElementById("landing-tab-online") as HTMLButtonElement | null;
const landingRulesBtn = document.getElementById("landing-rules") as HTMLButtonElement | null;
const landingPanelLocal = document.getElementById("landing-panel-local") as HTMLElement | null;
const landingPanelOnline = document.getElementById("landing-panel-online") as HTMLElement | null;
const landingPanelRules = document.getElementById("landing-panel-rules") as HTMLElement | null;
const lobbyListEl = document.getElementById("lobby-list") as HTMLElement;
const lobbyRefreshBtn = document.getElementById("lobby-refresh") as HTMLButtonElement;
const lobbyCreateBtn = document.getElementById("lobby-create") as HTMLButtonElement;
const privateKeyInput = document.getElementById("private-key") as HTMLInputElement | null;
const privateJoinBtn = document.getElementById("private-join") as HTMLButtonElement | null;
const privateCreateBtn = document.getElementById("private-create") as HTMLButtonElement | null;

appEl.dataset.started = "false";
document.body.dataset.mode = appEl.dataset.mode || "local";
document.body.dataset.cards = "canvas";

const unlockSound = () => sound.unlock();
window.addEventListener("pointerdown", unlockSound, { once: true });
window.addEventListener("keydown", unlockSound, { once: true });

let cardHintOverlay: HTMLElement | null = null;
let canvasNameTop: HTMLElement | null = null;
let canvasNameBottom: HTMLElement | null = null;
let canvasCheckTop: HTMLElement | null = null;
let canvasCheckBottom: HTMLElement | null = null;
let boardRotation = 0;
if (
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(pointer: coarse)").matches
) {
  boardRotation = 90;
}
if (canvasContainer) {
  cardHintOverlay = document.createElement("div");
  cardHintOverlay.id = "card-choice-overlay";
  cardHintOverlay.className = "card-hint board-hint hidden";
  cardHintOverlay.textContent = "Choose card to discard";
  canvasContainer.appendChild(cardHintOverlay);

  canvasNameTop = document.createElement("div");
  canvasNameTop.className = "canvas-nameplate top";
  canvasContainer.appendChild(canvasNameTop);

  canvasNameBottom = document.createElement("div");
  canvasNameBottom.className = "canvas-nameplate bottom";
  canvasContainer.appendChild(canvasNameBottom);

  canvasCheckTop = document.createElement("div");
  canvasCheckTop.className = "canvas-check top";
  canvasCheckTop.textContent = "CHECK";
  canvasContainer.appendChild(canvasCheckTop);

  canvasCheckBottom = document.createElement("div");
  canvasCheckBottom.className = "canvas-check bottom";
  canvasCheckBottom.textContent = "CHECK";
  canvasContainer.appendChild(canvasCheckBottom);

  canvasContainer.dataset.rotation = String(boardRotation);
}

let latestConfig: GameConfig | undefined;
let latestState: GameState | undefined;
let latestMoves: LegalMove[] = [];
let editableConfig: GameConfig | undefined;
let selectedCardIndex = 0;
let currentRoomId: string | undefined;
let currentRoomCode: string | undefined;
let currentRoomPrivate = false;
let baseConfig: GameConfig | undefined;
let localName = localStorage.getItem(LOCAL_NAME_KEY) ?? "";
let localOpponentName = localStorage.getItem(LOCAL_OPPONENT_NAME_KEY) ?? "";
let localStartingPlayer = localStorage.getItem(LOCAL_START_KEY) ?? "random";
let viewMode = (localStorage.getItem(VIEW_MODE_KEY) as "2d" | "3d" | null) ?? "3d";
let onlineName = localStorage.getItem(ONLINE_NAME_KEY) ?? "";
let reconnectToken = localStorage.getItem(RECONNECT_KEY) ?? "";
let currentMode: "local" | "online" = "local";
let draftSelection = new Set<string>();
let lastWinnerId: string | undefined;
let pendingMove:
  | { pieceId: string; to: { x: number; y: number }; cardIds: string[] }
  | undefined;
let startChoiceResolved = false;
let namesEditing = false;
let lobbyTimer: number | undefined;
let returnToLandingOnCustomizeClose = false;
let noticeTimeout: number | undefined;
let rematchPending = false;
let isSpectator = false;
let lobbyBusy = false;
let spectatorNoticeHidden = false;
let landingTab: "local" | "online" = "local";
let rulesVisible = false;
let onlineReadyIds = new Set<string>();
let onlineGameStarted = true;
let customizeScope: "local" | "lobby" = "local";
let returnToLobbyOnCustomizeClose = false;
let draftMode: "local" | "online" = "local";
let draftConfig: GameConfig | undefined;
let lastActivePlayerId: string | undefined;
let lastReadyAll = false;

const controller = new GameController({
  onState: (state) => {
    const previous = latestState;
    latestState = state;
    latestMoves = controller.getLegalMoves();
    if (previous) {
      const prevPieces = new Map(previous.pieces.map((piece) => [piece.id, piece]));
      const nextPieces = new Map(state.pieces.map((piece) => [piece.id, piece]));
      let moved = false;
      let captured = false;
      for (const [id, next] of nextPieces) {
        const prev = prevPieces.get(id);
        if (!prev) continue;
        if (prev.alive && !next.alive) {
          captured = true;
        } else if (prev.alive && next.alive && (prev.x !== next.x || prev.y !== next.y)) {
          moved = true;
        }
      }
      if (captured) {
        sound.play("slash");
      } else if (moved) {
        sound.play("move");
      }
      if (!previous.winnerId && state.winnerId) {
        sound.play("victory");
      }
    }
    renderAll();
  },
  onConfig: (config) => {
    latestConfig = config;
    renderer.setConfig(config);
    renderAll();
    renderLobbyOverlay();
  },
  onStatus: (message) => {
    statusEl.textContent = message;
  },
  onRoom: (roomId) => {
    currentRoomId = roomId;
    statusEl.textContent = `Online match ready · Room ${roomId}`;
    updateRoomCode();
  },
  onRoomInfo: (info) => {
    currentRoomId = info.roomId;
    currentRoomCode = info.code;
    currentRoomPrivate = Boolean(info.private);
    if (typeof info.started === "boolean") {
      onlineGameStarted = info.started;
    }
    if (info.code) {
      statusEl.textContent = `Online match ready · ${info.code}`;
    } else {
      statusEl.textContent = "Online match ready.";
    }
    updateRoomCode();
    updateLobbyOverlay();
  },
  onPlayer: (playerId) => {
    if (!playerId) {
      playerLabel.textContent = "Spectator";
      setSpectatorMode(true);
      updateLobbyOverlay();
      return;
    }
    setSpectatorMode(false);
    const label = latestConfig?.players.find((p) => p.id === playerId)?.name ?? playerId;
    playerLabel.textContent = label;
    renderLobbyOverlay();
  },
  onNotice: (message) => {
    showNotice(message);
    const lower = message.toLowerCase();
    if (lower.includes("joined")) {
      sound.play("door");
    } else if (lower.includes("left") || lower.includes("disconnected")) {
      sound.play("disconnect");
    }
  },
  onRematchStart: () => {
    setRematchPending(false);
    hideVictory();
    lastWinnerId = undefined;
    statusEl.textContent = "Rematch started.";
  },
  onRematchCancel: () => {
    setRematchPending(false);
    controller.disconnectOnline();
    setReconnectToken("");
    statusEl.textContent = "Opponent left. Back to lobby.";
    setSpectatorMode(false);
    currentRoomId = undefined;
    currentRoomCode = undefined;
    currentRoomPrivate = false;
    onlineReadyIds = new Set();
    onlineGameStarted = true;
    updateRoomCode();
    showLanding("online");
  },
  onLeave: () => {
    if (currentMode !== "online") return;
    if (latestState?.winnerId) {
      setReconnectToken("");
      statusEl.textContent = "Match ended. Back to lobby.";
    } else {
      statusEl.textContent = "Disconnected. You can resume from the lobby.";
    }
    setSpectatorMode(false);
    currentRoomId = undefined;
    currentRoomCode = undefined;
    currentRoomPrivate = false;
    onlineReadyIds = new Set();
    onlineGameStarted = true;
    updateRoomCode();
    showLanding("online");
  },
  onReconnectToken: (token) => {
    if (token) setReconnectToken(token);
  },
  onReadyState: (payload) => {
    onlineReadyIds = new Set(payload.ready);
    onlineGameStarted = payload.started;
    updateLobbyOverlay();
    renderAll();
  },
  onGameStart: () => {
    onlineGameStarted = true;
    updateLobbyOverlay();
  }
});

function handleCellTap(x: number, y: number) {
  if (!latestState || !latestConfig) return;
  if (!controller.canAct()) return;
  const pieceAt = latestState.pieces.find(
    (p) => p.alive && p.x === x && p.y === y && p.ownerId === latestState.activePlayerId
  );
  if (pieceAt) {
    pendingMove = undefined;
    controller.selectPiece(pieceAt.id);
    renderAll();
    return;
  }
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
  },
  onCardTap: (cardId, ownerId, role) => {
    if (!latestState || !latestConfig) return;
    if (!controller.canAct()) return;
    if (role !== "player") return;

    if (pendingMove && pendingMove.cardIds.includes(cardId)) {
      controller.selectCard(cardId);
      controller.tryMove(pendingMove.to.x, pendingMove.to.y);
      controller.clearSelection();
      pendingMove = undefined;
      renderAll();
      return;
    }

    const selection = controller.getSelection();
    const next = selection.selectedCardId === cardId ? undefined : cardId;
    pendingMove = undefined;
    controller.selectCard(next);
    renderAll();
  }
});
renderer.setViewMode(viewMode);
rotateBoardBtn?.addEventListener("click", () => {
  renderer.rotateBoardQuarter();
  boardRotation = (boardRotation + 90) % 360;
  updateBoardRotation();
});

function updateBoardRotation() {
  if (!canvasContainer) return;
  canvasContainer.dataset.rotation = String(boardRotation);
}

function renderAll() {
  if (!latestConfig || !latestState) return;
  renderCards();

  const viewPlayerId = controller.getPlayerId() ?? latestState.activePlayerId;
  const activeId = latestState.activePlayerId;
  if (!latestState.winnerId && activeId !== lastActivePlayerId) {
    const shouldPlay =
      currentMode === "local" ||
      (!isSpectator && viewPlayerId === activeId);
    if (shouldPlay) {
      sound.play("turn");
    }
    lastActivePlayerId = activeId;
  }
  const selection = controller.getSelection();
  const moves = filterMoves(latestMoves, selection.selectedCardId, selection.selectedPieceId);
  const checkOwners = computeCheckOwners(latestState, latestConfig);
  renderer.render(latestState, moves, {
    ...selection,
    pendingCardIds: pendingMove?.cardIds,
    viewerId: viewPlayerId,
    checkOwners
  });
  updateCheckIndicators(checkOwners, viewPlayerId);
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
    lastActivePlayerId = undefined;
  } else {
    const activeName =
      latestConfig.players.find((p) => p.id === latestState.activePlayerId)?.name ??
      latestState.activePlayerId;
    const isChecked = checkOwners.includes(latestState.activePlayerId);
    statusEl.textContent = `Turn ${latestState.turn} · ${activeName}${isChecked ? " · CHECK" : ""}`;
    lastWinnerId = undefined;
  }

  updateStartedUI();
}

function computeCheckOwners(state: GameState, config: GameConfig): string[] {
  const masterTypeIds = new Set(
    config.pieceTypes
      .filter((type) => type.tag === "king" || type.id === "master")
      .map((type) => type.id)
  );
  const checkOwners = new Set<string>();
  for (const player of config.players) {
    const master = state.pieces.find(
      (piece) => piece.alive && piece.ownerId === player.id && masterTypeIds.has(piece.typeId)
    );
    if (!master) continue;
    const opponent = config.players.find((p) => p.id !== player.id);
    if (!opponent) continue;
    const threatState: GameState = { ...state, activePlayerId: opponent.id };
    const threats = listLegalMoves(threatState, config);
    if (threats.some((move) => move.capture && move.to.x === master.x && move.to.y === master.y)) {
      checkOwners.add(player.id);
    }
  }
  return Array.from(checkOwners);
}

function updateCheckIndicators(checkOwners: string[], viewPlayerId: string | undefined) {
  if (!canvasCheckTop || !canvasCheckBottom || !latestConfig) return;
  const playerId = viewPlayerId ?? latestState?.activePlayerId;
  const opponentId = latestConfig.players.find((p) => p.id !== playerId)?.id;
  const playerInCheck = Boolean(playerId && checkOwners.includes(playerId));
  const opponentInCheck = Boolean(opponentId && checkOwners.includes(opponentId));
  canvasCheckTop.classList.toggle("active", opponentInCheck);
  canvasCheckBottom.classList.toggle("active", playerInCheck);
}

function updateStartedUI() {
  const started = Boolean(
    latestState && !latestState.winnerId && (currentMode === "local" || onlineGameStarted)
  );
  appEl.dataset.started = started ? "true" : "false";
  if (!started) {
    pendingMove = undefined;
    lastActivePlayerId = undefined;
  } else {
    if (namesEditing) setNamesEditing(false);
  }
  if (namesEditBtn) namesEditBtn.disabled = started;
  if (playerNameEditBtn) playerNameEditBtn.disabled = started;
  if (namesSaveBtn) namesSaveBtn.disabled = started;
  if (playerNameSaveBtn) playerNameSaveBtn.disabled = started;
}
function applyLandingView() {
  if (!landingTabLocal || !landingTabOnline || !landingPanelLocal || !landingPanelOnline) return;
  landingTabLocal.classList.toggle("active", landingTab === "local");
  landingTabOnline.classList.toggle("active", landingTab === "online");
  landingPanelLocal.classList.toggle("hidden", rulesVisible || landingTab !== "local");
  landingPanelOnline.classList.toggle("hidden", rulesVisible || landingTab !== "online");
  if (landingPanelRules) {
    landingPanelRules.classList.toggle("hidden", !rulesVisible);
  }
  if (landingRulesBtn) {
    landingRulesBtn.classList.toggle("active", rulesVisible);
  }
  landingOverlay.dataset.tab = landingTab;
  landingOverlay.dataset.rules = rulesVisible ? "true" : "false";
}

function setLandingTab(tab: "local" | "online") {
  landingTab = tab;
  rulesVisible = false;
  applyLandingView();
  if (tab === "online") {
    refreshLobby();
  }
}

function toggleRules() {
  rulesVisible = !rulesVisible;
  applyLandingView();
}

function syncOnlineNameInput() {
  if (!onlineNameInput) return;
  onlineNameInput.value = onlineName || localName;
}

function normalizeReconnectToken(token: string) {
  const parts = token.split(":");
  if (parts.length >= 3 && parts[0] === parts[1]) {
    return [parts[0], ...parts.slice(2)].join(":");
  }
  return token;
}

function getReconnectRoomId(token: string) {
  if (!token) return undefined;
  return token.split(":")[0];
}

function updateResumeButton() {
  if (landingActionsOnline) {
    landingActionsOnline.classList.add("hidden");
  }
}

function setReconnectToken(token?: string) {
  reconnectToken = token ? normalizeReconnectToken(token) : "";
  if (reconnectToken) {
    localStorage.setItem(RECONNECT_KEY, reconnectToken);
  } else {
    localStorage.removeItem(RECONNECT_KEY);
  }
  updateResumeButton();
}

function setSpectatorMode(enabled: boolean) {
  isSpectator = enabled;
  if (!enabled) {
    spectatorNoticeHidden = false;
    spectatorOverlay.classList.add("hidden");
    return;
  }
  spectatorOverlay.classList.toggle("hidden", spectatorNoticeHidden);
}

function shouldShowLobbyOverlay() {
  return currentMode === "online" && !onlineGameStarted && !isSpectator;
}

function renderLobbyOverlay() {
  if (!lobbyOverlay || !lobbyPlayersEl || !latestConfig) return;
  const playerId = controller.getPlayerId();
  const maxPlayers = latestConfig.players.length || 2;
  const readyCount = onlineReadyIds.size;
  const title = currentRoomPrivate ? "Private Lobby" : "Public Lobby";
  if (lobbyTitle) lobbyTitle.textContent = title;
  if (lobbySubtitle) {
    lobbySubtitle.textContent =
      readyCount >= maxPlayers ? "Waiting for match to start…" : "Waiting for players…";
  }
  if (lobbyRoomCodeEl) {
    const showCode = Boolean(currentRoomCode);
    lobbyRoomCodeEl.classList.toggle("hidden", !showCode);
    if (showCode) {
      lobbyRoomCodeEl.textContent = `Room Code · ${currentRoomCode?.toUpperCase()}`;
    }
  }
  lobbyPlayersEl.innerHTML = "";
  for (const player of latestConfig.players) {
    const row = document.createElement("div");
    row.className = "lobby-player";
    const name = document.createElement("div");
    name.className = "lobby-player-name";
    name.textContent = player.id === playerId ? `${player.name} (You)` : player.name;
    const status = document.createElement("div");
    const ready = onlineReadyIds.has(player.id);
    status.className = `lobby-player-status ${ready ? "ready" : "waiting"}`;
    status.textContent = onlineGameStarted ? "Playing" : ready ? "Ready" : "Waiting";
    row.appendChild(name);
    row.appendChild(status);
    lobbyPlayersEl.appendChild(row);
  }
  if (lobbyReadyToggle) {
    const canReady = Boolean(playerId) && !onlineGameStarted;
    lobbyReadyToggle.disabled = !canReady;
    lobbyReadyToggle.checked = playerId ? onlineReadyIds.has(playerId) : false;
  }

  const readyAll = maxPlayers > 0 && readyCount >= maxPlayers;
  if (readyAll && !lastReadyAll && !onlineGameStarted) {
    sound.play("ready");
  }
  lastReadyAll = readyAll;
  if (lobbySandboxEl) {
    const showSandbox = currentRoomPrivate;
    lobbySandboxEl.classList.toggle("hidden", !showSandbox);
    if (showSandbox && lobbySandboxNote) {
      const active = isCustomConfig(latestConfig);
      lobbySandboxNote.textContent = active
        ? "Custom cards enabled for this lobby."
        : "Using the default card set.";
    }
    if (showSandbox && lobbyDeckWrap && lobbyDeckList) {
      const deck = latestConfig.deck ?? [];
      lobbyDeckWrap.classList.toggle("hidden", deck.length === 0);
      lobbyDeckList.innerHTML = "";
      const cardById = new Map(latestConfig.cards.map((card) => [card.id, card]));
      for (const id of deck.slice(0, 5)) {
        const card = cardById.get(id);
        const pill = document.createElement("div");
        pill.className = "deck-pill";
        pill.textContent = card?.name ?? id;
        lobbyDeckList.appendChild(pill);
      }
    }
    const disabled = !canEditOnlineLobby();
    const tip = disabled ? "Available before the match starts" : undefined;
    setButtonDisabled(lobbyCustomizeBtn, disabled, tip);
    setButtonDisabled(lobbyRandomBtn, disabled, tip);
    setButtonDisabled(lobbyChooseBtn, disabled, tip);
  }
}

function updateLobbyOverlay() {
  if (!lobbyOverlay) return;
  const show = shouldShowLobbyOverlay();
  lobbyOverlay.classList.toggle("hidden", !show);
  if (show) renderLobbyOverlay();
}

function leaveOnlineLobby() {
  controller.cancelRematch();
  controller.disconnectOnline();
  setReconnectToken("");
  setSpectatorMode(false);
  currentRoomId = undefined;
  currentRoomCode = undefined;
  currentRoomPrivate = false;
  onlineReadyIds = new Set();
  onlineGameStarted = true;
  lastReadyAll = false;
  lastActivePlayerId = undefined;
  updateRoomCode();
  lobbyOverlay?.classList.add("hidden");
  showLanding("online");
}

function isCustomConfig(config: GameConfig) {
  const base = defaultConfig;
  if (config.cards.length !== base.cards.length) return true;
  const baseMap = new Map(base.cards.map((card) => [card.id, card]));
  for (const card of config.cards) {
    const baseline = baseMap.get(card.id);
    if (!baseline) return true;
    if (card.name !== baseline.name) return true;
    if (card.moves.length !== baseline.moves.length) return true;
    const moveSet = new Set(card.moves.map((move) => `${move.x},${move.y}`));
    const baseSet = new Set(baseline.moves.map((move) => `${move.x},${move.y}`));
    if (moveSet.size !== baseSet.size) return true;
    for (const move of moveSet) {
      if (!baseSet.has(move)) return true;
    }
  }
  return false;
}

function canEditOnlineLobby() {
  return currentMode === "online" && currentRoomPrivate && !onlineGameStarted && !isSpectator;
}

function applyOnlineConfig(config: GameConfig) {
  if (!canEditOnlineLobby()) {
    statusEl.textContent = "Lobby cards can only be changed before the match starts.";
    return;
  }
  latestConfig = config;
  controller.setConfig(config);
  renderer.setConfig(config);
  onlineReadyIds = new Set();
  controller.updateOnlineConfig(config);
  statusEl.textContent = "Lobby cards updated. Ready when you are.";
  updateLobbyOverlay();
}

function createConfigWithDeckFrom(config: GameConfig, deck: string[]) {
  const next = structuredClone(config) as GameConfig;
  next.deck = deck;
  return validateConfig(next);
}

function applyOnlineDeck(deck: string[]) {
  if (!latestConfig) return;
  try {
    const validated = createConfigWithDeckFrom(latestConfig, deck);
    applyOnlineConfig(validated);
    draftOverlay.classList.add("hidden");
  } catch {
    statusEl.textContent = "Deck selection invalid.";
  }
}

function setLobbyBusy(busy: boolean) {
  lobbyBusy = busy;
  const tooltip = busy ? "Working…" : undefined;
  setButtonDisabled(lobbyRefreshBtn, busy, tooltip);
  setButtonDisabled(lobbyCreateBtn, busy, tooltip);
  setButtonDisabled(landingTabOnline, busy, tooltip);
  if (landingActionsOnline) landingActionsOnline.classList.add("hidden");
  setButtonDisabled(privateJoinBtn, busy, tooltip);
  setButtonDisabled(privateCreateBtn, busy, tooltip);
  if (privateKeyInput) privateKeyInput.disabled = busy;
  if (busy) {
    lobbyCreateBtn.textContent = "Creating...";
    if (privateJoinBtn) privateJoinBtn.textContent = "Joining...";
    if (privateCreateBtn) privateCreateBtn.textContent = "Creating...";
  } else {
    lobbyCreateBtn.textContent = "Create Public Room";
    if (privateJoinBtn) privateJoinBtn.textContent = "Join Private";
    if (privateCreateBtn) privateCreateBtn.textContent = "Create Private Room";
  }
}

function updateRoomCode() {
  if (!roomCodeEl) return;
  const code = currentRoomCode;
  const show = currentMode === "online" && (Boolean(code) || currentRoomPrivate);
  roomCodeEl.classList.toggle("hidden", !show);
  if (show) {
    roomCodeEl.textContent = code ? `Room ${code.toUpperCase()}` : "Private Lobby";
  }
}

function showNotice(message: string) {
  statusEl.textContent = message;
  sound.play("notice");
  if (noticeTimeout) window.clearTimeout(noticeTimeout);
  noticeTimeout = window.setTimeout(() => {
    noticeTimeout = undefined;
    renderAll();
  }, 2200);
}

function showLanding(tab: "local" | "online" = "local") {
  landingOverlay.classList.remove("hidden");
  landingOverlay.dataset.tab = tab;
  landingOverlay.dataset.rules = "false";
  lobbyOverlay?.classList.add("hidden");
  setLandingTab(tab);
  syncOnlineNameInput();
  updateResumeButton();
  setLobbyBusy(false);
  refreshLobby();
  lastReadyAll = false;
  if (lobbyTimer) window.clearInterval(lobbyTimer);
  lobbyTimer = window.setInterval(refreshLobby, 8000);
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    statusEl.textContent = "You appear to be offline.";
  }
}

function hideLanding() {
  landingOverlay.classList.add("hidden");
  if (lobbyTimer) window.clearInterval(lobbyTimer);
  lobbyTimer = undefined;
}

function setButtonDisabled(
  button: HTMLButtonElement | null,
  disabled: boolean,
  tooltip?: string
) {
  if (!button) return;
  button.disabled = disabled;
  button.classList.toggle("button-disabled", disabled);
  if (tooltip && disabled) {
    button.setAttribute("data-tooltip", tooltip);
  } else {
    button.removeAttribute("data-tooltip");
  }
}

async function refreshLobby() {
  if (!lobbyListEl) return;
  if (lobbyBusy) return;
  lobbyListEl.innerHTML = "";
  lobbyRefreshBtn.classList.add("loading");
  try {
    const response = await fetch(LOBBY_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed");
    const payload = (await response.json()) as {
      rooms?: {
        roomId: string;
        clients: number;
        maxClients: number;
        players?: number;
        maxPlayers?: number;
        open?: boolean;
        started?: boolean;
        sandbox?: boolean;
        sandboxName?: string;
      }[];
    };
    const rooms = payload.rooms ?? [];
    if (!rooms.length) {
      const empty = document.createElement("div");
      empty.className = "lobby-empty";
      empty.textContent = "No public rooms yet. Create one below.";
      lobbyListEl.appendChild(empty);
      return;
    }
    const reconnectRoomId = reconnectToken ? getReconnectRoomId(reconnectToken) : undefined;
    for (const room of rooms) {
      const row = document.createElement("div");
      row.className = "lobby-item";
      const meta = document.createElement("div");
      meta.className = "room-meta";
      const id = document.createElement("div");
      id.className = "room-id";
      const code = (room as { code?: string }).code;
      const name = (room as { sandboxName?: string }).sandboxName;
      id.textContent = name
        ? name
        : code
          ? code.toUpperCase()
          : `Room ${room.roomId.slice(0, 6)}`;
      const count = document.createElement("div");
      count.className = "room-count";
      const players = room.players ?? room.clients;
      const maxPlayers = room.maxPlayers ?? room.maxClients;
      const sandbox = Boolean((room as { sandbox?: boolean }).sandbox);
      const started = Boolean((room as { started?: boolean }).started);
      const status = started ? "Live" : "Waiting";
      count.textContent = sandbox
        ? `${players}/${maxPlayers} players · Sandbox · ${status}`
        : `${players}/${maxPlayers} players · ${status}`;
      meta.appendChild(id);
      meta.appendChild(count);
      const actions = document.createElement("div");
      actions.className = "lobby-actions";
      const join = document.createElement("button");
      join.className = "ghost-button";
      const open = room.open ?? players < maxPlayers;
      const canRejoin = Boolean(started);
      const canResume = Boolean(
        reconnectRoomId && reconnectRoomId === room.roomId && started && open
      );
      join.textContent = open ? "Join" : canRejoin ? "Rejoin" : "Full";
      setButtonDisabled(
        join,
        !open && !canRejoin,
        open ? undefined : canRejoin ? "Rejoin with the same display name" : "Room is full"
      );
      if (canResume) {
        join.textContent = "Resume";
        setButtonDisabled(join, false);
      }
      join.addEventListener("click", async () => {
        if ((!open && !canRejoin) || lobbyBusy) return;
        if (canResume && reconnectToken) {
          setLobbyBusy(true);
          join.textContent = "Resuming...";
          setButtonDisabled(join, true, "Reconnecting…");
          setMode("online");
          const ok = await controller.reconnectOnline(
            SERVER_URL,
            normalizeReconnectToken(reconnectToken),
            getOnlineName()
          );
          setLobbyBusy(false);
          if (ok) {
            setSpectatorMode(false);
            hideLanding();
            updateLobbyOverlay();
            return;
          }
          statusEl.textContent = "Resume failed. Try joining again.";
          setReconnectToken("");
          refreshLobby();
          return;
        }
        setLobbyBusy(true);
        join.textContent = open ? "Joining..." : "Rejoining...";
        setButtonDisabled(join, true, "Connecting…");
        setMode("online");
        const ok = await controller.connectOnline(SERVER_URL, room.roomId, getOnlineName());
        setLobbyBusy(false);
        if (ok) {
          hideLanding();
          return;
        }
        join.textContent = open ? "Join" : canRejoin ? "Rejoin" : "Full";
        setButtonDisabled(
          join,
          !open && !canRejoin,
          open ? undefined : canRejoin ? "Rejoin with the same display name" : "Room is full"
        );
        statusEl.textContent = "Room unavailable. Refreshing lobby…";
        refreshLobby();
      });
      const spectate = document.createElement("button");
      spectate.className = "ghost-button icon-button lobby-icon";
      spectate.setAttribute("aria-label", "Spectate");
      spectate.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 6c5 0 9.3 3.1 10.9 7.5-1.6 4.4-5.9 7.5-10.9 7.5S2.7 17.9 1.1 13.5C2.7 9.1 7 6 12 6zm0 2.2c-3.5 0-6.6 2-8.2 5.3 1.6 3.3 4.7 5.3 8.2 5.3 3.5 0 6.6-2 8.2-5.3-1.6-3.3-4.7-5.3-8.2-5.3zm0 2.3a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"
          />
        </svg>
      `;
      setButtonDisabled(spectate, !started, started ? undefined : "Spectate available once the match starts");
      spectate.addEventListener("click", async () => {
        if (lobbyBusy) return;
        if (!started) return;
        setLobbyBusy(true);
        spectate.textContent = "Joining...";
        setMode("online");
        const ok = await controller.connectOnline(SERVER_URL, room.roomId, getOnlineName(), {
          spectator: true
        });
        setLobbyBusy(false);
        if (ok) {
          hideLanding();
          return;
        }
        spectate.textContent = "Spectate";
        statusEl.textContent = "Spectate failed. Refreshing lobby…";
        refreshLobby();
      });
      row.appendChild(meta);
      actions.appendChild(join);
      actions.appendChild(spectate);
      row.appendChild(actions);
      lobbyListEl.appendChild(row);
    }
  } catch {
    const empty = document.createElement("div");
    empty.className = "lobby-empty";
    empty.textContent = "Lobby unavailable. Try again.";
    lobbyListEl.appendChild(empty);
  } finally {
    lobbyRefreshBtn.classList.remove("loading");
  }
}

async function lookupPrivateRoom(code: string) {
  const response = await fetch(`${PRIVATE_URL}?code=${encodeURIComponent(code)}`, {
    cache: "no-store"
  });
  if (response.status === 404) {
    throw new Error("not_found");
  }
  if (response.status === 409) {
    throw new Error("full");
  }
  if (!response.ok) {
    throw new Error("failed");
  }
  const payload = (await response.json()) as { roomId?: string };
  if (!payload.roomId) throw new Error("failed");
  return payload.roomId;
}

function setMode(mode: "local" | "online") {
  currentMode = mode;
  appEl.dataset.mode = mode;
  document.body.dataset.mode = mode;
  controller.setMode(mode);
  onlineReadyIds = new Set();
  onlineGameStarted = true;
  lastActivePlayerId = undefined;
  updateLobbyOverlay();
  updateRoomCode();
  if (mode === "local") {
    currentRoomId = undefined;
    currentRoomPrivate = false;
    if (baseConfig) {
      const withName = applyLocalName(baseConfig);
      latestConfig = withName;
      controller.setConfig(withName);
      renderer.setConfig(withName);
      startChoiceResolved = false;
      playerLabel.textContent = localName || "You";
    }
  } else {
    startOverlay.classList.add("hidden");
  }
}

function getOnlineName() {
  const candidate = onlineName.trim() || localName.trim();
  return candidate || "Player";
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
  const viewPlayerId = controller.getPlayerId() ?? latestState.activePlayerId;
  const playerMeta = latestConfig.players.find((p) => p.id === viewPlayerId);
  const opponentMeta = latestConfig.players.find((p) => p.id !== viewPlayerId);
  const playerName = playerMeta?.name ?? "You";
  const opponentName = opponentMeta?.name ?? "Opponent";
  const primaryId = latestConfig.players[0]?.id;

  playerNameEl.textContent = playerName;
  opponentNameEl.textContent = opponentName;
  setNameClass(playerNameEl, viewPlayerId === primaryId ? "primary" : "secondary");
  setNameClass(opponentNameEl, opponentMeta?.id === primaryId ? "primary" : "secondary");
  if (canvasNameTop && canvasNameBottom) {
    canvasNameTop.textContent = opponentName;
    canvasNameBottom.textContent = playerName;
    setNameClass(canvasNameTop, opponentMeta?.id === primaryId ? "primary" : "secondary");
    setNameClass(canvasNameBottom, viewPlayerId === primaryId ? "primary" : "secondary");
  }

  const isPlayerActive = latestState.activePlayerId === viewPlayerId;
  const hasWinner = Boolean(latestState.winnerId);
  playerSection.classList.toggle("active", !hasWinner && isPlayerActive);
  opponentSection.classList.toggle("active", !hasWinner && !isPlayerActive);
  if (canvasNameTop && canvasNameBottom) {
    canvasNameTop.classList.toggle("active", !hasWinner && !isPlayerActive);
    canvasNameBottom.classList.toggle("active", !hasWinner && isPlayerActive);
  }
  renderCaptured(viewPlayerId);

  handEl.innerHTML = "";
  opponentHandEl.innerHTML = "";
  poolEl.innerHTML = "";

  const showHint = Boolean(pendingMove);
  if (cardChoiceHint) {
    const hideLegacy = document.body.dataset.cards === "canvas";
    cardChoiceHint.classList.toggle("hidden", hideLegacy || !showHint);
  }
  if (cardHintOverlay) {
    cardHintOverlay.classList.toggle("hidden", !showHint);
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

function cloneConfig<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function openCustomize(scope: "local" | "lobby" = "local") {
  if (!latestConfig) return;
  customizeScope = scope;
  returnToLandingOnCustomizeClose = false;
  returnToLobbyOnCustomizeClose = scope === "lobby";
  editableConfig = cloneConfig(latestConfig);
  selectedCardIndex = 0;
  renderCustomize();
  overlay.classList.remove("hidden");
}

function closeCustomize() {
  overlay.classList.add("hidden");
  if (returnToLobbyOnCustomizeClose) {
    returnToLobbyOnCustomizeClose = false;
    customizeScope = "local";
    updateLobbyOverlay();
    return;
  }
  if (returnToLandingOnCustomizeClose) {
    returnToLandingOnCustomizeClose = false;
    customizeScope = "local";
    showLanding();
    return;
  }
  customizeScope = "local";
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
    if (customizeScope === "lobby") {
      applyOnlineConfig(validated);
      closeCustomize();
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
    baseConfig = validated;
    const localConfig = applyLocalName(validated);
    latestConfig = localConfig;
    controller.setConfig(localConfig);
    renderer.setConfig(localConfig);
    startChoiceResolved = true;
    startLocalMatch();
    playerLabel.textContent = localName || "You";
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
  rematchPending = false;
  victoryOverlay.classList.toggle("spectator", isSpectator);
  if (victoryWaitEl) victoryWaitEl.classList.add("hidden");
  if (victoryRematchBtn) victoryRematchBtn.disabled = false;
  victoryOverlay.classList.remove("hidden");
  triggerConfetti();
}

function hideVictory() {
  victoryOverlay.classList.add("hidden");
}

function setRematchPending(pending: boolean) {
  rematchPending = pending;
  if (victoryWaitEl) victoryWaitEl.classList.toggle("hidden", !pending);
  if (victoryRematchBtn) victoryRematchBtn.disabled = pending;
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
  return createConfigWithDeckFrom(baseConfig, deck);
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
    hideVictory();
    draftOverlay.classList.add("hidden");
    startOverlay.classList.add("hidden");
  } catch {
    statusEl.textContent = "Deck selection invalid.";
  }
}

function startRandomFive() {
  if (currentMode === "online") {
    if (!canEditOnlineLobby()) {
      statusEl.textContent = "Deck selection is available before the match starts.";
      return;
    }
    if (!latestConfig) return;
    const candidates = [...latestConfig.cards];
    const selection: string[] = [];
    while (selection.length < 5 && candidates.length > 0) {
      const index = Math.floor(Math.random() * candidates.length);
      const [card] = candidates.splice(index, 1);
      if (card) selection.push(card.id);
    }
    applyOnlineDeck(selection);
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
  if (currentMode === "online") {
    if (!canEditOnlineLobby()) {
      statusEl.textContent = "Deck selection is available before the match starts.";
      return;
    }
    if (!latestConfig) return;
    draftMode = "online";
    draftConfig = latestConfig;
    draftSelection = new Set();
    renderDraft();
    lobbyOverlay?.classList.add("hidden");
    draftOverlay.classList.remove("hidden");
    return;
  }
  if (!baseConfig) return;
  draftMode = "local";
  draftConfig = baseConfig;
  startChoiceResolved = true;
  draftSelection = new Set();
  renderDraft();
  draftOverlay.classList.remove("hidden");
}

function maybeShowStartOverlay() {
  if (currentMode !== "local") return;
  if (startChoiceResolved) return;
  startOverlay.classList.remove("hidden");
}

function renderDraft() {
  const sourceConfig = draftConfig ?? baseConfig;
  if (!sourceConfig) return;
  draftGrid.innerHTML = "";
  if (draftSelectedEl) {
    draftSelectedEl.innerHTML = "";
  }
  for (const card of sourceConfig.cards) {
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
          if (currentMode === "local") {
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


newGameBtn.addEventListener("click", () => {
  if (currentMode === "online") {
    controller.cancelRematch();
  }
  controller.disconnectOnline();
  setReconnectToken("");
  statusEl.textContent = "Choose how you want to play.";
  startOverlay.classList.add("hidden");
  draftOverlay.classList.add("hidden");
  victoryOverlay.classList.add("hidden");
  overlay.classList.add("hidden");
  setSpectatorMode(false);
  currentRoomId = undefined;
  currentRoomCode = undefined;
  currentRoomPrivate = false;
  updateRoomCode();
  showLanding("local");
});

landingCloseBtn.addEventListener("click", hideLanding);
landingTabLocal?.addEventListener("click", () => setLandingTab("local"));
landingTabOnline?.addEventListener("click", () => setLandingTab("online"));
landingRulesBtn?.addEventListener("click", toggleRules);
landingLocalBtn.addEventListener("click", () => {
  setMode("local");
  startChoiceResolved = false;
  startOverlay.classList.remove("hidden");
  setSpectatorMode(false);
  hideLanding();
});
landingCustomizeBtn.addEventListener("click", () => {
  returnToLandingOnCustomizeClose = true;
  hideLanding();
  openCustomize("local");
});
lobbyRefreshBtn.addEventListener("click", refreshLobby);
lobbyCreateBtn.addEventListener("click", async () => {
  setMode("online");
  setLobbyBusy(true);
  const ok = await controller.createOnline(SERVER_URL, getOnlineName());
  setLobbyBusy(false);
  if (ok) {
    setSpectatorMode(false);
    hideLanding();
    updateLobbyOverlay();
  }
});
privateCreateBtn?.addEventListener("click", async () => {
  if (lobbyBusy) return;
  setMode("online");
  setLobbyBusy(true);
  const ok = await controller.createOnline(SERVER_URL, getOnlineName(), {
    private: true
  });
  setLobbyBusy(false);
  if (ok) {
    setSpectatorMode(false);
    hideLanding();
    updateLobbyOverlay();
  } else {
    statusEl.textContent = "Failed to create private lobby.";
  }
});
privateJoinBtn?.addEventListener("click", async () => {
  if (lobbyBusy) return;
  const code = privateKeyInput?.value.trim().toLowerCase() ?? "";
  if (!code) {
    statusEl.textContent = "Enter a private lobby key.";
    return;
  }
  setMode("online");
  setLobbyBusy(true);
  try {
    const roomId = await lookupPrivateRoom(code);
    const ok = await controller.connectOnline(SERVER_URL, roomId, getOnlineName());
    if (ok) {
      setSpectatorMode(false);
      hideLanding();
      updateLobbyOverlay();
      return;
    }
    statusEl.textContent = "Private lobby unavailable. Try again.";
  } catch (error) {
    const message =
      error instanceof Error && error.message === "full"
        ? "Private lobby is full."
        : error instanceof Error && error.message === "not_found"
          ? "No game found."
          : "Private lobby unavailable.";
    statusEl.textContent = message;
  } finally {
    setLobbyBusy(false);
  }
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
  if (appEl.dataset.started === "true") return;
  setNamesEditing(!namesEditing);
});
namesSaveBtn?.addEventListener("click", () => {
  if (appEl.dataset.started === "true") return;
  setNamesEditing(false);
});
playerNameEditBtn?.addEventListener("click", () => {
  if (appEl.dataset.started === "true") return;
  setNamesEditing(!namesEditing);
});
playerNameSaveBtn?.addEventListener("click", () => {
  if (appEl.dataset.started === "true") return;
  setNamesEditing(false);
});
localNameInput.addEventListener("input", () => {
  localName = localNameInput.value;
  localStorage.setItem(LOCAL_NAME_KEY, localName);
  if (!onlineName.trim()) {
    syncOnlineNameInput();
  }
  if (baseConfig) {
    const localConfig = applyLocalName(baseConfig);
    latestConfig = localConfig;
    controller.setConfig(localConfig);
    renderer.setConfig(localConfig);
    playerLabel.textContent = localName || "You";
    renderAll();
  }
});

if (onlineNameInput) {
  syncOnlineNameInput();
  onlineNameInput.addEventListener("input", () => {
    onlineName = onlineNameInput.value;
    localStorage.setItem(ONLINE_NAME_KEY, onlineName);
  });
}

if (privateKeyInput) {
  privateKeyInput.addEventListener("input", () => {
    const sanitized = privateKeyInput.value
      .toLowerCase()
      .replace(/[^a-z]/g, "")
      .slice(0, 6);
    privateKeyInput.value = sanitized;
  });
}

spectatorBackBtn?.addEventListener("click", () => {
  leaveOnlineLobby();
});

function hideSpectatorNotice() {
  spectatorNoticeHidden = true;
  spectatorOverlay.classList.add("hidden");
}

spectatorContinueBtn?.addEventListener("click", hideSpectatorNotice);
spectatorCloseBtn?.addEventListener("click", hideSpectatorNotice);
lobbyReadyToggle?.addEventListener("change", () => {
  if (!lobbyReadyToggle) return;
  const playerId = controller.getPlayerId();
  if (playerId) {
    if (lobbyReadyToggle.checked) {
      onlineReadyIds.add(playerId);
    } else {
      onlineReadyIds.delete(playerId);
    }
    renderLobbyOverlay();
  }
  controller.setReady(lobbyReadyToggle.checked);
});
lobbyBackBtn?.addEventListener("click", leaveOnlineLobby);
lobbyCloseBtn?.addEventListener("click", leaveOnlineLobby);
exitOnlineBtn?.addEventListener("click", () => {
  if (currentMode !== "online") return;
  leaveOnlineLobby();
});
lobbyCustomizeBtn?.addEventListener("click", () => {
  if (!canEditOnlineLobby()) {
    statusEl.textContent = "Lobby cards can only be edited before the match starts.";
    return;
  }
  lobbyOverlay?.classList.add("hidden");
  openCustomize("lobby");
});
lobbyRandomBtn?.addEventListener("click", () => {
  if (!canEditOnlineLobby()) {
    statusEl.textContent = "Deck selection is available before the match starts.";
    return;
  }
  startRandomFive();
});
lobbyChooseBtn?.addEventListener("click", () => {
  if (!canEditOnlineLobby()) {
    statusEl.textContent = "Deck selection is available before the match starts.";
    return;
  }
  openDraft();
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

customizeBtn.addEventListener("click", () => openCustomize("local"));
openCustomizeBtn.addEventListener("click", () => openCustomize("local"));
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
victoryRematchBtn?.addEventListener("click", () => {
  if (currentMode !== "online") return;
  setRematchPending(true);
  controller.requestRematch();
});
victoryLobbyBtn?.addEventListener("click", () => {
  if (currentMode !== "online") return;
  leaveOnlineLobby();
});
victoryOverlay.addEventListener("click", (event) => {
  if (event.target === victoryOverlay) hideVictory();
});

startRandomBtn.addEventListener("click", startRandomFive);
startChooseBtn.addEventListener("click", openDraft);

draftCloseBtn.addEventListener("click", () => {
  draftOverlay.classList.add("hidden");
  if (draftMode === "online") {
    updateLobbyOverlay();
  }
});
draftOverlay.addEventListener("click", (event) => {
  if (event.target === draftOverlay) {
    draftOverlay.classList.add("hidden");
    if (draftMode === "online") {
      updateLobbyOverlay();
    }
  }
});
draftStartBtn.addEventListener("click", () => {
  if (draftSelection.size !== 5) return;
  if (draftMode === "online") {
    applyOnlineDeck([...draftSelection]);
    draftOverlay.classList.add("hidden");
    updateLobbyOverlay();
    return;
  }
  startWithDeck([...draftSelection]);
});

appEl.dataset.mode = "local";
bootstrap();
showLanding();
