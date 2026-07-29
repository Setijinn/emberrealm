// ---------- EmberForge real-sprite loader (PixelLab assets) ----------
// Loads vendored PNG frames for classes that have real art and exposes
// emberSprite(look, state) -> {img, flip} for the renderer to blit.
// Falls back to the procedural heroSprite() for any class/anim not present.
//
// Robust to partial art: each (anim,dir) is *probed* frame-by-frame, so a
// direction with a missing or half-finished animation simply contributes
// fewer frames (or falls back) instead of breaking. West flips East when
// absent; a missing attack for a direction falls back to that direction's
// idle pose so the character never blanks out mid-swing.
//
// Assets live in assets/<cls>/ named:
//   idle_<d>.png            (d = s|e|n|w)
//   walk_<d>_<n>.png        (n = 0..)
//   attack_<d>_<n>.png      (n = 0..)

// On-screen scale for the 92px PixelLab sprites (tune to match world scale).
const EMBER_SC = 0.85;

// ---- THE PRELOAD REGISTRY ----
// Every image the game creates while the page is booting gets pushed here, and the loading screen
// (10b_loading.js) waits on exactly this list. Registering at CREATION rather than walking the
// asset objects afterwards is the point: a new sprite table added later is covered automatically,
// with no list to forget to update. Images created LAZILY during play (ability art, relic art)
// land here too, harmlessly -- the loader snapshots the list once and never looks again.
const ASSET_IMGS = [];
function _track(i){ if(i && typeof window!=='undefined') ASSET_IMGS.push(i); return i; }

// HUD orb frame (PixelLab) â€” ornate hollow ring for the HP/MP globes.
const _uiOrb = (typeof window!=='undefined') ? (()=>{ const i=new Image(); i.src='assets/ui/orb.png'; return _track(i); })() : null;
// Reusable interact-button plate (PixelLab) â€” used by the portal/pillar USE prompt.
const _btnInteract = (typeof window!=='undefined') ? (()=>{ const i=new Image(); i.src='assets/ui/btn_interact.png'; return _track(i); })() : null;
// Loot sacks (PixelLab), one per TIER BAND — never rarity, and never a chest: progression reads
// through material and ornament while the silhouette stays a sack. LOOT_BANDS names these by
// string, so adding the band above T12 later is one row plus one file.
//   _lootSack     public   T1-T8   plain burlap
//   _lootSackT9   bound    T9-T10  richer cloth, banded trim
//   _lootSackT11  bound    T11-T12 embroidered, clasped, ember at the seams
const _lootSack    = (typeof window!=='undefined') ? (()=>{ const i=new Image(); i.src='assets/ui/loot_sack.png';     return _track(i); })() : null;
const _lootSackT9  = (typeof window!=='undefined') ? (()=>{ const i=new Image(); i.src='assets/ui/loot_sack_t9.png';  return _track(i); })() : null;
const _lootSackT11 = (typeof window!=='undefined') ? (()=>{ const i=new Image(); i.src='assets/ui/loot_sack_t11.png'; return _track(i); })() : null;
//   _lootSackRelic bound    T13     violet and gold, gems in the seams, light coming out of it
const _lootSackRelic = (typeof window!=='undefined') ? (()=>{ const i=new Image(); i.src='assets/ui/loot_sack_relic.png'; return _track(i); })() : null;
// LOOT_BANDS names its sack by STRING so a new band is one row plus one file. Resolving that name
// needs a real table: these are `const`, which binds in the global LEXICAL scope and never becomes
// a property of `window`, so the old `window[bn.spr]` lookup silently returned undefined for every
// band and every sack in the game drew as the plain burlap one. The T9, T11 and relic art had
// never appeared on screen.
// THE EVENT CHEST (user, 2026-07-27). The one deliberate exception to "loot is always a sack":
// a sack is what a KILL leaves, and that rule stands. A chest is not a drop -- it is an event you
// walk up to, placed on purpose, and it looks like nothing else in the game precisely so it can
// never be mistaken for something a monster left behind.
const _eventChest = (typeof window!=='undefined') ? (()=>{ const i=new Image(); i.src='assets/ui/event_chest.png'; return _track(i); })() : null;
// THE CREATURE CARRIER (user, 2026-07-27). Mounts and pet eggs drop in their own sack, always, and
// always together. It is a WICKER CARRIER rather than a sack precisely because it is the one drop
// whose contents are alive -- the silhouette says "something is in here" the way no amount of
// ornament on a sack could, and it can never be mistaken for the gear bag beside it.
const _creatureSack = (typeof window!=='undefined') ? (()=>{ const i=new Image(); i.src='assets/ui/creature_sack.png'; return _track(i); })() : null;
const _LOOT_SPR={_lootSack:_lootSack, _lootSackT9:_lootSackT9, _lootSackT11:_lootSackT11,
                 _lootSackRelic:_lootSackRelic, _eventChest:_eventChest, _creatureSack:_creatureSack};
