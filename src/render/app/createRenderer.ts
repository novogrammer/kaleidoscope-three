import { REVISION, WebGPURenderer } from "three/webgpu";

const MAX_PIXEL_RATIO = 2;

export type RendererBackend = "webgpu" | "webgl2";

export type RendererViewport = {
  width: number;
  height: number;
  pixelRatio: number;
};

export async function createRenderer(canvas: HTMLCanvasElement): Promise<{
  renderer: WebGPURenderer;
  backend: RendererBackend;
}> {
  console.info(`three.js r${REVISION}`);

  const renderer = new WebGPURenderer({
    canvas,
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

  return {
    renderer,
    backend: backend.isWebGPUBackend === true ? "webgpu" : "webgl2",
  };
}

export function resizeRenderer(renderer: WebGPURenderer): RendererViewport {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);

  return { width, height, pixelRatio };
}
