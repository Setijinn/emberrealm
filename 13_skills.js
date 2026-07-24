// ---------- skill trees + ascension ----------
// Scarce points (1 per 2 levels): total earned at level L = floor(L/2).
// Trees cost more than you can fully buy -> specialize. Respec refunds all.
// Tree ends in an ASCENSION: choose 1 of 3 subclasses (higher-tier form).
//
// Node eff keys feed recalcStats() via treeStats(rpg):
//   flat stats: atk def hp mp spd dex wis vit
//   player flags: crit(+chance) ls(lifesteal) thorns(reflect) dr(dmg reduction)
//                 rof(fire-rate mult add) cleave(pierce+1) hpPct atkPct
// Keystones set flags the combat/render code reads.

// Bump whenever node IDs/meanings change: every save is refunded to a clean slate on load,
// because rewritten trees would otherwise leave points stranded on ids that no longer exist.
const TREE_VER=2;
function perkTotalFor(lvl){ return Math.floor((lvl||1)/2); }        // total points earned by level
function xpTreeInit(rpg){
  if(rpg.perkEarned===undefined) rpg.perkEarned=0;
  if(rpg.perkPts===undefined) rpg.perkPts=0;
  if(!rpg.tree) rpg.tree={};                 // nodeId -> ranks
  if(rpg.ascension===undefined) rpg.ascension=null;
  if(rpg.treeVer!==TREE_VER){                // full refund from level (points = floor(lvl/2))
    const had=Object.keys(rpg.tree).length;
    rpg.tree={}; rpg.perkEarned=rpg.perkPts=perkTotalFor(rpg.lvl);   // ascension is kept
    rpg.treeVer=TREE_VER;
    if(had&&typeof msg==='function') msg('PERKS REFUNDED','the skill trees were rebuilt');
  }
}
// award points to catch up to the level (called after level ups)
function grantPerkPoints(rpg){ xpTreeInit(rpg);
  const total=perkTotalFor(rpg.lvl);
  if(total>rpg.perkEarned){ rpg.perkPts+=(total-rpg.perkEarned); rpg.perkEarned=total; }
}

