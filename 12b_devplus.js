// ===================================================================================
// 12b_devplus.js — THE WORKBENCH (user, 2026-07-27: "enhance my dev menu to feature chests for
// everything we have added so far. I want it to be in depth as you could possibly make it")
//
// "Chests" are SACKS here, deliberately. The loot rule in this game is one sack per kill and
// nothing else — a dev tool that spawned a container the game does not have would be testing
// something that cannot happen. So every "chest" below drops a real sack, through the real
// bagAt/LOOT_BANDS path, exactly as a kill would.
//
// Ten tabs, every one of them wired to the actual systems rather than to a copy of their numbers:
// the species list reads MOBSPEC, the relic list reads RELIC_SETS, the animation list reads
// BOSS_ANIM plus each boss's own profile. Add a creature or a beat anywhere and it appears here
// with no edit to this file.
// ===================================================================================

let _devTab='sacks';
function devLog(t){ const el=$s('devLog'); if(el){ el.textContent='▸ '+t; el.style.color='#8fd48c'; } }
function _dvBtn(label,fn,cls){ const b=document.createElement('button');
  b.className='mbtn dev'+(cls?' '+cls:''); b.textContent=label;
  b.onclick=()=>{ try{ fn(); }catch(err){ const el=$s('devLog');
    if(el){ el.textContent='✖ '+err.message; el.style.color='#e2604c'; } } };
  return b; }
function _dvGrid(){ const d=document.createElement('div'); d.className='dgrid'; return d; }
function _dvHd(t){ const d=document.createElement('div'); d.className='msub'; d.style.marginTop='10px';
  d.textContent=t; return d; }
function _dvNote(t){ const d=document.createElement('div'); d.className='mnote'; d.textContent=t; return d; }
// a sack on the ground at the player's feet, through the real loot path
function _dvSack(items,label){
  if(!player||!curRoom) throw new Error('not in the world — RESUME GAME first');
  const lb=bagAt({x:player.x+26,y:player.y+18}, items.filter(Boolean));
  lb.life=900; loots.push(lb);
  devLog((label||'sack')+' — '+items.length+' piece'+(items.length===1?'':'s')
    +' · band '+(LOOT_BANDS[bagBand(lb)]||{label:'?'}).label);
  return lb;
}
function _dvCh(){ const c=curChar(); if(!c) throw new Error('no character loaded'); return c; }

