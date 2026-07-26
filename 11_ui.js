// ---------- accounts, menus, character select ----------
let inGame=false; let isAdmin=false;
let runLive=false, runChar=null;   // a run is in progress for THIS character -> ☰ offers RESUME
const memStore={};
const LS={
 get:(k,d)=>{try{const v=localStorage.getItem(k);return v!==null?JSON.parse(v):(k in memStore?memStore[k]:d);}catch(e){return k in memStore?memStore[k]:d;}},
 set:(k,v)=>{memStore[k]=v;try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
};
let users=LS.get('er-users',{});
let curUser=null;

// ---- teleport-pillar fast-travel ----
let _pillarSet=null;
function _pillars(){ if(!_pillarSet) _pillarSet=new Set(LS.get('er-pillars',[])); return _pillarSet; }
function pillarUnlocked(b){ return _pillars().has(b); }
function unlockPillar(b){ _pillars().add(b); LS.set('er-pillars',[..._pillarSet]); }
function closeFastTravel(){ const ov=document.getElementById('ftScr'); if(ov) ov.style.display='none'; }
// USE-button handler for the portal/pillar prompt (see 07_update portalPrompt detection)
function usePortalPrompt(){ const p=portalPrompt; if(!p) return; portalPrompt=null;
  // teleports suppress re-prompt; loot doesn't -- and neither does a stall, or closing the shop
  // while still standing at the counter would leave you unable to open it again
  if(p.kind!=='loot' && p.kind!=='vendor' && p.kind!=='wardrobe') portalLock=true;
  if(p.kind==='wardrobe'){ if(typeof openWardrobe==='function') openWardrobe();
    navigator.vibrate&&navigator.vibrate(15); return; }
  if(p.kind==='vendor'){ const np=p.np;
    // one flag per stall picks the panel; anything unflagged is a plain shop
    if(np.auction){ if(typeof openAuction==='function') openAuction(); }
    else if(np.event){ if(typeof openBounties==='function') openBounties(); }
    else if(np.diamond){ if(typeof openDiamonds==='function') openDiamonds(); }
    else openShop2(np.id);
    navigator.vibrate&&navigator.vibrate(15); return; }
  if(p.kind==='switch'){ const sw=p.sw; if(sw&&!sw.on){
    const ob=curRoom.objs&&curRoom.objs[sw.ch];
    if(ob&&!ob.done){
      if(sw.mode==='timing'){
        // Titan Locks: only while the seal glows
        if(!dunSealLit(sw.idx)){ msg('THE LOCK RESISTS','strike while it glows');
          _dunPhantoms(sw.x,sw.y,sw.ch,1); portalLock=false; return; } }
      else if(sw.idx!==undefined&&sw.idx!==ob.got){
        // wrong seal (order / relay) — the mind resets the chain and sends phantoms
        for(const s2 of curRoom.switches) if(s2.ch===sw.ch) s2.on=false;
        ob.got=0; ob.timer=0; msg('THE SEALS RESET','wrong order — phantoms stir');
        _dunPhantoms(sw.x,sw.y,sw.ch,2);
        if(typeof emitP==='function') for(let q=0;q<10;q++){ const a=Math.random()*6.283;
          emitP(sw.x,sw.y-8,{vx:Math.cos(a)*70,vy:Math.sin(a)*70-20,life:0.5,col:'#ff5a4d',sz:3,glow:true}); }
        portalLock=false; return; }
      sw.on=true; ob.got++;
      if(sw.mode==='relay') ob.timer=8;   // the flame is moving — reach the next brazier
      texts.push({x:sw.x,y:sw.y-18,txt:ob.got+'/'+ob.need,col:'#ffe08a',life:1.0}); }
    else sw.on=true;
    if(typeof emitP==='function') for(let q=0;q<10;q++){ const a=Math.random()*6.283;
      emitP(sw.x,sw.y-8,{vx:Math.cos(a)*60,vy:Math.sin(a)*60-30,life:0.6,col:'#ffd07a',sz:3,glow:true}); } }
    portalLock=false; return; }
  if(p.kind==='petpick'){ if(typeof setActivePet==='function') setActivePet(p.wuid); if(typeof spawnActivePet==='function') spawnActivePet();
    const _pn=(typeof activePet==='function'&&activePet())?activePet().name:'Pet'; if(typeof msg==='function') msg('🐾 '+_pn,'now your follower');
    navigator.vibrate&&navigator.vibrate(20); return; }
  if(p.kind==='petstation'){ if(typeof openPets==='function') openPets(p.st.kind==='incubator'?'collection':'fuse'); navigator.vibrate&&navigator.vibrate(20); return; }
  if(p.kind==='npc'){ const np=p.np, ls=np.lines||[];
    // walks his lines, then holds on the last — rendered with the boss death-quote treatment
    const i=Math.min(np.said,ls.length-1); np.said=Math.min(np.said+1,ls.length);
    if(typeof bossSayDeath==='function') bossSayDeath(ls[i],np); else msg(np.name,ls[i]);   // over his head
    if(i===0) msg(np.name,'a warden, still holding');
    navigator.vibrate&&navigator.vibrate(15); return; }
  if(p.kind==='portal'){ usePortal(p.to); }
  else if(p.kind==='ground'){ const gp=p.gp;
    if(gp.home){ const gv=rooms['G']; const rp=dunReturn||{x:gv.w*TILE/2,y:gv.h*TILE/2};
      const sp2=safeSpot(gv,rp.x,rp.y); enterRoom('G',sp2.x,sp2.y); msg('THE CLIMB','back to the vale'); groundPortals.length=0; }
    // Per-boss gate. 'none' = a plain building on the starter island, walk right in — it is
    // already gated by having had to kill its Lv4-16 owner. Anything else (including a MISSING
    // field) means the ascension wall, so a new boss can never accidentally unlock endgame depths.
    else if((GBOSS[gp.ring]&&GBOSS[gp.ring].gate)!=='none' && (!rpg||!rpg.ascension)){
      msg('THE RIFT RESISTS','Ascend to enter the awakened depths'); navigator.vibrate&&navigator.vibrate([20,40,20]); }
    else { enterDungeon(gp.ring); groundPortals.length=0; } }
  else if(p.kind==='pillar'){ const pl=p.pl;
    if(!pillarUnlocked(pl.band)){ unlockPillar(pl.band); msg('WAYPOINT ATTUNED',pl.name); }
    openFastTravel(); }
  // A soulbound sack opens rather than vanishing into the satchel: it can hold several pieces and
  // you should get to see them against what you are wearing before deciding. On a client the
  // panel asks the host first and opens on the grant — it must never award locally.
  else if(p.kind==='loot'){ if(typeof openBagPanel==='function') openBagPanel(p.bag);
    else claimBag(p.bag); }
  navigator.vibrate&&navigator.vibrate(30);
}
// ============================================================
// THE SACK PANEL (user, 2026-07-26)
// A soulbound sack can hold several pieces, so it opens instead of vanishing into the satchel:
// you see each piece measured against what you are actually wearing, and decide per item.
// ------------------------------------------------------------
let bagOpen=null;                   // the bag currently on screen, or null
let bagCmp=-1;                      // index of the row whose full comparison is expanded
function bagPanelShown(){ const s=$s('bagScr'); return !!(s&&s.style.display==='flex'); }
function closeBagPanel(){ bagOpen=null; const s=$s('bagScr'); if(s) s.style.display='none'; }
function openBagPanel(lb){
  if(!lb) return;
  // A client holds only a DISPLAY shadow of a bag unless the host sent it the real contents
  // (which it only does for that client's own soulbound sacks). Anything else goes straight
  // through the request/grant handshake — a ghost must never reach an inventory.
  const its=bagItems(lb);
  if(lb.remote && (!its.length || its[0].ghost)){ claimBag(lb); return; }
  if(!its.length){ claimBag(lb); return; }
  bagOpen=lb; bagCmp=-1; $s('bagScr').style.display='flex'; paintBagPanel();
}
// stat delta of `it` against what is worn in its slot, as coloured chips
function bagDeltaHtml(it,ch){
  if(it&&it.k==='leg'){ const L=legById(it.id);
    return '<span style="color:#ff9c50">'+(L?L.d:'a relic')+'</span>'
      +'<div class="bagWho">equip it from the Loadout screen</div>'; }
  // a relic compares like any other item -- it is one -- but its trait is the part that decides
  // whether you want it, so that goes first and the stat deltas follow underneath
  if(!it||it.k==='pot'||it.k==='coin'||it.k==='scroll') return '';
  if(!canEquip(it,ch)) return '<span class="bagSame">not for your class</span>';
  let head='';
  if(it.relic){ const R=relicDef(it.relic);
    head='<div class="relTrait">'+(R?R.d:'')+'</div>';
    if(R&&R.trait) head+='<div class="relTrait on">✦ '+R.trait.n+' — '+R.trait.d+'</div>';
    // which set it belongs to, and how close you are -- the first thing you want to know about a
    // piece you just found is whether it finishes something
    const S=(R&&typeof relicSet==='function')?relicSet(R.set):null;
    if(S){ const worn=(typeof setWornCount==='function')?setWornCount(S.id):0;
      head+='<div class="relSet">'+S.n+' <b>'+worn+'/4</b> — ✦ '+S.bonus.n+': '+S.bonus.d+'</div>'; } }
  const cur=equippedItemFor(it.k,ch);
  const a=itemStats(it,ch.cls), b=cur?itemStats(cur,ch.cls):newStats();
  let out='', any=false;
  for(const k of STATS){ const d=(a[k]||0)-(b[k]||0); if(!d) continue; any=true;
    out+='<b class="'+(d>0?'bagUp':'bagDown')+'">'+(d>0?'+':'')+d+' '+STAT_META[k].s+'</b>&nbsp; '; }
  if(!any) out='<span class="bagSame">no change</span>';
  return head+out+'<div class="bagWho">vs '+(cur?itemName(cur):'nothing equipped')+'</div>';
}
// Full side-by-side: the drop's sprite and every stat it gives, against the worn piece's sprite
// and stats, with the difference in the middle column.
function bagCompareBlock(it,ch){
  const wrap=document.createElement('div'); wrap.className='bagCmp';
  const cur=equippedItemFor(it.k,ch);
  const a=itemStats(it,ch.cls), b=cur?itemStats(cur,ch.cls):newStats();
  function side(item,stats,label,cls){
    const d=document.createElement('div'); d.className='bagCmpSide';
    const cv=document.createElement('canvas'); cv.width=54; cv.height=54; cv.className='bagCmpIco';
    if(item&&typeof drawItemIcon==='function') drawItemIcon(cv.getContext('2d'),item,54,54);
    d.appendChild(cv);
    const h=document.createElement('div'); h.className='bagCmpHd'; h.textContent=label;
    d.appendChild(h);
    const nm=document.createElement('div'); nm.className='bagCmpNm';
    nm.style.color=item?itemRarCol(item):'#7a7484';
    nm.textContent=item?itemName(item):'nothing equipped';
    d.appendChild(nm);
    let rows='';
    for(const k of STATS){ if(!stats[k]) continue;
      rows+='<div class="bagCmpRow"><span>'+STAT_META[k].s+'</span><b style="color:'+STAT_META[k].col+'">'+stats[k]+'</b></div>'; }
    if(!rows) rows='<div class="bagCmpRow"><span>—</span><b></b></div>';
    const sd=document.createElement('div'); sd.className='bagCmpStats'; sd.innerHTML=rows;
    d.appendChild(sd);
    if(cls) d.classList.add(cls);
    return d;
  }
  wrap.appendChild(side(it,a,'THIS DROP','bagCmpNew'));
  const mid=document.createElement('div'); mid.className='bagCmpMid';
  let ml='';
  for(const k of STATS){ const df=(a[k]||0)-(b[k]||0); if(!df) continue;
    ml+='<div class="'+(df>0?'bagUp':'bagDown')+'">'+(df>0?'+':'')+df+' '+STAT_META[k].s+'</div>'; }
  mid.innerHTML=ml||'<div class="bagSame">identical</div>';
  wrap.appendChild(mid);
  wrap.appendChild(side(cur,b,'EQUIPPED',null));
  return wrap;
}
function paintBagPanel(){
  const lb=bagOpen; if(!lb) return closeBagPanel();
  const ch=curChar(); if(!ch||!rpg) return closeBagPanel();
  const its=bagItems(lb);
  if(!its.length){ closeBagPanel(); return; }
  const band=bagBand(lb), bn=LOOT_BANDS[band], top=bagTopTier(lb);
  const relic=its.some(x=>x&&(x.k==='leg'||x.relic));
  $s('bagTitle').textContent=relic?'A RELIC':((bn&&bn.bound)?'SOULBOUND SACK':'SACK');
  $s('bagSub').innerHTML=(relic
      ? '<span style="color:'+RELIC_COL+'">kept by its dungeon — there is only one</span>'
      : '<span style="color:'+tierCol(top)+'">T'+(top+1)+' '+(TIER_NAMES[top]||'')+'</span>')
    +' · '+its.length+' piece'+(its.length===1?'':'s')
    +((bn&&bn.bound)?' · <span style="color:#ff9c50">bound to you</span>':' · anyone may take this');
  const L=$s('bagList'); L.innerHTML='';
  its.forEach((it,i)=>{
    const row=document.createElement('div'); row.className='bagRow';
    row.style.borderLeftColor=itemRarCol(it);
    const cv=document.createElement('canvas'); cv.width=46; cv.height=46; cv.className='bagIco';
    if(typeof drawItemIcon==='function') drawItemIcon(cv.getContext('2d'),it,46,46);
    row.appendChild(cv);
    const mid=document.createElement('div'); mid.className='bagMid';
    mid.innerHTML='<div class="bagNm" style="color:'+itemRarCol(it)+'">'+itemName(it)+'</div>'
      +'<div class="bagDelta">'+bagDeltaHtml(it,ch)+'</div>';
    row.appendChild(mid);
    const btns=document.createElement('div'); btns.className='bagBtns';
    const bt=document.createElement('button'); bt.className='mbtn dev'; bt.textContent='TAKE';
    bt.onclick=()=>bagTakeOne(i,false); btns.appendChild(bt);
    const be=document.createElement('button'); be.className='mbtn go'; be.textContent='EQUIP';
    be.disabled=!canEquip(it,ch);
    if(be.disabled) be.style.opacity='.4';
    else be.onclick=()=>bagTakeOne(i,true);
    btns.appendChild(be);
    const bc=document.createElement('button'); bc.className='mbtn dev'+(bagCmp===i?' on':'');
    bc.textContent='COMPARE'; bc.onclick=()=>{ bagCmp=(bagCmp===i?-1:i); paintBagPanel(); };
    btns.appendChild(bc);
    row.appendChild(btns);
    L.appendChild(row);
    // COMPARE opens the full side-by-side underneath: every stat of the drop against every stat
    // of what you are wearing, so you can judge a trade the one-line delta cannot express
    if(bagCmp===i){ L.appendChild(bagCompareBlock(it,ch)); }
  });
}
// Pull one piece out of the open bag. `wear` equips it straight away and sends the displaced
// piece to the satchel instead; otherwise it just goes to the satchel.
function bagTakeOne(i,wear){
  const lb=bagOpen; if(!lb) return;
  const its=bagItems(lb), it=its[i]; if(!it) return;
  const ch=curChar(); if(!ch||!rpg) return; if(!ch.inv) ch.inv=[];
  if(wear && canEquip(it,ch)){
    const r=equipItem(it,ch); if(!r) return;
    if(r.old){ if(ch.inv.length<20) ch.inv.push(r.old);
      else { texts.push({x:player.x,y:player.y-30,txt:'satchel full — old gear dropped',col:'#c04a3d',life:1.4});
        loots.push(bagAt({x:player.x,y:player.y},[r.old])); } }
    msg(itemName(it),'equipped');
  } else {
    if(!awardItem(it,lb.x,lb.y)) return;      // satchel full: leave it in the sack
  }
  its.splice(i,1); lb.items=its; lb.item=its[0]||null;
  if(!its.length){ const k=loots.indexOf(lb); if(k>=0) loots.splice(k,1); saveRPG(); closeBagPanel(); return; }
  saveRPG(); paintBagPanel();
}
function bagTakeAll(){
  const lb=bagOpen; if(!lb) return;
  const its=bagItems(lb), left=[];
  for(const it of its) if(!awardItem(it,lb.x,lb.y)) left.push(it);
  lb.items=left; lb.item=left[0]||null;
  if(!left.length){ const k=loots.indexOf(lb); if(k>=0) loots.splice(k,1); saveRPG(); closeBagPanel(); return; }
  saveRPG(); paintBagPanel();     // satchel filled up — whatever is left stays in the sack
}
function travelTo(pl){ closeFastTravel(); const g=rooms['G']; const sp=safeSpot(g,pl.x,pl.y);
  player.x=sp.x; player.y=sp.y; enemies=enemies.filter(e=>e.boss); portalLock=true; msg('WARPED',pl.name); }
function openFastTravel(){ const G=rooms['G']; if(!G||!G.pillars) return;
  let ov=document.getElementById('ftScr');
  if(!ov){ ov=document.createElement('div'); ov.id='ftScr';
    // built HIDDEN — only line ~86 turns it on. If anything throws while building the card,
    // the player is left with the game, not an empty full-screen overlay with no CLOSE button.
    ov.style.cssText='position:fixed;inset:0;background:rgba(8,6,10,.82);z-index:70;display:none;align-items:center;justify-content:center;'; document.body.appendChild(ov); }
  const card=document.createElement('div');
  card.style.cssText='background:#1a151f;border:1px solid #4a3d5c;border-radius:12px;padding:18px;min-width:250px;max-width:90vw;text-align:center;';
  card.innerHTML='<div style="font:bold 15px monospace;color:#ffd07a;margin-bottom:12px;letter-spacing:.1em;">✦ WAYPOINTS ✦</div>';
  for(const pl of G.pillars){ const un=pillarUnlocked(pl.band);
    const b=document.createElement('button');
    const _zn=(G.rings&&G.rings.names&&G.rings.names[pl.band])||{lv:'?'};   // never let one bad pillar blank the list
    b.textContent=(un?'▸ ':'🔒 ')+pl.name+'  ·  Lv '+_zn.lv+((_zn.lv2&&_zn.lv2!==_zn.lv)?'–'+_zn.lv2:'');   // flat rim reads "Lv 50", not "Lv 50–50"
    b.disabled=!un;
    b.style.cssText='display:block;width:100%;margin:5px 0;padding:10px;border-radius:7px;border:1px solid #4a3d5c;font:13px monospace;text-align:left;background:'+(un?'#2a2233':'#181420')+';color:'+(un?'#e8e0d0':'#6a6270')+';cursor:'+(un?'pointer':'default')+';';
    if(un) b.onclick=()=>travelTo(pl);
    card.appendChild(b); }
  const cl=document.createElement('button'); cl.textContent='CLOSE';
  cl.style.cssText='display:block;width:100%;margin-top:12px;padding:10px;border-radius:7px;border:1px solid #4a3d5c;background:#3a2c20;color:#e8e0d0;font:13px monospace;cursor:pointer;';
  cl.onclick=closeFastTravel; card.appendChild(cl);
  ov.innerHTML=''; ov.appendChild(card); ov.style.display='flex'; }
async function hash(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('emberrealm\u00b7'+s));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
const CLASSES=[
 {id:'ranger',n:'Ranger',ic:'🏹',d:'Fast hands, thin armor.',hp:90,spd:205,dmg:9,fr:0.17},
 {id:'pyro',n:'Pyromancer',ic:'🔥',d:'Bolts that hit like a forge.',hp:80,spd:160,dmg:26,fr:0.30},
 {id:'knight',n:'Knight',ic:'⚔️',d:'A walking wall of iron.',hp:190,spd:145,dmg:14,fr:0.30},
 {id:'rogue',n:'Rogue',ic:'🗡️',d:'Never where the blade lands.',hp:85,spd:230,dmg:8,fr:0.18},
 {id:'assassin',n:'Assassin',ic:'🔪',d:'One breath, one kill.',hp:88,spd:220,dmg:14,fr:0.20},
 {id:'cleric',n:'Cleric',ic:'⛑️',d:'Wounds close as fast as they open.',hp:115,spd:170,dmg:10,fr:0.24,regen:3},
 {id:'berserker',n:'Berserker',ic:'🪓',d:'Anger, weaponized.',hp:125,spd:185,dmg:19,fr:0.30},
 {id:'warlock',n:'Warlock',ic:'💀',d:'Every wound he deals feeds him.',hp:95,spd:170,dmg:16,fr:0.26,ls:0.12},
 {id:'frost',n:'Frostweaver',ic:'❄️',d:'Her bolts freeze the blood.',hp:100,spd:170,dmg:13,fr:0.26,slow:true},
 {id:'storm',n:'Stormcaller',ic:'⚡',d:'Lightning stops for no one.',hp:95,spd:180,dmg:12,fr:0.26,pierce:2},
 // Hunter and Shaman used to add projectiles from the class. Projectile count is the weapon's
 // alone now, so the output they lost comes back as rate — a Hunter looses arrows faster than
 // anyone rather than two at a time, and the Shaman's spirits pass THROUGH a rank (the staff
 // pierces) rather than fanning across one.
 {id:'hunter',n:'Hunter',ic:'🐺',d:'Looses faster than the eye follows.',hp:105,spd:195,dmg:8,fr:0.135},
 {id:'monk',n:'Monk',ic:'🥋',d:'Speed is its own armor.',hp:105,spd:215,dmg:9,fr:0.20},
 {id:'paladin',n:'Paladin',ic:'✨',d:'Faith holds the line.',hp:165,spd:155,dmg:12,fr:0.28,regen:2},
 {id:'necro',n:'Necromancer',ic:'🧟',d:'Death pays him tribute.',hp:90,spd:165,dmg:17,fr:0.28,ls:0.15},
 {id:'bard',n:'Bard',ic:'🎻',d:'Fights in tempo.',hp:100,spd:200,dmg:10,fr:0.22},
 {id:'shaman',n:'Shaman',ic:'🌀',d:'The spirits pass through.',hp:110,spd:175,dmg:6,fr:0.19},
 {id:'dragoon',n:'Dragoon',ic:'🐉',d:'Ember-blooded lancer.',hp:145,spd:175,dmg:16,fr:0.28},
];
const $s=id=>document.getElementById(id);
// ---- WEAPONS ----
// rof is the shot INTERVAL multiplier (higher = slower), and it is not hand-picked: every weapon's
// rate is derived from what it actually puts out, so damage, projectile count and rate stay tied
// together (user, 2026-07-26).
//
//   rof = K / index
//
// K is the weapon's measured single-target output per unit time at rof 1, relative to a bow. It is
// MEASURED, not computed from shots x dm, because a spread wastes projectiles: the sword throws
// three bolts but at 0.35 spread only about one lands on a 15px target, so its K is 1.00 and not
// 3.00. index is the single-target DPS the weapon is meant to have relative to a bow, and it is
// where the design intent lives — short reach and no pierce earn a higher index; long reach and
// pierce pay for themselves with a lower one.
//
//   weapon   reach  K     index   rof     why that index
//   fists     94    0.78  1.30    0.60    shortest reach in the game, must stand in the fight
//   sword    106    1.00  1.20    0.83    melee reach, and the spread cleaves a group
//   dagger   157    1.36  1.25    1.09    short reach, fastest hands
//   bow      768    1.00  1.00    1.00    the baseline everything else is quoted against
//   xbow     988    1.59  0.95    1.67    longest reach, heaviest single hit, pierces one
//   staff    432    1.03  0.85    1.21    pierces everything
//   wand     840    1.00  0.80    1.25    pierces everything AND reaches nearly as far as a bow
//
// `shots` is the WEAPON's alone (06_combat: `const n=Math.min(7,wt.shots||1)`). It used to stack
// with the class's own, which is how a Shaman's staff threw three bolts; that is gone and
// `player.shots` is display-only. The piercing weapons still carry the two lowest indices because
// a bolt that bores through a rank is worth more than one that stops in the first body.
const WTYPE={
 sword:{n:'Sword',shots:3,spread:0.35,spd:380,life:0.28,size:6,dm:1.0,rof:0.83},
 dagger:{n:'Dagger',shots:2,spread:0.12,spd:560,life:0.28,size:4,dm:0.7,rof:1.09},
 bow:{n:'Bow',shots:1,spd:640,life:1.2,size:5,dm:1.0,rof:1.0},
 xbow:{n:'Crossbow',shots:1,spd:760,life:1.3,size:6,dm:1.6,rof:1.67,pierce:1},
 // Staff and wand bore THROUGH a rank of enemies (user, 2026-07-26) — a bolt of force does not
 // stop in the first body. pierce:99 is "everything", full damage to every body, no decay.
 // The staff drops its second parallel bolt as part of the price: at 11px apart both landed in the
 // same 15px target, so it was doubling single-target damage while adding almost nothing to reach.
 // One piercing bolt is the cleaner weapon.
 staff:{n:'Staff',shots:1,spd:480,life:0.9,size:6,dm:1.0,rof:1.21,pierce:99},
 wand:{n:'Wand',shots:1,spd:600,life:1.4,size:4,dm:1.0,rof:1.25,pierce:99},
 // The monk's weapon. Same numbers 'fists' always had -- reach spd*life = ~94px, the shortest in
 // the game, which is why it carries the highest index and so the fastest rate. Nothing was
 // re-derived: this is a rename with an item behind it.
 gauntlet:{n:'Gauntlets',shots:1,spd:520,life:0.18,size:5,dm:0.85,rof:0.60},
 // RETIRED, kept deliberately. `legacy` is what excludes a type from every generator (see mkItem
 // and auctionListings), and keeping the row means a save still holding `wt:'fists'` renders and
 // migrates instead of throwing in itemBaseName before migrateWpnType can repair it.
 fists:{n:'Fists',shots:1,spd:520,life:0.18,size:5,dm:0.85,rof:0.60,legacy:1},
};
// Melee -> sword; rogue/assassin -> dagger; ranger/hunter/bard -> bow (swap to xbow, see WSWAP);
// monk -> gauntlet (was 'fists', which no generator could ever produce -- see migrateWpnType).
const CWEAP={rogue:'dagger',assassin:'dagger',monk:'gauntlet',ranger:'bow',hunter:'bow',bard:'bow',
 pyro:'staff',frost:'staff',cleric:'wand',storm:'wand',
 warlock:'wand',necro:'staff',berserker:'sword',knight:'sword',paladin:'sword',
 dragoon:'sword',shaman:'staff'};
// Classes that can toggle between two ranged weapons (bow <-> crossbow).
const WSWAP={ranger:['bow','xbow'],hunter:['bow','xbow'],bard:['bow','xbow']};
const CARMOR={knight:'plate',paladin:'plate',berserker:'plate',dragoon:'plate',
 ranger:'leather',hunter:'leather',rogue:'leather',assassin:'leather',monk:'leather',bard:'leather',
 pyro:'robe',frost:'robe',cleric:'robe',storm:'robe',warlock:'robe',necro:'robe',shaman:'robe'};
const MATN={plate:'Plate',leather:'Leather',robe:'Robe'};
// One ring per straight stat (T1-12 like weapons/armor). st keys keep the old
// 'hp'/'dmg'/'spd' for save compat; each ring grants its stat scaled by tier.
// (Special rings with unique effects will layer on top of this later.)
const RING_DEF={
 hp:  {stat:'hp',  n:'Ring of Vigor',     col:'#f0705a', v:t=>t*8+10},
 dmg: {stat:'atk', n:'Ring of Fury',      col:'#e2604c', v:t=>Math.round(t*1.6)+3},
 def: {stat:'def', n:'Ring of Warding',   col:'#c9d2da', v:t=>Math.round(t*1.0)+2},
 mp:  {stat:'mp',  n:'Ring of the Font',  col:'#7ab8d4', v:t=>t*5+8},
 vit: {stat:'vit', n:'Ring of Vitality',  col:'#7dc47a', v:t=>Math.round(t*0.9)+2},
 wis: {stat:'wis', n:'Ring of Wisdom',    col:'#c07ad4', v:t=>Math.round(t*1.0)+2},
 dex: {stat:'dex', n:'Ring of Precision', col:'#e8b34b', v:t=>Math.round(t*0.9)+2},
 spd: {stat:'spd', n:'Ring of Haste',     col:'#9ad4ef', v:t=>t*2+4},
 luck:{stat:'luck',n:'Ring of Luck',      col:'#8fd48c', v:t=>Math.round(t*1.2)+3},
};
// FORTUNE COINS — a rare passive loot boost you carry. Bronze/Silver/Gold (tier 0/1/2).
// Coins merge: 20 bronze -> 1 silver, 20 silver -> 1 gold. Your BEST coin tier grants
// passive fortune (more/better drops via rollLoot). Stored as rpg.coins=[bronze,silver,gold].
const COIN_NAMES=['Bronze','Silver','Gold'];
const COIN_VAL=[1,20,400];     // bronze-equivalent value (silver=20 bronze, gold=20 silver)
function coinValue(){ if(!rpg||!rpg.coins) return 0; let v=0; for(let i=0;i<3;i++) v+=(rpg.coins[i]||0)*COIN_VAL[i]; return v; }
// Every coin adds to the loot boost (merge-neutral in value); soft-diminishing so it stays sane.
function coinFortune(){ const v=coinValue(); return v>0?Math.round(2*Math.sqrt(v)):0; }
function addCoin(){ if(!rpg) return; if(!rpg.coins) rpg.coins=[0,0,0]; rpg.coins[0]++;
  while(rpg.coins[0]>=20){ rpg.coins[0]-=20; rpg.coins[1]++; }
  while(rpg.coins[1]>=20){ rpg.coins[1]-=20; rpg.coins[2]++; } }
const RING_STATS=Object.keys(RING_DEF);
const RINGN={}; for(const _k in RING_DEF) RINGN[_k]=RING_DEF[_k].n;
const LEGENDS=[
 {id:'hearthrender',slot:'wpn',n:'Hearthrender',price:12000,add:120,rof:1.0,d:'+120 dmg · forged in the first fire'},
 {id:'duskfang',slot:'wpn',n:'Duskfang',price:9000,add:55,rof:0.72,d:'+55 dmg · strikes 40% faster'},
 {id:'aegisflame',slot:'arm',n:'Aegis of the First Flame',price:11000,def:22,hp:120,spd:0,d:'+22 DEF · +120 HP'},
 {id:'wandershroud',slot:'arm',n:"Wanderer's Shroud",price:8000,def:10,hp:40,spd:35,d:'+10 DEF · +40 HP · +35 SPD'},
];
// ============================================================
// DUNGEON RELICS — T13 RIFTFORGED (user, 2026-07-26)
// ------------------------------------------------------------
// A relic IS a tiered item, exactly like everything else you wear: same object shape, same slot,
// same equip path, same satchel, same compare, same icon. What makes it a relic is that it sits
// one band ABOVE the ladder (RELIC_T), so its tier base already beats the best T12 that can ever
// drop, and that it carries fixed EXCLUSIVE affixes at values no roll can reach.
//
// WHAT they are -- the twelve four-piece sets, their bonuses, and the drop gate -- lives in
// 17e_relics.js. This file keeps only the machinery that turns one into an item you can wear.
// A relic is SHAPED FOR THE HERO WHO FINDS IT: weapons take their class's weapon type, armour and
// helms their material, so a piece passes the ordinary canEquip check and fights like the gear they
// trained on. Rings carry the stat their set chose. Identity is the name, the affixes and the
// trait -- never the silhouette.
function mkRelicItem(id,cls){
  const R=relicDef(id); if(!R) return null;
  const it={ k:R.slot, t:RELIC_T, relic:R.id, rar:5, aff:R.aff.map(a=>({s:a.s,v:a.v})) };
  if(R.slot==='wpn') it.wt=CWEAP[cls]||'sword';
  else if(R.slot==='ring') it.st=R.st||'luck';
  else it.mt=CARMOR[cls]||'plate';                    // arm + helm both read the class material
  return it;
}
// the dungeon a relic belongs to, through its set
function relicRing(id){ const R=relicDef(id); const S=R?relicSet(R.set):null; return S?S.ring:-1; }
// `rpg.relics` is the RECORD of which relics this hero has ever taken. It is not where the item
// lives -- the item lives in the satchel or on your body like any other -- but a record is what
// stops a boss dropping you a second copy, and what the death screen scores.
function ownsRelic(id){
  if(!rpg) return false;
  if(rpg.relics && rpg.relics.indexOf(id)>=0) return true;
  const ch=(typeof curChar==='function')?curChar():null;
  if(ch&&ch.inv) for(const it of ch.inv) if(it&&it.relic===id) return true;
  for(const sl of ['wpn','arm','helm','ring']){ const e=(rpg.eqAff||{})[sl]; if(e&&e.rel===id) return true; }
  return false;
}
function noteRelicTaken(id){ if(!rpg) return;
  if(!rpg.relics) rpg.relics=[];
  if(rpg.relics.indexOf(id)<0){ rpg.relics.push(id);
    if(typeof runNote==='function') runNote('relics'); } }
function legById(id){ return LEGENDS.filter(function(L){return L.id===id;})[0]||null; }
// THE LADDER. Index 0-11 are T1-T12, the tiers the world can actually roll. Index 12 is the band
// ABOVE the ladder: T13 Riftforged, which nothing rolls and nothing sells -- it exists only as the
// twelve dungeon relics, one per dungeon.
const TIER_NAMES=['Cracked','Worn','Iron','Steel','Tempered','Runed','Ember','Obsidian','Storm-forged','Dragonbone','Mythril','Hearthfire','Riftforged'];
// MAXT is the top ROLLABLE tier and every random draw still clamps to MAXT-1, so widening the
// ladder above it cannot leak a T13 into a drop table, an auction shelf or a shop row.
const MAXT=12;
const RELIC_T=12;                    // 0-based index of the Riftforged band == T13
function classWT(cls){ return WTYPE[CWEAP[cls]]||WTYPE.sword; }
function weaponAt(cls,t){ t=Math.max(0,Math.min(MAXT-1,t)); const wt=classWT(cls);
 return {n:TIER_NAMES[t]+' '+wt.n, add:Math.round(t*t*1.35+t*2),
  cost:t===0?0:Math.round(30*Math.pow(1.9,t)), tier:t+1}; }
function tierCost(t){return t===0?0:Math.round(30*Math.pow(1.9,t));}
// THE RELIC COLOUR. One violet for everything a relic touches -- its name, the R on its icon, the
// glow on its sack, the banner, the set line, the floating text. It is deliberately bluer and more
// saturated than the T9-T10 violet (#c07ad4) and than the diamond violet (#e0a6ff), so those three
// never read as the same thing. `--relic` in style.css is this same value; change both together.
const RELIC_COL='#a06bff';
function tierCol(t){ return t>=12?RELIC_COL:t>=11?'#ff9c50':t>=9?'#c07ad4':t>=6?'#7ab8d4':t>=3?'#7dc47a':'#cfc8bd'; }

// ============================================================
// LOOT TIERS BY AREA (user, 2026-07-26)
// ------------------------------------------------------------
// Tier is the only power axis, so tier is what the world gates. Where you farm decides what you
// can get; the level of the thing you killed no longer does. Keyed by CLUMP index 0-12, which is
// what zoneAt() returns and is stable per world position.
//
//   pub  weighted tiers for the PUBLIC channel, capped at T8 -- any player in the area may take it
//   sb   weighted tiers for the SOULBOUND channel, T9+, rolled per player and lootable only by them
//   sbP  soulbound chance on a trash kill (elites x3; bosses roll one guaranteed, see rollLoot)
//
// Weights are [tierIndex(0-based), weight]. Bands overlap by one tier at each seam so the ladder
// never has a hard wall, and the low zones deliberately stay generous -- gear should not be scarce
// at the start, only at the top.
const ZONE_TIERS=[
 /* 0  The Landing Sands  Lv1-8   */ {pub:[[0,65],[1,35]],            sb:null,                      sbP:0},
 /* 1  Gullwind Shore     Lv8-14  */ {pub:[[1,60],[2,40]],            sb:null,                      sbP:0},
 /* 2  Sawgrass Flats     Lv14-20 */ {pub:[[2,60],[3,40]],            sb:null,                      sbP:0},
 /* 3  The Verdant Belt   Lv20-26 */ {pub:[[3,55],[4,45]],            sb:null,                      sbP:0},
 /* 4  Wolfwood           Lv26-32 */ {pub:[[4,50],[5,50]],            sb:null,                      sbP:0},
 /* 5  Deep Timber        Lv32-39 */ {pub:[[5,45],[6,55]],            sb:[[8,100]],                 sbP:0.0015},
 /* 6  Stonebrow Rise     Lv39-45 */ {pub:[[6,40],[7,60]],            sb:[[8,70],[9,30]],           sbP:0.0030},
 // Cinderwatch is the calibration point: a Lv45 hero should be able to stand in a full T12 set.
 // At a 5% T12 weight that took a 118-boss median to complete — the right shape but one notch too
 // slow, so T12 is worth a quarter of this zone's bound drops. The grind ring still leads it.
 /* 7  Cinderwatch        Lv45-50 */ {pub:[[7,100]],                  sb:[[9,35],[10,40],[11,25]],  sbP:0.0045},
 /* 8  The Ashfall        Lv50    */ {pub:[[7,100]],                  sb:[[10,45],[11,55]],         sbP:0.0060},
 /* 9  Charred Steppe     Lv50    */ {pub:[[7,100]],                  sb:[[10,45],[11,55]],         sbP:0.0060},
 /* 10 The Molten Heart   Lv50    */ {pub:[[7,100]],                  sb:[[10,45],[11,55]],         sbP:0.0060},
 /* 11 The Glowing Waste  Lv50    */ {pub:[[7,100]],                  sb:[[10,45],[11,55]],         sbP:0.0060},
 /* 12 Emberflow          Lv50    */ {pub:[[7,100]],                  sb:[[10,45],[11,55]],         sbP:0.0060},
];
const ZONE_TIERS_FALLBACK={pub:[[0,100]],sb:null,sbP:0};   // ocean / bridge / anything unmapped
const PUB_TMAX=7;          // public gear caps at T8 (0-based 7). Everything above is soulbound.
const TIER_OVERFLOW=0.05;  // a small tail one tier above the row's max, so the chase never dies

// Which area's table applies to a kill. In a dungeon there is no overworld band under the tile
// (rings is null), so the drop inherits the boss's OVERWORLD clump -- the dream pays out in the
// currency of the homeland it remembers, which is the rule the tiles and mob names already follow.
function zoneTierRow(x,y){
  let z=-1;
  if(typeof curRoom!=='undefined'&&curRoom){
    if(curRoom.rings && typeof zoneAt==='function') z=zoneAt(x/TILE,y/TILE);
    else if(typeof curRoom.ring==='number'&&typeof BOSS_ZONE!=='undefined') z=BOSS_ZONE[curRoom.ring];
  }
  return ZONE_TIERS[z]||ZONE_TIERS_FALLBACK;
}
function pickWeighted(rows,fort){
  if(!rows||!rows.length) return 0;
  let tot=0; for(const r of rows) tot+=r[1];
  let q=Math.random()*tot;
  let t=rows[rows.length-1][0];
  for(const r of rows){ q-=r[1]; if(q<0){ t=r[0]; break; } }
  // the overflow tail: a rare step above the row's ceiling. Fortune widens it.
  if(Math.random() < TIER_OVERFLOW*(1+(fort||0)*0.02)){
    let mx=0; for(const r of rows) if(r[0]>mx) mx=r[0];
    if(t===mx) t=mx+1;
  }
  return Math.max(0,Math.min(MAXT-1,t));
}

// ============================================================
//  10-STAT SYSTEM
//  atk def hp mp vit wis dex spd luck fort
//  luck -> crit chance + hit   ·   fort -> loot bonus
// ============================================================
const STATS=['atk','def','hp','mp','vit','wis','dex','spd','luck','fort'];
const STAT_META={
 atk :{n:'Attack',  s:'ATK', col:'#e2604c'},
 def :{n:'Defense', s:'DEF', col:'#c9d2da'},
 hp  :{n:'Health',  s:'HP',  col:'#8fd48c'},
 mp  :{n:'Mana',    s:'MP',  col:'#7ab8d4'},
 vit :{n:'Vitality',s:'VIT', col:'#7dc47a'},
 wis :{n:'Wisdom',  s:'WIS', col:'#c07ad4'},
 dex :{n:'Dexterity',s:'DEX',col:'#e8b34b'},
 spd :{n:'Speed',   s:'SPD', col:'#9ad4ef'},
 luck:{n:'Luck',    s:'LCK', col:'#8fd48c'},
 fort:{n:'Fortune', s:'FRT', col:'#ffc94d'},
};
function newStats(){ const s={}; for(const k of STATS) s[k]=0; return s; }
function addStats(a,b){ for(const k of STATS) a[k]+=(b[k]||0); return a; }
function classBaseStats(c){
 const mt=CARMOR[c.id]||'plate';
 const cast=mt==='robe', agile=mt==='leather';
 return { atk:c.dmg, def:cast?2:agile?3:6, hp:c.hp,
  mp:cast?60:agile?36:26, vit:Math.round((c.regen||1)*4),
  wis:cast?14:agile?7:5,
  dex:Math.round(Math.max(4,Math.min(24,(0.30/c.fr)*8))),
  spd:c.spd, luck:(c.id==='rogue'||c.id==='hunter')?9:5, fort:5 };
}
// Per-level stat growth ×3 vs the old Lv150 game — the level axis is compressed 150->50, so a
// Lv50 hero reaches the same level-stats an old Lv150 hero had (gear tier + tree power reach cap
// at 50 too). This keeps the whole power/difficulty relationship intact, just 3x steeper.
function levelStats(c,lvl){ const L=Math.max(0,lvl-1); const mt=CARMOR[c.id]||'plate';
 const cast=mt==='robe', agile=mt==='leather';
 return { atk:Math.round(L*4.8), def:Math.round(L*1.05), hp:Math.round(L*30),
  mp:Math.round(L*(cast?4.2:2.1)), vit:Math.round(L*1.5),
  wis:Math.round(L*(cast?1.8:0.9)), dex:Math.round(L*(cast?0.78:agile?0.78:0.66)),
  spd:Math.round(L*1.8), luck:Math.round(L*0.45), fort:Math.round(L*0.36) };
}
// fixed base stats for a gear piece by slot + tier (+ material / ring type)
function gearBaseStats(slot,t,extra){ const s=newStats(); t=t|0;
 if(slot==='wpn'){ s.atk=Math.round(t*t*1.35+t*2); s.dex=Math.round(t*0.8); }
 else if(slot==='arm'){ const mt=extra||'plate'; const dm={plate:1.5,leather:1.0,robe:0.7}[mt]||1;
  s.def=Math.round((t+1)*dm*1.4); s.hp=t*6+8; s.vit=Math.round(t*0.6);
  if(mt==='leather'){ s.dex=Math.round(t*0.8); s.spd=Math.round(t*1.4); }
  else if(mt==='robe'){ s.wis=Math.round(t*1.1); s.mp=t*4; }
  else { s.def+=Math.round(t*0.6); s.hp+=t*3; } }
 else if(slot==='helm'){ s.wis=Math.round((t+1)*1.1); s.mp=(t+1)*4;
  s.def=Math.round((t+1)*0.6); s.vit=Math.round(t*0.4); }
 else if(slot==='ring'){ const rd=RING_DEF[extra]||RING_DEF.hp; s[rd.stat]=(s[rd.stat]||0)+rd.v(t); }
 return s;
}
// RARITY (user, 2026-07-26) does exactly two things: it picks the item's border colour, and it
// sets HOW MANY random stats the item rolls (count == rarity index, see rollAffixes). It does NOT
// scale power. It used to: a RAR_MULT of up to 3.0x on base stats meant a lucky Mythical T5
// out-stat a Common T9, so the two axes fought each other and the tier ladder stopped meaning
// anything. TIER is now the only power axis and the only progression axis.
const RAR_NAMES=['','Uncommon','Rare','Epic','Legendary','Mythical'];
const RAR_COL=['#cfc8bd','#7dc47a','#7ab8d4','#c07ad4','#ff9c50','#ff4d5e'];
function scaleStats(s,m){ for(const k of STATS) s[k]*=m; return s; }
const AFFIX_PREFIX={ atk:'Vicious', def:'Sturdy', hp:'Vital', mp:'Arcane',
 vit:'Hearty', wis:"Sage's", dex:'Nimble', spd:'Swift', luck:'Lucky', fort:'Prosperous' };
// rarity can roll at ANY tier. Quality q in [0,1) is skewed toward 1 by tier+fortune
// (higher exponent = better rolls) but the fixed ascending cutoffs keep the order
// intact — Mythical is always the rarest slice, never overtaking Legendary.
function rollRarity(t,fortune){
 const e=1+(t|0)*0.045+(fortune||0)*0.03;
 const q=1-Math.pow(Math.random(),e);
 if(q>0.997) return 5;   // Mythical
 if(q>0.975) return 4;   // Legendary
 if(q>0.91)  return 3;   // Epic
 if(q>0.75)  return 2;   // Rare
 if(q>0.46)  return 1;   // Uncommon
 return 0; }
function affixValue(k,t,rar){ const mag=(t-3)*(1+rar*0.4);
 if(k==='hp'||k==='mp') return Math.max(2,Math.round(mag*3+4));
 if(k==='atk'||k==='spd') return Math.max(1,Math.round(mag*1.5+2));
 return Math.max(1,Math.round(mag*0.8+1)); }
function rollAffixes(it,fortune){ it.rar=rollRarity(it.t,fortune); it.aff=[];
 if(!it.rar) return it;
 const keys=Object.keys(AFFIX_PREFIX), used={};
 for(let i=0;i<it.rar;i++){ let k,g=0; do{ k=keys[Math.floor(Math.random()*keys.length)]; }while(used[k]&&g++<12); used[k]=1;
  it.aff.push({s:k,v:affixValue(k,it.t,it.rar)}); }
 return it; }
function affStats(aff){ const s=newStats(); if(aff) for(const a of aff) s[a.s]=(s[a.s]||0)+a.v; return s; }
// full stat block an item contributes (base + its own affixes)
function itemStats(it,cls){ if(!it||it.k==='pot'||it.k==='scroll') return newStats();
 if(it.k==='coin') return newStats();   // coins boost via the carried total, not per-item
 let base;
 if(it.k==='wpn') base=gearBaseStats('wpn',it.t);
 else if(it.k==='arm') base=gearBaseStats('arm',it.t,it.mt);
 else if(it.k==='helm') base=gearBaseStats('helm',it.t,it.mt);
 else if(it.k==='ring') base=gearBaseStats('ring',it.t,it.st);
 else base=newStats();
 // base power is the TIER's, untouched by rarity — rarity only adds the rolled affixes below
 addStats(base,affStats(it.aff));
 for(const k of STATS) base[k]=Math.round(base[k]);
 return base;
}
function itemBaseName(it){
 const p='T'+(it.t+1)+' '+TIER_NAMES[it.t]+' ';
 // guarded: an unknown type must not take the satchel down with it. A co-op peer on an older build
 // can hand over a weapon whose type this client has never heard of.
 if(it.k==='wpn')return p+(WTYPE[it.wt]||WTYPE.sword).n;
 if(it.k==='arm')return p+MATN[it.mt]+' Armor';
 if(it.k==='helm')return p+MATN[it.mt]+' Helm';
 if(it.k==='ring')return 'T'+(it.t+1)+' '+RINGN[it.st];
 if(it.k==='coin')return (COIN_NAMES[it.t||0])+' Fortune Coin';
 return p; }
function itemName(it){ if(it.k==='pot')return 'Ember Tonic';
 if(it.k==='scroll')return (typeof scrollName==='function')?scrollName(it.st):'Scroll';
 if(it.k==='leg'){ const L=legById(it.id); return '★ '+(L?L.n:'Relic'); }
 // a relic wears its own name -- it is one specific object, not a roll off a table
 if(it.relic){ const R=relicDef(it.relic); if(R) return '★ '+R.n; }
 let nm=itemBaseName(it);
 if(it.rar && it.aff && it.aff.length) nm=AFFIX_PREFIX[it.aff[0].s]+' '+nm;
 return nm; }
function itemRarCol(it){ if(it&&(it.k==='leg'||it.relic)) return tierCol(RELIC_T);  // relics have their own colour
 return (it&&it.rar)?RAR_COL[it.rar]:tierCol(it?it.t:0); }
// a relic is equipped from the loadout screen (it owns the wpnL/armL slot), not from a bag row
function canEquip(it,ch){ if(!it||it.k==='pot'||it.k==='leg')return false;
 if(it.k==='wpn')return CWEAP[ch.cls]===it.wt;
 if(it.k==='arm'||it.k==='helm')return CARMOR[ch.cls]===it.mt;
 return it.k==='ring'; }
// ------------------------------------------------------------
// NEUTRAL GLORY VALUE (user, 2026-07-26)
// Every item has one honest number attached to it, and a listing may be set anywhere from 50%
// below to 50% above. That band is what makes an auction possible on a peer-to-peer game: a
// price can be haggled but it can never be absurd, so nobody can launder glory through a
// 1-glory sale to a friend or hold a T12 hostage at a million.
// The curve is deliberately much gentler than the old gold one (30 x 1.9^t put a T12 at ~48,000,
// which is twelve strong runs). Here a T12 sits near a quarter of a single good run, so trading
// is a way to fill a slot you are unlucky on, not a replacement for playing.
const GLORY_KIND={wpn:1.0, arm:1.0, helm:0.78, ring:0.82};
const GLORY_SPREAD=0.5;                       // a listing may sit +/- 50% of neutral
function itemGlory(it){
  if(!it) return 0;
  if(it.k==='pot')    return 6;
  if(it.k==='scroll') return 45;
  // LOOT BOOSTERS ARE THE MOST VALUABLE THINGS IN THE GAME (user, 2026-07-26). A Fortune Coin
  // raises every future drop for as long as it is carried, so it compounds in a way no single
  // piece of gear can — a gear item is one slot, a coin is every slot forever. Priced far above
  // the ladder on purpose, and scaled by the 20:1 merge ratio so the tiers stay consistent with
  // each other. A Gold coin is a trophy worth tens of runs, not something you shop for.
  if(it.k==='coin')   return [300,6000,120000][it.t||0]||300;
  if(it.k==='leg')    return 2600;            // the old relic form; the new one prices off its tier
  const t=(it.t|0)+1;
  const base=12*Math.pow(t,1.85);             // T1 ~12, T6 ~330, T9 ~700, T12 ~1170
  const km=GLORY_KIND[it.k]||1;
  // a Prosperous roll is loot boost on a gear slot, so it carries the same premium the coins do:
  // it keeps paying out on every drop you ever make while the piece is worn
  let fm=1; if(it.aff) for(const a of it.aff) if(a.s==='fort') fm+=0.85;
  // rarity is not power any more, but more rolled stats is still more item
  return Math.max(2,Math.round(base*km*fm*(1+(it.rar||0)*0.18)));
}
function gloryPriceRange(it){ const b=itemGlory(it);
  return {base:b, min:Math.max(1,Math.round(b*(1-GLORY_SPREAD))), max:Math.round(b*(1+GLORY_SPREAD))}; }
// what a listing is allowed to ask. Anything outside the band is pulled back to its edge rather
// than rejected, so a bad number never blocks a sale -- it just cannot be an exploit.
function clampGloryPrice(it,p){ const r=gloryPriceRange(it);
  const n=Math.round(p===undefined||p===null||isNaN(p)?r.base:p);
  return Math.max(r.min,Math.min(r.max,n)); }
function itemValue(it){ if(it.k==='coin') return [30,600,12000][it.t||0];
 if(it.k==='scroll') return 40;
 // worth follows tier, plus a modest premium per rolled affix — rarity is no longer raw power,
 // but more rolled stats is still more item, and a Mythical should not sell for a Common's price
 return it.k==='pot'?8:Math.max(6,Math.round(tierCost(it.t)*0.4*(1+(it.rar||0)*0.12))); }
// One item of a GIVEN kind at a given tier. The kind is chosen by the bag slot, not here.
function mkItem(k,t,fort){ t=Math.max(0,Math.min(MAXT-1,t)); let it;
 // data-driven rather than name-matched: a retired type carries `legacy` and drops out of every
 // generator at once, which is what lets the monk's gauntlet appear here like any other weapon
 if(k==='wpn'){ const keys=Object.keys(WTYPE).filter(x=>!WTYPE[x].legacy);
   it={k:'wpn',wt:keys[Math.floor(Math.random()*keys.length)],t:t}; }
 else if(k==='arm'||k==='helm'){ const mats=['plate','leather','robe'];
   it={k:k,mt:mats[Math.floor(Math.random()*3)],t:t}; }
 else it={k:'ring',st:RING_STATS[Math.floor(Math.random()*RING_STATS.length)],t:t};
 return rollAffixes(it, (fort!==undefined)?fort:((typeof player!=='undefined'&&player.fortune)||0)); }
// legacy single-item drop, still used by the boss branches in 07_update
function mkDrop(t,fort){ const r=Math.random();
 const k = r<0.5?'wpn' : r<0.7?'arm' : r<0.85?'helm' : 'ring';
 return mkItem(k,t,fort); }

// ------------------------------------------------------------
// BAG SLOTS (user, 2026-07-26)
// A bag is a fixed set of TYPED slots, each rolled independently. Composition is controlled here
// rather than by one weighted pick, so "armour comes up twice as often as weapons" is expressed as
// two armour slots instead of a magic number — and a bag can occasionally pay out two or three
// pieces at once, which is what makes opening one feel like an event.
// The per-slot odds are deliberately low: across a whole layout they average about one item, so
// the scarcity of the drop tables is preserved while individual bags get a spread.
const BAG_SLOTS={
 // ~0.95 items/bag, and 34% of rolls come up completely empty -> no bag drops at all
 pub:[ {k:'wpn',p:0.28}, {k:'arm',p:0.22}, {k:'arm',p:0.12}, {k:'helm',p:0.18}, {k:'ring',p:0.15} ],
 // soulbound bags are already rare enough to reach, so they are never empty (see the guarantee in
 // rollBagSlots); the extra slots are the chance of a second or third piece on top.
 bound:[ {k:'wpn',p:0.30}, {k:'arm',p:0.24}, {k:'helm',p:0.18}, {k:'ring',p:0.16} ],
};
function rollBagSlots(layout,tier,fort,guarantee){
 const items=[], fm=1+(fort||0)*0.004;
 for(const s of layout) if(Math.random()<s.p*fm) items.push(mkItem(s.k,tier,fort));
 if(!items.length && guarantee){ const s=layout[Math.floor(Math.random()*layout.length)];
   items.push(mkItem(s.k,tier,fort)); }
 return items; }
// ------------------------------------------------------------
// BAG BANDS — the sack you see is decided by the best TIER inside it, never by rarity.
// Data-driven so the planned tier above T12 is one row here plus one sprite: no logic change.
//
// ART BUDGET (user, 2026-07-26): T9-T12 are only the FIRST soulbound bands, not the ceiling.
// Higher tiers are coming, so these sacks stay deliberately restrained — plain leather with a wax
// seal, then studded canvas with an iron clasp. Ornament is spent in order: gold thread, gems,
// ember glow and rift-light are all still unused, and belong to the bands above these. The engine
// already escalates the light beam and the glow radius by band index, so a future row reads as
// more special without the sprite having to shout.
const LOOT_BANDS=[
 {min:0,  spr:'_lootSack',    bound:false, life:60,  label:''},        // public   T1-T8
 {min:8,  spr:'_lootSackT9',  bound:true,  life:240, label:'BOUND'},   // soulbound T9-T10
 {min:10, spr:'_lootSackT11', bound:true,  life:300, label:'BOUND'},   // soulbound T11-T12
 // The relic band. STILL A SACK -- the chest is retired and every drop in this game reads through
 // material and ornament, never through shape -- but the richest one there is: violet and gold
 // thread, gems in the seams, light coming out of it. Ten minutes on the ground, because the one
 // thing that must never happen is a relic rotting while you are still fighting what dropped it.
 // `min:12` is RELIC_T, so bandOfTier finds it on its own and nothing else can reach this band.
 {min:12, spr:'_lootSackRelic', bound:true, life:600, label:'RELIC'},
];
function bagItems(lb){ return (lb&&lb.items)||(lb&&lb.item?[lb.item]:[]); }
function bagTopTier(lb){ let t=-1; for(const it of bagItems(lb)) if(it&&it.t!==undefined&&it.t>t) t=it.t; return t; }
function bagTopRar(lb){ let r=0; for(const it of bagItems(lb)) if(it&&(it.rar||0)>r) r=it.rar; return r; }
function bandOfTier(t){ if(t===undefined||t<0) return 0;
 let b=0; for(let i=0;i<LOOT_BANDS.length;i++) if(t>=LOOT_BANDS[i].min) b=i; return b; }
function bagBand(lb){ return (lb&&lb.band!==undefined)?lb.band:bandOfTier(bagTopTier(lb)); }
function bagBound(lb){ return !!LOOT_BANDS[bagBand(lb)].bound; }
// walk-over vs INTERACT: public sacks auto-collect, soulbound sacks are worth pressing a button for.
// Decided by BAND, not by ownership, so solo and host behave identically.
// WALK-OVER vs INTERACT. A sack that holds anything worth looking at opens the panel, so you see
// what is in it and choose -- that is the whole point of a sack holding several things. Only a
// lone consumable still vacuums up as you walk over it, because stopping to read a panel about one
// tonic is worse than not having the panel. Public gear used to auto-collect too, which meant the
// bag UI existed but most players never saw it.
function bagAuto(lb){ const its=bagItems(lb); if(!its.length) return true;
 const junk=it=>it&&(it.k==='pot'||it.k==='coin'||it.k==='scroll');
 return its.length===1 && junk(its[0]); }

function bagAt(e,items){
 const list=Array.isArray(items)?items:(items?[items]:[]);
 const rar=list.reduce((m,it)=>Math.max(m,(it&&it.rar)||0),0);
 let bx=e.x+(Math.random()*22-11), by=e.y+(Math.random()*22-11);
 // A clump of trees leaves pockets the player can never reach: each trunk only blocks a small
 // circle, but several together enclose the gap between them. Loot scattered into one of those is
 // simply lost, so nudge the bag to the nearest spot a body actually fits, falling back to the
 // kill point itself if the whole area is walled in.
 if(typeof nearestStandable==='function'){
   const p=nearestStandable(bx,by,11,4);
   if(p){ bx=p.x; by=p.y; } else { bx=e.x; by=e.y; }
 }
 let top=-1; for(const it of list) if(it&&it.t!==undefined&&it.t>top) top=it.t;
 const band=bandOfTier(top);
 // `item` is kept as the headline piece so older readers and the co-op grant path keep working;
 // `items` is the truth. Life comes from the band: a soulbound sack must outlast the fight.
 return {x:bx,y:by,items:list,item:list[0]||null,rar:rar,band:band,life:LOOT_BANDS[band].life}; }
// Award ONE item. Returns false if it could not be taken (satchel full), so the caller can leave
// the rest of the bag on the ground rather than silently eating it.
function awardItem(it,x,y){
  const ch=(typeof curChar==='function')?curChar():null; if(!ch||!rpg||!it) return false;
  if(!ch.inv) ch.inv=[];
  const px=(x===undefined)?player.x:x, py=(y===undefined)?player.y:y;
  if(it.k==='coin'){ if(typeof addCoin==='function') addCoin(); if(typeof recalcStats==='function') recalcStats();
    texts.push({x:px,y:py-14,txt:'+Fortune Coin',col:'#ffd07a',life:1.2}); return true; }
  if(it.k==='pot'){ rpg.pots++; if(typeof hudRPG==='function') hudRPG();
    texts.push({x:px,y:py-14,txt:'+Tonic',col:'#7dc47a',life:1}); return true; }
  // the OLD relic form (k:'leg'), kept only so a sack minted before relics became real items still
  // hands you something. It converts on the spot into the item the relic is now.
  if(it.k==='leg'){ const R=relicDef(it.id); if(!R) return true;
    const conv=mkRelicItem(it.id,ch.cls); if(conv) it=conv; else return true; }
  if(it.relic){ const R=relicDef(it.relic);
    noteRelicTaken(it.relic);
    const _S=(typeof relicSet==='function')?relicSet(R.set):null;
  if(typeof msg==='function') msg('★ '+R.n, _S?('a piece of '+_S.n):'a relic');
    texts.push({x:px,y:py-14,txt:'★ '+R.n,col:tierCol(RELIC_T),life:2.2});
    /* falls through: a relic goes into the satchel like any other item */ }
  if(it.k==='scroll'){ if(typeof grantScroll==='function') grantScroll(rpg,it.st,1);
    const col=(typeof STAT_META!=='undefined'&&STAT_META[it.st])?STAT_META[it.st].col:'#e6c76a';
    texts.push({x:px,y:py-14,txt:'📜 '+((typeof scrollName==='function')?scrollName(it.st):'Scroll'),col:col,life:1.5});
    return true; }
  if(ch.inv.length>=20){ texts.push({x:player.x,y:player.y-30,txt:'satchel full',col:'#c04a3d',life:1.1}); return false; }
  ch.inv.push(it); texts.push({x:px,y:py-14,txt:itemName(it),col:itemRarCol(it),life:1.3}); return true;
}
// THE one way a bag leaves the ground. Both the walk-over and the INTERACT prompt come through
// here. On a client it never touches the inventory: it asks the host and waits for the 'G' grant,
// which is the only thing in the game allowed to award a real item over the network.
function claimBag(lb){
  if(!lb) return false;
  if(lb.remote){
    // reliable:false transport — a lost 'P' or 'G' must not brick the bag, so the request re-arms
    if(lb._asked && performance.now()-(lb._askT||0)<1200) return false;
    lb._asked=1; lb._askT=performance.now();
    if(typeof netRequestPickup==='function') netRequestPickup(lb);
    return false; }
  const i=loots.indexOf(lb); if(i<0) return false;
  const its=bagItems(lb), left=[];
  for(const it of its) if(!awardItem(it,lb.x,lb.y)) left.push(it);
  if(left.length===its.length) return false;          // took nothing (satchel full) — leave it be
  if(left.length){ lb.items=left; lb.item=left[0]; return false; }   // partial: keep the remainder
  loots.splice(i,1); saveRPG(); return true;
}
// Award an item directly, with no bag on the ground. Used when the co-op host grants a contested
// pickup to a specific player: only the winner's client runs this, so the drop lands once.
function takeLoot(item){
  const ch=(typeof curChar==='function')?curChar():null;
  if(!item||!ch||!rpg) return;
  if(!ch.inv) ch.inv=[];
  // relics carry a duplicate rule and a record, so a granted one goes through the same award path
  // the local pickup does rather than being pushed straight into the satchel
  if(item.k==='leg'||item.relic){ awardItem(item,player.x,player.y); saveRPG(); return; }
  if(item.k==='coin'){ if(typeof addCoin==='function') addCoin(); if(typeof recalcStats==='function') recalcStats(); }
  else if(item.k==='pot'){ rpg.pots++; if(typeof hudRPG==='function') hudRPG(); }
  else if(item.k==='scroll'){ if(typeof grantScroll==='function') grantScroll(rpg,item.st,1); }
  else if(ch.inv.length<20) ch.inv.push(item);
  if(typeof texts!=='undefined'&&typeof player!=='undefined')
    texts.push({x:player.x,y:player.y-30,txt:(typeof itemName==='function')?itemName(item):'loot',
      col:(typeof itemRarCol==='function')?itemRarCol(item):'#e6c76a',life:1.3});
}
// ------------------------------------------------------------
// Two independent channels. PUBLIC is one roll for the kill, shared by everyone in the area.
// SOULBOUND is rolled separately for each eligible player and belongs only to them.
// Both run host-side only (07_update gates rollLoot on netSimulates).
const PUB_GEAR={c:0.025, s:0.06, N:0.025};   // gear-bag chance by enemy type; bosses are handled below
const PUB_POT ={c:0.10,  s:0.14, N:0.10};
// ONE PUBLIC SACK PER KILL (user, 2026-07-26). Every public thing a kill pays out goes in the same
// sack: gear, the tonic, the coin, the scroll. It used to push a separate bag per item, so a
// dungeon boss carpeted the floor with five or six sacks that each held one thing, and a "bag"
// stopped meaning anything. `extra` is what rollLoot already rolled outside the gear table.
function rollPublicLoot(e,row,F,extra){
 const fmul=1+F*0.012;
 const tier=Math.min(PUB_TMAX,pickWeighted(row.pub,F));    // public gear never exceeds T8
 const r=Math.random();
 const items=(extra||[]).slice();
 if(e.type==='B'){
   // a boss rolls the public table TWICE into the one sack. Same number of sacks, a sack worth
   // opening: one slot roll averages 1.3 pieces, which is how a "bag" ended up meaning "an item".
   for(const it of rollBagSlots(BAG_SLOTS.pub,tier,F,true)) items.push(it);  // a boss always pays out
   for(const it of rollBagSlots(BAG_SLOTS.pub,tier,F,false)) items.push(it);
   if(Math.random()<0.4) items.push({k:'pot'});
 } else {
   const gp=(PUB_GEAR[e.type]||0)*fmul, pp=(PUB_POT[e.type]||0)*fmul;
   if(r<gp) for(const it of rollBagSlots(BAG_SLOTS.pub,tier,F,false)) items.push(it);
   else if(r<gp+pp) items.push({k:'pot'});
 }
 if(items.length) loots.push(bagAt(e,items));            // everything missed -> no sack at all
}
// One recipient's private roll. `who` is {id,fort}; id is undefined in solo, and bagAt's owner tag
// is only applied when actually networked, so solo bags never carry the field.
// One player's private roll, as ITEMS. Whether they end up in their own sack or merged into the
// single sack a kill leaves behind is rollLoot's decision -- see the note there.
function rollSoulboundItems(e,row,who){
 const items=[];
 if(!row.sb) return items;                              // this area has no soulbound band
 const F=who.fort||0;
 let p;
 if(e.type==='B') p=1;                                  // bosses are the reliable T9+ path
 else if(e.type==='s') p=row.sbP*3;
 else p=row.sbP;
 const n=(e.type==='B')?((typeof curRoom!=='undefined'&&curRoom&&curRoom.dungeon)?2:1):1;
 for(let q=0;q<n;q++){
   if(Math.random()>=p) continue;
   const tier=pickWeighted(row.sb,F);
   for(const it of rollBagSlots(BAG_SLOTS.bound,tier,F,true)) items.push(it); }   // never empty
 return items;
}
function rollSoulbound(e,row,who){
 const items=rollSoulboundItems(e,row,who);
 if(!items.length) return;
 const b=bagAt(e,items);
 if(who.id && typeof netOn==='function' && netOn()) b.own=who.id;
 loots.push(b);
}
// A boss may yield the relic its dungeon keeps. Rolled per eligible player like any bound drop,
// because a unique that only the host could ever see would be worthless in co-op — and skipped for
// anyone who already owns it, so it can never be a duplicate you cannot use.
// Returns the relic ITEM (or null). rollRelic keeps its own sack for co-op; solo merges it into
// the one sack the kill leaves -- the band follows the top tier either way, so a merged sack with
// a relic in it still shows the reliquary.
function rollRelicItem(e,who){
 if(e.type!=='B') return null;
 const ring=(e.ring!==undefined&&e.ring>=0)?e.ring
   :((typeof curRoom!=='undefined'&&curRoom&&typeof curRoom.bossRing==='number')?curRoom.bossRing:-1);
 const inDun=!!(typeof curRoom!=='undefined'&&curRoom&&curRoom.dungeon);
 // DUNGEONS ONLY, AND ONLY DEEP ONES (user, 2026-07-26). An overworld boss never drops a relic now,
 // and neither does any dungeon below the Lv40 band -- relicChanceFor returns 0 for both.
 if(!inDun) return null;
 const p0=(typeof relicChanceFor==='function')?relicChanceFor(ring):0;
 if(p0<=0) return null;
 // this dungeon hosts two sets; you can be given any piece of either that you do not already hold
 const pool=(typeof relicsForRing==='function')?relicsForRing(ring):[];
 const mineHere=(typeof netSelfId!=='function')||!who.id||who.id===netSelfId();
 const want=pool.filter(R=>!(mineHere&&ownsRelic(R.id)));
 if(!want.length) return null;
 // Only the LOCAL player's collection is knowable here, which is why `want` was filtered against it
 // above; a peer's duplicate is caught when the grant is awarded instead.
 const id=want[Math.floor(Math.random()*want.length)].id;
 const p=p0*(1+(who.fort||0)*0.004);
 if(Math.random()>=p) return null;
 // shaped for whoever it is rolled for -- in co-op `who` is the peer, so fall back to the local
 // hero's class only when there is no better answer. A relic is a real item from here on.
 const _cls=(who&&who.cls)||((typeof curChar==='function'&&curChar())?curChar().cls:'knight');
 const _it=mkRelicItem(id,_cls); if(!_it) return null;
 // AND SAY SO. A relic is 0.25%-1% off a boss most players will never see the inside of; it must
 // not scroll past in the same 12px text a potion gets. Only for the player it was rolled for.
 if(mineHere && typeof insaneDrop==='function') insaneDrop(_it);
 return _it;
}
// co-op path: the relic gets its own sack, because a shared sack cannot carry one player's bound
// row without the whole per-connection filter the netsync deliberately avoids
function rollRelic(e,who){
 const it=rollRelicItem(e,who); if(!it) return;
 const b=bagAt(e,[it]);
 b.band=LOOT_BANDS.length-1; b.life=LOOT_BANDS[b.band].life;   // the reliquary band, ten minutes
 b.relic=1;
 if(who.id && typeof netOn==='function' && netOn()) b.own=who.id;
 loots.push(b);
}
function rollLoot(e){
 const row=zoneTierRow(e.x,e.y);
 const F=(typeof player!=='undefined'&&player.fortune)||0;
 // Fortune Coin (bronze) — its own roll, can drop alongside gear. Rare on purpose: a coin boosts
 // EVERY future drop for as long as you carry it, so it compounds where gear does not. At the old
 // 4%/85% they were routine, which quietly made Fortune the cheapest stat in the game.
 // the coin and the scroll ride in the same public sack as the gear rather than each getting one
 const extra=[];
 if(Math.random() < (e.type==='B'?0.10:0.006)) extra.push({k:'coin'});
 if(typeof scrollDropFor==='function'){ const sc=scrollDropFor(e); if(sc) extra.push(sc); }  // max-stat scrolls
 if(typeof petOnKill==='function') petOnKill(e);         // incubation ticks + active pet gains XP per kill
 if(e.type==='B' && typeof spawnEggDrop==='function') spawnEggDrop(e);   // loose EGG, not a bag
 const roster=(typeof netLootRoster==='function')?netLootRoster(e.x,e.y):[{id:null,fort:F}];
 // ONE SACK PER KILL (user, 2026-07-26), and the sack you see is the best thing inside it -- which
 // bandOfTier(bagTopTier) already decides, so a relic in the sack makes it a reliquary by itself.
 //
 // Alone, that is exactly one sack: public gear, the tonic, the coin, the scroll, your bound roll
 // and any relic, together. WITH OTHER PLAYERS PRESENT the channels stay apart, because a shared
 // sack cannot carry one player's bound row: the netsync keeps bound loot off everyone else's wire
 // entirely rather than tagging it and trusting clients to filter, and merging would trade that
 // guarantee for tidiness. So: alone, one sack; in company, one shared sack plus your own.
 const alone = roster.length<=1 &&
   (!roster[0] || !roster[0].id || (typeof netSelfId!=='function') || roster[0].id===netSelfId());
 if(alone){
   const who=roster[0]||{id:null,fort:F};
   for(const it of rollSoulboundItems(e,row,who)) extra.push(it);
   const rel=(typeof rollRelicItem==='function')?rollRelicItem(e,who):null;
   if(rel) extra.push(rel);
   rollPublicLoot(e,row,F,extra);
   return;
 }
 rollPublicLoot(e,row,F,extra);
 for(const who of roster){ rollSoulbound(e,row,who); rollRelic(e,who); }
}
const ABIL={
 ranger:{res:'Focus',col:'#7dc47a',rule:'hit',d:'Volley: 12-arrow fan'},
 pyro:{res:'Heat',col:'#ff7a3d',rule:'shot',d:'Detonate: fiery blast around you'},
 knight:{res:'Defiance',col:'#c9d2da',rule:'hurt',d:'Bulwark: 4s invulnerable'},
 rogue:{res:'Combo',col:'#c07ad4',rule:'hit',d:'Shadowstep: blink forward, untouchable'},
 assassin:{res:'Malice',col:'#c0304a',rule:'hit',d:'Deathmark: +120% dmg + evade, 4s'},
 cleric:{res:'Grace',col:'#fff0c0',rule:'calm',d:'Sanctuary: full heal'},
 berserker:{res:'Rage',col:'#e2604c',rule:'hurt',d:'Whirlwind: 16-blade ring'},
 warlock:{res:'Essence',col:'#8a5ac0',rule:'hit',d:'Soulburst: drain all nearby foes'},
 frost:{res:'Rime',col:'#9ad4ef',rule:'hit',d:'Winter Nova: freeze everything near'},
 storm:{res:'Charge',col:'#ffe9b0',rule:'time2',d:'Chain Storm: lightning hits 6 foes'},
 hunter:{res:'Instinct',col:'#7dc47a',rule:'kill',d:'Wolfpack: 2 wolves fight for you'},
 monk:{res:'Flow',col:'#7ab8d4',rule:'move',d:'Zephyr: +80% speed, brief dodge'},
 paladin:{res:'Faith',col:'#ffd07a',rule:'time',d:'Consecrate: holy ground, 6s'},
 necro:{res:'Souls',col:'#8fd48c',rule:'kill',d:'Raise Dead: 2 skeletons, 12s'},
 bard:{res:'Tempo',col:'#c07ad4',rule:'shot',d:'Crescendo: +50% fire rate, 6s'},
 shaman:{res:'Spirits',col:'#7ab8d4',rule:'time',d:'Spirit Ring: 8 orbiting wards, 8s'},
 dragoon:{res:'Wind-up',col:'#e07a2e',rule:'prox',d:'Skyfall: leap and crater the ground'},
};
// Classes with a PERK_RES entry (13b_perks.js) use its gain table — that meter is a real
// resource perks read and spend. Everyone else keeps the old single-rule charge.
function chargeRes(kind){
 const pr=(typeof perkResDef==='function')?perkResDef():null;
 if(pr){ const g=pr.gain&&pr.gain[kind]; if(g) resAdd(g); return; }
 const rd=player.resDef; if(!rd) return;
 if(rd.rule==='shot'&&kind==='shot') res=Math.min(100,res+2.2);
 else if(rd.rule==='hit'&&kind==='hit') res=Math.min(100,res+3);
 else if(rd.rule==='kill'&&kind==='kill') res=Math.min(100,res+16);
 else if(rd.rule==='hurt'&&kind==='hurt') res=Math.min(100,res+13);
}
function aoe(x,y,r,dmg,col){ fx.push({t:'ring',x:x,y:y,r:r,life:0.35,col:col});
 for(const e of enemies){ if(Math.hypot(e.x-x,e.y-y)<r) dealDamage(e,dmg,{ability:true,col:col}); }
 boom(x,y,col,20); }
// Ability casting now routes through the 3-slot loadout system (12b_abilities.js).
function abilityCost(){ return (typeof armedCost==='function')?armedCost():1e9; }
function doAbility(wx,wy){ if(typeof castArmed==='function') castArmed(wx,wy); }
function eqPrefix(slot){ const a=eqAffArr(slot); return (a&&a.length)?AFFIX_PREFIX[a[0].s]+' ':''; }
function slotLabel(kind){ const ch=curChar(); if(!ch||!rpg)return '—';
 if(kind==='wpn'){ if(rpg.wpnL){const L=legById(rpg.wpnL); return '★ '+(L?L.n:'');}
  return eqPrefix('wpn')+'T'+((rpg.wpn||0)+1)+' '+weaponAt(ch.cls,rpg.wpn||0).n; }
 if(kind==='arm'){ if(rpg.armL){const L=legById(rpg.armL); return '★ '+(L?L.n:'');}
  return eqPrefix('arm')+'T'+((rpg.arm||0)+1)+' '+TIER_NAMES[rpg.arm||0]+' '+MATN[CARMOR[ch.cls]]; }
 if(kind==='helm') return rpg.helm>=0 ? eqPrefix('helm')+'T'+(rpg.helm+1)+' '+TIER_NAMES[rpg.helm]+' Helm' : 'No helm';
 if(kind==='ring') return rpg.ring ? eqPrefix('ring')+'T'+(rpg.ring.t+1)+' '+RINGN[rpg.ring.st] : 'No ring';
 return '—'; }
let mapInt=null;
// ---------- world map (top-down island minimap) ----------
// The Sundered Isles is one 300x190 grid, drawn as a single top-down minimap scaled to the card:
// ocean/bridge/land per tile, land tinted by radial band (+ a corruption bleed toward the portal),
// with the bridge, the infection portal, boss lairs, waypoints, and a "you" marker on top.
const MAP_W=980, MAP_PAD=18, MAP_TOP=34, MAP_BOT=30;
const MAP_OCEAN='#16303f', MAP_BRIDGE='#6e4d31';
const MRAMP=['#547a44','#3c5b35','#556636','#66705a','#767c74','#836254','#6a635e','#8a4a22','#b5451e'];
function mapLayout(G){ const s=(MAP_W-2*MAP_PAD)/G.w, gridH=G.h*s;
  return {s, ox:MAP_PAD, oy:MAP_TOP, gridH, H:Math.round(MAP_TOP+gridH+MAP_BOT)}; }
// band + corruption straight from the room's rings metadata (no curRoom dependency — the map can
// be open while you stand in a dungeon). Mirrors grvBandAt / corruptAt.
function _mBand(RG,tx,ty){ if(!RG||!RG.radial) return 0;
  const B=RG.bridge; if(tx>=B.x0&&tx<=B.x1&&Math.abs(ty-B.cy)<=(B.w>>1)) return 2;
  if(tx<B.x0){ const f=Math.min(1,Math.hypot(tx-RG.starter.cx,ty-RG.starter.cy)/RG.starter.r); return Math.max(0,Math.min(2,Math.floor(f*3))); }
  const f=Math.min(1,Math.hypot(tx-RG.core.cx,ty-RG.core.cy)/RG.rmax); return Math.max(3,Math.min(8,3+Math.floor(f*6))); }
function _mCorrupt(RG,tx,ty){ if(!RG||!RG.portal) return 0;
  const dd=Math.hypot(tx-RG.portal.x,ty-RG.portal.y); return Math.max(0,Math.min(1,1-dd/70)); }
// zone id: bands 0-7 are the radial rings; band 8 (the grind ring) is split into angular sectors
// (id 8 + sector) \u2014 mirrors ringInfoAt so the map matches the region banner.
function _mZone(RG,tx,ty){ const b=_mBand(RG,tx,ty); if(b<8) return b;
  const a=Math.atan2(ty-RG.core.cy,tx-RG.core.cx), n=(RG.grind&&RG.grind.length)||5;
  return 8+Math.max(0,Math.min(n-1,Math.floor(((a+Math.PI)/(2*Math.PI))*n))); }
function _mZoneName(RG,z){ if(z<8) return (RG.names[z]&&RG.names[z].n)||''; return (RG.grind&&RG.grind[z-8])||''; }
// a representative label point (world tiles) for the radial bands (rings \u2014 a centroid would fall
// in the ring's hole, so place at mid-radius on a staggered angle); grind sectors use a centroid.
function _mBandLabelPos(RG,z){
  if(z<3){ const midf=(z+0.5)/3, ang=-1.15+z*0.7; return [RG.starter.cx+Math.cos(ang)*RG.starter.r*midf, RG.starter.cy+Math.sin(ang)*RG.starter.r*midf]; }
  const midf=((z-3)+0.5)/6, ang=(z%2?0.30:-0.30); return [RG.core.cx+Math.cos(ang)*RG.rmax*midf, RG.core.cy+Math.sin(ang)*RG.rmax*midf]; }
// subtle per-sector tints so the 5 Lv50 grind "states" read distinctly on the red rim
const _GRIND_TINT=['rgba(255,175,60,0.13)','rgba(255,110,45,0.13)','rgba(205,55,150,0.15)','rgba(255,80,55,0.13)','rgba(235,150,55,0.13)'];
// terrain + zone borders + labels are static \u2014 render once into an offscreen canvas and blit it,
// so the live redraw only paints the moving markers
let _mapCache=null;
function mapTerrain(G,L){
  const key=G.w+'x'+G.h+':'+MAP_W;
  if(_mapCache&&_mapCache.key===key) return _mapCache.cv;
  const off=document.createElement('canvas'); off.width=MAP_W; off.height=L.H;
  const c=off.getContext('2d'); const RG=G.rings, s=L.s;
  c.fillStyle='#0b0a10'; c.fillRect(0,0,MAP_W,L.H);
  const T=(typeof _territories==='function')?_territories(G):null, zg=RG._zg;
  const zAt=(tx,ty)=>{ const zr=zg&&zg[ty]; return (zr&&tx>=0&&tx<zr.length)?zr[tx]:-1; };
  // STRIDE. The minimap scales the world down, so many tiles share one map pixel and drawing
  // every one is wasted work — at 1160x720 that was ~2.5M canvas ops and a 1.7s freeze the
  // first time the map opened. Sample a fixed budget of cells instead, drawing each as a
  // step-sized block: the picture is the same, and the cost stops tracking world size.
  const step=Math.max(1,Math.ceil(Math.sqrt((G.w*G.h)/250000))), bs=s*step+0.6;
  for(let ty=0;ty<G.h;ty+=step){ const row=G.grid[ty]; if(!row) continue;
    for(let tx=0;tx<G.w;tx+=step){ const ch=row[tx]; if(ch==null) continue;
      const px=L.ox+tx*s, py=L.oy+ty*s;
      if(ch==='w'){ c.fillStyle=MAP_OCEAN; c.fillRect(px,py,bs,bs); continue; }
      if(ch==='b'){ c.fillStyle=MAP_BRIDGE; c.fillRect(px,py,bs,bs); continue; }
      const zi=zAt(tx,ty), tt=(T&&zi>=0)?T[zi]:null, band=tt?tt.band:0;
      c.fillStyle=MRAMP[band]||'#547a44'; c.fillRect(px,py,bs,bs);
      if(tt&&tt.gi>=0&&_GRIND_TINT[tt.gi]){ c.fillStyle=_GRIND_TINT[tt.gi]; c.fillRect(px,py,bs,bs); }
      const cor=_mCorrupt(RG,tx,ty);
      if(cor>0.05){ c.fillStyle='rgba(150,40,180,'+(cor*0.55).toFixed(3)+')'; c.fillRect(px,py,bs,bs); }
      // clump border: darken where a neighbouring SAMPLE is a different territory -> province line
      if((zAt(tx-step,ty)>=0&&zAt(tx-step,ty)!==zi)||(zAt(tx+step,ty)>=0&&zAt(tx+step,ty)!==zi)
       ||(zAt(tx,ty-step)>=0&&zAt(tx,ty-step)!==zi)||(zAt(tx,ty+step)>=0&&zAt(tx,ty+step)!==zi)){
        c.fillStyle='rgba(14,9,16,0.55)'; c.fillRect(px,py,bs,bs); } } }
  // zone name labels \u2014 bands at a representative ring point, grind sectors at their centroid
  c.textAlign='center'; c.textBaseline='middle';
  if(T) for(const tt of T){ if(tt.n<60) continue;
    const lx=L.ox+(tt.sx/tt.n)*s, ly=L.oy+(tt.sy/tt.n)*s;
    const lvs=(tt.lvmax&&tt.lvmax!==tt.lvmin)?('Lv '+tt.lvmin+'-'+tt.lvmax):('Lv '+tt.lvmin);
    c.font='bold 11px "Pixelify Sans",monospace';
    c.lineWidth=3; c.strokeStyle='rgba(0,0,0,0.85)'; c.strokeText(tt.name,lx,ly-5);
    c.fillStyle='#f4ecdc'; c.fillText(tt.name,lx,ly-5);
    c.font='9px "Pixelify Sans",monospace';
    c.lineWidth=3; c.strokeStyle='rgba(0,0,0,0.85)'; c.strokeText(lvs,lx,ly+7);
    c.fillStyle='#ffc94d'; c.fillText(lvs,lx,ly+7); }
  c.textBaseline='alphabetic';
  _mapCache={key:key,cv:off};
  return off;
}
// a world point -> its pixel position on the minimap
function mapPos(G,L,wx,wy){ return {x:L.ox+(wx/TILE)*L.s, y:L.oy+(wy/TILE)*L.s}; }
function drawMap(){ const G=rooms['G']; if(!G||!G.rings) return;
 if($s('mapScr').style.display==='none'||!$s('mapScr').style.display){
  if(mapInt){clearInterval(mapInt);mapInt=null;} return; }
 const cv2=$s('mapCv'), c=cv2.getContext('2d');
 const L=mapLayout(G);
 if(cv2.width!==MAP_W) cv2.width=MAP_W;
 if(cv2.height!==L.H) cv2.height=L.H;
 c.imageSmoothingEnabled=false;
 c.drawImage(mapTerrain(G,L),0,0);
 const t=performance.now();
 c.textAlign='center';
 c.font='bold 15px "Pixelify Sans",monospace'; c.fillStyle='#e9dfce';
 c.fillText('THE SUNDERED ISLES',MAP_W/2,22);
 // boss lairs \u2014 small pale skull dots
 if(G.lairs) for(const b in G.lairs){ const La=G.lairs[b]; if(!La.spawn) continue; const q=mapPos(G,L,La.spawn.x,La.spawn.y);
   c.fillStyle='#ded0d4'; c.beginPath(); c.arc(q.x,q.y,2.6,0,6.29); c.fill();
   c.fillStyle='#20161c'; c.fillRect(q.x-1.1,q.y-0.6,0.9,0.9); c.fillRect(q.x+0.3,q.y-0.6,0.9,0.9); }
 // the infection portal (violet, pulsing)
 if(G.rings.portal){ const q=mapPos(G,L,G.rings.portal.x*TILE,G.rings.portal.y*TILE), pu=0.5+0.5*Math.sin(t/300);
   c.save(); c.globalCompositeOperation='lighter';
   const g=c.createRadialGradient(q.x,q.y,1,q.x,q.y,15); g.addColorStop(0,'rgba(180,60,210,'+(0.4+pu*0.3)+')'); g.addColorStop(1,'rgba(0,0,0,0)');
   c.fillStyle=g; c.beginPath(); c.arc(q.x,q.y,15,0,6.29); c.fill(); c.restore();
   c.save(); c.translate(q.x,q.y); c.rotate(t/1400); c.fillStyle='#e79bff'; c.fillRect(-3.2,-3.2,6.4,6.4); c.restore(); }
 // waypoint pillars (attuned = gold, dormant = grey)
 if(G.pillars) for(const pl of G.pillars){ const q=mapPos(G,L,(pl.x!=null?pl.x:pl.tx*TILE),(pl.y!=null?pl.y:pl.ty*TILE));
   const on=(typeof pillarUnlocked==='function')&&pillarUnlocked(pl.band);
   c.save(); c.translate(q.x,q.y); c.rotate(Math.PI/4);
   c.fillStyle=on?'#ffe08a':'#5a6472'; c.fillRect(-3.5,-3.5,7,7);
   c.strokeStyle='#14100c'; c.lineWidth=1; c.strokeRect(-3.5,-3.5,7,7); c.restore(); }
 // return portals
 if(G.portals) for(const gp of G.portals){ const q=mapPos(G,L,gp.x,gp.y);
   c.strokeStyle='#c07ad4'; c.lineWidth=1.5; c.beginPath(); c.arc(q.x,q.y,4,0,6.29); c.stroke();
   c.fillStyle='#e8d8ff'; c.fillRect(q.x-1.5,q.y-1.5,3,3); }
 // you
 if(curRoom&&curRoom.rings&&curRoom.rings.radial){
  const q=mapPos(G,L,player.x,player.y), pu=(Math.sin(t/250)+1)/2;
  c.strokeStyle='rgba(255,201,77,'+(0.9-pu*0.5)+')'; c.lineWidth=2;
  c.beginPath(); c.arc(q.x,q.y,5+pu*6,0,6.29); c.stroke();
  c.fillStyle='#fff'; c.beginPath(); c.arc(q.x,q.y,3.2,0,6.29); c.fill();
  c.strokeStyle='#101c26'; c.lineWidth=1; c.stroke(); }
 // footer: legend + where you are
 const fy=L.H-9;
 c.textAlign='left'; c.font='11px "Pixelify Sans",monospace';
 c.fillStyle='#ffe08a'; c.fillRect(MAP_PAD,fy-8,8,8);
 c.fillStyle='#cfc8bd'; c.fillText('waypoint',MAP_PAD+13,fy);
 c.fillStyle='#e79bff'; c.fillRect(MAP_PAD+82,fy-8,8,8);
 c.fillStyle='#cfc8bd'; c.fillText('portal',MAP_PAD+95,fy);
 c.fillStyle='#ded0d4'; c.beginPath(); c.arc(MAP_PAD+152,fy-4,3,0,6.29); c.fill();
 c.fillStyle='#cfc8bd'; c.fillText('boss lair',MAP_PAD+160,fy);
 c.textAlign='right';
 if(curRoom&&curRoom.rings&&curRoom.rings.radial){ const rg=regionAtPx(player.x,player.y);
  const lv=(typeof grvLvAt==='function')?grvLvAt(player.x/TILE,player.y/TILE):null;
  c.fillStyle='#ffc94d'; c.fillText(rg?('you are in '+rg.n+(lv?' \u00b7 Lv '+lv:'')):'',MAP_W-MAP_PAD,fy); }
 else { c.fillStyle='#8a8494'; c.fillText('you are in '+(curRoom?curRoom.name:'')+' \u2014 take the portal home',MAP_W-MAP_PAD,fy); }
}
// The map button is gone -- a live minimap sits in the top-left corner instead. The full-screen
// map still exists behind the M key for when you want the whole world and its zone labels.
function closeMap(){ $s('mapScr').style.display='none';
 if(mapInt){clearInterval(mapInt);mapInt=null;} }
$s('mapClose').addEventListener('click',closeMap);
$s('mapClose2').addEventListener('click',closeMap);


let invSelIdx=-1;
function openInv(){ $s('invScr').style.display='flex'; invSelIdx=-1; paintInv(); }
// draw a class's real PixelLab idle sprite (south-facing) into a card icon canvas;
// falls back to the class emoji, retrying once if the art is still preloading.
function paintClassIcon(cv,cls){ if(!cv) return; const g=cv.getContext('2d'); g.imageSmoothingEnabled=false;
 g.clearRect(0,0,cv.width,cv.height); let drew=false;
 if(typeof _emberReady!=='undefined' && _emberReady[cls] && typeof _emberIdle==='function'){
   const im=_emberIdle(cls,'s');
   if(im&&im.complete&&im.naturalWidth){ const sc=Math.min(cv.width/im.naturalWidth,cv.height/im.naturalHeight);
     const w=im.naturalWidth*sc, h=im.naturalHeight*sc;
     g.drawImage(im,Math.round((cv.width-w)/2),Math.round((cv.height-h)/2),w,h); drew=true; } }
 if(!drew){ const ci=CLASSES.findIndex(x=>x.id===cls); const c=CLASSES[ci<0?0:ci];
   g.font=Math.round(cv.height*0.62)+'px serif'; g.textAlign='center'; g.textBaseline='middle';
   g.fillText(c?c.ic:'❓',cv.width/2,cv.height/2+1);
   if(typeof _emberReady==='undefined' || !_emberReady[cls]) setTimeout(()=>{ if(document.body.contains(cv)) paintClassIcon(cv,cls); },500); }
}
// paper-doll equipment sockets: draw each equipped item's sprite into its slot canvas
function paintEqSlots(ch){ const cls=ch.cls, mt=CARMOR[cls]||'plate', wt=CWEAP[cls]||'sword';
 // read the slots back through equippedItemFor so a worn relic keeps its id here too -- that is
 // what puts its own sprite and its R in the paper doll instead of generic tier art
 const _w=equippedItemFor('wpn',ch), _a=equippedItemFor('arm',ch);
 const items={
   helm: rpg.helm>=0 ? {k:'helm',mt:mt,t:rpg.helm} : null,
   wpn:  rpg.wpnL ? {k:'wpn',wt:wt,t:11,leg:1} : (_w||{k:'wpn',wt:wt,t:rpg.wpn||0}),
   arm:  rpg.armL ? {k:'arm',mt:mt,t:11,leg:1} : (_a||{k:'arm',mt:mt,t:rpg.arm||0}),
   ring: rpg.ring ? {k:'ring',st:rpg.ring.st,t:rpg.ring.t} : null };
 document.querySelectorAll('#eqDoll .eqSlot').forEach(el=>{
   const it=items[el.getAttribute('data-slot')];
   const cv=el.querySelector('.eqCv'), g=cv.getContext('2d'); g.imageSmoothingEnabled=false; g.clearRect(0,0,cv.width,cv.height);
   const tb=el.querySelector('.eqTb');
   // the tier is stamped into the icon itself now, so the corner badge is only for the ★ that
   // marks a legendary — printing 'T9' twice on the same 52px slot just fought with the art
   if(it){ drawItemIcon(g,it,cv.width,cv.height);
     tb.textContent=it.leg?'★':''; tb.style.color='#ff9c50'; el.classList.add('filled');
   } else { tb.textContent=''; el.classList.remove('filled'); } });
}
// opaque-pixel bounding box of an image (cached by src) — used to crop away
// transparent sheet margins so sprites can be scaled to genuinely fill a box
const _bboxCache={};
function _imgBBox(im){ const k=im.src;
 if(_bboxCache[k]) return _bboxCache[k];
 const c=document.createElement('canvas'); c.width=im.naturalWidth; c.height=im.naturalHeight;
 const g=c.getContext('2d'); g.drawImage(im,0,0);
 const d=g.getImageData(0,0,c.width,c.height).data;
 let x0=c.width,y0=c.height,x1=-1,y1=-1;
 for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
  if(d[(y*c.width+x)*4+3]>10){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; } }
 const bb=(x1>=x0)?{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1}:{x:0,y:0,w:c.width,h:c.height};
 _bboxCache[k]=bb; return bb; }
