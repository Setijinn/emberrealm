// ---------- render ----------
let camX=0,camY=0;
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
  // town floor (PixelLab): cobble base, 'p' = paved walkway, ~11% broken variant
  // (well-mixed hash — a linear x*a+y*b formula makes diagonal stripes).
  // Decor cells (h planter / H brazier / l lamp) draw floor UNDER their sprite.
  if(t && typeof _hearth!=='undefined' && _hearth.floor && _hearth.floor.complete && _hearth.floor.naturalWidth && c!=='W' && c!=='w'){
    ctx.imageSmoothingEnabled=false; const hh=(x*131+y*57)>>>0, o=hh&3;
    let m=(Math.imul(x,374761393)+Math.imul(y,668265263))>>>0;
    m=Math.imul(m^(m>>>13),1274126177)>>>0; m=(m^(m>>>16))>>>0;
    const ok=im=>im&&im.complete&&im.naturalWidth;
    const img=(c==='p'&&ok(_hearth.floor_walk))?_hearth.floor_walk
             :((m%100<11)&&ok(_hearth.floor_broken))?_hearth.floor_broken:_hearth.floor;
    ctx.save(); ctx.translate(tx+TILE/2,ty+TILE/2); ctx.scale(o&1?-1:1,o&2?-1:1);
    ctx.drawImage(img,-TILE/2,-TILE/2,TILE,TILE); ctx.restore();
    const v=(hh>>2)%5;
    if(v===0){ ctx.fillStyle='rgba(0,0,0,0.12)'; ctx.fillRect(tx,ty,TILE,TILE); }
    else if(v===1){ ctx.fillStyle='rgba(255,240,210,0.05)'; ctx.fillRect(tx,ty,TILE,TILE); }
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
      // EVERY zone mixes its secondary tile in (heavier in the busy fiery zones) —
      // single-tile fill read too uniform
      const g=(hh%100 < (bd>=5?32:11))?GROUND_LO:GROUND_UP;
      // ~40% of cells use the zone's variant ground sheet for large-scale variety
      const _vs=_groundVar[bd];
      const src=(_vs && _vs.naturalWidth && hh%100>=60)?_vs:_gset;
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
        if(dh%100<20){ const im=_dl[dh%_dl.length];
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
function projSprite(key, baseCol, coreCol){
  let c=_projCache[key]; if(c) return c;
  const h=_pfh(key);
  if(typeof _projArt!=='undefined'){
    const name=_projArt._list[(h>>>3)%_projArt._list.length], img=_projArt[name];
    if(img && img.complete && img.naturalWidth){
      const tgt=_colHue(baseCol), delta=(tgt!==null)?(tgt-_domHue(name,img)):(((h>>>9)%12)*30);
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
