// Shared fixture and region-rule definitions for the P2-0 baseline (2026-11-07).
// Raw STL frame, millimetres. Region rules select triangles by raw-z centroid.
import path from "node:path";
const root = path.resolve(new URL("../../..", import.meta.url).pathname);
export const FIXTURES = {
  a320: { file: path.join(root, "assets/airbus-a320-cfd-1.snapshot.7/samolot.stl"), unit: "m (A320 demo; scale as in the app default)", unitScale: 1 },
  wing: { file: path.join(root, "assets/b737-wing-aerofoil-model-attempt/B737 aerofoil attempt.stl"), unit: "mm (assumed: SolidWorks default; STL carries no unit and the SLDPRT is not readable)", unitScale: 0.001 },
  drone: { file: path.join(root, "assets/drone-reverse-engineering-in-catia-v5-1.snapshot.8/Dron w100.stl"), unit: "mm (STEP declares SI_UNIT(.MILLI.,.METRE.))", unitScale: 0.001 }
};
// Rules fixed from the measured |z| profile BEFORE any recognition or oracle number (see README).
export const RULES = {
  all: { fixture: "wing", describe: "every triangle", select: () => true },
  "drone-wing": { fixture: "drone", describe: "300 <= |raw z centroid| < 990 mm (excludes centre pod and winglets)", select: (cz) => Math.abs(cz) >= 300 && Math.abs(cz) < 990 },
  "drone-with-winglets": { fixture: "drone", describe: "|raw z centroid| >= 300 mm (excludes pod only; sensitivity)", select: (cz) => Math.abs(cz) >= 300 }
};
