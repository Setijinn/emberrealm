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
// ===== ONE rule for "this boss cannot be touched right now" =====
// Used by damage AND status, because a boss that shrugs off hits while a burn quietly eats it is
// not actually invulnerable. Covers: the clone puzzle (it's hidden among its images), the phase
// transition beat, a SURVIVAL window where the fight is "get to safe ground" rather than "hit it",
// and the dramatic spoken lines — so a boss cannot be melted during its own confession.
function bossImmune(e){ if(!e) return false;
 if(e.mechInv) return true;                 // hidden among its mirror images
 if((e.phaseInv||0)>0) return true;         // mid phase-transition
 if((e.dlgInv||0)>0) return true;           // a dramatic line is landing
 if(e.bloom) return true;                   // SURVIVAL: thornrot bloom, reach the safe ground
 if(e.anchorInv) return true;               // planted at the middle of its arena, running a survival phase
 if(e.wardInv) return true;                 // a fight has raised its own shield (conduits, pillars, tide)
 return false; }
function applyStatus(e,id,dur,val){ if(!e||e.hp<=0||e.node) return;   // objective nodes immune
  // in co-op the host owns this enemy's health, so a status applied here must be mirrored there
  // or its damage-over-time would tick against a bar the host never marks as burning
  if(typeof netReportStatus==='function') netReportStatus(e,id,dur,val);
 if(bossImmune(e)) return;                                            // and untouchable bosses
 if(!e.st) e.st={};
 const s=e.st[id];
 if(s){ s.t=Math.max(s.t,dur); s.v=Math.max(s.v||0,val||0); }
 else e.st[id]={t:dur,v:val||0};
 if(id==='chill') e.slowT=Math.max(e.slowT||0,dur);   // legacy mirror (slowF, shatter checks)
 if(id==='stun')  e.stunT=Math.max(e.stunT||0,dur); }