// A button with the creature's ACTUAL sprite on it (user: "the list that displays what is going to
// be spawned should display their sprite as well"). Draws through the same art path the world uses,
// so the thumbnail cannot drift from what actually spawns.
function _dvIcoBtn(label,drawFn,fn,cls){
  const b=_dvBtn('',fn,cls);
  b.classList.add('dvIco');
  const cv=document.createElement('canvas'); cv.width=40; cv.height=40; cv.className='dvIcoCv';
  try{ drawFn(cv.getContext('2d'),40); }catch(err){}
  const t=document.createElement('span'); t.className='dvIcoTx'; t.textContent=label;
  b.appendChild(cv); b.appendChild(t);
  return b;
}
// mob art: type + band tint, exactly as drawEnemy resolves it
function _dvDrawMob(c,S,type,band){
  c.imageSmoothingEnabled=false;
  const anim=(typeof _mobAnim!=='undefined')?(type==='s'?_mobAnim.s:_mobAnim.c):null;
  let im=(anim&&anim.idle&&anim.idle[0]&&anim.idle[0].naturalWidth)?anim.idle[0]:null;
  if(!im){ im=(type==='s')?(typeof _mobCultist!=='undefined'?_mobCultist:null)
                          :(typeof _mobHound!=='undefined'?_mobHound:null); }
  if(im&&im.naturalWidth){
    // band -> MOBTINT row, same indirection enemyBand uses; a raw band 9 would read the
    // Tidewrack's art-slot row instead of The Cairnworks'.
    const _row=(typeof BAND_ROW!=='undefined'&&BAND_ROW[band]!==undefined)?BAND_ROW[band]:band;
    const t=(typeof tintedMob==='function')?tintedMob(im,_row):im;
    const sc=Math.min(38/t.width,38/t.height);
    c.drawImage(t,20-t.width*sc/2,20-t.height*sc/2,t.width*sc,t.height*sc);
  } else {
    const sp=(type==='s')?sprCult:sprHound;
    c.drawImage(sp,20-sp.width,20-sp.height,sp.width*2,sp.height*2);
  }
  // the species' own size and infliction, so two creatures on the same art still read apart
  if(S&&S.r){ c.strokeStyle='rgba(255,208,122,.5)'; c.lineWidth=1;
    c.beginPath(); c.arc(20,20,Math.min(18,9*S.r),0,6.29); c.stroke(); }
  if(S&&S.inf){ const cols={burn:'#ff8a3d',poison:'#8fd48c',bleed:'#e2604c',chill:'#6ab8e0',
    curse:'#c07ad4',stun:'#ffd23d',weak:'#a09aa8',shock:'#7fd8ff'};
    c.fillStyle=cols[S.inf.id]||'#fff'; c.beginPath(); c.arc(35,5,3.2,0,6.29); c.fill(); }
}
// boss art: the awakened sprite for a dungeon form, its own art slot otherwise
function _dvDrawBoss(c,ring,dungeonForm){
  c.imageSmoothingEnabled=false;
  const slot=(typeof bossArt==='function')?bossArt(ring):ring;
  let im=null;
  if(dungeonForm && typeof _awakImg!=='undefined' && _awakImg[slot] && _awakImg[slot].naturalWidth) im=_awakImg[slot];
  if(!im && typeof _bossAnim!=='undefined' && _bossAnim[slot] && _bossAnim[slot].idle
     && _bossAnim[slot].idle[0] && _bossAnim[slot].idle[0].naturalWidth) im=_bossAnim[slot].idle[0];
  if(!im && typeof _bossImg!=='undefined' && _bossImg[slot] && _bossImg[slot].naturalWidth) im=_bossImg[slot];
  if(im){ const sc=Math.min(38/im.width,38/im.height);
    c.drawImage(im,20-im.width*sc/2,20-im.height*sc/2,im.width*sc,im.height*sc); }
  else { const sp=(typeof sprBoss!=='undefined'&&sprBoss[slot])?sprBoss[slot]:sprTyrant;
    c.drawImage(sp,20-sp.width,20-sp.height,sp.width*2,sp.height*2); }
  const GB=GBOSS[ring];
  if(GB&&GB.col){ c.fillStyle=GB.col; c.fillRect(0,36,40,4); }
}
// ---------------------------------------------------------------------------------
const DEV_TABS=[
 ['sacks','SACKS'], ['relics','RELICS'], ['items','ITEMS'], ['flasks','FLASKS'],
 ['bosses','BOSSES'], ['anim','ANIMATION'], ['mobs','ENEMIES'], ['world','WORLD'],
 ['ui','UI / FX'], ['bal','BALANCE'],
];
function devPaintTabs(){
  const box=$s('devTabs'); if(!box) return; box.innerHTML='';
  for(const [id,label] of DEV_TABS){
    const b=document.createElement('button');
    b.className='mbtn dev devTab'+(_devTab===id?' on':'');
    b.textContent=label; b.onclick=()=>{ _devTab=id; devPaintTabs(); devPaintBody(); };
    box.appendChild(b);
  }
}
function devPaintBody(){
  const B=$s('devBody'); if(!B) return; B.innerHTML='';
  const fn=DEV_PANE[_devTab]; if(fn) fn(B);
}
const DEV_PANE={};

