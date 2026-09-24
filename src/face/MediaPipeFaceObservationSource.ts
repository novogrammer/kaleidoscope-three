import {
  FaceDetector,
  FilesetResolver,
  type Detection,
} from "@mediapipe/tasks-vision";
import wasmSimdBinaryPath from "@mediapipe/tasks-vision/vision_wasm_internal.wasm?url";
import wasmSimdLoaderPath from "@mediapipe/tasks-vision/vision_wasm_internal.js?url";
import wasmNoSimdBinaryPath from "@mediapipe/tasks-vision/vision_wasm_nosimd_internal.wasm?url";
import wasmNoSimdLoaderPath from "@mediapipe/tasks-vision/vision_wasm_nosimd_internal.js?url";
import modelAssetPath from "../assets/models/blaze_face_short_range.tflite?url";
import { TimingWindow } from "../diagnostics/TimingWindow";
import {
  createNoFaceObservation,
  type FaceObservation,
} from "./FaceObservation";
import type { FaceObservationSource } from "./FaceObservationSource";
import { calculateDetectionFrameSize } from "./detectionFrame";
import { createFaceObservationFromDetections } from "./mediapipeObservation";

export const FACE_DETECTION_INTERVAL_MS = 1000 / 15;
const DETECTION_TIMING_SAMPLE_COUNT = 60;

export type MediaPipeFaceObservationOptions = Readonly<{
  mirrorHorizontally: boolean;
}>;

type DetectionInput =
  | Readonly<{
      kind: "image";
      source: HTMLImageElement;
    }>
  | {
      kind: "video";
      source: HTMLVideoElement;
      lastVideoTime: number;
    };

type DetectionSession = {
  readonly detector: FaceDetector;
  readonly input: DetectionInput;
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;
  readonly mirrorHorizontally: boolean;
  readonly timings: TimingWindow | null;
  observation: FaceObservation;
  lastDetectionTimeMs: number;
};

export class MediaPipeFaceObservationSource
  implements FaceObservationSource
{
  #session: DetectionSession | null = null;

  async initializeImage(
    image: HTMLImageElement,
    options: MediaPipeFaceObservationOptions,
  ): Promise<void> {
    await this.#initializeSource(
      { kind: "image", source: image },
      image.naturalWidth,
      image.naturalHeight,
      options,
    );
  }

  async initializeVideo(
    video: HTMLVideoElement,
    options: MediaPipeFaceObservationOptions,
  ): Promise<void> {
    await this.#initializeSource(
      { kind: "video", source: video, lastVideoTime: -1 },
      video.videoWidth,
      video.videoHeight,
      options,
    );
  }

  async #initializeSource(
    input: DetectionInput,
    sourceWidth: number,
    sourceHeight: number,
    options: MediaPipeFaceObservationOptions,
  ): Promise<void> {
    if (this.#session !== null) return;

    const detectionCanvas = document.createElement("canvas");
    const detectionSize = calculateDetectionFrameSize(
      sourceWidth,
      sourceHeight,
    );
    detectionCanvas.width = detectionSize.width;
    detectionCanvas.height = detectionSize.height;
    const detectionContext = detectionCanvas.getContext("2d", {
      alpha: false,
    });

    if (detectionContext === null) {
      throw new Error("Could not create the face detection canvas context.");
    }

    const detector = await createDetector(
      input.kind === "image" ? "IMAGE" : "VIDEO",
    );
    this.#session = {
      detector,
      input,
      canvas: detectionCanvas,
      context: detectionContext,
      mirrorHorizontally: options.mirrorHorizontally,
      timings: import.meta.env.DEV
        ? new TimingWindow(DETECTION_TIMING_SAMPLE_COUNT)
        : null,
      observation: createNoFaceObservation(),
      lastDetectionTimeMs: -Infinity,
    };
  }

  sample(elapsedSeconds: number): FaceObservation {
    const session = this.#session;
    if (session === null) return createNoFaceObservation();

    this.#detectFrame(session, elapsedSeconds * 1000);

    return {
      ...session.observation,
      center: { ...session.observation.center },
      size: { ...session.observation.size },
    };
  }

  dispose(): void {
    this.#session?.detector.close();
    this.#session = null;
  }

  #detectFrame(session: DetectionSession, timestampMs: number): void {
    if (
      timestampMs - session.lastDetectionTimeMs < FACE_DETECTION_INTERVAL_MS ||
      (session.input.kind === "video" &&
        session.input.source.currentTime === session.input.lastVideoTime)
    ) {
      return;
    }

    const detections = this.#detectSourceFrame(session, timestampMs);

    session.observation = createFaceObservationFromDetections(
      detections,
      session.canvas.width,
      session.canvas.height,
      session.mirrorHorizontally,
    );
    session.lastDetectionTimeMs = timestampMs;
    if (session.input.kind === "video") {
      session.input.lastVideoTime = session.input.source.currentTime;
    }
  }

  #detectSourceFrame(
    session: DetectionSession,
    timestampMs: number,
  ): Detection[] {
    if (session.timings === null) {
      return this.#runDetectionPipeline(session, timestampMs);
    }

    const detectionStart = performance.now();
    const detections = this.#runDetectionPipeline(session, timestampMs);
    this.#recordDetectionTime(session, performance.now() - detectionStart);
    return detections;
  }

  #runDetectionPipeline(
    session: DetectionSession,
    timestampMs: number,
  ): Detection[] {
    session.context.drawImage(
      session.input.source,
      0,
      0,
      session.canvas.width,
      session.canvas.height,
    );

    return session.input.kind === "image"
      ? session.detector.detect(session.canvas).detections
      : session.detector.detectForVideo(session.canvas, timestampMs).detections;
  }

  #recordDetectionTime(
    session: DetectionSession,
    milliseconds: number,
  ): void {
    if (session.timings === null) return;

    const summary = session.timings.record(milliseconds);
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
