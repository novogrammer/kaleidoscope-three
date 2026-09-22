import { describe, expect, it } from "vitest";

import { shouldAttemptHdrOutput } from "./displayOutput";

describe("shouldAttemptHdrOutput", () => {
  it("uses HDR automatically only with WebGPU and an HDR display", () => {
    expect(
      shouldAttemptHdrOutput("auto", {
        webGpuAvailable: true,
        highDynamicRange: true,
      }),
    ).toBe(true);
    expect(
      shouldAttemptHdrOutput("auto", {
        webGpuAvailable: true,
        highDynamicRange: false,
      }),
    ).toBe(false);
    expect(
      shouldAttemptHdrOutput("auto", {
        webGpuAvailable: false,
        highDynamicRange: true,
      }),
    ).toBe(false);
  });

  it("allows an explicit HDR request for WebGPU diagnostics", () => {
    expect(
      shouldAttemptHdrOutput("hdr", {
        webGpuAvailable: true,
        highDynamicRange: false,
      }),
    ).toBe(true);
  });

  it("always honors the SDR override", () => {
    expect(
      shouldAttemptHdrOutput("sdr", {
        webGpuAvailable: true,
        highDynamicRange: true,
      }),
    ).toBe(false);
  });
});
