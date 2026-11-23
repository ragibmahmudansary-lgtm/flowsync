import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as vm from 'node:vm';
import { runVlmResolutionCheck, resolutionDeltas } from '../src/vlmSolver.js';
import { createProjectSnapshot } from '../src/projectState.js';
const wing={name:'wing',spanM:8,rootChordM:1,tipChordM:1};
const canard={name:'canard',spanM:3,rootChordM:.5,tipChordM:.5,xLeadingRootM:-4};
const base={surfaces:[wing,canard],velocityMS:40,densityKgM3:1.225,refAreaM2:8,refChordM:1,referencePoint:[.4,0,0]};
test('AUD-1 quarantined zero point withholds badge and persists through display boundary',()=>{
 const check=runVlmResolutionCheck(base);
 assert.equal(check.badge,'amber'); assert.equal(check.claim,'withheld');
 assert.equal(check.deltaClAlpha,null); assert.equal(check.r1.validity.valid,false);
 assert.match(check.withholdingReason,/alpha 0/);
 const src=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
 const body=src.match(/function resolutionBadgeText\(check, params\) \{[\s\S]*?\n\}/)[0];
 const render=new Function('formatNumber',`return (${body})`)((x)=>String(x));
 assert.match(render(check,{flowYawDeg:0}),/withheld/);
 const snap=createProjectSnapshot({lastVlm:{series:[],resolutionCheck:check}});
 assert.deepEqual(JSON.parse(JSON.stringify(snap)).analysis.resolutionCheck,check);
});
test('AUD-1 scientific identity distinguishes placement and wake and normalizes defaults',()=>{
 const a=runVlmResolutionCheck(base).inputIdentity;
 const b=runVlmResolutionCheck({...base,surfaces:[wing,{...canard,xLeadingRootM:4,zRootM:.6}]}).inputIdentity;
 const c=runVlmResolutionCheck({...base,wakeLengthFactor:200}).inputIdentity;
 const d=runVlmResolutionCheck({...base,betaDeg:0,wakeLengthFactor:20,surfaces:[{...wing,xLeadingRootM:0,zRootM:0}, {...canard,zRootM:0}]}).inputIdentity;
 assert.notDeepEqual(a,b); assert.notDeepEqual(a,c); assert.deepEqual(a,d);
});
test('AUD-1 rejects missing, quarantined and nonfinite comparison points',()=>{
 const sweep=()=>({validity:{status:'warning'},series:[{alphaDeg:0,cl:0,cdi:0,validity:{status:'ok'}},{alphaDeg:4,cl:.3,cdi:.01,validity:{status:'ok'}}]});
 assert.equal(resolutionDeltas(sweep(),sweep()).valid,true);
 for(const mutate of [s=>s.series.shift(),s=>s.series[0].validity.status='invalid',s=>s.series[1].cdi=NaN]) {
  const bad=sweep(); mutate(bad); const result=resolutionDeltas(bad,sweep());
  assert.equal(result.valid,false); assert.equal(result.deltaCdi,null); assert.ok(result.reasons.length);
 }
});

test('AUD-1 custom comparison with quarantined zero degree is withheld',()=>{
 const check=runVlmResolutionCheck({...base,chordwiseRows:1,spanwisePanels:8});
 assert.equal(check.claim,'withheld'); assert.equal(check.badge,'amber');
 assert.equal(check.currentGrid.validity.valid,false); assert.match(check.currentGrid.reason,/alpha 0/);
 assert.equal(check.currentGrid.deltaClAlpha,undefined);
});

test('AUD-1 application caller forwards flow and renders quarantined comparison', ()=>{
 const src=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
 const run=src.slice(src.indexOf('function runVlm()'),src.indexOf('// SOL-02 (REM-1): the badge text'));
 const render=src.match(/function resolutionBadgeText\(check, params\) \{[\s\S]*?\n\}/)[0];
 const elements={solverBadge:{},resolutionBadge:{},neutralPointInput:{}};
 const state={meshProperties:{},lastMassProperties:{cg:[.4,0,0]},recognitionReport:{htail:{...canard,valid:true}},referenceSource:'manual'};
 let observed;
 const params={flowYawDeg:0,chordwiseRows:4,velocityMS:40,densityKgM3:1.225,refAreaM2:8,macM:1};
 const context={state,elements,readAnalysisParams:()=>params,readMainSurface:()=>wing,
  runVlmAnalysis:opts=>{
   observed=opts;
   return {resolution:{label:'R1'},series:[],diagnostics:{panelCount:1},resolutionCheck:runVlmResolutionCheck(opts)};
  },
  setStatus:()=>{},renderVlmLattice:()=>{},updateMassAnalysis:()=>{},formatInput:()=>'',formatNumber:x=>String(x),TIER0_MODEL_DESCRIPTION:'model',console};
 vm.createContext(context); vm.runInContext(`${run}\n${render}\nrunVlm()`,context);
 assert.equal(observed.betaDeg,0); assert.equal(observed.surfaces.length,2);
 assert.equal(state.lastVlm.resolutionCheck.claim,'withheld');
 assert.match(elements.resolutionBadge.textContent,/withheld/); assert.match(elements.resolutionBadge.className,/warn/);
});

