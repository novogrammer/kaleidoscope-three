import {
  DataTexture,
  NearestFilter,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from "three/webgpu";

const textureSize = 256;
const cellSize = 32;
const gridWidth = 3;

const palette = [
  [255, 80, 96],
  [255, 190, 64],
  [64, 220, 150],
  [60, 170, 255],
  [150, 100, 255],
  [255, 100, 210],
] as const;

function buildTestPattern(): Uint8Array {
  const data = new Uint8Array(textureSize * textureSize * 4);

  for (let y = 0; y < textureSize; y += 1) {
    for (let x = 0; x < textureSize; x += 1) {
      const offset = (y * textureSize + x) * 4;
      const cellX = Math.floor(x / cellSize);
      const cellY = Math.floor(y / cellSize);
      const color = palette[(cellX + cellY * 3) % palette.length];
      const isGrid = x % cellSize < gridWidth || y % cellSize < gridWidth;
      const isDiagonal = Math.abs((x % cellSize) - (y % cellSize)) < 2;
      const scale = isGrid ? 0.08 : isDiagonal ? 1 : 0.7;

      data[offset] = Math.round(color[0] * scale);
      data[offset + 1] = Math.round(color[1] * scale);
      data[offset + 2] = Math.round(color[2] * scale);
      data[offset + 3] = 255;
    }
  }

  return data;
}

export class TestPatternTexture extends DataTexture {
  constructor() {
    super(
      buildTestPattern(),
      textureSize,
      textureSize,
      RGBAFormat,
      UnsignedByteType,
    );

    this.colorSpace = SRGBColorSpace;
    this.magFilter = NearestFilter;
    this.minFilter = NearestFilter;
    this.generateMipmaps = false;
    this.needsUpdate = true;
  }
}
