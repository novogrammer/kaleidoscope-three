import { beforeEach, describe, expect, it, vi } from "vitest";
import { HalfFloatType } from "three/webgpu";

type RendererMock = {
  options: Record<string, unknown>;
  init: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
};

const rendererInstances = vi.hoisted(() => [] as RendererMock[]);

vi.mock("three/webgpu", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three/webgpu")>();

  return {
    ...actual,
    WebGPURenderer: class {
      readonly backend = {};
      readonly options: Record<string, unknown>;
      readonly init: ReturnType<typeof vi.fn>;
      readonly dispose = vi.fn(async () => undefined);

      constructor(options: Record<string, unknown>) {
        this.options = options;
        const instanceIndex = rendererInstances.length;
        this.init = vi.fn(async () => {
          throw new Error(
            instanceIndex === 0 ? "HDR init failed" : "SDR init failed",
          );
        });
        rendererInstances.push(this);
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
    rendererInstances.length = 0;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("disposes both renderers when HDR and SDR initialization fail", async () => {
    const controller = new RendererController(
      {} as HTMLCanvasElement,
      "hdr",
      "auto",
    );

    await expect(controller.initialize()).rejects.toThrow("SDR init failed");

    expect(rendererInstances).toHaveLength(2);
    expect(rendererInstances[0]?.options.outputType).toBe(HalfFloatType);
    expect(rendererInstances[1]?.options).not.toHaveProperty("outputType");
    expect(rendererInstances[0]?.dispose).toHaveBeenCalledOnce();
    expect(rendererInstances[1]?.dispose).toHaveBeenCalledOnce();
  });
});
