// ============================================================
//  THE FORGE (18_forge.js) — Bram's stall, finally lit
// ------------------------------------------------------------
//  THE MACHINE TAKES EXACTLY TWO THINGS (user, 2026-07-28). Every rung of the whole arc is the
//  same gesture — put two things on the anvil, get one back — from joining two scraps off the
//  starter island to turning a T13 into a relic. That is the entire interface, and it is why there
//  is one panel instead of a workbench with tabs: a player who has used the Fusion Altar already
//  knows how this works.
//
//  THE LADDER ABOVE T12, AND WHERE EACH RUNG COMES FROM.
//    T1-T12               found anywhere the zone tables say so
//    SCAVENGED DREAMS     DROPPED, and only in the highest-level areas and the ASCENDED DREAM
//                         DUNGEONS (user, 2026-07-28). The forge does NOT make it. Written "SD",
//                         never "T13" — it is named for what it is, gear scavraged out of a dead
//                         god's dream, and a number would say nothing.
//    T14 Riftforged       relics. THIS is what the forge makes, out of an SD piece and a Riftseed.
//
//  So the forge has exactly two jobs: join materials into better materials, and turn a Scavenged
//  Dreams piece into a relic. It never touches the ordinary ladder.
//
//  Relics used to sit where SD sits now and moved up a rung to make room. The name went with them,
//  so a saved relic still reads 'Riftforged' — it changes its index, and migrateForgeTiers() moves
//  it.
//
//  WHY A RELIC STILL CANNOT LEAK INTO A DROP TABLE. mkItem() clamps t to MAXT-1, which is SD_T, so
//  the highest thing any roll can produce is a Scavenged Dreams piece. T14 is above the clamp and
//  the only functions that build one are mkRelicItem and forgeDo — neither reachable from rollLoot,
//  rollBagSlots, auctionListings or a shop row. The integrity check asserts it.
//
//  MATERIALS ARE ACCOUNT-LEVEL, like pets, mounts and the Vault, and for the reason the starter
//  island exists at all: it was the one stretch of the game that produced nothing permanent. A
//  material you farmed at Lv6 and lost to permadeath at Lv19 would leave the island exactly as
//  pointless as it was. They survive the hero who dug them up.
//
//  THEY DROP; THEY ARE NOT SOLD. Glory must never buy power, and a material is the first half of a
//  T14. They ride in the ordinary gear sack beside pet food and boost draughts, which keeps
//  one-sack-per-kill intact and means Fortune finds them like everything else.
// ============================================================

// The tier indices this file works in — SD_T (Scavenged Dreams) and RELIC_T — are declared in
// 11_ui.js with the rest of the ladder, because the ladder is one thing and it should be readable
// in one place. Nothing here redeclares them.

