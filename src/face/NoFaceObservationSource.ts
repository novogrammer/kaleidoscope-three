import { NO_FACE_OBSERVATION, type FaceObservation } from "./FaceObservation";
import type { FaceObservationSource } from "./FaceObservationSource";

export class NoFaceObservationSource implements FaceObservationSource {
  sample(): FaceObservation {
    return NO_FACE_OBSERVATION;
  }
}
