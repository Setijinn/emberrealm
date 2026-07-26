// ---------- RELIC SETS ----------
// Relics are T13 Riftforged items (see RELIC_T in 11_ui.js). This file is WHAT they are.
//
// WHERE THEY COME FROM (user, 2026-07-26). Relics drop in DUNGEONS ONLY, and only in dungeons at
// Lv40 and above. Six of the twelve dungeons qualify -- the Shattered Vault and the Windward Roost
// in the Lv40 band, then the Cinder Crypt, the Scorch Barrows, the Ashen Keep and the Core Sanctum
// at Lv50. The six starter-and-middle dungeons drop none at all, and no overworld boss ever does.
// The rates are deliberately brutal: 0.25% in a Lv40 dungeon, 1% in a Lv50 one, per boss kill.
//
// EACH QUALIFYING DUNGEON HOSTS TWO SETS, and a set is FOUR pieces -- weapon, armour, helm, ring.
// Every piece is best-in-slot on its own (T13 base plus exclusive affixes no roll can reach), some
// carry a trait of their own, and wearing all four adds a rule none of the pieces can give you.
// Twelve sets means twelve different builds worth chasing rather than one ladder everybody climbs.
//
// SET BONUSES ONLY USE FLAGS THE ENGINE ALREADY READS in 06_combat/07_update -- the same family the
// ascension capstones set. Nothing here adds a new branch to the damage path. (Flags read only by
// 12b_abilities are deliberately avoided: those modify a specific ability rather than always
// applying, which is not what a set bonus should feel like.)

// ring `st` must be a RING_DEF key: hp dmg def mp vit wis dex spd luck
const RELIC_SETS=[
 // ---------------- THE SHATTERED VAULT (Lv40) — Stonefist, the gate-stone ----------------
 {id:'gate', n:'The Gate That Held', ring:3, d:'what was set against the door',
  bonus:{n:'Immovable', d:'healing past full becomes a shield', flag:'overshield', v:1}},
 {id:'warren', n:'The Buried Warren', ring:3, d:'what grew in the dark under it',
  bonus:{n:'Rot Takes Hold', d:'your hits open wounds that bleed', flag:'bleedHit', v:0.35}},
 // ---------------- THE WINDWARD ROOST (Lv45) — the Crag Gargoyle, the herald ----------------
 {id:'herald', n:"The Herald's Flight", ring:4, d:'it never once landed',
  bonus:{n:'Never Landing', d:'you take 25% less damage while moving', flag:'moveDr', v:0.25}},
 {id:'beacon', n:'The Light That Would Not Turn', ring:4, d:'someone kept it burning to the end',
  bonus:{n:'Fixed Star', d:'your crits pierce everything', flag:'critPierce', v:1}},
 // ---------------- THE CINDER CRYPT (Lv50) — the Ash Wraith, the burned dead ----------------
 {id:'pyre', n:'What The Fire Kept', ring:6, d:'taken from the ash that remembers',
  bonus:{n:'Pyre', d:'your shots fork', flag:'fork', v:1}},
 {id:'faith', n:'The Small Faith', ring:6, d:'a chapel nobody outside it ever named',
  bonus:{n:'Litany', d:'you and your allies heal while you stand together', flag:'auraHeal', v:0.02}},
 // ---------------- THE SCORCH BARROWS (Lv50) — Magmaw, the furnace ----------------
 {id:'meltdown', n:'The Furnace Unbanked', ring:5, d:'a world was spent to light it',
  bonus:{n:'Meltdown', d:'everything you kill bursts', flag:'bloodNova', v:0.5}},
 {id:'regrowth', n:'The Root That Would Not Burn', ring:5, d:'it came back through the cinders',
  bonus:{n:'Regrowth', d:'a kill leaves you untouchable for a moment', flag:'killInv', v:1}},
 // ---------------- THE ASHEN KEEP (Lv50) — the Cinder Demon, first claimed ----------------
 {id:'grief', n:'Old Grief', ring:7, d:'it was first, and it taught them the way',
  bonus:{n:'No Mercy Twice', d:'a crit fires a second bolt', flag:'critBolt', v:0.6}},
 {id:'veil', n:'The Parted Veil', ring:7, d:'the scouts came through here',
  bonus:{n:'Unseen', d:'being hurt hides you for a heartbeat', flag:'vanishHurt', v:1}},
 // ---------------- THE CORE SANCTUM (Lv50) — the Molten Titan, the king ----------------
 {id:'throne', n:'The Last Wall', ring:8, d:'the order was given here',
  bonus:{n:'The Order Given', d:'your hits stagger', flag:'stun3', v:1}},
 {id:'tide', n:'What The Tide Left', ring:8, d:'it washed up and it stayed',
  bonus:{n:'Undertow', d:'what you hit is cursed', flag:'curse', v:0.3}},
];
function relicSet(id){ for(const S of RELIC_SETS) if(S.id===id) return S; return null; }
// which dungeon (boss ring) a set belongs to, and the two sets a dungeon hosts
function setsForRing(r){ return RELIC_SETS.filter(S=>S.ring===r); }