function lootSackImg(name){ const im=_LOOT_SPR[name]; return (im&&im.naturalWidth)?im:_lootSack; }
// THE FLOCK (03b_critters.js). 4 facings x 4 walk frames each, plus a standing pose. Loaded
// through _track() like everything else, so the boot curtain waits on them and a missing file
// degrades to the standing frame rather than to nothing.
const _critterImg={};
if(typeof window!=='undefined'){
  for(const sp of ['chicken','sheep']){
    _critterImg[sp]={stand:{},walk:{}};
    for(const d of ['south','east','north','west']){
      _critterImg[sp].stand[d]=(()=>{ const i=new Image(); i.src='assets/critters/'+sp+'_'+d+'.png'; return _track(i); })();
      _critterImg[sp].walk[d]=[0,1,2,3].map(f=>{ const i=new Image();
        i.src='assets/critters/'+sp+'_walk_'+d+'_'+f+'.png'; return _track(i); });
    }
  }
}
function critterFrame(spec,dirIdx,frame,moving){
  const set=_critterImg[spec]; if(!set) return null;
  const d=['south','east','north','west'][dirIdx|0]||'south';
  if(moving){ const a=set.walk[d]; const im=a&&a[(frame|0)%4];
    if(im&&im.complete&&im.naturalWidth) return im; }
  const st=set.stand[d];
  return (st&&st.complete&&st.naturalWidth)?st:null;
}
// Hearth (town) PixelLab art: 4 vendor shop stalls (with the vendor built in), fountain, portal.
const _hearth={};
if(typeof window!=='undefined') ['stall_bram','stall_sella','stall_maren','stall_odo','fountain','portal','floor',
  'floor_walk','floor_walk2','floor_broken','portal_realm','portal_cos','portal_vault','portal_guild','portal_arena',
  'wall','planter','brazier','lamp','portal_pets','portal_home',
  'vault_coffer','chest','signboard','vault_statue','vault_lectern',
  // THE VAULT (user: rework the visuals for the entire storage room). The strongroom's own
  // furniture -- everything the hub's market art could not say about a bank.
  'vault_door','vault_boxes','vault_coins','vault_crates','vault_sacks','vault_candelabra',
  // The wall racks are FRONT ELEVATIONS drawn across a 2x3-tile unit (see the 'h' branch in
  // 08_render.js). Two variants, alternated per unit, so a twenty-tile wall is not one rack
  // photocopied eleven times.
  'vault_rack0','vault_rack1']
  .forEach(k=>{ _hearth[k]=_img('assets/hearth/'+k+'.png'); });
// ---------------------------------------------------------------------------------------------
// WHERE A LIGHT ACTUALLY SHINES FROM.
// A glow is stored at its tile CENTRE (02_worldbuild), but the thing emitting it is a tall sprite
// drawn BASE-ANCHORED at the bottom of that tile and reaching upward -- a lamp post is about 160px
// tall standing on a 44px tile. The stored point is therefore nowhere near the flame, and every
// post in the game has been lighting the ground around its own feet while its head sat in the
// dark, with the embers streaming out of its base.
//
// The fractions are MEASURED off the art rather than guessed: luminance-weighted centroid of the
// brightest 12% of opaque pixels, as a fraction of the opaque bounding box measured up from the
// foot.  lamp 0.77   candelabra 0.82   brazier 0.55  -- a brazier reads low because its fire sits
// down in a wide bowl, which is exactly why one number for all of them would not have worked.
const GLOW_ART={ l:{k:'lamp', w:34, frac:0.77}, H:{k:'brazier', w:40, frac:0.55} };
function glowSrc(gl){
  const A=GLOW_ART[gl.t]||GLOW_ART.l;
  let k=A.k, w=A.w, frac=A.frac;
  // the vault swaps the town lamp for a candelabra, so the geometry has to swap with it
  if(gl.t==='l' && typeof curRoom!=='undefined' && curRoom && curRoom.key==='VAULT'){
    k='vault_candelabra'; w=30; frac=0.82; }
  const img=(typeof _hearth!=='undefined')?_hearth[k]:null;
  const base=gl.y+TILE/2-1;                                   // the sprite's foot
  const h=(img&&img.complete&&img.naturalWidth)
    ? img.naturalHeight*(w/img.naturalWidth) : TILE;           // art not in yet: fall back to a tile
  return { x:gl.x, y:base-h*frac };
}

// water tile (global â€” hub pool + grove lakes)
const _waterImg=(typeof window!=='undefined')?_img('assets/tiles/water.png'):null;
// Ocean variants — 4 seamless-compatible wave tiles (same tileset) mixed per-cell to break the
// grid repetition of a single tile. Index 0 is _waterImg (kept for hub pools / grove lakes).
const _waterVar=(typeof window!=='undefined')?[_waterImg,_img('assets/tiles/water_1.png'),_img('assets/tiles/water_2.png'),_img('assets/tiles/water_3.png')]:null;
// World-rework Phase 2 art: the great bridge deck, the sandy shore, the infection portal
// landmark, and corrupted-ground decals (drawn where corruptAt() is high, toward the portal).
const _bridgeImg=(typeof window!=='undefined')?_img('assets/tiles/bridge_deck.png'):null;
const _shoreImg =(typeof window!=='undefined')?_img('assets/tiles/shore_sand.png'):null;
const _portalImg=(typeof window!=='undefined')?_img('assets/env/portal_infect.png'):null;
const _corruptDec=(typeof window!=='undefined')?[_img('assets/env/corrupt_0.png'),_img('assets/env/corrupt_1.png')]:null;
// The infection portal was once a town portal — a ring of now-broken, crumbling stone pillars
// surrounds it, drawn as a stone circle around the rift in drawWorldFeatures().
const _portalPillars=(typeof window!=='undefined')?[_img('assets/env/pillar_0.png'),_img('assets/env/pillar_1.png'),_img('assets/env/pillar_2.png')]:null;
// Waypoint (fast-travel) pillar — a beautiful light-magic shrine; drawn base-anchored in drawPillar.
const _waypointImg=(typeof window!=='undefined')?_img('assets/env/waypoint.png'):null;
const _wardenImg=(typeof window!=='undefined')?_img('assets/env/warden.png'):null;   // Warden Ivor
// the great bridge: royal gatehouse arches, sentinel statues, collapsed masonry (09_sprites drawBridge)
const _bridgeTower=(typeof window!=='undefined')?_img('assets/env/bridge_tower.png'):null;
const _bridgeStatue=(typeof window!=='undefined')?_img('assets/env/bridge_statue.png'):null;
// 9-sliced plaque behind boss dialogue (17_bossmech drawBossQuote); QUOTE_INSET must match its border
const _quoteFrame=(typeof window!=='undefined')?_img('assets/ui/quote_frame.png'):null;
// Awakened dungeons: per-ring consciousness tileset + spectral awakened-boss sprite
// (render falls back to lairset / normal boss art until these land)
// ART SLOTS, not boss ids: a boss borrowing an existing slot adds no image request.
const _artSlots=(typeof bossArtSlots==='function')?bossArtSlots():[0,1,2,3,4,5,6,7,8];
const _tileSlots=(typeof bossTileSlots==='function')?bossTileSlots():_artSlots;
// Only the canon nine have an AWAKENED form — the starter three are the creature itself,
// not a dream of it — so awak art is loaded for those slots alone. Requesting the rest
// would 404 on every session against a cache-first service worker.
// 9/10/11 are the starter-dungeon den elders -- not dream forms, but still a distinct sprite so a
// dungeon boss is never the identical creature fought outside.
const AWAK_SLOTS=[0,1,2,3,4,5,6,7,8,9,10,11,12];
const _dunSet={}, _awakImg={};
if(typeof window!=='undefined'){
  for(const b of _tileSlots) _dunSet[b]=_img('assets/tiles/dunset_'+b+'.png');
  for(const b of AWAK_SLOTS) _awakImg[b]=_img('assets/mobs/awak_'+b+'.png'); }
