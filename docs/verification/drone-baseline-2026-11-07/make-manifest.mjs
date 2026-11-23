import fs from "node:fs";
import crypto from "node:crypto";
import { FIXTURES } from "./fixtures.mjs";
import { parseSTL } from "../../../src/stlParser.js";
const provenance = {
  a320: "Committed demo model (assets/airbus-a320-cfd-1.snapshot.7); licence question Q-7 open.",
  wing: "Local only, untracked. SolidWorks export 'B737 aerofoil attempt' (2012, companion SLDPRT + render). Licence not confirmed.",
  drone: "Local only, untracked. CATIA V5 export 'Dron w100' from a Windows folder, with STEP companion. Licence not confirmed."
};
const out = { generated: new Date().toISOString(), files: {} };
for (const [key, fx] of Object.entries(FIXTURES)) {
  const buf = fs.readFileSync(fx.file);
  const s = parseSTL(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let nonFinite = 0;
  for (let i = 0; i < s.positions.length; i += 3) for (let a = 0; a < 3; a += 1) {
    const v = s.positions[i + a];
    if (!Number.isFinite(v)) { nonFinite += 1; continue; }
    if (v < min[a]) min[a] = v; if (v > max[a]) max[a] = v;
  }
  let degenerate = 0;
  for (let t = 0; t < s.triangleCount; t += 1) {
    const p = s.positions, b = t * 9;
    const ux = p[b+3]-p[b], uy = p[b+4]-p[b+1], uz = p[b+5]-p[b+2], vx = p[b+6]-p[b], vy = p[b+7]-p[b+1], vz = p[b+8]-p[b+2];
    if (Math.hypot(uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx) === 0) degenerate += 1;
  }
  out.files[key] = {
    path: fx.file.replace(/^.*\/AirFLOW\//, ""),
    bytes: buf.length,
    sha256: crypto.createHash("sha256").update(buf).digest("hex"),
    format: s.format,
    triangleCount: s.triangleCount,
    header80: buf.subarray(0, 80).toString("latin1").replace(/\0+$/, "").replace(/[^\x20-\x7e]/g, "?"),
    rawBounds: { min, max },
    nonFiniteValues: nonFinite,
    exactlyZeroAreaTriangles: degenerate,
    unit: fx.unit,
    unitScaleToMetres: fx.unitScale,
    provenance: provenance[key],
    licence: "to confirm"
  };
}
fs.writeFileSync(new URL("./manifest.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out, null, 2));