// ---------------------------------- SACKS ----------------------------------------
// One "chest" per loot band, plus the shapes that are awkward to reproduce by playing.
DEV_PANE.sacks=function(B){
  B.appendChild(_dvNote('Every button drops a real sack at your feet through bagAt() — the same path a kill uses.'));
  B.appendChild(_dvHd('ONE PER BAND'));
  let g=_dvGrid();
  for(let i=0;i<LOOT_BANDS.length;i++){
    const bn=LOOT_BANDS[i], lo=bn.min, hi=(LOOT_BANDS[i+1]?LOOT_BANDS[i+1].min-1:MAXT-1);
    g.appendChild(_dvBtn(bn.label+' (T'+(lo+1)+'–T'+(hi+1)+')',()=>{
      const ch=_dvCh(), items=[];
      if(bn.min>=RELIC_T){ const r=RELICS[Math.floor(Math.random()*RELICS.length)];
        items.push(mkRelicItem(r.id,ch.cls)); }
      const n=1+Math.floor(Math.random()*3);
      for(let q=0;q<n;q++) items.push(mkItem(['wpn','arm','helm','ring'][q%4], lo+Math.floor(Math.random()*(hi-lo+1)), 0, ch.cls));
      _dvSack(items, bn.label+' sack');
    }));
  }
  B.appendChild(g);
  B.appendChild(_dvHd('SHAPES WORTH TESTING'));
  g=_dvGrid();
  g.appendChild(_dvBtn('Mixed verdicts (all 4)',()=>{
    const ch=_dvCh(), w=rpg.wpn|0, a=rpg.arm|0, h=(rpg.helm===undefined?-1:rpg.helm);
    _dvSack([
      mkItem('wpn',Math.min(MAXT-1,w+3),0,ch.cls),                          // upgrade
      {k:'arm', mt:CARMOR[ch.cls], t:a, rar:2, aff:[]},                      // sidegrade
      {k:'helm',mt:CARMOR[ch.cls], t:Math.max(0,h-4), rar:1, aff:[]},        // worse
      {k:'wpn', wt:(CWEAP[ch.cls]==='staff'?'bow':'staff'), t:MAXT-1, rar:4, aff:[]},  // off-class
    ],'mixed-verdict sack');
  }));
  g.appendChild(_dvBtn('Every slot, T12 mythic',()=>{ const ch=_dvCh();
    _dvSack(['wpn','arm','helm','ring'].map(k=>mkItem(k,MAXT-1,0,ch.cls)),'full T12 sack'); }));
  g.appendChild(_dvBtn('Single consumable (auto-take)',()=>_dvSack([{k:'coin'}],'lone coin')));
  g.appendChild(_dvBtn('20 pieces (overflow)',()=>{ const ch=_dvCh();
    const it=[]; for(let i=0;i<20;i++) it.push(mkItem(['wpn','arm','helm','ring'][i%4],(i%MAXT),0,ch.cls));
    _dvSack(it,'overflow sack'); }));
  g.appendChild(_dvBtn('Fill satchel to 20',()=>{ const ch=_dvCh(); ch.inv=ch.inv||[];
    while(ch.inv.length<20) ch.inv.push(mkItem('ring',1,0,ch.cls));
    saveRPG(); devLog('satchel filled to '+ch.inv.length+' — now open a sack to test the full path'); }));
  g.appendChild(_dvBtn('Empty satchel',()=>{ const ch=_dvCh(); ch.inv=[]; saveRPG(); devLog('satchel emptied'); }));
  B.appendChild(g);
  B.appendChild(_dvHd('THE EVENT CHEST'));
  g=_dvGrid();
  g.appendChild(_dvIcoBtn('Event chest',(c)=>{ c.imageSmoothingEnabled=false;
    const im=(typeof _eventChest!=='undefined')?_eventChest:null;
    if(im&&im.naturalWidth){ const sc=Math.min(38/im.width,38/im.height);
      c.drawImage(im,20-im.width*sc/2,20-im.height*sc/2,im.width*sc,im.height*sc); }
  },()=>{ if(!player) throw new Error('not in the world');
    const lb=spawnEventChest(player.x+40,player.y+24);
    devLog('chest — '+bagItems(lb).length+' pieces, '+bagItems(lb).filter(i=>i.relic).length+' relic(s)'); },'go'));
  g.appendChild(_dvBtn('Chest · guaranteed relic',()=>{ if(!player) throw new Error('not in the world');
    const lb=spawnEventChest(player.x+40,player.y+24,{relicP:1});
    devLog('chest — '+bagItems(lb).length+' pieces, '+bagItems(lb).filter(i=>i.relic).length+' relic(s)'); }));
  g.appendChild(_dvBtn('Chest odds ×2000',()=>{ const ch=_dvCh();
    let rel=0,items=0,tsum=0,tn=0;
    for(let i=0;i<2000;i++){ const it=rollEventChest(45,ch.cls);
      items+=it.length; for(const x of it){ if(x.relic) rel++; if(x.t!==undefined){tsum+=x.t;tn++;} } }
    devLog('2000 chests · '+(rel/20).toFixed(1)+'% held a relic · avg tier T'+(tsum/tn+1).toFixed(1)
      +' · avg '+(items/2000).toFixed(1)+' pieces'); }));
  g.appendChild(_dvBtn('Clear ground sacks',()=>{ const n=loots.length; loots.length=0; devLog(n+' sacks cleared'); }));
  B.appendChild(g);
};

// ---------------------------------- RELICS ---------------------------------------
DEV_PANE.relics=function(B){
  B.appendChild(_dvNote('12 sets × 4 pieces. "Full set" drops all four so you can wear the bonus immediately.'));
  for(const S of RELIC_SETS){
    const gb=(typeof GBOSS!=='undefined')?GBOSS[S.ring]:null;
    B.appendChild(_dvHd(S.n+'  ·  '+(gb?gb.dn:'ring '+S.ring)+'  ·  ✦ '+S.bonus.n));
    const g=_dvGrid();
    g.appendChild(_dvBtn('FULL SET (4)',()=>{ const ch=_dvCh();
      _dvSack(relicsOfSet(S.id).map(R=>mkRelicItem(R.id,ch.cls)), S.n+' full set'); },'go'));
    for(const R of relicsOfSet(S.id))
      g.appendChild(_dvBtn(R.n,()=>{ const ch=_dvCh(); _dvSack([mkRelicItem(R.id,ch.cls)],R.n); }));
    B.appendChild(g);
  }
  B.appendChild(_dvHd('WORN'));
  const g2=_dvGrid();
  g2.appendChild(_dvBtn('Report worn set',()=>{ const a=activeRelicSet();
    devLog(a?('wearing '+a.n+' — '+setWornCount(a.id)+'/4'):'no set bonus active'); }));
  g2.appendChild(_dvBtn('Drop every relic (48)',()=>{ const ch=_dvCh();
    for(const R of RELICS) _dvSack([mkRelicItem(R.id,ch.cls)],R.n);
    devLog('dropped all '+RELICS.length+' relics'); }));
  B.appendChild(g2);
};

