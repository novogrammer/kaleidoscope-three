import type { Detection, FaceDetector } from "@mediapipe/tasks-vision";
import { TimingWindow } from "../diagnostics/TimingWindow";
import { createMediaPipeFaceDetector } from "./createMediaPipeFaceDetector";
import {
  NO_FACE_OBSERVATION,
  type FaceObservation,
  type FaceObservationSource,
} from "./FaceObservation";
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
    await this.#initializeSource({ kind: "image", source: image }, options);
  }

  async initializeVideo(
    video: HTMLVideoElement,
    options: MediaPipeFaceObservationOptions,
  ): Promise<void> {
    await this.#initializeSource(
      { kind: "video", source: video, lastVideoTime: -1 },
      options,
    );
  }

  async #initializeSource(
    input: DetectionInput,
    options: MediaPipeFaceObservationOptions,
  ): Promise<void> {
    if (this.#session !== null) return;

    const sourceWidth =
      input.kind === "image"
        ? input.source.naturalWidth
        : input.source.videoWidth;
    const sourceHeight =
      input.kind === "image"
        ? input.source.naturalHeight
        : input.source.videoHeight;
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

    const detector = await createMediaPipeFaceDetector(
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
      observation: NO_FACE_OBSERVATION,
      lastDetectionTimeMs: -Infinity,
    };
  }

  sample(elapsedSeconds: number): FaceObservation {
    const session = this.#session;
    if (session === null) return NO_FACE_OBSERVATION;

    this.#detectFrame(session, elapsedSeconds * 1000);
    return session.observation;
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
    const timings = session.timings;
    if (timings === null) {
      return this.#runDetectionPipeline(session, timestampMs);
    }

    const detectionStart = performance.now();
    const detections = this.#runDetectionPipeline(session, timestampMs);
    this.#recordDetectionTime(timings, performance.now() - detectionStart);
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
    timings: TimingWindow,
    milliseconds: number,
  ): void {
    const summary = timings.record(milliseconds);
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
