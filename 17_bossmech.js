// ===================================================================================
// 17_bossmech.js — SIGNATURE BOSS MECHANICS + in-fight PUZZLES (user, 2026-07-24)
// Each named boss (GBOSS[].mech) runs a distinct mechanic that FITS its nature/lore, so no
// two fights feel the same and slow players get punished:
//   'bloom'  — SAFE-TILE puzzle: the arena erupts; reach one of a few unspoiled patches in
//              time or eat a heavy hit (Grovewarden thornrot / Stonefist fissures / Cinder fire flood).
//   'clones' — MIRROR puzzle: the boss hides among 4 identical images; ONE is the true one
//              (subtly crisper). Hit it to shatter the illusion for bonus damage; hit a false
//              idol and it detonates + the boss heals (Mistantler fog / Ash Wraith / Molten Titan).
//   'pools'  — spreading HAZARD: corrupted pools bubble up under you and linger, shrinking the
//              safe ground (Bog Horror bog / Gargoyle tar / Magmaw magma).
// Called from the boss update loop (bossMechTick) and on every phase break (bossMechTrigger).
// Decoy hits are resolved in dealDamage (06_combat). Overlays draw via drawBossMech().
// ===================================================================================

function bossPunishDmg(e){ return Math.min((player&&player.maxhp?player.maxhp*0.30:9999), (e.bd||10)*1.8); }

