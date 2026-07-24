// ---------- PET SYSTEM (roadmap #7) ----------
// Pets live in a COLLECTION on the USER (not the character), so they SURVIVE hero permadeath —
// the one thing you don't lose on death. Eggs are rare BOSS drops (condition zone-scaled). Opening
// an egg is a weighted rarity ROLL within the egg's band; the rolled rarity picks a pet of the
// egg's CATEGORY (closest available rarity in that family). You equip ONE active pet at a time; it
// follows you and auto-casts a rolled UTILITY kit (Phase 2). Pets level + fuse/evolve after hatch.
//
// Rarity ladder reuses the loot system: 0 Common · 1 Uncommon · 2 Rare · 3 Epic · 4 Legendary.
// (Mythical(5) is gear-only; pets top out at Legendary.)

// 9 categories (the "type" of a pet + its egg). key -> {name, emoji, col} for egg tint + UI.
const PET_CATS = {
  ember:  {name:'Ember',   emoji:'🔥', col:'#ff7a3d'},
  verdant:{name:'Verdant', emoji:'🌿', col:'#5cbf4a'},
  beast:  {name:'Beast',   emoji:'🐾', col:'#c9a06a'},
  storm:  {name:'Storm',   emoji:'⚡', col:'#6ab8ff'},
  tide:   {name:'Tide',    emoji:'💧', col:'#4aa6d6'},
  stone:  {name:'Stone',   emoji:'🪨', col:'#9a938a'},
  frost:  {name:'Frost',   emoji:'❄️', col:'#a9e0ff'},
  spirit: {name:'Spirit',  emoji:'✨', col:'#d6a6ff'},
  void:   {name:'Void',    emoji:'🟣', col:'#b23ce0'},
};
const PET_CAT_KEYS = Object.keys(PET_CATS);
const PET_RAR_NAME = ['Common','Uncommon','Rare','Epic','Legendary'];
const PET_RAR_COL  = ['#b8b2a6','#5fd06a','#4aa6ff','#c07add','#ffb23d'];

// The 32 creatures. spr = assets/pets/<spr>.png ; rar derived from the spr prefix.
function _rarOf(spr){ return spr.startsWith('legendary')?4:spr.startsWith('epic')?3:spr.startsWith('rare')?2:spr.startsWith('uncommon')?1:0; }
const PET_DB = [
  ['common_0','Emberling','ember'], ['common_1','Sproutling','verdant'], ['common_2','Cavebat','beast'],
  ['common_3','Dust Mouse','beast'], ['common_4','Pebble Beetle','stone'], ['common_5','Meadow Chick','beast'],
  ['common_6','Bog Toad','tide'], ['common_7','Cinder Moth','ember'], ['common_8','Thistle Hare','verdant'],
  ['common_9','Glow Snail','tide'], ['common_10','Twig Imp','verdant'], ['common_11','Frost Kit','frost'],
  ['uncommon_0','Grove Fox','verdant'], ['uncommon_1','Ashen Hound','beast'], ['uncommon_2','Storm Sparrow','storm'],
  ['uncommon_3','Marsh Newt','tide'], ['uncommon_4','Stone Badger','stone'], ['uncommon_5','Wisp Cat','spirit'],
  ['uncommon_6','Thorn Boar','verdant'], ['uncommon_7','Ember Ferret','ember'],
  ['rare_0','Crystal Stag','spirit'], ['rare_1','Molten Hound','ember'], ['rare_2','Tempest Owl','storm'],
  ['rare_3','Bramble Bear','verdant'], ['rare_4','Spirit Serpent','spirit'], ['rare_5','Glimmerfox','spirit'],
  ['epic_0','Frostmane Wolf','frost'], ['epic_1','Emberwing Drake','ember'], ['epic_2','Wraithcat','void'],
  ['epic_3','Thunderhorn Ram','beast'],
  ['legendary_0','Celestial Phoenix','ember'], ['legendary_1','Void Leviathan','void'],
].map(([spr,name,cat])=>({spr,name,cat,rar:_rarOf(spr)}));
function petDef(spr){ return PET_DB.find(p=>p.spr===spr)||null; }

