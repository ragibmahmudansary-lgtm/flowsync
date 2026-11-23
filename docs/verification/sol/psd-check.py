"""Challenge the existing random PSD claim by spectral decomposition.

Run after probes.mjs; requires NumPy. Implements the 2-D kernel independently
using arrays, without importing JavaScript or the implementation's reference.
"""
import json
from pathlib import Path
import numpy as np

here = Path(__file__).resolve().parent
panels = json.loads((here / 'psd-panels.json').read_text())
a = np.deg2rad(5)
ew = np.array([np.cos(a), 0, np.sin(a)])
A = np.array([p['boundA'] for p in panels])
B = np.array([p['boundB'] for p in panels])
mid = (A+B)/2
Q = np.zeros((len(panels), len(panels)))
for ends, sign in [(A, -1), (B, 1)]:
    r = mid[:, None, :] - ends[None, :, :]
    r -= np.einsum('ijk,k->ij', r, ew)[:, :, None]*ew
    r2 = np.sum(r*r, axis=2)
    v = sign*np.cross(ew, r)/(2*np.pi*r2[:, :, None])
    Q += 0.5*1.225*np.einsum('ijk,ik->ij', v, np.cross(B-A, ew))
eigenvalues, vectors = np.linalg.eigh((Q+Q.T)/2)
result = dict(rho=1.225, ew=ew.tolist(), gamma=vectors[:, 0].tolist(),
              minEigenvalue=float(eigenvalues[0]),
              maxEigenvalue=float(eigenvalues[-1]),
              negativeEigenvalueCount=int(sum(eigenvalues < -1e-10)),
              computedDrag=float(vectors[:, 0]@Q@vectors[:, 0]))
(here/'psd-counterexample.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['gamma','ew']}))
