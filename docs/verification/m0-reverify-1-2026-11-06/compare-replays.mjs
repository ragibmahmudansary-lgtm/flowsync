import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
const path = name => new URL(name, import.meta.url);
const text = name => readFileSync(path(name), 'utf8');
const json = name => JSON.parse(text(name));
const compressedJson = name => JSON.parse(gunzipSync(readFileSync(path(name))));
const rows = name => text(name).trim().split('\n').filter(Boolean).map(JSON.parse);
const current = rows('entry-sol.out');
const final = rows('final-sol.out');
function diff(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(key => {
    if (isDeepStrictEqual(before[key], after[key])) return [];
    const record = { key, id: after[key]?.id ?? before[key]?.id };
    if (Array.isArray(before)) record.row = Number(key) + 1;
    return [record];
  });
}
const prior = '../rem-3b-r-2026-11-06/';
const frozen = '../independent-2026-11-06/';
const benchmark = current.filter(row => row.id === 'OBS1-projection').map(row => ({
  ar: row.ar, freestream: row.eFreestream, body: row.eBody, bodyPrinted: row.eBody.toFixed(4)
}));
const expected = ['1.0121', '0.9898', '0.9717', '0.9412'];
if (!isDeepStrictEqual(benchmark.map(row => row.bodyPrinted), expected)) throw new Error('sidecar rounding mismatch');
const result = {
  sol: { entryCount: current.length, finalCount: final.length,
    entryVsRem3bR: diff(rows(prior + 'replay-probes.stdout'), current),
    entryVsFrozenIndependent: diff(rows(frozen + 'sol-replay.ndjson'), current),
    finalVsEntry: diff(current, final) },
  edges: { entryVsRem3bR: diff(json(prior + 'replay-edge-probes.stdout'), json('entry-edges.out')),
    finalVsEntry: diff(json('entry-edges.out'), json('final-edges.out')) },
  measurementGroups: { entrySummaryVsRem3bR: diff(json(prior + 'replay-independent-measure.stdout'), json('entry-measure.out')),
    finalFullVsEntry: diff(compressedJson('entry-measurements.json.gz'), compressedJson('final-measurements.json.gz')) },
  finalVsEntryEqual: Object.fromEntries(['analytic', 'psd', 'llt', 'api', 'decimal', 'oracle']
    .map(key => [key, text(`entry-${key}.out`) === text(`final-${key}.out`)])),
  benchmark
};
console.log(JSON.stringify(result, null, 2));
