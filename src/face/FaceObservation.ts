export type FaceObservation = {
  center: { x: number; y: number };
  size: { width: number; height: number };
  confidence: number;
  detected: boolean;
};

export function createNoFaceObservation(): FaceObservation {
  return {
    center: { x: 0.5, y: 0.5 },
    size: { width: 0, height: 0 },
    confidence: 0,
    detected: false,
  };
}
