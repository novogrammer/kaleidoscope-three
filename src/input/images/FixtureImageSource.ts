import { SRGBColorSpace, Texture } from "three/webgpu";
import type { FixtureName } from "../../app/config";
import faceCenterUrl from "../../assets/fixtures/face-center.jpg?url";
import type { ImageSource } from "./ImageSource";

const fixtureUrls: Partial<Record<FixtureName, string>> = {
  "face-center": faceCenterUrl,
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

  async initialize(): Promise<void> {
    if (this.#texture !== null) return;

    const url = fixtureUrls[this.#fixtureName];
    if (url === undefined) {
      throw new Error(`Fixture is not available: ${this.#fixtureName}`);
    }

    const image = new Image();
    image.decoding = "async";
    image.src = url;
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
