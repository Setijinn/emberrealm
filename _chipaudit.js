// FORGE CHIP LABEL AUDIT. Does any material name still get cut off?
//
// WHY THIS EXISTS. The chip label was one nowrap line with an ellipsis, so every generated seed
// read "Riftseed of As..." and the full name lived only in a title attribute -- nothing at all on
// touch. The fix gives the label two lines. But EIGHT CHIPS FIT ON A PHONE SCREEN and there are
// thirty-two materials, so a photograph proves eight names and says nothing about the other
// twenty-four -- and the longest of them, "Riftseed of Shattered Vault" (27 chars), is not one of
// the eight. Looking at a picture cannot answer this. Measuring every chip can.
//
// HOW. Grants one of every material so the pouch holds all of them, opens the real panel, and
// measures each label the way the browser actually laid it out: scrollHeight against clientHeight
// catches a name clamped by -webkit-line-clamp, and scrollWidth against clientWidth catches one
// cut sideways. Both, because the two failures look identical on screen and have different causes.
//
// Read-only with respect to content: it stands up a throwaway account in memory and never saves.
// Run it with `py tools/audit.py _chipaudit.js`.
(function(){
  const L=[];
  const say=(s)=>L.push(s===undefined?'':s);
  const row=(k,v)=>L.push('  '+String(k).padEnd(34,' ')+' '+v);
  const hd=(s)=>{ L.push(''); L.push('--- '+s+' ---'); };
  function dump(){
    const el=document.getElementById('testout');
    if(el) el.textContent=L.join('\n');
    document.title='AUDIT DONE';
  }

  function go(){
    try{
      // A throwaway account, never saved. Same setup as the screenshot rig in _shot.js, which is
      // the shape that is known to make this panel paint.
      users['_chip']={pass:'x',chars:[{cls:'knight',inv:[],rpg:{}}],cur:0,mats:{},vault:[]};
      curUser='_chip';
      rpg={lvl:50,xp:0,relics:[],eqAff:{},pots:5,mpots:5,train:{},scrolls:{},tree:{},perkPts:44};

      // One of everything, so every label in the game is on screen at once. This is the whole
      // point: the photograph could only show eight of the thirty-two.
      for(const k of MAT_KEYS) matAdd(k,1);

      // atForge() reads curShopNear and has no "I opened it here" latch, on purpose -- so standing
      // at the counter is simply saying where the player is, not faking a predicate.
      curShopNear='bram';
      openForge();

      const chips=document.querySelectorAll('#forgeScr .fgChip');
      const labels=document.querySelectorAll('#forgeScr .fgChip b');
      hd('WHAT IS ON SCREEN');
      row('materials in MAT_KEYS', MAT_KEYS.length);
      row('chips painted', chips.length);
      row('labels measured', labels.length);
      if(!labels.length){
        say('  NO LABELS FOUND -- the panel did not paint, so nothing here was measured.');
        return dump();
      }

      // The measurement. A clamped label reports a scrollHeight taller than the box it is allowed
      // to occupy; a sideways-cut one reports a wider scrollWidth. Allow 1px for sub-pixel layout.
      const clippedV=[], clippedH=[], heights={};
      let longest={n:'',len:0};
      labels.forEach((b)=>{
        const t=(b.textContent||'').trim();
        if(t.length>longest.len) longest={n:t,len:t.length};
        if(b.scrollHeight>b.clientHeight+1) clippedV.push(t+'  ('+b.scrollHeight+'>'+b.clientHeight+')');
        if(b.scrollWidth >b.clientWidth +1) clippedH.push(t+'  ('+b.scrollWidth+'>'+b.clientWidth+')');
        const h=b.getBoundingClientRect().height.toFixed(1);
        heights[h]=(heights[h]||0)+1;
      });

      hd('IS ANY NAME CUT OFF');
      row('longest name on screen', '"'+longest.n+'"  ('+longest.len+' chars)');
      row('clamped vertically', clippedV.length ? clippedV.length+'  <-- FAIL' : '0');
      clippedV.forEach(s=>say('    '+s));
      row('cut horizontally', clippedH.length ? clippedH.length+'  <-- FAIL' : '0');
      clippedH.forEach(s=>say('    '+s));

      // A row of chips should keep a straight baseline. If the reserved two-line box is working,
      // every label is the same height whether its own name wrapped or not.
      hd('DO THE ROWS STAY STRAIGHT');
      const hs=Object.keys(heights);
      row('distinct label heights', hs.length + (hs.length===1?'  (uniform)':'  <-- ragged'));
      hs.sort((a,b)=>parseFloat(a)-parseFloat(b)).forEach(h=>row('  '+h+'px', heights[h]+' labels'));

      // And the panel still has to fit the art's field, which is a PERCENTAGE inset -- adding a
      // line to every chip is exactly the kind of change that overflows it.
      hd('DOES THE PANEL STILL FIT ITS FRAME');
      const card=document.getElementById('forgeCard')||document.querySelector('#forgeScr .embCard')
        ||document.querySelector('#forgeScr>div');
      const body=document.getElementById('forgeBody');
      if(card&&body){
        const cr=card.getBoundingClientRect();
        const top=cr.top+cr.height*0.165, bot=cr.bottom-cr.height*0.180;
        const br=body.getBoundingClientRect();
        row('card', Math.round(cr.width)+'x'+Math.round(cr.height));
        row("art's usable field", Math.round(top)+' .. '+Math.round(bot));
        row('forgeBody', Math.round(br.top)+' .. '+Math.round(br.bottom));
        row('within the field', (br.top>=top-1&&br.bottom<=bot+1)?'yes':'NO  <-- FAIL');
        row('body scrolls its content', body.scrollHeight>body.clientHeight
          ? 'yes ('+body.scrollHeight+' in '+body.clientHeight+') -- expected, it is the scroller'
          : 'no');
      } else row('card/body', 'not found -- not measured');

      say();
      say((clippedV.length||clippedH.length) ? 'RESULT  FAIL -- a name is still being cut off.'
        : 'RESULT  PASS -- every one of the '+labels.length+' labels renders in full.');
    }catch(e){
      say('AUDIT THREW: '+(e&&e.message));
      say(e&&e.stack?String(e.stack).split('\n').slice(0,4).join('\n'):'');
    }
    dump();
  }

  if(document.readyState==='complete') setTimeout(go,900);
  else window.addEventListener('load',()=>setTimeout(go,900));
})();
