"""Independent analytic/numerical oracles; no production imports or source reads.

Reads measured inputs/outputs from measure.mjs. LLT uses Gauss integration of
the sine-series Galerkin equations; finite segments use axial/perpendicular
coordinates rather than the production cross-product expression. VLM geometry
is reconstructed from input dimensions, not copied from production panels.
"""
import json
from pathlib import Path
import numpy as np
from numpy.polynomial.legendre import leggauss

HERE = Path(__file__).resolve().parent
data = json.loads((HERE / 'measurements.json').read_text())
report = {}

def llt(ar, terms):
    # Gamma(theta)=2 b U sum A_n sin(n theta), a0=2 pi.
    # Project alpha*sin(theta) onto odd sin(m theta).
    nodes, weights = leggauss(600)
    theta=(nodes+1)*np.pi/2
    weights=weights*np.pi/2
    n=np.arange(1,2*terms,2)
    sine=np.sin(theta[:,None]*n)
    mat=np.diag(n.astype(float)) + (4*ar/np.pi**2) * (sine.T @ ((weights*np.sin(theta))[:,None]*sine))
    a=np.linalg.solve(mat, np.eye(terms)[0])
    return {'slope':float(np.pi*ar*a[0]),'dragPerClSquared':float(np.sum(n*a*a)/(np.pi*ar*a[0]**2))}

report['llt']=[]
for row in data['rectangles']:
    ar=row['ar']; fine=llt(ar,120); coarse=llt(ar,60)
    measured=row['cl']/np.deg2rad(4)
    ratio=row['cdi']/(fine['dragPerClSquared']*row['cl']**2)
    e=row['cl']**2/(np.pi*ar*row['cdi'])
    report['llt'].append({'ar':ar,'referenceSlope':fine['slope'],'vlmTwoPointSlope':measured,
       'slopeRelativeError':measured/fine['slope']-1,'matchedClDragRatio':ratio,'e':e,
       'oracle60to120RelativeChange':fine['slope']/coarse['slope']-1,
       'pass':bool(abs(measured/fine['slope']-1)<=.05 and .90<=ratio<=1.05 and .90<=e<=1.02) if ar>=6 else 'reported, AR4 not gated'})

def segment(p,a,b):
    d=b-a; length=np.linalg.norm(d)
    if length==0: return np.zeros(3)
    t=d/length; u=np.dot(p-a,t); radial=(p-a)-u*t; h2=np.dot(radial,radial)
    if h2<1e-28: return np.zeros(3) # only exact collinearity in these fixtures
    cos0=u/np.sqrt(u*u+h2); cos1=(u-length)/np.sqrt((u-length)**2+h2)
    return np.cross(t,radial)*(cos0-cos1)/(4*np.pi*h2)

def build(s,m,n):
    b=s['spanM']; cr=s['rootChordM']; ct=s['tipChordM']
    sweep=np.deg2rad(s.get('sweepDeg',0)); dih=np.deg2rad(s.get('dihedralDeg',0)); inc=np.deg2rad(s.get('incidenceDeg',0))
    d=np.array([np.cos(inc),0,-np.sin(inc)])
    def point(y,f):
        c=cr+(ct-cr)*abs(2*y/b)
        q=np.array([s.get('xLeadingRootM',0)+cr/4+abs(y)*np.tan(sweep),y,s.get('zRootM',0)+abs(y)*np.tan(dih)])
        return q+(f-.25)*c*d
    panels=[]
    for i in range(n):
        y0=-b/2+b*i/n; y1=-b/2+b*(i+1)/n
        for k in range(m):
            a=point(y0,(k+.25)/m); b1=point(y1,(k+.25)/m)
            cp=point((y0+y1)/2,(k+.75)/m)
            norm=np.cross(d,b1-a); norm=norm/np.linalg.norm(norm)
            if norm[2]<0: norm=-norm
            panels.append((a,b1,(a+b1)/2,cp,norm))
    return panels

