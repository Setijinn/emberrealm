// ---------- render ----------
let camX=0,camY=0;
// screen shake — impulse magnitude that decays each frame; camX/camY are jittered by it in
// render() so w2s and every draw follow. addShake(mag) is called by big beats (boss phases).
let _shake=0;
function addShake(m){ _shake=Math.max(_shake, m||0); }
// ---- camera rotation (PC only): hold Z/C to rotate the view, X to reset ----
// camRotT = target angle (driven by keys in update), camRot = smoothed display angle.
let camRot=0, camRotT=0;
// screen <-> world through the full camera transform (zoom + rotation about view centre)
function s2w(sx,sy){ const zoom=H/(viewTilesH()*TILE);
  let x=sx/zoom, y=sy/zoom;
  if(camRot){ const cx=W/zoom/2, cy=H/zoom/2, c=Math.cos(-camRot), s=Math.sin(-camRot),
    dx=x-cx, dy=y-cy; x=cx+dx*c-dy*s; y=cy+dx*s+dy*c; }
  return {x:camX+x, y:camY+y}; }
function w2s(wx,wy){ const zoom=H/(viewTilesH()*TILE);
  let x=wx-camX, y=wy-camY;
  if(camRot){ const cx=W/zoom/2, cy=H/zoom/2, c=Math.cos(camRot), s=Math.sin(camRot),
    dx=x-cx, dy=y-cy; x=cx+dx*c-dy*s; y=cy+dx*s+dy*c; }
  return {x:x*zoom, y:y*zoom}; }
const VIEW_TILES_H=10;
// PC shows a wider slice of the world (mouse+keyboard play felt too zoomed in)
// OPTS.zoom (settings "camera distance") multiplies the visible tile count: >1 = farther out
function viewTilesH(){ const z=(typeof OPTS!=='undefined'&&OPTS.zoom)?OPTS.zoom:1;
  return ((typeof inputMode!=='undefined' && inputMode==='pc') ? 13.5 : VIEW_TILES_H)*z; }
const roomCV=document.createElement('canvas');
function h2(x,y){const v=Math.sin(x*127.1+y*311.7)*43758.5453;return v-Math.floor(v);}
function buildRoomCache(){} // rooms render live now
// 9 vertical zones, bottom (band 0, green vale) -> top (band 8, molten crown)
const GBANDCOL=[
 ['#4a6b3e','#547a44'], // 0 Roothollow Vale
 ['#33502f','#3c5b35'], // 1 Mistwood
 ['#4a5a30','#556636'], // 2 Bramblemarch
 ['#5a6350','#66705a'], // 3 Greystone Foothills
 ['#6a706a','#767c74'], // 4 Wind Crags
 ['#75574a','#836254'], // 5 Emberscar Ridge
 ['#5e5854','#6a635e'], // 6 Ashfall Reach
 ['#7a4030','#8a4a22'], // 7 Cinderspire
 ['#9a3a1c','#b5451e'], // 8 Molten Crown
 ['#6f6a5c','#7d7768'], // 9 The Cairnworks (starter island, out of the green->red order)
];
// Radial band from tile-x/y — the new two-island world (grvBandAt lives in 03_entities).
function grvBandXY(x,y){ return (typeof grvBandAt==='function')?grvBandAt(x,y):0; }
// Well-avalanched per-cell hash. The old `(x*131+y*57)` has its low bit == (x+y)&1, so
// anything keyed off its low bits (the tile FLIP `&3`, tile choice `%100`) alternated on a
// checkerboard — with directionally-lit ground art that read as a bright/dark grid across the
// whole map. This mixes the bits so orientation and tile choice are decorrelated from
// position parity (same lesson as the town-floor hash).
function hmix(x,y){ let h=(Math.imul(x,374761393)+Math.imul(y,668265263))>>>0;
  h=Math.imul(h^(h>>>13),1274126177)>>>0; return (h^(h>>>16))>>>0; }
function _hexA(h,a){ if(!h||h[0]!=='#'){return 'rgba(154,212,239,'+a+')';}
  const n=parseInt(h.slice(1),16); return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')'; }
// No solid vector lines anywhere (user rule) — a "line" is drawn as a scatter of 1px pixels.
// dens = fraction of pixels kept (hash-jittered so it reads hand-placed, not a crisp stroke).
function pxV(px,py,len,col,dens){ ctx.fillStyle=col; const d=(dens===undefined?0.6:dens)*256;
  px|=0; py|=0; for(let i=0;i<len;i++) if((hmix(px,py+i)&255)<d) ctx.fillRect(px,py+i,1,1); }
function pxH(px,py,len,col,dens){ ctx.fillStyle=col; const d=(dens===undefined?0.6:dens)*256;
  px|=0; py|=0; for(let i=0;i<len;i++) if((hmix(px+i,py)&255)<d) ctx.fillRect(px+i,py,1,1); }
