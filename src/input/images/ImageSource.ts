import type { Texture } from "three/webgpu";

export interface ImageSource {
  readonly texture: Texture;

  initialize(): Promise<void>;
  dispose(): void;
}
