// ---------- accounts, menus, character select ----------
let inGame=false; let isAdmin=false;
const memStore={};
const LS={
 get:(k,d)=>{try{const v=localStorage.getItem(k);return v!==null?JSON.parse(v):(k in memStore?memStore[k]:d);}catch(e){return k in memStore?memStore[k]:d;}},
 set:(k,v)=>{memStore[k]=v;try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
};
let users=LS.get('er-users',{});
let curUser=null;

// ---- teleport-pillar fast-travel ----
let _pillarSet=null;
function _pillars(){ if(!_pillarSet) _pillarSet=new Set(LS.get('er-pillars',[])); return _pillarSet; }
function pillarUnlocked(b){ return _pillars().has(b); }
function unlockPillar(b){ _pillars().add(b); LS.set('er-pillars',[..._pillarSet]); }
function closeFastTravel(){ const ov=document.getElementById('ftScr'); if(ov) ov.style.display='none'; }
function travelTo(pl){ closeFastTravel(); const g=rooms['G']; const sp=safeSpot(g,pl.x,pl.y);
  player.x=sp.x; player.y=sp.y; enemies=enemies.filter(e=>e.boss); portalLock=true; msg('WARPED',pl.name); }
function openFastTravel(){ const G=rooms['G']; if(!G||!G.pillars) return;
  let ov=document.getElementById('ftScr');
  if(!ov){ ov=document.createElement('div'); ov.id='ftScr';
    ov.style.cssText='position:fixed;inset:0;background:rgba(8,6,10,.82);z-index:70;display:flex;align-items:center;justify-content:center;'; document.body.appendChild(ov); }
  const card=document.createElement('div');
  card.style.cssText='background:#1a151f;border:1px solid #4a3d5c;border-radius:12px;padding:18px;min-width:250px;max-width:90vw;text-align:center;';
  card.innerHTML='<div style="font:bold 15px monospace;color:#ffd07a;margin-bottom:12px;letter-spacing:.1em;">✦ WAYPOINTS ✦</div>';
  for(const pl of G.pillars){ const un=pillarUnlocked(pl.band);
    const b=document.createElement('button');
    b.textContent=(un?'▸ ':'🔒 ')+pl.name+'  ·  Lv '+G.rings.names[pl.band].lv;
    b.disabled=!un;
    b.style.cssText='display:block;width:100%;margin:5px 0;padding:10px;border-radius:7px;border:1px solid #4a3d5c;font:13px monospace;text-align:left;background:'+(un?'#2a2233':'#181420')+';color:'+(un?'#e8e0d0':'#6a6270')+';cursor:'+(un?'pointer':'default')+';';
    if(un) b.onclick=()=>travelTo(pl);
    card.appendChild(b); }
  const cl=document.createElement('button'); cl.textContent='CLOSE';
  cl.style.cssText='display:block;width:100%;margin-top:12px;padding:10px;border-radius:7px;border:1px solid #4a3d5c;background:#3a2c20;color:#e8e0d0;font:13px monospace;cursor:pointer;';
  cl.onclick=closeFastTravel; card.appendChild(cl);
  ov.innerHTML=''; ov.appendChild(card); ov.style.display='flex'; }
async function hash(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('emberrealm\u00b7'+s));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
const CLASSES=[
 {id:'ranger',n:'Ranger',ic:'🏹',d:'Fast hands, thin armor.',hp:90,spd:205,dmg:9,fr:0.14},
 {id:'pyro',n:'Pyromancer',ic:'🔥',d:'Bolts that hit like a forge.',hp:80,spd:160,dmg:26,fr:0.38},
 {id:'knight',n:'Knight',ic:'⚔️',d:'A walking wall of iron.',hp:190,spd:145,dmg:14,fr:0.30},
 {id:'rogue',n:'Rogue',ic:'🗡️',d:'Never where the blade lands.',hp:85,spd:230,dmg:8,fr:0.16},
 {id:'assassin',n:'Assassin',ic:'🔪',d:'One breath, one kill.',hp:88,spd:220,dmg:14,fr:0.20},
 {id:'cleric',n:'Cleric',ic:'⛑️',d:'Wounds close as fast as they open.',hp:115,spd:170,dmg:10,fr:0.24,regen:3},
 {id:'berserker',n:'Berserker',ic:'🪓',d:'Anger, weaponized.',hp:125,spd:185,dmg:19,fr:0.30},
 {id:'warlock',n:'Warlock',ic:'💀',d:'Every wound he deals feeds him.',hp:95,spd:170,dmg:16,fr:0.28,ls:0.12},
 {id:'frost',n:'Frostweaver',ic:'❄️',d:'Her bolts freeze the blood.',hp:100,spd:170,dmg:13,fr:0.26,slow:true},
 {id:'storm',n:'Stormcaller',ic:'⚡',d:'Lightning stops for no one.',hp:95,spd:180,dmg:12,fr:0.26,pierce:2},
 {id:'hunter',n:'Hunter',ic:'🐺',d:'Two arrows, one breath.',hp:105,spd:195,dmg:8,fr:0.22,shots:2,spread:0.10},
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
 dagger:{n:'Dagger',shots:2,spread:0.12,spd:560,life:0.28,size:4,dm:0.6,rof:0.6},
 bow:{n:'Bow',shots:1,spd:640,life:1.2,size:5,dm:1.0,rof:1.0},
 xbow:{n:'Crossbow',shots:1,spd:760,life:1.3,size:6,dm:1.7,rof:1.7,pierce:1},
 staff:{n:'Staff',shots:2,par:11,spd:480,life:0.9,size:6,dm:0.85,rof:1.0},
 wand:{n:'Wand',shots:1,spd:600,life:1.4,size:4,dm:0.9,rof:0.85},
 fists:{n:'Fists',shots:1,spd:520,life:0.18,size:5,dm:0.7,rof:0.5},
};
// Melee -> sword; rogue/assassin -> dagger; ranger/hunter/bard -> bow (swap to xbow, see WSWAP); monk -> fists.
const CWEAP={rogue:'dagger',assassin:'dagger',monk:'fists',ranger:'bow',hunter:'bow',bard:'bow',
 pyro:'staff',frost:'staff',cleric:'wand',storm:'wand',
 warlock:'wand',necro:'staff',berserker:'sword',knight:'sword',paladin:'sword',
 dragoon:'sword',shaman:'staff'};
// Classes that can toggle between two ranged weapons (bow <-> crossbow).
const WSWAP={ranger:['bow','xbow'],hunter:['bow','xbow'],bard:['bow','xbow']};
const CARMOR={knight:'plate',paladin:'plate',berserker:'plate',dragoon:'plate',
 ranger:'leather',hunter:'leather',rogue:'leather',assassin:'leather',monk:'leather',bard:'leather',
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
 if(r<0.5){ const keys=Object.keys(WTYPE).filter(k=>k!=='fists');
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
 ranger:{res:'Focus',col:'#7dc47a',rule:'hit',d:'Volley: 12-arrow fan'},
 pyro:{res:'Heat',col:'#ff7a3d',rule:'shot',d:'Detonate: fiery blast around you'},
 knight:{res:'Defiance',col:'#c9d2da',rule:'hurt',d:'Bulwark: 4s invulnerable'},
 rogue:{res:'Combo',col:'#c07ad4',rule:'hit',d:'Shadowstep: blink forward, untouchable'},
 assassin:{res:'Malice',col:'#c0304a',rule:'hit',d:'Deathmark: +120% dmg + evade, 4s'},
 cleric:{res:'Grace',col:'#fff0c0',rule:'calm',d:'Sanctuary: full heal'},
 berserker:{res:'Rage',col:'#e2604c',rule:'hurt',d:'Whirlwind: 16-blade ring'},
 warlock:{res:'Essence',col:'#8a5ac0',rule:'hit',d:'Soulburst: drain all nearby foes'},
 frost:{res:'Rime',col:'#9ad4ef',rule:'hit',d:'Winter Nova: freeze everything near'},
 storm:{res:'Charge',col:'#ffe9b0',rule:'time2',d:'Chain Storm: lightning hits 6 foes'},
 hunter:{res:'Instinct',col:'#7dc47a',rule:'kill',d:'Wolfpack: 2 wolves fight for you'},
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
// Ability casting now routes through the 3-slot loadout system (12b_abilities.js).
function abilityCost(){ return (typeof armedCost==='function')?armedCost():1e9; }
function doAbility(wx,wy){ if(typeof castArmed==='function') castArmed(wx,wy); }
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
 c.fillStyle='#14110e'; c.fillRect(0,0,cv2.width,cv2.height);
 // vertical zone map, tile by tile \u2014 band by height (bottom=green vale, top=molten)
 const NZ=G.rings.names.length;
 const MRAMP=['#547a44','#3c5b35','#556636','#66705a','#767c74','#836254','#6a635e','#8a4a22','#b5451e'];
 for(let y=0;y<G.h;y++){ const row=G.grid[y];
  const bd=Math.max(0,Math.min(NZ-1,Math.floor((1-y/G.h)*NZ)));
  for(let x=0;x<G.w;x++){ const ch=row[x];
   if(ch==='W') continue;
   c.fillStyle=(ch==='t')?'rgba(20,40,20,0.9)':(ch==='k')?'#5d5666':(MRAMP[bd]||'#547a44');
   c.fillRect(x*scl,y*scl,scl+0.6,scl+0.6); } }
 // zone boundary lines + centered labels
 c.strokeStyle='rgba(0,0,0,0.45)'; c.lineWidth=1;
 for(let i=1;i<NZ;i++){ const yy=G.h*(1-i/NZ)*scl;
  c.beginPath(); c.moveTo(0,yy); c.lineTo(cv2.width,yy); c.stroke(); }
 c.textAlign='center';
 for(let i=0;i<NZ;i++){ const rg=G.rings.names[i];
  const ly=G.h*(1-(i+0.5)/NZ)*scl, lx=cv2.width/2;
  c.font='bold 9px "Pixelify Sans",monospace';
  c.fillStyle='rgba(0,0,0,0.85)'; c.fillText(rg.n,lx+1,ly+1);
  c.fillStyle='#f0e8d8'; c.fillText(rg.n,lx,ly);
  c.font='8px "Pixelify Sans",monospace';
  c.fillStyle='rgba(0,0,0,0.85)'; c.fillText('Lv '+rg.lv,lx+1,ly+10);
  c.fillStyle='#ffc94d'; c.fillText('Lv '+rg.lv,lx,ly+9); }
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
// paper-doll equipment sockets: draw each equipped item's sprite into its slot canvas
function paintEqSlots(ch){ const cls=ch.cls, mt=CARMOR[cls]||'plate', wt=CWEAP[cls]||'sword';
 const items={
   helm: rpg.helm>=0 ? {k:'helm',mt:mt,t:rpg.helm} : null,
   wpn:  rpg.wpnL ? {k:'wpn',wt:wt,t:11,leg:1} : {k:'wpn',wt:wt,t:rpg.wpn||0},
   arm:  rpg.armL ? {k:'arm',mt:mt,t:11,leg:1} : {k:'arm',mt:mt,t:rpg.arm||0},
   ring: rpg.ring ? {k:'ring',st:rpg.ring.st,t:rpg.ring.t} : null };
 document.querySelectorAll('#eqDoll .eqSlot').forEach(el=>{
   const it=items[el.getAttribute('data-slot')];
   const cv=el.querySelector('.eqCv'), g=cv.getContext('2d'); g.imageSmoothingEnabled=false; g.clearRect(0,0,cv.width,cv.height);
   const tb=el.querySelector('.eqTb');
   if(it){ const sp=itemSprite(it);
     if(sp&&sp.width){ const sc=Math.max(1,Math.floor(Math.min((cv.width-10)/sp.width,(cv.height-10)/sp.height)));
       g.drawImage(sp,Math.round((cv.width-sp.width*sc)/2),Math.round((cv.height-sp.height*sc)/2),sp.width*sc,sp.height*sc); }
     tb.textContent=it.leg?'★':('T'+(it.t+1)); tb.style.color=it.leg?'#ff9c50':tierCol(it.t); el.classList.add('filled');
   } else { tb.textContent=''; el.classList.remove('filled'); } });
}
function paintInv(){ const ch=curChar(); if(!ch||!rpg)return;
 if(!ch.inv) ch.inv=[];
 recalcStats();
 const ci=Math.max(0,CLASSES.findIndex(x=>x.id===ch.cls)); const c=CLASSES[ci];
 paintEqSlots(ch);
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
 const th=CTHEME[ch.cls]||CTHEME.knight;
 const glow=d2.createRadialGradient(dc.width/2,dc.height*0.5,3,dc.width/2,dc.height*0.5,48);
 glow.addColorStop(0,th.p+'3c'); glow.addColorStop(1,'rgba(0,0,0,0)');
 d2.fillStyle=glow; d2.fillRect(0,0,dc.width,dc.height);
 d2.fillStyle='rgba(0,0,0,0.4)'; d2.beginPath(); d2.ellipse(dc.width/2,dc.height-13,28,6,0,0,6.29); d2.fill();
 // portrait: prefer the real PixelLab class sprite (south-facing idle); it already holds
 // the weapon, so no separate weapon overlay. Fall back to the procedural hero if not loaded.
 let drewReal=false;
 if(typeof _emberReady!=='undefined' && _emberReady[ch.cls] && typeof _emberIdle==='function'){
  const im=_emberIdle(ch.cls,'s');
  if(im && im.complete && im.naturalWidth){
   const sc=Math.min((dc.width-8)/im.naturalWidth,(dc.height-14)/im.naturalHeight);
   const w=im.naturalWidth*sc, h=im.naturalHeight*sc;
   d2.drawImage(im,Math.round((dc.width-w)/2),Math.round(dc.height-8-h),w,h); drewReal=true;
  }
 }
 if(!drewReal){
  const hs=heroSprite(player.look||{cls:ch.cls,helmT:-1},0); const sc=5;
  const hx=Math.round((dc.width-hs.width*sc)/2), hy=dc.height-16-hs.height*sc;
  d2.drawImage(hs,hx,hy,hs.width*sc,hs.height*sc);
  const ws=wpnSpr(CWEAP[ch.cls]||'sword',rpg.wpnL?11:(rpg.wpn||0));
  d2.save(); d2.translate(hx+hs.width*sc-4,hy+hs.height*sc*0.6); d2.rotate(-1.1);
  d2.drawImage(ws,-2,-ws.height*1.1,ws.width*2.2,ws.height*2.2); d2.restore();
 }
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
$s('loadBtn').addEventListener('click',function(){ if(typeof openLoadout==='function') openLoadout(); });
$s('skillBtn').addEventListener('click',function(){ if(typeof openSkills==='function') openSkills(); });
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
 if(rpg.eqAff===undefined) rpg.eqAff={}; if(rpg.mp===undefined) rpg.mp=null;
 if(rpg.arenaBest===undefined) rpg.arenaBest=0; }
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
 // ---- skill-tree flat stats fold in before deriving; % / flags applied after
 const T=(typeof treeStats==='function')?treeStats(ch.cls,rpg):null;
 if(T){ st.atk+=T.atk; st.def+=T.def; st.hp+=T.hp; st.mp+=T.mp; st.dex+=T.dex; st.wis+=T.wis; st.vit+=T.vit; st.spd=st.spd*(1+T.spd); }
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
 player.resDef=ABIL[ch.cls]||ABIL.knight;
 // ---- skill-tree percentage bonuses + combat flags
 player.thorns=0;
 if(T){ player.maxhp=Math.round(player.maxhp*(1+T.hpPct));
   player.dmg=Math.max(1,Math.round(player.dmg*(1+T.atkPct)));
   player.dr=Math.min(0.88, player.dr+T.dr);
   player.crit=Math.min(0.90, player.crit+T.crit);
   player.ls=player.ls+T.ls;
   player.pierce=player.pierce+T.cleave;
   player.thorns=T.thorns;
   if(T.rof>0) player.fireRate=player.fireRate/(1+T.rof);
   player.spd=player.spd; }
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
  if(typeof grantPerkPoints==='function') grantPerkPoints(rpg);
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
 if(owned) out.push({l:L.n, desc:(eq?'in use · tap to set aside':'owned · tap to equip'), legend:true, c:0,
   f:function(){ if(slot==='wpn') rpg.wpnL=(eq?null:L.id); else rpg.armL=(eq?null:L.id); }});
 else out.push({l:L.n, desc:L.d, legend:true, c:L.price,
   f:function(){ if(!rpg.legends)rpg.legends=[]; rpg.legends.push(L.id);
     if(slot==='wpn') rpg.wpnL=L.id; else rpg.armL=L.id; }});
} }
function shopRowsFor(id){ const ch=curChar(); const out=[]; const cls=ch.cls;
 if(id==='bram'){ const nt=(rpg.wpn||0)+1;
  if(nt<3){ const w=weaponAt(cls,nt);
   out.push({l:'T'+(nt+1)+' '+w.n, desc:'+'+w.add+' ATTACK', ic:{k:'wpn',wt:CWEAP[cls],t:nt}, c:w.cost,
    f:function(){rpg.wpn=nt; rpg.wpnL=null; if(rpg.eqAff)rpg.eqAff.wpn=null;}}); }
  else out.push({note:'Bram stocks up to T3 — finer steel is won in the field.'});
  legendRows('wpn',out); }
 if(id==='sella'){ const mt=CARMOR[cls]; const na=(rpg.arm||0)+1;
  if(na<3){ const s=gearBaseStats('arm',na,mt);
   out.push({l:'T'+(na+1)+' '+MATN[mt]+' Armor', desc:'+'+s.def+' DEF · +'+s.hp+' HP', ic:{k:'arm',mt:mt,t:na},
    c:Math.round(tierCost(na)*0.8), f:function(){rpg.arm=na; rpg.armL=null; if(rpg.eqAff)rpg.eqAff.arm=null;}}); }
  else out.push({note:'Armor above T3 must be found, not bought.'});
  const nh=(rpg.helm===undefined||rpg.helm<0)?0:rpg.helm+1;
  if(nh<3){ const s=gearBaseStats('helm',nh,mt);
   out.push({l:'T'+(nh+1)+' '+MATN[mt]+' Helm', desc:'+'+s.wis+' WIS · +'+s.mp+' MP', ic:{k:'helm',mt:mt,t:nh},
    c:Math.round(tierCost(Math.max(1,nh))*0.6), f:function(){rpg.helm=nh; if(rpg.eqAff)rpg.eqAff.helm=null;}}); }
  else out.push({note:'Helms above T3 drop in the field.'});
  legendRows('arm',out); }
 if(id==='odo'){ const pets=[['wolf','Grey Wolf',500,'a loyal hunter'],['skel','Bone Servant',1500,'tireless and grim'],['wisp','Ember Wisp',4000,'burns for you']];
  if(!rpg.pets)rpg.pets=[];
  for(const p of pets){ const pid=p[0],nm=p[1],cost=p[2];
   if(rpg.pets.indexOf(pid)>=0)
    out.push({l:nm, desc:(rpg.pet===pid?'✦ following you':'owned · tap to summon'), pet:pid, c:0,
     f:function(){rpg.pet=(rpg.pet===pid?null:pid); spawnPet();}});
   else out.push({l:nm, desc:p[3], pet:pid, c:cost, f:function(){rpg.pets.push(pid); rpg.pet=pid; spawnPet();}}); } }
 if(id==='maren'){ out.push({l:'Ember Tonic', desc:'restores +60 HP', ic:{k:'pot'}, c:15, f:function(){rpg.pots++;}});
  out.push({note:'Carrying '+rpg.pots+' tonic'+(rpg.pots===1?'':'s')+'.'}); }
 return out; }
function openShop2(id){ const n=SHOPNPCS.filter(function(x){return x.id===id;})[0]||SHOPNPCS[0];
 $s('shopTitle').textContent=n.title;
 $s('shopScr').style.display='flex'; paintShop2(n.id); }
function paintShop2(id){ if(!rpg) return;
 const np=SHOPNPCS.filter(x=>x.id===id)[0];
 $s('shopGold').innerHTML='<span class="purse">🪙 '+rpg.gold+' gold</span>';
 const box=$s('shopRows'); box.innerHTML='';
 for(const it of shopRowsFor(id)){
  if(it.note){ const d=document.createElement('div'); d.className='shopnote'; d.textContent=it.note; box.appendChild(d); continue; }
  const afford=!(it.c>0&&rpg.gold<it.c);
  const card=document.createElement('div'); card.className='shopcard'+(afford?'':' broke')+(it.legend?' legend':'');
  const ico=document.createElement('div'); ico.className='shopico';
  const sp = it.ic?itemSprite(it.ic) : (it.pet?petSprite(it.pet) : null);
  if(sp){ const cv=document.createElement('canvas'); cv.width=42; cv.height=36; cv.className='isprite';
   const cc=cv.getContext('2d'); cc.imageSmoothingEnabled=false;
   const sc=Math.max(1,Math.floor(Math.min(38/sp.width,32/sp.height)));
   cc.drawImage(sp,Math.round((42-sp.width*sc)/2),Math.round((36-sp.height*sc)/2),sp.width*sc,sp.height*sc);
   ico.appendChild(cv);
  } else { ico.classList.add('emoji'); ico.textContent=it.legend?'★':'🛒'; }
  card.appendChild(ico);
  const txt=document.createElement('div'); txt.className='shoptext';
  txt.innerHTML='<div class="shopname">'+it.l+'</div><div class="shopdesc">'+(it.desc||'')+'</div>';
  card.appendChild(txt);
  const pr=document.createElement('div'); pr.className='shopprice'+(it.c>0?'':' free');
  pr.textContent = it.c>0 ? it.c+'g' : (it.c===0?'✓':'');
  card.appendChild(pr);
  card.onclick=function(){ if(it.c>0&&rpg.gold<it.c){ navigator.vibrate&&navigator.vibrate(20); return; }
   if(it.c>0) rpg.gold-=it.c;
   if(it.f) it.f(); recalcStats(); saveRPG(); hudRPG(); paintShop2(id);
   navigator.vibrate&&navigator.vibrate(15); };
  box.appendChild(card); }
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
 if($s('loadBtn'))$s('loadBtn').style.display='none';
 if($s('loadScr'))$s('loadScr').style.display='none';
 if($s('skillBtn'))$s('skillBtn').style.display='none';
 if($s('skillScr'))$s('skillScr').style.display='none';
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
   +'<div class="cd">'+c.d+'<br><span style="color:#ffd07a">'+((typeof APOOL!=='undefined'&&APOOL[c.id])?APOOL[c.id][0].name+' — '+APOOL[c.id][0].desc:'')+'</span></div>'
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
 player.acd={}; armedSlot=0; if(typeof ensureLoadout==='function') ensureLoadout();
 if(typeof grantPerkPoints==='function') grantPerkPoints(rpg);   // backfill earned perk points
 spawnPet();
 document.getElementById('killTxt').textContent='Kills 0';
 hudRPG();
 hideAll(); $s('menuBtn').style.display='flex'; if(isAdmin)$s('devBtn2').style.display='flex';
 $s('potBtn').style.display='flex'; $s('invBtn').style.display='flex'; $s('abBtn').style.display='none'; $s('mapBtn').style.display='flex';
 if($s('loadBtn'))$s('loadBtn').style.display='flex';
 if($s('skillBtn'))$s('skillBtn').style.display='flex'; inGame=true;
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
