"""Independent rectangular-wing Glauert oracle using analytic Galerkin integrals.

Unlike the production tests' theta collocation and handwritten elimination,
this projects alpha*sin(theta)=sum A_n*sin(n*theta)*(sin(theta)/mu+n)
onto odd sine modes and uses NumPy's LAPACK solve. a0=2*pi; mu=a0/(4*AR).
"""
import json
from pathlib import Path
import numpy as np
rows=[]
for ar in [4,6,8,12]:
    for terms in [30,60,120]:
        n=np.arange(1,2*terms,2,dtype=float)
        k=n[:,None]
        integ=1/(1-(k-n)**2)-1/(1-(k+n)**2)
        mu=2*np.pi/(4*ar)
        matrix=integ/mu+np.diag(n*np.pi/2)
        rhs=np.zeros(terms);rhs[0]=np.pi/2  # unit alpha (linear equations)
        A=np.linalg.solve(matrix,rhs)
        cl=np.pi*ar*A[0]; cdi=np.pi*ar*np.sum(n*A*A)
        rows.append(dict(ar=ar,terms=terms,clAlpha=float(cl),
                         dragPerClSquared=float(cdi/cl**2),
                         e=float(cl**2/(np.pi*ar*cdi))))
print(json.dumps(rows,indent=2))
Path(__file__).with_name('llt-results.json').write_text(json.dumps(rows,indent=2)+'\n')
