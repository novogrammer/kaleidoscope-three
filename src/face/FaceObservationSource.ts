import type { FaceObservation } from "./FaceObservation";

export interface FaceObservationSource {
  sample(elapsedSeconds: number): FaceObservation;
  dispose?(): void;
}
