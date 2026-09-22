import { atan, cos, dot, floor, length, select, sin, vec2 } from "three/tsl";
import type { Node } from "three/webgpu";

type FloatNode = Node<"float">;
type Vec2Node = Node<"vec2">;

const radians60 = Math.PI / 3;
const radians120 = radians60 * 2;
const sin60 = Math.sin(radians60);

export function glslModuloTsl(
  value: FloatNode,
  divisor: FloatNode | number,
): FloatNode {
  return value.sub(floor(value.div(divisor)).mul(divisor));
}

function glslModuloVec2Tsl(value: Vec2Node, divisor: Vec2Node): Vec2Node {
  return value.sub(floor(value.div(divisor)).mul(divisor));
}

export function uvToAspectCoordinateTsl(
  coordinate: Vec2Node,
  width: FloatNode,
  height: FloatNode,
): Vec2Node {
  const aspect = width.div(height);
  return vec2(coordinate.x.sub(0.5).mul(aspect).add(0.5), coordinate.y);
}

export function aspectCoordinateToUvTsl(
  coordinate: Vec2Node,
  width: FloatNode,
  height: FloatNode,
): Vec2Node {
  const aspect = width.div(height);
  return vec2(coordinate.x.sub(0.5).div(aspect).add(0.5), coordinate.y);
}

export function mirrorCoordinateTsl(coordinate: Vec2Node): Vec2Node {
  return coordinate.sub(0.5).abs().add(0.5);
}

function chooseNearerCoordinate(
  current: Vec2Node,
  candidate: Vec2Node,
): Vec2Node {
  return select(
    dot(candidate, candidate).lessThan(dot(current, current)),
    candidate,
    current,
  );
}

export function repeatHexCoordinateTsl(
  coordinate: Vec2Node,
  unitLength: FloatNode,
): Vec2Node {
  const rectangle = vec2(unitLength.mul(3), unitLength.mul(sin60 * 2));
  const repeated = glslModuloVec2Tsl(coordinate, rectangle);
  const p0 = repeated;
  const p1 = repeated.sub(vec2(rectangle.x, 0));
  const p2 = repeated.sub(vec2(0, rectangle.y));
  const p3 = repeated.sub(rectangle);
  const p4 = repeated.sub(rectangle.mul(0.5));
  const nearest01 = chooseNearerCoordinate(p0, p1);
  const nearest012 = chooseNearerCoordinate(nearest01, p2);
  const nearest0123 = chooseNearerCoordinate(nearest012, p3);

  return chooseNearerCoordinate(nearest0123, p4);
}

export function foldKaleidoscopeCoordinateTsl(
  coordinate: Vec2Node,
): Vec2Node {
  const coordinateLength = length(coordinate);
  const angle = glslModuloTsl(atan(coordinate.y, coordinate.x), radians120);
  const foldedAngle = select(
    angle.greaterThan(radians60),
    angle.negate().add(radians120),
    angle,
  );

  return vec2(cos(foldedAngle), sin(foldedAngle)).mul(coordinateLength);
}

export function rotateCoordinateTsl(
  coordinate: Vec2Node,
  rotation: FloatNode,
): Vec2Node {
  const cosine = cos(rotation);
  const sine = sin(rotation);

  return vec2(
    coordinate.x.mul(cosine).add(coordinate.y.mul(sine)),
    coordinate.y.mul(cosine).sub(coordinate.x.mul(sine)),
  );
}

export function calculateKaleidoscopeCoordinateTsl(
  coordinate: Vec2Node,
  center: Vec2Node,
  unitLength: FloatNode,
  rotation: FloatNode,
): Vec2Node {
  const scopeCenter = vec2(
    unitLength.mul(0.5),
    unitLength.mul(0.5 / Math.sqrt(3)),
  );
  const rotated = rotateCoordinateTsl(coordinate.sub(center), rotation).add(
    scopeCenter,
  );
  const repeated = repeatHexCoordinateTsl(rotated, unitLength);
  const folded = foldKaleidoscopeCoordinateTsl(repeated).sub(scopeCenter);

  return rotateCoordinateTsl(folded, rotation.negate()).add(center);
}

export function calculateCircleMaskTsl(
  coordinate: Vec2Node,
  center: Vec2Node,
  minimumRadius: FloatNode,
  maximumRadius: FloatNode,
): FloatNode {
  const normalizedDistance = length(coordinate.sub(center))
    .sub(minimumRadius)
    .div(maximumRadius.sub(minimumRadius))
    .clamp(0, 1);

  return normalizedDistance.oneMinus().pow(2);
}
