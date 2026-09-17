import type {
  CadFace,
  ComponentType,
  ImportedModel,
  RecognitionResult,
} from "@/core/types";
import { analyzeLiftingSurface } from "./spanwiseAnalyzer";

function weldKey(x: number, y: number, z: number): string {
  return `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
}

/** Union-Find lumps = connected shells/solids. */
function findLumps(faces: CadFace[]): string[][] {
  const parent = new Map<string, string>();
  for (const f of faces) parent.set(f.id, f.id);
  const find = (a: string): string => {
    let r = a;
    while (parent.get(r)! !== r) r = parent.get(r)!;
    parent.set(a, r);
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a),
      rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  const vertexMap = new Map<string, string>();
  for (const f of faces)
    for (let i = 0; i < f.position.length; i += 3) {
      const k = weldKey(f.position[i], f.position[i + 1], f.position[i + 2]);
      const ex = vertexMap.get(k);
      if (ex) union(ex, f.id);
      else vertexMap.set(k, f.id);
    }
  const groups = new Map<string, string[]>();
  for (const f of faces) {
    const r = find(f.id);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(f.id);
  }
  return Array.from(groups.values());
}

/** Recompute all derived engineering properties from a component map. */
export function applyComponentMap(
  model: ImportedModel,
  prev: RecognitionResult,
  map: Record<string, ComponentType>
): RecognitionResult {
  const facesOf = (c: ComponentType) =>
    model.faces.filter((f) => map[f.id] === c);
  const wingFaces = facesOf("wing");
  const htailFaces = facesOf("htail");
  const vtailFaces = facesOf("vtail");
  const fuselageFaces = facesOf("fuselage");

  const wing = wingFaces.length ? analyzeLiftingSurface(wingFaces) : null;
  const htail = htailFaces.length ? analyzeLiftingSurface(htailFaces) : null;

  let vtailArea = 0,
    vtailHeight = 0;
  if (vtailFaces.length) {
    vtailArea = vtailFaces.reduce((s, f) => s + f.area, 0);
    let z0 = Infinity,
      z1 = -Infinity;
    for (const f of vtailFaces) {
      z0 = Math.min(z0, f.bbox.min[2]);
      z1 = Math.max(z1, f.bbox.max[2]);
    }
    vtailHeight = z1 - z0;
  }

  let fuselageLength = 0,
    fuselageMaxWidth = 0;
  if (fuselageFaces.length) {
    let x0 = Infinity,
      x1 = -Infinity,
      w = 0;
    for (const f of fuselageFaces) {
      x0 = Math.min(x0, f.bbox.min[0]);
      x1 = Math.max(x1, f.bbox.max[0]);
      w = Math.max(w, f.bbox.max[1], -f.bbox.min[1]);
    }
    fuselageLength = x1 - x0;
    fuselageMaxWidth = 2 * w;
  }

  return {
    ...prev,
    componentByFaceId: map,
    wing,
    htail,
    vtailArea,
    vtailHeight,
    fuselageLength,
    fuselageMaxWidth,
  };
}

/**
 * Rule-based recognition for conventional fixed-wing aircraft.
 * D-008: outboard threshold is fuselage-width-aware so small horizontal
 * tails are not absorbed into the fuselage class:
 *   T = max(0.06·yLen, 1.25·fuselageHalfWidthEstimate)
 */
export function runRecognition(model: ImportedModel): RecognitionResult {
  const faces = model.faces;
  const warnings: string[] = [];
  const map: Record<string, ComponentType> = {};
  for (const f of faces) map[f.id] = "unassigned";

  const bb = model.bbox;
  const xLen = bb.max[0] - bb.min[0];
  const yLen = bb.max[1] - bb.min[1];
  const zLen = bb.max[2] - bb.min[2];

  const aftThreshold = bb.min[0] + 0.3 * xLen;
  const elevatedThreshold = bb.min[2] + 0.45 * zLen;
  const totalAreaAll = faces.reduce((s, f) => s + f.area, 0);
  const MIN_REGION = 0.015 * totalAreaAll;

  // fuselage half-width estimate from centerline deck faces
  let fw = 0;
  for (const f of faces)
    if (Math.abs(f.avgNormal[2]) >= 0.5 && Math.abs(f.centroid[1]) < 0.05 * yLen)
      fw = Math.max(fw, Math.abs(f.bbox.max[1]), Math.abs(f.bbox.min[1]));
  if (fw <= 0) fw = 0.04 * yLen;
  const outboardThreshold = Math.max(0.06 * yLen, 1.25 * fw);

  const faceById = new Map(faces.map((f) => [f.id, f]));
  const lumps = findLumps(faces);
  if (lumps.length === 1)
    warnings.push(
      "Single fused solid: per-face heuristic classification used (lower confidence). Verify with manual override."
    );

  const classifyFace = (f: CadFace): ComponentType => {
    if (f.area < MIN_REGION) return "fuselage"; // struts, gear, fairings
    const n = f.avgNormal,
      c = f.centroid;
    const horizontal = Math.abs(n[2]) >= 0.5;
    const vertical = Math.abs(n[1]) >= 0.5;
    const aft = c[0] < aftThreshold;
    const outboard = Math.abs(c[1]) >= outboardThreshold;
    const elevated = c[2] > elevatedThreshold;
    if (horizontal && outboard) return aft ? "htail" : "wing";
    if (horizontal) return "fuselage";
    if (vertical && aft && elevated) return "vtail";
    return "fuselage";
  };

  if (lumps.length > 1) {
    for (const lump of lumps) {
      let hArea = 0,
        vArea = 0,
        total = 0,
        cx = 0,
        cz = 0,
        minX = Infinity,
        maxX = -Infinity,
        maxY = 0;
      for (const id of lump) {
        const f = faceById.get(id)!;
        total += f.area;
        if (Math.abs(f.avgNormal[2]) >= 0.5) hArea += f.area;
        if (Math.abs(f.avgNormal[1]) >= 0.5) vArea += f.area;
        cx += f.centroid[0] * f.area;
        cz += f.centroid[2] * f.area;
        minX = Math.min(minX, f.bbox.min[0]);
        maxX = Math.max(maxX, f.bbox.max[0]);
        maxY = Math.max(maxY, f.bbox.max[1], -f.bbox.min[1]);
      }
      if (total <= 0 || total < MIN_REGION) {
        for (const id of lump) map[id] = "fuselage";
        continue;
      }
      cx /= total;
      cz /= total;

      let comp: ComponentType = "fuselage";
      if (hArea > 0.5 * total && maxY >= outboardThreshold)
        comp = cx < aftThreshold ? "htail" : "wing";
      else if (
        vArea > 0.5 * total &&
        hArea < 0.25 * total &&
        cx < aftThreshold &&
        cz > elevatedThreshold
      )
        comp = "vtail";
      for (const id of lump) map[id] = comp;
    }

    const wingLumps = lumps.filter((l) => map[l[0]] === "wing");
    if (wingLumps.length > 1) {
      const areaOf = (l: string[]) =>
        l.reduce((s, id) => s + faceById.get(id)!.area, 0);
      wingLumps.sort((a, b) => areaOf(b) - areaOf(a));
      for (const l of wingLumps.slice(1))
        for (const id of l) map[id] = "htail";
      warnings.push(
        "Multiple horizontal lifting bodies: largest kept as Wing, others assigned to Horizontal Tail."
      );
    }
  } else {
    for (const f of faces) map[f.id] = classifyFace(f);
  }

  const base: RecognitionResult = {
    status: "proposed",
    componentByFaceId: map,
    wing: null,
    htail: null,
    vtailArea: 0,
    vtailHeight: 0,
    fuselageLength: 0,
    fuselageMaxWidth: 0,
    warnings,
    generatedAt: new Date().toISOString(),
  };

  const result = applyComponentMap(model, base, map);

  if (!result.wing)
    result.warnings.push(
      "No wing surfaces detected. Use manual override to assign faces to Wing."
    );
  if (!result.htail) result.warnings.push("No horizontal tail detected.");
  if (result.vtailArea === 0) result.warnings.push("No vertical tail detected.");
  if (result.wing && !result.wing.symmetric)
    result.warnings.push(
      "Wing planform appears asymmetric (left/right area mismatch > 5%)."
    );
  if (result.wing && result.wing.aspectRatio < 3)
    result.warnings.push(
      "Wing aspect ratio unusually low (< 3). Check recognition."
    );

  return result;
}
