import "./style.css";

import { parseAppConfig } from "./app/config";

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
    const [{ createRenderer, resizeRenderer }, { createTestScene }] =
      await Promise.all([
        import("./render/app/createRenderer"),
        import("./render/app/createTestScene"),
      ]);
    const { renderer, backend } = await createRenderer(canvas);
    const testScene = createTestScene();

    const resize = () => {
      const viewport = resizeRenderer(renderer);
      testScene.resize(viewport.width / viewport.height);
    };

    resize();
    window.addEventListener("resize", resize);

    await renderer.setAnimationLoop((time) => {
      testScene.update(time / 1000);
      renderer.render(testScene.scene, testScene.camera);
    });

    backendStatus.textContent =
      backend === "webgpu" ? "描画: WebGPU" : "描画: WebGL 2";
    runtimeStatus.hidden = false;
    startScreen.hidden = true;
    app.dataset.state = "running";

    window.addEventListener(
      "pagehide",
      () => {
        window.removeEventListener("resize", resize);
        testScene.dispose();
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

  const mock = value.mock === null ? "MediaPipe" : `モック / ${value.mock}`;
  return `入力設定: ${value.fixture} / ${mock}`;
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`Missing element: #${id}`);
  return element as T;
}
