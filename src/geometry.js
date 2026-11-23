import { computeTopology } from "./core/topology.js";

export { computeTopology };

const EPSILON = 1e-12;

export function computeBounds(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = positions[i + axis];
      if (value < min[axis]) min[axis] = value;
      if (value > max[axis]) max[axis] = value;
    }
  }
  return {
    min,
    max,
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
    center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
  };
}

export function computeSurfaceArea(positions) {
  let area = 0;
  for (let i = 0; i < positions.length; i += 9) {
    const a = vertexAt(positions, i);
    const b = vertexAt(positions, i + 3);
    const c = vertexAt(positions, i + 6);
    area += triangleArea(a, b, c);
  }
  return area;
}

export function computeMeshProperties(positions, massKg = 1) {
  const bounds = computeBounds(positions);
  const topology = computeTopology(positions);
  const massProperties = computePolyhedralMassProperties(positions, massKg);
  const warnings = [];
  if (topology.boundaryEdges > 0) warnings.push(`${topology.boundaryEdges} boundary edges detected; volume properties may be approximate.`);
  if (topology.nonManifoldEdges > 0) warnings.push(`${topology.nonManifoldEdges} non-manifold edges detected; inspect imported geometry.`);
  if (topology.componentCount > 1) warnings.push(`${topology.componentCount} disconnected components detected.`);
  if (topology.duplicateTriangles > 0) warnings.push(`${topology.duplicateTriangles} duplicate triangles detected.`);
  if (topology.degenerateTriangles > 0) warnings.push(`${topology.degenerateTriangles} degenerate triangles detected.`);
  if (Math.abs(massProperties.volumeM3) < EPSILON) warnings.push("Mesh signed volume is near zero; check face orientation and units.");

  return {
    triangleCount: positions.length / 9,
    bounds,
    surfaceAreaM2: computeSurfaceArea(positions),
    topology,
    ...massProperties,
    warnings
  };
}

export function computePolyhedralMassProperties(positions, massKg = 1) {
  let signedVolume = 0;
  const centroidNumerator = [0, 0, 0];
  const second = {
    xx: 0,
    yy: 0,
    zz: 0,
    xy: 0,
    xz: 0,
    yz: 0
  };

  for (let i = 0; i < positions.length; i += 9) {
    const a = vertexAt(positions, i);
    const b = vertexAt(positions, i + 3);
    const c = vertexAt(positions, i + 6);
    const volume = dot(a, cross(b, c)) / 6;
    signedVolume += volume;
    for (let axis = 0; axis < 3; axis += 1) {
      centroidNumerator[axis] += volume * (a[axis] + b[axis] + c[axis]) / 4;
    }
    accumulateSecondMoments(second, volume, a, b, c);
  }

  if (Math.abs(signedVolume) < EPSILON) {
    return {
      signedVolumeM3: signedVolume,
      volumeM3: 0,
      centroid: [0, 0, 0],
      densityKgM3: 0,
      inertiaOrigin: zeroTensor(),
      inertiaCg: zeroTensor()
    };
  }

  const sign = signedVolume < 0 ? -1 : 1;
  const volumeM3 = Math.abs(signedVolume);
  const centroid = centroidNumerator.map((value) => value / signedVolume);
  const density = massKg / volumeM3;
  const integral = {
    xx: second.xx * sign,
    yy: second.yy * sign,
    zz: second.zz * sign,
    xy: second.xy * sign,
    xz: second.xz * sign,
    yz: second.yz * sign
  };

  const inertiaOrigin = {
    xx: density * (integral.yy + integral.zz),
    yy: density * (integral.xx + integral.zz),
    zz: density * (integral.xx + integral.yy),
    xy: -density * integral.xy,
    xz: -density * integral.xz,
    yz: -density * integral.yz
  };
  const inertiaCg = translateInertia(inertiaOrigin, massKg, centroid, [0, 0, 0], -1);

  return {
    signedVolumeM3: signedVolume,
    volumeM3,
    centroid,
    densityKgM3: density,
    inertiaOrigin,
    inertiaCg
  };
}

export function translateInertia(inertia, mass, toPoint, fromPoint, direction = 1) {
  const dx = toPoint[0] - fromPoint[0];
  const dy = toPoint[1] - fromPoint[1];
  const dz = toPoint[2] - fromPoint[2];
  const term = {
    xx: mass * (dy * dy + dz * dz),
    yy: mass * (dx * dx + dz * dz),
    zz: mass * (dx * dx + dy * dy),
    xy: -mass * dx * dy,
    xz: -mass * dx * dz,
    yz: -mass * dy * dz
  };
  return {
    xx: inertia.xx + direction * term.xx,
    yy: inertia.yy + direction * term.yy,
    zz: inertia.zz + direction * term.zz,
    xy: inertia.xy + direction * term.xy,
    xz: inertia.xz + direction * term.xz,
    yz: inertia.yz + direction * term.yz
  };
}

export function zeroTensor() {
  return { xx: 0, yy: 0, zz: 0, xy: 0, xz: 0, yz: 0 };
}

function accumulateSecondMoments(out, volume, a, b, c) {
  const vertices = [a, b, c];
  for (let axis = 0; axis < 3; axis += 1) {
    const values = vertices.map((vertex) => vertex[axis]);
    out[axisName(axis, axis)] += (volume / 10) * (
      values[0] * values[0] +
      values[1] * values[1] +
      values[2] * values[2] +
      values[0] * values[1] +
      values[0] * values[2] +
      values[1] * values[2]
    );
  }
  out.xy += productIntegral(volume, vertices, 0, 1);
  out.xz += productIntegral(volume, vertices, 0, 2);
  out.yz += productIntegral(volume, vertices, 1, 2);
}

function productIntegral(volume, vertices, axisA, axisB) {
  let diagonal = 0;
  let offDiagonal = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    diagonal += vertices[i][axisA] * vertices[i][axisB];
    for (let j = 0; j < vertices.length; j += 1) {
      if (i !== j) offDiagonal += vertices[i][axisA] * vertices[j][axisB];
    }
  }
  return (volume / 20) * (2 * diagonal + offDiagonal);
}

function axisName(a, b) {
  if (a === 0 && b === 0) return "xx";
  if (a === 1 && b === 1) return "yy";
  if (a === 2 && b === 2) return "zz";
  throw new Error("Invalid second moment axis.");
}

function vertexAt(positions, index) {
  return [positions[index], positions[index + 1], positions[index + 2]];
}

function triangleArea(a, b, c) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return 0.5 * Math.hypot(...cross(ab, ac));
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
