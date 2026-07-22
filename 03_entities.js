// ---------- entities ----------
const player={x:0,y:0,r:14,hp:100,maxhp:100,spd:180,dmg:12,fireRate:0.22,fireT:0,kills:0,inv:0};
let curRoom=null, enemies=[], pShots=[], eShots=[], particles=[], embers=[];
let rpg=null, texts=[], respawnT=1, shopNear=false, loots=[];
let allies=[], zones=[], fx=[], res=0, lastShotT=99, abT=0, portalLock=false, curRegionN='';
let portalPrompt=null;   // {kind,x,y,label,...} nearest interactable portal/pillar (USE-gated)
let arenaActive=false, arenaWave=0, arenaCd=0;
// ---- world bosses + dungeons ----
// 9 zone bosses (bands 0-8), rethemed for the vertical climb. Sprites: assets/mobs/boss_<band>.png.
const GBOSS=[
 {n:'The Grovewarden',dn:'The Heartwood Hollow',col:'#4f9a3f',pat:'nova',pat2:'spiral',
  title:'bark-skinned guardian of the vale',
  desc:'A patient colossus that erupts in rings of thorns. Weave the gaps and wear it down.'},
 {n:'The Mistantler',dn:'The Fogbound Glade',col:'#6aae7a',pat:'spread5',pat2:'charge',
  title:'antlered stag-beast of the deep wood',
  desc:'Swift and wary, it strafes then lowers its antlers to charge. Punish between its rushes.'},
 {n:'The Bog Horror',dn:'The Sunken Warren',col:'#5a7a3a',pat:'aimed3',pat2:'spiral',
  title:'mud-and-thorn terror of the marsh',
  desc:'It rises from the muck and flails vine and spore. Bait its lunge, then flank.'},
 {n:'Stonefist',dn:'The Shattered Vault',col:'#8a8f88',pat:'nova',pat2:'charge',
  title:'boulder-knuckled golem of the foothills',
  desc:'Heavy shockwave rings and a crushing charge. Strike hard in the recovery after it lunges.'},
 {n:'The Crag Gargoyle',dn:'The Windward Roost',col:'#9aa0a8',pat:'spread5',pat2:'aimed3',
  title:'winged stone hunter of the high cliffs',
  desc:'It dives in erratic passes, raking with claws. Keep moving and answer between the swoops.'},
 {n:'Magmaw',dn:'The Scorch Barrows',col:'#c85a2a',pat:'ring8',pat2:'charge',
  title:'lava-veined beast of the burning ridge',
  desc:'Rings of cinder-fire and a molten charge. Orbit the safe lane; do not stand still.'},
 {n:'The Ash Wraith',dn:'The Cinder Crypt',col:'#8a857e',pat:'spiral',pat2:'aimed3',
  title:'drifting horror of soot and ember',
  desc:'A blinding spiral of ash with sudden aimed scythes. Find the one gap and stay in it.'},
 {n:'The Cinder Demon',dn:'The Ashen Keep',col:'#d4522a',pat:'ring8',pat2:'spiral',
  title:'horned fiend of the volcanic spire',
  desc:'Spinning fire-rings tighten around you. Match its rotation and thread the orbit.'},
 {n:'The Molten Titan',dn:'The Core Sanctum',col:'#ff7a3d',pat:'spiral',pat2:'summon',
  title:'crowned colossus at the molten summit',
  desc:'Everything at once: spiral fire, summoned horrors, relentless pressure. The final trial.'},
];
// per-ring projectile themes (colour/core/shape/size) — suited to each biome & creature
const BOSS_PROJ=[
 {col:'#4a90a8',core:'#cfeaf3',shape:'orb',size:9},    // Tideworn — brine globs
 {col:'#8fae6a',core:'#eef4cf',shape:'dart',size:6},   // Gullwind — feather-darts
 {col:'#7ea44a',core:'#e0f2a8',shape:'dart',size:6},   // Sawgrass — reed spines
 {col:'#4f9a3f',core:'#cdf2b6',shape:'orb',size:7},    // Verdant — thorn seeds
 {col:'#6f5a3a',core:'#d8c49a',shape:'orb',size:7},    // Wolfwood — bone shards
 {col:'#356b40',core:'#bcdcae',shape:'orb',size:8},    // Timberfell — spores
 {col:'#3f6b58',core:'#c6e6d6',shape:'dart',size:6},   // Bramble — barbs
 {col:'#8a8f9a',core:'#e2e7ee',shape:'orb',size:9},    // Stonebrow — boulders
 {col:'#9a8f80',core:'#e6ded0',shape:'orb',size:7},    // Scree — rockslide
 {col:'#c86a3a',core:'#ffdca6',shape:'orb',size:7},    // Cinderwatch — cinders
 {col:'#c05a3a',core:'#ffc7a0',shape:'diamond',size:7},// Ashfall — scythes
 {col:'#d4622a',core:'#ffd3a0',shape:'orb',size:9},    // Charstep — magma bombs
 {col:'#e0a83a',core:'#fff4c8',shape:'diamond',size:7},// Glowing — light lances
 {col:'#e0552a',core:'#ffd39a',shape:'orb',size:8},    // Emberflow — fire coils
 {col:'#ff7a3d',core:'#fff0c0',shape:'orb',size:9},    // Heart Devourer — core fire
];
let groundPortals=[], worldBoss=null, wbCd=18, dunReturn=null, ringBossCd=[];
function ringBossAlive(b){ for(const e of enemies) if(e.wb && e.ring===b) return true; return false; }
// ---- Boss surface lairs: tile-built enterable compounds stamped into the grove ----
// 'X' = lair wall (solid, themed tileset), '.' = interior floor -> 'F'. Bottom gap = doorway.
const LAIR_TEMPLATES={
 0:[ // Heartwood Hollow (13x10) — the Grovewarden's den
  'XXXXXXXXXXXXX',
  'X...........X',
  'X...........X',
  'X...........X',
  'X...........X',
  'X...........X',
  'X...........X',
  'X...........X',
  'X...........X',
  'XXXXX...XXXXX'],
 5:[ // Scorch Barrows (15x11) — Magmaw's lair, inner pillars for cover
  'XXXXXXXXXXXXXXX',
  'X.............X',
  'X..X.......X..X',
  'X.............X',
  'X.............X',
  'X.............X',
  'X.............X',
  'X.............X',
  'X..X.......X..X',
  'X.............X',
  'XXXXXX...XXXXXX'],
};
const LAIR_STAMP_BANDS=[0,5];   // pilot; add bands as their art ships
let _lairsStamped=false;
function stampLairs(){ const R=rooms['G']; if(!R||!R.grid||_lairsStamped) return; _lairsStamped=true; R.lairs={};
 const NZ=(R.rings&&R.rings.names.length)||9;
 for(const b of LAIR_STAMP_BANDS){ const T=LAIR_TEMPLATES[b]; if(!T) continue;
  const TH=T.length, TW=T[0].length;
  const cyBand=Math.max(TH,Math.min(R.h-TH-1,Math.round(R.h*(1-(b+0.5)/NZ))));
  const clear=(px,py)=>{ if(px<1||py<1||px+TW>=R.w-1||py+TH>=R.h-1) return false;
    for(let ty=py-1;ty<=py+TH;ty++)for(let tx=px-1;tx<=px+TW;tx++){ const row=R.grid[ty]; const c=row&&row[tx];
      if(c==null||'wWhHlXF'.indexOf(c)>=0) return false; }
    for(const pl of (R.pillars||[])){ const plx=pl.x/TILE,ply=pl.y/TILE; if(plx>px-2&&plx<px+TW+2&&ply>py-2&&ply<py+TH+2) return false; }
    for(const pt of (R.portals||[])){ const ptx=pt.x/TILE,pty=pt.y/TILE; if(ptx>px-2&&ptx<px+TW+2&&pty>py-2&&pty<py+TH+2) return false; }
    return true; };
  let place=null; const cx0=Math.round(R.w/2-TW/2);
  for(let r=0;r<8 && !place;r++)for(const dy of (r?[0,-r,r]:[0]))for(const dx of (r?[0,-r,r]:[0])){
    const px=cx0+dx*2, py=cyBand-Math.round(TH/2)+dy*2; if(clear(px,py)) place={px,py}; }
  if(!place) place={px:cx0, py:cyBand-Math.round(TH/2)};
  const {px,py}=place;
  for(let ty=0;ty<TH;ty++)for(let tx=0;tx<TW;tx++){ const ch=T[ty][tx];
    if(ch==='X') R.grid[py+ty][px+tx]='X'; else if(ch==='.') R.grid[py+ty][px+tx]='F'; }
  R.lairs[b]={ b, px, py, tw:TW, th:TH,
    spawn:{x:(px+TW/2)*TILE, y:(py+TH*0.58)*TILE},          // boss stands in front of the den
    sprite:{x:(px+TW/2)*TILE, y:(py+2.7)*TILE},             // den centrepiece near the back wall
    decos:[ {x:(px+2.4)*TILE,y:(py+2.4)*TILE,i:0}, {x:(px+TW-2.4)*TILE,y:(py+2.4)*TILE,i:1},
            {x:(px+2.4)*TILE,y:(py+TH-2.4)*TILE,i:2}, {x:(px+TW-2.4)*TILE,y:(py+TH-2.4)*TILE,i:3} ] };
  // drop any arrival landing points that now fall inside this compound (avoid spawning trapped)
  if(R.arrivals) R.arrivals=R.arrivals.filter(a=>!(a[0]>=px-1&&a[0]<=px+TW&&a[1]>=py-1&&a[1]<=py+TH));
 }
}
// Boss spawn anchor = its lair interior (falls back to band centre if unstamped).
function grvLairXY(b){ const R=rooms['G']; if(!R) return null;
 if(R.lairs && R.lairs[b]) return R.lairs[b].spawn;
 if(!R.rings) return null;
 const NZ=R.rings.names.length, tyc=Math.max(1,Math.min(R.h-2,Math.floor(R.h*(1-(b+0.5)/NZ))));
 return {x:(R.w/2)*TILE, y:(tyc+0.5)*TILE}; }