// ability effect sprites: zone rune circle, melee slash arc, heal glyph
const _fxRune=(typeof window!=='undefined')?_img('assets/fx/rune.png'):null;
const _fxSlash=(typeof window!=='undefined')?_img('assets/fx/slash.png'):null;
const _fxHeal=(typeof window!=='undefined')?_img('assets/fx/heal.png'):null;
// status effect icons (pips above afflicted enemies)
const _stIcons={};
if(typeof window!=='undefined') for(const k of ['burn','poison','bleed','chill','freeze','stun','curse','weak','shock'])
  _stIcons[k]=_img('assets/status/'+k+'.png');
// enemy health-bar display cover (thin ornate frame drawn over the plain fill)
const _hpbarImg=(typeof window!=='undefined')?_img('assets/ui/hpbar.png'):null;
// dream-path tile + 6 shared dream decor pieces scattered through every mind
const _dunPath=(typeof window!=='undefined')?_img('assets/tiles/dunpath.png'):null;
const _dunDec=[];
if(typeof window!=='undefined') for(let i=0;i<6;i++) _dunDec.push(_img('assets/env/ddec_'+i+'.png'));
// Item icon art (PixelLab): 3 tier bands per type/material (crude 0-3 / fine 4-7 / ornate 8-11).
// key = wpn_<type> | arm_<mat> | helm_<mat> | ring_<st> | potion. Band = min(2, floor(tier/4)).
const _itemArt={};
if(typeof window!=='undefined'){
  // Weapons ship ONE sprite per tier -- no two tiers share art. Each depicts its own tier name's
  // material: Cracked, Worn, Iron, Steel, Tempered, Runed, Ember, Obsidian, Storm-forged,
  // Dragonbone, Mythril, Hearthfire. Armour, helms and rings still ship three bands each; the
  // band maths below adapts to whatever a key actually provides.
  // literal list on purpose: building it from Object.keys(WTYPE) would run at load, before
  // 11_ui.js declares WTYPE, and take the whole boot down with a TDZ ReferenceError
  ['sword','dagger','bow','xbow','staff','wand','gauntlet'].forEach(k=>{ _itemArt['wpn_'+k]=[0,1,2,3,4,5,6,7,8,9,10,11].map(b=>_img('assets/items/wpn_'+k+'_'+b+'.png')); });
  // Armour and helms also ship one sprite per tier now. Rings are still on three bands; the band
  // maths below keys off each array's own length, so mixed depths coexist without a special case.
  const _T12=[0,1,2,3,4,5,6,7,8,9,10,11];
  ['plate','leather','robe'].forEach(m=>{ _itemArt['arm_'+m]=_T12.map(b=>_img('assets/items/arm_'+m+'_'+b+'.png'));
    _itemArt['helm_'+m]=_T12.map(b=>_img('assets/items/helm_'+m+'_'+b+'.png')); });
  // Rings tier like everything else. Their gem colour is the STAT's identity so it
  // never moves; the band is what carries the tier.
  ['hp','dmg','def','mp','vit','wis','dex','spd','luck'].forEach(s=>{ _itemArt['ring_'+s]=_T12.map(b=>_img('assets/items/ring_'+s+'_'+b+'.png')); });
  _itemArt['coin']=[0,1,2].map(b=>_img('assets/items/coin_'+b+'.png'));   // bronze/silver/gold
  _itemArt['potion']=[_img('assets/items/potion.png')];
}
// Ability art (PixelLab): a figure using each ability. Lazy-loaded by ability id
// (assets/abilities/<id>.png); returns the image only once decoded, else null -> emoji.
const _abilImgCache={};
function abilImg(id){ if(typeof window==='undefined'||!id) return null;
  if(_abilImgCache[id]===undefined){ const i=new Image(); i.src='assets/abilities/'+id+'.png'; _abilImgCache[id]=i; }
  const im=_abilImgCache[id]; return (im&&im.complete&&im.naturalWidth)?im:null; }
// The band maths below spreads the tiers THE ART WAS DRAWN FOR over whatever sprites a key ships.
// It used to read MAXT, which was right while MAXT and "how many tiers exist in the art" were the
// same number -- but they came apart the moment Scavenged Dreams made MAXT 13, and dividing by a
// clamp that can move would re-map every existing tier onto the wrong sprite. ART_TIERS is frozen
// at 12 for exactly that reason: it describes the files, not the ladder. Do not make this read
// MAXT again, and do not make it read TIER_NAMES.length either -- both of those grow.
function _nTiers(){ return (typeof ART_TIERS!=='undefined')?ART_TIERS:12; }
// Each relic ships its OWN sprite, drawn for the boss whose dungeon kept it. Lazy-loaded by id so
// twelve more images cost nothing until one actually drops.
const _relicArt={};
function relicArtImg(id){ if(typeof window==='undefined'||!id) return null;
  if(_relicArt[id]===undefined){ const i=new Image(); i.src='assets/items/relic_'+id+'.png'; _relicArt[id]=i; }
  const im=_relicArt[id]; return (im&&im.complete&&im.naturalWidth)?im:null; }
