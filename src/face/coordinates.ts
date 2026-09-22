import type { FaceObservation } from "./FaceObservation";

export type FaceBoundingBox = Readonly<{
  originX: number;
  originY: number;
  width: number;
  height: number;
}>;

export function createFaceObservationFromBoundingBox(
  box: FaceBoundingBox,
  confidence: number,
  sourceWidth: number,
  sourceHeight: number,
): FaceObservation {
  return {
    center: {
      x: (box.originX + box.width * 0.5) / sourceWidth,
      y: 1 - (box.originY + box.height * 0.5) / sourceHeight,
    },
    size: {
      width: box.width / sourceWidth,
      height: box.height / sourceHeight,
    },
    confidence,
    detected: true,
  };
}

export function mapSourceObservationToAspectCoordinates(
  observation: FaceObservation,
  viewportWidth: number,
  viewportHeight: number,
  sourceWidth: number,
  sourceHeight: number,
): FaceObservation {
  const viewportAspect = viewportWidth / viewportHeight;
  const sourceAspect = sourceWidth / sourceHeight;
  const viewportScaleX =
    viewportAspect < sourceAspect ? sourceAspect / viewportAspect : 1;
  const viewportScaleY =
    viewportAspect > sourceAspect ? viewportAspect / sourceAspect : 1;
  const viewportCenter = {
    x: (observation.center.x - 0.5) * viewportScaleX + 0.5,
    y: (observation.center.y - 0.5) * viewportScaleY + 0.5,
  };

  return {
    ...observation,
    center: {
      x: (viewportCenter.x - 0.5) * viewportAspect + 0.5,
      y: viewportCenter.y,
    },
    size: {
      width: observation.size.width * viewportScaleX * viewportAspect,
      height: observation.size.height * viewportScaleY,
    },
  };
}

export function mirrorFaceObservationHorizontally(
  observation: FaceObservation,
): FaceObservation {
  return {
    ...observation,
    center: {
      x: 1 - observation.center.x,
      y: observation.center.y,
    },
    size: { ...observation.size },
  };
}
