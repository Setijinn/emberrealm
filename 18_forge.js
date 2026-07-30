// ============================================================
//  THE FORGE (18_forge.js) — Bram's stall, finally lit
// ------------------------------------------------------------
//  THE MACHINE TAKES EXACTLY TWO THINGS (user, 2026-07-28). Every rung of the whole arc is the
//  same gesture — put two things on the anvil, get one back — from joining two scraps off the
//  starter island to turning a T13 into a relic. That is the entire interface, and it is why there
//  is one panel instead of a workbench with tabs: a player who has used the Fusion Altar already
//  knows how this works.
//
//  THE LADDER ABOVE T12, AND WHERE EACH RUNG COMES FROM (user, 2026-07-29).
//    T1-T12               found anywhere the zone tables say so
//    RIFTFORGED           the relics. DROPPED, in the six ascended dungeons at their own rates.
//    SCAVENGED DREAMS     the pinnacle, and CRAFTED ONLY. Nothing in the game drops it. Written
//                         "SD" — it is named for what it is, carried out of a dead god's dream,
//                         and a number would say nothing.
//
//  SD AND RIFTFORGED HAVE SWAPPED, and this pair has now moved twice. The first change inserted SD
//  underneath the relics as a dropped rung; the user has since made SD the crafted top and the relic
//  the drop that feeds it. So the forge's gear rung runs the other way: a RELIC plus its own
//  dungeon's Riftseed is raised into Scavenged Dreams.
//
//  THE OLD "BRAM JOINS THINGS, HE DOES NOT IMPROVE THEM" RULE IS RETIRED, deliberately and by the
//  user's decision, and it is retired here rather than left standing next to code that contradicts
//  it. The forge now moves a piece up the ladder. What survives of the rule is the part that still
//  matters: the ORDINARY ladder, T1-T12, is still found and never made.
//
//  RAISING A RELIC KEEPS ITS SET. The SD piece carries the same `relic` id, the same exclusive affix
//  and the same trait, and only its tier moves -- otherwise a finished four-piece set would beat four
//  of the best items in the game and the top rung would be a trap.
//
//  WHY NEITHER TOP RUNG CAN LEAK INTO A DROP TABLE. mkItem() clamps t to MAXT-1, which is the top of
//  the ORDINARY ladder (T12) now that MAXT is back to 12 — so no weighted roll, overflow tail, chest
//  or auction row can reach index 12 or 13. The only things that build one are mkRelicItem (at the
//  per-dungeon relic rate), forgeDo, and mkTopItem for the workbench. The integrity check asserts it.
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
  // ---- THE NINE ASCENDED BOSSES, one signature material each (user, 2026-07-28) ----
  // `ring` is the boss id, and it is the whole link: matDropFor pays the material belonging to the
  // boss you actually killed, so a reagent is a record of which door you got through. This is the
  // content gate for the T14 rung and it is not a new mechanism -- those dungeons already refuse
  // to open without an ascension (11_ui.js reads gate:'none'), so gating the material on the boss
  // gates the relic on the ascension for free.
  //
  // The first three depths have no relic sets of their own, so their materials chain into the
  // UNIVERSAL half of a seed. The remaining six each host two sets, and their material makes the
  // seed that forges those two and nothing else.
  anchorroot:{id:'anchorroot',n:'Anchorroot', tier:3, src:'rift', ring:0, col:'#4f9a3f', icon:'⊕',
            d:'a knot of the lattice that held the door open'},
  veilshard:{id:'veilshard', n:'Veilshard',   tier:3, src:'rift', ring:1, col:'#6aae7a', icon:'◈',
            d:'a piece of the parted veil, and it casts no shadow'},
  wallrot:  {id:'wallrot',   n:'Wallrot',     tier:3, src:'rift', ring:2, col:'#5a7a3a', icon:'◍',
            d:'the reagent that ate through the wall between worlds'},
  gatestone:{id:'gatestone', n:'Gatestone',   tier:3, src:'rift', ring:3, col:'#8a8f88', icon:'⬛',
            d:'a chip off what was set against the door'},
  pinion:   {id:'pinion',    n:"Herald's Pinion",tier:3,src:'rift',ring:4, col:'#9aa0a8', icon:'⩗',
            d:'it never once landed, and this never once touched ground'},
  clinker:  {id:'clinker',   n:'Furnace Clinker',tier:3,src:'rift',ring:5, col:'#c85a2a', icon:'⬢',
            d:'slag from a furnace a whole world was spent to light'},
  rememberash:{id:'rememberash',n:'Rememberash',tier:3,src:'rift',ring:6, col:'#8a857e', icon:'⁂',
            d:'ash that still knows the shape of what it was'},
  firstcinder:{id:'firstcinder',n:'First Cinder',tier:3,src:'rift',ring:7, col:'#d4522a', icon:'✸',
            d:'it was first, and it taught the others the way'},
  titanheart:{id:'titanheart',n:'Titanheart',  tier:3, src:'rift', ring:8, col:'#ff7a3d', icon:'✦',
            d:'the order was given here, and it is still warm'},
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
  // The last thing the ORDINARY tree can make. Everything below it exists to reach this, and this
  // exists to be handed to the rift chain.
  forgeheart:{id:'forgeheart',n:'Forgeheart',tier:3, src:'craft',   col:'#ff6a3d', icon:'❤',
            d:'the forge keeps one of these banked, and Bram will not say how'},
  // ---- the rift chain: the universal half of a seed, built from the first three depths ----
  riftcore: {id:'riftcore',  n:'Riftcore',    tier:4, src:'craft',   col:'#a06ad0', icon:'◉',
            d:'a forgeheart with the anchor grown back through it'},
  riftbloom:{id:'riftbloom', n:'Riftbloom',   tier:4, src:'craft',   col:'#b47ae0', icon:'❈',
            d:'it opens when nothing is looking at it'},
  riftheart:{id:'riftheart', n:'Riftheart',   tier:4, src:'craft',   col:'#c98af0', icon:'♥',
            d:'the half of a seed that every door has in common'},
};

