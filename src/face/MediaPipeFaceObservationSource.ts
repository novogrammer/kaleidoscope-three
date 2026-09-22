import {
  FaceDetector,
  FilesetResolver,
  type Detection,
} from "@mediapipe/tasks-vision";
import wasmSimdBinaryPath from "@mediapipe/tasks-vision/vision_wasm_internal.wasm?url";
import wasmSimdLoaderPath from "@mediapipe/tasks-vision/vision_wasm_internal.js?url";
import wasmNoSimdBinaryPath from "@mediapipe/tasks-vision/vision_wasm_nosimd_internal.wasm?url";
import wasmNoSimdLoaderPath from "@mediapipe/tasks-vision/vision_wasm_nosimd_internal.js?url";
import modelAssetPath from "../mediapipe-check/assets/blaze_face_short_range.tflite?url";
import type { FaceObservation } from "./FaceObservation";
import type { FaceObservationSource } from "./FaceObservationSource";
import { createFaceObservationFromBoundingBox } from "./coordinates";

const noFace = {
  center: { x: 0.5, y: 0.5 },
  size: { width: 0, height: 0 },
  confidence: 0,
  detected: false,
} satisfies FaceObservation;

export class MediaPipeFaceObservationSource
  implements FaceObservationSource
{
  #detector: FaceDetector | null = null;
  #observation: FaceObservation = noFace;

  async initialize(image: HTMLImageElement): Promise<void> {
    if (this.#detector !== null) return;

    const vision = await createVisionFileset();
    const detector = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath,
        delegate: "CPU",
      },
      runningMode: "IMAGE",
      minDetectionConfidence: 0.5,
      minSuppressionThreshold: 0.3,
    });

    try {
      const detections = detector.detect(image).detections;
      const bestDetection = detections.reduce<(typeof detections)[number] | null>(
        (best, candidate) =>
          best === null || confidenceOf(candidate) > confidenceOf(best)
            ? candidate
            : best,
        null,
      );
      const box = bestDetection?.boundingBox;

      this.#observation =
        bestDetection !== null && bestDetection !== undefined && box
          ? createFaceObservationFromBoundingBox(
              box,
              confidenceOf(bestDetection),
              image.naturalWidth,
              image.naturalHeight,
            )
          : noFace;
      this.#detector = detector;
    } catch (error) {
      detector.close();
      throw error;
    }
  }

  sample(): FaceObservation {
    return {
      ...this.#observation,
      center: { ...this.#observation.center },
      size: { ...this.#observation.size },
    };
  }

  dispose(): void {
    this.#detector?.close();
    this.#detector = null;
    this.#observation = noFace;
  }
}

async function createVisionFileset() {
  const isSimdSupported = await FilesetResolver.isSimdSupported();

  return isSimdSupported
    ? {
        wasmLoaderPath: wasmSimdLoaderPath,
        wasmBinaryPath: wasmSimdBinaryPath,
      }
    : {
        wasmLoaderPath: wasmNoSimdLoaderPath,
        wasmBinaryPath: wasmNoSimdBinaryPath,
      };
}

function confidenceOf(detection: Detection): number {
  return detection.categories[0]?.score ?? 0;
}
