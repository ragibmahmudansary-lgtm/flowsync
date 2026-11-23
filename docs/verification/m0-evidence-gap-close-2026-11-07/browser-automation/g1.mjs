import { attach, setInputs, runVlm, download } from './lib.mjs';
import { readFileSync } from 'node:fs';
const page = await attach();
await setInputs(page, {
  refAreaInput: 8, refSpanInput: 8, refMacInput: 1, rootChordInput: 1, tipChordInput: 1,
  sweepInput: 0, dihedralInput: 0, incidenceInput: 0, rootLeadingXInput: 17,
  velocityInput: 40, densityInput: 1.225, alphaMinInput: 0, alphaMaxInput: 4, alphaStepInput: 4,
  flowYawInput: 5, chordwiseRowsInput: 4, spanPanelsInput: '', cd0Input: 0, cm0Input: 0
});
const b = await runVlm(page);
console.log(JSON.stringify(b, null, 1).slice(0, 1500));
const dir = process.argv[2];
const files = await download(page, 'exportResultsButton', dir);
console.log('downloaded', files);
const r = JSON.parse(readFileSync(files[0], 'utf8'));
const c = r.resolutionCheck;
console.log(JSON.stringify({ claim: c.claim, badge: c.badge, withinGates: c.withinGates, beta: c.inputIdentity.betaDeg,
  deltaClAlpha: c.deltaClAlpha, deltaCdi: c.deltaCdi, withholdingReason: c.withholdingReason,
  coverage: c.coverage, currentGrid: c.currentGrid ? c.currentGrid.claim : null, uncertaintyLabel: c.uncertaintyLabel,
  refArea: r.provenance.inputs.refAreaM2, referencePoint: r.provenance.inputs.referencePoint, seed: r.provenance.inputs.seedReferencePlaceholder,
  validity: r.validity.status }, null, 1));
page.close();
