import { describe, expect, it } from "vitest";
import type { FaceObservation } from "./FaceObservation";
import {
  createFaceObservationFromBoundingBox,
  mapSourceObservationToAspectCoordinates,
  mirrorFaceObservationHorizontally,
} from "./coordinates";

const sourceObservation = {
  center: { x: 0.75, y: 0.75 },
  size: { width: 0.2, height: 0.4 },
  confidence: 0.9,
  detected: true,
} satisfies FaceObservation;

describe("face coordinate conversion", () => {
  it("normalizes a top-left MediaPipe bounding box and flips its y axis", () => {
    expect(
      createFaceObservationFromBoundingBox(
        { originX: 100, originY: 200, width: 200, height: 400 },
        0.8,
        1000,
        1000,
      ),
    ).toEqual({
      center: { x: 0.2, y: 0.6 },
      size: { width: 0.2, height: 0.4 },
      confidence: 0.8,
      detected: true,
    });
  });

  it("maps a square source through a landscape cover crop", () => {
    const mapped = mapSourceObservationToAspectCoordinates(
      sourceObservation,
      1920,
      1080,
      1024,
      1024,
    );

    expect(mapped.center.x).toBeCloseTo(17 / 18);
    expect(mapped.center.y).toBeCloseTo(17 / 18);
    expect(mapped.size.width).toBeCloseTo(16 / 45);
    expect(mapped.size.height).toBeCloseTo(32 / 45);
  });

  it("maps a square source through a portrait cover crop", () => {
    const mapped = mapSourceObservationToAspectCoordinates(
      sourceObservation,
      1080,
      1920,
      1024,
      1024,
    );

    expect(mapped.center.x).toBeCloseTo(0.75);
    expect(mapped.center.y).toBeCloseTo(0.75);
    expect(mapped.size.width).toBeCloseTo(0.2);
    expect(mapped.size.height).toBeCloseTo(0.4);
  });

  it("mirrors a camera observation without changing its size", () => {
    expect(mirrorFaceObservationHorizontally(sourceObservation)).toEqual({
      ...sourceObservation,
      center: { x: 0.25, y: 0.75 },
      size: { ...sourceObservation.size },
    });
  });
});
