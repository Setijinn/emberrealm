// ---------- always-on minimap (top-left) ----------
// Replaces the map BUTTON: instead of opening a full-screen map you now always have a small live
// map in the corner. It shows a window around you rather than the whole world, because at 1160x720
// tiles the whole world in 150px puts every landmark within a few pixels of every other one and
// tells you nothing about where to walk.
//
// A boss that is off the window still matters, so its marker is clamped to the rim and drawn
// hollow -- you get its direction without pretending it is close.

const MINI_PAD = 10;              // gap from the screen corner
const MINI_BASE = 148;            // panel size in CSS px at UI scale 1
const MINI_ZOOMS = [26, 40, 60, 90, 130];   // half-window in TILES; index 0 = closest in
let miniZoom = 2;
let _miniCache = null;

// The whole world rendered once at low resolution. The minimap then blits the sub-rect it needs,
// so panning and zooming cost one drawImage instead of re-rasterising terrain every frame.
// Per-terrain tinting on TOP of the zone ramp. The map used to paint every walkable tile the same
// zone colour with a flat dark square over trees, so the whole world read as one flat wash: you
// could see which BAND you were in and nothing about the ground itself. Now the zone ramp still
// sets the hue -- a zone has to stay recognisable at a glance -- and each terrain character shifts
// it toward its own material, so coastline, grassland, scree, ash flats and the forest all have
// distinct shapes on the map. Mixed in the cache, so it costs nothing per frame.
// ---- TERRAIN PALETTES ----
// The map exists for every INSTANCE now (user, 2026-07-27: "make mini maps for every instance"),
// and the four kinds of place do not share a vocabulary. The same character means different things
// in different rooms -- 'W' is a wall in the Hearth and the VOID outside the corridors in a
// dungeon -- so the palette is chosen by what kind of room you are standing in, not globally.

// OVERWORLD: the zone ramp sets the hue (a zone has to stay recognisable at a glance) and the
// terrain character shifts it toward its own material.
const MINI_TERR = {
  g:{c:[ 96,142, 70], k:0.50},   // grassland
  d:{c:[124,104, 72], k:0.42},   // dirt / open ground
  r:{c:[132,132,140], k:0.46},   // scree and bare rock
  e:{c:[ 92, 82, 86], k:0.46},   // burnt ash flats
  k:{c:[ 88, 88, 96], k:0.55},   // boulders
  t:{c:[ 42, 74, 44], k:0.62},   // forest
  '.':{c:[150,132,100], k:0.45}, // trodden path
  F:{c:[110, 96,112], k:0.55},   // a lair's own floor
  X:{c:[ 30, 26, 34], k:0.80}    // wall / cliff
};
// TOWN and the service rooms: flat, warm, legible. No zones here to colour by.
const MINI_TOWN = {
  f:'#6b5a44', p:'#8a7454', g:'#4e7340', w:'#255070',
  h:'#8a6a46', H:'#a07c50', l:'#d8b45c', W:'#241f28', '.':'#c2a06a'
};
// The plain corridor rooms: floor and wall, nothing else to say.
const MINI_PLAIN = { '.':'#6a6153', W:'#241f28', f:'#6a6153', p:'#8a7454' };
// DUNGEON: 'W' is not a wall, it is the void outside the dream. Corridors read cooler than
// chambers so the shape of the place is readable rather than one undifferentiated blob.
const MINI_DUN = { W:'#0a0812', D:'#e0a04a', '.':'#8b7c99', p:'#6b6184', f:'#8b7c99' };

function _miniClass(R){
  if(!R) return 'plain';
  if(R.rings) return 'over';
  if(R.dungeon) return 'dun';
  if(R.petRoom) return 'town';
  if(R.town || R.key==='VAULT' || R.key==='GUILD' || R.key==='COSMETICS' || R.key==='ARENA') return 'town';
  return 'plain';
}
function _miniMix(hex,rgb,k){
  const h=hex.replace('#',''),
        r=parseInt(h.slice(0,2),16), g=parseInt(h.slice(2,4),16), b=parseInt(h.slice(4,6),16);
  return 'rgb('+Math.round(r+(rgb[0]-r)*k)+','+Math.round(g+(rgb[1]-g)*k)+','+Math.round(b+(rgb[2]-b)*k)+')';
}
// A dungeon is a NEW PLACE every time it is generated, so it needs an identity of its own or the
// cache and the fog from the last one bleed into it. genDungeon builds a fresh object, so a lazy
// id on the room is enough -- a regenerated dungeon simply has none yet.
let _mapSeq=0;
function _miniId(R){ if(!R._mapId) R._mapId=(R.key||'?')+':'+(++_mapSeq); return R._mapId; }

