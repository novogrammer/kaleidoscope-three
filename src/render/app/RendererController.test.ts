import { beforeEach, describe, expect, it, vi } from "vitest";
import { HalfFloatType } from "three/webgpu";

type RendererMock = {
  options: Record<string, unknown>;
  init: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  defaultOnDeviceLost: ReturnType<typeof vi.fn>;
  onDeviceLost: (info: unknown) => void;
};

const rendererMockState = vi.hoisted(() => ({
  instances: [] as RendererMock[],
  initErrors: [] as Array<Error | undefined>,
}));

vi.mock("three/webgpu", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three/webgpu")>();

  return {
    ...actual,
    WebGPURenderer: class {
      readonly backend = {};
      readonly options: Record<string, unknown>;
      readonly init: ReturnType<typeof vi.fn>;
      readonly dispose = vi.fn(async () => undefined);
      readonly defaultOnDeviceLost = vi.fn();
      onDeviceLost: (info: unknown) => void = this.defaultOnDeviceLost;

      constructor(options: Record<string, unknown>) {
        this.options = options;
        const instanceIndex = rendererMockState.instances.length;
        this.init = vi.fn(async () => {
          const error = rendererMockState.initErrors[instanceIndex];
          if (error !== undefined) throw error;
        });
        rendererMockState.instances.push(this);
      }
    },
  };
});

vi.mock("./displayOutput", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./displayOutput")>();

  return {
    ...actual,
    readDisplayOutputCapabilities: () => ({
      webGpuAvailable: true,
      highDynamicRange: true,
    }),
  };
});

import { RendererController } from "./RendererController";

describe("RendererController", () => {
  beforeEach(() => {
    rendererMockState.instances.length = 0;
    rendererMockState.initErrors.length = 0;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("disposes both renderers when HDR and SDR initialization fail", async () => {
    rendererMockState.initErrors.push(
      new Error("HDR init failed"),
      new Error("SDR init failed"),
    );
    const controller = new RendererController(
      {} as HTMLCanvasElement,
      "hdr",
      "auto",
    );

    await expect(controller.initialize()).rejects.toThrow("SDR init failed");

    expect(rendererMockState.instances).toHaveLength(2);
    expect(rendererMockState.instances[0]?.options.outputType).toBe(
      HalfFloatType,
    );
    expect(rendererMockState.instances[1]?.options).not.toHaveProperty(
      "outputType",
    );
    expect(rendererMockState.instances[0]?.dispose).toHaveBeenCalledOnce();
    expect(rendererMockState.instances[1]?.dispose).toHaveBeenCalledOnce();
  });

  it("reports unexpected device loss after running the default handler", async () => {
    const onDeviceLost = vi.fn();
    const controller = new RendererController(
      {} as HTMLCanvasElement,
      "sdr",
      "auto",
      onDeviceLost,
    );
    await controller.initialize();
    const renderer = rendererMockState.instances[0];

    renderer?.onDeviceLost({ api: "WebGPU" });

    expect(renderer?.defaultOnDeviceLost).toHaveBeenCalledOnce();
    expect(onDeviceLost).toHaveBeenCalledOnce();
  });

  it("does not report device loss caused while disposing", async () => {
    const onDeviceLost = vi.fn();
    const controller = new RendererController(
      {} as HTMLCanvasElement,
      "sdr",
      "auto",
      onDeviceLost,
    );
    await controller.initialize();
    const renderer = rendererMockState.instances[0];
    renderer?.dispose.mockImplementationOnce(async () => {
      renderer.onDeviceLost({ api: "WebGPU" });
    });

    await controller.dispose();

    expect(renderer?.defaultOnDeviceLost).toHaveBeenCalledOnce();
    expect(onDeviceLost).not.toHaveBeenCalled();
  });
});