// ------------------------------------------------------------
// THE MATERIALS
// ------------------------------------------------------------
// `tier` here is the material's own rank, 0-3, and has NOTHING to do with the gear tier ladder —
// it exists to sort the pouch and to colour a chip, not to gate anything. What a material can do
// is decided by the recipe table below and nowhere else, so adding a material never changes a rule.
//
// `src` is documentation of where it comes from, and it is also what matDropFor reads, so the
// comment cannot drift from the behaviour the way a hand-written table would.
//   'starter'  the Lv1-20 island
//   'main'     the Lv20-50 main island
//   'rift'     post-ascension dungeon bosses ONLY
//   'craft'    made at the forge, never dropped
const MATERIALS = {
  // ---- the three the starter island pays out. This is what the island is FOR. ----
  cinder:  {id:'cinder',  n:'Cinder Scale',  tier:0, src:'starter', col:'#d98a5a', icon:'◆',
            d:'flakes off anything that burned before it died'},
  bogiron: {id:'bogiron', n:'Bog Iron',      tier:0, src:'starter', col:'#8b8f96', icon:'▰',
            d:'pulled out of the wet ground in lumps'},
  sap:     {id:'sap',     n:'Pale Sap',      tier:0, src:'starter', col:'#c8d9a0', icon:'❧',
            d:'runs clear, sets hard, and holds a shape'},
  // ---- the three the main island pays out, Lv20-50 ----
  glass:   {id:'glass',   n:'Storm Glass',   tier:1, src:'main',    col:'#9ad4ef', icon:'◇',
            d:'sand the lightning got to first'},
  salt:    {id:'salt',    n:'Grave Salt',    tier:1, src:'main',    col:'#e4e0d4', icon:'✳',
            d:'scraped from where something was buried a long time'},
  drakeash:{id:'drakeash',n:'Drake Ash',     tier:1, src:'main',    col:'#b06a4a', icon:'▲',
            d:'still warm, and it does not cool'},
  // ---- the apex reagent. POST-ASCENSION BOSSES ONLY. ----
  // This is the whole content gate for the T14 rung, and it is not a new mechanism: the dungeons
  // that drop it already refuse to open without an ascension (11_ui.js reads gate:'none'), so
  // gating the material on the boss gates the relic on the ascension for free.
  riftcinder:{id:'riftcinder',n:'Rift Cinder',tier:3, src:'rift',   col:'#c07ad4', icon:'✦',
            d:'it fell through from somewhere the world does not reach'},
  // ---- crafted. Nothing drops these. ----
  emberalloy:{id:'emberalloy',n:'Emberalloy',tier:1, src:'craft',   col:'#e0975a', icon:'❖',
            d:'iron that took the burn and kept it'},
  quench:  {id:'quench',  n:'Quenchresin',   tier:1, src:'craft',   col:'#a8c884', icon:'❉',
            d:'sap and iron, set together while hot'},
  flux:    {id:'flux',    n:'Witchflux',     tier:1, src:'craft',   col:'#8fc4a8', icon:'✺',
            d:'it makes two things that hate each other agree'},
  stormsteel:{id:'stormsteel',n:'Stormsteel',tier:2, src:'craft',   col:'#7ab8d4', icon:'⬟',
            d:'it rings when nothing has struck it'},
  gravebind:{id:'gravebind',n:'Gravebind',   tier:2, src:'craft',   col:'#b8b0c4', icon:'⬢',
            d:'what is bound with it stays bound'},
  drakeflux:{id:'drakeflux',n:'Drakeflux',   tier:2, src:'craft',   col:'#d4784a', icon:'⬣',
            d:'the burn, held in something that will pour'},
  truecore:{id:'truecore', n:'Truecore',     tier:3, src:'craft',   col:'#c9d2da', icon:'⯃',
            d:'struck through and found solid all the way'},
  // The last thing the material tree can make on its own. Everything below this exists to reach it.
  forgeheart:{id:'forgeheart',n:'Forgeheart',tier:3, src:'craft',   col:'#ff6a3d', icon:'❤',
            d:'the forge keeps one of these banked, and Bram will not say how'},
  // The relic catalyst: this plus a Scavenged Dreams piece is a relic. The end of the tree.
  riftseed:{id:'riftseed', n:'Riftseed',     tier:3, src:'craft',   col:'#ffd24a', icon:'✧',
            d:'hold it and something on the other side notices'},
};
const MAT_KEYS = Object.keys(MATERIALS);
function matDef(id){ return MATERIALS[id]||null; }

// ------------------------------------------------------------
// THE RECIPE TABLE
// ------------------------------------------------------------
// Keyed by the two inputs SORTED, so a recipe cannot be written twice by accident and the lookup
// never has to care which slot a player filled first. Everything is a pair; there is no other
// shape of recipe in this system and there is deliberately no way to add one.
function _pairKey(a,b){ return (a<b) ? a+'+'+b : b+'+'+a; }
const MAT_RECIPES = {};
function _recipe(a,b,out,n){ MAT_RECIPES[_pairKey(a,b)]={a:a,b:b,out:out,n:n||1}; }

