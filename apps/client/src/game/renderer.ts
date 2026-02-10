import * as PIXI from "pixi.js";
import type { GameConfig, GameState, LegalMove } from "@game/rules";

export type RendererSelection = {
  selectedPieceId?: string;
  selectedCardId?: string;
};

export type RendererCallbacks = {
  onCellTap?: (x: number, y: number) => void;
  onPieceTap?: (pieceId: string) => void;
};

export class GameRenderer {
  private app: PIXI.Application;
  private boardContainer: PIXI.Container;
  private pieceContainer: PIXI.Container;
  private cellGraphics: PIXI.Graphics[][] = [];
  private pieceGraphics = new Map<string, PIXI.Container>();
  private config?: GameConfig;
  private cellSize = 0;
  private origin = { x: 0, y: 0 };
  private callbacks: RendererCallbacks;
  private lastState?: GameState;
  private lastMoves: LegalMove[] = [];
  private lastSelection: RendererSelection = {};

  constructor(container: HTMLElement, callbacks: RendererCallbacks) {
    this.callbacks = callbacks;
    this.app = new PIXI.Application({
      backgroundAlpha: 0,
      antialias: true,
      resizeTo: container,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    });

    container.appendChild(this.app.canvas);

    this.boardContainer = new PIXI.Container();
    this.pieceContainer = new PIXI.Container();
    this.app.stage.addChild(this.boardContainer, this.pieceContainer);

    this.app.stage.eventMode = "static";

    window.addEventListener("resize", () => {
      this.layout();
    });
  }

  setConfig(config: GameConfig) {
    this.config = config;
    this.buildBoard();
    this.layout();
  }

  render(state: GameState, legalMoves: LegalMove[], selection: RendererSelection) {
    if (!this.config) return;
    this.lastState = state;
    this.lastMoves = legalMoves;
    this.lastSelection = selection;

    this.clearHighlights();

    for (const move of legalMoves) {
      const cell = this.cellGraphics[move.to.y]?.[move.to.x];
      if (!cell) continue;
      cell.alpha = move.capture ? 0.9 : 0.7;
      cell.tint = move.capture ? 0xe76f51 : 0x2a9d8f;
    }

    for (const piece of state.pieces) {
      const sprite = this.getOrCreatePiece(piece.id, piece.ownerId === this.config.players[0].id);
      sprite.visible = piece.alive;
      const radius = Math.max(10, this.cellSize * 0.33);
      const circle = sprite.children[0] as PIXI.Graphics;
      circle.scale.set(radius);
      const label = sprite.children[1] as PIXI.Text;
      const labelScale = Math.max(10, this.cellSize * 0.3) / 20;
      label.scale.set(labelScale);
      const pos = this.gridToPixels(piece.x, piece.y);
      sprite.position.set(pos.x, pos.y);

      if (selection.selectedPieceId === piece.id) {
        circle.tint = 0xf4a261;
      } else {
        circle.tint = piece.ownerId === this.config.players[0].id ? 0xd32f2f : 0x1976d2;
      }
    }
  }

  private buildBoard() {
    if (!this.config) return;

    this.boardContainer.removeChildren();
    this.cellGraphics = [];

    for (let y = 0; y < this.config.board.height; y += 1) {
      const row: PIXI.Graphics[] = [];
      for (let x = 0; x < this.config.board.width; x += 1) {
        const cell = new PIXI.Graphics();
        cell.eventMode = "static";
        cell.on("pointertap", () => this.callbacks.onCellTap?.(x, y));
        this.boardContainer.addChild(cell);
        row.push(cell);
      }
      this.cellGraphics.push(row);
    }
  }

  private layout() {
    if (!this.config) return;
    const padding = 24;
    const viewWidth = this.app.renderer.width;
    const viewHeight = this.app.renderer.height;

    const maxCellX = (viewWidth - padding * 2) / this.config.board.width;
    const maxCellY = (viewHeight - padding * 2) / this.config.board.height;
    this.cellSize = Math.floor(Math.min(maxCellX, maxCellY));

    const boardWidth = this.cellSize * this.config.board.width;
    const boardHeight = this.cellSize * this.config.board.height;

    this.origin.x = (viewWidth - boardWidth) / 2;
    this.origin.y = (viewHeight - boardHeight) / 2;

    this.drawBoard();
    if (this.lastState) {
      this.render(this.lastState, this.lastMoves, this.lastSelection);
    }
  }

  private drawBoard() {
    if (!this.config) return;
    for (let y = 0; y < this.config.board.height; y += 1) {
      for (let x = 0; x < this.config.board.width; x += 1) {
        const cell = this.cellGraphics[y]?.[x];
        if (!cell) continue;
        const isDark = (x + y) % 2 === 0;
        const color = isDark ? 0xd7c1a2 : 0xefe3d1;

        cell.clear();
        cell.beginFill(color);
        cell.drawRoundedRect(0, 0, this.cellSize - 2, this.cellSize - 2, 8);
        cell.endFill();
        cell.position.set(this.origin.x + x * this.cellSize, this.origin.y + y * this.cellSize);
        cell.alpha = 1;
        cell.tint = 0xffffff;
      }
    }
  }

  private clearHighlights() {
    for (const row of this.cellGraphics) {
      for (const cell of row) {
        cell.alpha = 1;
        cell.tint = 0xffffff;
      }
    }
  }

  private getOrCreatePiece(pieceId: string, isPrimary: boolean) {
    const existing = this.pieceGraphics.get(pieceId);
    if (existing) return existing;

    const container = new PIXI.Container();
    container.eventMode = "static";
    container.on("pointertap", () => this.callbacks.onPieceTap?.(pieceId));

    const circle = new PIXI.Graphics();
    circle.beginFill(isPrimary ? 0xd32f2f : 0x1976d2);
    circle.drawCircle(0, 0, 1);
    circle.endFill();

    const label = new PIXI.Text({
      text: pieceId.split(":")[1].charAt(0).toUpperCase(),
      style: new PIXI.TextStyle({
        fontFamily: "Space Grotesk",
        fontSize: 20,
        fill: 0xffffff,
        fontWeight: "bold"
      })
    });
    label.anchor.set(0.5);

    container.addChild(circle, label);
    this.pieceContainer.addChild(container);
    this.pieceGraphics.set(pieceId, container);
    return container;
  }

  private gridToPixels(x: number, y: number) {
    return {
      x: this.origin.x + x * this.cellSize + this.cellSize / 2,
      y: this.origin.y + y * this.cellSize + this.cellSize / 2
    };
  }
}
