export const CONFETTI_CAPACITY = 1000;
export const CONFETTI_SPAWN_RATE = 15;
export const CONFETTI_LIFETIME_SECONDS = 30;
export const CONFETTI_PREWARM_SECONDS = 10;

export type ConfettiParticleState = {
  active: boolean;
  x: number;
  y: number;
  rotation: number;
  flip: number;
  brightness: number;
  colorIndex: number;
};

const colorCount = 6;

export class ConfettiSimulation {
  readonly capacity: number;
  readonly #seed: number;

  constructor(seed = 0x6b616c65, capacity = CONFETTI_CAPACITY) {
    this.capacity = capacity;
    this.#seed = seed;
  }

  sample(index: number, elapsedSeconds: number, target: ConfettiParticleState): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.capacity) {
      throw new RangeError(`Confetti particle index is out of range: ${index}`);
    }

    const latestSpawnEvent = Math.floor(
      (elapsedSeconds + CONFETTI_PREWARM_SECONDS) * CONFETTI_SPAWN_RATE,
    );
    if (latestSpawnEvent < index) {
      target.active = false;
      return;
    }

    // Spawn events use slots in order and wrap only at the capacity limit.
    // Deriving the latest event for this slot keeps the result independent of
    // frame rate without treating the slot-reuse interval as particle lifetime.
    const capacityCycles = Math.floor(
      (latestSpawnEvent - index) / this.capacity,
    );
    const spawnEvent = index + capacityCycles * this.capacity;
    const spawnTime =
      spawnEvent / CONFETTI_SPAWN_RATE - CONFETTI_PREWARM_SECONDS;
    const age = elapsedSeconds - spawnTime;

    if (age < 0 || age >= CONFETTI_LIFETIME_SECONDS) {
      target.active = false;
      return;
    }

    const spawnX = randomForSpawn(this.#seed, spawnEvent, 0) * 2 - 1;
    const horizontalVelocity =
      (randomForSpawn(this.#seed, spawnEvent, 1) * 2 - 1) * 0.018;
    const fallSpeed = lerp(
      0.5,
      1,
      randomForSpawn(this.#seed, spawnEvent, 2),
    );
    const initialRotation =
      randomForSpawn(this.#seed, spawnEvent, 3) * Math.PI * 2;
    const angularVelocity = degreesToRadians(
      lerp(-1800, 1800, randomForSpawn(this.#seed, spawnEvent, 4)),
    );
    const flipOffset =
      randomForSpawn(this.#seed, spawnEvent, 5) * Math.PI * 2;
    const flipSpeed = lerp(
      5,
      11,
      randomForSpawn(this.#seed, spawnEvent, 6),
    );
    const colorIndex = Math.min(
      colorCount - 1,
      Math.floor(randomForSpawn(this.#seed, spawnEvent, 7) * colorCount),
    );
    const brightnessPhase = 1 - positiveModulo(age, 1);
    const brightnessEnvelope = 0.05 + Math.pow(brightnessPhase, 5) * 0.95;

    target.active = true;
    target.x = spawnX + horizontalVelocity * age;
    target.y = 1.1 - fallSpeed * age * 0.1;
    target.rotation = initialRotation + angularVelocity * age;
    target.flip = flipOffset + flipSpeed * age;
    target.brightness = brightnessEnvelope * 50;
    target.colorIndex = colorIndex;
  }
}

function randomForSpawn(seed: number, spawnEvent: number, channel: number): number {
  let value = seed >>> 0;
  value ^= Math.imul(spawnEvent + 1, 0x9e3779b1);
  value ^= Math.imul(channel + 1, 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}
