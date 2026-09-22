import {
  type Camera,
  REVISION,
  type RenderTarget,
  type Scene,
  WebGPURenderer,
} from "three/webgpu";
import { BloomRenderPipeline } from "./BloomRenderPipeline";

const MAX_PIXEL_RATIO = 2;

export type RendererBackend = "webgpu" | "webgl2";

export type RendererViewport = {
  width: number;
  height: number;
  pixelRatio: number;
};

export class RendererController {
  readonly #canvas: HTMLCanvasElement;
  #renderer: WebGPURenderer | null = null;
  #backend: RendererBackend | null = null;
  #bloomPipeline: BloomRenderPipeline | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.#canvas = canvas;
  }

  get backend(): RendererBackend {
    if (this.#backend === null) {
      throw new Error("RendererController has not been initialized.");
    }

    return this.#backend;
  }

  async initialize(): Promise<void> {
    if (this.#renderer !== null) return;

    console.info(`three.js r${REVISION}`);

    const renderer = new WebGPURenderer({
      canvas: this.#canvas,
      antialias: true,
      alpha: false,
    });

    try {
      await renderer.init();
    } catch (error) {
      await renderer.dispose();
      throw error;
    }

    const backend = renderer.backend as { isWebGPUBackend?: boolean };
    this.#renderer = renderer;
    this.#backend = backend.isWebGPUBackend === true ? "webgpu" : "webgl2";
  }

  resize(): RendererViewport {
    const renderer = this.#requireRenderer();
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);

    return { width, height, pixelRatio };
  }

  render(scene: Scene, camera: Camera): void {
    this.#requireRenderer().render(scene, camera);
  }

  configureBloom(scene: Scene, camera: Camera): void {
    this.#bloomPipeline?.dispose();
    this.#bloomPipeline = new BloomRenderPipeline(
      this.#requireRenderer(),
      scene,
      camera,
    );
  }

  renderBloom(): void {
    if (this.#bloomPipeline === null) {
      throw new Error("Bloom pipeline has not been configured.");
    }

    this.#bloomPipeline.render();
  }

  renderToTarget(scene: Scene, camera: Camera, target: RenderTarget): void {
    const renderer = this.#requireRenderer();
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
  }

  setAnimationLoop(
    callback: (time: DOMHighResTimeStamp, frame?: XRFrame) => void,
  ): Promise<void> {
    return this.#requireRenderer().setAnimationLoop(callback);
  }

  async dispose(): Promise<void> {
    if (this.#renderer === null) return;

    const renderer = this.#renderer;
    this.#bloomPipeline?.dispose();
    this.#bloomPipeline = null;
    this.#renderer = null;
    this.#backend = null;
    await renderer.dispose();
  }

  #requireRenderer(): WebGPURenderer {
    if (this.#renderer === null) {
      throw new Error("RendererController has not been initialized.");
    }

    return this.#renderer;
  }
}
