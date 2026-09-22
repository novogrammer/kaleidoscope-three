import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  type Texture,
} from "three/webgpu";
import type { KaleidoscopeFrameState } from "../../kaleidoscope/state";
import { KaleidoscopeMaterial } from "../materials/KaleidoscopeMaterial";

export class TestScene {
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);

  readonly #material: KaleidoscopeMaterial;
  readonly #geometry = new PlaneGeometry(2, 2);
  readonly #quad: Mesh;

  constructor(sourceTexture: Texture, sourceWidth: number, sourceHeight: number) {
    this.#material = new KaleidoscopeMaterial(
      sourceTexture,
      sourceWidth,
      sourceHeight,
    );
    this.#quad = new Mesh(this.#geometry, this.#material);
    this.camera.position.z = 2;
    this.scene.add(this.#quad);
  }

  resize(width: number, height: number): void {
    this.#material.setResolution(width, height);
  }

  update(frame: KaleidoscopeFrameState): void {
    this.#material.updateFrame(frame);
  }

  dispose(): void {
    this.#geometry.dispose();
    this.#material.dispose();
  }
}
