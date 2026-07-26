// ---------- always-on minimap (top-left) ----------
// Replaces the map BUTTON: instead of opening a full-screen map you now always have a small live
// map in the corner. It shows a window around you rather than the whole world, because at 1160x720
// tiles the whole world in 150px puts every landmark within a few pixels of every other one and
// tells you nothing about where to walk.
//
// A boss that is off the window still matters, so its marker is clamped to the rim and drawn
// hollow -- you get its direction without pretending it is close.

const MINI_PAD = 10;              // gap from the screen corner
const MINI_BASE = 208;            // panel size in CSS px at UI scale 1
const MINI_ZOOMS = [26, 40, 60, 90, 130];   // half-window in TILES; index 0 = closest in
let miniZoom = 2;
let _miniCache = null;

// The whole world rendered once at low resolution. The minimap then blits the sub-rect it needs,
// so panning and zooming cost one drawImage instead of re-rasterising terrain every frame.
function miniTerrain(G){
  const key=G.w+'x'+G.h;
  if(_miniCache && _miniCache.key===key) return _miniCache.cv;
  const s=0.34;                                     // world tiles -> cache pixels
  const cv=document.createElement('canvas');
  cv.width=Math.max(1,Math.round(G.w*s)); cv.height=Math.max(1,Math.round(G.h*s));
  const c=cv.getContext('2d');
  c.fillStyle='#0b0a10'; c.fillRect(0,0,cv.width,cv.height);
  const T=(typeof _territories==='function')?_territories(G):null;
  const zg=G.rings&&G.rings._zg;
  const step=Math.max(1,Math.ceil(Math.sqrt((G.w*G.h)/160000)));
  const bs=s*step+0.7;
  for(let ty=0;ty<G.h;ty+=step){ const row=G.grid[ty]; if(!row) continue;
    for(let tx=0;tx<G.w;tx+=step){ const ch=row[tx]; if(ch==null) continue;
      const px=tx*s, py=ty*s;
      if(ch==='w'){ c.fillStyle=(typeof MAP_OCEAN!=='undefined')?MAP_OCEAN:'#16324a'; c.fillRect(px,py,bs,bs); continue; }
      if(ch==='b'){ c.fillStyle=(typeof MAP_BRIDGE!=='undefined')?MAP_BRIDGE:'#6b5a3e'; c.fillRect(px,py,bs,bs); continue; }
      const zr=zg&&zg[ty], zi=(zr&&tx<zr.length)?zr[tx]:-1;
      const tt=(T&&zi>=0)?T[zi]:null;
      c.fillStyle=(typeof MRAMP!=='undefined'&&MRAMP[tt?tt.band:0])||'#547a44';
      c.fillRect(px,py,bs,bs);
      if('tk'.indexOf(ch)>=0){ c.fillStyle='rgba(0,0,0,0.22)'; c.fillRect(px,py,bs,bs); } } }
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
  return {x:pad, y:pad, w:sz, h:sz, btn:Math.round(26*u)};
}
// Hit-test for the zoom buttons; controls call this on tap/click.
function miniHit(mx,my){
  if(typeof inGame==='undefined' || !inGame) return null;
  const R=miniRect(), b=R.btn, by=R.y+R.h+Math.round(b*0.18);
  if(my<by || my>by+b) return null;
  if(mx>=R.x && mx<=R.x+b) return 'in';
  if(mx>=R.x+b+6 && mx<=R.x+b*2+6) return 'out';
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

  // zoom buttons under the panel
  const b=R.btn, by=R.y+R.h+Math.round(b*0.18);
  const drawBtn=(bx,img,glyph)=>{
    if(img&&img.complete&&img.naturalWidth){ ctx.imageSmoothingEnabled=false; ctx.drawImage(img,bx,by,b,b); }
    else { ctx.fillStyle='rgba(24,20,28,0.9)'; ctx.fillRect(bx,by,b,b);
      ctx.strokeStyle='rgba(196,158,90,0.6)'; ctx.lineWidth=1.5; ctx.strokeRect(bx,by,b,b);
      ctx.fillStyle='#e8c98a'; ctx.font='bold '+Math.round(b*0.62)+'px monospace';
      ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(glyph,bx+b/2,by+b/2+1);
      ctx.textAlign='left'; ctx.textBaseline='alphabetic'; } };
  drawBtn(R.x, (typeof _miniPlus!=='undefined')?_miniPlus:null, '+');
  drawBtn(R.x+b+6, (typeof _miniMinus!=='undefined')?_miniMinus:null, '−');
  // scale readout, so the zoom level is legible rather than guessed at
  ctx.fillStyle='rgba(220,210,190,0.55)';
  ctx.font=Math.round(9*((typeof UIS!=='undefined')?UIS:1))+'px "Pixelify Sans",monospace';
  ctx.fillText((half*2)+'t', R.x+b*2+12, by+b*0.68);
}