// ===================================================================================
// THE FIGHT REGISTRY (user, 2026-07-27): "25 distinct mechanics", and "make the dungeon boss and
// its overworld version kind of have the same mechanics but not all the way".
//
// So: 12 boss identities x 2 forms + the arena champion = 25 FIGHTS, built as 12 FAMILIES. The two
// forms of a boss share the family's core idea -- you recognise the creature instantly -- but the
// dungeon form twists one element and adds one of its own, so beating the Grovewarden outside
// teaches you something about the Awakened Grovewarden without teaching you everything.
//
// A fight is keyed by identity AND form, never by e.mech, which only had three values shared
// twelve ways.
//   ow<ring>  the overworld lair boss
//   dn<ring>  its dungeon form (Awakened, or the starter-island elder)
//   arena     the repeating wave champion
// Entries are registered from 17f_bossfights.js. Anything with no entry falls through to the old
// bloom/clones/pools behaviour, so the roster can land in batches without a half-built build.
// ===================================================================================
const BOSS_MECH={};
function bossMechKey(e){
  if(!e || e.decoy) return null;
  if(e.ring===undefined || e.ring===null || e.ring<0) return 'arena';
  return ((e.awk||e.den) ? 'dn' : 'ow')+e.ring;
}
function bossMechDef(e){ const k=bossMechKey(e); return k?(BOSS_MECH[k]||null):null; }
// HP fractions at which the fight escalates. A fight may declare 1, 2, 3 or 4 breaks; the old
// hard-coded 66/33 is the default so an unconverted boss is unchanged.
const BOSS_PHASE_DEF=[0.66,0.33];
function bossPhases(e){ const d=bossMechDef(e); return (d&&d.phases)||BOSS_PHASE_DEF; }
function bossPhaseFor(e){
  const th=bossPhases(e), f=(e.maxhp?e.hp/e.maxhp:1);
  let p=0; for(let i=0;i<th.length;i++) if(f<=th[i]) p=i+1;
  return p;
}
// ---- THE ARENA a boss is bound to, and its middle ----
// Overworld lairs stored this at worldgen (R.lairs[b]); dungeon boss chambers now do too
// (room.bossCh). Either shape answers the same two questions.
function bossArenaOf(e){
  if(!e) return null;
  if(e.arena) return e.arena;
  const R=(typeof curRoom!=='undefined')?curRoom:null;
  if(R && R.dungeon && R.bossCh){ const b=R.bossCh;
    return {x0:b.cx-b.rx, y0:b.cy-b.ry, x1:b.cx+b.rx, y1:b.cy+b.ry}; }
  return null;
}
function bossCentre(e){
  const R=(typeof curRoom!=='undefined')?curRoom:null;
  if(R && R.dungeon && R.bossCh) return {x:R.bossCh.cx, y:R.bossCh.cy};
  const A=bossArenaOf(e);
  if(A) return {x:(A.x0+A.x1)/2, y:(A.y0+A.y1)/2};
  return {x:e.x, y:e.y};      // no bounds known: anchor where it stands rather than teleport it
}
// ---- ANCHORED PHASES ----
// "It's fine if a boss stands still invincible for a minute and just blasts stuff like a survival
// stage." A phase may declare anchor:true -- the boss walks to the middle of its arena, plants,
// and cannot be damaged until the phase ends. The walk is deliberate: a boss that TELEPORTS to
// the centre reads as a bug, one that stalks to it reads as a decision.
function bossAnchorPhase(e){
  const d=bossMechDef(e); if(!d||!d.anchor) return false;
  const ph=e.phase||0;
  return Array.isArray(d.anchor) ? !!d.anchor[ph] : (typeof d.anchor==='function' ? !!d.anchor(e,ph) : !!d.anchor);
}
// Steer to the middle and lock. Returns true while the boss owes the anchor its movement, so the
// caller skips the ordinary chase.
//
// THE WINDOW IS TIMED, AND THAT IS THE WHOLE POINT. The brief was "it's fine if a boss stands
// still invincible for a minute and just blasts stuff" -- a MINUTE, not a phase. I implemented
// `anchor` as an unbounded per-phase state, so a boss entering an anchored phase became immune
// with no exit condition and the fight could never be finished: twelve of the fifteen anchored
// fights were literally unkillable, which is what the Gullwind Harrier's second phase was.
//
// Now: planting grants immunity for ANCHOR_WIN seconds while it blasts, then the ward drops and
// it is vulnerable again for ANCHOR_CD before it can plant a second time. Survive, punish, repeat.
// A fight wanting its own rule (break the conduits, cut the knots) uses wardInv instead and never
// touches this.
const BOSS_ANCHOR_SNAP=10;
// BOTH windows scale with bossPace().cycle. Only the cooldown used to, which meant the untouchable
// window stayed 9s while the window you could hit it in shrank with level: an anchored Lv55 fight
// was untouchable ~80% of the time against ~55% at Lv4. That is not a harder fight, it is a longer
// one. Scaling both keeps the ratio fixed and makes the whole cycle FASTER at level, which is what
// every other dial here does.
const ANCHOR_WIN=9.0;    // seconds untouchable, planted, firing (x P.cycle)
const ANCHOR_CD =7.5;    // seconds vulnerable before it may plant again (x P.cycle)
function bossAnchorStep(e,dt){
  if(!bossAnchorPhase(e)){ e.anchored=0; e.anchorInv=0; e.anchorT=0; e.anchorCd=0; return false; }
  // phase change re-arms the window
  const P=(typeof bossPace==='function')?bossPace(e):{cycle:1};
  if(e.anchorPh!==e.phase){ e.anchorPh=e.phase; e.anchorT=ANCHOR_WIN*P.cycle; e.anchorCd=0; }
  if(e.anchorT>0){
    e.anchorT-=dt;
    if(e.anchorT<=0){ e.anchorCd=ANCHOR_CD*P.cycle; e.anchorInv=0; e.anchored=0;
      if(typeof bossAnim==='function') bossAnim(e,'break');
      if(typeof msg==='function') msg('IT IS EXPOSED','strike it now'); }
  } else if(e.anchorCd>0){
    e.anchorCd-=dt;
    if(e.anchorCd<=0){ e.anchorT=ANCHOR_WIN*P.cycle;
      if(typeof bossAnim==='function') bossAnim(e,'plant');
      if(typeof msg==='function') msg('IT PLANTS ITSELF',''); }
  }
  // vulnerable stretch: the anchor releases the boss entirely so the fight reads as a normal one
  if(e.anchorT<=0){ e.anchored=0; e.anchorInv=0; return false; }
  const c=bossCentre(e), dx=c.x-e.x, dy=c.y-e.y, d=Math.hypot(dx,dy);
  if(d>BOSS_ANCHOR_SNAP){
    const sp=(e.spd||40)*1.55*dt;      // walks in faster than it fights -- it WANTS the middle
    if(typeof moveCircle==='function') moveCircle(e,(dx/d)*sp,(dy/d)*sp);
    else { e.x+=(dx/d)*sp; e.y+=(dy/d)*sp; }
    e.anchored=0; e.anchorInv=0;       // not immune until it actually ARRIVES
  } else {
    // a fight may want the PLANTING without the immunity (the Molten Titan's open core is meant to
    // be hittable, it is just suicidal to reach)
    e.x=c.x; e.y=c.y; e.anchored=1; e.anchorInv=e.anchorNoInv?0:1;
  }
  return true;
}
// ---- DYING WORDS: killing a boss frees it from the corruption-dream (which also ends it); it
// speaks a couple words of TRUTH as it goes. Shown as a slow, sombre centred quote (separate from
// the action banner). The final boss's line drops the whole reveal. (user, 2026-07-24) ----
let bossQuote=null;
// unconditional — used by the beats that OUTRANK chatter (phase lines, dying words)
function bossSayNow(line,dur,who){ if(!line) return;
  bossQuote={line:line, born:performance.now(), dur:dur||6200, who:who||null,
             x:who?who.x:0, y:who?who.y:0, r:who?who.r:0}; }
