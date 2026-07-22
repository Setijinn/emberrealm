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

// ----- skill tree UI screen -----
function openSkills(){ const ch=curChar(); if(!ch||!rpg) return; xpTreeInit(rpg); grantPerkPoints(rpg);
  let ov=document.getElementById('skillScr');
  if(!ov){ ov=document.createElement('div'); ov.id='skillScr'; ov.addEventListener('click',_skillClick); document.body.appendChild(ov); }
  ov.style.display='flex'; _skillRender(); }
function closeSkills(){ const ov=document.getElementById('skillScr'); if(ov) ov.style.display='none';
  if(typeof recalcStats==='function') recalcStats(); if(typeof saveRPG==='function') saveRPG(); }
function _skillClick(ev){ const t=ev.target.closest('[data-act]'); if(!t) return; const act=t.getAttribute('data-act');
  const ch=curChar(); if(!ch) return;
  if(act==='close'){ closeSkills(); return; }
  if(act==='node'){ const id=t.getAttribute('data-id');
    if(unlockNode(ch.cls,rpg,id)){ recalcStats(); saveRPG(); _skillRender(); navigator.vibrate&&navigator.vibrate(12); }
    else navigator.vibrate&&navigator.vibrate(15); return; }
  if(act==='respec'){ if(confirm('Refund every spent point? (ascension is kept)')){ respec(ch.cls,rpg); recalcStats(); saveRPG(); _skillRender(); } return; }
  if(act==='ascend'){ const id=t.getAttribute('data-id'); const a=treeOf(ch.cls).ascend.find(x=>x.id===id);
    if(a && confirm('Ascend to '+a.name+'? This is permanent.')){ if(doAscend(ch.cls,rpg,id)){ recalcStats(); saveRPG(); _skillRender(); } } return; }
}
function _skillRender(){ const ov=document.getElementById('skillScr'); const ch=curChar(); if(!ov||!ch) return;
  const t=treeOf(ch.cls); const cc=CLASSES[Math.max(0,CLASSES.findIndex(x=>x.id===ch.cls))]; const cn=cc?cc.n:ch.cls;
  if(!t){ ov.innerHTML='<div class="skWrap"><div class="skTitle">SKILLS · '+cn+'</div>'
      +'<div class="skHint">This class’s skill tree is still being forged — the Knight’s is ready now, the rest are coming.</div>'
      +'<button class="mbtn go" data-act="close" style="width:100%;margin-top:14px;">DONE</button></div>'; return; }
  xpTreeInit(rpg);
  let cols='';
  for(const b of t.branches){ let nodes='';
    for(const n of b.nodes){ const r=nodeRank(rpg,n.id), owned=r>0, maxed=r>=n.max, avail=nodeUnlockable(ch.cls,rpg,n);
      const cls='skNode'+(owned?' owned':'')+(avail?' avail':'')+((!owned&&!avail)?' locked':'');
      let pips=''; if(n.max>1) for(let i=0;i<n.max;i++) pips+='<i class="'+(i<r?'on':'')+'"></i>';
      nodes+='<div class="'+cls+'" data-act="node" data-id="'+n.id+'">'
        +'<div class="skNhead"><span class="skNname">'+n.name+'</span>'
        +'<span class="skNcost">'+(maxed?'✓':(n.cost+'p'))+'</span></div>'
        +'<div class="skNdesc">'+n.desc+'</div>'
        +(pips?'<div class="skPips">'+pips+'</div>':'')+'</div>'; }
    cols+='<div class="skCol"><div class="skBname" style="color:'+b.color+'">'+b.name+'</div>'+nodes+'</div>'; }
  let asc; const chosen=ascendInfo(ch.cls,rpg);
  if(chosen){ asc='<div class="skAscHead">✦ ASCENDED — '+chosen.name+'</div>'
      +'<div class="skAscChosen" style="border-color:'+chosen.color+'"><b style="color:'+chosen.color+'">'+chosen.name+'</b>'
      +'<div class="skNdesc">'+chosen.desc+'</div></div>'; }
  else { const ready=ascendReady(ch.cls,rpg);
    asc='<div class="skAscHead">ASCENSION '+(ready?'— choose your path':'— locked (reach Lv 40, spend 14 points)')+'</div><div class="skAscRow">';
    for(const a of t.ascend){ asc+='<div class="skAsc'+(ready?' rdy':' lock')+'" '+(ready?('data-act="ascend" data-id="'+a.id+'"'):'')
        +' style="border-color:'+(ready?a.color:'#39323f')+'"><b style="color:'+a.color+'">'+a.name+'</b>'
        +'<div class="skNdesc">'+a.desc+'</div></div>'; }
    asc+='</div>'; }
  ov.innerHTML='<div class="skWrap">'
    +'<div class="skTop"><div class="skTitle">SKILLS · '+cn+'</div><div class="skPts"><b>'+rpg.perkPts+'</b> points</div></div>'
    +'<div class="skHint">Scarce points — specialize. Nodes need the one above them. Respec anytime.</div>'
    +'<div class="skCols">'+cols+'</div>'
    +asc
    +'<div class="skBtns"><button class="mbtn" data-act="respec">RESPEC</button><button class="mbtn go" data-act="close">DONE</button></div>'
    +'</div>';
}

// ----- aggregate all effects (nodes + ascension) into a stat/flag delta -----
function treeStats(cls,rpg){
  const d={atk:0,def:0,hp:0,mp:0,spd:0,dex:0,wis:0,vit:0,hpPct:0,atkPct:0,crit:0,ls:0,thorns:0,dr:0,rof:0,cleave:0};
  const t=treeOf(cls); if(!t||!rpg) return d;
  const add=(eff,mult)=>{ if(!eff) return; for(const k in eff) if(k in d) d[k]+=eff[k]*(mult||1); };
  for(const b of t.branches) for(const n of b.nodes){ const r=nodeRank(rpg,n.id); if(r) add(n.eff,r); }
  const asc=ascendInfo(cls,rpg); if(asc) add(asc.eff,1);
  return d;
}
