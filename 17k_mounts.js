// ============================================================
//  MOUNTS (17k_mounts.js)
// ------------------------------------------------------------
//  A MOUNT IS A RIDE, NOT A STAT LINE. It carries you faster and it carries you unarmed: you
//  cannot fire and you cannot cast while mounted. That trade is the whole design. Without it a
//  mount is a pure buff, and a pure buff on a traversal tool means the correct play is to be
//  mounted at all times, which is the same failure the anchored-phase immunity had — a state with
//  no exit the player can reach.
//
//  THERE ARE THREE EXITS, and all of them are cheap:
//    1. Dismount on demand. Instant, no cooldown, no animation to wait out.
//    2. Damage throws you. Cumulative damage taken WHILE MOUNTED, measured against a fraction of
//       your own maxhp, so it self-scales with level and needs no second dial. The counter resets
//       every time you get off, so chip damage across a long ride still adds up but a clean ride
//       never carries a penalty forward.
//    3. A boss fight throws you and keeps you off. Mounts are allowed everywhere EXCEPT a live
//       boss engagement (user, 2026-07-27) — otherwise an anchored phase is something you ride
//       through rather than something you survive.
//
//  MOUNTS LIVE ON THE USER, not the character, exactly like pets (15_pets.js) and the Vault. They
//  survive hero permadeath. A mount lost to a Lv40 death would contradict what is already decided
//  for both of those, and the mount is handed over at Lv20 — the same beat as the bridge crossing
//  and the onset of permadeath — so losing it is precisely the moment it would sting most.
//
//  NOT YET WIRED: co-op. A mounted player is a `remote` shadow on a peer's screen and that shadow
//  carries none of this state, so a peer sees you afoot at mounted speed. Harmless but wrong, and
//  it is NOT fixed here — see netBroadcast/netApplyWorld in 14b_netsync.js.
// ============================================================

// Rarity ladder is the shared one: 0 Common - 1 Uncommon - 2 Rare - 3 Epic - 4 Legendary.
// Mounts reuse PET_RAR_NAME / PET_RAR_COL rather than declaring a second ladder, so a rarity
// always means the same thing and reads the same colour everywhere in the game.
function mountRarName(r){ return (typeof PET_RAR_NAME!=='undefined'&&PET_RAR_NAME[r])||'Common'; }
function mountRarCol(r){ return (typeof PET_RAR_COL!=='undefined'&&PET_RAR_COL[r])||'#b8b2a6'; }

// ---- THE TUNING DIALS. Every number a mount has is derived from its rarity through these two
// tables, so adding a species is one row and rebalancing the whole system is one array. ----
//
// SPEED is a multiplier folded into the player's existing speed chain (07_update.js), so it
// composes correctly with chill, the dyn perks and MOVE_SCALE instead of fighting them. It is
// deliberately NOT applied to MOVE_SCALE itself: MOVE_SCALE is the user's global "everything is
// slower" dial and a mount is not entitled to undo it for every other actor in the room.
const MOUNT_SPD = [1.34, 1.42, 1.52, 1.63, 1.76];
// THROW THRESHOLD as a fraction of maxhp. Cumulative while mounted. A percentage self-scales with
// level, so this never needs a per-level table and a Lv1 test hero behaves like a Lv50 one.
const MOUNT_TOUGH = [0.12, 0.15, 0.18, 0.22, 0.27];
// Seconds you stay afoot after being THROWN (not after dismounting by choice). Without this the
// threshold means nothing — you would remount on the next frame and ride on at full speed.
const MOUNT_THROW_CD = 6.0;
// GETTING ON TAKES TIME (user, 2026-07-27). Climbing into the saddle is a commitment you can be
// punished for starting, which is what stops a mount being a free escape button the moment a fight
// turns: you cannot outrun a bad pull by tapping V, because the second and a half it costs is
// exactly the window the thing chasing you needs.
//
// GETTING OFF IS STILL INSTANT, and deliberately so. Every exit from this state has to stay cheap
// and reachable — that is the rule the anchored-phase immunity was built around — so the cast is
// paid on the way IN only. A dismount you had to channel would turn the mount into the trap the
// three exits exist to prevent.
//
// DAMAGE INTERRUPTS IT, for the same reason damage throws you once you are up: the mount will not
// stand still for you while something is hitting you.
const MOUNT_CAST = 1.5;

// ============================================================
//  THE ROSTER — archetypes carry the art, species carry the identity
// ------------------------------------------------------------
//  Mounts are COLLECTIBLES and there are meant to be a lot of them (user, 2026-07-27). The art
//  budget for "a lot" is solved here exactly the way this game already solved 252 creatures on 12
//  drawings: an ARCHETYPE owns the sprite, a SPECIES is an archetype wearing a COAT, and the coat
//  is a tint. MOB_ARCH/MOBTINT is the same idea and the same reason — the band tint is what makes
//  the same crab a sand crab or a peat-stained one.
//
//  So: 12 sprites on disk, 78 mounts to collect, and adding the 79th is one row.
//
//  EVERY SPECIES CARRIES ITS OWN SPEED, sitting AROUND its rarity's baseline rather than on it.
//  Rarity sets the band; the animal decides where in the band it lands, and the bands deliberately
//  OVERLAP — the fastest Common beats the slowest Uncommon. That overlap is the point: a mount you
//  like is never strictly obsoleted by the next rarity you happen to pull.
//
//  `tough` is optional and defaults to the rarity's MOUNT_TOUGH. A species that gives up speed for
//  staying power sets it — the heavy ones carry you through more damage before they throw you,
//  which is the one lever that makes a slow mount worth choosing.
// ============================================================

