// ---------- accounts, menus, character select ----------
let inGame=false; let isAdmin=false;
const memStore={};
const LS={
 get:(k,d)=>{try{const v=localStorage.getItem(k);return v!==null?JSON.parse(v):(k in memStore?memStore[k]:d);}catch(e){return k in memStore?memStore[k]:d;}},
 set:(k,v)=>{memStore[k]=v;try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
};
let users=LS.get('er-users',{});
let curUser=null;
async function hash(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('emberrealm\u00b7'+s));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
const CLASSES=[
 {id:'squire',n:'Squire',ic:'🛡️',d:'Balanced in all things.',hp:130,spd:170,dmg:12,fr:0.24},
 {id:'ranger',n:'Ranger',ic:'🏹',d:'Fast hands, thin armor.',hp:90,spd:205,dmg:9,fr:0.14},
 {id:'pyro',n:'Pyromancer',ic:'🔥',d:'Bolts that hit like a forge.',hp:80,spd:160,dmg:26,fr:0.38},
 {id:'knight',n:'Knight',ic:'⚔️',d:'A walking wall of iron.',hp:190,spd:145,dmg:14,fr:0.30},
 {id:'rogue',n:'Rogue',ic:'🗡️',d:'Never where the blade lands.',hp:85,spd:230,dmg:8,fr:0.16},
 {id:'cleric',n:'Cleric',ic:'⛑️',d:'Wounds close as fast as they open.',hp:115,spd:170,dmg:10,fr:0.24,regen:3},
 {id:'berserker',n:'Berserker',ic:'🪓',d:'Anger, weaponized.',hp:125,spd:185,dmg:19,fr:0.30},
 {id:'warlock',n:'Warlock',ic:'💀',d:'Every wound he deals feeds him.',hp:95,spd:170,dmg:16,fr:0.28,ls:0.12},
 {id:'frost',n:'Frostweaver',ic:'❄️',d:'Her bolts freeze the blood.',hp:100,spd:170,dmg:13,fr:0.26,slow:true},
 {id:'storm',n:'Stormcaller',ic:'⚡',d:'Lightning stops for no one.',hp:95,spd:180,dmg:12,fr:0.26,pierce:2},
 {id:'hunter',n:'Hunter',ic:'🐺',d:'Two arrows, one breath.',hp:105,spd:195,dmg:8,fr:0.22,shots:2,spread:0.10},
 {id:'arbalest',n:'Arbalest',ic:'🎯',d:'One bolt. One answer.',hp:100,spd:165,dmg:36,fr:0.55},
 {id:'monk',n:'Monk',ic:'🥋',d:'Speed is its own armor.',hp:105,spd:215,dmg:9,fr:0.18},
 {id:'paladin',n:'Paladin',ic:'✨',d:'Faith holds the line.',hp:165,spd:155,dmg:12,fr:0.28,regen:2},
 {id:'necro',n:'Necromancer',ic:'🧟',d:'Death pays him tribute.',hp:90,spd:165,dmg:17,fr:0.30,ls:0.15},
 {id:'bard',n:'Bard',ic:'🎻',d:'Fights in tempo.',hp:100,spd:200,dmg:10,fr:0.20},
 {id:'shaman',n:'Shaman',ic:'🌀',d:'The spirits scatter wide.',hp:110,spd:175,dmg:6,fr:0.24,shots:3,spread:0.22},
 {id:'dragoon',n:'Dragoon',ic:'🐉',d:'Ember-blooded lancer.',hp:145,spd:175,dmg:16,fr:0.28},
];
const $s=id=>document.getElementById(id);
const WTYPE={
 sword:{n:'Sword',shots:3,spread:0.35,spd:380,life:0.28,size:6,dm:1.0,rof:1.0},
 dagger:{n:'Dagger',shots:1,spd:540,life:0.32,size:4,dm:0.75,rof:0.62},
 bow:{n:'Bow',shots:1,spd:640,life:1.2,size:5,dm:1.0,rof:1.0},
 xbow:{n:'Crossbow',shots:1,spd:760,life:1.3,size:6,dm:1.7,rof:1.7,pierce:1},
 staff:{n:'Staff',shots:2,par:11,spd:480,life:0.9,size:6,dm:0.85,rof:1.0},
 wand:{n:'Wand',shots:1,spd:600,life:1.4,size:4,dm:0.9,rof:0.85},
 tome:{n:'Tome',shots:1,spd:330,life:1.1,size:10,dm:1.6,rof:1.5},
 axe:{n:'Axe',shots:2,spread:0.3,spd:400,life:0.35,size:7,dm:1.25,rof:1.25},
 hammer:{n:'Hammer',shots:1,spd:340,life:0.3,size:11,dm:2.2,rof:1.9},
 spear:{n:'Spear',shots:1,spd:700,life:0.55,size:5,dm:1.15,rof:1.1,pierce:2},
 harp:{n:'Harp',shots:3,par:14,spd:430,life:0.8,size:5,dm:0.6,rof:0.8},
 totem:{n:'Totem',shots:5,spread:0.5,spd:380,life:0.5,size:5,dm:0.5,rof:1.0},
};
const CWEAP={squire:'sword',rogue:'dagger',monk:'dagger',ranger:'bow',hunter:'bow',
 arbalest:'xbow',pyro:'staff',frost:'staff',cleric:'wand',storm:'wand',
 warlock:'tome',necro:'tome',berserker:'axe',knight:'hammer',paladin:'hammer',
 dragoon:'spear',bard:'harp',shaman:'totem'};
const CARMOR={squire:'plate',knight:'plate',paladin:'plate',berserker:'plate',dragoon:'plate',
 ranger:'leather',hunter:'leather',rogue:'leather',monk:'leather',arbalest:'leather',bard:'leather',
 pyro:'robe',frost:'robe',cleric:'robe',storm:'robe',warlock:'robe',necro:'robe',shaman:'robe'};
const MATN={plate:'Plate',leather:'Leather',robe:'Robe'};
const RINGN={hp:'Ring of Vigor',dmg:'Ring of Fury',spd:'Ring of Haste'};
const LEGENDS=[
 {id:'hearthrender',slot:'wpn',n:'Hearthrender',price:12000,add:120,rof:1.0,d:'+120 dmg · forged in the first fire'},
 {id:'duskfang',slot:'wpn',n:'Duskfang',price:9000,add:55,rof:0.72,d:'+55 dmg · strikes 40% faster'},
 {id:'aegisflame',slot:'arm',n:'Aegis of the First Flame',price:11000,def:22,hp:120,spd:0,d:'+22 DEF · +120 HP'},
 {id:'wandershroud',slot:'arm',n:"Wanderer's Shroud",price:8000,def:10,hp:40,spd:35,d:'+10 DEF · +40 HP · +35 SPD'},
];
function legById(id){ return LEGENDS.filter(function(L){return L.id===id;})[0]||null; }
const TIER_NAMES=['Cracked','Worn','Iron','Steel','Tempered','Runed','Ember','Obsidian','Storm-forged','Dragonbone','Mythril','Hearthfire'];
const MAXT=12;
function classWT(cls){ return WTYPE[CWEAP[cls]]||WTYPE.sword; }
function weaponAt(cls,t){ t=Math.max(0,Math.min(MAXT-1,t)); const wt=classWT(cls);
 return {n:TIER_NAMES[t]+' '+wt.n, add:Math.round(t*t*1.35+t*2),
  cost:t===0?0:Math.round(30*Math.pow(1.9,t)), tier:t+1}; }
function tierCost(t){return t===0?0:Math.round(30*Math.pow(1.9,t));}
function tierCol(t){ return t>=11?'#ff9c50':t>=9?'#c07ad4':t>=6?'#7ab8d4':t>=3?'#7dc47a':'#cfc8bd'; }
function itemName(it){ if(it.k==='pot')return 'Ember Tonic';
 const p='T'+(it.t+1)+' '+TIER_NAMES[it.t]+' ';
 if(it.k==='wpn')return p+WTYPE[it.wt].n;
 if(it.k==='arm')return p+MATN[it.mt]+' Armor';
 if(it.k==='helm')return p+MATN[it.mt]+' Helm';
 if(it.k==='ring')return 'T'+(it.t+1)+' '+RINGN[it.st];
 return p; }
function canEquip(it,ch){ if(!it||it.k==='pot')return false;
 if(it.k==='wpn')return CWEAP[ch.cls]===it.wt;
 if(it.k==='arm'||it.k==='helm')return CARMOR[ch.cls]===it.mt;
 return it.k==='ring'; }
function itemValue(it){ return it.k==='pot'?8:Math.max(6,Math.round(tierCost(it.t)*0.4)); }
function mkDrop(t){ t=Math.max(0,Math.min(MAXT-1,t)); const r=Math.random();
 if(r<0.5){ const keys=Object.keys(WTYPE);
  return {k:'wpn',wt:keys[Math.floor(Math.random()*keys.length)],t:t}; }
 const mats=['plate','leather','robe'];
 if(r<0.7) return {k:'arm',mt:mats[Math.floor(Math.random()*3)],t:t};
 if(r<0.85) return {k:'helm',mt:mats[Math.floor(Math.random()*3)],t:t};
 return {k:'ring',st:['hp','dmg','spd'][Math.floor(Math.random()*3)],t:t}; }
function bagAt(e,item){ return {x:e.x+(Math.random()*22-11),y:e.y+(Math.random()*22-11),item:item,life:60}; }
function rollLoot(e){
 const lv=e.lv||1;
 const tb=Math.max(0,Math.min(11,Math.round(lv/12.5)));
 const tier=Math.max(0,Math.min(11,tb+Math.floor(Math.random()*3)-1));
 const r=Math.random();
 if(e.type==='B'){ loots.push(bagAt(e,mkDrop(Math.min(11,tb+1))));
   if(Math.random()<0.4) loots.push(bagAt(e,{k:'pot'})); return; }
 if(e.type==='s'){ if(r<0.10) loots.push(bagAt(e,mkDrop(tier)));
   else if(r<0.18) loots.push(bagAt(e,{k:'pot'})); return; }
 if(r<0.06) loots.push(bagAt(e,mkDrop(tier)));
 else if(r<0.12) loots.push(bagAt(e,{k:'pot'}));
}
const ABIL={
 squire:{res:'Valor',col:'#ffc94d',rule:'time',d:'Rally: heal 25% + 50% dmg for 5s'},
 ranger:{res:'Focus',col:'#7dc47a',rule:'hit',d:'Volley: 12-arrow fan'},
 pyro:{res:'Heat',col:'#ff7a3d',rule:'shot',d:'Detonate: fiery blast around you'},
 knight:{res:'Defiance',col:'#c9d2da',rule:'hurt',d:'Bulwark: 4s invulnerable'},
 rogue:{res:'Combo',col:'#c07ad4',rule:'hit',d:'Shadowstep: blink forward, untouchable'},
 cleric:{res:'Grace',col:'#fff0c0',rule:'calm',d:'Sanctuary: full heal'},
 berserker:{res:'Rage',col:'#e2604c',rule:'hurt',d:'Whirlwind: 16-blade ring'},
 warlock:{res:'Essence',col:'#8a5ac0',rule:'hit',d:'Soulburst: drain all nearby foes'},
 frost:{res:'Rime',col:'#9ad4ef',rule:'hit',d:'Winter Nova: freeze everything near'},
 storm:{res:'Charge',col:'#ffe9b0',rule:'time2',d:'Chain Storm: lightning hits 6 foes'},
 hunter:{res:'Instinct',col:'#7dc47a',rule:'kill',d:'Wolfpack: 2 wolves fight for you'},
 arbalest:{res:'Deadeye',col:'#e8b34b',rule:'still',d:'Deadeye: 3 volleys at 3x, pierce all'},
 monk:{res:'Flow',col:'#7ab8d4',rule:'move',d:'Zephyr: +80% speed, brief dodge'},
 paladin:{res:'Faith',col:'#ffd07a',rule:'time',d:'Consecrate: holy ground, 6s'},
 necro:{res:'Souls',col:'#8fd48c',rule:'kill',d:'Raise Dead: 2 skeletons, 12s'},
 bard:{res:'Tempo',col:'#c07ad4',rule:'shot',d:'Crescendo: +50% fire rate, 6s'},
 shaman:{res:'Spirits',col:'#7ab8d4',rule:'time',d:'Spirit Ring: 8 orbiting wards, 8s'},
 dragoon:{res:'Wind-up',col:'#e07a2e',rule:'prox',d:'Skyfall: leap and crater the ground'},
};
function chargeRes(kind){ const rd=player.resDef; if(!rd) return;
 if(rd.rule==='shot'&&kind==='shot') res=Math.min(100,res+2.2);
 else if(rd.rule==='hit'&&kind==='hit') res=Math.min(100,res+3);
 else if(rd.rule==='kill'&&kind==='kill') res=Math.min(100,res+16);
 else if(rd.rule==='hurt'&&kind==='hurt') res=Math.min(100,res+13);
}
function aoe(x,y,r,dmg,col){ fx.push({t:'ring',x:x,y:y,r:r,life:0.35,col:col});
 for(const e of enemies){ if(Math.hypot(e.x-x,e.y-y)<r){ e.hp-=dmg; e.flash=0.15;
  texts.push({x:e.x,y:e.y-e.r,txt:dmg,col:col,life:0.6}); } } boom(x,y,col,20); }
function doAbility(){
 if(res<100||!rpg||!inGame) return; const ch=curChar(); if(!ch)return;
 const cls=ch.cls; res=0;
 if(cls==='squire'){ player.hp=Math.min(player.maxhp,player.hp+player.maxhp*0.25); player.bDmgT=5; player.bDmgM=1.5; }
 else if(cls==='ranger'){ const a0=player.aim||0;
   for(let i=0;i<12;i++){ const sa=a0+(i-5.5)*0.12;
     pShots.push({x:player.x,y:player.y,px:player.x,py:player.y,vx:Math.cos(sa)*640,vy:Math.sin(sa)*640,r:5,life:1.1,dmg:player.dmg,pierce:0,lastHit:null}); } }
 else if(cls==='pyro'){ aoe(player.x,player.y,170,Math.round(player.dmg*3),'#ff7a3d'); }
 else if(cls==='knight'){ player.inv=4; }
 else if(cls==='rogue'){ const a0=player.aim||0;
   const nx=player.x+Math.cos(a0)*150, ny=player.y+Math.sin(a0)*150;
   if(!solid(nx,ny)){player.x=nx;player.y=ny;} player.inv=1.2; boom(player.x,player.y,'#c07ad4',14); }
 else if(cls==='cleric'){ player.hp=player.maxhp; boom(player.x,player.y,'#fff0c0',16); }
 else if(cls==='berserker'){ for(let i=0;i<16;i++){ const sa=i*Math.PI/8;
   pShots.push({x:player.x,y:player.y,px:player.x,py:player.y,vx:Math.cos(sa)*420,vy:Math.sin(sa)*420,r:7,life:0.5,dmg:Math.round(player.dmg*1.2),pierce:0,lastHit:null}); } }
 else if(cls==='warlock'){ let n=0;
   for(const e of enemies){ if(Math.hypot(e.x-player.x,e.y-player.y)<200){ e.hp-=Math.round(player.dmg*2); e.flash=0.15; n++; } }
   player.hp=Math.min(player.maxhp,player.hp+n*15);
   fx.push({t:'ring',x:player.x,y:player.y,r:200,life:0.35,col:'#8a5ac0'}); }
 else if(cls==='frost'){ for(const e of enemies){ if(Math.hypot(e.x-player.x,e.y-player.y)<220){ e.slowT=3; e.hp-=player.dmg; e.flash=0.1; } }
   fx.push({t:'ring',x:player.x,y:player.y,r:220,life:0.4,col:'#9ad4ef'}); }
 else if(cls==='storm'){ const sorted=enemies.slice().sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y)).slice(0,6);
   const pts=[{x:player.x,y:player.y}];
   for(const e of sorted){ const d2=Math.round(player.dmg*2.5); e.hp-=d2; e.flash=0.15; pts.push({x:e.x,y:e.y});
     texts.push({x:e.x,y:e.y-e.r,txt:d2,col:'#ffe9b0',life:0.6}); }
   if(pts.length>1) fx.push({t:'bolt',pts:pts,life:0.3,col:'#ffe9b0'}); }
 else if(cls==='hunter'){ for(let i=0;i<2;i++) allies.push({x:player.x,y:player.y,dmg:Math.round(player.dmg*0.8),life:10,cd:0,spr:'wolf'}); }
 else if(cls==='arbalest'){ player.deadeye=3; }
 else if(cls==='monk'){ player.bSpdT=5; player.bSpdM=1.8; player.inv=1.5; }
 else if(cls==='paladin'){ zones.push({x:player.x,y:player.y,r:95,life:6,tick:0}); }
 else if(cls==='necro'){ for(let i=0;i<2;i++) allies.push({x:player.x,y:player.y,dmg:Math.round(player.dmg*0.9),life:12,cd:0,spr:'skel'}); }
 else if(cls==='bard'){ player.bRofT=6; player.bRofM=1.5; }
 else if(cls==='shaman'){ player.spiritT=8; }
 else if(cls==='dragoon'){ const a0=player.aim||0;
   const nx=player.x+Math.cos(a0)*160, ny=player.y+Math.sin(a0)*160;
   if(!solid(nx,ny)){player.x=nx;player.y=ny;}
   aoe(player.x,player.y,130,Math.round(player.dmg*2.2),'#e07a2e'); }
 navigator.vibrate&&navigator.vibrate(60);
}
$s('abBtn').addEventListener('pointerdown',function(ev){ ev.stopPropagation(); doAbility(); });
function slotLabel(kind){ const ch=curChar(); if(!ch||!rpg)return '—';
 if(kind==='wpn'){ if(rpg.wpnL){const L=legById(rpg.wpnL); return '★ '+(L?L.n:'');}
  return 'T'+((rpg.wpn||0)+1)+' '+weaponAt(ch.cls,rpg.wpn||0).n; }
 if(kind==='arm'){ if(rpg.armL){const L=legById(rpg.armL); return '★ '+(L?L.n:'');}
  return 'T'+((rpg.arm||0)+1)+' '+TIER_NAMES[rpg.arm||0]+' '+MATN[CARMOR[ch.cls]]; }
 if(kind==='helm') return rpg.helm>=0 ? 'T'+(rpg.helm+1)+' '+TIER_NAMES[rpg.helm]+' Helm' : 'No helm';
 if(kind==='ring') return rpg.ring ? 'T'+(rpg.ring.t+1)+' '+RINGN[rpg.ring.st] : 'No ring';
 return '—'; }
