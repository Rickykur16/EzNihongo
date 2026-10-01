// Animasi carousel → video 9:16. render(t) deterministik; window.CUES = efek suara (sfx.py).
const $=s=>document.querySelector(s);
const cl=(x,a=0,b=1)=>Math.min(b,Math.max(a,x)), seg=(t,a,b)=>cl((t-a)/(b-a));
const eo5=x=>1-Math.pow(1-x,5), eo=x=>1-Math.pow(1-x,3), eio=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
const eback=x=>{const c=1.7;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2)};
const lerp=(a,b,x)=>a+(b-a)*x;
const DUR=[3.6,4.8,4.4,4.2,4.4,5.0,4.6];           // lama tiap slide (detik)
const T0=[]; DUR.reduce((a,d,i)=>(T0[i]=a,a+d),0);
const TOTAL=DUR.reduce((a,b)=>a+b,0); window.DURATION=TOTAL;
const TR=.38;                                       // durasi transisi geser
const S=[...document.querySelectorAll('#stage .s')];
const BGS=S.map(s=>{const cs=getComputedStyle(s);return {c:cs.backgroundColor,i:cs.backgroundImage,p:cs.backgroundPosition};});
// elemen yang dianimasikan per slide (urutan DOM), plus baris checklist satu per satu
const EL=S.map((s,si)=>{
  const list=[];
  [...s.children].forEach(ch=>{ if(ch.classList.contains('grain')) return;
    if(ch.querySelector('.chk')){ const h=ch.querySelector('.A'); if(h) list.push(h); ch.querySelectorAll('.chk').forEach(c=>list.push(c)); return; }
    list.push(ch); });
  return list.map((el,i)=>{ const kind=el.classList.contains('stamp')?'stamp':(el.classList.contains('chip')||el.classList.contains('sticker'))?'pop':
      el.classList.contains('A')?'head':el.classList.contains('page')||el.classList.contains('handle')||el.classList.contains('margin')||el.classList.contains('tape')?'quiet':'rise';
    return {el,base:el.style.transform||'',kind,i}; });
});
// jadwal masuk tiap elemen: judul dulu, lalu sisanya berurutan; stempel paling akhir
EL.forEach((list,si)=>{ let k=0; const t0=T0[si]+.12;
  list.forEach(o=>{ if(o.kind==='quiet'){o.at=t0;return;}
    if(o.kind==='stamp'){o.at=t0+1.55;return;}
    o.at=t0+.08+k*(si===1||si===3?.26:.32); k++; }); });
window.CUES=[[0,'riser'],[.35,'boom']];
EL.forEach((list,si)=>{ if(si>0) window.CUES.push([+(T0[si]-.12).toFixed(3),'whoosh',si%2?1:-1]);
  list.forEach((o,j)=>{ if(o.kind==='quiet') return;
    if(o.kind==='stamp') window.CUES.push([+(o.at+.05).toFixed(3),'impact',1]);
    else if(o.kind==='pop') window.CUES.push([+(o.at+.03).toFixed(3),'pop',j%7]);
    else if(o.el.classList.contains('chk')) window.CUES.push([+(o.at+.18).toFixed(3),'tick',j%5]);
    else if(o.kind==='head') window.CUES.push([+(o.at).toFixed(3),'whoosh_soft',1]);
    else window.CUES.push([+(o.at+.02).toFixed(3),'pop',(j+2)%7]); }); });
window.CUES.push([T0[6]+.1,'boom'],[T0[6]+.5,'shimmer'],[TOTAL-1.2,'sparkle']);
window.CUES.sort((a,b)=>a[0]-b[0]);

function slideOf(t){ let i=0; T0.forEach((a,k)=>{ if(t>=a) i=k; }); return i; }
function drawSlide(si,t,x){ const s=S[si]; s.style.display='block';
  const life=t-T0[si];
  s.style.transform=`translateX(${x}px) scale(${lerp(1,1.025,cl(life/DUR[si]))})`;
  EL[si].forEach(o=>{ const p=seg(t,o.at,o.at+(o.kind==='head'?.5:.42)), e=eo5(p), el=o.el;
    if(o.kind==='quiet'){ el.style.opacity=cl(p*2); return; }
    el.style.opacity=o.kind==='stamp'?(p>0?1:0):cl(p*2.2);
    if(o.kind==='stamp'){ const q=seg(t,o.at,o.at+.22);
      el.style.transform=`${o.base} scale(${lerp(2.6,1,eo5(q))})`; el.style.filter=`blur(${(1-q)*6}px)`; return; }
    if(o.kind==='pop'){ el.style.transform=`${o.base} scale(${lerp(.4,1,eback(p))})`; el.style.filter=`blur(${(1-e)*8}px)`; return; }
    if(o.kind==='head'){ el.style.clipPath=`inset(0 0 ${(1-e)*100}% 0)`; el.style.transform=`${o.base} translateY(${(1-e)*-30}px)`; el.style.filter=''; return; }
    el.style.transform=`${o.base} translateY(${(1-e)*60}px)`; el.style.filter=`blur(${(1-e)*12}px)`; });
  // centang tergambar
  s.querySelectorAll('.chk').forEach(c=>{ const path=c.querySelector('path'); if(!path) return;
    const o=EL[si].find(q=>q.el===c); const p=eo(seg(t,o.at+.15,o.at+.45)); path.style.strokeDasharray=140; path.style.strokeDashoffset=140*(1-p); });
  // stempel: guncang slide saat mendarat
  const st=EL[si].find(o=>o.kind==='stamp'); if(st){ const x2=t-st.at-.2; if(x2>0&&x2<.35) s.style.transform+=` translate(${Math.sin(x2*80)*12*Math.exp(-x2*10)}px,${Math.cos(x2*70)*8*Math.exp(-x2*10)}px)`; }
}
function setBg(si){ const b=BGS[si]; const g=$('#bg'); g.style.backgroundColor=b.c; g.style.backgroundImage=b.i==='none'?'':b.i; g.style.backgroundPosition='0 '+(285+30)+'px'; }
function render(t){
  S.forEach(s=>s.style.display='none');
  const si=slideOf(t), into=t-T0[si];
  if(si>0&&into<TR){ // geser: slide lama keluar ke kiri, baru masuk dari kanan
    const p=eio(into/TR); setBg(si); drawSlide(si-1,t,-p*1080); drawSlide(si,t,(1-p)*1080);
    $('#bg').style.opacity=1; $('#stage').style.filter=`blur(${Math.sin(p*Math.PI)*6}px)`;
  } else { setBg(si); drawSlide(si,t,0); $('#stage').style.filter=''; }
  // bar progres ala story
  document.querySelectorAll('#bar b').forEach((b,i)=>{ b.style.width=(i<si?100:i===si?cl(into/DUR[si])*100:0)+'%'; });
  const dark=['#111','rgb(17, 17, 17)'].includes(BGS[si].c);
  document.querySelectorAll('#bar i').forEach(i=>i.style.background=dark?'rgba(255,255,255,.22)':'rgba(0,0,0,.16)');
  document.querySelectorAll('#bar b').forEach(b=>b.style.background=dark?'#fff':'#111');
  $('#flash').style.opacity=t<.25?1-t/.25:0;
}
window.render=render;