// ---------------------------------- ITEMS ----------------------------------------
DEV_PANE.items=function(B){
  B.appendChild(_dvNote('Tier and rarity below apply to every spawn on this tab. Items go to the satchel.'));
  const g0=_dvGrid();
  g0.appendChild(_dvBtn('Tier '+(devItemTier+1),()=>{ devItemTier=(devItemTier+1)%MAXT; devPaintBody(); }));
  g0.appendChild(_dvBtn('Rarity: '+RAR_LBL[devItemRar],()=>{ devItemRar=(devItemRar+1)%6; devPaintBody(); }));
  B.appendChild(g0);
  B.appendChild(_dvHd('WEAPONS — every type, including the monk gauntlets'));
  let g=_dvGrid();
  for(const wt in WTYPE){
    const W=WTYPE[wt];
    g.appendChild(_dvBtn(W.n+(W.legacy?' (legacy)':''),()=>{ const ch=_dvCh(); ch.inv=ch.inv||[];
      if(ch.inv.length>=20) throw new Error('satchel full');
      const it={k:'wpn',wt:wt,t:devItemTier,rar:devItemRar}; const af=devAff(devItemTier,devItemRar); it.aff=af.a;
      ch.inv.push(it); saveRPG(); devLog('+ '+itemName(it)+(canEquip(it,ch)?'':' (wrong class)')); }));
  }
  B.appendChild(g);
  B.appendChild(_dvHd('ARMOUR / HELM by material'));
  g=_dvGrid();
  for(const mt of ['plate','leather','robe']) for(const k of ['arm','helm'])
    g.appendChild(_dvBtn(mt+' '+k,()=>{ const ch=_dvCh(); ch.inv=ch.inv||[];
      if(ch.inv.length>=20) throw new Error('satchel full');
      const it={k:k,mt:mt,t:devItemTier,rar:devItemRar}; it.aff=devAff(devItemTier,devItemRar).a;
      ch.inv.push(it); saveRPG(); devLog('+ '+itemName(it)); }));
  B.appendChild(g);
  B.appendChild(_dvHd('RINGS by stat'));
  g=_dvGrid();
  for(const st of RING_STATS)
    g.appendChild(_dvBtn(st.toUpperCase(),()=>{ const ch=_dvCh(); ch.inv=ch.inv||[];
      if(ch.inv.length>=20) throw new Error('satchel full');
      const it={k:'ring',st:st,t:devItemTier,rar:devItemRar}; it.aff=devAff(devItemTier,devItemRar).a;
      ch.inv.push(it); saveRPG(); devLog('+ '+itemName(it)); }));
  B.appendChild(g);
};

// ---------------------------------- FLASKS ---------------------------------------
DEV_PANE.flasks=function(B){
  B.appendChild(_dvNote('Both flasks refill on independent 48s clocks, cap 5. Auto thresholds live in Settings.'));
  B.appendChild(_dvHd('STOCK'));
  let g=_dvGrid();
  for(const n of [0,1,3,5,25,99]){
    g.appendChild(_dvBtn('HP tonics = '+n,()=>{ rpg.pots=n; saveRPG(); hudRPG(); devLog('tonics '+n); }));
    g.appendChild(_dvBtn('MP flasks = '+n,()=>{ rpg.mpots=n; saveRPG(); hudRPG(); devLog('flasks '+n); }));
  }
  B.appendChild(g);
  B.appendChild(_dvHd('CLOCKS + AUTO'));
  g=_dvGrid();
  g.appendChild(_dvBtn('Report timers',()=>devLog('pots '+(rpg.pots|0)+' t='+(rpg._potT||0).toFixed(1)
    +'s  ·  flasks '+(rpg.mpots|0)+' t='+(rpg._mpotT||0).toFixed(1)+'s')));
  g.appendChild(_dvBtn('Advance clocks 48s',()=>{ for(let i=0;i<48/0.05;i++) tickPotions(0.05);
    devLog('pots '+(rpg.pots|0)+'  flasks '+(rpg.mpots|0)); }));
  g.appendChild(_dvBtn('Drain HP to 4%',()=>{ player.hp=player.maxhp*0.04; devLog('hp '+Math.round(player.hp)); }));
  g.appendChild(_dvBtn('Drain MP to 4%',()=>{ player.mp=player.maxmp*0.04; devLog('mp '+Math.round(player.mp)); }));
  g.appendChild(_dvBtn('Auto-pot: '+(autoPotPct()||'OFF'),()=>{ autoPotCycle(); devPaintBody(); }));
  g.appendChild(_dvBtn('Auto-mana: '+(autoManaPct()||'OFF'),()=>{ autoManaCycle(); devPaintBody(); }));
  B.appendChild(g);
};