let mapInt=null;
const MAPCOL={w:'#16303f',d:'#c0a870',g:'#33502f',t:'#22391f',r:'#4a4550',k:'#5d5666',e:'#3a1f14',W:'#100d14'};
function drawMap(){ const G=rooms['G']; if(!G||!G.rings) return;
 if($s('mapScr').style.display==='none'||!$s('mapScr').style.display){
  if(mapInt){clearInterval(mapInt);mapInt=null;} return; }
 const cv2=$s('mapCv'), c=cv2.getContext('2d');
 const scl=cv2.width/G.w;
 const hpx=Math.ceil(G.h*scl);
 if(cv2.height!==hpx+30) cv2.height=hpx+30;
 // deep ocean backdrop with faint swell lines
 c.fillStyle='#101c26'; c.fillRect(0,0,cv2.width,cv2.height);
 c.strokeStyle='rgba(120,170,190,0.05)';
 for(let y=6;y<hpx;y+=10){ c.beginPath(); c.moveTo(0,y);
  for(let x=0;x<=cv2.width;x+=8) c.lineTo(x,y+Math.sin(x*0.06+y)*1.5);
  c.stroke(); }
 // the island itself, tile by tile
 const MRAMP=['#c4ad7c','#b9a46d','#9da762','#799b4e','#56913f','#40813b','#327440','#37624f','#485749','#4f4b47','#56463d','#613e33','#703a27','#81341f','#912f16'];
 for(let y=0;y<G.h;y++){ const row=G.grid[y];
  for(let x=0;x<G.w;x++){ const ch=row[x];
   if(ch==='w'||ch==='W') continue;
   const nd=Math.sqrt(Math.pow((x-G.rings.cx)/G.rings.rx,2)+Math.pow((y-G.rings.cy)/G.rings.ry,2));
   const bd=Math.max(0,Math.min(14,Math.floor((1-Math.min(nd,0.999))*15)));
   c.fillStyle=(ch==='t')?'rgba(20,40,20,0.9)':(ch==='k')?'#5d5666':MRAMP[bd];
   c.fillRect(x*scl,y*scl,scl+0.6,scl+0.6); } }
 c.strokeStyle='rgba(0,0,0,0.4)'; c.lineWidth=1;
 for(let i=1;i<15;i++){ const nd=1-(i/15);
  c.beginPath(); c.ellipse(G.rings.cx*scl,G.rings.cy*scl,G.rings.rx*scl*nd,G.rings.ry*scl*nd,0,0,6.29); c.stroke(); }
 // molten heart glow
 const R=G.rings, ccx=R.cx*scl, ccy=R.cy*scl;
 const gg=c.createRadialGradient(ccx,ccy,2,ccx,ccy,R.rx*scl*0.16);
 gg.addColorStop(0,'rgba(255,122,61,0.55)'); gg.addColorStop(1,'rgba(255,122,61,0)');
 c.fillStyle=gg; c.beginPath(); c.arc(ccx,ccy,R.rx*scl*0.16,0,6.29); c.fill();
 // ring contour hints
 c.strokeStyle='rgba(255,201,77,0.10)'; c.lineWidth=1;
 for(let i=3;i<15;i+=3){ const nd=1-(i/15);
  c.beginPath(); c.ellipse(ccx,ccy,R.rx*scl*nd,R.ry*scl*nd,0,0,6.29); c.stroke(); }
 // labels spiral inward around the island
 const BOSSB=[4,9,14];
 for(let i=0;i<15;i++){ const rg=R.names[i];
  const nd=1-((i+0.5)/15);
  const ang=-1.35+i*0.95;
  let lx=ccx+Math.cos(ang)*R.rx*scl*nd, ly=ccy+Math.sin(ang)*R.ry*scl*nd;
  if(i===14){ lx=ccx; ly=ccy-12; }
  c.textAlign='center';
  c.font='bold 9px "Pixelify Sans",monospace';
  c.fillStyle='rgba(0,0,0,0.85)'; c.fillText(rg.n,lx+1,ly+1);
  c.fillStyle='#f0e8d8'; c.fillText(rg.n,lx,ly);
  c.font='8px "Pixelify Sans",monospace';
  c.fillStyle='rgba(0,0,0,0.85)'; c.fillText('Lv '+rg.band,lx+1,ly+10);
  c.fillStyle='#ffc94d'; c.fillText('Lv '+rg.band,lx,ly+9);
  if(BOSSB.indexOf(i)>=0){ c.font='11px monospace';
   c.fillStyle='rgba(0,0,0,0.85)'; c.fillText('\u2620',lx+1,ly-9);
   c.fillStyle='#ff6b5a'; c.fillText('\u2620',lx,ly-10); } }
 // return portals
 for(const gp of G.portals){ const px=gp.x/TILE*scl, py=gp.y/TILE*scl;
  c.strokeStyle='#c07ad4'; c.lineWidth=1.5;
  c.beginPath(); c.arc(px,py,4,0,6.29); c.stroke();
  c.fillStyle='#e8d8ff'; c.fillRect(px-1.5,py-1.5,3,3); }
 // you
 if(curRoom&&curRoom.key==='G'){
  const px=player.x/TILE*scl, py=player.y/TILE*scl;
  const pu=(Math.sin(performance.now()/250)+1)/2;
  c.strokeStyle='rgba(255,201,77,'+(0.9-pu*0.5)+')'; c.lineWidth=1.5;
  c.beginPath(); c.arc(px,py,5+pu*5,0,6.29); c.stroke();
  c.fillStyle='#fff'; c.beginPath(); c.arc(px,py,3,0,6.29); c.fill();
  c.strokeStyle='#101c26'; c.lineWidth=1; c.stroke(); }
 // legend: shallows to the heart
 const ly2=hpx+10, lw=cv2.width-160;
 for(let i=0;i<100;i++){ const t=i/99;
  c.fillStyle=t<0.15?'#c0a870':t<0.55?'hsl('+(105-t*90)+',35%,30%)':t<0.8?'#4a4550':'#7a3a1e';
  c.fillRect(10+i*(lw/100),ly2,lw/100+0.6,8); }
 c.font='9px monospace'; c.textAlign='left'; c.fillStyle='#cfc8bd';
 c.fillText('shore \u00b7 Lv 1',10,ly2+17);
 c.fillText('heart \u00b7 Lv 150',10+lw-74,ly2+17);
 c.textAlign='right'; c.font='9px "Pixelify Sans",monospace';
 if(curRoom&&curRoom.key==='G'){ const rg=regionAtPx(player.x,player.y);
  c.fillStyle='#ffc94d'; c.fillText(rg?rg.n+' \u00b7 Lv '+rg.band:'',cv2.width-8,ly2+17); }
 else { c.fillStyle='#8a8494'; c.fillText('you are in '+(curRoom?curRoom.name:'')+' \u2014 portal in the plaza',cv2.width-8,ly2+17); }
}
$s('mapBtn').addEventListener('click',function(){ $s('mapScr').style.display='flex';
 drawMap(); if(mapInt)clearInterval(mapInt); mapInt=setInterval(drawMap,120); });
