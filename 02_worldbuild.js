// ============================================================
//  TILE STORAGE — one flat Uint8Array per room, not an array of arrays of chars
// ------------------------------------------------------------
//  WHY. `grid: map.map(r=>r.split(''))` builds H arrays of W single-character strings. At the current
//  1160x720 that is 835,200 element slots; the three-island world is ~8M, which is ~64MB of pointers
//  before any tile data, on a game that has to run on a phone. A Uint8Array of the same world is 8MB
//  and one allocation.
//
//  THE PACKING. 18 distinct characters exist across every built room (measured by _gridaudit.js, which
//  asks the rooms rather than grepping the data files -- a regex over those pulled in English prose and
//  claimed 45). With the raw markers the generator emits and the sweep below consumes -- c, s, P, T --
//  it is 22, so a 5-bit code covers it with room to spare and leaves 3 bits:
//
//      bits 0-4   tile code, 1..31        bits 5-7   island id, 0..7
//
//  CODE 0 IS RESERVED AND MEANS INVALID. A Uint8Array is born full of zeros, so anything that fails to
//  be written stays 0 -- and 0 decoding to a real tile would make a missed write silently look like
//  ground. `gAt` returns '\0' for it and the integrity check counts them.
//
//  THE ISLAND ID IN THE SAME BYTE is what Stage 10 needs: "which island is this tile on" is currently
//  two x-coordinate comparisons (`_onStarter`, `onMainIsland`) that cannot express a third island. One
//  array read replaces them, it is cheaper than the float compare it replaces, and it costs no extra
//  memory. Nothing sets it yet -- the generator will.
//
//  R.grid IS DELETED, DELIBERATELY. The tempting cheap version is `R.grid[y] = cells.subarray(...)`,
//  which keeps every `R.grid[ty][tx]` syntactically valid -- and returns a NUMBER, so every
//  `c === 'w'` in the codebase becomes permanently false and every `grid[y][x] = 'F'` writes 0,
//  silently, across sixty-odd sites. Deleting the property turns each missed site into a TypeError on
//  the exact line instead. That is the only mechanically safe way to do a conversion this wide.
// ============================================================
// index IS the code; 0 is the reserved INVALID slot.
// 'B' IS A SPAWN MARKER AND IT IS EASY TO MISS: the built rooms contain 18 characters and 'B' is not
// one of them, because the marker sweep below consumes it -- but four hand-authored rooms carry exactly
// one each in their RAW map, and leaving it out of this table packed all four as INVALID. The grid
// fingerprint found them (four rooms whose hash moved, one bad cell apiece) which is precisely what
// that check exists for. Anything the sweep consumes still has to be encodable on the way in.
const T_CHARS = '\0.DFHWXbcdefghklprstwPTB';
const T_CODE = {};                             // char -> code
for(let i=1;i<T_CHARS.length;i++) T_CODE[T_CHARS[i]]=i;
if(T_CHARS.length>32) throw new Error('tile alphabet outgrew 5 bits: '+T_CHARS.length);
const T_MASK=31, T_ISLE_SH=5;
// Named codes for the hot comparisons, so a renderer can test an integer instead of a string.
const T_w=T_CODE['w'], T_b=T_CODE['b'], T_X=T_CODE['X'], T_F=T_CODE['F'], T_D=T_CODE['D'],
      T_dot=T_CODE['.'], T_t=T_CODE['t'], T_k=T_CODE['k'], T_W=T_CODE['W'], T_H=T_CODE['H'],
      T_h=T_CODE['h'], T_l=T_CODE['l'], T_p=T_CODE['p'], T_P=T_CODE['P'], T_T=T_CODE['T'],
      T_c=T_CODE['c'], T_s=T_CODE['s'], T_f=T_CODE['f'], T_g=T_CODE['g'];
