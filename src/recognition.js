const EPSILON = 1e-10;

export const COMPONENT_TYPES = Object.freeze({
  unassigned: 0,
  wing: 1,
  htail: 2,
  vtail: 3,
  fuselage: 4
});

export const COMPONENT_NAMES = Object.freeze([
  "Unassigned",
  "Main wing",
  "Horizontal tail",
  "Vertical tail",
  "Fuselage"
]);

export function createRecognitionModel(triangleCount) {
  return {
    assignments: new Uint8Array(triangleCount),
    selected: new Set()
  };
}

export function buildTriangleAdjacency(positions, tolerance = 1e-5) {
  const triangleCount = positions.length / 9;
  const vertexIds = new Map();
  const firstEdgeUse = new Map();
  const adjacency = Array.from({ length: triangleCount }, () => []);

  function vertexId(offset) {
    const key = [positions[offset], positions[offset + 1], positions[offset + 2]]
      .map((value) => Math.round(value / tolerance))
      .join(",");
    let id = vertexIds.get(key);
    if (id === undefined) {
      id = vertexIds.size;
      vertexIds.set(key, id);
    }
    return id;
  }

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const base = triangle * 9;
    const ids = [vertexId(base), vertexId(base + 3), vertexId(base + 6)];
    for (const [a, b] of [[ids[0], ids[1]], [ids[1], ids[2]], [ids[2], ids[0]]]) {
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      const first = firstEdgeUse.get(key);
      if (first === undefined) {
        firstEdgeUse.set(key, triangle);
      } else if (first !== triangle) {
        adjacency[triangle].push(first);
        adjacency[first].push(triangle);
      }
    }
  }

  return adjacency.map((neighbors) => Int32Array.from(new Set(neighbors)));
}

export function growSelection(seedTriangle, positions, adjacency, maxAngleDeg = 18, maxTriangles = 15000) {
  if (!Number.isInteger(seedTriangle) || seedTriangle < 0 || seedTriangle >= adjacency.length) return new Set();
  const threshold = Math.cos(Math.max(0, Math.min(90, maxAngleDeg)) * Math.PI / 180);
  const selected = new Set([seedTriangle]);
  const queue = [seedTriangle];
  const normals = new Map();

  function normal(index) {
    let value = normals.get(index);
    if (!value) {
      value = triangleNormal(positions, index);
      normals.set(index, value);
    }
    return value;
  }

  const seedNormal = normal(seedTriangle);

  const limit = Math.max(1, Math.floor(maxTriangles));
  for (let cursor = 0; cursor < queue.length && selected.size < limit; cursor += 1) {
    const current = queue[cursor];
    const currentNormal = normal(current);
    for (const neighbor of adjacency[current]) {
      if (selected.has(neighbor)) continue;
      const neighborNormal = normal(neighbor);
      if (dot(currentNormal, neighborNormal) + 1e-12 < threshold) continue;
      if (dot(seedNormal, neighborNormal) + 1e-12 < threshold) continue;
      selected.add(neighbor);
      queue.push(neighbor);
      if (selected.size >= limit) break;
    }
  }
  return selected;
}

export function assignTriangles(model, triangleIndices, componentType) {
  if (!Object.values(COMPONENT_TYPES).includes(componentType)) throw new Error("Unknown component type.");
  for (const triangle of triangleIndices) {
    if (triangle >= 0 && triangle < model.assignments.length) model.assignments[triangle] = componentType;
  }
}

export function trianglesForComponent(assignments, componentType) {
  const triangles = [];
  for (let i = 0; i < assignments.length; i += 1) {
    if (assignments[i] === componentType) triangles.push(i);
  }
  return triangles;
}

