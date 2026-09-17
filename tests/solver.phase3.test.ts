import { describe, expect, it } from "vitest";
import { generatePanels } from "@/modules/solver/panelGenerator";
import { solveAlpha } from "@/modules/solver/vlmSolver";
import { analyzeStability } from "@/modules/solver/stability";
import { computeComponentProperties, computeCG } from "@/modules/solver/massProperties";
import { buildFace } from "@/modules/cad/faceProperties";

describe("VLM vs lifting-line", () => {
  it("rectangular AR=6 wing", () => {
    const stations = Array.from({ length: 25 }, (_, i) => ({
      y: -3 + (6 * i) / 24,
      xLe: 0,
      xTe: 1,
      z: 0,
    }));
    const panels = generatePanels([{ id: "w", name: "w", stations }], 24, 6);
    const ref = {
      area: 6,
      span: 6,
      mac: 1,
      momentRef: [0.25, 0, 0] as [number, number, number],
    };
    const res = [0, 4, 8].map((a) =>
      solveAlpha(
        panels,
        { velocity: 30, density: 1.225, viscosity: 1.81e-5, alphaDeg: a },
        ref,
        { relaxWake: true, viscousCorrection: true }
      )
    );
    const slope = (res[2].CL - res[0].CL) / 8;
    const ideal = ((2 * Math.PI * 6) / 8) * (Math.PI / 180);
    expect(Math.abs(slope - ideal) / ideal).toBeLessThan(0.12);
    const e = (res[1].CL ** 2) / (Math.PI * 6 * res[1].CDi);
    expect(e).toBeGreaterThan(0.85);
    expect(e).toBeLessThan(1.05);
    expect(res[1].CD0).toBeGreaterThan(0);
  });
});

describe("stability math", () => {
  it("stable configuration verdict", () => {
    const results = [0, 2, 4, 6, 8].map((a) => ({
      alphaDeg: a,
      CL: 0.1 * a,
      CDi: 0,
      CD0: 0,
      CD: 0,
      Cm: 0.05 - 0.02 * a,
      lift: 0,
      drag: 0,
      relaxed: false,
      spanwise: [],
    }));
    const rep = analyzeStability(results as any, {
      mac: 2,
      macX: 0,
      momentRefX: 0.5,
      cgX: 0.5,
    });
    expect(rep.valid).toBe(true);
    expect(rep.verdict).toBe("STABLE");
    expect(rep.staticMargin).toBeCloseTo(0.2, 5);
  });
});

describe("mass properties", () => {
  it("closed box volume via divergence theorem", () => {
    const C = [1, 0.5, 0.25];
    const quads: number[][][] = [
      [[0, 0, 0], [2, 0, 0], [2, 1, 0], [0, 1, 0]],
      [[0, 0, 0.5], [2, 0, 0.5], [2, 1, 0.5], [0, 1, 0.5]],
      [[0, 0, 0], [0, 1, 0], [0, 1, 0.5], [0, 0, 0.5]],
      [[2, 0, 0], [2, 1, 0], [2, 1, 0.5], [2, 0, 0.5]],
      [[0, 0, 0], [2, 0, 0], [2, 0, 0.5], [0, 0, 0.5]],
      [[0, 1, 0], [2, 1, 0], [2, 1, 0.5], [0, 1, 0.5]],
    ];
    const faces = quads.map((q, i) => {
      const pos = Float32Array.from(q.flat());
      // orient outward
      const ax = pos[3] - pos[0],
        ay = pos[4] - pos[1],
        az = pos[5] - pos[2];
      const bx = pos[6] - pos[0],
        by = pos[7] - pos[1],
        bz = pos[8] - pos[2];
      const n = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
      const cx = (pos[0] + pos[3] + pos[6] + pos[9]) / 4 - C[0];
      const cy = (pos[1] + pos[4] + pos[7] + pos[10]) / 4 - C[1];
      const cz = (pos[2] + pos[5] + pos[8] + pos[11]) / 4 - C[2];
      const idx =
        n[0] * cx + n[1] * cy + n[2] * cz < 0
          ? new Uint32Array([0, 1, 2, 3, 4, 5].reverse())
          : new Uint32Array([0, 1, 2, 3, 4, 5]);
      return buildFace(`F${i}`, `F${i}`, "stl", pos, new Float32Array(pos.length), idx, "#888");
    });
    const props = computeComponentProperties(faces, {
      F0: "wing",
      F1: "wing",
      F2: "wing",
      F3: "wing",
      F4: "wing",
      F5: "wing",
    });
    expect(props[0].fallback).toBe(false);
    expect(props[0].volume).toBeCloseTo(1, 2);
    const { cg } = computeCG(props.map((p) => ({ ...p, density: 1, mass: p.volume })));
    expect(cg[0]).toBeCloseTo(1, 2);
    expect(cg[2]).toBeCloseTo(0.25, 2);
  });
});