// Utility-ability pool — pets auto-cast these (Phase 2). Each: {id,name,icon,desc,cd(sec),kind}.
// kind drives the effect in petAct() later. Rolled onto a pet at hatch; count = rarity+1 (1..5).
const PET_UTIL = [
  {id:'mend',   name:'Mend',    icon:'💚', cd:9,  desc:'heals you for a burst of HP'},
  {id:'font',   name:'Font',    icon:'🔷', cd:10, desc:'restores a burst of MP'},
  {id:'shock',  name:'Shock',   icon:'⚡', cd:6,  desc:'zaps the nearest enemy (shock)'},
  {id:'stun',   name:'Stun',    icon:'💫', cd:12, desc:'briefly stuns the nearest enemy'},
  {id:'guard',  name:'Guard',   icon:'🛡️', cd:14, desc:'grants you a short shield'},
  {id:'spark',  name:'Spark',   icon:'✨', cd:8,  desc:'small burst of damage around you'},
  {id:'haste',  name:'Haste',   icon:'👟', cd:16, desc:'brief burst of move speed'},
  {id:'chill',  name:'Chill',   icon:'❄️', cd:9,  desc:'chills nearby enemies (slow)'},
  {id:'regen',  name:'Regen',   icon:'🌿', cd:0,  desc:'passive: slow HP regeneration'},
  {id:'fortune',name:'Fortune', icon:'🍀', cd:0,  desc:'passive: improves your loot fortune'},
];
function petUtil(id){ return PET_UTIL.find(u=>u.id===id)||null; }

// ---- collection storage on the USER (survives character death) ----
function petStore(){ const u=(typeof users!=='undefined'&&curUser)?users[curUser]:null; if(!u) return null;
  if(!Array.isArray(u.pets)) u.pets=[];        // hatched pet instances
  if(!Array.isArray(u.eggs)) u.eggs=[];        // unhatched eggs
  if(u.activePet===undefined) u.activePet=null;// uid of the equipped pet
  if(u.petSeq===undefined) u.petSeq=1;         // uid counter
  return u; }
function savePets(){ if(typeof LS!=='undefined'&&typeof users!=='undefined') LS.set('er-users',users); }

// ---- egg drops (called from rollLoot for bosses) ----
// condition by the boss's level: <20 Common, 20-39 Uncommon, 40+ Rare (small chance to shift +/-1).
function eggCondForLevel(lv){ let c = lv>=40?2 : lv>=20?1 : 0;
  const r=Math.random(); if(r<0.12) c=Math.min(2,c+1); else if(r>0.90) c=Math.max(0,c-1); return c; }
// returns an egg loot item {k:'egg',cond,cat} or null. Bosses only, rare.
// Eggs DROP AS LOOSE EGGS on the ground (NOT loot bags): their own drift list, auto-collected on
// walk-over, drawn as the themed egg sprite with a soft category-coloured glow.
const EGG_DROP_CHANCE = 0.16;
let petEggDrops = [];
function spawnEggDrop(e){ if(!e||e.type!=='B') return; if(Math.random()>=EGG_DROP_CHANCE) return;
  const cat=PET_CAT_KEYS[(Math.random()*PET_CAT_KEYS.length)|0], cond=eggCondForLevel(e.lv||1);
  petEggDrops.push({x:e.x,y:e.y,cond,cat,life:200});
  if(typeof msg==='function') msg('🥚 A pet egg dropped!', (PET_CATS[cat]?PET_CATS[cat].name:'')+' · '+PET_RAR_NAME[cond]+' condition'); }
function updateEggDrops(dt){ if(!petEggDrops.length) return;
  for(let i=petEggDrops.length-1;i>=0;i--){ const d=petEggDrops[i]; d.life-=dt;
    if(d.life<=0){ petEggDrops.splice(i,1); continue; }
    if(typeof player!=='undefined' && Math.hypot(player.x-d.x,player.y-d.y)<38){ giveEgg(d.cond,d.cat); petEggDrops.splice(i,1); } } }
function drawEggDrops(){ if(!petEggDrops.length||typeof ctx==='undefined') return;
  const t=performance.now()/1000;
  for(const d of petEggDrops){ const im=_eggImg&&_eggImg[d.cat], col=(PET_CATS[d.cat]&&PET_CATS[d.cat].col)||'#ffffff';
    const bob=Math.sin(t*2.2+d.x*0.03)*2, pulse=0.5+0.5*Math.sin(t*2.4+d.x*0.05), a=d.life<12?Math.max(0,d.life/12):1;
    ctx.save(); ctx.globalAlpha=a;
    ctx.globalCompositeOperation='lighter';
    const g=ctx.createRadialGradient(d.x,d.y+4,1,d.x,d.y+4,22);
    g.addColorStop(0,col+(pulse>0.5?'88':'55')); g.addColorStop(1,col+'00');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(d.x,d.y+4,22,0,6.29); ctx.fill();
    ctx.globalCompositeOperation='source-over';
    if(typeof shadow==='function') shadow(d.x,d.y+9,9);
    if(im&&im.complete&&im.naturalWidth){ const sc=30/im.naturalWidth; ctx.imageSmoothingEnabled=false;
      ctx.drawImage(im,Math.round(d.x-im.naturalWidth*sc/2),Math.round(d.y-im.naturalHeight*sc/2+bob),im.naturalWidth*sc,im.naturalHeight*sc); }
    ctx.restore(); } }

