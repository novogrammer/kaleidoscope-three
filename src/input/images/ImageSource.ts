import type { Texture } from "three/webgpu";

export interface ImageSource {
  readonly texture: Texture;
  readonly width: number;
  readonly height: number;

  initialize(): Promise<void>;
  dispose(): void;
}
