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
import { TimingWindow } from "../diagnostics/TimingWindow";
import type { FaceObservation } from "./FaceObservation";
import type { FaceObservationSource } from "./FaceObservationSource";
import {
  createFaceObservationFromBoundingBox,
  mirrorFaceObservationHorizontally,
} from "./coordinates";
import { calculateDetectionFrameSize } from "./detectionFrame";

export const FACE_DETECTION_INTERVAL_MS = 1000 / 15;
const DETECTION_TIMING_SAMPLE_COUNT = 60;

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
  #video: HTMLVideoElement | null = null;
  #detectionCanvas: HTMLCanvasElement | null = null;
  #detectionContext: CanvasRenderingContext2D | null = null;
  #lastDetectionTimeMs = -Infinity;
  #lastVideoTime = -1;
  readonly #detectionTimings = import.meta.env.DEV
    ? new TimingWindow(DETECTION_TIMING_SAMPLE_COUNT)
    : null;

  async initializeImage(image: HTMLImageElement): Promise<void> {
    if (this.#detector !== null) return;

    const detector = await createDetector("IMAGE");

    try {
      this.#observation = createObservation(
        detector.detect(image).detections,
        image.naturalWidth,
        image.naturalHeight,
        false,
      );
      this.#detector = detector;
    } catch (error) {
      detector.close();
      throw error;
    }
  }

  async initializeVideo(video: HTMLVideoElement): Promise<void> {
    if (this.#detector !== null) return;

    const detector = await createDetector("VIDEO");
    const detectionCanvas = document.createElement("canvas");
    const detectionSize = calculateDetectionFrameSize(
      video.videoWidth,
      video.videoHeight,
    );
    detectionCanvas.width = detectionSize.width;
    detectionCanvas.height = detectionSize.height;
    const detectionContext = detectionCanvas.getContext("2d", {
      alpha: false,
    });

    if (detectionContext === null) {
      detector.close();
      throw new Error("Could not create the face detection canvas context.");
    }

    this.#detector = detector;
    this.#video = video;
    this.#detectionCanvas = detectionCanvas;
    this.#detectionContext = detectionContext;
  }

  sample(elapsedSeconds: number): FaceObservation {
    this.#detectVideoFrame(elapsedSeconds * 1000);

    return {
      ...this.#observation,
      center: { ...this.#observation.center },
      size: { ...this.#observation.size },
    };
  }

  dispose(): void {
    this.#detector?.close();
    this.#detector = null;
    this.#video = null;
    this.#detectionCanvas = null;
    this.#detectionContext = null;
    this.#observation = noFace;
    this.#lastDetectionTimeMs = -Infinity;
    this.#lastVideoTime = -1;
  }

  #detectVideoFrame(timestampMs: number): void {
    if (
      this.#detector === null ||
      this.#video === null ||
      timestampMs - this.#lastDetectionTimeMs < FACE_DETECTION_INTERVAL_MS ||
      this.#video.currentTime === this.#lastVideoTime
    ) {
      return;
    }

    const detections = this.#detectForVideo(timestampMs);

    this.#observation = createObservation(
      detections,
      this.#detectionCanvas?.width ?? this.#video.videoWidth,
      this.#detectionCanvas?.height ?? this.#video.videoHeight,
      true,
    );
    this.#lastDetectionTimeMs = timestampMs;
    this.#lastVideoTime = this.#video.currentTime;
  }

  #detectForVideo(timestampMs: number): Detection[] {
    if (
      this.#detector === null ||
      this.#video === null ||
      this.#detectionCanvas === null ||
      this.#detectionContext === null
    ) {
      return [];
    }

    if (this.#detectionTimings === null) {
      return this.#runDetectionPipeline(timestampMs);
    }

    const detectionStart = performance.now();
    const detections = this.#runDetectionPipeline(timestampMs);
    this.#recordDetectionTime(performance.now() - detectionStart);
    return detections;
  }

  #runDetectionPipeline(timestampMs: number): Detection[] {
    if (
      this.#detector === null ||
      this.#video === null ||
      this.#detectionCanvas === null ||
      this.#detectionContext === null
    ) {
      return [];
    }

    this.#detectionContext.drawImage(
      this.#video,
      0,
      0,
      this.#detectionCanvas.width,
      this.#detectionCanvas.height,
    );

    return this.#detector.detectForVideo(
      this.#detectionCanvas,
      timestampMs,
    ).detections;
  }

  #recordDetectionTime(milliseconds: number): void {
    if (this.#detectionTimings === null) return;

    const summary = this.#detectionTimings.record(milliseconds);
    if (
      summary.totalSampleCount % DETECTION_TIMING_SAMPLE_COUNT !== 0
    ) {
      return;
    }

    console.info(
      `[MediaPipe] detection pipeline last ${summary.sampleCount}: ` +
        `latest=${summary.latestMilliseconds.toFixed(1)} ms, ` +
        `average=${summary.averageMilliseconds.toFixed(1)} ms, ` +
        `max=${summary.maximumMilliseconds.toFixed(1)} ms, ` +
        `15 fps budget=${FACE_DETECTION_INTERVAL_MS.toFixed(1)} ms`,
    );
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

async function createDetector(
  runningMode: "IMAGE" | "VIDEO",
): Promise<FaceDetector> {
  const vision = await createVisionFileset();

  return FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath,
      delegate: "CPU",
    },
    runningMode,
    minDetectionConfidence: 0.5,
    minSuppressionThreshold: 0.3,
  });
}

function createObservation(
  detections: Detection[],
  sourceWidth: number,
  sourceHeight: number,
  mirrorHorizontally: boolean,
): FaceObservation {
  const bestDetection = detections.reduce<Detection | null>(
    (best, candidate) =>
      best === null || confidenceOf(candidate) > confidenceOf(best)
        ? candidate
        : best,
    null,
  );
  const box = bestDetection?.boundingBox;

  if (bestDetection === null || !box) return noFace;

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
