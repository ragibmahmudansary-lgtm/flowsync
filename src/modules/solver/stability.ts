import type { AlphaResult } from "./vlmSolver";
import { linreg } from "@/core/math";

export interface StabilityInput {
  mac: number;
  macX: number;
  momentRefX: number;
  cgX: number;
}

export interface StabilityReport {
  valid: boolean;
  verdict: "STABLE" | "UNSTABLE" | "NEUTRAL" | "UNKNOWN";
  staticMargin: number;
  neutralPointX: number;
  cmAlpha: number;
  clAlpha: number;
  trimAlphaDeg: number | null;
  reasons: string[];
}

/**
 * Compute neutral point X location from Cm vs CL slope.
 * NP_x = momentRefX - (dCm/dCL) * MAC
 */
export function neutralPointX(
  results: AlphaResult[],
  mac: number,
  momentRefX: number
): number {
  if (results.length < 2) return momentRefX;

  const cls = results.map((r) => r.CL);
  const cms = results.map((r) => r.Cm);
  const { slope } = linreg(cls, cms);

  return momentRefX - slope * mac;
}

/**
 * Analyze static longitudinal stability.
 */
export function analyzeStability(
  results: AlphaResult[],
  input: StabilityInput
): StabilityReport {
  const reasons: string[] = [];

  if (results.length < 2) {
    return {
      valid: false,
      verdict: "UNKNOWN",
      staticMargin: 0,
      neutralPointX: input.cgX,
      cmAlpha: 0,
      clAlpha: 0,
      trimAlphaDeg: null,
      reasons: ["Insufficient data (need ≥ 2 AoA cases)"],
    };
  }

  // CL_α
  const alphas = results.map((r) => r.alphaDeg);
  const cls = results.map((r) => r.CL);
  const { slope: clAlpha } = linreg(alphas, cls);

  // Cm_α
  const cms = results.map((r) => r.Cm);
  const { slope: cmAlpha } = linreg(alphas, cms);

  // dCm/dCL
  const { slope: dCmDcl } = linreg(cls, cms);

  // Neutral point
  const npX = input.momentRefX - dCmDcl * input.mac;

  // Static margin (fraction of MAC)
  const staticMargin = (npX - input.cgX) / input.mac;

  // Trim alpha (where Cm = 0)
  const { slope: cmSlope, intercept: cmInt } = linreg(alphas, cms);
  const trimAlphaDeg = Math.abs(cmSlope) > 1e-9 ? -cmInt / cmSlope : null;

  // Verdict
  let verdict: StabilityReport["verdict"] = "UNKNOWN";
  if (Math.abs(staticMargin) < 0.02) {
    verdict = "NEUTRAL";
    reasons.push("Static margin ≈ 0 (neutral stability)");
  } else if (staticMargin > 0.02) {
    verdict = "STABLE";
    reasons.push(`CG ahead of NP by ${(staticMargin * 100).toFixed(1)}% MAC`);
  } else {
    verdict = "UNSTABLE";
    reasons.push(`CG behind NP by ${(-staticMargin * 100).toFixed(1)}% MAC`);
  }

  // Additional checks
  if (cmAlpha >= 0) {
    reasons.push("⚠ Cm_α ≥ 0: pitch-up tendency (potentially dangerous)");
  }
  if (clAlpha <= 0) {
    reasons.push("⚠ CL_α ≤ 0: unusual lift curve (check geometry)");
  }
  if (trimAlphaDeg !== null && (trimAlphaDeg < -10 || trimAlphaDeg > 20)) {
    reasons.push(`⚠ Trim α = ${trimAlphaDeg.toFixed(1)}° (outside typical range)`);
  }

  return {
    valid: true,
    verdict,
    staticMargin,
    neutralPointX: npX,
    cmAlpha,
    clAlpha,
    trimAlphaDeg,
    reasons,
  };
}
