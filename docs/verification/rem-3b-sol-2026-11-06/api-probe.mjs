import {generateVlmPanels, runVlmResolutionCheck, runVlmSweep, solveVlmCase, trefftzDrag} from '../../../src/vlmSolver.js';
const wing = { name: 'Wing', spanM: 8, rootChordM: 1, tipChordM: 1 };
const base = { surfaces: [wing], velocityMS: 40, densityKgM3: 1.225, refChordM: 1, refAreaM2: 8, alphaDeg: 4, chordwiseRows: 1, spanwisePanels: 4 };
const panels = generateVlmPanels(base.surfaces, base);
const pureDrag = patch => trefftzDrag(panels, [1,1,1,1], 1, [1,0,0], patch);
const measure = (key, fn) => {
  try {
    const r = fn();
    const values = Object.fromEntries(Object.entries(r).filter(([k]) => ['cl','cm','cdi','nearFieldTrefftzDifference','dragNTrefftz','dragNNearField','cdiTrefftz'].includes(k)));
    console.log(JSON.stringify({key, ...values, wake: r.diagnostics?.wakeLengthM, claim: r.claim, counts: r.coverage?.latticeCounts, validity:r.validity?.status, count: Array.isArray(r) ? r.length : undefined}, (_, v) => typeof v === 'number' && !Number.isFinite(v) ? String(v) : v));
  } catch (error) {
    console.log(JSON.stringify({key, error: error.message}));
  }
};
measure('baseline', () => solveVlmCase(base));
measure('spoof span', () => solveVlmCase({...base, panels: panels.map(p => ({...p,y0:p.y0/100,y1:p.y1/100}))}));
measure('shift midpoint', () => solveVlmCase({...base, panels: panels.map(p => ({...p,boundMidpoint:[p.boundMidpoint[0]+0.01,...p.boundMidpoint.slice(1)]}))}));
measure('ref area makes qS overflow', () => solveVlmCase({...base, refAreaM2: 1e308}));
measure('tiny qS coefficient overflow', () => solveVlmCase({...base, refAreaM2: Number.MIN_VALUE, densityKgM3: 0.001, referencePoint: [0.25,0,0]}));
measure('wake factor overflow', () => solveVlmCase({...base, refChordM: 4, wakeLengthFactor: 1e308}));
measure('wake collapses at a far downstream origin', () => {
  const shifted = panels.map(p => {
    const coords = q => [1e20, q[1], q[2]];
    return {...p, boundA:coords(p.boundA),boundB:coords(p.boundB),boundMidpoint:coords(p.boundMidpoint),controlPoint:[1e20+16384,p.controlPoint[1],0]};
  });
  return solveVlmCase({...base,alphaDeg:0,panels:shifted});
});
measure('duplicate names', () => generateVlmPanels([wing, {...wing,xLeadingRootM:4}], base));
measure('resolution key collides with Object.prototype', () => runVlmResolutionCheck({...base,chordwiseRows:4,spanwisePanels:'auto',surfaces:[{...wing,name:'constructor'}]}));
measure('near drag string', () => pureDrag({nearFieldDragN:'0'}));
measure('near drag null', () => pureDrag({nearFieldDragN:null}));
measure('negative near wake', () => pureDrag({wakeLengthM:-10}));
measure('qS as string', () => pureDrag({qS:'1'}));
measure('qS coefficient overflow', () => pureDrag({qS:Number.MIN_VALUE}));
measure('negative profile', () => runVlmSweep({...base,alphaMinDeg:4,alphaMaxDeg:4,alphaStepDeg:1,cd0:-1}));
measure('sweep load overflow', () => runVlmSweep({...base,alphaMinDeg:4,alphaMaxDeg:4,alphaStepDeg:1,cd0:1e308}));
