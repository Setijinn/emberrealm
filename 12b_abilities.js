// ---------- active-ability loadout system ----------
// Each class has a POOL of abilities. The player slots 3 into a loadout.
// In-game: 3 buttons (bottom-left). Tap a button to ARM that slot; tap the
// right side of the screen to CAST the armed ability. Each ability has its own
// mana cost + cooldown. Ground-targeted abilities land where you tapped.
//
// rpg.loadout = [id,id,id]  (persisted). armedSlot = which of the 3 is live.

// ----- cast primitives (each returns a cast(ctx) fn). ctx={x,y,aim,AP,dmg,cls} -----
// ground abilities use ctx.x/ctx.y (the tapped world point); others use player pos.
const P = {
 fan:(n,sp,spd,dm,col,r,life,pc)=>(c)=>{ const a0=c.aim;
   for(let i=0;i<n;i++){ const sa=a0+(i-(n-1)/2)*sp;
     pShots.push({x:player.x,y:player.y,px:player.x,py:player.y,vx:Math.cos(sa)*spd,vy:Math.sin(sa)*spd,r:r,life:life,dmg:Math.round(c.dmg*dm*c.AP),pierce:pc||0,lastHit:null}); }
   boom(player.x,player.y,col,6); },
 nova:(rad,dm,col,slow)=>(c)=>{ fx.push({t:'ring',x:player.x,y:player.y,r:rad,life:0.38,col:col});
   for(const e of enemies){ if(Math.hypot(e.x-player.x,e.y-player.y)<rad){ const d=Math.round(c.dmg*dm*c.AP); e.hp-=d; e.flash=0.15; if(slow)e.slowT=slow; texts.push({x:e.x,y:e.y-e.r,txt:d,col:col,life:0.6}); } }
   boom(player.x,player.y,col,18); },
 blast:(rad,dm,col,slow)=>(c)=>{ fx.push({t:'ring',x:c.x,y:c.y,r:rad,life:0.38,col:col});
   for(const e of enemies){ if(Math.hypot(e.x-c.x,e.y-c.y)<rad){ const d=Math.round(c.dmg*dm*c.AP); e.hp-=d; e.flash=0.15; if(slow)e.slowT=slow; texts.push({x:e.x,y:e.y-e.r,txt:d,col:col,life:0.6}); } }
   boom(c.x,c.y,col,18); },
 dash:(dist,inv,col)=>(c)=>{ const a=c.aim, nx=player.x+Math.cos(a)*dist, ny=player.y+Math.sin(a)*dist;
   if(!solid(nx,ny)){player.x=nx;player.y=ny;} player.inv=Math.max(player.inv,inv); boom(player.x,player.y,col,14); },
 whirl:(n,dm,col,spd,life)=>(c)=>{ for(let i=0;i<n;i++){ const sa=i*6.283/n;
     pShots.push({x:player.x,y:player.y,px:player.x,py:player.y,vx:Math.cos(sa)*(spd||420),vy:Math.sin(sa)*(spd||420),r:7,life:life||0.5,dmg:Math.round(c.dmg*dm*c.AP),pierce:0,lastHit:null}); }
   boom(player.x,player.y,col,10); },
 chain:(n,dm,col)=>(c)=>{ const s=enemies.slice().sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y)).slice(0,n);
   const pts=[{x:player.x,y:player.y}];
   for(const e of s){ const d=Math.round(c.dmg*dm*c.AP); e.hp-=d; e.flash=0.15; pts.push({x:e.x,y:e.y}); texts.push({x:e.x,y:e.y-e.r,txt:d,col:col,life:0.6}); }
   if(pts.length>1) fx.push({t:'bolt',pts:pts,life:0.3,col:col}); },
 summon:(spr,cnt,dm,life)=>(c)=>{ for(let i=0;i<cnt;i++) allies.push({x:player.x,y:player.y,dmg:Math.round(c.dmg*dm*c.AP),life:life,cd:0,spr:spr}); boom(player.x,player.y,'#8fd48c',12); },
 heal:(pct)=>(c)=>{ player.hp=Math.min(player.maxhp,player.hp+player.maxhp*pct); boom(player.x,player.y,'#fff0c0',16);
   texts.push({x:player.x,y:player.y-28,txt:'+'+Math.round(player.maxhp*pct),col:'#8fd48c',life:0.8}); },
 buff:(fld,mult,dur,inv)=>(c)=>{ player[fld+'T']=dur; player[fld+'M']=mult; if(inv)player.inv=Math.max(player.inv,inv); boom(player.x,player.y,'#ffd07a',12); },
 invuln:(dur)=>(c)=>{ player.inv=Math.max(player.inv,dur); boom(player.x,player.y,'#c9d2da',14); },
 zone:(rad,life,col)=>(c)=>{ zones.push({x:c.x,y:c.y,r:rad,life:life,tick:0,ap:c.AP}); fx.push({t:'ring',x:c.x,y:c.y,r:rad,life:0.35,col:col}); },
 drain:(rad,dm,col,healPer)=>(c)=>{ let n=0;
   for(const e of enemies){ if(Math.hypot(e.x-player.x,e.y-player.y)<rad){ e.hp-=Math.round(c.dmg*dm*c.AP); e.flash=0.15; n++; } }
   player.hp=Math.min(player.maxhp,player.hp+n*healPer*c.AP); fx.push({t:'ring',x:player.x,y:player.y,r:rad,life:0.35,col:col}); },
 spirit:(dur)=>(c)=>{ player.spiritT=dur; player.spiritAP=c.AP; boom(player.x,player.y,'#7ab8d4',12); },
 combo:(...fns)=>(c)=>{ for(const f of fns) f(c); },
};
function A(id,name,mp,cd,icon,desc,cast,ground){ return {id:id,name:name,mp:mp,cd:cd,icon:icon,desc:desc,cast:cast,ground:!!ground}; }

