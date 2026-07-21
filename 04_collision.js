// ---------- collision ----------
function solid(px,py){
  const gx=Math.floor(px/TILE), gy=Math.floor(py/TILE);
  if(gy<0||gy>=curRoom.h||gx<0||gx>=curRoom.w) return false; // off-edge = door gap
  return 'WhlHwtk'.indexOf(curRoom.grid[gy][gx])>=0;
}
function moveCircle(e,dx,dy){
  // axis-separated with corner sampling
  const pts=[[e.r,0],[-e.r,0],[0,e.r],[0,-e.r],[e.r*.7,e.r*.7],[-e.r*.7,e.r*.7],[e.r*.7,-e.r*.7],[-e.r*.7,-e.r*.7]];
  let nx=e.x+dx;
  if(!pts.some(p=>solid(nx+p[0],e.y+p[1]))) e.x=nx;
  let ny=e.y+dy;
  if(!pts.some(p=>solid(e.x+p[0],ny+p[1]))) e.y=ny;
}