// ----- tree data. Each class: {branches:[{key,name,color,nodes:[...]}], ascend:[{...}x3]} -----
// node: {id,name,desc,cost,max,req,eff}  (req = array of prerequisite node ids; eff per-rank)
const CLASS_TREE = {
 // ===== KNIGHT — resource: DEFIANCE (builds when you are hurt, bleeds off out of combat).
 // Identity: a wall that CONVERTS damage taken into offence. Shockwaves (tag 'shock') are
 // the class's chain currency — Retaliate throws them, Unbreakable Oath and Last Bastion
 // both feed off them.
 knight: {
  branches: [
   { key:'bulwark', name:'Bulwark', color:'#7d8a99', nodes:[
     {id:'k_b1', name:'Iron Skin', desc:'+7 DEF and +5 VIT per rank', cost:1, max:3, req:[], eff:{def:7,vit:5}},
     {id:'k_b2', name:'Defiant Stand', desc:'Below 50% HP, take 9% less damage per rank', cost:2, max:2, req:['k_b1'],
      cond:{when:'lowHp',v:0.50,eff:{dr:0.09}}},
     {id:'k_b3', name:'Retaliate', desc:'Being hurt looses a shockwave — 70% ATK around you (0.9s)', cost:2, max:1, req:['k_b1'],
      trig:{on:'hurt',icd:0.9,do:{dmgNearby:{r:100,pct:0.7,col:'#c9d2da'}},emits:'shock'}},
     {id:'k_b4', name:'Aegis', desc:'At full Defiance, spend 60 for a shield worth 15% max HP', cost:2, max:2, req:['k_b2'],
      trig:{on:'resFull',do:{shield:{pct:0.15},res:{n:-60,perRank:false},text:'AEGIS'}}},
     {id:'k_b5', name:'Unbreakable Oath', desc:'Keystone: +16 DEF, +10% HP. Your shockwaves stun (0.4s) and return 8 Defiance',
      cost:3, max:1, req:['k_b3','k_b4'], eff:{def:16,hpPct:0.10},
      trig:{on:'proc',filter:{tag:'shock'},do:{status:{r:120,id:'stun',dur:0.4},res:{n:8}}}},
   ]},
   { key:'vanguard', name:'Vanguard', color:'#6aae7a', nodes:[
     {id:'k_v1', name:'Footwork', desc:'+6% move speed and +3 DEX per rank', cost:1, max:3, req:[], eff:{spd:0.06,dex:3}},
     {id:'k_v2', name:'Shield Charge', desc:'Your dashing abilities shove foes back and stun them 0.6s', cost:2, max:1, req:['k_v1'],
      mod:{kind:'dash',do:{status:{r:110,id:'stun',dur:0.6},knock:{r:110,v:52}}}},
     {id:'k_v3', name:'Warpath', desc:'After any cast, +25% attack speed for 3s', cost:2, max:2, req:['k_v1'],
      trig:{on:'cast',do:{buff:{f:'bRof',m:1.25,dur:3,col:'#c9d2da'}},perRank:false}},
     {id:'k_v4', name:'Banner of the Line', desc:'Casting plants a war banner: 6s ground that grinds foes and steadies you', cost:2, max:1, req:['k_v3'],
      trig:{on:'cast',icd:6,do:{zone:{r:110,life:6,dmgPct:0.16,col:'#d4b96a'}}}},
     {id:'k_v5', name:'Onward', desc:'Keystone: while moving, +12% attack speed and +8% move speed', cost:3, max:1, req:['k_v2','k_v4'],
      cond:{when:'moving',eff:{rof:0.12,spd:0.08}}},
   ]},
   { key:'onslaught', name:'Onslaught', color:'#c0504a', nodes:[
     {id:'k_o1', name:'Sharpened', desc:'+5 ATK per rank', cost:1, max:3, req:[], eff:{atk:5}},
     {id:'k_o2', name:'Punish', desc:'For 3s after being hurt, +13% damage per rank', cost:2, max:2, req:['k_o1'],
      cond:{when:'recentHurt',eff:{atkPct:0.13}}},
     {id:'k_o3', name:'Guard Break', desc:'Your crits leave foes weakened (deal 30% less) for 2.5s', cost:2, max:1, req:['k_o1'],
      trig:{on:'crit',do:{status:{id:'weak',dur:2.5}}}},
     {id:'k_o4', name:'Defiant Might', desc:'+1.5% damage per 10 Defiance, per rank', cost:2, max:2, req:['k_o2'],
      cond:{when:'resScale',per:10,eff:{atkPct:0.015}}},
     {id:'k_o5', name:'Last Bastion', desc:'Keystone: below 35% HP, being hurt looses a GREATER shockwave (110% ATK) and heals you 5%',
      cost:3, max:1, req:['k_o3','k_o4'], ifOwn:'k_b3',
      trig:{on:'hurt',when:{when:'lowHp',v:0.35},icd:1.2,
            do:{dmgNearby:{r:140,pct:1.1,col:'#ffd07a'},heal:{pct:0.05}},emits:'shock'}},
   ]},
  ],
  ascend: [
   {id:'templar',name:'Templar',color:'#d4b96a',desc:'Holy bulwark. +25% HP, +20 DEF, take 10% less damage. Capstone: a radiant aura heals you 3 hp/s.',eff:{hpPct:0.25,def:20,dr:0.10,auraHeal:3}},
   {id:'warlord',name:'Warlord',color:'#c0392b',desc:'Relentless attacker. +14 ATK, +15% crit, +10% attack speed. Capstone: strikes cleave through foes.',eff:{atk:14,crit:0.15,rof:0.10,cleave:1}},
   {id:'sentinel',name:'Sentinel',color:'#5a7a9c',desc:'Immovable guardian. +18% HP, +14 DEF, reflect 40% melee, +10% move. Capstone: hold the line.',eff:{hpPct:0.18,def:14,thorns:0.40,spd:0.10}},
  ],
 },
 ranger:{ branches:[
  {key:'marksman',name:'Marksman',color:'#e8b34b',nodes:[
   {id:'r_m1',name:'Keen Eye',desc:'+3 DEX per rank',cost:1,max:3,req:[],eff:{dex:3}},
   {id:'r_m2',name:'Deadeye',desc:'+5% crit per rank',cost:2,max:2,req:['r_m1'],eff:{crit:0.05}},
   {id:'r_m3',name:'Piercing Arrows',desc:'Keystone: arrows pierce +1',cost:3,max:1,req:['r_m1'],eff:{pierce:1}},
   {id:'r_m4',name:'Heartseeker',desc:'+25% crit damage',cost:2,max:1,req:['r_m2'],eff:{critMult:0.25}},
   {id:'r_m5',name:'Killshot',desc:'Keystone: +8% crit, +30% crit damage',cost:3,max:1,req:['r_m2','r_m4'],eff:{crit:0.08,critMult:0.30}},
  ]},
  {key:'trailblazer',name:'Trailblazer',color:'#6aae7a',nodes:[
   {id:'r_t1',name:'Fleet',desc:'+5% move speed per rank',cost:1,max:3,req:[],eff:{spd:0.05}},
   {id:'r_t2',name:'Hardy',desc:'+8% max HP per rank',cost:2,max:2,req:['r_t1'],eff:{hpPct:0.08}},
   {id:'r_t3',name:'Swift Draw',desc:'+8% attack speed per rank',cost:2,max:2,req:['r_t1'],eff:{rof:0.08}},
   {id:'r_t4',name:'Evasion',desc:'Keystone: take 10% less damage',cost:3,max:1,req:['r_t2'],eff:{dr:0.10}},
   {id:'r_t5',name:'Windstep',desc:'Keystone: +10% move, +12% attack speed',cost:3,max:1,req:['r_t3','r_t4'],eff:{spd:0.10,rof:0.12}},
  ]},
  {key:'barrage',name:'Barrage',color:'#c0504a',nodes:[
   {id:'r_b1',name:'Sharpshot',desc:'+4 ATK per rank',cost:1,max:3,req:[],eff:{atk:4}},
   {id:'r_b2',name:'Quickbow',desc:'+8% attack speed per rank',cost:2,max:2,req:['r_b1'],eff:{rof:0.08}},
   {id:'r_b3',name:'Heavy Draw',desc:'Keystone: +12% damage',cost:3,max:1,req:['r_b1'],eff:{atkPct:0.12}},
   {id:'r_b4',name:'Barbed',desc:'+8% damage',cost:2,max:1,req:['r_b2'],eff:{atkPct:0.08}},
   {id:'r_b5',name:'Storm of Arrows',desc:'Keystone: +14% damage, +8% attack speed',cost:3,max:1,req:['r_b3','r_b4'],eff:{atkPct:0.14,rof:0.08}},
  ]}],
  ascend:[
   {id:'sharpshooter',name:'Sharpshooter',color:'#e8b34b',desc:'Precision incarnate. +12% crit, +50% crit damage, +1 pierce. Capstone: crits pierce everything.',eff:{crit:0.12,critMult:0.50,pierce:1,critPierce:1}},
   {id:'windranger',name:'Windranger',color:'#6aae7a',desc:'Never stops moving. +18% move, +18% attack speed, +12% HP. Capstone: dashes make you untouchable.',eff:{spd:0.18,rof:0.18,hpPct:0.12,dashInv:1}},
   {id:'tempest_r',name:'Tempest',color:'#c0504a',desc:'A hail of death. +16% damage, +14% attack speed, +1 pierce. Capstone: every shot forks on hit.',eff:{atkPct:0.16,rof:0.14,pierce:1,fork:1}},
  ]},
 pyro:{ branches:[
  {key:'pyromancy',name:'Pyromancy',color:'#e07a2e',nodes:[
   {id:'p_p1',name:'Kindle',desc:'+6% ability power per rank',cost:1,max:3,req:[],eff:{abilPow:0.06}},
   {id:'p_p2',name:'Attunement',desc:'+5 WIS per rank',cost:2,max:2,req:['p_p1'],eff:{wis:5}},
   {id:'p_p3',name:'Conflagration',desc:'Keystone: +18% ability power',cost:3,max:1,req:['p_p1'],eff:{abilPow:0.18}},
   {id:'p_p4',name:'Ember Font',desc:'+2 mana regen',cost:2,max:1,req:['p_p2'],eff:{mpregen:2}},
   {id:'p_p5',name:'Immolation',desc:'Keystone: +20% ability power, +6 WIS',cost:3,max:1,req:['p_p3','p_p4'],eff:{abilPow:0.20,wis:6}},
  ]},
  {key:'cinders',name:'Cinders',color:'#c0504a',nodes:[
   {id:'p_c1',name:'Scorch',desc:'+5 ATK per rank',cost:1,max:3,req:[],eff:{atk:5}},
   {id:'p_c2',name:'Searing',desc:'+8% attack speed per rank',cost:2,max:2,req:['p_c1'],eff:{rof:0.08}},
   {id:'p_c3',name:'Blue Heat',desc:'Keystone: +12% damage',cost:3,max:1,req:['p_c1'],eff:{atkPct:0.12}},
   {id:'p_c4',name:'Burning Aim',desc:'+5% crit',cost:2,max:1,req:['p_c2'],eff:{crit:0.05}},
   {id:'p_c5',name:'Firestorm',desc:'Keystone: +12% damage, +8% attack speed',cost:3,max:1,req:['p_c3','p_c4'],eff:{atkPct:0.12,rof:0.08}},
  ]},
  {key:'ashwarden',name:'Ashwarden',color:'#7d8a99',nodes:[
   {id:'p_a1',name:'Emberskin',desc:'+6 DEF per rank',cost:1,max:3,req:[],eff:{def:6}},
   {id:'p_a2',name:'Warmth',desc:'+8% max HP per rank',cost:2,max:2,req:['p_a1'],eff:{hpPct:0.08}},
   {id:'p_a3',name:'Cinder Ward',desc:'Keystone: take 10% less damage',cost:3,max:1,req:['p_a2'],eff:{dr:0.10}},
   {id:'p_a4',name:'Mana Shield',desc:'+25 max MP',cost:2,max:1,req:['p_a1'],eff:{mp:25}},
   {id:'p_a5',name:'Phoenix Heart',desc:'Keystone: +12% HP, +2 regen',cost:3,max:1,req:['p_a3'],eff:{hpPct:0.12,regen:2}},
  ]}],
  ascend:[
   {id:'infernomancer',name:'Infernomancer',color:'#e07a2e',desc:'+30% ability power, +8 WIS, +3 mana regen. Capstone: spells scorch the ground they touch.',eff:{abilPow:0.30,wis:8,mpregen:3,groundFire:1}},
   {id:'emberlord',name:'Emberlord',color:'#c0504a',desc:'+18% damage, +12% attack speed, +6% crit. Capstone: auto-shots explode.',eff:{atkPct:0.18,rof:0.12,crit:0.06,splash:0.45}},
   {id:'cinderguard',name:'Cinderguard',color:'#7d8a99',desc:'+16% HP, +14 DEF, take 10% less damage. Capstone: attackers burn on your thorns.',eff:{hpPct:0.16,def:14,dr:0.10,thorns:0.30}},
  ]},
 rogue:{ branches:[
  {key:'assassinate',name:'Assassinate',color:'#c0304a',nodes:[
   {id:'ro_a1',name:'Sharpen',desc:'+4 ATK per rank',cost:1,max:3,req:[],eff:{atk:4}},
   {id:'ro_a2',name:'Lethality',desc:'+6% crit per rank',cost:2,max:2,req:['ro_a1'],eff:{crit:0.06}},
   {id:'ro_a3',name:'Backstab',desc:'+30% crit damage per rank',cost:2,max:2,req:['ro_a1'],eff:{critMult:0.30}},
   {id:'ro_a4',name:'Exploit',desc:'Keystone: attacks pierce +1',cost:3,max:1,req:['ro_a2'],eff:{pierce:1}},
   {id:'ro_a5',name:'Assassinate',desc:'Keystone: +8% crit, +40% crit damage',cost:3,max:1,req:['ro_a2','ro_a3'],eff:{crit:0.08,critMult:0.40}},
  ]},
  {key:'shadow',name:'Shadow',color:'#8a5ac0',nodes:[
   {id:'ro_s1',name:'Nimble',desc:'+5% move speed per rank',cost:1,max:3,req:[],eff:{spd:0.05}},
   {id:'ro_s2',name:'Evasive',desc:'take 6% less damage per rank',cost:2,max:2,req:['ro_s1'],eff:{dr:0.06}},
   {id:'ro_s3',name:'Vanish',desc:'Keystone: +12% move, +6% dodge',cost:3,max:1,req:['ro_s1'],eff:{spd:0.12,dr:0.06}},
   {id:'ro_s4',name:'Cutpurse',desc:'+6 FORTUNE',cost:2,max:1,req:['ro_s1'],eff:{fort:6}},
   {id:'ro_s5',name:'Shadowdance',desc:'Keystone: +10% attack speed, +8% move',cost:3,max:1,req:['ro_s2','ro_s3'],eff:{rof:0.10,spd:0.08}},
  ]},
  {key:'bloodletter',name:'Bloodletter',color:'#6aae7a',nodes:[
   {id:'ro_b1',name:'Flurry',desc:'+6% attack speed per rank',cost:1,max:2,req:[],eff:{rof:0.06}},
   {id:'ro_b2',name:'Bloodthirst',desc:'Heal 4% of damage dealt',cost:2,max:1,req:['ro_b1'],eff:{ls:0.04}},
   {id:'ro_b3',name:'Frenzy',desc:'+8% attack speed',cost:2,max:1,req:['ro_b1'],eff:{rof:0.08}},
   {id:'ro_b4',name:'Vital',desc:'+8% max HP per rank',cost:2,max:2,req:[],eff:{hpPct:0.08}},
   {id:'ro_b5',name:'Massacre',desc:'Keystone: +6% lifesteal, +8% attack speed',cost:3,max:1,req:['ro_b2','ro_b3'],eff:{ls:0.06,rof:0.08}},
  ]}],
  ascend:[
   {id:'deathblade',name:'Deathblade',color:'#c0304a',desc:'+12% crit, +50% crit damage, +1 pierce. Capstone: crits hasten your cooldowns.',eff:{crit:0.12,critMult:0.50,pierce:1,critDashCd:1}},
   {id:'nightblade',name:'Nightblade',color:'#8a5ac0',desc:'+16% move, take 12% less damage, +10% attack speed. Capstone: vanish for a breath when hurt.',eff:{spd:0.16,dr:0.12,rof:0.10,vanishHurt:1}},
   {id:'reaper',name:'Reaper',color:'#6aae7a',desc:'+10% lifesteal, +12% attack speed, +10% HP. Capstone: kills restore 20% HP.',eff:{ls:0.10,rof:0.12,hpPct:0.10,killHeal:0.20}},
  ]},
 assassin:{ branches:[
  {key:'malice',name:'Malice',color:'#c0304a',nodes:[
   {id:'as_m1',name:'Whetstone',desc:'+4 ATK per rank',cost:1,max:3,req:[],eff:{atk:4}},
   {id:'as_m2',name:'Ruthless',desc:'+30% crit damage per rank',cost:2,max:2,req:['as_m1'],eff:{critMult:0.30}},
   {id:'as_m3',name:'Precision',desc:'+6% crit per rank',cost:2,max:2,req:['as_m1'],eff:{crit:0.06}},
   {id:'as_m4',name:'Rupture',desc:'Keystone: attacks pierce +1',cost:3,max:1,req:['as_m2'],eff:{pierce:1}},
   {id:'as_m5',name:'Deathmark',desc:'Keystone: +6% crit, +50% crit damage',cost:3,max:1,req:['as_m2','as_m3'],eff:{crit:0.06,critMult:0.50}},
  ]},
  {key:'venom',name:'Venom',color:'#6aae7a',nodes:[
   {id:'as_v1',name:'Deft',desc:'+3 DEX per rank',cost:1,max:3,req:[],eff:{dex:3}},
   {id:'as_v2',name:'Toxic Blades',desc:'Keystone: attacks slow foes',cost:2,max:1,req:['as_v1'],eff:{slow:1}},
   {id:'as_v3',name:'Swift Kill',desc:'+8% attack speed per rank',cost:2,max:2,req:['as_v1'],eff:{rof:0.08}},
   {id:'as_v4',name:'Lifedrain',desc:'Heal 5% of damage dealt',cost:2,max:1,req:['as_v2'],eff:{ls:0.05}},
   {id:'as_v5',name:'Plague',desc:'Keystone: hits poison foes',cost:3,max:1,req:['as_v3','as_v4'],eff:{poisonHit:0.6,rof:0.08}},
  ]},
  {key:'evasion',name:'Evasion',color:'#8a5ac0',nodes:[
   {id:'as_e1',name:'Lithe',desc:'+5% move speed per rank',cost:1,max:3,req:[],eff:{spd:0.05}},
   {id:'as_e2',name:'Toughened',desc:'+8% max HP per rank',cost:2,max:2,req:['as_e1'],eff:{hpPct:0.08}},
   {id:'as_e3',name:'Slippery',desc:'take 8% less damage per rank',cost:2,max:2,req:['as_e1'],eff:{dr:0.08}},
   {id:'as_e4',name:'Blur',desc:'Keystone: +12% move speed',cost:3,max:1,req:['as_e2'],eff:{spd:0.12}},
   {id:'as_e5',name:'Phantom',desc:'Keystone: take 12% less damage, +8% move',cost:3,max:1,req:['as_e3','as_e4'],eff:{dr:0.12,spd:0.08}},
  ]}],
  ascend:[
   {id:'nightshade',name:'Nightshade',color:'#6aae7a',desc:'+8% lifesteal, chilling shots, +1 pierce. Capstone: toxins leap to a nearby foe.',eff:{ls:0.08,slow:1,pierce:1,chainHit:0.5}},
   {id:'executioner_a',name:'Executioner',color:'#c0304a',desc:'+12% crit, +70% crit damage. Capstone: foes below 15% HP take triple damage.',eff:{crit:0.12,critMult:0.70,execute:2}},
   {id:'phantom_a',name:'Phantom',color:'#8a5ac0',desc:'+16% move, take 14% less damage, +10% attack speed. Capstone: kills make you briefly untouchable.',eff:{spd:0.16,dr:0.14,rof:0.10,killInv:1}},
  ]},
 cleric:{ branches:[
  {key:'devotion',name:'Devotion',color:'#d4b96a',nodes:[
   {id:'cl_d1',name:'Faith',desc:'+5 WIS per rank',cost:1,max:3,req:[],eff:{wis:5}},
   {id:'cl_d2',name:'Renewal',desc:'+2 regen per rank',cost:2,max:2,req:['cl_d1'],eff:{regen:2}},
   {id:'cl_d3',name:'Blessing',desc:'Keystone: +18% ability power',cost:3,max:1,req:['cl_d1'],eff:{abilPow:0.18}},
   {id:'cl_d4',name:'Spirit Well',desc:'+25 max MP',cost:2,max:1,req:['cl_d1'],eff:{mp:25}},
   {id:'cl_d5',name:'Sanctify',desc:'Keystone: +12% HP, +3 regen',cost:3,max:1,req:['cl_d2','cl_d3'],eff:{hpPct:0.12,regen:3}},
  ]},
  {key:'radiance',name:'Radiance',color:'#e8b34b',nodes:[
   {id:'cl_r1',name:'Smite',desc:'+4 ATK per rank',cost:1,max:3,req:[],eff:{atk:4}},
   {id:'cl_r2',name:'Holy Light',desc:'+8% ability power per rank',cost:2,max:2,req:['cl_r1'],eff:{abilPow:0.08}},
   {id:'cl_r3',name:'Dawnray',desc:'Keystone: +15% ability power',cost:3,max:1,req:['cl_r1'],eff:{abilPow:0.15}},
   {id:'cl_r4',name:'Judgment',desc:'+6% crit',cost:2,max:1,req:['cl_r2'],eff:{crit:0.06}},
   {id:'cl_r5',name:'Wrath',desc:'Keystone: +14% damage, +10% ability power',cost:3,max:1,req:['cl_r3','cl_r4'],eff:{atkPct:0.14,abilPow:0.10}},
  ]},
  {key:'sanctuary',name:'Sanctuary',color:'#7d8a99',nodes:[
   {id:'cl_s1',name:'Aegis',desc:'+6 DEF per rank',cost:1,max:3,req:[],eff:{def:6}},
   {id:'cl_s2',name:'Fortitude',desc:'+8% max HP per rank',cost:2,max:2,req:['cl_s1'],eff:{hpPct:0.08}},
   {id:'cl_s3',name:'Ward',desc:'Keystone: take 12% less damage',cost:3,max:1,req:['cl_s2'],eff:{dr:0.12}},
   {id:'cl_s4',name:'Retribution',desc:'reflect 20% melee damage',cost:2,max:1,req:['cl_s1'],eff:{thorns:0.20}},
   {id:'cl_s5',name:'Bastion',desc:'Keystone: +14% HP, +12 DEF',cost:3,max:1,req:['cl_s3'],eff:{hpPct:0.14,def:12}},
  ]}],
  ascend:[
   {id:'bishop',name:'Bishop',color:'#d4b96a',desc:'+26% ability power, +8 WIS, +3 mana regen. Capstone: healing past full becomes a shield.',eff:{abilPow:0.26,wis:8,mpregen:3,overshield:1}},
   {id:'inquisitor',name:'Inquisitor',color:'#e8b34b',desc:'+18% damage, +10% crit, +1 pierce. Capstone: bolts scorch (burn over 3s).',eff:{atkPct:0.18,crit:0.10,pierce:1,burnHit:0.5}},
   {id:'warden_c',name:'Warden',color:'#7d8a99',desc:'+18% HP, +16 DEF, take 12% less damage. Capstone: overflowing heals ward you.',eff:{hpPct:0.18,def:16,dr:0.12,overshield:1}},
  ]},
 // ===== BERSERKER — resource: RAGE (builds on hits AND on being hurt, bleeds off fast).
 // Identity: risk/reward — the lower your HP and the higher your Rage, the harder you hit.
 // Frenzy (tag 'frenzy') and blood bursts (tag 'blood') are the chain currencies.
 berserker:{ branches:[
  {key:'fury',name:'Fury',color:'#c0504a',nodes:[
   {id:'be_f1',name:'Brutality',desc:'+6 ATK per rank',cost:1,max:3,req:[],eff:{atk:6}},
   {id:'be_f2',name:'Bloodfury',desc:'+2.5% damage per 10 Rage, per rank',cost:2,max:2,req:['be_f1'],
    cond:{when:'resScale',per:10,eff:{atkPct:0.025}}},
   {id:'be_f3',name:'Reckless Swing',desc:'Surrounded (3+ foes): +6% crit per rank — but take 4% more damage',cost:2,max:2,req:['be_f1'],
    cond:{when:'nearFoes',n:3,r:190,eff:{crit:0.06,dr:-0.04}}},
   {id:'be_f4',name:'Frenzy',desc:'At full Rage: spend it all for 6s of +50% attack speed',cost:3,max:1,req:['be_f2'],
    trig:{on:'resFull',do:{buff:{f:'bRof',m:1.5,dur:6,col:'#e2604c'},res:{n:-100,perRank:false},text:'FRENZY!'},emits:'frenzy'}},
   {id:'be_f5',name:'Rampage',desc:'Keystone: kills stack Rampage (+4% damage each, 5 max, 6s) and return 9 Rage',cost:3,max:1,req:['be_f3','be_f4'],
    trig:{on:'kill',do:{stack:{id:'ramp',n:1,max:5,dur:6},res:{n:9}}},
    cond:{when:'stacks',id:'ramp',per:1,eff:{atkPct:0.04}}},
  ]},
  {key:'bloodrage',name:'Bloodrage',color:'#8a5ac0',nodes:[
   {id:'be_b1',name:'Thick Hide',desc:'+6 VIT and +5 DEF per rank',cost:1,max:3,req:[],eff:{vit:6,def:5}},
   {id:'be_b2',name:'Bloodbath',desc:'Below half HP, heal 8% of all damage you deal, per rank',cost:2,max:2,req:['be_b1'],
    cond:{when:'lowHp',v:0.50,eff:{ls:0.08}}},
   {id:'be_b3',name:'Reprisal',desc:'Being hurt sprays blood — foes within 140 bleed for 3s (1s)',cost:2,max:1,req:['be_b1'],
    trig:{on:'hurt',icd:1.0,do:{status:{r:140,id:'bleed',dur:3,val:2},res:{n:6}},emits:'blood'}},
   {id:'be_b4',name:'Blood Feast',desc:'Kills heal 5% max HP and feed 5 Rage, per rank',cost:2,max:2,req:['be_b2'],
    trig:{on:'kill',do:{heal:{pct:0.05},res:{n:5}}}},
   {id:'be_b5',name:'Undying',desc:'Keystone: below 30% HP take 18% less damage; every blood spray heals you 3%',cost:3,max:1,req:['be_b3','be_b4'],
    cond:{when:'lowHp',v:0.30,eff:{dr:0.18,ls:0.05}},
    trig:{on:'proc',filter:{tag:'blood'},do:{heal:{pct:0.03}}}},
  ]},
  {key:'warpath',name:'Warpath',color:'#e07a2e',nodes:[
   {id:'be_w1',name:'Longstride',desc:'+6% move speed and +4 ATK per rank',cost:1,max:3,req:[],eff:{spd:0.06,atk:4}},
   {id:'be_w2',name:'Unstoppable',desc:'Above 60% Rage: +9% move speed and take 5% less damage, per rank',cost:2,max:2,req:['be_w1'],
    cond:{when:'resAbove',v:0.60,eff:{spd:0.09,dr:0.05}}},
   {id:'be_w3',name:'Quake Step',desc:'Your leaps and dashes crater the ground — 90% ATK and a shove',cost:2,max:1,req:['be_w1'],
    mod:{kind:'dash',do:{dmgNearby:{r:120,pct:0.9,col:'#e07a2e'},knock:{r:120,v:58}}}},
   {id:'be_w4',name:'Warcry',desc:'Casting terrifies foes within 200 (deal 30% less, 3s) and builds 12 Rage (4s)',cost:2,max:1,req:['be_w2'],
    trig:{on:'cast',icd:4,do:{status:{r:200,id:'weak',dur:3},res:{n:12}}}},
   {id:'be_w5',name:'Endless Rage',desc:'Keystone: when Frenzy erupts it blasts everything around you (140% ATK) and adds +35% damage for 6s',
    cost:3,max:1,req:['be_w3','be_w4'],ifOwn:'be_f4',
    trig:{on:'proc',filter:{tag:'frenzy'},do:{dmgNearby:{r:170,pct:1.4,col:'#e2604c'},buff:{f:'bDmg',m:1.35,dur:6}}}},
  ]}],
  ascend:[
   {id:'ravager',name:'Ravager',color:'#c0504a',desc:'+16 ATK, cleave +2, +10% crit. Capstone: hits arc to a nearby foe.',eff:{atk:16,cleave:2,crit:0.10,chainHit:0.5}},
   {id:'bloodlord',name:'Bloodlord',color:'#8a5ac0',desc:'+12% lifesteal, +20% HP, +3 regen. Capstone: overheal erupts as damage.',eff:{ls:0.12,hpPct:0.20,regen:3,bloodNova:1}},
   {id:'juggernaut',name:'Juggernaut',color:'#e07a2e',desc:'+14% move, +16% attack speed, +14 DEF. Capstone: unstoppable — 8% less damage while moving.',eff:{spd:0.14,rof:0.16,def:14,moveDr:0.08}},
  ]},
 warlock:{ branches:[
  {key:'affliction',name:'Affliction',color:'#8a5ac0',nodes:[
   {id:'wa_a1',name:'Dark Pact',desc:'+5 WIS per rank',cost:1,max:3,req:[],eff:{wis:5}},
   {id:'wa_a2',name:'Corruption',desc:'+8% ability power per rank',cost:2,max:2,req:['wa_a1'],eff:{abilPow:0.08}},
   {id:'wa_a3',name:'Siphon',desc:'Keystone: heal 5% of damage dealt',cost:3,max:1,req:['wa_a1'],eff:{ls:0.05}},
   {id:'wa_a4',name:'Soul Font',desc:'+2 mana regen',cost:2,max:1,req:['wa_a2'],eff:{mpregen:2}},
   {id:'wa_a5',name:'Malefic',desc:'Keystone: +18% ability power, +6% lifesteal',cost:3,max:1,req:['wa_a3','wa_a4'],eff:{abilPow:0.18,ls:0.06}},
  ]},
  {key:'shadowbolt',name:'Shadowbolt',color:'#c0304a',nodes:[
   {id:'wa_s1',name:'Malice',desc:'+4 ATK per rank',cost:1,max:3,req:[],eff:{atk:4}},
   {id:'wa_s2',name:'Penetration',desc:'Keystone: bolts pierce +1',cost:3,max:1,req:['wa_s1'],eff:{pierce:1}},
   {id:'wa_s3',name:'Cruelty',desc:'+6% crit per rank',cost:2,max:2,req:['wa_s1'],eff:{crit:0.06}},
   {id:'wa_s4',name:'Empower',desc:'+8% damage per rank',cost:2,max:2,req:['wa_s2'],eff:{atkPct:0.08}},
   {id:'wa_s5',name:'Annihilate',desc:'Keystone: bolts pierce +1, +12% damage',cost:3,max:1,req:['wa_s3','wa_s4'],eff:{pierce:1,atkPct:0.12}},
  ]},
  {key:'soulward',name:'Soulward',color:'#7d8a99',nodes:[
   {id:'wa_w1',name:'Warding',desc:'+8% max HP per rank',cost:1,max:3,req:[],eff:{hpPct:0.08}},
   {id:'wa_w2',name:'Bulwark',desc:'+5 DEF per rank',cost:2,max:2,req:['wa_w1'],eff:{def:5}},
   {id:'wa_w3',name:'Mana Font',desc:'Keystone: +25 MP, +2 mana regen',cost:3,max:1,req:['wa_w1'],eff:{mp:25,mpregen:2}},
   {id:'wa_w4',name:'Pain Link',desc:'reflect 20% melee damage',cost:2,max:1,req:['wa_w2'],eff:{thorns:0.20}},
   {id:'wa_w5',name:'Dread Ward',desc:'Keystone: +12% HP, take 8% less damage',cost:3,max:1,req:['wa_w3','wa_w4'],eff:{hpPct:0.12,dr:0.08}},
  ]}],
  ascend:[
   {id:'soulflayer',name:'Soulflayer',color:'#8a5ac0',desc:'+26% ability power, +10% lifesteal, +8 WIS. Capstone: drain past full becomes a shield.',eff:{abilPow:0.26,ls:0.10,wis:8,overshield:1}},
   {id:'doomcaller',name:'Doomcaller',color:'#c0304a',desc:'+2 pierce, +16% damage, +10% crit. Capstone: bolts curse (+15% damage taken).',eff:{pierce:2,atkPct:0.16,crit:0.10,curse:0.15}},
   {id:'dreadlord',name:'Dreadlord',color:'#7d8a99',desc:'+18% HP, reflect 40% melee, +14 DEF. Capstone: pain shared with all who touch you.',eff:{hpPct:0.18,thorns:0.40,def:14}},
  ]},
 frost:{ branches:[
  {key:'frostbite',name:'Frostbite',color:'#5a9cc0',nodes:[
   {id:'fr_f1',name:'Rime',desc:'+5 WIS per rank',cost:1,max:3,req:[],eff:{wis:5}},
   {id:'fr_f2',name:'Deep Chill',desc:'Keystone: attacks slow foes',cost:2,max:1,req:['fr_f1'],eff:{slow:1}},
   {id:'fr_f3',name:'Frost Power',desc:'Keystone: +18% ability power',cost:3,max:1,req:['fr_f1'],eff:{abilPow:0.18}},
   {id:'fr_f4',name:'Ice Font',desc:'+2 mana regen',cost:2,max:1,req:['fr_f2'],eff:{mpregen:2}},
   {id:'fr_f5',name:'Absolute Zero',desc:'Keystone: +20% ability power, +6 WIS',cost:3,max:1,req:['fr_f3','fr_f4'],eff:{abilPow:0.20,wis:6}},
  ]},
  {key:'glacier',name:'Glacier',color:'#7d8a99',nodes:[
   {id:'fr_g1',name:'Frost Armor',desc:'+6 DEF per rank',cost:1,max:3,req:[],eff:{def:6}},
   {id:'fr_g2',name:'Hardened Ice',desc:'+8% max HP per rank',cost:2,max:2,req:['fr_g1'],eff:{hpPct:0.08}},
   {id:'fr_g3',name:'Ice Barrier',desc:'Keystone: take 10% less damage',cost:3,max:1,req:['fr_g2'],eff:{dr:0.10}},
   {id:'fr_g4',name:'Frostbite Skin',desc:'reflect 25% melee damage',cost:2,max:1,req:['fr_g1'],eff:{thorns:0.25}},
   {id:'fr_g5',name:'Permafrost',desc:'Keystone: +12% HP, +12 DEF',cost:3,max:1,req:['fr_g3'],eff:{hpPct:0.12,def:12}},
  ]},
  {key:'shatter',name:'Shatter',color:'#c0504a',nodes:[
   {id:'fr_s1',name:'Frost Edge',desc:'+4 ATK per rank',cost:1,max:3,req:[],eff:{atk:4}},
   {id:'fr_s2',name:'Ice Shards',desc:'Keystone: shots chill foes',cost:3,max:1,req:['fr_s1'],eff:{slow:1}},
   {id:'fr_s3',name:'Frostbite Aim',desc:'+6% crit per rank',cost:2,max:2,req:['fr_s1'],eff:{crit:0.06}},
   {id:'fr_s4',name:'Cold Snap',desc:'+8% damage per rank',cost:2,max:2,req:['fr_s2'],eff:{atkPct:0.08}},
   {id:'fr_s5',name:'Shatter',desc:'Keystone: +30% crit damage, chilled foes take +25%',cost:3,max:1,req:['fr_s3','fr_s4'],eff:{critMult:0.30,shatter:0.25}},
  ]}],
  ascend:[
   {id:'cryomancer',name:'Cryomancer',color:'#5a9cc0',desc:'+28% ability power, chilling shots, +8 WIS. Capstone: chilled foes shatter (+50% damage).',eff:{abilPow:0.28,slow:1,wis:8,shatter:0.5}},
   {id:'frostwarden',name:'Frostwarden',color:'#7d8a99',desc:'+18% HP, +16 DEF, reflect 40% melee. Capstone: an icy aura chills all near.',eff:{hpPct:0.18,def:16,thorns:0.40,slowAura:1}},
   {id:'icebreaker',name:'Icebreaker',color:'#c0504a',desc:'+18% damage, +8% crit, +2 pierce. Capstone: shards shatter chilled foes (+35%).',eff:{atkPct:0.18,crit:0.08,pierce:2,shatter:0.35}},
  ]},
 storm:{ branches:[
  {key:'tempest',name:'Tempest',color:'#5a9cc0',nodes:[
   {id:'st_t1',name:'Charge',desc:'+5 WIS per rank',cost:1,max:3,req:[],eff:{wis:5}},
   {id:'st_t2',name:'Arc',desc:'Keystone: bolts pierce +1',cost:3,max:1,req:['st_t1'],eff:{pierce:1}},
   {id:'st_t3',name:'Overload',desc:'Keystone: +18% ability power',cost:3,max:1,req:['st_t1'],eff:{abilPow:0.18}},
   {id:'st_t4',name:'Capacitor',desc:'+2 mana regen',cost:2,max:1,req:['st_t2'],eff:{mpregen:2}},
   {id:'st_t5',name:'Superconduct',desc:'Keystone: bolts pierce +1, +6 WIS',cost:3,max:1,req:['st_t3','st_t4'],eff:{pierce:1,wis:6}},
  ]},
  {key:'voltage',name:'Voltage',color:'#c0504a',nodes:[
   {id:'st_v1',name:'Spark',desc:'+4 ATK per rank',cost:1,max:3,req:[],eff:{atk:4}},
   {id:'st_v2',name:'Static',desc:'Keystone: hits shock foes',cost:3,max:1,req:['st_v1'],eff:{shockHit:0.15}},
   {id:'st_v3',name:'Shock',desc:'+6% crit per rank',cost:2,max:2,req:['st_v1'],eff:{crit:0.06}},
   {id:'st_v4',name:'Amplify',desc:'+8% damage per rank',cost:2,max:2,req:['st_v2'],eff:{atkPct:0.08}},
   {id:'st_v5',name:'Thunderclap',desc:'Keystone: +12% damage, +8% attack speed',cost:3,max:1,req:['st_v3','st_v4'],eff:{atkPct:0.12,rof:0.08}},
  ]},
  {key:'ionize',name:'Ionize',color:'#6aae7a',nodes:[
   {id:'st_i1',name:'Static Step',desc:'+6% move speed per rank',cost:1,max:3,req:[],eff:{spd:0.06}},
   {id:'st_i2',name:'Quicken',desc:'+8% attack speed per rank',cost:2,max:2,req:['st_i1'],eff:{rof:0.08}},
   {id:'st_i3',name:'Blink',desc:'Keystone: +10% move speed',cost:3,max:1,req:['st_i1'],eff:{spd:0.10}},
   {id:'st_i4',name:'Charged Skin',desc:'+8% max HP per rank',cost:2,max:2,req:[],eff:{hpPct:0.08}},
   {id:'st_i5',name:'Overdrive',desc:'Keystone: +10% attack speed, +8% move',cost:3,max:1,req:['st_i2','st_i3'],eff:{rof:0.10,spd:0.08}},
  ]}],
  ascend:[
   {id:'stormlord',name:'Stormlord',color:'#5a9cc0',desc:'+28% ability power, +2 pierce, +8 WIS. Capstone: hits arc between foes.',eff:{abilPow:0.28,pierce:2,wis:8,chainHit:0.6}},
   {id:'thunderer',name:'Thunderer',color:'#c0504a',desc:'+18% damage, +10% crit, +10% attack speed. Capstone: crits call down lightning.',eff:{atkPct:0.18,crit:0.10,rof:0.10,critBolt:0.6}},
   {id:'galewalker',name:'Galewalker',color:'#6aae7a',desc:'+16% move, +16% attack speed, +10% HP. Capstone: attack 12% faster while moving.',eff:{spd:0.16,rof:0.16,hpPct:0.10,moveRof:0.12}},
  ]},
 hunter:{ branches:[
  {key:'beastmaster',name:'Beastmaster',color:'#6aae7a',nodes:[
   {id:'hu_b1',name:'Bond',desc:'+4 ATK per rank',cost:1,max:3,req:[],eff:{atk:4}},
   {id:'hu_b2',name:'Kinship',desc:'+6% ability power per rank',cost:2,max:2,req:['hu_b1'],eff:{abilPow:0.06}},
   {id:'hu_b3',name:'Piercing Shot',desc:'Keystone: shots pierce +1',cost:3,max:1,req:['hu_b1'],eff:{pierce:1}},
   {id:'hu_b4',name:'Wild Aim',desc:'+5% crit',cost:2,max:1,req:['hu_b1'],eff:{crit:0.05}},
   {id:'hu_b5',name:'Alpha',desc:'Keystone: +10% damage, +8% ability power',cost:3,max:1,req:['hu_b3','hu_b4'],eff:{atkPct:0.10,abilPow:0.08}},
  ]},
  {key:'trapper',name:'Trapper',color:'#5a9cc0',nodes:[
   {id:'hu_t1',name:'Deft Hands',desc:'+3 DEX per rank',cost:1,max:3,req:[],eff:{dex:3}},
   {id:'hu_t2',name:'Snare',desc:'Keystone: attacks slow foes',cost:2,max:1,req:['hu_t1'],eff:{slow:1}},
   {id:'hu_t3',name:'Rapid Trap',desc:'+8% attack speed per rank',cost:2,max:2,req:['hu_t1'],eff:{rof:0.08}},
   {id:'hu_t4',name:'Barbed Trap',desc:'Keystone: shots pierce +1',cost:3,max:1,req:['hu_t2'],eff:{pierce:1}},
   {id:'hu_t5',name:'Volley Trap',desc:'Keystone: +12% damage, +8% attack speed',cost:3,max:1,req:['hu_t3','hu_t4'],eff:{atkPct:0.12,rof:0.08}},
  ]},
  {key:'survivalist',name:'Survivalist',color:'#7d8a99',nodes:[
   {id:'hu_s1',name:'Rugged',desc:'+8% max HP per rank',cost:1,max:3,req:[],eff:{hpPct:0.08}},
   {id:'hu_s2',name:'Fleet Foot',desc:'+5% move speed per rank',cost:2,max:2,req:['hu_s1'],eff:{spd:0.05}},
   {id:'hu_s3',name:'Camouflage',desc:'Keystone: +2 regen, take 8% less damage',cost:3,max:1,req:['hu_s1'],eff:{regen:2,dr:0.08}},
   {id:'hu_s4',name:'Bracing',desc:'+6 DEF per rank',cost:2,max:2,req:[],eff:{def:6}},
   {id:'hu_s5',name:'Wanderer',desc:'Keystone: +12% HP, +10% move',cost:3,max:1,req:['hu_s2','hu_s3'],eff:{hpPct:0.12,spd:0.10}},
  ]}],
  ascend:[
   {id:'packlord',name:'Packlord',color:'#6aae7a',desc:'+16% damage, +12% ability power, +8% attack speed. Capstone: summons come in pairs.',eff:{atkPct:0.16,abilPow:0.12,rof:0.08,summonX2:1}},
   {id:'falconer',name:'Falconer',color:'#5a9cc0',desc:'Chilling shots, +12% damage, +10% attack speed. Capstone: shots seek out foes.',eff:{slow:1,atkPct:0.12,rof:0.10,homing:1}},
   {id:'pathwarden',name:'Pathwarden',color:'#7d8a99',desc:'+18% HP, +14% move, +2 regen. Capstone: move through trees and rocks.',eff:{hpPct:0.18,spd:0.14,regen:2,terrainGhost:1}},
  ]},
 monk:{ branches:[
  {key:'fists',name:'Fists of Fury',color:'#c0504a',nodes:[
   {id:'mo_f1',name:'Rapid Palm',desc:'+5% attack speed per rank',cost:1,max:2,req:[],eff:{rof:0.05}},
   {id:'mo_f2',name:'Pressure Point',desc:'+6% crit per rank',cost:2,max:2,req:['mo_f1'],eff:{crit:0.06}},
   {id:'mo_f3',name:'Flurry',desc:'Keystone: +10% attack speed',cost:3,max:1,req:['mo_f1'],eff:{rof:0.10}},
   {id:'mo_f4',name:'Iron Fist',desc:'+4 ATK per rank',cost:1,max:3,req:[],eff:{atk:4}},
   {id:'mo_f5',name:'Hundred Hands',desc:'Keystone: +8% crit, +8% attack speed',cost:3,max:1,req:['mo_f2','mo_f3'],eff:{crit:0.08,rof:0.08}},
  ]},
  {key:'wind',name:'Flowing Wind',color:'#6aae7a',nodes:[
   {id:'mo_w1',name:'Lightfoot',desc:'+6% move speed per rank',cost:1,max:3,req:[],eff:{spd:0.06}},
   {id:'mo_w2',name:'Resilience',desc:'+8% max HP per rank',cost:2,max:2,req:['mo_w1'],eff:{hpPct:0.08}},
   {id:'mo_w3',name:'Dodge',desc:'Keystone: take 10% less damage',cost:3,max:1,req:['mo_w1'],eff:{dr:0.10}},
   {id:'mo_w4',name:'Recovery',desc:'+2 regen',cost:2,max:1,req:['mo_w2'],eff:{regen:2}},
   {id:'mo_w5',name:'Windwalk',desc:'Keystone: +12% move, +8% attack speed',cost:3,max:1,req:['mo_w3'],eff:{spd:0.12,rof:0.08}},
  ]},
  {key:'ki',name:'Inner Ki',color:'#d4b96a',nodes:[
   {id:'mo_k1',name:'Meditation',desc:'+5 WIS per rank',cost:1,max:3,req:[],eff:{wis:5}},
   {id:'mo_k2',name:'Chi Flow',desc:'+8% ability power per rank',cost:2,max:2,req:['mo_k1'],eff:{abilPow:0.08}},
   {id:'mo_k3',name:'Life Sap',desc:'Keystone: heal 5% of damage dealt',cost:3,max:1,req:['mo_k1'],eff:{ls:0.05}},
   {id:'mo_k4',name:'Deep Well',desc:'+25 max MP',cost:2,max:1,req:[],eff:{mp:25}},
   {id:'mo_k5',name:'Enlightened',desc:'Keystone: +14% HP, +2 regen',cost:3,max:1,req:['mo_k2','mo_k3'],eff:{hpPct:0.14,regen:2}},
  ]}],
  ascend:[
   {id:'grandmaster',name:'Grandmaster',color:'#c0504a',desc:'+16% attack speed, +10% crit, +8 ATK. Capstone: every third strike stuns.',eff:{rof:0.16,crit:0.10,atk:8,stun3:1}},
   {id:'windwalker',name:'Windwalker',color:'#6aae7a',desc:'+18% move, +12% attack speed, take 12% less damage. Capstone: dash through untouchable.',eff:{spd:0.18,rof:0.12,dr:0.12,dashInv:1}},
   {id:'ascendant',name:'Ascendant',color:'#d4b96a',desc:'+8% lifesteal, +20% HP, +3 regen. Capstone: strikes mend you.',eff:{ls:0.08,hpPct:0.20,regen:3}},
  ]},
 paladin:{ branches:[
  {key:'aegis',name:'Aegis',color:'#7d8a99',nodes:[
   {id:'pa_a1',name:'Plating',desc:'+8 DEF per rank',cost:1,max:3,req:[],eff:{def:8}},
   {id:'pa_a2',name:'Vigor',desc:'+8% max HP per rank',cost:2,max:2,req:['pa_a1'],eff:{hpPct:0.08}},
   {id:'pa_a3',name:'Shield Wall',desc:'Keystone: take 12% less damage',cost:3,max:1,req:['pa_a2'],eff:{dr:0.12}},
   {id:'pa_a4',name:'Thornmail',desc:'reflect 25% melee damage',cost:2,max:1,req:['pa_a1'],eff:{thorns:0.25}},
   {id:'pa_a5',name:'Unbreakable',desc:'Keystone: +16 DEF, +10% HP',cost:3,max:1,req:['pa_a3','pa_a4'],eff:{def:16,hpPct:0.10}},
  ]},
  {key:'zeal',name:'Zeal',color:'#e8b34b',nodes:[
   {id:'pa_z1',name:'Righteous',desc:'+4 ATK per rank',cost:1,max:3,req:[],eff:{atk:4}},
   {id:'pa_z2',name:'Fervor',desc:'+6% crit per rank',cost:2,max:2,req:['pa_z1'],eff:{crit:0.06}},
   {id:'pa_z3',name:'Cleave',desc:'Keystone: attacks cleave +1',cost:3,max:1,req:['pa_z1'],eff:{cleave:1}},
   {id:'pa_z4',name:'Crusade',desc:'+8% damage',cost:2,max:1,req:['pa_z2'],eff:{atkPct:0.08}},
   {id:'pa_z5',name:'Divine Wrath',desc:'Keystone: +10 ATK, cleave +1',cost:3,max:1,req:['pa_z3','pa_z4'],eff:{atk:10,cleave:1}},
  ]},
  {key:'grace',name:'Grace',color:'#d4b96a',nodes:[
   {id:'pa_g1',name:'Devout',desc:'+4 WIS per rank',cost:1,max:3,req:[],eff:{wis:4}},
   {id:'pa_g2',name:'Mending',desc:'+2 regen per rank',cost:2,max:2,req:['pa_g1'],eff:{regen:2}},
   {id:'pa_g3',name:'Holy Power',desc:'Keystone: +14% ability power',cost:3,max:1,req:['pa_g1'],eff:{abilPow:0.14}},
   {id:'pa_g4',name:'Font of Faith',desc:'+25 max MP',cost:2,max:1,req:[],eff:{mp:25}},
   {id:'pa_g5',name:'Consecration',desc:'Keystone: +12% HP, +3 regen',cost:3,max:1,req:['pa_g2','pa_g3'],eff:{hpPct:0.12,regen:3}},
  ]}],
  ascend:[
   {id:'crusader',name:'Crusader',color:'#e8b34b',desc:'+12 ATK, cleave +2, +10% crit. Capstone: smites explode.',eff:{atk:12,cleave:2,crit:0.10,splash:0.40}},
   {id:'guardian',name:'Guardian',color:'#7d8a99',desc:'+18% HP, +18 DEF, take 12% less damage. Capstone: overflowing light wards you.',eff:{hpPct:0.18,def:18,dr:0.12,overshield:1}},
   {id:'highpriest',name:'High Priest',color:'#d4b96a',desc:'+24% ability power, +8 WIS, +3 regen. Capstone: casts consecrate healing ground.',eff:{abilPow:0.24,wis:8,regen:3,groundHeal:1}},
  ]},
 // ===== NECROMANCER — resource: SOULS (torn from every kill; never decays).
 // Identity: a death economy — kills bank Souls, Souls are SPENT on minions and detonations.
 // Corpse blooms (tag 'bloom') and the soul nova (tag 'soulnova') are the chain currencies.
 necro:{ branches:[
  {key:'reaping',name:'Reaping',color:'#6aae7a',nodes:[
   {id:'ne_u1',name:'Grave Touch',desc:'+4 WIS and +4 ATK per rank',cost:1,max:3,req:[],eff:{wis:4,atk:4}},
   {id:'ne_u2',name:'Soul Harvest',desc:'Kills tear out 6 extra Souls and restore 4% mana, per rank',cost:2,max:2,req:['ne_u1'],
    trig:{on:'kill',do:{res:{n:6},mana:{pct:0.04}}}},
   {id:'ne_u3',name:'Corpse Bloom',desc:'The slain burst into a 4s pool of rot (0.8s)',cost:2,max:1,req:['ne_u1'],
    trig:{on:'kill',icd:0.8,do:{zone:{r:85,life:4,poison:true,dmgPct:0.18,col:'#8fd48c'}},emits:'bloom'}},
   {id:'ne_u4',name:'Soul Surge',desc:'At full Souls, spend them all: 160% ATK erupts around you',cost:3,max:1,req:['ne_u2'],
    trig:{on:'resFull',do:{dmgNearby:{r:190,pct:1.6,col:'#8a5ac0'},res:{n:-100,perRank:false},text:'SOUL SURGE'},emits:'soulnova'}},
   {id:'ne_u5',name:'Grave Pact',desc:'Keystone: a skeleton claws its way out of every corpse bloom',cost:3,max:1,req:['ne_u3','ne_u4'],ifOwn:'ne_u3',
    trig:{on:'proc',filter:{tag:'bloom'},do:{summon:{n:1,dmgPct:0.35,life:12,spr:'skel'}}}},
  ]},
  {key:'bonecraft',name:'Bonecraft',color:'#c0304a',nodes:[
   {id:'ne_b1',name:'Ossify',desc:'+5 DEF and +5 VIT per rank',cost:1,max:3,req:[],eff:{def:5,vit:5}},
   {id:'ne_b2',name:'Bonecraft',desc:'Your minions last 60% longer and hit 25% harder',cost:2,max:1,req:['ne_b1'],
    mod:{kind:'summon',pre:{sumLife:1.6,sumDmg:1.25}}},
   {id:'ne_b3',name:'Soul Conduit',desc:'Spend 20 Souls when you summon: the dead rise DOUBLED',cost:2,max:1,req:['ne_b1'],
    mod:{kind:'summon',pre:{spendRes:20,sumMul:2}}},
   {id:'ne_b4',name:'Bone Shield',desc:'Raising the dead wraps you in bone — 7% max HP of shield per rank',cost:2,max:2,req:['ne_b2'],
    trig:{on:'cast',filter:{kind:'summon'},do:{shield:{pct:0.07}}}},
   {id:'ne_b5',name:'Dread Legion',desc:'Keystone: minions carry your rot, and 3-in-10 kills raise another servant',cost:3,max:1,req:['ne_b3','ne_b4'],
    mod:{kind:'summon',pre:{sumSt:{id:'poison',dur:3,val:5}}},
    trig:{on:'kill',chance:0.30,perRank:false,do:{summon:{n:1,dmgPct:0.3,life:10,spr:'skel'}}}},
  ]},
  {key:'plague',name:'Plague',color:'#8a5ac0',nodes:[
   {id:'ne_s1',name:'Withering',desc:'+5 WIS and +3 DEX per rank',cost:1,max:3,req:[],eff:{wis:5,dex:3}},
   {id:'ne_s2',name:'Rot',desc:'1-in-4 hits fester — poison for 25% of the hit over 4s, per rank',cost:2,max:2,req:['ne_s1'],
    trig:{on:'hit',chance:0.25,perRank:false,do:{status:{id:'poison',dur:4,pct:0.25}}}},
   {id:'ne_s3',name:'Curse of Ash',desc:'Your crits curse — the marked take 20% more damage for 4s',cost:2,max:1,req:['ne_s1'],
    trig:{on:'crit',do:{status:{id:'curse',dur:4,val:0.20}}}},
   {id:'ne_s4',name:'Miasma',desc:'With 2+ foes near, +7% ability power per rank',cost:2,max:2,req:['ne_s2'],
    cond:{when:'nearFoes',n:2,r:210,eff:{abilPow:0.07}}},
   {id:'ne_s5',name:'Plaguelord',desc:'Keystone: the rotting dead spread their plague to everything within 150',cost:3,max:1,req:['ne_s3','ne_s4'],ifOwn:'ne_s2',
    trig:{on:'kill',do:{status:{r:150,id:'poison',dur:4,val:7}}}},
  ]}],
  ascend:[
   {id:'lich',name:'Lich',color:'#8a5ac0',desc:'+26% ability power, +12% lifesteal, +8 WIS. Capstone: raise twice the skeletons.',eff:{abilPow:0.26,ls:0.12,wis:8,summonX2:1}},
   {id:'bonelord',name:'Bonelord',color:'#c0304a',desc:'+2 pierce, +16% damage, +10% crit. Capstone: bone spears explode.',eff:{pierce:2,atkPct:0.16,crit:0.10,splash:0.45}},
   {id:'plaguebringer',name:'Plaguebringer',color:'#6aae7a',desc:'+16% damage, +10% ability power, +8% attack speed. Capstone: minions poison foes.',eff:{atkPct:0.16,abilPow:0.10,rof:0.08,allyDot:0.5}},
  ]},
 bard:{ branches:[
  {key:'cadence',name:'Cadence',color:'#c07ad4',nodes:[
   {id:'ba_c1',name:'Rhythm',desc:'+6% attack speed per rank',cost:1,max:2,req:[],eff:{rof:0.06}},
   {id:'ba_c2',name:'Sharp Note',desc:'+4 ATK per rank',cost:1,max:3,req:['ba_c1'],eff:{atk:4}},
   {id:'ba_c3',name:'Allegro',desc:'Keystone: +10% attack speed',cost:3,max:1,req:['ba_c1'],eff:{rof:0.10}},
   {id:'ba_c4',name:'Crescendo',desc:'+6% crit per rank',cost:2,max:2,req:['ba_c2'],eff:{crit:0.06}},
   {id:'ba_c5',name:'Finale',desc:'Keystone: +12% damage, +8% attack speed',cost:3,max:1,req:['ba_c3','ba_c4'],eff:{atkPct:0.12,rof:0.08}},
  ]},
  {key:'ballad',name:'Ballad',color:'#6aae7a',nodes:[
   {id:'ba_b1',name:'Vitality Song',desc:'+8% max HP per rank',cost:1,max:3,req:[],eff:{hpPct:0.08}},
   {id:'ba_b2',name:'Restful Tune',desc:'+2 regen per rank',cost:2,max:2,req:['ba_b1'],eff:{regen:2}},
   {id:'ba_b3',name:'Siphon Song',desc:'Keystone: heal 4% of damage dealt',cost:3,max:1,req:['ba_b1'],eff:{ls:0.04}},
   {id:'ba_b4',name:'March',desc:'+5% move speed per rank',cost:2,max:2,req:[],eff:{spd:0.05}},
   {id:'ba_b5',name:'Anthem',desc:'Keystone: +12% HP, +12% move',cost:3,max:1,req:['ba_b2','ba_b4'],eff:{hpPct:0.12,spd:0.12}},
  ]},
  {key:'harmony',name:'Harmony',color:'#d4b96a',nodes:[
   {id:'ba_h1',name:'Muse',desc:'+5 WIS per rank',cost:1,max:3,req:[],eff:{wis:5}},
   {id:'ba_h2',name:'Resonance',desc:'+8% ability power per rank',cost:2,max:2,req:['ba_h1'],eff:{abilPow:0.08}},
   {id:'ba_h3',name:'Encore',desc:'Keystone: +25 MP, +2 mana regen',cost:3,max:1,req:['ba_h1'],eff:{mp:25,mpregen:2}},
   {id:'ba_h4',name:'Fortune Song',desc:'+6 FORTUNE',cost:2,max:1,req:[],eff:{fort:6}},
   {id:'ba_h5',name:'Symphony',desc:'Keystone: +16% ability power, +6 WIS',cost:3,max:1,req:['ba_h2','ba_h3'],eff:{abilPow:0.16,wis:6}},
  ]}],
  ascend:[
   {id:'maestro',name:'Maestro',color:'#c07ad4',desc:'+20% attack speed, +10% crit, +8% damage. Capstone: your tempo never breaks.',eff:{rof:0.20,crit:0.10,atkPct:0.08}},
   {id:'skald',name:'Skald',color:'#6aae7a',desc:'+18% HP, +14% move, +6% lifesteal. Capstone: your pets share your tempo.',eff:{hpPct:0.18,spd:0.14,ls:0.06,allyHaste:0.3}},
   {id:'loremaster',name:'Loremaster',color:'#d4b96a',desc:'+24% ability power, +8 WIS, +8 FORT. Capstone: spells echo at 40% power.',eff:{abilPow:0.24,wis:8,fort:8,echoCast:0.4}},
  ]},
 shaman:{ branches:[
  {key:'spirits',name:'Spirits',color:'#4fb0a0',nodes:[
   {id:'sh_s1',name:'Totemic',desc:'+4 ATK per rank',cost:1,max:3,req:[],eff:{atk:4}},
   {id:'sh_s2',name:'Spirit Brand',desc:'Keystone: hits weaken foes',cost:3,max:1,req:['sh_s1'],eff:{weakHit:1}},
   {id:'sh_s3',name:'Spirit Power',desc:'+8% ability power per rank',cost:2,max:2,req:['sh_s1'],eff:{abilPow:0.08}},
   {id:'sh_s4',name:'Wild Spirit',desc:'+6% crit',cost:2,max:1,req:['sh_s2'],eff:{crit:0.06}},
   {id:'sh_s5',name:'Spirit Legion',desc:'Keystone: +12% damage, +10% ability power',cost:3,max:1,req:['sh_s3','sh_s4'],eff:{atkPct:0.12,abilPow:0.10}},
  ]},
  {key:'tides',name:'Tides',color:'#5a9cc0',nodes:[
   {id:'sh_t1',name:'Flow',desc:'+5 WIS per rank',cost:1,max:3,req:[],eff:{wis:5}},
   {id:'sh_t2',name:'Chill Tide',desc:'Keystone: attacks slow foes',cost:2,max:1,req:['sh_t1'],eff:{slow:1}},
   {id:'sh_t3',name:'Deep Current',desc:'Keystone: +18% ability power',cost:3,max:1,req:['sh_t1'],eff:{abilPow:0.18}},
   {id:'sh_t4',name:'Spring',desc:'+2 mana regen',cost:2,max:1,req:['sh_t2'],eff:{mpregen:2}},
   {id:'sh_t5',name:'Riptide',desc:'Keystone: bolts pierce +1, +6 WIS',cost:3,max:1,req:['sh_t3'],eff:{pierce:1,wis:6}},
  ]},
  {key:'earthward',name:'Earthward',color:'#6aae7a',nodes:[
   {id:'sh_e1',name:'Stoneskin',desc:'+8% max HP per rank',cost:1,max:3,req:[],eff:{hpPct:0.08}},
   {id:'sh_e2',name:'Bulwark',desc:'+6 DEF per rank',cost:2,max:2,req:['sh_e1'],eff:{def:6}},
   {id:'sh_e3',name:'Roots',desc:'Keystone: +2 regen, take 8% less damage',cost:3,max:1,req:['sh_e1'],eff:{regen:2,dr:0.08}},
   {id:'sh_e4',name:'Earth Spikes',desc:'reflect 20% melee damage',cost:2,max:1,req:['sh_e2'],eff:{thorns:0.20}},
   {id:'sh_e5',name:'Mountain',desc:'Keystone: +12% HP, +12 DEF',cost:3,max:1,req:['sh_e3'],eff:{hpPct:0.12,def:12}},
  ]}],
  ascend:[
   {id:'spiritcaller',name:'Spiritcaller',color:'#4fb0a0',desc:'+18% damage, +14% ability power, +8% attack speed. Capstone: spirits linger 60% longer.',eff:{atkPct:0.18,abilPow:0.14,rof:0.08,spiritDur:0.6}},
   {id:'tidesage',name:'Tidesage',color:'#5a9cc0',desc:'+26% ability power, chilling shots, +1 pierce. Capstone: tides arc between foes.',eff:{abilPow:0.26,slow:1,pierce:1,chainHit:0.5}},
   {id:'earthwarden',name:'Earthwarden',color:'#6aae7a',desc:'+18% HP, +16 DEF, +3 regen. Capstone: the roots sustain you.',eff:{hpPct:0.18,def:16,regen:3}},
  ]},
 dragoon:{ branches:[
  {key:'lancer',name:'Lancer',color:'#e07a2e',nodes:[
   {id:'dr_l1',name:'Lance Grip',desc:'+5 ATK per rank',cost:1,max:3,req:[],eff:{atk:5}},
   {id:'dr_l2',name:'Skewer',desc:'Keystone: attacks pierce +1',cost:3,max:1,req:['dr_l1'],eff:{pierce:1}},
   {id:'dr_l3',name:'Precision',desc:'+6% crit per rank',cost:2,max:2,req:['dr_l1'],eff:{crit:0.06}},
   {id:'dr_l4',name:'Momentum',desc:'+8% damage per rank',cost:2,max:2,req:['dr_l2'],eff:{atkPct:0.08}},
   {id:'dr_l5',name:'Impaler',desc:'Keystone: pierce +1, +30% crit damage',cost:3,max:1,req:['dr_l3','dr_l4'],eff:{pierce:1,critMult:0.30}},
  ]},
  {key:'skyborne',name:'Skyborne',color:'#6aae7a',nodes:[
   {id:'dr_s1',name:'Updraft',desc:'+6% move speed per rank',cost:1,max:3,req:[],eff:{spd:0.06}},
   {id:'dr_s2',name:'Hardy',desc:'+8% max HP per rank',cost:2,max:2,req:['dr_s1'],eff:{hpPct:0.08}},
   {id:'dr_s3',name:'Jet',desc:'Keystone: +10% move, +8% attack speed',cost:3,max:1,req:['dr_s1'],eff:{spd:0.10,rof:0.08}},
   {id:'dr_s4',name:'Feather Fall',desc:'+2 regen',cost:2,max:1,req:['dr_s2'],eff:{regen:2}},
   {id:'dr_s5',name:'Aerial',desc:'Keystone: take 10% less damage, +8% move',cost:3,max:1,req:['dr_s3','dr_s4'],eff:{dr:0.10,spd:0.08}},
  ]},
  {key:'dragonscale',name:'Dragonscale',color:'#7d8a99',nodes:[
   {id:'dr_d1',name:'Scales',desc:'+8 DEF per rank',cost:1,max:3,req:[],eff:{def:8}},
   {id:'dr_d2',name:'Endurance',desc:'+8% max HP per rank',cost:2,max:2,req:['dr_d1'],eff:{hpPct:0.08}},
   {id:'dr_d3',name:'Scaled Guard',desc:'Keystone: take 12% less damage',cost:3,max:1,req:['dr_d2'],eff:{dr:0.12}},
   {id:'dr_d4',name:'Spiked Scales',desc:'reflect 25% melee damage',cost:2,max:1,req:['dr_d1'],eff:{thorns:0.25}},
   {id:'dr_d5',name:'Wyrmhide',desc:'Keystone: +16 DEF, +10% HP',cost:3,max:1,req:['dr_d3','dr_d4'],eff:{def:16,hpPct:0.10}},
  ]}],
  ascend:[
   {id:'wyrmknight',name:'Wyrmknight',color:'#e07a2e',desc:'+2 pierce, +16% damage, +10% crit. Capstone: thrusts skewer a whole line.',eff:{pierce:2,atkPct:0.16,crit:0.10}},
   {id:'skylord',name:'Skylord',color:'#6aae7a',desc:'+16% move, +14% attack speed, +12% HP. Capstone: leaps crater on landing.',eff:{spd:0.16,rof:0.14,hpPct:0.12,dashBlast:1}},
   {id:'dragonlord',name:'Dragonlord',color:'#7d8a99',desc:'+18% HP, +18 DEF, reflect 40% melee. Capstone: scales punish every blow.',eff:{hpPct:0.18,def:18,thorns:0.40}},
  ]},
};

