// ---------- PERK ENGINE (design rule 2: perks ARE the class identity) ----------
// The stat keys in 13_skills `treeStats` stay exactly as they were — this file adds the
// three things that make one class play unlike another:
//
//   cond{}  a bonus that only applies while a CONDITION holds   (below 40% HP, while moving,
//           at high resource...)  -> folded into player.dyn each frame, never into recalcStats
//   trig{}  a reaction to an EVENT (hit/crit/kill/hurt/cast/proc) -> runs a payload
//   mod{}   a rewrite of an ABILITY at cast time, matched by ability kind or id
//
// Perks chain: a payload may `emits:'<tag>'`, and another node can listen with
// {on:'proc',filter:{tag:'<tag>'}}. Any entry may carry ifOwn:'<nodeId>' so a later node
// upgrades an earlier one. Chains are depth-capped and frame-budgeted (see PROC_* below).
//
// RULE 6 (projectile count comes only from weapons) is enforced here: no payload may touch
// player.shots. `burst` spawns INDEPENDENT projectiles (same as the Tempest fork capstone).
//
// Node schema (all optional, on top of {id,name,desc,cost,max,req,eff}):
//   cond:{when,v,r,n,per,eff:{atkPct|dr|spd|rof|crit|abilPow|ls},perRank}
//   trig:{on,filter,chance,icd,do:{...},emits}
//   mod :{kind|abil,pre:{...},do:{...}}

// ===== class resource =====
// Repurposes the (previously vestigial) `res` global from 03_entities and the resource
// name/colour already defined per class in ABIL (11_ui). Classes without an entry here keep
// the old chargeRes behaviour and draw no meter.
const PERK_RES = {
  knight:    {gain:{hurt:15, hit:0.5},            decay:2.2, max:100},
  berserker: {gain:{hurt:12, hit:2.0, kill:7},    decay:6.0, max:100},
  necro:     {gain:{kill:16, hit:0.35},           decay:0,   max:100},
};
function perkResDef(cls){ if(!cls){ const ch=(typeof curChar==='function')&&curChar(); cls=ch&&ch.cls; }
  return cls?(PERK_RES[cls]||null):null; }
function perkResInfo(){ const ch=(typeof curChar==='function')&&curChar(); if(!ch) return null;
  const d=PERK_RES[ch.cls]; if(!d) return null;
  const a=(typeof ABIL!=='undefined')&&ABIL[ch.cls];
  return {def:d, name:(a&&a.res)||'Charge', col:(a&&a.col)||'#ffd07a'}; }
function resMax(){ const d=perkResDef(); return (d&&d.max)||100; }
function resFrac(){ return Math.max(0,Math.min(1,(typeof res!=='undefined'?res:0)/resMax())); }
function resAdd(n){ if(typeof res==='undefined') return; res=Math.max(0,Math.min(resMax(),res+n)); }
function resSpend(n){ if(typeof res==='undefined'||res<n) return false; res-=n; return true; }

// ===== aggregation: owned nodes -> cond/trig/mod lists (rebuilt by recalcStats) =====
function perkAgg(cls,rpg){
  // clear the live layer: switching character (or respeccing) must not carry another build's
  // conditional bonuses, stacks or internal cooldowns into the new one.
  if(typeof player!=='undefined'&&player){
    if(player.dyn) for(const k of DYN_KEYS) player.dyn[k]=0;
    player.stk={}; player._icd={}; player._t={}; player._resFull=0; }
  const A={cond:[],trig:[],mod:[],owned:{}};
  const t=(typeof treeOf==='function')?treeOf(cls):null;
  if(!t||!rpg) return A;
  const take=(src,rank,id,name)=>{
    for(const key of ['cond','trig','mod']){ const v=src[key]; if(!v) continue;
      for(const e of (Array.isArray(v)?v:[v]))
        A[key].push(Object.assign({},e,{_id:id,_r:rank,_name:name,
          ifOwn:(e.ifOwn||src.ifOwn||null)})); } };   // node-level ifOwn applies to all its entries
  for(const b of t.branches) for(const n of b.nodes){
    const r=(typeof nodeRank==='function')?nodeRank(rpg,n.id):0;
    if(!r) continue; A.owned[n.id]=r; take(n,r,n.id,n.name); }
  const asc=(typeof ascendInfo==='function')?ascendInfo(cls,rpg):null;
  if(asc) { A.owned[asc.id]=1; take(asc,1,asc.id,asc.name); }
  // ifOwn gates: an entry only lives if the node it references is owned
  for(const key of ['cond','trig','mod'])
    A[key]=A[key].filter(e=>!e.ifOwn||A.owned[e.ifOwn]);
  return A;
}
function perkOwns(id){ const P=player._perk; return !!(P&&P.owned[id]); }