// ---------------------------------- BOSSES ---------------------------------------
DEV_PANE.bosses=function(B){
  B.appendChild(_dvNote('Spawns the real creature via makeEnemy so every AI field exists. "Dungeon form" flags awk/den — the fight key changes with it.'));
  const cur=()=>enemies.find(e=>e.type==='B');
  B.appendChild(_dvHd('SPAWN'));
  const gb=_dvGrid();
  for(let r=0;r<GBOSS.length;r++){
    const GB=GBOSS[r];
    gb.appendChild(_dvIcoBtn(GB.n,(c)=>_dvDrawBoss(c,r,false),()=>_devSpawnBoss(r,false)));
    gb.appendChild(_dvIcoBtn(((GB.gate==='none'&&GB.denN)?GB.denN:'Awakened '+GB.n),
      (c)=>_dvDrawBoss(c,r,true),()=>_devSpawnBoss(r,true),'go'));
  }
  B.appendChild(gb);
  B.appendChild(_dvHd('THE FIGHT IN FRONT OF YOU'));
  const g=_dvGrid();
  g.appendChild(_dvBtn('Report',()=>{ const b=cur(); if(!b) throw new Error('no boss here');
    const th=bossPhases(b);
    devLog(b.name+'  key='+bossMechKey(b)+'  phase '+(b.phase||0)+'/'+th.length
      +'  hp '+Math.round(100*b.hp/b.maxhp)+'%  breaks@'+th.join('/')
      +(b.anchored?'  ANCHORED':'')+(bossImmune(b)?'  IMMUNE':'')); }));
  for(const f of [0.9,0.7,0.5,0.3,0.12,0.02])
    g.appendChild(_dvBtn('HP → '+Math.round(f*100)+'%',()=>{ const b=cur(); if(!b) throw new Error('no boss here');
      b.hp=b.maxhp*f; bossBar=b; devLog('hp '+Math.round(f*100)+'%'); }));
  g.appendChild(_dvBtn('Force next phase',()=>{ const b=cur(); if(!b) throw new Error('no boss here');
    const th=bossPhases(b), nx=(b.phase||0);
    if(nx>=th.length) throw new Error('already final phase');
    b.hp=b.maxhp*(th[nx]-0.01); bossBar=b; devLog('driving to phase '+(nx+1)); }));
  g.appendChild(_dvBtn('Reset fight',()=>{ const b=cur(); if(!b) throw new Error('no boss here');
    bossReset(b); devLog('reset — full hp, phase 0, dialogue rearmed'); }));
  g.appendChild(_dvBtn('Toggle anchor now',()=>{ const b=cur(); if(!b) throw new Error('no boss here');
    if(b.anchorInv){ b.anchorInv=0; b.anchored=0; devLog('anchor released'); }
    else { const c=bossCentre(b); b.x=c.x; b.y=c.y; b.anchored=1; b.anchorInv=1;
      bossAnim(b,'plant'); bossAnimFx(b,'plant'); devLog('planted at arena centre'); } }));
  g.appendChild(_dvBtn('Kill it',()=>{ const b=cur(); if(!b) throw new Error('no boss here'); b.hp=0; devLog('killed'); }));
  B.appendChild(g);
  // Only offer lines the boss in front of you actually HAS. The starter three carry no `open`
  // and no `mid` array, so those buttons could only ever have reported their own absence.
  const b0=cur(), GB0=(b0&&b0.ring>=0)?GBOSS[b0.ring]:null;
  B.appendChild(_dvHd('DIALOGUE'+(GB0?('  ·  '+GB0.n):'  ·  spawn a boss first')));
  const g2=_dvGrid();
  const dlg=[['Opening line','open',0,GB0&&GB0.open]];
  for(let i=0;i<4;i++) dlg.push(['Milestone '+(i+1),'mid',i,GB0&&GB0.mid&&GB0.mid[i]]);
  dlg.push(['Phase bark 1','bark',0,GB0&&GB0.bark&&GB0.bark[0]]);
  dlg.push(['Phase bark 2','bark',1,GB0&&GB0.bark&&GB0.bark[1]]);
  dlg.push(['Dying words','death',0,GB0&&GB0.death]);
  for(const [label,kind,idx,has] of dlg){
    const btn=_dvBtn(label,()=>_devSay(kind,idx));
    if(!has){ btn.disabled=true; btn.style.opacity='.32'; btn.title='this boss has no such line'; }
    g2.appendChild(btn);
  }
  B.appendChild(g2);
};
function _devSpawnBoss(ring,dungeonForm){
  if(!curRoom||!player) throw new Error('not in the world');
  for(let i=enemies.length-1;i>=0;i--) if(enemies[i].type==='B') enemies.splice(i,1);
  const a=Math.random()*6.283, d=210;
  const sp={x:(player.x+Math.cos(a)*d)/TILE-0.5, y:(player.y+Math.sin(a)*d)/TILE-0.5, t:'B'};
  const e=makeEnemy(sp);
  const GB=GBOSS[ring];
  e.ring=ring; e.wb=true; e.col=GB.col; e.mech=GB.mech; e.pat=GB.pat; e.pat2=GB.pat2;
  e.awk=!!dungeonForm && GB.gate!=='none'; e.den=!!dungeonForm && GB.gate==='none';
  e.name=dungeonForm ? (e.awk?'Awakened '+GB.n:(GB.denN||GB.n)) : GB.n;
  e.saidOpen=false; e.chat=0; e.phase=0;
  enemies.push(e); bossBar=e; curRoom.cleared=false;
  devLog('spawned '+e.name+'  key='+bossMechKey(e)+'  breaks@'+bossPhases(e).join('/'));
}
function _devSay(kind,idx){
  const b=enemies.find(e=>e.type==='B'); if(!b) throw new Error('no boss here');
  const GB=(b.ring>=0)?GBOSS[b.ring]:null; if(!GB) throw new Error('this boss has no dialogue');
  let line=null;
  if(kind==='open') line=GB.open;
  else if(kind==='mid') line=GB.mid&&GB.mid[idx];
  else if(kind==='bark') line=GB.bark&&GB.bark[idx];
  else if(kind==='death') line=GB.death;
  if(!line) throw new Error('no line there for '+GB.n);
  bossSayNow(line,7000,b); bossBar=b;
  devLog('speaking — watch the subtitle bar');
}

