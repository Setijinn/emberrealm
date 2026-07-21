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

// Populated as each class's animations are generated + vendored to assets/<class>/.
// Empty => every class falls back to the procedural heroSprite() until wired.
const EMBER_CLASSES = {
  // maxN = upper bound of frames to probe per animation (walk=4, attack up to 8)
  // e.g. knight: { anims: { walk: 4, attack: 8 } }
};
const EMBER_DIRS = ['s','e','n','w'];

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
    for(const d of EMBER_DIRS){
      _emberImgAt(cls, 'idle', d, null);
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
    for(const d of EMBER_DIRS){
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
