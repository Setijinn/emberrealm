// ---------- combat ----------
// ===== STATUS EFFECTS (enemy-side, unified) =====
// One pipeline for every debuff: applyStatus(e,id,dur,val) -> tickStatuses in the
// enemy loop -> pips + particles in render. Anything (tree capstones, abilities,
// future unique weapons) inflicts these through applyStatus — never ad-hoc fields.
//  burn/poison: damage over time (val = dps)     bleed: % max HP over time
//  chill: 45% slower (mirrors legacy e.slowT)    freeze: cannot act, thaws to chill
//  stun: cannot act (short)                      curse: takes +val damage (default 15%)
//  weak: deals 30% less damage                   shock: arc-zap every 0.6s for val
const STATUS={
 burn:{col:'#ffb347'}, poison:{col:'#7dc47a'}, bleed:{col:'#ff4d5e'},
 chill:{col:'#9ad4ef'}, freeze:{col:'#d8f0fa'}, stun:{col:'#ffe08a'},
 curse:{col:'#c07ad4'}, weak:{col:'#8a8494'}, shock:{col:'#5a9cc0'} };
function applyStatus(e,id,dur,val){ if(!e||e.hp<=0||e.node) return;   // objective nodes immune
 if(!e.st) e.st={};
 const s=e.st[id];
 if(s){ s.t=Math.max(s.t,dur); s.v=Math.max(s.v||0,val||0); }
 else e.st[id]={t:dur,v:val||0};
 if(id==='chill') e.slowT=Math.max(e.slowT||0,dur);   // legacy mirror (slowF, shatter checks)
 if(id==='stun')  e.stunT=Math.max(e.stunT||0,dur); }
function hasStatus(e,id){ return !!(e.st&&e.st[id]&&e.st[id].t>0); }
function tickStatuses(e,dt){ if(!e.st) return true;
 let act=true;
 for(const id in e.st){ const s=e.st[id];
  s.t-=dt;
  if(id==='burn'||id==='poison') e.hp-=(s.v||0)*dt;
  else if(id==='bleed') e.hp-=e.maxhp*0.008*Math.max(1,s.v)*dt;
  else if(id==='shock'){ s.acc=(s.acc||0)+dt;
    if(s.acc>=0.6){ s.acc-=0.6; e.hp-=(s.v||0);
      if(typeof fx!=='undefined') fx.push({t:'bolt',
        pts:[{x:e.x+(Math.random()*30-15),y:e.y-26},{x:e.x,y:e.y}],life:0.15,col:'#9ad4ef'}); } }
  else if(id==='freeze'||id==='stun') act=false;
  if(typeof emitP==='function'&&Math.random()<4*dt){ const c=STATUS[id];
    if(c) emitP(e.x+(Math.random()*e.r*2-e.r),e.y-6,
      {vx:0,vy:id==='burn'?-24:-12,life:0.5,col:c.col,sz:2,glow:id==='burn'||id==='shock'}); }
  if(s.t<=0){ delete e.st[id]; if(id==='freeze') applyStatus(e,'chill',1,0); } }
 return act; }
