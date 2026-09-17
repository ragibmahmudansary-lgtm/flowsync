import { useRecognitionStore } from "@/state/useRecognitionStore";
import { useGeometryStore } from "@/state/useGeometryStore";
import type { ComponentType } from "@/core/types";

const COMPONENT_LABELS: Record<ComponentType, string> = {
  wing: "Wing",
  htail: "Horizontal Tail",
  vtail: "Vertical Tail",
  fuselage: "Fuselage",
  unassigned: "Unassigned",
};

const COMPONENT_COLORS: Record<ComponentType, string> = {
  wing: "#4F86C6",
  htail: "#5FA777",
  vtail: "#8E7CC3",
  fuselage: "#9AAAB9",
  unassigned: "#B7C1CC",
};

export function RecognitionInspector() {
  const result = useRecognitionStore((s) => s.result);
  const runAutoRecognition = useRecognitionStore((s) => s.runAutoRecognition);
  const assignSelectedFaces = useRecognitionStore((s) => s.assignSelectedFaces);
  const clearComponent = useRecognitionStore((s) => s.clearComponent);
  const confirmRecognition = useRecognitionStore((s) => s.confirmRecognition);
  const resetRecognition = useRecognitionStore((s) => s.resetRecognition);
  const selectedCount = useGeometryStore((s) => s.selectedFaceIds.length);
  const model = useGeometryStore((s) => s.model);

  if (!result) {
    return (
      <div className="p-3 text-xs space-y-3">
        <div className="p-2 rounded bg-[#EEF2F6] border border-[#C3CDD8]">
          <div className="font-medium text-[#0F172A] mb-2">
            🔍 Aircraft Recognition
          </div>
          <div className="text-[10px] text-[#52606D] mb-3">
            Automatically classify faces into Wing, Horizontal Tail, Vertical
            Tail, and Fuselage based on geometry heuristics.
          </div>
          <button
            className="w-full px-3 py-1.5 rounded border border-[#C3CDD8] bg-white hover:border-[#FF6600] hover:text-[#C2410C] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={runAutoRecognition}
            disabled={!model}
          >
            Run Auto-Recognition
          </button>
          {!model && (
            <div className="mt-2 text-[10px] text-amber-700">
              Import a model first.
            </div>
          )}
        </div>
      </div>
    );
  }

  const components: ComponentType[] = [
    "wing",
    "htail",
    "vtail",
    "fuselage",
    "unassigned",
  ];
  const faceCounts = components.map((c) => ({
    type: c,
    count: Object.values(result.componentByFaceId).filter((v) => v === c)
      .length,
  }));

  return (
    <div className="flex-1 overflow-auto p-3 text-xs space-y-3">
      {/* Status */}
      <div
        className={`p-2 rounded border ${
          result.status === "confirmed"
            ? "bg-green-50 border-green-200"
            : "bg-amber-50 border-amber-200"
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              result.status === "confirmed" ? "bg-green-500" : "bg-amber-500"
            }`}
          />
          <span
            className={`font-medium ${
              result.status === "confirmed"
                ? "text-green-800"
                : "text-amber-800"
            }`}
          >
            {result.status === "confirmed" ? "CONFIRMED" : "PROPOSED"}
          </span>
          <button
            className="ml-auto text-[10px] underline text-[#52606D] hover:text-[#FF6600]"
            onClick={resetRecognition}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Component cards */}
      <div className="space-y-2">
        {faceCounts.map(({ type, count }) => (
          <div
            key={type}
            className="p-2 rounded border border-[#C3CDD8] bg-[#EEF2F6]"
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: COMPONENT_COLORS[type] }}
              />
              <span className="font-medium text-[#0F172A]">
                {COMPONENT_LABELS[type]}
              </span>
              <span className="ml-auto text-[10px] text-[#52606D]">
                {count} faces
              </span>
            </div>
            <div className="flex gap-1 mt-1">
              <button
                className="flex-1 text-[10px] px-1.5 py-0.5 rounded border border-[#C3CDD8] bg-white hover:border-[#FF6600] hover:text-[#C2410C] disabled:opacity-50"
                onClick={() => assignSelectedFaces(type)}
                disabled={selectedCount === 0}
              >
                Assign Sel. ({selectedCount})
              </button>
              <button
                className="text-[10px] px-1.5 py-0.5 rounded border border-[#C3CDD8] bg-white hover:border-red-400 hover:text-red-600"
                onClick={() => clearComponent(type)}
                disabled={count === 0}
              >
                Clear
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Wing reference geometry */}
      {result.wing && (
        <div className="p-2 rounded border border-[#C3CDD8] bg-[#EEF2F6]">
          <div className="font-medium text-[#0F172A] mb-2">
            ✈️ Wing Reference Geometry
          </div>
          <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
            <span className="text-[#52606D]">Span:</span>
            <span>{result.wing.span.toFixed(3)} m</span>
            <span className="text-[#52606D]">Area:</span>
            <span>{result.wing.area.toFixed(3)} m²</span>
            <span className="text-[#52606D]">Root chord:</span>
            <span>{result.wing.rootChord.toFixed(3)} m</span>
            <span className="text-[#52606D]">Tip chord:</span>
            <span>{result.wing.tipChord.toFixed(3)} m</span>
            <span className="text-[#52606D]">MAC:</span>
            <span>{result.wing.mac.toFixed(3)} m @ x={result.wing.macX.toFixed(2)}</span>
            <span className="text-[#52606D]">Aspect ratio:</span>
            <span>{result.wing.aspectRatio.toFixed(2)}</span>
            <span className="text-[#52606D]">Sweep ¼-chord:</span>
            <span>{result.wing.sweepQuarterChordDeg.toFixed(1)}°</span>
            <span className="text-[#52606D]">Dihedral:</span>
            <span>{result.wing.dihedralDeg.toFixed(1)}°</span>
            <span className="text-[#52606D]">Symmetric:</span>
            <span>{result.wing.symmetric ? "Yes" : "No"}</span>
          </div>
        </div>
      )}

      {/* Horizontal tail */}
      {result.htail && (
        <div className="p-2 rounded border border-[#C3CDD8] bg-[#EEF2F6]">
          <div className="font-medium text-[#0F172A] mb-1">
            ➡️ Horizontal Tail
          </div>
          <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
            <span className="text-[#52606D]">Span:</span>
            <span>{result.htail.span.toFixed(3)} m</span>
            <span className="text-[#52606D]">Area:</span>
            <span>{result.htail.area.toFixed(3)} m²</span>
            <span className="text-[#52606D]">MAC:</span>
            <span>{result.htail.mac.toFixed(3)} m</span>
            <span className="text-[#52606D]">AR:</span>
            <span>{result.htail.aspectRatio.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Vertical tail + fuselage */}
      <div className="p-2 rounded border border-[#C3CDD8] bg-[#EEF2F6]">
        <div className="font-medium text-[#0F172A] mb-1">
          📐 Other Components
        </div>
        <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
          <span className="text-[#52606D]">V-tail area:</span>
          <span>{result.vtailArea.toFixed(3)} m²</span>
          <span className="text-[#52606D]">V-tail height:</span>
          <span>{result.vtailHeight.toFixed(3)} m</span>
          <span className="text-[#52606D]">Fuselage length:</span>
          <span>{result.fuselageLength.toFixed(3)} m</span>
          <span className="text-[#52606D]">Fuselage width:</span>
          <span>{result.fuselageMaxWidth.toFixed(3)} m</span>
        </div>
      </div>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="p-2 rounded border border-amber-200 bg-amber-50">
          <div className="font-medium text-amber-800 mb-1">⚠️ Warnings</div>
          <ul className="text-[10px] text-amber-700 space-y-0.5">
            {result.warnings.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Confirm button */}
      {result.status === "proposed" && (
        <button
          className="w-full px-3 py-2 rounded border border-transparent bg-[#FF6600] text-white hover:bg-[#C2410C] text-sm font-medium"
          onClick={confirmRecognition}
        >
          ✓ Confirm & Lock Recognition
        </button>
      )}
    </div>
  );
}
