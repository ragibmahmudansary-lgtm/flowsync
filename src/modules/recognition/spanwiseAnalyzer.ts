import type { CadFace, LiftingSurfaceProps, VlmStation } from "@/core/types";

const SPANWISE_BINS = 48;

interface Bin {
  y0: number;
  y1: number;
  xMin: number;
  xMax: number;
  area: number;
  zWeighted: number;
}

/**
 * Planform properties from projected UPPER skin only (projecting both
 * skins would double-count planform area). Convention: X fwd, Y right, Z up.
 * Sweep documented at quarter-chord (FS-04-013).
 */
export function analyzeLiftingSurface(faces: CadFace[]): LiftingSurfaceProps | null {
  const skin = faces.filter((f) => f.avgNormal[2] > 0.15);
  const useFaces = skin.length > 0 ? skin : faces;

  interface Tri {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    x3: number;
    y3: number;
    z: number;
    area: number;
  }
  const tris: Tri[] = [];
  let yMin = Infinity,
    yMax = -Infinity;

  for (const face of useFaces) {
    const p = face.position,
      idx = face.index;
    for (let t = 0; t < idx.length; t += 3) {
      const ia = idx[t] * 3,
        ib = idx[t + 1] * 3,
        ic = idx[t + 2] * 3;
      const x1 = p[ia],
        y1 = p[ia + 1],
        x2 = p[ib],
        y2 = p[ib + 1],
        x3 = p[ic],
        y3 = p[ic + 1];
      const area = Math.abs((x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1)) / 2;
      if (area <= 1e-12) continue;
      const z = (p[ia + 2] + p[ib + 2] + p[ic + 2]) / 3;
      tris.push({ x1, y1, x2, y2, x3, y3, z, area });
      for (const y of [y1, y2, y3]) {
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
      }
    }
  }
  if (tris.length === 0) return null;

  const span = yMax - yMin;
  if (span <= 1e-9) return null;

  const bins: Bin[] = Array.from({ length: SPANWISE_BINS }, (_, i) => ({
    y0: yMin + (span * i) / SPANWISE_BINS,
    y1: yMin + (span * (i + 1)) / SPANWISE_BINS,
    xMin: Infinity,
    xMax: -Infinity,
    area: 0,
    zWeighted: 0,
  }));

  for (const tri of tris) {
    const yc = (tri.y1 + tri.y2 + tri.y3) / 3;
    let bi = Math.floor(((yc - yMin) / span) * SPANWISE_BINS);
    if (bi < 0) bi = 0;
    if (bi >= SPANWISE_BINS) bi = SPANWISE_BINS - 1;
    const b = bins[bi];
    b.xMin = Math.min(b.xMin, tri.x1, tri.x2, tri.x3);
    b.xMax = Math.max(b.xMax, tri.x1, tri.x2, tri.x3);
    b.area += tri.area;
    b.zWeighted += tri.z * tri.area;
  }

  const active = bins.filter((b) => b.area > 1e-12);
  if (active.length === 0) return null;

  const totalArea = active.reduce((s, b) => s + b.area, 0);
  let areaLeft = 0,
    areaRight = 0;
  for (const tri of tris) {
    const yc = (tri.y1 + tri.y2 + tri.y3) / 3;
    if (yc < 0) areaLeft += tri.area;
    else areaRight += tri.area;
  }

  const centerOf = (b: Bin) => (b.y0 + b.y1) / 2;
  const right = active.filter((b) => centerOf(b) >= 0);
  const halfSource = right.length >= 3 ? right : active;
  const halfArea = halfSource.reduce((s, b) => s + b.area, 0);
  const dy = span / SPANWISE_BINS;

  let macI = 0,
    macXI = 0,
    macYI = 0;
  for (const b of halfSource) {
    const c = b.xMax - b.xMin;
    macI += c * c * dy;
    macXI += b.xMin * c * dy;
    macYI += centerOf(b) * c * dy;
  }
  const mac = halfArea > 0 ? macI / halfArea : 0;
  const macX = halfArea > 0 ? macXI / halfArea : 0;
  const macY = halfArea > 0 ? macYI / halfArea : 0;

  const rootBin = active.reduce(
    (best, b) => (Math.abs(centerOf(b)) < Math.abs(centerOf(best)) ? b : best),
    active[0]
  );
  const tipBin = active.reduce(
    (best, b) => (centerOf(b) > centerOf(best) ? b : best),
    active[0]
  );
  const rootChord = rootBin.xMax - rootBin.xMin;
  const tipChord = tipBin.xMax - tipBin.xMin;
  const aspectRatio = totalArea > 0 ? (span * span) / totalArea : 0;

  const xqRoot = rootBin.xMin + 0.25 * rootChord;
  const xqTip = tipBin.xMin + 0.25 * tipChord;
  const dyRef = centerOf(tipBin) - centerOf(rootBin);
  const sweepQuarterChordDeg =
    Math.abs(dyRef) > 1e-9
      ? (Math.atan2(xqRoot - xqTip, dyRef) * 180) / Math.PI
      : 0;

  const zRoot = rootBin.zWeighted / rootBin.area;
  const zTip = tipBin.zWeighted / tipBin.area;
  const dihedralDeg =
    Math.abs(dyRef) > 1e-9
      ? (Math.atan2(zTip - zRoot, dyRef) * 180) / Math.PI
      : 0;

  const symmetric =
    totalArea > 0 &&
    Math.abs(areaLeft - areaRight) / totalArea < 0.05 &&
    Math.abs(yMin + yMax) < 0.05 * span;

  const stations: VlmStation[] = active.map((b) => ({
    y: centerOf(b),
    xLe: b.xMin,
    xTe: b.xMax,
    z: b.zWeighted / b.area,
  }));

  return {
    span,
    semiSpan: span / 2,
    rootChord,
    tipChord,
    mac,
    macX,
    macY,
    area: totalArea,
    areaLeft,
    areaRight,
    aspectRatio,
    sweepQuarterChordDeg,
    dihedralDeg,
    symmetric,
    stations,
  };
}
