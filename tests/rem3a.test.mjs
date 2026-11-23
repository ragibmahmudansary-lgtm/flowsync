import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { solveVlmCase, runVlmSweep, runVlmResolutionCheck, UNCERTAINTY_LABEL } from '../src/vlmSolver.js';
const wing={name:'wing',spanM:8,rootChordM:1,tipChordM:1};
const base={surfaces:[wing],velocityMS:40,densityKgM3:1.225,refAreaM2:8,refChordM:1,referencePoint:[.4,0,0],alphaDeg:4};
const sweep={...base,alphaMinDeg:0,alphaMaxDeg:4,alphaStepDeg:2};
test('IA-03: fixed claim is withheld for counterexamples and ordinary case',()=>{
 for(const extra of [{},{chordwiseRows:1,spanwisePanels:4},{chordwiseRows:12,spanwisePanels:48},{alphaDeg:35},{surfaces:[{...wing,spanM:1}],refAreaM2:1}]) {
  const r=solveVlmCase({...base,...extra}); assert.notEqual(r.uncertaintyLabel,UNCERTAINTY_LABEL); assert.match(r.uncertaintyLabel,/unverified/);
 }
});
test('claim withheld at sweep and resolution API boundaries',()=>{
 for(const r of [runVlmSweep(sweep),runVlmResolutionCheck(sweep)]) {assert.notEqual(r.uncertaintyLabel,UNCERTAINTY_LABEL); assert.match(r.uncertaintyScope,/not a confidence interval/);}
});
test('actual application stability rendering does not present the fixed claim',()=>{
 const src=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
 const start=src.indexOf('function renderStabilityMetrics('); const body=src.slice(start,src.indexOf('\nfunction ',start+1));
 const result=runVlmSweep(sweep); const elements={solverDiagnostics:{innerHTML:''},stabilityMetrics:{innerHTML:''}};
 const ctx={UNCERTAINTY_LABEL, elements, nearestAlpha:(series)=>series[0], formatNumber:(v)=>String(v), formatScientific:(v)=>String(v), metric:(a,b)=>`${a}: ${b}`};
 vm.runInNewContext(`${body}\nrenderStabilityMetrics(vlm)`,{...ctx,vlm:result});
 assert.doesNotMatch(JSON.stringify(elements),/C_Lα ±5/);
 assert.doesNotMatch(readFileSync(new URL('../index.html',import.meta.url),'utf8'), /C_L&alpha; &plusmn;5/);
});