// ----- logic -----
function treeOf(cls){ return CLASS_TREE[cls]||null; }
function nodeById(cls,id){ const t=treeOf(cls); if(!t)return null;
  for(const b of t.branches) for(const n of b.nodes) if(n.id===id) return n; return null; }
function nodeRank(rpg,id){ return (rpg.tree&&rpg.tree[id])||0; }
function nodeUnlockable(cls,rpg,n){
  if(nodeRank(rpg,n.id)>=n.max) return false;                 // maxed
  if(rpg.perkPts< n.cost) return false;                        // can't afford
  for(const rq of (n.req||[])) if(nodeRank(rpg,rq)<1) return false; // prereqs
  return true;
}
function unlockNode(cls,rpg,id){ const n=nodeById(cls,id); if(!n||!nodeUnlockable(cls,rpg,n)) return false;
  rpg.tree[id]=nodeRank(rpg,id)+1; rpg.perkPts-=n.cost; return true; }
function spentPoints(cls,rpg){ const t=treeOf(cls); if(!t)return 0; let s=0;
  for(const b of t.branches) for(const n of b.nodes) s+=nodeRank(rpg,n.id)*n.cost; return s; }
function respec(cls,rpg){ xpTreeInit(rpg); rpg.perkPts+=spentPoints(cls,rpg); rpg.tree={}; }  // keeps ascension
// Ascension available once you've invested enough of the tree AND hit Lv 40.
function ascendReady(cls,rpg){ return rpg.lvl>=40 && spentPoints(cls,rpg)>=14 && !rpg.ascension; }
function doAscend(cls,rpg,ascId){ const t=treeOf(cls); if(!t||rpg.ascension) return false;
  if(!t.ascend.some(a=>a.id===ascId)) return false; if(!ascendReady(cls,rpg)) return false;
  rpg.ascension=ascId; return true; }
