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

// ============================================================
//  10-STAT SYSTEM
//  atk def hp mp vit wis dex spd luck fort
//  luck -> crit chance + hit   ·   fort -> loot bonus
// ============================================================
const STATS=['atk','def','hp','mp','vit','wis','dex','spd','luck','fort'];
const STAT_META={
 atk :{n:'Attack',  s:'ATK', col:'#e2604c'},
 def :{n:'Defense', s:'DEF', col:'#c9d2da'},
 hp  :{n:'Health',  s:'HP',  col:'#8fd48c'},
 mp  :{n:'Mana',    s:'MP',  col:'#7ab8d4'},
 vit :{n:'Vitality',s:'VIT', col:'#7dc47a'},
 wis :{n:'Wisdom',  s:'WIS', col:'#c07ad4'},
 dex :{n:'Dexterity',s:'DEX',col:'#e8b34b'},
 spd :{n:'Speed',   s:'SPD', col:'#9ad4ef'},
 luck:{n:'Luck',    s:'LCK', col:'#8fd48c'},
 fort:{n:'Fortune', s:'FRT', col:'#ffc94d'},
};
function newStats(){ const s={}; for(const k of STATS) s[k]=0; return s; }
function addStats(a,b){ for(const k of STATS) a[k]+=(b[k]||0); return a; }
function classBaseStats(c){
 const mt=CARMOR[c.id]||'plate';
 const cast=mt==='robe', agile=mt==='leather';
 return { atk:c.dmg, def:cast?2:agile?3:6, hp:c.hp,
  mp:cast?60:agile?36:26, vit:Math.round((c.regen||1)*4),
  wis:cast?14:agile?7:5,
  dex:Math.round(Math.max(4,Math.min(24,(0.30/c.fr)*8))),
  spd:c.spd, luck:(c.id==='rogue'||c.id==='hunter')?9:5, fort:5 };
}
function levelStats(c,lvl){ const L=Math.max(0,lvl-1); const mt=CARMOR[c.id]||'plate';
 const cast=mt==='robe', agile=mt==='leather';
 return { atk:Math.round(L*1.6), def:Math.round(L*0.35), hp:Math.round(L*10),
  mp:Math.round(L*(cast?1.4:0.7)), vit:Math.round(L*0.5),
  wis:Math.round(L*(cast?0.6:0.3)), dex:Math.round(L*(agile?0.4:0.2)),
  spd:Math.round(L*0.6), luck:Math.round(L*0.15), fort:Math.round(L*0.12) };
}
// fixed base stats for a gear piece by slot + tier (+ material / ring type)
function gearBaseStats(slot,t,extra){ const s=newStats(); t=t|0;
 if(slot==='wpn'){ s.atk=Math.round(t*t*1.35+t*2); s.dex=Math.round(t*0.8); }
 else if(slot==='arm'){ const mt=extra||'plate'; const dm={plate:1.5,leather:1.0,robe:0.7}[mt]||1;
  s.def=Math.round((t+1)*dm*1.4); s.hp=t*6+8; s.vit=Math.round(t*0.6);
  if(mt==='leather'){ s.dex=Math.round(t*0.8); s.spd=Math.round(t*1.4); }
  else if(mt==='robe'){ s.wis=Math.round(t*1.1); s.mp=t*4; }
  else { s.def+=Math.round(t*0.6); s.hp+=t*3; } }
 else if(slot==='helm'){ s.wis=Math.round((t+1)*1.1); s.mp=(t+1)*4;
  s.def=Math.round((t+1)*0.6); s.vit=Math.round(t*0.4); }
 else if(slot==='ring'){ s.luck=t+3; s.fort=t+3;
  if(extra==='hp') s.hp=t*8+10; else if(extra==='dmg') s.atk=Math.round(t*1.5)+2; else if(extra==='spd') s.spd=t*2+4; }
 return s;
}
// rarity + rolled prefix affixes on tier-7+ (index >=6) gear
const RAR_NAMES=['','Uncommon','Rare','Epic','Legendary'];
const RAR_COL=['#cfc8bd','#7dc47a','#7ab8d4','#c07ad4','#ff9c50'];
const AFFIX_PREFIX={ atk:'Vicious', def:'Sturdy', hp:'Vital', mp:'Arcane',
 vit:'Hearty', wis:"Sage's", dex:'Nimble', spd:'Swift', luck:'Lucky', fort:'Prosperous' };
