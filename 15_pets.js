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
  for(const p of u.pets){                       // migrate older pets to the new model
    if(p.abilLvl===undefined) p.abilLvl=1; if(p.feedXp===undefined) p.feedXp=0;
    if(!p.size || p.size<6) p.size=petSizeFor(p.rar||0);          // old size was a 1.0-1.56 fraction; now on-screen px
    if(!Array.isArray(p.kit) || p.kit.length<3){ const extra=PET_UTIL.map(x=>x.id).filter(id=>!(p.kit||[]).includes(id)); p.kit=(p.kit||[]).concat(extra).slice(0,3); } }
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
// FUSION = the EVOLUTION process (at the Fusion Terminal): 2 pets of the SAME tier -> one of the
// NEXT tier, with a 50/50 chance of taking either parent's CATEGORY. Both parents are consumed.
function petCanFuse(a,b){ return !!(a&&b&&a.uid!==b.uid&&a.rar===b.rar&&a.rar<4); }
function petFuse(aUid,bUid){ const u=petStore(); if(!u) return null;
  const a=u.pets.find(p=>p.uid===aUid), b=u.pets.find(p=>p.uid===bUid); if(!petCanFuse(a,b)) return null;
  const nr=a.rar+1;
  // 50/50 which parent's category — but the result must be a GENUINE next-tier creature. Prefer the
  // chosen parent's family if it reaches this tier, else the other parent's family, else (both cap
  // out lower) any creature of the next tier. Never a lower-tier creature mislabelled as higher.
  const fam=c=>PET_DB.filter(p=>p.cat===c&&p.rar===nr);
  const order=Math.random()<0.5?[a.cat,b.cat]:[b.cat,a.cat];
  let choices=null; for(const c of order){ const f=fam(c); if(f.length){ choices=f; break; } }
  if(!choices) choices=PET_DB.filter(p=>p.rar===nr);
  const def=choices[(Math.random()*choices.length)|0];
  const pet={ uid:u.petSeq++, spr:def.spr, name:def.name, cat:def.cat, rar:nr,
    lvl:1, xp:0, abilLvl:Math.max(a.abilLvl||1,b.abilLvl||1), feedXp:0, kit:rollKit(), size:petSizeFor(nr) };
  u.pets=u.pets.filter(p=>p.uid!==aUid&&p.uid!==bUid); u.pets.push(pet);
  if(u.activePet===aUid||u.activePet===bUid) u.activePet=pet.uid;
  savePets(); if(typeof spawnActivePet==='function'&&u.activePet===pet.uid) spawnActivePet();
  if(typeof msg==='function') msg('✨ EVOLVED!', PET_RAR_NAME[nr]+' '+def.name+' — '+(PET_CATS[def.cat]?PET_CATS[def.cat].name:'')); return pet; }
// FEEDING: give a pet an item -> ability XP -> raises its ability level (abilLvl), which powers all its abilities.
const PET_ABIL_MAX=12;
function petFeedNeed(lvl){ return 2+(lvl||1); }
function petFeed(uid,n){ const u=petStore(); const p=u&&u.pets.find(x=>x.uid===uid); if(!p) return false;
  if((p.abilLvl||1)>=PET_ABIL_MAX) return false;
  p.feedXp=(p.feedXp||0)+(n||1); let up=false;
  while((p.abilLvl||1)<PET_ABIL_MAX && p.feedXp>=petFeedNeed(p.abilLvl||1)){ p.feedXp-=petFeedNeed(p.abilLvl||1); p.abilLvl=(p.abilLvl||1)+1; up=true; }
  savePets(); if(up&&typeof msg==='function') msg('🍖 '+p.name,'abilities → Lv '+p.abilLvl); return true; }

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

// every pet rolls 3 abilities; how many are UNLOCKED grows with rarity (petSlots).
function rollKit(){ const pool=PET_UTIL.slice(), kit=[];
  for(let i=0;i<3 && pool.length;i++){ const idx=(Math.random()*pool.length)|0; kit.push(pool[idx].id); pool.splice(idx,1); }
  return kit; }
function petSlots(rar){ return [1,2,2,3,3][rar]||1; }             // abilities unlocked by rarity (Common 1 → Legendary 3)
function petSizeFor(rar){ return [30,39,48,58,67][rar]||30; }     // on-screen px; Legendary ~ a bit bigger than the player (~54)

