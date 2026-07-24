// ===================================================================================
// 16_maxstats.js — MAX-STAT TRAINING (roadmap #7... err #2)
// Per-stat SCROLLS permanently raise a stat toward a CLASS-DEPENDENT cap. Maxing ALL
// ten stats (at Lv50) is the new ASCENSION gate; ascending opens a PRESTIGE band of
// higher caps so the scroll grind continues, and unlocks the Awakened Dungeons.
//
// Model (persisted on rpg, so it survives per-character but NOT the account — it's a
// hero's own hard-won training, lost with the hero like everything else on death):
//   rpg.scrolls = { atk:n, def:n, ... }   // unspent scrolls banked, one bank per stat
//   rpg.train   = { atk:n, def:n, ... }   // scrolls invested (0..cap) -> permanent bonus
//   rpg.prestige = 0 | 1                  // rises on ascension; raises every cap
// The trained bonus folds into recalcStats as a flat stat layer (guarded by typeof).
// STATS / STAT_META / CLASSES / classBaseStats / levelStats / newStats live in 11_ui.js.
// ===================================================================================

// Each stat has its OWN targeted scroll (user: "increase a specific stat").
const SCROLL_TITLE={ atk:'Might', def:'Warding', hp:'Vigor', mp:'the Font', vit:'Vitality',
  wis:'Insight', dex:'Precision', spd:'Swiftness', luck:'Luck', fort:'Plunder' };
function scrollName(st){ return 'Scroll of '+(SCROLL_TITLE[st]||st); }

// Permanent bonus GRANTED per scroll invested (same for every class — class identity
// lives in the CAP, i.e. how many scrolls a class can sink into a stat). Tune here.
const TRAIN_STEP={ atk:5, def:3, hp:34, mp:9, vit:3, wis:5, dex:2, spd:2, luck:2, fort:2 };

// Baseline scroll CAP at affinity 1.0, and the flat caps for the two utility stats
// (SPD would break movement / FORTUNE is loot — kept class-independent + modest).
const TRAIN_BASE=12;
const FLAT_CAP={ spd:8, fort:10 };
const PRESTIGE_CAP_MUL=0.6;   // each prestige tier: +60% cap room

// ---- class affinity: derive each class's per-stat cap from its OWN natural Lv50 stat
// profile vs the roster average, so a class trains its SIGNATURE stats far and its weak
// stats little (a Knight pushes DEF/HP, a caster pushes WIS/MP). Built once, memoized.
let _affTab=null;
function _buildAff(){
  // Affinity is built from CLASS BASE stats only (pure class identity) — NOT base+level. The
  // per-level ramp is largely class-independent (e.g. +30 HP/level for everyone), so folding it
  // in would flatten the physical-stat caps to near-uniform. Base stats keep a Knight's DEF/HP
  // cap far above a caster's, and a caster's WIS/MP cap far above a Knight's. (SPD/FORT are
  // flat-capped separately, so their base values don't matter here.)
  const nat={}, sum={}; for(const s of STATS) sum[s]=0;
  for(const c of CLASSES){ const b=classBaseStats(c); nat[c.id]={};
    for(const s of STATS){ const v=(b[s]||0); nat[c.id][s]=v; sum[s]+=v; } }
  const avg={}; for(const s of STATS) avg[s]=(sum[s]/CLASSES.length)||1;
  _affTab={};
  for(const c of CLASSES){ _affTab[c.id]={};
    for(const s of STATS){ let r=avg[s]>0?nat[c.id][s]/avg[s]:1;
      _affTab[c.id][s]=Math.max(0.45,Math.min(1.9,r)); } }
}
function statAffinity(cls,st){ if(!_affTab) _buildAff(); return (_affTab[cls]&&_affTab[cls][st])||1; }

function trainCapBase(cls,st){
  if(FLAT_CAP[st]!==undefined) return FLAT_CAP[st];
  return Math.max(6,Math.min(26,Math.round(TRAIN_BASE*statAffinity(cls,st))));
}
function trainCap(cls,st,prestige){ prestige=prestige||0;
  return Math.round(trainCapBase(cls,st)*(1+PRESTIGE_CAP_MUL*prestige)); }

