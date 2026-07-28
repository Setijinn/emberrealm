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

// ============================================================
//  FLIGHT (Lv40+, user 2026-07-28)
// ------------------------------------------------------------
//  A FLYING MOUNT IS PURE TRAVERSAL. Nothing can reach you and you can reach nothing: no enemy
//  damages a flyer, and the mounted attack lockout already means you cannot hit back. The user
//  chose the strongest, simplest form of the rule on purpose, and it is self-balancing precisely
//  BECAUSE it is total — untouchable is only broken if you can also act, and you cannot.
//  ("We may change this later" — if it ever softens, `flyUntouchable()` is the one seam to widen,
//  and an `air:1` archetype flag on bird/wisp/swarm is the obvious shape for who gets through.)
//
//  IT CLEARS WATER, AND WATER ONLY. Not walls, not lair walls, not locked gates — 'W' is the VOID
//  inside a dungeon and 'X'/'D' are how the world gates its own content. See 04_collision.js.
//
//  THERE IS NO AUTO-LANDING (user, 2026-07-28). Getting off puts you down exactly where you are,
//  or not at all: if the ground beneath you will not hold a hero, the dismount simply does not
//  happen and you keep flying. Nothing searches for a nearby shore and nothing moves you — an
//  earlier pass did, and being teleported to ground you did not fly to is a worse surprise than
//  staying up. mountCanLandHere() is the whole rule.
const MOUNT_FLY_LV = 40;
function mountIsFlyer(m){ const d=mountDef(m); return !!(d&&d.fly); }
// Has this ACCOUNT earned flight? Same account-wide reading as the Lv20 stable gate: the highest
// level any character reached, so an alt does not have to climb to 40 again.
function mountFlyOk(){ const u=mountStore(); if(!u) return false;
  const cur=(typeof rpg!=='undefined'&&rpg&&rpg.lvl)?rpg.lvl:0;
  return Math.max(u.mountLv|0, cur|0) >= MOUNT_FLY_LV; }
