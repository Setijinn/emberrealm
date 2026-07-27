// ---------- always-on minimap (top-left) ----------
// Replaces the map BUTTON: instead of opening a full-screen map you now always have a small live
// map in the corner. It shows a window around you rather than the whole world, because at 1160x720
// tiles the whole world in 150px puts every landmark within a few pixels of every other one and
// tells you nothing about where to walk.
//
// A boss that is off the window still matters, so its marker is clamped to the rim and drawn
// hollow -- you get its direction without pretending it is close.

const MINI_PAD = 10;              // gap from the screen corner
const MINI_BASE = 148;            // panel size in CSS px at UI scale 1
const MINI_ZOOMS = [26, 40, 60, 90, 130];   // half-window in TILES; index 0 = closest in
let miniZoom = 2;
let _miniCache = null;

// The whole world rendered once at low resolution. The minimap then blits the sub-rect it needs,
// so panning and zooming cost one drawImage instead of re-rasterising terrain every frame.
// Per-terrain tinting on TOP of the zone ramp. The map used to paint every walkable tile the same
// zone colour with a flat dark square over trees, so the whole world read as one flat wash: you
// could see which BAND you were in and nothing about the ground itself. Now the zone ramp still
// sets the hue -- a zone has to stay recognisable at a glance -- and each terrain character shifts
// it toward its own material, so coastline, grassland, scree, ash flats and the forest all have
// distinct shapes on the map. Mixed in the cache, so it costs nothing per frame.
const MINI_TERR = {
  g:{c:[ 96,142, 70], k:0.50},   // grassland
  d:{c:[124,104, 72], k:0.42},   // dirt / open ground
  r:{c:[132,132,140], k:0.46},   // scree and bare rock
  e:{c:[ 92, 82, 86], k:0.46},   // burnt ash flats
  k:{c:[ 88, 88, 96], k:0.55},   // boulders
  t:{c:[ 42, 74, 44], k:0.62},   // forest
  '.':{c:[150,132,100], k:0.45}, // trodden path
  F:{c:[110, 96,112], k:0.55},   // a lair's own floor
  X:{c:[ 30, 26, 34], k:0.80}    // wall / cliff
};
function _miniMix(hex,rgb,k){
  const h=hex.replace('#',''),
        r=parseInt(h.slice(0,2),16), g=parseInt(h.slice(2,4),16), b=parseInt(h.slice(4,6),16);
  return 'rgb('+Math.round(r+(rgb[0]-r)*k)+','+Math.round(g+(rgb[1]-g)*k)+','+Math.round(b+(rgb[2]-b)*k)+')';
}
// The whole world rendered once at low resolution. The minimap then blits the sub-rect it needs,
// so panning and zooming cost one drawImage instead of re-rasterising terrain every frame.
function miniTerrain(G){
  const key=G.w+'x'+G.h+':d2';
  if(_miniCache && _miniCache.key===key) return _miniCache.cv;
  // Detail lives or dies on this scale: at 0.34 px per tile a forest and a shoreline are the same
  // smudge. 0.62 doubles the linear resolution (a 1160x720 world is a 719x446 cache, ~1.3MB) and
  // is what makes the terrain tints legible at all.
  const s=0.62;                                     // world tiles -> cache pixels
  const cv=document.createElement('canvas');
  cv.width=Math.max(1,Math.round(G.w*s)); cv.height=Math.max(1,Math.round(G.h*s));
  const c=cv.getContext('2d');
  c.fillStyle='#0b0a10'; c.fillRect(0,0,cv.width,cv.height);
  const T=(typeof _territories==='function')?_territories(G):null;
  const zg=G.rings&&G.rings._zg;
  const step=Math.max(1,Math.ceil(Math.sqrt((G.w*G.h)/420000)));
  const bs=s*step+0.7;
  const OCEAN=(typeof MAP_OCEAN!=='undefined')?MAP_OCEAN:'#16324a';
  for(let ty=0;ty<G.h;ty+=step){ const row=G.grid[ty]; if(!row) continue;
    for(let tx=0;tx<G.w;tx+=step){ const ch=row[tx]; if(ch==null) continue;
      const px=tx*s, py=ty*s;
      if(ch==='w'){
        // shallows read lighter than deep water, so the coastline is a shape and not a hard edge
        const nearLand=(row[tx-1]&&row[tx-1]!=='w')||(row[tx+1]&&row[tx+1]!=='w')||
                       (G.grid[ty-1]&&G.grid[ty-1][tx]&&G.grid[ty-1][tx]!=='w')||
                       (G.grid[ty+1]&&G.grid[ty+1][tx]&&G.grid[ty+1][tx]!=='w');
        c.fillStyle=nearLand?'#255070':OCEAN; c.fillRect(px,py,bs,bs); continue; }
      if(ch==='b'){ c.fillStyle=(typeof MAP_BRIDGE!=='undefined')?MAP_BRIDGE:'#6b5a3e'; c.fillRect(px,py,bs,bs); continue; }
      const zr=zg&&zg[ty], zi=(zr&&tx<zr.length)?zr[tx]:-1;
      const tt=(T&&zi>=0)?T[zi]:null;
      const base=(typeof MRAMP!=='undefined'&&MRAMP[tt?tt.band:0])||'#547a44';
      const M=MINI_TERR[ch];
      c.fillStyle=M?_miniMix(base,M.c,M.k):base;
      c.fillRect(px,py,bs,bs);
      // a little value noise so large flats are not dead colour at high zoom
      if(((tx*7+ty*13)&7)===0){ c.fillStyle='rgba(0,0,0,0.10)'; c.fillRect(px,py,bs,bs); }
      else if(((tx*5+ty*11)&7)===0){ c.fillStyle='rgba(255,250,235,0.07)'; c.fillRect(px,py,bs,bs); } } }
  _miniCache={key:key,cv:cv,s:s};
  return cv;
}

