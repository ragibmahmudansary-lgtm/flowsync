import type { ReportData } from "./reportData";

/**
 * Build rule-based interpretation sentences from report data.
 * No AI — deterministic engineering logic per FS-07-006.
 */
export function buildInterpretation(data: ReportData): string[] {
  const lines: string[] = [];

  // Wing analysis
  if (data.recognition.wing) {
    const wing = data.recognition.wing;
    lines.push(
      `The wing has a span of ${wing.span.toFixed(2)} m and planform area of ${wing.area.toFixed(2)} m², giving an aspect ratio of ${wing.aspectRatio.toFixed(2)}.`
    );

    if (Math.abs(wing.sweep) < 2) {
      lines.push("The wing exhibits essentially unswept planform geometry, typical of light aircraft designs optimized for low-speed performance.");
    } else if (wing.sweep > 0) {
      lines.push(`The wing has ${wing.sweep.toFixed(1)}° of aft sweep at the quarter-chord, which delays compressibility effects and modifies spanwise lift distribution.`);
    }

    if (Math.abs(wing.dihedral) > 0.5) {
      lines.push(
        `Wing dihedral of ${wing.dihedral.toFixed(1)}° provides positive roll stability through the dihedral effect.`
      );
    }
  }

  // Lift curve analysis
  if (data.results.length >= 2) {
    const alphas = data.results.map((r) => r.alpha);
    const cls = data.results.map((r) => r.CL);
    const clAlpha = (cls[cls.length - 1] - cls[0]) / (alphas[alphas.length - 1] - alphas[0]);

    lines.push(
      `The lift curve slope is approximately ${clAlpha.toFixed(4)} per degree, indicating linear lift behaviour within the analyzed angle-of-attack range.`
    );

    // Check for stall proximity
    const maxCL = Math.max(...cls);
    if (maxCL > 1.2) {
      lines.push(
        `Maximum lift coefficient of ${maxCL.toFixed(2)} was reached, suggesting the airfoil section is approaching stall at the upper end of the analysis range.`
      );
    }
  }

  // Drag analysis
  if (data.results.length > 0) {
    const lastResult = data.results[data.results.length - 1];
    const ar = data.recognition.wing?.aspectRatio ?? 0;

    if (ar > 0 && lastResult.CDi > 0) {
      const e = (lastResult.CL * lastResult.CL) / (Math.PI * ar * lastResult.CDi);
      lines.push(
        `Span efficiency factor e = ${e.toFixed(3)} indicates the lift distribution is ${
          e > 0.95 ? "near-elliptical" : e > 0.85 ? "reasonably efficient" : "suboptimal"
        }.`
      );
    }

    if (lastResult.CD0 > 0) {
      lines.push(
        `Estimated parasitic drag coefficient CD0 = ${lastResult.CD0.toFixed(4)} based on momentum-integral boundary-layer closure.`
      );
    }
  }

  // Stability analysis
  if (data.stability) {
    const stab = data.stability;
    lines.push(
      `Static longitudinal stability analysis indicates a ${stab.verdict.toLowerCase()} configuration with static margin of ${(stab.staticMargin * 100).toFixed(1)}% MAC.`
    );

    if (stab.verdict === "STABLE") {
      lines.push(
        `The center of gravity lies ahead of the neutral point by ${(stab.staticMargin * 100).toFixed(1)}% of the mean aerodynamic chord, providing positive pitch stiffness.`
      );
    } else if (stab.verdict === "UNSTABLE") {
      lines.push(
        `The center of gravity lies behind the neutral point, resulting in negative pitch stiffness. This configuration requires active control or redesign.`
      );
    }

    if (stab.trimAlpha !== null) {
      lines.push(
        `Trim angle of attack is ${stab.trimAlpha.toFixed(1)}°, where the pitching moment coefficient equals zero.`
      );
    }
  }

  // Mass properties
  if (data.mass) {
    lines.push(
      `Estimated aircraft mass is ${data.mass.totalMass.toFixed(1)} kg with center of gravity at x = ${data.mass.cgX.toFixed(3)} m.`
    );
  }

  // Method limitations
  lines.push("");
  lines.push("Method limitations:");
  lines.push("• Vortex lattice method assumes inviscid, incompressible, irrotational flow");
  lines.push("• Linear theory valid for small angles of attack (typically < 10°)");
  lines.push("• No modeling of flow separation, stall, or viscous-inviscid interaction");
  lines.push("• CD0 estimated via momentum-integral closure, not full Navier-Stokes");
  lines.push("• No ground effect, compressibility, or dynamic stability effects");

  return lines;
}
