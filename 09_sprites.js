// ---------- 8-bit sprites ----------
const HERO_A=[
"......OOOO......",
".....OMMMMO.....",
"....OMMMMMMO....",
"....OSSSSSSO....",
"....OSESSESO....",
"....OSSSSSSO....",
".....OSSSSO.....",
"...OOBBBBBBOO...",
"..OBBBDBBDBBBO..",
"..OBGBBBBBBGBO..",
"..OBBBBBBBBBBO..",
"...OBBBBBBBBO...",
"...OLLLLLLLLO...",
"...OLL.OO.LLO...",
"...OLL....LLO...",
"...Oll....llO...",
"...OO......OO..."];
const HERO_B=[
"......OOOO......",
".....OMMMMO.....",
"....OMMMMMMO....",
"....OSSSSSSO....",
"....OSESSESO....",
"....OSSSSSSO....",
".....OSSSSO.....",
"...OOBBBBBBOO...",
"..OBBBDBBDBBBO..",
"..OBGBBBBBBGBO..",
"..OBBBBBBBBBBO..",
"...OBBBBBBBBO...",
"...OLLLLLLLLO...",
"..OLL..OO..LLO..",
"..OLL......LLO..",
"..Oll......llO..",
"..OO........OO.."];
const HOUND=[
"....OOOOOOOO....",
"...ORRRRRRRRO...",
"..ORRERRRRERRO..",
"..ORRRRRRRRRRO..",
"..ORTTRRRRTTRO..",
"...ORRRRRRRRO...",
"..ORRRRRRRRRRO..",
"..ORrRRRRRRrRO..",
"..ORRO.OO.ORRO..",
"..ORRO....ORRO..",
"..OOO......OOO.."];
const CULT=[
"....OOOOOO....",
"...OPPPPPPO...",
"..OPPPPPPPPO..",
"..OPKKKKKKPO..",
"..OPKEKKEKPO..",
"..OPKKKKKKPO..",
"..OPPPPPPPPO..",
".OPPPpPPpPPPO.",
".OPPPPPPPPPPO.",
".OPPPPPPPPPPO.",
".OPpPPPPPPpPO.",
".OPPPPPPPPPPO.",
"..OPPPPPPPPO..",
"..OppPPPPppO..",
"..OPPPPPPPPO..",
"..OOOOOOOOOO.."];
const TYRANT=[
".OO................OO.",
".OHHO............OHHO.",
"..OHHO..OOOOOO..OHHO..",
"..OHHOOTTTTTTTTOOHHO..",
"...OOOTTTTTTTTTTOOO...",
"...OTTTTTTTTTTTTTTO...",
"..OTETTTTTTTTTTTTETO..",
"..OTTTTTTTTTTTTTTTTO..",
"..OTTMMMMMMMMMMMMTTO..",
"..OTTMHMHMHMHMHMHTTO..",
"..OTTTTTTTTTTTTTTTTO..",
".OTTTTtTTTTTTTTtTTTTO.",
".OTTTTTTTTTTTTTTTTTTO.",
".OTTTTTTTTTTTTTTTTTTO.",
".OtTTTTTTTTTTTTTTTTtO.",
"..OTTTTTTTTTTTTTTTTO..",
"..OTTTOO.OOOO.OOTTTO..",
"..OTTTO........OTTTO..",
"..OttTO........OTttO..",
"..OOOO..........OOOO.."];
const MAREN=[
"..OOOOOOOOOO..",
".OAAAAAAAAAAO.",
"OAAAAAAAAAAAAO",
"OaaaaaaaaaaaaO",
"..OSSSSSSSSO..",
"..OSESSSSESO..",
"..OSSSSSSSSO..",
"...OSSSSSSO...",
"..ORRRRRRRRO..",
".ORRGGGGGGRRO.",
".ORGGGGGGGGRO.",
".ORGGGGGGGGRO.",
".ORGGGGGGGGRO.",
".ORRGGGGGGRRO.",
"..ORRRRRRRRO..",
"..OrrRRRRrrO..",
"..OOOOOOOOOO.."];
function makeSprite(rows,pal){ const h=rows.length,w=rows[0].length;
 const cv2=document.createElement('canvas'); cv2.width=w; cv2.height=h;
 const c=cv2.getContext('2d');
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){ const ch=rows[y][x];
  if(ch==='.'||!pal[ch]) continue; c.fillStyle=pal[ch]; c.fillRect(x,y,1,1); }
 return cv2; }