function bossSayDeath(line,who){ bossSayNow(line,6200,who); }
// ---- IN-FIGHT DIALOGUE ----
// The two phase banners alone left the Lv30-50 bosses nearly silent through a long fight, so the
// confession they are supposed to be building landed in two lines. Each canon boss now speaks on
// ENGAGE and at four HP milestones as well, in the same sombre quote treatment as its dying words
// — the phase banners stay the loud beats, this is the boss talking THROUGH the fight.
const BOSS_CHAT_AT=[0.86,0.52,0.24,0.09];
// true while a line is still on screen — callers must WAIT rather than fire and lose the line
function quoteBusy(){ return !!(bossQuote && (performance.now()-bossQuote.born) < bossQuote.dur-700); }
function bossSayLine(line,dur,who){ if(!line || quoteBusy()) return false;
  bossQuote={line:line, born:performance.now(), dur:dur||4600, who:who||null,
             x:who?who.x:0, y:who?who.y:0, r:who?who.r:0};
  return true; }
function bossChatter(e){
  const gb=(typeof GBOSS!=='undefined' && e && e.ring!=null && e.ring>=0)?GBOSS[e.ring]:null;
  if(!gb || e.decoy) return;
  if(typeof bossBar==='undefined' || bossBar!==e) return;      // only the boss you're actually fighting
  if(e.phaseInv>0) return;                                     // let the phase beat land alone
  if(!e.saidOpen){ if(!gb.open){ e.saidOpen=1; }
    else if(bossSayLine(gb.open,5000,e)){ e.saidOpen=1; e.dlgInv=Math.max(e.dlgInv||0,1.8); return; }
    else return; }
  if(!gb.mid || !gb.mid.length) return;
  if(e.chat===undefined) e.chat=0;
  const f=e.hp/e.maxhp;
  // Check what's DUE before checking whether we can speak, and don't consume a milestone we
  // can't voice — otherwise a line whose moment arrives while another is on screen is marked
  // said and silently lost. Overdue milestones collapse to the most recent one.
  if(e.chat>=BOSS_CHAT_AT.length || f>BOSS_CHAT_AT[e.chat]) return;
  if(quoteBusy()) return;
  let spoke=null;
  while(e.chat<BOSS_CHAT_AT.length && f<=BOSS_CHAT_AT[e.chat]){ spoke=gb.mid[e.chat]; e.chat++; }
  if(spoke) bossSayLine(spoke,0,e); }
