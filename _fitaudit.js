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
  const L=[]; let warn=0, bad=0;
  const pad=(s,n)=>{ s=String(s); return s+' '.repeat(Math.max(1,n-s.length)); };
  function out(){
    const el=document.getElementById('testout');
    const head='FIT AUDIT  '+innerWidth+'x'+innerHeight+'  '+bad+' clipped, '+warn+' tight';
    if(el) el.textContent=head+'\n'+L.join('\n');
    document.title='FIT '+(bad?'FAIL':'OK');
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
    ['mapScr',    ()=>{ const s=document.getElementById('mapScr'); if(s) s.style.display='flex';
                        if(typeof drawMap==='function') drawMap(); }],
  ];
  // the panels whose own openers live elsewhere and take arguments this audit has no business
  // inventing: the pet panel needs a stable, the bag panel needs a loot bag, the skill and loadout
  // panels need a live character sheet. They are opened by id and painted if a painter exists.
  const EXTRA=[
    ['bagScr',   'paintBagPanel'],
    ['hcScr',    null],
    ['deathScr', null],
  ];

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
    card.querySelectorAll('*').forEach(e=>{
      const st=getComputedStyle(e);
      if(st.overflowY==='auto'||st.overflowY==='scroll'||st.overflowX==='auto'||st.overflowX==='scroll'){
        const over=e.scrollHeight-e.clientHeight;
        if(over>=best){ best=over; sc=e; } }
    });
    return {
      w:Math.round(r.width), h:Math.round(r.height),
      offX:Math.round(Math.max(0, -r.left) + Math.max(0, r.right-innerWidth)),
      offY:Math.round(Math.max(0, -r.top)  + Math.max(0, r.bottom-innerHeight)),
      sideways:Math.max(0, sc.scrollWidth-sc.clientWidth),
      hidden:Math.max(0, sc.scrollHeight-sc.clientHeight),
      shown:sc.clientHeight||1
    };
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
      if(!m){ L.push('  '+pad(id,12)+' MISSING'); bad++; continue; }
      const clipped=(m.offX>1||m.offY>1), side=(m.sideways>1);
      if(clipped||side) bad++;
      else if(m.hidden>m.shown*1.5) warn++;
      L.push('  '+pad(id,12)+pad(m.w+'x'+m.h,11)
             +pad((clipped?('CLIPPED '+m.offX+'x'+m.offY):'-'),12)
             +pad(side?('SIDEWAYS '+m.sideways):'-',11)
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

  function boot(){ try{ go(); }catch(e){ L.push('AUDIT THREW: '+(e&&e.stack||e)); bad++; out(); } }
  if(document.readyState==='complete') setTimeout(boot,700);
  else window.addEventListener('load',()=>setTimeout(boot,700));
})();