function closeMap(){ $s('mapScr').style.display='none';
 if(mapInt){clearInterval(mapInt);mapInt=null;} }
$s('mapClose').addEventListener('click',closeMap);
$s('mapClose2').addEventListener('click',closeMap);


let invSelIdx=-1;
function openInv(){ $s('invScr').style.display='flex'; invSelIdx=-1; paintInv(); }
function paintInv(){ const ch=curChar(); if(!ch||!rpg)return;
 if(!ch.inv) ch.inv=[];
 recalcStats();
 const ci=Math.max(0,CLASSES.findIndex(x=>x.id===ch.cls)); const c=CLASSES[ci];
 $s('eqSlots').innerHTML=
   '<div class="srow"><span>Weapon</span><span style="color:'+(rpg.wpnL?'#ff9c50':tierCol(rpg.wpn||0))+'">'+slotLabel('wpn')+'</span></div>'
  +'<div class="srow"><span>Helm</span><span style="color:'+(rpg.helm>=0?tierCol(rpg.helm):'#8a8494')+'">'+slotLabel('helm')+'</span></div>'
  +'<div class="srow"><span>Armor</span><span style="color:'+(rpg.armL?'#ff9c50':tierCol(rpg.arm||0))+'">'+slotLabel('arm')+'</span></div>'
  +'<div class="srow"><span>Ring</span><span style="color:'+(rpg.ring?tierCol(rpg.ring.t):'#8a8494')+'">'+slotLabel('ring')+'</span></div>';
 function chip(l,v){ return '<div class="schip"><span>'+l+'</span><b>'+v+'</b></div>'; }
 $s('eqStats').innerHTML=chip('HP',player.maxhp)+chip('DMG',player.dmg)+chip('DEF',player.def||0)
   +chip('SPD',Math.round(player.spd))+chip('LVL',rpg.lvl)+chip(player.resDef?player.resDef.res:'RES','\u2726');
 const dc=$s('dollCv'), d2=dc.getContext('2d'); d2.imageSmoothingEnabled=false;
 const bg=d2.createLinearGradient(0,0,0,dc.height); bg.addColorStop(0,'#241b33'); bg.addColorStop(1,'#120e18');
 d2.fillStyle=bg; d2.fillRect(0,0,dc.width,dc.height);
 const th=CTHEME[ch.cls]||CTHEME.squire;
 const glow=d2.createRadialGradient(dc.width/2,dc.height*0.5,3,dc.width/2,dc.height*0.5,48);
 glow.addColorStop(0,th.p+'3c'); glow.addColorStop(1,'rgba(0,0,0,0)');
 d2.fillStyle=glow; d2.fillRect(0,0,dc.width,dc.height);
 d2.fillStyle='rgba(0,0,0,0.4)'; d2.beginPath(); d2.ellipse(dc.width/2,dc.height-13,28,6,0,0,6.29); d2.fill();
 const hs=heroSprite(player.look||{cls:ch.cls,helmT:-1},0); const sc=5;
 const hx=Math.round((dc.width-hs.width*sc)/2), hy=dc.height-16-hs.height*sc;
 d2.drawImage(hs,hx,hy,hs.width*sc,hs.height*sc);
 const ws=wpnSpr(CWEAP[ch.cls]||'sword',rpg.wpnL?11:(rpg.wpn||0));
 d2.save(); d2.translate(hx+hs.width*sc-4,hy+hs.height*sc*0.6); d2.rotate(-1.1);
 d2.drawImage(ws,-2,-ws.height*1.1,ws.width*2.2,ws.height*2.2); d2.restore();
 $s('invInfo').textContent=ch.inv.length+' / 20 satchel slots';
 const g=$s('invGrid'); g.innerHTML='';
 ch.inv.forEach((it,i)=>{ const d=document.createElement('div'); d.className='islot'+(i===invSelIdx?' sel':'');
  d.style.color=it.k==='pot'?'#7dc47a':tierCol(it.t);
  d.innerHTML=(it.k==='pot'?'🧪':'T'+(it.t+1))+'<small>'
   +(it.k==='pot'?'Tonic':it.k==='wpn'?WTYPE[it.wt].n:it.k==='arm'?MATN[it.mt]:it.k==='helm'?MATN[it.mt]+' Helm':RINGN[it.st].replace('Ring of ',''))
   +'</small>';
  d.onclick=()=>{invSelIdx=i;paintInv();};
  g.appendChild(d); });
 const it=ch.inv[invSelIdx];
 $s('invSel').textContent = it? itemName(it)+' · sells for '+itemValue(it)+'g'
  +((it.k!=='pot'&&!canEquip(it,ch))?' · not usable by your class':'') : 'Tap an item';
 $s('invEquip').style.display = (it&&canEquip(it,ch)) ? '' : 'none';
 $s('invSell').style.display = it? '':'none';
 $s('invDrop').style.display = it? '':'none';
}
$s('invBtn').addEventListener('click',openInv);
$s('invClose').addEventListener('click',()=>{$s('invScr').style.display='none';});
$s('invEquip').addEventListener('click',()=>{ const ch=curChar(); if(!ch)return;
 const it=ch.inv[invSelIdx]; if(!it||!canEquip(it,ch)) return;
 let old=null;
 if(it.k==='wpn'){ old={k:'wpn',wt:CWEAP[ch.cls],t:rpg.wpn||0}; rpg.wpn=it.t; rpg.wpnL=null; }
 else if(it.k==='arm'){ old={k:'arm',mt:CARMOR[ch.cls],t:rpg.arm||0}; rpg.arm=it.t; rpg.armL=null; }
 else if(it.k==='helm'){ if(rpg.helm>=0) old={k:'helm',mt:CARMOR[ch.cls],t:rpg.helm}; rpg.helm=it.t; }
 else if(it.k==='ring'){ if(rpg.ring) old={k:'ring',st:rpg.ring.st,t:rpg.ring.t}; rpg.ring={st:it.st,t:it.t}; }
 const nm=itemName(it);
 ch.inv.splice(invSelIdx,1); if(old) ch.inv.push(old);
 invSelIdx=-1; recalcStats(); saveRPG(); hudRPG(); paintInv();
 msg(nm,'equipped'); });