test('resolution identity distinguishes bounds-seed validity from a measured reference', () => {
  const options = { ...base, surfaces: [wing] };
  const omitted = runVlmResolutionCheck(options).inputIdentity;
  const explicit = runVlmResolutionCheck({ ...options, seedReferencePlaceholder: false }).inputIdentity;
  const seeded = runVlmResolutionCheck({ ...options, seedReferencePlaceholder: true }).inputIdentity;
  assert.deepEqual(omitted, explicit);
  assert.equal(explicit.seedReferencePlaceholder, false);
  assert.equal(seeded.seedReferencePlaceholder, true);
});

test('finite comparison cases can yield an unrepresentable slope and withhold the grid summary', () => {
  const check = runVlmResolutionCheck({ ...base, surfaces: [wing], refAreaM2: 2e-307 });
  assert.equal(check.claim, 'withheld');
  assert.equal(check.badge, 'amber');
  assert.equal(check.deltaClAlpha, null);
  assert.equal(check.deltaCdi, null);
  for (const grid of [check.r1, check.r2]) {
    assert.equal(grid.validity.valid, false);
    assert.match(grid.validity.reasons.join(' '), /two-point lift slope is nonfinite/);
    assert.equal(grid.clAlphaTwoPointPerRad, null);
    assert.equal(grid.cdiAt4Deg, null);
  }
});

test('resolution retains representable slopes when the degree conversion intermediate overflows', () => {
  const options = { ...base, surfaces: [wing], refAreaM2: 3e-307 };
  const prescribed = runVlmResolutionCheck(options);
  assert.equal(prescribed.claim, 'prescribed R1 vs R2');
  assert.equal(prescribed.badge, 'green');
  assert.equal(prescribed.coverage.coversPlottedLattice, true);
  for (const grid of [prescribed.r1, prescribed.r2]) {
    assert.equal(grid.validity.valid, true);
    assert.ok(Number.isFinite(grid.clAlphaTwoPointPerRad));
    assert.ok(Number.isFinite(grid.cdiAt4Deg));
  }

  const custom = runVlmResolutionCheck({ ...options, chordwiseRows: 3, spanwisePanels: 12 });
  assert.equal(custom.currentGrid.validity.valid, true);
  assert.equal(custom.coverage.coversPlottedLattice, true);
  assert.ok(Number.isFinite(custom.currentGrid.deltaClAlpha));
  assert.ok(Number.isFinite(custom.currentGrid.deltaCdi));

  const split = runVlmResolutionCheck({ ...options, refAreaM2: 2.09e-307 });
  assert.equal(split.r1.validity.valid, false);
  assert.equal(split.r1.clAlphaTwoPointPerRad, null);
  assert.equal(split.r1.cdiAt4Deg, null);
  assert.equal(split.r2.validity.valid, true);
  assert.ok(Number.isFinite(split.r2.clAlphaTwoPointPerRad));
  assert.ok(Number.isFinite(split.r2.cdiAt4Deg));
  assert.equal(split.deltaClAlpha, null);
  assert.equal(split.deltaCdi, null);
  assert.equal(split.coverage.coversPlottedLattice, false);

  const uncoveredCustom = runVlmResolutionCheck({
    ...options, refAreaM2: 2.1e-307, chordwiseRows: 3, spanwisePanels: 12
  });
  assert.equal(uncoveredCustom.withinGates, true);
  assert.equal(uncoveredCustom.currentGrid.validity.valid, false);
  assert.equal(uncoveredCustom.claim, 'withheld');
  assert.equal(uncoveredCustom.badge, 'amber');
  assert.equal(uncoveredCustom.coverage.coversPlottedLattice, false);
});

test('resolution retains a finite relative delta between large slopes of opposite sign', () => {
  const sweep = clAt4 => ({
    validity: { status: 'ok' },
    series: [
      { alphaDeg: 4, cl: clAt4, cdi: 0.01, validity: { status: 'ok' } },
      { alphaDeg: 0, cl: 0, cdi: 0, validity: { status: 'ok' } }
    ]
  });
  const positive = sweep(1e307);
  const negative = sweep(-1.1e307);
  for (const [coarse, fine, expected] of [
    [positive, negative, 2.1],
    [negative, positive, 21 / 11]
  ]) {
    const comparison = resolutionDeltas(coarse, fine);
    assert.equal(comparison.coarse.valid, true);
    assert.equal(comparison.fine.valid, true);
    assert.equal(comparison.valid, true);
    assert.ok(Math.abs(comparison.deltaClAlpha - expected) <= 1e-15);
    assert.equal(comparison.deltaCdi, 0);
  }

  const unrepresentable = resolutionDeltas(sweep(0), positive);
  assert.equal(unrepresentable.coarse.valid, true);
  assert.equal(unrepresentable.fine.valid, true);
  assert.equal(unrepresentable.deltaClAlpha, null);
  assert.equal(unrepresentable.deltaCdi, null);
  assert.deepEqual(unrepresentable.reasons, ['comparison metrics are nonfinite']);
});
