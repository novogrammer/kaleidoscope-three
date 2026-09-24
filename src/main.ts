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
    const disposeResources = async (): Promise<void> => {
      if (resize !== null) {
        window.removeEventListener("resize", resize);
        resize = null;
      }
      sceneGraph?.dispose();
      sceneGraph = null;
      faceObservationSource.dispose?.();
      imageSource.dispose();
      await renderer.dispose();
    };

    try {
      await renderer.initialize();
      if (cameraSource !== null) {
        startStatus.textContent = "前面カメラを初期化しています…";
        try {
          await cameraSource.initialize();
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
      const activeCameraSource =
        cameraSource !== null && imageSource === cameraSource
          ? cameraSource
          : null;

      if (config.mock !== null) {
        faceObservationSource = new MockFaceObservationSource(config.mock);
      } else if (fixtureSource !== null || activeCameraSource !== null) {
        const { MediaPipeFaceObservationSource } = await import(
          "./face/MediaPipeFaceObservationSource"
        );
        startStatus.textContent = "顔を検出しています…";
        const mediaPipeSource = new MediaPipeFaceObservationSource();
        try {
          if (fixtureSource !== null) {
            await mediaPipeSource.initializeImage(fixtureSource.image, {
              mirrorHorizontally: false,
            });
            faceObservationSource = mediaPipeSource;
          } else if (activeCameraSource !== null) {
            await mediaPipeSource.initializeVideo(activeCameraSource.video, {
              mirrorHorizontally: true,
            });
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
      const initializedSceneGraph = new KaleidoscopeSceneGraph(
        imageSource.texture,
        imageSource.width,
        imageSource.height,
        activeCameraSource !== null,
      );
      sceneGraph = initializedSceneGraph;
      const kaleidoscopeEnabled = config.kaleidoscope === "on";
      renderer.configureBloom(
        kaleidoscopeEnabled
          ? initializedSceneGraph.scene
          : initializedSceneGraph.sourceScene,
        kaleidoscopeEnabled
          ? initializedSceneGraph.camera
          : initializedSceneGraph.sourceCamera,
      );

      resize = () => {
        const viewport = renderer.resize();
        viewportWidth = viewport.width;
        viewportHeight = viewport.height;
        initializedSceneGraph.resize(
          viewport.width,
          viewport.height,
          viewport.pixelRatio,
        );
      };

      resize();
      window.addEventListener("resize", resize);
      await renderer.setAnimationLoop((time) => {
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
          sourceObservation = faceObservationSource.sample(elapsedSeconds);
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
        initializedSceneGraph.update(elapsedSeconds, frame);
        if (kaleidoscopeEnabled) {
          renderer.renderToTarget(
            initializedSceneGraph.sourceScene,
            initializedSceneGraph.sourceCamera,
            initializedSceneGraph.sourceTarget,
          );
        }
        renderer.renderBloom();
      });
    } catch (error) {
      await disposeResources();
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
        void disposeResources();
      },
      { once: true },
    );
  } catch (error) {
    console.error("Failed to initialize the application.", error);
    startStatus.textContent =
      "アプリケーションを開始できませんでした。ページを再読み込みして再度お試しください。";
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
  const face =
    value.mock === null ? "MediaPipe" : `モック / ${value.mock}`;

  if (value.input === "camera") {
    return `入力設定: 前面カメラ / ${face}${faceScale}${kaleidoscope}`;
  }

  return `入力設定: ${value.fixture} / ${face}${faceScale}${kaleidoscope}`;
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
