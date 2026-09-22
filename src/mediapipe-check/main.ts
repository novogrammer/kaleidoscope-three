import {
  FaceDetector,
  FilesetResolver,
  type FaceDetectorResult,
} from "@mediapipe/tasks-vision";
import wasmSimdBinaryPath from "@mediapipe/tasks-vision/vision_wasm_internal.wasm?url";
import wasmSimdLoaderPath from "@mediapipe/tasks-vision/vision_wasm_internal.js?url";
import wasmNoSimdBinaryPath from "@mediapipe/tasks-vision/vision_wasm_nosimd_internal.wasm?url";
import wasmNoSimdLoaderPath from "@mediapipe/tasks-vision/vision_wasm_nosimd_internal.js?url";
import modelAssetPath from "../assets/models/blaze_face_short_range.tflite?url";

import "./style.css";

const DETECTION_INTERVAL_MS = 1000 / 15;

const video = getElement<HTMLVideoElement>("source");
const canvas = getElement<HTMLCanvasElement>("output");
const context = getCanvasContext(canvas);
const startButton = getElement<HTMLButtonElement>("start");
const stopButton = getElement<HTMLButtonElement>("stop");
const status = getElement<HTMLOutputElement>("status");
const emptyState = getElement<HTMLDivElement>("empty-state");

let detector: FaceDetector | undefined;
let stream: MediaStream | undefined;
let animationFrameId: number | undefined;
let latestResult: FaceDetectorResult = { detections: [] };
let lastDetectionTime = -Infinity;
let lastVideoTime = -1;
let running = false;

startButton.addEventListener("click", () => {
  void start();
});

stopButton.addEventListener("click", stop);
window.addEventListener("beforeunload", stop);

async function start(): Promise<void> {
  startButton.disabled = true;
  status.dataset.error = "false";

  try {
    setStatus("前面カメラを初期化しています…");
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "user" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });

    video.srcObject = stream;
    await video.play();
    await waitForVideoDimensions(video);

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    emptyState.hidden = true;
    running = true;
    stopButton.disabled = false;
    drawFrame();

    setStatus("MediaPipeを初期化しています…");
    const vision = await createVisionFileset();
    detector = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath,
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      minDetectionConfidence: 0.5,
      minSuppressionThreshold: 0.3,
    });

    setStatus("検出を開始しました");
  } catch (error) {
    stop();
    status.dataset.error = "true";
    setStatus(`初期化に失敗しました: ${getErrorMessage(error)}`);
  }
}

function drawFrame(now = performance.now()): void {
  if (!running) {
    return;
  }

  drawMirroredVideo();

  if (
    detector &&
    now - lastDetectionTime >= DETECTION_INTERVAL_MS &&
    video.currentTime !== lastVideoTime
  ) {
    const inferenceStart = performance.now();
    latestResult = detector.detectForVideo(video, now);
    const inferenceDuration = performance.now() - inferenceStart;

    lastDetectionTime = now;
    lastVideoTime = video.currentTime;
    setStatus(
      `faces: ${latestResult.detections.length} / inference: ${inferenceDuration.toFixed(1)} ms`,
    );
  }

  drawDetections(latestResult);
  animationFrameId = requestAnimationFrame(drawFrame);
}

function drawMirroredVideo(): void {
  context.save();
  context.translate(canvas.width, 0);
  context.scale(-1, 1);
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  context.restore();
}

function drawDetections(result: FaceDetectorResult): void {
  context.lineWidth = Math.max(3, canvas.width / 320);
  context.strokeStyle = "#38ff9c";
  context.fillStyle = "#38ff9c";
  context.font = `${Math.max(16, canvas.width / 50)}px ui-monospace, monospace`;

  for (const detection of result.detections) {
    const box = detection.boundingBox;

    if (!box) {
      continue;
    }

    const mirroredX = canvas.width - box.originX - box.width;
    const centerX = mirroredX + box.width / 2;
    const centerY = box.originY + box.height / 2;
    const score = detection.categories[0]?.score ?? 0;

    context.strokeRect(mirroredX, box.originY, box.width, box.height);

    const centerRadius = Math.max(5, canvas.width / 180);
    context.beginPath();
    context.arc(centerX, centerY, centerRadius, 0, Math.PI * 2);
    context.fill();

    const label = `${Math.round(score * 100)}% (${(centerX / canvas.width).toFixed(3)}, ${(centerY / canvas.height).toFixed(3)})`;
    context.fillText(label, mirroredX, Math.max(24, box.originY - 10));
  }
}

function stop(): void {
  running = false;

  if (animationFrameId !== undefined) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = undefined;
  }

  detector?.close();
  detector = undefined;

  stream?.getTracks().forEach((track) => track.stop());
  stream = undefined;
  video.srcObject = null;

  latestResult = { detections: [] };
  lastDetectionTime = -Infinity;
  lastVideoTime = -1;
  context.clearRect(0, 0, canvas.width, canvas.height);

  emptyState.hidden = false;
  startButton.disabled = false;
  stopButton.disabled = true;

  if (status.dataset.error !== "true") {
    setStatus("停止しました");
  }
}

function waitForVideoDimensions(source: HTMLVideoElement): Promise<void> {
  if (source.videoWidth > 0 && source.videoHeight > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    source.addEventListener("loadedmetadata", () => resolve(), { once: true });
  });
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

function setStatus(message: string): void {
  status.textContent = message;
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`#${id}が見つかりません。`);
  }

  return element as T;
}

function getCanvasContext(target: HTMLCanvasElement): CanvasRenderingContext2D {
  const targetContext = target.getContext("2d");

  if (!targetContext) {
    throw new Error("Canvas 2D contextを取得できませんでした。");
  }

  return targetContext;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
