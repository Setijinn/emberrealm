// ---------- collision ----------
function solid(px,py){
  const gx=Math.floor(px/TILE), gy=Math.floor(py/TILE);
  if(gy<0||gy>=curRoom.h||gx<0||gx>=curRoom.w) return false; // off-edge = door gap
  const c=curRoom.grid[gy][gx];
  // Trees / boulders: block only a small circle at the trunk/base, not the whole tile.
  if(c==='t'){ const ax=px-(gx+0.5)*TILE, ay=py-((gy+0.5)*TILE+7); return ax*ax+ay*ay < 90; }   // r~9.5 trunk
  if(c==='k'){ const ax=px-(gx+0.5)*TILE, ay=py-((gy+0.5)*TILE+3); return ax*ax+ay*ay < 180; }  // r~13 boulder
  return 'WhlHw'.indexOf(c)>=0;   // walls / structures / water: full tile
}
function moveCircle(e,dx,dy){
  // axis-separated with corner sampling
  const pts=[[e.r,0],[-e.r,0],[0,e.r],[0,-e.r],[e.r*.7,e.r*.7],[-e.r*.7,e.r*.7],[e.r*.7,-e.r*.7],[-e.r*.7,-e.r*.7]];
  let nx=e.x+dx;
  if(!pts.some(p=>solid(nx+p[0],e.y+p[1]))) e.x=nx;
  let ny=e.y+dy;
  if(!pts.some(p=>solid(e.x+p[0],ny+p[1]))) e.y=ny;
}
