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

type ConfettiParticleDefinition = {
  spawnX: number;
  horizontalVelocity: number;
  fallSpeed: number;
  initialRotation: number;
  angularVelocity: number;
  flipOffset: number;
  flipSpeed: number;
  colorIndex: number;
};

const colorCount = 6;

export class ConfettiSimulation {
  readonly capacity: number;
  readonly #particles: readonly ConfettiParticleDefinition[];

  constructor(seed = 0x6b616c65, capacity = CONFETTI_CAPACITY) {
    this.capacity = capacity;

    const random = createRandom(seed);
    this.#particles = Array.from({ length: capacity }, () => ({
      spawnX: random() * 2 - 1,
      horizontalVelocity: (random() * 2 - 1) * 0.018,
      fallSpeed: lerp(0.5, 1, random()),
      initialRotation: random() * Math.PI * 2,
      angularVelocity: degreesToRadians(lerp(-1800, 1800, random())),
      flipOffset: random() * Math.PI * 2,
      flipSpeed: lerp(5, 11, random()),
      colorIndex: Math.min(colorCount - 1, Math.floor(random() * colorCount)),
    }));
  }

  sample(index: number, elapsedSeconds: number, target: ConfettiParticleState): void {
    const particle = this.#particles[index];

    if (particle === undefined) {
      throw new RangeError(`Confetti particle index is out of range: ${index}`);
    }

    const firstSpawnTime = index / CONFETTI_SPAWN_RATE - CONFETTI_PREWARM_SECONDS;
    const timeSinceFirstSpawn = elapsedSeconds - firstSpawnTime;

    if (timeSinceFirstSpawn < 0) {
      target.active = false;
      return;
    }

    const age = positiveModulo(timeSinceFirstSpawn, CONFETTI_LIFETIME_SECONDS);
    const brightnessPhase = 1 - positiveModulo(age, 1);
    const brightnessEnvelope = 0.05 + Math.pow(brightnessPhase, 5) * 0.95;

    target.active = true;
    target.x = particle.spawnX + particle.horizontalVelocity * age;
    target.y = 1.1 - particle.fallSpeed * age * 0.1;
    target.rotation = particle.initialRotation + particle.angularVelocity * age;
    target.flip = particle.flipOffset + particle.flipSpeed * age;
    target.brightness = brightnessEnvelope * 50;
    target.colorIndex = particle.colorIndex;
  }
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
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
