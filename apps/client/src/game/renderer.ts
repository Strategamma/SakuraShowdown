// @ts-nocheck
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GameConfig, GameState, LegalMove } from "@game/rules";

const MODEL_BASE_RAW = import.meta.env.VITE_MODEL_BASE ?? "";
const MODEL_BASE = MODEL_BASE_RAW
  ? MODEL_BASE_RAW.endsWith("/") ? MODEL_BASE_RAW : `${MODEL_BASE_RAW}/`
  : "";

export type RendererSelection = {
  selectedPieceId?: string;
  selectedCardId?: string;
  pendingCardIds?: string[];
  viewerId?: string;
  checkOwners?: string[];
};

export type RendererCallbacks = {
  onCellTap?: (x: number, y: number) => void;
  onPieceTap?: (pieceId: string) => void;
  onCardTap?: (cardId: string, ownerId?: string, role?: "player" | "opponent" | "pool") => void;
};

type PieceVisual = {
  group: THREE.Group;
  body: THREE.Mesh;
  ring: THREE.Mesh;
  pieceId: string;
  alive: boolean;
  selected: boolean;
  target: THREE.Vector3;
  start: THREE.Vector3;
  startTime: number;
  duration: number;
  moveStyle?: MoveStyle;
  moveStartTime?: number;
  moveDuration?: number;
};

type CardVisual = {
  mesh: THREE.Mesh;
  cardId: string;
  ownerId?: string;
  role: "player" | "opponent" | "pool";
  selected: boolean;
  choice: boolean;
  dimmed: boolean;
  inverted: boolean;
  size: { w: number; h: number };
  start: THREE.Vector3;
  target: THREE.Vector3;
  startTime: number;
  duration: number;
};

type CardFly = {
  mesh: THREE.Mesh;
  start: THREE.Vector3;
  target: THREE.Vector3;
  startTime: number;
  duration: number;
  arc: number;
};

type CardLayout = {
  cardWidth: number;
  cardHeight: number;
  gap: number;
  playerSlots: THREE.Vector3[];
  opponentSlots: THREE.Vector3[];
  poolSlot: THREE.Vector3;
  rowOffset: number;
};

type HitData =
  | { type: "card"; cardId: string; ownerId?: string; role?: "player" | "opponent" | "pool" }
  | { type: "piece"; pieceId: string }
  | { type: "cell"; x: number; y: number };

type ModelEntry = {
  group: THREE.Group;
};

type MoveStyle = {
  leap?: number;
  spin?: number;
  tilt?: number;
  sway?: number;
  arc?: number;
  roll?: number;
  stomp?: number;
};