// ----- per-class ability pools (first 3 = default loadout) -----
const APOOL = {
 ranger:[
  A('ranger_volley','Volley',24,10,'🏹','12-arrow fan along your aim',P.fan(12,0.12,640,1,'#7dc47a',5,1.1,0)),
  A('ranger_pierce','Piercing Shot',16,5,'➶','One arrow, pierces everything',P.fan(1,0,940,3,'#7dc47a',6,1.4,99)),
  A('ranger_rain','Arrow Rain',26,11,'☔','A volley crashes down at the target',P.blast(120,2.6,'#7dc47a'),true),
  A('ranger_sprint','Sprint',12,7,'💨','+60% move speed for 4s',P.buff('bSpd',1.6,4)),
  A('ranger_snare','Snare Volley',20,9,'❄️','Slow + damage at the target',P.blast(110,1.4,'#9ad4ef',2.5),true),
 ],
 pyro:[
  A('pyro_deto','Detonate',26,10,'🔥','Fiery blast around you',P.nova(170,3,'#ff7a3d')),
  A('pyro_fireball','Fireball',18,5,'☄️','Explosion at the target',P.blast(120,3.2,'#ff7a3d'),true),
  A('pyro_flames','Flame Fan',16,6,'🌋','Cone of piercing embers',P.fan(7,0.14,560,1.3,'#ff7a3d',6,0.7,1)),
  A('pyro_immol','Immolate',20,9,'♨️','Burning ring that slows',P.nova(150,2,'#ff7a3d',1.5)),
  A('pyro_dash','Ember Dash',12,6,'💨','Blink through foes',P.dash(160,1,'#ff7a3d')),
 ],
 knight:[
  A('knight_bulwark','Bulwark',22,12,'🛡️','4s invulnerable',P.invuln(4)),
  A('knight_slam','Shield Slam',16,6,'💥','Shockwave at the target',P.blast(110,2.4,'#c9d2da'),true),
  A('knight_whirl','Sweeping Blow',18,7,'🌀','Ring of steel around you',P.whirl(12,1.4,'#c9d2da',400,0.5)),
  A('knight_rally','Rally',14,10,'💪','+50% damage for 5s',P.buff('bDmg',1.5,5)),
  A('knight_charge','Charge',12,6,'⚡','Dash forward',P.dash(170,0.8,'#c9d2da')),
 ],
 rogue:[
  A('rogue_step','Shadowstep',14,6,'🌑','Blink forward, untouchable',P.dash(150,1.2,'#c07ad4')),
  A('rogue_fan','Fan of Knives',18,7,'🔪','Spread of daggers',P.fan(9,0.16,620,1.1,'#c07ad4',5,0.7,0)),
  A('rogue_mark','Deathmark',20,11,'🎯','+120% damage + evade, 4s',P.buff('bDmg',2.2,4,0.8)),
  A('rogue_smoke','Smoke Bomb',16,9,'💨','Vanish; slow ring',P.combo(P.invuln(1.2),P.nova(140,1,'#c07ad4',2))),
  A('rogue_poison','Poison Vial',16,8,'☠️','Toxic blast at the target',P.blast(110,2.2,'#8fd48c'),true),
 ],
 assassin:[
  A('assassin_mark','Deathmark',20,11,'🎯','+120% damage + evade, 4s',P.buff('bDmg',2.2,4,0.8)),
  A('assassin_blink','Blink',12,5,'🌑','Dash, brief evade',P.dash(160,1,'#c0304a')),
  A('assassin_exec','Execute',22,9,'☠️','Heavy blast at the target',P.blast(100,3.4,'#c0304a'),true),
  A('assassin_fan','Shadow Fan',16,6,'🔪','Dagger spread',P.fan(7,0.14,660,1.2,'#c0304a',5,0.7,0)),
  A('assassin_veil','Veil',14,9,'👤','Vanish (invuln 2s)',P.invuln(2)),
 ],
 cleric:[
  A('cleric_sanct','Sanctuary',26,12,'✨','Full heal',P.heal(1)),
  A('cleric_smite','Smite',18,6,'🌟','Holy blast at the target',P.blast(120,2.6,'#fff0c0'),true),
  A('cleric_ward','Ward',16,9,'🛡️','Invulnerable 2.5s',P.invuln(2.5)),
  A('cleric_mend','Mend',14,6,'💛','Heal 35%',P.heal(0.35)),
  A('cleric_ground','Consecrate',20,10,'⛪','Holy ground at the target',P.zone(100,6,'#fff0c0'),true),
 ],
 berserker:[
  A('berserker_whirl','Whirlwind',24,10,'🌀','16-blade ring',P.whirl(16,1.2,'#e2604c',420,0.5)),
  A('berserker_rage','Rage',14,9,'💢','+60% damage for 5s',P.buff('bDmg',1.6,5)),
  A('berserker_leap','Leap',16,6,'💥','Dash then slam',P.combo(P.dash(160,0.6,'#e2604c'),P.nova(120,2,'#e2604c'))),
  A('berserker_quake','Quake',20,9,'⛰️','Earthshock at the target',P.blast(140,2.4,'#e2604c'),true),
  A('berserker_frenzy','Frenzy',16,8,'⚔️','+50% attack speed, 6s',P.buff('bRof',1.5,6)),
 ],
 warlock:[
  A('warlock_burst','Soulburst',24,10,'💜','Drain all nearby foes',P.drain(200,2,'#8a5ac0',15)),
  A('warlock_bolt','Shadow Bolt',14,4,'🟣','Piercing bolt',P.fan(1,0,760,2.4,'#8a5ac0',7,1.3,99)),
  A('warlock_imps','Summon Imps',20,12,'👿','2 imps fight for you, 12s',P.summon('skel',2,0.9,12)),
  A('warlock_curse','Curse',18,8,'☠️','Blast + slow at the target',P.blast(130,2,'#8a5ac0',2),true),
  A('warlock_tap','Life Tap',14,7,'🩸','Drain ring, heal per foe',P.drain(150,1.4,'#8a5ac0',12)),
 ],
 frost:[
  A('frost_nova','Winter Nova',24,10,'❄️','Freeze everything near',P.nova(220,1,'#9ad4ef',3)),
  A('frost_bolt','Frostbolt',14,4,'🔵','Piercing chill bolt',(c)=>{const a=c.aim; pShots.push({x:player.x,y:player.y,px:player.x,py:player.y,vx:Math.cos(a)*720,vy:Math.sin(a)*720,r:6,life:1.3,dmg:Math.round(c.dmg*2.2*c.AP),pierce:99,lastHit:null,slow:true});}),
  A('frost_blizzard','Blizzard',22,10,'🌨️','Chilling blast at the target',P.blast(150,2,'#9ad4ef',3),true),
  A('frost_shield','Ice Barrier',16,9,'🛡️','Invulnerable 2.5s',P.invuln(2.5)),
  A('frost_lance','Ice Lance',16,6,'🧊','Cone of shards',P.fan(5,0.12,640,1.5,'#9ad4ef',6,0.9,1)),
 ],
 storm:[
  A('storm_chain','Chain Storm',24,10,'⚡','Lightning arcs to 6 foes',P.chain(6,2.5,'#ffe9b0')),
  A('storm_strike','Thunderstrike',20,8,'🌩️','Bolt strikes the target',P.blast(120,2.8,'#ffe9b0'),true),
  A('storm_bolt','Lightning',14,4,'⚡','Arcs to 3 foes',P.chain(3,2,'#ffe9b0')),
  A('storm_rush','Static Rush',12,7,'💨','+60% move speed, 4s',P.buff('bSpd',1.6,4)),
  A('storm_nova','Static Nova',20,9,'🔆','Shock ring around you',P.nova(180,2,'#ffe9b0')),
 ],
 hunter:[
  A('hunter_pack','Wolfpack',22,12,'🐺','2 wolves fight for you, 10s',P.summon('wolf',2,0.8,10)),
  A('hunter_shot','Piercing Shot',14,5,'➶','Arrow pierces everything',P.fan(1,0,940,3,'#7dc47a',6,1.4,99)),
  A('hunter_trap','Snare',18,9,'🕸️','Slow blast at the target',P.blast(120,1.6,'#7dc47a',2.5),true),
  A('hunter_volley','Volley',22,10,'🏹','10-arrow fan',P.fan(10,0.13,640,1,'#7dc47a',5,1.1,0)),
  A('hunter_sprint','Sprint',12,7,'💨','+60% move speed, 4s',P.buff('bSpd',1.6,4)),
 ],
 monk:[
  A('monk_zephyr','Zephyr',16,8,'💨','+80% speed + dodge, 5s',P.buff('bSpd',1.8,5,1.5)),
  A('monk_palm','Palm Strike',14,4,'🖐️','Force blast at the target',P.blast(100,2.4,'#7ab8d4'),true),
  A('monk_flurry','Flurry',16,6,'👊','Ring of fists',P.whirl(10,1.2,'#7ab8d4',380,0.45)),
  A('monk_calm','Meditate',16,10,'🧘','Heal 40%',P.heal(0.4)),
  A('monk_dash','Wind Dash',12,5,'🌀','Dash, evade',P.dash(170,1,'#7ab8d4')),
 ],
 paladin:[
  A('paladin_conse','Consecrate',22,10,'⛪','Holy ground for 6s',P.zone(95,6,'#ffd07a'),true),
  A('paladin_smite','Smite',16,5,'🌟','Holy blast at the target',P.blast(120,2.6,'#ffd07a'),true),
  A('paladin_shield','Divine Shield',20,12,'🛡️','Invulnerable 3.5s',P.invuln(3.5)),
  A('paladin_heal','Lay on Hands',18,10,'💛','Heal 45%',P.heal(0.45)),
  A('paladin_zeal','Zeal',14,9,'✨','+50% damage for 5s',P.buff('bDmg',1.5,5)),
 ],
 necro:[
  A('necro_raise','Raise Dead',22,12,'💀','2 skeletons, 12s',P.summon('skel',2,0.9,12)),
  A('necro_bolt','Bone Spear',14,4,'🦴','Piercing bolt',P.fan(1,0,760,2.4,'#8fd48c',7,1.3,99)),
  A('necro_nova','Death Nova',22,10,'☠️','Ring of decay',P.nova(180,2,'#8fd48c')),
  A('necro_blast','Corpse Blast',18,8,'🟢','Blast at the target',P.blast(130,2.6,'#8fd48c'),true),
  A('necro_siphon','Siphon',16,8,'🩸','Drain ring, heal per foe',P.drain(160,1.4,'#8fd48c',12)),
 ],
 bard:[
  A('bard_cresc','Crescendo',18,10,'🎵','+50% attack speed, 6s',P.buff('bRof',1.5,6)),
  A('bard_note','Sonic Shot',14,4,'🎶','Piercing note',P.fan(1,0,820,2.2,'#c07ad4',6,1.2,99)),
  A('bard_march','March',12,7,'💨','+60% move speed, 4s',P.buff('bSpd',1.6,4)),
  A('bard_rest','Rest',16,9,'💛','Heal 35%',P.heal(0.35)),
  A('bard_discord','Discord',20,9,'🔊','Blast + slow at the target',P.blast(130,2,'#c07ad4',2),true),
 ],
 shaman:[
  A('shaman_ring','Spirit Ring',22,12,'🌀','8 orbiting wards, 8s',P.spirit(8)),
  A('shaman_bolt','Spirit Bolt',14,4,'🔷','Piercing bolt',P.fan(1,0,760,2.2,'#7ab8d4',6,1.3,99)),
  A('shaman_mend','Ancestral Mend',16,9,'💧','Heal 40%',P.heal(0.4)),
  A('shaman_nova','Tempest',20,9,'🌊','Shock ring that slows',P.nova(180,2,'#7ab8d4',1.5)),
  A('shaman_chain','Spirit Link',18,8,'⚡','Arcs to 4 foes',P.chain(4,2.2,'#7ab8d4')),
 ],
 dragoon:[
  A('dragoon_sky','Skyfall',22,11,'🌠','Leap and crater the ground',P.combo(P.dash(160,0.6,'#e07a2e'),P.nova(130,2.2,'#e07a2e'))),
  A('dragoon_thrust','Lance Thrust',14,4,'🔱','Piercing thrust',P.fan(1,0,880,2.6,'#e07a2e',7,1.2,99)),
  A('dragoon_leap','High Jump',12,6,'⬆️','Long dash, evade',P.dash(190,1,'#e07a2e')),
  A('dragoon_sweep','Lance Sweep',16,6,'🌀','Ring sweep',P.whirl(10,1.3,'#e07a2e',420,0.5)),
  A('dragoon_impact','Impact',20,9,'💥','Blast at the target',P.blast(140,2.4,'#e07a2e'),true),
 ],
};
// ----- 7 more abilities per class -> 12 total (unlocked via skill-tree ability nodes) -----
const _EXTRA={
 ranger:[
  A('ranger_multi','Multishot',18,6,'🎯','5-arrow spread',P.fan(5,0.18,700,1.2,'#7dc47a',5,1.0,0)),
  A('ranger_explo','Explosive Arrow',22,9,'💥','Fiery blast at the target',P.blast(120,3,'#e07a2e'),true),
  A('ranger_roll','Combat Roll',12,6,'🤸','Roll, brief evade',P.dash(150,1,'#7dc47a')),
  A('ranger_aim','Take Aim',14,10,'🔎','+60% damage, 5s',P.buff('bDmg',1.6,5)),
  A('ranger_hail','Arrow Hail',24,11,'☔','Arrows rain around you',P.nova(190,2,'#7dc47a')),
  A('ranger_venom','Venom Arrow',16,8,'☠️','Poison blast at the target',P.blast(100,2,'#8fd48c',2),true),
  A('ranger_swift','Swiftness',14,10,'💨','+50% attack speed, 6s',P.buff('bRof',1.5,6)),
 ],
 pyro:[
  A('pyro_meteor','Meteor',26,12,'☄️','Huge blast at the target',P.blast(160,3.6,'#ff7a3d'),true),
  A('pyro_wall','Wall of Fire',22,10,'🔥','Burning ground at the target',P.zone(110,6,'#ff7a3d'),true),
  A('pyro_combust','Combustion',24,10,'💥','Fiery ring around you',P.nova(180,2.6,'#ff7a3d')),
  A('pyro_shield','Flame Shield',16,10,'🛡️','Invulnerable 2.5s',P.invuln(2.5)),
  A('pyro_lavaburst','Lava Burst',18,6,'🌋','Cone of lava',P.fan(6,0.16,540,1.4,'#e07a2e',7,0.7,1)),
  A('pyro_ignite','Ignite',14,10,'♨️','+60% damage, 5s',P.buff('bDmg',1.6,5)),
  A('pyro_flash','Flash Fire',12,6,'💨','Blink through flames',P.dash(160,1,'#ff7a3d')),
 ],
 knight:[
  A('knight_bash','Shield Bash',16,6,'🛡️','Shockwave at the target',P.blast(110,2.4,'#c9d2da'),true),
  A('knight_fortify','Fortify',18,11,'🧱','Invulnerable 3s',P.invuln(3)),
  A('knight_warcry','War Cry',14,10,'📣','+55% damage, 5s',P.buff('bDmg',1.55,5)),
  A('knight_cleave','Cleaving Strike',18,7,'⚔️','Ring of steel',P.whirl(12,1.5,'#c9d2da',400,0.5)),
  A('knight_throw','Shield Throw',16,6,'🔵','Piercing shield',P.fan(1,0,720,2.6,'#c9d2da',8,1.2,99)),
  A('knight_wind','Second Wind',16,10,'💛','Heal 40%',P.heal(0.4)),
  A('knight_jugg','Juggernaut',14,9,'🐂','+55% move + brace, 5s',P.buff('bSpd',1.55,5,1.2)),
 ],
 rogue:[
  A('rogue_backstab','Backstab',18,7,'🗡️','Heavy blast at the target',P.blast(100,3.2,'#c07ad4'),true),
  A('rogue_evade','Evasion',14,9,'👤','Invulnerable 2s',P.invuln(2)),
  A('rogue_caltrops','Caltrops',18,9,'🌾','Slowing ground at the target',P.zone(110,5,'#8fd48c'),true),
  A('rogue_flurry','Flurry',18,7,'🔪','Ring of daggers',P.whirl(10,1.1,'#c07ad4',560,0.5)),
  A('rogue_venomfan','Venom Fan',16,7,'☠️','Poison spread',P.fan(7,0.16,620,1.1,'#8fd48c',5,0.7,0)),
  A('rogue_adren','Adrenaline',14,10,'⚡','+55% attack speed, 6s',P.buff('bRof',1.55,6)),
  A('rogue_clone','Shadow Clone',20,12,'🌑','2 shades fight, 10s',P.summon('skel',2,0.8,10)),
 ],
 assassin:[
  A('assassin_garrote','Garrote',18,7,'🩸','Heavy blast at the target',P.blast(100,3.4,'#c0304a'),true),
  A('assassin_cloak','Cloak',14,9,'👤','Invulnerable 2.5s',P.invuln(2.5)),
  A('assassin_fanknives','Fan of Knives',18,7,'🔪','Ring of blades',P.whirl(10,1.2,'#c0304a',600,0.5)),
  A('assassin_toxin','Toxin',16,8,'☠️','Poison blast at the target',P.blast(100,2.2,'#8fd48c',2),true),
  A('assassin_ambush','Ambush',14,7,'🌑','Dash then +damage',P.combo(P.dash(160,0.8,'#c0304a'),P.buff('bDmg',1.6,3))),
  A('assassin_swift','Swift Strike',14,10,'💨','+55% attack speed, 6s',P.buff('bRof',1.55,6)),
  A('assassin_massacre','Massacre',24,11,'💀','Blades erupt around you',P.nova(170,2.4,'#c0304a')),
 ],
 cleric:[
  A('cleric_holynova','Holy Nova',22,10,'🌟','Radiant ring around you',P.nova(180,2.4,'#fff0c0')),
  A('cleric_barrier','Barrier',16,9,'🛡️','Invulnerable 2.5s',P.invuln(2.5)),
  A('cleric_radiance','Radiance',14,10,'✨','+55% damage, 5s',P.buff('bDmg',1.55,5)),
  A('cleric_purge','Purge',18,6,'💠','Holy blast at the target',P.blast(120,2.8,'#fff0c0'),true),
  A('cleric_renew','Renew',16,9,'💚','Heal 45%',P.heal(0.45)),
  A('cleric_chastise','Chastise',16,6,'🌠','Holy spread',P.fan(5,0.14,620,1.5,'#fff0c0',6,0.9,1)),
  A('cleric_guardian','Guardian Spirit',20,12,'👼','2 wisps fight, 10s',P.summon('wolf',2,0.8,10)),
 ],
 berserker:[
  A('berserker_bloodbath','Bloodbath',24,10,'🩸','Drain all nearby foes',P.drain(200,2,'#e2604c',15)),
  A('berserker_rampage','Rampage',24,10,'💢','Earthshock ring',P.nova(190,2.6,'#e2604c')),
  A('berserker_warpath','Warpath',12,6,'🐂','Charge through foes',P.dash(180,0.8,'#e2604c')),
  A('berserker_reckless','Reckless',14,9,'😡','+65% damage, 5s',P.buff('bDmg',1.65,5)),
  A('berserker_earthshatter','Earthshatter',22,9,'⛰️','Quake at the target',P.blast(140,2.6,'#e2604c'),true),
  A('berserker_laststand','Last Stand',18,12,'🛡️','Heal 35% + brace',P.combo(P.heal(0.35),P.invuln(2))),
  A('berserker_bloodfan','Cleave Wave',16,6,'⚔️','Wave of blades',P.fan(5,0.18,500,1.4,'#e2604c',7,0.6,1)),
 ],
 warlock:[
  A('warlock_fury','Shadow Fury',24,10,'💜','Void ring around you',P.nova(180,2.4,'#8a5ac0')),
  A('warlock_hex','Hex',18,8,'🟣','Slow blast at the target',P.blast(120,2,'#8a5ac0',2.5),true),
  A('warlock_corruption','Corruption',16,7,'☠️','Cursed spread',P.fan(6,0.15,700,1.2,'#8a5ac0',6,1.0,1)),
  A('warlock_demon','Demon Form',16,11,'😈','+60% damage, 6s',P.buff('bDmg',1.6,6)),
  A('warlock_cage','Soul Cage',20,12,'🔗','2 imps fight, 12s',P.summon('skel',2,0.9,12)),
  A('warlock_rift','Void Rift',12,6,'🌀','Blink through shadow',P.dash(170,1,'#8a5ac0')),
  A('warlock_siphon','Life Siphon',16,7,'🩸','Drain ring, heal',P.drain(160,1.6,'#8a5ac0',14)),
 ],
 frost:[
  A('frost_spike','Glacial Spike',22,9,'🧊','Icy blast at the target',P.blast(130,3,'#9ad4ef',3),true),
  A('frost_armor','Ice Armor',16,10,'🛡️','Invulnerable 2.5s',P.invuln(2.5)),
  A('frost_coldsnap','Cold Snap',24,10,'❄️','Freezing ring around you',P.nova(200,2.2,'#9ad4ef',3)),
  A('frost_wall','Ice Wall',20,10,'🧱','Chilling ground at the target',P.zone(110,6,'#9ad4ef'),true),
  A('frost_freeze','Deep Freeze',18,9,'🥶','Freeze blast at the target',P.blast(110,2,'#9ad4ef',4),true),
  A('frost_rime','Rimeblades',16,6,'❄️','Cone of ice shards',P.fan(6,0.14,640,1.4,'#9ad4ef',6,0.9,1)),
  A('frost_block','Ice Block',14,10,'🧊','Invulnerable 3s',P.invuln(3)),
 ],
 storm:[
  A('storm_thunderstorm','Thunderstorm',24,10,'🌩️','Shock ring around you',P.nova(190,2.4,'#ffe9b0')),
  A('storm_ball','Ball Lightning',22,9,'🔆','Blast at the target',P.blast(120,2.8,'#ffe9b0'),true),
  A('storm_field','Static Field',20,10,'⚡','Shocking ground at the target',P.zone(110,6,'#ffe9b0'),true),
  A('storm_surge','Surge',14,10,'⚡','+55% attack speed, 6s',P.buff('bRof',1.55,6)),
  A('storm_fork','Fork Bolt',16,6,'🌿','Forking bolts',P.fan(3,0.12,760,1.8,'#ffe9b0',6,1.1,2)),
  A('storm_blink','Blink',12,6,'💨','Teleport a short way',P.dash(180,1,'#ffe9b0')),
  A('storm_overcharge','Overcharge',14,10,'🔋','+60% damage, 5s',P.buff('bDmg',1.6,5)),
 ],
 hunter:[
  A('hunter_beasttrap','Beast Trap',18,9,'🕳️','Slow blast at the target',P.blast(120,1.8,'#7dc47a',2.5),true),
  A('hunter_eagleeye','Eagle Eye',14,10,'🦅','+55% damage, 5s',P.buff('bDmg',1.55,5)),
  A('hunter_bolas','Bolas',16,8,'🪢','Snaring blast at the target',P.blast(110,1.6,'#7dc47a',3),true),
  A('hunter_multi','Multishot',18,6,'🏹','5-arrow spread',P.fan(5,0.16,660,1.2,'#7dc47a',5,1.0,0)),
  A('hunter_falcon','Falcon',20,12,'🦅','A hawk fights for you, 12s',P.summon('wolf',1,1.0,12)),
  A('hunter_roll','Roll',12,6,'🤸','Roll, brief evade',P.dash(150,1,'#7dc47a')),
  A('hunter_rapid','Rapid Fire',14,10,'💨','+55% attack speed, 6s',P.buff('bRof',1.55,6)),
 ],
 monk:[
  A('monk_ironpalm','Iron Palm',16,6,'👊','Force blast at the target',P.blast(100,2.8,'#7ab8d4'),true),
  A('monk_meditate2','Deep Meditation',18,11,'🧘','Heal 45%',P.heal(0.45)),
  A('monk_cyclone','Cyclone',18,7,'🌀','Ring of fists',P.whirl(12,1.2,'#7ab8d4',400,0.5)),
  A('monk_peace','Inner Peace',14,10,'☮️','Invulnerable 2.5s',P.invuln(2.5)),
  A('monk_rising','Rising Kick',16,6,'🦵','Leap then slam',P.combo(P.dash(160,0.7,'#7ab8d4'),P.nova(110,1.8,'#7ab8d4'))),
  A('monk_kiblast','Ki Blast',16,6,'🔵','Cone of chi',P.fan(5,0.14,620,1.5,'#7ab8d4',6,0.9,1)),
  A('monk_fury','Furious Fists',14,10,'⚡','+60% attack speed, 6s',P.buff('bRof',1.6,6)),
 ],
 paladin:[
  A('paladin_hammer','Hammer of Justice',18,7,'🔨','Holy blast at the target',P.blast(120,2.8,'#ffd07a'),true),
  A('paladin_aura','Devotion Aura',20,10,'⛪','Holy ground at the target',P.zone(100,6,'#ffd07a'),true),
  A('paladin_storm','Divine Storm',18,7,'✨','Ring of light',P.whirl(12,1.4,'#ffd07a',420,0.5)),
  A('paladin_blessing','Blessing',14,10,'🙏','+55% damage, 5s',P.buff('bDmg',1.55,5)),
  A('paladin_avenger','Avenger Shield',16,6,'🛡️','Piercing shield',P.fan(1,0,720,2.6,'#ffd07a',8,1.2,99)),
  A('paladin_sanct','Sanctuary',18,11,'🕊️','Invulnerable 3s',P.invuln(3)),
  A('paladin_crusade','Crusade',14,9,'⚡','+55% move + brace, 5s',P.buff('bSpd',1.55,5,1.2)),
 ],
 necro:[
  A('necro_corpseexp','Corpse Explosion',20,8,'💥','Decay blast at the target',P.blast(140,2.8,'#8fd48c'),true),
  A('necro_bonearmor','Bone Armor',16,10,'🦴','Invulnerable 2.5s',P.invuln(2.5)),
  A('necro_coil','Death Coil',18,7,'🟢','Drain ring, heal',P.drain(170,1.8,'#8fd48c',14)),
  A('necro_wraith','Summon Wraith',22,12,'👻','2 wraiths fight, 12s',P.summon('skel',2,1.0,12)),
  A('necro_decay','Decay',20,9,'☠️','Rotting ground at the target',P.zone(120,6,'#8fd48c'),true),
  A('necro_prison','Bone Prison',16,8,'🦴','Snaring blast at the target',P.blast(110,1.8,'#8fd48c',3),true),
  A('necro_ritual','Dark Ritual',14,10,'🕯️','+60% damage, 6s',P.buff('bDmg',1.6,6)),
 ],
 bard:[
  A('bard_soundwave','Sound Wave',22,9,'🔊','Sonic ring around you',P.nova(180,2.2,'#c07ad4')),
  A('bard_inspire','Inspire',14,10,'🎺','+55% damage, 5s',P.buff('bDmg',1.55,5)),
  A('bard_lullaby','Lullaby',16,8,'🎵','Slow blast at the target',P.blast(120,1.6,'#c07ad4',2.5),true),
  A('bard_encore','Encore',18,6,'🎶','Note spread',P.fan(5,0.16,700,1.3,'#c07ad4',6,1.1,1)),
  A('bard_ballad','Healing Ballad',16,9,'💗','Heal 40%',P.heal(0.4)),
  A('bard_forte','Fortissimo',18,7,'🎼','Ring of sound',P.whirl(10,1.2,'#c07ad4',480,0.5)),
  A('bard_quickstep','Quickstep',12,6,'💃','Dash, evade',P.dash(170,1,'#c07ad4')),
 ],
 shaman:[
  A('shaman_lavaburst','Lava Burst',22,9,'🌋','Fiery blast at the target',P.blast(130,3,'#e07a2e'),true),
  A('shaman_earthshield','Earth Shield',16,10,'🛡️','Invulnerable 2.5s',P.invuln(2.5)),
  A('shaman_windfury','Windfury',14,10,'🌬️','+55% attack speed, 6s',P.buff('bRof',1.55,6)),
  A('shaman_mendmax','Greater Mend',18,11,'💧','Heal 45%',P.heal(0.45)),
  A('shaman_frostshock','Frost Shock',16,8,'🧊','Slow blast at the target',P.blast(110,2,'#7ab8d4',2.5),true),
  A('shaman_ancestors','Ancestors',22,12,'👻','2 spirits fight, 12s',P.summon('skel',2,0.9,12)),
  A('shaman_stormcloud','Storm Cloud',24,10,'🌩️','Shock ring around you',P.nova(190,2.4,'#7ab8d4')),
 ],
 dragoon:[
  A('dragoon_breath','Dragon Breath',18,7,'🔥','Cone of dragonfire',P.fan(6,0.16,560,1.5,'#e07a2e',7,0.7,1)),
  A('dragoon_spearstorm','Spear Storm',18,7,'🔱','Ring of spears',P.whirl(12,1.4,'#e07a2e',440,0.5)),
  A('dragoon_scale','Dragon Scale',16,10,'🐲','Invulnerable 3s',P.invuln(3)),
  A('dragoon_cry','Battle Cry',14,10,'📣','+55% damage, 5s',P.buff('bDmg',1.55,5)),
  A('dragoon_earthstrike','Earth Strike',20,9,'⛰️','Crater at the target',P.blast(140,2.6,'#e07a2e'),true),
  A('dragoon_windleap','Wind Leap',12,6,'⬆️','Long dash, evade',P.dash(200,1,'#e07a2e')),
  A('dragoon_overdrive','Overdrive',14,10,'⚡','+55% attack speed, 6s',P.buff('bRof',1.55,6)),
 ],
};
for(const _c in _EXTRA){ if(APOOL[_c]) APOOL[_c]=APOOL[_c].concat(_EXTRA[_c]); }