// tier 0 -> tier 1. The three starter materials pair with each other, so the island alone gets you
// somewhere -- you cannot finish anything here, but nothing you pick up at Lv6 is wasted.
_recipe('bogiron','cinder',  'emberalloy');
_recipe('sap','bogiron',     'quench');
_recipe('cinder','sap',      'flux');
// tier 1 -> tier 2. Each takes one crafted tier-1 and one MAIN-ISLAND drop, which is the join
// between the two halves of the game: the island's output is the input to the mainland's.
_recipe('emberalloy','glass','stormsteel');
_recipe('quench','salt',     'gravebind');
_recipe('flux','drakeash',   'drakeflux');
// tier 2 -> tier 3.
_recipe('stormsteel','gravebind','truecore');
_recipe('truecore','drakeflux',  'forgeheart');
// the apex. The ONLY recipe that consumes a rift material, and therefore the only one an
// unascended player can never reach.
_recipe('forgeheart','riftcinder','riftseed');

function matRecipe(a,b){ return MAT_RECIPES[_pairKey(a,b)]||null; }
// every recipe that produces `id` -- used by the panel to explain where something comes from
function matRecipesFor(id){ const out=[]; for(const k in MAT_RECIPES){ const r=MAT_RECIPES[k];
  if(r.out===id) out.push(r); } return out; }

// ------------------------------------------------------------
// THE POUCH — account-level, exactly like the pantry in 15_pets.js
// ------------------------------------------------------------
function matStore(){ const u=(typeof users!=='undefined'&&curUser)?users[curUser]:null; if(!u) return null;
  if(!u.mats || typeof u.mats!=='object') u.mats={};
  return u.mats; }
function saveMats(){ if(typeof LS!=='undefined'&&typeof users!=='undefined') LS.set('er-users',users); }
function matCount(id){ const m=matStore(); return (m&&m[id])|0; }
function matAdd(id,n){ const m=matStore(); if(!m||!MATERIALS[id]) return 0;
  m[id]=(m[id]|0)+(n||1); saveMats(); return m[id]; }
// Spend is all-or-nothing on purpose: a craft that took half its inputs and then failed would be
// the worst bug in the system and the hardest to notice.
function matSpend(list){ const m=matStore(); if(!m) return false;
  for(const id in list) if((m[id]|0) < list[id]) return false;
  for(const id in list) m[id]=(m[id]|0)-list[id];
  saveMats(); return true; }
function matTotal(){ const m=matStore(); if(!m) return 0; let n=0; for(const k in m) n+=m[k]|0; return n; }
// what the pouch holds, richest first, for the panel
function matHeld(){ const m=matStore(); if(!m) return [];
  return MAT_KEYS.filter(k=>(m[k]|0)>0)
    .map(k=>({def:MATERIALS[k], n:m[k]|0}))
    .sort((x,y)=> (y.def.tier-x.def.tier) || (x.def.n<y.def.n?-1:1)); }

// ------------------------------------------------------------
// DROPS
// ------------------------------------------------------------
// Deliberately COMMON compared with everything else that rides in the sack. A material is not a
// prize, it is a unit of work: the fusion tree costs 2 starter materials per tier-1, 4 per tier-2
// and so on, so a rate tuned like a pet egg would put the first Forgeheart weeks away. Pet food
// (5.5% trash / 60% boss) is the closest honest comparison and this sits a little above it.
const MAT_DROP_P = {B:0.70, s:0.085, c:0.085, N:0.045};
// Which pool a kill pays from. This is the ONE place the island/mainland/rift split is decided.
function matPoolFor(e){
  // A post-ascension dungeon boss is the only source of the apex reagent. `gate` on the boss is the
  // existing ascension wall -- 'none' means a walk-in starter dungeon, anything else (INCLUDING a
  // missing field) means the awakened depths, which is the same default the dungeon door uses.
  if(e && e.type==='B' && typeof curRoom!=='undefined' && curRoom && curRoom.dungeon){
    const gb=(typeof GBOSS!=='undefined')?GBOSS[curRoom.ring]:null;
    if(gb && gb.gate!=='none') return 'rift';
  }
  // Otherwise it is decided by which island you are standing on. onMainIsland only answers in the
  // radial overworld room; anywhere else (a dungeon on the mainland, a side room) falls to 'main',
  // which is right -- the starter pool is the starter ISLAND, not "anywhere that is not the rim".
  if(typeof onMainIsland==='function' && typeof curRoom!=='undefined' && curRoom && curRoom.rings)
    return onMainIsland(e.x,e.y) ? 'main' : 'starter';
  return 'main';
}
function matPool(src){ return MAT_KEYS.filter(k=>MATERIALS[k].src===src); }
// Returns a loot item {k:'mat', m:id, n:count} or null. Pushed into rollLoot's `extra`, so it lands
// in the ordinary gear sack.
function matDropFor(e){
  if(!e || e.node) return null;
  let p=MAT_DROP_P[e.type]!==undefined?MAT_DROP_P[e.type]:MAT_DROP_P.c;
  if(e.elite) p*=2.2;
  const F=(typeof player!=='undefined'&&player.fortune)||0;
  p*=(1+F*0.012);
  if(Math.random()>=p) return null;
  const pool=matPool(matPoolFor(e));
  if(!pool.length) return null;
  const id=pool[Math.floor(Math.random()*pool.length)];
  // A boss pays a small stack; everything else pays one. The apex reagent NEVER stacks -- it is the
  // one material whose count is meant to be countable.
  const n=(id==='riftcinder') ? 1 : (e.type==='B' ? 2+Math.floor(Math.random()*3) : 1);
  return {k:'mat', m:id, n:n};
}