$s('invSell').addEventListener('click',()=>{ const ch=curChar(); if(!ch)return;
 const it=ch.inv[invSelIdx]; if(!it) return;
 rpg.gold+=itemValue(it); ch.inv.splice(invSelIdx,1); invSelIdx=-1;
 saveRPG(); hudRPG(); paintInv(); });
$s('invDrop').addEventListener('click',()=>{ const ch=curChar(); if(!ch)return;
 const it=ch.inv[invSelIdx]; if(!it) return;
 if(it.k==='wpn'&&it.t>=6&&!confirm('Discard '+itemName(it)+'?')) return;
 ch.inv.splice(invSelIdx,1); invSelIdx=-1; saveRPG(); paintInv(); });
function loadRPG(){ const ch=curChar(); if(!ch){rpg=null;return;} rpg=ch.rpg;
 if(rpg.arm===undefined)rpg.arm=0; if(rpg.helm===undefined)rpg.helm=-1;
 if(rpg.ring===undefined)rpg.ring=null;
 if(rpg.pets===undefined)rpg.pets=[]; if(rpg.pet===undefined)rpg.pet=null;
 if(rpg.legends===undefined)rpg.legends=[]; if(rpg.wpnL===undefined)rpg.wpnL=null;
 if(rpg.armL===undefined)rpg.armL=null; if(!ch.inv)ch.inv=[]; }