// 9-SLICE the plaque so one bitmap fits any line count: corners drawn at native size, edges and
// centre stretched. INSET must match the art's actual border thickness or the corners smear.
const QUOTE_INSET=26;   // == the corner size baked into assets/ui/quote_frame.png (60x60 atlas)
// s = corner size in the SOURCE atlas, ds = size to draw it at (so the border scales with the
// text/UI, not with the bitmap). Corners stay square; edges and centre stretch to fill.
function _slice9(im,x,y,w,h,s,ds){
  const iw=im.width, ih=im.height, d=Math.min(ds||s, Math.floor(w/2), Math.floor(h/2));
  const mw=iw-s*2, mh=ih-s*2, cw=w-d*2, ch=h-d*2;
  ctx.drawImage(im,0,0,s,s, x,y,d,d);                       ctx.drawImage(im,iw-s,0,s,s, x+w-d,y,d,d);
  ctx.drawImage(im,0,ih-s,s,s, x,y+h-d,d,d);                ctx.drawImage(im,iw-s,ih-s,s,s, x+w-d,y+h-d,d,d);
  if(cw>0){ ctx.drawImage(im,s,0,mw,s, x+d,y,cw,d);         ctx.drawImage(im,s,ih-s,mw,s, x+d,y+h-d,cw,d); }
  if(ch>0){ ctx.drawImage(im,0,s,s,mh, x,y+d,d,ch);         ctx.drawImage(im,iw-s,s,s,mh, x+w-d,y+d,d,ch); }
  if(cw>0&&ch>0) ctx.drawImage(im,s,s,mw,mh, x+d,y+d,cw,ch);
}
// BOSS DIALOGUE IS A SUBTITLE BAR (user, 2026-07-26). It used to float above the speaker's head,
// which meant the thing you were meant to read moved while you were dodging it -- and a boss that
// charges across the arena drags its own words out from under your eyes. It sits in one fixed
// place now, low and centred like film subtitles: your eyes stay on the fight, and the text is
// always where you last saw it. The speaker's NAME goes above the line, because a plaque that no
// longer points at anyone has to say who is talking.
function drawBossQuote(){
  if(!bossQuote) return;
  const q=bossQuote, el=performance.now()-q.born;
  if(el>q.dur){ bossQuote=null; return; }
  const a=Math.min(1, el/500)*Math.min(1,(q.dur-el)/900);           // fade in / out
  const fs=Math.max(13, Math.round(17*(typeof UIS!=='undefined'?UIS:1)));
  ctx.save(); ctx.globalAlpha=a; ctx.textAlign='center';
  ctx.font='italic '+fs+'px "Pixelify Sans",serif';
  const maxw=Math.min(W*0.72,680);
  const words=q.line.split(' '); let lines=[],cur='';
  for(const w of words){ const test=cur?cur+' '+w:w;
    if(ctx.measureText(test).width>maxw){ if(cur)lines.push(cur); cur=w; } else cur=test; }
  if(cur) lines.push(cur);
  const lh=Math.round(fs*1.18);        // tighter leading; 1.35 left visible dead space between lines
  let tw=0; for(const L of lines) tw=Math.max(tw,ctx.measureText(L).width);
  const im=(typeof _quoteFrame!=='undefined')?_quoteFrame:null;
  // The plaque is sized FROM the text, and the padding is the frame's own border thickness plus a
  // breathing gap — so however long the line is, the words always sit inside the carved border
  // instead of running under it, and a one-line box never collapses the 9-slice corners.
  // the border is drawn proportional to the text, so a bigger UI scale gets a bigger frame too
  const framed=!!(im && im.complete && im.naturalWidth);
  // Keep the plaque tight to the words. The border is drawn at a smaller inset than the atlas's
  // own 26px corner and the padding adds only a thin gap on top of it, so the frame hugs the text
  // instead of the box being mostly border with a sentence lost in the middle of it.
  const ins=framed?Math.max(10,Math.round(QUOTE_INSET*0.52*(fs/17))):6;
  const padX=ins+Math.round(fs*0.16), padY=ins-Math.round(fs*0.10);
  // the speaker's name rides inside the plaque, above the line, so reserve a row for it
  const who=(q.who&&q.who.name)?String(q.who.name).toUpperCase():'';
  const nfs=Math.max(9,Math.round(fs*0.62)), nh=who?Math.round(nfs*1.5):0;
  const bw=Math.max(ins*2+8, Math.ceil(tw)+padX*2), bh=Math.max(ins*2+6, lines.length*lh+nh+padY*2);
  // FIXED position: centred, resting just above the orb cluster. Anchored to the HUD rather than
  // to the world, so it never moves no matter what the speaker does.
  const om=(typeof hudOrbMetrics==='function')?hudOrbMetrics():{top:H*0.78};
  const us=(typeof UIS!=='undefined')?UIS:1;
  const cxq=W/2, top=Math.max(8, om.top-Math.round(12*us)-bh);
  if(framed){
    ctx.imageSmoothingEnabled=false;
    _slice9(im, Math.round(cxq-bw/2), Math.round(top), bw, bh, QUOTE_INSET, ins);
  } else {                                                          // frame not loaded: plain slab
    ctx.fillStyle='rgba(12,9,16,0.82)'; ctx.fillRect(cxq-bw/2,top,bw,bh);
    ctx.strokeStyle='rgba(150,120,190,0.55)'; ctx.lineWidth=2; ctx.strokeRect(cxq-bw/2,top,bw,bh); }
  if(who){ ctx.font='bold '+nfs+'px "Pixelify Sans",monospace';
    const ny=top+padY+nfs;
    ctx.fillStyle='rgba(0,0,0,.72)'; ctx.fillText(who,cxq+1,ny+1);
    ctx.fillStyle=(q.who&&q.who.col)||'#ff9c50'; ctx.fillText(who,cxq,ny);
    ctx.font='italic '+fs+'px "Pixelify Sans",serif'; }
  for(let i=0;i<lines.length;i++){ const yy=top+padY+nh+lh*(i+0.78);
    ctx.fillStyle='rgba(0,0,0,.72)'; ctx.fillText(lines[i],cxq+1,yy+1);
    ctx.fillStyle='#e4d6f5'; ctx.fillText(lines[i],cxq,yy); }
  ctx.restore(); ctx.textAlign='left';
}

