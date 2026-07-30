// DOES EVERY PANEL FIT THE SCREEN IT IS ON? Measured, at whatever viewport Chrome was given.
//
// WHY THIS EXISTS. This is a mobile-first PWA and, until now, every screenshot and every headless run
// this project had ever done was a desktop window -- 1280x720 for the shot tools, an implicit 800x600
// for the audits. Two layout faults had shipped and been looked at repeatedly without being seen: the
// zone plaque drawn underneath the HUD's button row, and a minimap taking 39% of a phone's height.
// Photographs found those two because someone finally took one at 667x375. Photographs do not scale to
// twenty panels, so this measures instead.
//
// It opens every panel in turn and asks three questions of each:
//   * does it scroll SIDEWAYS?  The project's rule is that the page body never scrolls horizontally
//     and any wide content (a table, a strip of chips) scrolls inside its own container. A panel whose
//     own scrollWidth exceeds its client width has content the player cannot reach at all, because
//     there is no horizontal scrollbar on a touch device to find.
//   * is any of it OUTSIDE the viewport?  A card wider or taller than the screen is clipped by the
//     window, not by a scroller, so what falls off is simply gone.
//   * does its scroller have MORE than the frame shows?  Not a failure -- most panels are honestly
//     scrollable -- but reported, because a scroller that is 4x its own height on a phone is a panel
//     the player has to hunt through, and that is a tuning fact worth having a number for.
//
// Run it at more than one size, or it tells you nothing this project did not already believe:
//   py tools/audit.py _fitaudit.js size=1296x815     -> a 1280x720 viewport
//   py tools/audit.py _fitaudit.js size=860x485      -> an 844x390 viewport (phone landscape)
//   py tools/audit.py _fitaudit.js size=683x470      -> a 667x375 viewport (small phone landscape)
//
// --window-size IS THE WINDOW, NOT THE VIEWPORT. In the DOM-dump path headless Chrome keeps ~16px of
// width and ~95px of height for itself, so `size=667x375` measures a 651x280 viewport -- a screen
// nothing has, and 95px shorter than the one being tuned for. The header line prints the viewport it
// actually got; trust that number and not the one on the command line.
(function(){
  const L=[]; let warn=0, clip=0, side=0;
  const pad=(s,n)=>{ s=String(s); return s+' '.repeat(Math.max(1,n-s.length)); };
  function out(){
    const el=document.getElementById('testout');
    // COUNTED APART, because they are different faults with different fixes and the first version of
    // this header lumped them into one "clipped" number -- which then reported "1 clipped" with no
    // CLIPPED row anywhere in the table, and sent me looking for a panel that was not there.
    const head='FIT AUDIT  '+innerWidth+'x'+innerHeight+'  '
      +clip+' clipped or overlapping, '+side+' scrolls sideways, '+warn+' tight';
    if(el) el.textContent=head+'\n'+L.join('\n');
    document.title='FIT '+((clip+side)?'FAIL':'OK');
  }

  // Every panel, and the call that opens it. A panel with no opener is still measured -- it is shown
  // by hand -- because the point is coverage, not elegance.
  const PANELS=[
    ['invScr',    ()=>openInv()],
    ['forgeScr',  ()=>openForge()],
    ['vaultScr',  ()=>openVault()],
    ['stableScr', ()=>openStable()],
    ['aucScr',    ()=>openAuction()],
    ['bntScr',    ()=>openBounties()],
    ['dmdScr',    ()=>openDiamonds()],
    ['wrdScr',    ()=>openWardrobe()],
    ['coopScr',   ()=>openCoop()],
    ['setScr',    ()=>openSettings()],
    ['menuScr',   ()=>openMenu()],
    ['charScr',   ()=>openChar()],
    ['classScr',  ()=>openClassPick()],
    ['fallenScr', ()=>openFallen()],
    ['shopScr',   ()=>openShop2('bram')],
    ['devScr',    ()=>openDev()],
    // the six that were missing, and they are not the small ones: the skill tree, the ability
    // loadout, the pet stable, the attributes screen, the character sheet and the loot bag are
    // where a player spends most of their time out of combat
    ['skillScr',  ()=>openSkills()],
    ['loadScr',   ()=>openLoadout()],
    ['petScr',    ()=>openPets()],
    ['statsScr',  ()=>openStats()],
    // NO sheetScr. It does not exist in index.html -- the only trace of it is a guarded
    // `if($s('sheetScr'))` in 11_ui.js and a name in _shot.js's hide list, both of which are
    // defensive and harmless. Listing it here reported MISSING at every viewport forever, which is
    // an audit crying wolf about a panel that was never built.

    ['bagScr',    ()=>{ // a loot bag needs a bag: build one holding a spread of real gear
                        const bag={x:0,y:0,items:[]};
                        if(typeof mkItem==='function') for(let t=3;t<=8;t++) bag.items.push(mkItem('wpn',t,0,'knight'));
                        if(typeof openBagPanel==='function') openBagPanel(bag); }],
    ['mapScr',    ()=>{ const s2=document.getElementById('mapScr'); if(s2) s2.style.display='flex';
                        if(typeof drawMap==='function') drawMap(); }],
    // the two modal interrupts. They have no opener -- the game raises them -- so they are shown
    // by id, which is exactly how a player meets them.
    ['hcScr',     null],
    ['deathScr',  null],
  ];
  const EXTRA=[];

  function measure(id){
    const s=document.getElementById(id); if(!s) return null;
    // THE CARD IS THE THING WITH A SIZE -- and a plain `.scr` does not have one. Those are
    // `inset:0` flex columns that scroll themselves, so the panel IS the box; only the panels built
    // around frame art have an inner card. Falling back to firstElementChild measured a TITLE
    // element and reported four panels as clipped by 200px, which is what they were not.
    const card=s.querySelector('#shopCard,#invCard,#bagCard,#mapCard,#coopCard,#hcCard,#deathCard')
            || s;
    const r=card.getBoundingClientRect();
    // the deepest scroller inside it, which is where content actually overflows. Seeded with the
    // card's own overflow, because a bare .scr scrolls itself and has no inner scroller to find.
    let sc=card, best=card.scrollHeight-card.clientHeight;
    // SIDEWAYS OVERFLOW IN AN overflow-x:auto CONTAINER IS THE SANCTIONED PATTERN, not a fault. The
    // project's rule is that the BODY never scrolls horizontally and wide content scrolls inside its
    // own box -- the dev panel's tab strip is one deliberate row you swipe, and flagging it made the
    // audit report a failure for the design it was written to check for. Only overflow the container
    // has not opted into counts, because that is the overflow nobody can reach.
    let unreachable=0;
    const scan=(e)=>{
      const st=getComputedStyle(e);
      const scrollsX=(st.overflowX==='auto'||st.overflowX==='scroll');
      const over=e.scrollWidth-e.clientWidth;
      if(over>1 && !scrollsX) unreachable=Math.max(unreachable,over);
      if(st.overflowY==='auto'||st.overflowY==='scroll'||scrollsX){
        const ov=e.scrollHeight-e.clientHeight;
        if(ov>=best){ best=ov; sc=e; } }
    };
    scan(card);
    card.querySelectorAll('*').forEach(scan);
    return {
      w:Math.round(r.width), h:Math.round(r.height),
      offX:Math.round(Math.max(0, -r.left) + Math.max(0, r.right-innerWidth)),
      offY:Math.round(Math.max(0, -r.top)  + Math.max(0, r.bottom-innerHeight)),
      sideways:unreachable,
      hidden:Math.max(0, sc.scrollHeight-sc.clientHeight),
      shown:sc.clientHeight||1
    };
  }

  // ---- DO TWO PIECES OF TEXT SIT ON TOP OF EACH OTHER? ----
  // Overflow is measurable; COLLISION is what photographs catch and numbers miss. The zone plaque
  // drawn underneath the HUD's button row overflowed nothing -- both elements were comfortably
  // inside the viewport, one was simply on top of the other -- and it shipped because every
  // screenshot was taken at the one size where it did not happen.
  //
  // Only TEXT-BEARING LEAVES, and only pairs where neither contains the other: a badge deliberately
  // sitting on its icon is a layout, not a fault, and every element overlaps its own ancestors. The
  // threshold is 35% of the SMALLER box, so a one-pixel touch between neighbours is not a finding.
  function collisions(root){
    const els=[];
    root.querySelectorAll('*').forEach(e=>{
      if(e.children.length) return;                       // leaves only
      const t=(e.textContent||'').trim();
      if(!t) return;
      const st=getComputedStyle(e);
      if(st.display==='none'||st.visibility==='hidden'||+st.opacity===0) return;
      // A CLOSED <details> STILL GIVES ITS CHILDREN RECTS. Chrome lays the collapsed content out at
      // the summary's position under content-visibility, so every folded dev section reported its
      // buttons as sitting on top of the next section's heading. Nothing is visible there.
      if(e.closest('details:not([open])')) return;
      const r=e.getBoundingClientRect();
      // AND NEITHER IS A ROW SCROLLED OUT OF ITS OWN LIST. getBoundingClientRect reports where an
      // element WOULD be, not whether its scroller is showing it -- so the loot bag's fifth row,
      // clipped by overflow:auto, measured as sitting across TAKE ALL. Anything outside the client
      // box of a scrolling ancestor is not on screen.
      for(let a=e.parentElement; a && a!==document.body; a=a.parentElement){
        const as=getComputedStyle(a);
        if(as.overflowY!=='auto' && as.overflowY!=='scroll'
           && as.overflowX!=='auto' && as.overflowX!=='scroll') continue;
        const ar=a.getBoundingClientRect();
        if(r.bottom<=ar.top+1 || r.top>=ar.bottom-1 || r.right<=ar.left+1 || r.left>=ar.right-1) return;
      }
      if(r.width<4||r.height<4) return;
      if(r.right<0||r.bottom<0||r.left>innerWidth||r.top>innerHeight) return;
      els.push({e:e,r:r,t:t.slice(0,22)});
    });
    const out=[];
    for(let i=0;i<els.length;i++) for(let j=i+1;j<els.length;j++){
      const A=els[i], B=els[j];
      if(A.e.contains(B.e)||B.e.contains(A.e)) continue;
      const ox=Math.min(A.r.right,B.r.right)-Math.max(A.r.left,B.r.left);
      const oy=Math.min(A.r.bottom,B.r.bottom)-Math.max(A.r.top,B.r.top);
      if(ox<=0||oy<=0) continue;
      // BOTH BOXES HAVE TO BE MEANINGFULLY COVERED. Requiring only 35% of the SMALLER one reported
      // nine panels, and most of them were a small element sitting inside a large one's box: a "+"
      // between two anvil slots is entirely within the slot's padding, so the overlap is 100% of the
      // "+" and 2% of the slot. That is a layout, not a collision. A real one -- two buttons on top
      // of each other, a banner under a button row -- covers a serious fraction of both.
      const area=ox*oy;
      const aA=A.r.width*A.r.height, aB=B.r.width*B.r.height;
      if(area < Math.min(aA,aB)*0.35) continue;
      if(area < Math.max(aA,aB)*0.15) continue;
      const rr=(r)=>Math.round(r.left)+','+Math.round(r.top)+' '+Math.round(r.width)+'x'+Math.round(r.height);
      out.push('"'+A.t+'"['+rr(A.r)+'] over "'+B.t+'"['+rr(B.r)+']');
      if(out.length>=4) return out;
    }
    return out;
  }

  function hideAll(){
    for(const [id] of PANELS.concat(EXTRA)){
      const e=document.getElementById(id); if(e) e.style.display='none'; }
  }

  function go(){
    // a real account, so every panel has something to paint rather than an empty state that fits
    // trivially. This is the same throwaway '_shot' account tools/shot.py stands up.
    users['_fit']={pass:'x', chars:[{cls:'knight', inv:[], rpg:{}}], cur:0, mats:{}, vault:[]};
    curUser='_fit';
    if(typeof play==='function') play();
    rpg.lvl=50;
    if(typeof MAT_KEYS!=='undefined' && typeof matAdd==='function')
      for(const k of MAT_KEYS) matAdd(k,3);
    if(typeof RELICS!=='undefined' && typeof mkRelicItem==='function')
      for(let i=0;i<Math.min(6,RELICS.length);i++) curChar().inv.push(mkRelicItem(RELICS[i].id,'knight'));
    if(typeof rollScrollStat==='function') curChar().inv.push({k:'scroll', st:rollScrollStat()});
    curShopNear='bram';

    L.push('  panel        card       off-screen  sideways   scroller');
    L.push('  ' + '-'.repeat(62));
    for(const [id,open] of PANELS){
      hideAll();
      let err=null;
      try{ if(open) open(); }catch(e){ err=e&&e.message; }
      const s=document.getElementById(id); if(s) s.style.display='flex';
      void document.body.offsetHeight;                 // force layout before measuring
      const m=measure(id);
      if(!m){ L.push('  '+pad(id,12)+' MISSING'); clip++; continue; }
      // A TOLERANCE, WITH THE RAW NUMBER STILL PRINTED. Measured after --hide-scrollbars removed the
      // gutter, five panels still reported 4-13px of horizontal overflow: a child at width:100% plus
      // a border, sub-pixel rounding on a percentage padding, that class of thing. 8px on a 640px
      // card is not content a player cannot reach, and treating it as a failure would train whoever
      // runs this to ignore the failures. Past SIDE_TOL it is a strip of real content -- a wide table
      // or a chip row -- and that is the case worth stopping for.
      const SIDE_TOL=16;
      const clipped=(m.offX>1||m.offY>1), sideways=(m.sideways>SIDE_TOL);
      if(clipped) clip++;
      if(sideways) side++;
      if(!clipped && !sideways && m.hidden>m.shown*1.5) warn++;
      const hits=collisions(s||document.body);
      if(hits.length){ clip++; L.push('  '+pad(id,12)+' OVERLAP  '+hits.join('   |   ')); }
      L.push('  '+pad(id,12)+pad(m.w+'x'+m.h,11)
             +pad((clipped?('CLIPPED '+m.offX+'x'+m.offY):'-'),12)
             +pad(sideways?('SIDEWAYS '+m.sideways):(m.sideways>1?('('+m.sideways+'px)'):'-'),11)
             +(m.hidden?('+'+m.hidden+'px below the fold, '
                        +((m.hidden+m.shown)/m.shown).toFixed(1)+' screens'):'fits')
             +(err?('   [opener threw: '+err+']'):''));
    }
    hideAll();

    L.push('');
    L.push('  CLIPPED means part of the card is outside the window -- clipped by the viewport rather');
    L.push('  than by a scroller, so that content cannot be reached at all. SIDEWAYS means a scroller');
    L.push('  has horizontal overflow, which on touch has no scrollbar to discover. Below-the-fold is');
    L.push('  not a failure -- most of these are honestly scrollable -- but past ~1.5 screens on a');
    L.push('  phone it is a panel the player has to hunt through, so the number is here to tune with.');
    out();
  }

  // WAIT FOR THE FONT. Every measurement in here is a text box, and 'Pixelify Sans' loads
  // asynchronously: before it arrives the browser lays text out in a fallback whose metrics are
  // wider, so lines overflow boxes they fit in perfectly once the real font lands. That produced
  // four confident OVERLAP findings on the bounty board, the auction and the diamond exchange --
  // and photographing the bounty board at the same size showed a panel with nothing wrong with it.
  // A layout audit that runs before its fonts is measuring a layout the player never sees.
  function boot(){
    const run=()=>{ try{ go(); }catch(e){ L.push('AUDIT THREW: '+(e&&e.stack||e)); clip++; out(); } };
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(()=>setTimeout(run,120)).catch(run);
    else run();
  }
  if(document.readyState==='complete') setTimeout(boot,700);
  else window.addEventListener('load',()=>setTimeout(boot,700));
})();
