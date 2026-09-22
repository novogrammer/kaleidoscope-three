import { describe, expect, it } from "vitest";

import type { FaceObservation } from "../face/FaceObservation";
import {
  KaleidoscopeStateController,
  calculateKaleidoscopeFrameState,
} from "./state";

const detectedFace = {
  center: { x: 0.4, y: 0.6 },
  size: { width: 0.3, height: 0.4 },
  confidence: 1,
  detected: true,
} satisfies FaceObservation;

describe("calculateKaleidoscopeFrameState", () => {
  it("uses the detected face for the main layer", () => {
    const frame = calculateKaleidoscopeFrameState(0, detectedFace);

    expect(frame.layers[0]).toEqual({
      center: { x: 0.4, y: 0.6 },
      radiusMinimum: 0,
      radiusMaximum: 1,
      unitLength: 0.65,
    });
  });

  it("hides the main layer when no face is detected", () => {
    const frame = calculateKaleidoscopeFrameState(0, {
      ...detectedFace,
      detected: false,
    });

    expect(frame.layers[0].radiusMaximum).toBe(0);
    expect(frame.layers[0].unitLength).toBeGreaterThan(0);
  });

  it("matches the initial sine and cosine auxiliary layers", () => {
    const frame = calculateKaleidoscopeFrameState(0, detectedFace);

    expect(frame.rotation).toBe(0);
    expect(frame.layers[1]).toEqual({
      center: { x: 0.9, y: 0.9 },
      radiusMinimum: 0,
      radiusMaximum: 0,
      unitLength: 0.0001,
    });
    expect(frame.layers[2]).toEqual({
      center: { x: 0.9, y: 0.1 },
      radiusMinimum: 0,
      radiusMaximum: 0.75,
      unitLength: 0.2,
    });
  });

  it("rotates by ten degrees per second", () => {
    const frame = calculateKaleidoscopeFrameState(9, detectedFace);

    expect(frame.rotation).toBeCloseTo(Math.PI / 2);
    expect(frame.layers[1].center).toEqual({ x: 0.1, y: 0.1 });
    expect(frame.layers[1].radiusMaximum).toBeCloseTo(0.75);
    expect(frame.layers[1].unitLength).toBeCloseTo(0.2);
  });
});

describe("KaleidoscopeStateController", () => {
  it("fades the main radius in linearly over one second", () => {
    const controller = new KaleidoscopeStateController();

    expect(controller.update(0, detectedFace).layers[0].radiusMaximum).toBe(0);
    expect(controller.update(0.5, detectedFace).layers[0].radiusMaximum).toBe(
      0.5,
    );
    expect(controller.update(1, detectedFace).layers[0].radiusMaximum).toBe(1);
  });

  it("uses Unity's ease-out-sine curve for the main unit length", () => {
    const controller = new KaleidoscopeStateController();

    controller.update(0, detectedFace);
    const frame = controller.update(0.5, detectedFace);

    expect(frame.layers[0].unitLength).toBeCloseTo(
      Math.sin(Math.PI / 4) * 0.65,
    );
  });

  it("fades out from the current value when the face disappears", () => {
    const controller = new KaleidoscopeStateController();

    controller.update(0, detectedFace);
    controller.update(1, detectedFace);
    const fadingFrame = controller.update(1.25, {
      ...detectedFace,
      detected: false,
    });
    const hiddenFrame = controller.update(2, {
      ...detectedFace,
      detected: false,
    });

    expect(fadingFrame.layers[0].radiusMaximum).toBe(0.75);
    expect(hiddenFrame.layers[0].radiusMaximum).toBe(0);
    expect(hiddenFrame.layers[0].unitLength).toBeGreaterThan(0);
  });

  it("keeps the last detected center while fading out", () => {
    const controller = new KaleidoscopeStateController();

    controller.update(0, detectedFace);
    const frame = controller.update(0.25, {
      ...detectedFace,
      center: { x: 0.5, y: 0.5 },
      detected: false,
    });

    expect(frame.layers[0].center).toEqual(detectedFace.center);
  });
});
