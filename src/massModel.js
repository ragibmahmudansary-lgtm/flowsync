import { translateInertia, zeroTensor } from "./geometry.js";

export function createDefaultManifest(meshProperties) {
  const centroid = meshProperties?.centroid || [0, 0, 0];
  return {
    version: 1,
    units: "SI",
    components: [
      {
        id: "airframe-mesh",
        name: "Airframe mesh volume",
        type: "mesh-volume",
        massKg: 42600,
        positionM: [...centroid],
        notes: "Uniform distributed mass over the imported STL volume. Edit this mass or import a real manifest for precise CG."
      }
    ]
  };
}

export function createPointMass(meshProperties, index = 1) {
  const center = meshProperties?.bounds?.center || [0, 0, 0];
  return {
    id: `point-mass-${Date.now()}-${index}`,
    name: `Point mass ${index}`,
    type: "point-mass",
    massKg: 1000,
    positionM: [...center],
    notes: ""
  };
}

export function normalizeManifest(manifest, meshProperties) {
  const source = manifest && Array.isArray(manifest.components) ? manifest : createDefaultManifest(meshProperties);
  return {
    version: 1,
    units: "SI",
    components: source.components.map((component, index) => normalizeComponent(component, meshProperties, index))
  };
}

export function updateMeshComponentPositions(manifest, meshProperties) {
  if (!manifest || !meshProperties) return manifest;
  for (const component of manifest.components) {
    if (component.type === "mesh-volume") component.positionM = [...meshProperties.centroid];
  }
  return manifest;
}

export function aggregateMassProperties(manifest, meshProperties) {
  const components = normalizeManifest(manifest, meshProperties).components;
  const resolved = components
    .filter((component) => Number.isFinite(component.massKg) && component.massKg > 0)
    .map((component) => resolveComponent(component, meshProperties));

  const totalMassKg = resolved.reduce((sum, component) => sum + component.massKg, 0);
  if (totalMassKg <= 0) {
    return {
      totalMassKg: 0,
      cg: [0, 0, 0],
      inertiaCg: zeroTensor(),
      components: resolved,
      warnings: ["Mass manifest has no positive masses."]
    };
  }

  const cg = [0, 0, 0];
  for (const component of resolved) {
    cg[0] += component.massKg * component.positionM[0];
    cg[1] += component.massKg * component.positionM[1];
    cg[2] += component.massKg * component.positionM[2];
  }
  cg[0] /= totalMassKg;
  cg[1] /= totalMassKg;
  cg[2] /= totalMassKg;

  let inertiaCg = zeroTensor();
  for (const component of resolved) {
    const translated = translateInertia(component.inertiaLocalCg, component.massKg, component.positionM, cg, 1);
    inertiaCg = addTensor(inertiaCg, translated);
  }

  const warnings = [];
  if (!resolved.some((component) => component.type === "mesh-volume")) {
    warnings.push("No mesh-volume component is active; CG is based only on point/component masses.");
  }
  if (resolved.some((component) => component.id === "airframe-mesh" && Number(component.massKg) === 42600)) {
    warnings.push("The 42,600 kg demo airframe mass is an editable assumption, not data contained in the STL.");
  }
  if (meshProperties?.warnings?.length) warnings.push(...meshProperties.warnings);

  return { totalMassKg, cg, inertiaCg, components: resolved, warnings };
}

function normalizeComponent(component, meshProperties, index) {
  const type = ["mesh-volume", "point-mass", "component"].includes(component.type) ? component.type : "point-mass";
  const position = Array.isArray(component.positionM) ? component.positionM : meshProperties?.bounds?.center || [0, 0, 0];
  const mass = Number.parseFloat(component.massKg);
  return {
    id: component.id || `${type}-${index + 1}`,
    name: component.name || `${type} ${index + 1}`,
    type,
    massKg: Number.isFinite(mass) ? mass : 0,
    positionM: [
      Number.parseFloat(position[0]) || 0,
      Number.parseFloat(position[1]) || 0,
      Number.parseFloat(position[2]) || 0
    ],
    notes: component.notes || ""
  };
}

function resolveComponent(component, meshProperties) {
  if (component.type === "mesh-volume" && meshProperties?.inertiaCg) {
    return {
      ...component,
      positionM: [...meshProperties.centroid],
      inertiaLocalCg: scaleTensor(meshProperties.inertiaCg, component.massKg)
    };
  }
  return { ...component, inertiaLocalCg: zeroTensor() };
}

function addTensor(a, b) {
  return {
    xx: a.xx + b.xx,
    yy: a.yy + b.yy,
    zz: a.zz + b.zz,
    xy: a.xy + b.xy,
    xz: a.xz + b.xz,
    yz: a.yz + b.yz
  };
}

function scaleTensor(tensor, scalar) {
  return {
    xx: tensor.xx * scalar,
    yy: tensor.yy * scalar,
    zz: tensor.zz * scalar,
    xy: tensor.xy * scalar,
    xz: tensor.xz * scalar,
    yz: tensor.yz * scalar
  };
}
