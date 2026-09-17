import { describe, expect, it } from "vitest";
import { buildFace, combineBounds } from "@/modules/cad/faceProperties";
import { segmentMesh } from "@/modules/cad/meshSegmentation";
import { normalizeOrientation } from "@/modules/cad/orientation";
import { buildFaceAdjacency } from "@/modules/cad/faceAdjacency";
import { parseSTL } from "@/modules/cad/importers/stlImporter";

function quad(
  ax: number[],
  bx: number[],
  cx: number[],
  dx: number[]
): { position: Float32Array; normal: Float32Array; index: Uint32Array } {
  const position = Float32Array.from([...ax, ...bx, ...cx, ...ax, ...cx, ...dx]);
  const normal = new Float32Array(position.length);
  const index = new Uint32Array([0, 1, 2, 3, 4, 5]);
  return { position, normal, index };
}

describe("face-properties", () => {
  it("unit square area and centroid", () => {
    const q = quad([0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]);
    const f = buildFace("F1", "q", "stl", q.position, q.normal, q.index, "#888");
    expect(f.area).toBeCloseTo(1, 5);
    expect(f.centroid[0]).toBeCloseTo(0.5, 5);
    expect(f.centroid[1]).toBeCloseTo(0.5, 5);
    expect(f.centroid[2]).toBeCloseTo(0, 5);
  });

  it("computes flat normals when input normals are zero", () => {
    const q = quad([0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]);
    const f = buildFace("F1", "q", "stl", q.position, q.normal, q.index, "#888");
    // Normal should be [0, 0, 1] for a flat XY quad
    expect(f.avgNormal[2]).toBeCloseTo(1, 1);
  });

  it("combineBounds covers all faces", () => {
    const q1 = quad([0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]);
    const q2 = quad([2, 2, 2], [3, 2, 2], [3, 3, 2], [2, 3, 2]);
    const f1 = buildFace("F1", "q1", "stl", q1.position, q1.normal, q1.index, "#888");
    const f2 = buildFace("F2", "q2", "stl", q2.position, q2.normal, q2.index, "#888");
    const bbox = combineBounds([f1, f2]);
    expect(bbox.min[0]).toBe(0);
    expect(bbox.max[0]).toBe(3);
    expect(bbox.min[2]).toBe(0);
    expect(bbox.max[2]).toBe(2);
  });
});

describe("segmentation", () => {
  it("splits perpendicular quads into two regions", () => {
    const ground = quad([-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1]);
    const fin = quad([-1, 0, 0], [1, 0, 0], [1, 0, 2], [-1, 0, 2]);
    const merged = {
      name: "shell",
      position: Float32Array.from([...ground.position, ...fin.position]),
      normal: new Float32Array(24),
      index: new Uint32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
    };
    const regions = segmentMesh(merged);
    expect(regions.length).toBe(2);
  });

  it("single flat quad stays as one region", () => {
    const q = quad([0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]);
    const shell = {
      name: "flat",
      position: q.position,
      normal: q.normal,
      index: q.index,
    };
    const regions = segmentMesh(shell);
    expect(regions.length).toBe(1);
  });
});

describe("orientation", () => {
  it("reports no geometry for empty input", () => {
    const rep = normalizeOrientation([]);
    expect(rep.applied).toBe(false);
  });

  it("applies transform to raw faces", () => {
    // Create a simple box-like shape: span 10 along X, length 7 along Y, height 2.8
    const position: number[] = [];
    const push = (x: number, y: number, z: number) => position.push(x, y, z);
    // Bottom face (XY plane)
    push(-5, -3, 0);
    push(5, -3, 0);
    push(5, 3, 0);
    push(-5, 3, 0);
    push(-5, -3, 0);
    push(5, 3, 0);
    // Fin at -Y end (taller)
    push(-5, -3, 0);
    push(5, -3, 0);
    push(5, -3.4, 1.0);
    push(-5, -3.4, 1.0);
    push(-5, -3, 0);
    push(5, -3.4, 1.0);

    const raw = {
      name: "box",
      position: Float32Array.from(position),
      normal: new Float32Array(position.length),
      index: new Uint32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
    };
    const rep = normalizeOrientation([raw]);
    // Should have applied some transform
    expect(typeof rep.detail).toBe("string");
    expect(rep.detail.length).toBeGreaterThan(0);
  });
});

describe("adjacency", () => {
  it("connects faces sharing welded vertices within dihedral threshold", () => {
    // Two coplanar quads sharing an edge
    const q1 = quad([0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]);
    const q2 = quad([1, 0, 0], [2, 0, 0], [2, 1, 0], [1, 1, 0]);
    const f1 = buildFace("F1", "q1", "stl", q1.position, q1.normal, q1.index, "#888");
    const f2 = buildFace("F2", "q2", "stl", q2.position, q2.normal, q2.index, "#888");
    const adj = buildFaceAdjacency([f1, f2]);
    expect(adj["F1"]).toContain("F2");
    expect(adj["F2"]).toContain("F1");
  });

  it("does not connect faces with large dihedral angle", () => {
    // Two perpendicular quads sharing a vertex but not an edge
    const q1 = quad([0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]); // XY plane
    const q2 = quad([1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]); // YZ plane at x=1
    const f1 = buildFace("F1", "q1", "stl", q1.position, q1.normal, q1.index, "#888");
    const f2 = buildFace("F2", "q2", "stl", q2.position, q2.normal, q2.index, "#888");
    const adj = buildFaceAdjacency([f1, f2]);
    // They share vertices but normals are 90° apart → should NOT be adjacent
    expect(adj["F1"]).not.toContain("F2");
  });
});

describe("STL parser", () => {
  it("parses ASCII STL", () => {
    const ascii = `solid test
  facet normal 0 0 1
    outer loop
      vertex 0 0 0
      vertex 1 0 0
      vertex 0 1 0
    endloop
  endfacet
endsolid test`;
    const buffer = new TextEncoder().encode(ascii).buffer;
    const result = parseSTL(buffer);
    expect(result.position.length).toBe(9); // 3 vertices × 3 coords
    expect(result.index.length).toBe(3); // 1 triangle
  });

  it("throws on empty STL", () => {
    const buffer = new TextEncoder().encode("solid empty\nendsolid empty").buffer;
    expect(() => parseSTL(buffer)).toThrow("no triangles");
  });
});
