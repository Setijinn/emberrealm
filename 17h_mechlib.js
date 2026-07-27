// ===================================================================================
// 17h_mechlib.js — THE MECHANIC PRIMITIVES the 25 fights are built from.
//
// Twenty-five bespoke fights written from scratch would be twenty-five hazard loops, twenty-five
// telegraph implementations and twenty-five co-op sync paths. Instead there is one of each here,
// parameterised, and a fight is a COMPOSITION: which primitives, in what arrangement, on what
// rhythm. That is also what keeps them distinguishable in play — two fights that both drop ground
// hazards still feel nothing alike if one drops them in a closing ring and the other in a line
// that chases you.
//
// Everything a fight puts on the field lives on `e.mk` (one object per boss), so bossReset clears
// a fight completely by dropping that one field, and the netcode has one place to look.
//
// DIFFICULTY RISES WITH LEVEL (user, 2026-07-27: "make sure the fights get progressively more
// difficult the higher level the fights get"). Every primitive reads bossPace(e) rather than
// hard-coding its timings, so the same mechanic is a slow readable puzzle at Lv4 and a genuine
// squeeze at Lv50 — without changing what it IS, which is what keeps the fight recognisable while
// still being harder.
// ===================================================================================

// ---- THE DIFFICULTY DIAL ----
// 0 at the first boss, 1 at the cap. Everything below scales off this ONE number, so the whole
// curve can be tuned in one place and no mechanic can drift out of step with the others.
function bossDiff(e){
  const lv=(e&&e.lv)||1, cap=(typeof LV_CAP!=='undefined')?LV_CAP:50;
  return Math.max(0,Math.min(1,(lv-4)/(cap-4)));
}
// The pace multipliers a primitive should use. Read them; do not invent your own numbers.
//   tele   telegraph length      1.00 -> 0.55   (you get less warning)
//   cycle  time between events   1.00 -> 0.62   (they come more often)
//   count  how many at once      1.00 -> 1.90   (there are more of them)
//   speed  how fast things move  1.00 -> 1.45
//   dmg    hazard damage         1.00 -> 1.30   (on top of the boss's own bd scaling)
// A DUNGEON form is harder again at the same level: it is the same creature awake and angry.
function bossPace(e){
  const d=bossDiff(e), f=(e&&(e.awk||e.den))?1:0;
  return {
    tele : (1.00-0.45*d) * (f?0.88:1),
    cycle: (1.00-0.38*d) * (f?0.85:1),
    count: (1.00+0.90*d) * (f?1.20:1),
    speed: (1.00+0.45*d) * (f?1.10:1),
    dmg  : (1.00+0.30*d) * (f?1.15:1),
    d:d, dun:!!f,
  };
}
// Damage a hazard should do. Scales with the boss's own damage AND the level dial, and is capped
// as a fraction of your pool so a mechanic can never one-shot you (rule: deaths come from
// patterns, not single hits).
function mechDmg(e,mul){
  const P=bossPace(e), base=(e.bd||10)*(mul===undefined?1:mul)*P.dmg;
  const cap=(typeof player!=='undefined'&&player.maxhp)?player.maxhp*0.26:9999;
  return Math.min(cap, base);
}
function mkState(e){ if(!e.mk) e.mk={haz:[],beam:null,wall:null,mark:null,ring:null,t:0,t2:0,n:0,ph:-1}; return e.mk; }
function _pl(){ return (typeof player!=='undefined')?player:null; }
function _hurt(amount){ if(typeof damagePlayer==='function') damagePlayer(amount); }

// ---------------------------------------------------------------------------------
// GROUND HAZARD — the workhorse. A circle that telegraphs, goes live, then fades.
// opts: {r, tele, live, dmg, tick, col, follow, grow, inflict}
// ---------------------------------------------------------------------------------
// How many hazards this fight currently owns. A fight that lays LASTING ground (scars, pools)
// needs this: the Bog Horror stacked 26 overlapping zones under a mound that follows the player,
// which is six times a level-matched hero's health bar per second. Long-lived floor denial must
// cap its own count or it stops being terrain and becomes a damage engine.
function mechHazCount(e){ return (e && e.mk && e.mk.haz) ? e.mk.haz.length : 0; }