// FLIGHT IS COMING AT Lv40 (user, 2026-07-27) and is NOT built. This is the seam, declared now so
// the shape is already right when it lands: a flying species sets `fly:1`, and everything that
// gates on the ground rules reads mountIsFlyer()/mountFlyOk() rather than testing a species id.
// What flight will additionally need, none of which exists yet:
//   - a collision exemption, which 04_collision.js already has the shape for (player.terrainGhost,
//     gated on _pmove so it only ever applies to the player's own movement)
//   - a decision about whether water/chasm tiles are the ONLY thing it clears, or everything
//   - the targeting question: which enemies can reach a flyer at all
const MOUNT_FLY_LV = 40;
function mountIsFlyer(m){ const d=mountDef(m); return !!(d&&d.fly); }
function mountFlyOk(){ const u=mountStore(); if(!u) return false;
  const cur=(typeof rpg!=='undefined'&&rpg&&rpg.lvl)?rpg.lvl:0;
  return Math.max(u.mountLv|0, cur|0) >= MOUNT_FLY_LV; }

// ---- the twelve drawings. spr = assets/mounts/<spr>.png ----
const MOUNT_ARCH = {
  horse:    {n:'horse',     spr:'arch_horse'},
  destrier: {n:'destrier',  spr:'arch_destrier'},   // heavy barded warhorse
  mule:     {n:'mule',      spr:'arch_mule'},
  stag:     {n:'stag',      spr:'arch_stag'},
  elk:      {n:'elk',       spr:'arch_elk'},
  wolf:     {n:'wolf',      spr:'arch_wolf'},
  boar:     {n:'boar',      spr:'arch_boar'},
  ram:      {n:'ram',       spr:'arch_ram'},
  cat:      {n:'great cat', spr:'arch_cat'},
  drake:    {n:'drake',     spr:'arch_drake'},      // wingless ground drake
  lizard:   {n:'lizard',    spr:'arch_lizard'},
  colossus: {n:'colossus',  spr:'arch_colossus'},   // walking stone construct
};
// ---- the coats. A tint plus the word that names it. Colours are the game's existing families
// (PET_CATS, MOBTINT) so a Frost mount reads frost the way everything else frost does. ----
const MOUNT_COATS = {
  plain:  {n:'Field',    col:null,      a:0},
  ash:    {n:'Ashen',    col:'#8a8078', a:0.34},
  ember:  {n:'Ember',    col:'#ff7a3d', a:0.32},
  frost:  {n:'Frost',    col:'#a9e0ff', a:0.32},
  storm:  {n:'Storm',    col:'#6ab8ff', a:0.30},
  tide:   {n:'Tide',     col:'#4aa6d6', a:0.30},
  verdant:{n:'Moss',     col:'#5cbf4a', a:0.28},
  stone:  {n:'Stone',    col:'#9a938a', a:0.34},
  sand:   {n:'Dune',     col:'#d8b26a', a:0.30},
  bog:    {n:'Peat',     col:'#6a7a4a', a:0.32},
  spirit: {n:'Spirit',   col:'#d6a6ff', a:0.30},
  void:   {n:'Void',     col:'#b23ce0', a:0.34},
  dawn:   {n:'Dawn',     col:'#ffd07a', a:0.28},
  blood:  {n:'Blood',    col:'#c0392b', a:0.30},
};
// [id, name, rarity, arch, coat, speed, tough?]
// Names are mostly <coat> <archetype>, with bespoke ones where a species has earned it.
const _MOUNTS = [
  // ---- COMMON (0): the workhorses. 1.26-1.40 ----
  ['pony',     'Field Pony',        0,'horse',   'plain',  1.34],
  ['drayhorse','Dray Horse',        0,'destrier','plain',  1.28, 0.17],
  ['mule',     'Ash Mule',          0,'mule',    'ash',    1.26, 0.18],
  ['bogmule',  'Peat Mule',         0,'mule',    'bog',    1.27, 0.19],
  ['steppe',   'Steppe Runner',     0,'horse',   'sand',   1.40],
  ['moorpony', 'Moor Pony',         0,'horse',   'bog',    1.32],
  ['craggoat', 'Crag Ram',          0,'ram',     'stone',  1.36],
  ['mossram',  'Moss Ram',          0,'ram',     'verdant',1.33],
  ['huskboar', 'Husk Boar',         0,'boar',    'ash',    1.30, 0.20],
  ['fenboar',  'Fen Boar',          0,'boar',    'bog',    1.29, 0.21],
  ['scrubstag','Scrub Stag',        0,'stag',    'sand',   1.38],
  ['greystag', 'Grey Stag',         0,'stag',    'stone',  1.35],
  ['saltpony', 'Salt Pony',         0,'horse',   'tide',   1.33],
  ['dunemule', 'Dune Mule',         0,'mule',    'sand',   1.28, 0.17],
  ['pitwolf',  'Pit Wolf',          0,'wolf',    'ash',    1.39],
  ['thornram', 'Thorn Ram',         0,'ram',     'bog',    1.31, 0.19],
  // ---- UNCOMMON (1): 1.34-1.49 ----
  ['stag',     'Moorland Stag',     1,'stag',    'verdant',1.44],
  ['courser',  'Salt Courser',      1,'horse',   'tide',   1.48],
  ['tuskback', 'Tuskback Boar',     1,'boar',    'stone',  1.36, 0.23],
  ['dustlope', 'Dustlope',          1,'cat',     'sand',   1.47],
  ['ridgeram', 'Ridge Ram',         1,'ram',     'ash',    1.39, 0.21],
  ['marshelk', 'Marsh Elk',         1,'elk',     'bog',    1.42],
  ['frostpony','Frostmane Pony',    1,'horse',   'frost',  1.41],
  ['embermule','Ember Mule',        1,'mule',    'ember',  1.34, 0.22],
  ['greywolf', 'Grey Hunter',       1,'wolf',    'stone',  1.46],
  ['reedstag', 'Reed Stag',         1,'stag',    'tide',   1.45],
  ['cinderram','Cinder Ram',        1,'ram',     'ember',  1.38, 0.20],
  ['peatelk',  'Peat Elk',          1,'elk',     'bog',    1.40, 0.21],
  ['sandlizard','Basking Lizard',   1,'lizard',  'sand',   1.43],
  ['mosscat',  'Moss Prowler',      1,'cat',     'verdant',1.46],
  ['stormcolt','Storm Colt',        1,'horse',   'storm',  1.49],
  ['boglizard','Fen Lizard',        1,'lizard',  'bog',    1.37, 0.22],
  ['ashstag',  'Ashfall Stag',      1,'stag',    'ash',    1.43],
  ['tideram',  'Tide Ram',          1,'ram',     'tide',   1.40],
  // ---- RARE (2): 1.44-1.59 ----
  ['dunestrid','Dunestrider',       2,'lizard',  'sand',   1.54],
  ['bramble',  'Bramblehorn Elk',   2,'elk',     'verdant',1.49, 0.24],
  ['sanddrake','Sand Drake',        2,'drake',   'sand',   1.58],
  ['greatwolf','Greatwolf',         2,'wolf',    'stone',  1.56],
  ['stonehide','Stonehide Beast',   2,'colossus','stone',  1.44, 0.29],
  ['tidemane', 'Tidemane',          2,'horse',   'tide',   1.52],
  ['frostwolf','Frost Hunter',      2,'wolf',    'frost',  1.55],
  ['emberdrake','Ember Drake',      2,'drake',   'ember',  1.57],
  ['stormstag','Stormcrest Stag',   2,'stag',    'storm',  1.53],
  ['bloodboar','Blooded Tusker',    2,'boar',    'blood',  1.46, 0.27],
  ['spiritelk','Spirit Elk',        2,'elk',     'spirit', 1.51],
  ['ashcat',   'Ashen Prowler',     2,'cat',     'ash',    1.56],
  ['voidlizard','Riftscale Lizard', 2,'lizard',  'void',   1.50],
  ['dawnhorse','Dawn Courser',      2,'horse',   'dawn',   1.54],
  ['peatcolossus','Mire Colossus',  2,'colossus','bog',    1.45, 0.30],
  ['frostram', 'Glacier Ram',       2,'ram',     'frost',  1.47, 0.26],
  ['bloodwolf','Red Hunter',        2,'wolf',    'blood',  1.57],
  ['tidedrake','Tide Drake',        2,'drake',   'tide',   1.55],
  // ---- EPIC (3): 1.55-1.70 ----
  ['embermane','Embermane Charger', 3,'destrier','ember',  1.65],
  ['frosthoof','Frosthoof Destrier',3,'destrier','frost',  1.62, 0.27],
  ['stormelk', 'Stormcrown Elk',    3,'elk',     'storm',  1.68],
  ['ashenwolf','Ashen Direwolf',    3,'wolf',    'ash',    1.69],
  ['warden',   'Warden Colossus',   3,'colossus','stone',  1.55, 0.35],
  ['voidcat',  'Void Prowler',      3,'cat',     'void',   1.70],
  ['spiritdest','Spirit Destrier',  3,'destrier','spirit', 1.64],
  ['bloodrake','Blood Drake',       3,'drake',   'blood',  1.67],
  ['dawnelk',  'Dawnhorn Elk',      3,'elk',     'dawn',   1.63],
  ['frostcat', 'Rime Prowler',      3,'cat',     'frost',  1.66],
  ['stormdrake','Storm Drake',      3,'drake',   'storm',  1.68],
  ['emberco',  'Cinder Colossus',   3,'colossus','ember',  1.57, 0.33],
  ['voidwolf', 'Rift Direwolf',     3,'wolf',    'void',   1.69],
  ['tidedest', 'Tidebound Destrier',3,'destrier','tide',   1.61, 0.28],
  ['spiritstag','Pale Stag',        3,'stag',    'spirit', 1.65],
  // ---- LEGENDARY (4): 1.68-1.84 ----
  ['riftrunner','Riftrunner',       4,'drake',   'void',   1.80],
  ['phoenixst','Emberwing Steed',   4,'destrier','ember',  1.76],
  ['voidstalk','Voidstalker',       4,'cat',     'void',   1.82],
  ['dawnhart', 'Dawnhart',          4,'elk',     'dawn',   1.72, 0.34],
  ['stormcrwn','Thundercrown',      4,'destrier','storm',  1.78],
  ['worldelk', 'Elk of the First Wood',4,'elk',  'verdant',1.74, 0.32],
  ['tidesov',  'Tide Sovereign',    4,'drake',   'tide',   1.79],
  ['bonewolf', 'The Pale Hunt',     4,'wolf',    'spirit', 1.83],
  ['ashking',  'The Ashen King',    4,'colossus','ash',    1.68, 0.40],
  ['bloodmane','Bloodmane',         4,'cat',     'blood',  1.84],
  ['frostsov', 'Winter Sovereign',  4,'destrier','frost',  1.75, 0.33],
];
const MOUNT_DB = _MOUNTS.map(function(r){
  const arch=MOUNT_ARCH[r[3]]||MOUNT_ARCH.horse, coat=MOUNT_COATS[r[4]]||MOUNT_COATS.plain;
  return {id:r[0], name:r[1], rar:r[2], arch:r[3], coat:r[4], spd:r[5],
          tough:(r[6]!==undefined?r[6]:undefined),
          spr:arch.spr, tint:coat.col, tintA:coat.a}; });
