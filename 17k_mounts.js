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

// ---- the roster. spr = assets/mounts/<spr>.png ----
// Ground mounts only for now; flight is a separate decision and a separate collision path.
const MOUNT_DB = [
  {id:'pony',      name:'Field Pony',        rar:0, spr:'pony'},
  {id:'mule',      name:'Ash Mule',          rar:0, spr:'mule'},
  {id:'stag',      name:'Moorland Stag',     rar:1, spr:'stag'},
  {id:'courser',   name:'Salt Courser',      rar:1, spr:'courser'},
  {id:'dunestrid', name:'Dunestrider',       rar:2, spr:'dunestrider'},
  {id:'bramble',   name:'Bramblehorn Elk',   rar:2, spr:'bramblehorn'},
  {id:'embermane', name:'Embermane Charger', rar:3, spr:'embermane'},
  {id:'frosthoof', name:'Frosthoof Destrier',rar:3, spr:'frosthoof'},
  {id:'riftrunner',name:'Riftrunner',        rar:4, spr:'riftrunner'},
];
function mountDef(id){ for(let i=0;i<MOUNT_DB.length;i++) if(MOUNT_DB[i].id===id) return MOUNT_DB[i]; return null; }
// THE STARTER. Handed over at the Stable the first time any character reaches Lv20.
const MOUNT_STARTER = 'pony';
// The level the Stable opens at. Deliberately the same number as the bridge crossing and the
// onset of permadeath — the mount is what the game gives you when it stops forgiving you.
const MOUNT_LV = 20;

function mountSpdOf(m){ const d=mountDef(m); return d?(MOUNT_SPD[d.rar]||1.34):1; }
function mountToughOf(m){ const d=mountDef(m); return d?(MOUNT_TOUGH[d.rar]||0.12):0.12; }

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

function mountUp(id){
  if(!mountUnlocked()) return false;
  const u=mountStore(); if(!u) return false;
  const d=mountDef(id||u.activeMount); if(!d||!mountOwns(d.id)) return false;
  if(mounted()) return false;
  if((player.mntCd||0)>0) return false;
  if(!mountAllowedHere()){ if(typeof msg==='function') msg('NOT HERE','you cannot mount in a fight'); return false; }
  player.mnt=d.id; player.mntDmg=0;
  if(typeof texts!=='undefined') texts.push({x:player.x,y:player.y-40,txt:d.name.toUpperCase(),col:mountRarCol(d.rar),life:0.8});
  return true; }

// reason: 'player' | 'thrown' | 'boss'. Only a THROW starts the remount cooldown — getting off on
// purpose costs you nothing, which is what keeps the ride a choice rather than a commitment.
function dismount(reason){
  if(!mounted()) return false;
  const d=mountDef(player.mnt);
  player.mnt=null; player.mntDmg=0;
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
  if(!mounted() || !(hit>0)) return;
  player.mntDmg=(player.mntDmg||0)+hit;
  const cap=Math.max(1, (player.maxhp||100)*mountToughOf(player.mnt));
  if(player.mntDmg>=cap) dismount('thrown'); }

// ---- per-frame. Runs the remount cooldown and enforces the boss rule. ----
function tickMounts(dt){
  if(typeof player==='undefined'||!player) return;
  if((player.mntCd||0)>0){ player.mntCd=Math.max(0,player.mntCd-dt); }
  if(mounted() && !mountAllowedHere()) dismount('boss'); }

// The factor the player's speed chain multiplies in. 1 when afoot, so it is always safe to call.
function mountSpdMul(){ return mounted()?mountSpdOf(player.mnt):1; }

// ---- art. Lazy per species, exactly like relicArtImg/pet sets: nine images cost nothing until
// one is actually saddled. ----
const _mountArt={};
function mountImg(spr){ if(typeof window==='undefined'||!spr) return null;
  if(_mountArt[spr]===undefined){ const i=new Image(); i.src='assets/mounts/'+spr+'.png'; _mountArt[spr]=i; }
  const im=_mountArt[spr]; return (im&&im.complete&&im.naturalWidth)?im:null; }