// The room rendered once at low resolution. The minimap then blits the sub-rect it needs, so
// panning and zooming cost one drawImage instead of re-rasterising terrain every frame.
// Scale is chosen from the room's SIZE: at a fixed 0.62 px/tile a 42-tile Hearth is a 26px
// thumbnail, which is not a map of anything.
// A TOTAL-PIXEL BUDGET, NOT A PER-TILE FLOOR, and this one fails SILENTLY at the three-island size.
//
// It read `min(8, max(0.62, 760/max(w,h)))`. The 760 term is the intent -- fit the long side into 760
// px -- but the 0.62 FLOOR overrides it the moment a room is bigger than ~1225 tiles across. At 3600
// wide, 760/3600 = 0.211 clamps up to 0.62 and the canvas becomes 2232x1389: 3.1M cells where today's
// is 359k. That is ~12.4 MB of RGBA backing store, and _fogA grows with it.
//
// AND THE CONSEQUENCE IS INVISIBLE. fogReveal writes _fogCv.toDataURL('image/png') into localStorage
// every six seconds inside a bare try/catch. Blow the ~5 MB origin quota and the write throws, the
// catch eats it, and fog persistence simply stops -- with no error, no symptom, and nothing to notice
// until a reload comes back to a black map. So the budget is expressed as the thing that actually
// matters (how many cells exist) and the floor only applies where it was ever needed: small rooms,
// where 0.62 px/tile really would draw a 26px thumbnail of a 42-tile Hearth.
const FOG_PX_BUDGET=360000;     // ~= today's overworld canvas, which is the size that is known to work
function miniScaleFor(R){
  const w=Math.max(1,R.w|0), h=Math.max(1,R.h|0);
  // the budget, then the same 8 px/tile ceiling as before, then a floor that only a SMALL room can
  // reach -- 0.62 is kept for exactly the case it was written for and can no longer override the budget
  const byBudget=Math.sqrt(FOG_PX_BUDGET/(w*h));
  const s=Math.min(8, byBudget);
  return (w*h < FOG_PX_BUDGET) ? Math.min(8, Math.max(0.62, s)) : s;
}
function miniTerrain(R){
  const key=_miniId(R)+':'+R.w+'x'+R.h;
  if(_miniCache && _miniCache.key===key) return _miniCache.cv;
  const s=miniScaleFor(R);
  const cv=document.createElement('canvas');
  cv.width=Math.max(1,Math.round(R.w*s)); cv.height=Math.max(1,Math.round(R.h*s));
  const c=cv.getContext('2d');
  const cls=_miniClass(R);
  c.fillStyle=(cls==='dun')?'#07060e':'#0b0a10'; c.fillRect(0,0,cv.width,cv.height);
  const T=(cls==='over'&&typeof _territories==='function')?_territories(R):null;
  // _zg is gone; zoneAt reads a cached 64x64 chunk. This loop is strided, so it warms only the
  // chunks the picture actually covers.
  const zAt=(tx,ty)=>(typeof zoneAtIn==='function')?zoneAtIn(R,tx,ty):-1;
  const step=Math.max(1,Math.ceil(Math.sqrt((R.w*R.h)/420000)));
  const bs=s*step+0.7;
  const OCEAN=(typeof MAP_OCEAN!=='undefined')?MAP_OCEAN:'#16324a';
  const FLAT=(cls==='town')?MINI_TOWN:(cls==='dun')?MINI_DUN:MINI_PLAIN;
  for(let ty=0;ty<R.h;ty+=step){
    for(let tx=0;tx<R.w;tx+=step){ const ch=gAt(R,tx,ty); if(ch==='\0') continue;
      const px=tx*s, py=ty*s;
      if(cls!=='over'){ const col=FLAT[ch]; if(!col) continue;
        c.fillStyle=col; c.fillRect(px,py,bs,bs);
        // the same value noise the overworld gets, so a big flat floor is not dead colour
        if(((tx*7+ty*13)&7)===0){ c.fillStyle='rgba(0,0,0,0.12)'; c.fillRect(px,py,bs,bs); }
        else if(((tx*5+ty*11)&7)===0){ c.fillStyle='rgba(255,250,235,0.06)'; c.fillRect(px,py,bs,bs); }
        continue; }
      if(ch==='w'){
        // shallows read lighter than deep water, so the coastline is a shape and not a hard edge
        const _land=(xx,yy)=>{ const cc=gCode(R,xx,yy); return cc!==0&&cc!==T_w; };
        const nearLand=_land(tx-1,ty)||_land(tx+1,ty)||_land(tx,ty-1)||_land(tx,ty+1);
        c.fillStyle=nearLand?'#255070':OCEAN; c.fillRect(px,py,bs,bs); continue; }
      if(ch==='b'){ c.fillStyle=(typeof MAP_BRIDGE!=='undefined')?MAP_BRIDGE:'#6b5a3e'; c.fillRect(px,py,bs,bs); continue; }
      const zi=zAt(tx,ty);
      const tt=(T&&zi>=0)?T[zi]:null;
      const base=(typeof MRAMP!=='undefined'&&MRAMP[tt?tt.band:0])||'#547a44';
      const M=MINI_TERR[ch];
      c.fillStyle=M?_miniMix(base,M.c,M.k):base;
      c.fillRect(px,py,bs,bs);
      if(((tx*7+ty*13)&7)===0){ c.fillStyle='rgba(0,0,0,0.10)'; c.fillRect(px,py,bs,bs); }
      else if(((tx*5+ty*11)&7)===0){ c.fillStyle='rgba(255,250,235,0.07)'; c.fillRect(px,py,bs,bs); } } }
  _miniCache={key:key,cv:cv,s:s};
  return cv;
}

