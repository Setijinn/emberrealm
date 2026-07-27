// ===================================================================================
// 09c_floordetail.js — 8-BIT FLOOR DETAIL (user, 2026-07-27: "more detail in all of the terrain
// floor, I want 8 bit detail")
//
// Every floor tile in the game was a base image (or a flat fill) plus at most one whole-tile
// wash. At a 44px tile that reads as clean and empty — the walls, the props and the creatures all
// carry detail and the ground carries none, so the floor looks like a backdrop the game is
// happening in front of rather than ground it is standing on.
//
// The approach is STAMPS, not per-pixel work at draw time. A handful of TILE-sized detail layers
// are rendered ONCE at boot into offscreen canvases — grit, chips, cracks, tufts, pitting — and a
// tile blits whichever one its position hashes to. Cost per tile is a single drawImage, which is
// what makes it affordable across a whole screen of terrain every frame, and being hashed rather
// than random means a tile's detail never changes between frames (nothing shimmers) or between
// sessions (a place keeps its face).
//
// Everything is drawn with 1px and 2px rectangles on integer coordinates, in a handful of alpha
// steps. That IS the 8-bit look: no gradients, no blur, no subpixel.
// ===================================================================================

const FD_VARIANTS=8;          // stamps per family — enough that the repeat is not legible
const _fdCache={};            // family -> [canvas x FD_VARIANTS]

// a tiny deterministic PRNG so a stamp set is identical every boot
function _fdRng(seed){ let s=seed>>>0||1;
  return ()=>{ s^=s<<13; s>>>=0; s^=s>>17; s^=s<<5; s>>>=0; return s/4294967296; }; }

// The families. Each is a list of layers: how many marks, their size, colour and alpha.
// `d` = dark (recessed: pits, cracks, grout), `l` = light (raised: grit, chips, highlights).
const FD_FAMILY={
  // cobble and flagstone: chips out of the stone, grout grit, the odd hairline crack
  stone:{ marks:[
    {n:52, w:1, h:1, col:'0,0,0',       a:0.20},
    {n:34, w:1, h:1, col:'255,240,214', a:0.10},
    {n:9,  w:2, h:1, col:'0,0,0',       a:0.12},
    {n:6,  w:1, h:2, col:'0,0,0',       a:0.10},
    {n:3,  w:2, h:2, col:'255,240,214', a:0.05}],
    cracks:2 },
  // packed dirt and sand: fine grain, no hard edges
  dirt:{ marks:[
    {n:54, w:1, h:1, col:'0,0,0',       a:0.11},
    {n:34, w:1, h:1, col:'255,236,196', a:0.08},
    {n:12, w:2, h:1, col:'0,0,0',       a:0.07}],
    cracks:0 },
  // grass: blades and clumps rather than speckle, so it reads as growth not noise
  // Blades have to be dense and high-contrast to survive at a 44px tile: the first pass was too
  // polite and read as a flat green field with a faint grain over it.
  grass:{ marks:[
    {n:52, w:1, h:3, col:'26,40,18',    a:0.42},
    {n:40, w:1, h:2, col:'150,178,96',  a:0.30},
    {n:26, w:1, h:2, col:'196,214,128', a:0.22},
    {n:20, w:1, h:1, col:'220,232,168', a:0.20},
    {n:16, w:2, h:1, col:'26,40,18',    a:0.24},
    {n:10, w:1, h:4, col:'34,52,24',    a:0.30}],
    cracks:0 },
  // dungeon stone: wetter, darker, more pitting
  crypt:{ marks:[
    {n:44, w:1, h:1, col:'0,0,0',       a:0.22},
    {n:16, w:1, h:1, col:'190,205,220', a:0.06},
    {n:10, w:2, h:2, col:'0,0,0',       a:0.14},
    {n:5,  w:1, h:3, col:'0,0,0',       a:0.12}],
    cracks:3 },
  // burnt ground: ash flecks and the odd ember
  ash:{ marks:[
    {n:46, w:1, h:1, col:'0,0,0',       a:0.18},
    {n:20, w:1, h:1, col:'220,210,200', a:0.10},
    {n:7,  w:1, h:1, col:'255,140,60',  a:0.22},
    {n:9,  w:2, h:1, col:'0,0,0',       a:0.10}],
    cracks:2 },
};