// Is the player in the air RIGHT NOW? Read by collision, by the damage gate and by the renderer.
function playerIsFlying(){ return mounted() && mountIsFlyer(player.mnt); }
// The single seam for "who can touch a flyer". Today: nobody. Widening this is how the rule
// softens later, and it is deliberately a function rather than a constant for that reason.
function flyUntouchable(){ return playerIsFlying(); }

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
  // ---- the six WINGED archetypes. Only species with fly:1 use these, and the art is drawn
  // wings-spread mid-beat because a flyer is never shown standing. ----
  griffon:  {n:'griffon',   spr:'arch_griffon',  air:1},
  wyvern:   {n:'wyvern',    spr:'arch_wyvern',   air:1},
  pegasus:  {n:'pegasus',   spr:'arch_pegasus',  air:1},
  roc:      {n:'roc',       spr:'arch_roc',      air:1},
  moth:     {n:'moth',      spr:'arch_moth',     air:1},
  skywyrm:  {n:'sky wyrm',  spr:'arch_skywyrm',  air:1},
  // ---- THE DRAGONS. Endgame, and deliberately only two drawings: a dragon has to stay rare
  // enough to mean something, and eighteen dragon variants would make it wallpaper. ----
  dragon:   {n:'dragon',    spr:'arch_dragon',   air:1},
  infernal: {n:'infernal',  spr:'arch_infernal', air:1},
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
// ---- THE FLYERS (Lv40+). A separate table only so the ground roster above stays readable and
// so "is anything flying?" is answerable by looking at one place.
//
// They sit at Rare and above because flight is the endgame reward, and their SPEEDS deliberately
// overlap the top of the ground roster rather than exceeding it. A flyer's prize is that nothing
// can touch it and water is not a wall — handing it the speed crown as well would retire every
// ground mount in the game the moment you turned 40, and there are 78 of those.
//
// [id, name, rarity, arch, coat, speed, tough?] — the trailing `1` marks it a flyer.
const _FLYERS = [
  // ---- RARE (2): the light flyers. Moths and the smaller wings. 1.46-1.58 ----
  ['mothdawn', 'Dawn Skiff',        2,'moth',   'dawn',    1.50],
  ['mothpale', 'Pale Moth',         2,'moth',   'spirit',  1.52],
  ['mothember','Cinder Moth',       2,'moth',   'ember',   1.54],
  ['mothgreen','Orchard Moth',      2,'moth',   'verdant', 1.48],
  ['mothvoid', 'Riftwing Moth',     2,'moth',   'void',    1.56],
  ['mothfrost','Hoarfrost Moth',    2,'moth',   'frost',   1.51, 0.26],
  ['mothstorm','Static Moth',       2,'moth',   'storm',   1.57],
  ['mothbog',  'Fen Moth',          2,'moth',   'bog',     1.46, 0.28],
  ['grifstone','Grey Griffon',      2,'griffon','stone',   1.55, 0.27],
  ['grifsand', 'Dune Griffon',      2,'griffon','sand',    1.58],
  ['rocstone', 'Crag Roc',          2,'roc',    'stone',   1.53, 0.29],
  ['rocsand',  'Dune Roc',          2,'roc',    'sand',    1.57],
  ['pegplain', 'White Pegasus',     2,'pegasus','plain',   1.56],
  ['wyrmtide', 'Reef Wyrm',         2,'skywyrm','tide',    1.54],
  // ---- EPIC (3): 1.55-1.70 ----
  ['grifstorm','Storm Griffon',     3,'griffon','storm',   1.66],
  ['grifash',  'Ashen Griffon',     3,'griffon','ash',     1.62],
  ['griffrost','Rime Griffon',      3,'griffon','frost',   1.60, 0.30],
  ['grifgreen','Wood Griffon',      3,'griffon','verdant', 1.63],
  ['rocfrost', 'Rime Roc',          3,'roc',    'frost',   1.63, 0.30],
  ['rocash',   'Ashfall Roc',       3,'roc',    'ash',     1.61],
  ['roctide',  'Gale Roc',          3,'roc',    'tide',    1.65],
  ['rocvoid',  'Rift Roc',          3,'roc',    'void',    1.68],
  ['wyvash',   'Ashen Wyvern',      3,'wyvern', 'ash',     1.67],
  ['wyvbog',   'Mire Wyvern',       3,'wyvern', 'bog',     1.58, 0.31],
  ['wyvember', 'Ember Wyvern',      3,'wyvern', 'ember',   1.69],
  ['wyvfrost', 'Glacier Wyvern',    3,'wyvern', 'frost',   1.62, 0.30],
  ['wyvstorm', 'Tempest Wyvern',    3,'wyvern', 'storm',   1.70],
  ['wyvtide',  'Brine Wyvern',      3,'wyvern', 'tide',    1.64],
  ['pegmoor',  'Moorland Pegasus',  3,'pegasus','verdant', 1.64],
  ['pegtide',  'Tidewing',          3,'pegasus','tide',    1.65],
  ['pegfrost', 'Snowmane Pegasus',  3,'pegasus','frost',   1.61, 0.29],
  ['pegspirit','Pale Pegasus',      3,'pegasus','spirit',  1.67],
  ['pegstorm', 'Galemane',          3,'pegasus','storm',   1.69],
  ['wyrmgreen','Green Sky Wyrm',    3,'skywyrm','verdant', 1.68],
  ['wyrmspir', 'Spirit Wyrm',       3,'skywyrm','spirit',  1.66],
  ['wyrmash',  'Ash Wyrm',          3,'skywyrm','ash',     1.59],
  // ---- LEGENDARY (4): 1.68-1.84 ----
  ['grifdawn', 'Dawn Griffon',      4,'griffon','dawn',    1.74],
  ['grifblood','Bloodfeather',      4,'griffon','blood',   1.79],
  ['wyvblood', 'Blood Wyvern',      4,'wyvern', 'blood',   1.78],
  ['wyvvoid',  'Rift Wyvern',       4,'wyvern', 'void',    1.80],
  ['pegdawn',  'Dawnwing',          4,'pegasus','dawn',    1.76],
  ['pegember', 'Emberwing Pegasus', 4,'pegasus','ember',   1.73],
  ['rocstorm', 'Thunder Roc',       4,'roc',    'storm',   1.75, 0.32],
  ['rocdawn',  'The Sun Eagle',     4,'roc',    'dawn',    1.72, 0.33],
  ['wyrmvoid', 'The Long Dark',     4,'skywyrm','void',    1.82],
  ['wyrmdawn', 'The First Light',   4,'skywyrm','dawn',    1.79, 0.31],
  ['wyrmblood','The Red Coil',      4,'skywyrm','blood',   1.83],
  ['wyrmstorm','The Sky Serpent',   4,'skywyrm','storm',   1.81],
  ['mothspir', 'The Lantern Moth',  4,'moth',   'spirit',  1.70, 0.34],
  ['grifvoid', 'Voidfeather',       4,'griffon','void',    1.84],
  ['pegvoid',  'The Pale Rider',    4,'pegasus','void',    1.77],
  ['wyvdawn',  'Dawnscale',         4,'wyvern', 'dawn',    1.71, 0.33],
];
// ---- THE DRAGONS. The apex of the collection, and the only mounts allowed above the ground
// roster's 1.84 ceiling. That exception is earned: they sit at the bottom of the drop table, they
// are Legendary only, and there are two drawings rather than eighteen precisely so a dragon stays
// rare enough to mean something. Themed on the same coats as everything else, so a frost dragon
// reads frost the way every frost thing in this game reads frost.
//
// `dragon` is the ancient horned wyrm; `infernal` is the molten one with lava between its plates,
// so the coats land differently on each — an ash INFERNAL is a cooling volcano, an ash DRAGON is
// a grey old monster.
const _DRAGONS = [
  ['drgember',  'Cinderwyrm',            4,'dragon',  'ember',   1.88],
  ['drgfrost',  'Rimefang',              4,'dragon',  'frost',   1.85, 0.36],
  ['drgstorm',  'Tempest Wyrm',          4,'dragon',  'storm',   1.90],
  ['drgvoid',   'The Rift Devourer',     4,'dragon',  'void',    1.92],
  ['drgblood',  'The Red Ruin',          4,'dragon',  'blood',   1.89],
  ['drgdawn',   'Aurelian, the Gilded',  4,'dragon',  'dawn',    1.84, 0.38],
  ['drgstone',  'The Mountain Father',   4,'dragon',  'stone',   1.82, 0.42],
  ['drgverd',   'The Jade Wyrm',         4,'dragon',  'verdant', 1.86],
  ['drgtide',   'The Drowned King',      4,'dragon',  'tide',    1.87],
  ['drgash',    'The Grey Wyrm',         4,'dragon',  'ash',     1.85],
  ['infember',  'Embermaw',              4,'infernal','ember',   1.91],
  ['infblood',  'The Blood Forge',       4,'infernal','blood',   1.90],
  ['infvoid',   'That Which Burns Cold', 4,'infernal','void',    1.92],
  ['infash',    'The Dying Volcano',     4,'infernal','ash',     1.86, 0.40],
  ['infstorm',  'Thunderscale',          4,'infernal','storm',   1.89],
  ['infspirit', 'The Pale Flame',        4,'infernal','spirit',  1.88],
];
function _mkMount(r,fly){
  const arch=MOUNT_ARCH[r[3]]||MOUNT_ARCH.horse, coat=MOUNT_COATS[r[4]]||MOUNT_COATS.plain;
  const m={id:r[0], name:r[1], rar:r[2], arch:r[3], coat:r[4], spd:r[5],
           tough:(r[6]!==undefined?r[6]:undefined),
           spr:arch.spr, tint:coat.col, tintA:coat.a};
  if(fly) m.fly=1;
  return m; }
