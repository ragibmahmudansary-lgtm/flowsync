import { performance } from 'node:perf_hooks';
import { generateVlmPanels, runVlmResolutionCheck, runVlmSweep } from '../../../src/vlmSolver.js';

const base = {
  surfaces: [{name: 'Wing', spanM: 10, rootChordM: 1, tipChordM: 1}],
  velocityMS: 40, densityKgM3: 1.225, refAreaM2: 10, refChordM: 1
};
function time(label, options, run) {
  const start = performance.now();
  const cpu = process.cpuUsage();
  const before = process.memoryUsage().rss;
  const result = run(options);
  const used = process.cpuUsage(cpu);
  console.log(JSON.stringify({ label, elapsedMs: performance.now() - start,
    cpuMs: (used.user + used.system) / 1000, rssBeforeBytes: before,
    rssAfterBytes: process.memoryUsage().rss, maxRssKiB: process.resourceUsage().maxRSS,
    result }));
}
for (const [rows, strips, points] of [[4,40,17], [8,80,2], [16,128,1], [16,128,2], [8,80,17]]) {
  const options = {...base, chordwiseRows: rows, spanwisePanels: strips, alphaMinDeg: 0,
    alphaMaxDeg: points === 2 ? 4 : points - 1, alphaStepDeg: points === 2 ? 4 : 1};
  time(`sweep ${rows}x${strips} / ${points}`, options, opts => {
    const result = runVlmSweep(opts);
    return { panels: result.panels.length, points: result.series.length };
  });
}
for (const [rows, strips] of [[4,40], [8,64], [8,128], [16,240]]) {
  const options = {...base, chordwiseRows: rows, spanwisePanels: strips};
  time(`resolution ${rows}x${strips}`, options, opts => {
    try {
      const result = runVlmResolutionCheck(opts);
      return { plottedPanels: generateVlmPanels(opts.surfaces, opts).length,
        lattices: result.inputIdentity.lattices, claim: result.claim };
    } catch (error) {
      return { error: error.message };
    }
  });
}