function blit(sp,x,y,sc,flip){ ctx.save(); ctx.translate(x,y);
 if(flip) ctx.scale(-1,1);
 ctx.imageSmoothingEnabled=false;
 ctx.drawImage(sp,-sp.width*sc/2,-sp.height*sc/2,sp.width*sc,sp.height*sc);
 ctx.restore(); }
const sprHound=makeSprite(HOUND,{O:'#140b0b',R:'#c04a3d',r:'#8d3227',E:'#ffd07a',T:'#e8e0d0'});
const sprCult=makeSprite(CULT,{O:'#140b14',P:'#8a5ac0',p:'#5f3d8a',E:'#ffd07a',K:'#241530'});
const sprTyrant=makeSprite(TYRANT,{O:'#1b0d08',T:'#e07a2e',t:'#a8551c',E:'#fff0c0',H:'#e8e0d0',M:'#401510'});
const sprMaren=makeSprite(MAREN,{O:'#140d08',A:'#5c3826',a:'#45291c',S:'#ecc795',R:'#7a5a30',r:'#5a411f',G:'#e8b34b',E:'#140d08'});
const sprBram=makeSprite(MAREN,{O:'#140d08',A:'#3a3344',a:'#262031',S:'#ecc795',R:'#5d6670',r:'#3f4750',G:'#c9d2da',E:'#140d08'});
const sprSella=makeSprite(MAREN,{O:'#140d08',A:'#45291c',a:'#2e1a10',S:'#ecc795',R:'#7a3f22',r:'#5a2d18',G:'#e07a2e',E:'#140d08'});
const sprOdo=makeSprite(MAREN,{O:'#140d08',A:'#2e4034',a:'#1d2a22',S:'#ecc795',R:'#3f6b52',r:'#2c4a39',G:'#8fd48c',E:'#140d08'});
const sprNyx=makeSprite(MAREN,{O:'#140d08',A:'#241530',a:'#170d20',S:'#c9b8d8',R:'#5f3d8a',r:'#432a63',G:'#c07ad4',E:'#140d08'});
const sprWisp=makeSprite(["..OO..",".OTTO.","OTWWTO","OTWWTO",".OTTO.","..OO.."],{O:'#1b0d08',T:'#ff8c3a',W:'#ffd07a'});
const BAG=[
"...OOOO...",
"..OGGGGO..",
".OLLLLLLO.",
"OLLLLLLLLO",
"OLLLLLLLLO",
"OLlLLLLlLO",
"OLLLLLLLLO",
".OLLLLLLO.",
"..OOOOOO.."];
const sprBag=makeSprite(BAG,{O:'#140d08',L:'#8a6a3a',l:'#6a4f28',G:'#e8b34b'});
const sprWolf=makeSprite(HOUND,{O:'#101418',R:'#8d97a3',r:'#5d6670',E:'#d8f0fa',T:'#e8e0d0'});
const sprSkel=makeSprite(CULT,{O:'#141414',P:'#d8d2c8',p:'#a39d94',E:'#7dc47a',K:'#2a2a2a'});
const WSPR={
 sword:["...T........","GGTWWWWWWWWW","...T........"],
 dagger:["..T.....","GGWWWWW.","..T....."],
 bow:["..WWWW....",".W....W...","T......G..",".W....W...","..WWWW...."],
 xbow:["..W..W....","GGWWWWWWT.","..W..W...."],
 staff:["..........T.","GGGGGGGGGGTT","..........T."],
 wand:["GGWWWWT."],
 tome:["GTTTTT","GWWWWW","GWWWWW","GWWWWW","GWWWWW","GTTTTT"],
 axe:["....WW..","GGGGWWWT","....WWW.","....WW.."],
 hammer:["....WWWW","GGGGWTTW","....WWWW"],
 spear:["............W.","GGGGGGGGGGWWT.",".............."],
 harp:["TWWWT","W...W","W.W.W","W...W","TWWWT"],
 totem:["TTTT","WWWW","GWWG","WWWW","GGGG"],
};
const wpnCache={};
function wpnSpr(type,tier){ const k=type+'_'+tier;
 if(!wpnCache[k]){ wpnCache[k]=makeSprite(WSPR[type]||WSPR.sword,
  {W:'#cfd6dd',G:'#5c3826',T:tierCol(tier|0),O:'#14101b'}); }
 return wpnCache[k]; }