const MOUNT_DB = _MOUNTS.map(function(r){ return _mkMount(r,0); })
       .concat(_FLYERS.map(function(r){ return _mkMount(r,1); }))
       .concat(_DRAGONS.map(function(r){ const m=_mkMount(r,1); m.dragon=1; return m; }));
function mountIsDragon(m){ const d=mountDef(m); return !!(d&&d.dragon); }
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
  // a flyer you own but have not earned the sky for stays in the stable
  if(d.fly && !mountFlyOk()){
    if(typeof msg==='function') msg('NOT YET','flight is earned at level '+MOUNT_FLY_LV);
    return false; }
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

// ---- LANDING IS AUTOMATIC, AND OVER WATER YOU SIMPLY STAY UP (user, 2026-07-28). ----
// Taking off and setting down are not things the player manages: mounting a flyer takes off,
// dismounting lands. There is no "land here" action and no landing you can get wrong.
//
// If there is nowhere to put your feet, YOU REMAIN IN THE AIR. Not teleported to the nearest
// shore, not refused with an error — the dismount simply does not happen and you keep flying.
// That is the honest answer: the hero has no business standing in the sea, and moving him
// somewhere he did not fly to would be a worse surprise than staying airborne. There is no way to
// get stuck, because the mount that put you over the water can always carry you off it.
//
// This works BECAUSE the collision exemption is gated on `_pmove`: standable() is never called
// from inside the player's own moveCircle, so it always sees the REAL terrain even while the
// rider is airborne. Without that gate it would report the middle of the sea as fine to stand on.
function mountCanLandHere(){
  if(typeof standable!=='function') return true;
  return standable(player.x, player.y, (player&&player.r)||14); }

