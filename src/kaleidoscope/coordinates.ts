export type Vector2 = Readonly<{
  x: number;
  y: number;
}>;

export type KaleidoscopeParameters = Readonly<{
  center: Vector2;
  unitLength: number;
  rotation: number;
}>;

const RADIANS_60 = Math.PI / 3;
const RADIANS_120 = RADIANS_60 * 2;
const SIN_60 = Math.sin(RADIANS_60);
const SQRT_3 = Math.sqrt(3);

/** CPU reference for UV2MyUV_float in CustomFunctions.hlsl. */
export function uvToAspectCoordinate(
  input: Vector2,
  width: number,
  height: number,
): Vector2 {
  const aspect = width / height;
  return {
    x: (input.x - 0.5) * aspect + 0.5,
    y: input.y,
  };
}

/** CPU reference for MyUV2UV_float in CustomFunctions.hlsl. */
export function aspectCoordinateToUv(
  input: Vector2,
  width: number,
  height: number,
): Vector2 {
  const aspect = width / height;
  return {
    x: (input.x - 0.5) / aspect + 0.5,
    y: input.y,
  };
}

/** Maps viewport UVs to source UVs with CSS object-fit: cover semantics. */
export function coverUv(
  input: Vector2,
  viewportWidth: number,
  viewportHeight: number,
  sourceWidth: number,
  sourceHeight: number,
): Vector2 {
  const viewportAspect = viewportWidth / viewportHeight;
  const sourceAspect = sourceWidth / sourceHeight;

  if (viewportAspect > sourceAspect) {
    return {
      x: input.x,
      y: (input.y - 0.5) * (sourceAspect / viewportAspect) + 0.5,
    };
  }

  return {
    x: (input.x - 0.5) * (viewportAspect / sourceAspect) + 0.5,
    y: input.y,
  };
}

/** GLSL-style modulo. Unlike JavaScript's remainder, the result wraps negatives. */
export function glslModulo(value: number, divisor: number): number {
  return value - divisor * Math.floor(value / divisor);
}

/** CPU reference for repeatCoordHex in CustomFunctions.hlsl. */
export function repeatHexCoordinate(
  coordinate: Vector2,
  unitLength: number,
): Vector2 {
  const rectangle = {
    x: unitLength * 3,
    y: SIN_60 * unitLength * 2,
  };
  const repeated = {
    x: glslModulo(coordinate.x, rectangle.x),
    y: glslModulo(coordinate.y, rectangle.y),
  };
  const candidates: Vector2[] = [
    repeated,
    { x: repeated.x - rectangle.x, y: repeated.y },
    { x: repeated.x, y: repeated.y - rectangle.y },
    { x: repeated.x - rectangle.x, y: repeated.y - rectangle.y },
    {
      x: repeated.x - rectangle.x * 0.5,
      y: repeated.y - rectangle.y * 0.5,
    },
  ];

  let shortest = candidates[0];
  let shortestLengthSquared = lengthSquared(shortest);

  for (let index = 1; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const candidateLengthSquared = lengthSquared(candidate);

    if (candidateLengthSquared < shortestLengthSquared) {
      shortest = candidate;
      shortestLengthSquared = candidateLengthSquared;
    }
  }

  return shortest;
}

/** CPU reference for calcCoord in CustomFunctions.hlsl. */
export function foldKaleidoscopeCoordinate(
  coordinate: Vector2,
): Vector2 {
  const length = Math.hypot(coordinate.x, coordinate.y);
  let angle = glslModulo(
    Math.atan2(coordinate.y, coordinate.x),
    RADIANS_120,
  );

  if (angle > RADIANS_60) {
    angle = RADIANS_120 - angle;
  }

  return {
    x: Math.cos(angle) * length,
    y: Math.sin(angle) * length,
  };
}

/**
 * CPU reference for rotateCoord in CustomFunctions.hlsl.
 *
 * Unity uses mul(rowVector, rotationMatrix), so a positive value rotates the
 * coordinate clockwise in conventional XY coordinates.
 */
export function rotateCoordinate(
  coordinate: Vector2,
  rotation: number,
): Vector2 {
  const sine = Math.sin(rotation);
  const cosine = Math.cos(rotation);

  return {
    x: coordinate.x * cosine + coordinate.y * sine,
    y: -coordinate.x * sine + coordinate.y * cosine,
  };
}

/** CPU reference for Kaleidoscope_float in CustomFunctions.hlsl. */
export function calculateKaleidoscopeCoordinate(
  input: Vector2,
  parameters: KaleidoscopeParameters,
): Vector2 {
  const { center, unitLength, rotation } = parameters;
  const scopeCenter = {
    x: unitLength * 0.5,
    y: (unitLength * 0.5) / SQRT_3,
  };
  const centered = {
    x: input.x - center.x,
    y: input.y - center.y,
  };
  const rotated = rotateCoordinate(centered, rotation);
  const repeated = repeatHexCoordinate(
    {
      x: rotated.x + scopeCenter.x,
      y: rotated.y + scopeCenter.y,
    },
    unitLength,
  );
  const folded = foldKaleidoscopeCoordinate(repeated);
  const unrotated = rotateCoordinate(
    {
      x: folded.x - scopeCenter.x,
      y: folded.y - scopeCenter.y,
    },
    -rotation,
  );

  return {
    x: unrotated.x + center.x,
    y: unrotated.y + center.y,
  };
}

/** CPU reference for CircleMask_float in CustomFunctions.hlsl. */
export function calculateCircleMask(
  coordinate: Vector2,
  center: Vector2,
  radiusMin: number,
  radiusMax: number,
): number {
  const distance = Math.hypot(
    coordinate.x - center.x,
    coordinate.y - center.y,
  );
  const normalized = clamp(
    (distance - radiusMin) /
      Math.max(radiusMax - radiusMin, 0.000001),
    0,
    1,
  );
  return (1 - normalized) ** 2;
}

function lengthSquared(value: Vector2): number {
  return value.x * value.x + value.y * value.y;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
