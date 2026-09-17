import { generatePanels, type VlmSurfaceInput } from "../modules/solver/panelGenerator";
import { solveAlpha, type AlphaResult, type ReferenceData } from "../modules/solver/vlmSolver";

interface RunMessage {
  type: "run";
  surfaces: VlmSurfaceInput[];
  spanwisePanels: number;
  chordwisePanels: number;
  velocity: number;
  density: number;
  viscosity: number;
  alphas: number[];
  reference: ReferenceData;
  relaxWake: boolean;
  viscousCorrection: boolean;
}

const post = (m: unknown) => (self as any).postMessage(m);

self.onmessage = (e: MessageEvent<RunMessage>) => {
  const msg = e.data;
  try {
    post({ type: "progress", stage: "Panel generation", pct: 5 });
    const panels = generatePanels(msg.surfaces, msg.spanwisePanels, msg.chordwisePanels);
    post({ type: "progress", stage: `Matrix assembly & solve (${panels.length} panels)`, pct: 15 });

    const results: AlphaResult[] = [];
    msg.alphas.forEach((alpha, i) => {
      results.push(
        solveAlpha(
          panels,
          { velocity: msg.velocity, density: msg.density, viscosity: msg.viscosity, alphaDeg: alpha },
          msg.reference,
          { relaxWake: msg.relaxWake, viscousCorrection: msg.viscousCorrection }
        )
      );
      post({ type: "progress", stage: `Solving α = ${alpha.toFixed(1)}°`, pct: 15 + (80 * (i + 1)) / msg.alphas.length });
    });

    post({ type: "progress", stage: "Post-processing", pct: 98 });
    post({ type: "result", results, panels });
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
