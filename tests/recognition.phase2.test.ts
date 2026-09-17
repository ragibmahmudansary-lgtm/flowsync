import { describe, expect, it } from "vitest";
import { buildFace } from "@/modules/cad/faceProperties";
import { analyzeLiftingSurface } from "@/modules/recognition/spanwiseAnalyzer";
import { runRecognition } from "@/modules/recognition/recognitionEngine";
import type { CadFace, ImportedModel } from "@/core/types";

function planformFace(
  id: string,
  y0: number,
  y1: number,
  x0: number,
  x1: number,
  z: number,
  vertical = false
): CadFace {
  // quad: two triangles; horizontal = normal +Z, vertical = normal +Y
  const p = vertical
    ? Float32Array.from([
        x0, 0, y0,
        x1, 0, y0,
        x1, 0, y1,
        x0, 0, y0,
        x1, 0, y1,
        x0, 0, y1,
      ])
    : Float32Array.from([
        x0, y0, z,
        x1, y0, z,
        x1, y1, z,
        x0, y0, z,
        x1, y1, z,
        x0, y1, z,
      ]);
  const normal = new Float32Array(p.length);
  const index = new Uint32Array([0, 1, 2, 3, 4, 5]);
  return buildFace(id, id, "stl", p, normal, index, "#888888");
}

describe("spanwise analyzer", () => {
  it("rectangular wing planform", () => {
    const f = planformFace("W", -3, 3, 0, 1, 0);
    const props = analyzeLiftingSurface([f])!;
    expect(props).not.toBeNull();
    expect(props.span).toBeCloseTo(6, 3);
    expect(props.area).toBeCloseTo(6, 3);
    expect(props.rootChord).toBeCloseTo(1, 3);
    expect(props.mac).toBeCloseTo(1, 3);
    expect(props.aspectRatio).toBeCloseTo(6, 3);
    expect(Math.abs(props.sweepQuarterChordDeg)).toBeLessThan(0.5);
    expect(Math.abs(props.dihedralDeg)).toBeLessThan(0.5);
    expect(props.symmetric).toBe(true);
    expect(props.stations.length).toBeGreaterThan(2);
  });

  it("returns null for empty faces", () => {
    const props = analyzeLiftingSurface([]);
    expect(props).toBeNull();
  });
});

describe("recognition engine", () => {
  it("classifies synthetic conventional aircraft", () => {
    const faces = [
      planformFace("wingR", 0.5, 3, 0, 1, 0),
      planformFace("wingL", -3, -0.5, 0, 1, 0),
      planformFace("htailR", 0.4, 1.2, -2.6, -2.0, 0.1),
      planformFace("vtail", -0.3, 0.3, 0.3, 1.2, 0, true),
      planformFace("fusSide", -2.5, 0.8, -0.2, 0.2, 0, true),
    ];

    // Make fuselage side panel have y-normal (vertical)
    const fusPos = Float32Array.from([
      -2.5, 0.25, -0.2,
      0.8, 0.25, -0.2,
      0.8, 0.25, 0.2,
      -2.5, 0.25, -0.2,
      0.8, 0.25, 0.2,
      -2.5, 0.25, 0.2,
    ]);
    faces[4] = buildFace("fusSide", "fusSide", "stl", fusPos, new Float32Array(fusPos.length), new Uint32Array([0, 1, 2, 3, 4, 5]), "#888");

    const bbox = {
      min: [-2.6, -3, -0.2] as [number, number, number],
      max: [1, 3, 1.2] as [number, number, number],
    };
    const model: ImportedModel = {
      fileName: "synth.stl",
      format: "stl",
      unit: "meter",
      faces,
      adjacency: {},
      bbox,
      triangleCount: 10,
      vertexCount: 20,
      importedAt: new Date().toISOString(),
    };
    const r = runRecognition(model);
    expect(r.componentByFaceId["wingR"]).toBe("wing");
    expect(r.componentByFaceId["wingL"]).toBe("wing");
    expect(r.componentByFaceId["htailR"]).toBe("htail");
    expect(r.wing).not.toBeNull();
    expect(r.wing!.span).toBeCloseTo(6, 0);
  });

  it("produces warnings when no wing detected", () => {
    // Only fuselage-like faces
    const faces = [
      planformFace("f1", -0.2, 0.2, -2, 2, 0, true),
    ];
    const bbox = {
      min: [-2, -0.2, -0.2] as [number, number, number],
      max: [2, 0.2, 0.2] as [number, number, number],
    };
    const model: ImportedModel = {
      fileName: "fus.stl",
      format: "stl",
      unit: "meter",
      faces,
      adjacency: {},
      bbox,
      triangleCount: 2,
      vertexCount: 6,
      importedAt: new Date().toISOString(),
    };
    const r = runRecognition(model);
    expect(r.warnings.some((w) => w.includes("No wing"))).toBe(true);
  });
});