export function computeSurfaceReference(positions, triangleIndices, options = {}) {
  if (!triangleIndices.length) return invalidReference("No triangles assigned.");
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  let triangleAreaM2 = 0;
  let projectedAreaSumM2 = 0;
  const samples = [];

  for (const triangle of triangleIndices) {
    const base = triangle * 9;
    const a = vertex(positions, base);
    const b = vertex(positions, base + 3);
    const c = vertex(positions, base + 6);
    const crossValue = cross(subtract(b, a), subtract(c, a));
    triangleAreaM2 += 0.5 * magnitude(crossValue);
    projectedAreaSumM2 += 0.5 * Math.abs(crossValue[2]);
    for (const point of [a, b, c]) {
      for (let axis = 0; axis < 3; axis += 1) {
        bounds.min[axis] = Math.min(bounds.min[axis], point[axis]);
        bounds.max[axis] = Math.max(bounds.max[axis], point[axis]);
      }
      samples.push(point);
    }
  }

  const spanM = bounds.max[1] - bounds.min[1];
  const chordExtentM = bounds.max[0] - bounds.min[0];
  if (spanM <= EPSILON || chordExtentM <= EPSILON) return invalidReference("Assigned surface has zero span or chord extent.");

  const requestedBins = options.binCount || Math.round(Math.sqrt(triangleIndices.length));
  const binCount = Math.max(12, Math.min(120, requestedBins));
  const bins = Array.from({ length: binCount }, (_, index) => ({
    y: bounds.min[1] + ((index + 0.5) / binCount) * spanM,
    minX: Infinity,
    maxX: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
    count: 0
  }));

  for (const point of samples) {
    const normalized = (point[1] - bounds.min[1]) / spanM;
    const index = Math.max(0, Math.min(binCount - 1, Math.floor(normalized * binCount)));
    const bin = bins[index];
    bin.minX = Math.min(bin.minX, point[0]);
    bin.maxX = Math.max(bin.maxX, point[0]);
    bin.minZ = Math.min(bin.minZ, point[2]);
    bin.maxZ = Math.max(bin.maxZ, point[2]);
    bin.count += 1;
  }

  fillMissingBins(bins);
  const stations = bins.map((bin) => ({
    y: bin.y,
    leadingX: bin.minX,
    trailingX: bin.maxX,
    chord: Math.max(0, bin.maxX - bin.minX),
    quarterChordX: bin.minX + 0.25 * Math.max(0, bin.maxX - bin.minX),
    midZ: (bin.minZ + bin.maxZ) / 2
  }));

  const areaM2 = integrate(stations, (station) => station.chord);
  const macM = areaM2 > EPSILON ? integrate(stations, (station) => station.chord ** 2) / areaM2 : 0;
  const centerY = bounds.min[1] < 0 && bounds.max[1] > 0 ? 0 : (bounds.min[1] + bounds.max[1]) / 2;
  const rootStations = closestStations(stations, centerY, 3);
  const leftTip = closestStations(stations, bounds.min[1], 2);
  const rightTip = closestStations(stations, bounds.max[1], 2);
  const rootChordM = average(rootStations.map((station) => station.chord));
  const tipChordM = average([...leftTip, ...rightTip].map((station) => station.chord));
  const xLeadingRootM = average(rootStations.map((station) => station.leadingX));
  const zRootM = average(rootStations.map((station) => station.midZ));
  const quarterChordX = areaM2 > EPSILON
    ? integrate(stations, (station) => station.quarterChordX * station.chord) / areaM2
    : xLeadingRootM + 0.25 * rootChordM;

  const rightHalf = stations.filter((station) => station.y >= centerY);
  const sweepSlope = regressionSlope(rightHalf, (station) => station.y, (station) => station.quarterChordX);
  const dihedralSlope = regressionSlope(rightHalf, (station) => station.y, (station) => station.midZ);
  const aspectRatio = areaM2 > EPSILON ? spanM ** 2 / areaM2 : 0;
  const warnings = [];
  if (areaM2 <= EPSILON) warnings.push("Planform area could not be derived from the assigned triangles.");
  if (aspectRatio < 0.5 || aspectRatio > 30) warnings.push(`Aspect ratio ${aspectRatio.toFixed(2)} is outside the expected aircraft range.`);
  if (projectedAreaSumM2 > areaM2 * 1.6) warnings.push("Both upper and lower skins appear selected; envelope integration was used to avoid double-counting planform area.");

  return {
    valid: warnings.length === 0 || areaM2 > EPSILON,
    triangleCount: triangleIndices.length,
    triangleAreaM2,
    projectedAreaSumM2,
    bounds: { min: bounds.min, max: bounds.max, size: bounds.max.map((value, axis) => value - bounds.min[axis]) },
    spanM,
    areaM2,
    macM,
    rootChordM,
    tipChordM,
    aspectRatio,
    sweepDeg: Math.atan(sweepSlope) * 180 / Math.PI,
    dihedralDeg: Math.atan(dihedralSlope) * 180 / Math.PI,
    xLeadingRootM,
    zRootM,
    aeroCenterXM: quarterChordX,
    stations,
    warnings
  };
}