// Smooth value noise in ~[0,1], feature size `scale` tiles. Smoothstep-interpolated hash
// lattice -> ORGANIC blobs with curved edges, not the hard 4x4 squares a block hash makes.
// Used to place secondary-terrain patches so they look like natural pools, not tiles.
function vnoise(x,y,scale){
  const fx=x/scale, fy=y/scale, x0=Math.floor(fx), y0=Math.floor(fy), ux=fx-x0, uy=fy-y0;
  const r=(a,b)=>(hmix(a,b)&1023)/1023, s=t=>t*t*(3-2*t);
  const a=r(x0,y0), b=r(x0+1,y0), c=r(x0,y0+1), d=r(x0+1,y0+1), sx=s(ux), sy=s(uy);
  return (a*(1-sx)+b*sx)*(1-sy)+(c*(1-sx)+d*sx)*sy;
}
// ---- SEAMLESS PER-TILE SHADE ----
// Every floor renderer in this file had its own copy of the same idea: hash the cell, bucket it,
// and paint a flat wash across the whole tile. That is what drew the grid. Two things were wrong
// with it and both had to go: the value was QUANTISED, so a seam was never a small step, and it
// was HASHED, so neighbours were uncorrelated and every edge jumped the full amplitude.
//
// This is the replacement, used by all of them. The value is continuous noise sampled at the tile
// CORNERS -- which neighbouring tiles share by construction -- and the tile is filled as four
// bilinear quadrants, so the ramp runs straight through the seam instead of stepping at it. Same
// large-scale mottling, no visible tiles. `amp` is the peak alpha; the light side is damped
// because a light wash reads far more strongly than a dark one at the same alpha.
function tileShade(tx,ty,x,y,amp,seed){
  const sd=seed||0;
  const n=(gx,gy)=>vnoise(gx*4+sd,gy*4+sd,26)-0.5;      // -0.5..0.5, smooth over ~6 tiles
  const n00=n(x,y), n10=n(x+1,y), n01=n(x,y+1), n11=n(x+1,y+1);
  const h=TILE/2;
  for(let qy=0;qy<2;qy++) for(let qx=0;qx<2;qx++){
    const u=(qx+0.5)/2, w=(qy+0.5)/2;
    const v=(n00*(1-u)+n10*u)*(1-w)+(n01*(1-u)+n11*u)*w;
    ctx.fillStyle=(v<0) ? 'rgba(0,0,0,'+(-v*amp*2).toFixed(3)+')'
                        : 'rgba(255,242,212,'+(v*amp*1.1).toFixed(3)+')';
    ctx.fillRect(tx+qx*h, ty+qy*h, h+1, h+1);
  }
}
// ---- 16-VARIANT ATLAS SAMPLER ----
// A 128x128 sheet holding sixteen 32x32 tiles of the SAME material (create_tiles_pro). Draws the
// variant chosen by position hash, so no surface is ever one cell repeated. Returns false when the
// atlas for that theme hasn't shipped yet, and the caller keeps its old single-cell path.
// `nv` caps how many of the 16 variants are used. A boss BORROWING another theme's sheet draws
// from a smaller subset, so its room reads as a plainer version of that place rather than as the
// theme's native arena — the Tidewrack's salt-house should not look as elaborate as the warren
// the tiles were made for.
// How beaten-up the ground at this tile should look, 0 clean .. 1 wrecked.
// The atlas is authored pristine->damaged, so this picks the cell. Wear follows traffic rather
// than noise: the middle of an arena, where the whole fight happens, is ground to rubble, and the
// untrodden rim stays clean. The noise term only ragged-edges the transition so it isn't a ring.
function tileWear(x,y){
  let w=0;
  const L=curRoom.lairAt&&curRoom.lairs?curRoom.lairs[curRoom.lairAt[y*curRoom.w+x]]:null;
  // px/py are the arena's top-left in TILES. (Its cx/cy fields are the centre in PIXELS -- do not
  // mix them in here; that unit mismatch silently puts the worn patch outside the arena.)
  if(L){ const dx=(x-(L.px+L.tw/2))/(L.tw/2), dy=(y-(L.py+L.th/2))/(L.th/2);
         w=1-Math.min(1,Math.hypot(dx,dy)); }
  else if(!curRoom.rings) w=0.35;                    // dungeon corridors: walked, not fought in
  return Math.max(0,Math.min(1,w+(vnoise(x+91,y+37,7)-0.5)*0.45));
}
// Each 32x32 cell cut out into its own canvas, cached per atlas. Drawing a sub-rect straight out
// of the 128x128 sheet lets the sampler reach a fraction of a texel past the cell edge and pull in
// the neighbouring cell, which paints a faint dotted seam around every tile. An isolated cell has
// no neighbour to bleed from.
// Cells are cached at the exact size they will occupy on screen (TILE_DEV_PX, set by render()).
// Two reasons. Cutting the cell out of the sheet stops the sampler reaching past its edge into the
// neighbouring cell. Pre-scaling it to the final device size means the 32px art is resampled ONCE,
// identically for every tile, instead of every tile independently resolving a 2.219x ratio -- that
// per-tile difference is what darkened the tile borders and drew the grid.
const _atlCells=new WeakMap();
let TILE_DEV_PX=0;
function atlasCell(atlas,i){
  const px=TILE_DEV_PX||32;
  let e=_atlCells.get(atlas);
  if(!e || e.px!==px){ e={px:px, cells:[]}; _atlCells.set(atlas,e); }
  let c=e.cells[i];
  if(!c){
    c=document.createElement('canvas'); c.width=px; c.height=px;
    const g2=c.getContext('2d'); g2.imageSmoothingEnabled=false;
    g2.drawImage(atlas,(i&3)*32,(i>>2)*32,32,32,0,0,px,px);
    e.cells[i]=c;
  }
  return c;
}
function drawAtlas(atlas,x,y,tx,ty,hh,nv){
  if(!atlas || !atlas.complete || !atlas.naturalWidth) return false;
  const n=nv||16, w=tileWear(x,y);
  // squared, so most ground sits near-pristine and heavy damage stays a local event
  const lo=Math.floor(w*w*(n-1)), i=lo+(((hh>>>7)&15)%Math.max(1,Math.min(3,n-lo)));
  const cell=atlasCell(atlas,i);
  ctx.imageSmoothingEnabled=false;
  // quarter-turns as well as mirrors: a mirror keeps the texture's own axes, so it still reads
  // as the same tile. With 16 variants x 8 orientations a repeat is essentially unfindable.
  ctx.save(); ctx.translate(tx+TILE/2,ty+TILE/2);
  // exact quarter turns, so the rotation is rigid and introduces no resampling of its own
  ctx.rotate(((hh>>4)&3)*(Math.PI/2)); ctx.scale((hh&1)?-1:1,(hh&2)?-1:1);
  ctx.drawImage(cell,0,0,cell.width,cell.height,-TILE/2,-TILE/2,TILE,TILE); ctx.restore();
  return true;
}
// A patch of ground beneath a standing feature, so it has something to grow out of. Without it a
// pine sits directly on shore shingle or bare stone and reads as pasted on. Trees get dark soil
// with a little leaf litter and a couple of grass blades; boulders get dry scree and no growth.
// Irregular and deterministic per tile, so it never reads as a drawn circle.
function propFooting(tx,ty,x,y,kind){
  const h=hmix(x*13+7,y*11+3);
  const cx=tx+TILE/2, cy=ty+TILE-9, rx=TILE*(kind==='t'?0.40:0.32), ry=rx*0.52;
  ctx.save();
  ctx.beginPath();
  for(let i=0;i<10;i++){                        // lumpy ellipse, not a clean disc
    const a=i/10*6.283, w=0.80+((h>>(i*3))&7)/18;
    const px=cx+Math.cos(a)*rx*w, py=cy+Math.sin(a)*ry*w;
    if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
  }
  ctx.closePath();
  ctx.fillStyle=(kind==='t')?'rgba(46,34,22,0.62)':'rgba(58,55,52,0.50)';
  ctx.fill();
  if(kind==='t'){
    ctx.fillStyle='rgba(62,48,28,0.55)';        // scuffed litter round the base
    for(let i=0;i<3;i++){ const a=((h>>(i*5))&15)/15*6.283;
      ctx.fillRect((cx+Math.cos(a)*rx*0.75)|0,(cy+Math.sin(a)*ry*0.75)|0,2,1); }
    ctx.fillStyle='rgba(88,120,58,0.55)';       // a couple of blades pushing up
    for(let i=0;i<2;i++){ const ox=((h>>(i*7+2))%Math.round(rx))-rx/2;
      ctx.fillRect((cx+ox)|0,(cy-2)|0,1,3); }
  } else {
    ctx.fillStyle='rgba(30,28,26,0.40)';        // chips shed off the rock
    for(let i=0;i<4;i++){ const a=((h>>(i*4))&15)/15*6.283;
      ctx.fillRect((cx+Math.cos(a)*rx*0.85)|0,(cy+Math.sin(a)*ry*0.85)|0,2,1); }
  }
  ctx.restore();
}
// Per-band accent used by the ground detail pass: [patch colour, speck colour].
// The patch is a second material drifting through the main one (dirt through grass, wet sand
// through dry, ash through scorched rock); the speck is the fine litter that sells the surface.
const TERR_ACCENT={
  0:['rgba(150,126,84,',   'rgba(96,80,52,'],     // Landing Sands   - darker damp sand
  1:['rgba(120,124,120,',  'rgba(70,74,74,'],     // Gullwind Shore  - shingle
  2:['rgba(120,124,58,',   'rgba(74,80,40,'],     // Sawgrass Flats  - dry grass
  3:['rgba(74,110,50,',    'rgba(46,72,34,'],     // Verdant Belt    - lush clumps
  4:['rgba(56,84,44,',     'rgba(38,58,30,'],     // Wolfwood
  5:['rgba(44,64,40,',     'rgba(28,44,26,'],     // Deep Timber     - deep shade
  6:['rgba(116,112,104,',  'rgba(72,70,66,'],     // Stonebrow Rise  - scree
  7:['rgba(96,84,78,',     'rgba(58,50,46,'],     // Cinderwatch     - ash drift
  8:['rgba(112,52,26,',    'rgba(60,26,14,'],     // The Ashfall     - ember crust
  9:['rgba(128,122,108,',  'rgba(80,76,68,']      // The Cairnworks  - chipped stone + quarry grit
};
// Open ground was one flat grain: the atlases are deliberately uniform so tiles never repeat, but
// uniform is also featureless. This adds the missing scales back WITHOUT reintroducing a pattern,
// because every value here comes from world-position noise and so flows across tile borders:
//   - broad drifts of light and shade, tens of tiles across, that give the ground shape
//   - a second material bleeding through in soft patches
//   - litter whose DENSITY is itself noise, so it clumps like real ground instead of sprinkling
//     evenly the way a per-tile random would
function terrainDetail(x,y,tx,ty,bd){
  const A=TERR_ACCENT[bd]||TERR_ACCENT[3];
  // 1. broad relief. TWO octaves at unrelated scales and offsets: a single vnoise is bilinear on
  // its own lattice, so on open ground its cells read as faint axis-aligned rectangles. Summing a
  // second, finer octave breaks that alignment and the result reads as organic ground.
  const n1=vnoise(x+11,y+7,17.0)*0.62 + vnoise(x+143,y+61,7.3)*0.38;
  if(n1>0.56){ ctx.fillStyle='rgba(255,246,220,'+((n1-0.56)*0.38).toFixed(3)+')'; ctx.fillRect(tx,ty,TILE,TILE); }
  else if(n1<0.44){ ctx.fillStyle='rgba(0,0,0,'+((0.44-n1)*0.46).toFixed(3)+')'; ctx.fillRect(tx,ty,TILE,TILE); }
  // 2. second material in soft-edged patches, likewise two octaves so the blobs are not lattice-shaped
  const n2=vnoise(x+91,y+53,6.6)*0.65 + vnoise(x+29,y+181,2.9)*0.35;
  if(n2>0.58){ ctx.fillStyle=A[0]+((n2-0.58)*1.65).toFixed(3)+')'; ctx.fillRect(tx,ty,TILE,TILE); }
  // 3. clustered litter: noise sets how much falls here, the tile hash sets where
  const dn=vnoise(x+31,y+77,3.6);
  if(dn>0.50){
    const hh=hmix(x*7+5,y*11+3), n=1+((dn-0.50)*7)|0;
    ctx.fillStyle=A[1]+'0.55)';
    for(let i=0;i<n&&i<4;i++){
      const ox=((hh>>(i*6))%(TILE-6))+3, oy=((hh>>(i*6+3))%(TILE-6))+3;
      const w=1+((hh>>(i*4))&1);
      ctx.fillRect(tx+ox,ty+oy,w,1);
    }
  }
  // 4. faint worn tracks: ridged noise reads as trodden ground rather than blobs
  const r=Math.abs(vnoise(x+7,y+131,9.0)-0.5);
  if(r<0.045){ ctx.fillStyle='rgba(0,0,0,'+((0.045-r)*1.7).toFixed(3)+')'; ctx.fillRect(tx,ty,TILE,TILE); }
}
function drawTileG(x,y){
  const c=curRoom.grid[y][x], tx=x*TILE, ty=y*TILE, t=curRoom.town;
  ctx.fillStyle=(x+y)%2?(t?'#2b1f18':'#17141d'):(t?'#281d16':'#1a1721');
  ctx.fillRect(tx,ty,TILE,TILE);
  // The Sanctuary (pet room): meadow floor + hedge border (PixelLab art, procedural fallback)
  if(curRoom.petRoom){
    if(c==='W'){                                             // hedge border (tiled art, procedural fallback)
      const hd=(typeof _roomHedgeImg!=='undefined')?_roomHedgeImg:null;
      if(hd&&hd.complete&&hd.naturalWidth){ ctx.imageSmoothingEnabled=false; const o=hmix(x,y)&3;
        ctx.save(); ctx.translate(tx+TILE/2,ty+TILE/2); ctx.scale(o&1?-1:1,o&2?-1:1); ctx.drawImage(hd,-TILE/2,-TILE/2,TILE,TILE); ctx.restore(); }
      else { ctx.fillStyle='#2c4a2a'; ctx.fillRect(tx,ty,TILE,TILE); }
      return; }
    if(c==='w'){                                             // freshwater lake / pond / waterfall pool
      // bright pond tile (mix of recoloured seamless variants), procedural fallback
      let wimg=null; if(typeof _pondVar!=='undefined'&&_pondVar){ const pv=_pondVar[hmix(x,y)%_pondVar.length]; if(pv&&pv.complete&&pv.naturalWidth) wimg=pv; }
      if(wimg){ ctx.imageSmoothingEnabled=false; ctx.drawImage(wimg,tx,ty,TILE,TILE); }
      else { ctx.fillStyle=(x+y)&1?'#2f9fb2':'#3ab0c4'; ctx.fillRect(tx,ty,TILE,TILE); }
      const G=curRoom.grid, wat=(xx,yy)=>{const r=G[yy];return r&&r[xx]==='w';};
      // DEPTH: darker toward the pond centre so it reads as deep water
      const wf=curRoom.waterfall;
      if(wf){ const dd=Math.hypot((x-wf.pcx)/Math.max(1,wf.prx),(y-wf.pcy)/Math.max(1,wf.pry)), deep=Math.max(0,Math.min(1,1-dd));
        ctx.fillStyle='rgba(6,44,72,'+(deep*0.42).toFixed(3)+')'; ctx.fillRect(tx,ty,TILE,TILE); }
      // shore: white foam + a thin grassy lip where the pool meets the lawn
      if(!wat(x,y-1)||!wat(x,y+1)||!wat(x-1,y)||!wat(x+1,y)){
        const foam='rgba(232,248,250,0.6)';
        if(!wat(x,y-1)){ pxH(tx,ty+1,TILE,foam,0.6); ctx.fillStyle='rgba(34,70,38,0.4)'; ctx.fillRect(tx,ty,TILE,2); }
        if(!wat(x,y+1)){ pxH(tx,ty+TILE-2,TILE,foam,0.6); ctx.fillStyle='rgba(34,70,38,0.4)'; ctx.fillRect(tx,ty+TILE-2,TILE,2); }
        if(!wat(x-1,y)){ pxV(tx+1,ty,TILE,foam,0.6); ctx.fillStyle='rgba(34,70,38,0.4)'; ctx.fillRect(tx,ty,2,TILE); }
        if(!wat(x+1,y)){ pxV(tx+TILE-2,ty,TILE,foam,0.6); ctx.fillStyle='rgba(34,70,38,0.4)'; ctx.fillRect(tx+TILE-2,ty,2,TILE); } }
      // drifting ripples + sun-glint sparkles
      const wn=Math.sin(performance.now()/700+x*0.9+y*1.7); if(wn>0.62){ ctx.fillStyle='rgba(235,250,252,0.14)'; ctx.fillRect(tx+6,ty+TILE/2-1,TILE-12,2); }
      const gh=hmix(x*3+((performance.now()/500)|0), y*5); if((gh&255)<16){ ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.fillRect(tx+(gh%TILE),ty+((gh>>5)%TILE),1,1); }
      return; }
    // THE MEADOW FLOOR (user: "give the grass texture in the pet sanctuary").
    // It was value-noise green with three 1px blades per cell -- correct, cheap, and from two
    // tiles away completely flat. It now stamps real painted turf.
    //
    // The base colour is still drawn FIRST and unconditionally. 15_pets.js has always asked for
    // assets/pets/room_floor*.png and the files never existed, so _img() was 404ing and this
    // branch silently ran its fallback forever; drawing the procedural green underneath means a
    // missing or still-decoding texture is a green lawn rather than a hole.
    //
    // Anti-repetition, because one stamp repeated across 900 cells is a grid:
    //   * TWO turf variants, the second (clover, drier) on about a third of cells
    //   * eight orientations -- four quarter turns times a mirror. Quarter turns matter more than
    //     mirrors here: a mirror preserves the texture's own axes, so it still reads as the same
    //     tile, and grass has a visible grain direction.
    //   * tileShade over the top, which is continuous corner-sampled noise rather than a per-tile
    //     value, so its variation does not line up with the tile edges it is hiding.
    // The base tone is matched to the TURF's measured mean (78,128,37) rather than picked by eye,
    // so a cell whose texture has not decoded yet is the same green as its neighbours instead of a
    // dark hole that pops when the image lands.
    const nz=vnoise(x,y,5.5)*0.6+vnoise(x+40,y+80,2.3)*0.4, gv=128+Math.round((nz-0.5)*44);
    ctx.fillStyle='rgb('+Math.round(gv*0.61)+','+gv+','+Math.round(gv*0.29)+')'; ctx.fillRect(tx,ty,TILE,TILE);
    const bh=hmix(x*3+1,y*7+2);
    const _ok=im=>im&&im.complete&&im.naturalWidth;
    const _g2=(typeof _roomFloor2Img!=='undefined')?_roomFloor2Img:null;
    const _g1=(typeof _roomFloorImg!=='undefined')?_roomFloorImg:null;
    const turf=(((bh>>>11)%100)<34 && _ok(_g2)) ? _g2 : (_ok(_g1)?_g1:(_ok(_g2)?_g2:null));
    if(turf){
      ctx.imageSmoothingEnabled=false;
      ctx.save(); ctx.translate(tx+TILE/2,ty+TILE/2);
      ctx.rotate((((bh>>>5)&3))*1.5707963267948966);
      if(bh&1) ctx.scale(-1,1);
      ctx.drawImage(turf,-TILE/2-1,-TILE/2-1,TILE+2,TILE+2);   // 1px bleed: no hairline at the seam
      ctx.restore();
      tileShade(tx,ty,x,y,0.13,67);
    } else {
      ctx.fillStyle='rgba(26,62,26,0.5)';                    // fallback: the old hand-drawn blades
      for(let i=0;i<3;i++){ if(((bh>>(i*4))&7)<4) ctx.fillRect(tx+2+((bh>>(i*3))%(TILE-4)), ty+2+((bh>>(i*3+2))%(TILE-4)), 1, 2); }
      if(((bh>>9)&7)<2){ ctx.fillStyle='rgba(255,255,235,0.07)'; ctx.fillRect(tx+((bh>>2)%TILE), ty+((bh>>5)%TILE),1,1); }
    }
    // daisies stay on top of either path -- they are the thing that reads as "meadow" rather than
    // "lawn", and they are sparser now that the turf carries its own small flowers
    if(vnoise(x+11,y+5,3.2)>0.90){ const dh=hmix(x+50,y+90), dx2=tx+7+(dh%18), dy2=ty+7+((dh>>5)%18);
      ctx.fillStyle=(dh&1)?'rgba(246,246,228,0.9)':'rgba(232,212,84,0.85)'; ctx.fillRect(dx2,dy2,2,2);
      ctx.fillStyle='rgba(70,140,60,0.7)'; ctx.fillRect(dx2,dy2+2,2,1); }
    return; }
  // Awakened dungeon: the boss's consciousness — themed wall/floor sampled from
  // dunset_<ring> (falls back to that boss's lair tileset, then procedural).
  // 'D' = locked dream-gate: wall block + pulsing boss-colored seal.
  if(curRoom.dungeon){
    // the dream wears the BOSS's art slot, not its current territory's band — ring is a boss id.
    // TILE art borrows separately from sprite art (a boss gets its face before its tileset).
    const rg=curRoom.ring||0, ra=(typeof bossTileArt==='function')?bossTileArt(rg):rg;
    const set=(typeof _dunSet!=='undefined'&&_dunSet[ra]&&_dunSet[ra].complete&&_dunSet[ra].naturalWidth)?_dunSet[ra]
             :(typeof _lairSet!=='undefined'&&_lairSet[ra]&&_lairSet[ra].complete&&_lairSet[ra].naturalWidth)?_lairSet[ra]:null;
    // A dungeon is that boss's dream of home, so it draws the boss's own 16-variant
    // arena atlases. Without this the dream fell back to a single repeated cell from
    // the lair sheet -- the one-sprite-everywhere problem the arenas already fixed.
    const _datl=(c==='W'||c==='D')
        ? (typeof _wallSet!=='undefined'?_wallSet[lairTileSet?lairTileSet(rg):ra]:null)
        : (typeof _floorSet!=='undefined'?_floorSet[lairTileSet?lairTileSet(rg):ra]:null);
    if(set || _datl){
      ctx.imageSmoothingEnabled=false; const hh=hmix(x,y), o=hh&3;   // mixed hash: no parity checkerboard
      const src=(c==='W'||c==='D')?GROUND_UP:GROUND_LO;
      // atlas first; only the base tile is replaced, everything below still runs
      if(!drawAtlas(_datl,x,y,tx,ty,hh,16)){
        ctx.save(); ctx.translate(tx+TILE/2,ty+TILE/2); ctx.scale(o&1?-1:1,o&2?-1:1);
        ctx.drawImage(set,src[0],src[1],32,32,-TILE/2,-TILE/2,TILE,TILE); ctx.restore();
      }
      // 'p' = dream-path spine. NOT an obvious road (the old stepping stones read as river
      // stones) — a faint 1x1 SPRINKLE of motes over the dream floor: a mysterious trail you
      // have to look for, never a highlighted path. A couple of tiny dim points per cell,
      // each with its own slow twinkle so the sprinkle shimmers rather than marches.
      if(c==='p'){
        const GB=(typeof GBOSS!=='undefined')?GBOSS[rg]:null, cr=GB?GB.col:'#9ad4ef';
        const hp=hmix(x*7+3,y*5+11), nd=1+(hp&1);        // 1-2 motes
        ctx.save();
        for(let i=0;i<nd;i++){
          const px=tx+3+((hp>>(i*7))%(TILE-6)), py=ty+3+((hp>>(i*7+3))%(TILE-6));
          const tw=0.06+0.16*(0.5+0.5*Math.sin(performance.now()/760+(x*3+y*7)+i*2.1));
          ctx.fillStyle=_hexA(cr,tw.toFixed(3)); ctx.fillRect(px,py,1,1);
        }
        ctx.restore();
        return; }
      // anti-repetition: fine per-cell brightness buckets PLUS clumped low-frequency
      // blotches (4x4-cell patches) so the dream floor never reads as a uniform grid
      tileShade(tx,ty,x,y,0.15,31);
      // large-scale brightness blotches via smooth value noise -> organic pools, NOT the old 4x4
      // square blocks (matches the overworld ground rework; user: kill the remaining square patches)
      tileShade(tx,ty,x,y,0.05,91);   // ramped, not thresholded: a threshold snaps to tile edges too
      // Inaccessible cells (walls / locked gates) = the VOID of the boss's consciousness.
      // Darken them hard so the lit dream-floor is unmistakably the play space (user: fill the
      // inaccessible areas so the playable area is highlighted), with sparse drifting motes so
      // the void is "filled", not flat black. Playable floor touching the void gets a faint
      // stippled rim (no solid lines) so the arena edge glows.
      if(c==='W'||c==='D'){
        ctx.fillStyle='rgba(6,5,14,0.56)'; ctx.fillRect(tx,ty,TILE,TILE);
        const GB=(typeof GBOSS!=='undefined')?GBOSS[rg]:null, wh=hmix(x*5+2,y*9+4);
        if(wh%6===0){ const tw=0.07+0.11*(0.5+0.5*Math.sin(performance.now()/900+(x*2+y*3)));
          ctx.fillStyle=_hexA(GB?GB.col:'#6a6aa0',tw.toFixed(3));
          ctx.fillRect(tx+3+(wh%(TILE-6)),ty+3+((wh>>5)%(TILE-6)),1,1); } }
      else { const G=curRoom.grid, vd=(xx,yy)=>{ const rr=G[yy]; const cc=rr&&rr[xx]; return cc==='W'||cc==='D'||cc==null; };
        const rc='rgba(255,238,200,0.16)';
        if(vd(x,y-1)) pxH(tx,ty,TILE,rc,0.5); if(vd(x,y+1)) pxH(tx,ty+TILE-1,TILE,rc,0.5);
        if(vd(x-1,y)) pxV(tx,ty,TILE,rc,0.5); if(vd(x+1,y)) pxV(tx+TILE-1,ty,TILE,rc,0.5); }
      if(c==='D'){ const GB=(typeof GBOSS!=='undefined')?GBOSS[rg]:null, pu=0.30+Math.sin(performance.now()/300)*0.18;
        ctx.globalAlpha=pu; ctx.fillStyle=GB?GB.col:'#ffd07a'; ctx.fillRect(tx,ty,TILE,TILE); ctx.globalAlpha=1;
        ctx.fillStyle='rgba(255,255,255,0.75)';
        ctx.fillRect(tx+TILE/2-2,ty+TILE/2-7,4,14); ctx.fillRect(tx+TILE/2-7,ty+TILE/2-2,14,4); }
      return;
    }
    if(c==='D'){ ctx.fillStyle='#3a3344'; ctx.fillRect(tx,ty,TILE,TILE);
      const pu=0.30+Math.sin(performance.now()/300)*0.18; ctx.globalAlpha=pu;
      ctx.fillStyle='#ffd07a'; ctx.fillRect(tx,ty,TILE,TILE); ctx.globalAlpha=1; return; }
  }
  // 'b' = the great bridge between the islands (the permadeath gate). Real PixelLab deck art
  // in Phase 2; placeholder timber planks + stippled rope rails over the ocean for now.
  if(c==='b'){
    const bimg=(typeof _bridgeImg!=='undefined'&&_bridgeImg&&_bridgeImg.complete&&_bridgeImg.naturalWidth)?_bridgeImg:null;
    if(bimg){ ctx.imageSmoothingEnabled=false; const o=hmix(x,y)&1;
      ctx.fillStyle='#5a3f28'; ctx.fillRect(tx,ty,TILE,TILE);   // timber base so any alpha never shows the void
      ctx.save(); ctx.translate(tx+TILE/2,ty+TILE/2); ctx.scale(o?-1:1,1);
      ctx.drawImage(bimg,-TILE/2,-TILE/2,TILE,TILE); ctx.restore(); }
    else { ctx.fillStyle='#5a3f28'; ctx.fillRect(tx,ty,TILE,TILE);
      ctx.fillStyle='#6e4d31'; for(let py=2;py<TILE;py+=6) ctx.fillRect(tx,ty+py,TILE,4);   // planks
      ctx.fillStyle='rgba(0,0,0,.28)'; for(let py=5;py<TILE;py+=6) ctx.fillRect(tx,ty+py,TILE,1); }
    const G=curRoom.grid, off=(xx,yy)=>{ const rr=G[yy]; const cc=rr&&rr[xx]; return cc!=='b'; };
    if(off(x,y-1)) pxH(tx,ty,TILE,'rgba(40,26,16,0.9)',0.8);        // rope rails on the open sides
    if(off(x,y+1)) pxH(tx,ty+TILE-1,TILE,'rgba(40,26,16,0.9)',0.8);
    return; }
  // GRASS ('g') — a lawn tile. Value-noise green rather than a stamped image, so a patch reads as
  // one continuous field instead of a grid, with the 8-bit detail pass laying blades over the top.
  // TOWN ONLY. The overworld uses 'g' for its grass too, and this branch RETURNS -- so it was
  // intercepting every grove tile and painting the Hearth's flat olive over the grove's per-band
  // colouring, while 'd'/'r'/'e' tiles still took the old path and stood out as grey squares
  // against it. The overworld gets its own 8-bit pass further down, on its own colours.
  if(c==='g' && curRoom.town){
    const hh=hmix(x,y);
    // MUTED, not lawn-green. Everything else in this game is warm browns and tans, and a saturated
    // grass green sat on top of that palette like a sticker. This is a mossy olive with a lot of
    // per-tile variation, so a patch reads as turf rather than as a filled rectangle.
    const n1=Math.sin(x*0.63+y*0.29)+Math.sin(x*0.17-y*0.77);          // large soft patches
    const n2=Math.sin(x*1.9-y*1.31)+Math.sin(x*2.7+y*2.1);             // finer mottling
    const v=n1*0.34+n2*0.16;                                            // ~ -1 .. 1
    const R=Math.round(66+v*16), G=Math.round(84+v*20), Bl=Math.round(46+v*11);
    ctx.fillStyle='rgb('+R+','+G+','+Bl+')';
    ctx.fillRect(tx,ty,TILE,TILE);
    // a second, coarser wash at quarter-tile resolution breaks the flat fill up further
    for(let qy=0;qy<2;qy++)for(let qx=0;qx<2;qx++){
      const q=hmix(x*2+qx,y*2+qy)&7;
      if(q<3){ ctx.fillStyle=q===0?'rgba(0,0,0,0.10)':'rgba(196,214,150,0.055)';
        ctx.fillRect(tx+qx*TILE/2,ty+qy*TILE/2,TILE/2,TILE/2); } }
    // the 8-bit blades
    if(typeof drawFloorDetail==='function') drawFloorDetail('grass',tx,ty,x,y,1);
    // edge shading against neighbouring stone, so a lawn has a lip rather than a border
    const Gr=curRoom.grid, gr=(xx,yy)=>{ const r=Gr[yy]; return r&&r[xx]==='g'; };
    if(!gr(x,y-1)) { ctx.fillStyle='rgba(30,40,22,0.40)'; ctx.fillRect(tx,ty,TILE,3); }
    if(!gr(x,y+1)) { ctx.fillStyle='rgba(30,40,22,0.30)'; ctx.fillRect(tx,ty+TILE-2,TILE,2); }
    if(!gr(x-1,y)) { ctx.fillStyle='rgba(30,40,22,0.40)'; ctx.fillRect(tx,ty,3,TILE); }
    if(!gr(x+1,y)) { ctx.fillStyle='rgba(30,40,22,0.30)'; ctx.fillRect(tx+TILE-2,ty,2,TILE); }
    // WILDFLOWERS (user: "add some flowers around"). Clusters, not lone dots -- flowers grow in
    // company, and one 2px pip per tile read as dirt rather than as a bloom. Each cluster picks a
    // single species so a patch is one colour, the way a real clump of the same plant would be.
    // >>> NOT >>. hmix returns an UNSIGNED 32-bit value, but the signed shift `>>` converts to
    // int32 first, so any hash above 2^31 comes out NEGATIVE -- and a negative % length is a
    // negative index, so SP[-2] was undefined and sp[0] threw. Every frame, on any grass tile
    // whose hash happened to land in the top half of the range. This crashed live play.
    if((hh>>>4)%2===0){                // half the lawn tiles carry a clump
      const SP=[['#d8b84a','#f0d878'],   // buttercup
                ['#dcd4e0','#ffffff'],   // daisy
                ['#c86a8e','#e89ab4'],   // clover pink
                ['#8a6ac0','#b39ae0'],   // small bellflower
                ['#d86a4a','#f09a7a']];  // poppy
      const sp=SP[(hh>>>9)%SP.length]||SP[0];   // ||SP[0]: never let a bad index reach sp[0] again
      const n=3+((hh>>>13)%4);
      const cx0=6+((hh>>>7)%(TILE-14)), cy0=6+((hh>>>11)%(TILE-14));
      for(let i=0;i<n;i++){
        const j=hmix(x*7+i,y*11+i);
        const fx=tx+cx0+((j%9)-4), fy=ty+cy0+(((j>>>4)%9)-4);
        if(fx<tx+2||fy<ty+2||fx>tx+TILE-4||fy>ty+TILE-5) continue;
        ctx.fillStyle='rgba(24,38,20,0.9)'; ctx.fillRect(fx+1,fy+3,1,3);       // stem
        ctx.fillStyle='rgba(20,32,16,0.55)'; ctx.fillRect(fx,fy+1,3,3);         // bloom shadow
        ctx.fillStyle=sp[0]; ctx.fillRect(fx,fy,3,3);                           // bloom
        ctx.fillStyle=sp[1]; ctx.fillRect(fx+1,fy,1,2);                         // highlight
      }
    }
    return;
  }
  // ============================ THE VAULT STRONGROOM ============================
  // The vault used the hub's cobble and looked like a shed behind the market. A strongroom is the
  // one room in the game that has to look EXPENSIVE, and the read has to be instant: polished
  // stone, brass, and a carpet that tells you where to walk.
  //
  // Drawn procedurally rather than from art because every part of it is a GRID: the slabs are
  // 2x2 tiles, the brass seams run along slab boundaries, the deposit-box doors are 2x2 per tile,
  // and the runner needs to know which of its own edges are exposed. A tile image cannot see its
  // neighbours, so a seam baked into art breaks the moment the room is reshaped -- and reshaping
  // the room is exactly what this pass does. Procedural also tiles perfectly and loads instantly,
  // which is most of the room's first impression.
  //
  //   f  polished granite, 2x2-tile slabs with brass seams
  //   p  crimson runner, gold trim drawn only on its exposed edges
  //   h  the back bank of safe-deposit doors
  //   W  dressed stone with a brass dado rail
  if(curRoom.key==='VAULT'){
    const VG=curRoom.grid, vat=(xx,yy)=>{ const r=VG[yy]; return r?r[xx]:'W'; };
    const vh=hmix(x,y);

    if(c==='W'){
      // dressed ashlar, courses offset every other row, with a brass rail at the base
      // The wall used to sit within a few values of the floor, so the room had no edge -- it just
      // faded out. Lifted with the floor and kept a step BRIGHTER than it, which is what gives the
      // chamber a readable boundary now that the middle is no longer black.
      ctx.fillStyle='#3a3444'; ctx.fillRect(tx,ty,TILE,TILE);
      const off=(y&1)?TILE/2:0;
      for(let i=-1;i<2;i++){
        const bx=tx+off+i*TILE, g2=hmix(x*3+i,y*7);
        ctx.fillStyle=['#4a4256','#443c4f','#51485e'][g2%3];
        ctx.fillRect(bx+1,ty+1,TILE-2,TILE/2-2);
        ctx.fillStyle=['#413a4c','#4c4459','#3d3647'][(g2>>>4)%3];
        ctx.fillRect(bx+1-TILE/2,ty+TILE/2+1,TILE-2,TILE/2-2);
      }
      ctx.fillStyle='rgba(255,240,210,0.05)'; ctx.fillRect(tx,ty,TILE,2);
      ctx.fillStyle='rgba(0,0,0,0.34)';       ctx.fillRect(tx,ty+TILE-5,TILE,5);
      // the rail only runs on wall cells with open floor below, so it reads as a line running
      // around the room rather than a stripe painted on every block in the map
      if('fph'.indexOf(vat(x,y+1))>=0){
        ctx.fillStyle='#7a5c22'; ctx.fillRect(tx,ty+TILE-11,TILE,3);
        ctx.fillStyle='#c9a04a'; ctx.fillRect(tx,ty+TILE-11,TILE,1);
        if((vh&7)===0){ ctx.fillStyle='#e8c98a'; ctx.fillRect(tx+((vh>>>3)%(TILE-4)),ty+TILE-11,2,1); }
      }
      return;
    }

    if(c==='h'){
      // THE SCROLL RACKS (user: "more like a wine cellar with the walls being wine shelfs but full
      // of scrolls", then "like that but a bunch of them from the front side").
      //
      // These are FRONT ELEVATIONS, not a top-down pattern. The first attempt drew the lattice
      // procedurally from above and it read as a honeycomb of coins -- a wine rack is recognised
      // by its front, by the X-braces and the ends of what is stored in it, and none of that
      // survives being flattened into a floor plan.
      //
      // So a rack is one image spanning a 2x3-TILE UNIT, and each tile blits its own sixth of it.
      // The unit is anchored to a global grid (floor(x/2)*2, floor(y/3)*3) rather than to the
      // block's own corner, which means the walls line up on their own no matter where a block is
      // placed -- 00b_hearth just has to put its rack blocks on those boundaries. Two variants
      // alternate per unit so a twenty-tile wall is not one rack repeated eleven times.
      const UW=2, UH=3;
      const ux=Math.floor(x/UW)*UW, uy=Math.floor(y/UH)*UH;
      const rk=(typeof _hearth!=='undefined')
        ? _hearth[(hmix(ux,uy)&1)?'vault_rack1':'vault_rack0'] : null;
      if(rk&&rk.complete&&rk.naturalWidth){
        const sw=rk.naturalWidth/UW, sh=rk.naturalHeight/UH;
        ctx.imageSmoothingEnabled=false;
        ctx.fillStyle='#120c07'; ctx.fillRect(tx,ty,TILE,TILE);   // behind, so gaps read as dark
        ctx.drawImage(rk,(x-ux)*sw,(y-uy)*sh,sw,sh, tx,ty,TILE,TILE);
        // the lowest course of a rack gets a contact shadow, so it sits ON the floor
        if(vat(x,y+1)!=='h'){ ctx.fillStyle='rgba(0,0,0,0.34)'; ctx.fillRect(tx,ty+TILE-4,TILE,4); }
        return;
      }
      // art not decoded yet: a dark panel, never the bare floor (which would flash as a hole)
      ctx.fillStyle='#1a1209'; ctx.fillRect(tx,ty,TILE,TILE);
      ctx.fillStyle='rgba(0,0,0,0.32)'; ctx.fillRect(tx,ty+TILE-4,TILE,4);
      return;
    }

    // ---- the floor: 2x2-tile polished slabs, brass seams on the slab grid ----
    // Still cold, because the room's light is additive warm glows and a mid-tone stone under that
    // much orange comes out khaki -- that part of the original reasoning holds. But it was pushed
    // so far down (a #12-#1c base) that most of the room read as an unlit void with a carpet in
    // it, and the brass the whole design hangs on had nothing to sit against. Roughly doubled in
    // value and given real MARBLE VEINING, which is the thing that makes polished stone read as
    // stone rather than as flat fill.
    const sh=hmix(x>>1,y>>1);                       // one hash per SLAB, not per tile
    ctx.fillStyle=['#2b2a38','#31303f','#262533','#353347'][sh%4];
    ctx.fillRect(tx,ty,TILE,TILE);
    // polish: a broad sheen that does NOT follow the tile grid, so the stone reads as one surface
    const sheen=vnoise(x*0.5,y*0.5,2.4);
    if(sheen>0.5){ ctx.fillStyle='rgba(168,178,225,'+((sheen-0.5)*0.20).toFixed(3)+')';
      ctx.fillRect(tx,ty,TILE,TILE); }
    // VEINING. Sampled from continuous value noise rather than a per-tile hash, so a vein runs
    // ACROSS slabs instead of restarting at every tile edge -- a vein that stops at a seam is the
    // tell that gives away a stamped floor. Two octaves: a wide pale drift and a fine bright
    // filament inside it.
    // FINE and FAINT. The first pass sampled the noise at 1.7 with a 0.045 band and drew veins ten
    // pixels wide that wandered across half the room -- glowing tubes, not marble. Marble reads as
    // marble because the veins are hairlines you notice on the second look: the frequency is more
    // than tripled so the features are small, the band is less than half as wide, and peak alpha
    // is 0.08 instead of 0.15.
    for(let vy=0;vy<TILE;vy+=2) for(let vx=0;vx<TILE;vx+=2){
      const wx=x+vx/TILE, wy=y+vy/TILE;
      const v=Math.abs(vnoise(wx*5.5,wy*5.5,2.0)-0.5);
      if(v<0.018){ ctx.fillStyle='rgba(188,194,228,'+((0.018-v)*4.5).toFixed(3)+')';
        ctx.fillRect(tx+vx,ty+vy,2,2); }
    }
    for(let i=0;i<5;i++){ const g3=hmix(x*13+i,y*17+i);
      ctx.fillStyle=(g3&1)?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.18)';
      ctx.fillRect(tx+(g3%TILE),ty+((g3>>>6)%TILE),1,1); }
    const sL=(x&1)===0, sT=(y&1)===0;
    if(sL){ ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(tx,ty,2,TILE);
            ctx.fillStyle='rgba(201,160,74,0.42)'; ctx.fillRect(tx+1,ty,1,TILE); }
    if(sT){ ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(tx,ty,TILE,2);
            ctx.fillStyle='rgba(201,160,74,0.42)'; ctx.fillRect(tx,ty+1,TILE,1); }
    if(sL&&sT){ ctx.fillStyle='#c9a04a'; ctx.fillRect(tx,ty,3,3);
                ctx.fillStyle='#f7e6b4'; ctx.fillRect(tx,ty,1,1); }

    // ---- the runner ----
    // The spawn cell left a black square in the middle of the carpet, ringed in gold trim, because
    // its neighbours correctly saw a non-runner cell and drew their own edge against it. The map
    // writes that cell as 'P', but 02_worldbuild REWRITES IT TO '.' while lifting the spawn point
    // out -- so checking for 'P' here matches nothing and the hole stayed. Checking for '.' is
    // what actually works, and it is qualified by a neighbour test so a '.' out on the stone floor
    // never turns into an orphan square of carpet.
    const runAt=(xx,yy)=>{ const q=vat(xx,yy);
      if(q==='p') return true;
      if(q!=='.') return false;
      return vat(xx-1,yy)==='p'||vat(xx+1,yy)==='p'||vat(xx,yy-1)==='p'||vat(xx,yy+1)==='p'; };
    if(runAt(x,y)){
      const rN=runAt(x,y-1), rS=runAt(x,y+1), rE=runAt(x+1,y), rW=runAt(x-1,y);
      ctx.fillStyle='#5e1a20'; ctx.fillRect(tx,ty,TILE,TILE);
      for(let i=0;i<10;i++){ const g4=hmix(x*29+i,y*31+i);
        ctx.fillStyle=(g4&3)?'rgba(0,0,0,0.13)':'rgba(255,190,170,0.07)';
        ctx.fillRect(tx+(g4%(TILE-4)),ty+((g4>>>7)%TILE),3,1); }
      // a faint damask diamond so the carpet carries a PATTERN and not just noise
      ctx.fillStyle='rgba(226,176,110,0.13)';
      for(let i=0;i<7;i++){ const w2=(i<4?i:6-i)*2+1;
        ctx.fillRect(tx+TILE/2-w2, ty+TILE/2-7+i*2, w2*2, 2); }
      // gold trim ONLY on exposed edges. Trim on every tile is a ladder, not a carpet.
      if(!rN){ ctx.fillStyle='#8a6a24'; ctx.fillRect(tx,ty,TILE,4);
               ctx.fillStyle='#d9b45e'; ctx.fillRect(tx,ty,TILE,2); }
      if(!rS){ ctx.fillStyle='#8a6a24'; ctx.fillRect(tx,ty+TILE-4,TILE,4);
               ctx.fillStyle='#d9b45e'; ctx.fillRect(tx,ty+TILE-2,TILE,2); }
      if(!rW){ ctx.fillStyle='#8a6a24'; ctx.fillRect(tx,ty,4,TILE);
               ctx.fillStyle='#d9b45e'; ctx.fillRect(tx,ty,2,TILE); }
      if(!rE){ ctx.fillStyle='#8a6a24'; ctx.fillRect(tx+TILE-4,ty,4,TILE);
               ctx.fillStyle='#d9b45e'; ctx.fillRect(tx+TILE-2,ty,2,TILE); }
    }

    // props that stand on the vault floor still draw over it
    // 'l' is the candelabra here rather than the town lamp -- reusing the tile char means the
    // room's lighting comes for free (02_worldbuild pushes a glow for every 'l' and 'H'), which
    // a decor entry would not have done.
    if(c==='H'||c==='l'){
      const dimg=(c==='H')?_hearth.brazier:_hearth.vault_candelabra;
      if(dimg&&dimg.complete&&dimg.naturalWidth){ ctx.fillStyle='rgba(0,0,0,.32)';
        ctx.beginPath(); ctx.ellipse(tx+TILE/2,ty+TILE-3,13,5,0,0,6.29); ctx.fill();
        drawObjBottom(dimg,tx+TILE/2,ty+TILE-1,c==='l'?30:40); } }
    return;
  }

  // town floor (PixelLab): cobble base, 'p' = paved walkway, ~11% broken variant
  // (well-mixed hash — a linear x*a+y*b formula makes diagonal stripes).
  // Decor cells (h planter / H brazier / l lamp) draw floor UNDER their sprite.
  if(t && typeof _hearth!=='undefined' && _hearth.floor && _hearth.floor.complete && _hearth.floor.naturalWidth && c!=='W' && c!=='w'){
    ctx.imageSmoothingEnabled=false; const hh=hmix(x,y), o=hh&3;   // mixed hash: no parity checkerboard
    let m=(Math.imul(x,374761393)+Math.imul(y,668265263))>>>0;
    m=Math.imul(m^(m>>>13),1274126177)>>>0; m=(m^(m>>>16))>>>0;
    const ok=im=>im&&im.complete&&im.naturalWidth;
    let img;
    if(c==='p'){ // walkway: main slab tile mixed with a cracked/pebbled variant (~26%)
      img=((m%100<26)&&ok(_hearth.floor_walk2))?_hearth.floor_walk2
         :(ok(_hearth.floor_walk)?_hearth.floor_walk:_hearth.floor); }
    else img=((m%100<11)&&ok(_hearth.floor_broken))?_hearth.floor_broken:_hearth.floor;
    ctx.save(); ctx.translate(tx+TILE/2,ty+TILE/2); ctx.scale(o&1?-1:1,o&2?-1:1);
    ctx.drawImage(img,-TILE/2,-TILE/2,TILE,TILE); ctx.restore();
    tileShade(tx,ty,x,y,0.10,7);
    // 8-bit grit over the cobble: chips, grout speckle and the odd hairline crack
    if(typeof drawFloorDetail==='function') drawFloorDetail('stone',tx,ty,x,y,0.85);
    // decor sprite on the floor (short objects, drawn base-anchored in the tile pass)
    if(c==='h'||c==='H'||c==='l'){
      const dimg=c==='h'?_hearth.planter:c==='H'?_hearth.brazier:_hearth.lamp;
      if(ok(dimg)){ ctx.fillStyle='rgba(0,0,0,.25)';
        ctx.beginPath(); ctx.ellipse(tx+TILE/2,ty+TILE-3,15,5,0,0,6.29); ctx.fill();
        drawObjBottom(dimg,tx+TILE/2,ty+TILE-1,c==='l'?34:40); return; }
      // art not loaded yet -> fall through to the procedural shapes below
    } else return;   // plain floor/walkway cell: done
  }
  const r1=h2(x,y);
  if(r1>0.55){ ctx.fillStyle='rgba(0,0,0,0.14)';
    ctx.fillRect(tx+(r1*30)%TILE,ty+(r1*57)%TILE,3,3); }
  // 8-BIT DETAIL on every remaining walkable surface -- the overworld, the groves, the dungeons.
  // Family comes from the grid char and the room, so a crypt pits and a field grains.
  if(typeof drawFloorDetail==='function' && 'WhlHwXDtk'.indexOf(c)<0){
    drawFloorDetail(floorFamily(c,curRoom),tx,ty,x,y,0.9); }
  if(c==='W'){
    const wimg=(t&&typeof _hearth!=='undefined')?_hearth.wall:null;
    if(wimg&&wimg.complete&&wimg.naturalWidth){
      ctx.imageSmoothingEnabled=false;
      ctx.save(); ctx.translate(tx+TILE/2,ty+TILE/2); ctx.scale((x*131+y*57)&1?-1:1,1);
      ctx.drawImage(wimg,-TILE/2,-TILE/2,TILE,TILE); ctx.restore();
      ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.fillRect(tx,ty,TILE,3);
      ctx.fillStyle='rgba(0,0,0,0.30)'; ctx.fillRect(tx,ty+TILE-6,TILE,6);
    } else {
    ctx.fillStyle=t?'#3a2a20':'#262031'; ctx.fillRect(tx,ty,TILE,TILE);
    ctx.fillStyle=t?'#54402f':'#3a3344'; ctx.fillRect(tx,ty,TILE,10);
    ctx.fillStyle=t?'#241812':'#151120'; ctx.fillRect(tx,ty+TILE-7,TILE,7);
    }
  } else if(c==='h'){
    ctx.fillStyle='#4a2f22'; ctx.fillRect(tx,ty,TILE,TILE);
    ctx.fillStyle='#84422a'; ctx.fillRect(tx,ty,TILE,11);
    ctx.fillStyle='#5c3826'; ctx.fillRect(tx+6,ty+19,13,13);
  } else if(c==='H'){
    // real brazier sprite everywhere (grove, sub-rooms) — not just town
    const bimg=(typeof _hearth!=='undefined')?_hearth.brazier:null;
    if(bimg&&bimg.complete&&bimg.naturalWidth){ ctx.fillStyle='rgba(0,0,0,.25)';
      ctx.beginPath(); ctx.ellipse(tx+TILE/2,ty+TILE-3,15,5,0,0,6.29); ctx.fill();
      drawObjBottom(bimg,tx+TILE/2,ty+TILE-1,40);
    } else {
    ctx.fillStyle='#55402f'; ctx.beginPath(); ctx.arc(tx+TILE/2,ty+TILE/2,TILE*0.46,0,6.29); ctx.fill();
    ctx.fillStyle='#2b1f18'; ctx.beginPath(); ctx.arc(tx+TILE/2,ty+TILE/2,TILE*0.32,0,6.29); ctx.fill();
    }
  } else if(c==='l'){
    const limg=(typeof _hearth!=='undefined')?_hearth.lamp:null;
    if(limg&&limg.complete&&limg.naturalWidth){ ctx.fillStyle='rgba(0,0,0,.25)';
      ctx.beginPath(); ctx.ellipse(tx+TILE/2,ty+TILE-3,12,4,0,0,6.29); ctx.fill();
      drawObjBottom(limg,tx+TILE/2,ty+TILE-1,34);
    } else {
    ctx.fillStyle='#3a2a20'; ctx.fillRect(tx+TILE/2-3,ty+10,6,TILE-14);
    ctx.fillStyle='#4f392b'; ctx.fillRect(tx+TILE/2-8,ty+3,16,15);
    ctx.fillStyle='#241812'; ctx.fillRect(tx+TILE/2-6,ty+5,12,11);
    }
  } else if(c==='w'){
    // OCEAN: base tile + drifting wave crests + shoreline surf. Waves/foam are drawn as pixel
    // scatter (pxH/pxV), never solid lines (user rule), and animate so the sea actually moves.
    const G=curRoom.grid, wat=(xx,yy)=>{ const r=G[yy]; return r&&r[xx]==='w'; };
    // Pick one of the seamless ocean variants per cell (mix breaks the single-tile repetition).
    // NO per-cell flip — these tiles are edge-matched, flipping would break the seams.
    // The variant is CYCLED over time, not fixed per cell, so the sea animates through its wave
    // frames. The time index carries a spatial term (x*0.30 + y*0.55) so neighbours change on
    // different beats and the swap reads as a swell travelling across the water — stepping every
    // cell in lockstep just makes the whole ocean blink.
    let _wimg=_waterImg;
    if(typeof _waterVar!=='undefined'&&_waterVar&&_waterVar.length){
      const wn2=_waterVar.length;
      const fi=(hmix(x,y)+Math.floor(performance.now()/560 + x*0.30 + y*0.55))%wn2;
      const wv=_waterVar[(fi+wn2)%wn2];
      if(wv&&wv.complete&&wv.naturalWidth) _wimg=wv; }
    if(_wimg&&_wimg.complete&&_wimg.naturalWidth){
      ctx.imageSmoothingEnabled=false; ctx.drawImage(_wimg,tx,ty,TILE,TILE);
    } else { ctx.fillStyle=(x+y)%2?'#16303f':'#1a3848'; ctx.fillRect(tx,ty,TILE,TILE); }
    ctx.fillStyle='rgba(6,12,26,0.30)'; ctx.fillRect(tx,ty,TILE,TILE);      // deepen into the palette
    const t=performance.now()/1000;
    // rolling wave crests: a scrolling sine+noise field; where it peaks, lay a foam ridge of
    // scattered pixels across the row -> a wave front drifting slowly north.
    for(let iy=0; iy<TILE; iy+=3){
      const wy=ty+iy;
      const ph=Math.sin(wy*0.10 - t*1.3 + x*0.35 + vnoise(x*3,(wy>>3)+y*3,5)*6.0);
      if(ph>0.88)      pxH(tx,ty+iy, TILE, 'rgba(205,232,244,0.22)', 0.55);
      else if(ph>0.74) pxH(tx,ty+iy, TILE, 'rgba(150,196,216,0.13)', 0.4);
    }
    // occasional sun-glint sparkle (drifts with a coarse time bucket)
    const gh=hmix(x*3+((t*1.5)|0), y*5);
    if((gh&255)<22){ ctx.fillStyle='rgba(224,242,251,0.20)'; ctx.fillRect(tx+(gh%TILE), ty+((gh>>5)%TILE),1,1); }
    // SHORELINE SURF: bright pulsing foam on the water edge that touches land, with a wet band
    // just inside it -> a lively coastline instead of a flat dark rim.
    if(!wat(x,y-1)||!wat(x,y+1)||!wat(x-1,y)||!wat(x+1,y)){
      const fa=(0.30+0.16*Math.sin(t*3.0+x*1.3+y*0.7)).toFixed(3), foam='rgba(236,248,252,'+fa+')';
      ctx.fillStyle='rgba(4,10,20,0.42)';
      if(!wat(x,y-1)){ ctx.fillRect(tx,ty+2,TILE,2); pxH(tx,ty,TILE,foam,0.7); }
      if(!wat(x,y+1)){ ctx.fillRect(tx,ty+TILE-4,TILE,2); pxH(tx,ty+TILE-1,TILE,foam,0.7); }
      if(!wat(x-1,y)){ ctx.fillRect(tx+2,ty,2,TILE); pxV(tx,ty,TILE,foam,0.7); }
      if(!wat(x+1,y)){ ctx.fillRect(tx+TILE-4,ty,2,TILE); pxV(tx+TILE-1,ty,TILE,foam,0.7); }
    }
  } else if(c==='X' || c==='F'){
    // Boss-room wall ('X', tileset upper) / floor ('F', lower) — themed to the BOSS whose den it
    // is, falling back to the terrain band only for arenas with no recorded owner.
    const _lo=curRoom.lairAt?curRoom.lairAt[y*curRoom.w+x]:undefined;
    const bd=(_lo!==undefined&&typeof lairTileSet==='function')?lairTileSet(_lo)
            :(curRoom.rings?grvBandXY(x,y):8);
    const set=_lairSet[bd];
    let src=(c==='X')?GROUND_UP:GROUND_LO;
    if(set && set.naturalWidth){ ctx.imageSmoothingEnabled=false;
      const hh=hmix(x,y), o=hh&3;   // mixed hash: no parity checkerboard
      // NOTE: do NOT try to auto-pick extra 32x32 "variant" cells out of these sheets. They are
      // not cell-aligned by material — the floor and wall areas are organic regions, so a cell
      // that measures close to the floor colour still straddles the boundary and drags wall
      // pixels in. On screen that reads as dark holes punched through the floor. GROUND_UP /
      // GROUND_LO are the two hand-verified clean cells.
      // ROTATE, don't just flip. A mirror preserves the texture's own axes, so a flipped tile
      // still reads as the same tile and the lattice survives; quarter-turns genuinely change its
      // orientation. 4 rotations x 2 mirrors from one clean cell = 8 readings of a single tile.
      // 16-variant atlas when this theme has one; otherwise the old single hand-verified cell
      const _atl=(c==='F')?_floorSet[bd]:_wallSet[bd];
      // a borrowed theme uses only the first 5 variants; its owner uses all 16
      const _bor=(_lo!==undefined&&typeof LAIR_TILE!=='undefined'&&LAIR_TILE[_lo]!==undefined);
      if(!drawAtlas(_atl,x,y,tx,ty,hh,_bor?5:16)){
        ctx.save(); ctx.translate(tx+TILE/2,ty+TILE/2);
        ctx.rotate(((hh>>4)&3)*1.5708); ctx.scale(o&1?-1:1,o&2?-1:1);
        ctx.drawImage(set,src[0],src[1],32,32,-TILE/2,-TILE/2,TILE,TILE); ctx.restore(); }
      // LOW-FREQUENCY mottling. Per-tile variation repeats at exactly the grid frequency, so it
      // can never break the wallpaper look no matter how strong it is — the eye still locks onto
      // the lattice. Broad vnoise patches several tiles across are what actually kill it: damp
      // hollows and sun-bleached rises that ignore the tile edges entirely.
      const m1=vnoise(x,y,6.5), m2=vnoise(x+91,y-37,2.7), m3=vnoise(x-53,y+17,14);
      const mo=m1*0.55+m2*0.25+m3*0.20;
      if(mo<0.48){ ctx.fillStyle='rgba(6,10,16,'+((0.48-mo)*1.05).toFixed(3)+')'; ctx.fillRect(tx,ty,TILE,TILE); }
      else if(mo>0.56){ ctx.fillStyle='rgba(255,240,208,'+((mo-0.56)*0.55).toFixed(3)+')'; ctx.fillRect(tx,ty,TILE,TILE); }
      // WORN PATCHES at a scale far bigger than the grid: broad areas where the surface is rubbed
      // through, with a soft edge. Nothing tile-sized can break a lattice — only something that
      // plainly ignores it can.
      const wr=vnoise(x+311,y+127,9.5);
      if(wr>0.63){ const a2=Math.min(0.34,(wr-0.63)*1.5);
        ctx.fillStyle='rgba(24,18,12,'+a2.toFixed(3)+')'; ctx.fillRect(tx,ty,TILE,TILE); }
      // ---- MULTI-TILE SURFACE FEATURES ----
      // A gouge of lava, a pool of standing water, a drift of ash: these have to read as ONE
      // continuous shape, so they cannot live in the tile art. A streak drawn inside a 32x32 tile
      // stops dead at its border and never lines up with the next tile — which is exactly why the
      // veined lava tiles looked like scattered slashes. Driven by continuous noise instead, so a
      // feature flows across as many tiles as it needs and closes properly at its own edge.
      if(c==='F'){
        const FEAT=({5:'lava',7:'lava',8:'lava',2:'water',0:'moss',1:'moss',6:'ash'})[bd];
        if(FEAT){ const fv=vnoise(x+17,y+43,5.2);
          if(fv>0.575){ const k=Math.min(1,(fv-0.575)/0.20), tt2=performance.now()/1000;
            if(FEAT==='lava'){
              ctx.fillStyle='rgba(24,11,7,'+(0.60*k).toFixed(3)+')'; ctx.fillRect(tx,ty,TILE,TILE);  // cooled crust rim
              if(k>0.40){ const g2=Math.min(1,(k-0.40)/0.60), pu=0.80+0.20*Math.sin(tt2*2.1+x*0.5+y*0.35);
                ctx.save(); ctx.globalCompositeOperation='lighter';
                ctx.globalAlpha=g2*pu*0.95; ctx.fillStyle='#ff6a12'; ctx.fillRect(tx,ty,TILE,TILE);
                if(g2>0.5){ ctx.globalAlpha=(g2-0.5)*1.9*pu; ctx.fillStyle='#ffdf9a';
                  ctx.fillRect(tx+3,ty+3,TILE-6,TILE-6); }                                          // white-hot core
                ctx.restore(); ctx.globalAlpha=1; } }
            else if(FEAT==='water'){
              ctx.fillStyle='rgba(14,34,40,'+(0.52*k).toFixed(3)+')'; ctx.fillRect(tx,ty,TILE,TILE);
              if(k>0.5){ const sh=0.16+0.10*Math.sin(tt2*1.6+x*0.7);
                ctx.fillStyle='rgba(150,214,224,'+(sh*(k-0.5)*2).toFixed(3)+')';
                ctx.fillRect(tx+4,ty+TILE*0.42,TILE-8,2); } }
            else if(FEAT==='moss'){
              ctx.fillStyle='rgba(58,104,44,'+(0.50*k).toFixed(3)+')'; ctx.fillRect(tx,ty,TILE,TILE); }
            else if(FEAT==='ash'){
              ctx.fillStyle='rgba(196,190,180,'+(0.42*k).toFixed(3)+')'; ctx.fillRect(tx,ty,TILE,TILE); } } } }
      // per-block variety on top -- as a continuous ramp, not a per-cell bucket (see tileShade)
      tileShade(tx,ty,x,y,0.13,53);
      // scattered grit + debris on the FLOOR, keyed off the same noise so it clusters in the
      // hollows instead of sprinkling evenly (even sprinkles read as texture, not as a place)
      if(c==='F'){
        if(mo<0.44 && ((hh>>9)&3)===0){ ctx.fillStyle='rgba(0,0,0,0.20)';
          ctx.fillRect(tx+3+((hh>>4)%26), ty+5+((hh>>7)%24), 5+((hh>>13)%7), 3); }
        if(((hh>>15)&7)===0){ ctx.fillStyle='rgba(255,244,214,0.09)';
          ctx.fillRect(tx+2+((hh>>6)%30), ty+3+((hh>>10)%28), 3, 2); } }
      // A wall standing over the floor casts onto it. Drawn on the FLOOR tile beneath, this is
      // the single strongest cue that the wall has height rather than being a painted pattern.
      if(c==='F'){ const G3=curRoom.grid, ab=(dx)=>{ const r=G3[y-1]; return r&&r[x+dx]==='X'; };
        if(ab(0)){ const sg=ctx.createLinearGradient(0,ty,0,ty+TILE*0.55);
          sg.addColorStop(0,'rgba(0,0,0,0.50)'); sg.addColorStop(1,'rgba(0,0,0,0)');
          ctx.fillStyle=sg; ctx.fillRect(tx,ty,TILE,TILE*0.55); }
        else if(ab(-1)||ab(1)){ const sg=ctx.createLinearGradient(0,ty,0,ty+TILE*0.30);
          sg.addColorStop(0,'rgba(0,0,0,0.26)'); sg.addColorStop(1,'rgba(0,0,0,0)');
          ctx.fillStyle=sg; ctx.fillRect(tx,ty,TILE,TILE*0.30); } }
      if(c==='X'){
        const G2=curRoom.grid, wl=(xx,yy)=>{ const r=G2[yy]; return r&&r[xx]==='X'; };
        // Light the wall by its SHAPE, not uniformly: a run of identical blocks with the same
        // highlight top and shadow bottom is exactly what reads as a repeated texture. Only the
        // exposed courses catch light, and only free-standing ends get a side shadow.
        // TOP CAP: the exposed upper course catches the light.
        if(!wl(x,y-1)){ ctx.fillStyle='rgba(255,250,232,'+(0.16+0.08*mo).toFixed(3)+')'; ctx.fillRect(tx,ty,TILE,5);
          ctx.fillStyle='rgba(255,255,255,0.10)'; ctx.fillRect(tx,ty+5,TILE,2); }
        // FRONT FACE: where the wall ends and floor begins you are looking at its vertical side,
        // so the lower third becomes a distinctly darker face with a lit top edge. Without this a
        // wall is just a differently-coloured floor tile.
        if(!wl(x,y+1)){ const fh=Math.round(TILE*0.38);
          const fg=ctx.createLinearGradient(0,ty+TILE-fh,0,ty+TILE);
          fg.addColorStop(0,'rgba(0,0,0,0.30)'); fg.addColorStop(1,'rgba(0,0,0,0.66)');
          ctx.fillStyle=fg; ctx.fillRect(tx,ty+TILE-fh,TILE,fh);
          ctx.fillStyle='rgba(255,246,224,0.14)'; ctx.fillRect(tx,ty+TILE-fh,TILE,2); }
        if(!wl(x-1,y)){ ctx.fillStyle='rgba(0,0,0,0.24)'; ctx.fillRect(tx,ty,4,TILE); }
        if(!wl(x+1,y)){ ctx.fillStyle='rgba(0,0,0,0.24)'; ctx.fillRect(tx+TILE-4,ty,4,TILE); }
        ctx.fillStyle='rgba(0,0,0,'+(0.10+0.22*(1-mo)).toFixed(3)+')';   // damp courses go darker
        ctx.fillRect(tx,ty,TILE,TILE);
        if(((hh>>2)%7)>=4){ ctx.fillStyle='rgba(0,0,0,0.35)';          // cracked / chipped blocks
          ctx.fillRect(tx+4+((hh>>5)%18), ty+7+((hh>>8)%20), 2, 5+((hh>>11)%6));
          ctx.fillRect(tx+7+((hh>>6)%16), ty+16+((hh>>9)%14), 4, 2); }
        if(mo>0.60 && ((hh>>12)&1)){ ctx.fillStyle='rgba(96,132,64,0.20)';   // moss on the damp side
          ctx.fillRect(tx+((hh>>3)%22), ty+TILE-9-((hh>>7)%7), 6+((hh>>14)%10), 4); } }
    } else { ctx.fillStyle=(c==='X')?'#3a3340':'#241f2a'; ctx.fillRect(tx,ty,TILE,TILE);
      if(c==='X'){ ctx.fillStyle='#4a4350'; ctx.fillRect(tx,ty,TILE,9); ctx.fillStyle='#181420'; ctx.fillRect(tx,ty+TILE-5,TILE,5); } }
  } else if('dgretk.'.indexOf(c)>=0 && curRoom.rings){
    const bd=grvBandXY(x,y);
    let _baseDrawn=false;      // shore sand already laid down -> skip the ground pass
    // SHORE: a sandy beach ring wherever land meets the ocean. Land cells touching 'w' draw the
    // sand tile instead of ground, with a wet-sand rim on the water side -> reads as a coastline.
    if(curRoom.rings.radial && typeof _shoreImg!=='undefined' && _shoreImg && _shoreImg.complete && _shoreImg.naturalWidth){
      const G=curRoom.grid, wat=(xx,yy)=>{ const r=G[yy]; return r&&r[xx]==='w'; };
      if(wat(x-1,y)||wat(x+1,y)||wat(x,y-1)||wat(x,y+1)){
        ctx.imageSmoothingEnabled=false; const hh=hmix(x,y), o=hh&3;
        ctx.save(); ctx.translate(tx+TILE/2,ty+TILE/2); ctx.scale(o&1?-1:1,o&2?-1:1);
        ctx.drawImage(_shoreImg,-TILE/2,-TILE/2,TILE,TILE); ctx.restore();
        tileShade(tx,ty,x,y,0.075,17);   // shoreline sand: same seamless ramp as every other floor
        ctx.fillStyle='rgba(70,110,120,0.30)';   // wet darker sand on the water-facing edge(s)
        if(wat(x,y-1)) ctx.fillRect(tx,ty,TILE,4); if(wat(x,y+1)) ctx.fillRect(tx,ty+TILE-4,TILE,4);
        if(wat(x-1,y)) ctx.fillRect(tx,ty,4,TILE); if(wat(x+1,y)) ctx.fillRect(tx+TILE-4,ty,4,TILE);
        // Do NOT return: a tree or boulder on the shoreline still has to draw its sprite,
        // or it becomes an invisible obstacle exactly like the ground atlas used to cause.
        _baseDrawn=true; }
    }
    const _gset=_groundSet[bd];
    if(_baseDrawn){ /* shore sand is the base here */ }
    else if(_gset && _gset.naturalWidth){ ctx.imageSmoothingEnabled=false;
      const hh=hmix(x,y), o=hh&3;   // mixed hash -> flip is random per-cell, not parity-checkerboard
      // The base is ALWAYS the main upper-terrain tile (GROUND_UP). The lower-terrain tile
      // (GROUND_LO) is a very DIFFERENT-looking biome tile — measured colour distance from the
      // main up to 263 — so sprinkling it per-tile at 11-32% was the ugly quilt. It now appears
      // ONLY as rare COARSE patches (a puddle / dirt / lava pool), a deliberate feature. The
      // same-terrain variant SHEET (mild ~60 contrast) carries the large-scale variety instead.
      const _vs=_groundVar[bd];
      // ORGANIC patches via smooth noise (curved blobs, not square blocks; sparse, not clustered):
      // secondary terrain (a dirt/lava pool) only in the highest, rarest noise peaks; the
      // same-terrain variant sheet fills gentler large-scale swells for texture variety.
      // Both alternate tiles are SPARSE organic accents; the ground is overwhelmingly the
      // clean main tile, with variety mostly from per-cell flip + brightness noise. loPatch
      // (a very different biome tile) ~2.5%; the variant sheet (some bands' variant is quite
      // dark) ~14% so it never takes over into big dark regions.
      const nLo=vnoise(x+13,y+61,3.4), nVar=vnoise(x+140,y+9,6.5);
      const loPatch=nLo > ((bd>=5&&bd<=8)?0.82:0.90);   // 5-8 are the hot bands; 9 is starter stone
      const g=loPatch?GROUND_LO:GROUND_UP;
      const useVar=!loPatch && _vs && _vs.naturalWidth && nVar>0.74;
      const src=useVar?_vs:_gset;
      // 16-variant open-world ground. This replaces ONLY the base tile -- it must not return
      // early: everything below (zone tint, corruption, decals) and, critically, the per-char
      // terrain features further down draw the trees and boulders. Returning here rendered a
      // world with no obstacles in it while collision still read them from the grid, so the
      // player walked into things that were not there.
      if(!drawAtlas(_terrSet[bd],x,y,tx,ty,hh,16)){
        ctx.save(); ctx.translate(tx+TILE/2,ty+TILE/2); ctx.scale(o&1?-1:1,o&2?-1:1);
        ctx.drawImage(src,g[0],g[1],32,32,-TILE/2,-TILE/2,TILE,TILE); ctx.restore();
        // LARGE-SCALE BRIGHTNESS, WITHOUT DRAWING THE GRID (user, 2026-07-27: "the variety in
        // brightness of each tile is enough to" show the tiles). This used to be a 3-step hash
        // wash -- 12% black, nothing, or 6% white -- painted flat across the whole tile. Both
        // halves of that were wrong: the value was QUANTISED, so a seam was never a small step,
        // and it was HASHED, so neighbours were uncorrelated and every single edge jumped the
        // full amplitude. Squares, everywhere, exactly as reported.
        //
        // Now the value is continuous noise sampled at the tile CORNERS, which neighbouring tiles
        // share by construction, and each tile is filled as four bilinear quadrants. The ramp
        // therefore runs straight through the seam instead of stepping at it: same large-scale
        // mottling, no grid. Four extra fillRects per ground tile.
        tileShade(tx,ty,x,y,0.065,0);
      }
      if(_bandTone[bd]){ ctx.fillStyle=_bandTone[bd]; ctx.fillRect(tx,ty,TILE,TILE); }
      terrainDetail(x,y,tx,ty,bd);      // multi-scale relief, patches and litter (continuous, never tiles)
      // CORRUPTION: the infection bleeding out from the portal. A violet/black stain rising
      // toward the rift, plus sparse corrupted crystal/growth decals in the worst of it.
      if(typeof corruptAt==='function'){ const cor=corruptAt(x,y);
        if(cor>0.06){ ctx.fillStyle='rgba(38,8,48,'+(cor*cor*0.6).toFixed(3)+')'; ctx.fillRect(tx,ty,TILE,TILE);
          // THE SHIMMER TRAVELS, IT DOES NOT FLICKER PER TILE. This was the source of the visible
          // grid in the corrupted zones -- x*1.3 rad per tile is ~75 degrees of phase between one
          // tile and the next, so a bright violet wash landed on each tile at an essentially
          // random brightness, flat across the whole tile, with a hard edge. Not the ground: the
          // stain on top of it. At 0.16 rad/tile the pulse reads as a slow wave rolling out from
          // the rift, and adjacent tiles sit within a few percent of each other.
          if(cor>0.35){ const gw=0.10+0.09*(0.5+0.5*Math.sin(performance.now()/700+x*0.16+y*0.11));
            ctx.fillStyle='rgba(190,60,210,'+(cor*gw).toFixed(3)+')'; ctx.fillRect(tx,ty,TILE,TILE); }
          if(cor>0.45 && typeof _corruptDec!=='undefined' && _corruptDec){
            const ch=hmix(x+701,y+229);
            if(ch%100 < cor*30){ const im=_corruptDec[ch%_corruptDec.length];
              if(im&&im.naturalWidth){ const ds=TILE*0.72, ox=((ch>>3)%10)-5, oy=((ch>>9)%10)-5;
                ctx.drawImage(im, tx+TILE/2-ds/2+ox, ty+TILE-ds+2+oy, ds, ds); } } } } }
      // scatter a ground decal (deterministic) on plain ground only — breaks repetition
      const _dl=_decal[bd];
      if(_dl && _dl.length && 'tk'.indexOf(c)<0){
        const dh=hmix(x+911,y+53);   // mixed (own offset) so decals don't parity-align either
        if(dh%100<10){ const im=_dl[dh%_dl.length];   // sparse ground decals — 20% read as clutter
          if(im && im.naturalWidth){ const ds=TILE*0.6, ox=((dh>>3)%12)-6, oy=((dh>>9)%12)-6;
            ctx.drawImage(im, tx+TILE/2-ds/2+ox, ty+TILE/2-ds/2+oy, ds, ds); } } } }
    else { ctx.fillStyle=GBANDCOL[bd][(x+y)&1]; ctx.fillRect(tx,ty,TILE,TILE); }
    // ring boundary lines: darker edge where the neighbour is a different band
    if(x>0 && grvBandXY(x-1,y)!==bd){ ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(tx,ty,2,TILE); }
    if(y>0 && grvBandXY(x,y-1)!==bd){ ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(tx,ty,TILE,2); }
    // The gold "danger rises this way" edge reads the band as an ORDERED ramp. Band 9 (The
    // Cairnworks) is appended, not inserted -- pillar bands are save keys -- so it is numerically
    // the highest band in the game while sitting between 2 and 3 on the ground. Without this guard
    // it would gild the 2|9 seam as the biggest jump on the map and draw the 9|3 seam backwards.
    const _ord=(b)=>(b===9?2.5:b);
    if(x>0 && _ord(grvBandXY(x-1,y))>_ord(bd)){ ctx.fillStyle='rgba(255,201,77,0.18)'; ctx.fillRect(tx,ty,2,TILE); }
    if(y>0 && _ord(grvBandXY(x,y-1))>_ord(bd)){ ctx.fillStyle='rgba(255,201,77,0.18)'; ctx.fillRect(tx,ty,TILE,2); }
    // THE OVERWORLD'S 8-BIT PASS (user: "the entire overworld terrain needs better 8-bit features
    // like the hearth"). Layered ON the band tint rather than replacing it, so every zone keeps
    // its own colour identity and just gains texture. Two octaves of per-tile value noise break
    // the flat fill up first -- a single fill across a whole zone is what made the ground read as
    // a backdrop -- then the stamp library adds grain, and grass tiles get blades and flowers.
    {
      // RESTRAINT. The first pass stacked three noise layers -- large value noise, a quarter-tile
      // wash and full-strength stamps -- on top of a khaki band colour, and three kinds of noise
      // at once is not texture, it is mud. One soft octave for large-scale variation, and the
      // stamps at roughly a third strength so they read as grain rather than dirt. The quarter-
      // tile wash is gone entirely: it was the blotchy part.
      const v=Math.sin(x*0.29+y*0.17)+Math.sin(x*0.11-y*0.34);
      ctx.fillStyle=(v>0)?'rgba(255,246,220,'+(v*0.016).toFixed(3)+')'
                         :'rgba(0,0,0,'+((-v)*0.022).toFixed(3)+')';
      ctx.fillRect(tx,ty,TILE,TILE);
      if(typeof drawFloorDetail==='function'){
        // 'wildgrass', not the Hearth's 'grass': light blades for a dry khaki ground rather than
        // dark ones for mossy green. Carried at a real strength now that the marks belong to the
        // palette -- the earlier mud came from the wrong stamps, not from too much of them.
        // every walkable terrain char in the realm gets its own tuned family, at a strength that
        // actually reads -- 'g' is a small minority of the ground out here
        const fam=(c==='g')?'wildgrass':(c==='r')?'wildrock':(c==='e')?'wildash':'wilddirt';
        drawFloorDetail(fam,tx,ty,x,y,0.85);
      }
    }
    // terrain features layered on the band tint
    if(c==='d'){ if(h2(x*3,y*5)>0.7){ ctx.fillStyle='rgba(90,70,40,0.30)'; ctx.fillRect(tx+(x*13)%30+4,ty+(y*17)%30+4,3,3); } }
    else if(c==='g'){
      // wildflowers out here too, but far sparser than the Hearth's tended lawn -- one tile in
      // seven rather than one in two, because this is wilderness, not a garden
      const gh=hmix(x*3+7,y*5+11)>>>0;
      if((gh>>>4)%7===0){
        const SP=[['#d8b84a','#f0d878'],['#dcd4e0','#ffffff'],['#c86a8e','#e89ab4'],
                  ['#8a6ac0','#b39ae0'],['#d86a4a','#f09a7a']];
        const sp=SP[(gh>>>9)%SP.length]||SP[0];      // >>> : a signed shift here crashed once
        const n=1+((gh>>>13)%3);
        const cx0=7+((gh>>>7)%(TILE-16)), cy0=7+((gh>>>11)%(TILE-16));
        for(let i=0;i<n;i++){ const j=hmix(x*7+i,y*11+i)>>>0;
          const fx=tx+cx0+((j%8)-4), fy=ty+cy0+(((j>>>4)%8)-4);
          if(fx<tx+2||fy<ty+2||fx>tx+TILE-4||fy>ty+TILE-6) continue;
          ctx.fillStyle='rgba(24,38,20,0.85)'; ctx.fillRect(fx+1,fy+3,1,3);
          ctx.fillStyle=sp[0]; ctx.fillRect(fx,fy,2,2);
          ctx.fillStyle=sp[1]; ctx.fillRect(fx,fy,1,1); }
      } }
    else if(c==='r'){ // rock: a few weathering specks instead of a square outline (no line, no square)
      const rh=hmix(x*5+1,y*9+2); ctx.fillStyle='rgba(0,0,0,.20)';
      ctx.fillRect(tx+4+(rh%13),ty+5+((rh>>4)%13),2,1); ctx.fillRect(tx+19+((rh>>8)%15),ty+21+((rh>>12)%15),1,2);
      ctx.fillStyle='rgba(255,255,255,.06)'; ctx.fillRect(tx+10+((rh>>16)%18),ty+9+((rh>>20)%20),1,1); }
    else if(c==='e'){ if(h2(x*7,y)>0.72){ const gl=0.5+Math.sin(performance.now()/300+x+y)*0.35;
      ctx.fillStyle='rgba(255,122,61,'+gl.toFixed(2)+')'; ctx.fillRect(tx+10,ty+TILE/2,TILE-20,3); } }
    else if(c==='t'){
      const _tr=_bandTree[bd], _o=featOffset(x,y), _bx=tx+TILE/2+_o[0], _by=ty+TILE-6+_o[1];
      propFooting(tx+_o[0],ty+_o[1],x,y,'t');
      if(_tr && _tr.naturalWidth){ ctx.imageSmoothingEnabled=false;
        const tw=TILE*0.92, th=tw*_tr.height/_tr.width;
        ctx.drawImage(_tr, _bx-tw/2, _by-th, tw, th); }
      else {
        ctx.fillStyle='#4a2f22'; ctx.fillRect(_bx-3,_by-13,6,12);
        ctx.fillStyle='#1f3520'; ctx.beginPath(); ctx.arc(_bx,_by-16,11,0,6.29); ctx.fill();
        ctx.fillStyle='#2c4a2a'; ctx.beginPath(); ctx.arc(_bx-3,_by-19,7,0,6.29); ctx.fill(); } }
    else if(c==='k'){
      const _bo=_bandBoulder[bd], _o=featOffset(x,y), _bx=tx+TILE/2+_o[0], _by=ty+TILE-6+_o[1];
      propFooting(tx+_o[0],ty+_o[1],x,y,'k');
      if(_bo && _bo.naturalWidth){ ctx.imageSmoothingEnabled=false;
        const bw=TILE*0.72, bh=bw*_bo.height/_bo.width;
        ctx.drawImage(_bo, _bx-bw/2, _by-bh, bw, bh); }
      else {
        ctx.fillStyle='#5d5666'; ctx.beginPath(); ctx.arc(_bx,_by-8,11,0,6.29); ctx.fill();
        ctx.fillStyle='#726a80'; ctx.beginPath(); ctx.arc(_bx-3,_by-11,6,0,6.29); ctx.fill();
        ctx.strokeStyle='rgba(0,0,0,.45)'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(_bx,_by-8,11,0,6.29); ctx.stroke(); } }
  } else if(c==='f'){
    ctx.fillStyle=(x+y)%2?'#332318':'#3a281b'; ctx.fillRect(tx,ty,TILE,TILE);
    const fh=hmix(x*7,y*3); ctx.fillStyle='rgba(0,0,0,.22)';   // specks, not a square outline
    ctx.fillRect(tx+5+(fh%14),ty+7+((fh>>4)%12),2,1); ctx.fillRect(tx+22+((fh>>8)%14),ty+24+((fh>>12)%12),1,2);
  }
}
function shadow(x,y,r){ ctx.fillStyle='rgba(0,0,0,.35)';
 ctx.beginPath(); ctx.ellipse(x,y,r,r*0.45,0,0,6.29); ctx.fill(); }
