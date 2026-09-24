import type { Detection } from "@mediapipe/tasks-vision";
import { describe, expect, it } from "vitest";
import { createFaceObservationFromDetections } from "./mediapipeObservation";

function createDetection(
  score: number,
  boundingBox?: Detection["boundingBox"],
): Detection {
  return {
    categories: [{ score }],
    boundingBox,
  } as Detection;
}

describe("createFaceObservationFromDetections", () => {
  it("returns the no-face observation when no valid bounding box exists", () => {
    expect(
      createFaceObservationFromDetections([], 100, 100, false),
    ).toEqual({
      center: { x: 0.5, y: 0.5 },
      size: { width: 0, height: 0 },
      confidence: 0,
      detected: false,
    });
  });

  it("selects the highest-confidence detection that has a bounding box", () => {
    const observation = createFaceObservationFromDetections(
      [
        createDetection(0.99),
        createDetection(0.6, {
          originX: 10,
          originY: 20,
          width: 20,
          height: 40,
          angle: 0,
        }),
        createDetection(0.8, {
          originX: 50,
          originY: 10,
          width: 30,
          height: 20,
          angle: 0,
        }),
      ],
      100,
      100,
      false,
    );

    expect(observation).toEqual({
      center: { x: 0.65, y: 0.8 },
      size: { width: 0.3, height: 0.2 },
      confidence: 0.8,
      detected: true,
    });
  });

  it("mirrors the selected observation only when requested", () => {
    const detection = createDetection(0.8, {
      originX: 10,
      originY: 20,
      width: 20,
      height: 40,
      angle: 0,
    });

    const normal = createFaceObservationFromDetections(
      [detection],
      100,
      100,
      false,
    );
    const mirrored = createFaceObservationFromDetections(
      [detection],
      100,
      100,
      true,
    );

    expect(normal.center.x).toBe(0.2);
    expect(mirrored.center.x).toBe(0.8);
    expect(mirrored.size).toEqual(normal.size);
  });
});