function paintInv(){ const ch=curChar(); if(!ch||!rpg)return;
 if(!ch.inv) ch.inv=[];
 recalcStats();
 const ci=Math.max(0,CLASSES.findIndex(x=>x.id===ch.cls)); const c=CLASSES[ci];
 paintEqSlots(ch);
 function chip(l,v,col){ return '<div class="schip"><span>'+l+'</span><b'+(col?' style="color:'+col+'"':'')+'>'+v+'</b></div>'; }
 const S=player.stats||newStats();
 let sh='';
 for(const k of STATS) sh+=chip(STAT_META[k].s,S[k],STAT_META[k].col);
 sh+=chip('Pool HP',player.maxhp,'#8fd48c')+chip('Pool MP',player.maxmp,'#7ab8d4')
   +chip('Crit',Math.round(player.crit*100)+'%','#ffc94d');
 $s('eqStats').innerHTML=sh;
 paintRelics();
 const dc=$s('dollCv'), d2=dc.getContext('2d'); d2.imageSmoothingEnabled=false;
 const bg=d2.createLinearGradient(0,0,0,dc.height); bg.addColorStop(0,'#241b33'); bg.addColorStop(1,'#120e18');
 d2.fillStyle=bg; d2.fillRect(0,0,dc.width,dc.height);
 const th=CTHEME[ch.cls]||CTHEME.knight;
 const glow=d2.createRadialGradient(dc.width/2,dc.height*0.5,3,dc.width/2,dc.height*0.5,48);
 glow.addColorStop(0,th.p+'3c'); glow.addColorStop(1,'rgba(0,0,0,0)');
 d2.fillStyle=glow; d2.fillRect(0,0,dc.width,dc.height);
 d2.fillStyle='rgba(0,0,0,0.4)'; d2.beginPath(); d2.ellipse(dc.width/2,dc.height-13,28,6,0,0,6.29); d2.fill();
 // portrait: prefer the real PixelLab class sprite (south-facing idle); it already holds
 // the weapon, so no separate weapon overlay. Fall back to the procedural hero if not loaded.
 let drewReal=false;
 if(typeof _emberReady!=='undefined' && _emberReady[ch.cls] && typeof _emberIdle==='function'){
  const im=_emberIdle(ch.cls,'s');
  if(im && im.complete && im.naturalWidth){
   // crop to the figure's opaque bbox — the sheets carry big transparent margins,
   // which left the hero tiny in the portrait window
   const bb=_imgBBox(im);
   const sc=Math.min((dc.width-10)/bb.w,(dc.height-16)/bb.h);
   const w=bb.w*sc, h=bb.h*sc;
   // the portrait wears what the hero wears — bbox is measured off the untinted art, since a
   // recolour paints only opaque pixels and so cannot change the outline
   const _pim=(typeof skinImg==='function')?skinImg(im):im;
   d2.drawImage(_pim,bb.x,bb.y,bb.w,bb.h,Math.round((dc.width-w)/2),Math.round(dc.height-10-h),w,h);
   drewReal=true;
  }
 }
 if(!drewReal){
  const hs=heroSprite(player.look||{cls:ch.cls,helmT:-1},0); const sc=5;
  const hx=Math.round((dc.width-hs.width*sc)/2), hy=dc.height-16-hs.height*sc;
  d2.drawImage(hs,hx,hy,hs.width*sc,hs.height*sc);
  const ws=wpnSpr(CWEAP[ch.cls]||'sword',rpg.wpnL?11:(rpg.wpn||0));
  d2.save(); d2.translate(hx+hs.width*sc-4,hy+hs.height*sc*0.6); d2.rotate(-1.1);
  d2.drawImage(ws,-2,-ws.height*1.1,ws.width*2.2,ws.height*2.2); d2.restore();
 }
 $s('invInfo').textContent=ch.inv.length+' / 20 satchel slots';
 const g=$s('invGrid'); g.innerHTML='';
 // Fortune Coins (carried, passively boost loot): bronze/silver/gold stacks shown first
 if(rpg.coins) rpg.coins.forEach((cnt,ci)=>{ if(cnt<=0) return;
   const d=document.createElement('div'); d.className='islot coin';
   const cvs=document.createElement('canvas'); cvs.width=44; cvs.height=38; cvs.className='isprite';
   drawItemIcon(cvs.getContext('2d'),{k:'coin',t:ci},44,38); d.appendChild(cvs);
   const badge=document.createElement('span'); badge.className='tbadge'; badge.textContent='×'+cnt; badge.style.color='#ffd07a'; d.appendChild(badge);
   d.onclick=()=>{ invSelIdx=-1;
     $s('invSel').innerHTML='<b style="color:#ffd07a">'+COIN_NAMES[ci]+' Fortune Coin</b> ×'+cnt
       +'<div class="istats">Carry coins to boost loot — total <span style="color:#ffc94d">+'+coinFortune()+' Fortune</span>. 20 '+COIN_NAMES[ci]+' merge into 1 '+(COIN_NAMES[ci+1]||'—')+'.</div>';
     $s('invEquip').style.display='none'; $s('invSell').style.display='none'; $s('invDrop').style.display='none'; };
   g.appendChild(d); });
 ch.inv.forEach((it,i)=>{ const d=document.createElement('div'); d.className='islot'+(i===invSelIdx?' sel':'');
  if(it.rar) d.style.borderColor=RAR_COL[it.rar];
  const cvs=document.createElement('canvas'); cvs.width=44; cvs.height=38; cvs.className='isprite';
  const cc=cvs.getContext('2d'); cc.imageSmoothingEnabled=false;
  drawItemIcon(cc,it,44,38);
  d.appendChild(cvs);
  // gear carries its tier stamped into the icon; only the tier-less kinds still need a glyph here
  if(it.k==='pot'||it.k==='scroll'||it.t===undefined){
    const badge=document.createElement('span'); badge.className='tbadge';
    badge.textContent='✦'; badge.style.color=itemRarCol(it);
    d.appendChild(badge); }
  d.onclick=()=>{invSelIdx=i;paintInv();};
  g.appendChild(d); });
 const it=ch.inv[invSelIdx];
 if(it){ let html='<b style="color:'+itemRarCol(it)+'">'+itemName(it)+'</b>';
  if(it.rar) html+=' <span style="color:'+RAR_COL[it.rar]+'">('+RAR_NAMES[it.rar]+')</span>';
  // was a gold price, which has been unspendable and unearnable since gold was wiped. The auction
  // still values items, so show THAT -- what the house would ask for it, not what you could get.
  if(typeof itemGlory==='function') html+=' · worth '+itemGlory(it)+'✦ at auction';
  if(it.k!=='pot'&&!canEquip(it,ch)) html+=' · <span style="color:#c04a3d">wrong class</span>';
  if(it.k!=='pot'){ const s2=itemStats(it,ch.cls); let sl='';
   for(const k of STATS){ if(s2[k]) sl+='<span style="color:'+STAT_META[k].col+'">+'+s2[k]+' '+STAT_META[k].s+'</span> '; }
   html+='<div class="istats">'+sl+'</div>'; }
  $s('invSel').innerHTML=html;
 } else $s('invSel').textContent='Tap an item';
 $s('invEquip').style.display = (it&&canEquip(it,ch)) ? '' : 'none';
 $s('invDrop').style.display = it? '':'none';
}
$s('invBtn').addEventListener('click',openInv);
if($s('coopBtn')) $s('coopBtn').addEventListener('click',function(){ if(typeof openCoop==='function') openCoop(); });
if($s('coopX')) $s('coopX').addEventListener('click',function(){ $s('coopScr').style.display='none'; });
$s('loadBtn').addEventListener('click',function(){ if(typeof openLoadout==='function') openLoadout(); });
$s('skillBtn').addEventListener('click',function(){ if(typeof openSkills==='function') openSkills(); });
if($s('statsBtn')) $s('statsBtn').addEventListener('click',function(){ if(typeof openStats==='function') openStats(); });
$s('invX').addEventListener('click',()=>{$s('invScr').style.display='none';});
$s('bagX').addEventListener('click',closeBagPanel);
$s('bagLeave').addEventListener('click',closeBagPanel);
$s('bagAll').addEventListener('click',bagTakeAll);
// Reconstruct the item currently WORN in a slot, rolls and all, so it can be compared against or
// handed back to the satchel. rpg.eqAff keeps the rarity/affixes separately from the tier.
function equippedItemFor(slot,ch){
  if(!rpg||!ch) return null;
  const e=(rpg.eqAff||{})[slot], ex=e?{rar:e.r,aff:e.a}:{};
  // a relic keeps its id in the slot record, so what comes back out is the relic itself
  if(e&&e.rel) ex.relic=e.rel;
  if(slot==='wpn')  return rpg.wpnL?null:Object.assign({k:'wpn',wt:CWEAP[ch.cls],t:rpg.wpn||0},ex);
  if(slot==='arm')  return rpg.armL?null:Object.assign({k:'arm',mt:CARMOR[ch.cls],t:rpg.arm||0},ex);
  if(slot==='helm') return (rpg.helm>=0)?Object.assign({k:'helm',mt:CARMOR[ch.cls],t:rpg.helm},ex):null;
  if(slot==='ring') return rpg.ring?Object.assign({k:'ring',st:rpg.ring.st,t:rpg.ring.t},ex):null;
  return null;
}
// Wear an item. Returns the piece it displaced (or null), which the caller decides what to do with.
function equipItem(it,ch){
  if(!it||!ch||!rpg||!canEquip(it,ch)) return false;
  if(!rpg.eqAff) rpg.eqAff={};
  const slot=it.k, old=equippedItemFor(slot,ch);
  if(slot==='wpn'){ rpg.wpn=it.t; rpg.wpnL=null; }
  else if(slot==='arm'){ rpg.arm=it.t; rpg.armL=null; }
  else if(slot==='helm'){ rpg.helm=it.t; }
  else if(slot==='ring'){ rpg.ring={st:it.st,t:it.t}; }
  else return false;
  rpg.eqAff[slot]={r:it.rar||0,a:it.aff||null,rel:it.relic||null};
  recalcStats(); saveRPG(); hudRPG();
  return {old:old};
}
$s('invEquip').addEventListener('click',()=>{ const ch=curChar(); if(!ch)return;
 const it=ch.inv[invSelIdx]; if(!it||!canEquip(it,ch)) return;
 const nm=itemName(it), r=equipItem(it,ch); if(!r) return;
 ch.inv.splice(invSelIdx,1); if(r.old) ch.inv.push(r.old);
 invSelIdx=-1; saveRPG(); paintInv();
 msg(nm,'equipped'); });
