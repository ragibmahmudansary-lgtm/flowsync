import { useSolverStore } from "@/state/useSolverStore";
import { useRecognitionStore } from "@/state/useRecognitionStore";
import { useAeroStore } from "@/state/useAeroStore";
import { analyzeStability } from "@/modules/solver/stability";

export function StabilityBox() {
  const results = useSolverStore((s) => s.results);
  const rec = useRecognitionStore((s) => s.result);
  const cgX = useAeroStore((s) => s.cgX);

  if (!results.length || !rec?.wing) {
    return (
      <div className="bg-white border border-[#C3CDD8] rounded p-4">
        <div className="text-xs text-[#52606D]">
          Run VLM analysis and compute CG to see stability assessment.
        </div>
      </div>
    );
  }

  const wing = rec.wing;
  const momentRefX = wing.macX + 0.25 * wing.mac;
  const cgXVal = cgX ?? momentRefX;

  const report = analyzeStability(results, {
    mac: wing.mac,
    macX: wing.macX,
    momentRefX,
    cgX: cgXVal,
  });

  const verdictColor =
    report.verdict === "STABLE"
      ? "bg-green-100 border-green-300 text-green-800"
      : report.verdict === "UNSTABLE"
      ? "bg-red-100 border-red-300 text-red-800"
      : report.verdict === "NEUTRAL"
      ? "bg-amber-100 border-amber-300 text-amber-800"
      : "bg-gray-100 border-gray-300 text-gray-800";

  return (
    <div className="bg-white border border-[#C3CDD8] rounded p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="text-sm font-medium text-[#0F172A]">📊 Static Stability</div>
        <div className={`px-3 py-1 rounded border text-xs font-bold ${verdictColor}`}>
          {report.verdict}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-3">
        <div className="text-[#52606D]">Static margin:</div>
        <div className={report.staticMargin > 0.05 ? "text-green-700" : report.staticMargin > 0 ? "text-amber-700" : "text-red-700"}>
          {(report.staticMargin * 100).toFixed(1)}% MAC
        </div>
        <div className="text-[#52606D]">Neutral point X:</div>
        <div>{report.neutralPointX.toFixed(3)} m</div>
        <div className="text-[#52606D]">CG X:</div>
        <div>{cgXVal.toFixed(3)} m</div>
        <div className="text-[#52606D]">CL_α:</div>
        <div>{report.clAlpha.toFixed(4)} /deg</div>
        <div className="text-[#52606D]">Cm_α:</div>
        <div className={report.cmAlpha < 0 ? "text-green-700" : "text-red-700"}>
          {report.cmAlpha.toFixed(4)} /deg
        </div>
        {report.trimAlphaDeg !== null && (
          <>
            <div className="text-[#52606D]">Trim α:</div>
            <div>{report.trimAlphaDeg.toFixed(1)}°</div>
          </>
        )}
      </div>

      {report.reasons.length > 0 && (
        <div className="space-y-0.5 text-[10px]">
          {report.reasons.map((r, i) => (
            <div key={i} className={r.startsWith("⚠") ? "text-amber-700" : "text-[#52606D]"}>
              {r.startsWith("⚠") ? "✗" : "✓"} {r}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 text-[9px] text-[#52606D] italic">
        Scope: VLM linear stability. Stall, dynamic effects, and control surface deflections not modeled.
      </div>
    </div>
  );
}