function xpNeed(l){return Math.floor(50*Math.pow(l,1.5));}
function recalcStats(){ const ch=curChar(); if(!ch||!rpg)return;
 const ci=Math.max(0,CLASSES.findIndex(x=>x.id===ch.cls)); const c=CLASSES[ci];
 player.cname=ch.name; player.hue=ci*20;
 rpg.wpn=Math.min(rpg.wpn||0,MAXT-1);
 player.wt=classWT(ch.cls);
 const wL=rpg.wpnL?legById(rpg.wpnL):null;
 const aL=rpg.armL?legById(rpg.armL):null;
 const wAdd=wL?wL.add:weaponAt(ch.cls,rpg.wpn).add;
 const mt=CARMOR[ch.cls]||'plate';
 const at=rpg.arm||0, ht=rpg.helm, rg=rpg.ring;
 let hpB=0, dmgB=0, spdB=0, def=0;
 const helmDef=(ht>=0?(ht+1)*0.8:0), helmHp=(ht>=0?(ht+1)*5:0);
 if(aL){ def=Math.round(aL.def+helmDef); hpB=aL.hp+helmHp; spdB=aL.spd; }
 else { const defM={plate:1.5,leather:1.0,robe:0.7}[mt];
  def=Math.round((at+1)*defM*1.3+helmDef);
  hpB=at*6+helmHp;
  if(mt==='leather') spdB+=at*1.5;
  if(mt==='robe') dmgB+=Math.round(at*1.2); }
 if(rg){ if(rg.st==='hp')hpB+=rg.t*8+10; if(rg.st==='dmg')dmgB+=Math.round(rg.t*1.5)+2; if(rg.st==='spd')spdB+=rg.t*2+4; }
 player.def=def;
 player.maxhp=c.hp+12*(rpg.lvl-1)+hpB;
 player.spd=c.spd+spdB;
 player.fireRate=c.fr*(player.wt.rof||1)*(wL?(wL.rof||1):1);
 player.dmg=c.dmg+Math.round(1.5*(rpg.lvl-1))+wAdd+dmgB;
 player.shots=c.shots||1; player.pierce=c.pierce||0;
 player.ls=c.ls||0; player.regen=c.regen||1; player.slowShot=!!c.slow;
 player.resDef=ABIL[ch.cls]||ABIL.squire;
 player.look={cls:ch.cls, hue:ci*20, mt:mt, armT:(aL?11:at), helmT:(ht===undefined?-1:ht)};
 if(player.hp>player.maxhp)player.hp=player.maxhp; }