// ===== conditional layer =====
// player.dyn is rebuilt every frame and read multiplicatively at 6 sites (fire, damagePlayer,
// movement, castArmed) — recalcStats stays the single source of BASE truth.
const DYN_KEYS=['atkPct','dr','spd','rof','crit','abilPow','ls'];
let _perkFrame=0;
function perkDynInit(){ if(!player.dyn){ player.dyn={}; for(const k of DYN_KEYS) player.dyn[k]=0; }
  if(!player._t) player._t={}; if(!player.stk) player.stk={}; if(!player._icd) player._icd={}; }
function perkStack(id,n,max,dur){ perkDynInit(); const s=player.stk[id]||(player.stk[id]={n:0,t:0});
  s.n=Math.max(0,Math.min(max||99,s.n+n)); s.t=dur||4; if(s.n<=0) delete player.stk[id]; }
function perkStackN(id){ const s=player.stk&&player.stk[id]; return s?s.n:0; }
// returns false (inactive) or a multiplier (1 = plain on/off, >1 = scales)
function perkCondOn(c){
  const hp=player.maxhp?player.hp/player.maxhp:1, mp=player.maxmp?(player.mp||0)/player.maxmp:1;
  const T=player._t||{};
  const near=(r)=>{ let n=0; if(typeof enemies!=='undefined') for(const e of enemies)
    if(Math.hypot(e.x-player.x,e.y-player.y)<(r||220)) n++; return n; };
  switch(c.when){
    case 'lowHp':      return hp<=(c.v||0.5);
    case 'highHp':     return hp>=(c.v||0.8);
    case 'fullHp':     return hp>=0.995;
    case 'missingHp':  return (1-hp)/(c.per||0.1);            // scales with HP missing
    case 'moving':     return !!player._moving;
    case 'still':      return (player._stillT||0)>=(c.v||1);
    case 'nearFoes':   { const n=near(c.r); return n>=(c.n||3) ? (c.per?n/c.per:1) : false; }
    case 'alone':      return near(c.r||260)===0;
    case 'lowMp':      return mp<=(c.v||0.3);
    case 'highMp':     return mp>=(c.v||0.8);
    case 'recentKill': return (T.kill||0)>0;
    case 'recentHurt': return (T.hurt||0)>0;
    case 'recentCast': return (T.cast||0)>0;
    case 'resAbove':   return resFrac()>=(c.v||0.5);
    case 'resScale':   return (typeof res!=='undefined'?res:0)/(c.per||10);   // e.g. +1% per 4 Rage
    case 'shielded':   return (player.shield||0)>0;
    case 'stacks':     { const n=perkStackN(c.id); return n>0?(c.per?n/c.per:n):false; }
    case 'always':     return 1;
  }
  return false;
}
function perkDyn(dt){
  perkDynInit(); _perkFrame++;
  const d=player.dyn, T=player._t;
  for(const k of DYN_KEYS) d[k]=0;
  for(const k in T) if(T[k]>0) T[k]=Math.max(0,T[k]-dt);
  for(const k in player._icd) if(player._icd[k]>0) player._icd[k]=Math.max(0,player._icd[k]-dt);
  player._stillT=player._moving?0:((player._stillT||0)+dt);
  player._moveT =player._moving?((player._moveT||0)+dt):0;
  for(const id in player.stk){ const s=player.stk[id]; s.t-=dt; if(s.t<=0) delete player.stk[id]; }
  // resource decay (out of combat drain — Rage bleeds fast, Souls never do)
  const rd=perkResDef();
  if(rd&&rd.decay&&(player._t.hurt||0)<=0&&(player._t.hit||0)<=0&&typeof res!=='undefined')
    res=Math.max(0,res-rd.decay*dt);
  // resource-threshold event: fires once when the meter fills, re-arms below 90%
  if(rd){ const f=resFrac();
    if(f>=0.999&&!player._resFull){ player._resFull=1; perkFire('resFull',{}); }
    else if(f<0.9) player._resFull=0; }
  const P=player._perk; if(!P) return;
  for(const c of P.cond){ const on=perkCondOn(c); if(!on) continue;
    const m=(typeof on==='number'?on:1)*(c.perRank===false?1:(c._r||1));
    if(c.eff) for(const k in c.eff) if(k in d) d[k]+=c.eff[k]*m; }
  // hard caps so a stacked build can't reach immunity
  d.dr=Math.min(0.45,d.dr); d.crit=Math.min(0.45,d.crit); d.spd=Math.min(1.2,d.spd);
}
// convenience readers used at the consumption sites
function dynAtk(){ return 1+((player.dyn&&player.dyn.atkPct)||0); }
function dynRof(){ return 1+((player.dyn&&player.dyn.rof)||0); }
function dynSpd(){ return 1+((player.dyn&&player.dyn.spd)||0); }
function dynDr(){  return (player.dyn&&player.dyn.dr)||0; }
function dynCrit(){return (player.dyn&&player.dyn.crit)||0; }
function dynAP(){  return 1+((player.dyn&&player.dyn.abilPow)||0); }
function dynLs(){  return (player.dyn&&player.dyn.ls)||0; }

