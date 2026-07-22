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

// Terrain art (PixelLab), per zone band. Ground = each tileset's all-terrain tile at (0,96,32).
function _img(src){ if(typeof window==='undefined') return null; const i=new Image(); i.src=src; return i; }
const _groundSet={}, _bandTree={}, _bandBoulder={}, _bandTone={};
const GROUND_UP=[0,96], GROUND_LO=[64,32];   // main + secondary ground tiles (uniform across tilesets)
(function(){
  if(typeof window==='undefined') return;
  for(let b=0;b<=8;b++) _groundSet[b]=_img('assets/tiles/set_'+b+'.png');
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
  const cls = (look && look.cls) || 'knight';
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
