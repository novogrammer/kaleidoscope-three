import { Mesh, OrthographicCamera, PlaneGeometry, Scene } from "three/webgpu";
import { KaleidoscopeTestMaterial } from "../materials/KaleidoscopeTestMaterial";
import { TestPatternTexture } from "../textures/TestPatternTexture";

export class TestScene {
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);

  readonly #texture = new TestPatternTexture();
  readonly #material = new KaleidoscopeTestMaterial(this.#texture);
  readonly #geometry = new PlaneGeometry(2, 2);
  readonly #quad = new Mesh(this.#geometry, this.#material);

  constructor() {
    this.camera.position.z = 2;
    this.scene.add(this.#quad);
  }

  resize(width: number, height: number): void {
    this.#material.setResolution(width, height);
  }

  dispose(): void {
    this.#geometry.dispose();
    this.#material.dispose();
    this.#texture.dispose();
  }
}