// ---- fog of war ----
// The map starts black and is uncovered in a circle as you walk. Kept as a canvas the same size as
// the terrain cache: revealing is one erase per frame and drawing is one blit, so the cost does not
// grow with how much of the world you have seen. Persisted per character, because exploration you
// paid for should still be there tomorrow.
const FOG_REVEAL_TILES = 22;
let _fogCv=null, _fogCtx=null, _fogKey=null, _fogDirty=0, _fogSaveT=0, _fogWarned=0;
// COVERAGE, MIRRORED IN A TYPED ARRAY. fogSeen used to answer by reading the fog canvas --
// getImageData(x,y,1,1) -- and drawMinimap calls it once per boss, lair, portal, loot bag, enemy
// and objective node, every frame. That is 20-40 synchronous canvas readbacks per frame, each one
// flushing the 2D pipeline and forcing a GPU->CPU sync: the most reliable way there is to cap a
// canvas game's frame rate. The array holds the same remaining-alpha value the canvas does, using
// the identical destination-out arithmetic, so the two cannot disagree.
let _fogA=null, _fogAW=0, _fogAH=0;

// THE KEY CARRIES THE WORLD'S SHAPE. A saved fog PNG is drawn for one canvas size, and fogInit
// restores it with drawImage(im,0,0,w,h) -- which STRETCHES whatever it finds to the current canvas. So
// a fog image from the 1160x720 world would be scaled over the three-island one and uncover a scaled
// ghost of somewhere else: a map that looks explored and does not match the ground. Putting w+h in the
// key means an old image is never even looked at, rather than being found and misread.
function _fogSlot(R){
  const ch=(typeof curChar==='function')?curChar():null;
  const u=(typeof curUser!=='undefined')?curUser:null;
  const shape=(R?((R.w|0)+'x'+(R.h|0)):'0x0');
  return 'er-fog:'+((u&&u.name)||u||'u')+':'+((ch&&ch.name)||'c')+':'+((R&&R.key)||'G')+':'+shape;
}
// Old fog under the pre-shape key is dead weight in a ~5 MB quota that the fog itself is trying to fit
// inside, so it is removed rather than orphaned. Runs once per slot, and only for keys that belong to
// THIS user and character -- never a blind sweep of localStorage.
function _fogDropLegacy(R){
  try{
    const ch=(typeof curChar==='function')?curChar():null;
    const u=(typeof curUser!=='undefined')?curUser:null;
    const stem='er-fog:'+((u&&u.name)||u||'u')+':'+((ch&&ch.name)||'c')+':'+((R&&R.key)||'G');
    if(localStorage.getItem(stem)!==null) localStorage.removeItem(stem);
  }catch(e){}
}
// Only the OVERWORLD's exploration is worth keeping: it is one persistent place you map over many
// runs. A dungeon is a new layout every time, so remembering the last one's fog would uncover a
// map that does not match the walls -- worse than no map. The Hearth and the service rooms are
// places you live in; they start fully revealed and never fog at all.
function _fogPersist(R){ return !!(R && R.rings); }
function _fogUsed(R){ return !!(R && (R.rings || R.dungeon)); }
function fogInit(R){
  const key=_miniId(R)+':'+_fogSlot(R);
  if(_fogCv && _fogKey===key) return;
  const cv=miniTerrain(R);
  _fogCv=document.createElement('canvas'); _fogCv.width=cv.width; _fogCv.height=cv.height;
  _fogCtx=_fogCv.getContext('2d',{willReadFrequently:true});
  _fogAW=_fogCv.width; _fogAH=_fogCv.height;
  _fogA=new Uint8Array(_fogAW*_fogAH); _fogA.fill(_fogUsed(R)?255:0);   // 255 = fully fogged
  if(_fogUsed(R)){ _fogCtx.fillStyle=(R.dungeon?'#06050c':'#05050a'); _fogCtx.fillRect(0,0,_fogCv.width,_fogCv.height); }
  _fogKey=key;
  if(!_fogPersist(R)) return;
  _fogDropLegacy(R);
  try{ const st=localStorage.getItem(_fogSlot(R));
    if(st){ const im=new Image();
      im.onload=()=>{ if(_fogCtx){ _fogCtx.globalCompositeOperation='copy';
        _fogCtx.drawImage(im,0,0,_fogCv.width,_fogCv.height);
        _fogCtx.globalCompositeOperation='source-over';
        // Seed the array from the restored image. ONE readback, at load, for a saved map that was
        // revealed across earlier sessions -- not one per entity per frame.
        try{ const d=_fogCtx.getImageData(0,0,_fogAW,_fogAH).data;
          for(let i=0,n=_fogAW*_fogAH;i<n;i++) _fogA[i]=d[i*4+3]; }catch(e){}
      } };
      im.src=st; } }catch(e){}
}
function fogReveal(R,dt){
  if(!_fogCtx || !_fogUsed(R)) return;
  const s=_miniCache.s;
  // a dungeon corridor is a couple of tiles wide, so the overworld's 22-tile disc would light the
  // whole floor from the door. Reveal scales with the place.
  const r=(R.dungeon?9:FOG_REVEAL_TILES)*s;
  const px=(player.x/TILE)*s, py=(player.y/TILE)*s;
  _fogCtx.save();
  _fogCtx.globalCompositeOperation='destination-out';
  // soft edge, so the revealed area feathers instead of stamping hard discs
  const g=_fogCtx.createRadialGradient(px,py,r*0.45,px,py,r);
  g.addColorStop(0,'rgba(0,0,0,1)'); g.addColorStop(1,'rgba(0,0,0,0)');
  _fogCtx.fillStyle=g;
  _fogCtx.beginPath(); _fogCtx.arc(px,py,r,0,6.29); _fogCtx.fill();
  _fogCtx.restore();
  // The same erase, applied to the array. destination-out with alpha a leaves (1-a) of what was
  // there, and the gradient runs 1 at 0.45r to 0 at r -- so this is the canvas's own arithmetic,
  // not an approximation of it. Bounded by the disc, ~29x29 cells on the overworld.
  if(_fogA){
    const x0=Math.max(0,Math.floor(px-r)), x1=Math.min(_fogAW-1,Math.ceil(px+r));
    const y0=Math.max(0,Math.floor(py-r)), y1=Math.min(_fogAH-1,Math.ceil(py+r));
    const inner=r*0.45, span=Math.max(0.001,r-inner);
    for(let y=y0;y<=y1;y++){ const row=y*_fogAW, dy=y-py;
      for(let x=x0;x<=x1;x++){ const dx=x-px, d=Math.sqrt(dx*dx+dy*dy);
        if(d>=r) continue;
        const a=d<=inner?1:(r-d)/span;
        const i=row+x, left=_fogA[i]*(1-a);
        if(left<_fogA[i]) _fogA[i]=left; } }
  }
  if(!_fogPersist(R)) return;
  _fogDirty=1;
  _fogSaveT-=dt||0.016;
  if(_fogDirty && _fogSaveT<=0){ _fogSaveT=6;      // throttled: a dataURL every frame would stutter
    // A BARE catch{} HERE IS HOW FOG PERSISTENCE DIES QUIETLY. Blow the ~5 MB origin quota and this
    // throws, the catch eats it, and exploration silently stops being saved -- no error, no symptom,
    // nothing to notice until a reload comes back to a black map. It still must not throw into the
    // frame, so the failure is caught and REPORTED, once, with the size that did not fit.
    try{ localStorage.setItem(_fogSlot(R), _fogCv.toDataURL('image/png')); _fogDirty=0; _fogWarned=0; }
    catch(e){
      if(!_fogWarned){ _fogWarned=1;
        let kb=-1; try{ kb=Math.round(_fogCv.toDataURL('image/png').length/1024); }catch(_){}
        const m='fog could not be saved ('+kb+' KB, '+_fogCv.width+'x'+_fogCv.height+') — '
               +'exploration will not persist: '+(e&&e.name||e);
        if(typeof console!=='undefined') console.warn(m);
        if(typeof msg==='function') msg('MAP NOT SAVED','the fog of war is too large to store');
      }
      _fogSaveT=30;          // stop hammering a quota that is not going to change in six seconds
    }
  }
}
function fogSeen(R,wx,wy){
  if(!_fogA || !_fogUsed(R)) return true;
  const s=_miniCache.s;
  const x=Math.round((wx/TILE)*s), y=Math.round((wy/TILE)*s);
  if(x<0||y<0||x>=_fogAW||y>=_fogAH) return false;
  return _fogA[y*_fogAW+x] < 130;      // same threshold the readback used
}

