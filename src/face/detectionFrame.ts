export const FACE_DETECTION_MAX_DIMENSION = 320;

export type DetectionFrameSize = Readonly<{
  width: number;
  height: number;
}>;

export function calculateDetectionFrameSize(
  sourceWidth: number,
  sourceHeight: number,
): DetectionFrameSize {
  const scale = Math.min(
    1,
    FACE_DETECTION_MAX_DIMENSION / Math.max(sourceWidth, sourceHeight),
  );

  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}