function saveRPG(){ if(curUser&&users[curUser]&&rpg){ LS.set('er-users',users); } }
function hudRPG(){ if(!rpg)return;
 $s('lvlTxt').textContent='Lv '+rpg.lvl;
 $s('goldTxt').textContent=rpg.gold+'g';
 $s('potBtn').textContent='🧪 '+rpg.pots; }
function gainXP(x,g){ if(!rpg)return; rpg.xp+=x; rpg.gold+=g;
 while(rpg.lvl<150 && rpg.xp>=xpNeed(rpg.lvl)){ rpg.xp-=xpNeed(rpg.lvl); rpg.lvl++;
  recalcStats(); player.hp=player.maxhp;
  msg('LEVEL '+rpg.lvl,'the ember grows'); }
 saveRPG(); hudRPG(); }
function usePotion(){ if(!rpg||rpg.pots<=0||player.hp>=player.maxhp) return;
 rpg.pots--; player.hp=Math.min(player.maxhp,player.hp+60); saveRPG(); hudRPG();
 texts.push({x:player.x,y:player.y-22,txt:'+60',col:'#7dc47a',life:1}); }


$s('potBtn').addEventListener('click',usePotion);
function legendRows(slot,out){ for(const L of LEGENDS){ if(L.slot!==slot) continue;
 const owned=rpg.legends&&rpg.legends.indexOf(L.id)>=0;
 const eq=(slot==='wpn'?rpg.wpnL:rpg.armL)===L.id;
 if(owned) out.push({l:'★ '+L.n+(eq?' — in use, tap to set aside':' — owned, tap to use'),c:0,
   f:function(){ if(slot==='wpn') rpg.wpnL=(eq?null:L.id); else rpg.armL=(eq?null:L.id); }});
 else out.push({l:'★ '+L.n+' · '+L.d,c:L.price,
   f:function(){ if(!rpg.legends)rpg.legends=[]; rpg.legends.push(L.id);
     if(slot==='wpn') rpg.wpnL=L.id; else rpg.armL=L.id; }});
} }
function shopRowsFor(id){ const ch=curChar(); const out=[];
 if(id==='bram'){ const nt=(rpg.wpn||0)+1;
  if(nt<3){ const w=weaponAt(ch.cls,nt);
   out.push({l:'T'+(nt+1)+' '+w.n+' (+'+w.add+' dmg)',c:w.cost,f:function(){rpg.wpn=nt; rpg.wpnL=null;}}); }
  else out.push({l:'Bram stocks up to T3 — finer steel is won in the field',c:-1});
  legendRows('wpn',out); }
 if(id==='sella'){ const na=(rpg.arm||0)+1;
  if(na<3) out.push({l:'T'+(na+1)+' '+MATN[CARMOR[ch.cls]]+' Armor',c:Math.round(tierCost(na)*0.8),f:function(){rpg.arm=na; rpg.armL=null;}});
  else out.push({l:'Armor above T3 must be found, not bought',c:-1});
  const nh=(rpg.helm===undefined||rpg.helm<0)?0:rpg.helm+1;
  if(nh<3) out.push({l:'T'+(nh+1)+' '+MATN[CARMOR[ch.cls]]+' Helm',c:Math.round(tierCost(Math.max(1,nh))*0.6),f:function(){rpg.helm=nh;}});
  else out.push({l:'Helms above T3 drop in the field',c:-1});
  legendRows('arm',out); }
 if(id==='odo'){ const pets=[['wolf','Grey Wolf',500],['skel','Bone Servant',1500],['wisp','Ember Wisp',4000]];
  if(!rpg.pets)rpg.pets=[];
  for(const p of pets){ const pid=p[0],nm=p[1],cost=p[2];
   if(rpg.pets.indexOf(pid)>=0)
    out.push({l:nm+(rpg.pet===pid?' — following you':' — owned, tap to summon'),c:0,
     f:function(){rpg.pet=(rpg.pet===pid?null:pid); spawnPet();}});
   else out.push({l:nm,c:cost,f:function(){rpg.pets.push(pid); rpg.pet=pid; spawnPet();}}); } }
 if(id==='maren'){ out.push({l:'Ember Tonic (+60 HP)',c:15,f:function(){rpg.pots++;}}); }
 return out; }