// Clear the saddle with NO landing logic at all. For the cases where the player is about to be
// somewhere else entirely anyway — death, a room change — so a refused landing can never leave a
// dead hero mounted in the Hearth.
function mountClear(){
  if(typeof player==='undefined'||!player) return;
  player.mnt=null; player.mntDmg=0; player.mntCast=0; player.mntCastId=null; player.mntCd=0; }

// reason: 'player' | 'thrown' | 'boss'. Only a THROW starts the remount cooldown — getting off on
// purpose costs you nothing, which is what keeps the ride a choice rather than a commitment.
function dismount(reason){
  // a cast in flight is cancelled by anything that would dismount you, including your own input
  if(!mounted()){ return mountCancel(reason==='player'); }
  // A FLYER OVER UNLANDABLE GROUND STAYS UP, whatever the reason. Even a forced dismount — a
  // fight starting, a throw — cannot put a hero down in open water, and it does not need to:
  // nothing can reach him up there and he can reach nothing, so hovering is a harmless state to
  // be left in. Use mountClear() for the paths that are relocating him anyway (death).
  if(playerIsFlying() && !mountCanLandHere()){
    if(reason==='player' && typeof texts!=='undefined')
      texts.push({x:player.x,y:player.y-44,txt:'NOWHERE TO LAND',col:'#9ad4ef',life:0.9});
    return false; }
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
// closest species of that rarity, preferring one not already stabled.
// FLYERS ARE OUT OF THE POOL UNTIL THE ACCOUNT HAS EARNED THE SKY. Dropping one at Lv25 would hand
// over a mount the stable refuses to saddle, which reads as a bug however correct the refusal is.
function _mountOfRar(rar,unowned){
  const canFly=(typeof mountFlyOk==='function')?mountFlyOk():false;
  const all=canFly?MOUNT_DB:MOUNT_DB.filter(m=>!m.fly);
  let pool=all.filter(m=>m.rar===rar);
  if(!pool.length){ // no species at that exact rarity — walk outward rather than dropping nothing
    let best=null,bd=99; for(const m of all){ const d=Math.abs(m.rar-rar); if(d<bd){bd=d;best=m;} }
    pool=best?all.filter(m=>m.rar===best.rar):[]; }
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

// ============================================================
//  DIRECTIONAL ANIMATION (assets/mounts/<arch>/…)
// ------------------------------------------------------------
//  An archetype ships EIGHT rotations and an eight-direction walk cycle:
//     assets/mounts/<arch>/idle_<dir>.png
//     assets/mounts/<arch>/walk_<dir>_<i>.png
//  with dir in n / ne / e / se / s / sw / w / nw.
//
//  EIGHT, not the hero's four. The hero's own art has n/s/e/w and flips west from east, which is
//  fine for a humanoid whose silhouette is nearly symmetric; a quadruped seen from three-quarters
//  is not, and a horse that snaps between four facings under a rider that snaps between four reads
//  worse than either alone. The mount gets the finer set and the rider keeps his.
//
//  EVERY LAYER FALLS BACK, exactly like the mob archetypes: animated frames -> the 8-way idle ->
//  the flat single-image sprite this file shipped first -> nothing drawn. A half-generated
//  archetype degrades to a still mount rather than to a hole in the world.
const MOUNT_DIRS=['e','se','s','sw','w','nw','n','ne'];
function _mountDir(aa){
  // 8 sectors of 45 degrees, starting at east. Returns the folder name, never a flip: a
  // three-quarter view cannot be mirrored honestly, which is the whole reason for having eight.
  const d=Math.atan2(Math.sin(aa),Math.cos(aa))*180/Math.PI;
  const i=Math.round(((d+360)%360)/45)%8;
  return MOUNT_DIRS[i]; }

const _mountAnim={};      // path -> Image
function _mountFrame(arch,name){
  if(typeof window==='undefined') return null;
  const p='assets/mounts/'+arch+'/'+name+'.png';
  if(_mountAnim[p]===undefined){ const i=new Image(); i.src=p; _mountAnim[p]=i; }
  const im=_mountAnim[p]; return (im&&im.complete&&im.naturalWidth)?im:null; }

// How many frames of a given clip an archetype actually has. Probed once by walking up from 0
// until a frame is missing, then cached — a set that ships 9 and a set that ships 4 both work.
const _mountFrameN={};
function _mountClipCount(arch,clip,dir){
  const k=arch+'/'+clip+'/'+dir;
  if(_mountFrameN[k]!==undefined) return _mountFrameN[k];
  let n=0; while(n<24 && _mountFrame(arch,clip+'_'+dir+'_'+n)) n++;
  // do NOT cache a zero: on the first frame every Image is still loading, and caching 0 here
  // would pin the archetype to "no animation" for the rest of the session
  if(n>0) _mountFrameN[k]=n;
  return n; }
function _mountWalkCount(arch,dir){ return _mountClipCount(arch,'walk',dir); }

// A FLYER IS NEVER STILL (user, 2026-07-28). Its resting state is wings open, beating up and
// down — a bird that freezes in mid-air the moment you stop reads as a cardboard cut-out pinned
// to the sky, and the hover bob alone cannot sell it. So `idle` is a CLIP for anything that flies,
// not a single frame, and it plays whether or not you are moving.
//
// Ground mounts keep a static idle on purpose: a horse standing still IS still, and a permanent
// trot-in-place would be worse than a pose. The animated path is used when the frames exist and
// the flat one when they do not, so the same code serves both without a flag.
const MOUNT_IDLE_FPS = 7;     // wing-beats are slower than a gait; this is a flap, not a flutter
const MOUNT_WALK_FPS = 10;

// The frame to draw right now. Returns null when this archetype has no directional art at all,
// which is the caller's signal to fall back to the flat sprite.
function mountFrameFor(d,aim,moving,clock){
  if(!d||!d.spr) return null;
  // the FOLDER is named after the sprite key (arch_horse), which is also the flat sprite's
  // filename -- d.arch is the short key ('horse') and points at nothing on disk
  const arch=d.spr, dir=_mountDir(aim||0);
  if(moving){ const n=_mountWalkCount(arch,dir);
    if(n>0){ const i=Math.floor((clock||0)*MOUNT_WALK_FPS)%n;
      const f=_mountFrame(arch,'walk_'+dir+'_'+i); if(f) return f; } }
  // animated idle (the flyers' wing-beat) wins over the static pose when it exists
  const ni=_mountClipCount(arch,'idle',dir);
  if(ni>0){ const i=Math.floor((clock||0)*MOUNT_IDLE_FPS)%ni;
    const f=_mountFrame(arch,'idle_'+dir+'_'+i); if(f) return f; }
  return _mountFrame(arch,'idle_'+dir); }
// A SPECIES IS AN ARCHETYPE IN A COAT. The archetype owns the drawing; the coat is a tint, cached
// by _tintImg on (src,col,alpha) so seventy-eight mounts cost twelve images and one canvas each
// the first time they are looked at. Returns null while the archetype is still loading — every
// caller already falls back, and a lazily-loaded Image returns null on the FIRST call because that
// call is what starts the load.
// The base drawing for a species, before the coat goes on. `st` is optional {aim,moving,clock} —
// with it, the eight-direction animated frame wins; without it (panels, chips) the flat sprite is
// what you want, because a UI card should not pick a facing.
function mountBaseImg(d,st){
  if(st){ const f=mountFrameFor(d, st.aim, st.moving, st.clock); if(f) return f; }
  return mountImg(d.spr); }

function mountArtFor(m,st){
  const d=(typeof m==='string')?mountDef(m):m; if(!d) return null;
  const im=mountBaseImg(d,st); if(!im) return null;
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
//  THE SEATED RIDER (assets/<cls>/ride_<dir>.png)
// ------------------------------------------------------------
//  A REAL RIDING SPRITE, not the standing pose with its legs hidden. The clip was a stopgap and
//  it never read as riding from the south, where the animal's body is a narrow column the hero
//  simply covers — legs cut off is not the same as legs astride.
//
//  One seated pose per class per direction, drawn ON TOP of the mount. It is independent of the
//  mount roster by construction: 17 classes x 8 directions, and it serves all 146 mounts. Baking
//  rider and mount together would be 17 x 20 archetypes x 8 = 2,720 sets for the same result.
//
//  Ascensions fall through to their base class exactly like emberSprite already does, and a class
//  with no ride art yet falls through to the standing sprite, so this can land one class at a time.
const _rideArt={};
function rideImg(cls,dir){
  if(typeof window==='undefined'||!cls) return null;
  const p='assets/'+cls+'/ride_'+dir+'.png';
  if(_rideArt[p]===undefined){ const i=new Image(); i.src=p; _rideArt[p]=i; }
  const im=_rideArt[p]; return (im&&im.complete&&im.naturalWidth)?im:null; }

// {img, flip} or null. West mirrors east when there is no west art, matching _emberDir's rule for
// the standing sprite — a seated humanoid IS near enough symmetric for that, unlike a quadruped.
function riderSprite(look,aim){
  if(!mounted()) return null;
  const base=(look&&look.cls)||'knight';
  const dir=_mountDir(aim||0);
  let im=rideImg(base,dir);
  if(im) return {img:im, flip:false};
  // the 8-way set may only ship 4: fold the diagonals onto their nearest cardinal
  const fold={ne:'n', nw:'n', se:'s', sw:'s'}[dir];
  if(fold){ im=rideImg(base,fold); if(im) return {img:im, flip:false}; }
  if(dir==='w'||dir==='nw'||dir==='sw'){ im=rideImg(base,'e'); if(im) return {img:im, flip:true}; }
  return null; }

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
// 63px tall here (a 74px opaque box at EMBER_SC 0.85).
//
// THE MOUNT MUST BE BIGGER THAN THE RIDER. 46px was 0.73x and vanished behind him; 58px matched
// his height and still read as "knight standing in front of a horse", because a rider only looks
// carried when the animal is visibly the larger object. 82px is ~1.3x the hero, which is roughly
// the real ratio of a horse's height to a person's and the point at which the silhouette reads
// mount-first. Everything else is derived from this, so the saddle line and the rider's lift move
// with it automatically.
const MOUNT_DRAW_H = 82;
// Where the saddle sits, as a fraction of the animal's height up from its feet. One number for all
// twelve archetypes: they are all quadruped-ish profiles of roughly the same build, and measuring
// off the DRAWN height rather than assuming a canvas position is what lets a wolf and a destrier
// share it.
const MOUNT_SEAT = 0.55;
// How far below the player's own y the animal's feet plant. Small and positive so it beds into the
// ground a touch rather than floating at the exact anchor.
const MOUNT_FOOT = 6;

// ALTITUDE. How far a flyer floats above where it actually is. Everything that matters — the
// collision test, the camera, the prompt ranges — keeps using the real position; only the drawing
// moves, so being in the air never desyncs where the game thinks you are from where you look.
const MOUNT_FLY_H = 30;
// The shadow is what SELLS it. Without one a raised sprite just reads as a bigger sprite standing
// further back; with one, the gap between the shadow and the feet IS the altitude, and it is drawn
// at the true ground position so it doubles as an honest marker of where you really are.
function _mountShadow(x,y,w){
  if(typeof ctx==='undefined') return;
  ctx.save();
  ctx.globalAlpha=0.30;
  ctx.fillStyle='#000';
  ctx.beginPath(); ctx.ellipse(x, y+6, w*0.42, w*0.16, 0, 0, 6.2832); ctx.fill();
  ctx.restore(); }

function mountDrawUnder(x,y,bob,faceAng,moving,clock){
  if(!mounted() || typeof blit!=='function') return 0;
  const d=mountDef(player.mnt); if(!d) return 0;
  // the eight-way animated frame if this archetype has one, else the flat sprite
  const st={aim:faceAng, moving:moving, clock:clock};
  const art=mountArtFor(d,st); if(!art) return 0;
  // OPAQUE BOX, never the canvas. _imgBBox caches on src, and the tinted canvas keeps the source's
  // geometry, so measuring the untinted archetype is both correct and cheaper. Every one of these
  // is a PixelLab canvas with a different amount of transparent margin — scaling by canvas size is
  // exactly what made the relic sack the smallest bag in the game.
  //
  // MEASURE A FIXED REFERENCE PER DIRECTION, never the frame being drawn. Every frame is scaled to
  // reach MOUNT_DRAW_H, so measuring each one individually would scale a leg-extended frame DOWN
  // to the same height as a tucked one and the animal would visibly pulse as it walked. The idle
  // pose for the current direction is the anchor: same silhouette proportions, constant across the
  // whole cycle. Falls through to the flat sprite for archetypes with no directional art yet.
  // A flyer has no STATIC idle -- its resting pose is a clip -- so the reference falls through to
  // frame 0 of that clip. Still one fixed image per direction, which is the whole requirement:
  // the scale must not change between frames or the animal pulses as its wings beat.
  const _rd=_mountDir(faceAng||0);
  const ref=_mountFrame(d.spr,'idle_'+_rd) || _mountFrame(d.spr,'idle_'+_rd+'_0') || mountImg(d.spr);
  const bb=(typeof _imgBBox==='function'&&ref)?_imgBBox(ref):null;
  const realH=(bb&&bb.h)?bb.h:(art.height||64);
  const sc=MOUNT_DRAW_H/Math.max(1,realH);
  const fly=!!d.fly;
  // A FLYER HOVERS; A WALKER TROTS. Slower, deeper, and it never stops — a wing-beat sway that
  // keeps going while you stand still is most of what says "this thing is not on the ground".
  const gait = fly ? Math.sin((clock||0)*4.2)*2.6
             : (moving?Math.sin((clock||0)*13+1.1)*1.6:Math.sin((clock||0)*3)*0.5);
  const alt = fly ? MOUNT_FLY_H : 0;
  const flip=Math.cos(faceAng)<0;
  // blit CENTRES on the point it is given, so to plant the animal's FEET we have to work back
  // from where its opaque box ends inside its own canvas.
  const canvasH=art.height||64;
  const footInCanvas=bb?(bb.y+bb.h):canvasH;               // px from canvas top down to its feet
  const centreY = y + MOUNT_FOOT + (canvasH*sc)/2 - footInCanvas*sc + gait*0.4 - alt;
  // shadow first, at the TRUE ground position, so the gap under the mount is the altitude
  if(fly) _mountShadow(x, y, (bb?bb.w:64)*sc);
  blit(art, x, centreY, sc, flip);
  // Lift the rider so his feet land on the saddle rather than on the floor beside it. Derived from
  // the same numbers that placed the animal, so changing MOUNT_DRAW_H moves both together.
  //   mount feet      = y + MOUNT_FOOT
  //   saddle          = feet - MOUNT_DRAW_H*MOUNT_SEAT
  //   hero feet drawn = y - 8 - lift + heroDrawnHeight/2      (09_sprites blits him centred)
  const HERO_HALF=31;                                       // 74px opaque box at EMBER_SC 0.85, halved
  const saddle = MOUNT_FOOT - MOUNT_DRAW_H*MOUNT_SEAT;
  // THE RIDER SITS IN THE SADDLE, NOT ON TOP OF THE ANIMAL. Landing his FEET on the saddle line
  // put a standing hero on its back, which is exactly what it looked like. He is dropped
  // MOUNT_SIT further so his hips meet the saddle instead, and 09_sprites clips his sprite at
  // that line so the legs below it disappear behind the animal — which is where a rider's legs
  // actually are. No new art: every class and every ascension already has an idle pose, and this
  // makes all 68 of them sit correctly on all 130 mounts.
  _mountSaddleY = y + saddle + alt;                          // world Y of the saddle line, for the clip
  return (23 - saddle) - (31-HERO_HALF) + gait*0.4 + alt - MOUNT_SIT; }

// How far the rider drops below "feet on the saddle" so that his HIPS sit at the saddle instead.
// The hero's opaque box is 74px at EMBER_SC 0.85 (63px drawn) and the hip line is roughly 45% up
// from the feet, so a bit over a third of his drawn height is what goes below the saddle.
const MOUNT_SIT = 22;
// Where the clip goes, in world coords, published by the draw above and read by 09_sprites on the
// same frame. A plain module-level value rather than a return field because the hero blit needs it
// AFTER mountDrawUnder has already returned its lift.
let _mountSaddleY = 0;
function mountSaddleY(){ return _mountSaddleY; }

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
    const up=mounted(), isFly=!!a.fly, canFly=mountFlyOk();
    h+='<div class="embHero">'
      +'<img class="embHeroImg" data-mount-img="'+a.id+'" src="assets/mounts/'+a.spr+'.png">'
      +'<div class="embHeroTx">'
        +'<div class="embHeroNm" style="color:'+mountRarCol(a.rar)+'">'+a.name+'</div>'
        +'<div class="embDim"><b style="color:'+mountRarCol(a.rar)+'">'+mountRarName(a.rar)+'</b>'
          +' · '+(isFly?'<span style="color:#9ad4ef">FLYING</span> · ':'')
          +(up?'<span style="color:#ffe08a">in the saddle</span>':'stabled')+'</div>'
        +'<div class="embLv">+'+spd+'% <span class="embDim">move speed</span></div>'
        // a flyer's rules are genuinely different, so it says so instead of showing a throw
        // threshold that can never be reached
        +(isFly
          ? '<div class="embDim">crosses water · nothing can reach you</div>'
            +'<div class="embDim">'+(canFly?'':'<b style="color:#e2604c">grounded until level '+MOUNT_FLY_LV+'</b>')+'</div>'
          : '<div class="embDim">thrown after '+tough+'% of your health in damage</div>')
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
      +'<div class="embDim">'+(m.fly?'<span style="color:#9ad4ef">✦</span> ':'')
        +'+'+Math.round((mountSpdOf(m.id)-1)*100)+'%</div></div>'; }
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