// A CSS-PIXEL SIZE IS NOT A SIZE ON A PHONE. 148px is 11% of a 1280x720 desktop's width and 20% of
// its height; on a 667x375 phone in landscape the same panel is 22% and 39% -- a fifth of the screen,
// covering ground the player is walking into. The panel is bounded by the SHORT axis as well, so the
// desktop keeps the size it was tuned at and a small screen gets a panel in proportion to itself.
const MINI_MAX_FRAC = 0.30;       // of min(W,H)
function miniRect(){
  const u=(typeof UIS!=='undefined')?UIS:1;
  const short=Math.min((typeof W!=='undefined'?W:1280),(typeof H!=='undefined'?H:720));
  const sz=Math.max(72,Math.round(Math.min(MINI_BASE*u, short*MINI_MAX_FRAC)));
  const pad=Math.round(MINI_PAD*u);
  // the zoom buttons scale WITH the panel rather than off a fixed 26px, or shrinking the map
  // leaves two buttons nearly as wide as it is
  return {x:pad, y:pad, w:sz, h:sz, btn:Math.round(sz*0.125)};
}
// The zoom buttons live INSIDE the frame now, bottom-right (user, 2026-07-27). One geometry
// function so the hit-test and the painter can never drift apart -- which is exactly how a
// control ends up looking like it is somewhere it is not.
function miniBtns(){
  const R=miniRect(), b=R.btn, m=Math.round(b*0.28);
  const by=R.y+R.h-b-m;
  return {b:b, by:by, out:R.x+R.w-b-m, in:R.x+R.w-b*2-m-Math.round(b*0.22)};
}
// Hit-test for the zoom buttons; controls call this on tap/click.
function miniHit(mx,my){
  if(typeof inGame==='undefined' || !inGame) return null;
  const B=miniBtns();
  if(my<B.by || my>B.by+B.b) return null;
  if(mx>=B.in && mx<=B.in+B.b) return 'in';
  if(mx>=B.out && mx<=B.out+B.b) return 'out';
  return null;
}
function miniZoomIn(){ miniZoom=Math.max(0,miniZoom-1); }
function miniZoomOut(){ miniZoom=Math.min(MINI_ZOOMS.length-1,miniZoom+1); }

