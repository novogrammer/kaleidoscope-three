import "./style.css";

import { parseAppConfig } from "./app/config";
import type { FaceObservation } from "./face/FaceObservation";
import type { FaceObservationSource } from "./face/FaceObservationSource";
import { MockFaceObservationSource } from "./face/MockFaceObservationSource";
import { NoFaceObservationSource } from "./face/NoFaceObservationSource";
import { mapSourceObservationToAspectCoordinates } from "./face/coordinates";
import { CameraImageSource } from "./input/images/CameraImageSource";
import { FixtureImageSource } from "./input/images/FixtureImageSource";
import type { ImageSource } from "./input/images/ImageSource";
import { TestPatternImageSource } from "./input/images/TestPatternImageSource";
import { KaleidoscopeStateController } from "./kaleidoscope/state";
import { KaleidoscopeSceneGraph } from "./render/app/KaleidoscopeSceneGraph";
import { RendererController } from "./render/app/RendererController";

const app = getElement<HTMLElement>("app");
const canvas = getElement<HTMLCanvasElement>("stage");
const startScreen = getElement<HTMLElement>("start-screen");
const startButton = getElement<HTMLButtonElement>("start-button");
const startStatus = getElement<HTMLElement>("start-status");
const runtimeStatus = getElement<HTMLElement>("runtime-status");
const backendStatus = getElement<HTMLElement>("backend-status");
const outputStatus = getElement<HTMLElement>("output-status");
const inputStatus = getElement<HTMLElement>("input-status");

const config = parseAppConfig(window.location.search);
let isStarting = false;
let reloadRequired = false;

inputStatus.textContent = formatInputStatus(config);
startButton.addEventListener("click", () => {
  if (reloadRequired) {
    window.location.reload();
    return;
  }

  void start();
});

canvas.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  showContextRecovery(
    "描画コンテキストが失われました。再読み込みして描画を開始し直してください。",
  );
});

canvas.addEventListener("webglcontextrestored", () => {
  showContextRecovery(
    "描画コンテキストは復元されました。再読み込みして描画を開始し直してください。",
  );
});