function initTrain(rpg){ if(!rpg) return;
  if(!rpg.train) rpg.train={};
  if(!rpg.scrolls) rpg.scrolls={};
  for(const s of STATS){ if(rpg.train[s]===undefined) rpg.train[s]=0;
    if(rpg.scrolls[s]===undefined) rpg.scrolls[s]=0; }
  if(rpg.prestige===undefined) rpg.prestige=rpg.ascension?1:0;
}

// the permanent stat block that folds into recalcStats
function trainedStats(cls,rpg){ const s=newStats(); if(!rpg||!rpg.train) return s;
  for(const k of STATS) s[k]=(rpg.train[k]||0)*(TRAIN_STEP[k]||0);
  return s; }

function statMaxed(cls,rpg,st){ return ((rpg.train&&rpg.train[st])||0) >= trainCap(cls,st,rpg.prestige||0); }
function statsMaxedCount(cls,rpg){ let n=0; for(const s of STATS) if(statMaxed(cls,rpg,s)) n++; return n; }
function allStatsMaxed(cls,rpg){ return statsMaxedCount(cls,rpg)===STATS.length; }

// invest up to n banked scrolls of `st` (n omitted = 1, Infinity = as many as possible)
function applyScroll(rpg,st,n){ const ch=curChar(); if(!ch||!rpg) return 0; initTrain(rpg);
  const cap=trainCap(ch.cls,st,rpg.prestige||0); n=(n===undefined)?1:n; let applied=0;
  while(applied<n && (rpg.scrolls[st]||0)>0 && rpg.train[st]<cap){ rpg.scrolls[st]--; rpg.train[st]++; applied++; }
  if(applied>0){ if(typeof recalcStats==='function') recalcStats();
    if(typeof saveRPG==='function') saveRPG(); if(typeof updateStatsBtn==='function') updateStatsBtn(); }
  return applied; }

function grantScroll(rpg,st,n){ if(!rpg) return; initTrain(rpg);
  rpg.scrolls[st]=(rpg.scrolls[st]||0)+(n||1); if(typeof updateStatsBtn==='function') updateStatsBtn(); }

function scrollsBanked(rpg){ if(!rpg||!rpg.scrolls) return 0; let n=0; for(const s of STATS) n+=(rpg.scrolls[s]||0); return n; }

// pick which stat a dropped scroll feeds — favour stats this hero hasn't maxed yet so the
// grind converges, but stay random enough to feel like a hunt.
function rollScrollStat(){ const ch=curChar();
  if(!ch||!rpg) return STATS[(Math.random()*STATS.length)|0];
  const open=STATS.filter(s=>!statMaxed(ch.cls,rpg,s));
  const pool=open.length?open:STATS;
  return pool[(Math.random()*pool.length)|0]; }

// drop hook, called from rollLoot(e): returns a scroll item or null. The max-stat grind is
// endgame, so scrolls only start dropping in the mid zones and pour in the Lv50 ring.
function scrollDropFor(e){ if(!e) return null; const lv=e.lv||1; if(lv<22) return null;
  const F=(typeof player!=='undefined'&&player.fortune)||0;
  let ch = (e.type==='B') ? 0.10+Math.min(0.34,(lv-20)*0.007)
                          : 0.010+Math.min(0.020,(lv-20)*0.0005);
  ch*=1+F*0.006;
  return (Math.random()<ch) ? {k:'scroll',st:rollScrollStat()} : null; }

// ------------------------------- Attributes screen -------------------------------
function updateStatsBtn(){ const b=document.getElementById('statsBtn'); if(!b) return;
  const n=(typeof rpg!=='undefined'&&rpg)?scrollsBanked(rpg):0;
  b.textContent = n>0 ? ('📜 '+n) : '📜'; }

function openStats(){ const ch=curChar(); if(!ch||!rpg) return; initTrain(rpg);
  if(typeof recalcStats==='function') recalcStats();
  let ov=document.getElementById('statsScr');
  if(!ov){ ov=document.createElement('div'); ov.id='statsScr'; document.body.appendChild(ov);
    ov.addEventListener('click',function(e){ if(e.target===ov) ov.style.display='none'; }); }
  ov.style.cssText='position:fixed;inset:0;z-index:44;display:flex;align-items:flex-start;justify-content:center;background:rgba(9,7,12,.95);overflow-y:auto;padding:14px 10px 28px;';
  _statsPaint(ov,ch);
  ov.style.display='flex';
}