// ------------------------------------------------------------
// WHAT THE ANVIL DOES WITH TWO THINGS
// ------------------------------------------------------------
// A slot holds one of:
//   {kind:'mat',  id}            a material out of the pouch
//   {kind:'item', i}             an index into the character's satchel
// forgePlan() is a PURE read: it says what the pair would produce and why it would not, and the
// panel calls it on every repaint. forgeDo() is the only thing that consumes anything.
function _slotItem(s){ if(!s||s.kind!=='item') return null;
  const ch=(typeof curChar==='function')?curChar():null;
  return (ch&&ch.inv&&ch.inv[s.i])||null; }

// A relic is crafted INTO a chosen set, and the piece you get is decided by the slot of the T13 you
// put in -- a T13 helm makes that set's helm. That is the whole reason to craft one instead of
// farming: a drop is 0.25%-1% spread across forty-eight pieces, and this completes the set you are
// actually wearing. It cannot make a duplicate (ownsRelic refuses), and it cannot reach a set whose
// dungeon you have never opened, because the Riftseed it costs only exists post-ascension.
function forgeRelicPieceFor(setId, slot){
  if(typeof RELICS==='undefined') return null;
  for(const R of RELICS) if(R.set===setId && R.slot===slot) return R;
  return null;
}
// Every set the player could forge into right now, with whether each is already owned.
function forgeSetsFor(slot){
  if(typeof RELIC_SETS==='undefined') return [];
  return RELIC_SETS.map(S=>{
    const piece=forgeRelicPieceFor(S.id,slot);
    return {set:S, piece:piece,
            owned:!!(piece && typeof ownsRelic==='function' && ownsRelic(piece.id))};
  }).filter(x=>!!x.piece);
}