function ascendInfo(cls,rpg){ const t=treeOf(cls); if(!t||!rpg.ascension) return null;
  return t.ascend.find(a=>a.id===rpg.ascension)||null; }

// ----- skill tree UI: a literal node-tree on canvas, nodes linked to prerequisites -----
let _skNodeImg=(typeof window!=='undefined')?(()=>{const i=new Image();i.src='assets/ui/skill_node.png';return i;})():null;
function _skFrameReady(){ return _skNodeImg&&_skNodeImg.complete&&_skNodeImg.naturalWidth>0; }
let _skLayout=null, _skSel=null, _skRaf=0;

function openSkills(){ const ch=curChar(); if(!ch||!rpg) return; xpTreeInit(rpg); grantPerkPoints(rpg);
  let ov=document.getElementById('skillScr');
  if(!ov){ ov=document.createElement('div'); ov.id='skillScr'; document.body.appendChild(ov); }
  ov.style.display='flex';
  ov.innerHTML='<div class="skWrap2">'
    +'<button class="tabX" id="skX" aria-label="Close">✕</button>'
    +'<div class="skTop"><div class="skTitle" id="skTitle"></div><div class="skPts" id="skPts"></div></div>'
    +'<div class="skHint">Tap a node to inspect · learn from the trunk up · branches end in ascension ✦</div>'
    +'<div class="skCanWrap"><canvas id="skillCv" width="960" height="560"></canvas></div>'
    +'<div class="skDetail" id="skDetail"></div>'
    +'<div class="skBtns"><button class="mbtn" id="skRespec">RESPEC</button></div>'
    +'</div>';
  // 'click' (not pointerdown) so dragging/panning the tree never selects a node
  const cv=document.getElementById('skillCv'); cv.addEventListener('click',_skClick);
  document.getElementById('skRespec').onclick=()=>{ if(confirm('Refund every spent point? (ascension is kept)')){ respec(ch.cls,rpg); recalcStats(); saveRPG(); _skSel=null; _skRefresh(); } };
  document.getElementById('skX').onclick=closeSkills;
  _skSel=null; _skBuildLayout(ch.cls); _skFitCanvas(); _skRefresh(); _skStartAnim();
  addEventListener('resize',_skFitCanvas);
}
// The tree stays FULL SIZE (960x560, readable nodes) inside the scrollable .skCanWrap
// viewport; here we just aim the initial view at the trunk (bottom-centre), where a
// build starts. On desktop the whole tree fits; on phones you pan around it.
function _skFitCanvas(){ const cv=document.getElementById('skillCv'); if(!cv) return;
  const wrap=cv.parentElement; if(!wrap) return;
  wrap.scrollLeft=Math.max(0,(cv.offsetWidth-wrap.clientWidth)/2);
  wrap.scrollTop=Math.max(0, cv.offsetHeight-wrap.clientHeight); }