// SOLID AS A LOOKUP, not `'WhlHwXD'.indexOf(c)>=0`. solid() runs ~8x per entity per frame for every
// enemy, ally and pet, and an indexOf over a string was doing a scan each time.
const T_SOLID=new Uint8Array(32);
for(const c of 'WhlHwXD') T_SOLID[T_CODE[c]]=1;
const T_BLOCKSMALL=new Uint8Array(32);          // trees and boulders: a small circle, not the tile
for(const c of 'tk') T_BLOCKSMALL[T_CODE[c]]=1;

// out of range returns 0 (INVALID) rather than throwing: every caller already has an out-of-bounds
// path and a thrown error inside the tile loop would take the frame with it
function gCode(R,x,y){
  if(!R||!R.cells) return 0;
  x|=0; y|=0;
  if(x<0||y<0||x>=R.w||y>=R.h) return 0;
  return R.cells[y*R.w+x]&T_MASK;
}
function gAt(R,x,y){ return T_CHARS[gCode(R,x,y)]||'\0'; }
function gSet(R,x,y,ch){
  if(!R||!R.cells) return;
  x|=0; y|=0;
  if(x<0||y<0||x>=R.w||y>=R.h) return;
  const code=(typeof ch==='number')?(ch&T_MASK):(T_CODE[ch]|0);
  const i=y*R.w+x;
  // PRESERVE THE ISLAND BITS. A write that clobbered them would move a tile to island 0, and nothing
  // would notice until a level or a mob roster came out wrong somewhere else entirely.
  R.cells[i]=(R.cells[i]&~T_MASK)|code;
}
function isleAt(R,x,y){
  if(!R||!R.cells) return 0;
  x|=0; y|=0;
  if(x<0||y<0||x>=R.w||y>=R.h) return 0;
  return (R.cells[y*R.w+x]>>>T_ISLE_SH)&7;
}
function gSetIsle(R,x,y,id){
  if(!R||!R.cells) return;
  x|=0; y|=0;
  if(x<0||y<0||x>=R.w||y>=R.h) return;
  const i=y*R.w+x;
  R.cells[i]=(R.cells[i]&T_MASK)|((id&7)<<T_ISLE_SH);
}
// WHICH ISLAND A TILE IS ON, from the geometry the generator emitted. Islands are disjoint discs
// (island A is the baked slice west of ISLE_A_W), so this is a containment test and nothing more.
//
// WHY THIS IS COMPUTED HERE AND NOT SHIPPED. The alternative is a second parallel map of island ids,
// which is another 6.3 MB to download and one more thing that can disagree with the tiles. The
// answer is derivable from four numbers per island, and it is derived once, in the same pass that
// was already touching every tile.
//
// NEAREST CENTRE, NOT FIRST DISC THAT CONTAINS IT.
//
// The first version tested each island's disc at a generous 1.45x radius and took the first hit,
// with a comment claiming the discs were too far apart to overlap. They are not: the centres are
// 1654 tiles apart and 1.45r + 1.45r is 2224, so B's generous disc reached 175 tiles INTO island C
// -- and because B is listed first, C's whole western strip, including the province where flight
// sets you down, was labelled island 1. _zoneAtRaw would then have searched island B's seeds for a
// tile on island C: wrong province, wrong level band, wrong loot table, on the one island the
// player can only reach by flying there. The selftest found it as "The Skyreach Shelf is not on
// island C".
//
// Nearest centre cannot be ambiguous. The generous radius is kept as an OUTER BOUND only -- the
// coastline noise pushes land past the nominal radius, so a tile just off the coast must still
// answer with its own island rather than falling through to 0.
function _isleIdFor(rings,x,y){
  if(!rings||!rings.isles) return 0;
  if(x<(typeof ISLE_A_W!=='undefined'?ISLE_A_W:352)) return 0;
  let best=0, bd=1e18;
  for(const I of rings.isles){
    if(I.baked||I.cx==null) continue;
    const dx=x-I.cx, dy=y-I.cy, d=dx*dx+dy*dy, rr=I.r*1.45;
    if(d<=rr*rr && d<bd){ bd=d; best=I.id|0; }
  }
  return best;
}
// Pack an array of row STRINGS (or of char arrays) into a room's cells.
function gPack(R,map,rings){
  const h=map.length, w=(map[0]&&map[0].length)|0;
  R.w=w; R.h=h;
  const cells=new Uint8Array(w*h);
  const isles=(rings&&rings.isles)?rings:null;
  for(let y=0;y<h;y++){
    const row=map[y]; const o=y*w;
    for(let x=0;x<w;x++){
      const c=(typeof row==='string')?row[x]:row[x];
      const code=T_CODE[c];
      // An unknown character is the one thing worth being loud about: it means the alphabet above is
      // out of date, and leaving it as 0 would render as INVALID everywhere with no explanation.
      if(code===undefined){ if(typeof console!=='undefined') console.warn('gPack: unknown tile char '+JSON.stringify(c)+' at '+x+','+y); continue; }
      // the island id rides in bits 5-6 of the same byte, written in the same pass
      cells[o+x]=isles ? (code|((_isleIdFor(isles,x,y)&7)<<T_ISLE_SH)) : code;
    }
  }
  R.cells=cells;
  return R;
}

