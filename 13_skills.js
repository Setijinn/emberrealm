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

function perkTotalFor(lvl){ return Math.floor((lvl||1)/2); }        // total points earned by level
function xpTreeInit(rpg){
  if(rpg.perkEarned===undefined) rpg.perkEarned=0;
  if(rpg.perkPts===undefined) rpg.perkPts=0;
  if(!rpg.tree) rpg.tree={};                 // nodeId -> ranks
  if(rpg.ascension===undefined) rpg.ascension=null;
}
// award points to catch up to the level (called after level ups)
function grantPerkPoints(rpg){ xpTreeInit(rpg);
  const total=perkTotalFor(rpg.lvl);
  if(total>rpg.perkEarned){ rpg.perkPts+=(total-rpg.perkEarned); rpg.perkEarned=total; }
}

// ----- tree data. Each class: {branches:[{key,name,color,nodes:[...]}], ascend:[{...}x3]} -----
// node: {id,name,desc,cost,max,req,eff}  (req = array of prerequisite node ids; eff per-rank)
const CLASS_TREE = {
 knight: {
  branches: [
   { key:'bulwark', name:'Bulwark', color:'#7d8a99', nodes:[
     {id:'k_b1', name:'Iron Skin',   desc:'+8 DEF per rank',            cost:1, max:3, req:[],        eff:{def:8}},
     {id:'k_b2', name:'Toughened',   desc:'+8% max HP per rank',        cost:2, max:2, req:['k_b1'],  eff:{hpPct:0.08}},
     {id:'k_b3', name:'Bulwark',     desc:'Keystone: take 12% less damage', cost:3, max:1, req:['k_b2'], eff:{dr:0.12}},
     {id:'k_b4', name:'Retribution', desc:'Reflect 25% of melee damage', cost:2, max:1, req:['k_b3'],  eff:{thorns:0.25}},
     {id:'k_b5', name:'Unbreakable', desc:'Keystone: +18 DEF and +10% HP',cost:3, max:1, req:['k_b4'], eff:{def:18,hpPct:0.10}},
   ]},
   { key:'vanguard', name:'Vanguard', color:'#6aae7a', nodes:[
     {id:'k_v1', name:'Footwork',    desc:'+6% move speed per rank',     cost:1, max:3, req:[],        eff:{spd:0.06}},
     {id:'k_v2', name:'Momentum',    desc:'+8% attack speed per rank',   cost:2, max:2, req:['k_v1'],  eff:{rof:0.08}},
     {id:'k_v3', name:'Vigor',       desc:'+10 VIT (HP + regen)',        cost:2, max:2, req:['k_v1'],  eff:{vit:10}},
     {id:'k_v4', name:'Second Wind', desc:'Keystone: +12% HP, +20% regen',cost:3, max:1, req:['k_v2','k_v3'], eff:{hpPct:0.12,vit:16}},
     {id:'k_v5', name:'Warlust',     desc:'Keystone: +14% attack speed', cost:3, max:1, req:['k_v4'],  eff:{rof:0.14}},
   ]},
   { key:'onslaught', name:'Onslaught', color:'#c0504a', nodes:[
     {id:'k_o1', name:'Sharpened',   desc:'+4 ATK per rank',             cost:1, max:3, req:[],        eff:{atk:4}},
     {id:'k_o2', name:'Bloodthirst', desc:'+5% crit chance per rank',    cost:2, max:2, req:['k_o1'],  eff:{crit:0.05}},
     {id:'k_o3', name:'Cleave',      desc:'Keystone: attacks pierce +1', cost:3, max:1, req:['k_o1'],  eff:{cleave:1}},
     {id:'k_o4', name:'Lifedrink',   desc:'Heal 6% of damage dealt',     cost:2, max:1, req:['k_o2'],  eff:{ls:0.06}},
     {id:'k_o5', name:'Executioner', desc:'Keystone: +10 ATK, +8% crit', cost:3, max:1, req:['k_o3','k_o4'], eff:{atk:10,crit:0.08}},
   ]},
  ],
  ascend: [
   {id:'templar',  name:'Templar',  color:'#d4b96a', desc:'Holy bulwark. +25% HP, +20 DEF, take 10% less damage. Capstone: a radiant aura that heals you over time.',
    eff:{hpPct:0.25,def:20,dr:0.10}},
   {id:'warlord',  name:'Warlord',  color:'#c0392b', desc:'Relentless attacker. +14 ATK, +15% crit, +10% attack speed. Capstone: strikes cleave through foes.',
    eff:{atk:14,crit:0.15,rof:0.10,cleave:1}},
   {id:'sentinel', name:'Sentinel', color:'#5a7a9c', desc:'Immovable guardian. +18% HP, +14 DEF, reflect 40% melee, +10% move. Capstone: hold the line.',
    eff:{hpPct:0.18,def:14,thorns:0.40,spd:0.10}},
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
   {id:'r_b3',name:'Split Shot',desc:'Keystone: +1 arrow',cost:3,max:1,req:['r_b1'],eff:{shots:1}},
   {id:'r_b4',name:'Barbed',desc:'+8% damage',cost:2,max:1,req:['r_b2'],eff:{atkPct:0.08}},
   {id:'r_b5',name:'Storm of Arrows',desc:'Keystone: +1 arrow, +10% damage',cost:3,max:1,req:['r_b3','r_b4'],eff:{shots:1,atkPct:0.10}},
  ]}],
  ascend:[
   {id:'sharpshooter',name:'Sharpshooter',color:'#e8b34b',desc:'Precision incarnate. +12% crit, +50% crit damage, +1 pierce. Capstone: crits ignore armor.',eff:{crit:0.12,critMult:0.50,pierce:1}},
   {id:'windranger',name:'Windranger',color:'#6aae7a',desc:'Never stops moving. +18% move, +18% attack speed, +12% HP. Capstone: dashes leave no opening.',eff:{spd:0.18,rof:0.18,hpPct:0.12}},
   {id:'tempest_r',name:'Tempest',color:'#c0504a',desc:'A hail of death. +2 arrows, +12% damage, +10% attack speed. Capstone: every shot forks.',eff:{shots:2,atkPct:0.12,rof:0.10}},
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
   {id:'p_c3',name:'Twin Flame',desc:'Keystone: +1 projectile',cost:3,max:1,req:['p_c1'],eff:{shots:1}},
   {id:'p_c4',name:'Burning Aim',desc:'+5% crit',cost:2,max:1,req:['p_c2'],eff:{crit:0.05}},
   {id:'p_c5',name:'Firestorm',desc:'Keystone: +1 projectile, +10% damage',cost:3,max:1,req:['p_c3','p_c4'],eff:{shots:1,atkPct:0.10}},
  ]},
  {key:'ashwarden',name:'Ashwarden',color:'#7d8a99',nodes:[
   {id:'p_a1',name:'Emberskin',desc:'+6 DEF per rank',cost:1,max:3,req:[],eff:{def:6}},
   {id:'p_a2',name:'Warmth',desc:'+8% max HP per rank',cost:2,max:2,req:['p_a1'],eff:{hpPct:0.08}},
   {id:'p_a3',name:'Cinder Ward',desc:'Keystone: take 10% less damage',cost:3,max:1,req:['p_a2'],eff:{dr:0.10}},
   {id:'p_a4',name:'Mana Shield',desc:'+25 max MP',cost:2,max:1,req:['p_a1'],eff:{mp:25}},
   {id:'p_a5',name:'Phoenix Heart',desc:'Keystone: +12% HP, +2 regen',cost:3,max:1,req:['p_a3'],eff:{hpPct:0.12,regen:2}},
  ]}],
  ascend:[
   {id:'infernomancer',name:'Infernomancer',color:'#e07a2e',desc:'+30% ability power, +8 WIS, +3 mana regen. Capstone: spells leave burning ground.',eff:{abilPow:0.30,wis:8,mpregen:3}},
   {id:'emberlord',name:'Emberlord',color:'#c0504a',desc:'+2 projectiles, +14% damage, +10% attack speed. Capstone: auto-shots explode.',eff:{shots:2,atkPct:0.14,rof:0.10}},
   {id:'cinderguard',name:'Cinderguard',color:'#7d8a99',desc:'+16% HP, +14 DEF, take 10% less damage. Capstone: burn your attackers.',eff:{hpPct:0.16,def:14,dr:0.10,thorns:0.30}},
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
   {id:'deathblade',name:'Deathblade',color:'#c0304a',desc:'+12% crit, +50% crit damage, +1 pierce. Capstone: crits refund a dash.',eff:{crit:0.12,critMult:0.50,pierce:1}},
   {id:'nightblade',name:'Nightblade',color:'#8a5ac0',desc:'+16% move, take 12% less damage, +10% attack speed. Capstone: vanish when hurt.',eff:{spd:0.16,dr:0.12,rof:0.10}},
   {id:'reaper',name:'Reaper',color:'#6aae7a',desc:'+10% lifesteal, +12% attack speed, +10% HP. Capstone: kills heal you fully.',eff:{ls:0.10,rof:0.12,hpPct:0.10}},
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
   {id:'as_v5',name:'Plague',desc:'Keystone: +1 projectile, +8% attack speed',cost:3,max:1,req:['as_v3','as_v4'],eff:{shots:1,rof:0.08}},
  ]},
  {key:'evasion',name:'Evasion',color:'#8a5ac0',nodes:[
   {id:'as_e1',name:'Lithe',desc:'+5% move speed per rank',cost:1,max:3,req:[],eff:{spd:0.05}},
   {id:'as_e2',name:'Toughened',desc:'+8% max HP per rank',cost:2,max:2,req:['as_e1'],eff:{hpPct:0.08}},
   {id:'as_e3',name:'Slippery',desc:'take 8% less damage per rank',cost:2,max:2,req:['as_e1'],eff:{dr:0.08}},
   {id:'as_e4',name:'Blur',desc:'Keystone: +12% move speed',cost:3,max:1,req:['as_e2'],eff:{spd:0.12}},
   {id:'as_e5',name:'Phantom',desc:'Keystone: take 12% less damage, +8% move',cost:3,max:1,req:['as_e3','as_e4'],eff:{dr:0.12,spd:0.08}},
  ]}],
  ascend:[
   {id:'nightshade',name:'Nightshade',color:'#6aae7a',desc:'+8% lifesteal, slowing shots, +1 pierce. Capstone: poisons spread between foes.',eff:{ls:0.08,slow:1,pierce:1}},
   {id:'executioner_a',name:'Executioner',color:'#c0304a',desc:'+12% crit, +70% crit damage. Capstone: execute low-HP foes instantly.',eff:{crit:0.12,critMult:0.70}},
   {id:'phantom_a',name:'Phantom',color:'#8a5ac0',desc:'+16% move, +14% less damage, +10% attack speed. Capstone: untargetable after a kill.',eff:{spd:0.16,dr:0.14,rof:0.10}},
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
   {id:'cl_r3',name:'Dawnray',desc:'Keystone: +1 projectile',cost:3,max:1,req:['cl_r1'],eff:{shots:1}},
   {id:'cl_r4',name:'Judgment',desc:'+6% crit',cost:2,max:1,req:['cl_r2'],eff:{crit:0.06}},
   {id:'cl_r5',name:'Wrath',desc:'Keystone: +14% damage, +1 projectile',cost:3,max:1,req:['cl_r3','cl_r4'],eff:{atkPct:0.14,shots:1}},
  ]},
  {key:'sanctuary',name:'Sanctuary',color:'#7d8a99',nodes:[
   {id:'cl_s1',name:'Aegis',desc:'+6 DEF per rank',cost:1,max:3,req:[],eff:{def:6}},
   {id:'cl_s2',name:'Fortitude',desc:'+8% max HP per rank',cost:2,max:2,req:['cl_s1'],eff:{hpPct:0.08}},
   {id:'cl_s3',name:'Ward',desc:'Keystone: take 12% less damage',cost:3,max:1,req:['cl_s2'],eff:{dr:0.12}},
   {id:'cl_s4',name:'Retribution',desc:'reflect 20% melee damage',cost:2,max:1,req:['cl_s1'],eff:{thorns:0.20}},
   {id:'cl_s5',name:'Bastion',desc:'Keystone: +14% HP, +12 DEF',cost:3,max:1,req:['cl_s3'],eff:{hpPct:0.14,def:12}},
  ]}],
  ascend:[
   {id:'bishop',name:'Bishop',color:'#d4b96a',desc:'+26% ability power, +8 WIS, +3 mana regen. Capstone: heals overflow into a shield.',eff:{abilPow:0.26,wis:8,mpregen:3}},
   {id:'inquisitor',name:'Inquisitor',color:'#e8b34b',desc:'+1 projectile, +16% damage, +10% crit, +1 pierce. Capstone: holy bolts scorch.',eff:{shots:1,atkPct:0.16,crit:0.10,pierce:1}},
   {id:'warden_c',name:'Warden',color:'#7d8a99',desc:'+18% HP, +16 DEF, take 12% less damage. Capstone: your aura shields allies.',eff:{hpPct:0.18,def:16,dr:0.12}},
  ]},
 berserker:{ branches:[
  {key:'fury',name:'Fury',color:'#c0504a',nodes:[
   {id:'be_f1',name:'Brutality',desc:'+5 ATK per rank',cost:1,max:3,req:[],eff:{atk:5}},
   {id:'be_f2',name:'Savage',desc:'+6% crit per rank',cost:2,max:2,req:['be_f1'],eff:{crit:0.06}},
   {id:'be_f3',name:'Cleave',desc:'Keystone: attacks cleave +1',cost:3,max:1,req:['be_f1'],eff:{cleave:1}},
   {id:'be_f4',name:'Reckless',desc:'+8% damage',cost:2,max:1,req:['be_f2'],eff:{atkPct:0.08}},
   {id:'be_f5',name:'Rampage',desc:'Keystone: +12 ATK, cleave +1',cost:3,max:1,req:['be_f3','be_f4'],eff:{atk:12,cleave:1}},
  ]},
  {key:'bloodrage',name:'Bloodrage',color:'#8a5ac0',nodes:[
   {id:'be_b1',name:'Thick Hide',desc:'+8% max HP per rank',cost:1,max:3,req:[],eff:{hpPct:0.08}},
   {id:'be_b2',name:'Bloodthirst',desc:'Heal 5% of damage dealt',cost:2,max:2,req:['be_b1'],eff:{ls:0.05}},
   {id:'be_b3',name:'Regenerate',desc:'+2 regen',cost:2,max:1,req:['be_b1'],eff:{regen:2}},
   {id:'be_b4',name:'Sanguine',desc:'Keystone: +8% lifesteal',cost:3,max:1,req:['be_b2'],eff:{ls:0.08}},
   {id:'be_b5',name:'Undying',desc:'Keystone: +14% HP, +2 regen',cost:3,max:1,req:['be_b3'],eff:{hpPct:0.14,regen:2}},
  ]},
  {key:'warpath',name:'Warpath',color:'#e07a2e',nodes:[
   {id:'be_w1',name:'Charge',desc:'+5% move speed per rank',cost:1,max:3,req:[],eff:{spd:0.05}},
   {id:'be_w2',name:'Frenzy',desc:'+8% attack speed per rank',cost:2,max:2,req:['be_w1'],eff:{rof:0.08}},
   {id:'be_w3',name:'Bloodlust',desc:'Keystone: +10% attack speed',cost:3,max:1,req:['be_w2'],eff:{rof:0.10}},
   {id:'be_w4',name:'Ironhide',desc:'+6 DEF per rank',cost:2,max:2,req:[],eff:{def:6}},
   {id:'be_w5',name:'Warpath',desc:'Keystone: +12% move, +10% attack speed',cost:3,max:1,req:['be_w3'],eff:{spd:0.12,rof:0.10}},
  ]}],
  ascend:[
   {id:'ravager',name:'Ravager',color:'#c0504a',desc:'+16 ATK, cleave +2, +10% crit. Capstone: hits chain to nearby foes.',eff:{atk:16,cleave:2,crit:0.10}},
   {id:'bloodlord',name:'Bloodlord',color:'#8a5ac0',desc:'+12% lifesteal, +20% HP, +3 regen. Capstone: overheal becomes damage.',eff:{ls:0.12,hpPct:0.20,regen:3}},
   {id:'juggernaut',name:'Juggernaut',color:'#e07a2e',desc:'+14% move, +16% attack speed, +14 DEF. Capstone: unstoppable — immune to slows.',eff:{spd:0.14,rof:0.16,def:14}},
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
   {id:'soulflayer',name:'Soulflayer',color:'#8a5ac0',desc:'+26% ability power, +10% lifesteal, +8 WIS. Capstone: drain past full into a shield.',eff:{abilPow:0.26,ls:0.10,wis:8}},
   {id:'doomcaller',name:'Doomcaller',color:'#c0304a',desc:'+2 pierce, +16% damage, +10% crit. Capstone: bolts curse on hit.',eff:{pierce:2,atkPct:0.16,crit:0.10}},
   {id:'dreadlord',name:'Dreadlord',color:'#7d8a99',desc:'+18% HP, reflect 40%, +14 DEF. Capstone: pain shared with all nearby foes.',eff:{hpPct:0.18,thorns:0.40,def:14}},
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
   {id:'fr_s2',name:'Ice Shards',desc:'Keystone: +1 projectile',cost:3,max:1,req:['fr_s1'],eff:{shots:1}},
   {id:'fr_s3',name:'Frostbite Aim',desc:'+6% crit per rank',cost:2,max:2,req:['fr_s1'],eff:{crit:0.06}},
   {id:'fr_s4',name:'Cold Snap',desc:'+8% damage per rank',cost:2,max:2,req:['fr_s2'],eff:{atkPct:0.08}},
   {id:'fr_s5',name:'Shatter',desc:'Keystone: +1 projectile, +30% crit damage',cost:3,max:1,req:['fr_s3','fr_s4'],eff:{shots:1,critMult:0.30}},
  ]}],
  ascend:[
   {id:'cryomancer',name:'Cryomancer',color:'#5a9cc0',desc:'+28% ability power, slowing shots, +8 WIS. Capstone: frozen foes shatter.',eff:{abilPow:0.28,slow:1,wis:8}},
   {id:'frostwarden',name:'Frostwarden',color:'#7d8a99',desc:'+18% HP, +16 DEF, reflect 40%. Capstone: an icy aura slows all near.',eff:{hpPct:0.18,def:16,thorns:0.40}},
   {id:'icebreaker',name:'Icebreaker',color:'#c0504a',desc:'+2 projectiles, +14% damage, +8% crit, +1 pierce. Capstone: shards pierce frozen foes.',eff:{shots:2,atkPct:0.14,crit:0.08,pierce:1}},
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
   {id:'st_v2',name:'Fork',desc:'Keystone: +1 projectile',cost:3,max:1,req:['st_v1'],eff:{shots:1}},
   {id:'st_v3',name:'Shock',desc:'+6% crit per rank',cost:2,max:2,req:['st_v1'],eff:{crit:0.06}},
   {id:'st_v4',name:'Amplify',desc:'+8% damage per rank',cost:2,max:2,req:['st_v2'],eff:{atkPct:0.08}},
   {id:'st_v5',name:'Thunderclap',desc:'Keystone: +1 projectile, +12% damage',cost:3,max:1,req:['st_v3','st_v4'],eff:{shots:1,atkPct:0.12}},
  ]},
  {key:'ionize',name:'Ionize',color:'#6aae7a',nodes:[
   {id:'st_i1',name:'Static Step',desc:'+6% move speed per rank',cost:1,max:3,req:[],eff:{spd:0.06}},
   {id:'st_i2',name:'Quicken',desc:'+8% attack speed per rank',cost:2,max:2,req:['st_i1'],eff:{rof:0.08}},
   {id:'st_i3',name:'Blink',desc:'Keystone: +10% move speed',cost:3,max:1,req:['st_i1'],eff:{spd:0.10}},
   {id:'st_i4',name:'Charged Skin',desc:'+8% max HP per rank',cost:2,max:2,req:[],eff:{hpPct:0.08}},
   {id:'st_i5',name:'Overdrive',desc:'Keystone: +10% attack speed, +8% move',cost:3,max:1,req:['st_i2','st_i3'],eff:{rof:0.10,spd:0.08}},
  ]}],
  ascend:[
   {id:'stormlord',name:'Stormlord',color:'#5a9cc0',desc:'+28% ability power, +2 pierce, +8 WIS. Capstone: bolts chain to more foes.',eff:{abilPow:0.28,pierce:2,wis:8}},
   {id:'thunderer',name:'Thunderer',color:'#c0504a',desc:'+2 projectiles, +14% damage, +10% crit. Capstone: crits call down lightning.',eff:{shots:2,atkPct:0.14,crit:0.10}},
   {id:'galewalker',name:'Galewalker',color:'#6aae7a',desc:'+16% move, +16% attack speed, +10% HP. Capstone: cast at full speed while moving.',eff:{spd:0.16,rof:0.16,hpPct:0.10}},
  ]},
 hunter:{ branches:[
  {key:'beastmaster',name:'Beastmaster',color:'#6aae7a',nodes:[
   {id:'hu_b1',name:'Bond',desc:'+4 ATK per rank',cost:1,max:3,req:[],eff:{atk:4}},
   {id:'hu_b2',name:'Kinship',desc:'+6% ability power per rank',cost:2,max:2,req:['hu_b1'],eff:{abilPow:0.06}},
   {id:'hu_b3',name:'Twin Shot',desc:'Keystone: +1 projectile',cost:3,max:1,req:['hu_b1'],eff:{shots:1}},
   {id:'hu_b4',name:'Wild Aim',desc:'+5% crit',cost:2,max:1,req:['hu_b1'],eff:{crit:0.05}},
   {id:'hu_b5',name:'Alpha',desc:'Keystone: +10% damage, +8% ability power',cost:3,max:1,req:['hu_b3','hu_b4'],eff:{atkPct:0.10,abilPow:0.08}},
  ]},
  {key:'trapper',name:'Trapper',color:'#5a9cc0',nodes:[
   {id:'hu_t1',name:'Deft Hands',desc:'+3 DEX per rank',cost:1,max:3,req:[],eff:{dex:3}},
   {id:'hu_t2',name:'Snare',desc:'Keystone: attacks slow foes',cost:2,max:1,req:['hu_t1'],eff:{slow:1}},
   {id:'hu_t3',name:'Rapid Trap',desc:'+8% attack speed per rank',cost:2,max:2,req:['hu_t1'],eff:{rof:0.08}},
   {id:'hu_t4',name:'Barbed Trap',desc:'Keystone: shots pierce +1',cost:3,max:1,req:['hu_t2'],eff:{pierce:1}},
   {id:'hu_t5',name:'Volley Trap',desc:'Keystone: +1 projectile, +8% attack speed',cost:3,max:1,req:['hu_t3','hu_t4'],eff:{shots:1,rof:0.08}},
  ]},
  {key:'survivalist',name:'Survivalist',color:'#7d8a99',nodes:[
   {id:'hu_s1',name:'Rugged',desc:'+8% max HP per rank',cost:1,max:3,req:[],eff:{hpPct:0.08}},
   {id:'hu_s2',name:'Fleet Foot',desc:'+5% move speed per rank',cost:2,max:2,req:['hu_s1'],eff:{spd:0.05}},
   {id:'hu_s3',name:'Camouflage',desc:'Keystone: +2 regen, take 8% less damage',cost:3,max:1,req:['hu_s1'],eff:{regen:2,dr:0.08}},
   {id:'hu_s4',name:'Bracing',desc:'+6 DEF per rank',cost:2,max:2,req:[],eff:{def:6}},
   {id:'hu_s5',name:'Wanderer',desc:'Keystone: +12% HP, +10% move',cost:3,max:1,req:['hu_s2','hu_s3'],eff:{hpPct:0.12,spd:0.10}},
  ]}],
  ascend:[
   {id:'packlord',name:'Packlord',color:'#6aae7a',desc:'+16% damage, +12% ability power, +1 projectile. Capstone: summons come in pairs.',eff:{atkPct:0.16,abilPow:0.12,shots:1}},
   {id:'falconer',name:'Falconer',color:'#5a9cc0',desc:'+2 projectiles, slowing shots, +10% attack speed. Capstone: shots seek out foes.',eff:{shots:2,slow:1,rof:0.10}},
   {id:'pathwarden',name:'Pathwarden',color:'#7d8a99',desc:'+18% HP, +14% move, +2 regen. Capstone: unhindered by terrain.',eff:{hpPct:0.18,spd:0.14,regen:2}},
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
   {id:'grandmaster',name:'Grandmaster',color:'#c0504a',desc:'+16% attack speed, +10% crit, +8 ATK. Capstone: every third strike stuns.',eff:{rof:0.16,crit:0.10,atk:8}},
   {id:'windwalker',name:'Windwalker',color:'#6aae7a',desc:'+18% move, +12% attack speed, take 12% less damage. Capstone: dash through foes.',eff:{spd:0.18,rof:0.12,dr:0.12}},
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
   {id:'crusader',name:'Crusader',color:'#e8b34b',desc:'+12 ATK, cleave +2, +10% crit. Capstone: smites explode.',eff:{atk:12,cleave:2,crit:0.10}},
   {id:'guardian',name:'Guardian',color:'#7d8a99',desc:'+18% HP, +18 DEF, take 12% less damage. Capstone: shields nearby allies.',eff:{hpPct:0.18,def:18,dr:0.12}},
   {id:'highpriest',name:'High Priest',color:'#d4b96a',desc:'+24% ability power, +8 WIS, +3 regen. Capstone: consecrated ground heals.',eff:{abilPow:0.24,wis:8,regen:3}},
  ]},
 necro:{ branches:[
  {key:'undeath',name:'Undeath',color:'#6aae7a',nodes:[
   {id:'ne_u1',name:'Command',desc:'+4 ATK per rank',cost:1,max:3,req:[],eff:{atk:4}},
   {id:'ne_u2',name:'Dark Ritual',desc:'+8% ability power per rank',cost:2,max:2,req:['ne_u1'],eff:{abilPow:0.08}},
   {id:'ne_u3',name:'Bone Legion',desc:'Keystone: +1 projectile',cost:3,max:1,req:['ne_u1'],eff:{shots:1}},
   {id:'ne_u4',name:'Grave Feast',desc:'heal 5% of damage dealt',cost:2,max:1,req:['ne_u2'],eff:{ls:0.05}},
   {id:'ne_u5',name:'Master of Death',desc:'Keystone: +12% damage, +8% ability power',cost:3,max:1,req:['ne_u3','ne_u4'],eff:{atkPct:0.12,abilPow:0.08}},
  ]},
  {key:'bonecraft',name:'Bonecraft',color:'#c0304a',nodes:[
   {id:'ne_b1',name:'Marrow',desc:'+5 WIS per rank',cost:1,max:3,req:[],eff:{wis:5}},
   {id:'ne_b2',name:'Bone Spear',desc:'Keystone: bolts pierce +1',cost:3,max:1,req:['ne_b1'],eff:{pierce:1}},
   {id:'ne_b3',name:'Malice',desc:'+6% crit per rank',cost:2,max:2,req:['ne_b1'],eff:{crit:0.06}},
   {id:'ne_b4',name:'Decay',desc:'+8% damage per rank',cost:2,max:2,req:['ne_b2'],eff:{atkPct:0.08}},
   {id:'ne_b5',name:'Impale',desc:'Keystone: bolts pierce +1, +14% damage',cost:3,max:1,req:['ne_b3','ne_b4'],eff:{pierce:1,atkPct:0.14}},
  ]},
  {key:'soulwell',name:'Soulwell',color:'#8a5ac0',nodes:[
   {id:'ne_s1',name:'Soul Vigor',desc:'+8% max HP per rank',cost:1,max:3,req:[],eff:{hpPct:0.08}},
   {id:'ne_s2',name:'Soul Font',desc:'+25 MP, +2 mana regen',cost:2,max:2,req:['ne_s1'],eff:{mp:25,mpregen:2}},
   {id:'ne_s3',name:'Vampiric',desc:'Keystone: +8% lifesteal',cost:3,max:1,req:['ne_s1'],eff:{ls:0.08}},
   {id:'ne_s4',name:'Bone Wall',desc:'reflect 20% melee damage',cost:2,max:1,req:['ne_s1'],eff:{thorns:0.20}},
   {id:'ne_s5',name:'Undying',desc:'Keystone: +12% HP, take 8% less damage',cost:3,max:1,req:['ne_s2','ne_s3'],eff:{hpPct:0.12,dr:0.08}},
  ]}],
  ascend:[
   {id:'lich',name:'Lich',color:'#8a5ac0',desc:'+26% ability power, +12% lifesteal, +8 WIS. Capstone: raise more skeletons.',eff:{abilPow:0.26,ls:0.12,wis:8}},
   {id:'bonelord',name:'Bonelord',color:'#c0304a',desc:'+2 pierce, +16% damage, +10% crit. Capstone: bone spears explode.',eff:{pierce:2,atkPct:0.16,crit:0.10}},
   {id:'plaguebringer',name:'Plaguebringer',color:'#6aae7a',desc:'+16% damage, +10% ability power, +1 projectile. Capstone: minions spread plague.',eff:{atkPct:0.16,abilPow:0.10,shots:1}},
  ]},
 bard:{ branches:[
  {key:'cadence',name:'Cadence',color:'#c07ad4',nodes:[
   {id:'ba_c1',name:'Rhythm',desc:'+6% attack speed per rank',cost:1,max:2,req:[],eff:{rof:0.06}},
   {id:'ba_c2',name:'Sharp Note',desc:'+4 ATK per rank',cost:1,max:3,req:['ba_c1'],eff:{atk:4}},
   {id:'ba_c3',name:'Allegro',desc:'Keystone: +10% attack speed',cost:3,max:1,req:['ba_c1'],eff:{rof:0.10}},
   {id:'ba_c4',name:'Crescendo',desc:'+6% crit per rank',cost:2,max:2,req:['ba_c2'],eff:{crit:0.06}},
   {id:'ba_c5',name:'Finale',desc:'Keystone: +1 projectile, +8% attack speed',cost:3,max:1,req:['ba_c3','ba_c4'],eff:{shots:1,rof:0.08}},
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
   {id:'maestro',name:'Maestro',color:'#c07ad4',desc:'+1 projectile, +16% attack speed, +10% crit. Capstone: your song never ends.',eff:{shots:1,rof:0.16,crit:0.10}},
   {id:'skald',name:'Skald',color:'#6aae7a',desc:'+18% HP, +14% move, +6% lifesteal. Capstone: allies share your tempo.',eff:{hpPct:0.18,spd:0.14,ls:0.06}},
   {id:'loremaster',name:'Loremaster',color:'#d4b96a',desc:'+24% ability power, +8 WIS, +8 FORTUNE. Capstone: spells echo twice.',eff:{abilPow:0.24,wis:8,fort:8}},
  ]},
 shaman:{ branches:[
  {key:'spirits',name:'Spirits',color:'#4fb0a0',nodes:[
   {id:'sh_s1',name:'Totemic',desc:'+4 ATK per rank',cost:1,max:3,req:[],eff:{atk:4}},
   {id:'sh_s2',name:'Split Spirit',desc:'Keystone: +1 projectile',cost:3,max:1,req:['sh_s1'],eff:{shots:1}},
   {id:'sh_s3',name:'Spirit Power',desc:'+8% ability power per rank',cost:2,max:2,req:['sh_s1'],eff:{abilPow:0.08}},
   {id:'sh_s4',name:'Wild Spirit',desc:'+6% crit',cost:2,max:1,req:['sh_s2'],eff:{crit:0.06}},
   {id:'sh_s5',name:'Spirit Legion',desc:'Keystone: +1 projectile, +12% damage',cost:3,max:1,req:['sh_s3','sh_s4'],eff:{shots:1,atkPct:0.12}},
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
   {id:'spiritcaller',name:'Spiritcaller',color:'#4fb0a0',desc:'+2 projectiles, +14% damage, +10% ability power. Capstone: spirits orbit longer.',eff:{shots:2,atkPct:0.14,abilPow:0.10}},
   {id:'tidesage',name:'Tidesage',color:'#5a9cc0',desc:'+26% ability power, slowing shots, +1 pierce. Capstone: totems chain heal and harm.',eff:{abilPow:0.26,slow:1,pierce:1}},
   {id:'earthwarden',name:'Earthwarden',color:'#6aae7a',desc:'+18% HP, +16 DEF, +3 regen. Capstone: roots shield you.',eff:{hpPct:0.18,def:16,regen:3}},
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
   {id:'skylord',name:'Skylord',color:'#6aae7a',desc:'+16% move, +14% attack speed, +12% HP. Capstone: leaps crater on landing.',eff:{spd:0.16,rof:0.14,hpPct:0.12}},
   {id:'dragonlord',name:'Dragonlord',color:'#7d8a99',desc:'+18% HP, +18 DEF, reflect 40%. Capstone: scales deflect projectiles.',eff:{hpPct:0.18,def:18,thorns:0.40}},
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
  const cv=document.getElementById('skillCv'); cv.addEventListener('pointerdown',_skClick);
  document.getElementById('skRespec').onclick=()=>{ if(confirm('Refund every spent point? (ascension is kept)')){ respec(ch.cls,rpg); recalcStats(); saveRPG(); _skSel=null; _skRefresh(); } };
  document.getElementById('skX').onclick=closeSkills;
  _skSel=null; _skBuildLayout(ch.cls); _skFitCanvas(); _skRefresh(); _skStartAnim();
  addEventListener('resize',_skFitCanvas);
}
// scale the canvas DISPLAY to fit the viewport (buffer stays 690x520) so the header,
// detail bar and RESPEC/DONE buttons are always visible — the canvas can't be scrolled
// past (touch-action:none), so it must never fill the whole screen.
function _skFitCanvas(){ const cv=document.getElementById('skillCv'); if(!cv) return;
  const maxW=Math.min(960, innerWidth*0.97), maxH=innerHeight*0.55;
  const s=Math.min(maxW/960, maxH/560);
  cv.style.width=Math.round(960*s)+'px'; cv.style.height=Math.round(560*s)+'px'; }
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
    shots:0,pierce:0,mpregen:0,abilPow:0,projSpd:0,regen:0,slow:0};
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