// ---- fog of war ----
// The map starts black and is uncovered in a circle as you walk. Kept as a canvas the same size as
// the terrain cache: revealing is one erase per frame and drawing is one blit, so the cost does not
// grow with how much of the world you have seen. Persisted per character, because exploration you
// paid for should still be there tomorrow.
const FOG_REVEAL_TILES = 22;
let _fogCv=null, _fogCtx=null, _fogKey=null, _fogDirty=0, _fogSaveT=0;

function _fogSlot(){
  const ch=(typeof curChar==='function')?curChar():null;
  const u=(typeof curUser==='function')?curUser():null;
  return 'er-fog:'+((u&&u.name)||'u')+':'+((ch&&ch.name)||'c');
}
function fogInit(G){
  const key=G.w+'x'+G.h+':'+_fogSlot();
  if(_fogCv && _fogKey===key) return;
  const cv=miniTerrain(G);
  _fogCv=document.createElement('canvas'); _fogCv.width=cv.width; _fogCv.height=cv.height;
  _fogCtx=_fogCv.getContext('2d');
  _fogCtx.fillStyle='#05050a'; _fogCtx.fillRect(0,0,_fogCv.width,_fogCv.height);
  _fogKey=key;
  try{ const s=localStorage.getItem(_fogSlot());
    if(s){ const im=new Image();
      im.onload=()=>{ if(_fogCtx){ _fogCtx.globalCompositeOperation='copy';
        _fogCtx.drawImage(im,0,0,_fogCv.width,_fogCv.height);
        _fogCtx.globalCompositeOperation='source-over'; } };
      im.src=s; } }catch(e){}
}
function fogReveal(G,dt){
  if(!_fogCtx) return;
  const s=_miniCache.s, r=FOG_REVEAL_TILES*s;
  const px=(player.x/TILE)*s, py=(player.y/TILE)*s;
  _fogCtx.save();
  _fogCtx.globalCompositeOperation='destination-out';
  // soft edge, so the revealed area feathers instead of stamping hard discs
  const g=_fogCtx.createRadialGradient(px,py,r*0.45,px,py,r);
  g.addColorStop(0,'rgba(0,0,0,1)'); g.addColorStop(1,'rgba(0,0,0,0)');
  _fogCtx.fillStyle=g;
  _fogCtx.beginPath(); _fogCtx.arc(px,py,r,0,6.29); _fogCtx.fill();
  _fogCtx.restore();
  _fogDirty=1;
  _fogSaveT-=dt||0.016;
  if(_fogDirty && _fogSaveT<=0){ _fogSaveT=6;      // throttled: a dataURL every frame would stutter
    try{ localStorage.setItem(_fogSlot(), _fogCv.toDataURL('image/png')); _fogDirty=0; }catch(e){}
  }
}
function fogSeen(G,wx,wy){
  if(!_fogCtx) return true;
  const s=_miniCache.s;
  const x=Math.round((wx/TILE)*s), y=Math.round((wy/TILE)*s);
  if(x<0||y<0||x>=_fogCv.width||y>=_fogCv.height) return false;
  try{ return _fogCtx.getImageData(x,y,1,1).data[3] < 130; }catch(e){ return true; }
}

