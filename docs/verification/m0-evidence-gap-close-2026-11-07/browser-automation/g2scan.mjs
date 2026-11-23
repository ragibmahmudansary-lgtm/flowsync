import { attach, setInputs, runVlm, download } from './lib.mjs';
import { readFileSync, rmSync } from 'node:fs';
const page = await attach();
const base = { refAreaInput: 8, refSpanInput: 8, refMacInput: 1, rootChordInput: 1, tipChordInput: 1,
  sweepInput: 0, dihedralInput: 0, incidenceInput: 0, rootLeadingXInput: 17, velocityInput: 40, densityInput: 1.225,
  flowYawInput: 0, cd0Input: 0.025, cm0Input: 0 };
const configs = [
  ['r4-s32-a0-10', { chordwiseRowsInput: 4, spanPanelsInput: 32, alphaMinInput: 0, alphaMaxInput: 10, alphaStepInput: 10 }],
  ['r8-s32-a0-10', { chordwiseRowsInput: 8, spanPanelsInput: 32, alphaMinInput: 0, alphaMaxInput: 10, alphaStepInput: 10 }],
  ['r2-s4-a-10-10', { chordwiseRowsInput: 2, spanPanelsInput: 4, alphaMinInput: -10, alphaMaxInput: 10, alphaStepInput: 20 }],
  ['r1-s2-a0-20', { chordwiseRowsInput: 1, spanPanelsInput: 2, alphaMinInput: 0, alphaMaxInput: 20, alphaStepInput: 20 }],
  ['r4-s32-chord0.5-a0-10', { chordwiseRowsInput: 4, spanPanelsInput: 32, rootChordInput: 0.5, tipChordInput: 0.5, refMacInput: 0.5, alphaMinInput: 0, alphaMaxInput: 10, alphaStepInput: 10 }],
];
for (const [name, cfg] of configs) {
  await setInputs(page, { ...base, ...cfg });
  const b = await runVlm(page);
  const dir = `${process.argv[2]}/${name}`;
  const [f] = await download(page, 'exportResultsButton', dir);
  const r = JSON.parse(readFileSync(f, 'utf8'));
  console.log(name, '| status:', b.status, '| validity:', r.validity.status, '| series:', r.series.map(p => `${p.alphaDeg}:${p.availability}`).join(' '), '| sweepMsgs:', r.validity.messages.length);
}
page.close();