// (no Sell handler: see index.html — with gold gone it paid nothing and only destroyed the item)
$s('invDrop').addEventListener('click',()=>{ const ch=curChar(); if(!ch)return;
 const it=ch.inv[invSelIdx]; if(!it) return;
 if(it.k==='wpn'&&it.t>=6&&!confirm('Discard '+itemName(it)+'?')) return;
 ch.inv.splice(invSelIdx,1); invSelIdx=-1; saveRPG(); paintInv(); });
// Relics used to be a parallel system: an id in rpg.legends, worn through rpg.wpnL/armL, outside
// the tier ladder entirely. They are ordinary T13 items now, so a save written before that has to
// be carried across: the ids move to rpg.relics (the record), and one that was actually WORN is
// re-equipped as the item it has become. The four purchasable legendaries are NOT relics and stay
// exactly where they were, on the old wpnL/armL path.
function migrateRelics(ch){
  if(!rpg||rpg._relicMig) return; rpg._relicMig=1;
  if(!rpg.relics) rpg.relics=[];
  const legs=rpg.legends||[];
  for(const id of legs.slice()){
    if(!relicDef(id)) continue;                       // a real legendary, leave it alone
    if(rpg.relics.indexOf(id)<0) rpg.relics.push(id);
    rpg.legends.splice(rpg.legends.indexOf(id),1);
    const worn=(rpg.wpnL===id)?'wpn':(rpg.armL===id)?'arm':null;
    const it=mkRelicItem(id,ch.cls); if(!it) continue;
    if(worn){ if(!rpg.eqAff) rpg.eqAff={};
      if(worn==='wpn'){ rpg.wpn=RELIC_T; rpg.wpnL=null; } else { rpg.arm=RELIC_T; rpg.armL=null; }
      rpg.eqAff[worn]={r:it.rar,a:it.aff,rel:id};
    } else if(ch.inv && ch.inv.length<20) ch.inv.push(it);
  }
}
// A class's weapon TYPE is decided by CWEAP and derived everywhere it is displayed -- the equipped
// slot stores only a tier and its affixes, so renaming a class's type re-labels what they are
// wearing for free. A SATCHEL item is different: it stores its own `wt`, so when the monk's type
// became 'gauntlet' every `wt:'fists'` item already in a bag stopped matching canEquip. The one
// that actually matters is a T13 relic weapon -- the most valuable object in the game -- which
// would sit in the satchel reading "wrong class" forever.
//
// Only a type marked `legacy` is retyped. An off-class weapon someone is carrying to trade is a
// real state the game supports, and must never be quietly converted into free power.
function migrateWpnType(ch){
  if(!rpg||!ch||!ch.inv) return;
  const want=CWEAP[ch.cls]; if(!want) return;
  let n=0;
  for(const it of ch.inv)
    if(it && it.k==='wpn' && it.wt && it.wt!==want && WTYPE[it.wt] && WTYPE[it.wt].legacy){
      it.wt=want; n++; }
  if(n) saveRPG();      // no one-shot flag: the sweep is 20 items and idempotent, and a flag set
}                       // before the loop could half-apply and then skip forever
function loadRPG(){ const ch=curChar(); if(!ch){rpg=null;return;} rpg=ch.rpg;
 if(rpg.arm===undefined)rpg.arm=0; if(rpg.helm===undefined)rpg.helm=-1;
 if(rpg.ring===undefined)rpg.ring=null;
 if(rpg.pets===undefined)rpg.pets=[]; if(rpg.pet===undefined)rpg.pet=null;
 if(rpg.legends===undefined)rpg.legends=[]; if(rpg.wpnL===undefined)rpg.wpnL=null;
 if(rpg.armL===undefined)rpg.armL=null; if(!ch.inv)ch.inv=[];
 migrateRelics(ch);
 migrateWpnType(ch);        // after migrateRelics: it can push a relic weapon into the satchel
 if(rpg.eqAff===undefined) rpg.eqAff={}; if(rpg.mp===undefined) rpg.mp=null;
 if(rpg.arenaBest===undefined) rpg.arenaBest=0;
 if(typeof initTrain==='function') initTrain(rpg); }   // max-stat scrolls/training (16_maxstats.js)
