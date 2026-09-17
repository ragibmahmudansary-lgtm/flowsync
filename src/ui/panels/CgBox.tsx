import { useMassStore } from "@/state/useMassStore";
import { useRecognitionStore } from "@/state/useRecognitionStore";
import { useAeroStore } from "@/state/useAeroStore";

export function CgBox() {
  const mass = useMassStore();
  const rec = useRecognitionStore((s) => s.result);
  const wingMac = rec?.wing?.mac ?? 0;
  const wingMacX = rec?.wing?.macX ?? 0;

  const cgPercentMac = wingMac > 0 && mass.cgX !== null
    ? ((mass.cgX - wingMacX) / wingMac) * 100
    : null;

  return (
    <div className="p-3 text-xs space-y-3">
      <div className="p-2 rounded bg-[#EEF2F6] border border-[#C3CDD8]">
        <div className="font-medium text-[#0F172A] mb-2">⚖️ Mass & CG</div>

        {/* Component densities */}
        <div className="space-y-1 mb-3">
          <div className="text-[10px] text-[#52606D] mb-1">Effective densities (kg/m³):</div>
          <div className="grid grid-cols-2 gap-1">
            <div>
              <label className="text-[9px] text-[#52606D]">Wing</label>
              <input
                type="number"
                className="w-full px-1 py-0.5 text-[10px] border border-[#C3CDD8] rounded"
                value={mass.densities.wing}
                onChange={(e) => mass.setDensities({ wing: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-[9px] text-[#52606D]">H. Tail</label>
              <input
                type="number"
                className="w-full px-1 py-0.5 text-[10px] border border-[#C3CDD8] rounded"
                value={mass.densities.htail}
                onChange={(e) => mass.setDensities({ htail: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-[9px] text-[#52606D]">V. Tail</label>
              <input
                type="number"
                className="w-full px-1 py-0.5 text-[10px] border border-[#C3CDD8] rounded"
                value={mass.densities.vtail}
                onChange={(e) => mass.setDensities({ vtail: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-[9px] text-[#52606D]">Fuselage</label>
              <input
                type="number"
                className="w-full px-1 py-0.5 text-[10px] border border-[#C3CDD8] rounded"
                value={mass.densities.fuselage}
                onChange={(e) => mass.setDensities({ fuselage: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>

        {/* Compute button */}
        <button
          className="w-full px-3 py-1.5 rounded border border-[#C3CDD8] bg-white hover:border-[#FF6600] hover:text-[#C2410C] text-xs"
          onClick={() => mass.compute()}
        >
          Compute CG
        </button>

        {/* Results */}
        {mass.totalMass !== null && (
          <div className="mt-2 space-y-1">
            <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
              <span className="text-[#52606D]">Total mass:</span>
              <span>{mass.totalMass.toFixed(1)} kg</span>
              <span className="text-[#52606D]">CG X:</span>
              <span>{mass.cgX?.toFixed(3) ?? "—"} m</span>
              <span className="text-[#52606D]">CG Z:</span>
              <span>{mass.cgZ?.toFixed(3) ?? "—"} m</span>
              {cgPercentMac !== null && (
                <>
                  <span className="text-[#52606D]">% MAC:</span>
                  <span className={cgPercentMac < 20 || cgPercentMac > 40 ? "text-amber-700 font-medium" : "text-green-700"}>
                    {cgPercentMac.toFixed(1)}%
                  </span>
                </>
              )}
            </div>

            {mass.fallbackWarning && (
              <div className="text-[9px] text-amber-700 mt-1">
                ⚠ Fallback bbox estimate used for some components (open surface).
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