// ---- pickup: add an egg to the collection (called when a {k:'egg'} bag is collected) ----
function giveEgg(cond,cat){ const u=petStore(); if(!u) return;
  const need=[24,44,72][cond]||24;             // incubation = kills (rarer condition -> longer)
  u.eggs.push({cond, cat, need, prog:0});
  savePets();
  if(typeof msg==='function') msg('🥚 '+(PET_CATS[cat]?PET_CATS[cat].name:'')+' Egg', PET_RAR_NAME[cond]+' condition · incubating'); }

// per-kill: incubate eggs + level the active pet. (Phase 4)
function petOnKill(e){ const u=petStore(); if(!u) return; let changed=false;
  for(const eg of u.eggs){ if(eg.prog<eg.need){ eg.prog++; if(eg.prog>=eg.need){ changed=true;
    if(typeof msg==='function') msg('🥚 An egg is ready to open!', (PET_CATS[eg.cat]?PET_CATS[eg.cat].name:'')+' · '+PET_RAR_NAME[eg.cond]); } } }
  if(changed) savePets();
  const xp = e&&e.type==='B'?36 : e&&e.type==='s'?4 : 3;    // bosses feed the active pet far more
  petGainXp(xp); }
// ---- Phase 4: leveling / fuse / evolve ----
function petMaxLvl(p){ return 10 + (p.rar||0)*5; }            // Common 10 ... Legendary 30
function petXpNeed(lvl){ return Math.floor(18*Math.pow(lvl,1.5)); }
function petGainXp(amt){ const p=activePet(); if(!p||!amt) return; const mx=petMaxLvl(p); if(p.lvl>=mx) return;
  p.xp=(p.xp||0)+amt; let up=false;
  while(p.lvl<mx && p.xp>=petXpNeed(p.lvl)){ p.xp-=petXpNeed(p.lvl); p.lvl++; up=true; }
  if(up){ savePets(); if(typeof msg==='function') msg(p.name+' → Lv '+p.lvl, p.lvl>=mx?'max level — ready to evolve!':''); } }
// fuse: sacrifice one pet to REROLL another's utility kit + feed it XP (the only way a kit changes)
function petFuse(baseUid,sacUid){ const u=petStore(); if(!u||baseUid===sacUid) return false;
  const base=u.pets.find(p=>p.uid===baseUid), sac=u.pets.find(p=>p.uid===sacUid); if(!base||!sac) return false;
  base.kit=rollKit(base.rar);
  const bonus=Math.round(petXpNeed(1)*(1+sac.rar)*(1+(sac.lvl-1)*0.3));
  base.xp=(base.xp||0)+bonus; const mx=petMaxLvl(base);
  while(base.lvl<mx && base.xp>=petXpNeed(base.lvl)){ base.xp-=petXpNeed(base.lvl); base.lvl++; }
  u.pets=u.pets.filter(p=>p.uid!==sacUid); if(u.activePet===sacUid) u.activePet=base.uid;
  savePets(); if(typeof spawnActivePet==='function'&&u.activePet===base.uid) spawnActivePet();
  if(typeof msg==='function') msg('🔗 Fused!', base.name+' rerolled its kit (+XP)'); return true; }
// evolve: at max level, climb a rarity — becoming the category's next creature if one exists
function petCanEvolve(p){ return p && p.rar<4 && p.lvl>=petMaxLvl(p); }
function petEvolve(uid){ const u=petStore(); if(!u) return false; const p=u.pets.find(x=>x.uid===uid); if(!petCanEvolve(p)) return false;
  const nr=p.rar+1, up=PET_DB.filter(d=>d.cat===p.cat&&d.rar>=nr).sort((a,b)=>a.rar-b.rar)[0];
  if(up){ p.spr=up.spr; p.name=up.name; p.rar=up.rar; } else { p.rar=nr; }   // no higher creature in family -> stronger same creature
  p.size=1+p.rar*0.14; p.lvl=1; p.xp=0; p.kit=rollKit(p.rar);
  savePets(); if(u.activePet===uid && typeof spawnActivePet==='function') spawnActivePet();
  if(typeof msg==='function') msg('✨ Evolved!', p.name+' — '+PET_RAR_NAME[p.rar]+'!'); return true; }

