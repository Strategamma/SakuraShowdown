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
  label: THREE.Sprite;
  pieceId: string;
  alive: boolean;
  selected: boolean;
  target: THREE.Vector3;
  start: THREE.Vector3;
  startTime: number;
  duration: number;
};

type ModelEntry = {
  group: THREE.Group;
};

export class GameRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private boardGroup: THREE.Group;
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
  private highlights: THREE.Mesh[] = [];
  private cellSize = 1;
  private boardSize = { width: 5, height: 5 };
  private loader = new GLTFLoader();
  private models = new Map<string, ModelEntry>();
  private woodTexture = this.createWoodTexture();
  private fabricTexture = this.createFabricTexture();
  private accentTexture = this.createAccentTexture();

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
    this.pieceGroup = new THREE.Group();
    this.highlightGroup = new THREE.Group();
    this.scene.add(this.boardGroup, this.highlightGroup, this.pieceGroup);

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
        map: this.woodTexture,
        color: 0xf1e2cb,
        roughness: 0.7,
        metalness: 0.05
      })
    );
    base.position.y = -0.28;
    base.receiveShadow = true;
    this.boardGroup.add(base);

    const lightMat = new THREE.MeshStandardMaterial({
      color: 0xf4e8d7,
      roughness: 0.75,
      map: this.woodTexture
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0xd9c0a0,
      roughness: 0.8,
      map: this.woodTexture
    });

    for (let y = 0; y < this.boardSize.height; y += 1) {
      for (let x = 0; x < this.boardSize.width; x += 1) {
        const geom = new THREE.BoxGeometry(this.cellSize * 0.98, 0.12, this.cellSize * 0.98);
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

  private buildHighlights() {
    this.highlightGroup.clear();
    this.highlights = [];

    for (let y = 0; y < this.boardSize.height; y += 1) {
      for (let x = 0; x < this.boardSize.width; x += 1) {
        const geom = new THREE.RingGeometry(this.cellSize * 0.18, this.cellSize * 0.32, 32);
        const mat = new THREE.MeshBasicMaterial({
          color: 0x2a9d8f,
          transparent: true,
          opacity: 0,
          depthWrite: false
        });
        const ring = new THREE.Mesh(geom, mat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(this.gridToWorld(x, y, 0.12));
        ring.userData = { type: "highlight", x, y, baseOpacity: 0 };
        this.highlightGroup.add(ring);
        this.highlights.push(ring);
      }
    }
  }

  private updateHighlights(legalMoves: LegalMove[]) {
    for (const highlight of this.highlights) {
      const mat = highlight.material as THREE.MeshBasicMaterial;
      mat.opacity = 0;
      highlight.userData.baseOpacity = 0;
    }

    for (const move of legalMoves) {
      const index = move.to.y * this.boardSize.width + move.to.x;
      const highlight = this.highlights[index];
      if (!highlight) continue;
      const mat = highlight.material as THREE.MeshBasicMaterial;
      mat.color.set(move.capture ? 0xe76f51 : 0x2a9d8f);
      const opacity = move.capture ? 0.7 : 0.45;
      mat.opacity = opacity;
      highlight.userData.baseOpacity = opacity;
    }
  }

  private updatePieces(state: GameState, selection: RendererSelection) {
    if (!this.config) return;

    for (const piece of state.pieces) {
      const visual = this.getOrCreatePiece(piece.id, piece.ownerId === this.config.players[0].id);
      visual.alive = piece.alive;
      visual.selected = selection.selectedPieceId === piece.id;

      const target = this.gridToWorld(piece.x, piece.y, 0.55);
      if (!visual.target.equals(target)) {
        visual.start.copy(visual.group.position);
        visual.target.copy(target);
        visual.startTime = performance.now();
        visual.duration = 240;
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
    let label: THREE.Sprite;

    if (modelEntry) {
      group = modelEntry.group.clone(true);
      this.prepareModel(group, isPrimary);
      body = this.extractPrimaryMesh(group);
      ring = this.createSelectionRing();
      label = this.createLabel(typeId.charAt(0).toUpperCase());
      label.position.set(0, 0.7, 0);
      group.add(ring, label);
    } else {
      ({ group, body, ring, label } = this.createProceduralPiece(typeId, isPrimary));
    }

    group.userData = { type: "piece", pieceId };
    this.pieceGroup.add(group);

    const visual: PieceVisual = {
      group,
      body,
      ring,
      label,
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
    const height = isMaster ? 0.75 : 0.6;
    const baseRadius = isMaster ? 0.34 : 0.28;

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

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(baseRadius * 0.9, baseRadius, height, 48),
      new THREE.MeshStandardMaterial({
        map: this.fabricTexture,
        color: isPrimary ? 0xc0392b : 0x1f6feb,
        roughness: 0.35,
        metalness: 0.2
      })
    );
    body.castShadow = true;
    body.position.y = height / 2 + 0.12;

    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(baseRadius * 0.5, 32, 20),
      new THREE.MeshStandardMaterial({
        map: this.accentTexture,
        color: 0xf7f1e8,
        roughness: 0.3,
        metalness: 0.1
      })
    );
    crown.position.y = height + 0.12;
    crown.castShadow = true;

    const crest = new THREE.Mesh(
      new THREE.ConeGeometry(baseRadius * 0.3, 0.2, 24),
      new THREE.MeshStandardMaterial({
        color: 0xf2d0a4,
        roughness: 0.4,
        metalness: 0.3
      })
    );
    crest.position.y = height + 0.32;
    crest.castShadow = true;

    const ring = this.createSelectionRing();

    const label = this.createLabel(typeId.charAt(0).toUpperCase());
    label.position.set(0, height + 0.48, 0);

    group.add(base, body, crown, crest, ring, label);

    return { group, body, ring, label };
  }

  private createSelectionRing() {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.04, 10, 48),
      new THREE.MeshBasicMaterial({ color: 0xf4a261, transparent: true, opacity: 0.7 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.12;
    ring.visible = false;
    return ring;
  }

  private createLabel(text: string) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(64, 64, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2b2a27";
      ctx.font = "bold 56px 'Space Grotesk'";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 64, 70);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.5, 0.5, 0.5);
    return sprite;
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
    const box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxAxis = Math.max(size.x, size.y, size.z);
    if (maxAxis > 0) {
      const scale = 0.85 / maxAxis;
      group.scale.setScalar(scale);
    }
    const center = new THREE.Vector3();
    box.getCenter(center);
    group.position.sub(center);
    group.position.y += 0.4;
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
      const data = hit.object.userData;
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

    for (const visual of this.pieces.values()) {
      if (!visual.alive) continue;

      const elapsed = now - visual.startTime;
      const t = visual.duration === 0 ? 1 : Math.min(elapsed / visual.duration, 1);
      if (visual.duration > 0) {
        visual.group.position.lerpVectors(visual.start, visual.target, this.easeOutCubic(t));
      } else {
        visual.group.position.copy(visual.target);
      }

      const bob = Math.sin(time * 2 + visual.target.x * 2.4) * 0.02;
      visual.group.position.y = visual.target.y + bob + (visual.selected ? 0.06 : 0);
      visual.group.rotation.y = Math.sin(time * 0.6 + visual.target.x) * 0.08;

      if (visual.ring.visible) {
        visual.ring.rotation.z = time * 0.8;
      }
    }

    for (const highlight of this.highlights) {
      const mat = highlight.material as THREE.MeshBasicMaterial;
      const base = highlight.userData.baseOpacity as number;
      if (base > 0) {
        mat.opacity = base + Math.sin(time * 4 + highlight.position.x) * 0.08;
      }
    }

    const drift = Math.sin(time * 0.2) * 0.25;
    this.camera.position.x = drift;
    this.camera.lookAt(0, 0, 0);
  }

  private fitCamera() {
    const width = this.boardSize.width * this.cellSize;
    const depth = this.boardSize.height * this.cellSize;
    const boardRadius = Math.max(width, depth) * 0.6;
    const fov = (this.camera.fov * Math.PI) / 180;
    const distance = boardRadius / Math.tan(fov / 2) + 2.5;

    this.camera.position.set(0, distance * 0.6, distance * 0.8);
    this.camera.lookAt(0, 0, 0);
  }

  private easeOutCubic(t: number) {
    return 1 - Math.pow(1 - t, 3);
  }

  private createWoodTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#eddcc2";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < 120; i += 1) {
        const y = Math.random() * canvas.height;
        const alpha = 0.05 + Math.random() * 0.08;
        ctx.strokeStyle = `rgba(120, 90, 50, ${alpha})`;
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