// ---- THE SIX RIFTSEEDS, one per relic-hosting dungeon ----
// Generated rather than typed, because a seed is entirely determined by the boss it belongs to:
// its name, its colour and the sets it can forge all come off GBOSS and RELIC_SETS. Typing six
// near-identical rows is how the two lists drift apart.
//
// A SEED DECIDES WHICH SETS IT CAN BECOME. That is the point of tying materials to bosses at all:
// you no longer pick any of the twelve sets off a list, you go and kill the thing that owns the
// one you want. It is the same rule the relic DROP already follows -- six dungeons, two sets each
// -- so crafting and finding finally answer to the same map.
const SEED_PREFIX='seed_';
function seedIdFor(ring){ return SEED_PREFIX+ring; }
function seedRing(id){ return (id&&id.indexOf(SEED_PREFIX)===0) ? (parseInt(id.slice(SEED_PREFIX.length),10)) : -1; }
function isSeed(id){ const r=seedRing(id); return r>=0 && !!MATERIALS[id]; }
(function _buildSeeds(){
  if(typeof RELIC_SETS==='undefined'||typeof GBOSS==='undefined') return;
  const rings=[]; for(const S of RELIC_SETS) if(rings.indexOf(S.ring)<0) rings.push(S.ring);
  rings.sort((a,b)=>a-b);
  for(const ring of rings){
    const gb=GBOSS[ring]; if(!gb) continue;
    MATERIALS[seedIdFor(ring)]={
      id:seedIdFor(ring), n:'Riftseed of '+String(gb.dn||gb.n).replace(/^The /,''),
      tier:5, src:'craft', ring:ring, col:gb.col||'#ffd24a', icon:'✧', seed:true,
      d:'hold it and something behind '+(gb.dn||gb.n)+' notices'};
  }
})();
// Read AFTER the seed builder above has run, or the six generated seeds are missing from every
// list, pool and integrity sweep that walks this. (They were, briefly.)
const MAT_KEYS = Object.keys(MATERIALS);
function matDef(id){ return MATERIALS[id]||null; }
// the material a given ascended boss pays, and the reverse
function matForRing(ring){ for(const k in MATERIALS){ const m=MATERIALS[k];
  if(m.src==='rift' && m.ring===ring) return m; } return null; }

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