def independent_drag(panels,gamma,rho,ew):
    terms=[]
    for i,(a,b,mid,_,_) in enumerate(panels):
        vel=np.zeros(3)
        for j,(aa,bb,_,_,_) in enumerate(panels):
            for anchor,sign in [(aa,-1),(bb,1)]:
                delta=mid-anchor; r=delta-ew*np.dot(delta,ew); r2=np.dot(r,r)
                if r2>1e-28: vel+=sign*gamma[j]*np.cross(ew,r)/(2*np.pi*r2)
        terms.append(.5*rho*gamma[i]*np.dot(vel,np.cross(b-a,ew)))
    return float(sum(terms))

report['independentVlm']=[]
for case in data['independentVlm']:
    o=case['options']; panels=build(o['surfaces'][0],4,16)
    alpha=np.deg2rad(o['alphaDeg']); ew=np.array([np.cos(alpha),0,np.sin(alpha)])
    wake=max(20*o['refChordM'],10*o['surfaces'][0]['spanM'])
    def horseshoe(p,panel,bound=True):
        a,b,_,_,_=panel
        return segment(p,a+wake*ew,a)+segment(p,b,b+wake*ew)+(segment(p,a,b) if bound else np.zeros(3))
    mat=np.array([[np.dot(horseshoe(p[3],q),p[4]) for q in panels] for p in panels])
    rhs=np.array([-np.dot(o['velocityMS']*ew,p[4]) for p in panels])
    gamma=np.linalg.solve(mat,rhs)
    forces=[]; moments=[]
    for i,p in enumerate(panels):
        v=o['velocityMS']*ew+sum((gamma[j]*horseshoe(p[2],q,j!=i) for j,q in enumerate(panels)),np.zeros(3))
        force=o['densityKgM3']*gamma[i]*np.cross(v,p[1]-p[0])
        forces.append(force); moments.append(np.cross(p[2]-o['referencePoint'],force))
    force=np.sum(forces,axis=0); moment=np.sum(moments,axis=0)
    qS=.5*o['densityKgM3']*o['velocityMS']**2*o['refAreaM2']
    cl=np.dot(force,[-np.sin(alpha),0,np.cos(alpha)])/qS
    cdi=independent_drag(panels,gamma,o['densityKgM3'],ew)/qS
    cm=moment[1]/qS/o['refChordM']
    coordinates=max(np.max(np.abs(np.array([p[j] for p in panels])-np.array([p[k] for p in case['panels']]))) for j,k in [(0,'boundA'),(1,'boundB'),(3,'controlPoint'),(4,'normal')])
    errors={k:float(abs(v/case[k]-1)) for k,v in [('cl',cl),('cdi',cdi),('cm',cm)]}
    errors['circulationMaxRelative']=float(np.max(np.abs(gamma-case['circulation']))/np.max(np.abs(gamma)))
    report['independentVlm'].append({'surface':o['surfaces'][0],'cl':float(cl),'cdi':float(cdi),'cm':float(cm),'geometryMaxAbsError':float(coordinates),'errors':errors,'tolerance':1e-9,'pass':bool(max(errors.values())<=1e-9 and coordinates<=1e-12)})

report['horseshoe']=[{'qS':r['qS'],'expected':1/np.pi,'actual':r['dragNTrefftz'],'relativeError':r['dragNTrefftz']*np.pi-1,'tolerance':1e-12} for r in data['unitHorseshoe']]
report['elliptic']=[{'n':r['n'],'expected':np.pi/8,'actual':r['dragNTrefftz'],'relativeError':r['dragNTrefftz']/(np.pi/8)-1,'tolerance':.01,'pass':abs(r['dragNTrefftz']/(np.pi/8)-1)<.01} for r in data['prescribedElliptic']]
base=next(r for r in data['scales'] if r['scale']==1)
report['scale']=[{'scale':r['scale'],**{k:r[k]/base[k]-1 for k in ['cl','cdi','cm']},'circulationMaxRelative':float(np.max(np.abs(np.array(r['circulation'])/r['scale']-base['circulation']))/max(np.abs(base['circulation']))),'status':r['validity']['status']} for r in data['scales']]
report['kernel']=[]
for r in data['kernels']:
    s=r['scale'];h=r['h'];expected=1/(4*np.pi*s*h*np.sqrt(.25+h*h))
    report['kernel'].append({**r,'expectedZ':expected,'relativeError':r['value'][2]/expected-1,'interpretation':'intentional cutoff; must count truncation' if h<1e-6 else 'analytic check, tolerance 1e-9'})

