import { describe, expect, it } from "vitest";

import {
  aspectCoordinateToUv,
  calculateCircleMask,
  calculateKaleidoscopeCoordinate,
  coverUv,
  foldKaleidoscopeCoordinate,
  glslModulo,
  repeatHexCoordinate,
  rotateCoordinate,
  uvToAspectCoordinate,
  type Vector2,
} from "./coordinates";

const SQRT_3 = Math.sqrt(3);

describe("kaleidoscope coordinate CPU reference", () => {
  it("round-trips between UV and aspect-corrected coordinates", () => {
    const uv = { x: 0.125, y: 0.75 };
    const aspectCoordinate = uvToAspectCoordinate(uv, 1920, 1080);

    expectVector(aspectCoordinate, { x: -1 / 6, y: 0.75 });
    expectVector(aspectCoordinateToUv(aspectCoordinate, 1920, 1080), uv);
  });

  it("round-trips aspect coordinates in a portrait viewport", () => {
    const uv = { x: 0.125, y: 0.75 };
    const aspectCoordinate = uvToAspectCoordinate(uv, 1080, 1920);

    expectVector(aspectCoordinate, { x: 0.2890625, y: 0.75 });
    expectVector(aspectCoordinateToUv(aspectCoordinate, 1080, 1920), uv);
  });

  it("cover-crops a square source vertically in a landscape viewport", () => {
    expectVector(coverUv({ x: 0.25, y: 0.25 }, 1920, 1080, 1024, 1024), {
      x: 0.25,
      y: 0.359375,
    });
  });

  it("cover-crops a square source horizontally in a portrait viewport", () => {
    expectVector(coverUv({ x: 0.25, y: 0.25 }, 1080, 1920, 1024, 1024), {
      x: 0.359375,
      y: 0.25,
    });
  });

  it("wraps negative values with GLSL modulo semantics", () => {
    expect(glslModulo(-0.25, 1)).toBeCloseTo(0.75, 10);
    expect(glslModulo(2.25, 1)).toBeCloseTo(0.25, 10);
  });

  it("selects the nearest origin in the hexagonal repeat cell", () => {
    expectVector(repeatHexCoordinate({ x: 2.9, y: 0.1 }, 1), {
      x: -0.1,
      y: 0.1,
    });
    expectVector(repeatHexCoordinate({ x: 1.5, y: SQRT_3 / 2 }, 1), {
      x: 0,
      y: 0,
    });
  });

  it("folds coordinates into the first 60-degree wedge", () => {
    expectVector(foldKaleidoscopeCoordinate({ x: 0, y: 1 }), {
      x: SQRT_3 / 2,
      y: 0.5,
    });
  });

  it("matches Unity's clockwise row-vector rotation", () => {
    expectVector(rotateCoordinate({ x: 1, y: 0 }, Math.PI / 2), {
      x: 0,
      y: -1,
    });
  });

  it("keeps the kaleidoscope center fixed for any rotation", () => {
    const center = { x: 0.42, y: 0.61 };

    expectVector(
      calculateKaleidoscopeCoordinate(center, {
        center,
        unitLength: 0.65,
        rotation: 1.234,
      }),
      center,
    );
  });

  it("maps a neighboring hex origin back to the center", () => {
    expectVector(
      calculateKaleidoscopeCoordinate(
        { x: 1, y: 0 },
        {
          center: { x: 0, y: 0 },
          unitLength: 1,
          rotation: 0,
        },
      ),
      { x: 0, y: 0 },
    );
  });

  it("matches a frozen integrated coordinate from the Unity formula", () => {
    expectVector(
      calculateKaleidoscopeCoordinate(
        { x: 0.83, y: 0.27 },
        {
          center: { x: 0.42, y: 0.61 },
          unitLength: 0.65,
          rotation: 0.37,
        },
      ),
      { x: 0.5265641373572131, y: 0.6599796152256057 },
    );
  });

  it("reproduces the squared circle-mask falloff", () => {
    const center = { x: 0, y: 0 };

    expect(calculateCircleMask(center, center, 0, 1)).toBeCloseTo(1, 10);
    expect(
      calculateCircleMask({ x: 0.5, y: 0 }, center, 0, 1),
    ).toBeCloseTo(0.25, 10);
    expect(calculateCircleMask({ x: 1, y: 0 }, center, 0, 1)).toBeCloseTo(
      0,
      10,
    );
  });

  it("handles a zero-width circle mask like the TSL implementation", () => {
    const center = { x: 0.5, y: 0.5 };

    expect(calculateCircleMask(center, center, 0, 0)).toBe(1);
    expect(
      calculateCircleMask({ x: 0.501, y: 0.5 }, center, 0, 0),
    ).toBe(0);
  });
});

function expectVector(actual: Vector2, expected: Vector2): void {
  expect(actual.x).toBeCloseTo(expected.x, 10);
  expect(actual.y).toBeCloseTo(expected.y, 10);
}
