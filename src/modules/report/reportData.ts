import { useGeometryStore } from "@/state/useGeometryStore";
import { useRecognitionStore } from "@/state/useRecognitionStore";
import { useSolverStore } from "@/state/useSolverStore";
import { useAeroStore } from "@/state/useAeroStore";
import { useMassStore } from "@/state/useMassStore";
import { analyzeStability } from "@/modules/solver/stability";
import { captureViewportPNG } from "@/three/viewportCapture";

export interface ReportData {
  generatedAt: string;
  configHash: string;
  project: {
    name: string;
    fileName: string;
    format: string;
    unit: string;
  };
  geometry: {
    faces: number;
    triangles: number;
    vertices: number;
    bbox: { min: [number, number, number]; max: [number, number, number] };
    orientation: string;
  };
  recognition: {
    wing: {
      span: number;
      area: number;
      mac: number;
      aspectRatio: number;
      sweep: number;
      dihedral: number;
    } | null;
    htail: {
      span: number;
      area: number;
    } | null;
    vtail: {
      area: number;
      height: number;
    } | null;
    fuselage: {
      length: number;
      width: number;
    } | null;
  };
  flightConditions: {
    velocity: number;
    density: number;
    viscosity: number;
    aoaRange: [number, number, number];
    panels: { spanwise: number; chordwise: number };
  };
  results: Array<{
    alpha: number;
    CL: number;
    CDi: number;
    CD0: number;
    CD: number;
    Cm: number;
  }>;
  stability: {
    verdict: string;
    staticMargin: number;
    neutralPointX: number;
    cgX: number;
    trimAlpha: number | null;
  } | null;
  mass: {
    totalMass: number;
    cgX: number;
    cgZ: number;
  } | null;
  viewport: string | null;
}

/**
 * Collect all data needed for the report.
 */
export function collectReportData(): ReportData {
  const model = useGeometryStore.getState().model;
  const recognition = useRecognitionStore.getState().result;
  const solver = useSolverStore.getState();
  const aero = useAeroStore.getState();
  const mass = useMassStore.getState();

  // Generate config hash from key parameters
  const configStr = JSON.stringify({
    velocity: aero.velocity,
    density: aero.density,
    aoaStart: aero.aoaStartDeg,
    aoaEnd: aero.aoaEndDeg,
    spanwisePanels: aero.spanwisePanels,
    chordwisePanels: aero.chordwisePanels,
  });
  const configHash = simpleHash(configStr);

  // Stability analysis
  let stability = null;
  if (solver.results.length > 0 && recognition?.wing) {
    const wing = recognition.wing;
    const momentRefX = wing.macX + 0.25 * wing.mac;
    const cgX = mass.cgX ?? momentRefX;

    const report = analyzeStability(solver.results, {
      mac: wing.mac,
      macX: wing.macX,
      momentRefX,
      cgX,
    });

    stability = {
      verdict: report.verdict,
      staticMargin: report.staticMargin,
      neutralPointX: report.neutralPointX,
      cgX,
      trimAlpha: report.trimAlphaDeg,
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    configHash,
    project: {
      name: "FlowSync Analysis",
      fileName: model?.fileName ?? "unknown",
      format: model?.format ?? "unknown",
      unit: model?.unit ?? "meter",
    },
    geometry: {
      faces: model?.faces.length ?? 0,
      triangles: model?.triangleCount ?? 0,
      vertices: model?.vertexCount ?? 0,
      bbox: model?.bbox ?? { min: [0, 0, 0], max: [0, 0, 0] },
      orientation: model?.orientationNote ?? "unknown",
    },
    recognition: {
      wing: recognition?.wing
        ? {
            span: recognition.wing.span,
            area: recognition.wing.area,
            mac: recognition.wing.mac,
            aspectRatio: recognition.wing.aspectRatio,
            sweep: recognition.wing.sweepQuarterChordDeg,
            dihedral: recognition.wing.dihedralDeg,
          }
        : null,
      htail: recognition?.htail
        ? {
            span: recognition.htail.span,
            area: recognition.htail.area,
          }
        : null,
      vtail:
        recognition && recognition.vtailArea > 0
          ? {
              area: recognition.vtailArea,
              height: recognition.vtailHeight,
            }
          : null,
      fuselage:
        recognition && recognition.fuselageLength > 0
          ? {
              length: recognition.fuselageLength,
              width: recognition.fuselageMaxWidth,
            }
          : null,
    },
    flightConditions: {
      velocity: aero.velocity,
      density: aero.density,
      viscosity: aero.viscosity,
      aoaRange: [aero.aoaStartDeg, aero.aoaEndDeg, aero.aoaStepDeg],
      panels: {
        spanwise: aero.spanwisePanels,
        chordwise: aero.chordwisePanels,
      },
    },
    results: solver.results.map((r) => ({
      alpha: r.alphaDeg,
      CL: r.CL,
      CDi: r.CDi,
      CD0: r.CD0,
      CD: r.CD,
      Cm: r.Cm,
    })),
    stability,
    mass:
      mass.totalMass !== null
        ? {
            totalMass: mass.totalMass,
            cgX: mass.cgX ?? 0,
            cgZ: mass.cgZ ?? 0,
          }
        : null,
    viewport: captureViewportPNG(),
  };
}

/**
 * Simple hash function for config fingerprinting.
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}
