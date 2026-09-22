import type { FaceObservation } from "../face/FaceObservation";

export type KaleidoscopeLayerState = {
  center: { x: number; y: number };
  radiusMinimum: number;
  radiusMaximum: number;
  unitLength: number;
};

export type KaleidoscopeFrameState = {
  rotation: number;
  layers: readonly [
    KaleidoscopeLayerState,
    KaleidoscopeLayerState,
    KaleidoscopeLayerState,
  ];
};

const angularVelocity = (10 * Math.PI) / 180;
export const FACE_FADE_DURATION_SECONDS = 1;
export const FACE_CENTER_SMOOTHING_HALF_LIFE_SECONDS = 0.1;
const dummyRadiusMaximum = 0.75;
const dummyUnitLengthMaximum = 0.2;
const mainRadiusMaximum = 1;
const mainUnitLengthMaximum = 0.65;
const minimumUnitLength = 0.0001;

export class KaleidoscopeStateController {
  #fadeFactor = 0;
  #previousElapsedSeconds: number | null = null;
  #hasDetectedFace = false;
  #targetCenter = { x: 0.5, y: 0.5 };
  #smoothedCenter = { x: 0.5, y: 0.5 };

  update(
    elapsedSeconds: number,
    face: FaceObservation,
  ): KaleidoscopeFrameState {
    const deltaSeconds =
      this.#previousElapsedSeconds === null
        ? 0
        : Math.max(0, elapsedSeconds - this.#previousElapsedSeconds);

    if (face.detected) {
      this.#targetCenter = { ...face.center };

      if (!this.#hasDetectedFace) {
        this.#smoothedCenter = { ...face.center };
        this.#hasDetectedFace = true;
      }
    }

    const smoothingFactor = exponentialSmoothingFactor(
      deltaSeconds,
      FACE_CENTER_SMOOTHING_HALF_LIFE_SECONDS,
    );
    this.#smoothedCenter = {
      x: lerp(this.#smoothedCenter.x, this.#targetCenter.x, smoothingFactor),
      y: lerp(this.#smoothedCenter.y, this.#targetCenter.y, smoothingFactor),
    };

    const target = face.detected ? 1 : 0;
    const maximumChange = deltaSeconds / FACE_FADE_DURATION_SECONDS;
    this.#fadeFactor = moveTowards(
      this.#fadeFactor,
      target,
      maximumChange,
    );
    this.#previousElapsedSeconds = elapsedSeconds;

    return calculateKaleidoscopeFrameState(
      elapsedSeconds,
      {
        ...face,
        center: { ...this.#smoothedCenter },
      },
      this.#fadeFactor,
    );
  }
}

export function calculateKaleidoscopeFrameState(
  elapsedSeconds: number,
  face: FaceObservation,
  mainFadeFactor = face.detected ? 1 : 0,
): KaleidoscopeFrameState {
  const rotation = angularVelocity * elapsedSeconds;
  const sine = Math.sin(rotation);
  const cosine = Math.cos(rotation);

  return {
    rotation,
    layers: [
      {
        center: { ...face.center },
        radiusMinimum: 0,
        radiusMaximum: mainFadeFactor * mainRadiusMaximum,
        unitLength: Math.max(
          easeOutSine(mainFadeFactor) * mainUnitLengthMaximum,
          minimumUnitLength,
        ),
      },
      createAuxiliaryLayer(sine, { x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9 }),
      createAuxiliaryLayer(cosine, { x: 0.9, y: 0.1 }, { x: 0.1, y: 0.9 }),
    ],
  };
}

function exponentialSmoothingFactor(
  deltaSeconds: number,
  halfLifeSeconds: number,
): number {
  return 1 - Math.pow(0.5, deltaSeconds / halfLifeSeconds);
}

function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}

function easeOutSine(value: number): number {
  return Math.sin(value * Math.PI * 0.5);
}

function moveTowards(
  current: number,
  target: number,
  maximumChange: number,
): number {
  if (Math.abs(target - current) <= maximumChange) return target;
  return current + Math.sign(target - current) * maximumChange;
}

function createAuxiliaryLayer(
  phase: number,
  positiveCenter: { x: number; y: number },
  nonPositiveCenter: { x: number; y: number },
): KaleidoscopeLayerState {
  const strength = Math.abs(phase);

  return {
    center: { ...(phase > 0 ? positiveCenter : nonPositiveCenter) },
    radiusMinimum: 0,
    radiusMaximum: strength * dummyRadiusMaximum,
    unitLength: Math.max(
      strength * dummyUnitLengthMaximum,
      minimumUnitLength,
    ),
  };
}
