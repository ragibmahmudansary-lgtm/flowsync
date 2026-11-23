import {readFileSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
const read = path => readFileSync(path, 'utf8');
const json = path => JSON.parse(read(path));
const jsonl = path => read(path).trim().split('\n').map(line => JSON.parse(line));
const current = new URL('.', import.meta.url).pathname;
const prior = current + '../rem-3b-sol-2026-11-06/';
const old = current + '../independent-2026-11-06/';
const mirror = read(current + 'replay-mirror.txt').trim();

function summarize(before, after) {
  const changes = [];
  const metrics = /(^|\.)(cl|cdi|cm|cdiNearField|maxPanelForce|dragNTrefftzRaw|dragNNearFieldRaw)(\.|$)/;
  let metricMaxRelative = {error: 0};
  const categorical = [];
  function compare(a, b, path, keys) {
    if (isDeepStrictEqual(a, b)) return;
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) compare(a[key], b[key], path + '.' + key, keys);
    } else {
      keys.push(path);
      if (typeof a === 'number' && typeof b === 'number') {
        if (metrics.test(path) && a && Math.abs(b / a - 1) > metricMaxRelative.error) {
          metricMaxRelative = {path, error: Math.abs(b / a - 1), before: a, after: b};
        }
      } else if (!path.includes('.messages.') && !path.includes('Suppression.')) {
        categorical.push({path, before: a, after: b});
      }
    }
  }
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const keys = [];
    const a = before[key], b = after[key];
    compare(a, b, key, keys);
    if (keys.length) changes.push({key, id: b?.id ?? a?.id, changedFields: keys.length});
  }
  return {changes, metricMaxRelative, categorical};
}
const sol = jsonl(current + 'replay-probes.stdout');
const api = jsonl(current + 'replay-api.stdout');
const analytic = json(current + 'replay-analytic-drag.stdout');
const edges = json(current + 'replay-edge-probes.stdout');
const report = {
  solRows: sol.length, apiRows: api.length, analyticRows: analytic.length,
  solVsImmediate: summarize(jsonl(prior + 'replay-probes.stdout'), sol),
  solVsFrozenIndependent: summarize(jsonl(old + 'sol-replay.ndjson'), sol),
  analytic: summarize(json(prior + 'replay-analytic-drag.stdout'), analytic),
  edges: summarize(json(prior + 'replay-edge-probes.stdout'), edges),
  api: summarize(jsonl(prior + 'api-post.jsonl'), api),
  decimalOracleExact: isDeepStrictEqual(json(current + 'replay-decimal.stdout'), json(prior + 'decimal-oracle.json')),
  independent: summarize(
    json(mirror + '/docs/verification/independent-2026-11-06/measurements.json'),
    json(mirror + '/post-measurements.json')
  )
};
console.log(JSON.stringify(report, null, 2));