// ---- hatch an egg (index into u.eggs) -> a new pet instance in u.pets ----
function hatchEgg(idx){ const u=petStore(); if(!u||idx<0||idx>=u.eggs.length) return null;
  const eg=u.eggs[idx]; if(eg.prog<eg.need) return null;              // not finished incubating
  const rar=openRollRarity(eg.cond), def=pickPet(eg.cat,rar);
  const pet={ uid:u.petSeq++, spr:def.spr, name:def.name, cat:def.cat, rar:def.rar,
    lvl:1, xp:0, abilLvl:1, feedXp:0, kit:rollKit(), size:petSizeFor(def.rar) };
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
let _roomFloorImg=null,_roomFloor2Img=null,_roomHedgeImg=null,_pondVar=null,_koiImg=null,_duckImg=null; const _roomDecor={};
if(typeof window!=='undefined' && typeof _img==='function'){
  for(const p of PET_DB) _petImg[p.spr]=_img('assets/pets/'+p.spr+'.png');
  for(const c of PET_CAT_KEYS) _eggImg[c]=_img('assets/pets/egg_'+c+'.png');
  _roomFloorImg=_img('assets/pets/room_floor.png'); _roomFloor2Img=_img('assets/pets/room_floor2.png'); _roomHedgeImg=_img('assets/pets/room_hedge.png');
  for(const d of ['pond','hay','shelter','barn','trough','apple','picket','rock','rocks']) _roomDecor[d]=_img('assets/pets/room_'+d+'.png');
  _pondVar=[_img('assets/pets/pond_0.png'),_img('assets/pets/pond_1.png'),_img('assets/pets/pond_2.png'),_img('assets/pets/pond_3.png')];
  _koiImg=_img('assets/pets/pond_koi.png');
  _roomDecor.lily=_img('assets/pets/pond_lily.png'); _roomDecor.lily2=_img('assets/pets/pond_lily2.png'); _roomDecor.reeds=_img('assets/pets/pond_reeds.png');
  _roomDecor.bridge=_img('assets/pets/room_bridge.png'); _duckImg=_img('assets/pets/pond_duck.png');
  _roomDecor.incubator=_img('assets/pets/room_incubator.png'); _roomDecor.altar=_img('assets/pets/room_altar.png');
}

// ================= Phase 2: the active pet in combat =================
// The equipped pet (activePet()) follows you and auto-casts its rolled UTILITY kit. It deals no
// weapon damage — its abilities are support (heal/mana/shield/haste) + light control (shock/stun/
// chill/spark). Strength scales with rarity + level via petPower().
let petEnt = null;
function petPower(p){ return 1 + (p.rar||0)*0.35 + ((p.lvl||1)-1)*0.05 + ((p.abilLvl||1)-1)*0.14; }   // fed ability level drives strength
function spawnActivePet(){ const p=activePet();
  if(!p){ petEnt=null; return; }
  petEnt={ def:p, x:(typeof player!=='undefined'?player.x-24:0), y:(typeof player!=='undefined'?player.y+14:0), face:1, cds:{}, t:0 };
  for(const id of p.kit){ const u=petUtil(id); if(u&&u.cd>0) petEnt.cds[id]=1.5+Math.random()*u.cd*0.5; }   // stagger first casts
}
// passive Fortune (folded into recalcStats via the hook in 11_ui)
function petBonusFortune(){ const p=activePet(); if(!p||!p.kit) return 0;
  if(p.kit.slice(0,petSlots(p.rar)).indexOf('fortune')<0) return 0;   // only if the Fortune slot is unlocked
  return Math.round(8 + p.rar*7 + (p.abilLvl-1)*2); }
// tiny sparkle burst for pet fx (uses the particle system when present)
function petSpark(x,y,col,n){ if(typeof emitP!=='function') return; n=n||6;
  for(let i=0;i<n;i++){ const a=Math.random()*6.283, s=20+Math.random()*40;
    emitP(x,y,{vx:Math.cos(a)*s,vy:Math.sin(a)*s-20,life:0.5+Math.random()*0.3,col:col,sz:2,g:60,drag:2,glow:true}); } }

function updatePet(dt){ if(!petEnt||!petEnt.def||typeof player==='undefined') return;
  if(curRoom&&curRoom.petRoom) return;                         // in the Sanctuary every pet wanders instead
  const p=petEnt.def;
  petEnt.t+=dt;
  // follow: trail slightly behind/beside the hero, lerped so it drifts naturally
  const tx=player.x-22, ty=player.y+14;
  petEnt.x+=(tx-petEnt.x)*Math.min(1,dt*6); petEnt.y+=(ty-petEnt.y)*Math.min(1,dt*6);
  if(Math.abs(tx-petEnt.x)>1) petEnt.face=(tx<petEnt.x)?-1:1;
  const pow=petPower(p), active=p.kit.slice(0, petSlots(p.rar));   // only UNLOCKED ability slots fire
  // passive regen (continuous, gentle)
  if(active.indexOf('regen')>=0 && typeof healPlayer==='function' && player.hp<player.maxhp) healPlayer(player.maxhp*0.005*pow*dt);
  // active abilities on cooldown
  for(const id of active){ const u=petUtil(id); if(!u||u.cd<=0) continue;
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
// ================= Phase 3: the Pets collection UI (tabbed) =================
let _petSel=null, _petTab='collection', _petFuseA=null;
function closePets(){ const ov=document.getElementById('petScr'); if(ov) ov.style.display='none'; _petFuseA=null; }
function _slotUnlockRar(i){ return i===0?0:i===1?1:3; }          // which rarity unlocks ability slot i
function _petAbilRows(p){ let s=''; for(let i=0;i<3;i++){ const unlocked=i<petSlots(p.rar), id=p.kit[i], uu=id?petUtil(id):null;
    if(unlocked&&uu) s+='<div style="font-size:10px;color:#cfc8bd;margin:2px 0;">'+uu.icon+' <b>'+uu.name+'</b> <span style="color:#8a8494;">— '+uu.desc+'</span></div>';
    else s+='<div style="font-size:10px;color:#5a5464;margin:2px 0;">🔒 slot '+(i+1)+' — unlocks at <span style="color:'+PET_RAR_COL[_slotUnlockRar(i)]+'">'+PET_RAR_NAME[_slotUnlockRar(i)]+'</span></div>'; }
  return s; }
function _petCardHTML(p,u,extra){ const active=p.uid===u.activePet, sel=p.uid===_petSel, cat=PET_CATS[p.cat]||{name:'?',col:'#fff'};
  const bord=sel?'#ffffff':active?'#ffc94d':'#332b40';
  return '<div class="petCard" data-uid="'+p.uid+'" style="background:'+(sel?'#2a2136':active?'#241a2e':'#1a1622')+';border:2px solid '+bord+';border-radius:10px;padding:8px;text-align:center;cursor:pointer;position:relative;'+(extra||'')+'">'
    +(active?'<div style="position:absolute;top:3px;right:6px;font-size:8px;color:#ffc94d;">ACTIVE</div>':'')
    +'<img src="assets/pets/'+p.spr+'.png" style="width:50px;height:50px;image-rendering:pixelated;">'
    +'<div style="font-size:11px;color:'+PET_RAR_COL[p.rar]+';font-weight:bold;">'+p.name+'</div>'
    +'<div style="font-size:9px;color:#8a8494;">'+cat.emoji+' '+PET_RAR_NAME[p.rar]+'</div>'
    +'<div style="font-size:9px;color:#7a94a6;">abil Lv '+(p.abilLvl||1)+' · '+petSlots(p.rar)+'/3 slots</div></div>'; }
function _eggRows(u){ let h='<div style="font:bold 12px monospace;color:#c9a04a;margin:2px 0 6px;letter-spacing:.1em;">🥚 EGGS ('+u.eggs.length+')</div>';
  if(!u.eggs.length) return h+'<div style="font-size:11px;color:#6a6472;margin-bottom:10px;">No eggs yet — defeat bosses to find them.</div>';
  h+='<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;">';
  u.eggs.forEach((eg,i)=>{ const cat=PET_CATS[eg.cat]||{name:'?',col:'#fff'}, ready=eg.prog>=eg.need, pct=Math.min(100,Math.round(100*eg.prog/eg.need));
    h+='<div style="display:flex;align-items:center;gap:10px;background:#1c1826;border:1px solid #332b40;border-radius:9px;padding:7px 9px;">'
      +'<img src="assets/pets/egg_'+eg.cat+'.png" style="width:34px;height:34px;image-rendering:pixelated;">'
      +'<div style="flex:1;min-width:0;"><div style="font-size:12px;color:'+cat.col+';">'+cat.emoji+' '+cat.name+' Egg <span style="color:'+PET_RAR_COL[eg.cond]+';">· '+PET_RAR_NAME[eg.cond]+'</span></div>'
      +(ready?'<div style="font-size:10px;color:#ffd07a;">ready to open!</div>'
            :'<div style="height:6px;background:#0d0b12;border-radius:4px;overflow:hidden;margin-top:4px;"><div style="height:100%;width:'+pct+'%;background:'+cat.col+';"></div></div><div style="font-size:9px;color:#8a8494;margin-top:2px;">incubating '+eg.prog+' / '+eg.need+' kills</div>')
      +'</div>'+(ready?'<button class="petOpen" data-i="'+i+'" style="'+_PBTNG+'">OPEN</button>':'')+'</div>'; });
  return h+'</div>'; }
const _PBTN='background:#2a2233;border:1px solid #5a4d6c;color:#e8dff2;border-radius:8px;padding:6px 11px;font:bold 11px monospace;cursor:pointer;';
const _PBTNG='background:#3a2a12;border:1px solid #c9a04a;color:#ffd07a;border-radius:8px;padding:6px 11px;font:bold 11px monospace;cursor:pointer;';
const _PBTND='background:#1a1622;border:1px solid #332b40;color:#5a5464;border-radius:8px;padding:6px 11px;font:bold 11px monospace;cursor:default;';
function _petKitIcons(kit){ return (kit||[]).map(id=>{ const u=petUtil(id); return u?('<span title="'+u.name+': '+u.desc+'">'+u.icon+'</span>'):''; }).join(' '); }
function openPets(tab){ const u=petStore(); if(!u) return; if(tab) _petTab=tab;
  let ov=document.getElementById('petScr');
  if(!ov){ ov=document.createElement('div'); ov.id='petScr';
    ov.style.cssText='position:fixed;inset:0;background:rgba(6,5,9,.86);z-index:60;display:flex;align-items:center;justify-content:center;padding:12px;';
    document.body.appendChild(ov); }
  ov.style.display='flex'; _petPaint(ov,u);
}
function _petTabCollection(u){ let h=_eggRows(u);
  h+='<div style="font:bold 12px monospace;color:#c9a04a;margin:2px 0 6px;letter-spacing:.1em;">COLLECTION ('+u.pets.length+')</div>';
  if(!u.pets.length) h+='<div style="font-size:11px;color:#6a6472;">No pets yet. Open an egg to hatch your first companion.</div>';
  else { h+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;">';
    for(const p of u.pets.slice().sort((a,b)=>b.rar-a.rar)) h+=_petCardHTML(p,u); h+='</div>'; }
  const sp=u.pets.find(p=>p.uid===_petSel);
  if(sp){ const an=petFeedNeed(sp.abilLvl||1), apct=Math.min(100,Math.round(100*(sp.feedXp||0)/an));
    h+='<div style="margin-top:12px;background:#1c1826;border:1px solid #4a3d5c;border-radius:10px;padding:10px;">'
      +'<div style="font-size:12px;color:'+PET_RAR_COL[sp.rar]+';font-weight:bold;">'+sp.name+' <span style="color:#8a8494;font-weight:normal;">· '+(PET_CATS[sp.cat]?PET_CATS[sp.cat].name:'')+' '+PET_RAR_NAME[sp.rar]+' · Lv '+sp.lvl+'</span></div>'
      +'<div style="font-size:10px;color:#7ec0e0;margin:5px 0 2px;">Ability Level '+(sp.abilLvl||1)+' / '+PET_ABIL_MAX+' <span style="color:#8a8494;">— feed items in the 🍖 Feed tab</span></div>'
      +'<div style="height:6px;background:#0d0b12;border-radius:4px;overflow:hidden;margin-bottom:8px;"><div style="height:100%;width:'+apct+'%;background:#4aa6ff;"></div></div>'
      +'<div style="margin-bottom:9px;">'+_petAbilRows(sp)+'</div>'
      +'<div style="display:flex;gap:6px;flex-wrap:wrap;">'
      +'<button id="petEquip" style="'+_PBTN+'">'+(sp.uid===u.activePet?'UNEQUIP':'EQUIP')+'</button>'
      +(sp.rar<4?'<button id="petEvolveFuse" style="'+_PBTNG+'">✨ EVOLVE (fuse)</button>':'<button style="'+_PBTND+'">✨ MAX RARITY</button>')
      +'</div></div>';
  } else h+='<div style="font-size:10px;color:#6a6472;margin-top:8px;">Tap a pet to inspect &amp; equip it.</div>';
  return h; }
function _petTabFeed(u){ let h='<div style="font-size:11px;color:#8a8494;margin-bottom:10px;">Feed satchel items to a pet to level up its abilities. Better items feed more.</div>';
  if(!u.pets.length) return h+'<div style="font-size:11px;color:#6a6472;">No pets yet.</div>';
  h+='<div style="font:bold 11px monospace;color:#c9a04a;margin:2px 0 6px;">PICK A PET</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin-bottom:12px;">';
  for(const p of u.pets.slice().sort((a,b)=>b.rar-a.rar)) h+=_petCardHTML(p,u); h+='</div>';
  const sp=u.pets.find(p=>p.uid===_petSel);
  if(!sp) return h+'<div style="font-size:10px;color:#6a6472;">Select a pet above to feed it.</div>';
  const an=petFeedNeed(sp.abilLvl||1), apct=Math.min(100,Math.round(100*(sp.feedXp||0)/an));
  h+='<div style="background:#1c1826;border:1px solid #4a3d5c;border-radius:10px;padding:10px;">'
    +'<div style="font-size:12px;color:'+PET_RAR_COL[sp.rar]+';font-weight:bold;">Feeding '+sp.name+'</div>'
    +'<div style="font-size:10px;color:#7ec0e0;margin:5px 0 2px;">Ability Level '+(sp.abilLvl||1)+' / '+PET_ABIL_MAX+'</div>'
    +'<div style="height:6px;background:#0d0b12;border-radius:4px;overflow:hidden;margin-bottom:9px;"><div style="height:100%;width:'+apct+'%;background:#4aa6ff;"></div></div>';
  const ch=(typeof curChar==='function')?curChar():null, inv=(ch&&ch.inv)||[];
  const feed=inv.map((it,i)=>({it,i})).filter(o=>o.it&&o.it.k!=='coin');
  if((sp.abilLvl||1)>=PET_ABIL_MAX) h+='<div style="font-size:10px;color:#ffd07a;">Abilities are maxed!</div>';
  else if(!feed.length) h+='<div style="font-size:10px;color:#6a6472;">Your satchel is empty — nothing to feed.</div>';
  else { h+='<div style="font-size:10px;color:#9a93a6;margin-bottom:5px;">Tap an item to feed it:</div><div style="display:flex;flex-wrap:wrap;gap:5px;">';
    for(const o of feed){ const nm=(typeof itemName==='function')?itemName(o.it):'item', col=(typeof itemRarCol==='function')?itemRarCol(o.it):'#cfc8bd';
      h+='<button class="petFeedItem" data-i="'+o.i+'" style="background:#241a2e;border:1px solid '+col+';color:'+col+';border-radius:7px;padding:5px 8px;font:10px monospace;cursor:pointer;">'+nm+'</button>'; }
    h+='</div>'; }
  return h+'</div>'; }
function _petTabFuse(u){ let h='<div style="font-size:11px;color:#8a8494;margin-bottom:10px;">FUSE 2 pets of the <b>same tier</b> → one of the <b>next tier</b>, with a 50/50 chance of taking either parent\'s type. Both are consumed. This is how pets EVOLVE.</div>';
  if(u.pets.length<2) return h+'<div style="font-size:11px;color:#6a6472;">You need at least 2 pets of the same tier.</div>';
  const a=_petFuseA!=null?u.pets.find(p=>p.uid===_petFuseA):null;
  h+='<div style="font-size:11px;color:#ffd07a;margin-bottom:6px;">'+(a?('Picked <b>'+a.name+'</b> ('+PET_RAR_NAME[a.rar]+'). Now tap another <b>'+PET_RAR_NAME[a.rar]+'</b> pet to fuse — or tap it again to cancel.'):'Tap the FIRST pet to fuse.')+'</div>';
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;">';
  for(const p of u.pets.slice().sort((x,y)=>y.rar-x.rar)){ const dim=a&&p.uid!==a.uid&&p.rar!==a.rar, picked=a&&p.uid===a.uid;
    h+=_petCardHTML(p,u,(dim?'opacity:.32;':'')+(picked?'border-color:#ff9a5a !important;':'')); }
  return h+'</div>'; }
function _petFeedFromInv(u,invIdx){ const sp=u.pets.find(p=>p.uid===_petSel); if(!sp) return;
  const ch=(typeof curChar==='function')?curChar():null; if(!ch||!ch.inv||!ch.inv[invIdx]) return;
  const it=ch.inv[invIdx], xp=1+((it.rar||0))+Math.floor((it.t||0)/3);
  ch.inv.splice(invIdx,1); if(typeof saveRPG==='function') saveRPG();
  petFeed(sp.uid, xp); }
function _petPaint(ov,u){
  ov.innerHTML='';
  const card=document.createElement('div');
  card.style.cssText='background:#15121b;border:1px solid #4a3d5c;border-radius:14px;max-width:620px;width:100%;max-height:92vh;overflow-y:auto;padding:16px;font-family:monospace;';
  let h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'
    +'<div style="font:bold 17px monospace;color:#ffd07a;letter-spacing:.08em;">🐾 PETS</div>'
    +'<button id="petClose" style="background:#2a1f16;border:1px solid #7a4a1e;color:#ffd07a;border-radius:8px;width:30px;height:30px;font-size:15px;cursor:pointer;">✕</button></div>';
  if(u.pets.length) h+='<button id="petSanctuary" style="'+_PBTNG+'width:100%;padding:8px;margin-bottom:10px;">🏡 VISIT THE SANCTUARY — watch your '+u.pets.length+' pet'+(u.pets.length===1?'':'s')+' roam</button>';
  h+='<div style="display:flex;gap:6px;margin-bottom:12px;">';
  for(const [k,lbl] of [['collection','🐾 Collection'],['feed','🍖 Feed'],['fuse','🔗 Fuse']])
    h+='<button class="petTab" data-tab="'+k+'" style="flex:1;padding:7px;border-radius:8px;font:bold 11px monospace;cursor:pointer;border:1px solid '+(_petTab===k?'#c9a04a':'#332b40')+';background:'+(_petTab===k?'#3a2a12':'#1a1622')+';color:'+(_petTab===k?'#ffd07a':'#8a8494')+';">'+lbl+'</button>';
  h+='</div>';
  h+= _petTab==='feed'?_petTabFeed(u) : _petTab==='fuse'?_petTabFuse(u) : _petTabCollection(u);
  card.innerHTML=h; ov.appendChild(card);
  const rp=()=>_petPaint(ov,u);
  document.getElementById('petClose').onclick=closePets;
  { const s=document.getElementById('petSanctuary'); if(s) s.onclick=()=>{ if(typeof enterPetRoom==='function') enterPetRoom(); }; }
  card.querySelectorAll('.petTab').forEach(b=>b.onclick=()=>{ _petTab=b.getAttribute('data-tab'); _petFuseA=null; rp(); });
  card.querySelectorAll('.petOpen').forEach(b=>b.onclick=(ev)=>{ ev.stopPropagation(); const i=+b.getAttribute('data-i'); const pet=hatchEgg(i); if(pet){ _petSel=pet.uid; if(u.activePet===pet.uid&&typeof spawnActivePet==='function') spawnActivePet(); } rp(); });
  card.querySelectorAll('.petCard').forEach(c=>c.onclick=()=>{ const uid=+c.getAttribute('data-uid');
    if(_petTab==='fuse'){ if(_petFuseA==null) _petFuseA=uid;
      else if(_petFuseA===uid) _petFuseA=null;
      else { const a=u.pets.find(p=>p.uid===_petFuseA), b=u.pets.find(p=>p.uid===uid);
        if(petCanFuse(a,b)){ const np=petFuse(_petFuseA,uid); _petFuseA=null; _petSel=np?np.uid:_petSel; } }
      rp(); return; }
    _petSel=uid; rp(); });
  card.querySelectorAll('.petFeedItem').forEach(b=>b.onclick=()=>{ _petFeedFromInv(u,+b.getAttribute('data-i')); rp(); });
  { const eq=document.getElementById('petEquip'); if(eq) eq.onclick=()=>{ setActivePet(u.activePet===_petSel?null:_petSel); if(typeof spawnActivePet==='function') spawnActivePet(); rp(); }; }
  { const ef=document.getElementById('petEvolveFuse'); if(ef) ef.onclick=()=>{ _petTab='fuse'; _petFuseA=_petSel; rp(); }; }
}
function drawPet(){ if(!petEnt||!petEnt.def||typeof ctx==='undefined') return;
  if(curRoom&&curRoom.petRoom) return;                         // suppressed in the Sanctuary (all pets wander there)
  const p=petEnt.def;
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
    const sc=(p.size||42)/Math.max(im.naturalWidth,im.naturalHeight);
    const w=im.naturalWidth*sc, h=im.naturalHeight*sc;
    ctx.translate(x,y+bob); ctx.scale(petEnt.face<0?-1:1,1);
    ctx.drawImage(im,-w/2,-h,w,h); ctx.restore();
  } }

// ================= The Sanctuary — a room where your whole collection roams =================
let petWanderers=[], petKoi=[], petDucks=[], _petReturn=null;
function _pondPoint(wf,off){ const a=Math.random()*6.28, rr=0.15+Math.random()*0.6;
  return {x:(wf.pcx+Math.cos(a)*wf.prx*rr)*TILE, y:(wf.pcy+(off||0)+Math.sin(a)*wf.pry*rr)*TILE}; }
function spawnKoi(){ petKoi=[]; const R=rooms['PETS'], wf=R&&R.waterfall; if(!wf) return;
  for(let i=0;i<7;i++){ const p=_pondPoint(wf,0.4); petKoi.push({x:p.x,y:p.y,tx:p.x,ty:p.y,spd:16+Math.random()*12,face:1,ph:Math.random()*6.28}); } }
function spawnDucks(){ petDucks=[]; const R=rooms['PETS'], wf=R&&R.waterfall; if(!wf) return;
  for(let i=0;i<3;i++){ const p=_pondPoint(wf,0.2); petDucks.push({x:p.x,y:p.y,tx:p.x,ty:p.y,spd:9+Math.random()*7,face:1,ph:Math.random()*6.28}); } }
function buildPetRoom(){ if(typeof rooms==='undefined') return null; if(rooms['PETS']) return rooms['PETS'];
  const W=40,H=28, grid=[];
  for(let y=0;y<H;y++){ const row=[]; for(let x=0;x<W;x++) row.push((x===0||y===0||x===W-1||y===H-1)?'W':'.'); grid.push(row); }
  const cx=W>>1;                                             // 20 — the CENTREPIECE: lake -> waterfall -> big central pond
  for(let y=1;y<=3;y++) for(let x=14;x<=26;x++) grid[y][x]='w';           // lake (top-centre)
  for(let y=4;y<=9;y++) for(let x=cx-1;x<=cx+1;x++) grid[y][x]='w';       // tall waterfall (two tiers)
  const pcx=cx, pcy=15, prx=9, pry=5.5;                                   // large central pond
  for(let y=Math.ceil(pcy-pry);y<=Math.floor(pcy+pry);y++) for(let x=pcx-prx;x<=pcx+prx;x++){ if(y<1||y>=H-1||x<1||x>=W-1) continue;
    const nx=(x-pcx)/prx, ny=(y-pcy)/pry; if(nx*nx+ny*ny<=1.02) grid[y][x]='w'; }
  const ex=cx; grid[H-1][ex]='.'; grid[H-1][ex-1]='.'; grid[H-1][ex+1]='.';
  const D=[];
  for(let i=0;i<14;i++){ const a=i/14*6.283, rx=pcx+Math.cos(a)*(prx+0.15), ry=pcy+Math.sin(a)*(pry+0.15);
    D.push({img:(i&1?'rocks':'rock'), x:rx*TILE, y:(ry+0.3)*TILE, s:1.35+(i%3)*0.18}); }   // rock ring around the pond
  D.push({img:'lily',x:15*TILE,y:13*TILE,s:1.1,flat:true},{img:'lily2',x:25*TILE,y:16.5*TILE,s:1.2,flat:true},
         {img:'lily',x:22*TILE,y:18*TILE,s:1.0,flat:true},{img:'lily2',x:16*TILE,y:17*TILE,s:1.0,flat:true},
         {img:'lily',x:24*TILE,y:13*TILE,s:1.0,flat:true});
  D.push({img:'reeds',x:12*TILE,y:12*TILE,s:1.6},{img:'reeds',x:28.5*TILE,y:18.5*TILE,s:1.6},{img:'reeds',x:13*TILE,y:19*TILE,s:1.5});
  D.push({img:'bridge',x:pcx*TILE,y:15*TILE,flat:true,w2:15.5*TILE,h2:3.6*TILE});           // wooden bridge across the pond
  D.push({img:'incubator',x:13*TILE,y:11*TILE,s:2.2},{img:'altar',x:27*TILE,y:11*TILE,s:2.2});   // interactable stations
  D.push({img:'barn',x:5.5*TILE,y:8.5*TILE,s:3.2},{img:'shelter',x:9.7*TILE,y:9.5*TILE,s:2.0});
  D.push({img:'apple',x:35.5*TILE,y:9*TILE,s:2.8},{img:'apple',x:34.5*TILE,y:25*TILE,s:2.6},{img:'apple',x:4.5*TILE,y:26*TILE,s:2.4});
  D.push({img:'trough',x:34*TILE,y:17.5*TILE,s:1.9});
  D.push({img:'hay',x:31*TILE,y:25*TILE,s:1.5},{img:'hay',x:8*TILE,y:25*TILE,s:1.5});
  D.push({img:'picket',x:4.5*TILE,y:21.5*TILE,s:2.0},{img:'picket',x:7.9*TILE,y:21.5*TILE,s:2.0},{img:'picket',x:11.3*TILE,y:21.5*TILE,s:2.0});
  const room={ id:'PETS', name:'The Sanctuary', w:W,h:H, grid, petRoom:true, town:false, big:false,
    spawns:[], glows:[], pillars:[], px:ex, py:H-3,
    waterfall:{ cx:pcx, x0:cx-1.35, x1:cx+1.35, topY:3.5, pcx, pcy, prx, pry },
    portals:[{x:(ex+0.5)*TILE, y:(H-1.5)*TILE, to:'_petback', col:'#8ee0a0', big:false}],
    petStations:[{x:13*TILE, y:11.6*TILE, kind:'incubator'}, {x:27*TILE, y:11.6*TILE, kind:'fusion'}],
    petDecor:D };
  rooms['PETS']=room; return room; }
// a random walkable LAWN point (grass '.', never water) — pets roam the ring around the central pond
function _petLawnPoint(){ const R=rooms['PETS']; for(let i=0;i<30;i++){ const tx=2+((Math.random()*(R.w-4))|0), ty=2+((Math.random()*(R.h-4))|0);
    if(R.grid[ty] && R.grid[ty][tx]==='.') return {x:(tx+0.5)*TILE, y:(ty+0.5)*TILE}; }
  return {x:(R.px+0.5)*TILE, y:(R.py+0.5)*TILE}; }
function spawnWanderers(){ petWanderers=[]; const u=petStore(); if(!u||!rooms['PETS']) return;
  for(const p of u.pets){ const s=_petLawnPoint();
    petWanderers.push({def:p, x:s.x, y:s.y, tx:s.x, ty:s.y, spd:16+Math.random()*16, face:Math.random()<0.5?-1:1, wait:Math.random()*3, ph:Math.random()*6.28}); } }
function enterPetRoom(){ const u=petStore(); if(!u||typeof enterRoom!=='function') return;
  const key=Object.keys(rooms).find(k=>rooms[k]===curRoom)||'0,0';
  _petReturn={key, x:player.x, y:player.y};
  buildPetRoom(); if(typeof closePets==='function') closePets();
  const R=rooms['PETS']; enterRoom('PETS',(R.px+0.5)*TILE,(R.py+0.5)*TILE);
  if(typeof portalLock!=='undefined') portalLock=false;
  spawnWanderers(); spawnKoi(); spawnDucks();
  if(typeof msg==='function') msg('THE SANCTUARY', u.pets.length+' pet'+(u.pets.length===1?'':'s')+' roaming'); }
function leavePetRoom(){ petWanderers=[]; const r=_petReturn||{key:'0,0'};
  if(typeof enterRoom==='function' && rooms[r.key]) enterRoom(r.key, r.x||(rooms[r.key].px+0.5)*TILE, r.y||(rooms[r.key].py+0.5)*TILE);
  else if(typeof usePortal==='function') usePortal('0,0'); }
function updatePetRoom(dt){ if(!curRoom||!curRoom.petRoom) return; const wf=curRoom.waterfall;
  for(const w of petWanderers){ const dx=w.tx-w.x, dy=w.ty-w.y, d=Math.hypot(dx,dy);
    if(d<4){ w.wait-=dt; if(w.wait<=0){ const p=_petLawnPoint(); w.tx=p.x; w.ty=p.y; w.wait=0.8+Math.random()*3.2; } }
    else { const mv=Math.min(d,w.spd*dt); w.x+=dx/d*mv; w.y+=dy/d*mv; if(Math.abs(dx)>2) w.face=dx<0?-1:1; } }
  const swim=(arr,off)=>{ if(!wf) return; for(const k of arr){ const dx=k.tx-k.x, dy=k.ty-k.y, d=Math.hypot(dx,dy);
    if(d<6){ const p=_pondPoint(wf,off); k.tx=p.x; k.ty=p.y; }
    else { const mv=k.spd*dt; k.x+=dx/d*mv; k.y+=dy/d*mv; if(Math.abs(dx)>1) k.face=dx<0?-1:1; } } };
  swim(petKoi,0.4); swim(petDucks,0.2); }
function drawWaterfall(){ const wf=curRoom&&curRoom.waterfall; if(!wf||typeof ctx==='undefined') return;
  const t=performance.now(), x0=wf.x0*TILE, x1=wf.x1*TILE, w=x1-x0, y0=wf.topY*TILE, y1=(wf.pcy-wf.pry+0.5)*TILE, hgt=y1-y0;
  const ymid=y0+hgt*0.52;                                    // ledge between the two tiers
  ctx.fillStyle='#26527a'; ctx.fillRect(x0-3,y0-2,w+6,hgt+2); // recessed spillway
  // falling water = bright RIBBONS with scrolling foam highlights (clipped to the column)
  ctx.save(); ctx.beginPath(); ctx.rect(x0,y0,w,hgt); ctx.clip();
  const cols=6, cw=w/cols;
  for(let c=0;c<cols;c++){ const cxp=x0+(c+0.5)*cw;
    ctx.fillStyle=(c%2)?'#5fa2d2':'#4f92c6'; ctx.fillRect(x0+c*cw, y0, cw+0.6, hgt);
    const spd=80+(c%3)*28, off=(t*spd/1000)%22;
    for(let yy=y0-22; yy<y1+22; yy+=22){ const py=yy+off+(c*8);
      ctx.fillStyle='rgba(232,247,255,0.82)'; ctx.fillRect(cxp-1.5, py, 3, 9);
      ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.fillRect(cxp-0.5, py+3, 1, 4); } }
  ctx.restore();
  // TIER LEDGE — a mossy stone shelf with churning foam where the upper drop lands
  ctx.fillStyle='#4a4a52'; ctx.fillRect(x0-4,ymid-1,w+8,5);
  ctx.fillStyle='rgba(58,92,58,0.55)'; ctx.fillRect(x0-4,ymid-2,w+8,2);
  ctx.fillStyle='rgba(246,252,255,0.85)'; for(let i=0;i<14;i++) ctx.fillRect(x0-3+Math.random()*(w+6), ymid+2+Math.random()*4,1,1);
  // white churning lip at the lake edge
  ctx.fillStyle='rgba(248,253,255,0.95)'; ctx.fillRect(x0-4,y0-4,w+8,5);
  for(let i=0;i<12;i++) ctx.fillRect(x0-3+Math.random()*(w+6), y0-5+Math.random()*6,1,1);
  // splash foam RING where it lands in the pond + rising spray
  const by=y1;
  for(let i=0;i<26;i++){ const a=Math.random()*Math.PI, rr=Math.random()*w*1.2;
    ctx.fillStyle='rgba(248,253,255,'+(0.4+Math.random()*0.5).toFixed(2)+')'; ctx.fillRect(wf.cx*TILE+Math.cos(a)*rr, by+Math.sin(a)*9-2,1,1); }
  if(typeof emitP==='function') for(let k=0;k<2;k++) if(Math.random()<0.6)
    emitP(wf.cx*TILE+(Math.random()*w-w/2), by, {vx:Math.random()*42-21, vy:-26-Math.random()*26, life:0.5+Math.random()*0.4, col:'#eaf6ff', sz:2, g:95, drag:1.5, glow:true});
}
function drawPetRoom(){ if(!curRoom||!curRoom.petRoom||typeof ctx==='undefined') return;
  drawWaterfall();
  const t=performance.now()/1000, items=[]; const _au=(typeof petStore==='function')?petStore():null, _active=_au?_au.activePet:null;
  // koi glide just under the pond surface (drawn before decor so lily pads/rocks sit over them)
  if(typeof _koiImg!=='undefined'&&_koiImg&&_koiImg.complete&&_koiImg.naturalWidth) for(const k of petKoi){
    const bob=Math.sin(t*3+k.ph); ctx.save(); ctx.globalAlpha=0.8; ctx.imageSmoothingEnabled=false;
    const s=20/Math.max(_koiImg.naturalWidth,_koiImg.naturalHeight), w=_koiImg.naturalWidth*s, h=_koiImg.naturalHeight*s;
    ctx.translate(k.x,k.y+bob); ctx.scale(k.face<0?-1:1,1); ctx.drawImage(_koiImg,-w/2,-h/2,w,h); ctx.restore(); }
  // ducks paddle ON the surface, each with a little wake
  if(typeof _duckImg!=='undefined'&&_duckImg&&_duckImg.complete&&_duckImg.naturalWidth) for(const k of petDucks){
    const bob=Math.sin(t*2.5+k.ph);
    ctx.fillStyle='rgba(240,250,252,0.32)'; ctx.beginPath(); ctx.ellipse(k.x,k.y+3,10,3.5,0,0,6.29); ctx.fill();
    ctx.save(); ctx.imageSmoothingEnabled=false;
    const s=25/Math.max(_duckImg.naturalWidth,_duckImg.naturalHeight), w=_duckImg.naturalWidth*s, h=_duckImg.naturalHeight*s;
    ctx.translate(k.x,k.y+bob); ctx.scale(k.face<0?-1:1,1); ctx.drawImage(_duckImg,-w/2,-h/2,w,h); ctx.restore(); }
  for(const d of (curRoom.petDecor||[])){ const im=_roomDecor[d.img]; if(im&&im.complete&&im.naturalWidth) items.push({y:d.y,k:'d',im,x:d.x,s:d.s,flat:d.flat,w2:d.w2,h2:d.h2,img:d.img}); }
  for(const w of petWanderers) items.push({y:w.y,k:'w',w});
  items.sort((a,b)=>a.y-b.y);
  for(const it of items){
    if(it.k==='d'){ const w2=it.w2||(TILE*it.s), h2=it.h2||(w2*it.im.naturalHeight/it.im.naturalWidth);
      if(it.flat){ ctx.imageSmoothingEnabled=false; ctx.globalAlpha=0.96; ctx.drawImage(it.im, it.x-w2/2, it.y-h2/2, w2, h2); ctx.globalAlpha=1; continue; }   // lily pads / bridge float flat, no shadow
      // rocks standing IN the pond: show only the top half, with foam + wave ripples at the waterline
      const gx=(it.x/TILE)|0, gy=(it.y/TILE)|0, inWater=(it.img==='rock'||it.img==='rocks')&&curRoom.grid[gy]&&curRoom.grid[gy][gx]==='w';
      if(inWater){ const wl=it.y-h2*0.44;
        ctx.save(); ctx.beginPath(); ctx.rect(it.x-w2/2, it.y-h2, w2, Math.max(1,wl-(it.y-h2))); ctx.clip();
        ctx.imageSmoothingEnabled=false; ctx.drawImage(it.im, it.x-w2/2, it.y-h2, w2, h2); ctx.restore();
        const tt=performance.now()/600;
        pxH(it.x-w2*0.34, wl-1, w2*0.68, 'rgba(244,253,255,0.85)', 0.55);   // foam waterline
        ctx.strokeStyle='rgba(230,250,252,0.5)'; ctx.lineWidth=1;
        for(let a=0;a<2;a++){ const rr=w2*(0.26+a*0.13)+Math.sin(tt+a*1.7)*1.5;
          ctx.beginPath(); ctx.ellipse(it.x, wl+2, rr, rr*0.34, 0, 0.12*Math.PI, 0.88*Math.PI); ctx.stroke(); }
        continue; }
      ctx.fillStyle='rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(it.x,it.y,w2*0.32,w2*0.11,0,0,6.29); ctx.fill();
      ctx.imageSmoothingEnabled=false; ctx.drawImage(it.im, it.x-w2/2, it.y-h2, w2, h2); }
    else { const w=it.w, im=_petImg[w.def.spr]; if(!im||!im.complete||!im.naturalWidth) continue;
      const moving=Math.hypot(w.tx-w.x,w.ty-w.y)>=4, bob=moving?Math.abs(Math.sin(t*8+w.ph))*2:Math.sin(t*2+w.ph)*1;
      if(w.def.rar>=3){ const col=PET_RAR_COL[w.def.rar]||'#fff', pu=0.4+0.3*Math.sin(t*2.5+w.ph);
        ctx.save(); ctx.globalCompositeOperation='lighter'; const g=ctx.createRadialGradient(w.x,w.y-6,1,w.x,w.y-6,16+w.def.rar*3);
        g.addColorStop(0,col+Math.round(pu*80).toString(16).padStart(2,'0')); g.addColorStop(1,col+'00');
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(w.x,w.y-6,16+w.def.rar*3,0,6.29); ctx.fill(); ctx.restore(); }
      if(typeof shadow==='function') shadow(w.x,w.y,7);
      if(w.def.uid===_active){ ctx.save(); ctx.strokeStyle='rgba(255,201,77,'+(0.6+0.3*Math.sin(t*4)).toFixed(2)+')'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.ellipse(w.x,w.y,11,5,0,0,6.29); ctx.stroke(); ctx.restore(); }   // your follower
      const sc=(w.def.size||42)/Math.max(im.naturalWidth,im.naturalHeight), ww=im.naturalWidth*sc, hh=im.naturalHeight*sc;
      ctx.save(); ctx.imageSmoothingEnabled=false; ctx.translate(w.x,w.y+bob); ctx.scale(w.face<0?-1:1,1); ctx.drawImage(im,-ww/2,-hh,ww,hh); ctx.restore(); }
  } }