// ---------- the forty-eight pieces ----------
// `aff` are FIXED exclusive affixes -- no roll produces these. `trait` is a rule the piece carries
// on its own, using the same player flags the capstones set. Rings carry `st`, which is what the
// ring's own tier base pays out in on top of the affixes.
const RELICS=[
 // ===== THE GATE THAT HELD — immovable, the wall that did not fall =====
 {id:'r_vault', set:'gate', slot:'wpn', n:'Stonefist Maul', d:'it does not need a second swing',
  aff:[{s:'atk',v:70},{s:'spd',v:-10}],
  trait:{n:'Concussive', d:'every hit shakes the ground for 35% splash', flag:'splash', v:0.35}},
 {id:'r_gatewarden', set:'gate', slot:'arm', n:'Gatewarden Cuirass', d:'it was standing when the door was not',
  aff:[{s:'def',v:40},{s:'hp',v:160},{s:'spd',v:-12}], trait:null},
 {id:'r_keystone', set:'gate', slot:'helm', n:'Keystone Crown', d:'the last stone set, and the first missed',
  aff:[{s:'def',v:26},{s:'vit',v:30},{s:'wis',v:16}], trait:null},
 {id:'r_sealsignet', set:'gate', slot:'ring', st:'def', n:'Signet of the Sealed Door', d:'sealed from the wrong side',
  aff:[{s:'def',v:22},{s:'hp',v:90}], trait:null},

 // ===== THE BURIED WARREN — attrition, everything that touches you rots =====
 {id:'r_warren', set:'warren', slot:'arm', n:'Warren Carapace', d:'grown, not forged — and grown thick',
  aff:[{s:'def',v:38},{s:'hp',v:150},{s:'spd',v:-14}],
  trait:{n:'Barbed', d:'attackers take 12% of what they deal', flag:'thorns', v:0.12}},
 {id:'r_rootrot', set:'warren', slot:'wpn', n:'Rootrot Cleaver', d:'it was a tool for cutting away the sick parts',
  aff:[{s:'atk',v:52},{s:'vit',v:28}],
  trait:{n:'Septic', d:'your hits poison', flag:'poisonHit', v:0.4}},
 {id:'r_blightbrow', set:'warren', slot:'helm', n:'Blightbrow Helm', d:'the brewer wore it while it worked',
  aff:[{s:'vit',v:34},{s:'def',v:20},{s:'hp',v:70}], trait:null},
 {id:'r_oozeband', set:'warren', slot:'ring', st:'vit', n:'Ooze-Slick Band', d:'nothing sticks to it, including you',
  aff:[{s:'vit',v:30},{s:'def',v:18}], trait:null},

 // ===== THE HERALD'S FLIGHT — speed, never stop moving =====
 {id:'r_roost', set:'herald', slot:'wpn', n:'Windward Talon', d:'taken off something that never landed',
  aff:[{s:'atk',v:44},{s:'dex',v:30},{s:'spd',v:24}],
  trait:{n:'Galebound', d:'you strike 30% faster while moving', flag:'moveRof', v:0.30}},
 {id:'r_updraft', set:'herald', slot:'arm', n:'Updraft Harness', d:'it is built to catch air, not blows',
  aff:[{s:'spd',v:58},{s:'dex',v:26},{s:'def',v:18}], trait:null},
 {id:'r_galecut', set:'herald', slot:'helm', n:'Gale-Cut Circlet', d:'worn smooth by wind alone',
  aff:[{s:'dex',v:28},{s:'spd',v:30},{s:'wis',v:14}], trait:null},
 {id:'r_featherloop', set:'herald', slot:'ring', st:'spd', n:'Feathered Loop', d:'it weighs nothing at all',
  aff:[{s:'spd',v:34},{s:'dex',v:22}], trait:null},

 // ===== THE LIGHT THAT WOULD NOT TURN — crit, everything lands =====
 {id:'r_lamp', set:'beacon', slot:'arm', n:"Lightkeeper's Coat", d:'someone kept the light on for years',
  aff:[{s:'spd',v:60},{s:'dex',v:24},{s:'luck',v:28}], trait:null},
 {id:'r_beacon', set:'beacon', slot:'wpn', n:'Beacon Lance', d:'it points at one thing and does not waver',
  aff:[{s:'atk',v:48},{s:'luck',v:30}],
  trait:{n:'Seeking', d:'your shots find their own way', flag:'homing', v:1}},
 {id:'r_watchcowl', set:'beacon', slot:'helm', n:"Watchman's Cowl", d:'for the long half of the night',
  aff:[{s:'luck',v:30},{s:'wis',v:18},{s:'spd',v:22}], trait:null},
 {id:'r_fixedstar', set:'beacon', slot:'ring', st:'luck', n:'Ring of the Fixed Star', d:'the one light that never moved',
  aff:[{s:'luck',v:34},{s:'dex',v:20}], trait:null},

 // ===== WHAT THE FIRE KEPT — burn, everything you touch catches =====
 {id:'r_crypt', set:'pyre', slot:'arm', n:'Cinder Crypt Mantle', d:'ash woven while it was still warm',
  aff:[{s:'def',v:26},{s:'hp',v:110},{s:'spd',v:40}], trait:null},
 {id:'r_pyrebrand', set:'pyre', slot:'wpn', n:"Pyre-Tender's Brand", d:'someone had to keep the fires fed',
  aff:[{s:'atk',v:50},{s:'luck',v:26}],
  trait:{n:'Everburning', d:'everything you hit catches fire', flag:'burnHit', v:0.5}},
 {id:'r_ashveil', set:'pyre', slot:'helm', n:'Ashen Veil', d:'so the tenders did not have to look',
  aff:[{s:'wis',v:26},{s:'mp',v:90},{s:'def',v:16}], trait:null},
 {id:'r_emberreliq', set:'pyre', slot:'ring', st:'luck', n:'Ember Reliquary', d:'a cinder of someone, kept',
  aff:[{s:'luck',v:28},{s:'wis',v:22}], trait:null},

 // ===== THE SMALL FAITH — caster and keeper, you hold the others up =====
 {id:'r_chapel', set:'faith', slot:'arm', n:'Marrow Chapel Vestment', d:'the last vestment of a small faith',
  aff:[{s:'wis',v:34},{s:'mp',v:120},{s:'def',v:20}], trait:null},
 {id:'r_censer', set:'faith', slot:'wpn', n:'Reliquary Censer', d:'swung at a service nobody survived',
  aff:[{s:'atk',v:38},{s:'wis',v:34},{s:'mp',v:80}], trait:null},
 {id:'r_mitre', set:'faith', slot:'helm', n:'Bonelight Mitre', d:'it still gives off a little light',
  aff:[{s:'wis',v:38},{s:'mp',v:110}], trait:null},
 {id:'r_marrowsignet', set:'faith', slot:'ring', st:'wis', n:'Marrow Signet', d:'worn by whoever spoke last',
  aff:[{s:'wis',v:30},{s:'mp',v:90}], trait:null},

 // ===== THE FURNACE UNBANKED — raw fire, things come apart =====
 {id:'r_barrows', set:'meltdown', slot:'wpn', n:'Scorchmaw', d:'still hot from the barrows',
  aff:[{s:'atk',v:56},{s:'luck',v:22}],
  trait:{n:'Everburning', d:'everything you hit catches fire', flag:'burnHit', v:0.5}},
 {id:'r_slagplate', set:'meltdown', slot:'arm', n:'Slagplate Harness', d:'poured, not forged',
  aff:[{s:'def',v:34},{s:'hp',v:130},{s:'atk',v:24}], trait:null},
 {id:'r_furnacemask', set:'meltdown', slot:'helm', n:'Furnace Mask', d:'you could look into it and live',
  aff:[{s:'def',v:22},{s:'vit',v:26},{s:'atk',v:20}], trait:null},
 {id:'r_moltencore', set:'meltdown', slot:'ring', st:'dmg', n:'Molten Core Band', d:'a drop of the furnace, cooled around a finger',
  aff:[{s:'atk',v:36},{s:'luck',v:24}], trait:null},

 // ===== THE ROOT THAT WOULD NOT BURN — sustain, you outlast it =====
 {id:'r_heartwood', set:'regrowth', slot:'wpn', n:'Heartwood Bough', d:'the root that would not burn',
  aff:[{s:'atk',v:58},{s:'vit',v:26}],
  trait:{n:'Quickening', d:'every kill returns 4% of your health', flag:'killHeal', v:0.04}},
 {id:'r_greenribs', set:'regrowth', slot:'arm', n:'Greenwood Ribs', d:'grown around a wound and kept growing',
  aff:[{s:'def',v:30},{s:'hp',v:140},{s:'vit',v:30}], trait:null},
 {id:'r_sapcrown', set:'regrowth', slot:'helm', n:'Sapcrown', d:'it is still sticky',
  aff:[{s:'vit',v:34},{s:'wis',v:20},{s:'hp',v:60}], trait:null},
 {id:'r_seedring', set:'regrowth', slot:'ring', st:'vit', n:'Seedring', d:'something in it is still alive',
  aff:[{s:'vit',v:30},{s:'luck',v:20}], trait:null},

 // ===== OLD GRIEF — execute, you end things =====
 {id:'r_keep', set:'grief', slot:'wpn', n:'Ashen Keepblade', d:'keen with old grief',
  aff:[{s:'atk',v:62},{s:'luck',v:24}],
  trait:{n:'Mercy', d:'+45% damage to anything nearly dead', flag:'execute', v:0.45}},
 {id:'r_keepplate', set:'grief', slot:'arm', n:'Keepwarden Plate', d:'it held the hall for a while',
  aff:[{s:'def',v:32},{s:'hp',v:120},{s:'luck',v:22}], trait:null},
 {id:'r_griefhelm', set:'grief', slot:'helm', n:'Grief-Wrought Helm', d:'beaten out of something that used to be a bell',
  aff:[{s:'luck',v:32},{s:'def',v:20},{s:'atk',v:22}], trait:null},
 {id:'r_firstclaimed', set:'grief', slot:'ring', st:'luck', n:'Band of the First Claimed', d:'it went first so the rest would know how',
  aff:[{s:'luck',v:36},{s:'atk',v:26}], trait:null},

 // ===== THE PARTED VEIL — evasion, they lose track of you =====
 {id:'r_fogbound', set:'veil', slot:'arm', n:'Fogbound Mantle', d:'never quite where you looked',
  aff:[{s:'spd',v:54},{s:'dex',v:26},{s:'def',v:22}], trait:null},
 {id:'r_veilpiercer', set:'veil', slot:'wpn', n:'Veilpiercer', d:'it made the first hole',
  aff:[{s:'atk',v:46},{s:'dex',v:32}],
  trait:{n:'Unmaking', d:'your hits leave the struck weakened', flag:'weakHit', v:0.3}},
 {id:'r_antlerhood', set:'veil', slot:'helm', n:'Antlered Hood', d:'the scout wore its own kill',
  aff:[{s:'dex',v:30},{s:'spd',v:26},{s:'wis',v:16}], trait:null},
 {id:'r_mistglass', set:'veil', slot:'ring', st:'dex', n:'Mistglass Ring', d:'you can see the room behind you in it',
  aff:[{s:'dex',v:28},{s:'spd',v:24}], trait:null},

 // ===== THE LAST WALL — the king's own, and it held =====
 {id:'r_sanctum', set:'throne', slot:'arm', n:'Core Sanctum Plate', d:'the last wall, and it held',
  aff:[{s:'def',v:44},{s:'hp',v:180},{s:'spd',v:-18}],
  trait:{n:'Bulwark', d:'everything near you moves slower', flag:'slowAura', v:1}},
 {id:'r_throneshard', set:'throne', slot:'wpn', n:'Throneshard', d:'a piece of the seat, sharpened',
  aff:[{s:'atk',v:60},{s:'def',v:24}], trait:null},
 {id:'r_riftcrown', set:'throne', slot:'helm', n:'Crown of the Ordered Rift', d:'he gave the order wearing this',
  aff:[{s:'def',v:30},{s:'hp',v:90},{s:'vit',v:28}], trait:null},
 {id:'r_kingsblood', set:'throne', slot:'ring', st:'hp', n:'Kingsblood Signet', d:'the hand it came off was still warm',
  aff:[{s:'hp',v:110},{s:'def',v:24}], trait:null},

 // ===== WHAT THE TIDE LEFT — chain and fortune, it keeps giving =====
 {id:'r_saltworks', set:'tide', slot:'wpn', n:'Salt-Eaten Harpoon', d:'pitted by a sea nobody knows',
  aff:[{s:'atk',v:40},{s:'dex',v:28},{s:'fort',v:16}],
  trait:{n:'Trailing Line', d:'hits carry to a second foe for 40%', flag:'chainHit', v:0.40}},
 {id:'r_barnacle', set:'tide', slot:'arm', n:'Barnacle Coat', d:'more shell than coat by now',
  aff:[{s:'def',v:26},{s:'hp',v:100},{s:'fort',v:18}], trait:null},
 {id:'r_drownedcrown', set:'tide', slot:'helm', n:'Drowned Crown', d:'somebody ruled something, once',
  aff:[{s:'fort',v:22},{s:'wis',v:24},{s:'mp',v:70}], trait:null},
 {id:'r_pearl', set:'tide', slot:'ring', st:'luck', n:'Pearl of the Unknown Sea', d:'it is not from any sea on this map',
  aff:[{s:'fort',v:26},{s:'luck',v:26}], trait:null},
];