function rollRarity(t,fortune){ if((t|0)<6) return 0;
 let r=Math.random()-(fortune||0)*0.0035;
 if(r<0.02) return 4; if(r<0.09) return 3; if(r<0.25) return 2; if(r<0.55) return 1; return 0; }
function affixValue(k,t,rar){ const mag=(t-3)*(1+rar*0.4);
 if(k==='hp'||k==='mp') return Math.max(2,Math.round(mag*3+4));
 if(k==='atk'||k==='spd') return Math.max(1,Math.round(mag*1.5+2));
 return Math.max(1,Math.round(mag*0.8+1)); }
function rollAffixes(it,fortune){ it.rar=rollRarity(it.t,fortune); it.aff=[];
 if(!it.rar) return it;
 const keys=Object.keys(AFFIX_PREFIX), used={};
 for(let i=0;i<it.rar;i++){ let k,g=0; do{ k=keys[Math.floor(Math.random()*keys.length)]; }while(used[k]&&g++<12); used[k]=1;
  it.aff.push({s:k,v:affixValue(k,it.t,it.rar)}); }
 return it; }
function affStats(aff){ const s=newStats(); if(aff) for(const a of aff) s[a.s]=(s[a.s]||0)+a.v; return s; }
// full stat block an item contributes (base + its own affixes)
function itemStats(it,cls){ if(!it||it.k==='pot') return newStats();
 let base;
 if(it.k==='wpn') base=gearBaseStats('wpn',it.t);
 else if(it.k==='arm') base=gearBaseStats('arm',it.t,it.mt);
 else if(it.k==='helm') base=gearBaseStats('helm',it.t,it.mt);
 else if(it.k==='ring') base=gearBaseStats('ring',it.t,it.st);
 else base=newStats();
 return addStats(base,affStats(it.aff));
}
function itemBaseName(it){
 const p='T'+(it.t+1)+' '+TIER_NAMES[it.t]+' ';
 if(it.k==='wpn')return p+WTYPE[it.wt].n;
 if(it.k==='arm')return p+MATN[it.mt]+' Armor';
 if(it.k==='helm')return p+MATN[it.mt]+' Helm';
 if(it.k==='ring')return 'T'+(it.t+1)+' '+RINGN[it.st];
 return p; }
function itemName(it){ if(it.k==='pot')return 'Ember Tonic';
 let nm=itemBaseName(it);
 if(it.rar && it.aff && it.aff.length) nm=AFFIX_PREFIX[it.aff[0].s]+' '+nm;
 return nm; }
function itemRarCol(it){ return (it&&it.rar)?RAR_COL[it.rar]:tierCol(it?it.t:0); }
function canEquip(it,ch){ if(!it||it.k==='pot')return false;
 if(it.k==='wpn')return CWEAP[ch.cls]===it.wt;
 if(it.k==='arm'||it.k==='helm')return CARMOR[ch.cls]===it.mt;
 return it.k==='ring'; }
function itemValue(it){ return it.k==='pot'?8:Math.max(6,Math.round(tierCost(it.t)*0.4)); }
function mkDrop(t){ t=Math.max(0,Math.min(MAXT-1,t)); const r=Math.random(); let it;
 if(r<0.5){ const keys=Object.keys(WTYPE);
  it={k:'wpn',wt:keys[Math.floor(Math.random()*keys.length)],t:t}; }
 else { const mats=['plate','leather','robe'];
  if(r<0.7) it={k:'arm',mt:mats[Math.floor(Math.random()*3)],t:t};
  else if(r<0.85) it={k:'helm',mt:mats[Math.floor(Math.random()*3)],t:t};
  else it={k:'ring',st:['hp','dmg','spd'][Math.floor(Math.random()*3)],t:t}; }
 return rollAffixes(it,(typeof player!=='undefined'&&player.fortune)||0); }
