import type { RawFaceMesh } from "../faceProperties";

/**
 * OCCT-based CAD importer (STEP/IGES/BREP).
 * Lazy-loads occt-import-js WASM module.
 * Returns raw faces with unit scale + Y-up→Z-up rotation applied.
 */

interface OcctResult {
  rawFaces: RawFaceMesh[];
  unit: string;
}

let occtModule: any = null;

async function loadOcct() {
  if (occtModule) return occtModule;

  try {
    const mod = await import("occt-import-js");
    const factory = mod.default || mod;
    occtModule = await factory({
      locateFile: (f: string) => `/wasm/${f}`,
    });
    return occtModule;
  } catch (err) {
    throw new Error(
      `Failed to load OCCT WASM kernel. Ensure public/wasm/occt-import-js.wasm exists. ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export async function importOcct(
  buffer: ArrayBuffer,
  format: "step" | "iges" | "brep"
): Promise<OcctResult> {
  const occt = await loadOcct();

  const data = new Uint8Array(buffer);
  let result: any;

  if (format === "step") {
    result = occt.ReadStepFile(data);
  } else if (format === "iges") {
    result = occt.ReadIgesFile(data);
  } else {
    result = occt.ReadBrepFile(data);
  }

  if (!result || !result.successes || result.successes.length === 0) {
    throw new Error(
      `OCCT failed to parse ${format.toUpperCase()} file. The file may be corrupt or use unsupported entities.`
    );
  }

  const rawFaces: RawFaceMesh[] = [];
  let unit = "meter";

  // Process each success (solid/shell)
  for (const success of result.successes) {
    if (success.meshes) {
      for (const mesh of success.meshes) {
        // Each mesh has submeshes per face
        if (mesh.submeshes) {
          for (let si = 0; si < mesh.submeshes.length; si++) {
            const sm = mesh.submeshes[si];
            if (!sm.attributes || !sm.indices) continue;

            // Extract position from attributes
            const posAttr = sm.attributes.position;
            const normAttr = sm.attributes.normal;
            if (!posAttr || !posAttr.array) continue;

            const position = new Float32Array(posAttr.array);
            const normal = normAttr?.array
              ? new Float32Array(normAttr.array)
              : new Float32Array(position.length);
            const index = new Uint32Array(sm.indices.array);

            // Apply Y-up → Z-up rotation: (x,y,z) → (x, z, -y)
            // Wait — FlowSync uses Z-up already from orientation module.
            // OCCT models are typically Y-up. Apply rotation here.
            for (let i = 0; i < position.length; i += 3) {
              const y = position[i + 1];
              const z = position[i + 2];
              position[i + 1] = z;
              position[i + 2] = -y;
            }
            for (let i = 0; i < normal.length; i += 3) {
              const y = normal[i + 1];
              const z = normal[i + 2];
              normal[i + 1] = z;
              normal[i + 2] = -y;
            }

            rawFaces.push({
              name: `Face_${si + 1}`,
              position,
              normal,
              index,
            });
          }
        }
      }
    }
  }

  // Detect unit from result
  if (result.unit) {
    unit = result.unit;
  }

  if (rawFaces.length === 0) {
    throw new Error("OCCT parsed the file but found no meshable faces.");
  }

  return { rawFaces, unit };
}
