// Executes the actual app function bodies with captured UI/export boundaries.
// This is a deterministic function-level integration probe, not a browser test.
import {readFileSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
import * as dut from '../../../src/vlmSolver.js';
const out=new URL('.',import.meta.url);
const source=readFileSync(new URL('../../../src/app.js',import.meta.url),'utf8');
const bodies={};
for(const name of ['updateGraphs','exportResults','invalidateVlm']) {
  const start=source.indexOf(`function ${name}(`);
  const next=source.indexOf('\nfunction ',start+1);
  bodies[name]=source.slice(start,next<0?undefined:next);
}
const surface={name:'wing',spanM:8,rootChordM:1,tipChordM:1};
const tail={name:'tail',spanM:3,rootChordM:.5,tipChordM:.5,xLeadingRootM:4,zRootM:.6};
const base={surfaces:[surface,tail],chordwiseRows:4,spanwisePanels:32,alphaDeg:10,velocityMS:40,densityKgM3:1.225,refAreaM2:8,refChordM:1,referencePoint:[.4,0,0],wakeLengthFactor:800};
const actual=dut.solveVlmCase(base);
const point={alphaDeg:10,cl:actual.cl,cdi:actual.cdi,cd:actual.cdi+.025,cm:actual.cm,liftN:actual.liftN,dragN:actual.trefftzDragN,momentNm:actual.pitchingMomentNm,validity:actual.validity};
const draws=[],exports=[];
const ctx={state:{lastVlm:{validity:actual.validity,series:[point]},lastPitchSamples:null,vlmGroup:{}},elements:{polarCanvas:'polar',pitchCanvas:'pitch',solverBadge:{},resolutionBadge:{},stabilityMetrics:{},solverDiagnostics:{}},
  drawPlots:(canvas,panels)=>draws.push({canvas,panels}),downloadBlob:(name,content,type)=>exports.push({name,content,type}),setStatus:()=>{},clearGroup:()=>{},metric:()=>''};
vm.createContext(ctx);
vm.runInContext(Object.values(bodies).join('\n'),ctx);
vm.runInContext('updateGraphs(); exportResults();',ctx);
const before=draws.length;
vm.runInContext('invalidateVlm("Inputs changed"); updateGraphs();',ctx);
const result={invalidSolve:{validity:actual.validity,cl:actual.cl,cdi:actual.cdi},exportsFromInvalid:exports,drawsFromInvalid:draws.slice(0,before),redrawsAfterInvalidation:draws.slice(before)};
// A previous pitch curve is retained when the next valid result has null C_m
// derivative: updateGraphs receives no samples and never clears that canvas.
draws.length=0;ctx.state.lastVlm={validity:{status:'warning'},series:[point]};ctx.state.lastPitchSamples=null;
vm.runInContext('updateGraphs(null)',ctx);
result.canvasesUpdatedWithUndeterminedPitch=draws.map(d=>d.canvas);
result.autoHighAR={ar:1e5,N:dut.autoSpanwisePanels({...surface,spanM:1e5},4)};
writeFileSync(new URL('app-probe-results.json',out),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
