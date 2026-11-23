// Minimal Chrome DevTools Protocol client for the headless Brave started by the session.
const PORT = 9333;
const base = `http://127.0.0.1:${PORT}`;
export async function newPage(url) {
  const r = await fetch(`${base}/json/new?${url}`, { method: 'PUT' });
  return r.json();
}
export async function closePage(id) { await fetch(`${base}/json/close/${id}`); }
export class Page {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.ready = new Promise((resolve, reject) => { this.ws.onopen = resolve; this.ws.onerror = reject; });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id);
        this.pending.delete(m.id);
        if (m.error) rej(new Error(m.error.message)); else res(m.result);
      }
    };
  }
  async send(method, params = {}) {
    await this.ready;
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => this.pending.set(id, { res, rej }));
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400));
    return r.result.value;
  }
  async waitFor(expr, timeoutMs = 30000) {
    const t0 = Date.now();
    let last;
    while (Date.now() - t0 < timeoutMs) {
      try { last = await this.eval(expr); if (last) return last; } catch (e) { last = e.message; }
      await new Promise((r) => setTimeout(r, 300));
    }
    throw new Error(`timeout waiting for: ${expr} (last: ${String(last).slice(0, 200)})`);
  }
  async setDownload(dir) { await this.send('Page.enable'); await this.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: dir }); }
  close() { this.ws.close(); }
}
