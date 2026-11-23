import { Page } from './cdp.mjs';
import { readdirSync, readFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
export async function attach() {
  const pages = await (await fetch('http://127.0.0.1:9333/json/list')).json();
  const p = pages.find((t) => t.type === 'page' && t.url.includes('127.0.0.1:4173'));
  if (!p) throw new Error('no app page open in headless brave');
  const page = new Page(p.webSocketDebuggerUrl);
  await page.send('Page.enable'); await page.send('Runtime.enable');
  return page;
}
export async function setInputs(page, values) {
  for (const [id, v] of Object.entries(values)) {
    await page.eval(`(() => { const el = document.getElementById(${JSON.stringify(id)}); if (!el) throw new Error('missing ${id}');
      el.value = ${JSON.stringify(String(v))}; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); return el.value; })()`);
  }
}
export async function readBadges(page) {
  return page.eval(`({ status: document.getElementById('statusLine').textContent,
     solver: document.getElementById('solverBadge').textContent, resolution: document.getElementById('resolutionBadge').textContent,
     diagnostics: document.getElementById('solverDiagnostics').innerText })`);
}
export async function runVlm(page) {
  await page.eval("document.getElementById('runVlmButton').click()");
  await new Promise((r) => setTimeout(r, 500));
  await page.waitFor("!document.getElementById('solverBadge').textContent.includes('Running')", 120000);
  return readBadges(page);
}
export async function download(page, button, dir) {
  mkdirSync(dir, { recursive: true });
  await page.setDownload(dir);
  await page.eval(`document.getElementById(${JSON.stringify(button)}).click()`);
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    const files = readdirSync(dir).filter((f) => !f.endsWith('.crdownload'));
    if (files.length) return files.map((f) => join(dir, f));
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`no download in ${dir}`);
}