export class GameRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private boardGroup: THREE.Group;
  private templeGroup: THREE.Group;
  private pieceGroup: THREE.Group;
  private highlightGroup: THREE.Group;
  private cardGroup: THREE.Group;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private config?: GameConfig;
  private callbacks: RendererCallbacks;
  private container: HTMLElement;
  private animationFrame?: number;
  private lastState?: GameState;
  private lastMoves: LegalMove[] = [];
  private lastSelection: RendererSelection = {};
  private pieces = new Map<string, PieceVisual>();
  private cells: THREE.Mesh[] = [];
  private highlights: Array<{ fill: THREE.Mesh; border: THREE.LineSegments }> = [];
  private cards = new Map<string, CardVisual>();
  private cardFly: CardFly[] = [];
  private lastCardSwapKey?: string;
  private cardLayout?: CardLayout;
  private cardTextureCache = new Map<string, THREE.CanvasTexture>();
  private opponentShelf?: THREE.Mesh;
  private cellSize = 1;
  private boardSize = { width: 5, height: 5 };
  private masterTypeIds = new Set<string>();
  private cardsEnabled = true;
  private loader = new GLTFLoader();
  private models = new Map<string, ModelEntry>();
  private woodTexture = this.createWoodTexture();
  private fabricTexture = this.createFabricTexture();
  private accentTexture = this.createAccentTexture();
  private lastMoveKey?: string;
  private moveStyles: Record<string, MoveStyle> = {
    tiger: { leap: 0.6, spin: 0.2, tilt: 0.25 },
    dragon: { leap: 0.45, spin: 0.5, arc: 0.3, roll: 0.2 },
    frog: { leap: 0.55, sway: 0.2 },
    rabbit: { leap: 0.4, arc: 0.25 },
    crab: { sway: 0.35, arc: 0.35 },
    elephant: { stomp: 0.35, tilt: 0.1 },
    goose: { sway: 0.2, spin: 0.15 },
    rooster: { spin: 0.3, tilt: 0.2 },
    monkey: { leap: 0.65, spin: 0.4 },
    mantis: { leap: 0.4, tilt: 0.35 },
    horse: { leap: 0.45, tilt: 0.1 },
    ox: { leap: 0.45, tilt: 0.1, stomp: 0.2 },
    crane: { leap: 0.5, spin: 0.25 },
    boar: { stomp: 0.3, sway: 0.2 },
    eel: { arc: 0.4, spin: 0.2 },
    cobra: { arc: 0.35, tilt: 0.3 }
  };
  private pieceBaseHeight = 0.12;
  private isFlipped = false;
  private currentFlip = 0;
  private targetFlip = 0;
  private flipStart = 0;
  private flipDuration = 600;
  private viewMode: "3d" | "2d" = "3d";
  private cardSize = { width: 1.8, height: 2.2 };
  private dragActive = false;
  private dragStart = { x: 0, y: 0 };
  private dragLast = { x: 0, y: 0 };
  private dragYaw = 0;
  private dragPitch = 0;
  private baseYaw = 0;
  private manualYaw = 0;
  private isPointerDown = false;

  constructor(container: HTMLElement, callbacks: RendererCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.scene = new THREE.Scene();
    this.scene.background = null;

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(0, 7, 7);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    this.boardGroup = new THREE.Group();
    this.templeGroup = new THREE.Group();
    this.pieceGroup = new THREE.Group();
    this.highlightGroup = new THREE.Group();
    this.highlightGroup.renderOrder = 3;
    this.cardGroup = new THREE.Group();
    this.cardGroup.renderOrder = 4;
    this.scene.add(
      this.boardGroup,
      this.templeGroup,
      this.highlightGroup,
      this.pieceGroup,
      this.cardGroup
    );

    this.setupLights();

    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("resize", this.onResize);

    this.onResize();
    this.startLoop();
  }

  setCardsEnabled(enabled: boolean) {
    this.cardsEnabled = enabled;
    if (!enabled) {
      this.cardGroup.clear();
      this.cards.clear();
      this.cardFly = [];
    }
  }

  setConfig(config: GameConfig) {
    this.config = config;
    this.boardSize = { width: config.board.width, height: config.board.height };
    this.masterTypeIds = new Set(
      config.pieceTypes
        .filter((type) => type.tag === "king" || type.id === "master")
        .map((type) => type.id)
    );
    this.buildBoard();
    this.buildTempleMarkers();
    this.buildHighlights();
    this.cardGroup.clear();
    this.cards.clear();
    this.cardFly = [];
    this.cardTextureCache.clear();
    this.opponentShelf = undefined;
    this.fitCamera();
    void this.loadModels();
  }

  render(state: GameState, legalMoves: LegalMove[], selection: RendererSelection) {
    if (!this.config) return;
    this.lastState = state;
    this.lastMoves = legalMoves;
    this.lastSelection = selection;

    this.updateHighlights(legalMoves);
    this.updatePieces(state, selection);
    if (this.cardsEnabled) {
      this.updateCards(state, selection);
    }
  }

  setBoardFlip(flipped: boolean) {
    if (this.isFlipped === flipped) return;
    this.isFlipped = flipped;
    this.targetFlip = flipped ? Math.PI : 0;
    this.flipStart = performance.now();
  }

  setViewMode(mode: "3d" | "2d") {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    if (mode === "2d") {
      this.dragYaw = 0;
      this.dragPitch = 0;
    }
    this.updateBaseYaw();
    this.fitCamera();
  }

  rotateBoardQuarter() {
    this.manualYaw += Math.PI / 2;
    if (this.manualYaw > Math.PI * 2) {
      this.manualYaw -= Math.PI * 2;
    }
  }

  private updateBaseYaw() {
    if (this.viewMode !== "3d") {
      this.baseYaw = 0;
      return;
    }
    const isCoarse =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(pointer: coarse)").matches;
    this.baseYaw = isCoarse ? Math.PI / 2 : 0;
  }

  private setupLights() {
    const hemi = new THREE.HemisphereLight(0xfaf4e6, 0x3a3a3a, 0.8);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 0.95);
    key.position.set(5, 10, 6);
    key.castShadow = true;
    key.shadow.mapSize.width = 2048;
    key.shadow.mapSize.height = 2048;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -10;
    this.scene.add(key);

    const fill = new THREE.PointLight(0xfff5e6, 0.35, 30);
    fill.position.set(-6, 4, -6);
    this.scene.add(fill);
  }

  private buildBoard() {
    this.boardGroup.clear();
    this.cells = [];

    const width = this.boardSize.width * this.cellSize;
    const height = this.boardSize.height * this.cellSize;

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.6, 0.45, height + 0.6),
      new THREE.MeshStandardMaterial({
        color: 0xd8d0c4,
        roughness: 0.9,
        metalness: 0.02
      })
    );
    base.position.y = -0.28;
    base.receiveShadow = true;
    this.boardGroup.add(base);

    const blossomMat = new THREE.MeshStandardMaterial({
      color: 0xf4b6c2,
      emissive: 0xd8758b,
      emissiveIntensity: 0.25,
      roughness: 0.6,
      metalness: 0.05
    });
    const blossomGeom = this.createBlossomGeometry(0.16, 5);
    const halfW = width / 2;
    const halfH = height / 2;
    const edgeOffset = this.cellSize * 0.65;
    const y = 0.095;
    const blossomPositions: Array<[number, number, number]> = [];
    for (let i = 0; i < this.boardSize.width; i += 1) {
      const x = -halfW + this.cellSize / 2 + i * this.cellSize;
      blossomPositions.push([x, y, -halfH - edgeOffset]);
      blossomPositions.push([x, y, halfH + edgeOffset]);
    }
    for (let j = 0; j < this.boardSize.height; j += 1) {
      const z = -halfH + this.cellSize / 2 + j * this.cellSize;
      blossomPositions.push([-halfW - edgeOffset, y, z]);
      blossomPositions.push([halfW + edgeOffset, y, z]);
    }
    blossomPositions.forEach(([x, y, z], index) => {
      const blossom = new THREE.Mesh(blossomGeom, blossomMat);
      blossom.position.set(x, y, z);
      blossom.rotation.y = (index * Math.PI) / 6;
      blossom.userData = { type: "decor" };
      blossom.receiveShadow = false;
      blossom.castShadow = false;
      this.boardGroup.add(blossom);
    });

    const lightMat = new THREE.MeshStandardMaterial({
      color: 0xf3efe8,
      roughness: 0.75
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0xc9c0b2,
      roughness: 0.8
    });

    for (let y = 0; y < this.boardSize.height; y += 1) {
      for (let x = 0; x < this.boardSize.width; x += 1) {
        const geom = new THREE.BoxGeometry(this.cellSize * 0.94, 0.12, this.cellSize * 0.94);
        const mat = (x + y) % 2 === 0 ? lightMat : darkMat;
        const cell = new THREE.Mesh(geom, mat);
        cell.position.copy(this.gridToWorld(x, y, 0.06));
        cell.receiveShadow = true;
        cell.castShadow = false;
        cell.userData = { type: "cell", x, y };
        this.boardGroup.add(cell);
        this.cells.push(cell);
      }
    }

    const shadowCatcher = new THREE.Mesh(
      new THREE.PlaneGeometry(width + 6, height + 6),
      new THREE.ShadowMaterial({ opacity: 0.2 })
    );
    shadowCatcher.rotation.x = -Math.PI / 2;
    shadowCatcher.position.y = -0.33;
    shadowCatcher.receiveShadow = true;
    this.boardGroup.add(shadowCatcher);
  }

  private createBlossomGeometry(radius: number, lobes: number) {
    const points: THREE.Vector2[] = [];
    const steps = 64;
    for (let i = 0; i <= steps; i += 1) {
      const t = (i / steps) * Math.PI * 2;
      const r = radius * (0.65 + 0.35 * Math.cos(lobes * t));
      points.push(new THREE.Vector2(Math.cos(t) * r, Math.sin(t) * r));
    }
    const shape = new THREE.Shape(points);
    const geom = new THREE.ShapeGeometry(shape, 24);
    geom.rotateX(-Math.PI / 2);
    return geom;
  }

  private buildTempleMarkers() {
    this.templeGroup.clear();
    if (!this.config) return;

    const ringGeom = new THREE.TorusGeometry(0.42, 0.05, 16, 48);
    const baseGeom = new THREE.CylinderGeometry(0.48, 0.52, 0.08, 48);

    this.config.players.forEach((player, index) => {
      const color = index === 0 ? 0xc23a49 : 0x1f6feb;
      const ring = new THREE.Mesh(
        ringGeom,
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.6,
          roughness: 0.35
        })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.copy(this.gridToWorld(player.temple.x, player.temple.y, 0.13));
      ring.castShadow = false;

      const base = new THREE.Mesh(
        baseGeom,
        new THREE.MeshStandardMaterial({
          color: 0xf1e2cb,
          roughness: 0.8,
          metalness: 0.05
        })
      );
      base.position.copy(this.gridToWorld(player.temple.x, player.temple.y, 0.04));
      base.receiveShadow = true;

      this.templeGroup.add(base, ring);
    });
  }

  private buildHighlights() {
    this.highlightGroup.clear();
    this.highlights = [];

    for (let y = 0; y < this.boardSize.height; y += 1) {
      for (let x = 0; x < this.boardSize.width; x += 1) {
        const planeGeom = new THREE.PlaneGeometry(this.cellSize * 0.88, this.cellSize * 0.88);
        const edgeGeom = new THREE.EdgesGeometry(planeGeom);
        const fillMat = new THREE.MeshBasicMaterial({
          color: 0x5aa8ff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          depthTest: false
        });
        const borderMat = new THREE.LineBasicMaterial({
          color: 0x5aa8ff,
          transparent: true,
          opacity: 0,
          depthTest: false
        });
        const fill = new THREE.Mesh(planeGeom, fillMat);
        const border = new THREE.LineSegments(edgeGeom, borderMat);
        fill.rotation.x = -Math.PI / 2;
        border.rotation.x = -Math.PI / 2;
        fill.position.copy(this.gridToWorld(x, y, 0.145));
        border.position.copy(this.gridToWorld(x, y, 0.155));
        fill.userData = { type: "highlight", x, y, baseOpacity: 0 };
        border.userData = fill.userData;
        this.highlightGroup.add(fill, border);
        this.highlights.push({ fill, border });
      }
    }
  }

  private updateHighlights(legalMoves: LegalMove[]) {
    for (const highlight of this.highlights) {
      const fillMat = highlight.fill.material as THREE.MeshBasicMaterial;
      const borderMat = highlight.border.material as THREE.LineBasicMaterial;
      fillMat.opacity = 0;
      borderMat.opacity = 0;
      highlight.fill.userData.baseOpacity = 0;
    }

    const primaryId = this.config?.players[0]?.id;
    const secondaryId = this.config?.players[1]?.id;

    for (const move of legalMoves) {
      const index = move.to.y * this.boardSize.width + move.to.x;
      const highlight = this.highlights[index];
      if (!highlight) continue;
      const fillMat = highlight.fill.material as THREE.MeshBasicMaterial;
      const borderMat = highlight.border.material as THREE.LineBasicMaterial;
      let baseColor = 0x5ab4ff;
      if (move.playerId === primaryId) baseColor = 0xe85c6d;
      if (move.playerId === secondaryId) baseColor = 0x5ab4ff;
      const color = move.capture ? 0xf2c15f : baseColor;
      const opacity = move.capture ? 0.7 : 0.5;
      fillMat.color.set(color);
      borderMat.color.set(color);
      fillMat.opacity = opacity;
      borderMat.opacity = opacity + 0.35;
      highlight.fill.userData.baseOpacity = opacity;
    }
  }

  private updatePieces(state: GameState, selection: RendererSelection) {
    if (!this.config) return;

    const checkOwners = new Set(selection.checkOwners ?? []);
    const lastMove = state.lastMove;
    const lastMoveKey = lastMove
      ? `${state.turn}:${lastMove.pieceId}:${lastMove.cardId}`
      : undefined;

    for (const piece of state.pieces) {
      const visual = this.getOrCreatePiece(piece.id, piece.ownerId === this.config.players[0].id);
      visual.alive = piece.alive;
      visual.selected = selection.selectedPieceId === piece.id;

      const target = this.gridToWorld(piece.x, piece.y, this.pieceBaseHeight);
      if (!visual.target.equals(target)) {
        visual.start.copy(visual.group.position);
        visual.target.copy(target);
        visual.startTime = performance.now();
        visual.duration = 240;
      }

      if (
        lastMove &&
        lastMoveKey !== this.lastMoveKey &&
        lastMove.pieceId === piece.id
      ) {
        visual.moveStyle = this.getMoveStyle(lastMove.cardId);
        visual.moveStartTime = performance.now();
        visual.moveDuration = 520;
        this.lastMoveKey = lastMoveKey;
      }

      const bodyMat = visual.body.material as THREE.MeshStandardMaterial;
      const ringMat = visual.ring.material as THREE.MeshBasicMaterial;
      const isMaster = this.masterTypeIds.has(piece.typeId);
      const inCheck = isMaster && checkOwners.has(piece.ownerId);
      if (visual.selected) {
        bodyMat.emissive.setHex(0xf4a261);
        bodyMat.emissiveIntensity = 0.5;
        ringMat.color.setHex(0xf4a261);
        ringMat.opacity = 0.75;
        visual.ring.visible = true;
      } else if (inCheck) {
        bodyMat.emissive.setHex(0xf2c15f);
        bodyMat.emissiveIntensity = 0.3;
        ringMat.color.setHex(0xf2c15f);
        ringMat.opacity = 0.85;
        visual.ring.visible = true;
      } else {
        bodyMat.emissive.setHex(0x000000);
        bodyMat.emissiveIntensity = 0;
        visual.ring.visible = false;
      }

      visual.group.visible = piece.alive;
    }
  }

  private updateCards(state: GameState, selection: RendererSelection) {
    if (!this.config) return;

    const viewerId = selection.viewerId ?? this.config.players[0]?.id;
    const viewer = state.players.find((p) => p.id === viewerId) ?? state.players[0];
    const opponent = state.players.find((p) => p.id !== viewer?.id);
    const layout = this.computeCardLayout();
    this.cardLayout = layout;
    this.updateOpponentShelf(layout);

    const pendingIds = new Set(selection.pendingCardIds ?? []);
    const selectedCardId = selection.selectedCardId;

    const desired: Array<{
      key: string;
      cardId: string;
      ownerId?: string;
      role: "player" | "opponent" | "pool";
      position: THREE.Vector3;
      inverted: boolean;
      size: { w: number; h: number };
    }> = [];

    if (viewer) {
      viewer.hand.forEach((cardId, index) => {
        const slot = layout.playerSlots[index] ?? layout.playerSlots[layout.playerSlots.length - 1];
        desired.push({
          key: this.cardKey("player", viewer.id, cardId),
          cardId,
          ownerId: viewer.id,
          role: "player",
          position: slot.clone(),
          inverted: false,
          size: { w: layout.cardWidth, h: layout.cardHeight }
        });
      });
    }

    if (opponent) {
      opponent.hand.forEach((cardId, index) => {
        const slot = layout.opponentSlots[index] ?? layout.opponentSlots[layout.opponentSlots.length - 1];
        desired.push({
          key: this.cardKey("opponent", opponent.id, cardId),
          cardId,
          ownerId: opponent.id,
          role: "opponent",
          position: slot.clone(),
          inverted: true,
          size: { w: layout.cardWidth, h: layout.cardHeight }
        });
      });
    }

    if (state.poolCard) {
      desired.push({
        key: this.cardKey("pool", undefined, state.poolCard),
        cardId: state.poolCard,
        ownerId: undefined,
        role: "pool",
        position: layout.poolSlot.clone(),
        inverted: false,
        size: { w: layout.cardWidth * 0.92, h: layout.cardHeight * 0.92 }
      });
    }

    const previous = new Map(this.cards);
    const next = new Map<string, CardVisual>();

    for (const entry of desired) {
      const card = this.config.cards.find((c) => c.id === entry.cardId);
      if (!card) continue;

      let visual = previous.get(entry.key);
      if (!visual) {
        const mesh = this.createCardMesh(card, entry.inverted);
        mesh.userData = {
          type: "card",
          cardId: entry.cardId,
          ownerId: entry.ownerId,
          role: entry.role
        };
        visual = {
          mesh,
          cardId: entry.cardId,
          ownerId: entry.ownerId,
          role: entry.role,
          selected: false,
          choice: false,
          dimmed: false,
          inverted: entry.inverted,
          size: entry.size,
          start: new THREE.Vector3(),
          target: entry.position.clone(),
          startTime: 0,
          duration: 0
        };
        mesh.position.copy(entry.position);
        mesh.scale.set(entry.size.w, entry.size.h, 1);
        this.cardGroup.add(mesh);
      }

      visual.cardId = entry.cardId;
      visual.ownerId = entry.ownerId;
      visual.role = entry.role;
      visual.size = entry.size;
      visual.target.copy(entry.position);
      if (!visual.start.equals(visual.target)) {
        visual.start.copy(visual.mesh.position);
        visual.startTime = performance.now();
        visual.duration = 220;
      }

      if (visual.inverted !== entry.inverted) {
        const material = visual.mesh.material as THREE.MeshStandardMaterial;
        material.map = this.getCardTexture(card, entry.inverted);
        material.needsUpdate = true;
        visual.inverted = entry.inverted;
      }

      const isSelectable = entry.role === "player";
      visual.selected = isSelectable && selectedCardId === entry.cardId;
      visual.choice = isSelectable && pendingIds.has(entry.cardId);
      visual.dimmed = isSelectable && pendingIds.size > 0 && !visual.choice;

      const material = visual.mesh.material as THREE.MeshStandardMaterial;
      material.opacity = visual.dimmed ? 0.4 : 1;
      material.emissive.setHex(visual.selected ? 0xf4a261 : visual.choice ? 0xf7c4d4 : 0x000000);
      material.emissiveIntensity = visual.selected ? 0.45 : visual.choice ? 0.3 : 0;

      visual.mesh.userData = {
        type: "card",
        cardId: entry.cardId,
        ownerId: entry.ownerId,
        role: entry.role
      };

      next.set(entry.key, visual);
    }

    for (const [key, visual] of previous.entries()) {
      if (!next.has(key)) {
        this.cardGroup.remove(visual.mesh);
      }
    }

    this.cards = next;

    const lastMove = state.lastMove;
    const swapKey = lastMove ? `${state.turn}:${lastMove.playerId}:${lastMove.cardId}` : undefined;
    if (lastMove && swapKey !== this.lastCardSwapKey) {
      const role = lastMove.playerId === viewer?.id ? "player" : "opponent";
      const fromKey = this.cardKey(role, lastMove.playerId, lastMove.cardId);
      const fromVisual = previous.get(fromKey);
      const poolKey = this.cardKey("pool", undefined, state.poolCard);
      const toVisual = this.cards.get(poolKey);
      if (fromVisual && toVisual) {
        const inverted = role === "opponent";
        this.spawnCardFly(fromVisual.mesh.position, toVisual.mesh.position, lastMove.cardId, inverted);
      }
      this.lastCardSwapKey = swapKey;
    }
  }

  private computeCardLayout(): CardLayout {
    const boardW = this.boardSize.width * this.cellSize;
    const boardD = this.boardSize.height * this.cellSize;
    const ratio = this.cardSize.height / this.cardSize.width;
    const isCompact =
      this.container.clientWidth < 720 ||
      this.container.clientHeight < 680 ||
      this.container.clientHeight > this.container.clientWidth * 1.2;
    const gap = Math.max(boardW * 0.04, this.cellSize * 0.2);
    const cardScale = isCompact ? 0.7 : 0.85;
    const cardWidth = ((boardW - gap) / 2) * cardScale;
    const cardHeight = cardWidth * ratio;
    const rowOffset =
      boardD / 2 + cardHeight / 2 + this.cellSize * (isCompact ? 0.22 : 0.4);
    const xOffset = boardW / 2 - cardWidth / 2;
    const cardY = 0.2;
    const poolX =
      boardW / 2 + cardWidth * (isCompact ? 0.55 : 0.65) + this.cellSize * (isCompact ? 0.32 : 0.5);
    return {
      cardWidth,
      cardHeight,
      gap,
      rowOffset,
      playerSlots: [
        new THREE.Vector3(-xOffset, cardY, rowOffset),
        new THREE.Vector3(xOffset, cardY, rowOffset)
      ],
      opponentSlots: [
        new THREE.Vector3(-xOffset, cardY, -rowOffset),
        new THREE.Vector3(xOffset, cardY, -rowOffset)
      ],
      poolSlot: new THREE.Vector3(poolX, cardY + 0.05, 0)
    };
  }

  private updateOpponentShelf(layout: CardLayout) {
    const boardW = this.boardSize.width * this.cellSize;
    const shelfWidth = boardW * 1.06;
    const shelfDepth = layout.cardHeight * 0.9;
    const shelfHeight = 0.06;
    if (!this.opponentShelf) {
      const geom = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x2b1f2a,
        roughness: 0.6,
        metalness: 0.1,
        emissive: 0x2b1b23,
        emissiveIntensity: 0.35
      });
      this.opponentShelf = new THREE.Mesh(geom, mat);
      this.opponentShelf.userData = { type: "decor" };
      this.cardGroup.add(this.opponentShelf);
    }
    this.opponentShelf.scale.set(shelfWidth, shelfHeight, shelfDepth);
    this.opponentShelf.position.set(0, shelfHeight / 2 + 0.02, -layout.rowOffset);
  }

  private cardKey(role: "player" | "opponent" | "pool", ownerId: string | undefined, cardId: string) {
    return `${role}:${ownerId ?? "pool"}:${cardId}`;
  }

  private createCardMesh(card: { id: string; name: string; moves: { x: number; y: number }[] }, inverted: boolean) {
    const geom = new THREE.PlaneGeometry(1, 1);
    const texture = this.getCardTexture(card, inverted);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      roughness: 0.6,
      metalness: 0.12
    });
    const mesh = new THREE.Mesh(geom, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    return mesh;
  }

  private spawnCardFly(from: THREE.Vector3, to: THREE.Vector3, cardId: string, inverted: boolean) {
    if (!this.config) return;
    const card = this.config.cards.find((c) => c.id === cardId);
    if (!card) return;
    const mesh = this.createCardMesh(card, inverted);
    mesh.position.copy(from);
    mesh.scale.set(this.cardLayout?.cardWidth ?? this.cardSize.width, this.cardLayout?.cardHeight ?? this.cardSize.height, 1);
    this.cardGroup.add(mesh);
    this.cardFly.push({
      mesh,
      start: from.clone(),
      target: to.clone(),
      startTime: performance.now(),
      duration: 520,
      arc: 0.28
    });
  }

  private getCardTexture(card: { id: string; name: string; moves: { x: number; y: number }[] }, inverted: boolean) {
    const key = `${card.id}:${inverted ? "inv" : "norm"}`;
    const cached = this.cardTextureCache.get(key);
    if (cached) return cached;
    const texture = this.drawCardTexture(card, inverted);
    this.cardTextureCache.set(key, texture);
    return texture;
  }

  private drawCardTexture(card: { id: string; name: string; moves: { x: number; y: number }[] }, inverted: boolean) {
    const width = 420;
    const height = 540;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement("canvas");
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);
    ctx.scale(dpr, dpr);

    const radius = 26;
    ctx.fillStyle = "#f2ece4";
    ctx.strokeStyle = "rgba(90, 70, 80, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(width - radius, 0);
    ctx.quadraticCurveTo(width, 0, width, radius);
    ctx.lineTo(width, height - radius);
    ctx.quadraticCurveTo(width, height, width - radius, height);
    ctx.lineTo(radius, height);
    ctx.quadraticCurveTo(0, height, 0, height - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(26, 14, 20, 0.98)";
    ctx.font = "600 28px \"Cinzel\", \"Georgia\", serif";
    ctx.textAlign = "center";
    ctx.fillText(card.name.toUpperCase(), width / 2, 54);

    const grid = 5;
    const gridSize = Math.min(width - 64, height - 150);
    const gridLeft = (width - gridSize) / 2;
    const gridTop = 90;
    const cell = gridSize / grid;

    ctx.strokeStyle = "rgba(40, 28, 34, 0.95)";
    ctx.lineWidth = 1.8;
    for (let i = 0; i <= grid; i += 1) {
      ctx.beginPath();
      ctx.moveTo(gridLeft, gridTop + i * cell);
      ctx.lineTo(gridLeft + gridSize, gridTop + i * cell);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(gridLeft + i * cell, gridTop);
      ctx.lineTo(gridLeft + i * cell, gridTop + gridSize);
      ctx.stroke();
    }

    ctx.fillStyle = "#b75c74";
    ctx.beginPath();
    ctx.arc(gridLeft + gridSize / 2, gridTop + gridSize / 2, 7, 0, Math.PI * 2);
    ctx.fill();

    const center = { x: 2, y: 2 };
    const xMul = inverted ? -1 : 1;
    const yMul = inverted ? -1 : 1;
    ctx.fillStyle = "#5a2b20";
    ctx.strokeStyle = "rgba(20, 12, 10, 0.9)";
    for (const move of card.moves) {
      const mx = move.x * xMul;
      const my = move.y * yMul;
      const gx = center.x + mx;
      const gy = center.y - my;
      if (gx < 0 || gx >= grid || gy < 0 || gy >= grid) continue;
      const inset = cell * 0.12;
      const sizeCell = cell * 0.76;
      const px = gridLeft + gx * cell + inset;
      const py = gridTop + gy * cell + inset;
      ctx.fillRect(px, py, sizeCell, sizeCell);
      ctx.strokeRect(px, py, sizeCell, sizeCell);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private getOrCreatePiece(pieceId: string, isPrimary: boolean): PieceVisual {
    const existing = this.pieces.get(pieceId);
    if (existing) return existing;

    const typeId = pieceId.split(":")[1];
    const modelEntry = this.models.get(typeId);

    let group: THREE.Group;
    let body: THREE.Mesh;
    let ring: THREE.Mesh;
    // no labels on pieces

    if (modelEntry) {
      group = modelEntry.group.clone(true);
      this.prepareModel(group, isPrimary);
      body = this.extractPrimaryMesh(group);
      ring = this.createSelectionRing();
      group.add(ring);
    } else {
      ({ group, body, ring } = this.createProceduralPiece(typeId, isPrimary));
    }

    group.userData = { type: "piece", pieceId };
    this.pieceGroup.add(group);

    const visual: PieceVisual = {
      group,
      body,
      ring,
      pieceId,
      alive: true,
      selected: false,
      target: new THREE.Vector3(),
      start: new THREE.Vector3(),
      startTime: 0,
      duration: 0
    };

    this.pieces.set(pieceId, visual);
    return visual;
  }

  private createProceduralPiece(typeId: string, isPrimary: boolean) {
    const group = new THREE.Group();
    const isMaster = typeId === "master";
    const scale = isMaster ? 1.05 : 0.92;
    const height = isMaster ? 0.82 : 0.62;
    const baseRadius = isMaster ? 0.32 : 0.26;

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(baseRadius * 1.05, baseRadius * 1.2, 0.12, 48),
      new THREE.MeshStandardMaterial({
        map: this.accentTexture,
        color: 0xf2eadf,
        roughness: 0.4,
        metalness: 0.2
      })
    );
    base.castShadow = true;
    base.position.y = 0.06;

    const robeColor = isPrimary ? 0xb43b46 : 0x2a64c7;
    const clothMat = new THREE.MeshStandardMaterial({
      map: this.fabricTexture,
      color: robeColor,
      roughness: 0.35,
      metalness: 0.18
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xf5e1c9,
      roughness: 0.45,
      metalness: 0.05
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x3b2a25,
      roughness: 0.7
    });

    const legHeight = 0.2 * scale;
    const legRadius = 0.055 * scale;
    const legOffset = 0.08 * scale;
    const legLeft = new THREE.Mesh(
      new THREE.CylinderGeometry(legRadius, legRadius * 1.1, legHeight, 16),
      clothMat
    );
    legLeft.position.set(-legOffset, legHeight / 2 + 0.12, 0);
    legLeft.castShadow = true;
    const legRight = legLeft.clone();
    legRight.position.set(legOffset, legHeight / 2 + 0.12, 0);

    const footLeft = new THREE.Mesh(
      new THREE.SphereGeometry(legRadius * 1.1, 14, 12),
      clothMat
    );
    footLeft.position.set(-legOffset, 0.12 + legRadius * 0.8, legRadius * 0.6);
    const footRight = footLeft.clone();
    footRight.position.set(legOffset, 0.12 + legRadius * 0.8, legRadius * 0.6);

    const torsoHeight = height * 0.55;
    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(baseRadius * 0.55, baseRadius * 0.7, torsoHeight, 32),
      clothMat
    );
    torso.position.y = 0.12 + legHeight + torsoHeight / 2;
    torso.castShadow = true;

    const shoulders = new THREE.Mesh(
      new THREE.SphereGeometry(baseRadius * 0.55, 24, 18),
      clothMat
    );
    shoulders.position.y = torso.position.y + torsoHeight / 2 - 0.02;
    shoulders.castShadow = true;

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(baseRadius * 0.33, 24, 18),
      skinMat
    );
    head.position.y = shoulders.position.y + baseRadius * 0.4;
    head.castShadow = true;

    const leftArm = new THREE.Mesh(
      new THREE.CylinderGeometry(baseRadius * 0.12, baseRadius * 0.16, 0.32, 16),
      clothMat
    );
    leftArm.position.set(-baseRadius * 0.5, shoulders.position.y - 0.12, 0.02);
    leftArm.rotation.z = Math.PI / 6;
    leftArm.castShadow = true;

    const rightArm = new THREE.Mesh(
      new THREE.CylinderGeometry(baseRadius * 0.12, baseRadius * 0.16, 0.32, 16),
      clothMat
    );
    rightArm.position.set(baseRadius * 0.5, shoulders.position.y - 0.12, 0.02);
    rightArm.rotation.z = -Math.PI / 6;
    rightArm.castShadow = true;

    const sleeveLeft = new THREE.Mesh(
      new THREE.ConeGeometry(baseRadius * 0.22, 0.22, 20),
      clothMat
    );
    sleeveLeft.position.set(-baseRadius * 0.52, shoulders.position.y - 0.18, 0.04);
    sleeveLeft.rotation.z = Math.PI / 6;
    sleeveLeft.castShadow = true;

    const sleeveRight = sleeveLeft.clone();
    sleeveRight.position.set(baseRadius * 0.52, shoulders.position.y - 0.18, 0.04);
    sleeveRight.rotation.z = -Math.PI / 6;

    const cloak = new THREE.Mesh(
      new THREE.ConeGeometry(baseRadius * 0.95, height * 0.75, 32, 1, true),
      clothMat
    );
    cloak.position.y = 0.12 + legHeight + torsoHeight * 0.35;
    cloak.rotation.y = Math.PI / 4;
    cloak.castShadow = true;

    const ring = this.createSelectionRing();

    group.add(
      base,
      legLeft,
      legRight,
      footLeft,
      footRight,
      torso,
      shoulders,
      head,
      leftArm,
      rightArm,
      sleeveLeft,
      sleeveRight,
      cloak,
      ring
    );

    const body = torso;

    if (isMaster) {
      const beard = new THREE.Mesh(
        new THREE.ConeGeometry(baseRadius * 0.36, 0.58, 24),
        new THREE.MeshStandardMaterial({
          color: 0xf4efe9,
          roughness: 0.6
        })
      );
      beard.position.set(0, head.position.y - 0.08, baseRadius * 0.1);
      beard.rotation.x = Math.PI;

      const moustache = new THREE.Mesh(
        new THREE.TorusGeometry(baseRadius * 0.2, 0.03, 12, 32, Math.PI),
        new THREE.MeshStandardMaterial({
          color: 0xdfd2c2,
          roughness: 0.5
        })
      );
      moustache.position.set(0, head.position.y + 0.02, baseRadius * 0.2);
      moustache.rotation.x = Math.PI / 2;

      const topknot = new THREE.Mesh(
        new THREE.SphereGeometry(baseRadius * 0.22, 20, 16),
        hairMat
      );
      topknot.position.y = head.position.y + 0.28;

      const staff = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.035, 1.1, 16),
        new THREE.MeshStandardMaterial({
          color: 0x8b6a4a,
          roughness: 0.7
        })
      );
      staff.position.set(baseRadius * 0.6, 0.7, 0);
      staff.rotation.z = Math.PI / 16;
      staff.castShadow = true;

      const staffOrb = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 16, 12),
        new THREE.MeshStandardMaterial({
          color: 0xc84b58,
          roughness: 0.4,
          metalness: 0.3
        })
      );
      staffOrb.position.set(baseRadius * 0.6, 1.25, 0);

      group.add(beard, moustache, topknot, staff, staffOrb);
    } else {
      const hair = new THREE.Mesh(
        new THREE.SphereGeometry(baseRadius * 0.34, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        hairMat
      );
      hair.position.set(0, head.position.y + 0.12, 0);

      const staff = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.03, 0.85, 14),
        new THREE.MeshStandardMaterial({
          color: 0x6a4a33,
          roughness: 0.75
        })
      );
      staff.position.set(baseRadius * 0.55, 0.45, 0);
      staff.rotation.z = Math.PI / 12;
      staff.castShadow = true;

      const staffCap = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 14, 12),
        new THREE.MeshStandardMaterial({
          color: 0xd6c4a6,
          roughness: 0.6
        })
      );
      staffCap.position.set(baseRadius * 0.55, 0.9, 0);

      const belt = new THREE.Mesh(
        new THREE.TorusGeometry(baseRadius * 0.55, 0.04, 12, 32),
        new THREE.MeshStandardMaterial({
          color: 0x32232c,
          roughness: 0.8
        })
      );
      belt.position.y = 0.36;
      belt.rotation.x = Math.PI / 2;

      group.add(hair, staff, staffCap, belt);
    }

    return { group, body, ring };
  }

  private createSelectionRing() {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.04, 10, 48),
      new THREE.MeshBasicMaterial({ color: 0xf4a261, transparent: true, opacity: 0.7 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08;
    ring.visible = false;
    return ring;
  }


  private extractPrimaryMesh(group: THREE.Group) {
    let targetMesh: THREE.Mesh | undefined;
    group.traverse((child: THREE.Object3D) => {
      if (targetMesh) return;
      if (child instanceof THREE.Mesh) {
        targetMesh = child;
      }
    });
    if (!targetMesh) {
      targetMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.34, 0.6, 32),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
      );
      group.add(targetMesh);
    }
    return targetMesh;
  }

  private async loadModels() {
    if (!MODEL_BASE) return;
    const modelPaths: Record<string, string> = {
      master: `${MODEL_BASE}master.glb`,
      student: `${MODEL_BASE}student.glb`
    };

    await Promise.all(
      Object.entries(modelPaths).map(async ([key, path]) => {
        try {
          const gltf = await this.loader.loadAsync(path);
          const group = gltf.scene;
          this.models.set(key, { group });
        } catch {
          this.models.delete(key);
        }
      })
    );

    if (this.lastState) {
      this.pieceGroup.clear();
      this.pieces.clear();
      this.updatePieces(this.lastState, this.lastSelection);
    }
  }

  private prepareModel(group: THREE.Group, isPrimary: boolean) {
    this.applySharedMaterial(group, isPrimary);
    this.normalizeModel(group);
  }

  private applySharedMaterial(group: THREE.Group, isPrimary: boolean) {
    group.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        const material = new THREE.MeshStandardMaterial({
          map: this.fabricTexture,
          color: isPrimary ? 0xc0392b : 0x1f6feb,
          roughness: 0.35,
          metalness: 0.2
        });
        child.material = material;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }

  private normalizeModel(group: THREE.Group) {
    let box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxAxis = Math.max(size.x, size.y, size.z);
    if (maxAxis > 0) {
      const scale = 0.85 / maxAxis;
      group.scale.setScalar(scale);
      box = new THREE.Box3().setFromObject(group);
    }
    const min = new THREE.Vector3();
    const max = new THREE.Vector3();
    box.getMin(min);
    box.getMax(max);
    group.position.x -= (min.x + max.x) / 2;
    group.position.z -= (min.z + max.z) / 2;
    group.position.y -= min.y;
  }

  private getMoveStyle(cardId: string): MoveStyle {
    return this.moveStyles[cardId] ?? { leap: 0.35, spin: 0.15 };
  }

  private gridToWorld(x: number, y: number, height = 0) {
    const width = this.boardSize.width * this.cellSize;
    const depth = this.boardSize.height * this.cellSize;
    return new THREE.Vector3(
      -width / 2 + this.cellSize / 2 + x * this.cellSize,
      height,
      -depth / 2 + this.cellSize / 2 + y * this.cellSize
    );
  }

  private onPointerDown = (event: PointerEvent) => {
    this.isPointerDown = true;
    this.dragActive = false;
    this.dragStart = { x: event.clientX, y: event.clientY };
    this.dragLast = { x: event.clientX, y: event.clientY };
    if (event.pointerType === "mouse" && event.button === 0) {
      this.renderer.domElement.setPointerCapture(event.pointerId);
    }
  };

  private onPointerMove = (event: PointerEvent) => {
    if (!this.isPointerDown) return;
    if (this.viewMode !== "3d") return;
    if (event.pointerType !== "mouse") return;
    const dx = event.clientX - this.dragStart.x;
    const dy = event.clientY - this.dragStart.y;
    if (!this.dragActive) {
      const distance = Math.hypot(dx, dy);
      if (distance < 6) return;
      this.dragActive = true;
    }
    const deltaX = event.clientX - this.dragLast.x;
    const deltaY = event.clientY - this.dragLast.y;
    this.dragYaw += deltaX * 0.004;
    this.dragPitch += deltaY * 0.003;
    this.dragPitch = Math.max(-0.6, Math.min(0.25, this.dragPitch));
    this.dragLast = { x: event.clientX, y: event.clientY };
  };

  private onPointerUp = (event: PointerEvent) => {
    if (!this.isPointerDown) return;
    const wasDrag = this.dragActive;
    this.isPointerDown = false;
    this.dragActive = false;
    if (event.pointerType === "mouse") {
      this.renderer.domElement.releasePointerCapture(event.pointerId);
    }
    if (!wasDrag) {
      this.handleClick(event);
    }
  };

  private handleClick(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(
      [this.cardGroup, this.pieceGroup, this.boardGroup],
      true
    );

    for (const hit of hits) {
      const data = this.findUserData(hit.object) as HitData | undefined;
      if (data?.type === "card" && data.cardId) {
        this.callbacks.onCardTap?.(
          data.cardId,
          data.ownerId,
          data.role
        );
        if (data.role !== "pool") return;
      }
      if (data?.type === "piece" && data.pieceId) {
        this.callbacks.onPieceTap?.(data.pieceId);
        return;
      }
      if (data?.type === "cell") {
        this.callbacks.onCellTap?.(data.x, data.y);
        return;
      }
    }
  }

  private findUserData(object: THREE.Object3D): Record<string, unknown> | undefined {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current.userData && Object.keys(current.userData).length > 0) {
        return current.userData as Record<string, unknown>;
      }
      current = current.parent;
    }
    return undefined;
  }

  private onResize = () => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.updateBaseYaw();
    this.fitCamera();

    if (this.lastState && this.config) {
      this.render(this.lastState, this.lastMoves, this.lastSelection);
    }
  };

  private startLoop() {
    const tick = () => {
      this.animationFrame = requestAnimationFrame(tick);
      this.updateAnimations();
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  private updateAnimations() {
    const now = performance.now();
    const time = now / 1000;
    const up = new THREE.Vector3(0, 1, 0);

    if (this.currentFlip !== this.targetFlip) {
      const elapsed = now - this.flipStart;
      const t = Math.min(elapsed / this.flipDuration, 1);
      const eased = this.easeInOutCubic(t);
      this.currentFlip = THREE.MathUtils.lerp(this.currentFlip, this.targetFlip, eased);
      if (t >= 1) {
        this.currentFlip = this.targetFlip;
      }
    }
    const combinedYaw = this.currentFlip + this.baseYaw + this.manualYaw + this.dragYaw;
    this.boardGroup.rotation.y = combinedYaw;
    this.templeGroup.rotation.y = combinedYaw;
    this.highlightGroup.rotation.y = combinedYaw;
    this.pieceGroup.rotation.y = combinedYaw;
    this.boardGroup.rotation.x = this.dragPitch;
    this.templeGroup.rotation.x = this.dragPitch;
    this.highlightGroup.rotation.x = this.dragPitch;
    this.pieceGroup.rotation.x = this.dragPitch;

    for (const visual of this.pieces.values()) {
      if (!visual.alive) continue;

      const elapsed = now - visual.startTime;
      const t = visual.duration === 0 ? 1 : Math.min(elapsed / visual.duration, 1);
      const basePosition = new THREE.Vector3();
      if (visual.duration > 0) {
        basePosition.lerpVectors(visual.start, visual.target, this.easeOutCubic(t));
      } else {
        basePosition.copy(visual.target);
      }

      let extraY = 0;
      let extraX = 0;
      let extraZ = 0;
      let spinY = 0;
      let tiltZ = 0;
      let rollX = 0;

      if (visual.moveStyle && visual.moveStartTime !== undefined) {
        const moveElapsed = now - visual.moveStartTime;
        const moveDuration = visual.moveDuration ?? 400;
        const mt = Math.min(Math.max(moveElapsed / moveDuration, 0), 1);
        const style = visual.moveStyle;
        const jump = (style.leap ?? 0) * Math.sin(Math.PI * mt);
        const sway = (style.sway ?? 0) * Math.sin(Math.PI * mt);
        const arc = (style.arc ?? 0) * Math.sin(Math.PI * mt);
        const spin = (style.spin ?? 0) * Math.sin(Math.PI * mt);
        const tilt = (style.tilt ?? 0) * Math.sin(Math.PI * mt);
        const roll = (style.roll ?? 0) * Math.sin(Math.PI * mt);
        const stomp = (style.stomp ?? 0) * Math.sin(Math.PI * mt) * (mt > 0.7 ? -1 : 1);

        const motionScale = 0.35;
        extraY += (jump + stomp) * motionScale;
        spinY += spin * Math.PI * motionScale;
        tiltZ += tilt * motionScale;
        rollX += roll * motionScale;

        const dir = new THREE.Vector3().subVectors(visual.target, visual.start);
        if (dir.lengthSq() > 0.0001) {
          dir.normalize();
          const right = new THREE.Vector3().crossVectors(dir, up);
          extraX += (right.x * arc + dir.x * sway * 0.15) * motionScale;
          extraZ += (right.z * arc + dir.z * sway * 0.15) * motionScale;
        }

        if (mt >= 1) {
          visual.moveStyle = undefined;
        }
      }

      basePosition.y += (visual.selected ? 0.04 : 0) + extraY;
      basePosition.x += extraX;
      basePosition.z += extraZ;
      visual.group.position.copy(basePosition);
      visual.group.rotation.y = spinY;
      visual.group.rotation.z = tiltZ;
      visual.group.rotation.x = rollX;

      if (visual.ring.visible) {
        visual.ring.rotation.z = time * 0.8;
      }
    }

    for (const highlight of this.highlights) {
      const fillMat = highlight.fill.material as THREE.MeshBasicMaterial;
      const borderMat = highlight.border.material as THREE.LineBasicMaterial;
      const baseOpacity = highlight.fill.userData.baseOpacity as number;
      if (baseOpacity > 0) {
        const pulse = Math.sin(time * 4 + highlight.fill.position.x) * 0.05;
        fillMat.opacity = baseOpacity + pulse;
        borderMat.opacity = baseOpacity + 0.25 + pulse * 0.6;
      }
    }

    for (const card of this.cards.values()) {
      const elapsed = now - card.startTime;
      const t = card.duration === 0 ? 1 : Math.min(elapsed / card.duration, 1);
      const pos = new THREE.Vector3();
      if (card.duration > 0) {
        pos.lerpVectors(card.start, card.target, this.easeOutCubic(t));
      } else {
        pos.copy(card.target);
      }
      card.mesh.position.copy(pos);

      let scale = 1;
      if (card.selected) {
        scale = 1.06 + Math.sin(time * 4) * 0.02;
      } else if (card.choice) {
        scale = 1.04 + Math.sin(time * 5) * 0.02;
      }
      card.mesh.scale.set(card.size.w * scale, card.size.h * scale, 1);
    }

    if (this.cardFly.length > 0) {
      const remaining: CardFly[] = [];
      for (const fly of this.cardFly) {
        const t = Math.min(Math.max((now - fly.startTime) / fly.duration, 0), 1);
        const eased = this.easeInOutCubic(t);
        const pos = new THREE.Vector3().lerpVectors(fly.start, fly.target, eased);
        pos.y += fly.arc * Math.sin(Math.PI * eased);
        fly.mesh.position.copy(pos);
        fly.mesh.scale.set(
          (this.cardLayout?.cardWidth ?? this.cardSize.width) * 0.92,
          (this.cardLayout?.cardHeight ?? this.cardSize.height) * 0.92,
          1
        );
        if (t < 1) {
          remaining.push(fly);
        } else {
          this.cardGroup.remove(fly.mesh);
        }
      }
      this.cardFly = remaining;
    }

    this.camera.lookAt(0, 0, 0);
  }

  private fitCamera() {
    const width = this.boardSize.width * this.cellSize;
    const depth = this.boardSize.height * this.cellSize;
    let extentX = width / 2;
    let extentZ = depth / 2;

    if (this.cardsEnabled) {
      const layout = this.computeCardLayout();
      const poolExtent = Math.abs(layout.poolSlot.x) + layout.cardWidth / 2;
      const cardXExtent = Math.max(
        Math.abs(layout.playerSlots[1]?.x ?? 0) + layout.cardWidth / 2,
        poolExtent
      );
      extentX = Math.max(width / 2, cardXExtent);
      extentZ = Math.max(depth / 2, layout.rowOffset + layout.cardHeight / 2);
    }
    const boardRadius = Math.max(extentX, extentZ);
    const fov = (this.camera.fov * Math.PI) / 180;
    const isCompact =
      this.container.clientWidth < 720 ||
      this.container.clientHeight < 680 ||
      this.container.clientHeight > this.container.clientWidth * 1.2;
    const distance = boardRadius / Math.tan(fov / 2) + (isCompact ? 0.6 : 1.2);

    if (this.viewMode === "2d") {
      this.camera.fov = 35;
      this.camera.position.set(0, distance * (isCompact ? 0.82 : 0.95), 0.01);
    } else {
      this.camera.fov = 40;
      this.camera.position.set(
        0,
        distance * (isCompact ? 0.48 : 0.55),
        distance * (isCompact ? 0.62 : 0.7)
      );
    }
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  private easeOutCubic(t: number) {
    return 1 - Math.pow(1 - t, 3);
  }

  private easeInOutCubic(t: number) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  private createWoodTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#7a6572";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < 120; i += 1) {
        const y = Math.random() * canvas.height;
        const alpha = 0.05 + Math.random() * 0.1;
        ctx.strokeStyle = `rgba(245, 200, 220, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(80, y + Math.random() * 6, 160, y - Math.random() * 6, 256, y);
        ctx.stroke();
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private createFabricTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#d9d2c5";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < 600; i += 1) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.2})`;
        ctx.fillRect(x, y, 1.2, 1.2);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      for (let i = 0; i < 8; i += 1) {
        const y = i * 16 + 4;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private createAccentTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#f5efe8";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "rgba(180,140,90,0.25)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i += 1) {
        ctx.beginPath();
        ctx.arc(64, 64, 16 + i * 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
}
