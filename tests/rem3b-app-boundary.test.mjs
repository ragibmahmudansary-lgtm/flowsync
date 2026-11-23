import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as axisMapping from '../src/axisMapping.js';
import * as stlParser from '../src/stlParser.js';
import * as geometry from '../src/geometry.js';
import * as massModel from '../src/massModel.js';
import * as stability from '../src/stability.js';
import * as recognition from '../src/recognition.js';
import * as vlmSolver from '../src/vlmSolver.js';
import * as projectState from '../src/projectState.js';
import * as THREE from '../vendor/three/three.module.js';

const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8');
const imports = { axisMapping, stlParser, geometry, massModel, stability, recognition, vlmSolver, projectState };
const html = read('../index.html');
const source = read('../src/app.js')
  .replace(/import (\{[\s\S]*?\}) from "\.\/(\w+)\.js[^"]*";/g, (_, names, module) =>
    module === 'graphs' ? '' : `const ${names} = imports.${module};`)
  .replace(/^bootstrap\(\);$/m, '');
const graphs = read('../src/graphs.js').replace(/^export /m, '');

class Element extends EventTarget {
  constructor(id, value = '') {
    super();
    this.id = id;
    this.value = value;
    this.validity = { badInput: false };
  }

  append() {}
  get valueAsNumber() { return this.value === '' ? NaN : Number(this.value); }
}

function canvas(id) {
  const element = new Element(id);
  const paint = {
    labels: [], strokes: 0,
    clearRect() { this.labels = []; this.strokes = 0; },
    fillText(text) { this.labels.push(text); },
    stroke() { this.strokes += 1; }
  };
  for (const method of ['fillRect', 'save', 'scale', 'restore', 'strokeRect', 'beginPath', 'moveTo', 'lineTo']) paint[method] = () => {};
  element.getContext = () => paint;
  element.getBoundingClientRect = () => ({ width: 560, height: 280 });
  element.paint = paint;
  return element;
}

function mount() {
  const dom = Object.fromEntries([...html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)].map(([tag, id]) =>
    [id, new Element(id, tag.match(/\bvalue="([^"]*)"/)?.[1])]));
  for (const id of ['polarCanvas', 'pitchCanvas']) dom[id] = canvas(id);
  const document = {
    querySelector: selector => dom[selector.slice(1)],
    querySelectorAll: () => [],
    createElement: tag => new Element(tag)
  };
  const window = new EventTarget();
  const state = vm.runInNewContext(`${graphs}\n${source}
    Object.assign(state, {
      THREE, vlmGroup: new THREE.Group(), markerGroup: new THREE.Group(),
      meshProperties: { bounds: { center: [0, 0, 0], size: [1, 4, 1] }, volumeM3: 1, surfaceAreaM2: 6 },
      manifest: { components: [0, 0.2].map((x, index) => ({
        id: String(index), type: 'point-mass', massKg: 10000, positionM: [x, 0, 0]
      })) }
    });
    Object.assign(elements.refSpanInput, { value: '4' });
    for (const id of ['refMacInput', 'rootChordInput', 'tipChordInput']) elements[id].value = '1';
    elements.refAreaInput.value = '4';
    for (const id of ['sweepInput', 'dihedralInput', 'incidenceInput', 'rootLeadingXInput']) elements[id].value = '0';
    elements.alphaMinInput.value = '-2';
    elements.alphaMaxInput.value = '2';
    updateMassAnalysis();
    state;
  `, { document, window, imports, THREE, console: { error() {} } });
  const run = () => dom.runVlmButton.dispatchEvent(new Event('click'));
  const edit = (id, value) => {
    dom[id].value = value;
    dom[id].dispatchEvent(new Event('input'));
  };
  return { dom, state, window, run, edit };
}

function assertCleared(dom, state) {
  assert.equal(state.lastVlm, null);
  assert.equal(state.lastPitchSamples, null);
  assert.equal(state.vlmGroup.children.length, 0);
  assert.equal(state.markerGroup.children.length, 2);
  assert.equal(dom.neutralPointInput.value, '');
  assert.equal(dom.solverDiagnostics.textContent, '');
  assert.match(dom.stabilityMetrics.innerHTML, /Run VLM to update/);
  assert.equal(dom.resolutionBadge.textContent, 'R1/R2 not run');
  for (const id of ['polarCanvas', 'pitchCanvas']) {
    assert.equal(dom[id].paint.strokes, 0);
    assert.ok(dom[id].paint.labels.includes('No data'));
  }
}

test('wired Run and input events clear both old plots and recover through real parsing and rendering', () => {
  const { dom, state, run, edit } = mount();
  run();
  assert.match(dom.statusLine.textContent, /VLM solved 5 cases/);
  assert.ok(state.lastPitchSamples.length > 0);
  assert.ok(dom.polarCanvas.paint.strokes > 0 && dom.pitchCanvas.paint.strokes > 0);
  assert.ok(dom.neutralPointInput.value);

  edit('alphaStepInput', '');
  assertCleared(dom, state);
  run();
  assert.match(dom.statusLine.textContent, /alphaStepInput must be a finite number/);
  assert.equal(dom.solverBadge.textContent, 'Solver error');
  assertCleared(dom, state);

  edit('alphaStepInput', '1');
  run();
  assert.match(dom.statusLine.textContent, /VLM solved 5 cases/);
  assert.ok(dom.polarCanvas.paint.strokes > 0 && dom.pitchCanvas.paint.strokes > 0);

  // Commit values without an input event to exercise a successful Run that
  // cannot compute a pitch response while the previous pitch is still drawn.
  dom.alphaMaxInput.value = dom.alphaMinInput.value;
  run();
  assert.match(dom.statusLine.textContent, /VLM solved 1 cases/);
  assert.ok(dom.polarCanvas.paint.strokes > 0);
  assert.equal(dom.pitchCanvas.paint.strokes, 0);
});

test('wired Run clears prior display on solver and resolution failure without an input event', () => {
  const { dom, state, run } = mount();
  run();
  assert.ok(state.lastVlm);
  dom.alphaStepInput.value = '0.001';
  run();
  assert.match(dom.statusLine.textContent, /Sweep resource limit/);
  assertCleared(dom, state);

  dom.alphaStepInput.value = '1';
  run();
  assert.ok(state.lastVlm);
  dom.refSpanInput.value = '160';
  dom.spanPanelsInput.value = '4';
  run();
  assert.match(dom.statusLine.textContent, /VLM panel resource limit/);
  assertCleared(dom, state);
});

test('invalid in-progress span text does not act like an intentionally blank automatic setting', () => {
  const { dom, run } = mount();
  dom.spanPanelsInput.value = '';
  dom.spanPanelsInput.validity.badInput = true;
  run();
  assert.match(dom.statusLine.textContent, /spanPanelsInput must be a finite number/);
});

test('wired Run rejects combined synchronous work and clears previous results', () => {
  const { dom, state, run } = mount();
  run();
  assert.ok(state.lastVlm);
  dom.refSpanInput.value = '10';
  dom.chordwiseRowsInput.value = '8';
  dom.spanPanelsInput.value = '64';
  dom.alphaMinInput.value = '0';
  dom.alphaMaxInput.value = '49';
  run();
  assert.match(dom.statusLine.textContent, /synchronous work limit/);
  assertCleared(dom, state);
});