// The three rungs, in one function, because they are one machine.
// Returns {ok, kind, out, cost, why} -- `why` is what the panel prints when ok is false.
function forgePlan(A,B,opts){
  const o=opts||{};
  if(!A||!B) return {ok:false, why:'Two things, on the anvil.'};
  const ia=_slotItem(A), ib=_slotItem(B);

  // ---- rung 1: two materials ----
  if(A.kind==='mat' && B.kind==='mat'){
    const r=matRecipe(A.id,B.id);
    if(!r) return {ok:false, why:'These two do nothing to each other.'};
    // the same material twice needs two of it
    const need={}; need[r.a]=(need[r.a]||0)+1; need[r.b]=(need[r.b]||0)+1;
    for(const id in need) if(matCount(id)<need[id])
      return {ok:false, why:'You need '+need[id]+'x '+MATERIALS[id].n+'.'};
    return {ok:true, kind:'mat', out:r.out, n:r.n, cost:need,
            label:MATERIALS[r.out].n, why:''};
  }

  // ---- the gear rung: a Scavenged Dreams piece plus the Riftseed ----
  const item = ia||ib, mat = (A.kind==='mat')?A:(B.kind==='mat'?B:null);
  if(!item || !mat) return {ok:false, why:'The anvil takes one piece and one reagent.'};
  if(item.relic) return {ok:false, why:'A relic is already the last thing this forge can make.'};
  if(item.k!=='wpn' && item.k!=='arm' && item.k!=='helm' && item.k!=='ring')
    return {ok:false, why:'That is not something Bram can work.'};

  // SD + Riftseed -> a relic (T14). The ONLY thing the forge does to a piece of gear: the ordinary
  // ladder is found, not made, and Scavenged Dreams is found too. Bram joins, he does not upgrade.
  if(mat.id==='riftseed'){
    if(item.t!==SD_T) return {ok:false, why:'The Riftseed only takes a '+TIER_NAMES[SD_T]+' piece.'};
    if(matCount('riftseed')<1) return {ok:false, why:'You have no Riftseed.'};
    const sets=forgeSetsFor(item.k);
    if(!sets.length) return {ok:false, why:'No set has a piece for that slot.'};
    const pick=o.set||null;
    if(!pick) return {ok:false, why:'Choose which set to forge it into.', needSet:sets};
    const chosen=sets.filter(s=>s.set.id===pick)[0];
    if(!chosen) return {ok:false, why:'That set has no piece for this slot.', needSet:sets};
    if(chosen.owned) return {ok:false, why:'You already carry that relic.', needSet:sets};
    return {ok:true, kind:'relic', cost:{riftseed:1}, relic:chosen.piece.id,
            label:'★ '+chosen.piece.n, why:'', needSet:sets};
  }
  return {ok:false, why:'That reagent does nothing to a piece of gear.'};
}

// The only function in this file that takes anything away from anybody.
function forgeDo(A,B,opts){
  const plan=forgePlan(A,B,opts);
  if(!plan.ok) return {ok:false, why:plan.why};
  const ch=(typeof curChar==='function')?curChar():null;

  if(plan.kind==='mat'){
    if(!matSpend(plan.cost)) return {ok:false, why:'The pouch came up short.'};
    matAdd(plan.out, plan.n);
    if(typeof msg==='function') msg('FORGED', MATERIALS[plan.out].n);
    return {ok:true, kind:'mat', out:plan.out};
  }

  // the gear rung consumes the reagent and REPLACES the piece in place, so nothing has to find a
  // free satchel slot and a full satchel can never eat the result
  const slot = (A.kind==='item')?A:B;
  const idx = slot.i;
  if(!ch||!ch.inv||!ch.inv[idx]) return {ok:false, why:'That piece is no longer in your satchel.'};
  if(!matSpend(plan.cost)) return {ok:false, why:'The pouch came up short.'};

  // the Scavenged Dreams piece is consumed and a relic takes its place in the same satchel slot
  const rel=(typeof mkRelicItem==='function')?mkRelicItem(plan.relic, ch.cls):null;
  if(!rel){ matAdd('riftseed',1); return {ok:false, why:'That relic could not be shaped.'}; }
  ch.inv[idx]=rel;
  if(typeof noteRelicTaken==='function') noteRelicTaken(plan.relic);
  if(typeof saveRPG==='function') saveRPG();
  if(typeof msg==='function') msg('RIFTFORGED', (typeof relicDef==='function'&&relicDef(plan.relic))?relicDef(plan.relic).n:'a relic');
  return {ok:true, kind:'relic', item:rel};
}

// ------------------------------------------------------------
// FORGING IS A PLACE, exactly like fusion is a place (15_pets.js).
// ------------------------------------------------------------
// The panel opens from the prompt at the stall and refuses to work anywhere else, so a player who
// reaches it through some other route still cannot craft from the middle of a dungeon.
//
// THIS DELIBERATELY HAS NO "I OPENED IT HERE" LATCH. A remembered flag is exactly the bug that made
// the pet panel render a station body with the tab strip suppressed for the rest of the session
// (fixed in f9e13e2) -- a latch outlives the condition it was set for. `curShopNear` is the live
// answer: 07_update sets it to the nearest stall's id and nulls it the moment you step away, and
// that same transition already calls closeVendorPanels(). So the panel cannot be open and stale.
function atForge(){
  if(typeof curShopNear!=='undefined' && curShopNear==='bram') return true;
  return !!(typeof portalPrompt!=='undefined' && portalPrompt && portalPrompt.kind==='vendor'
     && portalPrompt.np && portalPrompt.np.id==='bram');
}

