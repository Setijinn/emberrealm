// ============================================================
//  BOOST DRAUGHTS (17l_boosts.js)
// ------------------------------------------------------------
//  Three timed 2x consumables (user, 2026-07-28):
//    HOARDER'S    2x how OFTEN loot drops   (quantity — more sacks)
//    PROSPECTOR'S 2x FORTUNE                (quality — better tiers inside a sack)
//    SCHOLAR'S    2x XP
//
//  "2x loot drop" and "2x loot rate" were asked for as two separate potions, and the two useful
//  meanings of that are QUANTITY and QUALITY — so that is how they are split. Loot in this game
//  already has exactly those two dials: the drop chance in rollPublicLoot/rollSoulbound decides
//  whether a sack appears at all, and Fortune decides how good what is inside it is. If the intent
//  was two quantity potions instead, BOOSTS.fort is the one row to change.
//
//  THEY DROP; THEY ARE NOT SOLD. Glory must never buy power, and a draught that doubles your XP
//  or your loot is power however you frame it. They ride in the ordinary gear sack, which keeps
//  the one-sack-per-kill rule intact and means Fortune improves your odds of finding them.
//
//  THE CLOCK IS WALL-TIME, like incubation, not frame time. A boost you drank and then walked away
//  from should expire while you were gone — a timer that only advances while the tab is focused
//  would let a player pause the game to preserve a buff, which is the kind of thing nobody should
//  have to think about. Date.now() is the same source petStore's incubation already trusts.
//
//  STOCK LIVES ON THE CHARACTER, not the account. These are carried consumables, so permadeath
//  takes them exactly like it takes the satchel — unlike pets, mounts and the Vault, which are
//  deliberately account-level and deliberately survive.
// ============================================================

const BOOST_DUR = 15*60*1000;      // 15 real minutes per draught
const BOOST_MUL = 2;               // the "2x" in every name. One dial for all three.

const BOOSTS = {
  loot: {id:'loot', name:"Hoarder's Draught",    icon:'🪙', col:'#e8b34b',
         spr:'boost_loot', desc:'2x loot drops for 15 minutes'},
  fort: {id:'fort', name:"Prospector's Draught", icon:'🍀', col:'#5cbf4a',
         spr:'boost_fort', desc:'2x fortune for 15 minutes'},
  xp:   {id:'xp',   name:"Scholar's Draught",    icon:'✦',  col:'#c07add',
         spr:'boost_xp',   desc:'2x experience for 15 minutes'},
};
const BOOST_KEYS = Object.keys(BOOSTS);
function boostDef(id){ return BOOSTS[id]||null; }

// ---- storage on the CHARACTER ----
// `have` is how many are in the satchel; `until` is a wall-clock ms deadline per kind.
function boostStore(){ if(typeof rpg==='undefined'||!rpg) return null;
  if(!rpg.boost) rpg.boost={};
  if(!rpg.boost.have) rpg.boost.have={};
  if(!rpg.boost.until) rpg.boost.until={};
  for(const k of BOOST_KEYS){
    if(rpg.boost.have[k]===undefined) rpg.boost.have[k]=0;
    if(rpg.boost.until[k]===undefined) rpg.boost.until[k]=0; }
  return rpg.boost; }

function boostCount(id){ const b=boostStore(); return b?(b.have[id]|0):0; }
function boostActive(id){ const b=boostStore(); if(!b) return false;
  return (b.until[id]||0) > Date.now(); }
function boostLeft(id){ const b=boostStore(); if(!b) return 0;
  return Math.max(0, (b.until[id]||0) - Date.now()); }
// The multiplier a system should apply. Always safe to call — 1 when nothing is running.
function boostMul(id){ return boostActive(id) ? BOOST_MUL : 1; }

// The three the rest of the game actually reads.
function boostLootMul(){ return boostMul('loot'); }   // how often a sack drops
function boostFortMul(){ return boostMul('fort'); }   // how good what is inside it is
function boostXpMul(){   return boostMul('xp');   }   // experience

// ---- picking one up ----
function boostGive(id,n){ const b=boostStore(), d=boostDef(id); if(!b||!d) return false;
  b.have[id]=(b.have[id]|0)+(n||1);
  if(typeof saveRPG==='function') saveRPG();
  return true; }