if(typeof rooms!=='undefined' && rooms['G']) stampLairs();   // carve the boss compounds into the grove once
// each ring has its own unique mini-boss; only one of a given ring's boss lives at a time
function spawnRingBoss(b){
 if(!curRoom||!curRoom.rings) return;
 if(ringBossAlive(b)) return;
 const lair=(typeof grvLairXY==='function')?grvLairXY(b):null;
 for(let tries=0;tries<40;tries++){
  let bx,by;
  if(lair && tries<14){ const a=Math.random()*6.283, d=15+Math.random()*45; bx=lair.x+Math.cos(a)*d; by=lair.y+Math.sin(a)*d; } // guard its lair (stay inside)
  else { const a=Math.random()*6.283, d=300+Math.random()*220; bx=player.x+Math.cos(a)*d; by=player.y+Math.sin(a)*d; }
  if(bx<TILE*2||by<TILE*2||bx>(curRoom.w-2)*TILE||by>(curRoom.h-2)*TILE) continue;
  if(solid(bx,by)) continue;
  if(grvBandXY(bx/TILE,by/TILE)!==b) continue;
  const lv=curRoom.rings.names[b].lv;
  const GB=GBOSS[b], PJ=BOSS_PROJ[b]||{};
  // matched to zone: modest early, monstrous late
  const chaserHp=40*(1+lv*0.55);
  const size=24+ (lv/150)*22;          // small on the sands, huge at the core
  const boss={type:'B',wb:true,ring:b,x:bx,y:by,r:size,hp:Math.round(chaserHp*6),maxhp:Math.round(chaserHp*6),
   spd:34+(lv/150)*26,fireT:1.4,ang:0,col:GB.col,bd:5+lv*0.45,lv:lv,boss:true,name:GB.n,
   pat:GB.pat,pat2:GB.pat2,chargeT:0,sumT:3,
   pcol:PJ.col,pcore:PJ.core,pshape:PJ.shape,psize:PJ.size||7};
  enemies.push(boss);
  msg('\u2620 '+GB.n,GB.title);
  setTimeout(function(){ if(enemies.indexOf(boss)>=0) msg(GB.n,GB.desc); },1700);
  return;
 }
}
function genDungeon(ring){
 const lv=(rooms['G'].rings.names[ring].lv);
 const W2=48,H2=30, g=[];
 for(let y=0;y<H2;y++){ const row=[]; for(let x=0;x<W2;x++) row.push('.'); g.push(row); }
 for(let x=0;x<W2;x++){ g[0][x]='W'; g[H2-1][x]='W'; }
 for(let y=0;y<H2;y++){ g[y][0]='W'; g[y][W2-1]='W'; }
 // pillars / clutter
 for(let i=0;i<14;i++){ const w=1+((i*7)%3), h=1+((i*5)%3);
  const x=3+((i*13)%(W2-8)), y=4+((i*11)%(H2-9));
  if(x>6&&x<W2-8) for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++) g[yy][xx]='W'; }
 // minion packs (left/mid), boss chamber (right)
 const spots=[[10,8],[10,20],[18,14],[26,7],[26,22],[34,14]];
 for(const sp of spots){ if(g[sp[1]][sp[0]]==='.') g[sp[1]][sp[0]]=Math.random()<0.4?'s':'c'; }
 g[15][42]='B';
 // entry portal (left) + return marker placed at runtime
 const room={key:'DUN',grid:g,w:W2,h:H2,lv:lv,band:'boss',town:false,big:false,dungeon:true,
  glows:[],portals:[],spawns:[],regions:null,rings:null,ring:ring,px:4,py:15};
 for(let y=0;y<H2;y++)for(let x=0;x<W2;x++){ const c=g[y][x];
  if(c==='c'||c==='s'||c==='B'){ room.spawns.push({t:c,x:x,y:y}); g[y][x]='.'; } }
 room.bossRing=ring;
 rooms['DUN']=room;
 return room;
}
function enterDungeon(ring){
 dunReturn={x:player.x,y:player.y};
 genDungeon(ring);
 curRoom=rooms['DUN']; // set so makeEnemy reads dungeon lv
 enterRoom('DUN',(rooms['DUN'].px+.5)*TILE,(rooms['DUN'].py+.5)*TILE);
 msg(GBOSS[ring].dn,'clear it to the end');
}