// ----- loadout + cooldown state -----
let armedSlot = 0;
function classPool(cls){ return APOOL[cls]||APOOL.knight; }
function abilById(cls,id){ return classPool(cls).find(a=>a.id===id)||null; }
function defaultLoadout(cls){ const p=classPool(cls); return [p[0]?p[0].id:null,null,null]; }   // start with the 1 free ability
function isUnlocked(cls,id){ return (typeof unlockedAbils==='function') ? unlockedAbils(cls,rpg).has(id) : true; }
function ensureLoadout(){ const ch=curChar(); if(!ch||!rpg) return;
  if(!rpg.loadout || !Array.isArray(rpg.loadout) || rpg.loadout.length!==3) rpg.loadout=defaultLoadout(ch.cls);
  rpg.loadout=rpg.loadout.map(id=>{ if(!id||!abilById(ch.cls,id)) return null; if(!isUnlocked(ch.cls,id)) return null; return id; });
  if(!player.acd) player.acd={};
  if(armedSlot<0||armedSlot>2) armedSlot=0;
}
function armedAbility(){ const ch=curChar(); if(!ch||!rpg||!rpg.loadout) return null; const id=rpg.loadout[armedSlot]; return id?abilById(ch.cls,id):null; }
function armedCost(){ const a=armedAbility(); return a?a.mp:1e9; }
function abilCd(id){ return (player.acd&&player.acd[id])||0; }
function updateAbilCooldowns(dt){ if(!player.acd) return; for(const k in player.acd) player.acd[k]=Math.max(0,player.acd[k]-dt); }