function miniRect(){
  const u=(typeof UIS!=='undefined')?UIS:1;
  const sz=Math.round(MINI_BASE*u), pad=Math.round(MINI_PAD*u);
  // the zoom buttons scale WITH the panel rather than off a fixed 26px, or shrinking the map
  // leaves two buttons nearly as wide as it is
  return {x:pad, y:pad, w:sz, h:sz, btn:Math.round(sz*0.125)};
}
// The zoom buttons live INSIDE the frame now, bottom-right (user, 2026-07-27). One geometry
// function so the hit-test and the painter can never drift apart -- which is exactly how a
// control ends up looking like it is somewhere it is not.
function miniBtns(){
  const R=miniRect(), b=R.btn, m=Math.round(b*0.28);
  const by=R.y+R.h-b-m;
  return {b:b, by:by, out:R.x+R.w-b-m, in:R.x+R.w-b*2-m-Math.round(b*0.22)};
}
// Hit-test for the zoom buttons; controls call this on tap/click.
function miniHit(mx,my){
  if(typeof inGame==='undefined' || !inGame) return null;
  const B=miniBtns();
  if(my<B.by || my>B.by+B.b) return null;
  if(mx>=B.in && mx<=B.in+B.b) return 'in';
  if(mx>=B.out && mx<=B.out+B.b) return 'out';
  return null;
}
function miniZoomIn(){ miniZoom=Math.max(0,miniZoom-1); }
function miniZoomOut(){ miniZoom=Math.min(MINI_ZOOMS.length-1,miniZoom+1); }