const _MOUNT_BY_ID={}; for(const m of MOUNT_DB) _MOUNT_BY_ID[m.id]=m;
function mountDef(id){ return _MOUNT_BY_ID[id]||null; }
// THE STARTER. Handed over at the Stable the first time any character reaches Lv20.
const MOUNT_STARTER = 'pony';
// The level the Stable opens at. Deliberately the same number as the bridge crossing and the
// onset of permadeath — the mount is what the game gives you when it stops forgiving you.
const MOUNT_LV = 20;

// The species value wins; the rarity baseline is only the fallback, so a row that omits `spd` or
// `tough` still behaves sensibly and adding a species is genuinely one line.
function mountSpdOf(m){ const d=mountDef(m); if(!d) return 1;
  return d.spd || MOUNT_SPD[d.rar] || 1.34; }
function mountToughOf(m){ const d=mountDef(m); if(!d) return 0.12;
  return (d.tough!==undefined) ? d.tough : (MOUNT_TOUGH[d.rar]||0.12); }

// ---- collection storage on the USER (survives character death), mirroring petStore() ----
function mountStore(){ const u=(typeof users!=='undefined'&&typeof curUser!=='undefined'&&curUser)?users[curUser]:null;
  if(!u) return null;
  if(!Array.isArray(u.mounts)) u.mounts=[];        // owned mount ids
  if(u.activeMount===undefined) u.activeMount=null;// id of the saddled mount
  if(u.mountLv===undefined) u.mountLv=0;           // highest level any character has reached
  return u; }