function closeSkills(){ const ov=document.getElementById('skillScr'); if(ov) ov.style.display='none'; _skStopAnim();
  removeEventListener('resize',_skFitCanvas);
  if(typeof recalcStats==='function') recalcStats(); if(typeof saveRPG==='function') saveRPG(); }

// Organic tidy-tree layout: ALL branches are one graph rooted at the trunk. Every node's
// primary parent is its first req; a node with several children forks, a node with none is
// a dead-end. Subtrees get horizontal space proportional to their leaf count, so branches
// spread and fork naturally instead of sitting in rigid columns.
function _skBuildLayout(cls){ const cv=document.getElementById('skillCv'); const t=treeOf(cls); if(!cv||!t){ _skLayout=null; return; }
  const W=cv.width, H=cv.height;
  const all=[]; for(const b of t.branches) for(const n of b.nodes) all.push({n:n,color:b.color});
  const kids={}, primary={};
  for(const s of all){ const reqs=s.n.req||[]; if(reqs.length){ const p=reqs[0]; primary[s.n.id]=p; (kids[p]=kids[p]||[]).push(s.n.id); } }
  const roots=all.filter(s=>!(s.n.req&&s.n.req.length)).map(s=>s.n.id);
  const wById={}; function leafW(id){ if(wById[id]!=null) return wById[id]; const c=kids[id]||[];
    if(!c.length) return wById[id]=1; let w=0; for(const k of c) w+=leafW(k); return wById[id]=w; }
  roots.forEach(leafW);
  const depthById={}; function depth(id){ if(depthById[id]!=null) return depthById[id]; const p=primary[id];
    return depthById[id]=(p!=null?depth(p)+1:0); }
  all.forEach(s=>depth(s.n.id));
  const maxD=Math.max(1,...all.map(s=>depthById[s.n.id]));
  const pad=46, availW=W-2*pad, ascY=50, topY=118, botY=H-104;
  const yFor=d=> botY-(d/maxD)*(botY-topY);
  const pos={};
  function place(id,x0,x1){ pos[id]={x:pad+((x0+x1)/2)*availW, y:yFor(depthById[id])};
    const c=kids[id]||[]; if(!c.length) return; const tot=leafW(id)||1; let cx=x0;
    for(const k of c){ const w=(leafW(k)/tot)*(x1-x0); place(k,cx,cx+w); cx+=w; } }
  const totalW=roots.reduce((a,id)=>a+leafW(id),0)||1; let cx=0;
  for(const id of roots){ const w=leafW(id)/totalW; place(id,cx,cx+w); cx+=w; }
  // spread nodes that share a depth so nodes + labels never collide (keeps them centered)
  const byDepth={}; for(const s of all){ const d=depthById[s.n.id]; (byDepth[d]=byDepth[d]||[]).push(s.n.id); }
  const minGap=70;
  for(const d in byDepth){ const row=byDepth[d].slice().sort((a,b)=>pos[a].x-pos[b].x);
    for(let i=1;i<row.length;i++){ if(pos[row[i]].x-pos[row[i-1]].x<minGap) pos[row[i]].x=pos[row[i-1]].x+minGap; }
    const lo=pos[row[0]].x, hi=pos[row[row.length-1]].x, shift=W/2-(lo+hi)/2;
    for(const id of row){ pos[id].x=Math.min(W-pad,Math.max(pad,pos[id].x+shift)); } }
  const nodes=all.map(s=>({n:s.n,x:Math.round(pos[s.n.id].x),y:Math.round(pos[s.n.id].y),color:s.color,
    root:depthById[s.n.id]===0, top:!(kids[s.n.id]&&kids[s.n.id].length)}));
  t.ascend.forEach((a,i)=>{ nodes.push({a:a,x:Math.round(W*(i+0.5)/t.ascend.length),y:ascY,color:a.color}); });
  _skLayout={nodes:nodes,W:W,H:H,trunkX:Math.round(W/2),trunkY:H-40};
}
function _skBranchLine(g,x1,y1,x2,y2,col,w,a){ g.save(); g.globalAlpha=a; g.strokeStyle=col; g.lineWidth=w; g.lineCap='round';
  const my=(y1+y2)/2; g.beginPath(); g.moveTo(x1,y1); g.bezierCurveTo(x1,my,x2,my,x2,y2); g.stroke(); g.restore(); }