// Steepened for the Lv50 cap so reaching max is a real grind (the outer grind zones), not a
// sprint. Tunable — cumulative to 50 ≈ what the old 1.5 curve needed to reach the 60s.
function xpNeed(l){return Math.floor(60*Math.pow(l,1.7));}
function eqAffArr(slot){ const e=rpg&&rpg.eqAff&&rpg.eqAff[slot]; return e?e.a:null; }
function eqRar(slot){ const e=rpg&&rpg.eqAff&&rpg.eqAff[slot]; return e?e.r:0; }
// Global scale on the derived HP/MP pools — trims the big numbers without touching
// per-class balance (all sources scale uniformly). Tune here.
const HP_SCALE=0.80, MP_SCALE=0.80;
function recalcStats(){ const ch=curChar(); if(!ch||!rpg)return;
 const ci=Math.max(0,CLASSES.findIndex(x=>x.id===ch.cls)); const c=CLASSES[ci];
 player.cname=ch.name; player.hue=ci*20;
 // the weapon slot clamps to the top ROLLABLE tier, except when a relic is in it -- a relic is the
 // one thing allowed to sit on the Riftforged band, and clamping would quietly demote it to T12
 rpg.wpn=Math.min(rpg.wpn||0,((rpg.eqAff&&rpg.eqAff.wpn&&rpg.eqAff.wpn.rel)?RELIC_T:MAXT-1));
 player.wt=classWT(ch.cls);
 if(!rpg.eqAff) rpg.eqAff={};
 const mt=CARMOR[ch.cls]||'plate';
 const at=rpg.arm||0, ht=(rpg.helm===undefined?-1:rpg.helm), rg=rpg.ring;
 const wL=rpg.wpnL?legById(rpg.wpnL):null;
 const aL=rpg.armL?legById(rpg.armL):null;
 // ---- accumulate the 10 stats: class base + level + gear (tier base + rolled affixes)
 const st=addStats(classBaseStats(c), levelStats(c,rpg.lvl));
 // gear slot: the TIER's base stats, plus whatever affixes that item rolled. Rarity contributes
 // only through how many affixes there are — it no longer multiplies the base (see RAR_NAMES).
 function addSlot(base,slot){ addStats(base,affStats(eqAffArr(slot))); addStats(st,base); }
 if(wL) st.atk+=wL.add; else addSlot(gearBaseStats('wpn',rpg.wpn),'wpn');
 if(aL){ st.def+=aL.def; st.hp+=aL.hp; st.spd+=aL.spd||0; }
 else addSlot(gearBaseStats('arm',at,mt),'arm');
 if(ht>=0) addSlot(gearBaseStats('helm',ht,mt),'helm');
 if(rg) addSlot(gearBaseStats('ring',rg.t,rg.st),'ring');
 st.fort += coinFortune();      // passive loot boost from your best Fortune Coin
 // ---- skill-tree flat stats fold in before deriving; % / flags applied after
 const T=(typeof treeStats==='function')?treeStats(ch.cls,rpg):null;
 if(T){ st.atk+=T.atk; st.def+=T.def; st.hp+=T.hp; st.mp+=T.mp; st.dex+=T.dex; st.wis+=T.wis; st.vit+=T.vit;
   st.luck+=T.luck; st.fort+=T.fort; st.spd=st.spd*(1+T.spd); }
 // ---- permanent max-stat training (scrolls) folds in as a flat layer (16_maxstats.js)
 if(typeof trainedStats==='function'){ const TR=trainedStats(ch.cls,rpg); for(const k of STATS) st[k]+=(TR[k]||0); }
 for(const k of STATS) st[k]=Math.max(0,Math.round(st[k]));
 player.stats=st;
 // ---- derive combat values from the 10 stats
 player.def=st.def;
 player.dr=Math.min(0.80, st.def/(st.def+55));       // DEFENSE -> % damage reduction
 player.maxhp=Math.round((st.hp + st.vit*3)*HP_SCALE); // HP + VIT (scaled down to keep pools readable)
 player.spd=st.spd;                                   // SPEED
 player.dmg=Math.max(1,Math.round(st.atk));           // ATTACK
 const wRof=(player.wt.rof||1)*(wL?(wL.rof||1):1);
 player.fireRate=c.fr*wRof/(1+st.dex*0.013);          // DEX -> attack speed (softened to curb runaway)
 player.projSpd=1+st.dex*0.012;                       // DEX -> projectile speed
 player.regen=0.8+st.vit*0.12;                        // VIT -> hp regen/sec
 player.maxmp=Math.max(10,Math.round(st.mp*MP_SCALE)); // MP -> mana pool (scaled down)
 player.mpregen=2+st.wis*0.25;                        // WISDOM -> mana regen
 player.abilPow=1+st.wis*0.02;                        // WISDOM -> ability power
 player.crit=Math.min(0.75, st.luck*0.005);           // LUCK -> crit chance + hit
 player.critMult=1.5+st.luck*0.004;
 player.fortune=st.fort;                              // FORTUNE -> loot
 if(typeof petBonusFortune==='function') player.fortune+=petBonusFortune();   // active pet's Fortune kit
 // player.shots is display/legacy only — fire() counts projectiles from the weapon alone, so
 // nothing here or in the skill trees can change how many bolts leave the bow
 player.shots=(player.wt&&player.wt.shots)||1; player.pierce=c.pierce||0;
 player.ls=c.ls||0; player.slowShot=!!c.slow;
 player.resDef=ABIL[ch.cls]||ABIL.knight;
 // ---- skill-tree percentage bonuses + combat flags
 player.thorns=0;
 if(T){ player.maxhp=Math.round(player.maxhp*(1+T.hpPct));
   player.dmg=Math.max(1,Math.round(player.dmg*(1+T.atkPct)));
   player.dr=Math.min(0.88, player.dr+T.dr);
   player.crit=Math.min(0.90, player.crit+T.crit);
   player.critMult+=T.critMult;
   player.ls=player.ls+T.ls;
   player.pierce=player.pierce+T.cleave+T.pierce;
   player.shots=player.shots+T.shots;
   player.thorns=T.thorns;
   player.mpregen+=T.mpregen; player.regen+=T.regen;
   player.abilPow+=T.abilPow; player.projSpd+=T.projSpd;
   if(T.slow>0) player.slowShot=true;
   if(T.rof>0) player.fireRate=player.fireRate/(1+T.rof);
   // ascension capstone mechanics — flags picked up by combat/update/ability hooks
   for(const k of ['auraHeal','critPierce','dashInv','fork','groundFire','splash',
    'critDashCd','vanishHurt','killHeal','chainHit','execute','killInv','overshield',
    'burnHit','bloodNova','moveDr','curse','shatter','slowAura','critBolt','moveRof',
    'summonX2','homing','terrainGhost','stun3','groundHeal','allyDot','allyHaste',
    'echoCast','spiritDur','dashBlast','poisonHit','shockHit','bleedHit','weakHit']) player[k]=T[k]||0; }
 // RELIC TRAITS. A relic's trait sets exactly the same player flag an ascension capstone would, so
 // it is enforced by combat paths that already exist rather than by a special case. Applied AFTER
 // the tree assignment above (which overwrites) and additively, so a relic stacks with a capstone
 // that happens to share its flag instead of one silently erasing the other.
 for(const _sl of ['wpn','arm','helm','ring']){ const _e=(rpg.eqAff||{})[_sl];
   const _R=(_e&&_e.rel)?relicDef(_e.rel):null;
   if(_R&&_R.trait) player[_R.trait.flag]=(player[_R.trait.flag]||0)+_R.trait.v; }
 // SET BONUS: four pieces of one set, and you get a rule none of the four carries alone. Same
 // additive flag treatment, so a set bonus stacks with a piece trait and with a capstone.
 player._relicSet=null;
 if(typeof activeRelicSet==='function'){ const _S=activeRelicSet();
   if(_S&&_S.bonus){ player[_S.bonus.flag]=(player[_S.bonus.flag]||0)+_S.bonus.v; player._relicSet=_S.id; } }
 if(player.shield===undefined) player.shield=0;
 // projectile colour reflects the STATUS your shots inflict (user, 2026-07-24): a burn build
 // fires orange, poison green, frost blue... read off the on-hit flags, highest-signal first
 // (control > elemental DoT > debuff). Consumed by fire() -> the projectile forge.
 player.shotStat=null;
 if(typeof STATUS!=='undefined'){
   const _so=[['slowShot','chill'],['burnHit','burn'],['shockHit','shock'],['poisonHit','poison'],
     ['bleedHit','bleed'],['curse','curse'],['weakHit','weak']];
   for(const [fl,id] of _so){ if(player[fl] && STATUS[id]){ player.shotStat={id:id,col:STATUS[id].col}; break; } }
 }
 // perk engine: re-aggregate the owned nodes' cond/trig/mod entries (13b_perks.js)
 if(typeof perkAgg==='function') player._perk=perkAgg(ch.cls,rpg);
 player.look={cls:ch.cls, hue:ci*20, mt:mt, armT:(aL?11:at), helmT:ht, asc:(rpg.ascension||null)};
 if(player.mp===undefined||player.mp>player.maxmp) player.mp=player.maxmp;
 if(player.hp>player.maxhp)player.hp=player.maxhp; }