// Is the player ACTUALLY in this fight? Shared by the registry and the legacy path: a world boss
// that merely spawned near you must not run its mechanic across the overworld at nobody.
function bossEngaged(e){
  return (typeof bossBar!=='undefined' && bossBar===e) && (typeof player!=='undefined') &&
    !e.dormant && Math.hypot(e.x-player.x, e.y-player.y) < 720;
}
function bossMechTick(e, dt){
  if(!e || e.decoy) return;
  const D=bossMechDef(e);
  if(D){
    const eng=bossEngaged(e);
    // A FIGHT THAT IS NOT RUNNING MAY NOT HOLD YOU IMMUNE. Every fight's tick opens with
    // `if(!eng) return;`, so a fight interrupted mid-vanish -- you walked 720px away, or the boss
    // walked back to its arena -- returned before the line that clears mechInv, and stayed
    // untouchable for good. The Ashen Echo did exactly that: 100% immune, phase 0, forever.
    // Disengage is the one moment the fight itself cannot handle, so it is handled here for all.
    if(!eng && e.mechInv) e.mechInv=0;
    if(D.tick) D.tick(e,dt,e.phase||0,eng);
    return; }
  if(!e.mech) return;
  // Only START a mechanic once the player is ACTUALLY in this fight — i.e. has HIT this boss
  // (bossBar is set on the first hit) and is still nearby. A world boss that merely spawned near
  // you must NOT spam safe-circles + screen shake across the overworld (the "random circles").
  // Already-active events still resolve regardless so nothing gets stuck.
  const engaged = bossEngaged(e);
  if(e.mechT===undefined) e.mechT = 8 + Math.random()*4;
  if(e.mech==='pools'){ if(engaged) _poolsTick(e, dt); return; }
  if(e.mech==='bloom'){
    if(e.bloom) _bloomTick(e, dt);
    else if(engaged){ e.mechT-=dt; if(e.mechT<=0){ e.mechT=9+Math.random()*4; _bloomStart(e); } }
  } else if(e.mech==='clones'){
    if(e.cloneOn) _clonesTick(e, dt);
    else if(engaged){ e.mechT-=dt; if(e.mechT<=0){ e.mechT=13+Math.random()*5; _clonesStart(e); } }
  }
}
// forced event on a phase break — a dramatic beat that also introduces the mechanic early
function bossMechTrigger(e){
  if(!e || e.decoy) return;
  const D=bossMechDef(e);
  if(D){ if(D.trigger) D.trigger(e,e.phase||0); return; }
  if(!e.mech) return;
  if(e.mech==='bloom' && !e.bloom) _bloomStart(e);
  else if(e.mech==='clones' && !e.cloneOn) _clonesStart(e);
  else if(e.mech==='pools'){ for(let q=0;q<3;q++) _poolDrop(e, 90+q*30); }
}