function _skDraw(){ const cv=document.getElementById('skillCv'); if(!cv||!_skLayout){ return; } const g=cv.getContext('2d'); g.imageSmoothingEnabled=false;
  const ch=curChar(); if(!ch) return; const cls=ch.cls; const W=_skLayout.W,H=_skLayout.H;
  g.clearRect(0,0,W,H); const bg=g.createRadialGradient(W/2,H*0.62,40,W/2,H*0.62,H*0.95); bg.addColorStop(0,'#171019'); bg.addColorStop(1,'#0b090f'); g.fillStyle=bg; g.fillRect(0,0,W,H);
  const pulse=0.5+Math.sin(performance.now()/430)*0.5;
  const byId={}; for(const s of _skLayout.nodes) if(s.n) byId[s.n.id]=s;
  // trunk -> each branch root
  for(const s of _skLayout.nodes){ if(s.n&&s.root){ const owned=nodeRank(rpg,s.n.id)>0;
    _skBranchLine(g,_skLayout.trunkX,_skLayout.trunkY,s.x,s.y, owned?'#8a6a2e':'#3a3442', owned?5:4, 0.7); } }
  // req -> node links
  for(const s of _skLayout.nodes){ if(!s.n) continue; const childOwned=nodeRank(rpg,s.n.id)>0;
    for(const rq of (s.n.req||[])){ const p=byId[rq]; if(!p) continue; const reqOwned=nodeRank(rpg,rq)>0;
      _skBranchLine(g,p.x,p.y,s.x,s.y, childOwned?'#ffc94d':(reqOwned?s.color:'#3a3442'), childOwned?4.5:3, childOwned?0.95:(reqOwned?0.75:0.4)); } }
  // dead-end tips -> nearest ascension (faint aspiration lines)
  for(const s of _skLayout.nodes){ if(s.n&&s.top&&s.y<_skLayout.H*0.45){ let best=null,bd=1e9;
    for(const a of _skLayout.nodes){ if(!a.a) continue; const d=Math.abs(a.x-s.x); if(d<bd){bd=d;best=a;} }
    if(best) _skBranchLine(g,s.x,s.y,best.x,best.y,'#2c2633',2,0.25); } }
  // trunk root emblem
  g.fillStyle='#241b33'; g.beginPath(); g.arc(_skLayout.trunkX,_skLayout.trunkY,16,0,6.29); g.fill();
  g.lineWidth=2; g.strokeStyle='#7a4a1e'; g.stroke();
  const cc=CLASSES[Math.max(0,CLASSES.findIndex(x=>x.id===cls))];
  g.font='16px serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(cc?cc.ic:'★',_skLayout.trunkX,_skLayout.trunkY+1);
  for(const s of _skLayout.nodes){ if(s.n) _skDrawNode(g,s,pulse); }
  const chosen=ascendInfo(cls,rpg);
  for(const s of _skLayout.nodes){ if(s.a) _skDrawAsc(g,s,pulse,chosen); }
  g.textAlign='left'; g.textBaseline='alphabetic';
}
function _skDrawNode(g,s,pulse){ const ch=curChar(); const n=s.n, r=nodeRank(rpg,n.id), owned=r>0, avail=nodeUnlockable(ch.cls,rpg,n), sel=_skSel===n.id, R=18;
  const col=owned?'#ffc94d':(avail?'#8fd48c':'#5a5464');
  if(owned||avail){ const gl=g.createRadialGradient(s.x,s.y,2,s.x,s.y,R*1.7);
    gl.addColorStop(0,(owned?'rgba(255,201,77,':'rgba(143,212,140,')+(0.34*(owned?1:pulse)).toFixed(2)+')'); gl.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=gl; g.beginPath(); g.arc(s.x,s.y,R*1.7,0,6.29); g.fill(); }
  if(_skFrameReady()){ g.globalAlpha=owned?1:(avail?0.95:0.55); g.drawImage(_skNodeImg,s.x-R,s.y-R,R*2,R*2); g.globalAlpha=1; }
  else { g.fillStyle='#141019'; g.beginPath(); g.arc(s.x,s.y,R,0,6.29); g.fill(); }
  g.fillStyle=s.color+(owned?'dd':(avail?'99':'44')); g.beginPath(); g.arc(s.x,s.y,R*0.52,0,6.29); g.fill();
  g.lineWidth=sel?3:2; g.strokeStyle=sel?'#fff':col; g.beginPath(); g.arc(s.x,s.y,R,0,6.29); g.stroke();
  g.textAlign='center'; g.textBaseline='middle';
  if(n.ability){ const ab=(typeof abilById==='function')?abilById(ch.cls,n.ability):null;   // ability-unlock node shows its art (or icon)
    g.globalAlpha=owned?1:(avail?0.9:0.5);
    const aim=(typeof abilImg==='function')?abilImg(n.ability):null;
    if(aim){ const s2=R*1.66; g.save(); g.beginPath(); g.arc(s.x,s.y,R*0.9,0,6.29); g.clip(); g.drawImage(aim,s.x-s2/2,s.y-s2/2,s2,s2); g.restore(); }
    else { g.font='16px serif'; g.fillText(ab?ab.icon:'✦',s.x,s.y+1); }
    g.globalAlpha=1; }
  else if(n.max>1){ g.fillStyle='#fff'; g.font='bold 11px "Pixelify Sans",monospace'; g.fillText(r+'/'+n.max,s.x,s.y+1); }
  else if(owned){ g.fillStyle='#fff'; g.font='bold 13px monospace'; g.fillText('✓',s.x,s.y+1); }
  g.font='8px "Pixelify Sans",monospace'; g.textBaseline='top'; g.fillStyle=owned?'#e8d9b8':(avail?'#a9dea6':'#7a7484');
  g.fillText(n.name.length>11?n.name.slice(0,10)+'…':n.name, s.x, s.y+R+2);
}
function _skDrawAsc(g,s,pulse,chosen){ const ch=curChar(); const a=s.a, isC=chosen&&chosen.id===a.id, ready=ascendReady(ch.cls,rpg), sel=_skSel===a.id, R=24;
  if(isC||ready){ const gl=g.createRadialGradient(s.x,s.y,2,s.x,s.y,R*1.8);
    gl.addColorStop(0,'rgba(212,185,106,'+(0.4*(isC?1:pulse)).toFixed(2)+')'); gl.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gl; g.beginPath(); g.arc(s.x,s.y,R*1.8,0,6.29); g.fill(); }
  g.save(); g.translate(s.x,s.y); g.rotate(Math.PI/4);
  g.fillStyle=isC?a.color:'#141019'; g.fillRect(-R*0.72,-R*0.72,R*1.44,R*1.44);
  g.lineWidth=sel?3:2; g.strokeStyle= chosen?(isC?'#fff':'#39323f') : (ready?a.color:'#4a4454'); g.strokeRect(-R*0.72,-R*0.72,R*1.44,R*1.44);
  g.restore();
  g.textAlign='center'; g.textBaseline='middle'; g.font='13px serif'; g.fillStyle=isC?'#fff':(chosen?'#5a5464':a.color); g.fillText('✦',s.x,s.y+1);
  g.font='bold 10px "Pixelify Sans",monospace'; g.textBaseline='top'; g.fillStyle=isC?'#fff':(chosen?'#6a6474':a.color); g.fillText(a.name,s.x,s.y+R+3);
}
function _skClick(ev){ const cv=document.getElementById('skillCv'); if(!cv||!_skLayout) return; const rect=cv.getBoundingClientRect();
  const sx=(ev.clientX-rect.left)*(cv.width/rect.width), sy=(ev.clientY-rect.top)*(cv.height/rect.height);
  for(const s of _skLayout.nodes){ const R=s.a?30:26; if(Math.hypot(sx-s.x,sy-s.y)<R){ _skSel=s.n?s.n.id:s.a.id; navigator.vibrate&&navigator.vibrate(8); _skRefresh(); return; } }
}
function _skDetailBar(){ const el=document.getElementById('skDetail'); const ch=curChar(); if(!el||!ch) return; const sel=_skSel;
  let info='<span class="skDhint">Select a node to inspect it.</span>', act='';
  if(sel){ const n=nodeById(ch.cls,sel);
    if(n){ const r=nodeRank(rpg,n.id), maxed=r>=n.max, avail=nodeUnlockable(ch.cls,rpg,n);
      info='<div class="skDname">'+n.name+' <span class="skDrank">'+r+'/'+n.max+'</span></div><div class="skDdesc">'+n.desc+'</div>';
      act = maxed?'<button class="mbtn go" disabled>MAXED</button>'
        : '<button class="mbtn go" id="skLearn"'+(avail?'':' disabled')+'>LEARN · '+n.cost+'p</button>';
    } else { const t=treeOf(ch.cls); const a=t.ascend.find(x=>x.id===sel);
      if(a){ const chosen=ascendInfo(ch.cls,rpg), isC=chosen&&chosen.id===a.id, ready=ascendReady(ch.cls,rpg);
        info='<div class="skDname" style="color:'+a.color+'">✦ '+a.name+'</div><div class="skDdesc">'+a.desc+'</div>';
        act = isC?'<button class="mbtn go" disabled>ASCENDED</button>'
          : (chosen?'<button class="mbtn" disabled>already ascended</button>'
          : '<button class="mbtn go" id="skAsc"'+(ready?'':' disabled')+'>'+(ready?'ASCEND':'Lv40 + 14 pts')+'</button>'); } } }
  el.innerHTML='<div class="skDinfo">'+info+'</div><div class="skDact">'+act+'</div>';
  const lb=document.getElementById('skLearn'); if(lb) lb.onclick=()=>{ if(unlockNode(ch.cls,rpg,sel)){ recalcStats(); saveRPG(); _skRefresh(); navigator.vibrate&&navigator.vibrate(12);} else navigator.vibrate&&navigator.vibrate(15); };
  const ab=document.getElementById('skAsc'); if(ab) ab.onclick=()=>{ const a=treeOf(ch.cls).ascend.find(x=>x.id===sel); if(a&&confirm('Ascend to '+a.name+'? This is permanent.')){ if(doAscend(ch.cls,rpg,sel)){ recalcStats(); saveRPG(); _skRefresh(); } } };
}
function _skRefresh(){ const ch=curChar(); if(!ch) return; const cc=CLASSES[Math.max(0,CLASSES.findIndex(x=>x.id===ch.cls))];
  const tt=document.getElementById('skTitle'); if(tt) tt.textContent='SKILLS · '+(cc?cc.n:ch.cls);
  const pp=document.getElementById('skPts'); if(pp) pp.innerHTML='<b>'+rpg.perkPts+'</b> points';
  _skDetailBar(); _skDraw();
}
function _skStartAnim(){ _skStopAnim(); const step=()=>{ const ov=document.getElementById('skillScr'); if(!ov||ov.style.display==='none'){ _skRaf=0; return; } _skDraw(); _skRaf=requestAnimationFrame(step); }; _skRaf=requestAnimationFrame(step); }
function _skStopAnim(){ if(_skRaf) cancelAnimationFrame(_skRaf); _skRaf=0; }

