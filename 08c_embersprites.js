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

// HUD orb frame (PixelLab) â€” ornate hollow ring for the HP/MP globes.
const _uiOrb = (typeof window!=='undefined') ? (()=>{ const i=new Image(); i.src='assets/ui/orb.png'; return i; })() : null;
// Reusable interact-button plate (PixelLab) â€” used by the portal/pillar USE prompt.
const _btnInteract = (typeof window!=='undefined') ? (()=>{ const i=new Image(); i.src='assets/ui/btn_interact.png'; return i; })() : null;
// Loot sacks (PixelLab), one per TIER BAND — never rarity, and never a chest: progression reads
// through material and ornament while the silhouette stays a sack. LOOT_BANDS names these by
// string, so adding the band above T12 later is one row plus one file.
//   _lootSack     public   T1-T8   plain burlap
//   _lootSackT9   bound    T9-T10  richer cloth, banded trim
//   _lootSackT11  bound    T11-T12 embroidered, clasped, ember at the seams
const _lootSack    = (typeof window!=='undefined') ? (()=>{ const i=new Image(); i.src='assets/ui/loot_sack.png';     return i; })() : null;
const _lootSackT9  = (typeof window!=='undefined') ? (()=>{ const i=new Image(); i.src='assets/ui/loot_sack_t9.png';  return i; })() : null;
const _lootSackT11 = (typeof window!=='undefined') ? (()=>{ const i=new Image(); i.src='assets/ui/loot_sack_t11.png'; return i; })() : null;
// Hearth (town) PixelLab art: 4 vendor shop stalls (with the vendor built in), fountain, portal.
const _hearth={};
if(typeof window!=='undefined') ['stall_bram','stall_sella','stall_maren','stall_odo','fountain','portal','floor',
  'floor_walk','floor_walk2','floor_broken','portal_realm','portal_cos','portal_vault','portal_guild','portal_arena',
  'wall','planter','brazier','lamp']
  .forEach(k=>{ _hearth[k]=_img('assets/hearth/'+k+'.png'); });
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
const AWAK_SLOTS=[0,1,2,3,4,5,6,7,8,9,10,11];
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
  ['sword','dagger','bow','xbow','staff','wand'].forEach(k=>{ _itemArt['wpn_'+k]=[0,1,2,3,4,5,6,7,8,9,10,11].map(b=>_img('assets/items/wpn_'+k+'_'+b+'.png')); });
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
// The band maths below spreads the ROLLABLE tiers over whatever art a key ships, so it keys off
// MAXT and not TIER_NAMES.length -- the ladder grew a thirteenth entry (Riftforged, relics only)
// and counting that one would have re-mapped every existing tier onto the wrong sprite.
function _nTiers(){ return (typeof MAXT!=='undefined')?MAXT:12; }
// Each relic ships its OWN sprite, drawn for the boss whose dungeon kept it. Lazy-loaded by id so
// twelve more images cost nothing until one actually drops.
const _relicArt={};
function relicArtImg(id){ if(typeof window==='undefined'||!id) return null;
  if(_relicArt[id]===undefined){ const i=new Image(); i.src='assets/items/relic_'+id+'.png'; _relicArt[id]=i; }
  const im=_relicArt[id]; return (im&&im.complete&&im.naturalWidth)?im:null; }
