// ============================================================
//  BOOST DRAUGHTS (17l_boosts.js)
// ------------------------------------------------------------
//  Three timed consumables (user, 2026-07-28):
//    PROSPECTOR'S  a better chance at a RARE item   (rarity, not tier)
//    HOARDER'S     a chance at DUPLICATED loot      (the same drop, twice)
//    SCHOLAR'S     2x XP
//
//  The two loot draughts pull different levers on purpose, and neither is "more sacks":
//  Prospector's re-rolls RARITY and keeps the better result, so what you find is better without
//  any more of it appearing. Hoarder's leaves the roll alone and copies what came out. One makes a
//  sack worth opening; the other makes it fuller.
//
//  RARITY, NOT TIER. rollRarity() is the 0-5 Common..Mythical ladder and is completely separate
//  from the tier band, which is decided by where you are farming (zoneTierRow) and must stay that
//  way — a potion that raised your TIER would let you drink your way into gear the zone does not
//  owe you, which is the one thing the loot tables are built to prevent.
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
const BOOST_MUL = 2;               // the XP multiplier

// RARITY RE-ROLL. Prospector's rolls rollRarity twice and keeps the better result. Chosen over
// nudging the exponent or moving the cutoffs because it cannot break the ladder: the order stays
// intact, Mythical stays the rarest slice, and nothing can overflow past it. The real-world effect
// on "chance of Rare or better" is measured in QA rather than asserted here — an extra roll is
// worth less than a flat doubling, and the honest number is the one worth writing down.
const BOOST_RARE_ROLLS = 2;
// DUPLICATION. Deliberately RARE, and rare by construction rather than by picking a small number:
// an item duplicates only if BOOST_DUPE_ROLLS independent rolls ALL pass. Three at 0.40 is 6.4%,
// so a duplicate is a moment rather than a rhythm, and the two dials move it very differently —
// the probability tunes gently, the roll count tunes steeply. That is the point: a single 6.4%
// constant would be one number nobody could reason about, whereas "it has to come up three times"
// is a rule you can hold in your head.
const BOOST_DUPE_ROLLS = 3;
const BOOST_DUPE_P = 0.40;
// FORTUNE DOES NOT TOUCH THIS (user, 2026-07-28). Fortune Coins raise your chance at a RARE item
// and nothing else — they feed rollRarity's exponent, where they always have, and the Prospector's
// Draught compounds with them there. Duplication is deliberately the one roll in the game Fortune
// cannot buy: it is a flat, knowable 6.4% that a player with a hoard of coins and a player with
// none experience identically, which is what keeps "how much loot" and "how good the loot" as two
// separate axes instead of one stat quietly owning both.
function _dupeHit(){
  for(let i=0;i<BOOST_DUPE_ROLLS;i++) if(Math.random()>=BOOST_DUPE_P) return false;
  return true; }

const BOOSTS = {
  dupe: {id:'dupe', name:"Hoarder's Draught",    icon:'🪙', col:'#e8b34b',
         spr:'boost_loot', desc:'half your drops come doubled, 15 minutes'},
  rare: {id:'rare', name:"Prospector's Draught", icon:'🍀', col:'#5cbf4a',
         spr:'boost_fort', desc:'a better chance at rare items, 15 minutes'},
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

// ---- the three hooks the rest of the game reads ----
function boostXpMul(){ return boostMul('xp'); }

// How many times rollRarity should roll and keep the best. 1 normally, BOOST_RARE_ROLLS while a
// Prospector's is running.
function boostRareRolls(){ return boostActive('rare') ? BOOST_RARE_ROLLS : 1; }

// Duplicate the qualifying items of a freshly rolled sack. Returns a NEW array; the caller swaps
// it in. Called once per sack rather than per item so the whole rule lives in one place.
//
// RELICS AND ONE-OFFS ARE NEVER DUPLICATED. A relic already carries its own duplicate rule and a
// record of what you have found, so a second copy is thrown away on pickup anyway — copying it
// would look like a jackpot and pay nothing. Coins are excluded for the same reason a loot potion
// does not improve its own drop rate: Fortune Coins raise every future roll, and a draught that
// minted them would compound into itself.
function boostDupeItems(items){
  if(!items || !items.length || !boostActive('dupe')) return items;
  const out=[];
  for(const it of items){
    out.push(it);
    if(!it || it.relic || it.k==='leg' || it.k==='coin' || it.k==='boost') continue;
    if(_dupeHit()){
      // a shallow copy is right: affixes are already rolled, and a duplicate should be the SAME
      // item, not a second roll of one. Cloning the affix array keeps the two from sharing state.
      const c=Object.assign({},it);
      if(Array.isArray(it.aff)) c.aff=it.aff.map(a=>({s:a.s,v:a.v}));
      out.push(c); } }
  return out; }

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
