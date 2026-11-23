import { attach, setInputs, runVlm, download, readBadges } from './lib.mjs';
import { readFileSync, readdirSync } from 'node:fs';
const root = process.argv[2];
const valid = { refAreaInput: 8, refSpanInput: 8, refMacInput: 1, rootChordInput: 1, tipChordInput: 1,
  sweepInput: 0, dihedralInput: 0, incidenceInput: 0, rootLeadingXInput: 17, velocityInput: 40, densityInput: 1.225,
  alphaMinInput: 0, alphaMaxInput: 4, alphaStepInput: 4, flowYawInput: 5, chordwiseRowsInput: 4, spanPanelsInput: '', cd0Input: 0, cm0Input: 0 };
let page = await attach();
await setInputs(page, valid);
const b1 = await runVlm(page);
const [proj1] = await download(page, 'exportProjectButton', `${root}/e1-project`);
const [res1] = await download(page, 'exportResultsButton', `${root}/e1-results`);
console.log('E1 solver:', b1.solver, '| resolution:', b1.resolution);
// Restore: reload the app, then open the saved project through the real file input.
await page.send('Page.navigate', { url: 'http://127.0.0.1:4173/' });
await new Promise((r) => setTimeout(r, 1500));
page.close();
page = await attach();
await page.waitFor("document.readyState === 'complete'");
await page.waitFor("document.getElementById('statusLine').textContent.includes('VLM solved')", 120000);
await page.send('DOM.enable');
const doc = await page.send('DOM.getDocument', { depth: -1 });
const { nodeId } = await page.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#projectFileInput' });
await page.send('DOM.setFileInputFiles', { nodeId, files: [proj1] });
await new Promise((r) => setTimeout(r, 3000));
console.log('after restore status:', await page.eval("document.getElementById('statusLine').textContent"));
const b2 = await runVlm(page);
const [res2] = await download(page, 'exportResultsButton', `${root}/e2-results`);
console.log('E2 solver:', b2.solver, '| resolution:', b2.resolution);
const a = JSON.parse(readFileSync(res1, 'utf8')), c = JSON.parse(readFileSync(res2, 'utf8'));
const same = (k) => JSON.stringify(a[k]) === JSON.stringify(c[k]);
console.log('exact equal: provenance', same('provenance'), '| series', same('series'), '| validity', same('validity'), '| uncertaintyLabel', same('uncertaintyLabel'));
const d = (x) => x.resolutionCheck;
console.log('deltas E1', d(a).deltaClAlpha, d(a).deltaCdi, '| E2', d(c).deltaClAlpha, d(c).deltaCdi);
const rel = (p, q) => Math.abs(p - q) / Math.max(Math.abs(p), 1e-300);
console.log('rel diff dCLa', rel(d(a).deltaClAlpha, d(c).deltaClAlpha), 'dCDi', rel(d(a).deltaCdi, d(c).deltaCdi));
page.close();