function statusDmgOut(e){ return hasStatus(e,'weak')?0.7:1; }                       // weakened hit softer
function statusDmgIn(e){ return hasStatus(e,'curse')?(1+(e.st.curse.v||0.15)):1; }  // cursed take more
// ===== ONE funnel for every point of PLAYER-SOURCE damage =====
// Shots, abilities, zones, minions and perk procs all land here, so the multipliers that
// should apply everywhere (curse / execute / shatter, lifesteal) and the on-hit perk
// triggers fire uniformly instead of only for auto-attacks.
//   src {crit, ability, zone, ally, perk, silent, col}  — silent skips the damage number
function dealDamage(e,amount,src){
  if(!e||e.hp<=0) return 0;
  src=src||{};
  let dmg=Math.round(amount);
  if(player.execute&&e.hp<e.maxhp*0.15) dmg=Math.round(dmg*(1+player.execute));            // Executioner
  if(player.shatter&&(e.slowT>0||hasStatus(e,'freeze'))) dmg=Math.round(dmg*(1+player.shatter)); // Cryomancer
  dmg=Math.max(1,Math.round(dmg*statusDmgIn(e)));                                          // cursed foes
  e.hp-=dmg; e.flash=Math.max(e.flash||0,0.12);
  if(e.boss&&typeof bossBar!=='undefined') bossBar=e;
  // lifesteal covers what YOU land (shots, abilities, perk procs) — not minion or zone ticks,
  // which would otherwise drip-heal you forever with no risk attached.
  if(!src.ally&&!src.zone){ const ls=(player.ls||0)+((typeof dynLs==='function')?dynLs():0);
    if(ls&&typeof healPlayer==='function') healPlayer(dmg*ls); }
  if(!src.silent&&typeof texts!=='undefined')
    texts.push({x:e.x+(Math.random()*18-9),y:e.y-e.r-2,txt:src.crit?dmg+'!':dmg,
      col:src.col||(src.crit?'#ffd23d':'#ffe9b0'),life:src.crit?0.85:0.55});
  if(typeof perkFire==='function'){ const pc={e:e,dmg:dmg,crit:!!src.crit,src:src};
    perkFire('hit',pc); if(src.crit) perkFire('crit',pc); }
  return dmg;
}
function los(x1,y1,x2,y2){
  const d=Math.hypot(x2-x1,y2-y1), steps=Math.ceil(d/14);
  for(let i=1;i<steps;i++){ const t=i/steps;
    if(solid(x1+(x2-x1)*t, y1+(y2-y1)*t)) return false; }
  return true;
}
function fire(dt){
  player.fireT-=dt;
  if(player.fireT>0) return;
  const wt=player.wt||WTYPE.sword;
  let ang=null;
  // Manual aim (PC opt-in, Settings toggle): fire straight toward the cursor with
  // no auto-target lock. Touch is never affected — mobile keeps the auto-aim below.
  const manualPC=(typeof OPTS!=='undefined' && OPTS.aim &&
    typeof inputMode!=='undefined' && inputMode==='pc' && typeof mouseWorld==='function');
  if(manualPC){
    const m=mouseWorld(); ang=Math.atan2(m.y-player.y,m.x-player.x);
  } else {
    // auto-aim: PC favors the enemy nearest the CURSOR; touch favors the nearest to the player.
    // LOS is always from the player (you still can't shoot through walls).
    let ref={x:player.x,y:player.y};
    if(typeof inputMode!=='undefined' && inputMode==='pc' && typeof mouseWorld==='function') ref=mouseWorld();
    // auto-aim range cap: only engage targets the weapon can actually reach (+15% grace)
    const wRange=((wt.spd||520)*(player.projSpd||1))*(wt.life||1)*1.15;
    let best=null, bd=1e9;
    for(const e of enemies){ const d=Math.hypot(e.x-ref.x,e.y-ref.y);
      if(d<bd && Math.hypot(e.x-player.x,e.y-player.y)<=wRange && los(player.x,player.y,e.x,e.y)){bd=d;best=e;} }
    if(best) ang=Math.atan2(best.y-player.y,best.x-player.x);
  }
  if(ang===null) return;
  let _rate=player.fireRate/(player.bRofT>0?(player.bRofM||1.5):1);
  if(player.moveRof&&player._moving) _rate/=(1+player.moveRof);   // Galewalker: faster on the move
  if(typeof dynRof==='function') _rate/=dynRof();                 // conditional perks
  player.fireT=_rate;
  player.aim=ang;
  player.atkT=0.2;                     // trigger the attack animation
  const de3=player.deadeye>0;
  const critC=(player.crit||0)+((typeof dynCrit==='function')?dynCrit():0);
  const crit=Math.random()<critC;                     // LUCK + conditional perks -> crit chance
  let dm=player.dmg*(wt.dm||1)*(player.bDmgT>0?(player.bDmgM||1.5):1)*((typeof dynAtk==='function')?dynAtk():1);
  if(crit) dm*=(player.critMult||1.5);
  let pr=(wt.pierce||0)+(player.pierce||0);
  if(de3){ dm*=3; pr=99; }
  if(crit&&player.critPierce) pr=99;                 // Sharpshooter: crits pierce everything
  const psp=(wt.spd||520)*(player.projSpd||1);          // DEX -> projectile speed
  const n=Math.min(7,(wt.shots||1)+((player.shots||1)-1));
  // projectile forge key: every (class, weapon type, tier, rarity) combo has its own look
  const _cls=(typeof curChar==='function'&&curChar())?curChar().cls:'x';
  const _rar=(typeof eqRar==='function')?(eqRar('wpn')||0):0;
  const pk='w:'+_cls+':'+((typeof CWEAP!=='undefined'&&CWEAP[_cls])||'sword')+':'+(rpg?rpg.wpn:0)+':'+_rar;
  const pcore=(_rar>0&&typeof RAR_COL!=='undefined')?RAR_COL[_rar]:undefined;
  for(let i=0;i<n;i++){
    let sx=player.x, sy=player.y, sa=ang;
    if(wt.par && n>1){ const off=(i-(n-1)/2)*wt.par;
      sx+=Math.cos(ang+Math.PI/2)*off; sy+=Math.sin(ang+Math.PI/2)*off; }
    else if(n>1){ sa=ang+(i-(n-1)/2)*(wt.spread||0.15); }
    pShots.push({x:sx,y:sy,px:sx,py:sy,
      vx:Math.cos(sa)*psp,vy:Math.sin(sa)*psp,
      r:wt.size||5,life:wt.life||1,dmg:dm,crit:crit,
      pierce:pr,lastHit:null,slow:player.slowShot,pk:pk,pcore:pcore});
  }
  if(de3) player.deadeye--;
  chargeRes('shot'); lastShotT=0;
}
function eFire(e,ang,spd=200){
  // per-family forged look: each boss by name, mobs by type + level bracket
  const pk='e:'+(e.name?('B_'+e.name):(e.type+'_'+Math.floor((e.lv||1)/12)));
  eShots.push({x:e.x,y:e.y,px:e.x,py:e.y,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,
    r:e.psize||6,life:3,bd:(e.bd||8)*statusDmgOut(e),col:e.pcol||null,core:e.pcore||null,shape:e.pshape||null,pk:pk});
}
function boom(x,y,col,n=10){
  for(let i=0;i<n;i++){ const a=Math.random()*6.28,s=40+Math.random()*120;
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.4,col}); }
}
// ---- richer particle emitters (same `particles` array; extra fields are all optional:
// maxlife for fade-norm, sz size, g gravity, drag, glow = additive pass, shrink) ----
const PART_CAP=420;
function emitP(x,y,o){ if(particles.length>=PART_CAP) return;
  const life=(o&&o.life)||0.6;
  particles.push({x,y,vx:(o&&o.vx)||0,vy:(o&&o.vy)||0,life,maxlife:life,
    col:(o&&o.col)||'#fff',sz:(o&&o.sz)||3,g:(o&&o.g)||0,drag:(o&&o.drag)||0,
    glow:!!(o&&o.glow),shrink:true}); }
