// Independent review probes. Production imports are the device under review,
// never the mathematical oracle. Run from the repository root with Node 24.
import { solveVlmCase, runVlmSweep, runVlmResolutionCheck,
  generateVlmPanels, trefftzDrag, inducedVelocityFiniteSegment } from '../../../src/vlmSolver.js';
import { writeFileSync } from 'node:fs';
const out = [];
const record = (id, data) => { out.push({id, ...data}); console.log(JSON.stringify(out.at(-1))); };
const wing = {name:'Wing',spanM:8,rootChordM:1,tipChordM:1};
const base = {surfaces:[wing],alphaDeg:4,velocityMS:40,densityKgM3:1.225,
  refAreaM2:8,refChordM:1,referencePoint:[0.25,0,0]};
function sample(options) {
  try {
    const r = solveVlmCase({...base,...options});
    const ar = options.ar ?? 8;
    return {cl:r.cl,cdi:r.cdi,cm:r.cm,e:r.cl**2/(Math.PI*ar*r.cdi),
      cdiNearField:r.cdiNearField,gap:r.nearFieldTrefftzDifference,
      minGamma:Math.min(...r.circulation),maxGamma:Math.max(...r.circulation),
      maxPanelForce:Math.max(...r.panelResults.map(p=>Math.hypot(...p.force))),
      validity:r.validity,diagnostics:r.diagnostics};
  } catch(e) { return {error:e.message}; }
}
// Independent closed-form Biot-Savart integral for endpoints (0,+/-1,0)
// at point (1,0,0): velocity z=-sqrt(2)/(4*pi).
const analytic=-Math.SQRT2/(4*Math.PI);
record('segment-analytic',{actual:inducedVelocityFiniteSegment([1,0,0],[0,-1,0],[0,1,0])[2],expected:analytic});
// One unit-width horseshoe, unit gamma/rho, x-directed wake: D=1/pi.
const one={boundA:[0,-0.5,0],boundB:[0,0.5,0],boundMidpoint:[0,0,0]};
record('single-horseshoe',{actual:trefftzDrag([one],[1],1,[1,0,0]).dragNTrefftz,expected:1/Math.PI});
for (const ar of [4,6,8,12]) {
  const r=solveVlmCase({...base,surfaces:[{...wing,spanM:ar}],refAreaM2:ar,chordwiseRows:8,wakeLengthFactor:2000});
  const body=trefftzDrag(r.panels,r.circulation,1.225,[1,0,0],{qS:980*ar});
  record('OBS1-projection',{ar,clAlpha:r.cl/(4*Math.PI/180),
    eFreestream:r.cl**2/(Math.PI*ar*r.cdi),eBody:r.cl**2/(Math.PI*ar*body.cdiTrefftz)});
}
for (const s of [1,0.1,0.01,0.001,1000]) record('scale',{scale:s,...sample({surfaces:[{...wing,spanM:8*s,rootChordM:s,tipChordM:s}],refAreaM2:8*s*s,refChordM:s,referencePoint:[.25*s,0,0]})});
for (const [m,n] of [[4,32],[8,64],[12,64],[12,96],[16,64]]) {
  const b=2*Math.PI;
  record('elliptic-tip',{m,n,...sample({surfaces:[{name:'Ellipse',planform:'elliptic',spanM:b,rootChordM:1}],refAreaM2:Math.PI*b/4,chordwiseRows:m,spanwisePanels:n,wakeLengthFactor:100*b})});
}
const tail={name:'Tail',spanM:3,rootChordM:.5,tipChordM:.5,xLeadingRootM:4,zRootM:.6};
for(const n of ['auto',24,32,40,48,64]) record('OBS2-counts',{n,...sample({surfaces:[wing,tail],chordwiseRows:4,spanwisePanels:n,alphaDeg:10,wakeLengthFactor:800})});
// More than the 0/4-degree badge points: custom versus prescribed resolution.
const check=runVlmResolutionCheck(base);
record('badge-baseline',check);
for(const [m,n] of [[1,4],[1,32],[4,32],[8,64]]) record('custom-resolution',{m,n,...sample({chordwiseRows:m,spanwisePanels:n})});
for (const a of [.0001,.001,.01,1,2,4,8]) record('alpha',{alphaDeg:a,...sample({alphaDeg:a})});
for (const beta of [0,2,5,10,20]) {
  const r1=sample({betaDeg:beta,chordwiseRows:4}); const r2=sample({betaDeg:beta,chordwiseRows:8});
  record('yaw-resolution',{beta,r1,r2,deltaCl:Math.abs(r2.cl-r1.cl)/Math.abs(r1.cl),deltaCdi:Math.abs(r2.cdi-r1.cdi)/Math.abs(r1.cdi)});
}
for(const incidenceDeg of [0,5,10,15]) {
  const p=generateVlmPanels([{spanM:8,rootChordM:1,tipChordM:.3,sweepDeg:25,incidenceDeg}],{chordwiseRows:1,spanwisePanels:8}).at(-1);
  record('incidence-sweep',{incidenceDeg,expectedSweep:25,measuredSweep:Math.atan2(p.boundB[0]-p.boundA[0],p.boundB[1]-p.boundA[1])*180/Math.PI});
}
const sweep={...base,alphaMinDeg:-4,alphaMaxDeg:4,alphaStepDeg:2};
const refs=[];
for (const x of [0,.25,.5]) { const r=runVlmSweep({...sweep,referencePoint:[x,0,0]});refs.push({x,clAlpha:r.clAlphaPerRad,cmAlpha:r.cmAlphaPerRad,np:r.neutralPointXM}); }
record('moment-reference',{refs});
const r=solveVlmCase(base), scaled=solveVlmCase({...base,refAreaM2:16,refChordM:2});
record('reference-normalization',{clRatio:scaled.cl/r.cl,cdiRatio:scaled.cdi/r.cdi,cmRatio:scaled.cm/r.cm,liftDifference:scaled.liftN-r.liftN,dragDifference:scaled.trefftzDragN-r.trefftzDragN});
for(const [min,max,step] of [[6,12,2],[0,4,4],[2,6,1]]) {
  const r=runVlmSweep({...base,cm0:.02,alphaMinDeg:min,alphaMaxDeg:max,alphaStepDeg:step});
  record('fit-trim',{min,max,step,clAlpha:r.clAlphaPerRad,cmAlpha:r.cmAlphaPerRad,trim:r.trimAlphaDeg,stable:r.stable,validity:r.validity});
}
// Force sign rejection can be hidden by the unrelated reference area floor.
for (const qS of [1,1e12]) {
  try {record('roundoff-floor',{qS,result:trefftzDrag([one],[1],1,[1,0,0],{qS,nearFieldDragN:-1})});}
  catch(e){record('roundoff-floor',{qS,error:e.message});}
}
// API currently silently converts NaN circulation to zero.
record('nonfinite-gamma',{result:trefftzDrag([one],[NaN],1,[1,0,0],{qS:1})});
let lo=-3,hi=1,balanced;
for(let it=0;it<35;it++) {
  const a=(lo+hi)/2;
  balanced=solveVlmCase({...base,surfaces:[{...wing,incidenceDeg:2},tail],alphaDeg:a});
  if(balanced.cl>0)hi=a;else lo=a;
}
record('zero-net-lift',{alphaDeg:balanced.alphaDeg,cl:balanced.cl,cdi:balanced.cdi,maxAbsGamma:Math.max(...balanced.circulation.map(Math.abs))});
// Save the exact geometry of the existing random PSD test for eigendecomposition.
writeFileSync(new URL('./psd-panels.json',import.meta.url),JSON.stringify(generateVlmPanels([wing,tail],{chordwiseRows:4,spanwisePanels:12}),null,2)+'\n');
writeFileSync(new URL('./probe-results.json',import.meta.url),JSON.stringify(out,null,2)+'\n');