function saveRPG(){ if(curUser&&users[curUser]&&rpg){ LS.set('er-users',users); } }
function hudRPG(){ if(!rpg)return;
 $s('lvlTxt').textContent='Lv '+rpg.lvl;
 $s('goldTxt').textContent=(typeof accountGlory==='function'?accountGlory():0)+'\u2726';
 $s('potBtn').textContent='🧪 '+rpg.pots; }
// ===== PERMADEATH =====
// Up to Lv20 the hearth calls you home on death. From Lv20 the run is your life: dying
// retires the hero to the Hall of the Fallen and you start over with someone new.
const HC_LEVEL=20;
// ============================================================
// GLORY (user, 2026-07-26)
// ------------------------------------------------------------
// Glory is the ACCOUNT's currency, not the character's, and it is only ever paid out when a
// character dies for good. That is the whole loop: a run is worth what it accomplished, and you
// only collect by losing the hero who did it. It buys cosmetics and it is what the auction trades
// in -- never power, so no amount of banked glory makes a new character stronger than a fresh one.
//
// Scored from what the run actually DID rather than from level alone, so a cautious Lv50 who never
// left the safe ring is worth less than a Lv35 who cleared dungeons and pushed into the fog.
const GLORY={
  mob:      0.35,   // per ordinary kill — the floor, deliberately small
  elite:    1.6,
  boss:     55,     // a world boss is an event
  dungeon:  240,    // clearing a dungeon is the single biggest thing a run can do
  fogTile:  0.9,    // per percent of the world uncovered — rewards exploring, not camping
  level:    14,     // per level reached
  relic:    400,    // pulling a relic out of the world at all
  deepest:  6,      // per level of the deepest zone entered — credit for how far you pushed
};
function newRunStats(){ return {mobs:0,elites:0,bosses:0,dungeons:0,relics:0,deepest:0,fog:0,bounty:0}; }
function runStats(){ const ch=(typeof curChar==='function')?curChar():null;
  if(!ch) return null; if(!ch.run) ch.run=newRunStats(); return ch.run; }
