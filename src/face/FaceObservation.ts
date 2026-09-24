export type FaceObservation = Readonly<{
  center: Readonly<{ x: number; y: number }>;
  size: Readonly<{ width: number; height: number }>;
  confidence: number;
  detected: boolean;
}>;

export interface FaceObservationSource {
  sample(elapsedSeconds: number): FaceObservation;
  dispose?(): void;
}

export const NO_FACE_OBSERVATION = {
  center: { x: 0.5, y: 0.5 },
  size: { width: 0, height: 0 },
  confidence: 0,
  detected: false,
} as const satisfies FaceObservation;

export const NO_FACE_OBSERVATION_SOURCE = {
  sample: () => NO_FACE_OBSERVATION,
} as const satisfies FaceObservationSource;
