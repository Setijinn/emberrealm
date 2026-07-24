// ---------- ASCENSION ULTIMATES (design rule 8) ----------
// One fixed ultimate per ascension form (51). The CHOICE already happened when you picked
// 1 of 3 ascensions; each ult is derived from that form's capstone flag + sprite motif so
// look, mechanics and ultimate say the same thing.
//
// Cost model: NO mana — the cost is time. One long cooldown, one button, always castable
// when ready, always centred on you (rule 5b: a touch player must not have to aim it).
//
// BALANCE: every ult is built from the shared budget below, so the whole set retunes from
// one table. Reference points at any level:
//   a normal ability ~2-3x player damage on a 6-11s cooldown
//   ULT_T.nova  = 8x   player damage, once per ~60s   (~= 3 abilities in one press)
//   ULT_T.rain  = 1.1x per 0.5s tick for 6s           (~13x spread over the duration)
//   a defensive ult trades that damage for ~5s of invulnerability or a 50% shield
// Anything that stacks a buff instead is capped at ULT_T.buff for ULT_T.buffDur.
// Measured with a fixed harness (Lv100, 8 foes, damage normalised into "seconds of your own
// DPS"). Lingering ground was worth ~5x a burst ult before tuning (127 vs 20), because a
// 6-8s zone ticks 13-17 times into every target — hence rainDps well below 1.
const ULT_T={
  cd:60,            // baseline cooldown (per-ult override allowed, 45-75)
  nova:9.0,         // burst multiple of player damage
  rainDps:0.42, rainDur:6,
  volleyN:14, volleyDmg:0.95, volleyScale:3.4,
  sumN:5, sumDmg:0.55, sumLife:20, sumScale:0.62,
  buff:2.0, buffDur:8,
  wardPct:0.5, invuln:5,
  healPct:0.6,
  statusDur:5
};
// ---- ult primitives: same vocabulary as the ability P.* set, scaled to the ult budget ----
const U={
  // burst around you
  nova:(mult,r,col,st)=>(c)=>{ fx.push({t:'ring',x:player.x,y:player.y,r:r,life:0.5,col:col});
    for(const e of enemies){ if(Math.hypot(e.x-player.x,e.y-player.y)<r){
      dealDamage(e,c.dmg*mult*c.AP,{ability:true,ult:true,col:col});
      // valPct ties a damage-over-time to YOUR damage, so an ult scales with the character
      // instead of being huge at Lv40 and irrelevant at Lv150
      if(st) applyStatus(e,st.id,st.dur||ULT_T.statusDur,st.valPct?c.dmg*st.valPct*c.AP:(st.val||0)); } }
    if(typeof abilFx==='function') abilFx('nova',player.x,player.y,col);
    if(typeof emitP==='function') for(let i=0;i<34;i++){ const a=(i/34)*6.283;
      emitP(player.x,player.y,{vx:Math.cos(a)*260,vy:Math.sin(a)*260,life:0.7,col:col,sz:3.5,glow:true}); } },
  // lingering ground that ticks for a while
  rain:(r,col,dur,fire,poison)=>(c)=>{ zones.push({x:player.x,y:player.y,r:r,life:dur||ULT_T.rainDur,tick:0,
      ap:c.AP,dmg:Math.max(1,Math.round(c.dmg*ULT_T.rainDps*c.AP)),col:col,fire:!!fire,poison:!!poison});
    fx.push({t:'ring',x:player.x,y:player.y,r:r,life:0.5,col:col}); },
  // a spray of independent projectiles (never player.shots — design rule 6).
  // volleyScale: a radial spray only intersects a given target with ~2 of its N shots, so
  // per-projectile damage must be far higher than a nova's to be worth the same press.
  volley:(n,dm,col,life,pierce)=>(c)=>{ const N=n||ULT_T.volleyN;
    for(let i=0;i<N;i++){ const a=(i/N)*6.283;
      pShots.push({x:player.x,y:player.y,px:player.x,py:player.y,vx:Math.cos(a)*640,vy:Math.sin(a)*640,
        r:6,life:life||1.1,dmg:Math.round(c.dmg*(dm||ULT_T.volleyDmg)*ULT_T.volleyScale*c.AP),crit:false,
        pierce:(pierce===undefined?2:pierce),lastHit:null,forked:true,pk:'u:'+c.uid}); }
    if(typeof abilFx==='function') abilFx('fan',player.x,player.y,col,c.aim); },
  // sumScale trims the summon ults: a pack attacking twice a second for 20s was measuring
  // ~5x a burst ult, because pet damage compounds over the whole duration
  summon:(n,dm,life,spr)=>(c)=>{ const N=n||ULT_T.sumN;
    for(let i=0;i<N;i++) allies.push({x:player.x,y:player.y,
      dmg:Math.round(c.dmg*(dm||ULT_T.sumDmg)*ULT_T.sumScale*c.AP),life:life||ULT_T.sumLife,cd:0,spr:spr||'skel'});
    if(typeof abilFx==='function') abilFx('summon',player.x,player.y); },
  empower:(field,mult,dur,col)=>(c)=>{ player[field+'T']=dur||ULT_T.buffDur; player[field+'M']=mult||ULT_T.buff;
    if(typeof abilFx==='function') abilFx('buff',player.x,player.y,col||'#ffd07a'); },
  ward:(pct,inv)=>(c)=>{ player.shield=(player.shield||0)+player.maxhp*(pct||ULT_T.wardPct);
    if(inv) player.inv=Math.max(player.inv,inv);
    if(typeof abilFx==='function') abilFx('invuln',player.x,player.y); },
  heal:(pct)=>(c)=>{ if(typeof healPlayer==='function') healPlayer(player.maxhp*(pct||ULT_T.healPct));
    if(typeof abilFx==='function') abilFx('heal',player.x,player.y); },
  // brand everything nearby with a status
  // val is literal for curse (a damage multiplier); a DoT should pass valPct instead
  brand:(r,id,dur,val,col,valPct)=>(c)=>{ fx.push({t:'ring',x:player.x,y:player.y,r:r,life:0.45,col:col||'#c07ad4'});
    for(const e of enemies) if(Math.hypot(e.x-player.x,e.y-player.y)<r)
      applyStatus(e,id,dur||ULT_T.statusDur,valPct?c.dmg*valPct*c.AP:(val||0)); },
  // strike the N nearest for a heavy hit
  chain:(n,mult,col)=>(c)=>{ const s=enemies.slice()
      .sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y)).slice(0,n);
    const pts=[{x:player.x,y:player.y}];
    for(const e of s){ dealDamage(e,c.dmg*mult*c.AP,{ability:true,ult:true,col:col}); pts.push({x:e.x,y:e.y}); }
    if(pts.length>1) fx.push({t:'bolt',pts:pts,life:0.45,col:col||'#9ad4ef'}); },
  // execute: finish anything already wounded
  execute:(r,thresh,mult,col)=>(c)=>{ fx.push({t:'ring',x:player.x,y:player.y,r:r,life:0.5,col:col});
    for(const e of enemies){ if(Math.hypot(e.x-player.x,e.y-player.y)>r) continue;
      const low=e.hp<e.maxhp*thresh;
      dealDamage(e,c.dmg*(low?mult*2.2:mult)*c.AP,{ability:true,ult:true,col:col}); } },
  combo:(...fns)=>(c)=>{ for(const f of fns) f(c); }
};
function _ult(id,name,icon,desc,cast,cd){ return {id:id,name:name,icon:icon,desc:desc,cast:cast,cd:cd||ULT_T.cd}; }

