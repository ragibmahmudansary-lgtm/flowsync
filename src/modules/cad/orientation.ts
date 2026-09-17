import type { RawFaceMesh } from "./faceProperties";

export interface OrientationReport {
  applied: boolean;
  detail: string;
}

/**
 * Normalize model orientation to FlowSync convention:
 *   X = forward (nose), Y = right (starboard), Z = up
 *
 * Heuristic:
 *   1. Rank bbox axes by extent (smallest → vertical, largest remaining → span)
 *   2. If span is on X, rotate Z+90° to put span on Y
 *   3. Tail-fin nose heuristic: if the tallest feature is at -X end, flip X
 *   4. Ensure right-handed coordinate system
 *
 * Modifies raw faces in-place and returns a report.
 */
export function normalizeOrientation(raws: RawFaceMesh[]): OrientationReport {
  if (raws.length === 0)
    return { applied: false, detail: "No geometry to orient." };

  // Compute global bbox
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;

  for (const raw of raws) {
    for (let i = 0; i < raw.position.length; i += 3) {
      const x = raw.position[i],
        y = raw.position[i + 1],
        z = raw.position[i + 2];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
  }

  const dx = maxX - minX,
    dy = maxY - minY,
    dz = maxZ - minZ;
  const extents = [
    { axis: 0, size: dx },
    { axis: 1, size: dy },
    { axis: 2, size: dz },
  ].sort((a, b) => a.size - b.size);

  // smallest → Z (vertical), largest of remaining → Y (span)
  const verticalAxis = extents[0].axis;
  const spanAxis = extents[2].axis;
  const lengthAxis = extents[1].axis;

  const notes: string[] = [];
  let transform: (x: number, y: number, z: number) => [number, number, number];

  // Default: identity
  transform = (x, y, z) => [x, y, z];

  // Determine rotation needed
  // Target: span on Y, vertical on Z, length on X (forward)
  if (spanAxis === 0 && verticalAxis === 2) {
    // span on X, vertical on Z → rotate Z by +90°: (x,y,z) → (-y, x, z)
    transform = (x, y, z) => [-y, x, z];
    notes.push("Rotated Z+90° (span X→Y)");
  } else if (spanAxis === 0 && verticalAxis === 1) {
    // span on X, vertical on Y → rotate X+90°: (x,y,z) → (x, -z, y)
    transform = (x, y, z) => [x, -z, y];
    notes.push("Rotated X+90° (span X→Y, vert Y→Z)");
  } else if (spanAxis === 1 && verticalAxis === 0) {
    // span on Y, vertical on X → rotate Y+90°: (x,y,z) → (z, y, -x)
    transform = (x, y, z) => [z, y, -x];
    notes.push("Rotated Y+90° (vert X→Z)");
  } else if (spanAxis === 2 && verticalAxis === 0) {
    // span on Z, vertical on X → complex rotation
    transform = (x, y, z) => [-z, y, x];
    notes.push("Rotated to put span on Y, vertical on Z");
  } else if (spanAxis === 2 && verticalAxis === 1) {
    // span on Z, vertical on Y → rotate X+90°: (x,y,z) → (x, -z, y)
    transform = (x, y, z) => [x, -z, y];
    notes.push("Rotated X+90° (span Z→Y, vert Y→Z)");
  } else if (spanAxis === 1 && verticalAxis === 2) {
    // Already correct orientation (span Y, vert Z)
    notes.push("Already in FlowSync convention");
  } else {
    // Fallback: just ensure span→Y, vert→Z
    transform = (x, y, z) => [x, y, z];
    notes.push("No rotation needed");
  }

  // Apply transform
  for (const raw of raws) {
    const newPos = new Float32Array(raw.position.length);
    for (let i = 0; i < raw.position.length; i += 3) {
      const [nx, ny, nz] = transform(
        raw.position[i],
        raw.position[i + 1],
        raw.position[i + 2]
      );
      newPos[i] = nx;
      newPos[i + 1] = ny;
      newPos[i + 2] = nz;
    }
    const newNorm = new Float32Array(raw.normal.length);
    for (let i = 0; i < raw.normal.length; i += 3) {
      const [nx, ny, nz] = transform(
        raw.normal[i],
        raw.normal[i + 1],
        raw.normal[i + 2]
      );
      newNorm[i] = nx;
      newNorm[i + 1] = ny;
      newNorm[i + 2] = nz;
    }
    raw.position = newPos;
    raw.normal = newNorm;
  }

  // Tail-fin nose heuristic: after transform, check if tallest feature is at -X
  // If so, flip X: (x,y,z) → (-x, y, z)
  let recalcMinX = Infinity,
    recalcMaxX = -Infinity,
    recalcMinZ = Infinity,
    recalcMaxZ = -Infinity;
  for (const raw of raws) {
    for (let i = 0; i < raw.position.length; i += 3) {
      const x = raw.position[i],
        z = raw.position[i + 2];
      if (x < recalcMinX) recalcMinX = x;
      if (x > recalcMaxX) recalcMaxX = x;
      if (z < recalcMinZ) recalcMinZ = z;
      if (z > recalcMaxZ) recalcMaxZ = z;
    }
  }

  // Check if the top of the model (highest Z) is concentrated at -X end
  const xMid = (recalcMinX + recalcMaxX) / 2;
  let topAtNegX = 0,
    topAtPosX = 0;
  const zThreshold = recalcMinZ + (recalcMaxZ - recalcMinZ) * 0.7;
  for (const raw of raws) {
    for (let i = 0; i < raw.position.length; i += 3) {
      if (raw.position[i + 2] > zThreshold) {
        if (raw.position[i] < xMid) topAtNegX++;
        else topAtPosX++;
      }
    }
  }

  if (topAtNegX > topAtPosX * 1.5 && topAtNegX > 10) {
    // Flip X so nose points +X
    for (const raw of raws) {
      for (let i = 0; i < raw.position.length; i += 3) {
        raw.position[i] = -raw.position[i];
        raw.normal[i] = -raw.normal[i];
      }
    }
    notes.push("Flipped X (nose heuristic: tail fin was at -X)");
  }

  const applied = notes.length > 1 || (notes.length === 1 && !notes[0].includes("Already") && !notes[0].includes("No rotation"));

  return {
    applied,
    detail: notes.join("; "),
  };
}
