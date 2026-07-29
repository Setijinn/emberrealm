// Measure the forge panel as it actually renders, at several viewports. Reports into #testout so
// `chrome --headless --dump-dom` can read it back. Measuring beats guessing: the panel "fits"
// according to scrollHeight<=clientHeight while visibly spilling, because equip_panel's usable
// field is a percentage inset and not the padding box.
(function(){
  const L=[];
  const say=s=>L.push(s);
  function dump(){ const el=document.getElementById('testout');
    if(el) el.textContent=L.join('\n'); document.title='MEASURED'; }

  function setup(){
    users['_m']={pass:'x', chars:[{cls:'knight', inv:[], rpg:{}}], cur:0, mats:{}, vault:[]};
    curUser='_m';
    rpg={lvl:50,xp:0,relics:[],eqAff:{},pots:5,mpots:5,train:{},scrolls:{},tree:{},perkPts:44};
    const ch=curChar();
    for(const k of MAT_KEYS) matAdd(k,3);
    for(const k of ['wpn','arm','helm','ring']) ch.inv.push(mkItem(k,SD_T,0,ch.cls));
    curShopNear='bram';
  }

  // The card owns --vH/--vW, so a viewport can be simulated by setting them inline and forcing a
  // SYNCHRONOUS reflow. rAF is throttled to zero in a headless/background tab, so `void
  // offsetHeight` is the only reliable way to make the new values take effect before measuring.
  function atSize(w,h,fn){
    const card=document.querySelector('#forgeScr>#shopCard'); if(!card) return;
    const vH=Math.min(h*0.94, Math.min(w*0.95,432)*600/448);
    const vW=vH*448/600;
    card.style.setProperty('--vH',vH+'px');
    card.style.setProperty('--vW',vW+'px');
    card.style.setProperty('--u',(vH/100)+'px');
    card.style.width=vW+'px'; card.style.height=vH+'px';
    paintForge();
    void card.offsetHeight;
    fn(card,vW,vH);
  }

  function run(){
    setup();
    document.getElementById('forgeScr').style.display='flex';
    openForge();

    for(const [w,h,label] of [[1280,900,'desktop'],[390,844,'phone'],[320,568,'small phone']]){
      atSize(w,h,(card,vW,vH)=>{
        const inner=card.querySelector('#shopInner');
        const body=document.getElementById('forgeBody');
        const u=parseFloat(getComputedStyle(card).getPropertyValue('--u'))||0;
        const chips=body.querySelectorAll('.fgChip');
        const c0=chips[0]?chips[0].getBoundingClientRect():null;
        const strip=body.querySelector('.fgStrip');
        const sects=[...body.querySelectorAll('.embSect')];
        say('== '+label+' '+w+'x'+h+'  card '+Math.round(vW)+'x'+Math.round(vH)+'  --u='+u.toFixed(2)+'px');
        say('   #shopInner  client '+inner.clientWidth+'x'+inner.clientHeight
            +'   scroll '+inner.scrollWidth+'x'+inner.scrollHeight
            +(inner.scrollHeight>inner.clientHeight+1?'   <-- INNER OVERFLOWS':''));
        say('   #forgeBody  client '+body.clientWidth+'x'+body.clientHeight
            +'   scroll '+body.scrollWidth+'x'+body.scrollHeight
            +(body.scrollWidth>body.clientWidth+1?'   <-- SCROLLS SIDEWAYS':''));
        say('   chips '+chips.length+' of '+MAT_KEYS.length
            +(c0?('   first chip '+Math.round(c0.width)+'x'+Math.round(c0.height)+'px'):'   none')
            +(strip?('   strip w '+Math.round(strip.getBoundingClientRect().width)):''));
        // per-row chip count, which is what "only two fit" actually means
        if(chips.length&&strip){
          const rows={}; chips.forEach(c=>{ const t=Math.round(c.getBoundingClientRect().top);
            rows[t]=(rows[t]||0)+1; });
          const counts=Object.keys(rows).map(k=>rows[k]);
          say('   chips per row: '+counts.join(',')+'   rows '+counts.length);
        }
        // the real test: does anything sit outside the ART's usable field?
        const cb=card.getBoundingClientRect();
        const fieldTop=cb.top+cb.height*0.165, fieldBot=cb.bottom-cb.height*0.180;
        const fieldL=cb.left+cb.width*0.16, fieldR=cb.right-cb.width*0.16;
        const spill=[];
        body.querySelectorAll('.fgChip,.fgSlot,.embSect,.fgRec,.mbtn').forEach(el=>{
          const r=el.getBoundingClientRect(); if(!r.width&&!r.height) return;
          if(r.top<fieldTop-1||r.bottom>fieldBot+1||r.left<fieldL-1||r.right>fieldR+1)
            spill.push((el.className||el.tagName)+'@'+Math.round(r.top)+','+Math.round(r.left));
        });
        say('   outside the art field: '+(spill.length?spill.length+' — '+spill.slice(0,4).join(' '):'none'));
        // overlapping section headers, which is what the screenshot showed
        let overlaps=0;
        for(let i=0;i<sects.length;i++){
          const a=sects[i].getBoundingClientRect();
          body.querySelectorAll('.fgChip,.fgSlot').forEach(el=>{
            const b=el.getBoundingClientRect();
            if(a.top<b.bottom&&b.top<a.bottom&&a.left<b.right&&b.left<a.right) overlaps++;
          });
        }
        say('   header/chip overlaps: '+overlaps);
        say('');
      });
    }
  }
  function boot(){ try{ run(); }catch(e){ say('MEASURE THREW: '+(e&&e.stack||e)); } dump(); }
  if(document.readyState==='complete') setTimeout(boot,600);
  else window.addEventListener('load',()=>setTimeout(boot,600));
})();