// ---------- world build ----------
const rooms={};
for(const key in ROOM_DEFS){
  const [rx,ry]=key.split(',').map(Number);
  rooms[key]={key,rx,ry,name:ROOM_DEFS[key].name, cleared:false, spawns:[]};
  gPack(rooms[key], ROOM_DEFS[key].map, ROOM_DEFS[key].rings);
}
const RW=40, RH=22;
const _std=rm=>rm&&rm.w===RW&&rm.h===RH;       // only standard rooms auto-door
// carve doors between adjacent rooms
for(const key in rooms){
  const r=rooms[key];
  // door-carving only between standard-sized adjacent rooms (hub/arena are portal-linked)
  if(_std(r)){
    const east=rooms[(r.rx+1)+','+r.ry];
    if(_std(east)){ const my=Math.floor(RH/2);
      for(const dy of [-1,0,1]){ gSet(r,RW-1,my+dy,'.'); gSet(east,0,my+dy,'.'); } }
    const south=rooms[r.rx+','+(r.ry+1)];
    if(_std(south)){ const mx=Math.floor(RW/2);
      for(const dx of [-1,0,1]){ gSet(r,mx+dx,RH-1,'.'); gSet(south,mx+dx,0,'.'); } }
    const north=rooms[r.rx+','+(r.ry-1)];
    if(_std(north)){ const mx=Math.floor(RW/2);
      for(const dx of [-1,0,1]){ gSet(r,mx+dx,0,'.'); gSet(north,mx+dx,RH-1,'.'); } }
  }
  // collect spawns, glow sources, portals, strip markers
  r.town=!!ROOM_DEFS[key].town; r.glows=[];
  r.lv=ROOM_DEFS[key].lv||1; r.band=ROOM_DEFS[key].band||'';
  // r.w / r.h were set by gPack from the map itself; re-deriving them from a grid that no longer
  // exists was the first thing to break.
  r.big=!!ROOM_DEFS[key].big; r.regions=ROOM_DEFS[key].regions||null; r.portals=[];
  r.rings=ROOM_DEFS[key].rings||null; r.arrivals=ROOM_DEFS[key].arrivals||null;
  // the generator writes 8 ring names (bands 0-7); band 8 is the grind RIM, named out of the
  // separate rings.grind list. Anything indexing names[band] with 8 (openFastTravel on the
  // b:8 pillar, genDungeon(8)) hit undefined and threw — so normalize to 9 entries here, once.
  if(r.rings&&r.rings.radial&&r.rings.names&&r.rings.names.length===8&&r.rings.grind)
    r.rings.names.push({n:r.rings.grind[0],lv:LV_CAP,lv2:LV_CAP});
  r.pillars=(ROOM_DEFS[key].pillars||[]).map(p=>({x:(p.tx+.5)*TILE,y:(p.ty+.5)*TILE,band:p.b,name:p.name}));
  r.hub=!!ROOM_DEFS[key].hub; r.arena=!!ROOM_DEFS[key].arena; r.safe=!!ROOM_DEFS[key].safe;
  r.decor=ROOM_DEFS[key].decor||null; r.stalls=ROOM_DEFS[key].stalls||null;
  r.critters=ROOM_DEFS[key].critters||null;   // the Hearth flock (03b_critters.js)
  // the Wardrobe's mirror, in pixels — a room-level interactable, like a stall without a vendor
  const _wd=ROOM_DEFS[key].wardrobe;
  r.wardrobe=_wd?{x:_wd.x*TILE, y:_wd.y*TILE}:null;
  // the Vault's strongbox (17j_vault.js) -- same shape as the mirror above, tile-indexed
  const _sb=ROOM_DEFS[key].strongbox;
  r.strongbox=_sb?{x:(_sb.tx+.5)*TILE, y:(_sb.ty+.5)*TILE}:null;
  // the Stable's paddock gate (17k_mounts.js) -- same shape and the same x*TILE form as the
  // mirror, so the room def carries TILE coordinates and never pixels
  const _st=ROOM_DEFS[key].stable;
  r.stable=_st?{x:_st.x*TILE, y:_st.y*TILE}:null;
  // explicit destination portals (hub + sub-rooms)
  const pd=ROOM_DEFS[key].portalDefs;
  if(pd) for(const p of pd){
    const fl=r.town?'f':'.';
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){ const tx=p.tx+dx,ty=p.ty+dy;
      if(tx>0&&ty>0&&tx<r.w-1&&ty<r.h-1&&'Whl Hp'.indexOf(gAt(r,tx,ty))<0) gSet(r,tx,ty,fl); }
    r.portals.push({x:(p.tx+.5)*TILE,y:(p.ty+.5)*TILE,to:p.to,label:p.label,col:p.col,big:!!p.big}); }
  for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++){
    const c=gAt(r,x,y);
    if(c==='c'||c==='s'||c==='B'){ r.spawns.push({t:c,x,y}); gSet(r,x,y,'.'); }
    if(c==='P'){ r.px=x; r.py=y; gSet(r,x,y,r.town?'f':'.'); }
    if(c==='T'){ r.portals.push({x:(x+.5)*TILE,y:(y+.5)*TILE,to:'0,0',label:'HEARTH',col:'#c07ad4'}); gSet(r,x,y,r.big?'d':'.'); }
    // Firelight REACHES far and burns LOW (user, 2026-07-26). These radii are the outer pool in
    // 09_sprites; the alphas that go with them were dropped to match, so a brazier now lights a
    // whole corner of the plaza softly instead of scorching a bright disc around its own feet.
    if(c==='l') r.glows.push({t:'l',x:(x+.5)*TILE,y:(y+.5)*TILE,r:230});
    if(c==='H') r.glows.push({t:'H',x:(x+.5)*TILE,y:(y+.5)*TILE,r:420});
  }
  // guarantee open ground around portals
  if(r.big) for(const p of r.portals){
    const ptx=Math.floor(p.x/TILE), pty=Math.floor(p.y/TILE);
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
      const tx2=ptx+dx, ty2=pty+dy;
      if(tx2>0&&ty2>0&&tx2<r.w-1&&ty2<r.h-1&&gCode(r,tx2,ty2)!==T_w) gSet(r,tx2,ty2,'d'); }
    r.spawns=r.spawns.filter(function(sp2){ return Math.hypot(sp2.x-ptx,sp2.y-pty)>4; });
  }
}