// The three boost draughts (17l_boosts.js). Lazy per bottle, like the relics: three images cost
// nothing until one is actually in a sack.
const _boostArt={};
function boostArtImg(bt){ if(typeof window==='undefined'||!bt) return null;
  const d=(typeof boostDef==='function')?boostDef(bt):null; if(!d) return null;
  if(_boostArt[bt]===undefined){ const i=new Image(); i.src='assets/items/'+d.spr+'.png'; _boostArt[bt]=i; }
  const im=_boostArt[bt]; return (im&&im.complete&&im.naturalWidth)?im:null; }

function itemArtImg(it){ if(!it||typeof _itemArt==='undefined') return null;
  if(it.relic){ const r=relicArtImg(it.relic); if(r) return r; }   // its own art wins outright
  // a draught has no tier and no band -- its own bottle is the whole identity
  if(it.k==='boost'){ return boostArtImg(it.bt); }
  const NTIERS=_nTiers();
  let key=null;
  if(it.k==='wpn') key='wpn_'+it.wt; else if(it.k==='arm') key='arm_'+it.mt;
  else if(it.k==='helm') key='helm_'+it.mt; else if(it.k==='ring') key='ring_'+it.st;
  else if(it.k==='coin') key='coin'; else if(it.k==='pot') key='potion';
  const arr=_itemArt[key]; if(!arr) return null;
  // Spread the 12 tiers evenly over however many bands this key actually ships, so a set can be
  // deepened without touching this: 3 bands -> 4 tiers each, 6 bands -> 2 tiers each. Coins are
  // the exception — their denomination IS the band, not something derived from a tier.
  const band=(it.k==='coin')?Math.min(arr.length-1,it.t||0)
            :Math.min(arr.length-1,Math.floor((it.t||0)*arr.length/NTIERS));
  const im=arr[band];
  return (im&&im.complete&&im.naturalWidth)?im:null; }

// Terrain art (PixelLab), per zone band. Ground = each tileset's all-terrain tile at (0,96,32).
function _img(src){ if(typeof window==='undefined') return null; const i=new Image(); i.src=src; return _track(i); }
// PixelLab projectile art â€” 24 base shapes; the forge hue-shifts each into many variants
let _miniPlus=null, _miniMinus=null;      // minimap zoom button art
const _projArt={_list:['arrow','fireball','ice_shard','lightning','magic_orb','skull','note','leaf',
 'dagger','chakram','spear','void_orb','holy_star','bone','wind_slash','crystal',
 'thorn','ember','wisp','rune','shuriken','axe','meteor','feather']};
// What a weapon throws, per tier. The shape used to be a hash of the forge key, so a Hearthfire bow
// could fire a musical note; now the weapon type picks the family (a bow always looses something
// arrow-like) and the tier escalates it, so the shot on screen matches the weapon in the hand.
// One shape per weapon type, held across all twelve tiers. This mirrors how the
// weapon art itself now works: the silhouette is fixed per line and the tier is
// carried entirely by colour. Swapping the projectile's shape as you level would
// contradict that -- a Dragonbone bow would fire a bone while its sprite is plainly
// still a bow. The tier shows in the hue (PROJ_TIER_HUE) exactly as it does on the
// weapon in hand.
const PROJ_BY_WEAPON={
  bow:'arrow', xbow:'spear', sword:'wind_slash',
  dagger:'dagger', staff:'magic_orb', wand:'wisp',
  gauntlet:'wind_slash', fists:'wind_slash'   // a struck-air arc: the punch itself is the sprite
};
// Signature hue per tier, matching the material each tier's gear is made of: rust, grey, iron blue,
// steel, brass, rune blue, ember orange, obsidian red, storm white-blue, bone cream, mythril, gold.
const PROJ_TIER_HUE=[24,28,212,205,42,212,22,352,196,44,190,45];
// Shapes that read as spinning objects rather than as something pointed along its flight path.
// An arrow or a spear must stay aligned to its heading or it looks broken; a thrown blade, an orb
// or a star has no "forward", so those tumble instead.
const PROJ_SPIN={chakram:7.5,shuriken:11,axe:6,skull:2.4,magic_orb:2.0,void_orb:2.2,
  meteor:3.2,crystal:2.6,rune:1.8,wisp:2.8,ember:3.0,holy_star:2.2,bone:5.0};