// ---- THE RIFT CHAIN. Everything below here needs an ascension, because every rung consumes a
// material that only an ascended boss drops. ----
// The first three depths host no relic sets of their own -- RELIC_SETS starts at ring 3 -- so
// rather than leaving their drops as flavour, they build the half of a seed that every door has in
// common. It also means the awakened depths are walked in order: you cannot skip to the Core
// Sanctum's seed without having been through the Heartwood Hollow.
_recipe('forgeheart','anchorroot','riftcore');    // ring 0, the Grovewarden
_recipe('riftcore','veilshard',   'riftbloom');   // ring 1, the Mistantler
_recipe('riftbloom','wallrot',    'riftheart');   // ring 2, the Bog Horror

// ---- THE SIX SEEDS. Riftheart plus a relic dungeon's own signature. ----
// Generated from the same list the seeds themselves were, so a seventh relic dungeon would grow
// its material, its seed and its recipe without anyone editing three places and missing one.
(function _buildSeedRecipes(){
  for(const k in MATERIALS){ const m=MATERIALS[k];
    if(!m.seed) continue;
    const sig=matForRing(m.ring);
    if(sig) _recipe('riftheart', sig.id, m.id);
  }
})();

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
  // A post-ascension dungeon boss is the only source of a rift reagent. `gate` on the boss is the
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
// A RIFT DROP IS NOT DRAWN FROM A POOL -- it is the material belonging to the boss you just killed.
// That is the whole link between the ascended bosses and the crafting tree: a reagent in your pouch
// is a record of which door you got through, and the seed it eventually becomes can only forge the
// relics of the dungeon it came out of. A pool would have made every ascended boss interchangeable,
// which is exactly what the relic drop tables already refuse to do.
function riftMatForKill(e){
  if(typeof curRoom==='undefined'||!curRoom||!curRoom.dungeon) return null;
  if(typeof curRoom.ring!=='number') return null;
  return matForRing(curRoom.ring);
}
// Returns a loot item {k:'mat', m:id, n:count} or null. Pushed into rollLoot's `extra`, so it lands
// in the ordinary gear sack.
function matDropFor(e){
  if(!e || e.node) return null;
  let p=MAT_DROP_P[e.type]!==undefined?MAT_DROP_P[e.type]:MAT_DROP_P.c;
  if(e.elite) p*=2.2;
  const F=(typeof player!=='undefined'&&player.fortune)||0;
  p*=(1+F*0.012);
  if(Math.random()>=p) return null;
  const src=matPoolFor(e);
  let id=null;
  if(src==='rift'){
    const m=riftMatForKill(e); if(!m) return null;
    id=m.id;
  } else {
    const pool=matPool(src);
    if(!pool.length) return null;
    id=pool[Math.floor(Math.random()*pool.length)];
  }
  // A boss pays a small stack; everything else pays one. A RIFT REAGENT NEVER STACKS -- it is the
  // one kind whose count is meant to be countable, and one per clear is what makes the awakened
  // depths worth re-entering rather than worth farming once.
  const n=(src==='rift') ? 1 : (e.type==='B' ? 2+Math.floor(Math.random()*3) : 1);
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
// The sets a given SEED can forge into, for a given slot. A seed belongs to one dungeon and a
// dungeon hosts two sets, so this is a choice between two -- not a menu of twelve. Which two is
// decided by which boss you killed to get the reagent, which is the whole point of tying the
// materials to the bosses.
function forgeSetsFor(slot, ring){
  if(typeof RELIC_SETS==='undefined') return [];
  return RELIC_SETS.filter(S=>ring===undefined||ring<0||S.ring===ring).map(S=>{
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

  // ---- the gear rung: a RELIC plus the Riftseed of its own dungeon -> SCAVENGED DREAMS ----
  const item = ia||ib, mat = (A.kind==='mat')?A:(B.kind==='mat'?B:null);
  if(!item || !mat) return {ok:false, why:'The anvil takes one piece and one reagent.'};
  if(item.k!=='wpn' && item.k!=='arm' && item.k!=='helm' && item.k!=='ring')
    return {ok:false, why:'That is not something Bram can work.'};

  // THE DIRECTION OF THIS RUNG IS REVERSED (user, 2026-07-29). It used to be SD + seed -> relic,
  // when SD was the dropped rung and a relic was the crafted top. The user has swapped them: relics
  // are what the ascended dungeons drop, and Scavenged Dreams is the crafted pinnacle above them. So
  // the same two slots now run the other way.
  //
  // Left un-flipped this rung would have been DEAD rather than merely wrong -- it would still demand
  // an SD piece, and nothing in the game can produce one any more, so the forge's entire payoff
  // would have quietly become unreachable with no error to see.
  //
  // THE SD PIECE INHERITS THE RELIC'S SET, AFFIX AND TRAIT. Upgrading must never cost you set
  // progress, or a completed four-piece set would beat four SD pieces and the top rung would be a
  // trap. It keeps `relic` for exactly that reason -- the id IS the set membership, and every set
  // bonus already reads it -- so this adds no new combat branch.
  //
  // AND THE SEED MUST BE THAT RELIC'S OWN DUNGEON'S. The rule the seeds were built on is that a seed
  // only answers for the dungeon it came from; feeding the Core Sanctum's seed a Windward Roost relic
  // would retire that rule for no reason.
  if(isSeed(mat.id)){
    const seed=MATERIALS[mat.id];
    if(!item.relic) return {ok:false, why:'A Riftseed only takes a '+TIER_NAMES[RELIC_T]+' relic.'};
    if(item.t===SD_T) return {ok:false, why:'That is already '+TIER_NAMES[SD_T]+'.'};
    if(matCount(mat.id)<1) return {ok:false, why:'You have no '+seed.n+'.'};
    const ring=(typeof relicRing==='function')?relicRing(item.relic):-1;
    if(ring>=0 && seed.ring!==ring)
      return {ok:false, why:'That relic answers to another dungeon. It needs its own seed.'};
    const cost={}; cost[mat.id]=1;
    const nm=(typeof relicDef==='function'&&relicDef(item.relic))?relicDef(item.relic).n:'the relic';
    return {ok:true, kind:'sd', cost:cost, label:tierTag(SD_T)+' '+nm, why:''};
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

  // THE RELIC IS RAISED IN PLACE, keeping its set, its exclusive affix and its trait, and only its
  // TIER moves. That is the whole reason to build it this way rather than minting a fresh piece:
  // `relic` is the set membership, every set bonus reads it, and an upgrade that dropped it would
  // make a finished four-piece set better than four of the best items in the game.
  const src=ch.inv[idx];
  const up=Object.assign({}, src);
  up.t=SD_T;
  // A FAILED CRAFT MUST PUT BACK EXACTLY WHAT plan.cost TOOK. An earlier version of this path named
  // a hard-coded 'riftseed' that no longer existed once seeds became per-dungeon, which would have
  // minted a reagent out of nothing.
  if(!up.relic){ for(const id in plan.cost) matAdd(id, plan.cost[id]);
    return {ok:false, why:'That piece lost its relic on the anvil.'}; }
  ch.inv[idx]=up;
  if(typeof saveRPG==='function') saveRPG();
  if(typeof msg==='function') msg(tierTag(SD_T)+' — '+TIER_NAMES[SD_T].toUpperCase(),
    (typeof relicDef==='function'&&relicDef(up.relic))?relicDef(up.relic).n:'raised out of the dream');
  return {ok:true, kind:'sd', item:up};
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
// SAVE MIGRATION — the top two rungs have swapped twice now
// ------------------------------------------------------------
// FIXED BY SHAPE, NOT BY ARITHMETIC, and that is the whole reason this survives being run again.
// A blind numeric swap (12<->13) would undo itself on the second run and would need a schema marker
// to be safe. Keying off the `relic` FLAG needs no marker: "a relic sits at RELIC_T" is true
// whatever RELIC_T happens to be, so the same two rules carried relics 12->13 in the first swap and
// carry them 13->12 in this one.
//
//   a relic   -> RELIC_T, always. It is the flag that identifies it, never the index.
//   index 12  -> SD_T, but ONLY without a relic flag. Pre-swap that meant Scavenged Dreams; a
//                post-swap relic also sits at 12 and the flag is what tells the two apart.
//
// Idempotent: run it twice and the second pass matches nothing. A relic is already at RELIC_T, and a
// migrated SD piece is at 13 so the `t===12` test misses it.
//
// EQUIPPED GEAR IS MIGRATED TOO, WHICH IT WAS NOT BEFORE. equipItem stores the tier as a bare number
// in rpg.wpn/arm/helm and rpg.ring.t, with the relic id off in rpg.eqAff[slot].rel -- so the old
// version's comment claimed it covered "the equipped-affix record" while the code only walked inv
// and the Vault. An equipped relic therefore kept a stale index through the FIRST swap and has been
// displaying and computing as the wrong tier ever since. Both swaps are repaired by the same pass.
function migrateForgeTiers(){
  if(typeof users==='undefined'||!users) return 0;
  let n=0;
  const fix=(it)=>{
    if(!it) return;
    if(it.relic){ if(it.t!==RELIC_T){ it.t=RELIC_T; n++; } return; }
    if(it.t===12 && SD_T!==12){ it.t=SD_T; n++; }
  };
  // the equipped slots, where the tier is a loose number and the relic id lives somewhere else
  const fixEq=(rp)=>{
    if(!rp) return;
    const aff=rp.eqAff||{};
    for(const sl of ['wpn','arm','helm']){
      if(typeof rp[sl]!=='number') continue;
      const rel=aff[sl]&&aff[sl].rel;
      if(rel){ if(rp[sl]!==RELIC_T){ rp[sl]=RELIC_T; n++; } }
      else if(rp[sl]===12 && SD_T!==12){ rp[sl]=SD_T; n++; }
    }
    if(rp.ring && typeof rp.ring.t==='number'){
      const rel=aff.ring&&aff.ring.rel;
      if(rel){ if(rp.ring.t!==RELIC_T){ rp.ring.t=RELIC_T; n++; } }
      else if(rp.ring.t===12 && SD_T!==12){ rp.ring.t=SD_T; n++; }
    }
  };
  for(const name in users){ const u=users[name]; if(!u) continue;
    if(Array.isArray(u.chars)) for(const c of u.chars){
      if(!c) continue;
      if(Array.isArray(c.inv)) c.inv.forEach(fix);
      fixEq(c.rpg);
    }
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

// Which satchel rows the anvil will even look at: RELICS, and nothing else. It filtered for Scavenged
// Dreams pieces and explicitly SKIPPED relics (`if(!it||it.relic) continue`) while the rung ran the
// other way -- so after the swap it would have hidden the one input the forge now needs and shown a
// list of things it cannot use. Everything else is noise in a list you are trying to pick one
// specific piece out of.
function _forgeInvRows(){
  const ch=(typeof curChar==='function')?curChar():null;
  const inv=(ch&&ch.inv)?ch.inv:[]; const out=[];
  for(let i=0;i<inv.length;i++){ const it=inv[i];
    if(!it||!it.relic) continue;
    if(it.k!=='wpn'&&it.k!=='arm'&&it.k!=='helm'&&it.k!=='ring') continue;
    if(it.t===SD_T) continue;                  // already raised; nothing left to do to it
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
// The material's own art, with its glyph as the fallback. A lazy Image returns null on its FIRST
// call because that call only starts the load, so the glyph is what shows for one repaint and the
// art takes over on the next -- never a broken <img>, and never an empty chip.
//
// A SEED HAS NO FILE OF ITS OWN: it shares mat_seed.png and is tinted by its dungeon's colour, so
// the src here is the shared sprite and the tint is applied by matArtImg on the canvas path. The
// panel is HTML, so it gets the shared sprite plus a CSS hue the same colour instead -- cheaper
// than canvas-per-chip and it reads identically at chip size.
function _matIcoHtml(d,size){
  const px=size||22;
  const file=d.seed?'mat_seed':('mat_'+d.id);
  return '<img class="fgArt'+(d.seed?' seed':'')+'" src="assets/items/'+file+'.png" '
    +'style="width:'+px+'px;height:'+px+'px'+(d.seed?(';filter:drop-shadow(0 0 3px '+d.col+')'):'')+'" '
    +'alt="'+d.icon+'" onerror="this.replaceWith(document.createTextNode(\''+d.icon+'\'))">';
}
function _forgeSlotHtml(s,which){
  if(!s) return '<div class="fgSlot empty" data-clear="'+which+'"><span class="fgDim">empty</span></div>';
  if(s.kind==='mat'){ const d=MATERIALS[s.id];
    return '<div class="fgSlot" data-clear="'+which+'" style="border-color:'+d.col+'">'
      +_matIcoHtml(d,30)
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

  // the anvil plate, same shape as the Incubator's and the Altar's machine art
  h+='<div class="embMachine"><img src="assets/items/forge_ui.png" alt=""></div>';

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
        +_matIcoHtml(m.def,30)
        +'<b style="color:'+m.def.col+'">'+m.def.n+'</b><span class="fgN">x'+m.n+'</span></div>'; }
    h+='</div>'; }

  // ---- the satchel, filtered to what the anvil accepts ----
  const rows=_forgeInvRows();
  h+='<div class="embSect">ON THE ANVIL <span class="embDim">— relics only</span></div>';
  if(!rows.length) h+='<div class="embEmpty">Nothing in your satchel is ready for the forge.'
    +'<br><span class="embDim">Relics drop in the ascended dream dungeons. A relic and its own dungeon’s Riftseed become '
    +TIER_NAMES[SD_T]+'.</span></div>';
  else { h+='<div class="fgStrip">';
    for(const r of rows){ const col=(typeof tierCol==='function')?tierCol(r.it.t):'#fff';
      const sel=_slotSame(_forgeA,{kind:'item',i:r.i})||_slotSame(_forgeB,{kind:'item',i:r.i});
      h+='<div class="fgChip'+(sel?' on':'')+'" data-inv="'+r.i+'" style="border-color:'+col+'">'
        +'<span class="fgIco" style="color:'+col+'">'+tierTag(r.it.t)+'</span>'
        +'<b style="color:'+col+'">'+((typeof itemName==='function')?itemName(r.it):r.it.k)+'</b></div>'; }
    h+='</div>'; }

  // ---- what the tree looks like. A crafting system nobody can see the shape of is a wiki tab --
  // but sixteen lines of it is reference material, so it is FOLDED by default. Rendering it open
  // pushed the pouch and the anvil off the top of a panel whose frame is a fixed percentage inset.
  h+='<details class="fgBook"><summary>WHAT JOINS WITH WHAT ('+Object.keys(MAT_RECIPES).length+')</summary>';
  for(const k in MAT_RECIPES){ const r=MAT_RECIPES[k];
    const A=MATERIALS[r.a], B=MATERIALS[r.b], O=MATERIALS[r.out];
    const can=matCount(r.a)>0&&matCount(r.b)>0;
    h+='<div class="fgRec'+(can?' can':'')+'">'
      +_matIcoHtml(A,14)+'<span style="color:'+A.col+'">'+A.n+'</span> + '
      +_matIcoHtml(B,14)+'<span style="color:'+B.col+'">'+B.n+'</span>'
      +' <span class="fgDim">→</span> '+_matIcoHtml(O,14)
      +'<b style="color:'+O.col+'">'+O.n+'</b></div>'; }
  // THE GEAR RUNG, WRITTEN THE WAY IT NOW RUNS: relic + its own dungeon's seed -> Scavenged Dreams.
  h+='<div class="fgRec"><span style="color:'+((typeof tierCol==='function')?tierCol(RELIC_T):'#fff')+'">★ any relic</span>'
    +' + <span style="color:'+RELIC_COL+'">its own dungeon’s Riftseed</span>'
    +' <span class="fgDim">→</span> <b style="color:'+((typeof tierCol==='function')?tierCol(SD_T):'#fff')+'">'
    +tierTag(SD_T)+' '+TIER_NAMES[SD_T]+'</b></div>';
  h+='</details>';
  // The old blurb told the player "Bram joins things; he does not improve them" and that the ladder
  // up to SD is found -- both true until the user made SD the crafted top. A retired rule left in
  // USER-FACING text is worse than one left in a comment: it teaches the wrong model of the game.
  h+='<div class="embNote">The ordinary ladder, up to <b>'+TIER_NAMES[11]+'</b>, is <b>found</b> and '
    +'never made. Above it Bram does improve things: a <b>relic</b> drops in the ascended dream '
    +'dungeons, and he raises one into <b>'+TIER_NAMES[SD_T]+'</b> — the same set, the same trait, '
    +'a long way further up.<br><br>'
    +'Every ascended boss drops <b>its own</b> reagent. The first three depths build the '
    +'<b>Riftheart</b>; the six that host relics each make a <b>Riftseed of their own dungeon</b>, '
    +'and a seed only ever answers for the dungeon it came from.</div>';

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