const SHOPNPCS=[
 {id:'bram', name:'Bram', role:'WEAPONS', title:"BRAM'S WEAPONWORKS", awn:'#b5482f', x:19*TILE,   y:26.5*TILE},
 {id:'sella',name:'Sella',role:'ARMOR',   title:"SELLA'S ARMORY",     awn:'#e07a2e', x:23.5*TILE, y:26.5*TILE},
 {id:'maren',name:'Maren',role:'POTIONS', title:"MAREN'S PROVISIONS", awn:'#4f9a3f', x:28*TILE,   y:26.5*TILE},
 {id:'odo',  name:'Odo',  role:'PETS',    title:"ODO'S MENAGERIE",    awn:'#7ab8d4', x:32.5*TILE, y:26.5*TILE},
];
let curShopNear=null;
function makeEnemy(sp){
  const lv=roomLvAt(sp);
  const hm=1+lv*0.55, dm=lv*0.8;
  let e;
  if(sp.t==='c') e={type:'c',r:15,hp:40*hm,spd:95+Math.min(60,lv*0.6),touch:12+dm,col:'#c04a3d'};
  else if(sp.t==='s') e={type:'s',r:16,hp:60*hm,spd:45,fireT:1,bd:8+lv*0.5,col:'#8a5ac0'};
  else { const dr=(curRoom&&curRoom.dungeon)?curRoom.bossRing:-1;
    const GB=dr>=0?GBOSS[dr]:null;
    e={type:'B',r:GB?30+(lv/150)*14:30,hp:Math.round(600*hm*(GB?1.4:1)),spd:38,fireT:1.5,ang:0,
     col:GB?GB.col:'#e07a2e',boss:true,bd:8+lv*0.5,
     name:GB?GB.n:null,pat:GB?GB.pat:'ring8',pat2:GB?GB.pat2:'spiral',chargeT:0,sumT:3,wb:!!GB}; }
  e.hp=Math.round(e.hp); e.maxhp=e.hp;
  e.x=(sp.x+.5)*TILE; e.y=(sp.y+.5)*TILE; e.sref=sp; e.lv=lv;
  return e;
}
function slowF(e){return e.slowT>0?0.55:1;}
function safeSpot(r,px,py){
 function sol(tx,ty){ if(ty<1||ty>=r.h-1||tx<1||tx>=r.w-1) return true;
  return 'WhlHwtk'.indexOf(r.grid[ty][tx])>=0; }
 const t0x=Math.floor(px/TILE), t0y=Math.floor(py/TILE);
 for(let rad=0;rad<14;rad++){
  for(let dy=-rad;dy<=rad;dy++)for(let dx=-rad;dx<=rad;dx++){
   if(Math.max(Math.abs(dx),Math.abs(dy))!==rad) continue;
   if(!sol(t0x+dx,t0y+dy)) return {x:(t0x+dx+.5)*TILE,y:(t0y+dy+.5)*TILE};
  } }
 return {x:px,y:py}; }