// ---- the OPEN roll: weighted rarity within the egg's band; rarest is hardest ----
// Common egg -> {0,1,2}, Uncommon -> {1,2,3}, Rare -> {2,3,4}. Weights favour the floor.
const EGG_ROLL_W = [58, 30, 12];   // floor / +1 / +2  (percent-ish weights)
function openRollRarity(cond){ const base=cond; let r=Math.random()*(EGG_ROLL_W[0]+EGG_ROLL_W[1]+EGG_ROLL_W[2]);
  if(r<EGG_ROLL_W[0]) return base; r-=EGG_ROLL_W[0];
  if(r<EGG_ROLL_W[1]) return Math.min(4,base+1); return Math.min(4,base+2); }
// pick a pet of the category whose rarity is CLOSEST to the rolled rarity (families have uneven
// ceilings, so this always yields a thematic creature — luckier rolls climb the family).
function pickPet(cat,rar){ const fam=PET_DB.filter(p=>p.cat===cat);
  if(!fam.length) return PET_DB[(Math.random()*PET_DB.length)|0];
  let best=fam[0],bd=99; for(const p of fam){ const d=Math.abs(p.rar-rar); if(d<bd||(d===bd&&p.rar>best.rar)){bd=d;best=p;} }
  // if several share the closest rarity, pick randomly among them
  const tied=fam.filter(p=>Math.abs(p.rar-rar)===bd); return tied[(Math.random()*tied.length)|0]; }

// roll the utility kit: (rar+1) distinct abilities, biased so higher rarity can roll the rarer ones
function rollKit(rar){ const n=rar+1, pool=PET_UTIL.slice(), kit=[];
  for(let i=0;i<n && pool.length;i++){ const idx=(Math.random()*pool.length)|0; kit.push(pool[idx].id); pool.splice(idx,1); }
  return kit; }

// ---- hatch an egg (index into u.eggs) -> a new pet instance in u.pets ----
function hatchEgg(idx){ const u=petStore(); if(!u||idx<0||idx>=u.eggs.length) return null;
  const eg=u.eggs[idx]; if(eg.prog<eg.need) return null;              // not finished incubating
  const rar=openRollRarity(eg.cond), def=pickPet(eg.cat,rar);
  const pet={ uid:u.petSeq++, spr:def.spr, name:def.name, cat:def.cat, rar:def.rar,
    lvl:1, xp:0, kit:rollKit(def.rar), size:1+def.rar*0.14 };
  u.pets.push(pet); u.eggs.splice(idx,1);
  if(u.activePet==null) u.activePet=pet.uid;                          // auto-equip your first pet
  savePets();
  if(typeof msg==='function') msg((PET_RAR_COL[def.rar]&&'')+ '⭐ '+def.name+'!', PET_RAR_NAME[def.rar]+' '+(PET_CATS[def.cat]?PET_CATS[def.cat].name:'')+' pet hatched');
  return pet; }

// ---- active pet accessors ----
function activePet(){ const u=petStore(); if(!u||u.activePet==null) return null; return u.pets.find(p=>p.uid===u.activePet)||null; }
function setActivePet(uid){ const u=petStore(); if(!u) return; u.activePet=uid; savePets(); }

// dev/console helper: grant a specific egg for testing
function devEgg(cond,cat){ giveEgg(cond||0, cat||PET_CAT_KEYS[(Math.random()*9)|0]);
  const u=petStore(); if(u&&u.eggs.length){ u.eggs[u.eggs.length-1].prog=u.eggs[u.eggs.length-1].need; savePets(); } }

// ---- sprite loaders (08c's _img is defined by the time this file runs) ----
const _petImg={}, _eggImg={};
if(typeof window!=='undefined' && typeof _img==='function'){
  for(const p of PET_DB) _petImg[p.spr]=_img('assets/pets/'+p.spr+'.png');
  for(const c of PET_CAT_KEYS) _eggImg[c]=_img('assets/pets/egg_'+c+'.png');
}