function blitRot(sp,x,y,sc,ang){ ctx.save(); ctx.translate(x,y); ctx.rotate(ang);
 ctx.imageSmoothingEnabled=false;
 ctx.drawImage(sp,-sp.width*sc*0.2,-sp.height*sc/2,sp.width*sc,sp.height*sc);
 ctx.restore(); }

const CTHEME={
 squire:{p:'#5a7a9c',s:'#3c5570'}, ranger:{p:'#4f7d45',s:'#37592f'},
 pyro:{p:'#d4622a',s:'#96421c'}, knight:{p:'#7d8a99',s:'#565f6b'},
 rogue:{p:'#4a3d5c',s:'#322a40'}, cleric:{p:'#d8cfb8',s:'#a89c7f'},
 berserker:{p:'#a83232',s:'#742020'}, warlock:{p:'#6b3d99',s:'#482968'},
 frost:{p:'#6fb8d4',s:'#4a8aa8'}, storm:{p:'#c9b23c',s:'#8f7d24'},
 hunter:{p:'#8a6a3a',s:'#64491f'}, arbalest:{p:'#6b6b3f',s:'#4a4a28'},
 monk:{p:'#d49a3a',s:'#a06f1f'}, paladin:{p:'#d4b96a',s:'#a08a42'},
 necro:{p:'#5f8a4f',s:'#3f6134'}, bard:{p:'#9c4a6b',s:'#6f3049'},
 shaman:{p:'#3f8a7d',s:'#2a6157'}, dragoon:{p:'#b5652f',s:'#82461e'},
};
function mixc(a,b,t){
 const pa=parseInt(a.slice(1),16), pb=parseInt(b.slice(1),16);
 const r=Math.round(((pa>>16)&255)*(1-t)+((pb>>16)&255)*t);
 const g=Math.round(((pa>>8)&255)*(1-t)+((pb>>8)&255)*t);
 const bl=Math.round((pa&255)*(1-t)+(pb&255)*t);
 return '#'+((1<<24)|(r<<16)|(g<<8)|bl).toString(16).slice(1);
}
const heroCache={};
function heroSprite(look,frame){
 const cls=look.cls||'squire', mt=look.mt||'robe', at=look.armT|0;
 const ht=(look.helmT===undefined)?-1:look.helmT;
 const th=CTHEME[cls]||CTHEME.squire;
 const k=[cls,mt,at,ht,frame].join('_');
 if(!heroCache[k]){
  let B=th.p, D=th.s;
  if(mt==='plate'){ B=mixc(th.p,'#9aa3ad',0.45); D=mixc(th.s,'#6d7680',0.45); }
  else if(mt==='leather'){ B=mixc(th.p,'#7a5a30',0.35); D=mixc(th.s,'#5a411f',0.35); }
  const pal={O:'#14101b',
   M:ht>=0?'#c9d2da':'#6a4a2a', m:ht>=0?tierCol(ht):'#4f3620',
   S:'#ecc795',E:'#14101b',B:B,D:D,L:'#5c3826',l:'#45291c',
   G:tierCol(at)};
  heroCache[k]=makeSprite(frame?HERO_B:HERO_A,pal);
 } return heroCache[k]; }