// ------------------------------------------------------------
// SAVE MIGRATION — relics moved from index 12 to index 13
// ------------------------------------------------------------
// Anything carrying `relic` was built at the old RELIC_T and must move with the band, or it reads
// as an Emberforged and prices, colours and sorts as one. Runs over every character's satchel, the
// account Vault and the equipped-affix record. Idempotent: an already-migrated relic is at
// RELIC_T and is skipped, so running it twice costs nothing.
function migrateForgeTiers(){
  if(typeof users==='undefined'||!users) return 0;
  let n=0;
  const fix=(it)=>{ if(it && it.relic && it.t!==RELIC_T){ it.t=RELIC_T; n++; } };
  for(const name in users){ const u=users[name]; if(!u) continue;
    if(Array.isArray(u.chars)) for(const c of u.chars){ if(c&&Array.isArray(c.inv)) c.inv.forEach(fix); }
    if(Array.isArray(u.vault)) u.vault.forEach(fix);
  }
  if(n && typeof LS!=='undefined') LS.set('er-users',users);
  return n;
}
if(typeof window!=='undefined') setTimeout(function(){ try{ migrateForgeTiers(); }catch(e){} },0);

// ============================================================
//  THE PANEL
// ------------------------------------------------------------
//  Reuses the vault's shopCard/shopInner shell the way the Stable does, so it inherits the frame
//  fit that was already measured against equip_panel.png's percentage inset (16.5% top / 18%
//  bottom / ~16% sides) instead of re-earning it at every viewport. Nothing here declares a card.
//
//  ONE STRIP PER SOURCE, and both feed the same two slots: the POUCH (materials, account-level)
//  and the ANVIL-READY half of your satchel (only T12 and T13 gear, because nothing else is an
//  input to anything). Filtering the satchel down to what the machine accepts is the difference
//  between a panel you read and a panel you scroll.
// ============================================================
let _forgeA=null, _forgeB=null, _forgeSet=null, _forgeWired=false;

function openForge(){
  _forgeA=null; _forgeB=null; _forgeSet=null;
  const el=document.getElementById('forgeScr'); if(!el) return;
  el.style.display='flex';
  paintForge();
}
// Clearing the slots on the way out matters more than it looks: a slot holds a SATCHEL INDEX, and
// an index that survives the panel would point at whatever slid into that position next.
function closeForge(){ const el=document.getElementById('forgeScr'); if(el) el.style.display='none';
  _forgeA=null; _forgeB=null; _forgeSet=null; }

// Which satchel rows the anvil will even look at: Scavenged Dreams pieces and nothing else, because
// that is the only gear the forge has any use for. Everything else is noise in a list you are
// trying to pick one specific piece out of.
function _forgeInvRows(){
  const ch=(typeof curChar==='function')?curChar():null;
  const inv=(ch&&ch.inv)?ch.inv:[]; const out=[];
  for(let i=0;i<inv.length;i++){ const it=inv[i];
    if(!it||it.relic) continue;
    if(it.k!=='wpn'&&it.k!=='arm'&&it.k!=='helm'&&it.k!=='ring') continue;
    if(it.t!==SD_T) continue;
    out.push({i:i, it:it}); }
  return out;
}
function _slotSame(s,t){ if(!s||!t) return false;
  if(s.kind!==t.kind) return false;
  return s.kind==='mat' ? s.id===t.id : s.i===t.i; }
