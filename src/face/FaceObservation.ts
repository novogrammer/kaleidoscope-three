export type FaceObservation = Readonly<{
  center: Readonly<{ x: number; y: number }>;
  size: Readonly<{ width: number; height: number }>;
  confidence: number;
  detected: boolean;
}>;

export const NO_FACE_OBSERVATION = {
  center: { x: 0.5, y: 0.5 },
  size: { width: 0, height: 0 },
  confidence: 0,
  detected: false,
} as const satisfies FaceObservation;
