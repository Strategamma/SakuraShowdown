declare namespace THREE {
  const MathUtils: any;
  const SRGBColorSpace: any;
  const PCFSoftShadowMap: any;
  const RepeatWrapping: any;
  const HemisphereLight: any;
  const DirectionalLight: any;
  const PointLight: any;
  const Shape: any;
  const ShapeGeometry: any;
  const EdgesGeometry: any;
  const ShadowMaterial: any;

  type Object3D = any;
  type Scene = any;
  type Group = any;
  type Mesh = any;
  type PerspectiveCamera = any;
  type WebGLRenderer = any;
  type Raycaster = any;
  type Vector2 = any;
  type Vector3 = any;
  type Box3 = any;
  type CanvasTexture = any;
  type MeshStandardMaterial = any;
  type MeshBasicMaterial = any;
  type LineBasicMaterial = any;
  type TorusGeometry = any;
  type CylinderGeometry = any;
  type PlaneGeometry = any;
  type BoxGeometry = any;
  type SphereGeometry = any;
  type LineSegments = any;
}

declare module "three" {
  export = THREE;
}

declare module "three/examples/jsm/loaders/GLTFLoader.js" {
  const GLTFLoader: any;
  export { GLTFLoader };
}