function saveMounts(){ if(typeof LS!=='undefined'&&typeof users!=='undefined') LS.set('er-users',users); }

// Owned list, richest first, so every panel shows the same order without sorting at each call site.
function mountsOwned(){ const u=mountStore(); if(!u) return [];
  return u.mounts.map(mountDef).filter(Boolean).sort((a,b)=>b.rar-a.rar||a.name.localeCompare(b.name)); }
function mountOwns(id){ const u=mountStore(); return !!u && u.mounts.indexOf(id)>=0; }
function activeMount(){ const u=mountStore(); if(!u||!u.activeMount) return null;
  return mountOwns(u.activeMount)?mountDef(u.activeMount):null; }
function setActiveMount(id){ const u=mountStore(); if(!u) return;
  u.activeMount=(id&&mountOwns(id))?id:null; saveMounts(); }

// ---- acquisition ----
// Returns true if this was a NEW mount. A duplicate is not an error and not a loss — it is simply
// already in the stable — so the caller can say so rather than silently swallowing the drop.
function giveMount(id){ const u=mountStore(), d=mountDef(id); if(!u||!d) return false;
  if(mountOwns(id)) return false;
  u.mounts.push(id);
  if(!u.activeMount) u.activeMount=id;             // auto-saddle your first
  saveMounts(); return true; }

// THE Lv20 GATE. Reads the highest level ANY character on the account has reached, not the level
// of the hero standing in front of the stablemaster: the collection is account-wide, so a fresh
// Lv1 alt on an account that has already been to the main island is not sent back to earn it
// again. This mirrors the Vault's ungated withdrawal decision rather than contradicting it.
function mountNoteLevel(lv){ const u=mountStore(); if(!u) return;
  if((lv|0)>(u.mountLv|0)){ u.mountLv=lv|0; saveMounts(); } }
function mountUnlocked(){ const u=mountStore(); if(!u) return false;
  const cur=(typeof rpg!=='undefined'&&rpg&&rpg.lvl)?rpg.lvl:0;   // the field is rpg.lvl, not rpg.lv
  return Math.max(u.mountLv|0, cur|0) >= MOUNT_LV; }

// ---- ride state ----
// player.mnt      the id of the mount under you, null when afoot
// player.mntDmg   damage taken since you got on, reset on every dismount
// player.mntCd    seconds until you may remount after being thrown
function mounted(){ return !!(typeof player!=='undefined' && player && player.mnt); }

// THE ATTACK GATE. Deliberately NOT folded into playerCanAct(): that function is also read by
// 07_update.js to decide whether the player is FROZEN, where it zeroes the movement speed
// outright. Adding "mounted" to it would pin a mounted player motionless in the saddle, which is
// the exact opposite of the feature. fire() and doAbility() call this instead.
function playerCanAttack(){
  if(typeof playerCanAct==='function' && !playerCanAct()) return false;
  return !mounted(); }

// Where a mount is allowed. Everywhere EXCEPT a live boss engagement (user's call). A boss ARENA
// is not the test — an arena you are merely standing in is fine; it is the FIGHT that throws you,
// so wandering a cleared lair still lets you ride out of it.
//
// bossEngaged() takes the ENTITY, not nothing: it answers "is the player in this fight", and the
// fight the player could be in is the one owning the bar. Called with no argument it reads
// `bossBar===undefined`, which is false for every live boss, so the rule would have silently
// never fired and a mount would have been rideable through every anchored phase in the game.
function mountAllowedHere(){
  if(typeof bossBar!=='undefined' && bossBar && typeof bossEngaged==='function'){
    try{ if(bossEngaged(bossBar)) return false; }catch(err){} }
  return true; }

// Begin climbing into the saddle. Returns true if the CAST STARTED — not if you are mounted, which
// is MOUNT_CAST seconds later and only if nothing interrupts.
function mountUp(id){
  if(!mountUnlocked()) return false;
  const u=mountStore(); if(!u) return false;
  const d=mountDef(id||u.activeMount); if(!d||!mountOwns(d.id)) return false;
  if(mounted()) return false;
  if((player.mntCast||0)>0) return false;                 // already climbing
  if((player.mntCd||0)>0) return false;
  if(!mountAllowedHere()){ if(typeof msg==='function') msg('NOT HERE','you cannot mount in a fight'); return false; }
  player.mntCast=MOUNT_CAST; player.mntCastId=d.id;
  if(typeof texts!=='undefined') texts.push({x:player.x,y:player.y-40,txt:'MOUNTING…',col:mountRarCol(d.rar),life:0.7});
  return true; }

// Abandon a cast in progress. `quiet` skips the notice for the cases the player already knows
// about (they pressed dismount, they got thrown).
function mountCancel(quiet){
  if(!(player.mntCast>0)) return false;
  player.mntCast=0; player.mntCastId=null;
  if(!quiet && typeof texts!=='undefined')
    texts.push({x:player.x,y:player.y-40,txt:'INTERRUPTED',col:'#e2604c',life:0.8});
  return true; }

