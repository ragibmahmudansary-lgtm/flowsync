import { useGeometryStore } from "@/state/useGeometryStore";

export function ImportSummaryDialog() {
  const summaryOpen = useGeometryStore((s) => s.summaryOpen);
  const closeSummary = useGeometryStore((s) => s.closeSummary);
  const model = useGeometryStore((s) => s.model);
  const importStatus = useGeometryStore((s) => s.importStatus);
  const importError = useGeometryStore((s) => s.importError);

  if (!summaryOpen) return null;

  const isError = importStatus === "error";
  const totalArea = model
    ? model.faces.reduce((s, f) => s + f.area, 0)
    : 0;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/30"
      onClick={closeSummary}
    >
      <div
        className="w-[520px] max-h-[80vh] bg-white rounded-lg shadow-2xl border border-[#C3CDD8] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#C3CDD8] flex items-center gap-2">
          <div
            className={`h-3 w-3 rounded-full ${
              isError ? "bg-red-500" : "bg-green-500"
            }`}
          />
          <h2 className="font-semibold text-sm">
            {isError ? "Import Error" : "Import Summary"}
          </h2>
          <button
            className="ml-auto text-[#52606D] hover:text-[#FF6600] text-sm"
            onClick={closeSummary}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {isError ? (
            <div className="p-3 rounded bg-red-50 border border-red-200">
              <div className="font-medium text-red-800 text-sm mb-1">
                ❌ Import Failed
              </div>
              <div className="text-xs text-red-700">{importError}</div>
              <div className="mt-2 text-[10px] text-red-600">
                Hint: Check the file format and integrity. Supported formats:
                STEP, IGES, BREP, STL.
              </div>
            </div>
          ) : model ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Row label="File" value={model.fileName} />
                <Row label="Format" value={model.format.toUpperCase()} />
                <Row label="Source Unit" value={model.unit} />
                <Row label="Faces Detected" value={String(model.faces.length)} />
                <Row
                  label="Triangles"
                  value={model.triangleCount.toLocaleString()}
                />
                <Row
                  label="Vertices"
                  value={model.vertexCount.toLocaleString()}
                />
                <Row
                  label="Bounding Box"
                  value={`${(model.bbox.max[0] - model.bbox.min[0]).toFixed(2)} × ${(model.bbox.max[1] - model.bbox.min[1]).toFixed(2)} × ${(model.bbox.max[2] - model.bbox.min[2]).toFixed(2)}`}
                />
                <Row label="Total Surface Area" value={totalArea.toFixed(2)} />
              </div>
              {model.orientationNote && (
                <div className="p-2 rounded bg-[#EEF2F6] border border-[#C3CDD8] text-xs">
                  <span className="font-medium">Orientation:</span>{" "}
                  {model.orientationNote}
                </div>
              )}
              <div className="p-2 rounded bg-blue-50 border border-blue-200 text-[10px] text-blue-800">
                💡 <strong>Tips:</strong> Click faces in the viewport to select.
                Use Ctrl+Click to toggle, Ctrl+Shift+Click to flood-select
                connected faces. Create Named Selections in the Project Tree to
                group faces for VLM assignment.
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#C3CDD8] flex justify-end">
          <button
            className="px-4 py-1.5 rounded border border-[#C3CDD8] bg-white hover:border-[#FF6600] hover:text-[#C2410C] text-sm"
            onClick={closeSummary}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-[#52606D]">{label}:</span>
      <span className="text-[#0F172A] font-medium truncate">{value}</span>
    </>
  );
}
