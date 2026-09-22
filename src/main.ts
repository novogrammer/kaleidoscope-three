import "./style.css";

import { parseAppConfig } from "./app/config";
import { MockFaceObservationSource } from "./face/MockFaceObservationSource";
import { NoFaceObservationSource } from "./face/NoFaceObservationSource";
import { calculateKaleidoscopeFrameState } from "./kaleidoscope/state";

const app = getElement<HTMLElement>("app");
const canvas = getElement<HTMLCanvasElement>("stage");
const startScreen = getElement<HTMLElement>("start-screen");
const startButton = getElement<HTMLButtonElement>("start-button");
const startStatus = getElement<HTMLElement>("start-status");
const runtimeStatus = getElement<HTMLElement>("runtime-status");
const backendStatus = getElement<HTMLElement>("backend-status");
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
      { FixtureImageSource },
      { TestPatternImageSource },
    ] = await Promise.all([
      import("./render/app/RendererController"),
      import("./render/app/TestScene"),
      import("./input/images/FixtureImageSource"),
      import("./input/images/TestPatternImageSource"),
    ]);
    const renderer = new RendererController(canvas);
    const imageSource =
      config.input === "fixture"
        ? new FixtureImageSource(config.fixture)
        : new TestPatternImageSource();
    const faceObservationSource =
      config.mock === null
        ? new NoFaceObservationSource()
        : new MockFaceObservationSource(config.mock);
    let testScene: InstanceType<typeof TestScene> | null = null;
    let resize: (() => void) | null = null;
    let animationStartTime: number | null = null;

    try {
      await Promise.all([renderer.initialize(), imageSource.initialize()]);
      testScene = new TestScene(
        imageSource.texture,
        imageSource.width,
        imageSource.height,
      );

      resize = () => {
        const viewport = renderer.resize();
        testScene?.resize(viewport.width, viewport.height);
      };

      resize();
      window.addEventListener("resize", resize);
      await renderer.setAnimationLoop((time) => {
        if (testScene !== null) {
          animationStartTime ??= time;
          const elapsedSeconds = (time - animationStartTime) / 1000;
          const faceObservation = faceObservationSource.sample(elapsedSeconds);
          const frame = calculateKaleidoscopeFrameState(
            elapsedSeconds,
            faceObservation,
          );
          testScene.update(frame);
          renderer.render(testScene.scene, testScene.camera);
        }
      });
    } catch (error) {
      if (resize !== null) window.removeEventListener("resize", resize);
      testScene?.dispose();
      imageSource.dispose();
      await renderer.dispose();
      throw error;
    }

    backendStatus.textContent =
      renderer.backend === "webgpu" ? "描画: WebGPU" : "描画: WebGL 2";
    runtimeStatus.hidden = false;
    startScreen.hidden = true;
    app.dataset.state = "running";

    window.addEventListener(
      "pagehide",
      () => {
        if (resize !== null) window.removeEventListener("resize", resize);
        testScene?.dispose();
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
  if (value.input === "camera") return "入力設定: 前面カメラ（未接続）";

  const mock =
    value.mock === null ? "顔検出未接続" : `モック / ${value.mock}`;
  return `入力設定: ${value.fixture} / ${mock}`;
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`Missing element: #${id}`);
  return element as T;
}