// combat: glowing spark spray on hit
function fxHit(x,y,col){ for(let i=0;i<5;i++){ const a=Math.random()*6.28,s=60+Math.random()*130;
  emitP(x,y,{vx:Math.cos(a)*s,vy:Math.sin(a)*s-20,life:0.22+Math.random()*0.2,col,sz:2+Math.random()*2,g:180,glow:true}); } }
// combat: death shower scaled by radius — colored sparks + pale chips + smoke puffs
function fxDeath(x,y,col,r){ const n=Math.min(26,10+Math.round((r||14)*0.7));
  for(let i=0;i<n;i++){ const a=Math.random()*6.28,s=30+Math.random()*160;
    emitP(x,y,{vx:Math.cos(a)*s,vy:Math.sin(a)*s-30,life:0.35+Math.random()*0.45,
      col:Math.random()<0.7?col:'#f5e9d2',sz:2+Math.random()*3,g:150,drag:1.2,glow:Math.random()<0.5}); }
  for(let i=0;i<4;i++) emitP(x+(Math.random()*16-8),y+(Math.random()*10-5),
    {vx:Math.random()*24-12,vy:-24-Math.random()*26,life:0.8+Math.random()*0.5,
     col:'rgba(120,110,105,0.5)',sz:5+Math.random()*3,drag:1.5}); }
