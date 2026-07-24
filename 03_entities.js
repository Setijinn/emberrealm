// ---------- entities ----------
const player={x:0,y:0,r:14,hp:100,maxhp:100,spd:180,dmg:12,fireRate:0.22,fireT:0,kills:0,inv:0};
let curRoom=null, enemies=[], pShots=[], eShots=[], particles=[], embers=[];
let rpg=null, texts=[], respawnT=1, shopNear=false, loots=[];
let allies=[], zones=[], fx=[], res=0, lastShotT=99, abT=0, portalLock=false, curRegionN='';
let portalPrompt=null;   // {kind,x,y,label,...} nearest interactable portal/pillar (USE-gated)
let bossBar=null;        // boss whose big top-screen hp bar is showing (set on first hit)
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
 0:[ // Heartwood Hollow (19x14) — the Grovewarden's den, root-clump cover
  'XXXXXXXXXXXXXXXXXXX',
  'X.................X',
  'X.................X',
  'X.................X',
  'X....X.......X....X',
  'X.................X',
  'X.................X',
  'X.................X',
  'X.................X',
  'X....X.......X....X',
  'X.................X',
  'X.................X',
  'X.................X',
  'XXXXXXXX...XXXXXXXX'],
 1:[ // Fogbound Glade (19x14) — the Mistantler's den, thicket cover
  'XXXXXXXXXXXXXXXXXXX',
  'X.................X',
  'X.................X',
  'X..X...........X..X',
  'X.................X',
  'X.................X',
  'X......X...X......X',
  'X.................X',
  'X.................X',
  'X..X...........X..X',
  'X.................X',
  'X.................X',
  'X.................X',
  'XXXXXXXX...XXXXXXXX'],
 2:[ // Sunken Warren (20x15) — the Bog Horror's marsh warren, mud islets
  'XXXXXXXXXXXXXXXXXXXX',
  'X..................X',
  'X..................X',
  'X...XX........XX...X',
  'X..................X',
  'X..................X',
  'X........X.........X',
  'X..................X',
  'X..................X',
  'X..................X',
  'X...XX........XX...X',
  'X..................X',
  'X..................X',
  'X..................X',
  'XXXXXXXXX...XXXXXXXX'],
 3:[ // Shattered Vault (21x15) — Stonefist's ruin, broken pillar rows
  'XXXXXXXXXXXXXXXXXXXXX',
  'X...................X',
  'X...................X',
  'X...X....X....X.....X',
  'X...................X',
  'X...................X',
  'X...................X',
  'X...................X',
  'X...................X',
  'X...................X',
  'X...X....X....X.....X',
  'X...................X',
  'X...................X',
  'X...................X',
  'XXXXXXXXX...XXXXXXXXX'],
 4:[ // Windward Roost (20x14) — the Crag Gargoyle's eyrie, scattered crag teeth
  'XXXXXXXXXXXXXXXXXXXX',
  'X..................X',
  'X..................X',
  'X.....X......X.....X',
  'X..................X',
  'X..................X',
  'X..................X',
  'X..X............X..X',
  'X..................X',
  'X..................X',
  'X.....X......X.....X',
  'X..................X',
  'X..................X',
  'XXXXXXXXX...XXXXXXXX'],
 5:[ // Scorch Barrows (21x16) — Magmaw's keep, obsidian pillar clusters
  'XXXXXXXXXXXXXXXXXXXXX',
  'X...................X',
  'X..XX.....X.....XX..X',
  'X...................X',
  'X...................X',
  'X.....X.......X.....X',
  'X...................X',
  'X...................X',
  'X...................X',
  'X.....X.......X.....X',
  'X...................X',
  'X...................X',
  'X..XX...........XX..X',
  'X...................X',
  'X...................X',
  'XXXXXXXXX...XXXXXXXXX'],
 6:[ // Cinder Crypt (20x15) — the Ash Wraith's tombyard, grave rows
  'XXXXXXXXXXXXXXXXXXXX',
  'X..................X',
  'X..................X',
  'X..X.....X.....X...X',
  'X..................X',
  'X..................X',
  'X..................X',
  'X..................X',
  'X..................X',
  'X..................X',
  'X...X.....X.....X..X',
  'X..................X',
  'X..................X',
  'X..................X',
  'XXXXXXXXX...XXXXXXXX'],
 7:[ // Ashen Keep (21x16) — the Cinder Demon's fortress, bastion piers
  'XXXXXXXXXXXXXXXXXXXXX',
  'X...................X',
  'X..XX...........XX..X',
  'X..XX...........XX..X',
  'X...................X',
  'X...................X',
  'X.......X...X.......X',
  'X...................X',
  'X...................X',
  'X...................X',
  'X.......X...X.......X',
  'X...................X',
  'X..XX...........XX..X',
  'X..XX...........XX..X',
  'X...................X',
  'XXXXXXXXX...XXXXXXXXX'],
 8:[ // Core Sanctum (23x17) — the Molten Titan's throne hall, grand colonnade
  'XXXXXXXXXXXXXXXXXXXXXXX',
  'X.....................X',
  'X.....................X',
  'X....X.....X.....X....X',
  'X.....................X',
  'X.....................X',
  'X.....................X',
  'X..X...............X..X',
  'X.....................X',
  'X.....................X',
  'X.....................X',
  'X.....................X',
  'X....X.....X.....X....X',
  'X.....................X',
  'X.....................X',
  'X.....................X',
  'XXXXXXXXXX...XXXXXXXXXX'],
};
const LAIR_STAMP_BANDS=[0,1,2,3,4,5,6,7,8];   // all 9 zones have lairs
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
  // ORGANIC arena (user: "boss arenas less square — almost nothing should be perfect squares").
  // Instead of stamping the rectangular template, carve an irregular LOBED cavern inside the
  // template's footprint: an ellipse whose radius wobbles with angle + per-cell noise, wrapped
  // in a ragged 'X' wall ring, open at a south doorway, with a few scattered interior pillars.
  const cx=px+TW/2, cy=py+TH/2, rx=TW/2-0.6, ry=TH/2-0.6;
  const _lh=(tx,ty)=>{ let h=(Math.imul(tx+b*131+7,374761393)+Math.imul(ty+b*257+3,668265263))>>>0;
    h=Math.imul(h^(h>>>13),1274126177)>>>0; return ((h^(h>>>16))&255)/255; };
  const floorAt=(tx,ty)=>{ const nx=(tx+0.5-cx)/rx, ny=(ty+0.5-cy)/ry, a=Math.atan2(ny,nx);
    const wob=0.80+0.17*Math.sin(a*3+b)+0.10*Math.sin(a*5-b*2)+0.05*(_lh(tx,ty)-0.5);
    return (nx*nx+ny*ny) < wob*wob; };
  const inGrid=(tx,ty)=>tx>0&&ty>0&&tx<R.w-1&&ty<R.h-1;
  const ground=(tx,ty)=>{ const c=R.grid[ty]&&R.grid[ty][tx]; return c!=null&&'wWhHlXFDP'.indexOf(c)<0; };
  const bx0=px-2,bx1=px+TW+2,by0=py-2,by1=py+TH+2;
  // pass 1: floor
  for(let ty=by0;ty<by1;ty++)for(let tx=bx0;tx<bx1;tx++) if(inGrid(tx,ty)&&floorAt(tx,ty)&&ground(tx,ty)) R.grid[ty][tx]='F';
  // pass 2: ragged wall ring around the floor, with a ~4-wide doorway at the south-centre
  for(let ty=by0;ty<by1;ty++)for(let tx=bx0;tx<bx1;tx++){ if(!inGrid(tx,ty)||R.grid[ty][tx]==='F'||!ground(tx,ty)) continue;
    let touch=false; for(let dy=-1;dy<=1&&!touch;dy++)for(let dx=-1;dx<=1;dx++){ if(R.grid[ty+dy]&&R.grid[ty+dy][tx+dx]==='F'){touch=true;break;} }
    if(!touch) continue;
    if(ty>cy+ry*0.35 && Math.abs(tx-cx)<2.4) continue;    // leave the south doorway open
    R.grid[ty][tx]='X'; }
  // pass 3: a few scattered interior cover pillars (never near the boss's centre or the door)
  for(let i=0;i<5;i++){ const a=(i/5)*6.283+b, rr=0.42+0.28*_lh(px+i,py+i);
    const tx=Math.round(cx+Math.cos(a)*rx*rr), ty=Math.round(cy+Math.sin(a)*ry*rr);
    if(inGrid(tx,ty)&&R.grid[ty][tx]==='F'&&Math.hypot(tx-cx,ty-cy)>2.4&&!(ty>cy&&Math.abs(tx-cx)<2.4)){
      R.grid[ty][tx]='X'; if(_lh(tx+1,ty)>0.5&&R.grid[ty][tx+1]==='F') R.grid[ty][tx+1]='X'; } }
  // decor scattered on the INTERIOR floor (the old corner spots now fall in the ragged walls)
  const _decos=[]; for(let i=0;i<7;i++){ const a=(i/7)*6.283+b*1.3, rr=0.40+0.22*_lh(px+i*3,py-i);
    const dx=cx+Math.cos(a)*rx*rr, dy=cy+Math.sin(a)*ry*rr, tx=Math.round(dx), ty=Math.round(dy);
    if(R.grid[ty]&&R.grid[ty][tx]==='F'&&Math.hypot(tx-cx,ty-cy)>1.6) _decos.push({x:dx*TILE,y:dy*TILE,i:i%4}); }
  R.lairs[b]={ b, px, py, tw:TW, th:TH,
    spawn:{x:cx*TILE, y:(cy+ry*0.20)*TILE},                 // boss stands just south of centre, on floor
    sprite:{x:cx*TILE, y:(cy-ry*0.55)*TILE},                // den centrepiece toward the back
    decos:_decos };
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
  const lv=grvLvAtY(by/TILE);   // boss level matches where its lair sits in the zone
  const GB=GBOSS[b], PJ=BOSS_PROJ[b]||{};
  // matched to zone: modest early, monstrous late — on the unified difficulty curve
  const chaserHp=40*eHpScale(lv);
  const size=24+ (lv/LV_CAP)*22;       // small on the sands, huge at the core
  const boss={type:'B',wb:true,ring:b,x:bx,y:by,r:size,hp:Math.round(chaserHp*6),maxhp:Math.round(chaserHp*6),
   spd:34+(lv/LV_CAP)*26,fireT:1.4,ang:0,col:GB.col,bd:5+eDmgScale(lv)*0.56,lv:lv,boss:true,name:GB.n,
   pat:GB.pat,pat2:GB.pat2,chargeT:0,sumT:3,
   pcol:PJ.col,pcore:PJ.core,pshape:PJ.shape,psize:PJ.size||7};
  enemies.push(boss);
  msg('\u2620 '+GB.n,GB.title);
  setTimeout(function(){ if(enemies.indexOf(boss)>=0) msg(GB.n,GB.desc); },1700);
  return;
 }
}
// ---- Awakened dungeons: the slain boss's CONSCIOUSNESS ----
// A long 4-chamber gauntlet — each middle chamber locks the next gate behind a themed
// objective (destroy nodes / gather essences / awaken seals / slay every phantom),
// ending in the AWAKENED boss's arena. Themed nouns keep each mind distinct.
const DOBJ_NOUN={
 0:{slay:'Root-Hearts',collect:'Spirit Seeds', switch:'Grove Seals'},
 1:{slay:'Fog Anchors', collect:'Wisp Lights',  switch:'Antler Shrines'},
 2:{slay:'Spore Sacs',  collect:'Marsh Pearls', switch:'Drain Valves'},
 3:{slay:'Rune Cores',  collect:'Vault Shards', switch:'Rune Seals'},
 4:{slay:'Wind Totems', collect:'Storm Feathers',switch:'Gale Horns'},
 5:{slay:'Ember Hearts',collect:'Magma Tears',  switch:'Fire Seals'},
 6:{slay:'Soul Urns',   collect:'Grave Candles',switch:'Crypt Bells'},
 7:{slay:'War Idols',   collect:'Cinder Crowns',switch:'Gate Braziers'},
 8:{slay:'Crown Sigils',collect:'Gold Motes',   switch:'Titan Locks'},
};
// Every mind has ONE signature puzzle (alternating with combat chambers):
// regrow / chase / order / simon / hold / relay / candles / ambush / timing.
const DPUZ=['regrow','chase','order','simon','hold','relay','candles','ambush','timing'];
const DPUZ_LABEL=[
 'Sever the Root-Hearts before the grove reknits',
 'Catch the fleeing Wisp',
 'Open the Drain Valves — in order',
 'Repeat the Rune Plates',
 'Channel the Gale Circles',
 'Ember Relay — keep the flame moving',
 'Keep every Grave Candle lit',
 'Shatter the War Idols — survive the ambush',
 'Awaken the Titan Locks as they glow'];