function hasStatus(e,id){ return !!(e.st&&e.st[id]&&e.st[id].t>0); }
function tickStatuses(e,dt){ if(!e.st) return true;
 let act=true;
 // Damage-over-time subtracts hp DIRECTLY, so it never passed through dealDamage's immunity
 // check — a burn stack kept eating a boss straight through phase transitions and clone
 // puzzles. While immune the ticks are skipped AND the timers frozen, so the player doesn't
 // silently lose the duration they paid for either.
 const imm=bossImmune(e);
 for(const id in e.st){ const s=e.st[id];
  if(imm) continue;   // and an existing freeze/stun must not hold it either, or the mech stalls
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

// ===== THE SAME NINE STATUSES, ON THE PLAYER (user, 2026-07-26) =====
// Statuses only ever existed on enemies: the whole vocabulary was something you did TO the world
// and nothing the world could do back. These are the mirror, deliberately built from the same
// table and the same rules so "burn" means one thing in this game and not two.
// Differences from the enemy side, and why:
//   - a DoT on the player is a fraction of MAX HP per second, not a flat number. Enemy DoTs are
//     tuned against your damage; a flat value carried across a 100-level HP curve would be lethal
//     at Lv1 and unnoticeable at Lv50.
//   - freeze/stun cost you your ACTIONS (firing and casting), not a movement lock you cannot see
//     the end of. Being unable to act is already the harshest thing in a game about dodging.
//   - every application is capped in duration. A stun-lock you cannot escape is not difficulty.
const PSTAT={
  burn:  {dot:0.022, cap:6},
  poison:{dot:0.014, cap:9},
  bleed: {dot:0.018, cap:6},
  shock: {dot:0.020, cap:5},
  chill: {cap:5},          // -35% move
  freeze:{cap:1.6},        // cannot act; short by design
  stun:  {cap:1.4},        // cannot act
  weak:  {cap:6},          // -30% damage you deal
  curse: {cap:8},          // +damage you take
};
function playerStatus(id,dur,val){
  if(!PSTAT[id]) return;
  if(player.inv>0 && (id==='freeze'||id==='stun')) return;   // i-frames stop control loss outright
  if(!player.st) player.st={};
  const cap=PSTAT[id].cap, d=Math.min(dur||0,cap);
  const s=player.st[id];
  if(s){ s.t=Math.max(s.t,d); s.v=Math.max(s.v||0,val||0); }
  else player.st[id]={t:d,v:val||0};
  if(typeof texts!=='undefined') texts.push({x:player.x,y:player.y-40,
    txt:id.toUpperCase(),col:(STATUS[id]&&STATUS[id].col)||'#fff',life:0.7});
}
function playerHas(id){ return !!(player.st&&player.st[id]&&player.st[id].t>0); }
// true if the player may act this frame (fire / cast). Called by fire() and doAbility().
function playerCanAct(){ return !(playerHas('freeze')||playerHas('stun')); }
function playerSpdMul(){ return playerHas('chill')?0.65:1; }
function playerDmgMul(){ return playerHas('weak')?0.70:1; }
function playerDmgTaken(){ return playerHas('curse')?(1+(player.st.curse.v||0.15)):1; }
function tickPlayerStatuses(dt){
  if(!player.st) return;
  for(const id in player.st){ const s=player.st[id];
    s.t-=dt;
    const P=PSTAT[id];
    if(P&&P.dot&&player.hp>0){
      // straight to hp: a DoT must not re-enter damagePlayer, or it would spend the i-frames that
      // exist to stop CONTACT chip damage and you could stand in a boss with impunity while burning
      player.hp-=player.maxhp*P.dot*dt;
      if(player.hp<1&&player.hp>0) player.hp=1;   // a lingering tick never lands the killing blow
    }
    if(typeof emitP==='function'&&Math.random()<5*dt){ const c=STATUS[id];
      if(c) emitP(player.x+(Math.random()*22-11),player.y-8,
        {vx:0,vy:id==='burn'?-26:-14,life:0.5,col:c.col,sz:2,glow:id==='burn'||id==='shock'}); }
    if(s.t<=0) delete player.st[id];
  }
}
function clearPlayerStatuses(){ player.st={}; player.possT=0; player.possCd=0; player.possE=null; }

// ---------------------------------------------------------------------------------------------
// POSSESSION (user: "the ghost mob should posses the player for only a second forcing them to
// move whatever direction the ghost is going, then let go").
//
// The wisps -- 42 species of Weeper, Voice and Empty Pelt -- had no mechanic of their own; they
// were an ordinary body with a ghost's sprite on it. This is theirs, and it is the only thing in
// the game that takes the STICK rather than the character: for one second your input does nothing
// and you travel the wisp's heading, sampled live, so it tows you wherever it happens to be going.
//
// Deliberate limits, each for a reason:
//   * one second exactly, as asked, and it cannot be extended by a second wisp arriving
//   * you keep your attacks. Losing movement is already the harshest thing in a dodging game;
//     taking the whole character away would make a crowd of wisps unplayable rather than scary
//   * a per-player lockout after release, so two wisps cannot pass you back and forth forever.
//     The same rule the status caps follow: a lock you cannot escape is not difficulty
//   * i-frames refuse it outright, exactly as they refuse stun and freeze
//   * the drag goes through moveCircle, so it can push you into the open but never through a wall
const POSS_T    = 1.0;    // how long it holds you
const POSS_CD   = 5.0;    // lockout AFTER release, measured from the grab
const POSS_GRAB = 12;     // reach past the two bodies -- a caster wisp can take you too
const POSS_DRAG = 1.05;   // fraction of your own speed it tows you at
function canPossess(e){
  if(!e||e.hp<=0||e.node||e.boss) return false;
  if((player.possT||0)>0 || (player.possCd||0)>0) return false;
  if(player.inv>0) return false;                              // i-frames refuse control loss
  return (typeof mobArch==='function') && mobArch(e)==='wisp';
}
function possessPlayer(e){
  if(!canPossess(e)) return false;
  player.possT=POSS_T; player.possCd=POSS_T+POSS_CD; player.possE=e;
  // seed the heading from the wisp's own last step; possessTick re-reads it every frame so it
  // tows you where it is going NOW, not where it was going when it grabbed you
  const mx=e.x-(e._px===undefined?e.x:e._px), my=e.y-(e._py===undefined?e.y:e._py);
  player.possA = (Math.hypot(mx,my)>0.05) ? Math.atan2(my,mx)
                                          : Math.atan2(e.y-player.y,e.x-player.x);
  if(typeof msg==='function') msg('IT HAS YOU','you go where it goes');
  if(typeof texts!=='undefined') texts.push({x:player.x,y:player.y-40,txt:'POSSESSED',col:'#c07ad4',life:0.8});
  if(typeof addShake==='function') addShake(7);
  if(typeof emitP==='function') for(let i=0;i<18;i++){ const a=Math.random()*6.283;
    emitP(player.x,player.y,{vx:Math.cos(a)*70,vy:Math.sin(a)*70-20,life:0.5,col:'#c07ad4',sz:2,glow:true}); }
  return true;
}
// The heading, re-read each frame. Falls back to the stored angle when the wisp is standing still
// or has died mid-grab, so a possession always carries you somewhere rather than freezing you in
// place -- being held still is a stun, and this is meant to be a shove.
function possessAngle(){
  const g=player.possE;
  if(g && g.hp>0){ const mx=g.x-(g._px===undefined?g.x:g._px), my=g.y-(g._py===undefined?g.y:g._py);
    if(Math.hypot(mx,my)>0.05){ player.possA=Math.atan2(my,mx); } }
  return player.possA||0;
}
// ===== ONE funnel for every point of PLAYER-SOURCE damage =====
// Shots, abilities, zones, minions and perk procs all land here, so the multipliers that
// should apply everywhere (curse / execute / shatter, lifesteal) and the on-hit perk
// triggers fire uniformly instead of only for auto-attacks.
//   src {crit, ability, zone, ally, perk, silent, col}  — silent skips the damage number
function dealDamage(e,amount,src){
  if(!e||e.hp<=0) return 0;
  if(e.decoy){ if(typeof bossDecoyHit==='function') bossDecoyHit(e); return 0; }            // mirror-puzzle guess
  if(e.mechInv) return 0;                                                                    // boss hidden among its images
  if(bossImmune(e)){ e.flash=Math.max(e.flash||0,0.1);                                       // phase beat / survival / dialogue
    if(!src||!src.silent){ if(typeof texts!=='undefined') texts.push({x:e.x+(Math.random()*16-8),y:e.y-e.r-2,txt:'IMMUNE',col:'#9ad4ef',life:0.5}); }
    return 0; }
  src=src||{};
  let dmg=Math.round(amount);
  if(e.dr) dmg=Math.max(1,Math.round(dmg*(1-e.dr)));                                        // enemy DEFENSE (armour)
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
  // EVERY POINT OF PLAYER DAMAGE REACHES THE HOST, not only auto-attacks. netReportHit used to have
  // exactly one caller, in the shot-collision block -- so on a client every ability, ultimate,
  // chain, splash, ally, pet, zone and perk proc moved the local health bar and was reverted by the
  // next snapshot. Worse than "no contribution": the client's own death loop then awarded XP for a
  // kill the host never saw. This is the funnel the file header already promises, and it is where
  // applyStatus reports from too (line 30) -- the working precedent.
  // Placed after every early return, so a nullified hit sends nothing, and it reports the
  // POST-mitigation number, which is what the host applies verbatim.
  if(typeof netReportHit==='function') netReportHit(e,dmg,!!src.crit);
  return dmg;
}
function los(x1,y1,x2,y2){
  const d=Math.hypot(x2-x1,y2-y1), steps=Math.ceil(d/14);
  for(let i=1;i<steps;i++){ const t=i/steps;
    if(solid(x1+(x2-x1)*t, y1+(y2-y1)*t)) return false; }
  return true;
}
// Where to aim to hit a MOVING target: solve |P + V t| = s t for the first t>0, where P is the
// offset to the enemy, V its velocity (07_update.js tracks it) and s the projectile speed.
// Expanding gives (V·V - s²)t² + 2(P·V)t + P·P = 0.
// Returns the point to shoot at, or the enemy itself when leading is impossible or pointless:
//   - a target faster than the shot, running away, has no intercept at all (both roots negative)
//   - a lead longer than the projectile lives is a shot that expires in empty ground
//   - a lead through a wall is worse than a direct shot that at least clips the corner
function aimPoint(e,spd,life){
  const vx=e.tvx||0, vy=e.tvy||0;
  const px=e.x-player.x, py=e.y-player.y;
  if(!vx && !vy) return e;
  const a=vx*vx+vy*vy-spd*spd, b=2*(px*vx+py*vy), c=px*px+py*py;
  let t;
  if(Math.abs(a)<1e-4){ if(Math.abs(b)<1e-6) return e; t=-c/b; }   // target moving at shot speed
  else { const disc=b*b-4*a*c; if(disc<0) return e;
    const r=Math.sqrt(disc), t1=(-b-r)/(2*a), t2=(-b+r)/(2*a);
    t=Math.min(t1<1e-4?Infinity:t1, t2<1e-4?Infinity:t2); }
  if(!isFinite(t) || t<=0 || t>(life||1)) return e;
  const ax=e.x+vx*t, ay=e.y+vy*t;
  if(!los(player.x,player.y,ax,ay)) return e;
  return {x:ax,y:ay};
}
function fire(dt){
  player.fireT-=dt;
  if(player.fireT>0) return;
  // frozen / stunned: the shot does not go off. MOUNTED: neither does it — a mount carries you
  // unarmed, and that trade is the only thing stopping "stay mounted" from being the correct play
  // in every situation. playerCanAttack wraps playerCanAct rather than replacing it, because
  // 07_update reads playerCanAct to decide whether you are frozen and zeroes your speed with it.
  if(typeof playerCanAttack==='function'){ if(!playerCanAttack()) return; }
  else if(!playerCanAct()) return;
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
    const _psp=(wt.spd||520)*(player.projSpd||1);
    // RANGE_SCALE rides on the LIFETIME, so this cap and the shot below cannot disagree about how
    // far the weapon reaches -- an auto-aim that locks onto something the bolt expires short of is
    // worse than no auto-aim, because it silently spends your fire rate on a target you cannot hit.
    const wRange=_psp*(wt.life||1)*RANGE_SCALE*1.15;
    // TARGETING MODE (user, 2026-07-27) decides WHICH reachable enemy wins, not whether to
    // auto-aim at all. Range and line-of-sight are still absolute: a mode can only ever reorder
    // the targets you could already hit, never let you shoot through a wall or past your reach.
    let best=null, bd=1e9;
    const _mode=(typeof targetMode==='function')?targetMode():'near';
    for(const e of enemies){
      // TWO DIFFERENT THINGS ARE CALLED A NODE, and skipping both made four fights unwinnable.
      // A DUNGEON OBJECTIVE node (genDungeon's {t:'N'} regrow/ambush spawns) is scenery you
      // solve, and auto-aim should ignore it -- that is what this line was for. But a fight's
      // GATE node (mechAdds' knots and conduits, which carry a mechTag) is the only way to drop
      // the boss's ward: with the ward up and nothing else alive in the arena, `best` stayed
      // null, fire() hit its `if(ang===null) return` and the player could not shoot AT ALL.
      // The ward never dropped, so the boss was immune forever. On PC you could switch to
      // manual aim in Settings and never notice; on touch, auto-aim is the only mode there is.
      if(e.node && !e.mechTag) continue;                      // objective nodes are not targets
      // ...and a gate node ranks LAST among real targets, so it never steals a shot from a
      // creature that is actually attacking you -- it only wins when nothing else is left.
      const _isGate=!!(e.node && e.mechTag);
      if(Math.hypot(e.x-player.x,e.y-player.y)>wRange) continue;
      if(!los(player.x,player.y,e.x,e.y)) continue;
      // every mode scores LOWER = better, so one comparison serves them all
      let score;
      if(_mode==='hp')        score=-(e.hp||0);              // highest HP first
      else if(_mode==='low')  score=(e.hp||0);               // finish the wounded
      else if(_mode==='boss') score=(e.boss?0:1e6)+Math.hypot(e.x-ref.x,e.y-ref.y);
      else                    score=Math.hypot(e.x-ref.x,e.y-ref.y);
      if(_isGate) score+=1e5;                                // last resort, never a priority
      if(score<bd){ bd=score; best=e; }
    }
    // lead the target: aim where it WILL be when the shot arrives, not where it is now
    // LEAD IT AT THE SPEED IT ACTUALLY FLIES. aimPoint solves an intercept in real seconds and
    // rejects a solution later than `life`, so both arguments have to be in the same frame as the
    // integration: PROJ_SCALE slows the bolt and stretches its lifetime by the same factor.
    // Passing the raw pair would have under-led every moving target by exactly the scale, which is
    // the kind of miss that reads as "the aim is broken" rather than as "the shots are slower".
    if(best){ const p=aimPoint(best,_psp*PROJ_SCALE,(wt.life||1)*RANGE_SCALE/PROJ_SCALE);
      ang=Math.atan2(p.y-player.y,p.x-player.x); }
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
  let dm=player.dmg*(wt.dm||1)*(player.bDmgT>0?(player.bDmgM||1.5):1)*((typeof dynAtk==='function')?dynAtk():1)*playerDmgMul();
  if(crit) dm*=(player.critMult||1.5);
  let pr=(wt.pierce||0)+(player.pierce||0);
  if(de3){ dm*=3; pr=99; }
  if(crit&&player.critPierce) pr=99;                 // Sharpshooter: crits pierce everything
  const psp=(wt.spd||520)*(player.projSpd||1);          // DEX -> projectile speed
  // Projectile count comes from the WEAPON and nothing else (user, 2026-07-26). It used to add the
  // class's own `shots` on top, which meant the same weapon fired a different number of bolts in
  // different hands and no weapon's rate could be balanced against its output — a Shaman's staff
  // threw three. Class identity lives in rate and damage now; the weapon decides how many.
  const n=Math.min(7,wt.shots||1);
  // projectile forge key: every (class, weapon type, tier, rarity) combo has its own look
  const _cls=(typeof curChar==='function'&&curChar())?curChar().cls:'x';
  const _rar=(typeof eqRar==='function')?(eqRar('wpn')||0):0;
  const _wtn=(typeof CWEAP!=='undefined'&&CWEAP[_cls])||'sword';
  const _wtier=(rpg?(rpg.wpn||0):0);
  let pk='w:'+_cls+':'+_wtn+':'+_wtier+':'+_rar;
  // Tie the shot's look to the weapon that fired it rather than to a hash of the key: the weapon
  // type picks the shape family and the tier sets the hue and the top-end shape, so upgrading a
  // bow visibly changes what comes off the string.
  const _look=(typeof projLook==='function')?projLook(_wtn,_wtier):null;
  let pcore=(_rar>0&&typeof RAR_COL!=='undefined')?RAR_COL[_rar]:undefined;
  // status builds recolour the shot to the effect it inflicts (recalcStats -> player.shotStat).
  // The '|st:' suffix gives the forge a distinct cached sprite so the tint sticks per status.
  const _ss=player.shotStat, _sc=_ss?_ss.col:undefined;
  if(_ss){ pk+='|st:'+_ss.id; pcore=_sc; }
  for(let i=0;i<n;i++){
    let sx=player.x, sy=player.y, sa=ang;
    if(wt.par && n>1){ const off=(i-(n-1)/2)*wt.par;
      sx+=Math.cos(ang+Math.PI/2)*off; sy+=Math.sin(ang+Math.PI/2)*off; }
    else if(n>1){ sa=ang+(i-(n-1)/2)*(wt.spread||0.15); }
    pShots.push({x:sx,y:sy,px:sx,py:sy,
      vx:Math.cos(sa)*psp,vy:Math.sin(sa)*psp,
      // the ONE place a weapon's reach is set. Abilities and ultimates push their own shots with
      // their own lifetimes and are deliberately not scaled by this.
      r:wt.size||5,life:(wt.life||1)*RANGE_SCALE,dmg:dm,crit:crit,
      pierce:pr,lastHit:null,slow:player.slowShot,pk:pk,pc:_sc,pcore:pcore,
      // a status build recolours the shot, so let its hue win over the tier's
      psh:_look?_look.shape:undefined, phu:(_look&&!_ss)?_look.hue:undefined,
      pspin:_look?_look.spin:0, age:0});
  }
  if(de3) player.deadeye--;
  chargeRes('shot'); lastShotT=0;
}
function eFire(e,ang,spd=200){
  // per-family forged look: each boss by name, mobs by type + level bracket
  const pk='e:'+(e.name?('B_'+e.name):(e.type+'_'+Math.floor((e.lv||1)/12)));
  eShots.push({x:e.x,y:e.y,px:e.x,py:e.y,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,
    r:e.psize||6,life:3,bd:(e.bd||8)*statusDmgOut(e),col:e.pcol||null,core:e.pcore||null,shape:e.pshape||null,pk:pk,
    owner:e,             // who fired it: on-hurt perks need a target to punish
    inf:e.inf||null});   // the caster's affliction rides the bolt
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
