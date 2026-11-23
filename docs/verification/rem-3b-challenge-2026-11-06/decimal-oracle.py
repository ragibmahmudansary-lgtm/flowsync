from decimal import Decimal, localcontext
import json
cases=[['0','1e-323','5e-324'],['-1e-323','1e-323','5e-324'],['0.1','0.3','0.1'],['-0.3','0.3','0.2'],['1e20','1.0000000000000007e20','20000'],['0','1e-300','5e-301'],['0','0.9999999999999998','1']]
with localcontext() as ctx:
 ctx.prec=1200
 out=[]
 for a,b,s in cases:
  a,b,s=map(Decimal,(a,b,s)); n=int((b-a)//s)
  out.append([float(a),float(b),float(s),[float(a+i*s) for i in range(n+1)]])
 print(json.dumps(out,allow_nan=False))
