import type { MockMode } from "../app/config";
import type { FaceObservation } from "./FaceObservation";
import type { FaceObservationSource } from "./FaceObservationSource";

const centeredFace = {
  center: { x: 0.5, y: 0.5 },
  size: { width: 0.36, height: 0.48 },
  confidence: 1,
  detected: true,
} satisfies FaceObservation;

export class MockFaceObservationSource implements FaceObservationSource {
  readonly #mode: MockMode;

  constructor(mode: MockMode) {
    this.#mode = mode;
  }

  sample(elapsedSeconds: number): FaceObservation {
    return sampleMockFaceObservation(this.#mode, elapsedSeconds);
  }
}

export function sampleMockFaceObservation(
  mode: MockMode,
  elapsedSeconds: number,
): FaceObservation {
  if (mode === "center") return cloneObservation(centeredFace);

  if (mode === "enter-exit") {
    const cycle = positiveModulo(elapsedSeconds, 6);
    return {
      ...cloneObservation(centeredFace),
      detected: cycle < 3,
      confidence: cycle < 3 ? 1 : 0,
    };
  }

  return {
    ...cloneObservation(centeredFace),
    center: {
      x: 0.5 + Math.sin(elapsedSeconds * 0.7) * 0.25,
      y: 0.5 + Math.cos(elapsedSeconds * 0.5) * 0.18,
    },
  };
}

function cloneObservation(observation: FaceObservation): FaceObservation {
  return {
    ...observation,
    center: { ...observation.center },
    size: { ...observation.size },
  };
}

function positiveModulo(value: number, divisor: number): number {
  return value - divisor * Math.floor(value / divisor);
}
