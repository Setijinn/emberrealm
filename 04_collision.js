// ---------- collision ----------
// Per-tile pseudo-random offset so trees/boulders aren't all grid-centred.
// Used by BOTH the renderer and collision so the hitbox tracks the sprite.
function featOffset(x,y){ const h=(x*73+y*149)>>>0; return [(h%15)-7,((h>>4)%11)-5]; }
function solid(px,py){
  const gx=Math.floor(px/TILE), gy=Math.floor(py/TILE);
  if(gy<0||gy>=curRoom.h||gx<0||gx>=curRoom.w) return false; // off-edge = door gap
  const c=curRoom.grid[gy][gx];
  // Trees / boulders: block a small circle at the offset base, not the whole tile.
  // Tree circle sits UP at the visible stump (the sprite carries a shadow/grass skirt
  // below the trunk, so blocking at the image base stopped you too far down).
  if(c==='t'||c==='k'){
    // Pathwarden capstone: the PLAYER moves through trees and rocks
    if(typeof _pmove!=='undefined'&&_pmove&&player.terrainGhost) return false;
    const o=featOffset(gx,gy);
    const bx=(gx+0.5)*TILE+o[0], by=(gy+1)*TILE-6+o[1];
    const ax=px-bx, ay=py-(by-(c==='t'?13:6)), rr=(c==='t'?7:11);
    return ax*ax+ay*ay < rr*rr; }
  return 'WhlHwXD'.indexOf(c)>=0;  // walls / structures / water / lair walls / locked gates: full tile
}
// Is there room to STAND at this world point, given a body radius?
// A single tree only blocks a small circle, so one is easy to walk around -- but a clump of them
// leaves pockets that are fully enclosed. Anything spawned into such a pocket (an enemy, a dropped
// item) is unreachable, so spawners and drops test with this instead of a bare solid() check.
function standable(px,py,r){
  r=r||12;
  if(solid(px,py)) return false;
  for(let i=0;i<8;i++){ const a=i*(Math.PI/4);
    if(solid(px+Math.cos(a)*r, py+Math.sin(a)*r)) return false; }
  return true;
}
// Nearest standable point to (px,py), searching outward in rings. Returns null if genuinely walled
// in, so callers can skip the spawn rather than drop it somewhere silly.
function nearestStandable(px,py,r,maxRings){
  if(standable(px,py,r)) return {x:px,y:py};
  const R=maxRings||6;
  for(let ring=1;ring<=R;ring++){
    const step=Math.max(6,Math.round(24/ring));
    for(let a=0;a<360;a+=step){
      const t=a*Math.PI/180, d=ring*TILE*0.75;
      const nx=px+Math.cos(t)*d, ny=py+Math.sin(t)*d;
      if(standable(nx,ny,r)) return {x:nx,y:ny};
    }
  }
  return null;
}
function moveCircle(e,dx,dy){
  // axis-separated with corner sampling
  const pts=[[e.r,0],[-e.r,0],[0,e.r],[0,-e.r],[e.r*.7,e.r*.7],[-e.r*.7,e.r*.7],[e.r*.7,-e.r*.7],[-e.r*.7,-e.r*.7]];
  let nx=e.x+dx;
  if(!pts.some(p=>solid(nx+p[0],e.y+p[1]))) e.x=nx;
  let ny=e.y+dy;
  if(!pts.some(p=>solid(e.x+p[0],ny+p[1]))) e.y=ny;
}
