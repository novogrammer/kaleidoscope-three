import { SRGBColorSpace, Texture } from "three/webgpu";
import type { FixtureName } from "../../app/config";
import faceCenterUrl from "../../assets/fixtures/face-center.jpg?url";
import faceOffsetUrl from "../../assets/fixtures/face-offset.jpg?url";
import noFaceUrl from "../../assets/fixtures/no-face.jpg?url";
import type { ImageSource } from "./ImageSource";

const fixtureUrls: Record<FixtureName, string> = {
  "face-center": faceCenterUrl,
  "face-offset": faceOffsetUrl,
  "no-face": noFaceUrl,
};

export class FixtureImageSource implements ImageSource {
  readonly #fixtureName: FixtureName;
  #image: HTMLImageElement | null = null;
  #texture: Texture | null = null;

  constructor(fixtureName: FixtureName) {
    this.#fixtureName = fixtureName;
  }

  get image(): HTMLImageElement {
    if (this.#image === null) {
      throw new Error("FixtureImageSource has not been initialized.");
    }

    return this.#image;
  }

  get texture(): Texture {
    if (this.#texture === null) {
      throw new Error("FixtureImageSource has not been initialized.");
    }

    return this.#texture;
  }

  get width(): number {
    return this.image.naturalWidth;
  }

  get height(): number {
    return this.image.naturalHeight;
  }

  async initialize(): Promise<void> {
    if (this.#texture !== null) return;

    const image = new Image();
    image.decoding = "async";
    image.src = fixtureUrls[this.#fixtureName];
    await image.decode();

    const texture = new Texture(image);
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;

    this.#image = image;
    this.#texture = texture;
  }

  dispose(): void {
    this.#texture?.dispose();
    this.#texture = null;
    this.#image = null;
  }
}
