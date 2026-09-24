import { describe, expect, it } from "vitest";
import {
  CONFETTI_CAPACITY,
  CONFETTI_LIFETIME_SECONDS,
  CONFETTI_PREWARM_SECONDS,
  CONFETTI_SPAWN_RATE,
  ConfettiSimulation,
  type ConfettiParticleState,
} from "./ConfettiSimulation";

function createState(): ConfettiParticleState {
  return {
    active: false,
    x: 0,
    y: 0,
    rotation: 0,
    flip: 0,
    brightness: 0,
    colorIndex: 0,
  };
}

describe("ConfettiSimulation", () => {
  it("uses the Unity VFX capacity by default", () => {
    expect(new ConfettiSimulation().capacity).toBe(CONFETTI_CAPACITY);
  });

  it("produces deterministic particle states for the same seed", () => {
    const a = new ConfettiSimulation(123, 1);
    const b = new ConfettiSimulation(123, 1);
    const stateA = createState();
    const stateB = createState();

    a.sample(0, 3.25, stateA);
    b.sample(0, 3.25, stateB);

    expect(stateA).toEqual(stateB);
  });

  it("starts with ten seconds of particles prewarmed", () => {
    const simulation = new ConfettiSimulation(123);
    const state = createState();
    let activeCount = 0;

    for (let index = 0; index < simulation.capacity; index += 1) {
      simulation.sample(index, 0, state);
      if (state.active) activeCount += 1;
    }

    expect(activeCount).toBe(
      Math.floor(CONFETTI_PREWARM_SECONDS * CONFETTI_SPAWN_RATE) + 1,
    );
  });

  it("keeps the steady-state count at spawn rate times lifetime", () => {
    const simulation = new ConfettiSimulation(123);
    const state = createState();
    let activeCount = 0;
    const elapsedSeconds = 40.001;

    for (let index = 0; index < simulation.capacity; index += 1) {
      simulation.sample(index, elapsedSeconds, state);
      if (state.active) activeCount += 1;
    }

    expect(activeCount).toBe(
      CONFETTI_SPAWN_RATE * CONFETTI_LIFETIME_SECONDS,
    );
  });

  it("reuses a slot for a later spawn event with new properties", () => {
    const simulation = new ConfettiSimulation(123);
    const firstState = createState();
    const reusedState = createState();
    const firstSlotSpawnTime = -CONFETTI_PREWARM_SECONDS;
    const firstSlotReuseTime =
      firstSlotSpawnTime + CONFETTI_CAPACITY / CONFETTI_SPAWN_RATE;

    simulation.sample(0, firstSlotSpawnTime, firstState);
    simulation.sample(
      0,
      firstSlotSpawnTime + CONFETTI_LIFETIME_SECONDS,
      reusedState,
    );
    expect(reusedState.active).toBe(false);

    simulation.sample(0, firstSlotReuseTime, reusedState);
    expect(reusedState.active).toBe(true);
    expect(reusedState.x).not.toBe(firstState.x);
    expect(reusedState.rotation).not.toBe(firstState.rotation);
  });

  it("keeps the shader brightness above one in linear space", () => {
    const simulation = new ConfettiSimulation(123, 1);
    const state = createState();

    simulation.sample(0, 0, state);

    expect(state.brightness).toBeGreaterThanOrEqual(2.5);
    expect(state.brightness).toBeLessThanOrEqual(50);
  });

  it("rejects an invalid particle index", () => {
    const simulation = new ConfettiSimulation(123, 1);

    expect(() => simulation.sample(1, 0, createState())).toThrow(RangeError);
  });
});