// Vertical zone band from tile-y: bottom (high y)=band 0, top (y=0)=highest band.
function grvBandY(ty){ const NZ=(curRoom.rings&&curRoom.rings.names.length)||9, H=curRoom.h||1;
 return Math.max(0,Math.min(NZ-1,Math.floor((1-ty/H)*NZ))); }
function ringInfoAt(tx,ty){ return curRoom.rings.names[grvBandY(ty)]; }
function regionAtPx(px,py){ if(!curRoom) return null;
 if(curRoom.rings) return ringInfoAt(px/TILE,py/TILE);
 if(!curRoom.regions) return null;
 const tx=px/TILE, ty=py/TILE;
 for(const rg of curRoom.regions){ if(tx>=rg.x1&&tx<rg.x2&&ty>=rg.y1&&ty<rg.y2) return rg; }
 return null; }
function roomLvAt(sp){
 if(curRoom&&curRoom.rings) return ringInfoAt(sp.x,sp.y).lv;
 if(curRoom&&curRoom.regions){
  for(const rg of curRoom.regions){ if(sp.x>=rg.x1&&sp.x<rg.x2&&sp.y>=rg.y1&&sp.y<rg.y2) return rg.lv; } }
 return (curRoom&&curRoom.lv)?curRoom.lv:1; }