function runNote(k,n){ const s=runStats(); if(s) s[k]=(s[k]||0)+(n===undefined?1:n);
  // the daily board reads the same acts a run is scored on, so it hooks in here rather than
  // growing its own counters. 'bounty' is the payout itself and must not feed back into progress.
  if(k!=='bounty' && typeof bountyNote==='function') bountyNote(k,n); }
function runDeepest(lv){ const s=runStats(); if(s&&lv>s.deepest) s.deepest=lv|0; }
// percentage of the world this character has uncovered, read straight off the fog mask
function fogPct(){
  try{ if(typeof _fogCv==='undefined'||!_fogCv) return 0;
    const g=_fogCtx||_fogCv.getContext('2d');
    const d=g.getImageData(0,0,_fogCv.width,_fogCv.height).data;
    let clear=0, n=0;
    for(let i=3;i<d.length;i+=16*4){ n++; if(d[i]<130) clear++; }   // sample every 16th pixel
    return n?(clear/n*100):0;
  }catch(e){ return 0; }
}
function gloryFor(s,lvl){
  if(!s) return 0;
  return Math.round(
      (s.mobs||0)*GLORY.mob + (s.elites||0)*GLORY.elite + (s.bosses||0)*GLORY.boss
    + (s.dungeons||0)*GLORY.dungeon + (s.fog||0)*GLORY.fogTile + ((lvl||1)-1)*GLORY.level
    + (s.relics||0)*GLORY.relic + (s.deepest||0)*GLORY.deepest
    + (s.bounty||0));                                   // bounties are banked in glory already
}
// a readable breakdown for the death screen — you should be able to see what earned what
function gloryRows(s,lvl){
  if(!s) return [];
  const r=[];
  const add=(l,n,v)=>{ const g=Math.round(n*v); if(g>0) r.push({l:l,n:n,g:g}); };
  add('Levels gained',(lvl||1)-1,GLORY.level);
  add('Foes felled',s.mobs||0,GLORY.mob);
  add('Elites felled',s.elites||0,GLORY.elite);
  add('Bosses felled',s.bosses||0,GLORY.boss);
  add('Dungeons cleared',s.dungeons||0,GLORY.dungeon);
  add('Relics taken',s.relics||0,GLORY.relic);
  // fog is a percentage, so it needs its own row rather than a count x rate
  const fg=Math.round((s.fog||0)*GLORY.fogTile);
  if(fg>0) r.push({l:'World uncovered',n:Math.round(s.fog||0)+'%',g:fg});
  add('Deepest ground',s.deepest||0,GLORY.deepest);
  if(s.bounty>0) r.push({l:'Bounties claimed',n:'',g:s.bounty});   // already in glory, not a rate
  return r;
}
function accountGlory(){ const u=users[curUser]; return (u&&u.glory)||0; }
// Spend from the ACCOUNT. Glory is earned only by dying, so this is the one purse in the game
// that outlives a character — and the only way it ever goes down.
function spendGlory(n){ const u=users[curUser];
  if(!u||n<=0||(u.glory||0)<n) return false;
  u.glory-=n; LS.set('er-users',users); if(typeof hudRPG==='function') hudRPG(); return true; }
