import {
  createNoFaceObservation,
  type FaceObservation,
} from "./FaceObservation";
import type { FaceObservationSource } from "./FaceObservationSource";

export class NoFaceObservationSource implements FaceObservationSource {
  sample(): FaceObservation {
    return createNoFaceObservation();
  }
}
