const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]};
const cr=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+0.05)/(y+0.05)};
const T={s0:'#080c11',s1:'#0e141b',s2:'#141c25',s3:'#1b2531',s4:'#243140',ink:'#e8eef4',ink2:'#c3cfdb',muted:'#9aaabb',line:'#2a3644',lineStrong:'#5d7085',accent:'#6cb2ff',onAccent:'#06101c',
 infoBg:'#12263b',infoFg:'#a9d1ff',goodBg:'#0f2b1f',goodFg:'#79e0ae',goodBd:'#2c6a4c',warnBg:'#33260b',warnFg:'#f6c46b',warnBd:'#7a5a1c',badBg:'#3a151b',badFg:'#ff9aa3',focus:'#ffd166',
 serBlue:'#6cb2ff',serTeal:'#3fd6d0',serRed:'#ff8a94',serGreen:'#62d79c',serAmber:'#f2b457',canvasMuted:'#9aaabb',gridLine:'#243140',zero:'#6b7f94'};
globalThis.T=T;
const rows=[];
const chk=(n,fg,bg,min)=>{const r=cr(T[fg],T[bg]);rows.push([n,T[fg],T[bg],r.toFixed(2),min,r>=min?'PASS':'FAIL'])};
for(const bg of ['s0','s1','s2','s3']){chk(`ink on ${bg}`,'ink',bg,4.5);chk(`ink2 on ${bg}`,'ink2',bg,4.5);chk(`muted on ${bg}`,'muted',bg,4.5);chk(`accent on ${bg}`,'accent',bg,4.5)}
chk('muted on s4','muted','s4',4.5);chk('ink on s4','ink','s4',4.5);
chk('onAccent on accent (primary btn)','onAccent','accent',4.5);
chk('info badge','infoFg','infoBg',4.5);chk('good badge','goodFg','goodBg',4.5);chk('warn badge','warnFg','warnBg',4.5);chk('bad text on badBg','badFg','badBg',4.5);
chk('warn text on warn bg (list)','warnFg','warnBg',4.5);
chk('warnFg on s2','warnFg','s2',4.5);chk('badFg on s2','badFg','s2',4.5);chk('goodFg on s2','goodFg','s2',4.5);
chk('lineStrong (control border) on s2','lineStrong','s2',3);chk('lineStrong on s3','lineStrong','s3',3);chk('lineStrong on s1','lineStrong','s1',3);
chk('focus ring on s1','focus','s1',3);chk('focus ring on s3','focus','s3',3);
for(const k of ['serBlue','serTeal','serRed','serGreen','serAmber','zero'])chk(`${k} on canvas s2`,k,'s2',3);
for (const r of rows) console.log(`| ${r[0]} | ${r[1]} on ${r[2]} | ${r[3]}:1 | ${r[4]}:1 | ${r[5]} |`);
