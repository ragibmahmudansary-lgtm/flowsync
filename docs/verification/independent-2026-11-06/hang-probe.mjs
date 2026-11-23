// Must be run with an external timeout. A finite alpha whose increment rounds
// back to itself reproduces OBS-M0-5-4 without allocating a large lattice.
import {runVlmSweep} from '../../../src/vlmSolver.js';
runVlmSweep({surfaces:[{spanM:8,rootChordM:1,tipChordM:1}],chordwiseRows:1,spanwisePanels:4,
  alphaMinDeg:1e17,alphaMaxDeg:1e17,alphaStepDeg:1,
  velocityMS:40,densityKgM3:1.225,refAreaM2:8,refChordM:1});
console.log('completed');
