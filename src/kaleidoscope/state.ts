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
const dummyRadiusMaximum = 0.75;
const dummyUnitLengthMaximum = 0.2;
const minimumUnitLength = 0.0001;

export function calculateKaleidoscopeFrameState(
  elapsedSeconds: number,
  face: FaceObservation,
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
        radiusMaximum: face.detected ? 1 : 0,
        unitLength: face.detected ? 0.65 : minimumUnitLength,
      },
      createAuxiliaryLayer(sine, { x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9 }),
      createAuxiliaryLayer(cosine, { x: 0.9, y: 0.1 }, { x: 0.1, y: 0.9 }),
    ],
  };
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