// ---- the 51. Each is keyed by ascension id and echoes that form's capstone. ----
const ULTS={
 // KNIGHT — Templar heals through an aura, Warlord cleaves, Sentinel holds the line
 templar:_ult('templar','Sanctuary','⛪','Hallowed ground: a great ward, 60% healed, and the wicked burned back',
   U.combo(U.ward(0.55,2.5),U.heal(0.6),U.rain(150,'#ffe9b0',7),U.nova(4.5,170,'#ffe9b0')),65),
 warlord:_ult('warlord','Warcry of Ruin','📣','You roar — doubled damage for 8s and every foe cowed',
   U.combo(U.empower('bDmg',2.0,8,'#c0392b'),U.brand(240,'weak',6,0,'#c0392b'),U.nova(3.5,190,'#c0392b')),60),
 sentinel:_ult('sentinel','Hold the Line','🛡️','Immovable: 5s untouchable, a half-health ward, all blows returned',
   U.combo(U.ward(0.6,ULT_T.invuln),U.empower('bDmg',1.5,8,'#5a7a9c'),U.nova(3.0,150,'#5a7a9c',{id:'stun',dur:1})),60),
 // RANGER — Sharpshooter pierces, Windranger dashes, Tempest forks
 sharpshooter:_ult('sharpshooter','Perfect Shot','🎯','One breath, one volley — 18 piercing arrows that cross everything',
   U.combo(U.volley(18,1.05,'#e8b34b',1.6,99),U.empower('bDmg',1.6,6,'#e8b34b')),55),
 windranger:_ult('windranger','Cyclone','🌪️','You become the storm: untouchable 4s, blades on every wind',
   U.combo(U.ward(0.3,4),U.volley(16,0.7,'#6aae7a',0.9,2),U.rain(150,'#6aae7a',5),U.empower('bSpd',1.6,6,'#6aae7a')),55),
 tempest_r:_ult('tempest_r','Arrow Storm','🏹','The sky goes dark — a 7s rain of splintering shafts',
   U.combo(U.rain(190,'#c0504a',7),U.volley(20,0.65,'#c0504a',1.2,3)),58),
 // PYROMANCER — Infernomancer scorches ground, Emberlord explodes, Cinderguard burns attackers
 infernomancer:_ult('infernomancer','Inferno','🌋','The ground itself catches — a 7s firestorm, everything alight',
   U.combo(U.nova(5.0,200,'#ff7a3d',{id:'burn',dur:6,valPct:0.35}),U.rain(200,'#ff7a3d',7,true)),58),
 emberlord:_ult('emberlord','Meteor','☄️','You call down a mountain of fire',
   U.combo(U.nova(9.5,230,'#e07a2e',{id:'burn',dur:5,valPct:0.25}),U.volley(12,0.7,'#e07a2e',0.8,1)),60),
 cinderguard:_ult('cinderguard','Living Pyre','♨️','You burn as armour: half-health ward and a 7s corona',
   U.combo(U.ward(0.55,2),U.rain(140,'#c0504a',7,true),U.empower('bDmg',1.5,8,'#c0504a')),60),
 // ROGUE — Deathblade crits into cooldowns, Nightblade vanishes, Reaper feeds on kills
 deathblade:_ult('deathblade','Death Blossom','🌹','A whirl of steel — 20 blades and every cooldown reset',
   U.combo(U.volley(20,0.75,'#c0304a',0.7,1),U.nova(4.0,150,'#c0304a'),
     (c)=>{ if(player.acd) for(const k in player.acd) if(k.charAt(0)!=='_') player.acd[k]=0; }),58),
 nightblade:_ult('nightblade','Vanish','🌑','Gone — 5s untouchable, and you strike from nowhere at doubled damage',
   U.combo(U.ward(0.25,ULT_T.invuln),U.empower('bDmg',2.2,7,'#8a5ac0'),U.brand(220,'weak',6,0,'#8a5ac0')),55),
 reaper:_ult('reaper','Harvest','⚰️','The scythe falls: the wounded are reaped and their life is yours',
   U.combo(U.execute(210,0.35,4.2,'#6aae7a'),U.heal(0.5),U.empower('bRof',1.6,8,'#6aae7a')),58),
 // ASSASSIN — Nightshade chains toxins, Executioner finishes, Phantom kills unseen
 nightshade:_ult('nightshade','Killing Fog','☠️','A creeping cloud: 8s of spreading venom',
   U.combo(U.brand(220,'poison',8,0,'#6aae7a',0.4),U.rain(180,'#6aae7a',8,false,true),U.nova(3.0,180,'#6aae7a')),55),
 executioner_a:_ult('executioner_a','Execution','🪓','Sentence passed — anything under a third of its life is cut down',
   U.combo(U.execute(200,0.34,5.0,'#c0304a'),U.empower('bDmg',1.7,7,'#c0304a')),55),
 phantom_a:_ult('phantom_a','Phantom Assault','👤','You are everywhere at once for 6s and cannot be touched for 4',
   U.combo(U.ward(0.25,4),U.volley(18,0.7,'#8a5ac0',0.8,2),U.empower('bRof',1.9,6,'#8a5ac0')),55),
 // CLERIC — Bishop over-shields, Inquisitor burns, Warden wards
 bishop:_ult('bishop','Divine Aegis','✨','Light made solid: a full-health ward for you, ruin for the unclean',
   U.combo(U.ward(0.9,2.5),U.heal(0.7),U.nova(4.0,200,'#fff0c0',{id:'weak',dur:6})),65),
 inquisitor:_ult('inquisitor','Pyre of Judgment','🔥','The guilty burn — a pillar of holy fire for 7s',
   U.combo(U.nova(5.5,190,'#e8b34b',{id:'burn',dur:6,valPct:0.3}),U.rain(170,'#e8b34b',7,true)),58),
 warden_c:_ult('warden_c','Bulwark of Light','🛡️','A wall of dawn: 5s untouchable and everything held',
   U.combo(U.ward(0.7,ULT_T.invuln),U.brand(200,'stun',1.2,0,'#7d8a99'),U.heal(0.45)),62),
 // BERSERKER — Ravager chains, Bloodlord novas on overheal, Juggernaut runs through it
 ravager:_ult('ravager','Bloodstorm','🩸','A red haze — you strike everything near, over and over, for 7s',
   U.combo(U.rain(160,'#c0504a',7),U.empower('bRof',2.0,7,'#c0504a'),U.nova(4.0,160,'#c0504a',{id:'bleed',dur:6,val:4})),58),
 bloodlord:_ult('bloodlord','Crimson Tide','🌊','You drink deep: healed to the brim, and the overflow detonates',
   U.combo(U.heal(1.0),U.nova(6.5,200,'#c0392b',{id:'bleed',dur:6,val:4}),U.empower('bDmg',1.8,8,'#c0392b')),60),
 juggernaut:_ult('juggernaut','Unstoppable','🐗','Nothing stops you: 5s untouchable, doubled speed, all shoved aside',
   U.combo(U.ward(0.5,ULT_T.invuln),U.empower('bSpd',2.0,8,'#7d8a99'),U.nova(4.5,170,'#7d8a99',{id:'stun',dur:1.2})),60),
 // WARLOCK — Soulflayer shields on overheal, Doomcaller curses, Dreadlord commands
 soulflayer:_ult('soulflayer','Soul Harvest','👁️','You tear the life out of everything near and wear it',
   U.combo(U.nova(6.0,210,'#8a5ac0'),U.heal(0.7),U.ward(0.4,0)),58),
 doomcaller:_ult('doomcaller','Doom','💀','A death sentence: everything near takes 60% more damage for 8s',
   U.combo(U.brand(240,'curse',8,0.6,'#8a5ac0'),U.nova(4.5,200,'#8a5ac0'),U.empower('bDmg',1.5,8,'#8a5ac0')),58),
 dreadlord:_ult('dreadlord','Dread Legion','🦇','The dark answers — six horrors rise for 22s',
   U.combo(U.summon(6,0.6,22,'skel'),U.brand(220,'weak',8,0,'#8a5ac0')),60),
 // FROSTWEAVER — Cryomancer shatters, Frostwarden freezes the field, Icebreaker breaks it
 cryomancer:_ult('cryomancer','Absolute Winter','❄️','The world stops: everything frozen 2.5s, then shattered',
   U.combo(U.brand(230,'freeze',2.5,0,'#9ad4ef'),U.nova(6.5,230,'#9ad4ef'),U.rain(180,'#9ad4ef',6)),58),
 frostwarden:_ult('frostwarden','Glacial Prison','🧊','A cage of ice — held 3s, and the cold does not leave',
   U.combo(U.brand(240,'freeze',3,0,'#5a9cc0'),U.ward(0.5,2),U.rain(200,'#5a9cc0',7)),60),
 icebreaker:_ult('icebreaker','Shatterpoint','🔨','You break what you froze: everything chilled takes the full blow',
   U.combo(U.brand(220,'chill',6,0,'#7d8a99'),U.nova(9.0,220,'#7d8a99'),U.empower('bDmg',1.6,7,'#7d8a99')),58),
 // STORMCALLER — Stormlord chains, Thunderer calls bolts, Galewalker runs
 stormlord:_ult('stormlord','Thunderstorm','⛈️','The storm breaks — 7s of falling lightning',
   U.combo(U.rain(210,'#9ad4ef',7),U.chain(8,3.0,'#9ad4ef'),U.brand(210,'shock',6,0,'#9ad4ef',0.25)),58),
 thunderer:_ult('thunderer','Lightning Rod','⚡','You become the strike point: everything arcs to you and burns out',
   U.combo(U.chain(10,4.0,'#ffe9b0'),U.nova(5.0,200,'#ffe9b0',{id:'shock',dur:6,valPct:0.3}),U.ward(0.3,2)),58),
 galewalker:_ult('galewalker','Tempest Run','💨','You outrun the wind: doubled speed and fire rate for 8s',
   U.combo(U.empower('bSpd',2.0,8,'#6aae7a'),U.empower('bRof',2.0,8,'#6aae7a'),U.volley(14,0.6,'#6aae7a',0.9,2)),55),
 // HUNTER — Packlord doubles the pack, Falconer homes, Pathwarden walks the wild
 packlord:_ult('packlord','The Great Hunt','🐺','The whole pack comes: eight beasts for 22s',
   U.combo(U.summon(8,0.5,22,'wolf'),U.empower('bDmg',1.4,10,'#6aae7a')),60),
 falconer:_ult('falconer','Falcon Barrage','🦅','A storm of wings that never misses',
   U.combo(U.volley(20,0.75,'#5a9cc0',1.4,2),U.summon(2,0.5,18,'wisp'),U.empower('bRof',1.6,8,'#5a9cc0')),55),
 pathwarden:_ult('pathwarden','Wild Growth','🌿','The land itself rises against them for 8s',
   U.combo(U.rain(210,'#6aae7a',8,false,true),U.brand(210,'chill',8,0,'#6aae7a'),U.heal(0.5)),58),
 // MONK — Grandmaster staggers, Windwalker dashes, Ascendant transcends
 grandmaster:_ult('grandmaster','Thousand Palms','👐','A blur of strikes — everything near stunned and broken',
   U.combo(U.volley(22,0.6,'#c0504a',0.5,1),U.nova(4.5,160,'#c0504a',{id:'stun',dur:1.4}),U.empower('bRof',2.0,7,'#c0504a')),55),
 windwalker:_ult('windwalker','Wind Body','🍃','Air and nothing else: 5s untouchable, doubled speed',
   U.combo(U.ward(0.3,ULT_T.invuln),U.empower('bSpd',2.0,8,'#6aae7a'),U.rain(150,'#6aae7a',6)),55),
 ascendant:_ult('ascendant','Enlightenment','🌟','Perfect clarity: doubled damage and speed, wounds closed',
   U.combo(U.heal(0.8),U.empower('bDmg',2.0,9,'#d4b96a'),U.empower('bRof',1.5,9,'#d4b96a'),U.nova(3.5,170,'#d4b96a')),60),
 // PALADIN — Crusader explodes, Guardian wards, High Priest consecrates
 crusader:_ult('crusader','Divine Charge','⚔️','You ride them down — a blast that leaves nothing standing',
   U.combo(U.nova(8.5,220,'#e8b34b',{id:'stun',dur:1.2}),U.empower('bDmg',1.7,8,'#e8b34b')),58),
 guardian:_ult('guardian','Aegis of Dawn','🌅','An unbreakable ward for 5s and healing for all you protect',
   U.combo(U.ward(0.9,ULT_T.invuln),U.heal(0.6),U.brand(200,'weak',7,0,'#7d8a99')),65),
 highpriest:_ult('highpriest','Sanctified Ground','⛪','Holy earth for 8s: you mend, they burn',
   U.combo(U.rain(190,'#d4b96a',8,true),U.heal(0.6),U.ward(0.4,0),U.nova(3.5,180,'#d4b96a')),62),
 // NECROMANCER — Lich raises doubled, Bonelord explodes, Plaguebringer rots
 lich:_ult('lich','Army of the Dead','💀','The graves open — ten servants for 22s',
   U.combo(U.summon(10,0.45,22,'skel'),U.brand(210,'curse',8,0.3,'#8a5ac0')),62),
 bonelord:_ult('bonelord','Bone Storm','🦴','A cyclone of shards, 7s long',
   U.combo(U.rain(180,'#c0304a',7),U.volley(18,0.7,'#c0304a',1.2,3)),58),
 plaguebringer:_ult('plaguebringer','Pestilence','🧪','A plague that spreads for 9s and weakens all it touches',
   U.combo(U.brand(240,'poison',9,0,'#6aae7a',0.45),U.brand(240,'weak',9,0,'#6aae7a'),U.rain(200,'#6aae7a',9,false,true)),58),
 // BARD — Maestro finishes, Skald hastens allies, Loremaster echoes
 maestro:_ult('maestro','Grand Finale','🎼','The last chord: everything on the field feels it',
   U.combo(U.nova(8.0,240,'#c07ad4',{id:'stun',dur:1}),U.empower('bRof',1.8,8,'#c07ad4')),58),
 skald:_ult('skald','War Song','🥁','A marching song: doubled damage and speed for 9s',
   U.combo(U.empower('bDmg',1.9,9,'#c07ad4'),U.empower('bSpd',1.5,9,'#c07ad4'),U.summon(3,0.5,18,'wisp')),58),
 loremaster:_ult('loremaster','Encore','📜','Every note repeats — 8s of doubled fire and a ringing blast',
   U.combo(U.empower('bRof',2.0,8,'#d4b96a'),U.nova(5.0,200,'#d4b96a'),U.volley(14,0.6,'#d4b96a',1.0,2)),58),
 // SHAMAN — Spiritcaller lingers, Tidesage chains, Earthwarden endures
 spiritcaller:_ult('spiritcaller','Spirit Host','🕯️','The ancestors answer: eight wisps for 22s',
   U.combo(U.summon(8,0.5,22,'wisp'),U.heal(0.4),(c)=>{ player.spiritT=Math.max(player.spiritT||0,10); player.spiritAP=c.AP; }),60),
 tidesage:_ult('tidesage','Tidal Wave','🌊','The sea arrives — everything swept, chilled and drowned',
   U.combo(U.nova(7.0,240,'#5a9cc0',{id:'chill',dur:7}),U.rain(210,'#5a9cc0',7),U.heal(0.4)),58),
 earthwarden:_ult('earthwarden','Earthquake','⛰️','The ground breaks: everything thrown down and held',
   U.combo(U.nova(7.5,230,'#6aae7a',{id:'stun',dur:1.5}),U.ward(0.5,2),U.rain(180,'#6aae7a',6)),58),
 // DRAGOON — Wyrmknight charges, Skylord craters, Dragonlord breathes fire
 wyrmknight:_ult('wyrmknight','Dragon Rush','🐲','A lance through everything — 8s of doubled damage',
   U.combo(U.volley(16,0.85,'#e07a2e',1.5,99),U.empower('bDmg',2.0,8,'#e07a2e')),55),
 skylord:_ult('skylord','Skyfall','☄️','You come down like a falling star',
   U.combo(U.nova(9.5,230,'#e07a2e',{id:'stun',dur:1.4}),U.ward(0.35,2)),58),
 dragonlord:_ult('dragonlord',"Dragon's Breath",'🔥','A river of fire that burns for 8s',
   U.combo(U.nova(6.0,210,'#e07a2e',{id:'burn',dur:7,valPct:0.4}),U.rain(200,'#e07a2e',8,true),U.empower('bDmg',1.5,8,'#e07a2e')),58),
};