function projLook(wt,tier){
  const shape=PROJ_BY_WEAPON[wt]||PROJ_BY_WEAPON.sword;
  const t=Math.max(0,Math.min(PROJ_TIER_HUE.length-1,tier|0));
  return {shape:shape, hue:PROJ_TIER_HUE[t], spin:PROJ_SPIN[shape]||0};
}
const _groundSet={}, _bandTree={}, _bandBoulder={}, _bandTone={};
const _groundVar={}, _decal={}, _lair={};   // richer terrain: variant ground tiles + scatter decals + boss lairs
const _lairSet={}, _lairDec={};              // boss-room wall/floor tileset (wall=GROUND_UP, floor=GROUND_LO) + interior decorations
// 4x4 atlases of 16 same-material variants, keyed like the sheets above. `_floorSet` = boss-arena
// floors, `_terrSet` = open-world ground per band, `_dunFloor` = dungeon floors. Any theme with no
// atlas yet falls back to its old single cell, so these roll out one at a time.
const _floorSet={}, _wallSet={}, _terrSet={}, _dunFloor={};
const GROUND_UP=[0,96], GROUND_LO=[64,32];   // main + secondary ground tiles (uniform across tilesets)
// every band gets decals: forest zones share the grass set (0), stone zones the rocky set (3),
// ash/fire zones the ember set (5) â€” richness everywhere without 9 full unique sets
// Which scatter-decal set each terrain band uses: 0 = grass/mushroom, 3 = rocky, 5 = ember.
// This used to run 0,0,0,3,3,5,5,5,5, which put mushrooms and grass tufts on the landing sands
// and the shore while the verdant belt and wolfwood got bare rock -- exactly backwards. Decals
// now follow the ground they land on: grass only where grass grows, rock on sand/scree, ember
// in the burn.
const DECAL_SRC={0:3,1:3,2:0,3:0,4:0,5:0,6:3,7:5,8:5,9:3};   // 9 Cairnworks -> rocky scatter
const LAIR_BANDS=[0,1,2,3,4,5,6,7,8];         // bands 0-8 have a boss-lair structure.
// Band 9 is NOT here on purpose. Arena walls/floors are keyed to the BOSS (lairTileSet), never
// to the ground it stands on, and boss 12 borrows slot 3 -- so band 9 needs no lairset/floor/wall.
(function(){
  if(typeof window==='undefined') return;
  for(const n of _projArt._list) _projArt[n]=_img('assets/proj/'+n+'.png');
  _miniPlus=_img('assets/ui/mini_plus.png'); _miniMinus=_img('assets/ui/mini_minus.png');
  for(let b=0;b<=9;b++) _groundSet[b]=_img('assets/tiles/set_'+b+'.png');
  // per-zone variant ground sheet (sampled at GROUND_UP like the base) for large-scale variety
  for(let b=0;b<=9;b++) _groundVar[b]=_img('assets/tiles/setv_'+b+'.png');
  // scatter decals (small transparent props laid on the ground): shared per theme set
  const _dsrc={};
  for(const s of [0,3,5]){ _dsrc[s]=[]; for(let i=0;i<6;i++) _dsrc[s].push(_img('assets/env/decal_'+s+'_'+i+'.png')); }
  for(let b=0;b<=9;b++) _decal[b]=_dsrc[DECAL_SRC[b]];
  // The den sprite and its decor belong to the BOSS (art slots); the wall/floor tileset belongs
  // to the TERRAIN it's cut into (bands) — that split is what lets a boss move zones.
  for(const b of _artSlots) _lair[b]=_img('assets/env/lair_'+b+'.png');
  for(const b of LAIR_BANDS) _lairSet[b]=_img('assets/tiles/lairset_'+b+'.png');
  // Dedicated FLOOR ATLASES: 4x4 sheets of 16 same-material variants (create_tiles_pro), so an
  // arena floor is never one 32x32 cell repeated. Themes without a sheet yet fall back to the
  // single lairset cell, so this rolls out per theme without breaking anything.
  for(const b of LAIR_BANDS) _floorSet[b]=_img('assets/tiles/floor_'+b+'.png');
  for(const b of LAIR_BANDS) _wallSet[b]=_img('assets/tiles/wall_'+b+'.png');
  // open-world ground, one atlas per terrain band -- same no-repeat rule outdoors as in the arenas
  for(let b=0;b<=9;b++) _terrSet[b]=_img('assets/tiles/terr_'+b+'.png');
  // Boss-room decor: all nine themes already ship their own set of four props, and
  // bossDecArt only borrows for the three starter bosses (DEC_SLOT). Do not "fix" this
  // by cutting the count -- fewer props per theme means a barer arena, not a richer one.
  const _decDone={};
  for(const b of _artSlots){ const s=(typeof bossDecArt==='function')?bossDecArt(b):b;
    if(_decDone[s]){ _lairDec[b]=_decDone[s]; continue; }
    const a=[]; for(let i=0;i<4;i++) a.push(_img('assets/env/ldec_'+s+'_'+i+'.png'));
    _decDone[s]=a; _lairDec[b]=a; }
  // Flora per band, matched to the ground it stands on. Only bands 0-2 were mapped before, and
  // they were mapped wrong: Gullwind Shore drew a PINE on shore shingle, and every band from the
  // Verdant Belt outward had no tree at all so it fell through to the procedural green blob.
  const tScrub=_img('assets/env/tree_scrub.png'), tGrass=_img('assets/env/tree_grass.png'),
        tWillow=_img('assets/env/tree_willow.png'), tPine=_img('assets/env/tree_pine.png'),
        tBare=_img('assets/env/tree_bare.png'), tDead=_img('assets/env/tree_dead.png');
  _bandTree[0]=tScrub;    // Landing Sands   - salt scrub, nothing tall grows in sand
  _bandTree[1]=tScrub;    // Gullwind Shore  - same, wind-bent
  _bandTree[2]=tWillow;   // Sawgrass Flats
  _bandTree[3]=tGrass;    // Verdant Belt    - proper broadleaf
  _bandTree[4]=tPine;     // Wolfwood
  _bandTree[5]=tPine;     // Deep Timber
  _bandTree[6]=tBare;     // Stonebrow Rise  - stunted and windswept on rock
  _bandTree[7]=tDead;     // Cinderwatch     - burnt
  _bandTree[8]=tDead;     // The Ashfall
  _bandTree[9]=tBare;     // The Cairnworks  - stunted scrub on a worked-out quarry rise
  const bGrass=_img('assets/env/boulder_grass.png'), bGrey=_img('assets/env/boulder_grey.png'),
        bScorch=_img('assets/env/boulder_scorched.png'), bVolc=_img('assets/env/boulder_volcanic.png');
  // mossy boulders belong where there is moss, not on sand
  _bandBoulder[0]=_bandBoulder[1]=bGrey;
  _bandBoulder[2]=_bandBoulder[3]=_bandBoulder[4]=_bandBoulder[5]=bGrass;
  _bandBoulder[6]=bGrey;
  _bandBoulder[7]=bScorch;
  _bandBoulder[8]=bVolc;
  _bandBoulder[9]=bGrey;
  _bandTone[0]='rgba(22,44,16,0.40)';   // toned-down vivid grass (per feedback)
  _bandTone[7]='rgba(8,4,12,0.32)';     // calm the volcanic glow -> dark rock w/ glowing cracks
  _bandTone[8]='rgba(8,3,10,0.46)';     // molten: darker still, subdue the busy lava grid
  // The Cairnworks sheet came back cool and faintly blue; a warm dust wash pulls it back to dry
  // worked stone without regenerating it. This is what _bandTone is for -- bands 0/7/8 all
  // correct their sheets the same way rather than chasing a perfect generation.
  _bandTone[9]='rgba(74,60,38,0.30)';
})();

