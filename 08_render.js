// ---------- render ----------
let camX=0,camY=0;
const VIEW_TILES_H=10;
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
];
// Vertical band: bottom of the map (high y) = band 0 (easy), top (y=0) = highest.
function grvBandXY(x,y){ const R=curRoom, NZ=R.rings.names.length, H=R.h||1;
 return Math.max(0,Math.min(NZ-1,Math.floor((1-y/H)*NZ))); }
function drawTileG(x,y){
  const c=curRoom.grid[y][x], tx=x*TILE, ty=y*TILE, t=curRoom.town;
  ctx.fillStyle=(x+y)%2?(t?'#2b1f18':'#17141d'):(t?'#281d16':'#1a1721');
  ctx.fillRect(tx,ty,TILE,TILE);
  const r1=h2(x,y);
  if(r1>0.55){ ctx.fillStyle='rgba(0,0,0,0.14)';
    ctx.fillRect(tx+(r1*30)%TILE,ty+(r1*57)%TILE,3,3); }
  if(c==='W'){
    ctx.fillStyle=t?'#3a2a20':'#262031'; ctx.fillRect(tx,ty,TILE,TILE);
    ctx.fillStyle=t?'#54402f':'#3a3344'; ctx.fillRect(tx,ty,TILE,10);
    ctx.fillStyle=t?'#241812':'#151120'; ctx.fillRect(tx,ty+TILE-7,TILE,7);
  } else if(c==='h'){
    ctx.fillStyle='#4a2f22'; ctx.fillRect(tx,ty,TILE,TILE);
    ctx.fillStyle='#84422a'; ctx.fillRect(tx,ty,TILE,11);
    ctx.fillStyle='#5c3826'; ctx.fillRect(tx+6,ty+19,13,13);
  } else if(c==='H'){
    ctx.fillStyle='#55402f'; ctx.beginPath(); ctx.arc(tx+TILE/2,ty+TILE/2,TILE*0.46,0,6.29); ctx.fill();
    ctx.fillStyle='#2b1f18'; ctx.beginPath(); ctx.arc(tx+TILE/2,ty+TILE/2,TILE*0.32,0,6.29); ctx.fill();
  } else if(c==='l'){
    ctx.fillStyle='#3a2a20'; ctx.fillRect(tx+TILE/2-3,ty+10,6,TILE-14);
    ctx.fillStyle='#4f392b'; ctx.fillRect(tx+TILE/2-8,ty+3,16,15);
    ctx.fillStyle='#241812'; ctx.fillRect(tx+TILE/2-6,ty+5,12,11);
  } else if(c==='w'){
    ctx.fillStyle=(x+y)%2?'#16303f':'#1a3848'; ctx.fillRect(tx,ty,TILE,TILE);
    const wn=Math.sin(performance.now()/700+x*0.9+y*1.7);
    if(wn>0.55){ ctx.fillStyle='rgba(200,230,240,0.10)'; ctx.fillRect(tx+6,ty+TILE/2-2,TILE-12,3); }
  } else if('dgretk.'.indexOf(c)>=0 && curRoom.rings){
    const bd=grvBandXY(x,y);
    ctx.fillStyle=GBANDCOL[bd][(x+y)&1]; ctx.fillRect(tx,ty,TILE,TILE);
    // ring boundary lines: darker edge where the neighbour is a different band
    if(x>0 && grvBandXY(x-1,y)!==bd){ ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(tx,ty,2,TILE); }
    if(y>0 && grvBandXY(x,y-1)!==bd){ ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(tx,ty,TILE,2); }
    if(x>0 && grvBandXY(x-1,y)>bd){ ctx.fillStyle='rgba(255,201,77,0.18)'; ctx.fillRect(tx,ty,2,TILE); }
    if(y>0 && grvBandXY(x,y-1)>bd){ ctx.fillStyle='rgba(255,201,77,0.18)'; ctx.fillRect(tx,ty,TILE,2); }
    // terrain features layered on the band tint
    if(c==='d'){ if(h2(x*3,y*5)>0.7){ ctx.fillStyle='rgba(90,70,40,0.30)'; ctx.fillRect(tx+(x*13)%30+4,ty+(y*17)%30+4,3,3); } }
    else if(c==='g'){ if(h2(x,y*3)>0.72){ ctx.fillStyle='rgba(0,0,0,0.14)'; ctx.fillRect(tx+8,ty+12,3,6); ctx.fillRect(tx+24,ty+22,3,6); } }
    else if(c==='r'){ ctx.strokeStyle='rgba(0,0,0,.16)'; ctx.strokeRect(tx+1,ty+1,TILE-2,TILE-2); }
    else if(c==='e'){ if(h2(x*7,y)>0.72){ const gl=0.5+Math.sin(performance.now()/300+x+y)*0.35;
      ctx.fillStyle='rgba(255,122,61,'+gl.toFixed(2)+')'; ctx.fillRect(tx+10,ty+TILE/2,TILE-20,3); } }
    else if(c==='t'){
      ctx.fillStyle='#4a2f22'; ctx.fillRect(tx+TILE/2-4,ty+TILE/2,8,TILE/2-4);
      ctx.fillStyle='#1f3520'; ctx.beginPath(); ctx.arc(tx+TILE/2,ty+TILE/2-6,15,0,6.29); ctx.fill();
      ctx.fillStyle='#2c4a2a'; ctx.beginPath(); ctx.arc(tx+TILE/2-4,ty+TILE/2-10,9,0,6.29); ctx.fill(); }
    else if(c==='k'){
      ctx.fillStyle='#5d5666'; ctx.beginPath(); ctx.arc(tx+TILE/2,ty+TILE/2+3,14,0,6.29); ctx.fill();
      ctx.fillStyle='#726a80'; ctx.beginPath(); ctx.arc(tx+TILE/2-4,ty+TILE/2-1,8,0,6.29); ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,.45)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(tx+TILE/2,ty+TILE/2+3,14,0,6.29); ctx.stroke(); }
  } else if(c==='f'){
    ctx.fillStyle=(x+y)%2?'#332318':'#3a281b'; ctx.fillRect(tx,ty,TILE,TILE);
    ctx.strokeStyle='rgba(0,0,0,.20)'; ctx.strokeRect(tx+1,ty+1,TILE-2,TILE-2);
  }
}
function shadow(x,y,r){ ctx.fillStyle='rgba(0,0,0,.35)';
 ctx.beginPath(); ctx.ellipse(x,y,r,r*0.45,0,0,6.29); ctx.fill(); }
function drawShot(s,col,core){
 ctx.fillStyle=col; ctx.globalAlpha=0.4;
 ctx.fillRect((s.px+s.x)/2-3,(s.py+s.y)/2-3,6,6);
 ctx.globalAlpha=1;
 ctx.fillStyle=col; ctx.fillRect(s.x-s.r,s.y-s.r,s.r*2,s.r*2);
 ctx.fillStyle=core; ctx.fillRect(s.x-s.r+2,s.y-s.r+2,s.r*2-4,s.r*2-4);
}