// -------------------------------- ANIMATION --------------------------------------
DEV_PANE.anim=function(B){
  const b=enemies.find(e=>e.type==='B');
  B.appendChild(_dvNote(b?('Playing on: '+b.name+'  (ring '+b.ring+')')
                          :'No boss present — spawn one on the BOSSES tab first.'));
  B.appendChild(_dvHd('SHARED VOCABULARY'));
  let g=_dvGrid();
  const shared=Object.keys(BOSS_ANIM).filter(k=>!_devIsSig(k));
  for(const nm of shared) g.appendChild(_dvBtn(nm,()=>_devPlay(nm)));
  B.appendChild(g);
  if(b && typeof bossProfile==='function' && bossProfile(b)){
    B.appendChild(_dvHd('THIS BOSS’S OWN BEATS'));
    g=_dvGrid();
    for(const nm of bossSigBeats(b)) g.appendChild(_dvBtn(nm,()=>_devPlay(nm),'go'));
    B.appendChild(g);
  }
  B.appendChild(_dvHd('EVERY SIGNATURE MOVE IN THE GAME'));
  g=_dvGrid();
  for(const r in BOSS_PROF){
    const GB=GBOSS[r];
    for(const nm of Object.keys(BOSS_PROF[r].beats)){
      if(['idle','speak','wind','die'].indexOf(nm)>=0) continue;
      g.appendChild(_dvBtn((GB?GB.n.replace('The ',''):r)+' · '+nm,()=>{
        const bb=enemies.find(e=>e.type==='B'); if(!bb) throw new Error('spawn a boss first');
        const was=bb.ring; bb.ring=+r; _devPlay(nm); bb.ring=was;
        devLog('played '+(GB?GB.n:'ring '+r)+"'s "+nm+' (profile borrowed for the beat)'); }));
    }
  }
  B.appendChild(g);
  B.appendChild(_dvHd('POSE READOUT'));
  const g2=_dvGrid();
  g2.appendChild(_dvBtn('Sample current pose',()=>{ const bb=enemies.find(e=>e.type==='B');
    if(!bb) throw new Error('no boss here'); const P=bossAnimPose(bb);
    devLog((bb.anim||'idle')+'  sx '+P.sx.toFixed(2)+'  sy '+P.sy.toFixed(2)
      +'  rot '+(P.rot*57.3).toFixed(1)+'°  dy '+P.dy.toFixed(1)+'  glow '+P.glow.toFixed(2)); }));
  B.appendChild(g2);
};
function _devIsSig(k){ if(typeof BOSS_PROF==='undefined') return false;
  for(const r in BOSS_PROF) if(BOSS_PROF[r].beats[k] && !['idle','speak','wind','die','slam'].includes(k)){
    // shared only if EVERY profile could mean it; treat profile-only names as signatures
    let sharedNames=['wind','slam','roar','recoil','lunge','summon','phase','plant','hold',
                     'vanish','appear','ward','break','speak','die','idle'];
    return sharedNames.indexOf(k)<0;
  }
  return false; }
function _devPlay(nm){
  const b=enemies.find(e=>e.type==='B'); if(!b) throw new Error('spawn a boss first');
  bossBar=b; bossAnimClear(b); bossAnim(b,nm);
  if(typeof bossAnimFx==='function') bossAnimFx(b,nm);
  devLog('▶ '+nm+'  ('+((BOSS_ANIM[nm]||{}).t||0)+'s)');
}