function castArmed(wx,wy){ if(!rpg||!inGame) return; const ch=curChar(); if(!ch) return; ensureLoadout();
  const a=armedAbility();
  if(!a){ texts.push({x:player.x,y:player.y-30,txt:'empty slot',col:'#c9c2b8',life:0.7}); return; }
  if(abilCd(a.id)>0){ texts.push({x:player.x,y:player.y-30,txt:'◷ cooldown',col:'#c9c2b8',life:0.6}); navigator.vibrate&&navigator.vibrate(15); return; }
  if((player.mp||0)<a.mp){ texts.push({x:player.x,y:player.y-30,txt:'◇ low mana',col:'#7ab8d4',life:0.7}); navigator.vibrate&&navigator.vibrate(20); return; }
  player.mp-=a.mp; player.acd[a.id]=a.cd;
  const ctx={ x:(a.ground&&wx!=null)?wx:player.x, y:(a.ground&&wy!=null)?wy:player.y, aim:player.aim||0, AP:player.abilPow||1, dmg:player.dmg, cls:ch.cls };
  const _n0=pShots.length;
  try{ a.cast(ctx); }catch(e){ if(typeof showErr==='function') showErr(e); }
  // tag this cast's projectiles for the forge — every ability has its own projectile look
  for(let i=_n0;i<pShots.length;i++){ if(!pShots[i].pk) pShots[i].pk='a:'+a.id; }
  navigator.vibrate&&navigator.vibrate(50);
}