function hazAdd(e,x,y,opts){
  const M=mkState(e), P=bossPace(e), o=opts||{};
  M.haz.push({ x:x, y:y, r:o.r||TILE*1.1, r0:o.r||TILE*1.1,
    ph:'tele', t:(o.tele!==undefined?o.tele:1.1)*P.tele,
    live:(o.live!==undefined?o.live:4.0), dmg:o.dmg!==undefined?o.dmg:0.55,
    tick:o.tick||0.4, ct:0, col:o.col||'#7a3a2a', grow:o.grow||0,
    follow:o.follow||0, inflict:o.inflict||null });
  return M.haz[M.haz.length-1];
}
function hazTick(e,dt){
  const M=e.mk; if(!M||!M.haz.length) return;
  const pl=_pl();
  for(let i=M.haz.length-1;i>=0;i--){
    const h=M.haz[i];
    if(h.follow&&pl){ h.x+=(pl.x-h.x)*Math.min(1,h.follow*dt); h.y+=(pl.y-h.y)*Math.min(1,h.follow*dt); }
    if(h.grow) h.r+=h.grow*dt;
    h.t-=dt;
    if(h.ph==='tele'){ if(h.t<=0){ h.ph='live'; h.t=h.live; } continue; }
    if(h.t<=0){ M.haz.splice(i,1); continue; }
    h.ct-=dt;
    if(h.ct<=0 && pl && Math.hypot(pl.x-h.x,pl.y-h.y)<h.r){
      h.ct=h.tick; _hurt(mechDmg(e,h.dmg));
      if(h.inflict && typeof playerStatus==='function') playerStatus(h.inflict.id,h.inflict.dur,h.inflict.val||0);
    }
  }
}
function hazDraw(e){
  const M=e.mk; if(!M||!M.haz.length) return;
  const t=performance.now()/1000;
  for(const h of M.haz){
    ctx.save();
    if(h.ph==='tele'){
      // a dashed, closing ring: you can read both WHERE and WHEN from it
      const k=1-Math.max(0,h.t)/Math.max(0.001,h.t+0.0001);
      ctx.globalAlpha=0.55+0.35*Math.sin(t*14);
      ctx.strokeStyle=h.col; ctx.lineWidth=2; ctx.setLineDash([6,5]); ctx.lineDashOffset=-t*22;
      ctx.beginPath(); ctx.arc(h.x,h.y,h.r,0,6.29); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha=0.14; ctx.fillStyle=h.col;
      ctx.beginPath(); ctx.arc(h.x,h.y,h.r,0,6.29); ctx.fill();
    } else {
      const fade=Math.min(1,h.t/0.6);
      ctx.globalAlpha=0.34*fade;
      const g=ctx.createRadialGradient(h.x,h.y,h.r*0.15,h.x,h.y,h.r);
      g.addColorStop(0,h.col); g.addColorStop(1,h.col+'00');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(h.x,h.y,h.r,0,6.29); ctx.fill();
      ctx.globalAlpha=0.5*fade; ctx.strokeStyle=h.col; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(h.x,h.y,h.r,0,6.29); ctx.stroke();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------------
// SWEEPING BEAM — a rotating sector. The Harrier's lighthouse, the Titan's scan.
// ---------------------------------------------------------------------------------
function beamStart(e,opts){
  const M=mkState(e), P=bossPace(e), o=opts||{};
  M.beam={ ang:o.ang||0, w:(o.w||0.42), spin:(o.spin||0.8)*P.speed,
    len:o.len||TILE*13, dmg:o.dmg!==undefined?o.dmg:0.5, tick:o.tick||0.5, ct:0,
    col:o.col||'#ffd07a', life:(o.life||8)*1, from:o.from||'boss' };
}
function beamTick(e,dt){
  const M=e.mk, B=M&&M.beam; if(!B) return;
  B.life-=dt; if(B.life<=0){ M.beam=null; return; }
  B.ang+=B.spin*dt;
  const pl=_pl(); if(!pl) return;
  const ox=(B.from==='boss')?e.x:B.x, oy=(B.from==='boss')?e.y:B.y;
  const dx=pl.x-ox, dy=pl.y-oy, d=Math.hypot(dx,dy);
  if(d>B.len) return;
  let a=Math.atan2(dy,dx)-B.ang;
  while(a>Math.PI) a-=6.283; while(a<-Math.PI) a+=6.283;
  B.ct-=dt;
  if(Math.abs(a)<B.w/2 && B.ct<=0){ B.ct=B.tick; _hurt(mechDmg(e,B.dmg)); }
}
function beamDraw(e){
  const M=e.mk, B=M&&M.beam; if(!B) return;
  const ox=(B.from==='boss')?e.x:B.x, oy=(B.from==='boss')?e.y:B.y;
  ctx.save(); ctx.globalCompositeOperation='lighter';
  const g=ctx.createRadialGradient(ox,oy,4,ox,oy,B.len);
  g.addColorStop(0,B.col+'aa'); g.addColorStop(1,B.col+'00');
  ctx.fillStyle=g; ctx.globalAlpha=0.5;
  ctx.beginPath(); ctx.moveTo(ox,oy);
  ctx.arc(ox,oy,B.len,B.ang-B.w/2,B.ang+B.w/2); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------------
// SAFE GROUND — the arena floods and only a few patches are safe. The survival shape.
// ---------------------------------------------------------------------------------
function safeStart(e,n,opts){
  const M=mkState(e), P=bossPace(e), o=opts||{};
  const N=Math.max(1,Math.round(n/Math.max(1,P.count*0.75)));   // FEWER safe spots at high level
  const safes=[]; let tries=0;
  const pl=_pl()||{x:e.x,y:e.y};
  while(safes.length<N && tries<80){ tries++;
    const a=Math.random()*6.283, d=TILE*(1.3+Math.random()*3.4);
    const sx=pl.x+Math.cos(a)*d, sy=pl.y+Math.sin(a)*d;
    if(typeof solid==='function' && solid(sx,sy)) continue;
    if(safes.some(s=>Math.hypot(s.x-sx,s.y-sy)<TILE*2)) continue;
    safes.push({x:sx,y:sy});
  }
  if(!safes.length) safes.push({x:pl.x,y:pl.y});
  M.ring={ safes:safes, r:(o.r||TILE*1.15), t:(o.tele||2.2)*P.tele, ph:'tele',
    col:o.col||'#8fd48c', dmg:o.dmg!==undefined?o.dmg:1.5, live:o.live||0.9 };
}
function safeTick(e,dt){
  const M=e.mk, R=M&&M.ring; if(!R) return;
  R.t-=dt;
  if(R.ph==='tele'){ if(R.t<=0){ R.ph='fire'; R.t=R.live;
      const pl=_pl();
      const ok=pl && R.safes.some(s=>Math.hypot(pl.x-s.x,pl.y-s.y)<R.r);
      if(!ok){ _hurt(mechDmg(e,R.dmg)); if(typeof addShake==='function') addShake(10); }
      if(typeof msg==='function') msg(ok?'SAFE':'TOO SLOW','');
    } return; }
  if(R.t<=0) M.ring=null;
}
function safeDraw(e){
  const M=e.mk, R=M&&M.ring; if(!R) return;
  const t=performance.now()/1000;
  ctx.save();
  if(R.ph==='tele'){
    // everything outside the safe circles darkens, so "where is safe" reads instantly
    const A=(typeof bossArenaOf==='function')?bossArenaOf(e):null;
    ctx.globalAlpha=0.30;
    ctx.fillStyle='rgba(90,20,20,1)';
    if(A) ctx.fillRect(A.x0,A.y0,A.x1-A.x0,A.y1-A.y0);
    ctx.globalCompositeOperation='destination-out';
    for(const s of R.safes){ ctx.beginPath(); ctx.arc(s.x,s.y,R.r,0,6.29); ctx.fill(); }
    ctx.globalCompositeOperation='source-over';
    ctx.globalAlpha=0.8+0.2*Math.sin(t*10);
    ctx.strokeStyle=R.col; ctx.lineWidth=3;
    for(const s of R.safes){ ctx.beginPath(); ctx.arc(s.x,s.y,R.r,0,6.29); ctx.stroke(); }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------------
// THE MARK — a debuff that resolves after a delay unless you do something about it.
// ---------------------------------------------------------------------------------
function markSet(e,opts){
  const M=mkState(e), P=bossPace(e), o=opts||{};
  M.mark={ t:(o.dur||5)*P.tele, dmg:o.dmg!==undefined?o.dmg:1.4, r:o.r||TILE*2.4,
    col:o.col||'#ff6a3d', cleansed:false, stacks:(o.stacks||1) };
}
function markTick(e,dt,cleanseTest){
  const M=e.mk, K=M&&M.mark; if(!K) return;
  if(cleanseTest && cleanseTest()){ M.mark=null;
    if(typeof msg==='function') msg('CLEANSED',''); return; }
  K.t-=dt;
  if(K.t<=0){
    const pl=_pl();
    if(pl){ _hurt(mechDmg(e,K.dmg*K.stacks));
      if(typeof addShake==='function') addShake(9);
      if(typeof fx!=='undefined') fx.push({t:'ring',x:pl.x,y:pl.y,r:K.r,life:0.5,col:K.col}); }
    M.mark=null;
  }
}
function markDraw(e){
  const M=e.mk, K=M&&M.mark; if(!K) return;
  const pl=_pl(); if(!pl) return;
  const t=performance.now()/1000, urg=1-Math.max(0,Math.min(1,K.t/5));
  ctx.save();
  ctx.globalAlpha=0.5+0.45*Math.sin(t*(6+urg*14));
  ctx.strokeStyle=K.col; ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.arc(pl.x,pl.y,K.r*(0.6+0.4*urg),0,6.29); ctx.stroke();
  // a countdown arc: how long you have, not just that you are marked
  ctx.globalAlpha=0.9; ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(pl.x,pl.y,K.r*0.5,-1.57,-1.57+6.283*Math.max(0,K.t/5)); ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------------
// ADDS — a fight's own summons, tagged so it can find and clear them.
// ---------------------------------------------------------------------------------
function mechAdds(e,n,tag,opts){
  if(typeof enemies==='undefined'||typeof makeEnemy!=='function') return [];
  const P=bossPace(e), o=opts||{};
  const N=Math.max(1,Math.round(n*(o.scale===false?1:P.count)));
  const made=[];
  const lv=e.lv||10, edr=(typeof eDR==='function')?eDR(eDef(lv)):0;
  const mh=40*(typeof eHpScale==='function'?eHpScale(lv):1)*(1-edr)*(o.hp||1);
  for(let i=0;i<N;i++){
    const a=(i/N)*6.283+Math.random()*0.5, d=o.dist||70;
    const sp=(typeof safeSpot==='function')?safeSpot(curRoom,e.x+Math.cos(a)*d,e.y+Math.sin(a)*d):{x:e.x,y:e.y};
    const m={type:o.type||'c', summoned:true, mechTag:tag, owner:e,
      x:sp.x, y:sp.y, r:o.r||15, hp:Math.round(mh), maxhp:Math.round(mh),
      spd:(o.spd||120)*P.speed, touch:(6+(typeof eDmgScale==='function'?eDmgScale(lv):0)*0.38)*P.dmg,
      col:o.col||e.col, lv:lv, def:eDef(lv), dr:edr, dex:eDex(lv), maxmp:eMp(lv), mp:eMp(lv)};
    if(o.node){ m.type='N'; m.node=true; m.spd=0; m.touch=0; }
    enemies.push(m); made.push(m);
  }
  return made;
}
function mechAddsAlive(e,tag){
  if(typeof enemies==='undefined') return 0;
  let n=0; for(const m of enemies) if(m&&m.mechTag===tag&&m.owner===e&&m.hp>0) n++;
  return n;
}
function mechClearAdds(e,tag){
  if(typeof enemies==='undefined') return;
  for(let i=enemies.length-1;i>=0;i--){ const m=enemies[i];
    if(m&&m.owner===e&&(!tag||m.mechTag===tag)) enemies.splice(i,1); }
}

// ---------------------------------------------------------------------------------
// A WARD the fight raises itself — read by bossImmune via e.wardInv.
// ---------------------------------------------------------------------------------
function wardRaise(e){ e.wardInv=1; if(typeof bossAnim==='function') bossAnim(e,'ward'); }
function wardDrop(e){ if(!e.wardInv) return; e.wardInv=0;
  if(typeof bossAnim==='function'){ bossAnim(e,'break'); }
  if(typeof msg==='function') msg('THE WARD BREAKS','strike it now'); }
function wardDraw(e){
  if(!e.wardInv) return;
  const t=performance.now()/1000;
  ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=0.30+0.14*Math.sin(t*3);
  ctx.strokeStyle=e.col||'#ffd07a'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(e.x,e.y,e.r*1.5,0,6.29); ctx.stroke();
  ctx.globalAlpha=0.10;
  ctx.fillStyle=e.col||'#ffd07a'; ctx.beginPath(); ctx.arc(e.x,e.y,e.r*1.5,0,6.29); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------------
// A full-arena tint, for phases that change what the ground IS.
// ---------------------------------------------------------------------------------
function arenaWash(e,col,a){
  const A=(typeof bossArenaOf==='function')?bossArenaOf(e):null;
  ctx.save(); ctx.globalAlpha=a; ctx.fillStyle=col;
  if(A) ctx.fillRect(A.x0,A.y0,A.x1-A.x0,A.y1-A.y0);
  else ctx.fillRect(e.x-700,e.y-700,1400,1400);
  ctx.restore();
}
// Every fight's draw ends with this so the shared primitives always render.
function mechDrawCommon(e){
  if(!e.mk) return;
  hazDraw(e); safeDraw(e); beamDraw(e); markDraw(e); wardDraw(e);
  netMechDraw(e);
}
// What a CLIENT draws for the shapes that only exist on the wire. The fights' own draw functions
// read host-side fields (M.isles, M.dx, M.fog) that a client never has, so they silently no-op;
// this renders the generic equivalents so the mechanic is visible where it is playable.
function netMechDraw(e){
  const M=e.mk; if(!M||!M.remote) return;
  if(M.fog>0){
    const R=(TILE*7.0)*(1-0.35*M.fog);
    ctx.save(); ctx.globalAlpha=0.74*M.fog;
    const g=ctx.createRadialGradient(player.x,player.y,R*0.55,player.x,player.y,R*1.7);
    g.addColorStop(0,'rgba(148,166,178,0)'); g.addColorStop(1,'rgba(148,166,178,1)');
    ctx.fillStyle=g; ctx.fillRect(player.x-R*1.8,player.y-R*1.8,R*3.6,R*3.6);
    ctx.restore();
  }
  if(M.safe&&M.safe.length){
    const A=(typeof bossArenaOf==='function')?bossArenaOf(e):null;
    ctx.save(); ctx.globalAlpha=0.26; ctx.fillStyle='#2f6f8f';
    if(A) ctx.fillRect(A.x0,A.y0,A.x1-A.x0,A.y1-A.y0);
    ctx.globalCompositeOperation='destination-out';
    for(const s of M.safe){ ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,6.29); ctx.fill(); }
    ctx.restore();
    ctx.save(); ctx.globalAlpha=0.7; ctx.strokeStyle='#8fd6e8'; ctx.lineWidth=3;
    for(const s of M.safe){ ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,6.29); ctx.stroke(); }
    ctx.restore();
  }
}
// ...and every fight's tick starts with it.
function mechTickCommon(e,dt){
  if(!e.mk) return;
  hazTick(e,dt); safeTick(e,dt); beamTick(e,dt);
}
// A timer helper: returns true once every `period` seconds, scaled by pace.
function mechEvery(e,key,period,dt){
  const M=mkState(e);
  if(M[key]===undefined) M[key]=period*bossPace(e).cycle;
  M[key]-=dt;
  if(M[key]<=0){ M[key]=period*bossPace(e).cycle; return true; }
  return false;
}

// ===================================================================================
// CO-OP: THE PRIMITIVE LAYER ON THE WIRE
//
// Enemy AI is host-only, so without this a client sees none of what the 25 fights put on the
// ground. The fights are NOT serialized individually — everything that can damage you lives in a
// handful of shared shapes on `e.mk`, so syncing the primitives makes all 25 work at once and
// keeps the netcode one thing instead of twenty-five.
//
// Only what a client must SEE or ACT ON crosses. Bespoke visual state (the Bog Horror's islands,
// the fog radius, the echo trail) stays home — a client missing it loses flavour, not fairness.
// Stonefist's pillars are the exception and do cross, because they are COVER: whether one stands
// between you and the boss decides whether the slam hits you, and a client that cannot see them
// cannot play the mechanic at all.
//
// Rows are arrays of rounded ints, matching the packing style of the rest of the snapshot.
// ===================================================================================
const NETMK_HAZ_CAP=20;    // a client dodging 20 circles is not meaningfully better off at 28
function netPackMech(e){
  const M=e&&e.mk; if(!M) return null;
  const haz=[];
  if(M.haz&&M.haz.length){
    // newest last; if we are over the cap drop the OLDEST, which are the ones about to expire
    const src=M.haz.length>NETMK_HAZ_CAP?M.haz.slice(M.haz.length-NETMK_HAZ_CAP):M.haz;
    for(const h of src) haz.push([Math.round(h.x),Math.round(h.y),Math.round(h.r),
                                  h.ph==='tele'?0:1, h.col||'']);
  }
  const ring=M.ring?[M.ring.ph==='tele'?0:1, Math.round(M.ring.r),
                     (M.ring.safes||[]).map(s=>[Math.round(s.x),Math.round(s.y)])]:null;
  const beam=M.beam?[+M.beam.ang.toFixed(2), +M.beam.w.toFixed(2), Math.round(M.beam.len)]:null;
  const mark=M.mark?[+M.mark.t.toFixed(2), Math.round(M.mark.r)]:null;
  const pil=(M.pillars&&M.pillars.length)
    ? M.pillars.filter(q=>q.hp>0).map(q=>[Math.round(q.x),Math.round(q.y)]) : null;
  const beams=(M.beams&&M.beams.length)?M.beams.map(b=>+b.a.toFixed(2)):null;
  const ring2=(M.ring2!==undefined)?Math.round(M.ring2):null;
  // GROUND YOU MUST BE STANDING ON. Six fights express their mechanic as "everywhere except here
  // is lethal" rather than as hazards, and the primitive layer alone did not carry them -- on a
  // client the Bog Horror's sinking islands and the Tidewrack's dry ring simply did not exist, so
  // the mechanic was unplayable rather than merely unseen. One generic list covers all of them.
  let safe=null;
  if(M.isles&&M.isles.length) safe=M.isles.map(s=>[Math.round(s.x),Math.round(s.y),Math.round(s.r)]);
  else if(M.dx!==undefined&&M.dy!==undefined) safe=[[Math.round(M.dx),Math.round(M.dy),Math.round(TILE*1.9)]];
  // the Tidewrack's dry ground is the circle around ITSELF, and only while the tide is in. It is
  // derivable from the boss position, but only if the client is told the tide is up at all.
  else if(M.tide!==undefined && Math.sin(M.tide)>0.25)
    safe=[[Math.round(e.x),Math.round(e.y),Math.round(TILE*3.2)]];
  // the fog radius: the Mistantler's whole identity is that you cannot see, and a client that can
  // see the arena is playing a different fight
  const fog=(M.fog>0)?+M.fog.toFixed(2):null;
  if(!haz.length&&!ring&&!beam&&!mark&&!pil&&!beams&&ring2===null&&!safe&&fog===null) return null;
  return [haz,ring,beam,mark,pil,beams,ring2,safe,fog];
}
// Rebuild a DISPLAY-AND-HAZARD `e.mk` on a client. Marked `remote` so nothing here is ever mistaken
// for authoritative state, and so the host's own resolution (which decides real damage for the
// host's player) is never confused with the client evaluating the same hazard against itself.
function netUnpackMech(e,a){
  if(!a){ if(e.mk&&e.mk.remote) e.mk=null; return; }
  const M=e.mk=(e.mk&&e.mk.remote)?e.mk:{remote:true};
  M.remote=true;
  const prev=M.haz||[];
  M.haz=(a[0]||[]).map((h,i)=>({x:h[0],y:h[1],r:h[2],ph:h[3]?'live':'tele',col:h[4]||'#7a3a2a',
    t:9,live:9,dmg:0.55,tick:0.4, ct:(prev[i]&&prev[i].ct)||0}));   // keep local tick cooldowns
  M.ring=a[1]?{ph:a[1][0]?'fire':'tele', r:a[1][1],
                safes:(a[1][2]||[]).map(s=>({x:s[0],y:s[1]})), t:9, _done:(M.ring&&M.ring._done)}:null;
  M.beam=a[2]?{ang:a[2][0], w:a[2][1], len:a[2][2], from:'boss', col:'#ffd07a', ct:0}:null;
  M.mark=a[3]?{t:a[3][0], r:a[3][1], col:'#ff6a3d'}:null;
  M.pillars=a[4]?a[4].map(q=>({x:q[0],y:q[1],hp:1})):null;
  M.beams=a[5]?a[5].map(v=>({a:v,s:0})):null;
  if(a[6]!==null&&a[6]!==undefined) M.ring2=a[6];
  M.safe=a[7]?a[7].map(q=>({x:q[0],y:q[1],r:q[2]})):null;
  M.fog=(a[8]!==null&&a[8]!==undefined)?a[8]:0;
}
// Evaluate the wire's hazards against THIS machine's player. The host resolves its own; every
// client resolves its own; nobody resolves anybody else's.
function netMechHurt(e,dt){
  const M=e&&e.mk; if(!M||!M.remote||typeof player==='undefined') return;
  const bd=(e.bd||10);
  for(const h of M.haz){
    if(h.ph!=='live') continue;
    h.ct-=dt; if(h.ct>0) continue;
    if(Math.hypot(player.x-h.x,player.y-h.y)<h.r){
      h.ct=0.4; damagePlayer(bd*0.55);
      if(typeof boom==='function') boom(player.x,player.y,h.col,4); }
  }
  // safe ground resolves ONCE, exactly like the host's version
  const R=M.ring;
  if(R && R.ph==='fire' && !R._done){ R._done=1;
    const ok=(R.safes||[]).some(s=>Math.hypot(player.x-s.x,player.y-s.y)<R.r);
    if(!ok){ damagePlayer(Math.min(player.maxhp*0.26, bd*1.5));
      player.inv=Math.max(player.inv||0,0.35);
      if(typeof addShake==='function') addShake(10); }
    else if(typeof texts!=='undefined')
      texts.push({x:player.x,y:player.y-30,txt:'SAFE!',col:'#8fd48c',life:0.9}); }
  const B=M.beam;
  if(B){ const dx=player.x-e.x, dy=player.y-e.y, d=Math.hypot(dx,dy);
    if(d<=B.len){ let ang=Math.atan2(dy,dx)-B.ang;
      while(ang>Math.PI) ang-=6.283; while(ang<-Math.PI) ang+=6.283;
      B.ct-=dt;
      if(Math.abs(ang)<B.w/2 && B.ct<=0){ B.ct=0.5; damagePlayer(bd*0.5); } } }
  // off the safe ground: the same slow drowning/burning tick the host applies to itself
  if(M.safe&&M.safe.length){
    const on=M.safe.some(s=>Math.hypot(player.x-s.x,player.y-s.y)<s.r);
    M.wet=(M.wet||0)+dt;
    if(!on && M.wet>0.5){ M.wet=0; damagePlayer(bd*0.40);
      if(typeof playerStatus==='function') playerStatus('chill',1.6,0); }
  }
  if(M.beams){ M.hit=(M.hit||0)-dt;
    for(const b of M.beams){ const dx=player.x-e.x, dy=player.y-e.y;
      if(Math.hypot(dx,dy)>TILE*12) continue;
      let ang=Math.atan2(dy,dx)-b.a; while(ang>Math.PI) ang-=6.283; while(ang<-Math.PI) ang+=6.283;
      if(Math.abs(ang)<0.21 && M.hit<=0){ M.hit=0.5; damagePlayer(bd*0.45); } } }
}