// ---------- lookups ----------
function relicDef(id){ for(const R of RELICS) if(R.id===id) return R; return null; }
function isRelic(it){ return !!(it&&it.relic); }
function relicOf(it){ return it&&it.relic?relicDef(it.relic):null; }
function relicsOfSet(sid){ return RELICS.filter(R=>R.set===sid); }
// every relic a given dungeon can drop: both of its sets, all four slots each
function relicsForRing(r){ const ids=setsForRing(r).map(S=>S.id);
  return RELICS.filter(R=>ids.indexOf(R.set)>=0); }

// ---------- what you are wearing ----------
// The set bonus counts EQUIPPED pieces only -- four slots, four relics, all of the same set.
function wornRelicIds(){
  const out=[]; if(typeof rpg==='undefined'||!rpg||!rpg.eqAff) return out;
  for(const sl of ['wpn','arm','helm','ring']){ const e=rpg.eqAff[sl]; if(e&&e.rel) out.push(e.rel); }
  return out;
}
function setWornCount(sid){ let n=0;
  for(const id of wornRelicIds()){ const R=relicDef(id); if(R&&R.set===sid) n++; }
  return n; }
// the completed set, if any. Four pieces of one set is the only thing that counts.
function activeRelicSet(){
  for(const S of RELIC_SETS) if(setWornCount(S.id)>=4) return S;
  return null;
}