const DOBJ_PLAN={};
for(let r=0;r<9;r++) DOBJ_PLAN[r]=[DPUZ[r],'waves'];
// Per-ring dungeon ARCHITECTURE: room shape, edge irregularity, radii, corridor
// wobble/width, spacing. This is what makes each mind read differently on the map.
const DSHAPE=[
 {room:'blob', irr:0.55,rmin:8, rmax:12,wob:2.5,cw:2.0,gap:9 },  // 0 root caves
 {room:'round',irr:0.10,rmin:6, rmax:9, wob:3.5,cw:1.6,gap:15},  // 1 misty glades, thin winding paths
 {room:'blob', irr:0.80,rmin:8, rmax:12,wob:3.0,cw:2.3,gap:10},  // 2 ragged bog warren
 {room:'vault',irr:0.0, rmin:7, rmax:10,wob:0.0,cw:2.0,gap:14},  // 3 shattered vault (elbow halls)
 {room:'round',irr:0.15,rmin:5, rmax:7, wob:4.2,cw:1.5,gap:17},  // 4 wind ledges + perches
 {room:'blob', irr:0.50,rmin:9, rmax:13,wob:2.0,cw:2.6,gap:9 },  // 5 magma caverns
 {room:'cells',irr:0.35,rmin:8, rmax:11,wob:1.5,cw:1.6,gap:9 },  // 6 catacomb cell-clusters
 {room:'vault',irr:0.0, rmin:9, rmax:12,wob:0.0,cw:2.4,gap:15},  // 7 fortress halls
 {room:'round',irr:0.08,rmin:10,rmax:13,wob:1.0,cw:2.2,gap:10},  // 8 grand sanctums
];
function genDungeon(ring){
 const _n=rooms['G'].rings.names[ring];
 // the mind is a step beyond the zone's peak — "matching but a little more difficult"
 const lv=Math.min(160,(_n.lv2!==undefined?_n.lv2:_n.lv)+5);
 // seeded PRNG — every ring gets its OWN layout, stable across visits.
 // MIRRORED 1:1 by scratchpad dun_gen2.py (structural validation) — keep in sync.
 let _s=(ring*7919+1013)>>>0;
 const rng=function(){ _s=(_s+0x6D2B79F5)>>>0;
  let t=Math.imul(_s^(_s>>>15),1|_s); t=(t+Math.imul(t^(t>>>7),61|t))^t;
  return ((t^(t>>>14))>>>0)/4294967296; };
 const seed=ring*7919+1013;
 const chash=(x,y)=>{ let h=(Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(seed,971))>>>0;
  h=Math.imul(h^(h>>>13),1274126177)>>>0; return ((h^(h>>>16))>>>0)/4294967296; };
 const st=DSHAPE[ring];
 const W2=170+ring*26, H2=84, g=[];
 for(let y=0;y<H2;y++){ const row=[]; for(let x=0;x<W2;x++) row.push('W'); g.push(row); }
 // deeper minds are LONGER: ring 0 ~4-5 chambers, ring 8 ~8-9
 const NCH=4+Math.floor(ring*0.55)+Math.floor(rng()*2);
 const chs=[]; let cx=18, cy=36;
 const step=st.rmax+st.gap+st.rmax;
 for(let i=0;i<NCH;i++){
  let r=st.rmin+rng()*(st.rmax-st.rmin);
  const aspect=st.room==='round'?0.7+rng()*0.5:0.85+rng()*0.3;
  if(i===NCH-1) r*=1.25;                        // boss arena is grander
  chs.push({cx:cx,cy:cy,r:r,ry:r*aspect,out:'E'});
  if(i===NCH-1) break;
  const d=rng();
  const vstep=Math.min(step,24);                // vertical hops shorter — grid is wide, not tall
  let dir=(d<0.55||i===NCH-2)?'E':(d<0.775?'N':'S');
  if(dir==='E'&&cx+step>W2-20) dir=(cy>Math.floor(H2/2))?'N':'S';
  if(dir==='N'&&cy-vstep<16) dir='S';
  if(dir==='S'&&cy+vstep>H2-16) dir='N';
  if(dir==='E') cx+=step; else cy+=(dir==='S'?1:-1)*vstep;
  cx=Math.min(cx,W2-18); cy=Math.max(16,Math.min(H2-16,cy));
  chs[i].out=dir;
 }
 const carveCell=(x,y)=>{ if(x>=1&&x<W2-1&&y>=1&&y<H2-1) g[y][x]='.'; };
 // ---- carve rooms in the ring's architecture ----
 for(const c of chs){
  const r=c.r, ry=c.ry;
  if(st.room==='blob'||st.room==='round'||st.room==='cells'){
   let subs=[[0,0,1.0]];
   if(st.room==='cells'){ const k=3+Math.floor(rng()*2); subs=[];
    for(let q=0;q<4;q++){ const ox=(rng()*2-1)*r*0.75, oy=(rng()*2-1)*ry*0.75;
     if(q<k) subs.push([ox,oy,0.55]); } }
   for(const sub of subs){ const ox=sub[0], oy=sub[1], fr=sub[2];
    const rr=r*fr, rry=ry*fr;
    const x0=Math.floor(c.cx+ox-rr-3), x1=Math.floor(c.cx+ox+rr+3);
    const y0=Math.floor(c.cy+oy-rry-3), y1=Math.floor(c.cy+oy+rry+3);
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
     const dx=(x-(c.cx+ox))/rr, dy=(y-(c.cy+oy))/rry;
     const dd=Math.sqrt(dx*dx+dy*dy);
     const edge=1.0+(chash(x,y)-0.5)*st.irr*2;
     if(dd<=edge) carveCell(x,y); } }
  } else { // vault: main hall + 2 offset side rooms (asymmetric composite)
   const w=Math.floor(r*1.5), h=Math.floor(ry*1.1);
   for(let y=Math.floor(c.cy-h);y<=Math.floor(c.cy+h);y++)
    for(let x=Math.floor(c.cx-w);x<=Math.floor(c.cx+w);x++) carveCell(x,y);
   for(let q=0;q<2;q++){ const sw=Math.floor(3+rng()*3), sh=Math.floor(2+rng()*3);
    const sx=Math.floor(c.cx+(rng()*2-1)*(w-sw-1));
    const sy=Math.floor(c.cy+(rng()<0.5?1:-1)*(h+sh-1));
    for(let y=sy-sh;y<=sy+sh;y++)for(let x=sx-sw;x<=sx+sw;x++) carveCell(x,y); } }
 }
 // ---- corridors (wavy polyline or elbow) with dream-path spine; gates stamped LAST ----
 const brush=(fx,fy,rad)=>{ for(let y=Math.floor(fy-rad);y<=Math.floor(fy+rad);y++)
  for(let x=Math.floor(fx-rad);x<=Math.floor(fx+rad);x++)
   if((x-fx)*(x-fx)+(y-fy)*(y-fy)<=rad*rad) carveCell(x,y); };
 const gatePts=[], gatesByCh=[];
 for(let i=0;i<NCH-1;i++){ const a=chs[i], b=chs[i+1];
  const ph=rng()*6.283, midf=0.35+rng()*0.3;
  const ax=a.cx, ay=a.cy, bx=b.cx, by=b.cy;
  const dist=Math.hypot(bx-ax,by-ay), steps=Math.max(8,Math.floor(dist*2));
  const pts=[]; let gpt=null;
  if(st.room==='vault'){
   let segs;
   if(a.out==='E'){ const mx=ax+(bx-ax)*midf; segs=[[ax,ay],[mx,ay],[mx,by],[bx,by]]; gpt=[mx,(ay+by)/2]; }
   else { const my=ay+(by-ay)*midf; segs=[[ax,ay],[ax,my],[bx,my],[bx,by]]; gpt=[(ax+bx)/2,my]; }
   for(let si=0;si<segs.length-1;si++){ const x0=segs[si][0],y0=segs[si][1],x1=segs[si+1][0],y1=segs[si+1][1];
    const sl=Math.max(2,Math.floor(Math.hypot(x1-x0,y1-y0)*2));
    for(let t=0;t<=sl;t++){ const f=t/sl; pts.push([x0+(x1-x0)*f, y0+(y1-y0)*f]); } }
  } else {
   const pxn=-(by-ay)/(dist||1), pyn=(bx-ax)/(dist||1);
   for(let t=0;t<=steps;t++){ const f=t/steps;
    const fade=Math.sin(f*Math.PI);              // no wobble at the ends
    const off=Math.sin(f*Math.PI*2+ph)*st.wob*fade;
    pts.push([ax+(bx-ax)*f+pxn*off, ay+(by-ay)*f+pyn*off]); }
   gpt=pts[Math.floor(pts.length/2)];
  }
  for(const p2 of pts) brush(p2[0],p2[1],st.cw);
  // dream-path spine along the corridor
  for(const p2 of pts){ const fx=p2[0], fy=p2[1];
   for(let y=Math.floor(fy-1);y<=Math.floor(fy+1);y++)
    for(let x=Math.floor(fx-1);x<=Math.floor(fx+1);x++)
     if((x-fx)*(x-fx)+(y-fy)*(y-fy)<=1.0&&x>=1&&x<W2-1&&y>=1&&y<H2-1&&g[y][x]==='.') g[y][x]='p'; }
  if(i>0) gatePts.push(gpt);
 }
 for(const gp of gatePts){ const gx=gp[0], gy=gp[1], cells=[];
  const rad=st.cw+1.6;
  for(let y=Math.floor(gy-rad)-1;y<=Math.floor(gy+rad)+1;y++)
   for(let x=Math.floor(gx-rad)-1;x<=Math.floor(gx+rad)+1;x++)
    if((x-gx)*(x-gx)+(y-gy)*(y-gy)<=rad*rad&&x>0&&x<W2-1&&y>0&&y<H2-1&&(g[y][x]==='.'||g[y][x]==='p')){
     g[y][x]='D'; cells.push({x:x,y:y}); }
  gatesByCh.push(cells);
 }
 const room={key:'DUN',grid:g,w:W2,h:H2,lv:lv,band:'boss',town:false,big:false,dungeon:true,
  glows:[],portals:[],spawns:[],regions:null,rings:null,ring:ring,
  px:Math.floor(chs[0].cx),py:Math.floor(chs[0].cy),
  orbs:[], switches:[], plates:[], circles:[], chases:[], objs:[], ddec:[] };
 // objectives: chambers 1..NCH-2 alternate the ring's SIGNATURE puzzle with combat
 for(let ci=1;ci<NCH-1;ci++){ const c=chs[ci], oi=ci-1;
  const isSig=(oi%2===0);
  const type=isSig?DPUZ[ring]:'waves';
  const obj={type:type,mode:type,ch:oi,need:3,got:0,done:false,gateCells:gatesByCh[oi]||[],
   bounds:{x0:Math.floor(c.cx-c.r)-4,y0:Math.floor(c.cy-c.ry)-4,
           x1:Math.floor(c.cx+c.r)+4,y1:Math.floor(c.cy+c.ry)+4},
   label:type==='waves'?'Slay every phantom':DPUZ_LABEL[ring],
   spots:[], rgT:0, snuffT:0, demoT:0, timer:0};
  if(isSig){
   // 3 puzzle spots via rejection sampling on the organic floor (mirrored by the sim)
   for(let q=0;q<3;q++){ let sx=null, sy=null;
    for(let t2=0;t2<24;t2++){ const tx2=Math.floor(c.cx+(rng()*2-1)*c.r*0.7);
     const ty2=Math.floor(c.cy+(rng()*2-1)*c.ry*0.7);
     if(tx2>0&&tx2<W2-1&&ty2>0&&ty2<H2-1&&g[ty2][tx2]==='.'){ sx=tx2; sy=ty2; break; } }
    if(sx===null){ sx=Math.floor(c.cx)+q; sy=Math.floor(c.cy); }
    const px2=(sx+.5)*TILE, py2=(sy+.5)*TILE;
    obj.spots.push({tx:sx,ty:sy,x:px2,y:py2});
    if(type==='regrow'||type==='ambush') room.spawns.push({t:'N',x:sx,y:sy,ch:oi});
    else if(type==='order'||type==='relay'||type==='timing')
     room.switches.push({x:px2,y:py2,ch:oi,on:false,idx:q,mode:type});
    else if(type==='simon'||type==='candles')
     room.plates.push({x:px2,y:py2,ch:oi,on:false,idx:q,mode:type});
    else if(type==='hold') room.circles.push({x:px2,y:py2,ch:oi,prog:0,lit:false}); }
   if(type==='chase') room.chases.push({ch:oi,x:obj.spots[0].x,y:obj.spots[0].y,wt:0});
  } else obj.need=-1;
  // mob packs in this chamber (denser deeper into the mind); 2 rng draws per pack
  const nm=3+Math.floor(rng()*2)+Math.floor(ci*0.7);
  for(let q=0;q<nm;q++){ const ra=rng(), rb=rng();
   const sx=Math.floor(c.cx+(ra*2-1)*c.r*0.8), sy=Math.floor(c.cy+(rb*2-1)*c.ry*0.8);
   if(sx>0&&sx<W2-1&&sy>0&&sy<H2-1&&g[sy][sx]==='.')
    room.spawns.push({t:ra<0.4?'s':'c',x:sx,y:sy,ch:oi}); }
  room.objs.push(obj); }
 const bc=chs[NCH-1];
 room.spawns.push({t:'B',x:Math.floor(bc.cx),y:Math.floor(bc.cy),ch:99});
 // entry + boss centres guaranteed open (mirror: python brushes these at the end)
 brush(chs[0].cx,chs[0].cy,2.5); brush(bc.cx,bc.cy,3.0);
 // --- everything below is JS-only garnish (no grid mutation the sim needs) ---
 // a light welcome pack in the entry chamber
 for(let q=0;q<2;q++){ const c=chs[0];
  const sx=Math.floor(c.cx+(rng()*2-1)*c.r*0.7), sy=Math.floor(c.cy+(rng()*2-1)*c.ry*0.7);
  if(sx>0&&sx<W2-1&&sy>0&&sy<H2-1&&g[sy][sx]==='.'&&(sx!==room.px||sy!==room.py))
   room.spawns.push({t:'c',x:sx,y:sy,ch:-1}); }
 // dream decor scattered through every chamber (crystals, saplings, sunken faces,
 // spectral braziers, memory shards, rune stumps)
 chs.forEach(function(c,i){ const k=2+Math.floor(rng()*3);
  for(let q=0;q<k;q++){ const dx2=Math.floor(c.cx+(rng()*2-1)*c.r*0.8);
   const dy2=Math.floor(c.cy+(rng()*2-1)*c.ry*0.8);
   if(dx2<=0||dx2>=W2-1||dy2<=0||dy2>=H2-1) continue;
   if(g[dy2][dx2]!=='.'||(Math.abs(dx2-c.cx)<3&&Math.abs(dy2-c.cy)<3)) continue;
   room.ddec.push({x:(dx2+.5)*TILE,y:(dy2+.5)*TILE,i:Math.floor(rng()*6)}); } });
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
 {id:'bram', name:'Bram', role:'WEAPONS', title:"BRAM'S WEAPONWORKS", awn:'#b5482f', x:9.5*TILE,  y:10.8*TILE},
 {id:'sella',name:'Sella',role:'ARMOR',   title:"SELLA'S ARMORY",     awn:'#e07a2e', x:9.5*TILE,  y:18.3*TILE},
 {id:'maren',name:'Maren',role:'POTIONS', title:"MAREN'S PROVISIONS", awn:'#4f9a3f', x:32.5*TILE, y:10.8*TILE},
 {id:'odo',  name:'Odo',  role:'PETS',    title:"ODO'S MENAGERIE",    awn:'#7ab8d4', x:32.5*TILE, y:18.3*TILE},
];
let curShopNear=null;
// ---- unified difficulty curve ----
// EVERY enemy stat derives from these two so the whole game rescales in unison.
// Linear early (unchanged feel in the first zones) + quadratic late: player power
// compounds (tier² weapons × rarity × tree × attack speed), so enemies must too —
// with only the old linear curve the realm got EASIER as you climbed.
// RETUNED for the perk trees + ascension ultimates (rule 8c: the curve must assume capstone
// AND ultimate power at endgame). Measured: this curve was calibrated against a hero with NO
// tree investment (TTK 1.2s at Lv1 -> 5.44s at Lv150, matching its design intent), but a
// fully-specced ascended hero cut endgame TTK to 3.10s — the trees alone made the late game
// ~1.75x easier than designed, before ultimates added ~40% more effective DPS.
// hpQuad carries the correction because it is ~nil early and dominant late: enemy HP is
// untouched in the first zones, +36% by Lv40, +60% by Lv150 — tracking how perk points
// actually accumulate. dmQuad rises only slightly: with permadeath from Lv20, death should
// come from readable pattern pressure (rule 5b), not from single hits turning lethal.
// HARDER PASS (user, 2026-07-24 — "make the game overall more difficult"): on top of a ~50%
// spawn-density increase (more enemies = more bullets = the fun, dodgeable axis of harder),
// enemies are tankier and hit harder across the board. hp +9% base / more late, damage +15%
// base — every zone bites now, not only the endgame. Deaths still come from patterns, not
// one-shots (rule 5b), so dmg is raised via the linear term rather than the quadratic.
// LEVEL-AXIS COMPRESSION 150->50 (world rework): the level axis shrank 3x, so an enemy at the
// new lv reads the same as the old enemy at 3*lv. eHpScale/eDmgScale(lv) ~= old(3*lv) means the
// LINEAR terms ×3 and the QUADRATIC terms ×9 (since (3lv)^2 = 9lv^2). Player level-stats/tree/
// gear-tier were scaled to match, so a Lv50 hero vs a Lv50 enemy == the old Lv150 matchup. Then
// verified/nudged with the TTK harness. Old (Lv150): {0.60,0.024,0.95,0.016}.
const DIFF={hpLin:1.80, hpQuad:0.216, dmLin:2.85, dmQuad:0.144};
function eHpScale(lv){ return 1 + lv*DIFF.hpLin + lv*lv*DIFF.hpQuad; }
function eDmgScale(lv){ return lv*DIFF.dmLin + lv*lv*DIFF.dmQuad; }
// ---- enemy BEHAVIOURS (user, 2026-07-24) — each is a personality that changes how the
// enemy SPAWNS (dormant? anchored? in a pack?) and ROAMS (chase / kite / guard / wander),
// consumed by the movement code in 07_update via enemyAI(). Difficulty comes from these +
// the DIFF stat curve, NOT from spawning more of them. Params are tunable here.
//   hunter     relentless straight-line chase (the classic)
//   pack       steers toward nearby pack-mates AND you -> coordinated swarms, faster in numbers
//   ambusher   DORMANT until you step close, then a fast lunge burst (spawn: sits inert)
//   sentinel   guards its spawn point; chases only within a leash, else returns and patrols; tankier
//   roamer     wanders the ground when you're far, hunts when you're near (the map feels alive)
//   skirmisher (shooters) KITES — backs off when you close in, holds at range and fires
const EBEH={
  hunter:    {},
  pack:      {cohesion:150, packBuff:0.16},
  ambusher:  {wake:200, burst:1.95, burstT:1.4, hpMul:0.85, touchMul:1.35},
  sentinel:  {leash:360, hpMul:1.55, spdMul:0.9},
  roamer:    {engage:540, wander:0.42},
  skirmisher:{kiteMin:175, kiteMax:300, spdMul:2.4},
};
// deterministic per-spawn so a given spot keeps its character across respawns (a guarded
// chokepoint stays guarded). Variety + danger rise with the band.
function pickBehaviour(sp,lv,type){
  const b=Math.max(0,Math.min(8,Math.round(lv/5.5)));   // behaviour-variety band (Lv50 -> full set)
  const h=(Math.imul(sp.x|0,374761393)+Math.imul(sp.y|0,668265263))>>>0;
  const roll=(h^(h>>>13))%100;
  if(type==='s'){
    if(roll < 26+b*4) return 'skirmisher';
    if(roll < 42+b*2) return 'sentinel';
    if(roll < 55)     return 'roamer';
    return 'hunter';
  }
  if(roll < 16+b*3) return 'pack';
  if(roll < 30+b*4) return 'ambusher';
  if(roll < 44+b*2) return 'sentinel';
  if(roll < 58)     return 'roamer';
  return 'hunter';
}
function makeEnemy(sp){
  const lv=roomLvAt(sp);
  const hm=eHpScale(lv), dm=eDmgScale(lv);
  let e;
  if(sp.t==='c') e={type:'c',r:15,hp:40*hm,spd:95+Math.min(60,lv*0.6),touch:12+dm,col:'#c04a3d'};
  else if(sp.t==='s') e={type:'s',r:16,hp:60*hm,spd:45,fireT:1,bd:8+dm*0.63,col:'#8a5ac0'};
  else if(sp.t==='N'){ // dungeon objective node: stationary, harmless, must be destroyed
    const th=GBOSS[(curRoom&&curRoom.ring)||0];
    e={type:'N',r:16,hp:Math.round(46*hm),spd:0,touch:0,col:th?th.col:'#7ab8d4',node:true}; }
  else { const dr=(curRoom&&curRoom.dungeon)?curRoom.bossRing:-1;
    const GB=dr>=0?GBOSS[dr]:null;
    // dungeon boss = the AWAKENED consciousness: tougher than the flesh it wore,
    // and it always layers both its shot patterns (e.awk bypasses the Lv60 gate)
    e={type:'B',r:GB?32+(lv/LV_CAP)*16:30,hp:Math.round(600*hm*(GB?1.9:1)),spd:GB?44:38,fireT:1.5,ang:0,
     col:GB?GB.col:'#e07a2e',boss:true,bd:(8+dm*0.63)*(GB?1.25:1),
     name:GB?('Awakened '+GB.n):null,pat:GB?GB.pat:'ring8',pat2:GB?GB.pat2:'spiral',
     chargeT:0,sumT:3,wb:!!GB,awk:!!GB}; }
  e.x=(sp.x+.5)*TILE; e.y=(sp.y+.5)*TILE; e.sref=sp; e.lv=lv; if(sp.ch!==undefined) e.ch=sp.ch;
  // assign a behaviour to roaming enemies (not dungeon nodes / bosses) and apply its spawn-time
  // tweaks. home = spawn point (sentinels leash to it); ambushers begin dormant.
  if(e.type==='c'||e.type==='s'){
    e.beh=pickBehaviour(sp,lv,e.type); const B=EBEH[e.beh]||EBEH.hunter;
    e.home={x:e.x,y:e.y}; e.roamA=Math.random()*6.283;
    if(B.hpMul) e.hp*=B.hpMul;
    if(B.spdMul) e.spd*=B.spdMul;
    if(B.touchMul&&e.touch) e.touch*=B.touchMul;
    if(e.beh==='ambusher') e.dormant=true;
  }
  // NEVER spawn inside a wall — grove lairs stamp 'X' over old spawn spots, and any
  // future caller might pass a bad tile; relocate to the nearest open cell.
  if(typeof solid==='function'&&curRoom&&solid(e.x,e.y)){
    const ss=safeSpot(curRoom,e.x,e.y); e.x=ss.x; e.y=ss.y; }
  // group scaling: enemies grow with how many heroes are actually here (co-op)
  const cn=(typeof coopNearCount==='function')?coopNearCount(e.x,e.y):1;
  if(cn>1){ e.hp*=1+0.65*(cn-1);
    if(e.touch) e.touch*=1+0.22*(cn-1);
    if(e.bd) e.bd*=1+0.22*(cn-1); }
  e.hp=Math.round(e.hp); e.maxhp=e.hp;
  return e;
}
function slowF(e){return e.slowT>0?0.55:1;}
function safeSpot(r,px,py){
 function sol(tx,ty){ if(ty<1||ty>=r.h-1||tx<1||tx>=r.w-1) return true;
  return 'WhlHwtkXD'.indexOf(r.grid[ty][tx])>=0; }   // incl. lair walls + dream gates
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
// Continuous enemy level: interpolates from a zone's entry lv at its bottom to its exit lv
// at its top — so the top of one zone matches the bottom of the next (no difficulty cliffs).
function grvLvAtY(ty){ const R=curRoom; if(!R||!R.rings) return (R&&R.lv)||1;
 const NZ=R.rings.names.length, H=R.h||1;
 const p=Math.max(0,Math.min(NZ-0.001,(1-ty/H)*NZ)), b=Math.floor(p), f=p-b;
 const n=R.rings.names[b], lo=n.lv, hi=(n.lv2!==undefined)?n.lv2:((b+1<NZ)?R.rings.names[b+1].lv:n.lv+10);
 return Math.max(1,Math.round(lo+(hi-lo)*f)); }
function regionAtPx(px,py){ if(!curRoom) return null;
 if(curRoom.rings) return ringInfoAt(px/TILE,py/TILE);
 if(!curRoom.regions) return null;
 const tx=px/TILE, ty=py/TILE;
 for(const rg of curRoom.regions){ if(tx>=rg.x1&&tx<rg.x2&&ty>=rg.y1&&ty<rg.y2) return rg; }
 return null; }
function roomLvAt(sp){
 if(curRoom&&curRoom.rings) return grvLvAtY(sp.y);
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
  a.lv=Math.min(LV_CAP, 2+arenaWave*1.3);   // arena scales to the Lv50 cap over its waves
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