function openShop2(id){ const n=SHOPNPCS.filter(function(x){return x.id===id;})[0]||SHOPNPCS[0];
 $s('shopTitle').textContent=n.title;
 $s('shopScr').style.display='flex'; paintShop2(n.id); }
function paintShop2(id){ if(!rpg) return;
 $s('shopGold').textContent='Purse: '+rpg.gold+'g';
 const box=$s('shopRows'); box.innerHTML='';
 for(const it of shopRowsFor(id)){
  if(it.c===-1){ const d=document.createElement('div'); d.className='mnote'; d.textContent=it.l; box.appendChild(d); continue; }
  const b=document.createElement('button'); b.className='mbtn';
  b.textContent=it.l+(it.c>0?' — '+it.c+'g':'');
  if(it.c>0&&rpg.gold<it.c) b.style.opacity='0.45';
  b.onclick=function(){ if(it.c>0&&rpg.gold<it.c) return;
   if(it.c>0) rpg.gold-=it.c;
   if(it.f) it.f(); recalcStats(); saveRPG(); hudRPG(); paintShop2(id); };
  box.appendChild(b); }
}
function spawnPet(){ for(let i=allies.length-1;i>=0;i--) if(allies[i].pet) allies.splice(i,1);
 if(!rpg||!rpg.pet) return;
 const dmg=rpg.pet==='wolf'?Math.max(3,Math.round(player.dmg*0.5))
  :rpg.pet==='skel'?Math.max(4,Math.round(player.dmg*0.7))
  :Math.max(5,Math.round(player.dmg*0.9));
 allies.push({pet:true,x:player.x,y:player.y,dmg:dmg,life:1e9,cd:0,spr:rpg.pet}); }
$s('shopBtn').addEventListener('click',function(){ openShop2(curShopNear||'maren'); });
$s('shopClose').addEventListener('click',()=>{$s('shopScr').style.display='none';});



function show(id){for(const s of ['loginScr','menuScr','charScr','classScr','devScr'])$s(s).style.display=(s===id)?'flex':'none';
 $s('menuBtn').style.display='none'; $s('potBtn').style.display='none';
 $s('shopBtn').style.display='none'; $s('shopScr').style.display='none';
 $s('invBtn').style.display='none'; $s('invScr').style.display='none';
 $s('abBtn').style.display='none';
 $s('mapBtn').style.display='none'; $s('mapScr').style.display='none';
 if($s('sheetScr'))$s('sheetScr').style.display='none'; shopNear=false;}
