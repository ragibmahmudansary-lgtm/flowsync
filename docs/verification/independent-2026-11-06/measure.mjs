// Production measurements only. Expected values are computed by oracle.py,
// which neither imports nor reads production code.
import {writeFileSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import * as dut from '../../../src/vlmSolver.js';
import {computeSurfaceReference} from '../../../src/recognition.js';
import {parseSTL} from '../../../src/stlParser.js';
import {mapPositions, DEFAULT_AXIS_MAPPING} from '../../../src/axisMapping.js';
const out = fileURLToPath(new URL('.', import.meta.url));
const wing = (b=8,c=1, extra={}) => ({name:'wing',spanM:b,rootChordM:c,tipChordM:c,...extra});
const opts = (extra={}) => ({surfaces:[wing()],velocityMS:40,densityKgM3:1.225,refAreaM2:8,refChordM:1,referencePoint:[0.4,0,0],alphaDeg:4,...extra});
const slim = r => ({cl:r.cl,cdi:r.cdi,cm:r.cm,force:r.totalForce,moment:r.totalMoment,circulation:r.circulation,validity:r.validity,diagnostics:r.diagnostics,
  dragNTrefftzRaw:r.dragNTrefftzRaw,dragNNearFieldRaw:r.dragNNearFieldRaw,nearFieldTrefftzDifference:r.nearFieldTrefftzDifference,uncertaintyLabel:r.uncertaintyLabel});
const result={head:process.argv[2] || 'supply git rev-parse HEAD as argument',node:process.version};
result.rectangles=[];
for (const ar of [4,6,8,12]) {
  const r=dut.solveVlmCase(opts({surfaces:[wing(ar)],refAreaM2:ar,chordwiseRows:8}));
  result.rectangles.push({ar,...slim(r)});
}
result.independentVlm=[];
for (const s of [wing(),wing(8,1,{tipChordM:0.5,sweepDeg:25,dihedralDeg:5,incidenceDeg:3})]) {
  const options=opts({surfaces:[s],chordwiseRows:4,spanwisePanels:16});
  const r=dut.solveVlmCase(options);
  result.independentVlm.push({options,...slim(r),panels:r.panels});
}
result.scales=[];
for (const scale of [1e-3,0.01,0.1,1,10,1000]) {
  const r=dut.solveVlmCase(opts({surfaces:[wing(8*scale,scale)],refAreaM2:8*scale**2,refChordM:scale,referencePoint:[.4*scale,0,0]}));
  result.scales.push({scale,...slim(r)});
}
result.kernels=[];
for (const scale of [1e-3,1,1000]) for (const h of [0.5e-6,2e-6,.1,1]) {
  const p=[scale/2,h*scale,0],a=[0,0,0],b=[scale,0,0],stats={truncations:0};
  result.kernels.push({scale,h,value:dut.inducedVelocityFiniteSegment(p,a,b,stats),stats});
}
const horseshoe={boundA:[0,-.5,0],boundB:[0,.5,0],boundMidpoint:[0,0,0]};
result.unitHorseshoe=[];
for (const qS of [1,1e12]) {
  result.unitHorseshoe.push({qS,...dut.trefftzDrag([horseshoe],[1],1,[1,0,0],{qS,wakeLengthM:1e5})});
}
result.prescribedElliptic=[];
for (const n of [128,256]) {
  const panels=[],gamma=[];
  for(let i=0;i<n;i++) {
    const ya=-1+2*i/n,yb=-1+2*(i+1)/n,ym=(ya+yb)/2;
    panels.push({boundA:[0,ya,0],boundB:[0,yb,0],boundMidpoint:[0,ym,0]});
    gamma.push(Math.sqrt(1-ym*ym));
  }
  result.prescribedElliptic.push({n,...dut.trefftzDrag(panels,gamma,1,[1,0,0])});
}
const swOpts=opts({alphaMinDeg:-4,alphaMaxDeg:8,alphaStepDeg:1,cm0:0.01});
const sweepSummary=r=>({series:r.series.map(({panelResults,circulation,...p})=>p),fit:r.fit,clAlphaPerRad:r.clAlphaPerRad,cmAlphaPerRad:r.cmAlphaPerRad,trimAlphaDeg:r.trimAlphaDeg,trimStatus:r.trimStatus,staticMargin:r.staticMargin,neutralPointXM:r.neutralPointXM,stabilityVerdict:r.stabilityVerdict,validity:r.validity});
result.fits=[];
for (const sweep of [{}, {alphaMinDeg:6,alphaMaxDeg:12}, {alphaMinDeg:0,alphaMaxDeg:4,alphaStepDeg:4}, {cm0:10}]) result.fits.push({options:{...swOpts,...sweep},...sweepSummary(dut.runVlmSweep({...swOpts,...sweep}))});
// Force the fitted line's trim root to a known interior angle, then directly
// measure the physical C_m at that angle (distinct from a line-root identity).
const baseline=dut.runVlmSweep(swOpts), target=3;
const cm0=-(baseline.fit.cm.intercept-swOpts.cm0+baseline.fit.cm.slopePerDeg*target);
const trimmed=dut.runVlmSweep({...swOpts,cm0});
result.trimRoundTrip={target,cm0,...sweepSummary(trimmed),directCm:dut.solveVlmCase(opts({alphaDeg:trimmed.trimAlphaDeg})).cm+cm0};
result.moments=[];
for(const referencePoint of [[0,0,0],[.6,0,0],[.6,0,2]]) result.moments.push({referencePoint,...slim(dut.solveVlmCase(opts({referencePoint})))});
result.tinyDrag=[];
for(const alphaDeg of [.001,.01,.1]) result.tinyDrag.push({alphaDeg,...slim(dut.solveVlmCase(opts({alphaDeg})))});
result.labels=[];
for(const extra of [{chordwiseRows:1,spanwisePanels:4},{chordwiseRows:12,spanwisePanels:48},{alphaDeg:35},{surfaces:[wing(1)],refAreaM2:1}]) {
  try{result.labels.push({extra,...slim(dut.solveVlmCase(opts(extra)))});}catch(e){result.labels.push({extra,error:e.message});}
}
result.badges=[];
for(const extra of [{betaDeg:5},{chordwiseRows:1,spanwisePanels:4},{surfaces:[wing(),wing(3,.5,{name:'canard',xLeadingRootM:-4})]}]) {
  try{const r=dut.runVlmResolutionCheck(opts(extra));result.badges.push({extra,...r});}catch(e){result.badges.push({extra,error:e.message});}
}
result.inputs=[];
for(const gamma of [null,'',false,NaN,Infinity]) {
  try{result.inputs.push({input:String(gamma),result:dut.trefftzDrag([horseshoe],[gamma],1,[1,0,0])});}catch(e){result.inputs.push({input:String(gamma),error:e.message});}
}
for(const extra of [{alphaDeg:'bad'},{betaDeg:NaN},{cm0:'bad'},{alphaMinDeg:'bad'}]) {
  try{const r=('cm0' in extra || 'alphaMinDeg' in extra)?dut.runVlmSweep({...swOpts,...extra}):dut.solveVlmCase(opts(extra));
    result.inputs.push({input:String(Object.keys(extra)),value:String(Object.values(extra)),result:r.series?sweepSummary(r):slim(r)});
  }catch(e){result.inputs.push({input:String(Object.keys(extra)),error:e.message});}
}
const bytes=readFileSync(new URL('../../../assets/airbus-a320-cfd-1.snapshot.7/samolot.stl',import.meta.url));
const parsed=parseSTL(bytes),positions=mapPositions(parsed.positions,DEFAULT_AXIS_MAPPING,1),selected=[];
for(let t=0;t<positions.length/9;t++) if((positions[9*t+1]+positions[9*t+4]+positions[9*t+7])/3>=8) selected.push(t);
const triangles=selected.map(t=>Array.from(positions.slice(t*9,t*9+9)));
const ref=computeSurfaceReference(positions,selected);
result.recognition={selected:selected.length,areaM2:ref.areaM2,macM:ref.macM,valid:ref.valid,warnings:ref.warnings,triangles};
const manifest=JSON.parse(readFileSync(new URL('../sol/MANIFEST.json',import.meta.url)));
result.frozenEvidence=[];
for(const [section,entries] of Object.entries(manifest)) if(section.toLowerCase().includes('sha256') && typeof entries==='object') {
 for(const [name,expected] of Object.entries(entries)) if(section==='reviewArtifactSha256') {
  const actual=createHash('sha256').update(readFileSync(new URL('../sol/'+name,import.meta.url))).digest('hex');
  result.frozenEvidence.push({name,match:actual===expected});
 }
}
writeFileSync(out+'measurements.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({head:result.head,rectangles:result.rectangles.map(({ar,cl,cdi})=>({ar,cl,cdi})),labels:result.labels.map(({extra,validity,uncertaintyLabel})=>({extra,validity,uncertaintyLabel})),badges:result.badges.map(({badge,claim,withinGates,error})=>({badge,claim,withinGates,error})),inputs:result.inputs.map(({input,error,result})=>({input,error,drag:result?.dragNTrefftz})),recognition:{area:ref.areaM2,valid:ref.valid}}));