function enterRoom(key, px, py){
  curRoom=rooms[key];
  player.x=px; player.y=py;
  enemies=[]; pShots=[]; eShots=[]; embers=[]; loots=[]; zones=[]; fx=[];
  worldBoss=null; ringBossCd=[]; if(!curRoom||!curRoom.dungeon) groundPortals=[];
  for(const al of allies){al.x=player.x;al.y=player.y;}
  buildRoomCache();
  curRegionN='';
  const rnow=Date.now();
  if(!curRoom.big){ for(const sp of curRoom.spawns){ if(!sp.dead||sp.dead<=rnow) enemies.push(makeEnemy(sp)); } }
  document.getElementById('roomTxt').textContent=curRoom.name;
  msg(curRoom.name, curRoom.town?'the hearth never dies':(curRoom.band?'a hunting ground for Lv '+curRoom.band:''));
}
function msg(t,sub=''){ const m=document.getElementById('msg');
  m.innerHTML=t+(sub?`<small>${sub}</small>`:''); m.classList.add('show');
  clearTimeout(msg.t); msg.t=setTimeout(()=>m.classList.remove('show'),1500); }

// ---- portal routing: every portal carries a destination `to` ----
function usePortal(to){
  if(curRoom&&curRoom.arena&&arenaActive){ recordArenaBest(); arenaActive=false; }
  if(to==='G'){ const gv=rooms['G']; if(!gv) return;
    let ax=gv.w*TILE/2, ay=gv.h*TILE/2;
    if(gv.arrivals&&gv.arrivals.length){ const ar=gv.arrivals[Math.floor(Math.random()*gv.arrivals.length)];
      ax=(ar[0]+.5)*TILE; ay=(ar[1]+.5)*TILE; }
    const sp=safeSpot(gv,ax,ay); enterRoom('G',sp.x,sp.y);
    msg('ROOTHOLLOW VALE','the climb begins'); return; }
  const dst=rooms[to]; if(!dst) return;
  const sp=safeSpot(dst,(dst.px+.5)*TILE,(dst.py+.5)*TILE);
  enterRoom(to,sp.x,sp.y);
  if(dst.arena) startArena();
}
// ---- Arena: endless escalating waves ----
function recordArenaBest(){ if(!rpg) return; const survived=Math.max(0,arenaWave-1);
  if(survived>(rpg.arenaBest||0)){ rpg.arenaBest=survived; msg('NEW RECORD','wave '+survived+' survived'); }
  if(typeof saveRPG==='function') saveRPG(); }
function startArena(){ arenaActive=true; arenaWave=0; arenaCd=1.6; enemies=[]; eShots=[];
  msg('THE PROVING GROUNDS', (rpg&&rpg.arenaBest)?'best: wave '+rpg.arenaBest:'survive as long as you can'); }
function arenaSpawnWave(){ const a=rooms['ARENA']; if(!a) return;
  arenaWave++;
  a.lv=Math.min(150, 2+arenaWave*4);
  const boss=(arenaWave%5===0);
  const n=boss?1:Math.min(22, 3+Math.floor(arenaWave*1.6));
  for(let i=0;i<n;i++){
    let x,y,tries=0;
    do{ x=(2+Math.random()*(a.w-4))*TILE; y=(2+Math.random()*(a.h-4))*TILE; tries++; }
    while(tries<30 && (solid(x,y) || Math.hypot(x-player.x,y-player.y)<170));
    const t=boss?'B':(arenaWave>2 && i%4===0)?'s':'c';
    enemies.push(makeEnemy({t:t,x:Math.floor(x/TILE),y:Math.floor(y/TILE)}));
  }
  msg('WAVE '+arenaWave, boss?'a champion approaches':n+' foes');
}
