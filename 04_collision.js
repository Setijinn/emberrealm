// ---------- collision ----------
// Per-tile pseudo-random offset so trees/boulders aren't all grid-centred.
// Used by BOTH the renderer and collision so the hitbox tracks the sprite.
function featOffset(x,y){ const h=(x*73+y*149)>>>0; return [(h%15)-7,((h>>4)%11)-5]; }
// SOLID IS THE HOTTEST TILE READ IN THE GAME -- roughly eight calls per entity per frame, for every
// enemy, ally and pet -- so it works in tile CODES and looks the answer up in a Uint8Array instead of
// scanning `'WhlHwXD'.indexOf(c)` for every one of them.
function solid(px,py){
  const gx=Math.floor(px/TILE), gy=Math.floor(py/TILE);
  if(gy<0||gy>=curRoom.h||gx<0||gx>=curRoom.w) return false; // off-edge = door gap
  const c=gCode(curRoom,gx,gy);
  // Trees / boulders: block a small circle at the offset base, not the whole tile.
  // Tree circle sits UP at the visible stump (the sprite carries a shadow/grass skirt
  // below the trunk, so blocking at the image base stopped you too far down).
  if(T_BLOCKSMALL[c]){
    // Pathwarden capstone: the PLAYER moves through trees and rocks
    if(typeof _pmove!=='undefined'&&_pmove&&player.terrainGhost) return false;
    // ...and so does a rider in the air, for the obvious reason
    if(typeof _pmove!=='undefined'&&_pmove&&typeof playerIsFlying==='function'&&playerIsFlying()) return false;
    const o=featOffset(gx,gy);
    const bx=(gx+0.5)*TILE+o[0], by=(gy+1)*TILE-6+o[1];
    const isTree=(c===T_t);
    const ax=px-bx, ay=py-(by-(isTree?13:6)), rr=(isTree?7:11);
    return ax*ax+ay*ay < rr*rr; }
  // FLIGHT CLEARS WATER, AND WATER ONLY (user, 2026-07-28). Not walls, not lair walls, not locked
  // gates: 'W' is the VOID inside a dungeon, and 'X'/'D' are how the world gates its own content,
  // so a flyer that cleared them could leave the map or skip a boss door. Gated on `_pmove` like
  // the Pathwarden exemption above, so it only ever applies to the PLAYER's own movement — enemies,
  // spawns and dropped loot keep testing the real terrain and never path into the sea.
  if(c===T_w && typeof _pmove!=='undefined' && _pmove
     && typeof playerIsFlying==='function' && playerIsFlying()) return false;
  // ...AND A BOSS ARENA'S RING (user, 2026-07-31: "flyers should be able to go over walls of
  // overworld boss arenas"). 'X' is stamped by stampLairs, which runs only on room 'G', so it is
  // by construction the OVERWORLD den wall and never a dungeon's masonry. That wall exists to shape
  // a fight, not to gate content -- it has doors, and you can already walk in through them -- so
  // flying over it takes nothing away. 'W' (the dungeon void), 'h'/'l' and the locked gate 'D' are
  // all still solid to a flyer, which is what keeps flight from skipping a boss door or leaving the
  // map. flyOverWalls also refuses inside a dungeon, where a flyer is dismissed anyway.
  if(c===T_X && typeof _pmove!=='undefined' && _pmove
     && typeof flyOverWalls==='function' && flyOverWalls()) return false;
  return !!T_SOLID[c];  // walls / structures / water / lair walls / locked gates: full tile
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
// THE SAMPLE RING IS A FUNCTION OF e.r AND NOTHING ELSE. This rebuilt an array of eight arrays
// plus two closures on every call -- and it is called for the player, every enemy, every ally and
// every pet, every frame. At ~40 enemies that was roughly 33,000 allocations a second in the
// hottest loop in the game. Same eight points, same axis-separated order, no allocation.
const _MC_OFF=[1,0, -1,0, 0,1, 0,-1, 0.7,0.7, -0.7,0.7, 0.7,-0.7, -0.7,-0.7];
function _mcBlocked(px,py,r){
  for(let i=0;i<16;i+=2) if(solid(px+_MC_OFF[i]*r, py+_MC_OFF[i+1]*r)) return true;
  return false;
}
function moveCircle(e,dx,dy){
  // axis-separated with corner sampling
  const r=e.r;
  const nx=e.x+dx;
  if(!_mcBlocked(nx,e.y,r)) e.x=nx;
  const ny=e.y+dy;
  if(!_mcBlocked(e.x,ny,r)) e.y=ny;
}
