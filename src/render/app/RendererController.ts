import {
  ACESFilmicToneMapping,
  ColorManagement,
  HalfFloatType,
  NoToneMapping,
  type Camera,
  REVISION,
  SRGBColorSpace,
  type RenderTarget,
  type Scene,
  WebGPURenderer,
} from "three/webgpu";
import {
  ExtendedSRGBColorSpace,
  ExtendedSRGBColorSpaceImpl,
} from "three/addons/math/ColorSpaces.js";
import { BloomRenderPipeline } from "./BloomRenderPipeline";
import {
  type DisplayOutputMode,
  type DisplayOutputPreference,
  readDisplayOutputCapabilities,
  shouldAttemptHdrOutput,
} from "./displayOutput";
import type { RendererBackendPreference } from "./rendererBackend";

const MAX_PIXEL_RATIO = 2;
export const SDR_TONE_MAPPING_EXPOSURE = 1;

export type RendererBackend = "webgpu" | "webgl2";

export type RendererViewport = {
  width: number;
  height: number;
  pixelRatio: number;
};

export class RendererController {
  readonly #canvas: HTMLCanvasElement;
  readonly #outputPreference: DisplayOutputPreference;
  readonly #backendPreference: RendererBackendPreference;
  #renderer: WebGPURenderer | null = null;
  #backend: RendererBackend | null = null;
  #outputMode: DisplayOutputMode | null = null;
  #bloomPipeline: BloomRenderPipeline | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    outputPreference: DisplayOutputPreference = "auto",
    backendPreference: RendererBackendPreference = "auto",
  ) {
    this.#canvas = canvas;
    this.#outputPreference = outputPreference;
    this.#backendPreference = backendPreference;
  }

  get outputMode(): DisplayOutputMode {
    if (this.#outputMode === null) {
      throw new Error("RendererController has not been initialized.");
    }

    return this.#outputMode;
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

    const capabilities = readDisplayOutputCapabilities();
    const forceWebGl = this.#backendPreference === "webgl2";
    const attemptHdr =
      !forceWebGl &&
      shouldAttemptHdrOutput(this.#outputPreference, capabilities);
    let hdrInitialized = attemptHdr;
    let renderer = this.#createRenderer(attemptHdr);

    try {
      await renderer.init();
    } catch (error) {
      await renderer.dispose();
      if (!attemptHdr) throw error;

      console.warn(
        "Renderer initialization with HDR settings failed. Falling back to SDR output.",
        error,
      );
      hdrInitialized = false;
      renderer = this.#createRenderer(false);
      try {
        await renderer.init();
      } catch (fallbackError) {
        await renderer.dispose();
        throw fallbackError;
      }
    }

    const backend = renderer.backend as { isWebGPUBackend?: boolean };
    this.#renderer = renderer;
    this.#backend = backend.isWebGPUBackend === true ? "webgpu" : "webgl2";
    this.#outputMode =
      hdrInitialized && this.#backend === "webgpu" ? "hdr" : "sdr";

    if (this.#outputMode === "sdr") this.#configureSdrOutput(renderer);
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
    this.#outputMode = null;
    await renderer.dispose();
  }

  #createRenderer(hdr: boolean): WebGPURenderer {
    if (hdr) {
      ColorManagement.define({
        [ExtendedSRGBColorSpace]: ExtendedSRGBColorSpaceImpl,
      });
    }

    const renderer = new WebGPURenderer({
      canvas: this.#canvas,
      antialias: true,
      alpha: false,
      forceWebGL: this.#backendPreference === "webgl2",
      ...(hdr ? { outputType: HalfFloatType } : {}),
    });

    if (hdr) {
      renderer.outputColorSpace = ExtendedSRGBColorSpace;
      renderer.toneMapping = NoToneMapping;
    }

    return renderer;
  }

  #configureSdrOutput(renderer: WebGPURenderer): void {
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = SDR_TONE_MAPPING_EXPOSURE;
  }

  #requireRenderer(): WebGPURenderer {
    if (this.#renderer === null) {
      throw new Error("RendererController has not been initialized.");
    }

    return this.#renderer;
  }
}
