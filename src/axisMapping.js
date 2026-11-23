export const AXIS_OPTIONS = [
  { value: "x", label: "STL +X" },
  { value: "-x", label: "STL -X" },
  { value: "y", label: "STL +Y" },
  { value: "-y", label: "STL -Y" },
  { value: "z", label: "STL +Z" },
  { value: "-z", label: "STL -Z" }
];

export const DEFAULT_AXIS_MAPPING = {
  longitudinal: "x",
  lateral: "z",
  vertical: "y"
};

const AXIS_INDEX = { x: 0, y: 1, z: 2 };

export function mapPositions(rawPositions, mapping = DEFAULT_AXIS_MAPPING, unitScale = 1) {
  validateAxisMapping(mapping);
  if (!Number.isFinite(unitScale) || unitScale <= 0) {
    throw new Error("Unit scale must be a positive finite number.");
  }
  const mapped = new Float64Array(rawPositions.length);
  for (let i = 0; i < rawPositions.length; i += 3) {
    const raw = [rawPositions[i], rawPositions[i + 1], rawPositions[i + 2]];
    mapped[i] = readAxis(raw, mapping.longitudinal) * unitScale;
    mapped[i + 1] = readAxis(raw, mapping.lateral) * unitScale;
    mapped[i + 2] = readAxis(raw, mapping.vertical) * unitScale;
  }
  return mapped;
}

export function validateAxisMapping(mapping) {
  const values = [mapping.longitudinal, mapping.lateral, mapping.vertical];
  const axes = values.map((value) => String(value || "").replace("-", ""));
  if (axes.some((axis) => !(axis in AXIS_INDEX))) {
    throw new Error("Axis mapping contains an unsupported axis.");
  }
  if (new Set(axes).size !== 3) {
    throw new Error("Longitudinal, lateral, and vertical must use three different STL axes.");
  }
  return true;
}

export function readAxis(vector, axis) {
  const sign = axis.startsWith("-") ? -1 : 1;
  const key = axis.replace("-", "");
  return sign * vector[AXIS_INDEX[key]];
}

export function internalToScene(vector) {
  return [vector[0], vector[2], vector[1]];
}

export function positionsToSceneFloat32(positions) {
  const scene = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    scene[i] = positions[i];
    scene[i + 1] = positions[i + 2];
    scene[i + 2] = positions[i + 1];
  }
  return scene;
}