// --------------------------------- ENEMIES ---------------------------------------
DEV_PANE.mobs=function(B){
  B.appendChild(_dvNote('Reads MOBSPEC directly — 54 species across 9 bands, including the 18 that only exist inside dungeons.'));
  for(let bd=0;bd<MOBSPEC.length;bd++){
    B.appendChild(_dvHd('BAND '+bd+(typeof RING_NAMES!=='undefined'&&RING_NAMES[bd]?('  ·  '+RING_NAMES[bd]):'')));
    const g=_dvGrid();
    for(const t of ['c','s']){
      for(const dun of [false,true]){
        const pool=mobPool(bd,t,dun);
        const extra=dun?pool.slice(mobPool(bd,t,false).length):pool;
        for(const S of extra)
          g.appendChild(_dvIcoBtn((dun?'⌂ ':'')+S.n,(c)=>_dvDrawMob(c,S,t,bd),
            ()=>_devSpawnSpecies(bd,t,S.n),dun?'go':undefined));
      }
    }
    B.appendChild(g);
  }
};
function _devSpawnSpecies(band,type,name){
  if(!curRoom||!player) throw new Error('not in the world');
  for(let tries=0;tries<300;tries++){
    const a=Math.random()*6.283, d=150+Math.random()*180;
    const x=player.x+Math.cos(a)*d, y=player.y+Math.sin(a)*d;
    if(solid(x,y)) continue;
    // `spec` names the creature outright — mobSpec honours it over the position hash, which is
    // the only way to see a dungeon-only species without standing in that dungeon
    const sp={x:Math.floor(x/TILE), y:Math.floor(y/TILE), t:type, spec:name, band:band};
    const e=makeEnemy(sp);
    e.band=band;
    enemies.push(e); curRoom.cleared=false;
    devLog('spawned '+(e.spn||name)+'  beh='+e.beh+'  lv'+e.lv+'  hp '+Math.round(e.hp)
      +(type==='s'?('  shots '+eShotCount(e.lv)+'  cd '+(eFireCd(e.lv)/(1+e.dex*0.004)).toFixed(2)+'s'):''));
    return;
  }
  throw new Error('no open ground nearby — move and retry');
}

// ---------------------------------- WORLD ----------------------------------------
DEV_PANE.world=function(B){
  B.appendChild(_dvHd('DUNGEONS — all 13'));
  const g=_dvGrid();
  for(let r=0;r<GBOSS.length;r++){
    const GB=GBOSS[r];
    g.appendChild(_dvBtn(GB.dn,()=>{ enterDungeon(r);
      devLog('entered '+GB.dn+(curRoom.bossCh?('  · chamber centre '+Math.round(curRoom.bossCh.cx)+','+Math.round(curRoom.bossCh.cy)):'  · NO bossCh')); }));
  }
  B.appendChild(g);
  B.appendChild(_dvHd('ROOMS'));
  const g2=_dvGrid();
  for(const k in rooms) g2.appendChild(_dvBtn(rooms[k].name+(rooms[k].cleared?' ✓':''),()=>devTeleport(k)));
  B.appendChild(g2);
  B.appendChild(_dvHd('THIS ROOM'));
  const g3=_dvGrid();
  g3.appendChild(_dvBtn('Report',()=>devLog(curRoom.name+'  lv '+(curRoom.lv||'?')
    +'  dungeon='+!!curRoom.dungeon+'  ring='+(curRoom.ring!==undefined?curRoom.ring:'-')
    +'  enemies '+enemies.length+'  sacks '+loots.length
    +(curRoom.bossCh?'  bossCh ✓':''))));
  g3.appendChild(_dvBtn('Go to boss chamber',()=>{ if(!curRoom.bossCh) throw new Error('not a dungeon');
    player.x=curRoom.bossCh.cx; player.y=curRoom.bossCh.cy+120; devLog('warped to the chamber'); }));
  g3.appendChild(_dvBtn('Complete objectives',()=>{ if(!curRoom.objs) throw new Error('no objectives here');
    for(const o of curRoom.objs) if(!o.done){ o.got=o.need; dunOpenGate(o); }
    devLog('all objectives opened'); }));
  B.appendChild(g3);
};

