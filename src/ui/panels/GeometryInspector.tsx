import { useGeometryStore } from "@/state/useGeometryStore";

export function GeometryInspector() {
  const model = useGeometryStore((s) => s.model);
  const importStatus = useGeometryStore((s) => s.importStatus);
  const importError = useGeometryStore((s) => s.importError);
  const selectedFaceIds = useGeometryStore((s) => s.selectedFaceIds);
  const applyRotation = useGeometryStore((s) => s.applyRotation);

  if (!model && importStatus === "idle") {
    return (
      <div className="p-3 text-xs text-[#52606D] space-y-3">
        <div className="p-2 rounded bg-[#EEF2F6] border border-[#C3CDD8]">
          <div className="font-medium text-[#0F172A] mb-1">Import Status</div>
          <div className="text-[10px]">Idle — import a CAD file to begin.</div>
        </div>
      </div>
    );
  }

  if (importStatus === "loading") {
    return (
      <div className="p-3 text-xs text-[#52606D] space-y-3">
        <div className="p-2 rounded bg-amber-50 border border-amber-200">
          <div className="font-medium text-amber-800 mb-1">⏳ Importing…</div>
          <div className="text-[10px]">Processing in background worker.</div>
        </div>
      </div>
    );
  }

  if (importStatus === "error") {
    return (
      <div className="p-3 text-xs text-[#52606D] space-y-3">
        <div className="p-2 rounded bg-red-50 border border-red-200">
          <div className="font-medium text-red-800 mb-1">❌ Import Error</div>
          <div className="text-[10px] text-red-700">{importError}</div>
        </div>
      </div>
    );
  }

  if (!model) return null;

  const totalArea = model.faces.reduce((s, f) => s + f.area, 0);
  const selectedFaces = model.faces.filter((f) =>
    selectedFaceIds.includes(f.id)
  );
  const selectedArea = selectedFaces.reduce((s, f) => s + f.area, 0);

  const bboxDx = (model.bbox.max[0] - model.bbox.min[0]).toFixed(3);
  const bboxDy = (model.bbox.max[1] - model.bbox.min[1]).toFixed(3);
  const bboxDz = (model.bbox.max[2] - model.bbox.min[2]).toFixed(3);

  return (
    <div className="flex-1 overflow-auto p-3 text-xs space-y-3">
      {/* Model stats */}
      <div className="p-2 rounded bg-[#EEF2F6] border border-[#C3CDD8]">
        <div className="font-medium text-[#0F172A] mb-2">📐 Model</div>
        <div className="grid grid-cols-2 gap-1 text-[10px]">
          <span className="text-[#52606D]">File:</span>
          <span className="text-[#0F172A] truncate">{model.fileName}</span>
          <span className="text-[#52606D]">Format:</span>
          <span className="text-[#0F172A] uppercase">{model.format}</span>
          <span className="text-[#52606D]">Unit:</span>
          <span className="text-[#0F172A]">{model.unit}</span>
          <span className="text-[#52606D]">Faces:</span>
          <span className="text-[#0F172A]">{model.faces.length}</span>
          <span className="text-[#52606D]">Triangles:</span>
          <span className="text-[#0F172A]">
            {model.triangleCount.toLocaleString()}
          </span>
          <span className="text-[#52606D]">Vertices:</span>
          <span className="text-[#0F172A]">
            {model.vertexCount.toLocaleString()}
          </span>
          <span className="text-[#52606D]">Total area:</span>
          <span className="text-[#0F172A]">{totalArea.toFixed(2)}</span>
          <span className="text-[#52606D]">BBox (X×Y×Z):</span>
          <span className="text-[#0F172A]">
            {bboxDx} × {bboxDy} × {bboxDz}
          </span>
        </div>
        {model.orientationNote && (
          <div className="mt-2 text-[10px] text-[#52606D] border-t border-[#C3CDD8] pt-1">
            <span className="font-medium">Orientation:</span>{" "}
            {model.orientationNote}
          </div>
        )}
      </div>

      {/* Orientation override */}
      <div className="p-2 rounded bg-[#EEF2F6] border border-[#C3CDD8]">
        <div className="font-medium text-[#0F172A] mb-2">🔄 Orientation Override</div>
        <div className="flex gap-1">
          <button
            className="flex-1 text-[10px] px-1.5 py-1 rounded border border-[#C3CDD8] bg-white hover:border-[#FF6600] hover:text-[#C2410C]"
            onClick={() => applyRotation("rotZ90")}
          >
            Rot Z 90°
          </button>
          <button
            className="flex-1 text-[10px] px-1.5 py-1 rounded border border-[#C3CDD8] bg-white hover:border-[#FF6600] hover:text-[#C2410C]"
            onClick={() => applyRotation("flipX")}
          >
            Flip X
          </button>
          <button
            className="flex-1 text-[10px] px-1.5 py-1 rounded border border-[#C3CDD8] bg-white hover:border-[#FF6600] hover:text-[#C2410C]"
            onClick={() => applyRotation("flipZ")}
          >
            Flip Z
          </button>
        </div>
      </div>

      {/* Selection info */}
      <div className="p-2 rounded bg-[#EEF2F6] border border-[#C3CDD8]">
        <div className="font-medium text-[#0F172A] mb-2">
          🎯 Selection ({selectedFaceIds.length})
        </div>
        {selectedFaceIds.length === 0 ? (
          <div className="text-[10px] text-[#52606D]">
            No faces selected. Click a face in the viewport or tree.
          </div>
        ) : (
          <>
            <div className="text-[10px] text-[#52606D] mb-1">
              Total selected area: {selectedArea.toFixed(3)}
            </div>
            <div className="space-y-1 max-h-32 overflow-auto">
              {selectedFaces.slice(0, 6).map((f) => (
                <div
                  key={f.id}
                  className="text-[10px] p-1 rounded bg-white border border-[#C3CDD8]"
                >
                  <div className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-sm"
                      style={{ backgroundColor: f.baseColor }}
                    />
                    <span className="font-medium">{f.name}</span>
                    <span className="ml-auto text-[#52606D]">
                      A={f.area.toFixed(3)}
                    </span>
                  </div>
                  <div className="text-[9px] text-[#52606D] mt-0.5">
                    C=({f.centroid[0].toFixed(2)}, {f.centroid[1].toFixed(2)},{" "}
                    {f.centroid[2].toFixed(2)})
                  </div>
                </div>
              ))}
              {selectedFaces.length > 6 && (
                <div className="text-[9px] text-[#52606D] italic">
                  … and {selectedFaces.length - 6} more
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Selection help */}
      <div className="text-[10px] text-[#52606D] italic">
        Click = select · Ctrl+Click = toggle · Ctrl+Shift+Click = flood · Box
        mode = marquee
      </div>
    </div>
  );
}