// -------------------------------------- BLOOM (safe-tile) --------------------------------------
function _bloomStart(e){
  const nsafe = Math.max(2, 4 - (e.phase||0));      // fewer safe patches as it enrages
  const safes=[]; let tries=0;
  while(safes.length<nsafe && tries<60){ tries++;
    const a=Math.random()*6.283, d=TILE*(1.4+Math.random()*3.2);
    const sx=player.x+Math.cos(a)*d, sy=player.y+Math.sin(a)*d;
    if(typeof solid==='function' && solid(sx,sy)) continue;
    if(safes.some(s=>Math.hypot(s.x-sx,s.y-sy)<TILE*2)) continue;
    safes.push({x:sx,y:sy});
  }
  if(!safes.length) safes.push({x:player.x,y:player.y});
  e.bloom={ph:'tele', t:2.2, dur:2.2, safes:safes, sr:TILE*1.15};
  if(typeof msg==='function') msg('☠ '+((e.name||'THE BOSS').toUpperCase()), 'REACH THE SAFE GROUND');
  if(typeof addShake==='function') addShake(6);
}
function _bloomTick(e, dt){
  const b=e.bloom; if(!b) return; b.t-=dt;
  if(b.t<=0){
    const safe = b.safes.some(s=>Math.hypot(player.x-s.x,player.y-s.y)<=b.sr);
    if(!safe){ if(typeof damagePlayer==='function') damagePlayer(bossPunishDmg(e));
      player.inv=Math.max(player.inv||0,0.35);
      if(typeof msg==='function') msg('TOO SLOW','the bloom caught you');
      if(typeof addShake==='function') addShake(10); navigator.vibrate&&navigator.vibrate(60);
    } else if(typeof texts!=='undefined') texts.push({x:player.x,y:player.y-30,txt:'SAFE!',col:'#8fd48c',life:0.8});
    // erupt everywhere but the safe patches (visual)
    if(typeof emitP==='function') for(let q=0;q<24;q++){ const a=Math.random()*6.283, r=40+Math.random()*260;
      emitP(e.x+Math.cos(a)*r, e.y+Math.sin(a)*r, {vx:0,vy:-40,life:0.4,col:e.col||'#c04a3d',sz:3,g:-30,glow:true}); }
    e.bloom=null;
  }
}
function _bloomDraw(e){
  const b=e.bloom; if(!b) return;
  const k=1-b.t/b.dur;                         // 0..1 as the eruption nears
  // danger veil over the whole arena, brightening as it closes in
  ctx.save(); ctx.globalAlpha=0.10+0.22*k; ctx.fillStyle=e.col||'#c04a3d';
  ctx.fillRect(camX-40,camY-40, W/(H/(viewTilesH()*TILE))+80, H/(H/(viewTilesH()*TILE))+80);
  ctx.restore();
  // safe patches: glowing green rings that pulse
  for(const s of b.safes){ const pl=0.6+Math.sin(performance.now()/120)*0.4;
    ctx.save();
    ctx.globalAlpha=0.28*pl; ctx.fillStyle='#8fd48c';
    ctx.beginPath(); ctx.arc(s.x,s.y,b.sr,0,6.29); ctx.fill();
    ctx.globalAlpha=0.9; ctx.strokeStyle='#bdf0a8'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(s.x,s.y,b.sr,0,6.29); ctx.stroke();
    ctx.restore();
  }
}