async function start(): Promise<void> {
  if (isStarting) return;

  isStarting = true;
  startButton.disabled = true;
  startStatus.textContent = "描画を初期化しています…";

  try {
    const mediaPipeModule =
      config.mock === null
        ? await import("./face/MediaPipeFaceObservationSource")
        : null;
    const renderer = new RendererController(
      canvas,
      config.output,
      config.backend,
      () => {
        showContextRecovery(
          "GPU描画デバイスが失われました。再読み込みして描画を開始し直してください。",
        );
      },
    );
    const fixtureSource =
      config.input === "fixture"
        ? new FixtureImageSource(config.fixture)
        : null;
    const cameraSource =
      config.input === "camera" ? new CameraImageSource() : null;
    let imageSource: ImageSource =
      fixtureSource ?? cameraSource ?? new TestPatternImageSource();
    let cameraAvailable = false;
    let faceObservationSource: FaceObservationSource =
      new NoFaceObservationSource();
    let sceneGraph: KaleidoscopeSceneGraph | null = null;
    let resize: (() => void) | null = null;
    let animationStartTime: number | null = null;
    let viewportWidth = 1;
    let viewportHeight = 1;
    const kaleidoscopeState = new KaleidoscopeStateController({
      scaleMainLayerWithFaceSize: config.faceScale === "dynamic",
    });

    try {
      await renderer.initialize();
      if (cameraSource !== null) {
        startStatus.textContent = "前面カメラを初期化しています…";
        try {
          await cameraSource.initialize();
          cameraAvailable = true;
        } catch (cameraError) {
          console.warn(
            "Camera input is unavailable. Using the fallback texture.",
            cameraError,
          );
          imageSource = new TestPatternImageSource();
          await imageSource.initialize();
          inputStatus.textContent = "入力設定: カメラ利用不可 / 補助表示";
        }
      } else {
        await imageSource.initialize();
      }

      if (config.mock !== null) {
        faceObservationSource = new MockFaceObservationSource(config.mock);
      } else if (mediaPipeModule !== null) {
        startStatus.textContent = "顔を検出しています…";
        const mediaPipeSource =
          new mediaPipeModule.MediaPipeFaceObservationSource();
        try {
          if (fixtureSource !== null) {
            await mediaPipeSource.initializeImage(fixtureSource.image);
            faceObservationSource = mediaPipeSource;
          } else if (cameraSource !== null && cameraAvailable) {
            await mediaPipeSource.initializeVideo(cameraSource.video);
            faceObservationSource = mediaPipeSource;
          }
        } catch (mediaPipeError) {
          mediaPipeSource.dispose();
          console.warn(
            "Face detection is unavailable. Continuing without it.",
            mediaPipeError,
          );
          inputStatus.textContent = "入力設定: 顔検出利用不可 / 補助表示";
        }
      }
      sceneGraph = new KaleidoscopeSceneGraph(
        imageSource.texture,
        imageSource.width,
        imageSource.height,
        cameraAvailable,
      );
      const kaleidoscopeEnabled = config.kaleidoscope === "on";
      renderer.configureBloom(
        kaleidoscopeEnabled ? sceneGraph.scene : sceneGraph.sourceScene,
        kaleidoscopeEnabled ? sceneGraph.camera : sceneGraph.sourceCamera,
      );

      resize = () => {
        const viewport = renderer.resize();
        viewportWidth = viewport.width;
        viewportHeight = viewport.height;
        sceneGraph?.resize(
          viewport.width,
          viewport.height,
          viewport.pixelRatio,
        );
      };

      resize();
      window.addEventListener("resize", resize);
      await renderer.setAnimationLoop((time) => {
        if (sceneGraph !== null) {
          animationStartTime ??= time;
          const elapsedSeconds = (time - animationStartTime) / 1000;
          let sourceObservation: FaceObservation;
          try {
            sourceObservation = faceObservationSource.sample(elapsedSeconds);
          } catch (faceObservationError) {
            console.warn(
              "Face detection failed while running. Continuing without it.",
              faceObservationError,
            );
            faceObservationSource.dispose?.();
            faceObservationSource = new NoFaceObservationSource();
            inputStatus.textContent =
              "入力設定: 顔検出実行エラー / 補助表示";
            sourceObservation =
              faceObservationSource.sample(elapsedSeconds);
          }
          const faceObservation = mapSourceObservationToAspectCoordinates(
            sourceObservation,
            viewportWidth,
            viewportHeight,
            imageSource.width,
            imageSource.height,
          );
          const frame = kaleidoscopeState.update(
            elapsedSeconds,
            faceObservation,
          );
          sceneGraph.update(elapsedSeconds, frame);
          if (kaleidoscopeEnabled) {
            renderer.renderToTarget(
              sceneGraph.sourceScene,
              sceneGraph.sourceCamera,
              sceneGraph.sourceTarget,
            );
          }
          renderer.renderBloom();
        }
      });
    } catch (error) {
      if (resize !== null) window.removeEventListener("resize", resize);
      sceneGraph?.dispose();
      faceObservationSource.dispose?.();
      imageSource.dispose();
      await renderer.dispose();
      throw error;
    }

    backendStatus.textContent =
      renderer.backend === "webgpu" ? "描画: WebGPU" : "描画: WebGL 2";
    outputStatus.textContent =
      renderer.outputMode === "hdr" ? "出力: HDR" : "出力: SDR";
    runtimeStatus.hidden = false;
    startScreen.hidden = true;
    app.dataset.state = "running";

    window.addEventListener(
      "pagehide",
      () => {
        if (resize !== null) window.removeEventListener("resize", resize);
        sceneGraph?.dispose();
        faceObservationSource.dispose?.();
        imageSource.dispose();
        void renderer.dispose();
      },
      { once: true },
    );
  } catch (error) {
    console.error("Failed to initialize the renderer.", error);
    startStatus.textContent =
      "描画を開始できませんでした。WebGPUまたはWebGL 2を利用できるブラウザで再度お試しください。";
    startButton.disabled = false;
    app.dataset.state = "error";
    isStarting = false;
  }
}

function formatInputStatus(value: ReturnType<typeof parseAppConfig>): string {
  const faceScale =
    value.faceScale === "dynamic" ? " / 顔サイズ連動" : "";
  const kaleidoscope =
    value.kaleidoscope === "off" ? " / 万華鏡なし" : "";

  if (value.input === "camera") {
    const face = value.mock === null ? "MediaPipe" : `モック / ${value.mock}`;
    return `入力設定: 前面カメラ / ${face}${faceScale}${kaleidoscope}`;
  }

  const mock =
    value.mock === null ? "MediaPipe" : `モック / ${value.mock}`;
  return `入力設定: ${value.fixture} / ${mock}${faceScale}${kaleidoscope}`;
}

function showContextRecovery(message: string): void {
  reloadRequired = true;
  backendStatus.textContent = "描画コンテキストの再初期化が必要です";
  startStatus.textContent = message;
  startButton.textContent = "再読み込み / Reload";
  startButton.disabled = false;
  startScreen.hidden = false;
  app.dataset.state = "error";
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`Missing element: #${id}`);
  return element as T;
}