// ----- HUD: 3 ability buttons (bottom-left), tap to arm -----
function abilBtnRects(){ const out=[];
  if(typeof inputMode!=='undefined' && inputMode==='pc'){
    // PC: MMO-style action bar — a horizontal 1/2/3 row right of the MP orb
    const r=26, gap=12, orbR=Math.round(Math.min(34,W*0.08));
    let x=W/2+orbR*2+40+r; const y=H-r-24;
    for(let s=0;s<3;s++){ out.push({slot:s,x:x,y:y,r:r}); x+=(r*2+gap); }
    return out;
  }
  const r=Math.round(Math.min(30,W*0.075)), gap=10, x=W-16-r;
  let y=H-64-r;                          // touch: right edge, above the bottom HUD button row
  for(let s=0;s<3;s++){ out.push({slot:s,x:x,y:y,r:r}); y-=(r*2+gap); }
  return out; }
function hitAbilButton(sx,sy){ if(!inGame||!rpg||(W<=H&&(typeof inputMode==='undefined'||inputMode!=='pc'))) return -1; const rects=abilBtnRects();
  for(const b of rects){ if(Math.hypot(sx-b.x,sy-b.y)<=b.r+6) return b.slot; } return -1; }
function armSlot(s){ if(s>=0&&s<3){ armedSlot=s; navigator.vibrate&&navigator.vibrate(10); } }

