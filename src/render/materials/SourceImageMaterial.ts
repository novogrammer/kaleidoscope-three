import { MeshBasicNodeMaterial, Vector2, type Texture } from "three/webgpu";
import { texture, uniform, uv, vec4 } from "three/tsl";
import { coverUvTsl } from "../../kaleidoscope/coordinates.tsl";

export class SourceImageMaterial extends MeshBasicNodeMaterial {
  readonly #resolution = uniform(new Vector2(1, 1));
  readonly #sourceSize = uniform(new Vector2(1, 1));

  constructor(sourceTexture: Texture, sourceWidth: number, sourceHeight: number) {
    super();

    this.#sourceSize.value.set(sourceWidth, sourceHeight);
    const sampleUv = coverUvTsl(
      uv(),
      this.#resolution.x,
      this.#resolution.y,
      this.#sourceSize.x,
      this.#sourceSize.y,
    );

    this.colorNode = vec4(texture(sourceTexture, sampleUv).rgb, 1);
    this.depthTest = false;
    this.depthWrite = false;
    this.toneMapped = false;
  }

  setResolution(width: number, height: number): void {
    this.#resolution.value.set(width, height);
  }
}
