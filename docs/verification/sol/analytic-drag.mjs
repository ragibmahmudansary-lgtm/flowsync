// Prescribed elliptic LOADING: independent analytic oracle D=rho*pi*G0^2/8.
// No circulation solve, no planform assumption, no MiMo reference functions.
import {trefftzDrag} from '../../../src/vlmSolver.js';
import {readFileSync,writeFileSync} from 'node:fs';
const results=[];
for (const N of [16,32,64,128,256,512]) {
  const panels=[],gamma=[];
  for (let i=0;i<N;i++) {
    const y0=-4+8*i/N,y1=-4+8*(i+1)/N,ym=(y0+y1)/2;
    panels.push({boundA:[0,y0,0],boundB:[0,y1,0],boundMidpoint:[0,ym,0]});
    gamma.push(Math.sqrt(1-(ym/4)**2));
  }
  const actual=trefftzDrag(panels,gamma,1,[1,0,0]).dragNTrefftz;
  results.push({N,actual,expected:Math.PI/8,relativeError:actual/(Math.PI/8)-1});
}
const p=JSON.parse(readFileSync(new URL('./psd-panels.json',import.meta.url)));
const c=JSON.parse(readFileSync(new URL('./psd-counterexample.json',import.meta.url)));
try { trefftzDrag(p,c.gamma,c.rho,c.ew); results.push({psd:'unexpected acceptance'}); }
catch(e){results.push({psdError:e.message});}
console.log(JSON.stringify(results,null,2));
writeFileSync(new URL('./analytic-results.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
