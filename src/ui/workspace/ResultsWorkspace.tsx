import { useSolverStore } from "@/state/useSolverStore";
import { useRecognitionStore } from "@/state/useRecognitionStore";
import { LineChart } from "@/ui/charts/LineChart";
import { StabilityBox } from "@/ui/panels/StabilityBox";

export function ResultsWorkspace() {
  const results = useSolverStore((s) => s.results);
  const status = useSolverStore((s) => s.status);
  const error = useSolverStore((s) => s.error);
  const panelsCount = useSolverStore((s) => s.panels?.length ?? 0);
  const ar = useRecognitionStore((s) => s.result?.wing?.aspectRatio ?? 0);

  if (status === "error" && error)
    return (
      <div className="h-full p-6">
        <div className="rounded border border-red-400 bg-red-50 p-4 text-sm text-red-700">
          Solver error: {error}
        </div>
      </div>
    );

  if (!results.length)
    return (
      <div className="h-full flex items-center justify-center text-sm text-[#52606D]">
        No results yet — configure Tab 3 and run the VLM analysis.
      </div>
    );

  const mid = results[Math.floor(results.length / 2)];
  const last = results[results.length - 1];
  const e = last.CDi > 0 && ar > 0 ? (last.CL * last.CL) / (Math.PI * ar * last.CDi) : 0;

  return (
    <div className="h-full w-full p-4 space-y-4 overflow-auto">
      <StabilityBox />
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <LineChart
          title="CL vs α"
          xLabel="α (deg)"
          yLabel="CL"
          series={[
            {
              name: "CL",
              color: "#4F86C6",
              points: results.map((r) => ({ x: r.alphaDeg, y: r.CL })),
            },
          ]}
        />
        <LineChart
          title="Drag breakdown vs α"
          xLabel="α (deg)"
          yLabel="CD"
          series={[
            {
              name: "CDi",
              color: "#C98A4B",
              points: results.map((r) => ({ x: r.alphaDeg, y: r.CDi })),
            },
            {
              name: "CD0",
              color: "#7A8B99",
              points: results.map((r) => ({ x: r.alphaDeg, y: r.CD0 })),
            },
            {
              name: "CD",
              color: "#E11D48",
              points: results.map((r) => ({ x: r.alphaDeg, y: r.CD })),
            },
          ]}
        />
        <LineChart
          title="Cm vs α (¼-MAC)"
          xLabel="α (deg)"
          yLabel="Cm"
          series={[
            {
              name: "Cm",
              color: "#8E7CC3",
              points: results.map((r) => ({ x: r.alphaDeg, y: r.Cm })),
            },
          ]}
        />
        <LineChart
          title="Drag polar CL vs CD"
          xLabel="CD"
          yLabel="CL"
          series={[
            {
              name: "polar",
              color: "#5FA777",
              points: results.map((r) => ({ x: r.CD, y: r.CL })),
            },
          ]}
        />
        <LineChart
          title={`Spanwise Γ (α=${mid.alphaDeg.toFixed(1)}°)`}
          xLabel="y (m)"
          yLabel="Γ"
          series={[
            {
              name: "Γ",
              color: "#5BA3A3",
              points: mid.spanwise.map((p) => ({ x: p.y, y: p.gamma })),
            },
          ]}
        />
        <LineChart
          title={`Sectional cl (α=${mid.alphaDeg.toFixed(1)}°)`}
          xLabel="y (m)"
          yLabel="cl"
          series={[
            {
              name: "cl",
              color: "#7A8B99",
              points: mid.spanwise.map((p) => ({ x: p.y, y: p.clLocal })),
            },
          ]}
        />
      </div>
      <div className="bg-white border border-[#C3CDD8] rounded p-3 text-xs font-mono text-[#52606D]">
        Cases: {results.length} | Panels: {panelsCount} | e (last): {e.toFixed(3)} | CL range:{" "}
        {results[0].CL.toFixed(3)} → {last.CL.toFixed(3)} | Report generator arrives Phase 4
      </div>
    </div>
  );
}
