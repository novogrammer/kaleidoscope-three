import { SRGBColorSpace, VideoTexture, type Texture } from "three/webgpu";
import type { ImageSource } from "./ImageSource";

export class CameraImageSource implements ImageSource {
  readonly #video = document.createElement("video");
  #stream: MediaStream | null = null;
  #texture: VideoTexture | null = null;

  constructor() {
    this.#video.autoplay = true;
    this.#video.muted = true;
    this.#video.playsInline = true;
  }

  get video(): HTMLVideoElement {
    return this.#video;
  }

  get texture(): Texture {
    if (this.#texture === null) {
      throw new Error("CameraImageSource has not been initialized.");
    }

    return this.#texture;
  }

  get width(): number {
    return this.#video.videoWidth;
  }

  get height(): number {
    return this.#video.videoHeight;
  }

  async initialize(): Promise<void> {
    if (this.#texture !== null) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser does not support camera input.");
    }

    try {
      this.#stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      this.#video.srcObject = this.#stream;
      await this.#video.play();
      await waitForVideoDimensions(this.#video);

      const texture = new VideoTexture(this.#video);
      texture.colorSpace = SRGBColorSpace;
      this.#texture = texture;
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  dispose(): void {
    this.#texture?.dispose();
    this.#texture = null;
    this.#video.pause();
    this.#video.srcObject = null;
    this.#stream?.getTracks().forEach((track) => track.stop());
    this.#stream = null;
  }
}

function waitForVideoDimensions(video: HTMLVideoElement): Promise<void> {
  if (video.videoWidth > 0 && video.videoHeight > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    video.addEventListener("loadedmetadata", () => resolve(), { once: true });
  });
}