function drawAbilButtons(){ if(!rpg) return; ensureLoadout(); const ch=curChar(); if(!ch) return;
  const rects=abilBtnRects();
  for(const b of rects){ const id=rpg.loadout[b.slot]; const a=id?abilById(ch.cls,id):null;
    ctx.save();
    ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,6.29);
    ctx.fillStyle= a?'rgba(18,14,24,0.82)':'rgba(18,14,24,0.45)'; ctx.fill();
    if(a){ const cd=abilCd(a.id), afford=(player.mp||0)>=a.mp;
      ctx.globalAlpha=(cd>0||!afford)?0.4:1;
      const aim=(typeof abilImg==='function')?abilImg(a.id):null;
      if(aim){ const s=b.r*1.7; ctx.save(); ctx.beginPath(); ctx.arc(b.x,b.y,b.r*0.92,0,6.29); ctx.clip();
        ctx.drawImage(aim,b.x-s/2,b.y-s/2,s,s); ctx.restore(); }
      else { ctx.font=Math.round(b.r*1.05)+'px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(a.icon,b.x,b.y+1); }
      ctx.globalAlpha=1;
      if(cd>0){ const frac=Math.min(1,cd/a.cd);
        ctx.beginPath(); ctx.moveTo(b.x,b.y);
        ctx.arc(b.x,b.y,b.r,-1.5708,-1.5708+6.283*frac,false); ctx.closePath();
        ctx.fillStyle='rgba(0,0,0,0.58)'; ctx.fill();
        ctx.fillStyle='#eee4d4'; ctx.font='bold '+Math.round(b.r*0.72)+'px "Pixelify Sans",monospace';
        ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(Math.ceil(cd),b.x,b.y+1); }
    }
    ctx.lineWidth= (b.slot===armedSlot)?3:2;
    ctx.strokeStyle= (b.slot===armedSlot)?'#ffc94d':'rgba(170,160,185,0.55)';
    ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,6.29); ctx.stroke();
    // PC mode: show the 1/2/3 hotkey on each slot
    if(typeof inputMode!=='undefined' && inputMode==='pc'){
      ctx.font='bold 11px "Pixelify Sans",monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle='rgba(0,0,0,0.85)'; ctx.fillText(''+(b.slot+1),b.x-b.r+7,b.y-b.r+8);
      ctx.fillStyle='#ffd07a'; ctx.fillText(''+(b.slot+1),b.x-b.r+6,b.y-b.r+7); }
    ctx.restore();
  }
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
}