// Enemy sprites (PixelLab). Mobs (hound=c, cultist=s) + per-band boss images.
const _mobHound = _img('assets/mobs/hound.png');
const _mobCultist = _img('assets/mobs/cultist.png');
// ARCHETYPE ART. Ninety-nine species shared these two sprites -- one hound for every chaser in the
// game, one cultist for every shooter. These give the roster ten silhouettes instead of two; the
// band tint then makes it ninety looks. `beast` and `caster` deliberately alias the originals so
// nothing that already worked changes.
const _mobArchImg = (typeof window!=='undefined') ? {
  beast:_mobHound, caster:_mobCultist,
  crab :_img('assets/mobs/arch_crab.png'),
  swarm:_img('assets/mobs/arch_swarm.png'),
  bird :_img('assets/mobs/arch_bird.png'),
  husk :_img('assets/mobs/arch_husk.png'),
  golem:_img('assets/mobs/arch_golem.png'),
  plant:_img('assets/mobs/arch_plant.png'),
  wisp :_img('assets/mobs/arch_wisp.png'),
  boar :_img('assets/mobs/arch_boar.png'),
  // the shooters were 51 species deep in one hooded cultist. Three more silhouettes split that
  // into a thrower, a fur-and-antler shaman and a faceless robed acolyte.
  slinger:_img('assets/mobs/arch_slinger.png'),
  shaman :_img('assets/mobs/arch_shaman.png'),
  acolyte:_img('assets/mobs/arch_acolyte.png') } : {};
function mobArchImg(name){ const i=_mobArchImg[name]; return (i&&i.naturalWidth)?i:null; }
// the elite's crown, worn above the head
const _eliteCrown = (typeof window!=='undefined') ? _img('assets/ui/elite_crown.png') : null;
// Summoned allies / pets (wolf, skeleton, wisp) — real PixelLab art, procedural fallback.
const _allyImg = (typeof window!=='undefined') ? {
  wolf:_img('assets/mobs/ally_wolf.png'),
  skel:_img('assets/mobs/ally_skel.png'),
  wisp:_img('assets/mobs/ally_wisp.png') } : {};
const _bossImg = {};
if(typeof window!=='undefined') for(const b of _artSlots) _bossImg[b]=_img('assets/mobs/boss_'+b+'.png');

// Enemy frame animations (PixelLab objects). type/band -> {idle:[frames], attack:[frames]}
function _frames(dir,name,n){ const a=[]; if(typeof window!=='undefined') for(let i=0;i<n;i++) a.push(_img(dir+'/'+name+'_'+i+'.png')); return a; }
const _mobAnim={}, _bossAnim={}, _mobArchAnim={}, _allyAnim={}, _petAnim={};
function mobArchAnim(name){ const A=_mobArchAnim[name];
  return (A && A.idle && A.idle.length && A.idle[0].naturalWidth) ? A : null; }
function allyAnim(name){ const A=_allyAnim[name];
  return (A && A.idle && A.idle.length && A.idle[0].naturalWidth) ? A : null; }
// PETS. Loaded lazily by sprite name -- there are 32 species and only the one walking beside you
// is ever on screen, so probing all of them at boot would be 32 folders nobody looks at.
function petAnim(spr){
  if(!spr) return null;
  if(_petAnim[spr]===undefined) _petAnim[spr]={idle:_frames('assets/pets/anim/'+spr,'idle',9)};
  const A=_petAnim[spr];
  return (A && A.idle.length && A.idle[0].complete && A.idle[0].naturalWidth) ? A : null;
}
if(typeof window!=='undefined'){
  const _anim=(name)=>({idle:_frames('assets/mobs/anim/'+name,'idle',7), attack:_frames('assets/mobs/anim/'+name,'attack',7)});
  _mobAnim.c=_anim('hound');
  _mobAnim.s=_anim('cultist');
  // ARCHETYPE FRAMES (user: "give all of the mobs animations", then "make sure every creature in
  // the game has animations"). Nine idle and nine attack frames each, PixelLab v3, at
  // assets/mobs/anim/arch_<name>/{idle,attack}_N.png. _enemyFrame picks the attack set while
  // e.animAtk is running and the idle set otherwise; a missing folder leaves the archetype on its
  // static sprite, which is exactly where it was before any of this shipped.
  for(const k of ['crab','swarm','bird','husk','golem','plant','wisp','boar','slinger','shaman','acolyte'])
    _mobArchAnim[k]={idle:_frames('assets/mobs/anim/arch_'+k,'idle',9),
                     attack:_frames('assets/mobs/anim/arch_'+k,'attack',9)};
  // SUMMONED ALLIES. They fight beside you for a whole run and stood perfectly still doing it.
  for(const k of ['wolf','skel','wisp'])
    _allyAnim[k]={idle:_frames('assets/mobs/anim/ally_'+k,'idle',9), attack:[]};
  // every boss now has idle+attack frames; a slot without them falls back to its static sprite
  for(const b of _artSlots) _bossAnim[b]=_anim('boss_'+b);
}