// ----- aggregate all effects (nodes + ascension) into a stat/flag delta -----
function treeStats(cls,rpg){
  const d={atk:0,def:0,hp:0,mp:0,spd:0,dex:0,wis:0,vit:0,luck:0,fort:0,
    hpPct:0,atkPct:0,crit:0,critMult:0,ls:0,thorns:0,dr:0,rof:0,cleave:0,
    shots:0,pierce:0,mpregen:0,abilPow:0,projSpd:0,regen:0,slow:0,
    // ascension capstone mechanics (design rule: capstones DO what they SAY)
    auraHeal:0,critPierce:0,dashInv:0,fork:0,groundFire:0,splash:0,critDashCd:0,
    vanishHurt:0,killHeal:0,chainHit:0,execute:0,killInv:0,overshield:0,burnHit:0,
    bloodNova:0,moveDr:0,curse:0,shatter:0,slowAura:0,critBolt:0,moveRof:0,
    summonX2:0,homing:0,terrainGhost:0,stun3:0,groundHeal:0,allyDot:0,allyHaste:0,
    echoCast:0,spiritDur:0,dashBlast:0,poisonHit:0,shockHit:0,bleedHit:0,weakHit:0};
  const t=treeOf(cls); if(!t||!rpg) return d;
  const add=(eff,mult)=>{ if(!eff) return; for(const k in eff) if(k in d) d[k]+=eff[k]*(mult||1); };
  for(const b of t.branches) for(const n of b.nodes){ const r=nodeRank(rpg,n.id); if(r) add(n.eff,r); }
  const asc=ascendInfo(cls,rpg); if(asc) add(asc.eff,1);
  // Flat stat/rate bonuses scale with LEVEL so tree investment stays relevant end-game
  // (the % nodes — hpPct/atkPct/spd/crit/dr/... and count flags — already scale or are
  //  intentionally level-invariant). ~1x at Lv1 -> ~3x at Lv150.
  const lm=1+Math.max(0,(rpg.lvl||1)-1)*0.014;
  for(const k of ['atk','def','hp','mp','dex','wis','vit','luck','fort','regen','mpregen'])
    d[k]=Math.round(d[k]*lm*10)/10;
  return d;
}

