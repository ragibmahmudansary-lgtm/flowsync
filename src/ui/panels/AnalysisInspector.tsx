import { useAeroStore } from "@/state/useAeroStore";
import { useSolverStore } from "@/state/useSolverStore";
import { runCommand } from "@/commands/registry";

export function AnalysisInspector() {
  const aero = useAeroStore();
  const solver = useSolverStore();

  return (
    <div className="flex-1 overflow-auto p-3 text-xs space-y-3">
      {/* Flight Conditions */}
      <div className="p-2 rounded bg-[#EEF2F6] border border-[#C3CDD8]">
        <div className="font-medium text-[#0F172A] mb-2">🛩️ Flight Conditions</div>
        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-[#52606D]">Velocity (m/s)</label>
            <input
              type="number"
              className="w-full px-2 py-1 text-xs border border-[#C3CDD8] rounded"
              value={aero.velocity}
              onChange={(e) => aero.set({ velocity: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-[10px] text-[#52606D]">Density (kg/m³)</label>
            <input
              type="number"
              className="w-full px-2 py-1 text-xs border border-[#C3CDD8] rounded"
              value={aero.density}
              onChange={(e) => aero.set({ density: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-[10px] text-[#52606D]">Viscosity (Pa·s)</label>
            <input
              type="number"
              className="w-full px-2 py-1 text-xs border border-[#C3CDD8] rounded"
              value={aero.viscosity}
              onChange={(e) => aero.set({ viscosity: Number(e.target.value) })}
              step="1e-6"
            />
          </div>
        </div>
      </div>

      {/* AoA Sweep */}
      <div className="p-2 rounded bg-[#EEF2F6] border border-[#C3CDD8]">
        <div className="font-medium text-[#0F172A] mb-2">📐 Angle of Attack Sweep</div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-[#52606D]">Start (°)</label>
            <input
              type="number"
              className="w-full px-2 py-1 text-xs border border-[#C3CDD8] rounded"
              value={aero.aoaStartDeg}
              onChange={(e) => aero.set({ aoaStartDeg: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-[10px] text-[#52606D]">End (°)</label>
            <input
              type="number"
              className="w-full px-2 py-1 text-xs border border-[#C3CDD8] rounded"
              value={aero.aoaEndDeg}
              onChange={(e) => aero.set({ aoaEndDeg: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-[10px] text-[#52606D]">Step (°)</label>
            <input
              type="number"
              className="w-full px-2 py-1 text-xs border border-[#C3CDD8] rounded"
              value={aero.aoaStepDeg}
              onChange={(e) => aero.set({ aoaStepDeg: Number(e.target.value) })}
            />
          </div>
        </div>
      </div>

      {/* Panel Settings */}
      <div className="p-2 rounded bg-[#EEF2F6] border border-[#C3CDD8]">
        <div className="font-medium text-[#0F172A] mb-2">🔲 Panel Settings</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-[#52606D]">Spanwise</label>
            <input
              type="number"
              className="w-full px-2 py-1 text-xs border border-[#C3CDD8] rounded"
              value={aero.spanwisePanels}
              onChange={(e) => aero.set({ spanwisePanels: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-[10px] text-[#52606D]">Chordwise</label>
            <input
              type="number"
              className="w-full px-2 py-1 text-xs border border-[#C3CDD8] rounded"
              value={aero.chordwisePanels}
              onChange={(e) => aero.set({ chordwisePanels: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="mt-2">
          <label className="text-[10px] text-[#52606D]">Symmetry</label>
          <select
            className="w-full px-2 py-1 text-xs border border-[#C3CDD8] rounded"
            value={aero.symmetry}
            onChange={(e) => aero.set({ symmetry: e.target.value as "full" | "half" })}
          >
            <option value="full">Full aircraft</option>
            <option value="half">Half model (symmetric)</option>
          </select>
        </div>
      </div>

      {/* Solver Options */}
      <div className="p-2 rounded bg-[#EEF2F6] border border-[#C3CDD8]">
        <div className="font-medium text-[#0F172A] mb-2">⚙️ Solver Options</div>
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-[10px]">
            <input
              type="checkbox"
              checked={aero.wakeRelaxation}
              onChange={(e) => aero.set({ wakeRelaxation: e.target.checked })}
            />
            Wake relaxation (vorticity transport)
          </label>
          <label className="flex items-center gap-2 text-[10px]">
            <input
              type="checkbox"
              checked={aero.viscousCorrection}
              onChange={(e) => aero.set({ viscousCorrection: e.target.checked })}
            />
            Viscous drag (momentum integral CD0)
          </label>
        </div>
      </div>

      {/* Theory Note */}
      <div className="p-2 rounded bg-blue-50 border border-blue-200 text-[9px] text-blue-800">
        <strong>Theory:</strong> ∂(ρφ)/∂t=0 · convection=wake relaxation · diffusion=BL momentum integral · sources=BCs
      </div>

      {/* Run Button */}
      <button
        className="w-full px-3 py-2 rounded border border-transparent bg-[#FF6600] text-white hover:bg-[#C2410C] text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={() => runCommand("solver.run")}
        disabled={solver.status === "running"}
      >
        {solver.status === "running" ? `Solving… ${solver.progressPct}%` : "Run VLM Analysis"}
      </button>

      {solver.status === "running" && (
        <div className="text-[10px] text-[#52606D]">{solver.progressStage}</div>
      )}

      {solver.status === "error" && solver.error && (
        <div className="p-2 rounded bg-red-50 border border-red-200 text-[10px] text-red-700">
          {solver.error}
        </div>
      )}

      {/* Validation */}
      <button
        className="w-full px-3 py-1.5 rounded border border-[#C3CDD8] bg-white hover:border-[#FF6600] hover:text-[#C2410C] text-xs"
        onClick={() => runCommand("solver.validate")}
      >
        Run Validation (AR=6 rect wing)
      </button>

      {solver.validationReport.length > 0 && (
        <div className="p-2 rounded bg-[#EEF2F6] border border-[#C3CDD8] font-mono text-[9px] space-y-0.5">
          {solver.validationReport.map((line, i) => (
            <div key={i} className={line.startsWith("PASS") ? "text-green-700" : line.startsWith("FAIL") ? "text-red-700" : "text-[#52606D]"}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