// ---------- projectile forge ----------
// Procedural per-key projectile art: 12 base shapes x hashed palette/size/detail/glow.
// Every (class,weapon,tier,rarity) combo, every ability, and every enemy family gets its
// own key -> its own look (hundreds of distinct projectile types), cached as tiny sprites.
const _projCache={};
function _pfh(str){ let h=2166136261; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
// --- colour helpers for the PixelLab tinting path ---
function _rgb2hsl(r,g,b){ r/=255;g/=255;b/=255; const mx=Math.max(r,g,b),mn=Math.min(r,g,b); let h2=0,s=0,l=(mx+mn)/2;
 if(mx!==mn){ const d=mx-mn; s=l>0.5?d/(2-mx-mn):d/(mx+mn);
  h2= mx===r ? (g-b)/d+(g<b?6:0) : mx===g ? (b-r)/d+2 : (r-g)/d+4; h2*=60; }
 return [h2,s,l]; }
function _hsl2rgb(h2,s,l){ h2=((h2%360)+360)%360/360;
 const q=l<0.5?l*(1+s):l+s-l*s, p=2*l-q, f=t=>{ if(t<0)t+=1; if(t>1)t-=1;
  return t<1/6 ? p+(q-p)*6*t : t<1/2 ? q : t<2/3 ? p+(q-p)*(2/3-t)*6 : p; };
 return [Math.round(f(h2+1/3)*255),Math.round(f(h2)*255),Math.round(f(h2-1/3)*255)]; }
function _colHue(col){ if(!col) return null;
 if(col[0]==='#'){ const n=parseInt(col.slice(1),16); return _rgb2hsl((n>>16)&255,(n>>8)&255,n&255)[0]; }
 const m=/hsl\((\d+)/.exec(col); return m?+m[1]:null; }
const _projArtHue={};
function _domHue(name,img){ if(_projArtHue[name]!==undefined) return _projArtHue[name];
 const c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight;
 const g=c.getContext('2d'); g.drawImage(img,0,0);
 const d=g.getImageData(0,0,c.width,c.height).data; let vx=0,vy=0;
 for(let i=0;i<d.length;i+=4){ if(d[i+3]<40) continue; const [h2,s]=_rgb2hsl(d[i],d[i+1],d[i+2]);
  if(s<0.2) continue; const a=h2*Math.PI/180; vx+=Math.cos(a)*s; vy+=Math.sin(a)*s; }
 const hue=(vx||vy)?((Math.atan2(vy,vx)*180/Math.PI)+360)%360:0;
 _projArtHue[name]=hue; return hue; }
// PixelLab-art projectile: pick a base shape by hash, hue-shift its pixels (12 steps, or to
// the caller's theme colour), pad square, add a glow. Falls back to the procedural forge
// until the art decodes. 24 shapes x 12 hues x sizes/rarity glows = hundreds of looks.
// `shape`/`hue` are supplied by the firing weapon (see projLook). When given they override the
// hash-picked look entirely, which is what ties the shot on screen to the weapon that fired it;
// without them this falls back to the old key-hash behaviour for boss and perk projectiles.
function projSprite(key, baseCol, coreCol, shape, hue){
  let c=_projCache[key]; if(c) return c;
  const h=_pfh(key);
  if(typeof _projArt!=='undefined'){
    const name=shape||_projArt._list[(h>>>3)%_projArt._list.length], img=_projArt[name];
    if(img && img.complete && img.naturalWidth){
      const tgt=(hue!==undefined&&hue!==null)?hue:_colHue(baseCol);
      const delta=(tgt!==null)?(tgt-_domHue(name,img)):(((h>>>9)%12)*30);
      const w=img.naturalWidth, hh2=img.naturalHeight, S=Math.max(w,hh2)+10;
      const cv2=document.createElement('canvas'); cv2.width=S; cv2.height=S;
      const g=cv2.getContext('2d');
      const glowHue=(tgt!==null)?tgt:((_domHue(name,img)+delta)%360);
      const gl=g.createRadialGradient(S/2,S/2,1,S/2,S/2,S/2);
      gl.addColorStop(0,'hsla('+Math.round(glowHue)+',85%,62%,0.4)'); gl.addColorStop(1,'rgba(0,0,0,0)');
      g.fillStyle=gl; g.fillRect(0,0,S,S);
      // tinted art, centred
      const tc=document.createElement('canvas'); tc.width=w; tc.height=hh2;
      const tg=tc.getContext('2d'); tg.drawImage(img,0,0);
      if(Math.abs(delta)>4){ const id=tg.getImageData(0,0,w,hh2), d=id.data;
        for(let i=0;i<d.length;i+=4){ if(d[i+3]<8) continue;
          const [h3,s3,l3]=_rgb2hsl(d[i],d[i+1],d[i+2]); if(s3<0.14) continue;   // keep outlines/greys
          const rgb=_hsl2rgb(h3+delta,s3,l3); d[i]=rgb[0]; d[i+1]=rgb[1]; d[i+2]=rgb[2]; }
        tg.putImageData(id,0,0); }
      g.imageSmoothingEnabled=false;
      g.drawImage(tc,(S-w)/2,(S-hh2)/2);
      _projCache[key]=cv2; return cv2;
    }
  }
  return _projProc(key, baseCol, coreCol);   // art not decoded yet — procedural stand-in (uncached key)
}
function _projProc(key, baseCol, coreCol){
  let c=_projCache['p:'+key]; if(c) return c;
  const h=_pfh(key), S=30;
  const cv2=document.createElement('canvas'); cv2.width=S; cv2.height=S;
  const g=cv2.getContext('2d'); g.translate(S/2,S/2);
  const hue=h%360;
  const base=baseCol||('hsl('+hue+',74%,56%)');
  const core=coreCol||('hsl('+((hue+45)%360)+',95%,84%)');
  const shape=(h>>>3)%12, rr=6+((h>>>7)%5), sp=4+((h>>>10)%5);
  // soft glow halo
  const gl=g.createRadialGradient(0,0,1,0,0,S/2);
  gl.addColorStop(0,base); gl.addColorStop(1,'rgba(0,0,0,0)');
  g.globalAlpha=0.32; g.fillStyle=gl; g.fillRect(-S/2,-S/2,S,S); g.globalAlpha=1;
  g.fillStyle=base; g.strokeStyle='rgba(0,0,0,0.4)'; g.lineWidth=1.4;
  const P=(pts)=>{ g.beginPath(); g.moveTo(pts[0][0],pts[0][1]); for(let i=1;i<pts.length;i++) g.lineTo(pts[i][0],pts[i][1]); g.closePath(); g.fill(); g.stroke(); };
  switch(shape){
    case 0: g.beginPath(); g.arc(0,0,rr,0,6.29); g.fill(); g.stroke(); break;                      // orb
    case 1: P([[rr*1.5,0],[-rr*0.8,rr*0.8],[-rr*0.4,0],[-rr*0.8,-rr*0.8]]); break;                 // dart
    case 2: P([[rr*1.35,0],[0,rr*0.85],[-rr*1.35,0],[0,-rr*0.85]]); break;                          // diamond
    case 3: P([[rr*1.5,0],[rr*0.2,rr*0.5],[-rr*0.6,rr*0.25],[-rr*1.2,rr*0.7],[-rr*0.7,0],[-rr*1.2,-rr*0.7],[-rr*0.6,-rr*0.25],[rr*0.2,-rr*0.5]]); break; // bolt
    case 4: g.beginPath(); g.arc(0,0,rr,-1.1,1.1); g.arc(rr*0.55,0,rr*0.72,1.25,-1.25,true); g.closePath(); g.fill(); g.stroke(); break; // crescent blade
    case 5: { g.beginPath(); for(let i=0;i<sp*2;i++){ const a=i*Math.PI/sp, d=(i%2)?rr*0.45:rr*1.15; g.lineTo(Math.cos(a)*d,Math.sin(a)*d);} g.closePath(); g.fill(); g.stroke(); break; } // star
    case 6: g.beginPath(); g.arc(0,0,rr,0,6.29); g.arc(0,0,rr*0.5,0,6.29,true); g.fill('evenodd'); g.stroke(); break; // ring
    case 7: P([[rr*1.7,0],[-rr*1.1,rr*0.3],[-rr*1.4,0],[-rr*1.1,-rr*0.3]]); break;                  // needle
    case 8: P([[rr*1.2,0],[-rr*0.9,rr*0.95],[-rr*0.9,-rr*0.95]]); break;                            // tri shard
    case 9: g.beginPath(); g.arc(-rr*0.45,0,rr*0.62,0,6.29); g.arc(rr*0.45,0,rr*0.62,0,6.29); g.fill(); g.stroke(); break; // twin orbs
    case 10:P([[rr*1.3,rr*0.2],[rr*0.3,rr*0.75],[-rr*1.2,rr*0.35],[-rr*0.5,-rr*0.2],[-rr*1.0,-rr*0.8],[rr*0.4,-rr*0.6]]); break; // jagged shard
    default:{ g.save(); g.rotate(Math.PI/4); g.fillRect(-rr*0.8,-rr*0.8,rr*1.6,rr*1.6); g.strokeRect(-rr*0.8,-rr*0.8,rr*1.6,rr*1.6); g.restore(); break; } // rune square
  }
  // core detail
  g.fillStyle=core;
  if(shape===6){ g.beginPath(); g.arc(0,0,rr*0.28,0,6.29); g.fill(); }
  else if(shape===9){ g.beginPath(); g.arc(-rr*0.45,0,rr*0.26,0,6.29); g.arc(rr*0.45,0,rr*0.26,0,6.29); g.fill(); }
  else { g.beginPath(); g.arc(rr*0.15,0,Math.max(1.6,rr*0.34),0,6.29); g.fill(); }
  _projCache['p:'+key]=cv2; return cv2;
}
function drawShot(s,col,core){
 if(s.pk){                                   // forged projectile: sprite rotated to its heading
   const sp2=projSprite(s.pk,s.pc,s.pcore,s.psh,s.phu), sc=Math.max(0.7,(s.r||5)/6);
   // Pointed shots stay aligned to their heading; tumbling shapes (thrown blades, orbs, stars) get
   // a continuous spin instead, driven by flight time so every shot spins at the same rate.
   const ang=s.pspin ? (s.age||0)*s.pspin : Math.atan2(s.vy,s.vx);
   ctx.globalAlpha=0.35; ctx.drawImage(sp2,(s.px+s.x)/2-15*sc*0.7,(s.py+s.y)/2-15*sc*0.7,30*sc*0.7,30*sc*0.7);
   ctx.globalAlpha=1;
   ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(ang);
   ctx.drawImage(sp2,-15*sc,-15*sc,30*sc,30*sc); ctx.restore();
   if(s.crit){ const rr=9*sc, n=Math.max(10,Math.round(rr*0.9)); ctx.fillStyle='#ffd23d';  // crit halo as pixels
     for(let i=0;i<n;i++){ const hh=hmix(i*5+1,(rr|0)+i), a=(i/n)*6.283+((hh&15)/15-0.5)*0.25, jr=rr+((hh>>4)%3)-1;
       ctx.globalAlpha=0.5*(0.5+0.5*((hh>>8)&3)/3); ctx.fillRect((s.x+Math.cos(a)*jr)|0,(s.y+Math.sin(a)*jr)|0,2,2); }
     ctx.globalAlpha=1; }
   return; }
 ctx.fillStyle=col; ctx.globalAlpha=0.4;
 ctx.fillRect((s.px+s.x)/2-3,(s.py+s.y)/2-3,6,6);
 ctx.globalAlpha=1;
 ctx.fillStyle=col; ctx.fillRect(s.x-s.r,s.y-s.r,s.r*2,s.r*2);
 ctx.fillStyle=core; ctx.fillRect(s.x-s.r+2,s.y-s.r+2,s.r*2-4,s.r*2-4);
}