// ===== abilities unlock through the tree (start with the class's first ability) =====
function abilityStarter(cls){ const p=(typeof APOOL!=='undefined')&&APOOL[cls]; return (p&&p[0])?p[0].id:null; }
function unlockedAbils(cls,rpg){ const set=new Set(); const st=abilityStarter(cls); if(st) set.add(st);
  const t=treeOf(cls); if(t&&rpg&&rpg.tree) for(const b of t.branches) for(const n of b.nodes)
    if(n.ability && nodeRank(rpg,n.id)>0) set.add(n.ability);
  return set; }
function isAbilUnlocked(cls,rpg,id){ return unlockedAbils(cls,rpg).has(id); }
// Inject ability-unlock nodes into every class tree from its APOOL (ability #0 is the free
// starter; #1.. become unlock nodes hung off the branches — extra forks/dead-ends too).
(function _injectAbilityNodes(){ if(typeof APOOL==='undefined'||typeof CLASS_TREE==='undefined') return;
  for(const cls in CLASS_TREE){ const t=CLASS_TREE[cls], pool=APOOL[cls]; if(!pool||!t.branches) continue;
    for(let i=1;i<pool.length;i++){ const ab=pool[i], br=t.branches[(i-1)%t.branches.length];
      if(!br.nodes.length) continue; const anchor=br.nodes[(i-1)%br.nodes.length];
      br.nodes.push({id:'ab_'+ab.id, name:ab.name, desc:'Unlock ability — '+ab.desc,
        cost:2, max:1, req:[anchor.id], eff:{}, ability:ab.id}); }
  }
})();
