import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { runVlmSweep } from '../src/vlmSolver.js';
import { createProjectSnapshot } from '../src/projectState.js';

const source = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const start = source.indexOf('function exportResults(');
const body = source.slice(start, source.indexOf('\nfunction ', start + 1));
function exportApp(result) {
  const calls = [];
  const context = { state: { lastVlm: result }, downloadBlob: (...args) => calls.push(args), setStatus: () => {} };
  vm.runInNewContext(`${body}\nexportResults()`, context);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'airflow-vlm-results.json');
  assert.equal(calls[0][2], 'application/json');
  return JSON.parse(calls[0][1]);
}
const inputs = {surfaces:[{name:'wing',spanM:8,rootChordM:1,tipChordM:1}], chordwiseRows:4,spanwisePanels:32,alphaMinDeg:0,alphaMaxDeg:4,alphaStepDeg:4,betaDeg:0,velocityMS:40,densityKgM3:1.225,refAreaM2:8,refChordM:1,referencePoint:[.4,0,0],cd0:.025,cm0:0};

test('actual app export retains valid sweep values, provenance and persistence', () => {
  const result = runVlmSweep(inputs);
  result.provenance = {inputs, referenceSource:'bounds',sourceName:'demo',massSource:'assumedUniform'};
  result.resolutionCheck = {claim:'withheld', validity:{valid:false,reasons:['coverage missing']}};
  const exported = exportApp(result);
  assert.equal(exported.schema, 'airflow.vlm-results');
  assert.match(exported.uncertaintyLabel, /unverified/);
  assert.equal(exported.uncertaintyScope, result.uncertaintyScope);
  assert.equal(exported.series[0].cl, result.series[0].cl);
  assert.deepEqual(exported.provenance, result.provenance);
  assert.deepEqual(exported.resolution, result.resolution);
  assert.deepEqual(exported.resolutionCheck, result.resolutionCheck);
  assert.match(exported.coefficientNotes.cd, /assumed constant CD0/);
  const saved = JSON.parse(JSON.stringify(createProjectSnapshot({lastVlm:result})));
  assert.deepEqual(saved.analysis.provenance, exported.provenance);
  assert.equal(saved.analysis.uncertaintyLabel, exported.uncertaintyLabel);
  assert.deepEqual(saved.analysis.resolutionCheck, exported.resolutionCheck);
});

test('actual app export quarantines invalid sweep including mixed points', () => {
  const point = {alphaDeg:10,cl:.94,cdi:.03,cd:.05,cm:-.25,liftN:7,dragN:2,momentNm:-3,validity:{status:'invalid',messages:['bad']}};
  const result = {validity:{status:'invalid',messages:['bad']},series:[point,{...point,alphaDeg:0,validity:{status:'ok',messages:[]}}],method:'test',provenance:{inputs}};
  const exported = exportApp(result);
  for (const p of exported.series) {
    assert.equal(p.availability,'withheld');
    for (const key of ['cl','cdi','cd','cm','liftN','dragN','momentNm']) assert.equal(p[key],null);
  }
  assert.deepEqual(exported.validity,result.validity);
  assert.deepEqual(exported.series[0].validity,point.validity);
  assert.deepEqual(exported.provenance.inputs,inputs);
});

test('missing point validity and nonfinite values remain unavailable in JSON', () => {
  const exported = exportApp({validity:{status:'warning',messages:[]},series:[{alphaDeg:0,cl:1},{alphaDeg:4,cl:NaN,cdi:1,validity:{status:'ok',messages:[]}}]});
  assert.equal(exported.series[0].availability,'withheld');
  assert.equal(exported.series[0].cl,null);
  assert.equal(exported.series[1].cl,null);
  assert.equal(exported.series[1].cdi,1);
});