// ---- runtime ----
function ultFor(){ if(typeof rpg==='undefined'||!rpg||!rpg.ascension) return null; return ULTS[rpg.ascension]||null; }
function ultCd(){ return (player.acd&&player.acd.__ult)||0; }
function ultReady(){ return !!ultFor() && ultCd()<=0; }
function castUlt(){
  const u=ultFor(); if(!u||!inGame) return false;
  if(ultCd()>0){ texts.push({x:player.x,y:player.y-30,txt:'◷ '+Math.ceil(ultCd())+'s',col:'#c9c2b8',life:0.7}); return false; }
  if(!player.acd) player.acd={};
  player.acd.__ult=u.cd;
  const ch=(typeof curChar==='function')?curChar():null;
  // Ability power is SOFTENED for ultimates (0.55 + 0.45*AP). At full strength a WIS class
  // got ~2x the value of the identical formula, so martial ascensions had weak ultimates
  // purely for lacking WIS. Casters still lead, by a sane margin.
  const rawAP=(player.abilPow||1)*((typeof dynAP==='function')?dynAP():1);
  const ctx={ x:player.x, y:player.y, aim:player.aim||0, uid:u.id,
    AP:0.55+0.45*rawAP,
    dmg:Math.round(player.dmg*((typeof dynAtk==='function')?dynAtk():1)), cls:ch?ch.cls:'x' };
  const n0=pShots.length;
  try{ u.cast(ctx); }catch(e){ if(typeof showErr==='function') showErr(e); }
  for(let i=n0;i<pShots.length;i++) if(!pShots[i].pk) pShots[i].pk='u:'+u.id;
  if(typeof msg==='function') msg(u.name.toUpperCase(),u.desc);
  if(typeof perkFire==='function') perkFire('cast',{x:player.x,y:player.y,aim:ctx.aim,abil:'__ult',kind:'ult',kinds:['ult']});
  navigator.vibrate&&navigator.vibrate([60,40,90]);
  return true;
}
// ---- HUD: a 4th, gold button that only exists once you have ascended ----
function ultBtnRect(){ if(!ultFor()) return null;
  const us=(typeof UIS!=='undefined')?UIS:1;
  if(typeof inputMode!=='undefined' && inputMode==='pc'){
    const r=Math.round(30*us), orbR=Math.round(Math.min(34,W*0.08)*us);
    return {x:W/2+orbR*2+Math.round(40*us)+r+3*(Math.round(26*us)*2+Math.round(12*us)), y:H-r-Math.round(24*us), r:r};
  }
  const r=Math.round(Math.min(34,W*0.085)*us);
  return {x:W-Math.round(16*us)-r, y:H-Math.round(64*us)-r-3*(Math.round(Math.min(30,W*0.075)*us)*2+Math.round(10*us)), r:r};
}
function hitUltButton(sx,sy){ const b=ultBtnRect(); if(!b||!inGame) return false;
  return Math.hypot(sx-b.x,sy-b.y)<=b.r+8; }
