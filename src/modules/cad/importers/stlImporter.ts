import type { RawFaceMesh } from "../faceProperties";

const NUM = /-?\d*\.?\d+(?:[eE][-+]?\d+)?/g;

/**
 * Dependency-free binary + ASCII STL parser.
 * Returns a single RawFaceMesh with all triangles from the shell.
 */
export function parseSTL(buffer: ArrayBuffer): RawFaceMesh {
  const view = new DataView(buffer);
  const positions: number[] = [];
  const normals: number[] = [];

  let triCount = 0;
  if (buffer.byteLength >= 84) {
    const n = view.getUint32(80, true);
    if (84 + n * 50 === buffer.byteLength) triCount = n;
  }

  if (triCount > 0) {
    // Binary STL
    let off = 84;
    for (let t = 0; t < triCount; t++) {
      const nx = view.getFloat32(off, true),
        ny = view.getFloat32(off + 4, true),
        nz = view.getFloat32(off + 8, true);
      off += 12;
      for (let v = 0; v < 3; v++) {
        positions.push(
          view.getFloat32(off, true),
          view.getFloat32(off + 4, true),
          view.getFloat32(off + 8, true)
        );
        normals.push(nx, ny, nz);
        off += 12;
      }
      off += 2; // attribute byte count
    }
  } else {
    // ASCII STL
    const lines = new TextDecoder().decode(buffer).split(/\r?\n/);
    let n: [number, number, number] = [0, 0, 0];
    for (const line of lines) {
      const s = line.trim();
      if (s.startsWith("facet normal")) {
        const m = s.match(NUM);
        if (m && m.length >= 3)
          n = [Number(m[0]), Number(m[1]), Number(m[2])];
      } else if (s.startsWith("vertex")) {
        const m = s.match(NUM);
        if (m && m.length >= 3) {
          positions.push(Number(m[0]), Number(m[1]), Number(m[2]));
          normals.push(n[0], n[1], n[2]);
        }
      }
    }
  }

  if (positions.length === 0)
    throw new Error("STL file contains no triangles.");

  const index = new Uint32Array(positions.length / 3);
  for (let i = 0; i < index.length; i++) index[i] = i;

  return {
    name: "STL_Shell",
    position: Float32Array.from(positions),
    normal: Float32Array.from(normals),
    index,
  };
}
