import {readFileSync,writeFileSync} from 'node:fs';
import * as dut from '../../../src/vlmSolver.js';
const out=new URL('.',import.meta.url);
const wing={name:'wing',spanM:8,rootChordM:1,tipChordM:1};
const canard={name:'canard',spanM:3,rootChordM:.5,tipChordM:.5,xLeadingRootM:-4};
const options={surfaces:[wing,canard],velocityMS:40,densityKgM3:1.225,refAreaM2:8,refChordM:1,referencePoint:[.4,0,0],alphaMinDeg:0,alphaMaxDeg:4,alphaStepDeg:4};
const badgeInvalid=[];
for(const chordwiseRows of [4,8]) {
 const r=dut.runVlmSweep({...options,chordwiseRows});
 badgeInvalid.push({chordwiseRows,validity:r.validity,points:r.series.map(({alphaDeg,cl,cdi,validity})=>({alphaDeg,cl,cdi,validity}))});
}
const inputIdentity=dut.runVlmResolutionCheck(options).inputIdentity;
const changedIdentity=dut.runVlmResolutionCheck({...options,surfaces:[wing,{...canard,xLeadingRootM:4,zRootM:.6}]}).inputIdentity;
const neutralPoint=[];
for(const x of [0,.2,.25,.3,.6]) {
 const r=dut.runVlmSweep({...options,surfaces:[wing],referencePoint:[x,0,0],alphaMinDeg:-4,alphaMaxDeg:4,alphaStepDeg:2});
 neutralPoint.push({x,np:r.neutralPointXM,clAlphaPerRad:r.clAlphaPerRad,cmAlphaPerRad:r.cmAlphaPerRad,cmFit:r.fit.cm});
}
// A separately written scalar slicer, different loop/control structure from
// oracle.py's vectorized intersections; endpoint stations + trapezoidal rule.
const data=JSON.parse(readFileSync(new URL('measurements.json',out)));
const triangles=data.recognition.triangles;
let lo=Infinity,hi=-Infinity;
for(const t of triangles) for(const i of [1,4,7]) {lo=Math.min(lo,t[i]);hi=Math.max(hi,t[i]);}
const slices=[];
for(const n of [200,400,800,1600]) {
 const chords=[];
 for(let j=0;j<=n;j++) {
  const y=lo+(hi-lo)*(j===0?1e-9:j===n?n-1e-9:j)/n;
  let xmin=Infinity,xmax=-Infinity;
  for(const t of triangles) {
   for(const [ia,ib] of [[0,3],[3,6],[6,0]]) {
    const ya=t[ia+1],yb=t[ib+1];
    if((ya<y && yb>=y)||(yb<y && ya>=y)) {
     const x=t[ia]+(t[ib]-t[ia])*(y-ya)/(yb-ya);
     xmin=Math.min(xmin,x);xmax=Math.max(xmax,x);
    }
   }
  }
  chords.push(Number.isFinite(xmin)?xmax-xmin:0);
 }
 const area=(chords.reduce((a,b)=>a+b,0)-(chords[0]+chords.at(-1))/2)*(hi-lo)/n;
 slices.push({n,areaM2:area});
}
const result={badgeInvalid,inputIdentityCollision:JSON.stringify(inputIdentity)===JSON.stringify(changedIdentity),inputIdentity,changedIdentity,neutralPoint,slices};
writeFileSync(new URL('edge-probe-results.json',out),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
