import type { Vec3 } from "@/core/types";
import { sub, cross, dot, scale, add, norm } from "@/core/math";
import { horseshoeInducedVelocity } from "./biotSavart";
import { estimateCD0 } from "./viscousDrag";
import type { VlmPanel } from "./panelGenerator";

export interface ReferenceData {
  area: number;
  span: number;
  mac: number;
  momentRef: Vec3; // Point about which moments are computed (typically ¼ MAC)
}

export interface FlightConditions {
  velocity: number;
  density: number;
  viscosity: number;
  alphaDeg: number;
}

export interface SpanwiseResult {
  y: number;
  gamma: number;
  clLocal: number;
  cdLocal: number;
}

export interface AlphaResult {
  alphaDeg: number;
  CL: number;
  CDi: number;
  CD0: number;
  CD: number;
  Cm: number;
  lift: number;
  drag: number;
  relaxed: boolean;
  spanwise: SpanwiseResult[];
  gammas: number[];
}

export function freestreamDirection(alphaDeg: number): Vec3 {
  const alphaRad = (alphaDeg * Math.PI) / 180;
  return [-Math.cos(alphaRad), 0, Math.sin(alphaRad)];
}

export interface SolverOptions {
  relaxWake: boolean;
  viscousCorrection: boolean;
}

/**
 * Solve VLM for a single angle of attack.
 */
export function solveAlpha(
  panels: VlmPanel[],
  conditions: FlightConditions,
  reference: ReferenceData,
  options: SolverOptions
): AlphaResult {
  const { velocity, density, viscosity, alphaDeg } = conditions;
  const alphaRad = (alphaDeg * Math.PI) / 180;

  // Freestream direction (X-fwd convention: wind comes from +X at α=0)
  const wHat: Vec3 = [-Math.cos(alphaRad), 0, Math.sin(alphaRad)];
  const vInf: Vec3 = scale(wHat, -velocity); // Velocity vector (opposite to wind)

  const n = panels.length;
  if (n === 0) {
    return {
      alphaDeg,
      CL: 0,
      CDi: 0,
      CD0: 0,
      CD: 0,
      Cm: 0,
      lift: 0,
      drag: 0,
      relaxed: false,
      spanwise: [],
      gammas: [],
    };
  }

  // Assemble AIC matrix: A[i][j] = normal component of velocity induced at panel i's control point by panel j's horseshoe vortex with Γ=1
  const A: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const RHS: number[] = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    const cp = panels[i].controlPoint;
    const ni = panels[i].normal;

    // RHS = -V∞ · n (no-penetration BC)
    RHS[i] = -(vInf[0] * ni[0] + vInf[1] * ni[1] + vInf[2] * ni[2]);

    for (let j = 0; j < n; j++) {
      const vInd = horseshoeInducedVelocity(
        cp,
        panels[j].boundA,
        panels[j].boundB,
        1.0, // Unit circulation
        wHat
      );
      A[i][j] = vInd[0] * ni[0] + vInd[1] * ni[1] + vInd[2] * ni[2];
    }
  }

  // Solve A * Γ = RHS using Gaussian elimination with partial pivoting
  const gamma = solveLinearSystem(A, RHS);

  // Compute forces
  let totalLift = 0;
  let totalInducedDrag = 0;
  let totalMoment = 0;
  const spanwise: SpanwiseResult[] = [];

  const qInf = 0.5 * density * velocity * velocity;

  for (let i = 0; i < n; i++) {
    const panel = panels[i];
    const g = gamma[i];

    // Lift from Kutta-Joukowski: L = ρ * V * Γ * dy
    const boundVec = sub(panel.boundB, panel.boundA);
    const boundLen = norm(boundVec);
    const liftForce = density * velocity * Math.abs(g) * boundLen;

    // Induced drag from rearward component of induced velocity
    const vIndAtBound = horseshoeInducedVelocity(
      scale(add(panel.boundA, panel.boundB), 0.5),
      panel.boundA,
      panel.boundB,
      g,
      wHat
    );
    const wEff = dot(vIndAtBound, wHat); // Downwash component
    const diForce = density * g * boundLen * wEff;

    totalLift += liftForce;
    totalInducedDrag += diForce;

    // Moment about reference point (¼ MAC)
    const r = sub(panel.controlPoint, reference.momentRef);
    const forceVec: Vec3 = [0, 0, liftForce]; // Lift in Z direction
    const moment = r[0] * forceVec[2] - r[2] * forceVec[0]; // M_y = x*Fz - z*Fx
    totalMoment += moment;

    // Spanwise loading (aggregate by span index)
    const dy = boundLen;
    const clLocal = boundLen > 0 ? liftForce / (qInf * panel.chord * dy) : 0;
    const cdLocal = boundLen > 0 ? diForce / (qInf * panel.chord * dy) : 0;

    spanwise.push({
      y: panel.y,
      gamma: g,
      clLocal,
      cdLocal,
    });
  }

  // Aggregate spanwise results by unique y stations
  const yMap = new Map<number, { gamma: number; cl: number; cd: number; count: number }>();
  for (const s of spanwise) {
    const key = Math.round(s.y * 1000) / 1000;
    const existing = yMap.get(key);
    if (existing) {
      existing.gamma += s.gamma;
      existing.cl += s.clLocal;
      existing.cd += s.cdLocal;
      existing.count++;
    } else {
      yMap.set(key, { gamma: s.gamma, cl: s.clLocal, cd: s.cdLocal, count: 1 });
    }
  }

  const spanwiseAgg: SpanwiseResult[] = Array.from(yMap.entries())
    .map(([y, v]) => ({
      y,
      gamma: v.gamma / v.count,
      clLocal: v.cl / v.count,
      cdLocal: v.cd / v.count,
    }))
    .sort((a, b) => a.y - b.y);

  // Non-dimensional coefficients
  const CL = totalLift / (qInf * reference.area);
  const CDi = totalInducedDrag / (qInf * reference.area);

  // CD0 (viscous drag)
  const wettedArea = 2 * reference.area; // Top + bottom
  const CD0 = options.viscousCorrection
    ? estimateCD0(velocity, density, viscosity, reference.mac, wettedArea, reference.area)
    : 0;

  const CD = CDi + CD0;

  // Cm about ¼ MAC
  const Cm = totalMoment / (qInf * reference.area * reference.mac);

  return {
    alphaDeg,
    CL,
    CDi,
    CD0,
    CD,
    Cm,
    lift: totalLift,
    drag: totalInducedDrag + CD0 * qInf * reference.area,
    relaxed: options.relaxWake,
    spanwise: spanwiseAgg,
    gammas: gamma,
  };
}

/**
 * Solve linear system Ax = b using Gaussian elimination with partial pivoting.
 */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const aug = A.map((row, i) => [...row, b[i]]);

  // Forward elimination
  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxRow = col;
    let maxVal = Math.abs(aug[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }
    if (maxRow !== col) {
      [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    }

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) continue;

    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / pivot;
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // Back substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = aug[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= aug[i][j] * x[j];
    }
    x[i] = Math.abs(aug[i][i]) > 1e-12 ? sum / aug[i][i] : 0;
  }

  return x;
}
