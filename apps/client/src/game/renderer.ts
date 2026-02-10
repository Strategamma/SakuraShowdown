import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GameConfig, GameState, LegalMove } from "@game/rules";

export type RendererSelection = {
  selectedPieceId?: string;
  selectedCardId?: string;
};

export type RendererCallbacks = {
  onCellTap?: (x: number, y: number) => void;
  onPieceTap?: (pieceId: string) => void;
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
  private highlights: Array<{ base: THREE.Mesh; ring: THREE.Mesh }> = [];
  private cellSize = 1;
  private boardSize = { width: 5, height: 5 };
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
    this.scene.add(this.boardGroup, this.templeGroup, this.highlightGroup, this.pieceGroup);

    this.setupLights();

    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("resize", this.onResize);

    this.onResize();
    this.startLoop();
  }

  setConfig(config: GameConfig) {
    this.config = config;
    this.boardSize = { width: config.board.width, height: config.board.height };
    this.buildBoard();
    this.buildTempleMarkers();
    this.buildHighlights();
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
    this.fitCamera();
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
        const baseGeom = new THREE.CircleGeometry(this.cellSize * 0.26, 36);
        const ringGeom = new THREE.RingGeometry(this.cellSize * 0.28, this.cellSize * 0.38, 36);
        const baseMat = new THREE.MeshBasicMaterial({
          color: 0x5873b6,
          transparent: true,
          opacity: 0,
          depthWrite: false
        });
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x5873b6,
          transparent: true,
          opacity: 0,
          depthWrite: false
        });
        const base = new THREE.Mesh(baseGeom, baseMat);
        const ring = new THREE.Mesh(ringGeom, ringMat);
        base.rotation.x = -Math.PI / 2;
        ring.rotation.x = -Math.PI / 2;
        base.position.copy(this.gridToWorld(x, y, 0.11));
        ring.position.copy(this.gridToWorld(x, y, 0.12));
        base.userData = { type: "highlight", x, y, baseOpacity: 0 };
        ring.userData = base.userData;
        this.highlightGroup.add(base, ring);
        this.highlights.push({ base, ring });
      }
    }
  }

  private updateHighlights(legalMoves: LegalMove[]) {
    for (const highlight of this.highlights) {
      const baseMat = highlight.base.material as THREE.MeshBasicMaterial;
      const ringMat = highlight.ring.material as THREE.MeshBasicMaterial;
      baseMat.opacity = 0;
      ringMat.opacity = 0;
      highlight.base.userData.baseOpacity = 0;
    }

    const primaryId = this.config?.players[0]?.id;
    const secondaryId = this.config?.players[1]?.id;

    for (const move of legalMoves) {
      const index = move.to.y * this.boardSize.width + move.to.x;
      const highlight = this.highlights[index];
      if (!highlight) continue;
      const baseMat = highlight.base.material as THREE.MeshBasicMaterial;
      const ringMat = highlight.ring.material as THREE.MeshBasicMaterial;
      let baseColor = 0x5873b6;
      if (move.playerId === primaryId) baseColor = 0xcc4b4b;
      if (move.playerId === secondaryId) baseColor = 0x4b7bd3;
      const color = move.capture ? 0xd8a647 : baseColor;
      const opacity = move.capture ? 0.65 : 0.38;
      baseMat.color.set(color);
      ringMat.color.set(color);
      baseMat.opacity = opacity;
      ringMat.opacity = opacity + 0.15;
      highlight.base.userData.baseOpacity = opacity;
    }
  }

  private updatePieces(state: GameState, selection: RendererSelection) {
    if (!this.config) return;

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
      if (visual.selected) {
        bodyMat.emissive.setHex(0xf4a261);
        bodyMat.emissiveIntensity = 0.5;
        visual.ring.visible = true;
      } else {
        bodyMat.emissive.setHex(0x000000);
        bodyMat.emissiveIntensity = 0;
        visual.ring.visible = false;
      }

      visual.group.visible = piece.alive;
    }
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
    const height = isMaster ? 0.75 : 0.52;
    const baseRadius = isMaster ? 0.34 : 0.24;

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
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(baseRadius * 0.85, baseRadius, height, 48),
      new THREE.MeshStandardMaterial({
        map: this.fabricTexture,
        color: robeColor,
        roughness: 0.35,
        metalness: 0.2
      })
    );
    body.castShadow = true;
    body.position.y = height / 2 + 0.12;

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(baseRadius * 0.45, 32, 20),
      new THREE.MeshStandardMaterial({
        color: 0xf5e1c9,
        roughness: 0.45,
        metalness: 0.05
      })
    );
    head.position.y = height + 0.18;
    head.castShadow = true;

    const sleeveMat = new THREE.MeshStandardMaterial({
      map: this.fabricTexture,
      color: robeColor,
      roughness: 0.4,
      metalness: 0.1
    });
    const leftArm = new THREE.Mesh(
      new THREE.CylinderGeometry(baseRadius * 0.16, baseRadius * 0.2, 0.28, 18),
      sleeveMat
    );
    leftArm.position.set(-baseRadius * 0.55, height * 0.45, 0);
    leftArm.rotation.z = Math.PI / 2.5;
    leftArm.castShadow = true;

    const rightArm = new THREE.Mesh(
      new THREE.CylinderGeometry(baseRadius * 0.16, baseRadius * 0.2, 0.28, 18),
      sleeveMat
    );
    rightArm.position.set(baseRadius * 0.55, height * 0.45, 0);
    rightArm.rotation.z = -Math.PI / 2.5;
    rightArm.castShadow = true;

    const ring = this.createSelectionRing();

    group.add(base, body, head, leftArm, rightArm, ring);

    if (isMaster) {
      const beard = new THREE.Mesh(
        new THREE.ConeGeometry(baseRadius * 0.34, 0.55, 24),
        new THREE.MeshStandardMaterial({
          color: 0xe8d9c8,
          roughness: 0.6
        })
      );
      beard.position.set(0, height - 0.05, baseRadius * 0.08);
      beard.rotation.x = Math.PI;

      const moustache = new THREE.Mesh(
        new THREE.TorusGeometry(baseRadius * 0.22, 0.03, 12, 32, Math.PI),
        new THREE.MeshStandardMaterial({
          color: 0xdfd2c2,
          roughness: 0.5
        })
      );
      moustache.position.set(0, height + 0.08, baseRadius * 0.22);
      moustache.rotation.x = Math.PI / 2;

      const topknot = new THREE.Mesh(
        new THREE.SphereGeometry(baseRadius * 0.2, 20, 16),
        new THREE.MeshStandardMaterial({
          color: 0x3b2a25,
          roughness: 0.7
        })
      );
      topknot.position.y = height + 0.5;

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
        new THREE.SphereGeometry(baseRadius * 0.35, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({
          color: 0x3b2a25,
          roughness: 0.8
        })
      );
      hair.position.set(0, height + 0.28, 0);

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
    group.traverse((child) => {
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
    const modelPaths: Record<string, string> = {
      master: "/models/master.glb",
      student: "/models/student.glb"
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
    group.traverse((child) => {
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
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects([this.pieceGroup, this.boardGroup], true);

    for (const hit of hits) {
      const data = this.findUserData(hit.object) as
        | { type?: string; pieceId?: string; x?: number; y?: number }
        | undefined;
      if (data?.type === "piece" && data.pieceId) {
        this.callbacks.onPieceTap?.(data.pieceId as string);
        return;
      }
      if (data?.type === "cell") {
        this.callbacks.onCellTap?.(data.x as number, data.y as number);
        return;
      }
    }
  };

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
      this.boardGroup.rotation.y = this.currentFlip;
      this.templeGroup.rotation.y = this.currentFlip;
      this.highlightGroup.rotation.y = this.currentFlip;
      this.pieceGroup.rotation.y = this.currentFlip;
    }

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
      const baseMat = highlight.base.material as THREE.MeshBasicMaterial;
      const ringMat = highlight.ring.material as THREE.MeshBasicMaterial;
      const baseOpacity = highlight.base.userData.baseOpacity as number;
      if (baseOpacity > 0) {
        const pulse = Math.sin(time * 4 + highlight.base.position.x) * 0.06;
        baseMat.opacity = baseOpacity + pulse;
        ringMat.opacity = baseOpacity + 0.15 + pulse * 0.6;
      }
    }

    this.camera.lookAt(0, 0, 0);
  }

  private fitCamera() {
    const width = this.boardSize.width * this.cellSize;
    const depth = this.boardSize.height * this.cellSize;
    const boardRadius = Math.max(width, depth) * 0.6;
    const fov = (this.camera.fov * Math.PI) / 180;
    const distance = boardRadius / Math.tan(fov / 2) + 2.5;

    if (this.viewMode === "2d") {
      this.camera.fov = 35;
      this.camera.position.set(0, distance * 1.1, 0.01);
    } else {
      this.camera.fov = 40;
      this.camera.position.set(0, distance * 0.6, distance * 0.8);
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