function bankGlory(n){ const u=users[curUser]; if(!u||n<=0) return 0;
  u.glory=(u.glory||0)+n; LS.set('er-users',users); return u.glory; }
// PERMADEATH IS THE BRIDGE, NOT A LEVEL (user, 2026-07-26). It used to trigger at HC_LEVEL, which
// meant a hero could become permanent while still standing on the safe starter island. Crossing
// onto the main island is the commitment now: geography you chose to cross, not a number that
// happened to you. `hc` is stamped on the character the first time they cross, so a hero who has
// been out there stays permanent even if they retreat to the starter side afterwards.
function isHardcore(r){ return !!(r&&r.hc); }
function markHardcore(){ if(rpg&&!rpg.hc){ rpg.hc=1; saveRPG(); } }
function isDead(ch){ return !!(ch&&ch.dead); }
// The permadeath notice now fires ONCE, when you first CROSS THE BRIDGE onto the main island
// — the point of no return. No teleport (you're crossing on purpose); just the modal + a grace
// window so you're not read the rules mid-hit. Called every frame from update() while in the
// grove. (`hcSeen` kept as the flag; pre-existing Lv20+ heroes trip it on their first crossing.)
function hcCheck(){ const ch=curChar(); if(!ch||!rpg||!inGame) return false;
 if(rpg.hcSeen) return false;
 if(typeof onMainIsland!=='function' || !onMainIsland(player.x,player.y)) return false;
 rpg.hcSeen=1; markHardcore();       // the crossing itself is what makes this hero permanent
 player.inv=Math.max(player.inv||0,2.5);
 for(const id of ['invScr','skillScr','mapScr','loadScr','shopScr','aucScr','bntScr','dmdScr','wrdScr','coopScr'])
   if($s(id)) $s(id).style.display='none';
 $s('hcScr').style.display='flex';
 navigator.vibrate&&navigator.vibrate([40,60,40]);
 return true; }
function gainXP(x,g){ if(!rpg)return; rpg.xp+=x;   // g is ignored: kills pay xp, never currency
 while(rpg.lvl<LV_CAP && rpg.xp>=xpNeed(rpg.lvl)){ rpg.xp-=xpNeed(rpg.lvl); rpg.lvl++;
  if(typeof grantPerkPoints==='function') grantPerkPoints(rpg);
  recalcStats(); player.hp=player.maxhp;
  msg('LEVEL '+rpg.lvl,'the ember grows'); }
 saveRPG(); hudRPG(); }   // permadeath notice is bridge-crossing based now (hcCheck in update)
// A Lv20+ hero has fallen for good: record the tombstone, end the run, show the eulogy.
function permaDeath(){ const ch=curChar(); if(!ch) return;
 const zone=(typeof regionAtPx==='function'&&curRoom)?(regionAtPx(player.x,player.y)||{}).n:null;
 // the run's last act: read how much of the world it uncovered, score it, and pay the ACCOUNT.
 // This is the only time glory is ever awarded -- you collect by losing the hero who earned it.
 const st=runStats()||newRunStats();
 if(typeof fogPct==='function') st.fog=Math.max(st.fog||0,fogPct());
 const earned=gloryFor(st,rpg.lvl);
 const total=bankGlory(earned);
 ch.dead={ lvl:rpg.lvl, kills:player.kills||0, glory:earned,
   run:Object.assign({},st),
   zone: zone || (curRoom?curRoom.name:'the realm'), at: Date.now() };
 recordBest(player.kills); saveRPG(); LS.set('er-users',users);
 runLive=false; runChar=null; inGame=false;
 res=0; allies=[]; zones=[]; fx=[]; enemies.length=0; pShots.length=0; eShots.length=0;
 player.spiritT=0; player.deadeye=0; player.thornT=0; if(typeof clearPlayerStatuses==='function') clearPlayerStatuses();
 const cc=CLASSES[Math.max(0,CLASSES.findIndex(x=>x.id===ch.cls))];
 $s('deathWho').textContent=ch.name+' the '+(cc?cc.n:ch.cls);
 // the ledger matters more than the epitaph: you should be able to read exactly what this run
 // was worth, and what it added to the account
 let rows='';
 for(const r of gloryRows(st,ch.dead.lvl))
   rows+='<div class="gRow"><span>'+r.l+'</span><em>'+r.n+'</em><b>+'+r.g+'</b></div>';
 $s('deathCard').innerHTML=
   '<div>fell in <b class="dstat">'+ch.dead.zone+'</b></div>'
  +'<div>at <b class="dstat">Level '+ch.dead.lvl+'</b> · <b class="dstat">'+ch.dead.kills+'</b> kills this run</div>'
  +'<div id="gloryBox"><div id="gloryHd">GLORY EARNED</div>'+rows
  +'<div class="gRow gTot"><span>banked to your account</span><em></em><b>'+earned+'</b></div>'
  +'<div class="mnote" style="margin-top:6px;">account total — <b style="color:#ffc94d">'+total+' glory</b></div></div>'
  +'<div class="mnote" style="margin-top:10px;">Their name is kept in the Hall of the Fallen.</div>';
 // show() tears down the whole in-game UI — HUD buttons and any overlay left open
 // (inventory, skills, map, shop...) — so nothing survives the run
 show('deathScr');
 navigator.vibrate&&navigator.vibrate([90,70,90,70,180]); }
function openFallen(){ const u=users[curUser]; if(!u) return; migrate(u);
 const dead=u.chars.map((ch,i)=>({ch,i})).filter(x=>isDead(x.ch))
   .sort((a,b)=>(b.ch.dead.lvl-a.ch.dead.lvl)||(b.ch.dead.at-a.ch.dead.at));
 const box=$s('fallenList'); box.innerHTML='';
 $s('fallenNote').textContent=dead.length
   ? dead.length+' hero'+(dead.length>1?'es':'')+' lost to the realm'
   : 'No one has fallen yet. Keep it that way.';
 for(const {ch,i} of dead){ const ci=CLASSES.findIndex(x=>x.id===ch.cls); const c=CLASSES[ci<0?0:ci];
  const d=document.createElement('div'); d.className='ccard fallen';
  const when=new Date(ch.dead.at);
  d.innerHTML='<div class="cskull">💀</div>'
   +'<canvas class="cicCv" width="64" height="64"></canvas>'
   +'<div class="cn">'+ch.name+'</div>'
   +'<div class="cd">'+c.n+' · fell at Lv '+ch.dead.lvl+'<br>'+ch.dead.zone+'</div>'
   +'<div class="cs">'+ch.dead.kills+' kills · '+(ch.dead.glory||0)+'✦</div>'
   +'<div class="mnote" style="margin-top:4px;">'+when.toLocaleDateString()+'</div>'
   +'<div class="cdel">✕</div>';
  paintClassIcon(d.querySelector('.cicCv'), ch.cls);
  d.onclick=(ev)=>{ if(ev.target.classList.contains('cdel')
      && confirm('Remove '+ch.name+' from the Hall? Their record is lost.')){
    u.chars.splice(i,1); if(u.cur>=u.chars.length)u.cur=0; LS.set('er-users',users); openFallen(); } };
  box.appendChild(d); }
 show('fallenScr'); }
function usePotion(){ if(!rpg||rpg.pots<=0||player.hp>=player.maxhp) return;
 const heal=Math.max(60,Math.round(player.maxhp*0.35));   // scale with HP pool, not flat
 rpg.pots--; player.hp=Math.min(player.maxhp,player.hp+heal); saveRPG(); hudRPG();
 texts.push({x:player.x,y:player.y-22,txt:'+'+heal,col:'#7dc47a',life:1}); }


// POTIONS REFILL THEMSELVES (user, 2026-07-26). They were bought with gold, and gold is gone --
// glory is earned only by dying, so it must never be the thing standing between you and a heal.
// A slow trickle back to a small cap: enough that you are never stranded, never so much that
// stacking them replaces playing carefully. Drops still top you up faster than the trickle does.
const POT_CAP=5, POT_REFILL=48;    // one potion every 48s, up to five held
function tickPotions(dt){
  if(!rpg||!inGame) return;
  autoPotTick(dt);
  if((rpg.pots||0)>=POT_CAP){ rpg._potT=0; return; }
  rpg._potT=(rpg._potT||0)+dt;
  if(rpg._potT>=POT_REFILL){ rpg._potT-=POT_REFILL; rpg.pots=(rpg.pots||0)+1;
    if(typeof hudRPG==='function') hudRPG(); saveRPG(); }
}
// AUTO POTION (user, 2026-07-26). Drinks one tonic when you fall to the mark you set.
//
// WHAT IT IS NOT: a safety net. It fires no faster than once a second, it cannot drink what you do
// not have, and a hit that takes you from above the mark straight to zero never gets a chance to
// run at all -- there is no frame in between. It is a convenience for the long fights where you
// would have tapped the flask anyway, and the settings screen says so in as many words.
const AUTOPOT_CD=1.0;              // seconds between automatic drinks
let _autoPotT=0;
function autoPotTick(dt){
  const pct=(typeof autoPotPct==='function')?autoPotPct():0;
  if(_autoPotT>0) _autoPotT-=dt;
  if(!pct || !rpg || (rpg.pots||0)<=0) return;
  if(typeof player==='undefined' || !player.maxhp || player.hp<=0) return;   // dead men drink nothing
  if(_autoPotT>0) return;
  if(player.hp > player.maxhp*(pct/100)) return;
  const before=player.hp;
  usePotion();
  if(player.hp>before){ _autoPotT=AUTOPOT_CD;
    texts.push({x:player.x,y:player.y-36,txt:'AUTO',col:'#7dc47a',life:0.9}); }
}
$s('potBtn').addEventListener('click',usePotion);
// The four purchasable LEGENDARIES (not relics -- relics are ordinary T13 items now and equip from
// the satchel like anything else). These still own the wpnL/armL slot wholesale, and the only place
// they could ever be equipped from used to be a vendor's shop rows, so they live here instead.
function paintRelics(){ const box=$s('eqRelics'); if(!box||!rpg) return;
 const owned=(rpg.legends||[]).map(legById).filter(Boolean);
 if(!owned.length){ box.innerHTML=''; return; }
 let h='<div class="relHead">★ LEGENDARIES</div><div class="relRow">';
 for(const L of owned){ const eq=(L.slot==='wpn'?rpg.wpnL:rpg.armL)===L.id;
  h+='<div class="relChip'+(eq?' on':'')+'" data-rel="'+L.id+'" title="'+(L.d||'')+'">'
    +'<b>'+L.n+'</b><span>'+(eq?'in use':(L.slot==='wpn'?'weapon':'armor'))+'</span></div>'; }
 box.innerHTML=h+'</div>';
 box.querySelectorAll('.relChip').forEach(el=>{ el.onclick=function(){
   const L=legById(el.getAttribute('data-rel')); if(!L) return;
   const eq=(L.slot==='wpn'?rpg.wpnL:rpg.armL)===L.id;
   if(L.slot==='wpn') rpg.wpnL=eq?null:L.id; else rpg.armL=eq?null:L.id;
   recalcStats(); saveRPG(); hudRPG(); paintInv();
   navigator.vibrate&&navigator.vibrate(12); }; });
}
// (legendRows is gone with Bram's stock -- it existed to SELL the four legendaries for glory. One
//  already owned is equipped from the ★ LEGENDARIES strip on the equipment screen, same as before.)
// NOTHING IS SOLD FOR GLORY ANY MORE.
//
// Glory must never buy power -- that rule is why selling items was removed, why potions refill
// themselves, and why Sella's armour and Odo's pets went. Bram was the last hole in it: T1-T3
// weapons and two legendaries, all priced in glory, all straightforwardly power. His stock is gone
// for the same reason theirs was. Weapons are found in the field now, like armour.
//
// The stall itself is UNTOUCHED and stays reserved for the item-fusion system, which is why the
// forge is cold rather than gone: it is waiting for something, and it says so.
function shopRowsFor(id){ const ch=curChar(); const out=[]; const cls=ch.cls;
 if(id==='bram'){
  out.push({note:'The forge is banked and cold. Bram turns a broken blade over and sets it down again.'});
  out.push({note:'"Steel is won out there, not bought in here. Bring me something worth joining and we will talk."'});
 }
 return out; }
function openShop2(id){ const n=SHOPNPCS.filter(function(x){return x.id===id;})[0]||SHOPNPCS[0];
 $s('shopTitle').textContent=n.title;
 $s('shopScr').style.display='flex'; paintShop2(n.id); }
function paintShop2(id){ if(!rpg) return;
 const np=SHOPNPCS.filter(x=>x.id===id)[0];
 $s('shopGold').innerHTML='<span class="purse">✦ '+accountGlory()+' glory</span>';
 const box=$s('shopRows'); box.innerHTML='';
 for(const it of shopRowsFor(id)){
  if(it.note){ const d=document.createElement('div'); d.className='shopnote'; d.textContent=it.note; box.appendChild(d); continue; }
  const afford=!(it.c>0&&accountGlory()<it.c);
  const card=document.createElement('div'); card.className='shopcard'+(afford?'':' broke')+(it.legend?' legend':'');
  const ico=document.createElement('div'); ico.className='shopico';
  if(it.ic||it.pet){ const cv=document.createElement('canvas'); cv.width=42; cv.height=36; cv.className='isprite';
   const cc=cv.getContext('2d'); cc.imageSmoothingEnabled=false;
   if(it.ic){ drawItemIcon(cc,it.ic,42,36); }
   else { const sp=petSprite(it.pet); if(sp){ const sc=Math.max(1,Math.floor(Math.min(38/sp.width,32/sp.height)));
     cc.drawImage(sp,Math.round((42-sp.width*sc)/2),Math.round((36-sp.height*sc)/2),sp.width*sc,sp.height*sc); } }
   ico.appendChild(cv);
  } else { ico.classList.add('emoji'); ico.textContent=it.legend?'★':'🛒'; }
  card.appendChild(ico);
  const txt=document.createElement('div'); txt.className='shoptext';
  txt.innerHTML='<div class="shopname">'+it.l+'</div><div class="shopdesc">'+(it.desc||'')+'</div>';
  card.appendChild(txt);
  const pr=document.createElement('div'); pr.className='shopprice'+(it.c>0?'':' free');
  pr.textContent = it.c>0 ? it.c+'g' : (it.c===0?'✓':'');
  card.appendChild(pr);
  card.onclick=function(){ if(it.c>0&&!spendGlory(it.c)){ navigator.vibrate&&navigator.vibrate(20); return; }
   if(it.f) it.f(); recalcStats(); saveRPG(); hudRPG(); paintShop2(id);
   navigator.vibrate&&navigator.vibrate(15); };
  box.appendChild(card); }
}
// The legacy bought-pet follower is retired. It ran BESIDE the egg/Sanctuary pet, so a player who
// had both walked around with two, and only this one dealt damage -- a per-character combat pet
// bought with glory. `rpg.pet`/`rpg.pets` may still sit in old saves; nothing reads them now, and
// this exists only so any follower left over from a previous session is cleared rather than
// orphaned in `allies`. Pets live in 15_pets.js.
function spawnPet(){ for(let i=allies.length-1;i>=0;i--) if(allies[i].pet) allies.splice(i,1); }
// Stalls are opened from the prompt above the stall (usePortalPrompt, kind 'vendor') -- there is
// deliberately no HUD button to bind here any more.
// Every stall panel closes the same way and in the same places (walking off, opening the menu,
// crossing the bridge), so the list of them lives here once instead of in five call sites.
const VENDOR_PANELS=['shopScr','aucScr','bntScr','dmdScr'];
function closeVendorPanels(){ for(const id of VENDOR_PANELS){ const el=document.getElementById(id);
  if(el) el.style.display='none'; } }
