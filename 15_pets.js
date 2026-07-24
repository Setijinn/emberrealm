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

// incubation ticks on kills (Phase 2 calls petOnKill); returns list of newly-ready egg indexes
function petOnKill(){ const u=petStore(); if(!u) return; let changed=false;
  for(const eg of u.eggs){ if(eg.prog<eg.need){ eg.prog++; if(eg.prog>=eg.need){ changed=true;
    if(typeof msg==='function') msg('🥚 An egg is ready to open!', (PET_CATS[eg.cat]?PET_CATS[eg.cat].name:'')+' · '+PET_RAR_NAME[eg.cond]); } } }
  if(changed) savePets(); }

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
