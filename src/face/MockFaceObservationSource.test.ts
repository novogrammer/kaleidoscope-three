import { describe, expect, it } from "vitest";

import { sampleMockFaceObservation } from "./MockFaceObservationSource";

describe("sampleMockFaceObservation", () => {
  it("keeps the center mock fixed and detected", () => {
    expect(sampleMockFaceObservation("center", 123)).toEqual({
      center: { x: 0.5, y: 0.5 },
      size: { width: 0.36, height: 0.48 },
      confidence: 1,
      detected: true,
    });
  });

  it("alternates detection every three seconds", () => {
    expect(sampleMockFaceObservation("enter-exit", 2.99).detected).toBe(true);
    expect(sampleMockFaceObservation("enter-exit", 3).detected).toBe(false);
    expect(sampleMockFaceObservation("enter-exit", 6).detected).toBe(true);
  });

  it("moves within a bounded area", () => {
    const observation = sampleMockFaceObservation("move", Math.PI);

    expect(observation.detected).toBe(true);
    expect(observation.center.x).toBeGreaterThanOrEqual(0.25);
    expect(observation.center.x).toBeLessThanOrEqual(0.75);
    expect(observation.center.y).toBeGreaterThanOrEqual(0.32);
    expect(observation.center.y).toBeLessThanOrEqual(0.68);
  });
});