// -------------------------------------- POOLS (hazard) --------------------------------------
function _poolDrop(e, off){ off=off||0;
  e.pools=e.pools||[];
  if(e.pools.length>=9) return;
  const a=Math.random()*6.283, d=off + Math.random()*60;
  let px=player.x+Math.cos(a)*d, py=player.y+Math.sin(a)*d;
  if(typeof solid==='function' && solid(px,py)){ px=player.x; py=player.y; }
  e.pools.push({x:px,y:py, r:0, rmax:TILE*(1.5+Math.random()*0.7), t:1.0, ph:'tele', dur:4.5+Math.random()*2, dcd:0});
}
function _poolsTick(e, dt){
  e.poolT=(e.poolT===undefined?2:e.poolT)-dt;
  if(e.poolT<=0){ e.poolT=1.5+Math.random()*1.0; _poolDrop(e, 40); }
  const P=e.pools; if(!P) return;
  for(let i=P.length-1;i>=0;i--){ const p=P[i];
    if(p.ph==='tele'){ p.t-=dt; p.r=p.rmax*(1-Math.max(0,p.t)); if(p.t<=0){ p.ph='live'; p.r=p.rmax; } }
    else { p.dur-=dt; if(p.dur<=0){ P.splice(i,1); continue; }
      p.dcd-=dt;
      if(Math.hypot(player.x-p.x,player.y-p.y)<p.r*0.92 && p.dcd<=0){ p.dcd=0.35;
        if(typeof damagePlayer==='function') damagePlayer((e.bd||10)*0.55);
      }
    }
  }
}
function _poolsDraw(e){
  const P=e.pools; if(!P) return; const t=performance.now()/1000;
  for(const p of P){
    if(p.ph==='tele'){ ctx.save(); ctx.globalAlpha=0.5; ctx.strokeStyle=e.col||'#c85a2a'; ctx.lineWidth=2;
      ctx.setLineDash([6,5]); ctx.beginPath(); ctx.arc(p.x,p.y,p.rmax,0,6.29); ctx.stroke();
      ctx.globalAlpha=0.16; ctx.fillStyle=e.col||'#c85a2a'; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,6.29); ctx.fill();
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha=0.42; ctx.fillStyle=e.col||'#c85a2a';
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,6.29); ctx.fill();
      ctx.globalAlpha=0.7; ctx.strokeStyle='#ffd7a0'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r*(0.9+Math.sin(t*3+p.x)*0.06),0,6.29); ctx.stroke();
      // bubbling specks
      ctx.globalAlpha=0.6; ctx.fillStyle='#fff2d8';
      for(let q=0;q<3;q++){ const a=t*2+q*2+p.x; ctx.fillRect(p.x+Math.cos(a)*p.r*0.5-1,p.y+Math.sin(a*1.3)*p.r*0.4-1,2,2); }
      ctx.restore();
    }
  }
}

