import test from 'node:test';
import assert from 'node:assert/strict';
import {runVlmSweep, generateVlmPanels, solveVlmCase} from '../src/vlmSolver.js';
const wing={spanM:8,rootChordM:1,tipChordM:1};
const base={surfaces:[wing],chordwiseRows:1,spanwisePanels:4,velocityMS:40,densityKgM3:1.225,refAreaM2:8,refChordM:1};
test('sweep accepts 201 points and refuses 202',()=>{
 assert.equal(runVlmSweep({...base,alphaMinDeg:0,alphaMaxDeg:200,alphaStepDeg:1}).series.length,201);
 assert.throws(()=>runVlmSweep({...base,alphaMinDeg:0,alphaMaxDeg:201,alphaStepDeg:1}),/resource limit/);
});
test('generation accepts 4096 panels and refuses more',()=>{
 const surfaces = Array.from({length:17}, (_, index) => ({...wing, name:`Wing ${index + 1}`}));
 assert.equal(generateVlmPanels(surfaces.slice(0,16),{chordwiseRows:4,spanwisePanels:64}).length,4096);
 assert.throws(()=>generateVlmPanels(surfaces,{chordwiseRows:4,spanwisePanels:64}),/resource limit/);
});
test('dense solve refuses 2049 panels before solving',()=>{
 const panel=generateVlmPanels([wing],{chordwiseRows:1,spanwisePanels:4})[0];
 assert.throws(()=>solveVlmCase({...base,panels:Array(2049).fill(panel)}),/resource limit/);
});
test('dense solver accepts the 2048-panel operational boundary', {timeout: 120000}, () => {
 const result=solveVlmCase({...base, chordwiseRows:16, spanwisePanels:128, alphaDeg:4});
 assert.equal(result.diagnostics.panelCount,2048);
 assert.ok(Number.isFinite(result.cl));
});