// ===== trigger bus =====
const PROC_DEPTH_MAX=2, PROC_BUDGET=16;
let _procDepth=0, _procBudget=0, _procFrame=-1;
function perkFilter(f,ctx){ if(!f) return true;
  if(f.kind && ctx.kind!==f.kind && !(ctx.kinds&&ctx.kinds.indexOf(f.kind)>=0)) return false;
  if(f.abil && ctx.abil!==f.abil) return false;
  if(f.tag  && ctx.tag !==f.tag)  return false;
  if(f.crit && !ctx.crit) return false;
  if(f.boss && !(ctx.e&&ctx.e.boss)) return false;
  return true; }
function perkFire(evt,ctx){
  perkDynInit(); ctx=ctx||{};
  const T=player._t;                     // event memory drives the recent* conditions
  if(evt==='kill') T.kill=3; else if(evt==='hurt') T.hurt=3;
  else if(evt==='cast') T.cast=3; else if(evt==='hit'||evt==='crit') T.hit=1.5;
  const P=player._perk; if(!P||!P.trig.length) return;
  for(const t of P.trig){
    if(t.on!==evt) continue;
    if(!perkFilter(t.filter,ctx)) continue;
    if(t.when && !perkCondOn(t.when)) continue;        // trigger gated on a condition too
    if(t.chance!==undefined && Math.random()>=t.chance*(t.perRank===false?1:(t._r||1))) continue;
    if(t.icd){ const k=t._id+'|'+t.on; if((player._icd[k]||0)>0) continue; player._icd[k]=t.icd; }
    perkDo(t.do,ctx,t); }
}
// ===== payload verbs =====
function perkDo(d,ctx,src){
  if(!d) return;
  if(_procDepth>=PROC_DEPTH_MAX) return;
  if(_procFrame!==_perkFrame){ _procFrame=_perkFrame; _procBudget=0; }
  if(++_procBudget>PROC_BUDGET) return;
  _procDepth++;
  try{
    const r=(src&&src._r)||1;
    const e=ctx.e||null;
    const x=(ctx.x!=null)?ctx.x:(e?e.x:player.x), y=(ctx.y!=null)?ctx.y:(e?e.y:player.y);
    const base=player.dmg*dynAtk();
    const hurt=(t,amt)=>{ if(typeof dealDamage==='function') dealDamage(t,amt,{perk:true});
      else { t.hp-=amt; t.flash=0.12; } };
    if(d.dmgNearby){ const o=d.dmgNearby, rad=o.r||90, dmg=Math.max(1,Math.round(base*(o.pct||0.5)*r));
      if(typeof fx!=='undefined') fx.push({t:'ring',x:x,y:y,r:rad,life:0.3,col:o.col||'#ffd07a'});
      if(typeof enemies!=='undefined') for(const t of enemies)
        if(Math.hypot(t.x-x,t.y-y)<rad+t.r){ hurt(t,dmg); if(o.status) applyStatus(t,o.status.id,o.status.dur||2,o.status.val||0); }
      if(typeof emitP==='function') for(let i=0;i<10;i++){ const a=(i/10)*6.283;
        emitP(x,y,{vx:Math.cos(a)*160,vy:Math.sin(a)*160,life:0.35,col:o.col||'#ffd07a',sz:2.5,glow:true}); } }
    if(d.status){ const o=d.status, dur=o.dur||2;
      // val is absolute; `pct` instead scales the DoT off the hit that triggered it
      const val=o.pct?((ctx.dmg||base)*o.pct*r)/dur:(o.val||0)*r;
      if(o.r){ if(typeof enemies!=='undefined') for(const t of enemies)
                 if(Math.hypot(t.x-x,t.y-y)<o.r) applyStatus(t,o.id,dur,val); }
      else if(e) applyStatus(e,o.id,dur,val); }
    if(d.heal){ const amt=player.maxhp*(d.heal.pct||0.05)*r*(d.heal.perFoe?ctx.n||1:1);
      if(typeof healPlayer==='function') healPlayer(amt); else player.hp=Math.min(player.maxhp,player.hp+amt); }
    if(d.mana){ player.mp=Math.min(player.maxmp,(player.mp||0)+player.maxmp*(d.mana.pct||0.1)*r); }
    if(d.shield){ const cap=player.maxhp*0.35;
      player.shield=Math.min(cap,(player.shield||0)+player.maxhp*(d.shield.pct||0.1)*r); }
    if(d.res) resAdd((d.res.n||0)*(d.res.perRank===false?1:r));
    if(d.cdCut&&player.acd){ const s=(d.cdCut.s||0.5)*r;
      for(const k in player.acd) if(player.acd[k]>0) player.acd[k]=Math.max(0,player.acd[k]-s); }
    if(d.buff){ const o=d.buff; player[o.f+'T']=o.dur||3; player[o.f+'M']=o.m||1.3;
      if(typeof abilFx==='function') abilFx('buff',player.x,player.y,o.col||'#ffd07a'); }
    if(d.stack) perkStack(d.stack.id,(d.stack.n||1),d.stack.max||10,d.stack.dur||5);
    if(d.knock&&typeof enemies!=='undefined'){ const o=d.knock, rad=o.r||110, push=o.v||60;
      for(const t of enemies){ if(t.boss) continue;                    // bosses hold their ground
        const dd=Math.hypot(t.x-x,t.y-y)||1; if(dd>=rad) continue;
        const nx=t.x+((t.x-x)/dd)*push, ny=t.y+((t.y-y)/dd)*push;
        if(typeof solid!=='function'||!solid(nx,ny)){ t.x=nx; t.y=ny; } } }
    // INDEPENDENT projectiles — never player.shots (design rule 6)
    if(d.burst){ const o=d.burst, n=Math.min(12,(o.n||4)), sp=o.spd||520;
      const a0=(ctx.aim!=null?ctx.aim:(player.aim||0))-((n-1)/2)*(o.spread||0.22);
      for(let i=0;i<n;i++){ const a=o.ring?(i/n)*6.283:a0+i*(o.spread||0.22);
        pShots.push({x:player.x,y:player.y,px:player.x,py:player.y,
          vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:o.size||5,life:o.life||0.6,
          dmg:Math.max(1,Math.round(base*(o.dmgPct||0.4)*r)),crit:false,pierce:o.pierce||0,
          lastHit:null,forked:true,pk:'p:'+((src&&src._id)||'perk')}); } }
    if(d.zone){ const o=d.zone;
      zones.push({x:x,y:y,r:o.r||80,life:(o.life||4),tick:0,ap:player.abilPow||1,
        fire:!!o.fire,poison:!!o.poison,healOnly:!!o.healOnly,
        dmg:o.dmgPct?Math.max(1,Math.round(base*o.dmgPct*r)):0,col:o.col||'#ffd07a',perk:(src&&src._id)||null});
      if(typeof fx!=='undefined') fx.push({t:'ring',x:x,y:y,r:o.r||80,life:0.35,col:o.col||'#ffd07a'}); }
    if(d.summon){ const o=d.summon, n=Math.min(8,(o.n||1)*r);
      for(let i=0;i<n;i++) allies.push({x:player.x,y:player.y,
        dmg:Math.max(1,Math.round(base*(o.dmgPct||0.3))),life:o.life||10,cd:0,spr:o.spr||'skel'});
      if(typeof abilFx==='function') abilFx('summon',player.x,player.y); }
    if(d.echo&&player._lastCast){ const lc=player._lastCast, pct=(d.echo.pct||0.4);
      const c2={x:lc.x,y:lc.y,aim:lc.aim,AP:(lc.AP||1)*pct,dmg:Math.round(lc.dmg*pct),cls:lc.cls,_echo:true};
      try{ lc.fn(c2); }catch(err){} }
    if(d.text&&typeof texts!=='undefined')
      texts.push({x:player.x,y:player.y-34,txt:d.text,col:(src&&src.col)||'#ffd07a',life:0.8});
    if(src&&src.emits) perkFire('proc',{tag:src.emits,x:x,y:y,e:e,from:src._id});
  } finally { _procDepth--; }
}

