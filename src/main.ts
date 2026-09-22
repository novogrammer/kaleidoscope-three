import "./style.css";

import { parseAppConfig } from "./app/config";
import type { FaceObservationSource } from "./face/FaceObservationSource";
import { MockFaceObservationSource } from "./face/MockFaceObservationSource";
import { NoFaceObservationSource } from "./face/NoFaceObservationSource";
import { mapSourceObservationToAspectCoordinates } from "./face/coordinates";
import type { ImageSource } from "./input/images/ImageSource";
import { KaleidoscopeStateController } from "./kaleidoscope/state";

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

inputStatus.textContent = formatInputStatus(config);
startButton.addEventListener("click", () => void start());

canvas.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  backendStatus.textContent = "描画コンテキストが失われました";
  app.dataset.state = "error";
});

canvas.addEventListener("webglcontextrestored", () => {
  backendStatus.textContent = "描画コンテキストを復元しました";
  app.dataset.state = "running";
});

async function start(): Promise<void> {
  if (isStarting) return;

  isStarting = true;
  startButton.disabled = true;
  startStatus.textContent = "描画を初期化しています…";

  try {
    const [
      { RendererController },
      { TestScene },
      { CameraImageSource },
      { FixtureImageSource },
      { TestPatternImageSource },
      mediaPipeModule,
    ] = await Promise.all([
      import("./render/app/RendererController"),
      import("./render/app/TestScene"),
      import("./input/images/CameraImageSource"),
      import("./input/images/FixtureImageSource"),
      import("./input/images/TestPatternImageSource"),
      config.mock === null
        ? import("./face/MediaPipeFaceObservationSource")
        : Promise.resolve(null),
    ]);
    const renderer = new RendererController(canvas, config.output);
    const fixtureSource =
      config.input === "fixture"
        ? new FixtureImageSource(config.fixture)
        : null;
    const cameraSource =
      config.input === "camera" ? new CameraImageSource() : null;
    let imageSource: ImageSource =
      fixtureSource ?? cameraSource ?? new TestPatternImageSource();
    let cameraAvailable = false;
    let faceObservationSource: FaceObservationSource & {
      dispose?: () => void;
    } = new NoFaceObservationSource();
    let testScene: InstanceType<typeof TestScene> | null = null;
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
      testScene = new TestScene(
        imageSource.texture,
        imageSource.width,
        imageSource.height,
        cameraAvailable,
      );
      renderer.configureBloom(testScene.scene, testScene.camera);

      resize = () => {
        const viewport = renderer.resize();
        viewportWidth = viewport.width;
        viewportHeight = viewport.height;
        testScene?.resize(
          viewport.width,
          viewport.height,
          viewport.pixelRatio,
        );
      };

      resize();
      window.addEventListener("resize", resize);
      await renderer.setAnimationLoop((time) => {
        if (testScene !== null) {
          animationStartTime ??= time;
          const elapsedSeconds = (time - animationStartTime) / 1000;
          const sourceObservation =
            faceObservationSource.sample(elapsedSeconds);
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
          testScene.update(elapsedSeconds, frame);
          renderer.renderToTarget(
            testScene.sourceScene,
            testScene.sourceCamera,
            testScene.sourceTarget,
          );
          renderer.renderBloom();
        }
      });
    } catch (error) {
      if (resize !== null) window.removeEventListener("resize", resize);
      testScene?.dispose();
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
        testScene?.dispose();
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

  if (value.input === "camera") {
    const face = value.mock === null ? "MediaPipe" : `モック / ${value.mock}`;
    return `入力設定: 前面カメラ / ${face}${faceScale}`;
  }

  const mock =
    value.mock === null ? "MediaPipe" : `モック / ${value.mock}`;
  return `入力設定: ${value.fixture} / ${mock}${faceScale}`;
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`Missing element: #${id}`);
  return element as T;
}
