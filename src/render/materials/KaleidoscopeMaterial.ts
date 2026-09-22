import { MeshBasicNodeMaterial, Vector2, type Texture } from "three/webgpu";
import { texture, uniform, uv, vec2, vec4 } from "three/tsl";
import {
  aspectCoordinateToUvTsl,
  calculateCircleMaskTsl,
  calculateKaleidoscopeCoordinateTsl,
  uvToAspectCoordinateTsl,
} from "../../kaleidoscope/coordinates.tsl";
import type { KaleidoscopeFrameState } from "../../kaleidoscope/state";

export class KaleidoscopeMaterial extends MeshBasicNodeMaterial {
  readonly #resolution = uniform(new Vector2(1, 1));
  readonly #rotation = uniform(0);
  readonly #centers = [
    uniform(new Vector2(0.5, 0.5)),
    uniform(new Vector2(0.9, 0.9)),
    uniform(new Vector2(0.9, 0.1)),
  ] as const;
  readonly #unitLengths = [uniform(0.65), uniform(0.0001), uniform(0.2)] as const;
  readonly #minimumRadii = [uniform(0), uniform(0), uniform(0)] as const;
  readonly #maximumRadii = [uniform(1), uniform(0), uniform(0.75)] as const;

  constructor(sourceTexture: Texture) {
    super();

    const aspectCoordinate = uvToAspectCoordinateTsl(
      uv(),
      this.#resolution.x,
      this.#resolution.y,
    );
    const sampleLayer = (index: 0 | 1 | 2) => {
      const kaleidoscopeCoordinate = calculateKaleidoscopeCoordinateTsl(
        aspectCoordinate,
        this.#centers[index],
        this.#unitLengths[index],
        this.#rotation,
      );
      const viewportUv = aspectCoordinateToUvTsl(
        kaleidoscopeCoordinate,
        this.#resolution.x,
        this.#resolution.y,
      );
      const sourceUv = vec2(viewportUv.x, viewportUv.y.oneMinus());
      const sampledColor = texture(sourceTexture, sourceUv);
      const mask = calculateCircleMaskTsl(
        aspectCoordinate,
        this.#centers[index],
        this.#minimumRadii[index],
        this.#maximumRadii[index],
      );

      return sampledColor.rgb.mul(mask);
    };
    const color = sampleLayer(0).add(sampleLayer(1)).add(sampleLayer(2));

    this.colorNode = vec4(color, 1);
    this.toneMapped = false;
  }

  setResolution(width: number, height: number): void {
    this.#resolution.value.set(width, height);
  }

  updateFrame(frame: KaleidoscopeFrameState): void {
    this.#rotation.value = frame.rotation;

    for (let index = 0; index < frame.layers.length; index += 1) {
      const layer = frame.layers[index];
      const center = this.#centers[index];
      const unitLength = this.#unitLengths[index];
      const minimumRadius = this.#minimumRadii[index];
      const maximumRadius = this.#maximumRadii[index];

      if (
        layer === undefined ||
        center === undefined ||
        unitLength === undefined ||
        minimumRadius === undefined ||
        maximumRadius === undefined
      ) {
        continue;
      }

      center.value.set(layer.center.x, layer.center.y);
      unitLength.value = layer.unitLength;
      minimumRadius.value = layer.radiusMinimum;
      maximumRadius.value = layer.radiusMaximum;
    }
  }
}
