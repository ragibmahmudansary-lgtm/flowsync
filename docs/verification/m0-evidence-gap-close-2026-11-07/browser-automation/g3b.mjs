import { attach, setInputs, runVlm, readBadges } from './lib.mjs';
const valid = { refAreaInput: 8, refSpanInput: 8, refMacInput: 1, rootChordInput: 1, tipChordInput: 1,
  sweepInput: 0, dihedralInput: 0, incidenceInput: 0, rootLeadingXInput: 17, velocityInput: 40, densityInput: 1.225,
  alphaMinInput: 0, alphaMaxInput: 4, alphaStepInput: 4, flowYawInput: 5, chordwiseRowsInput: 4, spanPanelsInput: '', cd0Input: 0, cm0Input: 0 };
const page = await attach();
const canvasInk = `(() => ['polarCanvas','pitchCanvas'].map(id => { const c = document.getElementById(id); const d = c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for (let i=3;i<d.length;i+=4) if (d[i]) n++; return n; }))()`;
await setInputs(page, valid);
await runVlm(page);
console.log('valid run   ink(polar,pitch):', await page.eval(canvasInk), '| results: ', (await readBadges(page)).resolution);
await setInputs(page, { alphaStepInput: 0 });
const b = await runVlm(page);
console.log('invalid run status:', b.status);
console.log('  solver badge:', b.solver, '| resolution badge:', JSON.stringify(b.resolution));
console.log('  diagnostics:', JSON.stringify(b.diagnostics).slice(0, 200));
console.log('  ink(polar,pitch):', await page.eval(canvasInk));
await page.eval("document.getElementById('exportResultsButton').click()");
await new Promise(r => setTimeout(r, 800));
console.log('  export after invalid run -> status:', await page.eval("document.getElementById('statusLine').textContent"));
page.close();
