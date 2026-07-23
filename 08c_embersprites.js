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

// HUD orb frame (PixelLab) — ornate hollow ring for the HP/MP globes.
const _uiOrb = (typeof window!=='undefined') ? (()=>{ const i=new Image(); i.src='assets/ui/orb.png'; return i; })() : null;
// Reusable interact-button plate (PixelLab) — used by the portal/pillar USE prompt.
const _btnInteract = (typeof window!=='undefined') ? (()=>{ const i=new Image(); i.src='assets/ui/btn_interact.png'; return i; })() : null;
// Loot containers (PixelLab): drab sack for low rarity, ornate chest for high rarity.
const _lootSack  = (typeof window!=='undefined') ? (()=>{ const i=new Image(); i.src='assets/ui/loot_sack.png';  return i; })() : null;
const _lootChest = (typeof window!=='undefined') ? (()=>{ const i=new Image(); i.src='assets/ui/loot_chest.png'; return i; })() : null;
// Hearth (town) PixelLab art: 4 vendor shop stalls (with the vendor built in), fountain, portal.
const _hearth={};
if(typeof window!=='undefined') ['stall_bram','stall_sella','stall_maren','stall_odo','fountain','portal','floor',
  'floor_walk','floor_walk2','floor_broken','portal_realm','portal_cos','portal_vault','portal_guild','portal_arena',
  'wall','planter','brazier','lamp']
  .forEach(k=>{ _hearth[k]=_img('assets/hearth/'+k+'.png'); });
// water tile (global — hub pool + grove lakes)
const _waterImg=(typeof window!=='undefined')?_img('assets/tiles/water.png'):null;
// Awakened dungeons: per-ring consciousness tileset + spectral awakened-boss sprite
// (render falls back to lairset / normal boss art until these land)
const _dunSet={}, _awakImg={};
if(typeof window!=='undefined') for(let b=0;b<=8;b++){
  _dunSet[b]=_img('assets/tiles/dunset_'+b+'.png');
  _awakImg[b]=_img('assets/mobs/awak_'+b+'.png'); }
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
  ['sword','dagger','bow','xbow','staff','wand'].forEach(k=>{ _itemArt['wpn_'+k]=[0,1,2].map(b=>_img('assets/items/wpn_'+k+'_'+b+'.png')); });
  ['plate','leather','robe'].forEach(m=>{ _itemArt['arm_'+m]=[0,1,2].map(b=>_img('assets/items/arm_'+m+'_'+b+'.png'));
    _itemArt['helm_'+m]=[0,1,2].map(b=>_img('assets/items/helm_'+m+'_'+b+'.png')); });
  ['hp','dmg','def','mp','vit','wis','dex','spd','luck'].forEach(s=>{ _itemArt['ring_'+s]=[0,1,2].map(b=>_img('assets/items/ring_'+s+'_'+b+'.png')); });
  _itemArt['coin']=[0,1,2].map(b=>_img('assets/items/coin_'+b+'.png'));   // bronze/silver/gold
  _itemArt['potion']=[_img('assets/items/potion.png')];
}
// Ability art (PixelLab): a figure using each ability. Lazy-loaded by ability id
// (assets/abilities/<id>.png); returns the image only once decoded, else null -> emoji.
const _abilImgCache={};
function abilImg(id){ if(typeof window==='undefined'||!id) return null;
  if(_abilImgCache[id]===undefined){ const i=new Image(); i.src='assets/abilities/'+id+'.png'; _abilImgCache[id]=i; }
  const im=_abilImgCache[id]; return (im&&im.complete&&im.naturalWidth)?im:null; }
function itemArtImg(it){ if(!it||typeof _itemArt==='undefined') return null;
  // coins use their denomination (0/1/2) as the band directly, not tier/4
  const band=(it.k==='coin')?Math.min(2,it.t||0):Math.min(2,Math.floor((it.t||0)/4)); let key=null;
  if(it.k==='wpn') key='wpn_'+it.wt; else if(it.k==='arm') key='arm_'+it.mt;
  else if(it.k==='helm') key='helm_'+it.mt; else if(it.k==='ring') key='ring_'+it.st;
  else if(it.k==='coin') key='coin'; else if(it.k==='pot') key='potion';
  const arr=_itemArt[key]; if(!arr) return null;
  const im=arr[Math.min(band,arr.length-1)];
  return (im&&im.complete&&im.naturalWidth)?im:null; }

// Terrain art (PixelLab), per zone band. Ground = each tileset's all-terrain tile at (0,96,32).
function _img(src){ if(typeof window==='undefined') return null; const i=new Image(); i.src=src; return i; }
// PixelLab projectile art — 24 base shapes; the forge hue-shifts each into many variants
const _projArt={_list:['arrow','fireball','ice_shard','lightning','magic_orb','skull','note','leaf',
 'dagger','chakram','spear','void_orb','holy_star','bone','wind_slash','crystal',
 'thorn','ember','wisp','rune','shuriken','axe','meteor','feather']};
