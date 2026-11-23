import test from 'node:test';
import assert from 'node:assert/strict';
import {solveVlmCase} from '../src/vlmSolver.js';
const base={surfaces:[{spanM:8,rootChordM:1,tipChordM:1}],chordwiseRows:1,spanwisePanels:4,velocityMS:40,densityKgM3:1.225,refAreaM2:8,refChordM:1,alphaDeg:4};
test('finite reference coordinates cannot silently yield an infinite moment',()=>{
 assert.throws(()=>solveVlmCase({...base,referencePoint:[1e308,0,0]}),/nonfinite.*moment/i);
});