// All 17 classes have real PixelLab art vendored to assets/<class>/.
// walk = 4 frames/dir; attack probed up to 8 (some dirs 5, some 7). West walk/attack
// mirror East at render time, so only s/e/n are vendored/probed for those; idle has
// real s/e/n/w rotations.
const EMBER_CLASSES = {
  knight:{anims:{walk:4,attack:8}}, paladin:{anims:{walk:4,attack:8}},
  berserker:{anims:{walk:4,attack:8}}, dragoon:{anims:{walk:4,attack:8}},
  rogue:{anims:{walk:4,attack:8}}, assassin:{anims:{walk:4,attack:8}},
  ranger:{anims:{walk:4,attack:8}}, hunter:{anims:{walk:4,attack:8}},
  bard:{anims:{walk:4,attack:8}}, monk:{anims:{walk:4,attack:8}},
  cleric:{anims:{walk:4,attack:8}}, pyro:{anims:{walk:4,attack:8}},
  frost:{anims:{walk:4,attack:8}}, storm:{anims:{walk:4,attack:8}},
  warlock:{anims:{walk:4,attack:8}}, necro:{anims:{walk:4,attack:8}},
  shaman:{anims:{walk:4,attack:8}},
};
// Ascended forms: vendored ascension sprite sets register as pseudo-classes
// 'asc_<ascensionId>' at assets/asc_<id>/ â€” emberSprite prefers them when the
// player has ascended and the art is loaded, else falls back to the base class.
const ASC_FORMS=['templar','warlord','sentinel','crusader','guardian','highpriest','ravager','bloodlord','juggernaut','wyrmknight','skylord','dragonlord','deathblade','nightblade','reaper','nightshade','executioner_a','phantom_a','sharpshooter','windranger','tempest_r','packlord','falconer','pathwarden','maestro','skald','loremaster','grandmaster','windwalker','ascendant','bishop','inquisitor','warden_c','infernomancer','emberlord','cinderguard','cryomancer','frostwarden','icebreaker','stormlord','thunderer','galewalker','soulflayer','doomcaller','dreadlord','lich','bonelord','plaguebringer','spiritcaller','tidesage','earthwarden'];   // grows as each form's art lands
for(const a of ASC_FORMS) EMBER_CLASSES['asc_'+a]={anims:{walk:4,attack:8}};
const EMBER_DIRS = ['s','e','n','w'];       // idle rotations (all real)
const EMBER_ANIM_DIRS = ['s','e','n'];      // walk/attack (west mirrors east)

const _emberImg = {};      // path -> HTMLImageElement
const _emberFrames = {};   // `${cls}/${anim}_${dir}` -> [img,...] (loaded, contiguous)
const _emberReady = {};    // cls -> true once idle frames are in
let _emberPending = 0;
const _emberClsPending = {};   // cls -> probes still in flight FOR THAT CLASS
const _emberProbed = {};       // cls -> its probes have been issued

// A CLASS BECOMES READY ON ITS OWN. The build used to run exactly once, when the last of ~2700
// probes settled, and _emberReady was empty until that single moment -- so one slow request held
// back all 68 sprite sets and EVERY character in the game drew the procedural fallback until the
// whole library was in. On a phone that is most of a minute of gold blobs. Each class now
// assembles the instant its own frames land.
// THE IDLE WAVE IS COUNTED SEPARATELY, and it has to be. _emberReady -- which is what decides
// whether a hero draws real art or the procedural fallback, and whether the character select
// screen shows a portrait or an emoji -- depends on the four idle poses ONLY. If both waves share
// a counter, the second wave's 36 files land in the middle of the first wave's 4 and the count
// never reaches zero until all 40 are in, so `ready` waits on the frames it was split away from.
// Measured: it left every class on the emoji fallback until the whole library had arrived, which
// is the exact failure the per-class build above was written to fix.
const _emberIdlePending = {};
function _emberDone(cls, idle){
  if(idle && --_emberIdlePending[cls]===0) _emberBuildClass(cls);   // ready as soon as it can be
  if(--_emberClsPending[cls]===0) _emberBuildClass(cls);            // again once the frames are in
  if(--_emberPending===0) _emberBuild();
}

function _emberImgAt(cls, anim, dir, n){
  const name = anim + '_' + dir + (n!=null ? ('_'+n) : '');
  const path = 'assets/' + cls + '/' + name + '.png';
  if(_emberImg[path]) return _emberImg[path];
  const idle = (anim === 'idle');
  const img = new Image();
  img.decoding = 'async';
  _emberPending++;
  _emberClsPending[cls] = (_emberClsPending[cls]||0) + 1;
  if(idle) _emberIdlePending[cls] = (_emberIdlePending[cls]||0) + 1;
  img.onload  = ()=>_emberDone(cls, idle);
  img.onerror = ()=>_emberDone(cls, idle);
  img.src = path;
  _emberImg[path] = _track(img);
  return img;
}

// A SPRITE SET LOADS IN TWO WAVES, because standing still and running are not equally urgent.
//
// The ascension split above established the principle: do not make the loading curtain wait on art
// that cannot possibly be on screen yet. The same argument applies one level down. A set is 40
// files -- 4 idle poses and 36 walk/attack frames -- and at boot we probed all 40 for all 17
// playable classes. But the only thing that needs art before you press PLAY is the character
// select screen, and that draws each class STANDING. The other 612 files are the running and
// swinging frames of sixteen heroes you did not pick, and the curtain waited on every one.
//
// So: idle at boot (68 files), motion on demand. `emberMotion` is called the first time a class
// actually moves, and `emberPreloadRest` sweeps the rest in the background once the curtain is up,
// so switching heroes later is still warm. A class whose motion has not landed yet holds its idle
// pose, which is the same graceful fallback an un-loaded ascension already used.
function emberProbe(cls){
  const spec = EMBER_CLASSES[cls];
  if(!spec || _emberProbed[cls]) return;
  _emberProbed[cls] = true;
  _emberClsPending[cls] = 1;                 // a guard count, released below, so an all-cached
  _emberIdlePending[cls] = 1;                // set cannot build before every probe is issued
  for(const d of EMBER_DIRS) _emberImgAt(cls, 'idle', d, null);
  _emberPending++;
  _emberDone(cls, true);
}

// The walk and attack frames. Separate flag from _emberProbed so the second wave is not swallowed
// by the first one's guard. Also idempotent, because emberSprite calls it on every frame it draws.
const _emberMoProbed = {};
function emberMotion(cls){
  const spec = EMBER_CLASSES[cls];
  if(!spec || _emberMoProbed[cls]) return;
  _emberMoProbed[cls] = true;
  emberProbe(cls);                           // motion without idle would never become _emberReady
  _emberClsPending[cls] = (_emberClsPending[cls]||0) + 1;
  _emberPending++;
  for(const d of EMBER_ANIM_DIRS){
    for(const anim in spec.anims){
      for(let n=0; n<spec.anims[anim]; n++) _emberImgAt(cls, anim, d, n);
    }
  }
  _emberDone(cls);                           // releases the guard; rebuilds once the frames land
}

