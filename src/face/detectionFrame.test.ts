import { describe, expect, it } from "vitest";
import { calculateDetectionFrameSize } from "./detectionFrame";

describe("calculateDetectionFrameSize", () => {
  it("fits a landscape frame within a 320px long edge", () => {
    expect(calculateDetectionFrameSize(1280, 720)).toEqual({
      width: 320,
      height: 180,
    });
  });

  it("fits a portrait frame within a 320px long edge", () => {
    expect(calculateDetectionFrameSize(720, 1280)).toEqual({
      width: 180,
      height: 320,
    });
  });

  it("does not upscale a smaller frame", () => {
    expect(calculateDetectionFrameSize(240, 180)).toEqual({
      width: 240,
      height: 180,
    });
  });
});