export function buildRecognitionReport(positions, assignments) {
  const components = {};
  for (const [name, type] of Object.entries(COMPONENT_TYPES)) {
    if (type === COMPONENT_TYPES.unassigned) continue;
    const triangles = trianglesForComponent(assignments, type);
    components[name] = triangles.length ? computeSurfaceReference(positions, triangles) : invalidReference("Not assigned.");
  }
  return components;
}

export function encodeAssignments(assignments) {
  const runs = [];
  if (!assignments.length) return runs;
  let value = assignments[0];
  let count = 1;
  for (let i = 1; i < assignments.length; i += 1) {
    if (assignments[i] === value) count += 1;
    else {
      runs.push([value, count]);
      value = assignments[i];
      count = 1;
    }
  }
  runs.push([value, count]);
  return runs;
}

export function decodeAssignments(runs, triangleCount) {
  const assignments = new Uint8Array(triangleCount);
  let cursor = 0;
  for (const entry of Array.isArray(runs) ? runs : []) {
    const value = Number(entry[0]);
    const count = Number(entry[1]);
    if (!Number.isInteger(value) || value < 0 || value > 4 || !Number.isInteger(count) || count < 0) continue;
    assignments.fill(value, cursor, Math.min(triangleCount, cursor + count));
    cursor += count;
    if (cursor >= triangleCount) break;
  }
  return assignments;
}

function invalidReference(message) {
  return { valid: false, triangleCount: 0, warnings: [message] };
}

function fillMissingBins(bins) {
  const populated = bins.map((bin, index) => bin.count ? index : -1).filter((index) => index >= 0);
  if (!populated.length) return;
  for (let index = 0; index < bins.length; index += 1) {
    if (bins[index].count) continue;
    let lower = populated[0];
    let upper = populated[populated.length - 1];
    for (const candidate of populated) {
      if (candidate <= index) lower = candidate;
      if (candidate >= index) { upper = candidate; break; }
    }
    const t = lower === upper ? 0 : (index - lower) / (upper - lower);
    for (const key of ["minX", "maxX", "minZ", "maxZ"]) {
      bins[index][key] = bins[lower][key] + (bins[upper][key] - bins[lower][key]) * t;
    }
  }
}

function integrate(stations, accessor) {
  if (stations.length < 2) return 0;
  let value = 0;
  const firstSpacing = stations[1].y - stations[0].y;
  const lastSpacing = stations[stations.length - 1].y - stations[stations.length - 2].y;
  value += 0.5 * accessor(stations[0]) * firstSpacing;
  for (let i = 1; i < stations.length; i += 1) {
    const dy = stations[i].y - stations[i - 1].y;
    value += 0.5 * (accessor(stations[i - 1]) + accessor(stations[i])) * dy;
  }
  value += 0.5 * accessor(stations[stations.length - 1]) * lastSpacing;
  return value;
}

function closestStations(stations, y, count) {
  return [...stations].sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y)).slice(0, count);
}

function regressionSlope(values, xAccessor, yAccessor) {
  if (values.length < 2) return 0;
  const meanX = average(values.map(xAccessor));
  const meanY = average(values.map(yAccessor));
  let numerator = 0;
  let denominator = 0;
  for (const value of values) {
    const dx = xAccessor(value) - meanX;
    numerator += dx * (yAccessor(value) - meanY);
    denominator += dx * dx;
  }
  return denominator > EPSILON ? numerator / denominator : 0;
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function triangleNormal(positions, triangle) {
  const base = triangle * 9;
  const value = cross(subtract(vertex(positions, base + 3), vertex(positions, base)), subtract(vertex(positions, base + 6), vertex(positions, base)));
  const length = magnitude(value) || 1;
  return value.map((component) => component / length);
}

function vertex(positions, offset) {
  return [positions[offset], positions[offset + 1], positions[offset + 2]];
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function magnitude(value) {
  return Math.hypot(value[0], value[1], value[2]);
}
