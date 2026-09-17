import type { ToolSchema } from "./types";
import { useGeometryStore } from "@/state/useGeometryStore";
import { useRecognitionStore } from "@/state/useRecognitionStore";
import { useSolverStore } from "@/state/useSolverStore";
import { useAeroStore } from "@/state/useAeroStore";
import { useConsoleStore } from "@/state/useConsoleStore";
import { useUIStore } from "@/state/useUIStore";
import { analyzeStability } from "@/modules/solver/stability";
import { searchCompendium } from "./knowledge";

export const TOOL_SCHEMAS: ToolSchema[] = [
  { type: "function", function: { name: "get_project_state", description: "Model file, faces, triangles, bbox, orientation note.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_recognition_state", description: "Component counts, wing reference geometry, warnings, status.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_solver_results", description: "CL slope, last-case coefficients, span efficiency.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_stability", description: "Static stability report for current CG (verdict, margins, trim).", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "run_recognition", description: "Run automatic aircraft recognition.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "run_solver", description: "Start the VLM AoA sweep in the background worker.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "run_validation", description: "Run AR=6 lifting-line validation case.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "set_flight_conditions", description: "Set velocity/density/viscosity/AoA sweep/display AoA.", parameters: { type: "object", properties: { velocity: { type: "number" }, density: { type: "number" }, aoaStartDeg: { type: "number" }, aoaEndDeg: { type: "number" }, aoaStepDeg: { type: "number" }, displayAlphaDeg: { type: "number" } } } } },
  { type: "function", function: { name: "set_panel_settings", description: "Set spanwise/chordwise panels or symmetry.", parameters: { type: "object", properties: { spanwisePanels: { type: "number" }, chordwisePanels: { type: "number" }, symmetry: { type: "string", enum: ["full", "half"] } } } } },
  { type: "function", function: { name: "select_component", description: "Select all faces of a component.", parameters: { type: "object", properties: { component: { type: "string", enum: ["wing", "htail", "vtail", "fuselage", "unassigned"] } }, required: ["component"] } } },
  { type: "function", function: { name: "navigate_tab", description: "Switch UI tab.", parameters: { type: "object", properties: { tab: { type: "string", enum: ["geometry", "vlm", "analysis", "results"] } }, required: ["tab"] } } },
  { type: "function", function: { name: "set_view", description: "Camera preset Iso/Top/Front/Side/Reset.", parameters: { type: "object", properties: { view: { type: "string" } }, required: ["view"] } } },
  { type: "function", function: { name: "set_display_mode", description: "shaded | wireframe | shadedEdges.", parameters: { type: "object", properties: { mode: { type: "string" } }, required: ["mode"] } } },
  { type: "function", function: { name: "open_console", description: "Open the analysis console.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "generate_report", description: "Generate PDF + JSON engineering report.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "explain_term", description: "Definition + where-to-see for any FlowSync/aero/CFD term.", parameters: { type: "object", properties: { topic: { type: "string" } }, required: ["topic"] } } },
  { type: "function", function: { name: "how_do_i", description: "Step-by-step playbook for an operational task.", parameters: { type: "object", properties: { task: { type: "string" } }, required: ["task"] } } },
];

export async function executeTool(name: string, args: Record<string, any>): Promise<string> {
  try {
    switch (name) {
      case "get_project_state": {
        const m = useGeometryStore.getState().model;
        if (!m) return "No CAD model imported yet.";
        const b = m.bbox;
        return `${m.fileName} (${m.format.toUpperCase()}), ${m.faces.length} faces, ${m.triangleCount} tris, bbox ${(b.max[0]-b.min[0]).toFixed(2)}×${(b.max[1]-b.min[1]).toFixed(2)}×${(b.max[2]-b.min[2]).toFixed(2)} m. Orientation: ${m.orientationNote ?? "n/a"}`;
      }
      case "get_recognition_state": {
        const r = useRecognitionStore.getState().result;
        const m = useGeometryStore.getState().model;
        if (!r || !m) return "Recognition not run yet.";
        const counts: Record<string, number> = {};
        for (const f of m.faces) { const c = r.componentByFaceId[f.id] ?? "unassigned"; counts[c] = (counts[c] ?? 0) + 1; }
        const w = r.wing;
        return `status=${r.status}; counts=${JSON.stringify(counts)}; wing=${w ? `span ${w.span.toFixed(2)} m, area ${w.area.toFixed(2)} m², AR ${w.aspectRatio.toFixed(2)}, MAC ${w.mac.toFixed(2)} m @ x=${w.macX.toFixed(2)}, sweep ${w.sweepQuarterChordDeg.toFixed(1)}°, dihedral ${w.dihedralDeg.toFixed(1)}°` : "none"}; warnings=${r.warnings.join(" | ") || "none"}`;
      }
      case "get_solver_results": {
        const res = useSolverStore.getState().results;
        if (!res.length) return "No solver results yet. Call run_solver first.";
        const n = res.length;
        const xs = res.map((r) => r.alphaDeg), ys = res.map((r) => r.CL);
        const sx = xs.reduce((a, b) => a + b, 0), sy = ys.reduce((a, b) => a + b, 0);
        const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0), sxx = xs.reduce((a, x) => a + x * x, 0);
        const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
        const last = res[n - 1];
        const ar = useRecognitionStore.getState().result?.wing?.aspectRatio ?? 0;
        const e = last.CDi > 0 && ar > 0 ? (last.CL ** 2) / (Math.PI * ar * last.CDi) : 0;
        return `${n} cases; CL_α=${slope.toFixed(4)}/deg; last: CL=${last.CL.toFixed(3)}, CDi=${last.CDi.toFixed(4)}, CD0=${last.CD0.toFixed(4)}, CD=${last.CD.toFixed(4)}, Cm=${last.Cm.toFixed(4)}; e=${e.toFixed(3)}`;
      }
      case "get_stability": {
        const res = useSolverStore.getState().results;
        const w = useRecognitionStore.getState().result?.wing;
        const cgX = useAeroStore.getState().cgX;
        if (!res.length || !w || cgX === null) return "Stability not evaluable: need solver results, recognition, and a CG (Tab 3 → Compute CG).";
        const rep = analyzeStability(res, { mac: w.mac, macX: w.macX, momentRefX: w.macX + 0.25 * w.mac, cgX });
        const npPctMac = ((rep.neutralPointX - w.macX) / w.mac) * 100;
        const cgPctMac = ((cgX - w.macX) / w.mac) * 100;
        return `${rep.verdict}; Cm_α=${rep.cmAlpha.toFixed(4)}/deg; SM=${(rep.staticMargin * 100).toFixed(1)}% MAC; NP=${npPctMac.toFixed(1)}% MAC; CG=${cgPctMac.toFixed(1)}% MAC; trim α=${rep.trimAlphaDeg !== null ? rep.trimAlphaDeg.toFixed(2) + "°" : "n/a"}`;
      }
      case "run_recognition": useRecognitionStore.getState().runAutoRecognition(); return "Recognition executed; call get_recognition_state.";
      case "run_solver": useSolverStore.getState().run(); return "Solver started in background worker; call get_solver_results shortly.";
      case "run_validation": useSolverStore.getState().runValidation(); return useSolverStore.getState().validationReport.join(" | ");
      case "set_flight_conditions": { const p: any = {}; for (const k of ["velocity","density","aoaStartDeg","aoaEndDeg","aoaStepDeg","displayAlphaDeg"]) if (typeof args[k] === "number") p[k] = args[k]; useAeroStore.getState().set(p); return `Flight conditions updated: ${JSON.stringify(p)}`; }
      case "set_panel_settings": { const p: any = {}; if (typeof args.spanwisePanels === "number") p.spanwisePanels = args.spanwisePanels; if (typeof args.chordwisePanels === "number") p.chordwisePanels = args.chordwisePanels; if (args.symmetry) p.symmetry = args.symmetry; useAeroStore.getState().set(p); return `Panel settings updated: ${JSON.stringify(p)}`; }
      case "select_component": {
        const m = useGeometryStore.getState().model;
        const r = useRecognitionStore.getState().result;
        if (!m || !r) return "No model/recognition.";
        const ids = m.faces.filter((f) => r.componentByFaceId[f.id] === args.component).map((f) => f.id);
        useGeometryStore.getState().setSelectedFaces(ids);
        return `Selected ${ids.length} faces of ${args.component}.`;
      }
      case "navigate_tab": useUIStore.getState().setActiveTab(args.tab); return `Tab: ${args.tab}`;
      case "set_view": useUIStore.getState().requestView(args.view); return `View: ${args.view}`;
      case "set_display_mode": useUIStore.getState().setDisplayMode(args.mode); return `Display: ${args.mode}`;
      case "open_console": useConsoleStore.getState().toggle(); return "Console toggled.";
      case "generate_report": { const { generateReport } = await import("@/modules/report/pdfReport"); await generateReport(); return "Report generated (PDF + JSON)."; }
      case "explain_term": {
        const hit = searchCompendium(args.topic ?? "").glossary[0];
        return hit ? `${hit.term}: ${hit.def} Where in FlowSync: ${hit.where}` : `No glossary entry for "${args.topic}". Try: MAC, static margin, CDi, wake relaxation, transport equation, CFD.`;
      }
      case "how_do_i": {
        const hit = searchCompendium(args.task ?? "").playbook[0];
        return hit ? `${hit.title}:\n${hit.steps.join("\n")}` : `No playbook for "${args.task}". Try: first analysis, name faces, fix recognition, interpret stability, validate, panels, vlm-vs-cfd, troubleshoot.`;
      }
      default: return `Unknown tool "${name}".`;
    }
  } catch (e) {
    return `Tool error: ${e instanceof Error ? e.message : String(e)}`;
  }
}