// The cast landing. Split out of mountUp so tickMounts has one place to finish it.
function _mountSeat(id){
  const d=mountDef(id); if(!d||!mountOwns(d.id)) return false;
  player.mnt=d.id; player.mntDmg=0; player.mntCast=0; player.mntCastId=null;
  if(typeof texts!=='undefined') texts.push({x:player.x,y:player.y-40,txt:d.name.toUpperCase(),col:mountRarCol(d.rar),life:0.8});
  return true; }

// reason: 'player' | 'thrown' | 'boss'. Only a THROW starts the remount cooldown — getting off on
// purpose costs you nothing, which is what keeps the ride a choice rather than a commitment.
function dismount(reason){
  // a cast in flight is cancelled by anything that would dismount you, including your own input
  if(!mounted()){ return mountCancel(reason==='player'); }
  const d=mountDef(player.mnt);
  player.mnt=null; player.mntDmg=0; player.mntCast=0; player.mntCastId=null;
  if(reason==='thrown'||reason==='boss'){
    player.mntCd=MOUNT_THROW_CD;
    if(typeof texts!=='undefined') texts.push({x:player.x,y:player.y-44,txt:'THROWN',col:'#e2604c',life:0.9});
    if(typeof boom==='function' && d) boom(player.x,player.y,mountRarCol(d.rar),14);
  }
  return true; }

function mountToggle(){ if(mounted()) return dismount('player'); return mountUp(null); }

// ---- damage feeds the throw. Called from damagePlayer so EVERY source counts: touch, enemy
// shots, boss hazards and the client-side hazard paths in 14b_netsync.js all route through it,
// which is the only reason this needs exactly one hook instead of a dozen. ----
function mountTookDamage(hit){
  if(!(hit>0)) return;
  // being hit while climbing knocks you back off the stirrup. No throw cooldown for this — you
  // never got up, so the punishment is the time you wasted, not a lockout on top of it.
  if(!mounted()){ if(player.mntCast>0) mountCancel(false); return; }
  player.mntDmg=(player.mntDmg||0)+hit;
  const cap=Math.max(1, (player.maxhp||100)*mountToughOf(player.mnt));
  if(player.mntDmg>=cap) dismount('thrown'); }

// ---- per-frame. Runs the remount cooldown and enforces the boss rule. ----
function tickMounts(dt){
  if(typeof player==='undefined'||!player) return;
  if((player.mntCd||0)>0){ player.mntCd=Math.max(0,player.mntCd-dt); }
  // the climb. A fight starting mid-cast cancels it for the same reason it throws a rider.
  if(player.mntCast>0){
    if(!mountAllowedHere()) mountCancel(false);
    else { player.mntCast-=dt; if(player.mntCast<=0) _mountSeat(player.mntCastId); } }
  if(mounted() && !mountAllowedHere()) dismount('boss');
  // the HUD button reads state that changes without any input (the throw, the cooldown running
  // out), so it is refreshed here rather than only on click
  if(typeof hudMounts==='function') hudMounts(); }

// The factor the player's speed chain multiplies in. 1 when afoot, so it is always safe to call.
function mountSpdMul(){ return mounted()?mountSpdOf(player.mnt):1; }

// ============================================================
//  MOUNT DROPS
// ------------------------------------------------------------
//  Rare mounts turn up as loot anywhere in the game, at VERY low rates (user, 2026-07-27). They
//  ride in the CREATURE SACK with pet eggs — never in the gear sack — see CREATURE_BAND in 11_ui.js.
//
//  The rate is per-kill and deliberately tiny. These are account-permanent, they never expire, and
//  there are only nine of them, so a rate that feels generous in a session is a collection finished
//  in a weekend. A boss is the reliable source; trash is a lottery ticket.
//
//  WHICH mount you get is rolled on the shared rarity ladder and weighted DOWN hard, then matched
//  to a species of that rarity. A duplicate is re-rolled once against what you do not already own,
//  so late in a collection the drop is far more likely to be something new — but if you own
//  everything the drop is simply refused and the sack does not spawn, rather than paying you a
//  ninth Field Pony that the Stable would silently swallow.
// ============================================================
const MOUNT_DROP_P = {B:0.010, s:0.0009, c:0.0006, N:0.0006};   // boss 1%, elites x3 below, trash ~0.06%
const MOUNT_DROP_RAR = [0.52, 0.28, 0.13, 0.055, 0.015];        // Common..Legendary, weighted down

function _mountPickRar(){ const r=Math.random(); let a=0;
  for(let i=0;i<MOUNT_DROP_RAR.length;i++){ a+=MOUNT_DROP_RAR[i]; if(r<a) return i; }
  return 0; }
// closest species of that rarity, preferring one not already stabled
function _mountOfRar(rar,unowned){
  let pool=MOUNT_DB.filter(m=>m.rar===rar);
  if(!pool.length){ // no species at that exact rarity — walk outward rather than dropping nothing
    let best=null,bd=99; for(const m of MOUNT_DB){ const d=Math.abs(m.rar-rar); if(d<bd){bd=d;best=m;} }
    pool=best?MOUNT_DB.filter(m=>m.rar===best.rar):[]; }
  if(unowned){ const fresh=pool.filter(m=>!mountOwns(m.id)); if(fresh.length) pool=fresh; }
  return pool.length?pool[Math.floor(Math.random()*pool.length)]:null; }

// Returns a {k:'mount',id} loot item or null. Mirrors eggDropFor/petFoodDropFor's shape so
// rollLoot treats all three the same way.
function mountDropFor(e){
  if(!e || e.node) return null;
  if(typeof mountUnlocked==='function' && !mountUnlocked()) return null;  // no drops before the Stable opens
  // THE Lv20-50 ZONE ONLY (user, 2026-07-27) — that is the MAIN ISLAND, and onMainIsland is
  // already the game's word for it: the same bridge crossing that opens the Stable, makes a hero
  // permanent and starts the Lv20+ curve. The starter island stays a place you learn on and take
  // nothing permanent from, which is the whole reason it never took permadeath either.
  if(typeof onMainIsland==='function' && !onMainIsland(e.x,e.y)) return null;
  let p=MOUNT_DROP_P[e.type]||MOUNT_DROP_P.c;
  if(e.elite) p*=3;
  const F=(typeof player!=='undefined'&&player.fortune)||0;
  p*=(1+F*0.012);                                   // Fortune moves it, like every other drop
  if(Math.random()>=p) return null;
  // roll, then give the re-roll a chance to find something new
  let d=_mountOfRar(_mountPickRar(), true);
  if(d && mountOwns(d.id)) d=_mountOfRar(_mountPickRar(), true);
  if(!d || mountOwns(d.id)) return null;            // collection complete: no sack rather than a dud
  return {k:'mount', id:d.id, rar:d.rar}; }