// ================= Phase 2: the active pet in combat =================
// The equipped pet (activePet()) follows you and auto-casts its rolled UTILITY kit. It deals no
// weapon damage — its abilities are support (heal/mana/shield/haste) + light control (shock/stun/
// chill/spark). Strength scales with rarity + level via petPower().
let petEnt = null;
function petPower(p){ return 1 + (p.rar||0)*0.4 + ((p.lvl||1)-1)*0.10; }
function spawnActivePet(){ const p=activePet();
  if(!p){ petEnt=null; return; }
  petEnt={ def:p, x:(typeof player!=='undefined'?player.x-24:0), y:(typeof player!=='undefined'?player.y+14:0), face:1, cds:{}, t:0 };
  for(const id of p.kit){ const u=petUtil(id); if(u&&u.cd>0) petEnt.cds[id]=1.5+Math.random()*u.cd*0.5; }   // stagger first casts
}
// passive Fortune (folded into recalcStats via the hook in 11_ui)
function petBonusFortune(){ const p=activePet(); if(!p||!p.kit||p.kit.indexOf('fortune')<0) return 0;
  return Math.round(8 + p.rar*7 + (p.lvl-1)*1.5); }
// tiny sparkle burst for pet fx (uses the particle system when present)
function petSpark(x,y,col,n){ if(typeof emitP!=='function') return; n=n||6;
  for(let i=0;i<n;i++){ const a=Math.random()*6.283, s=20+Math.random()*40;
    emitP(x,y,{vx:Math.cos(a)*s,vy:Math.sin(a)*s-20,life:0.5+Math.random()*0.3,col:col,sz:2,g:60,drag:2,glow:true}); } }

function updatePet(dt){ if(!petEnt||!petEnt.def||typeof player==='undefined') return; const p=petEnt.def;
  petEnt.t+=dt;
  // follow: trail slightly behind/beside the hero, lerped so it drifts naturally
  const tx=player.x-22, ty=player.y+14;
  petEnt.x+=(tx-petEnt.x)*Math.min(1,dt*6); petEnt.y+=(ty-petEnt.y)*Math.min(1,dt*6);
  if(Math.abs(tx-petEnt.x)>1) petEnt.face=(tx<petEnt.x)?-1:1;
  const pow=petPower(p);
  // passive regen (continuous, gentle)
  if(p.kit.indexOf('regen')>=0 && typeof healPlayer==='function' && player.hp<player.maxhp) healPlayer(player.maxhp*0.005*pow*dt);
  // active abilities on cooldown
  for(const id of p.kit){ const u=petUtil(id); if(!u||u.cd<=0) continue;
    petEnt.cds[id]=(petEnt.cds[id]||0)-dt; if(petEnt.cds[id]>0) continue;
    petEnt.cds[id]= petAct(p,id,pow) ? u.cd : 0.6;   // fired -> full cd; condition unmet -> retry soon
  }
}
// nearest live enemy to the pet within range (or null)
function _petTarget(rng){ if(typeof enemies==='undefined') return null; let best=null,bd=rng*rng;
  for(const e of enemies){ if(!e||e.hp<=0||e.node) continue; const dx=e.x-petEnt.x,dy=e.y-petEnt.y,d=dx*dx+dy*dy; if(d<bd){bd=d;best=e;} }
  return best; }