function bagAt(e,item){ return {x:e.x+(Math.random()*22-11),y:e.y+(Math.random()*22-11),item:item,life:60}; }
function rollLoot(e){
 const lv=e.lv||1;
 const F=(typeof player!=='undefined'&&player.fortune)||0;
 const fmul=1+F*0.012;                 // fortune: more drops
 const tb=Math.max(0,Math.min(11,Math.round(lv/12.5)));
 let tier=Math.max(0,Math.min(11,tb+Math.floor(Math.random()*3)-1));
 if(Math.random()<F*0.004) tier=Math.min(11,tier+1);  // fortune: better tier
 const r=Math.random();
 if(e.type==='B'){ loots.push(bagAt(e,mkDrop(Math.min(11,tb+1))));
   if(Math.random()<0.4) loots.push(bagAt(e,{k:'pot'})); return; }
 if(e.type==='s'){ if(r<0.10*fmul) loots.push(bagAt(e,mkDrop(tier)));
   else if(r<0.18*fmul) loots.push(bagAt(e,{k:'pot'})); return; }
 if(r<0.06*fmul) loots.push(bagAt(e,mkDrop(tier)));
 else if(r<0.12*fmul) loots.push(bagAt(e,{k:'pot'}));
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
function abilityCost(){ return Math.max(18, Math.round((player.maxmp||40)*0.5)); }
function doAbility(){
 if(!rpg||!inGame) return; const ch=curChar(); if(!ch)return;
 const cost=abilityCost();
 if((player.mp||0)<cost){ texts.push({x:player.x,y:player.y-30,txt:'◇ low mana',col:'#7ab8d4',life:0.7});
   navigator.vibrate&&navigator.vibrate(20); return; }
 player.mp-=cost;
 const AP=player.abilPow||1, cls=ch.cls;
 if(cls==='squire'){ player.hp=Math.min(player.maxhp,player.hp+player.maxhp*0.25*AP); player.bDmgT=5; player.bDmgM=1.5; }
 else if(cls==='ranger'){ const a0=player.aim||0;
   for(let i=0;i<12;i++){ const sa=a0+(i-5.5)*0.12;
     pShots.push({x:player.x,y:player.y,px:player.x,py:player.y,vx:Math.cos(sa)*640,vy:Math.sin(sa)*640,r:5,life:1.1,dmg:Math.round(player.dmg*AP),pierce:0,lastHit:null}); } }
 else if(cls==='pyro'){ aoe(player.x,player.y,170,Math.round(player.dmg*3*AP),'#ff7a3d'); }
 else if(cls==='knight'){ player.inv=4; }
 else if(cls==='rogue'){ const a0=player.aim||0;
   const nx=player.x+Math.cos(a0)*150, ny=player.y+Math.sin(a0)*150;
   if(!solid(nx,ny)){player.x=nx;player.y=ny;} player.inv=1.2; boom(player.x,player.y,'#c07ad4',14); }
 else if(cls==='cleric'){ player.hp=player.maxhp; boom(player.x,player.y,'#fff0c0',16); }
 else if(cls==='berserker'){ for(let i=0;i<16;i++){ const sa=i*Math.PI/8;
   pShots.push({x:player.x,y:player.y,px:player.x,py:player.y,vx:Math.cos(sa)*420,vy:Math.sin(sa)*420,r:7,life:0.5,dmg:Math.round(player.dmg*1.2*AP),pierce:0,lastHit:null}); } }
 else if(cls==='warlock'){ let n=0;
   for(const e of enemies){ if(Math.hypot(e.x-player.x,e.y-player.y)<200){ e.hp-=Math.round(player.dmg*2*AP); e.flash=0.15; n++; } }
   player.hp=Math.min(player.maxhp,player.hp+n*15*AP);
   fx.push({t:'ring',x:player.x,y:player.y,r:200,life:0.35,col:'#8a5ac0'}); }
 else if(cls==='frost'){ for(const e of enemies){ if(Math.hypot(e.x-player.x,e.y-player.y)<220){ e.slowT=3; e.hp-=Math.round(player.dmg*AP); e.flash=0.1; } }
   fx.push({t:'ring',x:player.x,y:player.y,r:220,life:0.4,col:'#9ad4ef'}); }
 else if(cls==='storm'){ const sorted=enemies.slice().sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y)).slice(0,6);
   const pts=[{x:player.x,y:player.y}];
   for(const e of sorted){ const d2=Math.round(player.dmg*2.5*AP); e.hp-=d2; e.flash=0.15; pts.push({x:e.x,y:e.y});
     texts.push({x:e.x,y:e.y-e.r,txt:d2,col:'#ffe9b0',life:0.6}); }
   if(pts.length>1) fx.push({t:'bolt',pts:pts,life:0.3,col:'#ffe9b0'}); }
 else if(cls==='hunter'){ for(let i=0;i<2;i++) allies.push({x:player.x,y:player.y,dmg:Math.round(player.dmg*0.8*AP),life:10,cd:0,spr:'wolf'}); }
 else if(cls==='arbalest'){ player.deadeye=3; }
 else if(cls==='monk'){ player.bSpdT=5; player.bSpdM=1.8; player.inv=1.5; }
 else if(cls==='paladin'){ zones.push({x:player.x,y:player.y,r:95,life:6,tick:0,ap:AP}); }
 else if(cls==='necro'){ for(let i=0;i<2;i++) allies.push({x:player.x,y:player.y,dmg:Math.round(player.dmg*0.9*AP),life:12,cd:0,spr:'skel'}); }
 else if(cls==='bard'){ player.bRofT=6; player.bRofM=1.5; }
 else if(cls==='shaman'){ player.spiritT=8; player.spiritAP=AP; }
 else if(cls==='dragoon'){ const a0=player.aim||0;
   const nx=player.x+Math.cos(a0)*160, ny=player.y+Math.sin(a0)*160;
   if(!solid(nx,ny)){player.x=nx;player.y=ny;}
   aoe(player.x,player.y,130,Math.round(player.dmg*2.2*AP),'#e07a2e'); }
 navigator.vibrate&&navigator.vibrate(60);
}
$s('abBtn').addEventListener('pointerdown',function(ev){ ev.stopPropagation(); doAbility(); });
function eqPrefix(slot){ const a=eqAffArr(slot); return (a&&a.length)?AFFIX_PREFIX[a[0].s]+' ':''; }
function slotLabel(kind){ const ch=curChar(); if(!ch||!rpg)return '—';
 if(kind==='wpn'){ if(rpg.wpnL){const L=legById(rpg.wpnL); return '★ '+(L?L.n:'');}
  return eqPrefix('wpn')+'T'+((rpg.wpn||0)+1)+' '+weaponAt(ch.cls,rpg.wpn||0).n; }
 if(kind==='arm'){ if(rpg.armL){const L=legById(rpg.armL); return '★ '+(L?L.n:'');}
  return eqPrefix('arm')+'T'+((rpg.arm||0)+1)+' '+TIER_NAMES[rpg.arm||0]+' '+MATN[CARMOR[ch.cls]]; }
 if(kind==='helm') return rpg.helm>=0 ? eqPrefix('helm')+'T'+(rpg.helm+1)+' '+TIER_NAMES[rpg.helm]+' Helm' : 'No helm';
 if(kind==='ring') return rpg.ring ? eqPrefix('ring')+'T'+(rpg.ring.t+1)+' '+RINGN[rpg.ring.st] : 'No ring';
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
 function chip(l,v,col){ return '<div class="schip"><span>'+l+'</span><b'+(col?' style="color:'+col+'"':'')+'>'+v+'</b></div>'; }
 const S=player.stats||newStats();
 let sh='';
 for(const k of STATS) sh+=chip(STAT_META[k].s,S[k],STAT_META[k].col);
 sh+=chip('Pool HP',player.maxhp,'#8fd48c')+chip('Pool MP',player.maxmp,'#7ab8d4')
   +chip('Crit',Math.round(player.crit*100)+'%','#ffc94d');
 $s('eqStats').innerHTML=sh;
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
  if(it.rar) d.style.borderColor=RAR_COL[it.rar];
  const cvs=document.createElement('canvas'); cvs.width=44; cvs.height=38; cvs.className='isprite';
  const cc=cvs.getContext('2d'); cc.imageSmoothingEnabled=false;
  const sp=itemSprite(it);
  if(sp){ const sc=Math.max(1,Math.floor(Math.min(40/sp.width,34/sp.height)));
   cc.drawImage(sp,Math.round((44-sp.width*sc)/2),Math.round((38-sp.height*sc)/2),sp.width*sc,sp.height*sc); }
  d.appendChild(cvs);
  const badge=document.createElement('span'); badge.className='tbadge';
  badge.textContent=it.k==='pot'?'✦':'T'+(it.t+1); badge.style.color=itemRarCol(it);
  d.appendChild(badge);
  d.onclick=()=>{invSelIdx=i;paintInv();};
  g.appendChild(d); });
 const it=ch.inv[invSelIdx];
 if(it){ let html='<b style="color:'+itemRarCol(it)+'">'+itemName(it)+'</b>';
  if(it.rar) html+=' <span style="color:'+RAR_COL[it.rar]+'">('+RAR_NAMES[it.rar]+')</span>';
  html+=' · '+itemValue(it)+'g';
  if(it.k!=='pot'&&!canEquip(it,ch)) html+=' · <span style="color:#c04a3d">wrong class</span>';
  if(it.k!=='pot'){ const s2=itemStats(it,ch.cls); let sl='';
   for(const k of STATS){ if(s2[k]) sl+='<span style="color:'+STAT_META[k].col+'">+'+s2[k]+' '+STAT_META[k].s+'</span> '; }
   html+='<div class="istats">'+sl+'</div>'; }
  $s('invSel').innerHTML=html;
 } else $s('invSel').textContent='Tap an item';
 $s('invEquip').style.display = (it&&canEquip(it,ch)) ? '' : 'none';
 $s('invSell').style.display = it? '':'none';
 $s('invDrop').style.display = it? '':'none';
}
$s('invBtn').addEventListener('click',openInv);
$s('invClose').addEventListener('click',()=>{$s('invScr').style.display='none';});
$s('invEquip').addEventListener('click',()=>{ const ch=curChar(); if(!ch)return;
 const it=ch.inv[invSelIdx]; if(!it||!canEquip(it,ch)) return;
 if(!rpg.eqAff) rpg.eqAff={};
 let old=null; const slot=it.k;
 function oldAff(s){ const e=rpg.eqAff[s]; return e?{rar:e.r,aff:e.a}:{}; }
 if(it.k==='wpn'){ if(!rpg.wpnL) old=Object.assign({k:'wpn',wt:CWEAP[ch.cls],t:rpg.wpn||0},oldAff('wpn')); rpg.wpn=it.t; rpg.wpnL=null; }
 else if(it.k==='arm'){ if(!rpg.armL) old=Object.assign({k:'arm',mt:CARMOR[ch.cls],t:rpg.arm||0},oldAff('arm')); rpg.arm=it.t; rpg.armL=null; }
 else if(it.k==='helm'){ if(rpg.helm>=0) old=Object.assign({k:'helm',mt:CARMOR[ch.cls],t:rpg.helm},oldAff('helm')); rpg.helm=it.t; }
 else if(it.k==='ring'){ if(rpg.ring) old=Object.assign({k:'ring',st:rpg.ring.st,t:rpg.ring.t},oldAff('ring')); rpg.ring={st:it.st,t:it.t}; }
 rpg.eqAff[slot]={r:it.rar||0,a:it.aff||null};
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
 if(rpg.armL===undefined)rpg.armL=null; if(!ch.inv)ch.inv=[];
 if(rpg.eqAff===undefined) rpg.eqAff={}; if(rpg.mp===undefined) rpg.mp=null; }
function xpNeed(l){return Math.floor(50*Math.pow(l,1.5));}
function eqAffArr(slot){ const e=rpg&&rpg.eqAff&&rpg.eqAff[slot]; return e?e.a:null; }
function eqRar(slot){ const e=rpg&&rpg.eqAff&&rpg.eqAff[slot]; return e?e.r:0; }
function recalcStats(){ const ch=curChar(); if(!ch||!rpg)return;
 const ci=Math.max(0,CLASSES.findIndex(x=>x.id===ch.cls)); const c=CLASSES[ci];
 player.cname=ch.name; player.hue=ci*20;
 rpg.wpn=Math.min(rpg.wpn||0,MAXT-1);
 player.wt=classWT(ch.cls);
 if(!rpg.eqAff) rpg.eqAff={};
 const mt=CARMOR[ch.cls]||'plate';
 const at=rpg.arm||0, ht=(rpg.helm===undefined?-1:rpg.helm), rg=rpg.ring;
 const wL=rpg.wpnL?legById(rpg.wpnL):null;
 const aL=rpg.armL?legById(rpg.armL):null;
 // ---- accumulate the 10 stats: class base + level + gear (+ affixes)
 const st=addStats(classBaseStats(c), levelStats(c,rpg.lvl));
 if(wL) st.atk+=wL.add; else addStats(st,gearBaseStats('wpn',rpg.wpn));
 addStats(st,affStats(eqAffArr('wpn')));
 if(aL){ st.def+=aL.def; st.hp+=aL.hp; st.spd+=aL.spd||0; }
 else addStats(st,gearBaseStats('arm',at,mt));
 addStats(st,affStats(eqAffArr('arm')));
 if(ht>=0){ addStats(st,gearBaseStats('helm',ht,mt)); addStats(st,affStats(eqAffArr('helm'))); }
 if(rg){ addStats(st,gearBaseStats('ring',rg.t,rg.st)); addStats(st,affStats(eqAffArr('ring'))); }
 for(const k of STATS) st[k]=Math.max(0,Math.round(st[k]));
 player.stats=st;
 // ---- derive combat values from the 10 stats
 player.def=st.def;
 player.dr=Math.min(0.80, st.def/(st.def+55));       // DEFENSE -> % damage reduction
 player.maxhp=Math.round(st.hp + st.vit*3);           // HP + VIT
 player.spd=st.spd;                                   // SPEED
 player.dmg=Math.max(1,Math.round(st.atk));           // ATTACK
 const wRof=(player.wt.rof||1)*(wL?(wL.rof||1):1);
 player.fireRate=c.fr*wRof/(1+st.dex*0.02);           // DEX -> attack speed
 player.projSpd=1+st.dex*0.012;                       // DEX -> projectile speed
 player.regen=0.8+st.vit*0.12;                        // VIT -> hp regen/sec
 player.maxmp=Math.max(10,Math.round(st.mp));         // MP -> mana pool
 player.mpregen=2+st.wis*0.25;                        // WISDOM -> mana regen
 player.abilPow=1+st.wis*0.02;                        // WISDOM -> ability power
 player.crit=Math.min(0.75, st.luck*0.005);           // LUCK -> crit chance + hit
 player.critMult=1.5+st.luck*0.004;
 player.fortune=st.fort;                              // FORTUNE -> loot
 player.shots=c.shots||1; player.pierce=c.pierce||0;
 player.ls=c.ls||0; player.slowShot=!!c.slow;
 player.resDef=ABIL[ch.cls]||ABIL.squire;
 player.look={cls:ch.cls, hue:ci*20, mt:mt, armT:(aL?11:at), helmT:ht};
 if(player.mp===undefined||player.mp>player.maxmp) player.mp=player.maxmp;
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
   out.push({l:'T'+(nt+1)+' '+w.n+' (+'+w.add+' dmg)',c:w.cost,f:function(){rpg.wpn=nt; rpg.wpnL=null; if(rpg.eqAff)rpg.eqAff.wpn=null;}}); }
  else out.push({l:'Bram stocks up to T3 — finer steel is won in the field',c:-1});
  legendRows('wpn',out); }
 if(id==='sella'){ const na=(rpg.arm||0)+1;
  if(na<3) out.push({l:'T'+(na+1)+' '+MATN[CARMOR[ch.cls]]+' Armor',c:Math.round(tierCost(na)*0.8),f:function(){rpg.arm=na; rpg.armL=null; if(rpg.eqAff)rpg.eqAff.arm=null;}});
  else out.push({l:'Armor above T3 must be found, not bought',c:-1});
  const nh=(rpg.helm===undefined||rpg.helm<0)?0:rpg.helm+1;
  if(nh<3) out.push({l:'T'+(nh+1)+' '+MATN[CARMOR[ch.cls]]+' Helm',c:Math.round(tierCost(Math.max(1,nh))*0.6),f:function(){rpg.helm=nh; if(rpg.eqAff)rpg.eqAff.helm=null;}});
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
 loadRPG(); recalcStats(); player.hp=player.maxhp; player.mp=player.maxmp;
 player.kills=0; player.inv=1;
 res=0; allies=[]; zones=[]; fx=[]; player.spiritT=0; player.deadeye=0;
 player.bDmgT=0; player.bRofT=0; player.bSpdT=0;
 spawnPet();
 document.getElementById('killTxt').textContent='Kills 0';
 hudRPG();
 hideAll(); $s('menuBtn').style.display='flex'; if(isAdmin)$s('devBtn2').style.display='flex';
 $s('potBtn').style.display='flex'; $s('invBtn').style.display='flex'; $s('abBtn').style.display='none'; $s('mapBtn').style.display='flex'; inGame=true;
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
