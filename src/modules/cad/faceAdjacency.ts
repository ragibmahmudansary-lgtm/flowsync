import type { CadFace } from "@/core/types";

/**
 * Build welded-vertex face adjacency filtered by ≤30° average-normal dihedral.
 * Returns Record<faceId, faceId[]> where two faces are adjacent if they share
 * at least one welded vertex AND their average normals differ by ≤30°.
 */
export function buildFaceAdjacency(
  faces: CadFace[]
): Record<string, string[]> {
  const TOL = 1e-6;
  const DIHEDRAL_COS = Math.cos((30 * Math.PI) / 180);

  // Build vertex → face mapping (welded by position)
  const vertexToFace = new Map<string, string[]>();

  for (const face of faces) {
    const seen = new Set<string>();
    for (let i = 0; i < face.position.length; i += 3) {
      const x = Math.round(face.position[i] / TOL) * TOL;
      const y = Math.round(face.position[i + 1] / TOL) * TOL;
      const z = Math.round(face.position[i + 2] / TOL) * TOL;
      const key = `${x},${y},${z}`;
      if (seen.has(key)) continue;
      seen.add(key);

      let arr = vertexToFace.get(key);
      if (!arr) {
        arr = [];
        vertexToFace.set(key, arr);
      }
      arr.push(face.id);
    }
  }

  // Build candidate pairs (faces sharing a vertex)
  const candidatePairs = new Map<string, Set<string>>();
  for (const face of faces) candidatePairs.set(face.id, new Set());

  for (const faceIds of vertexToFace.values()) {
    for (let i = 0; i < faceIds.length; i++) {
      for (let j = i + 1; j < faceIds.length; j++) {
        candidatePairs.get(faceIds[i])!.add(faceIds[j]);
        candidatePairs.get(faceIds[j])!.add(faceIds[i]);
      }
    }
  }

  // Filter by dihedral angle
  const faceMap = new Map<string, CadFace>();
  for (const f of faces) faceMap.set(f.id, f);

  const result: Record<string, string[]> = {};
  for (const face of faces) {
    const neighbors: string[] = [];
    const candidates = candidatePairs.get(face.id)!;
    for (const nbId of candidates) {
      const nb = faceMap.get(nbId)!;
      const dot =
        face.avgNormal[0] * nb.avgNormal[0] +
        face.avgNormal[1] * nb.avgNormal[1] +
        face.avgNormal[2] * nb.avgNormal[2];
      if (dot >= DIHEDRAL_COS) {
        neighbors.push(nbId);
      }
    }
    result[face.id] = neighbors;
  }

  return result;
}