// PICKUP. A mount goes to the Stable, never to the satchel — the same rule eggs follow to the
// incubator. Returns true if it was consumed, so the award path can treat it like any other item.
function mountTake(it){
  if(!it || it.k!=='mount') return false;
  const d=mountDef(it.id); if(!d) return true;      // unknown id: swallow it rather than stranding a bag
  const isNew=giveMount(d.id);
  if(typeof msg==='function') msg(isNew?'A MOUNT':'ALREADY STABLED', d.name+(isNew?' is yours':' — you have one'));
  if(typeof texts!=='undefined'&&typeof player!=='undefined')
    texts.push({x:player.x,y:player.y-34,txt:d.name.toUpperCase(),col:mountRarCol(d.rar),life:1.5});
  return true; }

// ---- art. Lazy per species, exactly like relicArtImg/pet sets: nine images cost nothing until
// one is actually saddled. ----
const _mountArt={};
function mountImg(spr){ if(typeof window==='undefined'||!spr) return null;
  if(_mountArt[spr]===undefined){ const i=new Image(); i.src='assets/mounts/'+spr+'.png'; _mountArt[spr]=i; }
  const im=_mountArt[spr]; return (im&&im.complete&&im.naturalWidth)?im:null; }
// A SPECIES IS AN ARCHETYPE IN A COAT. The archetype owns the drawing; the coat is a tint, cached
// by _tintImg on (src,col,alpha) so seventy-eight mounts cost twelve images and one canvas each
// the first time they are looked at. Returns null while the archetype is still loading — every
// caller already falls back, and a lazily-loaded Image returns null on the FIRST call because that
// call is what starts the load.
function mountArtFor(m){
  const d=(typeof m==='string')?mountDef(m):m; if(!d) return null;
  const im=mountImg(d.spr); if(!im) return null;
  if(!d.tint || typeof _tintImg!=='function') return im;
  return _tintImg(im, d.tint, d.tintA||0.3, 0); }

// Panels are built as HTML strings, so their <img> tags cannot carry a canvas. They are stamped
// with data-mount-img instead and resolved here once the markup is in the DOM. Anything still
// loading is retried on the next paint rather than being left blank forever — mountImg returns
// null on the FIRST call for a species because that call is what starts the download.
function mountPaintImgs(root){
  if(!root||typeof document==='undefined') return;
  const list=root.querySelectorAll('img[data-mount-img]');
  for(const el of list){
    const d=mountDef(el.getAttribute('data-mount-img')); if(!d) continue;
    const art=mountArtFor(d);
    if(!art){ if(!el._mRetry){ el._mRetry=1; setTimeout(()=>mountPaintImgs(root),220); } continue; }
    try{ el.src=(art.toDataURL?art.toDataURL():art.src); }catch(err){}
  } }

// ============================================================
//  THE STABLE — the Hearth's paddock (00b_hearth.js `stable`)
// ------------------------------------------------------------
//  Opened AT the paddock via a portalPrompt like every other stall, never from a HUD button, and
//  it does NOT set portalLock — closing the panel at the gate would otherwise lock you out of it.
//  Reuses the vault's shopCard/shopInner shell so it inherits a frame fit that was already
//  measured against equip_panel's percentage inset instead of re-earning it.
// ============================================================
let _stableSel=null;

// THE Lv20 HANDOVER. Claimed at the stable rather than posted through the door on level-up: the
// reward wants a place, the same way fusion does, and arriving to collect it is what makes the
// paddock somewhere you go rather than scenery you walk past.
function stableClaim(){
  if(!mountUnlocked()) return false;
  if(mountOwns(MOUNT_STARTER)) return false;
  const got=giveMount(MOUNT_STARTER);
  if(got && typeof msg==='function'){ const d=mountDef(MOUNT_STARTER);
    msg('THE STABLE', (d?d.name:'A mount')+' is yours'); }
  return got; }

function openStable(){
  const s=(typeof $s==='function')?$s('stableScr'):document.getElementById('stableScr');
  if(!s) return;
  stableClaim();                     // walking up at Lv20 is what hands the starter over
  _stableSel=(activeMount()||{}).id||null;
  s.style.display='flex';
  paintStable(); }
function closeStable(){
  const s=(typeof $s==='function')?$s('stableScr'):document.getElementById('stableScr');
  if(s) s.style.display='none'; }

