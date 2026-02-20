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
  const Raycaster: any;
  const Vector2: any;
  const Vector3: any;
  const Scene: any;
  const PerspectiveCamera: any;
  const WebGLRenderer: any;
  const Group: any;
  const Mesh: any;
  const BoxGeometry: any;
  const PlaneGeometry: any;
  const TorusGeometry: any;
  const CylinderGeometry: any;
  const SphereGeometry: any;
  const MeshStandardMaterial: any;
  const MeshBasicMaterial: any;
  const LineBasicMaterial: any;
  const LineSegments: any;
  const Box3: any;
  const CanvasTexture: any;
}

declare module "three" {
  export = THREE;
}

declare module "three/examples/jsm/loaders/GLTFLoader.js" {
  const GLTFLoader: any;
  export { GLTFLoader };
}