// ----- loadout picker overlay (in-game) -----
let loadSel=0;
function openLoadout(){ const ch=curChar(); if(!ch||!rpg){ return; } ensureLoadout(); loadSel=0;
  let ov=document.getElementById('loadScr');
  if(!ov){ ov=document.createElement('div'); ov.id='loadScr';
    ov.addEventListener('click',_loadClick); document.body.appendChild(ov); }
  ov.style.display='flex'; _loadRender(); }
function closeLoadout(){ const ov=document.getElementById('loadScr'); if(ov) ov.style.display='none'; saveRPG(); }
function _loadClick(ev){ const t=ev.target.closest('[data-act]'); if(!t) return; const act=t.getAttribute('data-act');
  const ch=curChar(); if(!ch) return;
  if(act==='close'){ closeLoadout(); return; }
  if(act==='slot'){ loadSel=+t.getAttribute('data-i'); _loadRender(); return; }
  if(act==='clear'){ rpg.loadout[loadSel]=null; saveRPG(); _loadRender(); return; }
  if(act==='locked'){ navigator.vibrate&&navigator.vibrate(15); return; }
  if(act==='pick'){ const id=t.getAttribute('data-id'); if(!isUnlocked(ch.cls,id)) return;
    // if already slotted elsewhere, pull it out of that slot first
    for(let i=0;i<3;i++) if(rpg.loadout[i]===id) rpg.loadout[i]=null;
    rpg.loadout[loadSel]=id;
    loadSel=(loadSel+1)%3;                      // advance to next slot for quick fill
    saveRPG(); _loadRender(); return; }
}
// emoji sits behind; the ability image (if it exists) covers it, else onerror removes it
function _abilIcHtml(a,emoji){ return emoji+'<img class="ldIcImg" src="assets/abilities/'+a.id+'.png" alt="" onerror="this.remove()">'; }
function _loadRender(){ const ov=document.getElementById('loadScr'); const ch=curChar(); if(!ov||!ch) return;
  const pool=classPool(ch.cls);
  let slots='';
  for(let i=0;i<3;i++){ const a=rpg.loadout[i]?abilById(ch.cls,rpg.loadout[i]):null;
    slots+='<div class="ldSlot'+(i===loadSel?' sel':'')+'" data-act="slot" data-i="'+i+'">'
      +'<div class="ldNum">'+(i+1)+'</div>'
      +'<div class="ldIc">'+(a?_abilIcHtml(a,a.icon):'＋')+'</div>'
      +'<div class="ldNm">'+(a?a.name:'empty')+'</div>'
      +(a?'<div class="ldX" data-act="clear">✕</div>':'')+'</div>'; }
  const unl=(typeof unlockedAbils==='function')?unlockedAbils(ch.cls,rpg):null;
  let cards='', nUnl=0;
  for(const a of pool){ const locked=unl&&!unl.has(a.id); if(!locked) nUnl++;
    const slotIdx=rpg.loadout.indexOf(a.id); const on=slotIdx>=0;
    cards+='<div class="ldCard'+(on?' on':'')+(locked?' locked':'')+'" '+(locked?'data-act="locked"':('data-act="pick" data-id="'+a.id+'"'))+'>'
      +'<div class="ldCic">'+(locked?'🔒':_abilIcHtml(a,a.icon))+'</div>'
      +'<div class="ldCbody"><div class="ldCn">'+a.name+(on?' <span class="ldTag">'+(slotIdx+1)+'</span>':'')+'</div>'
      +'<div class="ldCd">'+(locked?'Locked — unlock in the skill tree (🌟).':a.desc)+'</div>'
      +'<div class="ldCm">'+a.mp+' MP · '+a.cd+'s'+(a.ground?' · aimed':'')+'</div></div></div>'; }
  const cc=CLASSES[Math.max(0,CLASSES.findIndex(x=>x.id===ch.cls))];
  ov.innerHTML='<div class="ldWrap">'
    +'<button class="tabX" data-act="close" aria-label="Close">✕</button>'
    +'<div class="ldTitle">ABILITIES · '+(cc?cc.n:ch.cls)+'</div>'
    +'<div class="ldHint">'+nUnl+' of '+pool.length+' unlocked · tap a slot then an ability. Unlock more in the skill tree (🌟).</div>'
    +'<div class="ldSlots">'+slots+'</div>'
    +'<div class="ldGrid">'+cards+'</div>'
    +'</div>';
}