function petAct(p,id,pow){
  const dmg=(typeof player!=='undefined'?player.dmg:10);
  switch(id){
    case 'mend': if(player.hp>=player.maxhp*0.9) return false;
      if(typeof healPlayer==='function') healPlayer(player.maxhp*(0.07+0.02*pow)); petSpark(player.x,player.y,'#7ee08a'); return true;
    case 'font': if((player.mp||0)>=player.maxmp*0.7) return false;
      player.mp=Math.min(player.maxmp,(player.mp||0)+player.maxmp*(0.12+0.03*pow)); petSpark(player.x,player.y-4,'#6ab8e0'); return true;
    case 'guard': if((player.shield||0)>=player.maxhp*0.14) return false;
      player.shield=(player.shield||0)+player.maxhp*(0.09+0.03*pow); petSpark(player.x,player.y,'#a9e0ff'); return true;
    case 'haste': player.bSpdT=Math.max(player.bSpdT||0,3); player.bSpdM=Math.max(player.bSpdM||1,1.28); petSpark(player.x,player.y,'#e6d29a'); return true;
    case 'shock': { const e=_petTarget(240); if(!e) return false;
      if(typeof dealDamage==='function') dealDamage(e, dmg*(0.35+0.12*pow), 'pet');
      if(typeof applyStatus==='function') applyStatus(e,'shock',2.2,Math.max(2,Math.round(dmg*0.1*pow))); petSpark(e.x,e.y,'#6ab8ff'); return true; }
    case 'stun': { const e=_petTarget(210); if(!e) return false;
      if(typeof applyStatus==='function') applyStatus(e,'stun',0.7+0.12*pow); petSpark(e.x,e.y,'#ffe08a'); return true; }
    case 'spark': { let hit=false; if(typeof enemies!=='undefined') for(const e of enemies){ if(!e||e.hp<=0||e.node) continue;
        if(Math.hypot(e.x-player.x,e.y-player.y)<125){ if(typeof dealDamage==='function') dealDamage(e, dmg*(0.28+0.1*pow), 'pet'); hit=true; } }
      if(hit) petSpark(player.x,player.y,'#ffd07a',10); return hit; }
    case 'chill': { let hit=false; if(typeof enemies!=='undefined') for(const e of enemies){ if(!e||e.hp<=0||e.node) continue;
        if(Math.hypot(e.x-player.x,e.y-player.y)<150){ if(typeof applyStatus==='function') applyStatus(e,'chill',1.6+0.2*pow); hit=true; } }
      if(hit) petSpark(player.x,player.y,'#9ad4ef',8); return hit; }
    default: return false;   // regen/fortune are passive
  }
}
// ================= Phase 3: the Pets collection UI =================
let _petSel=null, _petFuse=false;
function closePets(){ const ov=document.getElementById('petScr'); if(ov) ov.style.display='none'; _petFuse=false; }
const _PBTN='background:#2a2233;border:1px solid #5a4d6c;color:#e8dff2;border-radius:8px;padding:6px 11px;font:bold 11px monospace;cursor:pointer;';
const _PBTNG='background:#3a2a12;border:1px solid #c9a04a;color:#ffd07a;border-radius:8px;padding:6px 11px;font:bold 11px monospace;cursor:pointer;';
const _PBTND='background:#1a1622;border:1px solid #332b40;color:#5a5464;border-radius:8px;padding:6px 11px;font:bold 11px monospace;cursor:default;';
function _petKitIcons(kit){ return (kit||[]).map(id=>{ const u=petUtil(id); return u?('<span title="'+u.name+': '+u.desc+'">'+u.icon+'</span>'):''; }).join(' '); }
function openPets(){ const u=petStore(); if(!u) return;
  let ov=document.getElementById('petScr');
  if(!ov){ ov=document.createElement('div'); ov.id='petScr';
    ov.style.cssText='position:fixed;inset:0;background:rgba(6,5,9,.86);z-index:60;display:flex;align-items:center;justify-content:center;padding:12px;';
    document.body.appendChild(ov); }
  ov.style.display='flex';
  _petPaint(ov,u);
}
function _petPaint(ov,u){
  ov.innerHTML='';
  const card=document.createElement('div');
  card.style.cssText='background:#15121b;border:1px solid #4a3d5c;border-radius:14px;max-width:600px;width:100%;max-height:92vh;overflow-y:auto;padding:16px;font-family:monospace;';
  let h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'
    +'<div style="font:bold 17px monospace;color:#ffd07a;letter-spacing:.08em;">🐾 PETS</div>'
    +'<button id="petClose" style="background:#2a1f16;border:1px solid #7a4a1e;color:#ffd07a;border-radius:8px;width:30px;height:30px;font-size:15px;cursor:pointer;">✕</button></div>'
    +'<div style="font-size:11px;color:#8a8494;margin-bottom:12px;">Kept across deaths. Eggs drop from bosses &amp; hatch as you fight. Equip one to fight beside you.</div>';
  // ---- EGGS ----
  h+='<div style="font:bold 12px monospace;color:#c9a04a;margin:4px 0 6px;letter-spacing:.1em;">EGGS ('+u.eggs.length+')</div>';
  if(!u.eggs.length) h+='<div style="font-size:11px;color:#6a6472;margin-bottom:10px;">No eggs yet — defeat bosses to find them.</div>';
  else { h+='<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;">';
    u.eggs.forEach((eg,i)=>{ const cat=PET_CATS[eg.cat]||{name:'?',col:'#fff'}, ready=eg.prog>=eg.need, pct=Math.min(100,Math.round(100*eg.prog/eg.need));
      h+='<div style="display:flex;align-items:center;gap:10px;background:#1c1826;border:1px solid #332b40;border-radius:9px;padding:7px 9px;">'
        +'<img src="assets/pets/egg_'+eg.cat+'.png" style="width:34px;height:34px;image-rendering:pixelated;">'
        +'<div style="flex:1;min-width:0;">'
        +'<div style="font-size:12px;color:'+cat.col+';">'+cat.emoji+' '+cat.name+' Egg <span style="color:'+PET_RAR_COL[eg.cond]+';">· '+PET_RAR_NAME[eg.cond]+'</span></div>'
        +(ready?'<div style="font-size:10px;color:#ffd07a;">ready to open!</div>'
              :'<div style="height:6px;background:#0d0b12;border-radius:4px;overflow:hidden;margin-top:4px;"><div style="height:100%;width:'+pct+'%;background:'+cat.col+';"></div></div>'
               +'<div style="font-size:9px;color:#8a8494;margin-top:2px;">incubating '+eg.prog+' / '+eg.need+' kills</div>')
        +'</div>'
        +(ready?'<button class="petOpen" data-i="'+i+'" style="background:#3a2a12;border:1px solid #c9a04a;color:#ffd07a;border-radius:8px;padding:6px 12px;font:bold 11px monospace;cursor:pointer;">OPEN</button>':'')
        +'</div>'; });
    h+='</div>'; }
  // ---- COLLECTION ----
  h+='<div style="font:bold 12px monospace;color:#c9a04a;margin:4px 0 6px;letter-spacing:.1em;">COLLECTION ('+u.pets.length+')</div>';
  if(_petFuse){ const bn=(u.pets.find(p=>p.uid===_petSel)||{}).name||'?';
    h+='<div style="font-size:11px;color:#ff9a5a;margin-bottom:6px;">🔗 Fuse mode — pick a pet to SACRIFICE into <b>'+bn+'</b> (rerolls its kit, +XP). <span id="petFuseCancel" style="color:#8ab6d6;cursor:pointer;text-decoration:underline;">cancel</span></div>'; }
  if(!u.pets.length) h+='<div style="font-size:11px;color:#6a6472;">No pets yet. Open an egg to hatch your first companion.</div>';
  else { h+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(126px,1fr));gap:8px;">';
    const sorted=u.pets.slice().sort((a,b)=>b.rar-a.rar||b.lvl-a.lvl);
    for(const p of sorted){ const active=p.uid===u.activePet, sel=p.uid===_petSel, cat=PET_CATS[p.cat]||{name:'?',col:'#fff'};
      const bord=sel?'#ffffff':active?'#ffc94d':'#332b40';
      h+='<div class="petCard" data-uid="'+p.uid+'" style="background:'+(sel?'#2a2136':active?'#241a2e':'#1a1622')+';border:2px solid '+bord+';border-radius:10px;padding:8px;text-align:center;cursor:pointer;position:relative;">'
        +(active?'<div style="position:absolute;top:3px;right:6px;font-size:8px;color:#ffc94d;letter-spacing:.05em;">ACTIVE</div>':'')
        +'<img src="assets/pets/'+p.spr+'.png" style="width:52px;height:52px;image-rendering:pixelated;">'
        +'<div style="font-size:11px;color:'+PET_RAR_COL[p.rar]+';font-weight:bold;margin-top:2px;">'+p.name+'</div>'
        +'<div style="font-size:9px;color:#8a8494;">'+cat.emoji+' '+PET_RAR_NAME[p.rar]+' · Lv '+p.lvl+'/'+petMaxLvl(p)+'</div>'
        +'<div style="font-size:12px;margin-top:3px;letter-spacing:1px;">'+_petKitIcons(p.kit)+'</div>'
        +'</div>'; }
    h+='</div>'; }
  // ---- ACTIONS for the selected pet ----
  const sp=u.pets.find(p=>p.uid===_petSel);
  if(sp && !_petFuse){ const mx=petMaxLvl(sp), need=petXpNeed(sp.lvl), pct=sp.lvl>=mx?100:Math.min(100,Math.round(100*(sp.xp||0)/need));
    h+='<div style="margin-top:12px;background:#1c1826;border:1px solid #4a3d5c;border-radius:10px;padding:10px;">'
      +'<div style="font-size:12px;color:'+PET_RAR_COL[sp.rar]+';font-weight:bold;">'+sp.name+' <span style="color:#8a8494;font-weight:normal;">· '+PET_RAR_NAME[sp.rar]+' · Lv '+sp.lvl+'/'+mx+'</span></div>'
      +'<div style="height:6px;background:#0d0b12;border-radius:4px;overflow:hidden;margin:6px 0;"><div style="height:100%;width:'+pct+'%;background:#c9a04a;"></div></div>'
      +'<div style="font-size:10px;color:#9a93a6;margin-bottom:9px;">'+(sp.kit||[]).map(id=>{const uu=petUtil(id);return uu?uu.icon+' '+uu.name:'';}).join('   ·   ')+'</div>'
      +'<div style="display:flex;gap:6px;flex-wrap:wrap;">'
      +'<button id="petEquip" style="'+_PBTN+'">'+(sp.uid===u.activePet?'UNEQUIP':'EQUIP')+'</button>'
      +(petCanEvolve(sp)?'<button id="petEvolve" style="'+_PBTNG+'">✨ EVOLVE</button>':'<button style="'+_PBTND+'">✨ EVOLVE (Lv '+mx+')</button>')
      +(u.pets.length>=2?'<button id="petFuseBtn" style="'+_PBTN+'">🔗 FUSE</button>':'')
      +'</div></div>';
  } else if(!_petFuse) h+='<div style="font-size:10px;color:#6a6472;margin-top:8px;">Tap a pet to inspect, equip, evolve or fuse it.</div>';
  card.innerHTML=h; ov.appendChild(card);
  document.getElementById('petClose').onclick=closePets;
  card.querySelectorAll('.petOpen').forEach(b=>b.onclick=(ev)=>{ ev.stopPropagation();
    const i=+b.getAttribute('data-i'); const pet=hatchEgg(i); if(pet){ _petSel=pet.uid; if(typeof spawnActivePet==='function'&&u.activePet===pet.uid) spawnActivePet(); } _petPaint(ov,u); });
  card.querySelectorAll('.petCard').forEach(c=>c.onclick=()=>{ const uid=+c.getAttribute('data-uid');
    if(_petFuse && _petSel!=null && uid!==_petSel){ petFuse(_petSel,uid); _petFuse=false; _petPaint(ov,u); return; }
    _petSel=uid; _petPaint(ov,u); });
  const fc=document.getElementById('petFuseCancel'); if(fc) fc.onclick=()=>{ _petFuse=false; _petPaint(ov,u); };
  const eq=document.getElementById('petEquip'); if(eq) eq.onclick=()=>{ setActivePet(u.activePet===_petSel?null:_petSel); if(typeof spawnActivePet==='function') spawnActivePet(); _petPaint(ov,u); };
  const ev2=document.getElementById('petEvolve'); if(ev2) ev2.onclick=()=>{ petEvolve(_petSel); _petPaint(ov,u); };
  const fb=document.getElementById('petFuseBtn'); if(fb) fb.onclick=()=>{ _petFuse=true; _petPaint(ov,u); };
}
function drawPet(){ if(!petEnt||!petEnt.def||typeof ctx==='undefined') return; const p=petEnt.def;
  const im=_petImg[p.spr], x=petEnt.x, y=petEnt.y, t=performance.now()/1000;
  const bob=Math.sin(t*3+x*0.05)*2;
  if(typeof shadow==='function') shadow(x,y,8);
  // rarity aura for rare+ pets
  if(p.rar>=2){ const col=PET_RAR_COL[p.rar]||'#fff', pulse=0.4+0.3*Math.sin(t*2.5);
    ctx.save(); ctx.globalCompositeOperation='lighter';
    const g=ctx.createRadialGradient(x,y-6,1,x,y-6,18+p.rar*3);
    g.addColorStop(0,col+Math.round(pulse*90).toString(16).padStart(2,'0')); g.addColorStop(1,col+'00');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y-6,18+p.rar*3,0,6.29); ctx.fill(); ctx.restore(); }
  if(im&&im.complete&&im.naturalWidth){ ctx.save(); ctx.imageSmoothingEnabled=false;
    const sc=(TILE*0.62*(p.size||1))/Math.max(im.naturalWidth,im.naturalHeight);
    const w=im.naturalWidth*sc, h=im.naturalHeight*sc;
    ctx.translate(x,y+bob); ctx.scale(petEnt.face<0?-1:1,1);
    ctx.drawImage(im,-w/2,-h,w,h); ctx.restore();
  } }