function hideAll(){for(const s of ['loginScr','menuScr','charScr','classScr','devScr'])$s(s).style.display='none';}
function refreshUserList(){
 const box=$s('userList'); box.innerHTML='';
 for(const n of Object.keys(users)){const b=document.createElement('button');b.className='mbtn user';
  b.textContent=n; b.onclick=()=>{$s('loginName').value=n;$s('loginPass').focus();};
  box.appendChild(b);}
}
const ADMIN_HASH='b3a7d6e897c405612aa0c29d8d9f5ddfffe71c18632360752d7d29c5db912e23';
async function doLogin(){
 const n=$s('loginName').value.trim(), p=$s('loginPass').value;
 if(!n||!p){loginErr('Enter a name and password');return;}
 const h=await hash(p);
 if(n.toLowerCase()==='admin'){
  if(h!==ADMIN_HASH){loginErr('Wrong admin password');return;}
  isAdmin=true;
  if(!users['admin']) users['admin']={char:null,best:0};
 } else {
  isAdmin=false;
  if(users[n]){ if(users[n].pass!==h){loginErr('Wrong password for '+n);return;} }
  else { users[n]={pass:h,char:null,best:0}; LS.set('er-users',users); }
 }
 loginErr(''); $s('loginPass').value='';
 curUser=n.toLowerCase()==='admin'?'admin':n; LS.set('er-last',curUser); openMenu();
}
function loginErr(t){$s('loginErr').textContent=t;}
function openMenu(){
 $s('menuWho').textContent=curUser;
 const u=users[curUser];
 const ch=curChar();
 const cc=ch?CLASSES[Math.max(0,CLASSES.findIndex(x=>x.id===ch.cls))]:null;
 $s('menuChar').textContent= ch&&cc ? cc.ic+' '+ch.name+' the '+cc.n : 'No character yet';
 const ur=(ch&&ch.rpg)||{lvl:1,gold:0};
 $s('menuBest').textContent='Lv '+ur.lvl+' · '+ur.gold+'g · best '+(u.best||0)+' kills';
 $s('devMenuBtn').style.display=isAdmin?'':'none'; $s('devBtn2').style.display='none'; inGame=false; show('menuScr');
}
function migrate(u){ if(!u.chars){ u.chars=[]; u.cur=0;
  if(u.char){ u.chars.push({name:curUser.slice(0,14), cls:u.char, rpg:u.rpg||{lvl:1,xp:0,gold:0,wpn:0,pots:1}}); }
  delete u.char; delete u.rpg; LS.set('er-users',users); }
 if(u.cur===undefined||u.cur>=u.chars.length) u.cur=0; }
function curChar(){ const u=users[curUser]; if(!u) return null; migrate(u); return u.chars[u.cur]||null; }
function openChar(){
 const u=users[curUser]; migrate(u);
 const box=$s('charList'); box.innerHTML='';
 if(!u.chars.length){ box.innerHTML='<div class="mnote">No characters yet. Forge your first hero.</div>'; }
 u.chars.forEach((ch,i)=>{ const ci=CLASSES.findIndex(x=>x.id===ch.cls); const c=CLASSES[ci<0?0:ci];
  const d=document.createElement('div'); d.className='ccard'+(i===u.cur?' sel':'');
  d.innerHTML='<div class="cic">'+c.ic+'</div><div class="cn">'+ch.name+'</div>'
   +'<div class="cd">'+c.n+' · Lv '+ch.rpg.lvl+'</div>'
   +'<div class="cs">'+ch.rpg.gold+'g · T'+((ch.rpg.wpn||0)+1)+' '+weaponAt(ch.cls,ch.rpg.wpn||0).n+'</div>'
   +'<div class="cdel">✕</div>';
  d.onclick=(ev)=>{ if(ev.target.classList.contains('cdel')){
    if(confirm('Delete '+ch.name+' forever?')){ u.chars.splice(i,1); if(u.cur>=u.chars.length)u.cur=0;
     LS.set('er-users',users); openChar(); }
    return; }
   u.cur=i; LS.set('er-users',users); openMenu(); };
  box.appendChild(d); });
 show('charScr');
}
function openClassPick(){
 const box=$s('classList'); box.innerHTML='';
 CLASSES.forEach((c,i)=>{ const d=document.createElement('div'); d.className='ccard mini';
  let tags=' · '+classWT(c.id).n;
  if(c.shots>1) tags+=' · ×'+c.shots+' shots'; if(c.pierce) tags+=' · pierce';
  if(c.ls) tags+=' · lifesteal'; if(c.regen>1) tags+=' · regen'; if(c.slow) tags+=' · chill';
  d.innerHTML='<div class="cic">'+c.ic+'</div><div class="cn">'+c.n+'</div>'
   +'<div class="cd">'+c.d+'<br><span style="color:#ffd07a">'+(ABIL[c.id]?ABIL[c.id].res+' — '+ABIL[c.id].d:'')+'</span></div>'
   +'<div class="cs">HP '+c.hp+' · SPD '+c.spd+' · DMG '+c.dmg+' · '+(1/c.fr).toFixed(1)+'/s'+tags+'</div>';
  d.onclick=()=>{ const nm=($s('charName').value.trim()||('Hero'+Math.floor(Math.random()*900+100))).slice(0,14);
   const u=users[curUser];
   u.chars.push({name:nm, cls:c.id, rpg:{lvl:1,xp:0,gold:0,wpn:0,pots:1}});
   u.cur=u.chars.length-1; LS.set('er-users',users); $s('charName').value=''; openMenu(); };
  box.appendChild(d); });
 show('classScr');
}
function play(){
 const u=users[curUser];
 const ch=curChar();
 if(!ch){openChar();return;}
 loadRPG(); recalcStats(); player.hp=player.maxhp;
 player.kills=0; player.inv=1;
 res=0; allies=[]; zones=[]; fx=[]; player.spiritT=0; player.deadeye=0;
 player.bDmgT=0; player.bRofT=0; player.bSpdT=0;
 spawnPet();
 document.getElementById('killTxt').textContent='Kills 0';
 hudRPG();
 hideAll(); $s('menuBtn').style.display='flex'; if(isAdmin)$s('devBtn2').style.display='flex';
 $s('potBtn').style.display='flex'; $s('invBtn').style.display='flex'; $s('abBtn').style.display='flex'; $s('mapBtn').style.display='flex'; $s('abBtn').style.display='flex'; $s('mapBtn').style.display='flex'; inGame=true;
 const r0=rooms['0,0']; enterRoom('0,0',(r0.px+.5)*TILE,(r0.py+.5)*TILE);
}
function recordBest(k){ if(curUser&&users[curUser]&&k>(users[curUser].best||0)){
 users[curUser].best=k; LS.set('er-users',users); } }
$s('loginBtn').addEventListener('click',doLogin);
$s('loginPass').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
$s('playBtn').addEventListener('click',play);
$s('charBtn').addEventListener('click',openChar);
$s('backBtn').addEventListener('click',openMenu);
$s('newCharBtn').addEventListener('click',openClassPick);
$s('classBack').addEventListener('click',openChar);
$s('switchBtn').addEventListener('click',()=>{curUser=null;isAdmin=false;LS.set('er-last',null);refreshUserList();show('loginScr');});
$s('menuBtn').addEventListener('click',()=>{recordBest(player.kills);openMenu();});
