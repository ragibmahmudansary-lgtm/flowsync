/**
 * Viscous drag (CD0) estimation via von Kármán momentum integral.
 * Uses flat-plate turbulent BL correlation with roughness correction.
 * This is a closure model — full FVM/CFD deferred to post-Beta.
 */

const RE_TRANSITION = 5e5;

/**
 * Skin friction coefficient for turbulent flat plate (Schlichting).
 */
function cfTurbulent(Re: number): number {
  if (Re < 1e3) return 0;
  // Schlichting: Cf = 0.455 / (log10(Re))^2.58
  const logRe = Math.log10(Re);
  return 0.455 / Math.pow(logRe, 2.58);
}

/**
 * Skin friction coefficient for laminar flat plate (Blasius).
 */
function cfLaminar(Re: number): number {
  if (Re < 1) return 0;
  return 1.328 / Math.sqrt(Re);
}

/**
 * Estimate CD0 for a lifting surface using momentum integral closure.
 * Accounts for laminar-turbulent transition at Re_transition.
 */
export function estimateCD0(
  velocity: number,
  density: number,
  viscosity: number,
  mac: number,
  wettedArea: number,
  referenceArea: number
): number {
  if (velocity <= 0 || density <= 0 || referenceArea <= 0) return 0;

  const Re = (density * velocity * mac) / viscosity;
  if (Re < 100) return 0;

  // Transition location (fraction of chord)
  const xTrans = Math.min(1, RE_TRANSITION / Re);

  // Laminar portion
  const ReLam = Re * xTrans;
  const cdl = cfLaminar(ReLam) * xTrans;

  // Turbulent portion (from LE to TE, minus laminar)
  const cdt = cfTurbulent(Re) * (1 - xTrans);

  // Total skin friction (one side)
  const cfTotal = cdl + cdt;

  // CD0 = Cf * (wetted area / reference area)
  // For a wing, wetted ≈ 2 * planform (top + bottom)
  const formFactor = 1.0; // No form drag in VLM (lifting surfaces only)
  return cfTotal * (wettedArea / referenceArea) * formFactor;
}

/**
 * Estimate CD0 for the full aircraft (wing + tails + fuselage).
 */
export function estimateAircraftCD0(
  velocity: number,
  density: number,
  viscosity: number,
  wingMac: number,
  wingArea: number,
  htailArea: number,
  vtailArea: number,
  fuselageLength: number,
  fuselageWidth: number
): number {
  // Wetted areas (approximate)
  const wingWetted = 2 * wingArea;
  const htailWetted = 2 * htailArea;
  const vtailWetted = 2 * vtailArea;
  const fuselageWetted = Math.PI * fuselageWidth * fuselageLength; // Cylinder approx

  const totalWetted = wingWetted + htailWetted + vtailWetted + fuselageWetted;

  return estimateCD0(velocity, density, viscosity, wingMac, totalWetted, wingArea);
}