// -------------------------------------- CLONES (mirror puzzle) --------------------------------------
function _clonesStart(e){
  if(e.cloneOn) return;
  e.cloneOn=true; e.mechInv=true; e.hidden=true; e._decoys=[]; e.cloneTimer=8.5;
  const N=4, realIdx=(Math.random()*N)|0, R=TILE*3.6;
  for(let i=0;i<N;i++){ const a=(i/N)*6.283 + Math.PI/4 + (Math.random()*0.3-0.15);
    let sx=player.x+Math.cos(a)*R, sy=player.y+Math.sin(a)*R;
    if(typeof safeSpot==='function'){ const ss=safeSpot(curRoom,sx,sy); sx=ss.x; sy=ss.y; }
    const d={type:'B', decoy:true, realClone:(i===realIdx), bossRef:e, boss:true,
      ring:e.ring, wb:e.wb, awk:e.awk, r:e.r, col:e.col, name:e.name, lv:e.lv,
      bd:e.bd, pcol:e.pcol, pcore:e.pcore, pshape:e.pshape, psize:e.psize,
      x:sx, y:sy, hp:1, maxhp:1};
    e._decoys.push(d); enemies.push(d);
  }
  if(typeof msg==='function') msg('☠ '+((e.name||'THE BOSS').toUpperCase()), 'FIND THE TRUE ONE');
  if(typeof addShake==='function') addShake(9);
  navigator.vibrate&&navigator.vibrate([20,30,20]);
}
function _clonesTick(e, dt){
  if(!e.cloneOn) return;
  e.cloneTimer-=dt;
  const anyReal = (e._decoys||[]).some(d=>d.realClone && enemies.indexOf(d)>=0);
  if(e.cloneTimer<=0 || !anyReal){
    // timeout (or someone cleared the real via AoE without a clean hit): every remaining fake
    // detonates as a punish, then the true boss returns where its image stood.
    let realPos=null;
    for(const d of (e._decoys||[])){ if(enemies.indexOf(d)<0) continue;
      if(d.realClone) realPos={x:d.x,y:d.y}; else _decoyNova(d);
    }
    _clonesEnd(e, realPos, false);
  }
}
function _decoyNova(d){
  const n=12, spd=200;
  for(let i=0;i<n;i++) if(typeof eFire==='function') eFire(d,(i/n)*6.283,spd);
  if(typeof emitP==='function') for(let q=0;q<14;q++){ const a=Math.random()*6.283;
    emitP(d.x,d.y,{vx:Math.cos(a)*170,vy:Math.sin(a)*170,life:0.5,col:d.col||'#ff9c50',sz:3,glow:true}); }
  if(typeof addShake==='function') addShake(6);
}
function _clonesEnd(e, realPos, solved){
  for(const d of (e._decoys||[])){ const i=enemies.indexOf(d); if(i>=0) enemies.splice(i,1); }
  e._decoys=[]; e.cloneOn=false; e.mechInv=false; e.hidden=false;
  if(realPos){ e.x=realPos.x; e.y=realPos.y; }
  if(solved){ e.hp-=e.maxhp*0.12;               // reward for reading the tell
    if(typeof texts!=='undefined') texts.push({x:e.x,y:e.y-e.r,txt:'REVEALED!',col:'#ffd23d',life:1.1});
    if(typeof addShake==='function') addShake(10);
  }
  e.mechT=Math.max(e.mechT||0, 8);              // brief breather before the next event
}
// called from dealDamage when the player strikes a decoy — resolves the guess
function bossDecoyHit(d){
  const e=d.bossRef; if(!e){ const i=enemies.indexOf(d); if(i>=0) enemies.splice(i,1); return; }
  if(d.realClone){
    if(typeof texts!=='undefined') texts.push({x:d.x,y:d.y-d.r,txt:'THE TRUE ONE!',col:'#ffd23d',life:1.0});
    _clonesEnd(e, {x:d.x,y:d.y}, true);
  } else {
    _decoyNova(d);
    e.hp=Math.min(e.maxhp, e.hp + e.maxhp*0.04);   // a false idol — the boss mends a little
    if(typeof texts!=='undefined') texts.push({x:d.x,y:d.y-d.r,txt:'FALSE IDOL',col:'#ff5a4d',life:0.9});
    navigator.vibrate&&navigator.vibrate(40);
    const i=enemies.indexOf(d); if(i>=0) enemies.splice(i,1);
  }
}

// -------------------------------------- render hook --------------------------------------
// Draw mechanic overlays (safe patches, hazard pools) beneath the sprites. The decoy "tell"
// (fakes drawn dimmer/greyer than the true image) is applied in the enemy draw loop.
function drawBossMech(){
  if(typeof enemies==='undefined') return;
  for(const e of enemies){ if(!e || e.decoy) continue;
    const D=bossMechDef(e);
    if(D){ if(D.draw) D.draw(e); continue; }
    if(!e.mech) continue;
    if(e.mech==='bloom' && e.bloom) _bloomDraw(e);
    if(e.mech==='pools' && e.pools) _poolsDraw(e);
  }
}
