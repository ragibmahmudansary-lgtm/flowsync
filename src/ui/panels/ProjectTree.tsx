import { useState } from "react";
import { useGeometryStore } from "@/state/useGeometryStore";
import { useRecognitionStore } from "@/state/useRecognitionStore";
import type { ComponentType } from "@/core/types";

const COMPONENT_LABELS: Record<ComponentType, string> = {
  wing: "Wing",
  htail: "H. Tail",
  vtail: "V. Tail",
  fuselage: "Fuselage",
  unassigned: "Unassigned",
};

const COMPONENT_ICONS: Record<ComponentType, string> = {
  wing: "✈️",
  htail: "➡️",
  vtail: "🔺",
  fuselage: "📦",
  unassigned: "❓",
};

export function ProjectTree() {
  const model = useGeometryStore((s) => s.model);
  const selectedFaceIds = useGeometryStore((s) => s.selectedFaceIds);
  const namedSelections = useGeometryStore((s) => s.namedSelections);
  const selectOnly = useGeometryStore((s) => s.selectOnly);
  const createNamedSelection = useGeometryStore((s) => s.createNamedSelection);
  const assignSelectedFaces = useGeometryStore((s) => s.assignSelectedFaces);
  const deleteNamedSelection = useGeometryStore((s) => s.deleteNamedSelection);
  const [newNsName, setNewNsName] = useState("");
  const [expanded, setExpanded] = useState(true);
  const [componentsExpanded, setComponentsExpanded] = useState(true);
  const recResult = useRecognitionStore((s) => s.result);
  const setSelectedFaces = useGeometryStore((s) => s.setSelectedFaces);

  if (!model) {
    return (
      <div className="p-3 text-xs text-[#52606D]">
        <div className="mb-3 p-2 rounded bg-[#EEF2F6] border border-[#C3CDD8]">
          <div className="font-medium text-[#0F172A] mb-1">📐 Geometry</div>
          <div className="text-[10px]">No model imported yet</div>
        </div>
        <div className="mb-3 p-2 rounded bg-[#EEF2F6] border border-[#C3CDD8]">
          <div className="font-medium text-[#0F172A] mb-1">🔍 Recognition</div>
          <div className="text-[10px]">Awaiting geometry import</div>
        </div>
        <div className="mb-3 p-2 rounded bg-[#EEF2F6] border border-[#C3CDD8]">
          <div className="font-medium text-[#0F172A] mb-1">📊 VLM Setup</div>
          <div className="text-[10px]">Configure in Phase 2</div>
        </div>
        <div className="p-2 rounded bg-[#EEF2F6] border border-[#C3CDD8]">
          <div className="font-medium text-[#0F172A] mb-1">📈 Results</div>
          <div className="text-[10px]">Available after Phase 3 analysis</div>
        </div>
      </div>
    );
  }

  const displayFaces = model.faces.slice(0, 150);
  const hasMore = model.faces.length > 150;

  return (
    <div className="flex-1 overflow-auto p-2 text-xs">
      {/* Model node */}
      <div className="mb-2">
        <button
          className="w-full text-left px-2 py-1 rounded hover:bg-[#EEF2F6] flex items-center gap-1"
          onClick={() => setExpanded(!expanded)}
        >
          <span className="text-[10px]">{expanded ? "▼" : "▶"}</span>
          <span className="font-medium text-[#0F172A]">
            📐 {model.fileName}
          </span>
          <span className="ml-auto text-[10px] text-[#52606D]">
            {model.faces.length} faces
          </span>
        </button>

        {expanded && (
          <div className="ml-4 mt-1 space-y-0.5 max-h-48 overflow-auto">
            {displayFaces.map((face) => (
              <button
                key={face.id}
                className={`w-full text-left px-2 py-0.5 rounded text-[11px] flex items-center gap-1 ${
                  selectedFaceIds.includes(face.id)
                    ? "bg-[#FF6600]/15 text-[#C2410C]"
                    : "hover:bg-[#EEF2F6] text-[#52606D]"
                }`}
                onClick={() => selectOnly(face.id)}
              >
                <span
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{ backgroundColor: face.baseColor }}
                />
                <span className="truncate">{face.name}</span>
                <span className="ml-auto text-[9px] text-[#52606D]">
                  {face.area.toFixed(2)}
                </span>
              </button>
            ))}
            {hasMore && (
              <div className="text-[10px] text-[#52606D] px-2 py-1 italic">
                … and {model.faces.length - 150} more faces
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recognized Components */}
      {recResult && (
        <div className="mb-2">
          <button
            className="w-full text-left px-2 py-1 rounded hover:bg-[#EEF2F6] flex items-center gap-1"
            onClick={() => setComponentsExpanded(!componentsExpanded)}
          >
            <span className="text-[10px]">{componentsExpanded ? "▼" : "▶"}</span>
            <span className="font-medium text-[#0F172A]">
              🔍 Recognized Components
            </span>
            <span
              className={`ml-auto text-[9px] px-1 rounded ${
                recResult.status === "confirmed"
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {recResult.status === "confirmed" ? "LOCKED" : "PROPOSED"}
            </span>
          </button>

          {componentsExpanded && (
            <div className="ml-4 mt-1 space-y-0.5">
              {(["wing", "htail", "vtail", "fuselage", "unassigned"] as ComponentType[]).map(
                (comp) => {
                  const faceIds = model.faces
                    .filter((f) => recResult.componentByFaceId[f.id] === comp)
                    .map((f) => f.id);
                  if (faceIds.length === 0) return null;
                  return (
                    <button
                      key={comp}
                      className="w-full text-left px-2 py-0.5 rounded text-[11px] flex items-center gap-1 hover:bg-[#EEF2F6]"
                      onClick={() => setSelectedFaces(faceIds)}
                    >
                      <span>{COMPONENT_ICONS[comp]}</span>
                      <span className="font-medium">{COMPONENT_LABELS[comp]}</span>
                      <span className="ml-auto text-[9px] text-[#52606D]">
                        {faceIds.length}
                      </span>
                    </button>
                  );
                }
              )}
            </div>
          )}
        </div>
      )}

      {/* Named selections */}
      <div className="mt-3 border-t border-[#C3CDD8] pt-2">
        <div className="text-[10px] uppercase tracking-widest text-[#52606D] mb-2 px-1">
          Named Selections
        </div>

        {namedSelections.length === 0 && (
          <div className="text-[10px] text-[#52606D] px-1 mb-2">
            No named selections yet.
          </div>
        )}

        {namedSelections.map((ns) => (
          <div
            key={ns.id}
            className="mb-1.5 p-1.5 rounded border border-[#C3CDD8] bg-[#EEF2F6]"
          >
            <div className="flex items-center gap-1">
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: ns.color ?? "#FF6600" }}
              />
              <span className="font-medium text-[#0F172A] text-[11px]">
                {ns.name}
              </span>
              <span className="ml-auto text-[9px] text-[#52606D]">
                {ns.faceIds.length} faces
              </span>
              <button
                className="text-[9px] text-red-500 hover:text-red-700 ml-1"
                onClick={() => deleteNamedSelection(ns.id)}
                title="Delete"
              >
                ✕
              </button>
            </div>
            {selectedFaceIds.length > 0 && (
              <button
                className="mt-1 w-full text-[10px] px-1.5 py-0.5 rounded bg-white border border-[#C3CDD8] hover:border-[#FF6600] hover:text-[#C2410C]"
                onClick={() => assignSelectedFaces(ns.id)}
              >
                Assign Selected ({selectedFaceIds.length})
              </button>
            )}
          </div>
        ))}

        {/* Create new */}
        <div className="flex gap-1 mt-2">
          <input
            type="text"
            className="flex-1 text-[11px] px-1.5 py-0.5 rounded border border-[#C3CDD8] bg-white focus:outline-none focus:border-[#FF6600]"
            placeholder="Name…"
            value={newNsName}
            onChange={(e) => setNewNsName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newNsName.trim()) {
                createNamedSelection(newNsName.trim());
                setNewNsName("");
              }
            }}
          />
          <button
            className="text-[10px] px-2 py-0.5 rounded border border-[#C3CDD8] bg-white hover:border-[#FF6600] hover:text-[#C2410C]"
            onClick={() => {
              if (newNsName.trim()) {
                createNamedSelection(newNsName.trim());
                setNewNsName("");
              }
            }}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