const _groundSet={}, _bandTree={}, _bandBoulder={}, _bandTone={};
const _groundVar={}, _decal={}, _lair={};   // richer terrain: variant ground tiles + scatter decals + boss lairs
const _lairSet={}, _lairDec={};              // boss-room wall/floor tileset (wall=GROUND_UP, floor=GROUND_LO) + interior decorations
const GROUND_UP=[0,96], GROUND_LO=[64,32];   // main + secondary ground tiles (uniform across tilesets)
// every band gets decals: forest zones share the grass set (0), stone zones the rocky set (3),
// ash/fire zones the ember set (5) — richness everywhere without 9 full unique sets
const DECAL_SRC={0:0,1:0,2:0,3:3,4:3,5:5,6:5,7:5,8:5};
const LAIR_BANDS=[0,1,2,3,4,5,6,7,8];         // all 9 zones have a boss-lair structure
(function(){
  if(typeof window==='undefined') return;
  for(const n of _projArt._list) _projArt[n]=_img('assets/proj/'+n+'.png');
  for(let b=0;b<=8;b++) _groundSet[b]=_img('assets/tiles/set_'+b+'.png');
  // per-zone variant ground sheet (sampled at GROUND_UP like the base) for large-scale variety
  for(let b=0;b<=8;b++) _groundVar[b]=_img('assets/tiles/setv_'+b+'.png');
  // scatter decals (small transparent props laid on the ground): shared per theme set
  const _dsrc={};
  for(const s of [0,3,5]){ _dsrc[s]=[]; for(let i=0;i<6;i++) _dsrc[s].push(_img('assets/env/decal_'+s+'_'+i+'.png')); }
  for(let b=0;b<=8;b++) _decal[b]=_dsrc[DECAL_SRC[b]];
  // boss lairs per band: exterior-den centrepiece sprite, wall/floor tileset, interior decorations
  for(const b of LAIR_BANDS) _lair[b]=_img('assets/env/lair_'+b+'.png');
  for(const b of LAIR_BANDS) _lairSet[b]=_img('assets/tiles/lairset_'+b+'.png');
  for(const b of LAIR_BANDS){ _lairDec[b]=[]; for(let i=0;i<4;i++) _lairDec[b].push(_img('assets/env/ldec_'+b+'_'+i+'.png')); }
  _bandTree[0]=_img('assets/env/tree_grass.png');
  _bandTree[1]=_img('assets/env/tree_pine.png');
  _bandTree[2]=_img('assets/env/tree_willow.png');
  const bGrass=_img('assets/env/boulder_grass.png'), bGrey=_img('assets/env/boulder_grey.png'),
        bScorch=_img('assets/env/boulder_scorched.png'), bVolc=_img('assets/env/boulder_volcanic.png');
  _bandBoulder[0]=_bandBoulder[1]=_bandBoulder[2]=bGrass;
  _bandBoulder[3]=_bandBoulder[4]=bGrey;
  _bandBoulder[5]=_bandBoulder[6]=bScorch;
  _bandBoulder[7]=_bandBoulder[8]=bVolc;
  _bandTone[0]='rgba(22,44,16,0.40)';   // toned-down vivid grass (per feedback)
  _bandTone[7]='rgba(8,4,12,0.32)';     // calm the volcanic glow -> dark rock w/ glowing cracks
  _bandTone[8]='rgba(8,3,10,0.46)';     // molten: darker still, subdue the busy lava grid
})();

// Enemy sprites (PixelLab). Mobs (hound=c, cultist=s) + per-band boss images.
const _mobHound = _img('assets/mobs/hound.png');
const _mobCultist = _img('assets/mobs/cultist.png');
const _bossImg = {};
if(typeof window!=='undefined') for(let b=0;b<=8;b++) _bossImg[b]=_img('assets/mobs/boss_'+b+'.png');

// Enemy frame animations (PixelLab objects). type/band -> {idle:[frames], attack:[frames]}
function _frames(dir,name,n){ const a=[]; if(typeof window!=='undefined') for(let i=0;i<n;i++) a.push(_img(dir+'/'+name+'_'+i+'.png')); return a; }
const _mobAnim={}, _bossAnim={};
if(typeof window!=='undefined'){
  const _anim=(name)=>({idle:_frames('assets/mobs/anim/'+name,'idle',7), attack:_frames('assets/mobs/anim/'+name,'attack',7)});
  _mobAnim.c=_anim('hound');
  _mobAnim.s=_anim('cultist');
  for(let b=0;b<=8;b++) _bossAnim[b]=_anim('boss_'+b);
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
// 'asc_<ascensionId>' at assets/asc_<id>/ — emberSprite prefers them when the
// player has ascended and the art is loaded, else falls back to the base class.
const ASC_FORMS=['templar','warlord','sentinel','crusader','guardian','highpriest','ravager','bloodlord','juggernaut'];   // grows as each form's art lands
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
