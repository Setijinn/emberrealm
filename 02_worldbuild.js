// ---------- world build ----------
const rooms={};
for(const key in ROOM_DEFS){
  const [rx,ry]=key.split(',').map(Number);
  rooms[key]={key,rx,ry,name:ROOM_DEFS[key].name,
    grid:ROOM_DEFS[key].map.map(r=>r.split('')), cleared:false, spawns:[]};
}
const RW=40, RH=22;
// carve doors between adjacent rooms
for(const key in rooms){
  const r=rooms[key];
  const east=rooms[(r.rx+1)+','+r.ry];
  if(east){ const my=Math.floor(RH/2);
    r.grid[my-1][RW-1]='.'; r.grid[my][RW-1]='.'; r.grid[my+1][RW-1]='.';
    east.grid[my-1][0]='.'; east.grid[my][0]='.'; east.grid[my+1][0]='.'; }
  const south=rooms[r.rx+','+(r.ry+1)];
  if(south){ const mx=Math.floor(RW/2);
    r.grid[RH-1][mx-1]='.'; r.grid[RH-1][mx]='.'; r.grid[RH-1][mx+1]='.';
    south.grid[0][mx-1]='.'; south.grid[0][mx]='.'; south.grid[0][mx+1]='.'; }
  const north=rooms[r.rx+','+(r.ry-1)];
  if(north){ const mx=Math.floor(RW/2);
    r.grid[0][mx-1]='.'; r.grid[0][mx]='.'; r.grid[0][mx+1]='.';
    north.grid[RH-1][mx-1]='.'; north.grid[RH-1][mx]='.'; north.grid[RH-1][mx+1]='.'; }
  // collect spawns, glow sources, portals, strip markers
  r.town=!!ROOM_DEFS[key].town; r.glows=[];
  r.lv=ROOM_DEFS[key].lv||1; r.band=ROOM_DEFS[key].band||'';
  r.w=r.grid[0].length; r.h=r.grid.length;
  r.big=!!ROOM_DEFS[key].big; r.regions=ROOM_DEFS[key].regions||null; r.portals=[];
  r.rings=ROOM_DEFS[key].rings||null; r.arrivals=ROOM_DEFS[key].arrivals||null;
  if(key==='0,0'){ r.portals.push({x:20.5*TILE,y:6.5*TILE}); }
  for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++){
    const c=r.grid[y][x];
    if(c==='c'||c==='s'||c==='B'){ r.spawns.push({t:c,x,y}); r.grid[y][x]='.'; }
    if(c==='P'){ r.px=x; r.py=y; r.grid[y][x]=r.town?'f':'.'; }
    if(c==='T'){ r.portals.push({x:(x+.5)*TILE,y:(y+.5)*TILE}); r.grid[y][x]=r.big?'d':'.'; }
    if(c==='l') r.glows.push({t:'l',x:(x+.5)*TILE,y:(y+.5)*TILE,r:130});
    if(c==='H') r.glows.push({t:'H',x:(x+.5)*TILE,y:(y+.5)*TILE,r:240});
  }
  // guarantee open ground around portals
  if(r.big) for(const p of r.portals){
    const ptx=Math.floor(p.x/TILE), pty=Math.floor(p.y/TILE);
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
      const tx2=ptx+dx, ty2=pty+dy;
      if(tx2>0&&ty2>0&&tx2<r.w-1&&ty2<r.h-1&&r.grid[ty2][tx2]!=='w') r.grid[ty2][tx2]='d'; }
    r.spawns=r.spawns.filter(function(sp2){ return Math.hypot(sp2.x-ptx,sp2.y-pty)>4; });
  }
}