// Clicking a chip fills the first empty slot, or clears it if it is already in one.
function _forgePick(slot){
  if(_slotSame(_forgeA,slot)){ _forgeA=null; return; }
  if(_slotSame(_forgeB,slot)){ _forgeB=null; return; }
  if(!_forgeA) _forgeA=slot; else if(!_forgeB) _forgeB=slot; else _forgeB=slot;
  _forgeSet=null;                      // a new pair invalidates the set choice
}
function _forgeSlotHtml(s,which){
  if(!s) return '<div class="fgSlot empty" data-clear="'+which+'"><span class="fgDim">empty</span></div>';
  if(s.kind==='mat'){ const d=MATERIALS[s.id];
    return '<div class="fgSlot" data-clear="'+which+'" style="border-color:'+d.col+'">'
      +'<span class="fgIco" style="color:'+d.col+'">'+d.icon+'</span>'
      +'<b style="color:'+d.col+'">'+d.n+'</b></div>'; }
  const it=_slotItem(s); if(!it) return '<div class="fgSlot empty" data-clear="'+which+'"><span class="fgDim">gone</span></div>';
  const col=(typeof tierCol==='function')?tierCol(it.t):'#fff';
  return '<div class="fgSlot" data-clear="'+which+'" style="border-color:'+col+'">'
    +'<span class="fgIco" style="color:'+col+'">'+tierTag(it.t)+'</span>'
    +'<b style="color:'+col+'">'+((typeof itemName==='function')?itemName(it):it.k)+'</b></div>';
}

