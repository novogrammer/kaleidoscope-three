import {
  RenderPipeline,
  type Camera,
  type Scene,
  type WebGPURenderer,
} from "three/webgpu";
import { pass } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";

export const BLOOM_STRENGTH = 0.25;
export const BLOOM_RADIUS = 0.5;
export const BLOOM_THRESHOLD = 1;

export class BloomRenderPipeline {
  readonly #scenePass: ReturnType<typeof pass>;
  readonly #bloomPass: ReturnType<typeof bloom>;
  readonly #pipeline: RenderPipeline;

  constructor(renderer: WebGPURenderer, scene: Scene, camera: Camera) {
    this.#scenePass = pass(scene, camera, { depthBuffer: false });
    const sceneColor = this.#scenePass.getTextureNode("output");
    this.#bloomPass = bloom(
      sceneColor,
      BLOOM_STRENGTH,
      BLOOM_RADIUS,
      BLOOM_THRESHOLD,
    );
    this.#pipeline = new RenderPipeline(
      renderer,
      sceneColor.add(this.#bloomPass),
    );
  }

  render(): void {
    this.#pipeline.render();
  }

  dispose(): void {
    this.#pipeline.dispose();
    this.#bloomPass.dispose();
    this.#scenePass.dispose();
  }
}
