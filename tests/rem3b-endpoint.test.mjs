import test from 'node:test';
import assert from 'node:assert/strict';
import {runVlmSweep} from '../src/vlmSolver.js';
const base={surfaces:[{spanM:8,rootChordM:1,tipChordM:1}],chordwiseRows:1,spanwisePanels:4,velocityMS:40,densityKgM3:1.225,refAreaM2:8,refChordM:1};
test('single point sweep is one point even for a small step',()=>assert.equal(runVlmSweep({...base,alphaMinDeg:0,alphaMaxDeg:0,alphaStepDeg:1e-12}).series.length,1));
test('decimal endpoint is included',()=>assert.equal(runVlmSweep({...base,alphaMinDeg:0,alphaMaxDeg:0.3,alphaStepDeg:0.1}).series.length,4));