// ===== ability mods (perk rewrites an ability at cast time) =====
// pre  — runs BEFORE the cast (can set transient flags the primitive reads, e.g. _sumMul)
// do   — runs AFTER the cast at the landing point
function perkModsFor(a){ const P=player._perk; if(!P||!P.mod.length) return null;
  const ctx={abil:a.id,kind:a.kind||null,kinds:a.kinds||[]};
  const out=P.mod.filter(m=>perkFilter(m,ctx));
  return out.length?out:null; }
function perkCastPre(a,ctx){ player._sumMul=1; player._sumLife=1; player._sumDmg=1; player._sumSt=null;
  const ms=perkModsFor(a); if(!ms) return null;
  for(const m of ms){ if(!m.pre) continue;
    if(m.pre.spendRes!==undefined && !resSpend(m.pre.spendRes)) continue;  // can't pay -> mod is skipped
    if(m.pre.sumMul)  player._sumMul=(player._sumMul||1)*m.pre.sumMul;     // summon count / life / power
    if(m.pre.sumLife) player._sumLife=(player._sumLife||1)*m.pre.sumLife;
    if(m.pre.sumDmg)  player._sumDmg=(player._sumDmg||1)*m.pre.sumDmg;
    if(m.pre.sumSt)   player._sumSt=m.pre.sumSt;                           // minions inherit an on-hit status
    if(m.pre.ap)      ctx.AP=(ctx.AP||1)*m.pre.ap;
    if(m.pre.dmg)     ctx.dmg=Math.round((ctx.dmg||player.dmg)*m.pre.dmg); }
  return ms; }