function drawMinimap(){
  if(typeof inGame==='undefined' || !inGame) return;
  if(!curRoom || !curRoom.rings) return;                 // overworld only; dungeons have their own flow
  const G=rooms['G']; if(!G||!G.grid) return;
  const R=miniRect();
  const half=MINI_ZOOMS[miniZoom];                       // half-window in tiles
  const ptx=player.x/TILE, pty=player.y/TILE;

  ctx.save();
  // panel
  ctx.fillStyle='rgba(10,8,14,0.82)';
  ctx.fillRect(R.x-3,R.y-3,R.w+6,R.h+6);
  ctx.strokeStyle='rgba(196,158,90,0.55)'; ctx.lineWidth=2;
  ctx.strokeRect(R.x-3,R.y-3,R.w+6,R.h+6);

  // terrain window, clipped to the panel
  ctx.beginPath(); ctx.rect(R.x,R.y,R.w,R.h); ctx.clip();
  const cv=miniTerrain(G), s=_miniCache.s;
  const sx=(ptx-half)*s, sy=(pty-half)*s, sw=half*2*s, sh=half*2*s;
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(cv, sx,sy,sw,sh, R.x,R.y,R.w,R.h);
  // fog on top of the terrain but UNDER the markers, so your own dot stays visible in the dark
  fogInit(G); fogReveal(G, 0.016);
  if(_fogCv) ctx.drawImage(_fogCv, sx,sy,sw,sh, R.x,R.y,R.w,R.h);

  // world tile -> panel pixel
  const P=(wx,wy)=>({x:R.x+((wx/TILE)-(ptx-half))/(half*2)*R.w,
                     y:R.y+((wy/TILE)-(pty-half))/(half*2)*R.h});
  const inPanel=(p)=>p.x>=R.x&&p.x<=R.x+R.w&&p.y>=R.y&&p.y<=R.y+R.h;

  // BOSSES - red. Live world bosses first; off-window ones get clamped to the rim, hollow, so you
  // can read their direction without mistaking them for something you can reach.
  const seen=[];
  if(typeof enemies!=='undefined') for(const e of enemies){
    if(!e.wb || e.hp<=0) continue;
    seen.push(e.ring);
    const p=P(e.x,e.y);
    if(inPanel(p)){
      ctx.fillStyle='#ff4a3d';
      ctx.beginPath(); ctx.arc(p.x,p.y,4.5,0,6.29); ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.8)'; ctx.lineWidth=1.5; ctx.stroke();
    } else {
      const cx=R.x+R.w/2, cy=R.y+R.h/2;
      let dx=p.x-cx, dy=p.y-cy; const m=Math.max(Math.abs(dx),Math.abs(dy))||1;
      const k=(R.w/2-6)/m; dx*=k; dy*=k;
      ctx.strokeStyle='#ff4a3d'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(cx+dx,cy+dy,3.6,0,6.29); ctx.stroke();
    }
  }
  // a boss den you have not woken still reads as a place to go, drawn faint
  if(G.lairs) for(const k in G.lairs){ const L=G.lairs[k];
    if(seen.indexOf(+k)>=0) continue;
    const wx=(L.px+L.tw/2)*TILE, wy=(L.py+L.th/2)*TILE;
    if(!fogSeen(G,wx,wy)) continue;          // a den you have not walked past is not on your map yet
    const p=P(wx,wy);
    if(!inPanel(p)) continue;
    ctx.fillStyle='rgba(255,74,61,0.30)';
    ctx.beginPath(); ctx.arc(p.x,p.y,3,0,6.29); ctx.fill(); }

  // ---- LIVE DETAIL ----
  // The map showed terrain, bosses and you, and nothing else -- so it told you where you were and
  // not what was around you. Everything below is drawn only inside the window and only on ground
  // the fog has actually been lifted from, so the map never reports what you have not seen.

  // portals and dungeon gates: the reason you are walking somewhere
  const gate=(p,col)=>{ ctx.strokeStyle=col; ctx.lineWidth=1.8;
    ctx.beginPath(); ctx.arc(p.x,p.y,3.4,0,6.29); ctx.stroke();
    ctx.fillStyle=col; ctx.globalAlpha=0.35; ctx.fill(); ctx.globalAlpha=1; };
  if(curRoom.portals) for(const pt of curRoom.portals){
    const p=P((pt.x+0.5)*TILE,(pt.y+0.5)*TILE);
    if(inPanel(p) && fogSeen(G,(pt.x+0.5)*TILE,(pt.y+0.5)*TILE)) gate(p,'#8fe0ff'); }
  if(typeof groundPortals!=='undefined') for(const gp of groundPortals){
    const p=P(gp.x,gp.y); if(inPanel(p)) gate(p,'#c58aff'); }

  // loot on the ground -- a sack you walked past is worth being able to find again
  if(typeof loots!=='undefined') for(const l of loots){
    const p=P(l.x,l.y); if(!inPanel(p)) continue;
    ctx.fillStyle='#ffcf6a';
    ctx.fillRect(p.x-1.6,p.y-1.6,3.2,3.2);
    ctx.strokeStyle='rgba(0,0,0,0.7)'; ctx.lineWidth=1; ctx.strokeRect(p.x-1.6,p.y-1.6,3.2,3.2); }

  // ordinary foes: elites read heavier than chaff, so a crowded rim is legible rather than a smear
  if(typeof enemies!=='undefined') for(const e of enemies){
    if(e.wb || e.hp<=0 || e.decoy || e.node) continue;
    const p=P(e.x,e.y); if(!inPanel(p)) continue;
    const elite=(e.type==='s');
    ctx.fillStyle=elite?'#ff9a5a':'rgba(230,120,110,0.85)';
    ctx.beginPath(); ctx.arc(p.x,p.y,elite?2.6:1.8,0,6.29); ctx.fill(); }

  // objective nodes stand out from the foes that guard them
  if(typeof enemies!=='undefined') for(const e of enemies){
    if(!e.node || e.hp<=0) continue;
    const p=P(e.x,e.y); if(!inPanel(p)) continue;
    ctx.strokeStyle='#ffe08a'; ctx.lineWidth=1.6;
    ctx.beginPath(); ctx.moveTo(p.x,p.y-3.4); ctx.lineTo(p.x+3.4,p.y);
    ctx.lineTo(p.x,p.y+3.4); ctx.lineTo(p.x-3.4,p.y); ctx.closePath(); ctx.stroke(); }

  // PLAYERS - blue. Co-op peers first so the local marker draws on top of them.
  if(typeof coop!=='undefined' && coop && coop.on){
    const now=performance.now(), rk=(curRoom.key||'?');
    for(const id in coop.peers){ const q=coop.peers[id];
      if(!q||q.rm!==rk||now-q.ts>2500) continue;
      const p=P(q.x,q.y); if(!inPanel(p)) continue;
      ctx.fillStyle='#5aa9ff';
      ctx.beginPath(); ctx.arc(p.x,p.y,3.6,0,6.29); ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.75)'; ctx.lineWidth=1.4; ctx.stroke(); } }
  const me=P(player.x,player.y);
  ctx.fillStyle='#8fd0ff';
  ctx.beginPath(); ctx.arc(me.x,me.y,4.2,0,6.29); ctx.fill();
  ctx.strokeStyle='#0b1620'; ctx.lineWidth=1.6; ctx.stroke();
  // facing nib, so the dot tells you which way you are pointing
  const aa=(player.aim||0);
  ctx.strokeStyle='#8fd0ff'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(me.x,me.y);
  ctx.lineTo(me.x+Math.cos(aa)*9, me.y+Math.sin(aa)*9); ctx.stroke();
  ctx.restore();

  // the map is north-up while the CAMERA can be rotated, so say which way north is or the two
  // disagree silently and the map starts lying to you
  {
    const us0=(typeof UIS!=='undefined')?UIS:1;
    ctx.save();
    ctx.fillStyle='rgba(10,8,14,0.6)'; ctx.fillRect(R.x+R.w-Math.round(13*us0), R.y+2, Math.round(11*us0), Math.round(11*us0));
    ctx.fillStyle='rgba(226,216,196,0.8)';
    ctx.font='bold '+Math.round(8*us0)+'px "Pixelify Sans",monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('N', R.x+R.w-Math.round(7.5*us0), R.y+Math.round(8*us0));
    ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    // and the level of the ground you are standing on, which is the number that decides whether
    // walking one screen further is a good idea
    if(typeof grvLvAt==='function'){
      const lv=grvLvAt(ptx,pty);
      if(lv){ const t='Lv '+lv;
        ctx.font=Math.round(9*us0)+'px "Pixelify Sans",monospace';
        const w=ctx.measureText(t).width+8;
        ctx.fillStyle='rgba(10,8,14,0.66)'; ctx.fillRect(R.x+2, R.y+2, w, Math.round(11*us0));
        ctx.fillStyle='rgba(255,208,122,0.9)'; ctx.fillText(t, R.x+6, R.y+Math.round(10.5*us0)); } }
    ctx.restore();
  }

  // zoom buttons, INSIDE the frame at the bottom-right. They sit on a scrim so they stay readable
  // over bright ground, and they are drawn after the clip is released so they are never cut off.
  const B=miniBtns(), b=B.b;
  const drawBtn=(bx,img,glyph)=>{
    ctx.fillStyle='rgba(10,8,14,0.72)'; ctx.fillRect(bx-2,B.by-2,b+4,b+4);
    if(img&&img.complete&&img.naturalWidth){ ctx.imageSmoothingEnabled=false; ctx.drawImage(img,bx,B.by,b,b); }
    else { ctx.fillStyle='rgba(24,20,28,0.92)'; ctx.fillRect(bx,B.by,b,b);
      ctx.strokeStyle='rgba(196,158,90,0.75)'; ctx.lineWidth=1.5; ctx.strokeRect(bx,B.by,b,b);
      ctx.fillStyle='#e8c98a'; ctx.font='bold '+Math.round(b*0.62)+'px monospace';
      ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(glyph,bx+b/2,B.by+b/2+1);
      ctx.textAlign='left'; ctx.textBaseline='alphabetic'; } };
  drawBtn(B.in,  (typeof _miniPlus!=='undefined')?_miniPlus:null, '+');
  drawBtn(B.out, (typeof _miniMinus!=='undefined')?_miniMinus:null, '−');
  // scale readout, bottom-LEFT inside the frame now that the buttons hold the right corner
  const us=(typeof UIS!=='undefined')?UIS:1;
  ctx.font=Math.round(9*us)+'px "Pixelify Sans",monospace';
  const lab=(half*2)+'t';
  ctx.fillStyle='rgba(10,8,14,0.66)';
  ctx.fillRect(R.x+2, R.y+R.h-Math.round(13*us), ctx.measureText(lab).width+8, Math.round(11*us));
  ctx.fillStyle='rgba(226,216,196,0.82)';
  ctx.fillText(lab, R.x+6, R.y+R.h-Math.round(4.5*us));
}
