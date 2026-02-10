import "./styles.css";
import type { GameConfig, GameState, LegalMove } from "@game/rules";
import { GameController } from "./game/controller";
import { GameRenderer } from "./game/renderer";

const CONFIG_URL = import.meta.env.VITE_CONFIG_URL ?? "/game.json";
const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "ws://localhost:2567";

const statusEl = document.getElementById("status") as HTMLElement;
const modeSelect = document.getElementById("mode") as HTMLSelectElement;
const connectBtn = document.getElementById("connect") as HTMLButtonElement;
const roomInput = document.getElementById("room") as HTMLInputElement;
const playerLabel = document.getElementById("player-label") as HTMLElement;
const handEl = document.getElementById("hand") as HTMLElement;
const poolEl = document.getElementById("pool") as HTMLElement;
const canvasContainer = document.getElementById("canvas-container") as HTMLElement;

let latestConfig: GameConfig | undefined;
let latestState: GameState | undefined;
let latestMoves: LegalMove[] = [];

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
  onPlayer: (playerId) => {
    playerLabel.textContent = playerId ?? "Spectator";
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

function renderAll() {
  if (!latestConfig || !latestState) return;
  renderCards();

  const selection = controller.getSelection();
  const moves = filterMoves(latestMoves, selection.selectedCardId, selection.selectedPieceId);
  renderer.render(latestState, moves, selection);

  if (latestState.winnerId) {
    statusEl.textContent = `Winner: ${latestState.winnerId}`;
  } else {
    statusEl.textContent = `Turn ${latestState.turn} · ${latestState.activePlayerId}`;
  }
}

function renderCards() {
  if (!latestState || !latestConfig) return;

  const selection = controller.getSelection();
  const viewPlayerId = controller.getPlayerId() ?? latestState.activePlayerId;
  const playerState = latestState.players.find((p) => p.id === viewPlayerId);

  handEl.innerHTML = "";
  if (playerState) {
    for (const cardId of playerState.hand) {
      const card = latestConfig.cards.find((c) => c.id === cardId);
      const cardEl = document.createElement("div");
      cardEl.className = "card";
      cardEl.textContent = card?.name ?? cardId;
      if (selection.selectedCardId === cardId) {
        cardEl.classList.add("active");
      }
      cardEl.addEventListener("click", () => {
        const next = selection.selectedCardId === cardId ? undefined : cardId;
        controller.selectCard(next);
        renderAll();
      });
      handEl.appendChild(cardEl);
    }
  }

  poolEl.innerHTML = "";
  const poolCard = latestConfig.cards.find((c) => c.id === latestState.poolCard);
  const poolCardEl = document.createElement("div");
  poolCardEl.className = "card disabled";
  poolCardEl.textContent = poolCard?.name ?? latestState.poolCard;
  poolEl.appendChild(poolCardEl);
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

async function bootstrap() {
  try {
    await controller.loadConfig(CONFIG_URL);
    renderer.setConfig(latestConfig!);
    controller.startLocal();
  } catch (error) {
    statusEl.textContent = "Failed to load config.";
  }
}

modeSelect.addEventListener("change", () => {
  const mode = modeSelect.value === "online" ? "online" : "local";
  controller.setMode(mode);

  if (mode === "local") {
    controller.startLocal();
  }
});

connectBtn.addEventListener("click", async () => {
  if (modeSelect.value === "local") {
    controller.startLocal();
    return;
  }

  await controller.connectOnline(SERVER_URL, roomInput.value.trim() || undefined);
});

bootstrap();
