import {
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  MeshBasicNodeMaterial,
  Object3D,
  PlaneGeometry,
} from "three/webgpu";
import { instanceColor, vec4 } from "three/tsl";
import {
  ConfettiSimulation,
  type ConfettiParticleState,
} from "../../confetti/ConfettiSimulation";

const palette = [
  [1, 0, 0],
  [0.698, 0.416, 0],
  [0, 0.741, 0],
  [0, 0.49, 1],
  [0.569, 0, 1],
  [1, 0, 0.725],
] as const;

const particleWidth = 0.05;
const particleHeight = 0.025;

export class ConfettiInstancedMesh {
  readonly mesh: InstancedMesh;

  readonly #simulation = new ConfettiSimulation();
  readonly #geometry = new PlaneGeometry(1, 1);
  readonly #material = new MeshBasicNodeMaterial();
  readonly #transform = new Object3D();
  readonly #color = new Color();
  readonly #state: ConfettiParticleState = {
    active: false,
    x: 0,
    y: 0,
    rotation: 0,
    flip: 0,
    brightness: 0,
    colorIndex: 0,
  };

  constructor() {
    this.#material.colorNode = vec4(instanceColor, 1);
    this.#material.depthTest = false;
    this.#material.depthWrite = false;
    this.#material.toneMapped = false;

    this.mesh = new InstancedMesh(
      this.#geometry,
      this.#material,
      this.#simulation.capacity,
    );
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  update(elapsedSeconds: number, aspect: number): void {
    let visibleIndex = 0;

    for (let index = 0; index < this.#simulation.capacity; index += 1) {
      this.#simulation.sample(index, elapsedSeconds, this.#state);
      if (!this.#state.active) continue;

      const baseColor = palette[this.#state.colorIndex] ?? palette[0];
      const flipScale = Math.max(0.08, Math.abs(Math.cos(this.#state.flip)));

      this.#transform.position.set(this.#state.x * aspect, this.#state.y, 0);
      this.#transform.rotation.set(0, 0, this.#state.rotation);
      this.#transform.scale.set(
        particleWidth,
        particleHeight * flipScale,
        1,
      );
      this.#transform.updateMatrix();
      this.mesh.setMatrixAt(visibleIndex, this.#transform.matrix);

      this.#color.setRGB(
        baseColor[0] * this.#state.brightness,
        baseColor[1] * this.#state.brightness,
        baseColor[2] * this.#state.brightness,
      );
      this.mesh.setColorAt(visibleIndex, this.#color);
      visibleIndex += 1;
    }

    this.mesh.count = visibleIndex;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor !== null) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  dispose(): void {
    this.#geometry.dispose();
    this.#material.dispose();
  }
}