function perkCastPost(ms,a,ctx){ player._sumMul=1; player._sumLife=1; player._sumDmg=1; player._sumSt=null;
  if(!ms) return;
  for(const m of ms) if(m.do) perkDo(m.do,{x:ctx.x,y:ctx.y,aim:ctx.aim,abil:a.id,kind:a.kind,kinds:a.kinds},m); }

// ===== HUD: class resource meter (drawn above the XP bar by 09_sprites) =====
function drawResMeter(cx,by,w){
  const info=perkResInfo(); if(!info||typeof ctx==='undefined') return;
  const us=(typeof UIS!=='undefined')?UIS:1;
  const h=Math.max(5,Math.round(7*us)), x=cx-w/2, y=by-h-Math.round(4*us);
  const f=resFrac(), full=f>=0.999;
  ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(x,y,w,h);
  ctx.fillStyle=info.col; ctx.fillRect(x,y,w*f,h);
  if(full){ ctx.globalAlpha=0.35+0.35*Math.sin(performance.now()/180);
    ctx.fillStyle='#fff'; ctx.fillRect(x,y,w,h); ctx.globalAlpha=1; }
  const seg=4; ctx.strokeStyle='rgba(0,0,0,.55)'; ctx.lineWidth=1;
  for(let i=1;i<seg;i++){ const sx=Math.round(x+w*i/seg)+0.5;
    ctx.beginPath(); ctx.moveTo(sx,y); ctx.lineTo(sx,y+h); ctx.stroke(); }
  ctx.strokeStyle='rgba(216,210,200,.28)'; ctx.strokeRect(x-0.5,y-0.5,w+1,h+1);
  ctx.font=Math.round(9*us)+'px "Pixelify Sans",monospace'; ctx.textAlign='center';
  ctx.fillStyle='rgba(0,0,0,.7)'; ctx.fillText(info.name,cx+1,y-Math.round(2*us)+1);
  ctx.fillStyle=info.col;         ctx.fillText(info.name,cx,y-Math.round(2*us));
  ctx.textAlign='left';
}