// Half-window in TILES for the room you are in. A 42-tile Hearth at the overworld's 26-tile zoom
// would be mostly black void around a small town, so the window is clamped to the room and its
// centre is clamped to keep it inside -- a small room simply shows all of itself.
function miniWindow(R){
  let half=MINI_ZOOMS[miniZoom];
  // The panel is SQUARE and the rooms are not. Capping only at the long axis let a 274x84 dungeon
  // zoom out to a 260-tile square window, of which 84 tiles was the dungeon and the rest was void:
  // the whole place collapsed into a thin band two pixels tall. Cap so the SHORT axis stays mostly
  // used -- you pan along a long dungeon instead of shrinking it into nothing -- while a nearly
  // square room like the Hearth still shows all of itself at once.
  half=Math.min(half, Math.max(R.w,R.h)/2, (Math.min(R.w,R.h)/2)*1.6);
  let cx=player.x/TILE, cy=player.y/TILE;
  if(R.w<=half*2) cx=R.w/2; else cx=Math.max(half,Math.min(R.w-half,cx));
  if(R.h<=half*2) cy=R.h/2; else cy=Math.max(half,Math.min(R.h-half,cy));
  return {half:half, cx:cx, cy:cy};
}
function drawMinimap(){
  if(typeof inGame==='undefined' || !inGame) return;
  const G=curRoom; if(!G||!G.cells) return;             // EVERY instance has a map now
  const R=miniRect();
  const Wn=miniWindow(G), half=Wn.half;

  ctx.save();
  // panel
  ctx.fillStyle='rgba(10,8,14,0.82)';
  ctx.fillRect(R.x-3,R.y-3,R.w+6,R.h+6);
  ctx.strokeStyle='rgba(196,158,90,0.55)'; ctx.lineWidth=2;
  ctx.strokeRect(R.x-3,R.y-3,R.w+6,R.h+6);

  // terrain window, clipped to the panel
  ctx.beginPath(); ctx.rect(R.x,R.y,R.w,R.h); ctx.clip();
  const cv=miniTerrain(G), s=_miniCache.s;
  const sx=(Wn.cx-half)*s, sy=(Wn.cy-half)*s, sw=half*2*s, sh=half*2*s;
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(cv, sx,sy,sw,sh, R.x,R.y,R.w,R.h);
  // fog on top of the terrain but UNDER the markers, so your own dot stays visible in the dark
  fogInit(G); fogReveal(G, 0.016);
  if(_fogCv && _fogUsed(G)) ctx.drawImage(_fogCv, sx,sy,sw,sh, R.x,R.y,R.w,R.h);

  // world tile -> panel pixel
  const P=(wx,wy)=>({x:R.x+((wx/TILE)-(Wn.cx-half))/(half*2)*R.w,
                     y:R.y+((wy/TILE)-(Wn.cy-half))/(half*2)*R.h});
  const inPanel=(p)=>p.x>=R.x&&p.x<=R.x+R.w&&p.y>=R.y&&p.y<=R.y+R.h;

  // ---- DUNGEON LANDMARKS ----
  // A dungeon is the one place you can genuinely get lost, so it gets the two things you actually
  // navigate by: the way out, and the room you are working toward.
  if(G.dungeon){
    if(G.bossCh && fogSeen(G,G.bossCh.cx,G.bossCh.cy)){
      const c0=P((G.bossCh.cx-G.bossCh.rx), (G.bossCh.cy-G.bossCh.ry));
      const c1=P((G.bossCh.cx+G.bossCh.rx), (G.bossCh.cy+G.bossCh.ry));
      ctx.strokeStyle='rgba(255,74,61,0.75)'; ctx.lineWidth=1.6;
      ctx.strokeRect(c0.x,c0.y,c1.x-c0.x,c1.y-c0.y); }
    if(G.px!=null){ const p=P((G.px+0.5)*TILE,(G.py+0.5)*TILE);
      if(inPanel(p)){ ctx.fillStyle='#7dc47a'; ctx.beginPath();
        ctx.moveTo(p.x,p.y-4); ctx.lineTo(p.x+3.6,p.y+3); ctx.lineTo(p.x-3.6,p.y+3);
        ctx.closePath(); ctx.fill(); } }
  }
  // ---- TOWN LANDMARKS ---- the four stalls, so the Hearth map is a map of the town
  if(G.town && typeof SHOPNPCS!=='undefined') for(const n of SHOPNPCS){
    const p=P(n.x,n.y); if(!inPanel(p)) continue;
    ctx.fillStyle=n.awn||'#e8c98a';
    ctx.fillRect(p.x-2.4,p.y-2.4,4.8,4.8);
    ctx.strokeStyle='rgba(0,0,0,0.75)'; ctx.lineWidth=1; ctx.strokeRect(p.x-2.4,p.y-2.4,4.8,4.8); }

  // BOSSES - red. Live bosses first; off-window ones get clamped to the rim, hollow, so you can
  // read their direction without mistaking them for something you can reach.
  const seen=[];
  if(typeof enemies!=='undefined') for(const e of enemies){
    if(!e.boss || e.hp<=0 || e.decoy) continue;
    if(e.ring!=null) seen.push(e.ring);
    // a boss you have not found yet stays off the map; once seen it is worth tracking off-window
    if(!fogSeen(G,e.x,e.y) && Math.hypot(e.x-player.x,e.y-player.y)>TILE*14) continue;
    const p=P(e.x,e.y);
    if(inPanel(p)){
      ctx.fillStyle='#ff4a3d';
      ctx.beginPath(); ctx.arc(p.x,p.y,4.5,0,6.29); ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.8)'; ctx.lineWidth=1.5; ctx.stroke();
    } else {
      const cx=R.x+R.w/2, cy=R.y+R.h/2;
      let dx=p.x-cx, dy=p.y-cy; const m=Math.max(Math.abs(dx),Math.abs(dy))||1;
      const k=(R.w/2-6)/m; dx*=k; dy*=k;
      ctx.strokeStyle='#ff4a3d'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(cx+dx,cy+dy,3.6,0,6.29); ctx.stroke();
    }
  }
  // a boss den you have not woken still reads as a place to go, drawn faint
  if(G.lairs) for(const k in G.lairs){ const L=G.lairs[k];
    if(seen.indexOf(+k)>=0) continue;
    const wx=(L.px+L.tw/2)*TILE, wy=(L.py+L.th/2)*TILE;
    if(!fogSeen(G,wx,wy)) continue;          // a den you have not walked past is not on your map yet
    const p=P(wx,wy);
    if(!inPanel(p)) continue;
    ctx.fillStyle='rgba(255,74,61,0.30)';
    ctx.beginPath(); ctx.arc(p.x,p.y,3,0,6.29); ctx.fill(); }

  // ---- LIVE DETAIL ----
  // The map showed terrain, bosses and you, and nothing else -- so it told you where you were and
  // not what was around you. Everything below is drawn only inside the window and only on ground
  // the fog has actually been lifted from, so the map never reports what you have not seen.

  // portals and dungeon gates: the reason you are walking somewhere
  const gate=(p,col)=>{ ctx.strokeStyle=col; ctx.lineWidth=1.8;
    ctx.beginPath(); ctx.arc(p.x,p.y,3.4,0,6.29); ctx.stroke();
    ctx.fillStyle=col; ctx.globalAlpha=0.35; ctx.fill(); ctx.globalAlpha=1; };
  if(G.portals) for(const pt of G.portals){
    const p=P((pt.x+0.5)*TILE,(pt.y+0.5)*TILE);
    if(inPanel(p) && fogSeen(G,(pt.x+0.5)*TILE,(pt.y+0.5)*TILE)) gate(p,'#8fe0ff'); }
  if(typeof groundPortals!=='undefined') for(const gp of groundPortals){
    const p=P(gp.x,gp.y); if(inPanel(p)) gate(p,'#c58aff'); }

  // loot on the ground -- a sack you walked past is worth being able to find again
  if(typeof loots!=='undefined') for(const l of loots){
    const p=P(l.x,l.y); if(!inPanel(p)||!fogSeen(G,l.x,l.y)) continue;
    ctx.fillStyle='#ffcf6a';
    ctx.fillRect(p.x-1.6,p.y-1.6,3.2,3.2);
    ctx.strokeStyle='rgba(0,0,0,0.7)'; ctx.lineWidth=1; ctx.strokeRect(p.x-1.6,p.y-1.6,3.2,3.2); }

  // ordinary foes: elites read heavier than chaff, so a crowded rim is legible rather than a smear
  if(typeof enemies!=='undefined') for(const e of enemies){
    if(e.boss || e.hp<=0 || e.decoy || e.node) continue;
    // fog-gated like everything else: a marker on ground you have never walked is a wallhack,
    // and in a dungeon that is most of the map
    const p=P(e.x,e.y); if(!inPanel(p)||!fogSeen(G,e.x,e.y)) continue;
    const elite=!!e.elite || (e.type==='s');
    ctx.fillStyle=e.elite?'#ffd07a':elite?'#ff9a5a':'rgba(230,120,110,0.85)';
    ctx.beginPath(); ctx.arc(p.x,p.y,e.elite?3.4:elite?2.6:1.8,0,6.29); ctx.fill();
    if(e.elite){ ctx.strokeStyle='rgba(0,0,0,0.75)'; ctx.lineWidth=1; ctx.stroke(); } }

  // objective nodes stand out from the foes that guard them
  if(typeof enemies!=='undefined') for(const e of enemies){
    if(!e.node || e.hp<=0) continue;
    const p=P(e.x,e.y); if(!inPanel(p)||!fogSeen(G,e.x,e.y)) continue;
    ctx.strokeStyle='#ffe08a'; ctx.lineWidth=1.6;
    ctx.beginPath(); ctx.moveTo(p.x,p.y-3.4); ctx.lineTo(p.x+3.4,p.y);
    ctx.lineTo(p.x,p.y+3.4); ctx.lineTo(p.x-3.4,p.y); ctx.closePath(); ctx.stroke(); }

  // PLAYERS - blue. Co-op peers first so the local marker draws on top of them.
  if(typeof coop!=='undefined' && coop && coop.on){
    const now=performance.now(), rk=(G.key||'?');
    for(const id in coop.peers){ const q=coop.peers[id];
      if(!q||q.rm!==rk||now-q.ts>2500) continue;
      const p=P(q.x,q.y); if(!inPanel(p)) continue;
      ctx.fillStyle='#5aa9ff';
      ctx.beginPath(); ctx.arc(p.x,p.y,3.6,0,6.29); ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.75)'; ctx.lineWidth=1.4; ctx.stroke(); } }
  const me=P(player.x,player.y);
  ctx.fillStyle='#8fd0ff';
  ctx.beginPath(); ctx.arc(me.x,me.y,4.2,0,6.29); ctx.fill();
  ctx.strokeStyle='#0b1620'; ctx.lineWidth=1.6; ctx.stroke();
  // facing nib, so the dot tells you which way you are pointing
  const aa=(player.aim||0);
  ctx.strokeStyle='#8fd0ff'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(me.x,me.y);
  ctx.lineTo(me.x+Math.cos(aa)*9, me.y+Math.sin(aa)*9); ctx.stroke();
  ctx.restore();

  // the map is north-up while the CAMERA can be rotated, so say which way north is or the two
  // disagree silently and the map starts lying to you
  {
    const us0=(typeof UIS!=='undefined')?UIS:1;
    ctx.save();
    ctx.fillStyle='rgba(10,8,14,0.6)'; ctx.fillRect(R.x+R.w-Math.round(13*us0), R.y+2, Math.round(11*us0), Math.round(11*us0));
    ctx.fillStyle='rgba(226,216,196,0.8)';
    ctx.font='bold '+Math.round(8*us0)+'px "Pixelify Sans",monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('N', R.x+R.w-Math.round(7.5*us0), R.y+Math.round(8*us0));
    ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    // and WHERE you are. Out in the realm that is the ground's LEVEL -- the number that decides
    // whether walking one screen further is a good idea. Indoors there is no such number, so the
    // dungeon shows its own level and the town shows nothing rather than a lie.
    let t=null;
    if(G.rings && typeof grvLvAt==='function'){ const lv=grvLvAt(player.x/TILE,player.y/TILE); if(lv) t='Lv '+lv; }
    else if(G.dungeon) t='Lv '+(G.lv||'?');
    else if(G.band) t='Lv '+G.band;
    if(t){ ctx.font=Math.round(9*us0)+'px "Pixelify Sans",monospace';
      const w=ctx.measureText(t).width+8;
      ctx.fillStyle='rgba(10,8,14,0.66)'; ctx.fillRect(R.x+2, R.y+2, w, Math.round(11*us0));
      ctx.fillStyle='rgba(255,208,122,0.9)'; ctx.fillText(t, R.x+6, R.y+Math.round(10.5*us0)); }
    ctx.restore();
  }

  // zoom buttons, INSIDE the frame at the bottom-right. They sit on a scrim so they stay readable
  // over bright ground, and they are drawn after the clip is released so they are never cut off.
  const B=miniBtns(), b=B.b;
  const drawBtn=(bx,img,glyph)=>{
    ctx.fillStyle='rgba(10,8,14,0.72)'; ctx.fillRect(bx-2,B.by-2,b+4,b+4);
    if(img&&img.complete&&img.naturalWidth){ ctx.imageSmoothingEnabled=false; ctx.drawImage(img,bx,B.by,b,b); }
    else { ctx.fillStyle='rgba(24,20,28,0.92)'; ctx.fillRect(bx,B.by,b,b);
      ctx.strokeStyle='rgba(196,158,90,0.75)'; ctx.lineWidth=1.5; ctx.strokeRect(bx,B.by,b,b);
      ctx.fillStyle='#e8c98a'; ctx.font='bold '+Math.round(b*0.62)+'px monospace';
      ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(glyph,bx+b/2,B.by+b/2+1);
      ctx.textAlign='left'; ctx.textBaseline='alphabetic'; } };
  drawBtn(B.in,  (typeof _miniPlus!=='undefined')?_miniPlus:null, '+');
  drawBtn(B.out, (typeof _miniMinus!=='undefined')?_miniMinus:null, '\u2212');
  // scale readout, bottom-LEFT inside the frame now that the buttons hold the right corner
  const us=(typeof UIS!=='undefined')?UIS:1;
  ctx.font=Math.round(9*us)+'px "Pixelify Sans",monospace';
  const lab=Math.round(half*2)+'t';
  ctx.fillStyle='rgba(10,8,14,0.66)';
  ctx.fillRect(R.x+2, R.y+R.h-Math.round(13*us), ctx.measureText(lab).width+8, Math.round(11*us));
  ctx.fillStyle='rgba(226,216,196,0.82)';
  ctx.fillText(lab, R.x+6, R.y+R.h-Math.round(4.5*us));
}