function paintForge(){
  const scr=document.getElementById('forgeScr'); if(!scr||scr.style.display==='none') return;
  const body=document.getElementById('forgeBody'); if(!body) return;

  if(!atForge()){
    body.innerHTML='<div class="embEmpty">The forge is cold.<br><span class="embDim">'
      +'Bram works at his stall in the Hearth — walk to it and interact.</span></div>';
    return; }

  const plan=forgePlan(_forgeA,_forgeB,{set:_forgeSet});
  let h='';

  // ---- the anvil ----
  h+='<div class="fgAnvil">'+_forgeSlotHtml(_forgeA,'a')
    +'<span class="fgPlus">+</span>'+_forgeSlotHtml(_forgeB,'b')
    +'<span class="fgPlus">=</span>'
    +'<div class="fgOut'+(plan.ok?' on':'')+'">'+(plan.ok?plan.label:'<span class="fgDim">—</span>')+'</div>'
    +'</div>';
  h+='<div class="fgWhy'+(plan.ok?' ok':'')+'">'+(plan.ok?'Bram takes both and sets to work.':plan.why)+'</div>';

  // ---- the set chooser, only when rung 3 is otherwise ready ----
  if(plan.needSet && plan.needSet.length){
    h+='<div class="embSect">FORGE IT INTO</div><div class="fgSets">';
    for(const s of plan.needSet){
      h+='<div class="fgSet'+(_forgeSet===s.set.id?' on':'')+(s.owned?' owned':'')+'" data-set="'+s.set.id+'">'
        +'<b>'+s.set.n+'</b>'
        +'<span class="fgDim">'+(s.owned?'already carried':s.piece.n)+'</span></div>'; }
    h+='</div>'; }

  // ---- the pouch ----
  const held=matHeld();
  h+='<div class="embSect">THE POUCH <span class="embDim">— '+matTotal()+' held, and they survive you</span></div>';
  if(!held.length) h+='<div class="embEmpty">Nothing yet. <span class="embDim">Materials drop in the gear sack — the starter island pays the first three.</span></div>';
  else { h+='<div class="fgStrip">';
    for(const m of held){
      const sel=_slotSame(_forgeA,{kind:'mat',id:m.def.id})||_slotSame(_forgeB,{kind:'mat',id:m.def.id});
      h+='<div class="fgChip'+(sel?' on':'')+'" data-mat="'+m.def.id+'" title="'+m.def.d+'" style="border-color:'+m.def.col+'">'
        +'<span class="fgIco" style="color:'+m.def.col+'">'+m.def.icon+'</span>'
        +'<b style="color:'+m.def.col+'">'+m.def.n+'</b><span class="fgN">x'+m.n+'</span></div>'; }
    h+='</div>'; }

  // ---- the satchel, filtered to what the anvil accepts ----
  const rows=_forgeInvRows();
  h+='<div class="embSect">ON THE ANVIL <span class="embDim">— '+TIER_NAMES[SD_T]+' pieces only</span></div>';
  if(!rows.length) h+='<div class="embEmpty">Nothing in your satchel is ready for the forge.'
    +'<br><span class="embDim">'+TIER_NAMES[SD_T]+' gear drops in the highest-level areas and the ascended dream dungeons.</span></div>';
  else { h+='<div class="fgStrip">';
    for(const r of rows){ const col=(typeof tierCol==='function')?tierCol(r.it.t):'#fff';
      const sel=_slotSame(_forgeA,{kind:'item',i:r.i})||_slotSame(_forgeB,{kind:'item',i:r.i});
      h+='<div class="fgChip'+(sel?' on':'')+'" data-inv="'+r.i+'" style="border-color:'+col+'">'
        +'<span class="fgIco" style="color:'+col+'">'+tierTag(r.it.t)+'</span>'
        +'<b style="color:'+col+'">'+((typeof itemName==='function')?itemName(r.it):r.it.k)+'</b></div>'; }
    h+='</div>'; }

  // ---- what the tree looks like. A crafting system nobody can see the shape of is a wiki tab. ----
  h+='<div class="embSect">WHAT JOINS WITH WHAT</div><div class="fgBook">';
  for(const k in MAT_RECIPES){ const r=MAT_RECIPES[k];
    const A=MATERIALS[r.a], B=MATERIALS[r.b], O=MATERIALS[r.out];
    const can=matCount(r.a)>0&&matCount(r.b)>0;
    h+='<div class="fgRec'+(can?' can':'')+'">'
      +'<span style="color:'+A.col+'">'+A.n+'</span> + <span style="color:'+B.col+'">'+B.n+'</span>'
      +' <span class="fgDim">→</span> <b style="color:'+O.col+'">'+O.n+'</b></div>'; }
  h+='<div class="fgRec"><span style="color:'+((typeof tierCol==='function')?tierCol(SD_T):'#fff')+'">'+TIER_NAMES[SD_T]+' piece</span>'
    +' + <span style="color:'+MATERIALS.riftseed.col+'">Riftseed</span>'
    +' <span class="fgDim">→</span> <b style="color:'+((typeof tierCol==='function')?tierCol(RELIC_T):'#fff')+'">★ a relic, T'+(RELIC_T+1)+'</b></div>';
  h+='</div>';
  h+='<div class="embNote">Bram joins things; he does not improve them. The ladder up to '
    +TIER_NAMES[SD_T]+' is <b>found</b>, never made — and '+TIER_NAMES[SD_T]+' only falls in the '
    +'highest-level areas and the ascended dream dungeons.</div>';

  body.innerHTML=h;

  const go=document.getElementById('forgeGo');
  if(go){ go.disabled=!plan.ok; go.classList.toggle('go',!!plan.ok); }

  // Delegated and wired ONCE. innerHTML is rebuilt on every repaint, so per-node handlers would be
  // orphaned every time -- the same trap hudBoosts documents.
  if(!_forgeWired){
    body.addEventListener('click',function(ev){
      const t=ev.target.closest?ev.target.closest('[data-mat],[data-inv],[data-set],[data-clear]'):null;
      if(!t) return;
      if(t.hasAttribute('data-clear')){ if(t.getAttribute('data-clear')==='a') _forgeA=null; else _forgeB=null; }
      else if(t.hasAttribute('data-mat')) _forgePick({kind:'mat', id:t.getAttribute('data-mat')});
      else if(t.hasAttribute('data-inv')) _forgePick({kind:'item', i:+t.getAttribute('data-inv')});
      else if(t.hasAttribute('data-set')) _forgeSet=t.getAttribute('data-set');
      paintForge(); });
    _forgeWired=true; }
}

if(typeof document!=='undefined'){
  const _fc=document.getElementById('forgeClose');
  if(_fc) _fc.addEventListener('click',closeForge);
  const _fg=document.getElementById('forgeGo');
  if(_fg) _fg.addEventListener('click',function(){
    const r=forgeDo(_forgeA,_forgeB,{set:_forgeSet});
    if(r.ok){ _forgeA=null; _forgeB=null; _forgeSet=null;
      navigator.vibrate&&navigator.vibrate(20);
      if(typeof paintInv==='function') paintInv();
      if(typeof recalcStats==='function') recalcStats();
      if(typeof hudRPG==='function') hudRPG(); }
    else navigator.vibrate&&navigator.vibrate(20);
    paintForge(); });
}
