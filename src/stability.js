const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function computeStaticStability(params, massProperties) {
  const dynamicPressure = 0.5 * params.densityKgM3 * params.velocityMS ** 2;
  const cgX = massProperties.cg[0] || 0;
  const mac = Math.max(params.macM, 1e-6);
  const staticMargin = (params.neutralPointXM - cgX) / mac;
  const cmAlphaPerRad = -params.clAlphaPerRad * staticMargin;
  const trimAlphaRad = Math.abs(cmAlphaPerRad) > 1e-9 ? -params.cm0 / cmAlphaPerRad : NaN;
  const stable = staticMargin > 0 && cmAlphaPerRad < 0;

  const series = [];
  const step = Math.max(params.alphaStepDeg, 0.1);
  const alphaMin = Math.min(params.alphaMinDeg, params.alphaMaxDeg);
  const alphaMax = Math.max(params.alphaMinDeg, params.alphaMaxDeg);
  for (let alphaDeg = alphaMin; alphaDeg <= alphaMax + 1e-9; alphaDeg += step) {
    const alphaRad = alphaDeg * DEG_TO_RAD;
    const cl = params.cl0 + params.clAlphaPerRad * alphaRad;
    const cd = params.cd0 + params.dragK * cl * cl;
    const cm = params.cm0 + cmAlphaPerRad * alphaRad;
    const liftN = dynamicPressure * params.refAreaM2 * cl;
    const dragN = dynamicPressure * params.refAreaM2 * cd;
    const momentNm = dynamicPressure * params.refAreaM2 * mac * cm;
    series.push({ alphaDeg, alphaRad, cl, cd, cm, liftN, dragN, momentNm, staticMargin });
  }

  return {
    dynamicPressure,
    staticMargin,
    cmAlphaPerRad,
    trimAlphaDeg: Number.isFinite(trimAlphaRad) ? trimAlphaRad * RAD_TO_DEG : NaN,
    stable,
    series
  };
}

export function simulatePitchResponse(params, massProperties, stability) {
  const iyy = Math.max(Math.abs(massProperties.inertiaCg.yy), 1e-6);
  const qbar = stability.dynamicPressure;
  const area = params.refAreaM2;
  const mac = params.macM;
  const pitchDamping = Math.max(params.pitchDamping, 0);
  const alphaRelaxation = 1.25;
  const dt = 0.025;
  const duration = 12;
  const initialAlpha = Number.isFinite(stability.trimAlphaDeg) ? stability.trimAlphaDeg * DEG_TO_RAD + 2 * DEG_TO_RAD : 3 * DEG_TO_RAD;
  let state = {
    theta: initialAlpha,
    qPitch: 0,
    alpha: initialAlpha
  };
  const samples = [];

  function derivatives(s) {
    const cm = params.cm0 + stability.cmAlphaPerRad * s.alpha;
    const moment = qbar * area * mac * cm;
    return {
      theta: s.qPitch,
      qPitch: moment / iyy - pitchDamping * s.qPitch,
      alpha: s.qPitch - alphaRelaxation * (s.alpha - s.theta)
    };
  }

  for (let t = 0; t <= duration + 1e-9; t += dt) {
    samples.push({
      timeS: t,
      thetaDeg: state.theta * RAD_TO_DEG,
      qPitchDegS: state.qPitch * RAD_TO_DEG,
      alphaDeg: state.alpha * RAD_TO_DEG
    });
    state = rk4Step(state, dt, derivatives);
  }
  return samples;
}

export function defaultReferenceFromBounds(bounds) {
  const length = Math.max(bounds.size[0], 0.1);
  const span = Math.max(bounds.size[1], 0.1);
  const mac = Math.max(length * 0.112, 0.1);
  return {
    refAreaM2: span * mac * 0.875,
    spanM: span,
    macM: mac,
    aeroCenterXM: bounds.min[0] + length * 0.4,
    neutralPointXM: bounds.min[0] + length * 0.5
  };
}

function rk4Step(state, dt, f) {
  const k1 = f(state);
  const k2 = f(addState(state, scaleDerivatives(k1, dt / 2)));
  const k3 = f(addState(state, scaleDerivatives(k2, dt / 2)));
  const k4 = f(addState(state, scaleDerivatives(k3, dt)));
  return {
    theta: state.theta + (dt / 6) * (k1.theta + 2 * k2.theta + 2 * k3.theta + k4.theta),
    qPitch: state.qPitch + (dt / 6) * (k1.qPitch + 2 * k2.qPitch + 2 * k3.qPitch + k4.qPitch),
    alpha: state.alpha + (dt / 6) * (k1.alpha + 2 * k2.alpha + 2 * k3.alpha + k4.alpha)
  };
}

function addState(state, delta) {
  return {
    theta: state.theta + delta.theta,
    qPitch: state.qPitch + delta.qPitch,
    alpha: state.alpha + delta.alpha
  };
}

function scaleDerivatives(value, scalar) {
  return {
    theta: value.theta * scalar,
    qPitch: value.qPitch * scalar,
    alpha: value.alpha * scalar
  };
}