function drawEnemySprite(e,pn){
 const flip = player.x < e.x;
 if(e.type==='c') blit(sprHound,e.x,e.y+Math.sin(pn*6+e.x)*1,2.0,flip);
 else if(e.type==='s') blit(sprCult,e.x,e.y+Math.sin(pn*3+e.x)*1.5,2.1,flip);
 else blit(sprTyrant,e.x,e.y+Math.sin(pn*2)*1.5,e.wb?3.8:2.8,flip);
}
const ENAME={c:'Cinder Hound',s:'Ashbound Cultist',B:'CINDER TYRANT'};
function render(){
  ctx.fillStyle='#0b0a10'; ctx.fillRect(0,0,W,H);
  const roomW=curRoom.w*TILE, roomH=curRoom.h*TILE;
  const zoom=H/(VIEW_TILES_H*TILE);
  const vw=W/zoom, vh=H/zoom;
  camX = roomW<=vw ? (roomW-vw)/2 : Math.max(0,Math.min(roomW-vw, player.x-vw/2));
  camY = roomH<=vh ? (roomH-vh)/2 : Math.max(0,Math.min(roomH-vh, player.y-vh/2));
  ctx.save(); ctx.scale(zoom,zoom); ctx.translate(-camX,-camY);
  const tx0=Math.max(0,Math.floor(camX/TILE)), ty0=Math.max(0,Math.floor(camY/TILE));
  const tx1=Math.min(curRoom.w-1,Math.ceil((camX+vw)/TILE)), ty1=Math.min(curRoom.h-1,Math.ceil((camY+vh)/TILE));
  for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++) drawTileG(tx,ty);
  const pn=performance.now()/1000;
  if(curRoom.glows) for(const gl of curRoom.glows){
    const fl=1+Math.sin(pn*9+gl.x)*0.16;
    if(gl.t==='H'){
      ctx.fillStyle='#ff8c3a'; ctx.beginPath(); ctx.arc(gl.x,gl.y+2,12*fl,0,6.29); ctx.fill();
      ctx.fillStyle='#ffd07a'; ctx.beginPath(); ctx.arc(gl.x,gl.y-2,6.5*fl,0,6.29); ctx.fill();
    } else if(gl.t==='l'){
      ctx.fillStyle='#fff0c0'; ctx.fillRect(gl.x-4,gl.y-17+Math.sin(pn*11+gl.x),8,9);
    } }
  if(curRoom.portals) for(const pt of curRoom.portals){
    const pp=performance.now()/300;
    const pcols=['#c07ad4','#8a5ac0','#e8d8ff'];
    for(let i=0;i<3;i++){ ctx.strokeStyle=pcols[i]; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(pt.x,pt.y,10+i*7+Math.sin(pp+i*2)*3,0,6.29); ctx.stroke(); }
    ctx.fillStyle='#e8d8ff'; ctx.fillRect(pt.x-3,pt.y-3,6,6);
  }
  for(const p of particles){ ctx.globalAlpha=p.life/0.4; ctx.fillStyle=p.col;
    ctx.fillRect(p.x-2,p.y-2,4,4); } ctx.globalAlpha=1;
  for(const s of pShots) drawShot(s,'#ffc94d','#fff4cc');
  for(const s of eShots) drawShot(s,'#e2604c','#ffc0b0');
  for(const z of zones){ ctx.globalAlpha=0.20; ctx.fillStyle='#ffd07a';
    ctx.beginPath(); ctx.arc(z.x,z.y,z.r,0,6.29); ctx.fill();
    ctx.globalAlpha=0.55; ctx.strokeStyle='#ffd07a'; ctx.lineWidth=2; ctx.stroke(); ctx.globalAlpha=1; }
  for(const gp of groundPortals){ const pp=performance.now()/220;
    const cols=gp.home?['#7dc47a','#4f8a4c','#d8ffd8']:['#c07ad4','#8a5ac0','#e8d8ff'];
    for(let i=0;i<3;i++){ ctx.strokeStyle=cols[i]; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(gp.x,gp.y,11+i*7+Math.sin(pp+i*2)*3,0,6.29); ctx.stroke(); }
    ctx.fillStyle=gp.home?'#d8ffd8':'#e8d8ff'; ctx.fillRect(gp.x-3,gp.y-3,6,6);
    ctx.font='10px monospace'; ctx.textAlign='center'; ctx.fillStyle='#e8d8ff';
    ctx.fillText(gp.home?'EXIT':(GBOSS[gp.ring]?GBOSS[gp.ring].dn:'DUNGEON'),gp.x,gp.y-24); ctx.textAlign='left'; }
  for(const lb of loots){ shadow(lb.x,lb.y+8,10);
    blit(sprBag,lb.x,lb.y,2.0,false);
    ctx.fillStyle=lb.item.k==='pot'?'#7dc47a':tierCol(lb.item.t);
    ctx.fillRect(lb.x-3,lb.y-2,6,6); }
  for(const e of enemies){
    shadow(e.x,e.y+e.r*0.8,e.r*1.05);
    drawEnemySprite(e,pn);
    if(e.slowT>0){ ctx.globalAlpha=0.35; ctx.fillStyle='#9ad4ef';
      ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,6.29); ctx.fill(); ctx.globalAlpha=1; }
    if(e.flash>0){ ctx.globalAlpha=Math.min(1,e.flash*8); ctx.fillStyle='#fff';
      ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,6.29); ctx.fill(); ctx.globalAlpha=1; }
    ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(e.x-e.r-2,e.y-e.r-15,(e.r+2)*2,4);
    ctx.fillStyle=e.boss?'#ff9c50':'#7dc47a';
    ctx.fillRect(e.x-e.r-2,e.y-e.r-15,(e.r+2)*2*Math.max(0,e.hp/e.maxhp),4);
    ctx.font='10px monospace'; ctx.textAlign='center'; ctx.fillStyle='#cfc8bd';
    if(e.wb){ ctx.fillStyle='#ff6b5a'; ctx.font='12px "Pixelify Sans",monospace';
      ctx.fillText('\u2620 '+e.name+' \u2620',e.x,e.y-e.r-30);
      ctx.font='10px monospace'; ctx.fillStyle='#ffd07a'; ctx.fillText('WORLD BOSS · Lv'+e.lv,e.x,e.y-e.r-19); }
    else ctx.fillText((ENAME[e.type]||'')+(e.lv?' · Lv'+e.lv:''),e.x,e.y-e.r-19);
    ctx.textAlign='left';
  }
  for(const al of allies){ shadow(al.x,al.y+8,10);
    blit(al.spr==='wolf'?sprWolf:al.spr==='skel'?sprSkel:sprWisp,al.x,al.y,al.spr==='wisp'?2.2:1.6,player.x<al.x); }
  if(player.spiritT>0){ for(let i=0;i<8;i++){ const a2=performance.now()/300+i*Math.PI/4;
    const ox=player.x+Math.cos(a2)*62, oy=player.y+Math.sin(a2)*62;
    ctx.fillStyle='#7ab8d4'; ctx.fillRect(ox-4,oy-4,8,8);
    ctx.fillStyle='#d8f0fa'; ctx.fillRect(ox-2,oy-2,4,4); } }
  for(const f of fx){ if(f.t==='ring'){ ctx.globalAlpha=Math.min(1,f.life*2.5); ctx.strokeStyle=f.col; ctx.lineWidth=4;
      ctx.beginPath(); ctx.arc(f.x,f.y,f.r*(1.4-f.life*2),0,6.29); ctx.stroke(); ctx.globalAlpha=1; }
    else if(f.t==='bolt'){ ctx.globalAlpha=Math.min(1,f.life*3); ctx.strokeStyle=f.col; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(f.pts[0].x,f.pts[0].y);
      for(let i=1;i<f.pts.length;i++) ctx.lineTo(f.pts[i].x,f.pts[i].y);
      ctx.stroke(); ctx.globalAlpha=1; } }
  if(curRoom.town){
    for(const np of SHOPNPCS){
      shadow(np.x,np.y+12,15);
      const sp=np.id==='maren'?sprMaren:np.id==='bram'?sprBram:np.id==='sella'?sprSella:np.id==='odo'?sprOdo:sprNyx;
      blit(sp,np.x,np.y-8,2.2,false);
      ctx.font='10px monospace'; ctx.textAlign='center'; ctx.fillStyle='#ffd07a';
      ctx.fillText(np.name,np.x,np.y+30); ctx.textAlign='left'; }
  }
  ctx.font='13px monospace'; ctx.textAlign='center';
  for(const t2 of texts){ ctx.globalAlpha=Math.min(1,t2.life*1.4); ctx.fillStyle=t2.col;
    ctx.fillText(t2.txt,t2.x,t2.y); }
  ctx.globalAlpha=1; ctx.textAlign='left';
  shadow(player.x,player.y+player.r*0.85,player.r*1.05);
  const moving=stick.move.id!==null;
  const bob=Math.sin(pn*11)*(moving?1.8:0.5);
  ctx.globalAlpha = player.inv>0 ? (Math.sin(performance.now()/40)>0?0.45:1) : 1;
  const hframe = moving ? (Math.floor(pn*8)%2) : 0;
  blit(heroSprite(player.look||{hue:player.hue||30,helmT:-1},hframe), player.x, player.y-4+bob*0.4, 2.2, Math.cos(player.aim||0)<0);
  const aa=player.aim||0;
  const chW=curChar();
  if(chW&&rpg) blitRot(wpnSpr(CWEAP[chW.cls]||'sword',rpg.wpnL?11:(rpg.wpn||0)),
    player.x+Math.cos(aa)*(player.r+2), player.y+Math.sin(aa)*(player.r+2), 2.0, aa);
  ctx.globalAlpha=1;
  ctx.font='11px monospace'; ctx.textAlign='center'; ctx.fillStyle='#ffd07a';
  ctx.fillText((player.cname||'Hero')+(rpg?' · Lv '+rpg.lvl:''),player.x,player.y-player.r-11);
  ctx.textAlign='left';
  if(curRoom.glows&&curRoom.glows.length){
    ctx.globalCompositeOperation='lighter';
    for(const gl of curRoom.glows){
      const fl=1+Math.sin(pn*7+gl.x)*0.06+Math.sin(pn*13+gl.y)*0.05;
      const rad=gl.r*fl;
      const gr=ctx.createRadialGradient(gl.x,gl.y,4,gl.x,gl.y,rad);
      gr.addColorStop(0,'rgba(255,160,60,0.42)');
      gr.addColorStop(0.5,'rgba(235,115,40,0.16)');
      gr.addColorStop(1,'rgba(235,115,40,0)');
      ctx.fillStyle=gr; ctx.beginPath(); ctx.arc(gl.x,gl.y,rad,0,6.29); ctx.fill();
    }
    ctx.globalCompositeOperation='source-over';
  }
  ctx.fillStyle='#ffb066';
  for(const em of embers){ ctx.globalAlpha=Math.min(1,em.life*0.8); ctx.fillRect(em.x-1.5,em.y-1.5,3,3); }
  ctx.globalAlpha=1;
  ctx.restore();
  const vg=ctx.createRadialGradient(W/2,H/2,H*0.25,W/2,H/2,H*0.95);
  if(curRoom.town){ vg.addColorStop(0,'rgba(255,140,50,0.05)'); vg.addColorStop(1,'rgba(110,45,10,0.22)'); }
  else { vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.42)'); }
  ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
  for(const k of ['move','aim']){ const s=stick[k];
    if(s.id!==null){ ctx.strokeStyle='rgba(216,210,200,.25)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(s.ox,s.oy,50,0,6.29); ctx.stroke();
      ctx.fillStyle='rgba(216,210,200,.35)';
      ctx.beginPath(); ctx.arc(s.ox+s.dx,s.oy+s.dy,20,0,6.29); ctx.fill(); } }
  ctx.fillStyle='rgba(0,0,0,.65)'; ctx.fillRect(W/2-97,H-28,194,15);
  ctx.strokeStyle='rgba(216,210,200,.35)'; ctx.lineWidth=1; ctx.strokeRect(W/2-97.5,H-28.5,195,16);
  const hg=ctx.createLinearGradient(0,H-28,0,H-13);
  const hc=player.hp/player.maxhp>0.3;
  hg.addColorStop(0,hc?'#8fd48c':'#f07a64'); hg.addColorStop(1,hc?'#4f8a4c':'#a83a2a');
  ctx.fillStyle=hg; ctx.fillRect(W/2-95,H-26,190*Math.max(0,player.hp/player.maxhp),11);
  if(rpg){ ctx.fillStyle='rgba(0,0,0,.65)'; ctx.fillRect(W/2-97,H-10,194,6);
    ctx.fillStyle='#7ab8d4'; ctx.fillRect(W/2-95,H-9,190*Math.min(1,rpg.xp/xpNeed(rpg.lvl)),4); }
  fpsCount++; const fn=performance.now();
  if(fn-fpsLast>500){fpsNow=Math.round(fpsCount*1000/(fn-fpsLast));fpsCount=0;fpsLast=fn;}
  if(typeof dev!=='undefined'&&dev.fps){ctx.fillStyle='#7dc47a';ctx.font='14px monospace';ctx.fillText(fpsNow+' fps',10,H-10);}
}
