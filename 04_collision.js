// ---------- collision ----------
// Per-tile pseudo-random offset so trees/boulders aren't all grid-centred.
// Used by BOTH the renderer and collision so the hitbox tracks the sprite.
function featOffset(x,y){ const h=(x*73+y*149)>>>0; return [(h%15)-7,((h>>4)%11)-5]; }
function solid(px,py){
  const gx=Math.floor(px/TILE), gy=Math.floor(py/TILE);
  if(gy<0||gy>=curRoom.h||gx<0||gx>=curRoom.w) return false; // off-edge = door gap
  const c=curRoom.grid[gy][gx];
  // Trees / boulders: block a small circle at the offset base, not the whole tile.
  if(c==='t'||c==='k'){ const o=featOffset(gx,gy);
    const bx=(gx+0.5)*TILE+o[0], by=(gy+1)*TILE-6+o[1];
    const ax=px-bx, ay=py-(by-(c==='t'?3:6)), rr=(c==='t'?8:11);
    return ax*ax+ay*ay < rr*rr; }
  return 'WhlHwX'.indexOf(c)>=0;   // walls / structures / water / lair walls: full tile
}
function moveCircle(e,dx,dy){
  // axis-separated with corner sampling
  const pts=[[e.r,0],[-e.r,0],[0,e.r],[0,-e.r],[e.r*.7,e.r*.7],[-e.r*.7,e.r*.7],[e.r*.7,-e.r*.7],[-e.r*.7,-e.r*.7]];
  let nx=e.x+dx;
  if(!pts.some(p=>solid(nx+p[0],e.y+p[1]))) e.x=nx;
  let ny=e.y+dy;
  if(!pts.some(p=>solid(e.x+p[0],ny+p[1]))) e.y=ny;
}