// --------------------------------- UI / FX ---------------------------------------
DEV_PANE.ui=function(B){
  B.appendChild(_dvNote('Fires the interface pieces so you can look at them without farming for them.'));
  B.appendChild(_dvHd('BANNERS'));
  let g=_dvGrid();
  g.appendChild(_dvBtn('INSANE DROP',()=>{ const ch=_dvCh();
    const r=RELICS[Math.floor(Math.random()*RELICS.length)];
    insaneDrop(mkRelicItem(r.id,ch.cls)); devLog('banner fired'); }));
  g.appendChild(_dvBtn('msg() ×3 (queue)',()=>{ msg('FIRST','one'); msg('SECOND','two'); msg('THIRD','three');
    devLog('three banners queued — each gets its full time'); }));
  g.appendChild(_dvBtn('Phase banner',()=>{ const b=enemies.find(e=>e.type==='B');
    if(!b) throw new Error('spawn a boss first'); bossEnterPhase(b,(b.phase||0)+1); }));
  B.appendChild(g);
  B.appendChild(_dvHd('STATUS BANNER'));
  g=_dvGrid();
  g.appendChild(_dvBtn('Co-op: solo',()=>{ coop.on=false; coop.pub=false; coop._trying=false; devLog('badge: (none)'); }));
  g.appendChild(_dvBtn('Co-op: connecting',()=>{ coop.on=false; coop.auto=true; coop._trying=true; devLog('badge: connecting…'); }));
  g.appendChild(_dvBtn('Co-op: EMBER SERVER',()=>{ coop.on=true; coop.pub=true; coop._trying=false;
    coop.peers={a:1,b:1,c:1}; devLog('badge: '+coopTag()); }));
  g.appendChild(_dvBtn('Co-op: private room',()=>{ coop.on=true; coop.pub=false; coop.code='TEST42';
    devLog('badge: '+coopTag()); }));
  B.appendChild(g);
  B.appendChild(_dvHd('UI SCALE'));
  g=_dvGrid();
  for(const u of [0.6,0.8,1,1.2,1.4,1.7])
    g.appendChild(_dvBtn('UIS ×'+u,()=>{ OPTS.ui=u; saveOpts(); applyOpts(); devLog('UI scale '+u); }));
  B.appendChild(g);
  B.appendChild(_dvHd('PROMPTS'));
  g=_dvGrid();
  g.appendChild(_dvBtn('Sack at a portal (collision)',()=>{
    const pt=(curRoom.portals&&curRoom.portals[0]); if(!pt) throw new Error('no portal in this room');
    player.x=pt.x; player.y=pt.y+26; portalLock=false;
    const ch=_dvCh(); _dvSack([mkItem('wpn',MAXT-1,0,ch.cls),mkItem('arm',MAXT-1,0,ch.cls)],'collision test');
    devLog('both prompts should be up, TAKE below USE'); }));
  B.appendChild(g);
};

// -------------------------------- BALANCE ----------------------------------------
DEV_PANE.bal=function(B){
  B.appendChild(_dvNote('Reads the live curves. Useful after a tuning change — these are the numbers, not a copy of them.'));
  B.appendChild(_dvHd('THE AGGRESSION RAMP'));
  const pre=document.createElement('div');
  pre.className='mnote'; pre.style.textAlign='left'; pre.style.whiteSpace='pre'; pre.style.fontSize='11px';
  let txt='lv   shots  cd     hit   touch\n';
  for(const lv of [1,4,8,12,20,30,40,50]){
    const dm=eDmgScale(lv), dex=eDex(lv);
    txt+=String(lv).padEnd(5)+String(eShotCount(lv)).padEnd(7)
      +(eFireCd(lv)/(1+dex*0.004)).toFixed(2).padEnd(7)
      +String(Math.round(5+dm*0.63)).padEnd(6)+Math.round(7+dm)+'\n';
  }
  pre.textContent=txt; B.appendChild(pre);
  B.appendChild(_dvHd('ROSTER'));
  const g=_dvGrid();
  g.appendChild(_dvBtn('Count species',()=>{ const ow=new Set(), dn=new Set();
    for(let b=0;b<MOBSPEC.length;b++) for(const t of ['c','s']){
      for(const m of mobPool(b,t,false)) ow.add(m.n);
      for(const m of mobPool(b,t,true)) dn.add(m.n); }
    devLog(ow.size+' overworld · '+[...dn].filter(n=>!ow.has(n)).length+' dungeon-only · '+dn.size+' total in a dungeon'); }));
  g.appendChild(_dvBtn('Loot sweep ×4000',()=>{
    let pots=0,items=0,relics=0; const keep=loots.slice(); loots.length=0;
    for(const t of ['c','s','N','B']) for(let i=0;i<1000;i++){
      loots.length=0; rollLoot({type:t,x:player.x,y:player.y,lv:45,ring:-1});
      for(const lb of loots) for(const it of bagItems(lb)){ items++;
        if(it.k==='pot') pots++; if(it.relic) relics++; } }
    loots.length=0; for(const l of keep) loots.push(l);
    devLog('4000 rolls · '+items+' items · '+pots+' potions · '+relics+' relics'); }));
  g.appendChild(_dvBtn('Fight keys (all 27)',()=>{
    const ks=[]; for(let r=0;r<GBOSS.length;r++) ks.push('ow'+r,'dn'+r); ks.push('arena');
    const have=ks.filter(k=>BOSS_MECH[k]);
    devLog(have.length+'/'+ks.length+' fights registered'+(have.length?': '+have.join(' '):' — all on the legacy path')); }));
  B.appendChild(g);
};

// ---------------------------------------------------------------------------------
// openDev (12_devpanel.js) calls devPaintPlus() at the end -- wrapping the function here would not
// work, because the dev BUTTON captured the original reference when it bound its listener.
function devPaintPlus(){ devPaintTabs(); devPaintBody(); }
