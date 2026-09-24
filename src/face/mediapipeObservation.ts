import type { Detection } from "@mediapipe/tasks-vision";
import {
  createNoFaceObservation,
  type FaceObservation,
} from "./FaceObservation";
import {
  createFaceObservationFromBoundingBox,
  mirrorFaceObservationHorizontally,
} from "./coordinates";

function confidenceOf(detection: Detection): number {
  return detection.categories[0]?.score ?? 0;
}

export function createFaceObservationFromDetections(
  detections: readonly Detection[],
  sourceWidth: number,
  sourceHeight: number,
  mirrorHorizontally: boolean,
): FaceObservation {
  const bestDetection = detections.reduce<Detection | null>(
    (best, candidate) => {
      if (!candidate.boundingBox) return best;

      return best === null || confidenceOf(candidate) > confidenceOf(best)
        ? candidate
        : best;
    },
    null,
  );
  const box = bestDetection?.boundingBox;

  if (!box) return createNoFaceObservation();

  const observation = createFaceObservationFromBoundingBox(
    box,
    confidenceOf(bestDetection),
    sourceWidth,
    sourceHeight,
  );

  return mirrorHorizontally
    ? mirrorFaceObservationHorizontally(observation)
    : observation;
}
