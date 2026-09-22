export type FaceObservation = {
  center: { x: number; y: number };
  size: { width: number; height: number };
  confidence: number;
  detected: boolean;
};
