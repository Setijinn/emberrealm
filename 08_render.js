// ---------- render ----------
let camX=0,camY=0;
const VIEW_TILES_H=10;
// PC shows a wider slice of the world (mouse+keyboard play felt too zoomed in)
function viewTilesH(){ return (typeof inputMode!=='undefined' && inputMode==='pc') ? 13.5 : VIEW_TILES_H; }
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
  // town cobblestone floor (PixelLab) for walkable cells, per-cell flip for variety
  if(t && typeof _hearth!=='undefined' && _hearth.floor && _hearth.floor.complete && _hearth.floor.naturalWidth && 'WwhHl'.indexOf(c)<0){
    ctx.imageSmoothingEnabled=false; const hh=(x*131+y*57)>>>0, o=hh&3;
    ctx.save(); ctx.translate(tx+TILE/2,ty+TILE/2); ctx.scale(o&1?-1:1,o&2?-1:1);
    ctx.drawImage(_hearth.floor,-TILE/2,-TILE/2,TILE,TILE); ctx.restore();
    const v=(hh>>2)%5;
    if(v===0){ ctx.fillStyle='rgba(0,0,0,0.12)'; ctx.fillRect(tx,ty,TILE,TILE); }
    else if(v===1){ ctx.fillStyle='rgba(255,240,210,0.05)'; ctx.fillRect(tx,ty,TILE,TILE); }
    return;
  }
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
  } else if(c==='X' || c==='F'){
    // boss-room wall ('X', sampled from tileset upper) / floor ('F', lower), themed per zone
    const bd=curRoom.rings?grvBandXY(x,y):8;
    const set=_lairSet[bd], src=(c==='X')?GROUND_UP:GROUND_LO;
    if(set && set.naturalWidth){ ctx.imageSmoothingEnabled=false;
      const hh=(x*131+y*57)>>>0, o=hh&3;
      ctx.save(); ctx.translate(tx+TILE/2,ty+TILE/2); ctx.scale(o&1?-1:1,o&2?-1:1);
      ctx.drawImage(set,src[0],src[1],32,32,-TILE/2,-TILE/2,TILE,TILE); ctx.restore();
      // per-block variety: brightness noise + weathering chips so no two blocks read identical
      const v=(hh>>2)%7;
      if(v===0){ ctx.fillStyle='rgba(0,0,0,0.15)'; ctx.fillRect(tx,ty,TILE,TILE); }
      else if(v===1){ ctx.fillStyle='rgba(255,240,210,0.07)'; ctx.fillRect(tx,ty,TILE,TILE); }
      if(c==='X'){ ctx.fillStyle='rgba(255,255,255,0.05)'; ctx.fillRect(tx,ty,TILE,3);
        ctx.fillStyle='rgba(0,0,0,0.34)'; ctx.fillRect(tx,ty+TILE-5,TILE,5);
        if(v>=5){ ctx.fillStyle='rgba(0,0,0,0.35)';                    // cracked / chipped blocks
          ctx.fillRect(tx+4+((hh>>5)%18), ty+7+((hh>>8)%20), 2, 5+((hh>>11)%6));
          ctx.fillRect(tx+7+((hh>>6)%16), ty+16+((hh>>9)%14), 4, 2); } }
    } else { ctx.fillStyle=(c==='X')?'#3a3340':'#241f2a'; ctx.fillRect(tx,ty,TILE,TILE);
      if(c==='X'){ ctx.fillStyle='#4a4350'; ctx.fillRect(tx,ty,TILE,9); ctx.fillStyle='#181420'; ctx.fillRect(tx,ty+TILE-5,TILE,5); } }
  } else if('dgretk.'.indexOf(c)>=0 && curRoom.rings){
    const bd=grvBandXY(x,y);
    const _gset=_groundSet[bd];
    if(_gset && _gset.naturalWidth){ ctx.imageSmoothingEnabled=false;
      const hh=(x*131+y*57)>>>0, o=hh&3;   // per-cell flip (4 orientations) breaks the grid
      // fiery zones (5-8): mix in the dark secondary tile to break the high-contrast lava grid
      const g=(bd>=5 && hh%100<32)?GROUND_LO:GROUND_UP;
      // ~1/3 of cells use the zone's variant ground sheet for large-scale variety
      const _vs=_groundVar[bd];
      const src=(_vs && _vs.naturalWidth && hh%100>=68)?_vs:_gset;
      ctx.save(); ctx.translate(tx+TILE/2,ty+TILE/2); ctx.scale(o&1?-1:1,o&2?-1:1);
      ctx.drawImage(src,g[0],g[1],32,32,-TILE/2,-TILE/2,TILE,TILE); ctx.restore();
      const v=(hh>>2)%5;                    // subtle per-tile brightness noise
      if(v===0){ ctx.fillStyle='rgba(0,0,0,0.12)'; ctx.fillRect(tx,ty,TILE,TILE); }
      else if(v===1){ ctx.fillStyle='rgba(255,245,215,0.06)'; ctx.fillRect(tx,ty,TILE,TILE); }
      if(_bandTone[bd]){ ctx.fillStyle=_bandTone[bd]; ctx.fillRect(tx,ty,TILE,TILE); }
      // scatter a ground decal (deterministic) on plain ground only — breaks repetition
      const _dl=_decal[bd];
      if(_dl && _dl.length && 'tk'.indexOf(c)<0){
        const dh=(x*197+y*263)>>>0;
        if(dh%100<15){ const im=_dl[dh%_dl.length];
          if(im && im.naturalWidth){ const ds=TILE*0.6, ox=((dh>>3)%12)-6, oy=((dh>>9)%12)-6;
            ctx.drawImage(im, tx+TILE/2-ds/2+ox, ty+TILE/2-ds/2+oy, ds, ds); } } } }
    else { ctx.fillStyle=GBANDCOL[bd][(x+y)&1]; ctx.fillRect(tx,ty,TILE,TILE); }
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
      const _tr=_bandTree[bd], _o=featOffset(x,y), _bx=tx+TILE/2+_o[0], _by=ty+TILE-6+_o[1];
      if(_tr && _tr.naturalWidth){ ctx.imageSmoothingEnabled=false;
        const tw=TILE*0.92, th=tw*_tr.height/_tr.width;
        ctx.drawImage(_tr, _bx-tw/2, _by-th, tw, th); }
      else {
        ctx.fillStyle='#4a2f22'; ctx.fillRect(_bx-3,_by-13,6,12);
        ctx.fillStyle='#1f3520'; ctx.beginPath(); ctx.arc(_bx,_by-16,11,0,6.29); ctx.fill();
        ctx.fillStyle='#2c4a2a'; ctx.beginPath(); ctx.arc(_bx-3,_by-19,7,0,6.29); ctx.fill(); } }
    else if(c==='k'){
      const _bo=_bandBoulder[bd], _o=featOffset(x,y), _bx=tx+TILE/2+_o[0], _by=ty+TILE-6+_o[1];
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
    ctx.strokeStyle='rgba(0,0,0,.20)'; ctx.strokeRect(tx+1,ty+1,TILE-2,TILE-2);
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
function projSprite(key, baseCol, coreCol){
  let c=_projCache[key]; if(c) return c;
  const h=_pfh(key), S=30;
  const cv2=document.createElement('canvas'); cv2.width=S; cv2.height=S;
  const g=cv2.getContext('2d'); g.translate(S/2,S/2);
  const hue=h%360;
  const base=baseCol||('hsl('+hue+',74%,56%)');
  const core=coreCol||('hsl('+((hue+45)%360)+',95%,84%)');
  const shape=(h>>3)%12, rr=6+((h>>7)%5), sp=4+((h>>10)%5);
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
  _projCache[key]=cv2; return cv2;
}
function drawShot(s,col,core){
 if(s.pk){                                   // forged projectile: sprite rotated to its heading
   const sp2=projSprite(s.pk,s.pc,s.pcore), ang=Math.atan2(s.vy,s.vx), sc=Math.max(0.7,(s.r||5)/6);
   ctx.globalAlpha=0.35; ctx.drawImage(sp2,(s.px+s.x)/2-15*sc*0.7,(s.py+s.y)/2-15*sc*0.7,30*sc*0.7,30*sc*0.7);
   ctx.globalAlpha=1;
   ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(ang);
   ctx.drawImage(sp2,-15*sc,-15*sc,30*sc,30*sc); ctx.restore();
   if(s.crit){ ctx.globalAlpha=0.55; ctx.strokeStyle='#ffd23d'; ctx.lineWidth=2;
     ctx.beginPath(); ctx.arc(s.x,s.y,9*sc,0,6.29); ctx.stroke(); ctx.globalAlpha=1; }
   return; }
 ctx.fillStyle=col; ctx.globalAlpha=0.4;
 ctx.fillRect((s.px+s.x)/2-3,(s.py+s.y)/2-3,6,6);
 ctx.globalAlpha=1;
 ctx.fillStyle=col; ctx.fillRect(s.x-s.r,s.y-s.r,s.r*2,s.r*2);
 ctx.fillStyle=core; ctx.fillRect(s.x-s.r+2,s.y-s.r+2,s.r*2-4,s.r*2-4);
}