function paintStable(){
  const cnt=(typeof $s==='function')?$s('stableCount'):document.getElementById('stableCount');
  const list=(typeof $s==='function')?$s('stableList'):document.getElementById('stableList');
  const sel=(typeof $s==='function')?$s('stableSel'):document.getElementById('stableSel');
  const btn=(typeof $s==='function')?$s('stableSaddle'):document.getElementById('stableSaddle');
  if(!list) return;
  const owned=mountsOwned(), act=activeMount();

  if(cnt) cnt.innerHTML= mountUnlocked()
    ? '<span class="purse">'+owned.length+' of '+MOUNT_DB.length+' mounts stabled</span>'
    : '<span class="purse">The stablemaster turns you away — reach level '+MOUNT_LV+'</span>';

  list.innerHTML='';
  if(!mountUnlocked()){
    const d=document.createElement('div'); d.className='mnote';
    d.textContent='Mounts are for riders who have crossed the bridge. Reach level '+MOUNT_LV+' and come back.';
    list.appendChild(d);
  } else if(!owned.length){
    const d=document.createElement('div'); d.className='mnote';
    d.textContent='Empty stalls. Rare mounts are found out in the world.';
    list.appendChild(d);
  } else for(const m of owned){
    const on=act&&act.id===m.id, isSel=_stableSel===m.id;
    const c=document.createElement('div');
    c.className='embChip'+(isSel?' sel':'')+(on?' on':'');
    c.style.borderColor=mountRarCol(m.rar);
    const im=mountImg(m.spr);
    if(im){ const cv=document.createElement('canvas'); cv.width=48; cv.height=40; cv.className='isprite';
      const cc=cv.getContext('2d'); cc.imageSmoothingEnabled=false;
      // SIZE BY THE OPAQUE BOX, never naturalWidth — PixelLab files carry transparent margin and
      // scaling by canvas size is what made the relic sack the smallest bag in the game.
      const bb=(typeof _imgBBox==='function')?_imgBBox(im):null;
      const sw=bb?bb.w:im.naturalWidth, sh=bb?bb.h:im.naturalHeight;
      const sx=bb?bb.x:0, sy=bb?bb.y:0;
      const k=Math.min(46/Math.max(1,sw), 38/Math.max(1,sh));
      cc.drawImage(im, sx,sy,sw,sh, (48-sw*k)/2,(40-sh*k)/2, sw*k, sh*k);
      c.appendChild(cv); }
    const n=document.createElement('div'); n.className='cn'; n.textContent=m.name; c.appendChild(n);
    const r=document.createElement('div'); r.className='cd'; r.style.color=mountRarCol(m.rar);
    r.textContent=mountRarName(m.rar)+(on?' · SADDLED':''); c.appendChild(r);
    c.onclick=function(){ _stableSel=m.id; paintStable(); };
    list.appendChild(c); }

  const m=_stableSel?mountDef(_stableSel):null;
  if(sel) sel.textContent = m
    ? m.name+' — '+Math.round((mountSpdOf(m.id)-1)*100)+'% faster afoot, thrown after '
      +Math.round(mountToughOf(m.id)*100)+'% of your health in damage'
    : (mountUnlocked()?'Pick a mount':'Come back at level '+MOUNT_LV);
  if(btn){ const can=!!(m&&mountOwns(m.id));
    btn.disabled=!can; btn.style.opacity=can?1:0.45;
    btn.textContent=(m&&activeMount()&&activeMount().id===m.id)?'UNSADDLE':'SADDLE IT'; } }

// ============================================================
//  DRAWING THE RIDE
// ------------------------------------------------------------
//  Called from the hero's own draw in 09_sprites.js, immediately BEFORE the hero blit so the
//  mount is underneath him, and it returns the LIFT — how far up the rider has to move so he sits
//  in the saddle instead of standing through the animal's back.
//
//  SIZED BY THE OPAQUE BOUNDING BOX, never naturalWidth. Every one of these is a 64x64 PixelLab
//  canvas and the animal inside it occupies a different fraction of each — scaling by canvas size
//  is exactly what made the relic sack the smallest bag in the game and the Hearth flock render as
//  specks. The bbox is what tells us how big the animal actually is.
// ============================================================
// Target on-screen height of the ANIMAL ITSELF (its opaque box, not its canvas). The hero draws
// 63px tall here (a 74px opaque box at EMBER_SC 0.85), and a mount that is not at least his height
// reads as a large dog he is standing over rather than something carrying him — the first pass at
// 46px measured 0.73x and vanished behind him almost completely.
const MOUNT_DRAW_H = 58;
// Where the saddle sits, as a fraction of the animal's height up from its feet. One number for all
// twelve archetypes: they are all quadruped-ish profiles of roughly the same build, and measuring
// off the DRAWN height rather than assuming a canvas position is what lets a wolf and a destrier
// share it.
const MOUNT_SEAT = 0.55;
// How far below the player's own y the animal's feet plant. Small and positive so it beds into the
// ground a touch rather than floating at the exact anchor.
const MOUNT_FOOT = 6;

function mountDrawUnder(x,y,bob,faceAng,moving,clock){
  if(!mounted() || typeof blit!=='function') return 0;
  const d=mountDef(player.mnt); if(!d) return 0;
  const art=mountArtFor(d); if(!art) return 0;
  // OPAQUE BOX, never the canvas. _imgBBox caches on src, and the tinted canvas keeps the source's
  // geometry, so measuring the untinted archetype is both correct and cheaper. Every one of these
  // is a 64x64 PixelLab canvas with a different amount of transparent margin — scaling by canvas
  // size is exactly what made the relic sack the smallest bag in the game.
  const base=mountImg(d.spr);
  const bb=(typeof _imgBBox==='function'&&base)?_imgBBox(base):null;
  const realH=(bb&&bb.h)?bb.h:(art.height||64);
  const sc=MOUNT_DRAW_H/Math.max(1,realH);
  const gait=moving?Math.sin((clock||0)*13+1.1)*1.6:Math.sin((clock||0)*3)*0.5;
  const flip=Math.cos(faceAng)<0;
  // blit CENTRES on the point it is given, so to plant the animal's FEET we have to work back
  // from where its opaque box ends inside its own canvas.
  const canvasH=art.height||64;
  const footInCanvas=bb?(bb.y+bb.h):canvasH;               // px from canvas top down to its feet
  const centreY = y + MOUNT_FOOT + (canvasH*sc)/2 - footInCanvas*sc + gait*0.4;
  blit(art, x, centreY, sc, flip);
  // Lift the rider so his feet land on the saddle rather than on the floor beside it. Derived from
  // the same numbers that placed the animal, so changing MOUNT_DRAW_H moves both together.
  //   mount feet      = y + MOUNT_FOOT
  //   saddle          = feet - MOUNT_DRAW_H*MOUNT_SEAT
  //   hero feet drawn = y - 8 - lift + heroDrawnHeight/2      (09_sprites blits him centred)
  const HERO_HALF=31;                                       // 74px opaque box at EMBER_SC 0.85, halved
  const saddle = MOUNT_FOOT - MOUNT_DRAW_H*MOUNT_SEAT;
  return (23 - saddle) - (31-HERO_HALF) + gait*0.4; }

