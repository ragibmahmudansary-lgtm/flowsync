import test from 'node:test';
import assert from 'node:assert/strict';
import {runVlmSweep} from '../src/vlmSolver.js';
const base={surfaces:[{spanM:8,rootChordM:1,tipChordM:1}],chordwiseRows:1,spanwisePanels:4,velocityMS:40,densityKgM3:1.225,refAreaM2:8,refChordM:1};
const samples=(a,b,s)=>runVlmSweep({...base,alphaMinDeg:a,alphaMaxDeg:b,alphaStepDeg:s}).series.map(p=>p.alphaDeg);
test('strict decimal upper boundary excludes next integer',()=>assert.deepEqual(samples(0,1-Number.EPSILON,1),[0]));
test('decimal endpoints and samples are rounded once',()=>assert.deepEqual(samples(0,0.3,0.1),[0,0.1,0.2,0.3]));
test('decimal interval just below endpoint does not add a point',()=>assert.deepEqual(samples(0,0.29999999999999993,0.1),[0,0.1,0.2]));
test('reversed and offset decimal intervals preserve endpoints',()=>assert.deepEqual(samples(0.3,-0.1,0.1),[-0.1,0,0.1,0.2,0.3]));