def fit(points,key):
    p=[r for r in points if abs(r['alphaDeg'])<=5+1e-9 and r['validity']['status']!='invalid']
    if len(p)<3:return {'status':'insufficient linear data'}
    x=np.array([r['alphaDeg'] for r in p]);y=np.array([r[key] for r in p]);c=np.polyfit(x,y,1)
    maxdev=max(np.abs(np.diff(y)/np.diff(x)-c[0]));passed=maxdev<=.05*abs(c[0])
    return {'status':'determined' if passed else 'non-linear: not determined','slopePerDeg':float(c[0]),'intercept':float(c[1]),'maxDeviation':float(maxdev)}
report['fits']=[]
for row in data['fits']+[data['trimRoundTrip']]:
    entry={}
    for key in ['cl','cm']:
        ref=fit(row['series'],key);actual=row['fit'][key]
        entry[key]={'reference':ref,'actual':actual,'statusMatches':ref['status']==actual['status']}
        if actual['status']=='determined': entry[key]['maxAbsError']=max(abs(ref[k]-actual[k]) for k in ['slopePerDeg','intercept'])
    entry.update(trim=row['trimAlphaDeg'],trimStatus=row['trimStatus'])
    report['fits'].append(entry)
report['trimRoundTrip']={k:data['trimRoundTrip'][k] for k in ['target','trimAlphaDeg','directCm','trimStatus']}
ref=data['moments'][0];report['momentTransfer']=[]
for r in data['moments'][1:]:
    delta=-np.array(r['referencePoint']);force=np.array(ref['force'])
    expected=ref['cm']+(delta[2]*force[0]-delta[0]*force[2])/(.5*1.225*40**2*8)
    report['momentTransfer'].append({'referencePoint':r['referencePoint'],'expected':expected,'actual':r['cm'],'absError':abs(r['cm']-expected),'tolerance':1e-12})

# Triangle-plane intersections (400 midpoint stations); wholly independent of
# the production vertex bins. Integrate only the selected outboard triangles.
tri=np.array(data['recognition']['triangles']).reshape(-1,3,3)
ymin=tri[:,:,1].min();ymax=tri[:,:,1].max();chords=[]
for y in ymin+(np.arange(400)+.5)*(ymax-ymin)/400:
    xs=[]
    for i,j in [(0,1),(1,2),(2,0)]:
        a=tri[:,i,:];b=tri[:,j,:];mask=(a[:,1]<=y)&(b[:,1]>y)|(b[:,1]<=y)&(a[:,1]>y)
        aa=a[mask];bb=b[mask];t=(y-aa[:,1])/(bb[:,1]-aa[:,1]);xs.extend(aa[:,0]+t*(bb[:,0]-aa[:,0]))
    chords.append(max(xs)-min(xs) if len(xs) else 0)
area=float(sum(chords)*(ymax-ymin)/400)
# The historical 22.66 value additionally clips integration at y=8; centroid
# selection alone admits triangles with vertices down to y=6.9805. Record both
# domains rather than silently treating their area values as interchangeable.
clipped=[]
for y in 8+(np.arange(400)+.5)*(ymax-8)/400:
    xs=[]
    for i,j in [(0,1),(1,2),(2,0)]:
        a=tri[:,i,:];b=tri[:,j,:];mask=(a[:,1]<=y)&(b[:,1]>y)|(b[:,1]<=y)&(a[:,1]>y)
        aa=a[mask];bb=b[mask];t=(y-aa[:,1])/(bb[:,1]-aa[:,1]);xs.extend(aa[:,0]+t*(bb[:,0]-aa[:,0]))
    clipped.append(max(xs)-min(xs) if len(xs) else 0)
clipped_area=float(sum(clipped)*(ymax-8)/400)
report['recognition']={'oracleAreaM2':area,'fullSelectedTriangleYBounds':[float(ymin),float(ymax)],'oracleClippedAtY8AreaM2':clipped_area,'productionAreaM2':data['recognition']['areaM2'],'relativeError':data['recognition']['areaM2']/area-1,'productionValid':data['recognition']['valid'],'tolerance':.02,'pass':abs(data['recognition']['areaM2']/area-1)<=.02}
(HERE/'oracle-results.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
