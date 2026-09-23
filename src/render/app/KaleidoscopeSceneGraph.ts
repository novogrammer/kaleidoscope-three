import {
  HalfFloatType,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RenderTarget,
  Scene,
  type Texture,
} from "three/webgpu";
import type { KaleidoscopeFrameState } from "../../kaleidoscope/state";
import { KaleidoscopeMaterial } from "../materials/KaleidoscopeMaterial";
import { SourceImageMaterial } from "../materials/SourceImageMaterial";
import { ConfettiInstancedMesh } from "../objects/ConfettiInstancedMesh";

export class KaleidoscopeSceneGraph {
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  readonly sourceScene = new Scene();
  readonly sourceCamera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  readonly sourceTarget = new RenderTarget(1, 1, {
    type: HalfFloatType,
    depthBuffer: false,
  });

  readonly #material: KaleidoscopeMaterial;
  readonly #geometry = new PlaneGeometry(2, 2);
  readonly #quad: Mesh;
  readonly #sourceMaterial: SourceImageMaterial;
  readonly #sourceGeometry = new PlaneGeometry(2, 2);
  readonly #sourceQuad: Mesh;
  readonly #confetti = new ConfettiInstancedMesh();
  #aspect = 1;

  constructor(
    sourceTexture: Texture,
    sourceWidth: number,
    sourceHeight: number,
    mirrorSourceHorizontally = false,
  ) {
    this.#sourceMaterial = new SourceImageMaterial(
      sourceTexture,
      sourceWidth,
      sourceHeight,
      mirrorSourceHorizontally,
    );
    this.#sourceQuad = new Mesh(this.#sourceGeometry, this.#sourceMaterial);
    this.#sourceQuad.renderOrder = 0;
    this.sourceCamera.position.z = 2;
    this.sourceScene.add(this.#sourceQuad, this.#confetti.mesh);

    this.#material = new KaleidoscopeMaterial(this.sourceTarget.texture);
    this.#quad = new Mesh(this.#geometry, this.#material);
    this.camera.position.z = 2;
    this.scene.add(this.#quad);
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.#aspect = width / height;
    this.sourceCamera.left = -this.#aspect;
    this.sourceCamera.right = this.#aspect;
    this.sourceCamera.updateProjectionMatrix();
    this.#sourceQuad.scale.x = this.#aspect;
    this.#sourceMaterial.setResolution(width, height);
    this.#material.setResolution(width, height);
    this.sourceTarget.setSize(
      Math.floor(width * pixelRatio),
      Math.floor(height * pixelRatio),
    );
  }

  update(elapsedSeconds: number, frame: KaleidoscopeFrameState): void {
    this.#confetti.update(elapsedSeconds, this.#aspect);
    this.#material.updateFrame(frame);
  }

  dispose(): void {
    this.sourceTarget.dispose();
    this.#sourceGeometry.dispose();
    this.#sourceMaterial.dispose();
    this.#confetti.dispose();
    this.#geometry.dispose();
    this.#material.dispose();
  }
}
