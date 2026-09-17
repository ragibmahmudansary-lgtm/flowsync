import { create } from "zustand";
import type { AlphaResult } from "@/modules/solver/vlmSolver";
import type { VlmPanel } from "@/modules/solver/panelGenerator";
import { generatePanels } from "@/modules/solver/panelGenerator";
import { solveAlpha } from "@/modules/solver/vlmSolver";
import { useRecognitionStore } from "./useRecognitionStore";
import { useAeroStore } from "./useAeroStore";
import { useConsoleStore } from "./useConsoleStore";

interface SolverState {
  status: "idle" | "running" | "done" | "error";
  progressStage: string;
  progressPct: number;
  results: AlphaResult[];
  panels: VlmPanel[] | null;
  error: string | null;
  validationReport: string[];
  vizGamma: number[] | null;
  vizAlpha: number | null;
  run: () => void;
  runValidation: () => void;
}

export const useSolverStore = create<SolverState>((set) => ({
  status: "idle",
  progressStage: "",
  progressPct: 0,
  results: [],
  panels: null,
  error: null,
  validationReport: [],
  vizGamma: null,
  vizAlpha: null,

  run: () => {
    const rec = useRecognitionStore.getState().result;
    const aero = useAeroStore.getState();
    const log = useConsoleStore.getState().log;

    if (!rec?.wing || rec.wing.stations.length < 4) {
      set({
        status: "error",
        error: "Wing planform insufficient. Check orientation (Flip/Rot in Tab 1) and recognition (Tab 2).",
      });
      return;
    }

    const surfaces = [{ id: "wing", name: "Wing", stations: rec.wing.stations }];
    if (rec.htail && rec.htail.stations.length > 1)
      surfaces.push({ id: "htail", name: "Horizontal Tail", stations: rec.htail.stations });

    const alphas: number[] = [];
    for (let a = aero.aoaStartDeg; a <= aero.aoaEndDeg + 1e-9; a += aero.aoaStepDeg)
      alphas.push(Number(a.toFixed(3)));

    const reference = {
      area: rec.wing.area,
      span: rec.wing.span,
      mac: rec.wing.mac,
      momentRef: [rec.wing.macX + 0.25 * rec.wing.mac, 0, 0] as [number, number, number],
    };

    set({ status: "running", progressPct: 0, progressStage: "Starting solver worker…", error: null });
    log("info", `Solver: ${surfaces.length} surface(s), ${alphas.length} AoA cases, ${aero.spanwisePanels}×${aero.chordwisePanels} panels.`);

    const worker = new Worker(new URL("../workers/solver.worker.ts", import.meta.url), { type: "module" });

    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === "progress") set({ progressStage: msg.stage, progressPct: Math.round(msg.pct) });
      else if (msg.type === "result") {
        set({
          status: "done",
          results: msg.results,
          panels: msg.panels,
          vizGamma: msg.vizGamma,
          vizAlpha: msg.vizAlpha,
          progressPct: 100,
          progressStage: "Complete",
        });
        log("success", `Solver complete: ${msg.results.length} cases, ${msg.panels.length} panels.`);
        worker.terminate();
      } else if (msg.type === "error") {
        set({ status: "error", error: msg.message });
        log("error", `Solver: ${msg.message}`);
        worker.terminate();
      }
    };
    worker.onerror = (e) => {
      set({ status: "error", error: e.message });
      log("error", `Solver worker crashed: ${e.message}`);
      worker.terminate();
    };

    worker.postMessage({
      type: "run",
      surfaces,
      spanwisePanels: aero.spanwisePanels,
      chordwisePanels: aero.chordwisePanels,
      velocity: aero.velocity,
      density: aero.density,
      viscosity: aero.viscosity,
      alphas,
      reference,
      relaxWake: aero.wakeRelaxation,
      viscousCorrection: aero.viscousCorrection,
    });
  },

  runValidation: () => {
    const report: string[] = [];
    try {
      const span = 6, chord = 1;
      const stations = Array.from({ length: 25 }, (_, i) => ({
        y: -span / 2 + (span * i) / 24, xLe: 0, xTe: chord, z: 0,
      }));
      const panels = generatePanels([{ id: "wing", name: "Rect", stations }], 24, 6);
      const reference = { area: span * chord, span, mac: chord, momentRef: [0.25 * chord, 0, 0] as [number, number, number] };
      const results = [0, 2, 4, 6, 8].map((a) =>
        solveAlpha(panels, { velocity: 30, density: 1.225, viscosity: 1.81e-5, alphaDeg: a }, reference, { relaxWake: true, viscousCorrection: true })
      );

      const fit = (() => {
        const xs = results.map((r) => r.alphaDeg), ys = results.map((r) => r.CL);
        const n = xs.length;
        const sx = xs.reduce((a, b) => a + b, 0), sy = ys.reduce((a, b) => a + b, 0);
        const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0), sxx = xs.reduce((a, x) => a + x * x, 0);
        return (n * sxy - sx * sy) / (n * sxx - sx * sx);
      })();

      const ideal = ((2 * Math.PI * 6) / (6 + 2)) * (Math.PI / 180);
      const err = (100 * Math.abs(fit - ideal)) / ideal;
      const r5 = results[2];
      const e = r5.CDi > 0 ? (r5.CL * r5.CL) / (Math.PI * 6 * r5.CDi) : 0;
      const pass = (ok: boolean) => (ok ? "PASS" : "FAIL");

      report.push(`${pass(err < 12)} | CL_α = ${fit.toFixed(4)}/deg vs lifting-line ideal ${ideal.toFixed(4)}/deg (dev ${err.toFixed(1)}%)`);
      report.push(`${pass(e > 0.85 && e < 1.05)} | Span efficiency e = ${e.toFixed(3)} (rect wing ≈ 0.95)`);
      report.push(`${pass(Math.abs(results[0].CL) < 0.02)} | CL(α=0) = ${results[0].CL.toFixed(4)} (flat plate ≈ 0)`);
      report.push(`${pass(Math.abs(r5.Cm) < 0.06)} | Cm(¼-chord, α=4°) = ${r5.Cm.toFixed(4)} (symmetric ≈ 0)`);
      report.push(`INFO | ${panels.length} panels, relaxed wake ON, CD0 closure ON`);
      set({ validationReport: report });
      useConsoleStore.getState().log("success", "Validation case executed.");
    } catch (err) {
      set({ validationReport: [`FAIL | Validation crashed: ${err instanceof Error ? err.message : String(err)}`] });
    }
  },
}));