// ---------- drops ----------
// Dungeons only, Lv40+ only. BOSS_ZONE maps a boss to the territory it rules; territories 6-7 are
// the Lv39-50 band and 8-12 are the Lv50 rim, which is the whole gate.
const RELIC_ZONE_MIN=6;          // below this the dungeon drops no relic at all
const RELIC_P_LV40=0.0025;       // Shattered Vault, Windward Roost
const RELIC_P_LV50=0.01;         // Cinder Crypt, Scorch Barrows, Ashen Keep, Core Sanctum
// ---------- INSANE DROP ----------
// Fired the moment a relic hits the ground, for the player it was rolled for. It names the piece
// and the set it belongs to, because "which of the four is this" is the first thing you want to
// know. The animation is CSS; re-triggering it needs the class removed and the layout re-read, or
// a second relic in the same fight would not replay it.
let _dropBanT=null;
function insaneDrop(it){
  const el=document.getElementById('dropBanner'); if(!el||!it) return;
  const R=relicDef(it.relic); if(!R) return;
  const S=relicSet(R.set);
  const nm=document.getElementById('dbName'), sb=document.getElementById('dbSub');
  if(nm) nm.textContent='★ '+R.n;
  if(sb) sb.textContent=S?(S.n+' — '+(R.slot==='wpn'?'weapon':R.slot==='arm'?'armour':R.slot)+' piece'):'';
  el.classList.remove('on'); void el.offsetWidth;      // restart the animation from the top
  el.classList.add('on');
  if(_dropBanT) clearTimeout(_dropBanT);
  _dropBanT=setTimeout(()=>el.classList.remove('on'),3600);
  if(navigator.vibrate) navigator.vibrate([60,50,60,50,140]);
  if(typeof msg==='function') msg('★ '+R.n, S?('a piece of '+S.n):'a relic');
}
function relicZoneOf(ring){
  return (typeof BOSS_ZONE!=='undefined' && BOSS_ZONE[ring]!==undefined) ? BOSS_ZONE[ring] : -1; }
function relicChanceFor(ring){
  const z=relicZoneOf(ring);
  if(z<RELIC_ZONE_MIN) return 0;
  return z>=8 ? RELIC_P_LV50 : RELIC_P_LV40;
}
