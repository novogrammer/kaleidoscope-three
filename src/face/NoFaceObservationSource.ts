import type { FaceObservation } from "./FaceObservation";
import type { FaceObservationSource } from "./FaceObservationSource";

export class NoFaceObservationSource implements FaceObservationSource {
  sample(): FaceObservation {
    return {
      center: { x: 0.5, y: 0.5 },
      size: { width: 0, height: 0 },
      confidence: 0,
      detected: false,
    };
  }
}