function preloadEmber(){
  // ONLY THE PLAYABLE CLASSES AT BOOT. The 51 ascension sets are 1851 files and 11MB -- probing
  // them up front bought nothing (you cannot be ascended on the loading screen) and it was the
  // bulk of what the boot curtain was waiting on. They load the first time emberSprite is asked
  // for one, which is the frame a player with that form comes on screen.
  for(const cls in EMBER_CLASSES){ if(cls.indexOf('asc_')===0) continue; emberProbe(cls); }
}

// Called once the curtain is up. Issued LATE on purpose: anything registered through _track while
// the curtain is still counting would put itself back on the critical path, which is the whole
// thing this split exists to avoid.
//
// AND IT WAITS FOR THE IDLE WAVE FIRST. The curtain also lifts on a hard 12s cap, so on a cold
// cache over a slow link it can come up while the idle poses are still in flight -- and dumping
// 612 more requests into a browser that allows six at a time pushes the four files a hero
// actually needs to the back of the queue. Measured on a cold load: every class went ready at
// 58s with the second wave already competing. Deferred art must never delay priority art; that
// is the entire premise of splitting them.
// Waits on SETTLED, not on ready. An idle pose that 404s is never going to decode, and gating on
// _emberReady would then hold the second wave behind a file that does not exist until a timeout
// expired -- so the condition is "the idle wave is no longer in flight", which a 404 satisfies
// just as well as a success. That is the same distinction 10b_loading.js draws for the curtain.
let _emberRestTries = 0;
function emberPreloadRest(){
  const playable = [];
  for(const cls in EMBER_CLASSES){ if(cls.indexOf('asc_')!==0) playable.push(cls); }
  const settled = playable.every(c=>(_emberIdlePending[c]|0)===0);
  // the retry cap is a backstop against a request that neither loads nor errors, nothing more
  if(!settled && ++_emberRestTries < 240){ setTimeout(emberPreloadRest, 500); return; }
  for(const cls of playable) emberMotion(cls);
}

// Assemble one class's contiguous frame lists from whatever decoded.
function _emberBuildClass(cls){
  const spec = EMBER_CLASSES[cls]; if(!spec) return;
  for(const d of EMBER_ANIM_DIRS){
    for(const anim in spec.anims){
      const arr = [];
      for(let n=0; n<spec.anims[anim]; n++){
        const img = _emberImg['assets/'+cls+'/'+anim+'_'+d+'_'+n+'.png'];
        if(img && img.complete && img.naturalWidth) arr.push(img); else break;
      }
      _emberFrames[cls+'/'+anim+'_'+d] = arr;
    }
  }
  // ready if all four idle poses decoded
  _emberReady[cls] = EMBER_DIRS.every(d=>{
    const im = _emberImg['assets/'+cls+'/idle_'+d+'.png'];
    return im && im.complete && im.naturalWidth;
  });
}

// After all probes settle, rebuild everything that has been probed. Kept as a backstop: the
// per-class build above is what actually gets sprites on screen early.
function _emberBuild(){ for(const cls in _emberProbed) _emberBuildClass(cls); }

// aim angle (screen space: +x east, +y south) -> cardinal + flip flag
function _emberDir(aa){
  const deg = Math.atan2(Math.sin(aa), Math.cos(aa)) * 180/Math.PI;
  if(deg >= -45 && deg < 45)   return {dir:'e', flip:false};
  if(deg >= 45 && deg < 135)   return {dir:'s', flip:false};
  if(deg >= -135 && deg < -45) return {dir:'n', flip:false};
  return {dir:'w', flip:false};
}

function _emberIdle(cls, dir){ return _emberImg['assets/'+cls+'/idle_'+dir+'.png']; }

// Returns {img, flip} or null (=> procedural fallback in renderer)
function emberSprite(look, state){
  let cls = (look && look.cls) || 'knight';
  // ascended? use the ascension's own sprite set once its art is in. Asking for it is what
  // STARTS the load now -- until it arrives this falls through to the base class, which is a
  // correct-looking hero rather than a blank one.
  if(look && look.asc && EMBER_CLASSES['asc_'+look.asc]){
    emberProbe('asc_'+look.asc);
    if(_emberReady['asc_'+look.asc]) cls='asc_'+look.asc;
  }
  if(!EMBER_CLASSES[cls] || !_emberReady[cls]) return null;
  const {dir, flip} = _emberDir(state.aim||0);
  let flp = flip;
  // This hero is on screen, so its motion frames are now worth fetching. Idempotent and one
  // property read after the first call, so it is free to sit in the draw path.
  if(!_emberMoProbed[cls]) emberMotion(cls);

  if(state.attacking){
    let fr = _emberFrames[cls+'/attack_'+dir] || [];
    // west: flip east's attack if west absent
    if(!fr.length && dir==='w'){ fr = _emberFrames[cls+'/attack_e'] || []; if(fr.length) flp=true; }
    if(fr.length){
      const i = Math.min(fr.length-1, Math.floor((state.atkPhase||0) * fr.length));
      return {img: fr[i], flip: flp};
    }
    // no attack art for this dir -> hold the idle pose (graceful, non-blank)
    let idle = _emberIdle(cls, dir);
    if(!idle && dir==='w'){ idle = _emberIdle(cls,'e'); flp=true; }
    return idle && idle.naturalWidth ? {img: idle, flip: flp} : null;
  }

  if(state.moving){
    let fr = _emberFrames[cls+'/walk_'+dir] || [];
    if(!fr.length && dir==='w'){ fr = _emberFrames[cls+'/walk_e'] || []; if(fr.length) flp=true; }
    if(fr.length){
      const i = Math.floor((state.clock||0)*8) % fr.length;
      return {img: fr[i], flip: flp};
    }
  }

  // idle
  let idle = _emberIdle(cls, dir);
  if((!idle || !idle.naturalWidth) && dir==='w'){ idle = _emberIdle(cls,'e'); flp=true; }
  return idle && idle.naturalWidth ? {img: idle, flip: flp} : null;
}

if(typeof window!=='undefined') preloadEmber();