// ============================================================
//  THE MOUNTS TAB — inside the companion panel (user, 2026-07-27)
// ------------------------------------------------------------
//  Mounts and pets are the same KIND of thing: a creature you collect, that lives on the account
//  and survives permadeath, that you pick one of at a time. They drop in the same carrier. So they
//  read out of the same panel rather than two, and this is a TAB beside COMPANION and FEED.
//
//  The STABLE is still where a mount is CLAIMED -- that is a place you go, like the Fusion Altar --
//  but riding one should never require walking back to town, so saddling and mounting live here,
//  in the panel you can open anywhere.
//
//  Markup deliberately mirrors _petTabEquipped: same embHero / embSect / embStrip / embChip
//  classes, so the two tabs are visibly one UI and no new CSS is needed.
// ============================================================
function _petTabMounts(u){
  if(!mountUnlocked())
    return '<div class="embEmpty">No mounts yet.<br><span class="embDim">'
      +'The Stable in the Hearth opens at level '+MOUNT_LV+' — the same crossing that makes a hero '
      +'permanent. Rare mounts are also found out in the world.</span></div>';
  const owned=mountsOwned();
  if(!owned.length)
    return '<div class="embEmpty">The stalls are empty.<br><span class="embDim">'
      +'Claim your first mount at the Stable in the Hearth.</span></div>';
  const a=activeMount();
  let h='';
  if(a){
    const spd=Math.round((mountSpdOf(a.id)-1)*100), tough=Math.round(mountToughOf(a.id)*100);
    const up=mounted();
    h+='<div class="embHero">'
      +'<img class="embHeroImg" data-mount-img="'+a.id+'" src="assets/mounts/'+a.spr+'.png">'
      +'<div class="embHeroTx">'
        +'<div class="embHeroNm" style="color:'+mountRarCol(a.rar)+'">'+a.name+'</div>'
        +'<div class="embDim"><b style="color:'+mountRarCol(a.rar)+'">'+mountRarName(a.rar)+'</b>'
          +' · '+(up?'<span style="color:#ffe08a">in the saddle</span>':'stabled')+'</div>'
        +'<div class="embLv">+'+spd+'% <span class="embDim">move speed</span></div>'
        +'<div class="embDim">thrown after '+tough+'% of your health in damage</div>'
        +'<div class="embDim">a mount carries you unarmed — no attacks, no abilities</div>'
      +'</div></div>'
      +'<div class="embBtns" style="margin:8px 0;">'
      +'<button class="embBtn'+(up?'':' go')+'" id="mountRide">'+(up?'DISMOUNT':'MOUNT UP')+'</button></div>';
  }
  h+='<div class="embSect">YOUR MOUNTS ('+owned.length+' / '+MOUNT_DB.length+')</div><div class="embStrip">';
  for(const m of owned){
    const on=a&&a.id===m.id;
    h+='<div class="embChip'+(on?' on':'')+'" data-mount="'+m.id+'">'
      +'<img data-mount-img="'+m.id+'" src="assets/mounts/'+m.spr+'.png">'
      +'<div class="embChipNm" style="color:'+mountRarCol(m.rar)+'">'+m.name+'</div>'
      +'<div class="embDim">+'+Math.round((mountSpdOf(m.id)-1)*100)+'%</div></div>'; }
  return h+'</div>'; }

// ---- the HUD toggle. Shown only once there is something to ride, so a hero who has never seen
// the Stable never carries a button that would only ever refuse them. ----
// MOBILE ONLY (user, 2026-07-27). PC has the V key, and a HUD button PC never presses is a button
// PC has to look past forever. `inputMode` is set by 05_controls on the first real input, so this
// follows the player rather than sniffing the user agent — a tablet with a keyboard gets whichever
// one they actually used last.
function hudMounts(){
  if(typeof document==='undefined') return;
  const b=document.getElementById('mountBtn'); if(!b) return;
  const touch=(typeof inputMode==='undefined')||inputMode!=='pc';
  const has=touch && mountUnlocked() && !!activeMount();
  b.style.display=has?'flex':'none';
  if(!has) return;
  const casting=(player.mntCast||0)>0, cd=(player.mntCd||0)>0;
  b.className=[mounted()?'up':'', (cd&&!casting)?'cd':'', casting?'cast':''].filter(Boolean).join(' ');
  const m=activeMount();
  // the climb is the one state worth showing a number for — it is short, and you are committed
  if(casting) b.style.setProperty('--castP', Math.round(100*(1-player.mntCast/MOUNT_CAST))+'%');
  else b.style.removeProperty('--castP');
  b.title = casting ? 'Mounting…'
    : mounted() ? ('Dismount '+m.name)
    : cd ? ('Thrown — remount in '+Math.ceil(player.mntCd)+'s')
    : ('Mount '+m.name); }

// wired once the DOM exists; the panel's buttons live in index.html beside the vault's
(function(){ if(typeof document==='undefined') return;
  function wire(){
    const cl=document.getElementById('stableClose'), sd=document.getElementById('stableSaddle');
    if(cl) cl.onclick=function(){ closeStable(); };
    if(sd) sd.onclick=function(){
      if(!_stableSel) return;
      const cur=activeMount();
      if(cur&&cur.id===_stableSel){ setActiveMount(null); if(mounted()) dismount('player'); }
      else setActiveMount(_stableSel);
      paintStable(); hudMounts(); };
    const mb=document.getElementById('mountBtn');
    if(mb) mb.onclick=function(){ if(typeof mountToggle==='function') mountToggle(); hudMounts(); };
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',wire); else wire();
})();