function itemArtImg(it){ if(!it||typeof _itemArt==='undefined') return null;
  if(it.relic){ const r=relicArtImg(it.relic); if(r) return r; }   // its own art wins outright
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
function _img(src){ if(typeof window==='undefined') return null; const i=new Image(); i.src=src; return i; }
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
  dagger:'dagger', staff:'magic_orb', wand:'wisp', fists:'wind_slash'
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
const DECAL_SRC={0:3,1:3,2:0,3:0,4:0,5:0,6:3,7:5,8:5};
const LAIR_BANDS=[0,1,2,3,4,5,6,7,8];         // all 9 zones have a boss-lair structure
(function(){
  if(typeof window==='undefined') return;
  for(const n of _projArt._list) _projArt[n]=_img('assets/proj/'+n+'.png');
  _miniPlus=_img('assets/ui/mini_plus.png'); _miniMinus=_img('assets/ui/mini_minus.png');
  for(let b=0;b<=8;b++) _groundSet[b]=_img('assets/tiles/set_'+b+'.png');
  // per-zone variant ground sheet (sampled at GROUND_UP like the base) for large-scale variety
  for(let b=0;b<=8;b++) _groundVar[b]=_img('assets/tiles/setv_'+b+'.png');
  // scatter decals (small transparent props laid on the ground): shared per theme set
  const _dsrc={};
  for(const s of [0,3,5]){ _dsrc[s]=[]; for(let i=0;i<6;i++) _dsrc[s].push(_img('assets/env/decal_'+s+'_'+i+'.png')); }
  for(let b=0;b<=8;b++) _decal[b]=_dsrc[DECAL_SRC[b]];
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
  for(let b=0;b<=8;b++) _terrSet[b]=_img('assets/tiles/terr_'+b+'.png');
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
  const bGrass=_img('assets/env/boulder_grass.png'), bGrey=_img('assets/env/boulder_grey.png'),
        bScorch=_img('assets/env/boulder_scorched.png'), bVolc=_img('assets/env/boulder_volcanic.png');
  // mossy boulders belong where there is moss, not on sand
  _bandBoulder[0]=_bandBoulder[1]=bGrey;
  _bandBoulder[2]=_bandBoulder[3]=_bandBoulder[4]=_bandBoulder[5]=bGrass;
  _bandBoulder[6]=bGrey;
  _bandBoulder[7]=bScorch;
  _bandBoulder[8]=bVolc;
  _bandTone[0]='rgba(22,44,16,0.40)';   // toned-down vivid grass (per feedback)
  _bandTone[7]='rgba(8,4,12,0.32)';     // calm the volcanic glow -> dark rock w/ glowing cracks
  _bandTone[8]='rgba(8,3,10,0.46)';     // molten: darker still, subdue the busy lava grid
})();

// Enemy sprites (PixelLab). Mobs (hound=c, cultist=s) + per-band boss images.
const _mobHound = _img('assets/mobs/hound.png');
const _mobCultist = _img('assets/mobs/cultist.png');
// Summoned allies / pets (wolf, skeleton, wisp) — real PixelLab art, procedural fallback.
const _allyImg = (typeof window!=='undefined') ? {
  wolf:_img('assets/mobs/ally_wolf.png'),
  skel:_img('assets/mobs/ally_skel.png'),
  wisp:_img('assets/mobs/ally_wisp.png') } : {};
const _bossImg = {};
if(typeof window!=='undefined') for(const b of _artSlots) _bossImg[b]=_img('assets/mobs/boss_'+b+'.png');

// Enemy frame animations (PixelLab objects). type/band -> {idle:[frames], attack:[frames]}
function _frames(dir,name,n){ const a=[]; if(typeof window!=='undefined') for(let i=0;i<n;i++) a.push(_img(dir+'/'+name+'_'+i+'.png')); return a; }
const _mobAnim={}, _bossAnim={};
if(typeof window!=='undefined'){
  const _anim=(name)=>({idle:_frames('assets/mobs/anim/'+name,'idle',7), attack:_frames('assets/mobs/anim/'+name,'attack',7)});
  _mobAnim.c=_anim('hound');
  _mobAnim.s=_anim('cultist');
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

function _emberImgAt(cls, anim, dir, n){
  const name = anim + '_' + dir + (n!=null ? ('_'+n) : '');
  const path = 'assets/' + cls + '/' + name + '.png';
  if(_emberImg[path]) return _emberImg[path];
  const img = new Image();
  img.decoding = 'async';
  _emberPending++;
  img.onload = ()=>{ if(--_emberPending===0) _emberBuild(); };
  img.onerror = ()=>{ if(--_emberPending===0) _emberBuild(); };
  img.src = path;
  _emberImg[path] = img;
  return img;
}

function preloadEmber(){
  for(const cls in EMBER_CLASSES){
    const spec = EMBER_CLASSES[cls];
    for(const d of EMBER_DIRS) _emberImgAt(cls, 'idle', d, null);
    for(const d of EMBER_ANIM_DIRS){
      for(const anim in spec.anims){
        for(let n=0; n<spec.anims[anim]; n++) _emberImgAt(cls, anim, d, n);
      }
    }
  }
}

// After all probes settle, assemble contiguous frame lists from what loaded.
function _emberBuild(){
  for(const cls in EMBER_CLASSES){
    const spec = EMBER_CLASSES[cls];
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
}

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
  // ascended? use the ascension's own sprite set once its art is in
  if(look && look.asc && EMBER_CLASSES['asc_'+look.asc] && _emberReady['asc_'+look.asc])
    cls='asc_'+look.asc;
  if(!EMBER_CLASSES[cls] || !_emberReady[cls]) return null;
  const {dir, flip} = _emberDir(state.aim||0);
  let flp = flip;

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
