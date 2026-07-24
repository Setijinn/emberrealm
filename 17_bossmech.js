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

// ---- DYING WORDS: killing a boss frees it from the corruption-dream (which also ends it); it
// speaks a couple words of TRUTH as it goes. Shown as a slow, sombre centred quote (separate from
// the action banner). The final boss's line drops the whole reveal. (user, 2026-07-24) ----
let bossQuote=null;
function bossSayDeath(line){ if(!line) return; bossQuote={line:line, born:performance.now(), dur:6200}; }
function drawBossQuote(){
  if(!bossQuote) return;
  const el=performance.now()-bossQuote.born;
  if(el>bossQuote.dur){ bossQuote=null; return; }
  const a=Math.min(1, el/500)*Math.min(1,(bossQuote.dur-el)/900);   // fade in / out
  ctx.save(); ctx.globalAlpha=a; ctx.textAlign='center';
  ctx.font='italic 20px "Pixelify Sans",serif';
  const maxw=Math.min(W*0.82,760); const words=bossQuote.line.split(' '); let lines=[],cur='';
  for(const w of words){ const test=cur?cur+' '+w:w;
    if(ctx.measureText(test).width>maxw){ if(cur)lines.push(cur); cur=w; } else cur=test; }
  if(cur) lines.push(cur);
  const y0=H*0.70;
  for(let i=0;i<lines.length;i++){ const yy=y0+i*27;
    ctx.fillStyle='rgba(0,0,0,.72)'; ctx.fillText(lines[i],W/2+1,yy+1);
    ctx.fillStyle='#d6c2ec'; ctx.fillText(lines[i],W/2,yy); }
  ctx.restore(); ctx.textAlign='left';
}

function bossMechTick(e, dt){
  if(!e || !e.mech || e.decoy) return;
  if(e.mech==='pools'){ _poolsTick(e, dt); return; }
  if(e.mechT===undefined) e.mechT = 6 + Math.random()*3;
  if(e.mech==='bloom'){
    if(e.bloom) _bloomTick(e, dt);
    else { e.mechT-=dt; if(e.mechT<=0){ e.mechT=7.5+Math.random()*3.5; _bloomStart(e); } }
  } else if(e.mech==='clones'){
    if(e.cloneOn) _clonesTick(e, dt);
    else { e.mechT-=dt; if(e.mechT<=0){ e.mechT=11+Math.random()*4; _clonesStart(e); } }
  }
}
// forced event on a phase break — a dramatic beat that also introduces the mechanic early
function bossMechTrigger(e){
  if(!e || !e.mech || e.decoy) return;
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
  for(const e of enemies){ if(!e || !e.mech || e.decoy) continue;
    if(e.mech==='bloom' && e.bloom) _bloomDraw(e);
    if(e.mech==='pools' && e.pools) _poolsDraw(e);
  }
}