function drawUltButton(){ const u=ultFor(); if(!u) return; const b=ultBtnRect(); if(!b) return;
  const cd=ultCd(), ready=cd<=0, pulse=0.5+Math.sin(performance.now()/300)*0.5;
  ctx.save();
  if(ready){ const g=ctx.createRadialGradient(b.x,b.y,2,b.x,b.y,b.r*1.8);
    g.addColorStop(0,'rgba(255,201,77,'+(0.30+0.22*pulse).toFixed(2)+')'); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(b.x,b.y,b.r*1.8,0,6.29); ctx.fill(); }
  ctx.fillStyle=ready?'rgba(58,40,16,.92)':'rgba(20,17,25,.9)';
  ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,6.29); ctx.fill();
  ctx.font=Math.round(b.r*1.15)+'px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.globalAlpha=ready?1:0.45; ctx.fillText(u.icon,b.x,b.y+1); ctx.globalAlpha=1;
  if(!ready){ ctx.fillStyle='rgba(8,6,10,.62)'; ctx.beginPath(); ctx.moveTo(b.x,b.y);
    ctx.arc(b.x,b.y,b.r,-Math.PI/2,-Math.PI/2+6.283*(cd/u.cd)); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#e8e0d0'; ctx.font='bold '+Math.round(b.r*0.62)+'px "Pixelify Sans",monospace';
    ctx.fillText(Math.ceil(cd),b.x,b.y+1); }
  ctx.lineWidth=ready?3:2; ctx.strokeStyle=ready?'#ffc94d':'#5a4a2e';
  ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,6.29); ctx.stroke();
  ctx.fillStyle=ready?'#ffd07a':'#7a7484'; ctx.font='bold '+Math.round(9*((typeof UIS!=='undefined')?UIS:1))+'px "Pixelify Sans",monospace';
  ctx.textBaseline='top'; ctx.fillText('ULT',b.x,b.y+b.r+3);
  ctx.restore(); ctx.textAlign='left'; ctx.textBaseline='alphabetic';
}