$s('shopClose').addEventListener('click',()=>{$s('shopScr').style.display='none';});
$s('aucClose').addEventListener('click',()=>{ if(typeof closeAuction==='function') closeAuction(); });
$s('bntClose').addEventListener('click',()=>{ if(typeof closeBounties==='function') closeBounties(); });
$s('dmdClose').addEventListener('click',()=>{ if(typeof closeDiamonds==='function') closeDiamonds(); });
$s('wrdClose').addEventListener('click',()=>{ if(typeof closeWardrobe==='function') closeWardrobe(); });



function show(id){for(const s of ['loginScr','menuScr','charScr','classScr','devScr','setScr','fallenScr','hcScr','deathScr'])$s(s).style.display=(s===id)?'flex':'none';
 $s('menuBtn').style.display='none'; $s('potBtn').style.display='none';
 closeVendorPanels();
 $s('invBtn').style.display='none'; $s('invScr').style.display='none';
 $s('abBtn').style.display='none';
 $s('mapScr').style.display='none';
 if($s('hearthBtn'))$s('hearthBtn').style.display='none';
 if($s('coopBtn'))$s('coopBtn').style.display='none';
 if($s('coopScr'))$s('coopScr').style.display='none';
 if($s('loadBtn'))$s('loadBtn').style.display='none';
 if($s('loadScr'))$s('loadScr').style.display='none';
 if($s('skillBtn'))$s('skillBtn').style.display='none';
 if($s('skillScr'))$s('skillScr').style.display='none';
 if($s('statsBtn'))$s('statsBtn').style.display='none';
 if($s('statsScr'))$s('statsScr').style.display='none';
 if($s('sheetScr'))$s('sheetScr').style.display='none';
 // Hiding the HUD also hides the stall button, but proximity only re-evaluates when the NEAREST
 // NPC CHANGES -- so forgetting who we stood at is what makes the button come back on RESUME.
 // Without this, opening the menu at a stall and resuming loses that stall until you walk away.
 shopNear=false; curShopNear=null;}
function hideAll(){for(const s of ['loginScr','menuScr','charScr','classScr','devScr','setScr','fallenScr','hcScr','deathScr'])$s(s).style.display='none';}
function refreshUserList(){
 const box=$s('userList'); box.innerHTML='';
 for(const n of Object.keys(users)){const b=document.createElement('button');b.className='mbtn user';
  b.textContent=n; b.onclick=()=>{$s('loginName').value=n;$s('loginPass').focus();};
  box.appendChild(b);}
}
const ADMIN_HASH='b3a7d6e897c405612aa0c29d8d9f5ddfffe71c18632360752d7d29c5db912e23';
async function doLogin(){
 const n=$s('loginName').value.trim(), p=$s('loginPass').value;
 if(!n||!p){loginErr('Enter a name and password');return;}
 const h=await hash(p);
 if(n.toLowerCase()==='admin'){
  if(h!==ADMIN_HASH){loginErr('Wrong admin password');return;}
  isAdmin=true;
  if(!users['admin']) users['admin']={char:null,best:0};
 } else {
  isAdmin=false;
  if(users[n]){ if(users[n].pass!==h){loginErr('Wrong password for '+n);return;} }
  else { users[n]={pass:h,char:null,best:0}; LS.set('er-users',users); }
 }
 loginErr(''); $s('loginPass').value='';
 curUser=n.toLowerCase()==='admin'?'admin':n; LS.set('er-last',curUser); openMenu();
}
function loginErr(t){$s('loginErr').textContent=t;}
function openMenu(){
 // a build that landed mid-run was held back rather than reloading you (boot.js); the menu is the
 // safe moment to take it
 if(typeof emberReloadIfPending==='function' && emberReloadIfPending()) return;
 $s('menuWho').textContent=curUser;
 const u=users[curUser];
 const ch=curChar();
 const cc=ch?CLASSES[Math.max(0,CLASSES.findIndex(x=>x.id===ch.cls))]:null;
 $s('menuChar').textContent= ch&&cc ? cc.ic+' '+ch.name+' the '+cc.n : 'No character yet';
 const ur=(ch&&ch.rpg)||{lvl:1};
 $s('menuBest').textContent=isDead(ch)
   ? '💀 fell at Lv '+ch.dead.lvl+' in '+ch.dead.zone+' — choose another hero'
   : ('Lv '+ur.lvl+' · best '+(u.best||0)+' kills'
      +(isHardcore(ur)?'  ·  ☠ PERMADEATH':''));
 // Hall of the Fallen appears once you have actually lost someone
 const anyDead=(u.chars||[]).some(isDead);
 $s('fallenBtn').style.display=anyDead?'':'none';
 $s('playBtn').textContent=isDead(ch)?'CHOOSE A HERO':'PLAY';
 $s('devMenuBtn').style.display=isAdmin?'':'none'; $s('devBtn2').style.display='none'; inGame=false; show('menuScr');
 // ☰ mid-run used to be a one-way door: PLAY restarts you in the Hearth with the run
 // reset, so an accidental tap cost your position. Offer RESUME while the run is live.
 const rb=$s('resumeBtn'); if(rb) rb.style.display=(runLive&&curChar()===runChar)?'':'none';
}
// Return to a run already in progress: the world, position and cooldowns are all still
// in memory — only the HUD was hidden — so this restores the HUD and hands control back.
function resumeRun(){ if(!runLive||curChar()!==runChar){ play(); return; }
 hideAll(); showGameHud(); inGame=true; hudRPG(); }
function migrate(u){ if(!u.chars){ u.chars=[]; u.cur=0;
  if(u.char){ u.chars.push({name:curUser.slice(0,14), cls:u.char, rpg:u.rpg||{lvl:1,xp:0,wpn:0,pots:1}}); }
  delete u.char; delete u.rpg; LS.set('er-users',users); }
 if(u.cur===undefined||u.cur>=u.chars.length) u.cur=0; }
function curChar(){ const u=users[curUser]; if(!u) return null; migrate(u); return u.chars[u.cur]||null; }
function openChar(){
 const u=users[curUser]; migrate(u);
 const box=$s('charList'); box.innerHTML='';
 if(!u.chars.length){ box.innerHTML='<div class="mnote">No characters yet. Forge your first hero.</div>'; }
 u.chars.forEach((ch,i)=>{ const ci=CLASSES.findIndex(x=>x.id===ch.cls); const c=CLASSES[ci<0?0:ci];
  const gone=isDead(ch);
  const d=document.createElement('div'); d.className='ccard'+(i===u.cur&&!gone?' sel':'')+(gone?' fallen':'');
  d.innerHTML=(gone?'<div class="cskull">💀</div>':'')
   +'<canvas class="cicCv" width="64" height="64"></canvas><div class="cn">'+ch.name+'</div>'
   +'<div class="cd">'+c.n+' · '+(gone?('fell at Lv '+ch.dead.lvl+'<br>'+ch.dead.zone):('Lv '+ch.rpg.lvl))+'</div>'
   +'<div class="cs">'+(gone?(ch.dead.kills+' kills · '+(ch.dead.glory||0)+'✦')
        :('T'+((ch.rpg.wpn||0)+1)+' '+weaponAt(ch.cls,ch.rpg.wpn||0).n))+'</div>'
   +'<div class="cdel">✕</div>';
  paintClassIcon(d.querySelector('.cicCv'), ch.cls);
  d.onclick=(ev)=>{ if(ev.target.classList.contains('cdel')){
    if(confirm(gone?('Remove '+ch.name+' from the Hall? Their record is lost.'):('Delete '+ch.name+' forever?'))){
     u.chars.splice(i,1); if(u.cur>=u.chars.length)u.cur=0;
     LS.set('er-users',users); openChar(); }
    return; }
   if(gone){ msg&&msg(ch.name+' is gone','their ember cannot be rekindled'); return; }   // dead heroes are not playable
   u.cur=i; LS.set('er-users',users); openMenu(); };
  box.appendChild(d); });
 show('charScr');
}
function openClassPick(){
 const box=$s('classList'); box.innerHTML='';
 CLASSES.forEach((c,i)=>{ const d=document.createElement('div'); d.className='ccard mini';
  let tags=' · '+classWT(c.id).n;
  // shot count is the weapon's, so the tag reads it from there rather than from the class
  const _cw=classWT(c.id);
  if(_cw.shots>1) tags+=' · ×'+_cw.shots+' shots';
  if(c.pierce||_cw.pierce) tags+=(_cw.pierce>=99?' · pierces all':' · pierce');
  if(c.ls) tags+=' · lifesteal'; if(c.regen>1) tags+=' · regen'; if(c.slow) tags+=' · chill';
  d.innerHTML='<canvas class="cicCv" width="56" height="56"></canvas><div class="cn">'+c.n+'</div>'
   +'<div class="cd">'+c.d+'<br><span style="color:#ffd07a">'+((typeof APOOL!=='undefined'&&APOOL[c.id])?APOOL[c.id][0].name+' — '+APOOL[c.id][0].desc:'')+'</span></div>'
   +'<div class="cs">HP '+c.hp+' · SPD '+c.spd+' · DMG '+c.dmg+' · '+(1/c.fr).toFixed(1)+'/s'+tags+'</div>';
  paintClassIcon(d.querySelector('.cicCv'), c.id);
  d.onclick=()=>{ const nm=($s('charName').value.trim()||('Hero'+Math.floor(Math.random()*900+100))).slice(0,14);
   const u=users[curUser];
   u.chars.push({name:nm, cls:c.id, rpg:{lvl:1,xp:0,wpn:0,pots:1}});
   u.cur=u.chars.length-1; LS.set('er-users',users); $s('charName').value=''; openMenu(); };
  box.appendChild(d); });
 show('classScr');
}
function play(){
 const u=users[curUser];
 const ch=curChar();
 if(!ch){openChar();return;}
 if(isDead(ch)){ openChar(); return; }        // a fallen hero can never be played again
 loadRPG(); recalcStats(); player.hp=player.maxhp; player.mp=player.maxmp;
 player.kills=0; player.inv=1;
 res=0; allies=[]; zones=[]; fx=[]; player.spiritT=0; player.deadeye=0; player.thornT=0; if(typeof clearPlayerStatuses==='function') clearPlayerStatuses();
 player.bDmgT=0; player.bRofT=0; player.bSpdT=0;
 player.acd={}; armedSlot=0; if(typeof ensureLoadout==='function') ensureLoadout();
 if(typeof grantPerkPoints==='function') grantPerkPoints(rpg);   // backfill earned perk points
 spawnPet(); if(typeof spawnActivePet==='function') spawnActivePet();
 document.getElementById('killTxt').textContent='Kills 0';
 hudRPG();
 hideAll(); showGameHud(); inGame=true;
 runLive=true; runChar=ch;                       // a run is now in progress (enables RESUME)
 const r0=rooms['0,0']; enterRoom('0,0',(r0.px+.5)*TILE,(r0.py+.5)*TILE);
 hcCheck();     // heroes already past Lv20 (or from before this rule) get the notice here
}
// one place that reveals the in-game HUD — used by play() and resumeRun()
function showGameHud(){
 $s('menuBtn').style.display='flex'; if(isAdmin)$s('devBtn2').style.display='flex';
 $s('potBtn').style.display='flex'; $s('invBtn').style.display='flex';
 $s('abBtn').style.display='none';
 if($s('coopBtn'))$s('coopBtn').style.display='flex';
 if($s('loadBtn'))$s('loadBtn').style.display='flex';
 if($s('skillBtn'))$s('skillBtn').style.display='flex';
 if($s('petBtn'))$s('petBtn').style.display='flex';
 if($s('statsBtn')){ $s('statsBtn').style.display='flex'; if(typeof updateStatsBtn==='function') updateStatsBtn(); }
 if($s('hearthBtn')) $s('hearthBtn').style.display='flex';
}
// ---- HEARTH RECALL: one tap home from anywhere (user) ----
// Deliberately always available, including mid-fight, because that is what was asked for. It is
// therefore also an escape hatch out of a losing permadeath fight — worth knowing, and easy to
// gate later by refusing while bossBar is set if that turns out to be too forgiving.
function goHearth(){
 if(typeof rooms==='undefined'||!rooms['0,0']) return;
 if(curRoom && curRoom.town){ if(typeof msg==='function') msg('THE HEARTH','you are already home'); return; }
 const r0=rooms['0,0'];
 // leaving the world cleanly: drop the pursuers, live shots and any dungeon-exit portal, or
 // they follow you into town and the ground portal would still be waiting on return
 if(typeof enemies!=='undefined') enemies.length=0;
 if(typeof eShots!=='undefined') eShots.length=0;
 if(typeof groundPortals!=='undefined') groundPortals.length=0;
 if(typeof bossBar!=='undefined') bossBar=null;
 if(typeof portalLock!=='undefined') portalLock=true;      // don't instantly re-trigger the arrival portal
 enterRoom('0,0',(r0.px+.5)*TILE,(r0.py+.5)*TILE);
 if(typeof spawnPet==='function') spawnPet();
 if(typeof msg==='function') msg('🔥 THE HEARTH','the fire calls you home');
 navigator.vibrate&&navigator.vibrate(18);
}
if(typeof document!=='undefined'){ const _hb=document.getElementById('hearthBtn');
 if(_hb) _hb.addEventListener('click',goHearth); }
if(typeof document!=='undefined'){ const _pb=document.getElementById('petBtn');
 if(_pb) _pb.addEventListener('click',function(){ if(typeof openPets==='function') openPets(); }); }
function recordBest(k){ if(curUser&&users[curUser]&&k>(users[curUser].best||0)){
 users[curUser].best=k; LS.set('er-users',users); } }
// ---------- device settings (UI scale, camera, feedback toggles, manual aim) ----------
// Stored per DEVICE in er-opts (not per user) — display comfort follows the screen.
// autoPot is the HP PERCENTAGE it drinks at; 0 is off. The steps are the only legal values, so a
// hand-edited save cannot ask for "drink at 95%".
const AUTOPOT_STEPS=[0,5,10,15];
const OPT_DEF={ui:1,zoom:1,dmgTxt:true,vib:true,fps:false,fs:true,aim:false,autoPot:0};
let OPTS=Object.assign({},OPT_DEF,LS.get('er-opts',{}));
function saveOpts(){ LS.set('er-opts',OPTS); applyOpts(); }
function applyOpts(){
 UIS=OPTS.ui||1;
 document.documentElement.style.setProperty('--uis',UIS);   // scales the fixed HUD buttons (style.css)
 // vibration mute: shadow navigator.vibrate so every existing call site respects it
 try{
  if(OPTS.vib===false) Object.defineProperty(navigator,'vibrate',{value:function(){return false;},configurable:true,writable:true});
  else if(Object.getOwnPropertyDescriptor(navigator,'vibrate')) delete navigator.vibrate;
 }catch(e){}
}
applyOpts();
function _setPaint(){
 $s('setUi').value=Math.round((OPTS.ui||1)*100);   $s('setUiV').textContent=Math.round((OPTS.ui||1)*100)+'%';
 $s('setZoom').value=Math.round((OPTS.zoom||1)*100); $s('setZoomV').textContent=Math.round((OPTS.zoom||1)*100)+'%';
 const tg=(id,on)=>{ const b=$s(id).querySelector('b'); b.textContent=on?'ON':'OFF'; b.classList.toggle('off',!on); };
 tg('setAim',!!OPTS.aim); tg('setDmg',OPTS.dmgTxt!==false); tg('setVib',OPTS.vib!==false); tg('setFps',!!OPTS.fps); tg('setFs',OPTS.fs!==false);
 // Grey out what this input cannot do. A row marked data-only="pc" is meaningless on a touch
 // screen (there is no cursor to aim at), and data-only="touch" is meaningless on a desktop (no
 // vibration motor, no fullscreen-on-tap). They stay visible but say why they are inert, and their
 // click handlers refuse, so the stored value cannot drift away from what you can actually see.
 const _mode=(typeof inputMode!=='undefined')?inputMode:'pc';
 document.querySelectorAll('#setScr .setRow[data-only]').forEach(r=>{
   const only=r.getAttribute('data-only'), off=(only!==_mode);
   r.classList.toggle('na',off);
   const lbl=r.querySelector('span'), base=lbl.getAttribute('data-label')||lbl.textContent;
   lbl.setAttribute('data-label',base);
   lbl.textContent=off?(base+(only==='pc'?' (mouse only)':' (touch only)')):base; });
 // auto potion reads as a percentage rather than ON/OFF, and its warning brightens when it is armed
 const ap=autoPotPct(), pb=$s('setPot').querySelector('b');
 pb.textContent=ap?(ap+'% HP'):'OFF'; pb.classList.toggle('off',!ap);
 $s('setPot').querySelector('span').textContent=ap?'Auto potion at':'Auto potion';
 $s('setPotNote').classList.toggle('on',!!ap);
}
// the stored value is only ever one of the steps, whatever a hand-edited save says
function autoPotPct(){ const v=OPTS.autoPot|0; return AUTOPOT_STEPS.indexOf(v)>0?v:0; }
function autoPotCycle(){ const i=Math.max(0,AUTOPOT_STEPS.indexOf(autoPotPct()));
  OPTS.autoPot=AUTOPOT_STEPS[(i+1)%AUTOPOT_STEPS.length]; saveOpts(); _setPaint();
  if(typeof msg==='function'){ const p=autoPotPct();
    if(p) msg('AUTO POTION · '+p+'%','it will not keep you alive — watch your bar');
    else msg('AUTO POTION OFF','tonics are yours to spend'); } }
function openSettings(){ _setPaint(); show('setScr'); }
$s('setBtn').addEventListener('click',openSettings);
$s('setBack').addEventListener('click',openMenu);
$s('setReset').addEventListener('click',()=>{ OPTS=Object.assign({},OPT_DEF); saveOpts(); _setPaint(); });
$s('setUi').addEventListener('input',e=>{ OPTS.ui=(+e.target.value)/100; saveOpts(); $s('setUiV').textContent=e.target.value+'%'; });
$s('setZoom').addEventListener('input',e=>{ OPTS.zoom=(+e.target.value)/100; saveOpts(); $s('setZoomV').textContent=e.target.value+'%'; });
// a row that does not apply to this input refuses the tap rather than storing a value the player
// cannot see the effect of
function _setTog(id,fn){ $s(id).addEventListener('click',()=>{
  if($s(id).classList.contains('na')){ navigator.vibrate&&navigator.vibrate(15); return; }
  fn(); saveOpts(); _setPaint(); }); }
_setTog('setAim',()=>{ OPTS.aim=!OPTS.aim; });
_setTog('setDmg',()=>{ OPTS.dmgTxt=(OPTS.dmgTxt===false); });
_setTog('setVib',()=>{ OPTS.vib=(OPTS.vib===false); });
_setTog('setFps',()=>{ OPTS.fps=!OPTS.fps; });
_setTog('setFs',()=>{ OPTS.fs=(OPTS.fs===false); });
$s('setPot').addEventListener('click',autoPotCycle);
$s('loginBtn').addEventListener('click',doLogin);
$s('loginPass').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
$s('playBtn').addEventListener('click',play);
$s('resumeBtn').addEventListener('click',resumeRun);
// ---- permadeath screens ----
$s('hcOk').addEventListener('click',()=>{ $s('hcScr').style.display='none'; });
$s('deathNew').addEventListener('click',()=>{ $s('deathScr').style.display='none'; openClassPick(); });
$s('deathHall').addEventListener('click',()=>{ $s('deathScr').style.display='none'; openFallen(); });
$s('deathMenu').addEventListener('click',()=>{ $s('deathScr').style.display='none'; openMenu(); });
$s('fallenBtn').addEventListener('click',openFallen);
$s('fallenBack').addEventListener('click',openMenu);
$s('charBtn').addEventListener('click',openChar);
$s('backBtn').addEventListener('click',openMenu);
$s('newCharBtn').addEventListener('click',openClassPick);
$s('classBack').addEventListener('click',openChar);
$s('switchBtn').addEventListener('click',()=>{curUser=null;isAdmin=false;runLive=false;runChar=null;LS.set('er-last',null);refreshUserList();show('loginScr');});
$s('menuBtn').addEventListener('click',()=>{recordBest(player.kills);openMenu();});
