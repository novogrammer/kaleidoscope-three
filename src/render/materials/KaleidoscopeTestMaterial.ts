import { MeshBasicNodeMaterial, Vector2, type Texture } from "three/webgpu";
import { texture, uniform, uv, vec4 } from "three/tsl";
import {
  aspectCoordinateToUvTsl,
  calculateCircleMaskTsl,
  calculateKaleidoscopeCoordinateTsl,
  uvToAspectCoordinateTsl,
} from "../../kaleidoscope/coordinates.tsl";

export class KaleidoscopeTestMaterial extends MeshBasicNodeMaterial {
  readonly #resolution = uniform(new Vector2(1, 1));

  constructor(sourceTexture: Texture) {
    super();

    const center = uniform(new Vector2(0.5, 0.5));
    const unitLength = uniform(0.22);
    const rotation = uniform(0.2);
    const aspectCoordinate = uvToAspectCoordinateTsl(
      uv(),
      this.#resolution.x,
      this.#resolution.y,
    );
    const kaleidoscopeCoordinate = calculateKaleidoscopeCoordinateTsl(
      aspectCoordinate,
      center,
      unitLength,
      rotation,
    );
    const sampleUv = aspectCoordinateToUvTsl(
      kaleidoscopeCoordinate,
      this.#resolution.x,
      this.#resolution.y,
    );
    const sampledColor = texture(sourceTexture, sampleUv);
    const minimumRadius = uniform(0.68);
    const maximumRadius = uniform(0.94);
    const mask = calculateCircleMaskTsl(
      aspectCoordinate,
      center,
      minimumRadius,
      maximumRadius,
    );

    this.colorNode = vec4(sampledColor.rgb.mul(mask), 1);
    this.toneMapped = false;
  }

  setResolution(width: number, height: number): void {
    this.#resolution.value.set(width, height);
  }
}