function _fdBuild(fam){
  const F=FD_FAMILY[fam]||FD_FAMILY.stone;
  const out=[];
  for(let v=0;v<FD_VARIANTS;v++){
    const cv=document.createElement('canvas');
    cv.width=TILE; cv.height=TILE;
    const c=cv.getContext('2d');
    // seed from family name + variant so every family gets its own arrangement
    let h=v*2654435761; for(let i=0;i<fam.length;i++) h=Math.imul(h^fam.charCodeAt(i),16777619);
    const rnd=_fdRng(h);
    for(const m of F.marks){
      c.fillStyle='rgba('+m.col+','+m.a+')';
      for(let i=0;i<m.n;i++){
        // integer coordinates only — a mark on a half pixel is a blur, and a blur is not 8-bit
        const x=Math.floor(rnd()*(TILE-m.w+1)), y=Math.floor(rnd()*(TILE-m.h+1));
        c.fillRect(x,y,m.w,m.h);
      }
    }
    // hairline cracks: a short stepped walk, one pixel at a time, like a dithered line
    for(let k=0;k<(F.cracks||0);k++){
      c.fillStyle='rgba(0,0,0,0.20)';
      let x=Math.floor(rnd()*TILE), y=Math.floor(rnd()*TILE);
      const len=6+Math.floor(rnd()*12), horiz=rnd()<0.5;
      for(let i=0;i<len;i++){
        c.fillRect(x,y,1,1);
        if(horiz){ x+=1; if(rnd()<0.34) y+=rnd()<0.5?1:-1; }
        else     { y+=1; if(rnd()<0.34) x+=rnd()<0.5?1:-1; }
        if(x<0||y<0||x>=TILE||y>=TILE) break;
      }
    }
    out.push(cv);
  }
  return out;
}
function fdStamp(fam,x,y){
  if(typeof TILE==='undefined') return null;
  if(!_fdCache[fam]) _fdCache[fam]=_fdBuild(fam);
  const set=_fdCache[fam];
  // hash the TILE, not the frame: the same ground keeps the same face forever
  let m=(Math.imul(x,668265263)+Math.imul(y,374761393))>>>0;
  m=Math.imul(m^(m>>>15),2246822519)>>>0; m=(m^(m>>>13))>>>0;
  return set[m%set.length];
}
// Draw the detail for one tile. `flip` rotates through the 4 mirror states so a stamp reused
// nearby does not read as a repeat.
function drawFloorDetail(fam,tx,ty,x,y,alpha){
  const st=fdStamp(fam,x,y); if(!st) return;
  let h=(Math.imul(x,2246822519)+Math.imul(y,3266489917))>>>0; h=(h^(h>>>16))>>>0;
  const o=h&3;
  ctx.save();
  ctx.imageSmoothingEnabled=false;
  if(alpha!==undefined && alpha<1) ctx.globalAlpha*=alpha;
  ctx.translate(tx+TILE/2,ty+TILE/2);
  ctx.scale(o&1?-1:1, o&2?-1:1);
  ctx.drawImage(st,-TILE/2,-TILE/2);
  ctx.restore();
}
// Which family a grid char belongs to, so callers do not each invent their own mapping.
function floorFamily(c,room){
  if(c==='g') return 'grass';
  if(room&&room.dungeon) return 'crypt';
  if(room&&room.band==='boss') return 'crypt';
  if(c==='.'||c==='f'||c==='p') return (room&&room.town)?'stone':'dirt';
  return 'stone';
}
