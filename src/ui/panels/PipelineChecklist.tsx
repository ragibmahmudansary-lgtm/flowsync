import { useGeometryStore } from "@/state/useGeometryStore";
import { useRecognitionStore } from "@/state/useRecognitionStore";
import { runCommand } from "@/commands/registry";

type RowStatus = "ok" | "warn" | "fail" | "pending";

interface ChecklistRow {
  label: string;
  status: RowStatus;
  info: string;
  action?: { label: string; command: string };
}

export function PipelineChecklist() {
  const model = useGeometryStore((s) => s.model);
  const importStatus = useGeometryStore((s) => s.importStatus);
  const recResult = useRecognitionStore((s) => s.result);

  const rows: ChecklistRow[] = [];

  // Row 1: Import
  if (!model) {
    rows.push({
      label: "Import",
      status: importStatus === "error" ? "fail" : "fail",
      info: importStatus === "loading" ? "Loading…" : "No model imported",
      action: { label: "Import", command: "cad.import" },
    });
  } else {
    rows.push({
      label: "Import",
      status: "ok",
      info: `${model.faces.length} faces · ${model.format.toUpperCase()}`,
    });
  }

  // Row 2: Orientation
  if (!model) {
    rows.push({
      label: "Orientation",
      status: "fail",
      info: "Awaiting import",
    });
  } else if (model.orientationNote?.includes("manual")) {
    rows.push({
      label: "Orientation",
      status: "warn",
      info: "Manual override applied",
      action: { label: "Flip X", command: "view.Reset" },
    });
  } else {
    rows.push({
      label: "Orientation",
      status: "ok",
      info: model.orientationNote || "Auto-normalized",
    });
  }

  // Row 3: Segmentation
  if (!model) {
    rows.push({
      label: "Segmentation",
      status: "fail",
      info: "Awaiting import",
    });
  } else if (model.faces.length < 8 || model.faces.length > 2000) {
    rows.push({
      label: "Segmentation",
      status: "warn",
      info: `${model.faces.length} faces (unusual count)`,
    });
  } else {
    rows.push({
      label: "Segmentation",
      status: "ok",
      info: `${model.faces.length} faces`,
    });
  }

  // Row 4: Recognition
  if (!recResult) {
    rows.push({
      label: "Recognition",
      status: model ? "warn" : "fail",
      info: model ? "Not run yet" : "Awaiting import",
      action: model ? { label: "Run", command: "recognition.run" } : undefined,
    });
  } else if (recResult.status === "confirmed") {
    rows.push({
      label: "Recognition",
      status: "ok",
      info: `Confirmed · wing=${recResult.wing ? "yes" : "no"}`,
    });
  } else if (recResult.wing) {
    rows.push({
      label: "Recognition",
      status: "warn",
      info: `Proposed · wing span ${recResult.wing.span.toFixed(2)} m`,
      action: { label: "Re-run", command: "recognition.run" },
    });
  } else {
    rows.push({
      label: "Recognition",
      status: "fail",
      info: "No wing detected",
      action: { label: "Re-run", command: "recognition.run" },
    });
  }

  // Row 5: Paneling (Phase 3)
  rows.push({
    label: "Paneling",
    status: "pending",
    info: "Arrives Phase 3",
  });

  // Row 6: Solver (Phase 3)
  rows.push({
    label: "Solver",
    status: "fail",
    info: "Arrives Phase 3",
  });

  const statusColor = (s: RowStatus) =>
    s === "ok"
      ? "bg-green-500"
      : s === "warn"
      ? "bg-amber-500"
      : s === "fail"
      ? "bg-red-500"
      : "bg-slate-400";

  return (
    <div className="p-3 text-xs">
      <div className="text-[10px] uppercase tracking-widest text-[#52606D] mb-2">
        Pipeline Health
      </div>
      <div className="space-y-1.5">
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex items-center gap-2 p-1.5 rounded border border-[#C3CDD8] bg-white"
          >
            <div className={`h-2 w-2 rounded-full shrink-0 ${statusColor(row.status)}`} />
            <span className="font-medium text-[#0F172A] text-[11px] w-20">
              {row.label}
            </span>
            <span className="flex-1 text-[10px] text-[#52606D] font-mono truncate">
              {row.info}
            </span>
            {row.action && (
              <button
                className="text-[10px] px-1.5 py-0.5 rounded border border-[#C3CDD8] hover:border-[#FF6600] hover:text-[#C2410C]"
                onClick={() => runCommand(row.action!.command)}
              >
                {row.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
