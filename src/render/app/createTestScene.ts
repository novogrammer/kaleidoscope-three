import {
  CircleGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  RingGeometry,
  Scene,
} from "three/webgpu";

export type TestScene = {
  scene: Scene;
  camera: OrthographicCamera;
  resize: (aspect: number) => void;
  update: (time: number) => void;
  dispose: () => void;
};

export function createTestScene(): TestScene {
  const scene = new Scene();
  scene.background = new Color("#05040a");

  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 2;

  const coreGeometry = new CircleGeometry(0.22, 6);
  const coreMaterial = new MeshBasicMaterial({ color: "#ffd6e6" });
  const core = new Mesh(coreGeometry, coreMaterial);
  core.rotation.z = Math.PI / 6;
  scene.add(core);

  const ringGeometry = new RingGeometry(0.34, 0.52, 6);
  const ringMaterial = new MeshBasicMaterial({
    color: "#ff4f8e",
    side: DoubleSide,
  });
  const ring = new Mesh(ringGeometry, ringMaterial);
  ring.rotation.z = Math.PI / 6;
  scene.add(ring);

  return {
    scene,
    camera,
    resize(aspect) {
      camera.left = -aspect;
      camera.right = aspect;
      camera.top = 1;
      camera.bottom = -1;
      camera.updateProjectionMatrix();
    },
    update(time) {
      ring.rotation.z = Math.PI / 6 + time * 0.18;
      const scale = 1 + Math.sin(time * 1.4) * 0.035;
      core.scale.setScalar(scale);
    },
    dispose() {
      coreGeometry.dispose();
      coreMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
    },
  };
}
