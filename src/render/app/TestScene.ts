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

export class TestScene {
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);

  readonly #coreGeometry = new CircleGeometry(0.22, 6);
  readonly #coreMaterial = new MeshBasicMaterial({ color: "#ffd6e6" });
  readonly #core = new Mesh(this.#coreGeometry, this.#coreMaterial);
  readonly #ringGeometry = new RingGeometry(0.34, 0.52, 6);
  readonly #ringMaterial = new MeshBasicMaterial({
    color: "#ff4f8e",
    side: DoubleSide,
  });
  readonly #ring = new Mesh(this.#ringGeometry, this.#ringMaterial);

  constructor() {
    this.scene.background = new Color("#05040a");
    this.camera.position.z = 2;

    this.#core.rotation.z = Math.PI / 6;
    this.scene.add(this.#core);

    this.#ring.rotation.z = Math.PI / 6;
    this.scene.add(this.#ring);
  }

  resize(aspect: number): void {
    this.camera.left = -aspect;
    this.camera.right = aspect;
    this.camera.top = 1;
    this.camera.bottom = -1;
    this.camera.updateProjectionMatrix();
  }

  update(time: number): void {
    this.#ring.rotation.z = Math.PI / 6 + time * 0.18;
    const scale = 1 + Math.sin(time * 1.4) * 0.035;
    this.#core.scale.setScalar(scale);
  }

  dispose(): void {
    this.#coreGeometry.dispose();
    this.#coreMaterial.dispose();
    this.#ringGeometry.dispose();
    this.#ringMaterial.dispose();
  }
}