function _statsPaint(ov,ch){ const cls=ch.cls, P=rpg.prestige||0;
  const cc=CLASSES[Math.max(0,CLASSES.findIndex(x=>x.id===cls))];
  const maxed=statsMaxedCount(cls,rpg), all=maxed===STATS.length;
  const ascended=!!rpg.ascension;
  // status line
  let status;
  if(ascended){ status='<span style="color:#e6c76a">✦ ASCENDED'+(P>0?' · Prestige '+_roman(P):'')+'</span> — caps raised, keep training'; }
  else if(rpg.lvl<50){ status='<b>Ascension</b> needs <span style="color:#ffc94d">Lv 50</span> &amp; all stats maxed · <span style="color:#8fd48c">'+maxed+'/'+STATS.length+' maxed</span>'; }
  else if(all){ status='<span style="color:#8fd48c">✦ READY TO ASCEND</span> — open the Skill Tree 🌟 and pick your form'; }
  else { status='<b>Ascension:</b> max every stat · <span style="color:#8fd48c">'+maxed+'/'+STATS.length+' maxed</span>'; }

  let rows='';
  for(const s of STATS){ const m=STAT_META[s], col=m.col;
    const cap=trainCap(cls,s,P), inv=rpg.train[s]||0, bank=rpg.scrolls[s]||0;
    const live=(player&&player.stats)?player.stats[s]:0;
    const bonus=inv*(TRAIN_STEP[s]||0);
    const pct=cap>0?Math.round(inv/cap*100):0, full=inv>=cap;
    const canP=bank>0 && !full;
    rows+='<div class="msRow">'
      +'<div class="msName" style="color:'+col+'">'+m.n+' <span class="msAbbr">'+m.s+'</span></div>'
      +'<div class="msVal">'+live+(bonus>0?' <span style="color:'+col+'">(+'+bonus+')</span>':'')+'</div>'
      +'<div class="msBarWrap"><div class="msBar" style="width:'+pct+'%;background:'+col+'"></div>'
        +'<span class="msBarTxt">'+inv+' / '+cap+(full?' ✓':'')+'</span></div>'
      +'<div class="msBank" style="opacity:'+(bank>0?1:.4)+'">📜 '+bank+'</div>'
      +'<button class="msBtn" data-st="'+s+'" data-act="1"'+(canP?'':' disabled')+'>+1</button>'
      +'<button class="msBtn" data-st="'+s+'" data-act="max"'+(canP?'':' disabled')+'>MAX</button>'
      +'</div>';
  }
  const totalBank=scrollsBanked(rpg);
  ov.innerHTML='<div class="msCard">'
    +'<button class="tabX" id="msX" aria-label="Close">✕</button>'
    +'<div class="msTitle">ATTRIBUTES · '+(cc?cc.n:cls)+'</div>'
    +'<div class="msStatus">'+status+'</div>'
    +'<div class="msRows">'+rows+'</div>'
    +'<div class="msFoot"><span class="msHint">Scrolls drop from bosses in the higher zones — each pours into one stat toward your class’s cap.</span>'
      +'<button class="mbtn" id="msAll"'+(totalBank>0?'':' disabled')+'>APPLY ALL</button></div>'
    +'</div>';
  document.getElementById('msX').onclick=function(){ ov.style.display='none'; };
  const rowsEl=ov.querySelector('.msRows');
  rowsEl.onclick=function(e){ const b=e.target.closest('.msBtn'); if(!b||b.disabled) return;
    const st=b.getAttribute('data-st'), act=b.getAttribute('data-act');
    const got=applyScroll(rpg, st, act==='max'?Infinity:1);
    if(got>0){ navigator.vibrate&&navigator.vibrate(10); _statsPaint(ov,ch); } };
  document.getElementById('msAll').onclick=function(){ let any=0;
    for(const s of STATS) any+=applyScroll(rpg,s,Infinity);
    if(any>0){ navigator.vibrate&&navigator.vibrate(14); _statsPaint(ov,ch); } };
}
function _roman(n){ return ['','I','II','III','IV','V','VI','VII','VIII'][n]||(''+n); }
