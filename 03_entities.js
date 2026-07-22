// ---------- entities ----------
const player={x:0,y:0,r:14,hp:100,maxhp:100,spd:180,dmg:12,fireRate:0.22,fireT:0,kills:0,inv:0};
let curRoom=null, enemies=[], pShots=[], eShots=[], particles=[], embers=[];
let rpg=null, texts=[], respawnT=1, shopNear=false, loots=[];
let allies=[], zones=[], fx=[], res=0, lastShotT=99, abT=0, portalLock=false, curRegionN='';
let arenaActive=false, arenaWave=0, arenaCd=0;
// ---- world bosses + dungeons ----
const GBOSS=[
 {n:'The Tideworn Colossus',dn:'The Drowned Hollow',col:'#4a90a8',pat:'aimed3',pat2:'nova',
  title:'barnacle-crusted titan of the shallows',
  desc:'Ancient and slow, it heaves salt-heavy blows. Sidestep its lobbed brine and it tires quickly.'},
 {n:'Gullwind Harrier',dn:'The Windward Roost',col:'#8fae6a',pat:'spread5',pat2:'spread5',
  title:'shrieking raptor of the dunes',
  desc:'Fast and erratic, it strafes with feather-darts. Keep moving and punish between its passes.'},
 {n:'The Sawgrass Devourer',dn:'The Sunken Warren',col:'#7ea44a',pat:'aimed3',pat2:'charge',
  title:'reed-choked maw that swallows the unwary',
  desc:'It coils in the tall grass, then lunges. Bait the charge, then flank.'},
 {n:'Verdant Warden',dn:'The Overgrowth',col:'#4f9a3f',pat:'nova',pat2:'spiral',
  title:'living bulwark of thorn and root',
  desc:'A patient guardian that erupts in rings of thorns. Weave through the gaps.'},
 {n:'The Wolfwood Alpha',dn:'The Beastlord Den',col:'#3a7d3a',pat:'summon',pat2:'charge',
  title:'grey king of the deep timber',
  desc:'It calls the pack to its side and hunts in a rush. Thin the wolves, then corner the Alpha.'},
 {n:'Timberfell Ancient',dn:'The Rotroot Deep',col:'#356b40',pat:'spiral',pat2:'nova',
  title:'moss-shrouded elder of fallen giants',
  desc:'Its slow spiral of spores fills the wood. Read the rotation and slip inside it.'},
 {n:'The Bramble Tyrant',dn:'The Thornmaze',col:'#3f6b58',pat:'spread5',pat2:'spiral',
  title:'crowned horror of the strangling vines',
  desc:'Wide thorn-volleys herd you into the walls. Hold the center of the arena.'},
 {n:'Stonebrow Goliath',dn:'The Shattered Vault',col:'#6a7d6a',pat:'nova',pat2:'charge',
  title:'mountain given a cruel and grinding will',
  desc:'Heavy shockwave rings and a crushing charge. Punish the long recovery after it lunges.'},
 {n:'The Scree Stalker',dn:'The Landslide Tomb',col:'#585450',pat:'charge',pat2:'aimed3',
  title:'avalanche that learned to hunt',
  desc:'Relentless charges down the slope. Never stop moving; strike as it resets.'},
 {n:'Cinderwatch Sentinel',dn:'The Ashen Keep',col:'#8a5a4a',pat:'ring8',pat2:'spiral',
  title:'unsleeping warden of the ember-gate',
  desc:'Rotating rings of cinder-fire. Match its spin and orbit through the safe lane.'},
 {n:'The Ashfall Reaper',dn:'The Cinder Crypt',col:'#9a5540',pat:'aimed3',pat2:'ring8',
  title:'harvester walking the drifting ash',
  desc:'Rapid aimed scythes of flame that quicken as it wounds. Burst it before it enrages.'},
 {n:'Charstep Behemoth',dn:'The Scorch Barrows',col:'#a5502f',pat:'nova',pat2:'charge',
  title:'smouldering colossus leaving fire in its wake',
  desc:'Each footfall a shockwave; it charges through its own flame. Give it wide berth.'},
 {n:'The Glowing Horror',dn:'The Radiant Abyss',col:'#c07a3a',pat:'spiral',pat2:'ring8',
  title:'thing of light that should not be',
  desc:'A dense, blinding spiral. There is always one gap — find it and stay in it.'},
 {n:'Emberflow Wyrm',dn:'The Molten Warren',col:'#d4622a',pat:'ring8',pat2:'aimed3',
  title:'serpent swimming rivers of magma',
  desc:'Coiling fire-rings and sudden aimed lances. Punish it hardest when it uncoils.'},
 {n:'The Heart Devourer',dn:'The Core Sanctum',col:'#ff7a3d',pat:'spiral',pat2:'summon',
  title:'that which waits at the island\'s burning core',
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
// each ring has its own unique mini-boss; only one of a given ring's boss lives at a time
function spawnRingBoss(b){
 if(!curRoom||!curRoom.rings) return;
 if(ringBossAlive(b)) return;
 for(let tries=0;tries<40;tries++){
  const a=Math.random()*6.283, d=300+Math.random()*220;
  const bx=player.x+Math.cos(a)*d, by=player.y+Math.sin(a)*d;
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