// ---- drinking one ----
// EXTENDS rather than replaces. Drinking a second while one is running should not throw away the
// time you already had — that is a punishment for using the thing you found, and nobody reads the
// timer closely enough to avoid it.
function boostDrink(id){
  const b=boostStore(), d=boostDef(id); if(!b||!d) return false;
  if((b.have[id]|0)<=0) return false;
  b.have[id]--;
  const now=Date.now();
  const base=Math.max(now, b.until[id]||0);
  b.until[id]=base+BOOST_DUR;
  if(typeof msg==='function') msg(d.name.toUpperCase(), d.desc);
  if(typeof texts!=='undefined'&&typeof player!=='undefined')
    texts.push({x:player.x,y:player.y-36,txt:d.icon+' 2x',col:d.col,life:1.3});
  if(typeof saveRPG==='function') saveRPG();
  if(typeof hudBoosts==='function') hudBoosts();
  return true; }

// ---- drops ----
// Deliberately uncommon and boss-weighted. These compound with everything else you are doing, so
// a common one would quietly become the baseline rather than a good day.
const BOOST_DROP_P = {B:0.075, s:0.010, c:0.007, N:0.007};
function boostDropFor(e){
  if(!e || e.node) return null;
  let p=BOOST_DROP_P[e.type]||BOOST_DROP_P.c;
  if(e.elite) p*=3;
  // Fortune finds them, like everything else in a sack. NOT boostLootMul — a loot draught that
  // improved the odds of finding more loot draughts is a feedback loop, and the one rule this
  // economy has kept is that nothing mints its own supply.
  const F=(typeof player!=='undefined'&&player.fortune)||0;
  p*=(1+F*0.012);
  if(Math.random()>=p) return null;
  const id=BOOST_KEYS[Math.floor(Math.random()*BOOST_KEYS.length)];
  return {k:'boost', bt:id}; }

// ---- the HUD strip. ONE element does both jobs: what you are holding (tap to drink) and what is
// running (with the clock). Two separate widgets for three consumables would be more chrome than
// the feature is worth, and the states are mutually informative — you want to see "2 left" right
// next to "4:12 remaining" when deciding whether to drink another. ----
let _boostWired=0;
function hudBoosts(){
  if(typeof document==='undefined') return;
  const b=boostStore(); if(!b) return;
  const shown=BOOST_KEYS.filter(k=>boostActive(k)||(b.have[k]|0)>0);
  let el=document.getElementById('boostStrip');
  if(!el){
    if(!shown.length) return;                       // nothing to say yet: do not build the node
    el=document.createElement('div'); el.id='boostStrip';
    (document.getElementById('hudTop')||document.body).appendChild(el);
    // delegated, and wired ONCE — rebuilding innerHTML every frame would orphan per-node handlers
    el.addEventListener('click',function(ev){
      const c=ev.target.closest?ev.target.closest('.boostChip'):null;
      if(c&&c.getAttribute('data-b')) boostDrink(c.getAttribute('data-b')); });
    _boostWired=1; }
  if(!shown.length){ el.style.display='none'; return; }
  el.style.display='flex';
  const html=shown.map(function(k){
    const d=BOOSTS[k], on=boostActive(k), n=b.have[k]|0;
    let right;
    if(on){ const s=Math.ceil(boostLeft(k)/1000);
      right='<b>'+Math.floor(s/60)+':'+('0'+(s%60)).slice(-2)+'</b>'; }
    else right='<b>x'+n+'</b>';
    return '<span class="boostChip'+(on?' on':'')+(n>0?' has':'')+'" data-b="'+k+'"'
      +' title="'+d.name+' — '+d.desc+(n>0?' · tap to drink ('+n+' held)':'')+'"'
      +' style="color:'+d.col+'">'+d.icon+' '+right+'</span>'; }).join('');
  if(el._html!==html){ el.innerHTML=html; el._html=html; }   // only touch the DOM when it changed
}

// refreshed on the same tick everything else is; cheap, and the countdown has to move on its own
function tickBoosts(){ if(typeof hudBoosts==='function') hudBoosts(); }
