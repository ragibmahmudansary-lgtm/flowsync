// P2-0 baseline: current (pre-change) recognition on the wing and the drone.
// Usage: node baseline.mjs <caseName> <out.json>   caseName in: wing | drone-wing | drone-with-winglets | a320-all
import fs from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import { parseSTL } from "../../../src/stlParser.js";
import { mapPositions, DEFAULT_AXIS_MAPPING } from "../../../src/axisMapping.js";
import { computeSurfaceReference } from "../../../src/recognition.js";
import { computeTopology } from "../../../src/core/topology.js";
import { FIXTURES, RULES } from "./fixtures.mjs";

const [caseName, outPath] = process.argv.slice(2);
const mem = () => { const m = process.memoryUsage(); return { rssMB: +(m.rss/1048576).toFixed(1), heapUsedMB: +(m.heapUsed/1048576).toFixed(1) }; };
const t = () => performance.now();
const rule = caseName === "a320-all" ? { fixture: "a320", describe: "every triangle", select: () => true } : RULES[caseName === "wing" ? "all" : caseName];
const fx = FIXTURES[rule.fixture];
const result = { case: caseName, fixture: rule.fixture, rule: rule.describe, node: process.version, loadavgStart: os.loadavg()[0], stages: {} };

let t0 = t();
const buf = fs.readFileSync(fx.file);
const parsed = parseSTL(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
result.stages.parse = { ms: +(t() - t0).toFixed(1), ...mem() };

t0 = t();
const mapped = mapPositions(parsed.positions, DEFAULT_AXIS_MAPPING, fx.unitScale);
result.stages.map = { ms: +(t() - t0).toFixed(1), ...mem() };

// Select by raw-z centroid in millimetres (scale-independent for the A320 'all' rule).
const idx = [];
for (let tri = 0; tri < parsed.triangleCount; tri += 1) {
  const b = tri * 9;
  const cz = (parsed.positions[b + 2] + parsed.positions[b + 5] + parsed.positions[b + 8]) / 3;
  if (rule.select(cz)) idx.push(tri);
}
const idxBytes = Buffer.alloc(idx.length * 4);
idx.forEach((v, i) => idxBytes.writeUInt32LE(v, i * 4));
result.region = { triangleCount: idx.length, regionIndexSha256: crypto.createHash("sha256").update(idxBytes).digest("hex") };

t0 = t();
const ref = computeSurfaceReference(mapped, idx);
result.stages.recognition = { ms: +(t() - t0).toFixed(1), ...mem() };
const { stations, ...scalars } = ref;
result.recognition = { ...scalars, stationCount: stations?.length ?? 0, reportJsonBytes: JSON.stringify(ref).length };

t0 = t();
const topo = computeTopology(parsed.positions);
result.stages.topology = { ms: +(t() - t0).toFixed(1), ...mem() };
result.topology = topo;

result.loadavgEnd = os.loadavg()[0];
fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ case: caseName, region: result.region, recognition: { valid: ref.valid, areaM2: ref.areaM2, spanM: ref.spanM, macM: ref.macM, rootChordM: ref.rootChordM, sweepDeg: ref.sweepDeg, warnings: ref.warnings }, stages: result.stages, topology: { components: topo.componentCount, boundary: topo.boundaryEdges, nonManifold: topo.nonManifoldEdges } }, null, 1));
