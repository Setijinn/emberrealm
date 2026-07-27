// ===================================================================================
// 17f_bossanim.js — BOSS ANIMATION (user, 2026-07-27: "a lot more animations for the bosses
// during the fights and speeches and stuff")
//
// A boss had exactly two animation states: a sine bob, and an `attack` frame set swapped in while
// e.animAtk ran down. Everything else it did — escalating, planting, summoning, dying, and every
// word it ever said — happened to a creature standing perfectly still.
//
// This is a PROCEDURAL layer, not new art. It drives transform (squash, stretch, lean, rise,
// recoil, spin), a glow/tint pulse, and per-beat particle work, on TOP of whatever frames a boss
// already has. That choice is deliberate: 12 bosses x 10 states of hand-drawn animation is an art
// programme, whereas squash-and-stretch is exactly what reads at this sprite size, lands today,
// and layers cleanly under real frames if they ever ship (see bossAnimFrames below).
//
// Beats are named and fire-and-forget:  bossAnim(e,'roar')
// Anything can call one; the fight registry (17g) leans on them heavily.
// ===================================================================================

// dur is in seconds; each beat has a sensible default so callers usually pass only a name.
const BOSS_ANIM={
  // --- combat beats ---
  wind:   {t:0.42, pri:2},   // crouches and coils before a volley — the tell
  slam:   {t:0.50, pri:4},   // rears up and drives down; shakes on impact
  roar:   {t:1.10, pri:5},   // swells, bellows, throws a ring of light
  recoil: {t:0.26, pri:1},   // knocked back a step when hurt badly
  lunge:  {t:0.38, pri:3},   // stretches along its charge
  summon: {t:0.85, pri:4},   // rises, arms wide, pulls something up
  // --- fight-structure beats ---
  phase:  {t:1.10, pri:6},   // the escalation itself
  plant:  {t:0.90, pri:5},   // settling into an anchored survival phase
  hold:   {t:0.00, pri:0},   // looping "planted and breathing" (dur 0 == until cleared)
  vanish: {t:0.45, pri:5},   // collapses inward (clones, burrow)
  appear: {t:0.45, pri:5},   // bursts back out
  ward:   {t:0.70, pri:4},   // raises its own shield
  break:  {t:0.80, pri:6},   // that shield is broken — stagger
  // --- performance beats ---
  speak:  {t:0.00, pri:1},   // a loop: leans in and glows while a line is on screen
  die:    {t:2.20, pri:9},   // topples
};
// Start a beat. A higher-priority beat interrupts a lower one; equal priority restarts it.
function bossAnim(e,name,dur){
  if(!e) return;
  const D=BOSS_ANIM[name]; if(!D) return;
  const cur=e.anim&&BOSS_ANIM[e.anim];
  if(cur && (e.animT>0||cur.t===0) && cur.pri>D.pri) return;   // something more important is playing
  e.anim=name; e.animDur=(dur!==undefined?dur:D.t); e.animT=e.animDur; e.animAge=0;
  if(name==='roar'||name==='slam'||name==='phase'||name==='break'){
    if(typeof addShake==='function') addShake(name==='phase'?14:9);
  }
}
function bossAnimClear(e,name){ if(e && (!name || e.anim===name)){ e.anim=null; e.animT=0; e.animAge=0; } }
// Tick every boss's animation clock, and keep the two AMBIENT loops (speak / hold) honest: they
// have no duration of their own, so they end when their reason ends rather than on a timer.
function bossAnimTick(e,dt){
  if(!e) return;
  if(typeof bossAnimSeed==='function') bossAnimSeed(e);   // so two of a species never breathe in step
  e.animAge=(e.animAge||0)+dt;
  // a boss whose line is on screen leans in and glows, without anyone having to remember to ask
  const talking=(typeof bossQuote!=='undefined' && bossQuote && bossQuote.who===e
                 && (performance.now()-bossQuote.born)<bossQuote.dur);
  if(e.anim==='speak' && !talking) bossAnimClear(e,'speak');
  if(e.anim==='hold' && !e.anchored) bossAnimClear(e,'hold');
  if(e.animT>0){ e.animT-=dt; if(e.animT<=0 && (BOSS_ANIM[e.anim]||{}).t!==0) e.anim=null; }
  if(!e.anim){
    if(e.anchored) bossAnim(e,'hold');
    else if(talking) bossAnim(e,'speak');
  }
}
// The pose for this frame: multipliers and offsets the draw code applies around the sprite's own
// centre. sx/sy are squash-and-stretch (volume-preserving where it matters), rot is a lean in
// radians, dx/dy a positional shove, glow an additive bloom 0..1, and a an alpha.
function _ease(t){ return t<0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2; }
function bossAnimPose(e){
  const P={sx:1,sy:1,rot:0,dx:0,dy:0,glow:0,a:1};
  if(!e) return P;
  const nm=e.anim||'idle';                       // no beat playing == idling, which is now a real state
  const D=BOSS_ANIM[nm]||BOSS_ANIM.speak;
  const loop=(D.t===0)||nm==='idle';
  const p=loop?0:Math.max(0,Math.min(1,1-(e.animT/(e.animDur||D.t||1))));   // 0..1 through the beat
  const age=loop?((performance.now()/1000)+(e.animSeed||0)):(e.animAge||0);
  // the direction the player lies in, so leans and lunges point at them rather than at nothing
  let ux=0,uy=0;
  if(typeof player!=='undefined'){ const dx=player.x-e.x, dy=player.y-e.y, d=Math.hypot(dx,dy)||1;
    ux=dx/d; uy=dy/d; }
  // THE BOSS'S OWN VERSION WINS. 17g gives each identity its own idle, tell, speech and death plus
  // signature moves; the shared beats below are the fallback for anything it does not define.
  const pb=(typeof bossProfBeat==='function')?bossProfBeat(e,nm):null;
  if(pb){ const R=pb(p,age,ux,uy,P)||{};
    for(const k in R) if(R[k]!==undefined) P[k]=R[k];
    return P; }
  if(nm==='idle') return P;                      // no profile: the old sine bob in the draw code stands
  switch(nm){
    case 'wind': {            // coil: sink and widen, then release
      const k=Math.sin(p*Math.PI);
      P.sy=1-0.16*k; P.sx=1+0.13*k; P.dy=6*k; P.dx=-ux*7*k; P.rot=-ux*0.07*k; P.glow=0.25*k;
      break; }
    case 'slam': {            // rear back over the first third, drive down over the rest
      if(p<0.34){ const k=_ease(p/0.34); P.sy=1+0.24*k; P.sx=1-0.12*k; P.dy=-13*k; P.rot=-ux*0.12*k; }
      else { const k=_ease((p-0.34)/0.66);
        P.sy=1+0.24-0.52*k; P.sx=1-0.12+0.30*k; P.dy=-13+22*k; P.rot=-ux*0.12+ux*0.20*k; P.glow=0.5*(1-k); }
      break; }
    case 'roar': {            // swell, hold, settle — with a tremor through the hold
      const k=p<0.28?_ease(p/0.28):(p<0.72?1:1-_ease((p-0.72)/0.28));
      P.sx=1+0.17*k; P.sy=1+0.21*k; P.glow=k;
      P.dx=Math.sin(age*46)*2.4*k; P.dy=Math.cos(age*39)*1.8*k;
      break; }
    case 'recoil': { const k=1-p; P.dx=-ux*15*k; P.dy=-uy*15*k; P.rot=ux*0.16*k; P.sx=1-0.08*k; break; }
    case 'lunge': { const k=Math.sin(p*Math.PI);
      P.sx=1+0.22*k; P.sy=1-0.14*k; P.dx=ux*10*k; P.dy=uy*10*k; P.rot=ux*0.14*k; break; }
    case 'summon': {          // rises off the ground, splayed, then drops
      const k=Math.sin(p*Math.PI);
      P.dy=-16*k; P.sx=1+0.10*k; P.sy=1+0.14*k; P.glow=0.75*k; P.rot=Math.sin(age*7)*0.05*k;
      break; }
    case 'phase': {           // the big one: crouch, erupt, settle
      if(p<0.22){ const k=_ease(p/0.22); P.sy=1-0.26*k; P.sx=1+0.20*k; P.dy=11*k; P.glow=0.3*k; }
      else { const k=_ease((p-0.22)/0.78);
        P.sy=1-0.26+0.62*k; P.sx=1+0.20-0.30*k; P.dy=11-24*k;
        P.glow=1-0.75*k; P.rot=Math.sin(age*23)*0.09*(1-k); }
      break; }
    case 'plant': {           // drives its weight down and settles
      const k=_ease(p);
      P.sy=1+0.18-0.30*k; P.sx=1-0.10+0.18*k; P.dy=-10+14*k; P.glow=0.6*(1-k);
      break; }
    case 'hold': {            // planted: a slow, heavy breath and a ward shimmer
      const b=Math.sin(age*2.1);
      P.sy=1+b*0.045; P.sx=1-b*0.035; P.dy=-b*2.2; P.glow=0.22+0.12*Math.sin(age*3.3);
      break; }
    case 'vanish': { const k=_ease(p); P.sx=1-0.85*k; P.sy=1+0.35*k; P.a=1-k; P.glow=0.6*(1-k); break; }
    case 'appear': { const k=_ease(p); P.sx=0.15+0.85*k; P.sy=1.35-0.35*k; P.a=k; P.glow=0.6*(1-k); break; }
    case 'ward':   { const k=Math.sin(p*Math.PI); P.sx=1+0.09*k; P.sy=1+0.09*k; P.glow=0.9*k; break; }
    case 'break':  {          // shield shattered: a hard stagger
      const k=1-p; P.rot=Math.sin(age*34)*0.20*k; P.dx=Math.sin(age*41)*5*k;
      P.sy=1-0.14*k; P.sx=1+0.10*k; P.glow=0.3*k; break; }
    case 'speak':  {          // leans toward you and pulses while it talks
      const b=Math.sin(age*2.6);
      P.rot=ux*0.055+ux*0.02*b; P.dy=-2.5-1.5*b; P.sy=1+0.03*b; P.glow=0.16+0.10*Math.sin(age*4.1);
      break; }
    case 'die':    {          // topples away from you and sinks
      const k=_ease(p);
      P.rot=-ux*1.15*k; P.dy=10*k; P.sy=1-0.30*k; P.sx=1+0.12*k; P.a=1-0.55*k; P.glow=0.4*(1-k);
      break; }
  }
  return P;
}
// If a boss ever gets REAL frames for a beat, they win: `_bossAnim[slot][name]` is checked first
// and the procedural pose still layers on top (a hand-drawn roar that also swells reads better
// than either alone). Nothing ships with these yet — the lookup is the seam for when they do.
function bossAnimFrames(e,slot){
  if(!e||!e.anim||typeof _bossAnim==='undefined') return null;
  const set=_bossAnim[slot]; if(!set) return null;
  const fr=set[e.anim];
  if(!fr||!fr.length||!fr[0]||!fr[0].naturalWidth) return null;
  const D=BOSS_ANIM[e.anim]||{t:0.5};
  const p=(D.t===0)?((e.animAge||0)*4)%1:Math.max(0,Math.min(0.999,1-(e.animT/(e.animDur||D.t||1))));
  return fr[Math.floor(p*fr.length)];
}
// ---- beats that also throw something into the world ----
// Called at the START of the loud ones, so the visual effect and the pose share a trigger.
function bossAnimFx(e,name){
  if(!e||typeof emitP!=='function') return;
  const col=e.col||'#ff9c50';
  if(name==='roar'||name==='phase'){
    if(typeof fx!=='undefined') fx.push({t:'ring',x:e.x,y:e.y,r:e.r*1.2,life:0.55,col:col});
    for(let i=0;i<22;i++){ const a=Math.random()*6.283, s=90+Math.random()*180;
      emitP(e.x,e.y,{vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:0.4+Math.random()*0.4,col:col,
        sz:2+Math.random()*3,g:40,glow:true}); }
  } else if(name==='slam'){
    for(let i=0;i<16;i++){ const a=Math.random()*6.283, s=60+Math.random()*140;
      emitP(e.x,e.y+e.r*0.6,{vx:Math.cos(a)*s,vy:-Math.abs(Math.sin(a))*s*0.6,life:0.35+Math.random()*0.3,
        col:'#cdbfae',sz:2+Math.random()*2,g:220,drag:1.5}); }
  } else if(name==='plant'){
    if(typeof fx!=='undefined') fx.push({t:'ring',x:e.x,y:e.y,r:e.r*1.6,life:0.7,col:col});
  } else if(name==='vanish'||name==='appear'){
    for(let i=0;i<18;i++){ const a=Math.random()*6.283, s=70+Math.random()*130;
      emitP(e.x,e.y,{vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:0.3+Math.random()*0.3,col:col,
        sz:2+Math.random()*2,g:0,glow:true}); }
  }
}
