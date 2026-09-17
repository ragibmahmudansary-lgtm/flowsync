import { parseSTL } from "../modules/cad/importers/stlImporter";
import { segmentMesh } from "../modules/cad/meshSegmentation";
import { normalizeOrientation } from "../modules/cad/orientation";
import {
  buildFace,
  combineBounds,
  PALETTE,
  type RawFaceMesh,
} from "../modules/cad/faceProperties";
import { buildFaceAdjacency } from "../modules/cad/faceAdjacency";
import type { ImportedModel } from "../core/types";

interface ImportMessage {
  type: "import";
  fileName: string;
  format: string;
  buffer: ArrayBuffer;
}

const post = (m: unknown) => (self as any).postMessage(m);

self.onmessage = async (e: MessageEvent<ImportMessage>) => {
  const msg = e.data;
  try {
    post({ type: "progress", stage: `Parsing ${msg.fileName}`, pct: 10 });

    let raws: RawFaceMesh[];
    let unit = "meter";

    if (msg.format === "stl") {
      const shell = parseSTL(msg.buffer);
      post({
        type: "progress",
        stage: `Segmenting shell (${shell.index.length / 3} tris)`,
        pct: 30,
      });
      raws = segmentMesh(shell);
    } else {
      post({
        type: "progress",
        stage: "Reading CAD kernel (OCCT)",
        pct: 25,
      });
      // Dynamic import for OCCT — only loaded when needed
      const { importOcct } = await import(
        "../modules/cad/importers/occtImporter"
      );
      const r = await importOcct(
        msg.buffer,
        msg.format as "step" | "iges" | "brep"
      );
      raws = r.rawFaces;
      unit = r.unit;
    }

    post({ type: "progress", stage: "Normalizing orientation", pct: 55 });
    const orientation = normalizeOrientation(raws);

    post({ type: "progress", stage: "Building face database", pct: 70 });
    const faces = raws.map((raw, i) =>
      buildFace(
        `Face_${String(i + 1).padStart(3, "0")}`,
        raw.name || `Face_${i + 1}`,
        msg.format,
        raw.position,
        raw.normal,
        raw.index,
        PALETTE[i % PALETTE.length]
      )
    );

    post({ type: "progress", stage: "Computing adjacency", pct: 85 });
    const adjacency = buildFaceAdjacency(faces);
    const bbox = combineBounds(faces);

    const model: ImportedModel = {
      fileName: msg.fileName,
      format: msg.format,
      unit,
      faces,
      adjacency,
      bbox,
      triangleCount: faces.reduce((s, f) => s + f.index.length / 3, 0),
      vertexCount: faces.reduce((s, f) => s + f.position.length / 3, 0),
      orientationNote: orientation.detail,
      importedAt: new Date().toISOString(),
    };

    post({ type: "progress", stage: "Complete", pct: 100 });
    post({ type: "result", model });
  } catch (err) {
    post({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
