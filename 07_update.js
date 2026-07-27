// ---------- update ----------
// Ambient decoration particles: braziers shed embers+smoke, town lamps warm motes,
// the fountain sprays droplets, portals leak colored magic, lair dens drift themed bits.
// Distance-culled; skipped entirely when the pool is near the cap so combat always wins.
function ambientParts(dt){
  if(typeof emitP!=='function' || particles.length>340 || !curRoom) return;
  const px=player.x, py=player.y, CULL=980;
  const near=(x,y)=>Math.abs(x-px)<CULL && Math.abs(y-py)<CULL;
  if(curRoom.glows) for(const gl of curRoom.glows){ if(!near(gl.x,gl.y)) continue;
    if(gl.t==='H'){
      if(Math.random()<4.5*dt) emitP(gl.x+(Math.random()*14-7),gl.y-6,
        {vx:Math.random()*16-8,vy:-30-Math.random()*45,life:0.7+Math.random()*0.5,
         col:Math.random()<0.6?'#ffb347':'#ffe08a',sz:2,drag:0.4,glow:true});
      if(Math.random()<0.7*dt) emitP(gl.x,gl.y-10,
        {vx:Math.random()*10-5,vy:-18-Math.random()*14,life:1.4,col:'rgba(110,100,95,0.45)',sz:5,drag:0.8});
    } else if(gl.t==='l' && curRoom.town){
      if(Math.random()<1.6*dt) emitP(gl.x+(Math.random()*10-5),gl.y-26,
        {vx:Math.random()*8-4,vy:-8-Math.random()*10,life:1.2,col:'#ffe9b0',sz:2,glow:true});
    } }
  if(curRoom.decor) for(const d of curRoom.decor){ if(d.t!=='fountain') continue;
    const fx0=d.x*TILE, fy0=d.y*TILE; if(!near(fx0,fy0)) continue;
    if(Math.random()<14*dt){ const a=Math.random()*6.28;
      emitP(fx0+(Math.random()*8-4), fy0-40,
        {vx:Math.cos(a)*(16+Math.random()*22),vy:-70-Math.random()*60,life:0.8,
         col:Math.random()<0.5?'#bfe6f5':'#8fd0ea',sz:2,g:300,glow:true}); } }
  if(curRoom.portals) for(const pt of curRoom.portals){ if(!near(pt.x,pt.y)) continue;
    if(Math.random()<3*dt) emitP(pt.x+(Math.random()*30-15),pt.y+(Math.random()*8-16),
      {vx:Math.random()*10-5,vy:-16-Math.random()*24,life:0.9+Math.random()*0.6,
       col:pt.col||'#c07ad4',sz:2,glow:true}); }
  if(curRoom.dungeon){ const GB=GBOSS[curRoom.ring||0];   // drifting dream motes in the mind
    if(Math.random()<6*dt) emitP(player.x+(Math.random()*760-380), player.y+(Math.random()*460-230),
      {vx:Math.random()*8-4,vy:-10-Math.random()*12,life:1.6,col:GB?GB.col:'#8fb0d0',sz:2,glow:true}); }
  if(curRoom.lairs) for(const b in curRoom.lairs){ const L=curRoom.lairs[b];
    if(!L.sprite || !near(L.sprite.x,L.sprite.y)) continue;
    if(Math.random()<2.2*dt){ const fiery=(+b)>=5;
      emitP(L.sprite.x+(Math.random()*60-30), L.sprite.y+(Math.random()*20-30),
        {vx:Math.random()*10-5, vy:fiery?(-22-Math.random()*30):(-8-Math.random()*10),
         life:1.1, col:fiery?'#ff9a4d':((+b)<3?'#9fd08a':'#c9c2b8'), sz:2, glow:fiery}); } }
}
// Is anyone standing in this arena? Co-op peers count, or a boss would drop aggro the moment the
// host stepped out while a teammate was still fighting it.
// Put a disengaged boss back exactly as it was found: full health, phase 0, no statuses, no
// lingering mechanic state, and none of the adds or images it spawned. A partial reset would let
// you chip a boss down over several trips, which is precisely what the arena lock is meant to stop.
function bossReset(e){
  e.hp=e.maxhp;
  e.phase=0; e.phaseInv=0; e.dlgInv=0; e.phaseFlash=0; e.mechInv=0;
  e.st={}; e.slowT=0; e.stunT=0; e.flash=0;
  e.hidden=false; e.chargeT=0; e.cdur=0; e.sumT=3; e.fireT=1.4; e.ang=0;
  // These three were named e.clones / e.said / e.chatAt, which are not fields anything ever sets --
  // so the mirror puzzle and the dialogue cursor BOTH survived a reset. A boss you walked away from
  // came back mid-clone-phase and refused to say its opening line again.
  e.bloom=0; e.pools=null;
  e.cloneOn=0; e.cloneTimer=0; e._decoys=null;
  e.saidOpen=false; e.chat=0;
  // registry-fight state: the anchor, any self-raised ward, and whatever the fight parked on `mk`
  e.anchored=0; e.anchorInv=0; e.wardInv=0; e.mk=null; e.mechT=undefined;
  e.anim=null; e.animT=0;
  if(e.mp!==undefined) e.mp=e.maxmp;
  // clear anything this boss put on the field
  for(let i=enemies.length-1;i>=0;i--){ const o=enemies[i];
    if(o!==e && (o.decoy||o.summoned) && (o.owner===e||o.ring===e.ring)) enemies.splice(i,1); }
  if(typeof eShots!=='undefined'&&eShots) eShots.length=0;
  if(e.arena){ e.x=(e.arena.x0+e.arena.x1)/2; e.y=(e.arena.y0+e.arena.y1)/2; }
}
function bossArenaHasPlayer(A){
  if(player.x>A.x0&&player.x<A.x1&&player.y>A.y0&&player.y<A.y1) return true;
  // peers live on coop.peers (there is no global `coopPeers`), and each entry carries the room it
  // is in plus a timestamp -- a stale or different-room peer must not hold the arena open
  const ps=(typeof coop!=='undefined'&&coop&&coop.on)?coop.peers:null;
  if(ps){ const now=performance.now(), rk=(curRoom&&curRoom.key)||'?';
    for(const k in ps){ const p=ps[k];
      if(!p||p.rm!==rk||now-p.ts>2500) continue;
      if(p.x>A.x0&&p.x<A.x1&&p.y>A.y0&&p.y<A.y1) return true; } }
  return false;
}
// ---- Awakened-dungeon objective engine ----
// Checks each locked chamber's objective; completing one melts its gate open.
function _dunSparkle(x,y,col){ if(typeof emitP!=='function') return;
  for(let q=0;q<8;q++){ const a=Math.random()*6.283;
    emitP(x,y,{vx:Math.cos(a)*80,vy:Math.sin(a)*80-20,life:0.5,col:col||'#bfe6f5',sz:3,glow:true}); } }
function _dunPhantoms(x,y,ch,n){ for(let q=0;q<(n||2);q++){ const a=Math.random()*6.283;
  const ss=safeSpot(curRoom,x+Math.cos(a)*90,y+Math.sin(a)*90);
  enemies.push(makeEnemy({t:'c',x:Math.floor(ss.x/TILE),y:Math.floor(ss.y/TILE),ch:ch})); } }
function _chAlive(ch){ let n=0;
  for(const e of enemies) if(e.ch===ch&&e.type!=='B'&&e.type!=='N'&&!e.summoned) n++; return n; }
// seal "glow phase" for the Titan Locks timing puzzle (shared with render + interact)
function dunSealLit(idx){ return ((performance.now()/3000+idx*0.33)%1)<0.45; }
function dunObjectives(dt){ const R=curRoom; if(!R||!R.dungeon||!R.objs) return;
  for(const o of R.objs){ if(o.done) continue;
    if(o.type==='waves'){
      // only counts once the player is inside that chamber (no pre-clearing from the door)
      const px=player.x/TILE, py=player.y/TILE, b=o.bounds;
      if(!b || px<b.x0||px>b.x1||py<b.y0||py>b.y1) continue;
      if(_chAlive(o.ch)===0) dunOpenGate(o);
      continue; }
    const m=o.mode;
    if(m==='regrow'||m==='ambush'){
      let aliveN=0; for(const e of enemies) if(e.type==='N'&&e.ch===o.ch) aliveN++;
      o.got=o.need-aliveN;
      if(m==='regrow'){
        if(o.got>0&&o.got<o.need){ o.rgT+=dt;
          if(o.rgT>9){ o.rgT=0;
            for(const s of o.spots){ let has=false;
              for(const e of enemies) if(e.type==='N'&&e.ch===o.ch&&Math.abs(e.x-s.x)<22&&Math.abs(e.y-s.y)<22){has=true;break;}
              if(!has){ enemies.push(makeEnemy({t:'N',x:s.tx,y:s.ty,ch:o.ch})); _dunSparkle(s.x,s.y,'#9fd08a'); } }
            msg('THE GROVE REKNITS','sever all three quickly'); continue; } }
        else o.rgT=0; }
      if(o.got>=o.need){
        if(m==='ambush'&&_chAlive(o.ch)>0) continue;   // idols down — now survive it
        dunOpenGate(o); }
      continue; }
    if(m==='chase'){ const cz=R.chases.find(z=>z.ch===o.ch); if(!cz) continue;
      const d=Math.hypot(player.x-cz.x,player.y-cz.y);
      cz.wt+=dt;
      if(d<300){ const a=Math.atan2(cz.y-player.y,cz.x-player.x)+Math.sin(cz.wt*3)*0.6;
        const nx=cz.x+Math.cos(a)*150*dt, ny=cz.y+Math.sin(a)*150*dt, b=o.bounds;
        const cx2=Math.max((b.x0+1)*TILE,Math.min((b.x1)*TILE,nx));
        const cy2=Math.max((b.y0+1)*TILE,Math.min((b.y1)*TILE,ny));
        if(!solid(cx2,cy2)){ cz.x=cx2; cz.y=cy2; } }
      if(typeof emitP==='function'&&Math.random()<10*dt)
        emitP(cz.x,cz.y,{vx:0,vy:0,life:0.5,col:'#bfe6f5',sz:3,glow:true});
      if(d<32){ o.got++;
        texts.push({x:cz.x,y:cz.y-16,txt:o.got+'/'+o.need,col:'#ffe08a',life:1});
        _dunSparkle(cz.x,cz.y);
        let far=o.spots[0],fd=-1;
        for(const s of o.spots){ const dd=Math.hypot(s.x-player.x,s.y-player.y); if(dd>fd){fd=dd;far=s;} }
        cz.x=far.x; cz.y=far.y; }
      if(o.got>=o.need){ R.chases=R.chases.filter(z=>z!==cz); dunOpenGate(o); }
      continue; }
    if(m==='simon'){ o.demoT+=dt;
      for(const pl of R.plates){ if(pl.ch!==o.ch||pl.on) continue;
        if(Math.hypot(pl.x-player.x,pl.y-player.y)<28){
          if(pl.idx===o.got){ pl.on=true; o.got++;
            texts.push({x:pl.x,y:pl.y-16,txt:o.got+'/'+o.need,col:'#ffe08a',life:1}); _dunSparkle(pl.x,pl.y,'#ffd07a'); }
          else { for(const p2 of R.plates) if(p2.ch===o.ch) p2.on=false; o.got=0;
            msg('THE PLATES RESET','watch the sequence'); _dunPhantoms(player.x,player.y,o.ch,2); } } }
      if(o.got>=o.need) dunOpenGate(o); continue; }
    if(m==='candles'){
      for(const pl of R.plates){ if(pl.ch!==o.ch||pl.on) continue;
        if(Math.hypot(pl.x-player.x,pl.y-player.y)<28){ pl.on=true; _dunSparkle(pl.x,pl.y,'#ffe08a'); } }
      let lit=0; for(const pl of R.plates) if(pl.ch===o.ch&&pl.on) lit++;
      o.got=lit;
      if(lit>=o.need){ dunOpenGate(o); continue; }
      if(lit>0){ o.snuffT+=dt;
        if(o.snuffT>3.5){ o.snuffT=0;
          const cand=R.plates.filter(pl=>pl.ch===o.ch&&pl.on);
          const pick=cand[Math.floor(Math.random()*cand.length)];
          if(pick){ pick.on=false;
            texts.push({x:pick.x,y:pick.y-16,txt:'snuffed',col:'#8a8290',life:0.9}); } } }
      continue; }
    if(m==='hold'){
      for(const cc of R.circles){ if(cc.ch!==o.ch||cc.lit) continue;
        const d=Math.hypot(cc.x-player.x,cc.y-player.y);
        if(d<44){ cc.prog+=dt;
          if(cc.prog>=3){ cc.lit=true; _dunSparkle(cc.x,cc.y,'#bfe6f5');
            _dunPhantoms(cc.x,cc.y,o.ch,1); } }   // the wind answers
        else cc.prog=Math.max(0,cc.prog-dt*0.7); }
      let lit=0; for(const cc of R.circles) if(cc.ch===o.ch&&cc.lit) lit++;
      o.got=lit; if(lit>=o.need) dunOpenGate(o); continue; }
    // order / relay / timing complete through the INTERACT seals
    if(m==='relay'&&o.got>0){ o.timer-=dt;
      if(o.timer<=0){ for(const sw of R.switches) if(sw.ch===o.ch) sw.on=false;
        o.got=0; msg('THE FLAME DIES','relight the relay from the first brazier'); } }
    if(o.got>=o.need) dunOpenGate(o);
  } }
function dunOpenGate(o){ const R=curRoom; o.done=true;
  for(const c of (o.gateCells||[])){ R.grid[c.y][c.x]='p';   // path continues through
    if(typeof emitP==='function') for(let q=0;q<3;q++)
      emitP((c.x+.5)*TILE,(c.y+.5)*TILE,{vx:Math.random()*70-35,vy:Math.random()*70-35,
        life:0.6,col:'#ffe08a',sz:3,glow:true}); }
  msg('THE WAY OPENS', o.label+' — done'); }
// Fire ONE volley of a boss shot pattern; returns that pattern's cooldown.
// Kept separate so patterns can be layered (combined) on independent timers.
function bossVolley(e,pat,base,spd,enraged){
  if(pat==='aimed3'){ for(let i=-1;i<=1;i++) eFire(e,base+i*0.20,spd); return enraged?0.6:0.95; }
  if(pat==='spread5'){ for(let i=-2;i<=2;i++) eFire(e,base+i*0.16,spd*1.1); return enraged?0.5:0.8; }
  if(pat==='nova'){ const n=enraged?16:12; for(let i=0;i<n;i++) eFire(e,(i/n)*6.283,spd*0.8); return enraged?1.0:1.5; }
  if(pat==='spiral'){ eFire(e,e.ang,spd*0.9); eFire(e,e.ang+Math.PI,spd*0.9); return enraged?0.12:0.18; }
  if(pat==='ring8'){ for(let i=0;i<8;i++) eFire(e,e.ang+i*Math.PI/4,spd*0.85);
    if(enraged) eFire(e,base,spd*1.6); return enraged?0.55:0.9; }
  if(pat==='summon'){ e.sumT-=1;
    if(e.sumT<=0){ e.sumT=3;
      const alive=enemies.filter(function(m){return m.summoned;}).length;
      if(alive<6){ for(let q=0;q<3;q++){ const a=Math.random()*6.283;
        const mlv=e.lv||10, mh=40*eHpScale(mlv);   // minions ride the unified curve too
        const ss=safeSpot(curRoom,e.x+Math.cos(a)*40,e.y+Math.sin(a)*40);   // never in a wall
        enemies.push({type:'c',summoned:true,x:ss.x,y:ss.y,
         r:15,hp:Math.round(mh),maxhp:Math.round(mh),spd:120,touch:6+eDmgScale(mlv)*0.38,col:e.col,lv:e.lv}); } } }
    for(let i=-1;i<=1;i++) eFire(e,base+i*0.25,spd); return 2.2; }
  for(let i=0;i<8;i++) eFire(e,e.ang+i*Math.PI/4,spd*0.8); return 0.9;
}
// ---- BOSS PHASES (user, 2026-07-24): crossing an HP threshold triggers a dramatic beat —
// a brief invulnerability, a telegraphed shockwave you must dodge, a screen shake + burst, a
// banner, and (from phase 2) summoned adds. Each phase then fires faster and layers harder, so
// the fight escalates instead of being one static pattern. Called once per threshold crossed.
function bossEnterPhase(e, ph){
  e.phaseInv=Math.max(e.phaseInv||0, 0.9);   // immune during the transition so it reads as a beat
  e.phaseFlash=0.7;
  const spd=(170+(e.lv||10)*0.7)*(1+ph*0.12);
  // telegraphed double shockwave — two offset rings expanding outward
  const n=14+ph*4;
  for(let i=0;i<n;i++) eFire(e,(i/n)*6.283, spd*0.7);
  for(let i=0;i<n;i++) eFire(e,(i/n)*6.283 + Math.PI/n, spd*1.05);
  // particle burst + screen shake + banner
  if(typeof emitP==='function') for(let q=0;q<28;q++){ const a=Math.random()*6.283, sp2=130+Math.random()*230;
    emitP(e.x,e.y,{vx:Math.cos(a)*sp2,vy:Math.sin(a)*sp2,life:0.55+Math.random()*0.45,
      col:e.col||'#ff9c50',sz:3+Math.random()*3,g:60,glow:true}); }
  if(typeof addShake==='function') addShake(11+ph*4);
  // STORY: the boss speaks a line from its backstory as it escalates (its role in the rift)
  const gb=(typeof GBOSS!=='undefined'&&e.ring!=null&&e.ring>=0)?GBOSS[e.ring]:null;
  // A fight may name its own stages; the generic ladder is the fallback and now stretches far
  // enough for a four-break boss instead of running off the end of a three-entry array.
  const _D=(typeof bossMechDef==='function')?bossMechDef(e):null;
  const titles=(_D&&_D.titles)||['','ENRAGED','FINAL STAND','NOTHING HELD BACK'];
  const line=(gb&&gb.bark&&gb.bark[ph-1])?gb.bark[ph-1]:'';
  // Banner keeps the loud stage title; the SPOKEN line goes in the plaque above the boss's head,
  // so every word a boss says appears in the same place instead of split across two UIs.
  // This also FIXES a silent bug: the bark used to go in the banner, and bossMechTrigger below
  // fires its own msg() a line later ("REACH THE SAFE GROUND"), so every canon boss — they all
  // have a mech — overwrote its own phase dialogue almost immediately. Nobody ever read it.
  if(typeof msg==='function') msg('☠ '+((e.name||'THE BOSS').toUpperCase())+' — PHASE '+(ph+1), titles[ph]||'');
  if(typeof bossAnim==='function'){ bossAnim(e,'phase',1.1); bossAnimFx(e,'phase'); }
  // the spoken beat is a protected moment: it cannot be melted mid-sentence (user)
  if(line && typeof bossSayNow==='function'){ bossSayNow(line,5800,e); e.dlgInv=Math.max(e.dlgInv||0,2.2); }
  navigator.vibrate&&navigator.vibrate([30,40,30]);
  // signature mechanic fires on the phase break (thornrot bloom / mirror idols / hazard burst)
  if(typeof bossMechTrigger==='function') bossMechTrigger(e);
  // summon adds from phase 2 onward to change the fight's shape
  if(ph>=1 && typeof enemies!=='undefined'){
    if(typeof bossAnim==='function') bossAnim(e,'summon');
    const mlv=e.lv||10, edr=(typeof eDR==='function')?eDR(eDef(mlv)):0, mh=40*eHpScale(mlv)*(1-edr);
    const alive=enemies.filter(m=>m.summoned).length, nAdd=ph+1;
    for(let q=0; q<nAdd && alive+q<8; q++){ const a=Math.random()*6.283;
      const ss=(typeof safeSpot==='function')?safeSpot(curRoom,e.x+Math.cos(a)*62,e.y+Math.sin(a)*62):{x:e.x,y:e.y};
      enemies.push({type:'c',summoned:true,x:ss.x,y:ss.y,r:15,hp:Math.round(mh),maxhp:Math.round(mh),
        spd:120,touch:6+eDmgScale(mlv)*0.38,col:e.col,lv:mlv,
        def:eDef(mlv),dr:edr,dex:eDex(mlv),maxmp:eMp(mlv),mp:eMp(mlv)}); } }
}
// ---- ascension capstone helpers ----
// heals that respect Bishop/Soulflayer (overflow -> shield) and Bloodlord (overheal nova)
let _inBloodNova=false;
function healPlayer(amt){ if(!amt||amt<=0) return;
  const over=Math.max(0,(player.hp+amt)-player.maxhp);
  player.hp=Math.min(player.maxhp,player.hp+amt);
  if(over>0.5){
    // overshield caps what THIS overheal contributes (20% max HP) — it must not clamp a
    // shield you already have, or a Guardian's 90% ultimate ward was being cut to 20%
    if(player.overshield) player.shield=Math.min(player.maxhp,(player.shield||0)+Math.min(player.maxhp*0.20,over));
    // Bloodlord: overheal detonates. Two guards — the nova's OWN damage lifesteals back into
    // healPlayer, which at full HP is pure overheal, which would detonate again, larger each
    // time (a runaway worth ~400s of DPS in testing). Re-entrancy is blocked and the blast
    // is capped, so it stays a burst rather than a feedback loop.
    if(player.bloodNova&&over>4&&(player._bnCd||0)<=0&&!_inBloodNova){ player._bnCd=1.5;
      _inBloodNova=true;
      try{ aoe(player.x,player.y,90,Math.round(Math.min(over*2,player.maxhp*0.45)),'#c0392b'); }
      finally{ _inBloodNova=false; } } } }
// damage to the player through Juggernaut (less while moving), shields, Nightblade (vanish)
function damagePlayer(raw){ let hit=raw*playerDmgTaken();   // cursed players take more, same as foes
  if(player.moveDr&&player._moving) hit*=(1-player.moveDr);
  if(typeof dynDr==='function') hit*=(1-dynDr());          // conditional perks (below X% HP, ...)
  hit=Math.max(1,Math.round(hit));
  if((player.shield||0)>0){ const ab=Math.min(player.shield,hit); player.shield-=ab; hit-=ab; }
  if(hit>0) player.hp-=hit;
  if(player.vanishHurt) player.inv=Math.max(player.inv,1.1);
  if(typeof perkFire==='function') perkFire('hurt',{dmg:hit,x:player.x,y:player.y});
  return hit; }
// ---- enemy behaviour AI (see EBEH / pickBehaviour in 03_entities) ----
// Returns where the enemy WANTS to move this frame: {tx,ty target point, smul speed×, move}.
// The type-specific code (chase / kite / fire) in update() consumes it. One behaviour per
// enemy, so only one branch ever applies.
function enemyAI(e,dx,dy,dd,dt){
  // the species' signature (MOBSPEC in 03_entities) overrides the behaviour's defaults, so a Reed
  // Lurcher ambushing and a Cliff Skua ambushing are the same RULE with different bodies.
  // Merged once and cached: this runs for every enemy every frame.
  let B=(typeof EBEH!=='undefined'&&EBEH[e.beh])||{};
  if(e.sig){ if(!e._mb || e._mbk!==e.beh){ e._mb=Object.assign({},B,e.sig); e._mbk=e.beh; } B=e._mb; }
  let tx=player.x, ty=player.y, smul=1;
  // per-enemy gait clock and phase. Lazily seeded from the spawn position so it survives enemies
  // built by paths that never touch makeEnemy (summons, decoys) and so two neighbours never sway
  // in lockstep — a row of identically-swaying hounds reads as one animation, not three animals.
  if(e.wp===undefined){ const h=(Math.imul(e.x|0,374761393)^Math.imul(e.y|0,668265263))>>>0;
    e.wp=(h%628)/100; e.wfj=0.85+((h>>>9)%40)/100; e.aiT=0; e.lungeCd=(h>>>17)%100/100; }
  e.aiT=(e.aiT||0)+dt;
  if(e.lungeCd>0) e.lungeCd-=dt;
  if(e.lungeT>0) e.lungeT-=dt;
  // AMBUSHER: dormant (inert) until you step into range, then a short fast lunge
  if(e.beh==='ambusher'){
    if(e.dormant){
      if(dd<B.wake){ e.dormant=false; e.burstT=B.burstT; e.flash=0.25;
        if(typeof boom==='function') boom(e.x,e.y,e.col,10); }
      else return {tx:e.x,ty:e.y,smul:0,move:false};
    }
    if(e.burstT>0){ e.burstT-=dt; e.pounced=true; smul=B.burst||1; }
    // the pounce is spent: break off, circle wide, and go back to lying in wait rather than
    // degenerating into an ordinary chaser for the rest of its life.
    // Gated on having actually pounced — otherwise one built outside makeEnemy (no dormant flag,
    // no burstT) peels away on its very first frame without ever having attacked.
    else if(B.breakoff && e.pounced){
      e.breakT=(e.breakT===undefined)?B.breakoff:e.breakT-dt;
      if(e.breakT>0){ tx=e.x-dx; ty=e.y-dy; smul=1.15;      // retreat straight back
        return {tx,ty,smul,move:true,hold:true}; }
      if(dd>(B.rehide||330)){ e.dormant=true; e.breakT=undefined; e.burstT=0;
        return {tx:e.x,ty:e.y,smul:0,move:false}; }
      if(e.breakT<-2.2){ e.breakT=B.breakoff; }             // still cornered: peel off again
    }
  }
  // SENTINEL: guards home. Once you leave its territory it disengages and PACES its post — a
  // guard walks a beat back and forth, it does not orbit its own feet like a wind-up toy.
  if(e.beh==='sentinel'){
    const hd=Math.hypot(player.x-e.home.x,player.y-e.home.y);
    if(hd>(B.leash||360)){
      if(Math.hypot(e.x-e.home.x,e.y-e.home.y)<52){
        const beat=Math.sin(e.aiT*0.55+e.wp)*(B.pace||70);
        tx=e.home.x+Math.cos(e.roamA)*beat; ty=e.home.y+Math.sin(e.roamA)*beat; smul=0.45; }
      else { tx=e.home.x; ty=e.home.y; smul=0.85; }
      return {tx,ty,smul,move:true,hold:true};   // hold = pursuing its OWN goal, not the player
    }
  }
  // ROAMER: wanders the ground when you're far off, hunts when you close in. The drift is a slow
  // random WALK on the heading rather than a fresh direction each frame, so it ambles somewhere
  // instead of vibrating in place, and it pauses to cast about every few seconds.
  if(e.beh==='roamer' && dd>(B.engage||540)){
    e.roamA+=(Math.random()-0.5)*dt*1.4;
    const sniff=Math.sin(e.aiT*0.42+e.wp);
    tx=e.x+Math.cos(e.roamA)*120; ty=e.y+Math.sin(e.roamA)*120;
    smul=(B.wander||0.42)*(sniff>0.72?0.12:1);      // head-up pause, roughly one beat in five
    return {tx,ty,smul,move:true,hold:true};
  }
  // PACK: hounds do not pile onto one point — they SURROUND. Each takes a slot on a ring around
  // you, spaced by its position among the local pack, and holds it until the ring is close enough
  // to close; then the whole pack collapses in at once. The old centroid blend pulled them all to
  // the same spot, which stacked their bodies and let you fight a five-hound pack one hound wide.
  if(e.beh==='pack'){
    const mates=[];
    for(const o of enemies){ if(o.beh==='pack' && o.hp>0){
      if(o===e || Math.hypot(o.x-e.x,o.y-e.y)<(B.cohesion||150)) mates.push(o); } }
    const n=mates.length;
    if(n>1){
      mates.sort((a,b)=>(a._px||a.x)-(b._px||b.x)||a.y-b.y);   // stable order -> stable slots
      const idx=Math.max(0,mates.indexOf(e));
      smul=1+(B.packBuff||0.16)*Math.min(3,n-1);
      if(dd>(B.collapse||190)){
        // hold a slot on the ring, offset from the bearing you are approaching from
        const base=Math.atan2(e.y-player.y,e.x-player.x);
        const slot=base+((idx/n)-0.5)*2.2 + Math.sin(e.aiT*0.5+e.wp)*0.18;
        const R=B.flank||150;
        tx=player.x+Math.cos(slot)*R; ty=player.y+Math.sin(slot)*R;
      }
    }
  }
  // ---- movement signature: the shape of the approach, laid over the target point above ----
  // A lunge is a straight committed dash from a set distance, on a cooldown: the one gait a
  // four-legged pack predator must have, and the reason a hound reads as an animal rather than a
  // homing missile. Corruption makes them rangier and more willing to commit.
  const cor=e.corrupt?1.35:1;
  let harrying=false;
  if(B.lunge && e.type==='c' && !e.dormant){
    const L=B.lunge;
    if(e.lungeT>0){ // mid-dash: dead straight at where you were when it committed, full speed
      return {tx:e.lx,ty:e.ly,smul:L.mul,move:true,lunging:true};
    }
    // inside the lunge band with the dash on cooldown: HARRY. Orbit at bite range and wait for
    // the opening instead of pressing in and standing on the player as a contact-damage aura.
    // The LUNGE is tested before the harry, and its lower bound is a body-space check rather than
    // L.min. Ordered the other way (harry first, lunge only when dd>L.min) every harrying creature
    // deadlocked: its orbit radius sits INSIDE its own lunge band, so after the first dash it could
    // never satisfy dd>L.min again and circled at bite range forever without ever attacking.
    // Now it orbits only while the dash is cooling and commits the moment it is ready.
    if(e.lungeCd<=0 && dd>28 && dd<L.max*cor){
      e.lungeT=L.dur; e.lungeCd=L.dur+(L.cd/cor)*(0.8+Math.random()*0.4);
      // aim the dash PAST the player so it carries through rather than stopping on contact
      e.lx=player.x+(dx/dd)*70; e.ly=player.y+(dy/dd)*70;
      e.animAtk=Math.max(e.animAtk||0,0.45);
      // kick up dirt where it pushes off: a 2.5x dash with no tell is a cheap hit, and this is
      // the frame the player needs to read to sidestep it
      if(typeof emitP==='function') for(let i=0;i<5;i++){ const a=Math.atan2(-dy,-dx)+(Math.random()-0.5)*1.2;
        emitP(e.x,e.y+6,{vx:Math.cos(a)*90,vy:Math.sin(a)*90-20,life:0.4,col:'#9a8a74',sz:2.5}); }
      return {tx:e.lx,ty:e.ly,smul:L.mul,move:true,lunging:true};
    }
    // dash still cooling and we are already at bite range: HARRY. Circle and wait for the opening
    // instead of pressing in and standing on the player as a contact-damage aura.
    // 0.5 rad of lead, not more: steering at a point far around the circle cuts the chord and
    // spirals the orbit inward, which lands it back on top of the player anyway. Falls THROUGH to
    // separation below — five hounds orbiting the same circle in lockstep read as one hound.
    if(B.harry && dd<L.min){
      // A dash aims 70px PAST you, so it ends the lunge standing on top of you — where atan2 of a
      // 1px offset is meaningless and the orbit target jitters randomly, pinning it there forever
      // (it can neither harry out nor re-enter its own lunge band). Below ~14px, drive the angle
      // off the gait clock instead: a stable bearing it can actually walk out on.
      const a=((dd>14)?Math.atan2(e.y-player.y,e.x-player.x):(e.wp+e.aiT*1.6))
              +(e.wp>3.14?1:-1)*0.5;
      tx=player.x+Math.cos(a)*B.harry; ty=player.y+Math.sin(a)*B.harry; smul=1.15;
      harrying=true;
    }
  }
  // Separation. Nothing in this game gives enemies a body that other enemies collide with, so a
  // pack closing on one point ends up standing in the same 7px and reads as one animal. Push off
  // near neighbours: this is what turns a surrounding ring into five distinct hounds, and it keeps
  // the harry orbits from collapsing into a single lockstep circle.
  if(e.type==='c'||e.type==='s'){
    let sx=0, sy=0, sn=0;
    const SR=(e.r||15)+24;
    for(const o of enemies){ if(o===e||o.hp<=0||(o.type!=='c'&&o.type!=='s')) continue;
      const ox=e.x-o.x, oy=e.y-o.y, od=Math.hypot(ox,oy);
      if(od<SR && od>0.01){ const w=(SR-od)/SR; sx+=ox/od*w; sy+=oy/od*w; if(++sn>7) break; } }
    // The push is scaled by the distance still to run, with a FLOOR: a creature already standing
    // on its target has ~0 left to run, so a purely proportional nudge vanishes exactly where the
    // stacking happens — which is how two of them ended up 1px apart on the player.
    if(sn){ const al=Math.hypot(tx-e.x,ty-e.y);
      const push=Math.max(46,al*0.55);
      tx+=sx*push; ty+=sy*push; }
  }
  // Sway: swing the HEADING off the straight line, decaying to nothing inside `commit`, so the
  // creature loafs and jinks at range and goes straight for the throat up close.
  if(B.sway && !harrying){
    const near=Math.max(0,Math.min(1,(dd-(B.commit||0))/220));
    const amp=B.sway*cor*near;
    if(amp>0.01){
      const ax=tx-e.x, ay=ty-e.y, al=Math.hypot(ax,ay)||1;
      const a=Math.atan2(ay,ax)+Math.sin(e.aiT*(B.swayF||2)*e.wfj+e.wp)*amp;
      tx=e.x+Math.cos(a)*al; ty=e.y+Math.sin(a)*al;
    }
  }
  return {tx,ty,smul,move:true};
}
let _pmove=false;   // true only while the PLAYER is being moved (Pathwarden terrain ghost)
function update(dt){
  // move: touch stick when held, else keyboard (WASD/arrows) at full speed
  const m=stick.move;
  if(typeof tickPotions==='function') tickPotions(dt);   // potions trickle back; gold is gone
  tickPlayerStatuses(dt);                       // burn/poison/bleed/shock tick, chill/weak/curse apply
  const frozen=!playerCanAct();                 // freeze and stun cost you the frame entirely
  const sp=player.spd*(typeof dev!=='undefined'?dev.spd:1)*(player.bSpdT>0?(player.bSpdM||1):1)
    *((typeof dynSpd==='function')?dynSpd():1)*playerSpdMul()*(frozen?0:1);
  player._moving=false; _pmove=true;
  if(m.id!==null){
    const d=Math.hypot(m.dx,m.dy)||1;
    moveCircle(player,(m.dx/d)*sp*dt*Math.min(1,d/28),(m.dy/d)*sp*dt*Math.min(1,d/28));
    player._moving=true;
  } else if(typeof keyMove==='function'){
    const kv=keyMove();
    if(kv){ moveCircle(player, kv.x*sp*dt, kv.y*sp*dt); player._moving=true; }
  }
  _pmove=false;
  // camera rotation (PC only): hold Z/C to spin the view, X snaps back to north
  if(typeof camRot!=='undefined'){
    if(typeof inputMode!=='undefined' && inputMode==='pc' && typeof keys!=='undefined'){
      const RSPD=2.1;
      if(keys['z']) camRotT-=RSPD*dt;
      if(keys['c']) camRotT+=RSPD*dt;
      if(keys['x']) camRotT=0;
    } else camRotT=0;                                    // touch mode: always north-up
    camRot+=(camRotT-camRot)*Math.min(1,dt*10);          // smooth follow
    if(Math.abs(camRot-camRotT)<0.0008 && camRotT===0) camRot=0;
  }
  player.inv=Math.max(0,player.inv-dt);
  // perk conditionals: rebuilt AFTER movement (so `moving`/`still` are current) and BEFORE
  // fire(), so this frame's shot already sees the bonus.
  if(typeof perkDyn==='function') perkDyn(dt);
  if(typeof updateAbilCooldowns==='function') updateAbilCooldowns(dt);      // ability cooldowns
  if(player.atkT>0) player.atkT-=dt;                                       // attack animation timer
  if(player.hp<player.maxhp) player.hp+=(player.regen||1)*dt;               // VIT -> regen
  if(player.mp<player.maxmp) player.mp=Math.min(player.maxmp,player.mp+(player.mpregen||2)*dt); // WIS -> mana
  // ascension auras + shield upkeep
  if(player._bnCd>0) player._bnCd-=dt;
  if(player.thornT>0){ player.thornT-=dt;                                  // ult reflect window
    if(typeof emitP==='function'&&Math.random()<5*dt){ const a=Math.random()*6.283;
      emitP(player.x+Math.cos(a)*22,player.y+Math.sin(a)*18,
        {vx:Math.cos(a)*40,vy:Math.sin(a)*40,life:0.5,col:'#c9d2da',sz:2.5,glow:true}); } }
  if((player.shield||0)>0) player.shield=Math.max(0,player.shield-player.maxhp*0.02*dt);
  if(player.auraHeal){ player.hp=Math.min(player.maxhp,player.hp+player.auraHeal*dt);
    if(typeof emitP==='function'&&Math.random()<3*dt)
      emitP(player.x+(Math.random()*40-20),player.y+(Math.random()*30-20),
        {vx:0,vy:-16,life:0.8,col:'#ffe9b0',sz:2,glow:true}); }
  if(player.slowAura){ for(const e of enemies){ if(Math.hypot(e.x-player.x,e.y-player.y)<150) e.slowT=Math.max(e.slowT||0,0.4); }
    if(typeof emitP==='function'&&Math.random()<4*dt)
      emitP(player.x+(Math.random()*60-30),player.y+(Math.random()*40-20),
        {vx:0,vy:-10,life:0.9,col:'#9ad4ef',sz:2,glow:true}); }

  // room transitions (walk off edge through a door)
  const gx=player.x/TILE, gy=player.y/TILE;
  if(gx>curRoom.w){ const k=(curRoom.rx+1)+','+curRoom.ry; if(rooms[k]) enterRoom(k, TILE*0.9, player.y); }
  else if(gx<0){ const k=(curRoom.rx-1)+','+curRoom.ry; if(rooms[k]){ const t=rooms[k]; enterRoom(k, (t.w-0.9)*TILE, player.y); } }
  else if(gy>curRoom.h){ const k=curRoom.rx+','+(curRoom.ry+1); if(rooms[k]) enterRoom(k, player.x, TILE*0.9); }
  else if(gy<0){ const k=curRoom.rx+','+(curRoom.ry-1); if(rooms[k]){ const t=rooms[k]; enterRoom(k, player.x, (t.h-0.9)*TILE); } }

  // Track each enemy's velocity so the auto-aim can lead its target (06_combat.js fire()).
  // Measured from the position delta rather than from the AI's intent, because that is the one
  // signal that exists on BOTH paths: the host moves enemies itself, a co-op client only ever
  // sees them interpolated out of snapshots and has no AI to ask.
  // Runs before fire() so the shot leaving this frame uses this frame's reading.
  for(const e of enemies){
    if(e._px!==undefined && dt>0){
      const dx=e.x-e._px, dy=e.y-e._py;
      // a room change, a boss reset or a snapshot correction is a jump, not a sprint — a lead
      // computed off one would throw the shot at nothing
      if(Math.hypot(dx,dy) > Math.max(60,(e.spd||160)*dt*4)){ e.tvx=0; e.tvy=0; }
      else { const k=Math.min(1,dt*9);            // EMA: strafing AI flips direction constantly
        e.tvx=(e.tvx||0)+((dx/dt)-(e.tvx||0))*k;
        e.tvy=(e.tvy||0)+((dy/dt)-(e.tvy||0))*k; }
    }
    e._px=e.x; e._py=e.y;
  }

  fire(dt);

  // enemies
  // On a co-op CLIENT the shared world belongs to the host: enemies, bosses and their projectiles
  // arrive as snapshots and are interpolated, so running the AI here as well would fight the
  // incoming state and desync immediately. Solo play and the host take the normal path.
  if(typeof netIsClient==='function' && netIsClient()){
    if(typeof netInterp==='function') netInterp(dt);
    if(typeof netHazards==='function') netHazards(dt);   // pools / bloom hit US too
    for(const e of enemies){ if(e.flash>0)e.flash-=dt; if(e.animAtk>0)e.animAtk-=dt; }
  } else
  for(const e of enemies){
    if(e.slowT>0)e.slowT-=dt; if(e.flash>0)e.flash-=dt; if(e.animAtk>0)e.animAtk-=dt;
    if(e.stunT>0)e.stunT-=dt;
    if(!tickStatuses(e,dt)) continue;          // frozen / stunned foes cannot act
    const dx=player.x-e.x, dy=player.y-e.y, dd=Math.hypot(dx,dy)||1;
    if(e.type==='c'){
      const ai=enemyAI(e,dx,dy,dd,dt);
      if(ai.move){ const ax=ai.tx-e.x, ay=ai.ty-e.y, al=Math.hypot(ax,ay)||1;
        moveCircle(e,(ax/al)*e.spd*ai.smul*slowF(e)*dt,(ay/al)*e.spd*ai.smul*slowF(e)*dt); }
      if(dd<e.r+player.r+14) e.animAtk=0.45;   // lunge-bite anim when adjacent
      if(dd<e.r+player.r && player.inv<=0){ const hit=damagePlayer(e.touch*statusDmgOut(e)*(1-(player.dr||0)));
        if(e.inf) playerStatus(e.inf.id,e.inf.dur,0);        // what this creature leaves on you
        player.inv=Math.max(player.inv,0.7); chargeRes('hurt'); boom(player.x,player.y,'#c04a3d',6);
        const _th=(player.thorns||0)+((player.thornT>0)?(player.thornB||0):0);   // + ult reflect
        if(_th>0){ const rf=Math.round(hit*_th*4); if(rf>0){ e.hp-=rf; e.flash=0.15; texts.push({x:e.x,y:e.y-e.r,txt:rf,col:'#c9d2da',life:0.5}); } } }
    }
    if(e.type==='s'){
      const ai=enemyAI(e,dx,dy,dd,dt);
      // A CULTIST IS A CASTER, and a caster plants to cast. It roots for the windup before each
      // volley and moves only between them — which is both what the animation already claims and
      // the thing that makes a caster readable: you learn to move when it stops.
      // Gated on having the mana to actually cast, or an MP-starved low-level one would read
      // fireT<=0 forever and root permanently.
      const _ro=(EBEH.skirmisher||{}).root||0.42;
      const rooted=(e.mp||0)>=8 && e.fireT<_ro;
      if(rooted){ /* planted mid-cast */ }
      else if(e.beh==='skirmisher'){
        // kite: back off when crowded, close the gap when out of range, strafe in the pocket
        const B=EBEH.skirmisher; let mvx,mvy;
        if(dd<B.kiteMin){ mvx=-dx/dd; mvy=-dy/dd; }
        else if(dd>B.kiteMax){ mvx=dx/dd; mvy=dy/dd; }
        else { mvx=-dy/dd; mvy=dx/dd; }
        moveCircle(e,mvx*e.spd*slowF(e)*dt,mvy*e.spd*slowF(e)*dt);
      } else if(ai.hold){
        // returning to its post / wandering / breaking off — its own goal outranks the stand-off
        const ax=ai.tx-e.x, ay=ai.ty-e.y, al=Math.hypot(ax,ay)||1;
        moveCircle(e,(ax/al)*e.spd*ai.smul*slowF(e)*dt,(ay/al)*e.spd*ai.smul*slowF(e)*dt);
      } else if(ai.move){
        // the others hold a stand-off and SIDESTEP along it between volleys. They used to walk to
        // 200px and then stand perfectly still for the rest of the fight, which made every
        // non-kiting caster in the game a turret you could ignore or trivially lead.
        const SO=230, arc=(e.wp>3.14?1:-1);
        let mvx,mvy,ms=1;
        if(dd>SO+45){ mvx=dx/dd; mvy=dy/dd; }
        else if(dd<SO-45){ mvx=-dx/dd; mvy=-dy/dd; }
        else { mvx=-dy/dd*arc; mvy=dx/dd*arc; ms=0.55; }   // shuffle around the ring
        moveCircle(e,mvx*e.spd*ai.smul*ms*slowF(e)*dt,mvy*e.spd*ai.smul*ms*slowF(e)*dt);
      }
      if(e.maxmp){ e.mp=Math.min(e.maxmp,(e.mp||0)+e.maxmp*0.35*dt); }   // caster MP regen (~35%/s)
      e.fireT-=dt;
      if(e.fireT<=0 && (e.mp||0)>=8){ e.mp-=8;                           // MP-gated: low-lv casters can't sustain
        // cadence and VOLUME both ramp with level now (eFireCd / eShotCount in 03_entities) --
        // a Lv1 shooter puts one slow bolt in the air, a Lv50 one a fast three-wide fan.
        // `rof` lets a species be quicker or heavier than its band's baseline.
        e.fireT=eFireCd(e.lv||1)/(1+(e.dex||0)*0.004)*(e.rof||1);
        e.animAtk=0.45; const base=Math.atan2(dy,dx);
        const psp=210*(1+(e.dex||0)*0.006);                             // DEX -> projectile speed
        const n=eShotCount(e.lv||1), half=(n-1)/2;
        for(let i=0;i<n;i++) eFire(e, base+(i-half)*0.22, psp); }
    }
    if(e.type==='B' && !e.decoy){
      // ---- ARENA LOCK ----
      // A world boss belongs to its den. It does not begin the fight until someone walks in, and
      // it cannot be pulled out of it: otherwise a boss wanders off across the zone, aggroes from
      // a screen away, and can be kited forever in open ground where none of its mechanics matter.
      if(e.wb && e.arena){
        const A=e.arena;
        const pIn = player.x>A.x0 && player.x<A.x1 && player.y>A.y0 && player.y<A.y1;
        if(pIn) e.woke=true;
        else if(e.woke && !bossArenaHasPlayer(A)){ e.woke=false; bossReset(e); }  // left -> full reset
        if(!e.woke){ e.fireT=Math.max(e.fireT,0.6); continue; }   // dormant until someone walks in
      }
      if(typeof bossAnimTick==='function') bossAnimTick(e,dt);   // pose clock (17f_bossanim)
      if(typeof bossMechTick==='function') bossMechTick(e,dt);   // signature mechanic / puzzle
      // --- PHASES. The count and the thresholds belong to the FIGHT now (bossPhases in
      // 17_bossmech): a fight may break at 1, 2, 3 or 4 points instead of the old fixed 66/33.
      if(e.phase===undefined) e.phase=0;
      const np=(typeof bossPhaseFor==='function')?bossPhaseFor(e)
              :((e.hp/e.maxhp)>0.66?0:(e.hp/e.maxhp)>0.33?1:2);
      if(np>e.phase){ e.phase=np; bossEnterPhase(e,np); }
      if(typeof bossChatter==='function') bossChatter(e);       // engage line + HP-milestone dialogue
      if(e.phaseInv>0) e.phaseInv-=dt;
      if(e.dlgInv>0) e.dlgInv-=dt;                               // protected dialogue window
      if(e.phaseFlash>0) e.phaseFlash-=dt;
      // ANCHORED PHASE: it walks to the middle of its arena, plants and goes untouchable while the
      // phase runs. Movement belongs to the anchor for the duration; it still shoots (that is the
      // whole point of a survival stage), so only the movement half of the block below is skipped.
      const _anch=(typeof bossAnchorStep==='function') && bossAnchorStep(e,dt);
      // A fight may take the wheel entirely -- no shared volley, no shared chase.
      const _D=(typeof bossMechDef==='function')?bossMechDef(e):null;
      if(_D && _D.ownsCombat){ if(e.animAtk>0) e.animAtk-=dt; continue; }
      if(!e.hidden){                              // hidden while its clone puzzle is up — images do the work
      const ph=e.phase, enraged=ph>=1;            // enrage behaviours from phase 2 on
      const fireMul=[1,0.78,0.6][ph]||0.6;        // attacks come faster each phase
      const pat=(ph>=1&&e.pat2)?e.pat2:(e.pat||'ring8');
      const spd=(170+ (e.lv||10)*0.7)*(1+ph*0.12);   // projectiles speed up per phase
      e.ang+=dt*(2.2+ph*0.6);
      // movement: charge bosses lunge, others drift toward the player (a touch faster each phase)
      const mv=1+ph*0.14;
      if(_anch){ /* the anchor owns movement this phase */ }
      else if(pat==='charge'){
        e.chargeT-=dt;
        if(e.chargeT<=0){ e.chargeT=(1.6+Math.random())/mv;
          if(typeof bossAnim==='function') bossAnim(e,'lunge');
          e.cvx=(dx/dd)*e.spd*4.2; e.cvy=(dy/dd)*e.spd*4.2; e.cdur=0.45; }
        if(e.cdur>0){ e.cdur-=dt; moveCircle(e,e.cvx*dt,e.cvy*dt); }
        else moveCircle(e,(dx/dd)*e.spd*0.4*slowF(e)*dt,(dy/dd)*e.spd*0.4*slowF(e)*dt);
      } else {
        moveCircle(e,(dx/dd)*e.spd*mv*slowF(e)*dt,(dy/dd)*e.spd*mv*slowF(e)*dt);
      }
      // tether: whatever the movement did, the boss stays inside its den. Dungeon chambers have
      // bounds now too (room.bossCh), so an Awakened boss is as bound to its room as a lair boss.
      if(!_anch){ const A=(typeof bossArenaOf==='function')?bossArenaOf(e):(e.wb?e.arena:null);
        if(A){ const m=e.r*0.5;
          e.x=Math.max(A.x0+m,Math.min(A.x1-m,e.x));
          e.y=Math.max(A.y0+m,Math.min(A.y1-m,e.y)); } }
      // during the transition beat the boss holds fire (you're dodging the shockwave)
      if((e.phaseInv||0)<=0){
        e.fireT-=dt;
        if(e.fireT<=0){ e.animAtk=0.5;
          if(typeof bossAnim==='function') bossAnim(e,pat==='nova'||pat==='ring8'?'roar':'wind');
          e.fireT=bossVolley(e,pat,Math.atan2(dy,dx),spd,enraged)*fireMul; }
        // LAYER the second pattern from phase 2 on (awakened bosses always) — fires on its own timer
        const other=(pat===e.pat2)?e.pat:e.pat2;
        if((ph>=1||e.awk) && other && other!==pat && other!=='charge' && other!=='summon'){
          e.fireT2=(e.fireT2===undefined?1.2:e.fireT2)-dt;
          if(e.fireT2<=0){ e.animAtk=0.5;
            e.fireT2=bossVolley(e,other,Math.atan2(dy,dx),spd,enraged)*1.5*fireMul; } }
      }
      } // end !hidden
    }
  }
  // player shots
  for(let i=pShots.length-1;i>=0;i--){ const s=pShots[i];
    s.px=s.x; s.py=s.y;
    // Falconer capstone: shots seek out foes (gentle steering).
    // Tested on !nohome, NOT on !forked: 'forked' marks shots that must not fork or chain AGAIN
    // (that would recurse), and ult/perk volleys set it for exactly that reason. Steering cannot
    // recurse, so excluding them there silently cost Falcon Barrage the one thing its name claims.
    if(player.homing&&!s.nohome){ let bn=null,bd2=1e9;
      for(const e of enemies){ const d2=Math.hypot(e.x-s.x,e.y-s.y); if(d2<420&&d2<bd2){bd2=d2;bn=e;} }
      if(bn){ const want=Math.atan2(bn.y-s.y,bn.x-s.x), cur=Math.atan2(s.vy,s.vx);
        let diff=want-cur; while(diff>Math.PI)diff-=6.283; while(diff<-Math.PI)diff+=6.283;
        // 5.5 rad/s, not 3.2: a shot launched away from the target could not complete the turn
        // inside its own lifetime, so "shots seek out foes" only ever nudged the ones already
        // pointed roughly right. A falcon wheels — this is the rate that lets it come back.
        const na=cur+Math.max(-5.5*dt,Math.min(5.5*dt,diff)), sp2=Math.hypot(s.vx,s.vy);
        s.vx=Math.cos(na)*sp2; s.vy=Math.sin(na)*sp2; } }
    s.x+=s.vx*dt; s.y+=s.vy*dt; s.life-=dt;
    s.age=(s.age||0)+dt;                       // drives the tumble on spinning projectiles
    if(s.life<=0||solid(s.x,s.y)){ pShots.splice(i,1); continue; }
    for(const e of enemies){ if(e!==s.lastHit && Math.hypot(e.x-s.x,e.y-s.y)<e.r+s.r){
      // execute/shatter/curse scaling, lifesteal, damage text and the on-hit perk triggers
      // all live in dealDamage now — shot-only extras (fork/chain/splash/critBolt) stay here.
      const dmg=dealDamage(e,(s.dmg||player.dmg)*(typeof dev!=='undefined'?dev.dmg:1),{crit:s.crit});
      // On a client the host owns this enemy's health. dealDamage already applied the hit locally
      // so the flash and the number land on the same frame you fired -- that is the prediction.
      // Reporting it lets the host resolve the real value, which arrives in the next snapshot.
      if(typeof netReportHit==='function') netReportHit(e,dmg,s.crit);
      s.lastHit=e; chargeRes('hit');
      if(s.slow) applyStatus(e,'chill',1,0);
      // the ability that threw this shot brands what it HIT, not what stood near the caster
      if(s.st) applyStatus(e,s.st.id,s.st.dur,s.st.valPct?Math.round(dmg*s.st.valPct):(s.st.val||0));
      // ---- on-hit capstones (all through the unified status system) ----
      if(player.burnHit) applyStatus(e,'burn',3,dmg*player.burnHit/3);
      if(player.poisonHit) applyStatus(e,'poison',4,dmg*player.poisonHit/4);
      if(player.shockHit) applyStatus(e,'shock',2,Math.max(1,Math.round(dmg*player.shockHit)));
      if(player.bleedHit) applyStatus(e,'bleed',3,player.bleedHit);
      if(player.weakHit) applyStatus(e,'weak',2.5,0);
      if(player.curse) applyStatus(e,'curse',4,player.curse);
      if(player.stun3){ player._s3=(player._s3||0)+1;
        if(player._s3>=3){ player._s3=0; applyStatus(e,'stun',0.8,0); fxHit(e.x,e.y,'#ffe08a'); } }
      if(player.chainHit&&!s.forked){ let cn=null,cd2=1e9;
        for(const e2 of enemies){ if(e2===e) continue;
          const d3=Math.hypot(e2.x-e.x,e2.y-e.y); if(d3<170&&d3<cd2){cd2=d3;cn=e2;} }
        if(cn){ const cdm=Math.round(dmg*player.chainHit); cn.hp-=cdm; cn.flash=0.12;
          texts.push({x:cn.x,y:cn.y-cn.r,txt:cdm,col:'#9ad4ef',life:0.5});
          fx.push({t:'bolt',pts:[{x:e.x,y:e.y},{x:cn.x,y:cn.y}],life:0.25,col:'#9ad4ef'}); } }
      if(player.splash) aoe(e.x,e.y,60,Math.round(dmg*player.splash),'#ff9c50');
      if(s.crit&&player.critBolt){ const bd3=Math.round(dmg*player.critBolt); e.hp-=bd3;
        fx.push({t:'bolt',pts:[{x:e.x,y:e.y-120},{x:e.x,y:e.y}],life:0.3,col:'#9ad4ef'});
        texts.push({x:e.x,y:e.y-e.r-14,txt:bd3,col:'#9ad4ef',life:0.6}); }
      if(s.crit&&player.critDashCd&&player.acd){    // __-prefixed keys (the ultimate) are exempt
        for(const k in player.acd) if(k.charAt(0)!=='_'&&player.acd[k]>0) player.acd[k]=Math.max(0,player.acd[k]-0.6); }
      if(player.fork&&!s.forked){ const ba=Math.atan2(s.vy,s.vx), sp3=Math.hypot(s.vx,s.vy);
        for(const off of [-0.5,0.5]) pShots.push({x:s.x,y:s.y,px:s.x,py:s.y,
          vx:Math.cos(ba+off)*sp3,vy:Math.sin(ba+off)*sp3,r:s.r,life:0.45,
          dmg:Math.round((s.dmg||player.dmg)*0.45),crit:false,pierce:0,lastHit:e,forked:true,pk:s.pk,pcore:s.pcore,
          psh:s.psh,phu:s.phu,pspin:s.pspin,age:0}); }
      fxHit(s.x,s.y,'#ffc94d');
      if(s.pierce>0){ s.pierce--; } else { pShots.splice(i,1); }
      break; } }
  }
  // enemy deaths
  for(let i=enemies.length-1;i>=0;i--){ if(enemies[i].hp<=0){
    const de=enemies[i];
    fxDeath(de.x,de.y,de.col,de.r);
    if(de.corrupt && typeof emitP==='function')                       // corrupted foe -> violet burst
      for(let q=0;q<16;q++){ const a=Math.random()*6.283, sp=60+Math.random()*150;
        emitP(de.x,de.y,{vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:0.55+Math.random()*0.3,col:'#b030d0',sz:3,glow:true}); }
    if(de.boss){ // freeing a boss from the dream ends it — it speaks a couple words of truth
      const gb=(de.ring!=null&&de.ring>=0&&typeof GBOSS!=='undefined')?GBOSS[de.ring]:null;
      if(gb&&gb.death&&typeof bossSayDeath==='function') bossSayDeath(gb.death,de);   // over the corpse
      else msg('THRONE SHATTERED','the realm is yours — for now'); }
    if(de.sref) de.sref.dead=Date.now()+(de.boss?180000:60000);
    enemies.splice(i,1); player.kills++;
    if(player.killHeal) healPlayer(player.maxhp*player.killHeal);          // Reaper
    if(player.killInv) player.inv=Math.max(player.inv,0.9);               // Phantom
    if(typeof perkFire==='function') perkFire('kill',{e:de,x:de.x,y:de.y});
    document.getElementById('killTxt').textContent='Kills '+player.kills;
    if(de.type==='N' && curRoom.dungeon && curRoom.objs){   // objective node destroyed
      const o=curRoom.objs[de.ch]; if(o&&!o.done){ o.got++;
        texts.push({x:de.x,y:de.y-18,txt:o.got+'/'+o.need,col:'#ffe08a',life:1.0}); }
      if(typeof fxDeath==='function') fxDeath(de.x,de.y,de.col,22); }
    const rwB={c:{xp:8,g:3},s:{xp:14,g:6},N:{xp:26,g:10},B:{xp:220,g:120}}[de.type];
    if(rpg&&rwB){ const lm=1+(de.lv||1)*0.35, gm=1+(de.lv||1)*0.30;
      const rx=Math.round(rwB.xp*lm), rg2=Math.round(rwB.g*gm);
      texts.push({x:de.x,y:de.y-8,txt:'+'+rx+'xp',col:'#7ab8d4',life:1.1});
      texts.push({x:de.x,y:de.y+10,txt:'+'+rg2+'g',col:'#ffc94d',life:1.1});
      gainXP(rx,rg2); chargeRes('kill');
      // what this run accomplished — banked as glory when the character finally dies
      if(typeof runNote==='function'){
        runNote(de.type==='B'?'bosses':de.type==='s'?'elites':'mobs');
        if(typeof runDeepest==='function') runDeepest(de.lv||1); }
      // A client does not roll its own drops: the host rolls once and the bag is shared, or
      // everyone generates their own private copy of the same kill's loot. This guard used to sit
      // ONLY on the trash branch below, so both BOSS branches minted duplicate bags on every
      // machine -- and those bags carry no `remote` flag, so the snapshot cull never removed them.
      // The portal, the message and the XP stay per-machine: those are correctly local.
      const _sim=(typeof netSimulates!=='function' || netSimulates());
      if(de.wb && de.ring>=0 && !curRoom.dungeon){ worldBoss=null; ringBossCd[de.ring]=32+Math.random()*20;
        groundPortals.push({x:de.x,y:de.y,ring:de.ring,life:45});
        if(_sim) for(let q=0;q<2;q++) loots.push(bagAt(de,mkDrop(Math.min(11,Math.round(de.lv/4.2)+1))));
        msg('A PORTAL TEARS OPEN',GBOSS[de.ring].dn+' awaits'); }
      else if(curRoom.dungeon && de.boss){
        if(_sim){ const rt2=Math.min(11,Math.round((curRoom.lv||10)/4.2)+2);
          for(let q=0;q<3;q++) loots.push(bagAt(de,mkDrop(rt2))); }   // no tonic: flasks refill themselves
        groundPortals.push({x:de.x+TILE,y:de.y,ring:-1,life:600,home:true});
        if(typeof runNote==='function') runNote('dungeons');   // the biggest thing a run can do
        msg('THE CONSCIOUSNESS SHATTERS','its mind falls quiet — step through to return'); }
      else if(_sim) rollLoot(de);
    } } }
  // enemy shots. A client's copies come from the host and are dead-reckoned in netInterp, so it
  // must not advance or expire them here -- but it still has to test them against ITSELF, because
  // each player takes their own damage locally.
  const _netCl=(typeof netIsClient==='function'&&netIsClient());
  for(let i=eShots.length-1;i>=0;i--){ const s=eShots[i];
    if(!_netCl){ s.px=s.x; s.py=s.y; s.x+=s.vx*dt; s.y+=s.vy*dt; s.life-=dt;
      if(s.life<=0||solid(s.x,s.y)){ eShots.splice(i,1); continue; } }
    if(player.inv<=0 && Math.hypot(player.x-s.x,player.y-s.y)<player.r+s.r){
      damagePlayer((s.bd||8)*(1-(player.dr||0)));
      // the shot carries whatever its caster inflicts — a Sawgrass Spitter's bolt poisons you the
      // same way your poison bolts poison it. Stamped at eFire from the species.
      if(s.inf) playerStatus(s.inf.id,s.inf.dur,0);
      player.inv=Math.max(player.inv,0.35); chargeRes('hurt'); boom(player.x,player.y,'#c04a3d',5); eShots.splice(i,1); }
  }
  // particles (gravity + drag are optional per-particle fields)
  for(let i=particles.length-1;i>=0;i--){ const p=particles[i];
    if(p.g) p.vy+=p.g*dt;
    if(p.drag){ const f=Math.max(0,1-p.drag*dt); p.vx*=f; p.vy*=f; }
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt; if(p.life<=0) particles.splice(i,1); }
  ambientParts(dt);
  // host: push the shared world to everyone (rate-limited to NET_HZ inside)
  if(typeof netBroadcast==='function') netBroadcast();
  if(typeof updateEggDrops==='function') updateEggDrops(dt);   // pet eggs on the ground: walk-over to collect
  if(typeof updatePet==='function') updatePet(dt);             // active pet: follow + auto-cast its utility kit
  if(typeof updatePetRoom==='function') updatePetRoom(dt);     // sanctuary: pets wander
  // drifting embers in warm places
  if(curRoom.glows&&curRoom.glows.length&&curRoom.town&&Math.random()<dt*16){
    const gl=curRoom.glows[Math.floor(Math.random()*curRoom.glows.length)];
    embers.push({x:gl.x+(Math.random()*34-17),y:gl.y,vx:(Math.random()-.5)*16,vy:-22-Math.random()*30,life:1.5+Math.random()*1.2});
  }
  for(let i=embers.length-1;i>=0;i--){ const e=embers[i];
    e.x+=e.vx*dt+Math.sin(performance.now()/280+i)*0.35; e.y+=e.vy*dt; e.life-=dt;
    if(e.life<=0) embers.splice(i,1); }
  for(let i=texts.length-1;i>=0;i--){ const t2=texts[i];
    t2.y-=28*dt; t2.life-=dt; if(t2.life<=0) texts.splice(i,1); }
  // per-ring mini-boss spawner (grove only) — one unique boss per ring at a time
  // keyed on the TERRITORY's boss, not the theme band — and -1 (ocean, bridge, the reserved
  // Molten Heart) must never touch ringBossCd, which players cross constantly.
  if(curRoom.rings && (typeof netSimulates!=='function' || netSimulates())){
    const cb=zoneBossAt(player.x/TILE,player.y/TILE);
    if(cb>=0){ ringBossCd[cb]=(ringBossCd[cb]||0)-dt;
      if(ringBossCd[cb]<=0){ ringBossCd[cb]=14+Math.random()*12;
        if(!ringBossAlive(cb) && Math.random()<0.85) spawnRingBoss(cb); } } }
  // release the portal lock once we've stepped clear of every portal.
  // (dungeons have no fixed curRoom.portals, so without this the lock set on
  //  entry never cleared and the return-home portal could never fire.)
  if(portalLock){ let nearAny=false;
    if(curRoom.portals) for(const pt of curRoom.portals){ if(Math.hypot(pt.x-player.x,pt.y-player.y)<90){nearAny=true;break;} }
    if(!nearAny) for(const gp of groundPortals){ if(Math.hypot(gp.x-player.x,gp.y-player.y)<90){nearAny=true;break;} }
    if(!nearAny && curRoom.pillars) for(const pl of curRoom.pillars){ if(Math.hypot(pl.x-player.x,pl.y-player.y)<90){nearAny=true;break;} }
    if(!nearAny) portalLock=false; }
  // ground dungeon portals from slain world bosses: tick life + despawn (USE-gated below)
  for(let i=groundPortals.length-1;i>=0;i--){ const gp=groundPortals[i];
    gp.life-=dt; if(gp.life<=0){ groundPortals.splice(i,1); continue; } }
  // spawns: streaming activation + 60s respawns (only once you leave the area)
  respawnT-=dt;
  // clients never activate spawn points -- every enemy they see is one the host spawned
  if(respawnT<=0 && !curRoom.dungeon && (typeof netSimulates!=='function' || netSimulates())){
    respawnT=0.5; const rn=Date.now();
    // CONCURRENCY CAP: the overworld bakes ~700 spawn points and a typical spot has 20-35 inside
    // the stream ring — activating them all buried a new hero under a 20-30 enemy swarm. Cap the
    // number of ROAMING foes (c/s) active near you at once, scaled by the local zone level so a
    // Lv1 starter stays sparse (~5) and only the Lv50 grind zones get busy (~15). Bosses/nodes exempt.
    // THE HOST FILLS THE GROUND AROUND EVERY HERO IT SIMULATES, not just its own. Measuring from
    // `player` alone meant a co-op client walked an empty world -- clients never activate spawn
    // points, so if the host was not standing beside them, nothing existed. Solo returns just the
    // local hero, so single-player is untouched.
    const _anchors=(typeof netSimAnchors==='function')?netSimAnchors():[{x:player.x,y:player.y}];
    // nearest hero, and WHICH one: the cap is per hero, or the first player in spawn-array order
    // spends the whole budget and everyone else still stands in an empty field.
    const _nearIdx=(x,y)=>{ let b=1e9,bi=0;
      for(let i=0;i<_anchors.length;i++){ const d=Math.hypot(_anchors[i].x-x,_anchors[i].y-y); if(d<b){b=d;bi=i;} }
      return {d:b,i:bi}; };
    const _near=(x,y)=>_nearIdx(x,y).d;
    // each hero's cap follows the zone THEY are standing in, so a Lv1 starter stays sparse while a
    // Lv50 rim gets busy -- even when both are being fed by the same host
    const _caps=_anchors.map(a=>{ if(!curRoom.big) return 1e9;
      const lv=(typeof grvLvAt==='function' && curRoom.rings)?grvLvAt(a.x/TILE,a.y/TILE):(curRoom.band||10);
      return Math.max(3, Math.min(8, 3+Math.floor(lv/9))); });
    const _roamN=_anchors.map(()=>0);
    for(const e of enemies){ if(e.type!=='c'&&e.type!=='s') continue;
      const n=_nearIdx(e.x,e.y); if(n.d<1100) _roamN[n.i]++; }
    for(const sp of curRoom.spawns){
      if(enemies.some(e=>e.sref===sp)) continue;
      const roamer = (sp.t==='c'||sp.t==='s');
      const sx=(sp.x+.5)*TILE, sy=(sp.y+.5)*TILE;
      const n=_nearIdx(sx,sy), d=n.d;
      if(roamer && _roamN[n.i]>=_caps[n.i]) continue;         // that hero's swarm cap is full
      let spawned=false;
      if(sp.dead){ if(sp.dead<=rn && d>500 && (!curRoom.big||d<800)){ sp.dead=0; enemies.push(makeEnemy(sp)); spawned=true; } }
      else if(curRoom.big && d>240 && d<800){ enemies.push(makeEnemy(sp)); spawned=true; }
      if(spawned && roamer) _roamN[n.i]++;
    }
    // cull against the NEAREST hero too, or the host immediately deletes what it just spawned for
    // someone standing on the other side of the map
    if(curRoom.big){ for(let i=enemies.length-1;i>=0;i--){ const e=enemies[i];
      if(e.sref && !e.boss && _near(e.x,e.y)>1100) enemies.splice(i,1); } }
    if(curRoom.regions||curRoom.rings){ const rg=regionAtPx(player.x,player.y);
      if(rg && rg.n!==curRegionN){ curRegionN=rg.n; msg(rg.n,'a hunting ground for Lv '+rg.lv+(rg.lv2?'–'+rg.lv2:'')); } }
    // permadeath notice fires the instant you first cross the bridge onto the main island
    if(curRoom.rings && typeof hcCheck==='function') hcCheck();
  }
  // find the nearest interactable portal/pillar and show a USE prompt above the hero.
  // Nothing auto-fires anymore — the player must press the prompt (see usePortalPrompt).
  // portalLock suppresses the prompt right after interacting, until you step clear.
  // boss bar vanishes when the boss dies, you leave the room, or you get far away
  if(bossBar && (bossBar.hp<=0 || enemies.indexOf(bossBar)<0
      || Math.hypot(player.x-bossBar.x,player.y-bossBar.y)>1100)) bossBar=null;
  // LOOT, SCANNED ON ITS OWN. Deliberately outside the competition below and outside portalLock:
  // a sack is never the thing that teleported you, and it must stay offered while you stand on it
  // next to whatever else is there. A sack that auto-collects on walk-over never prompts, and
  // somebody else's bound sack is invisible to me.
  lootPrompt=null;
  { let _lbest=1e9;
    for(const lb of loots){ if(bagAuto(lb)) continue;
      if(lb.own && typeof netOwnsLoot==='function' && !netOwnsLoot(lb)) continue;
      const d=Math.hypot(lb.x-player.x,lb.y-player.y);
      // 64, not the 48 the shared prompt used: a sack scatters a little where it lands, so at 48 it
      // could sit visually under your boots and still refuse to offer. Opening it is now the ONLY
      // way to get it, so the band has to be forgiving.
      if(d<64 && d<_lbest){ _lbest=d;
        const n=bagItems(lb).length, tt=bagTopTier(lb);
        lootPrompt={x:lb.x,y:lb.y,bag:lb,
          ctx:'T'+(tt+1)+(n>1?(' · '+n+' pieces'):'')}; } } }
  portalPrompt=null;
  if(!portalLock){ let _pbest=1e9;
    if(curRoom.portals) for(const pt of curRoom.portals){ const d=Math.hypot(pt.x-player.x,pt.y-player.y);
      if(d<44 && d<_pbest){ _pbest=d; portalPrompt={kind:'portal',x:pt.x,y:pt.y,to:pt.to||'0,0',ctx:pt.label||'Portal'}; } }
    for(const gp of groundPortals){ const d=Math.hypot(gp.x-player.x,gp.y-player.y);
      if(d<44 && d<_pbest){ _pbest=d; portalPrompt={kind:'ground',x:gp.x,y:gp.y,gp:gp,ctx:gp.home?'The Vale':'The Dungeon'}; } }
    if(curRoom.pillars) for(const pl of curRoom.pillars){ const d=Math.hypot(pl.x-player.x,pl.y-player.y);
      if(d<46 && d<_pbest){ _pbest=d; portalPrompt={kind:'pillar',x:pl.x,y:pl.y,pl:pl,ctx:pillarUnlocked(pl.band)?pl.name:'Attune '+pl.name}; } }
    if(curRoom.npc){ const np=curRoom.npc, d=Math.hypot(np.x-player.x,np.y-player.y);
      if(d<52 && d<_pbest){ _pbest=d; portalPrompt={kind:'npc',x:np.x,y:np.y,np:np,ctx:np.name}; } }
    if(curRoom.switches) for(const sw of curRoom.switches){ if(sw.on) continue;
      const d=Math.hypot(sw.x-player.x,sw.y-player.y);
      if(d<46 && d<_pbest){ _pbest=d; portalPrompt={kind:'switch',x:sw.x,y:sw.y,sw:sw,ctx:'Awaken'}; } }
    // Sanctuary: stand on a pet to make it your follower
    if(curRoom.petRoom && typeof petWanderers!=='undefined'){ const _pu=(typeof petStore==='function')?petStore():null;
      for(const w of petWanderers){ if(_pu&&_pu.activePet===w.def.uid) continue;
        const d=Math.hypot(w.x-player.x,w.y-player.y);
        if(d<40 && d<_pbest){ _pbest=d; portalPrompt={kind:'petpick',x:w.x,y:w.y-8,wuid:w.def.uid,ctx:'Make '+w.def.name+' your follower'}; } } }
    // Sanctuary stations: incubator (open eggs) + fusion altar (evolve)
    if(curRoom.petRoom && curRoom.petStations) for(const st of curRoom.petStations){ const d=Math.hypot(st.x-player.x,st.y-player.y);
      if(d<48 && d<_pbest){ _pbest=d; portalPrompt={kind:'petstation',x:st.x,y:st.y-24,st:st,ctx:st.kind==='incubator'?'Open the Incubator':'Use the Fusion Altar'}; } }
    // HEARTH STALLS (user, 2026-07-26): a vendor is opened AT THE STALL, not from a HUD button.
    // Same 85px range the old button used, and it competes on distance with every other prompt,
    // so standing between a portal and a stall offers the nearer one instead of both at once.
    // Anchored above the hanging sign (y-118), which the stall art and sign already occupy.
    if(curRoom.town) for(const np of SHOPNPCS){ const d=Math.hypot(np.x-player.x,np.y-player.y);
      if(d<85 && d<_pbest){ _pbest=d; portalPrompt={kind:'vendor',x:np.x,y:np.y-118,np:np,
        ctx:np.name, label:np.auction?'AUCTION':np.event?'BOUNTIES':np.diamond?'DIAMONDS':(np.plabel||'SHOP')}; } }
    // the Wardrobe's mirror — a room-level interactable with no vendor behind it
    if(curRoom.wardrobe){ const wd=curRoom.wardrobe, d=Math.hypot(wd.x-player.x,wd.y-player.y);
      if(d<70 && d<_pbest){ _pbest=d; portalPrompt={kind:'wardrobe',x:wd.x,y:wd.y-40,
        ctx:'The Wardrobe', label:'WARDROBE'}; } }
  }
  // dungeon: objective progress + orb pickup + dream motes
  if(curRoom.dungeon){
    if(curRoom.orbs) for(const o of curRoom.orbs){ if(o.got) continue;
      if(Math.hypot(o.x-player.x,o.y-player.y)<34){ o.got=true;
        const ob=curRoom.objs[o.ch]; if(ob&&!ob.done){ ob.got++;
          texts.push({x:o.x,y:o.y-16,txt:ob.got+'/'+ob.need,col:'#ffe08a',life:1.0}); }
        if(typeof emitP==='function') for(let q=0;q<8;q++){ const a=Math.random()*6.283;
          emitP(o.x,o.y,{vx:Math.cos(a)*70,vy:Math.sin(a)*70-20,life:0.5,col:'#bfe6f5',sz:3,g:120,glow:true}); } } }
    dunObjectives(dt);
  }
  // arena wave director
  if(curRoom.arena && arenaActive && enemies.length===0){
    arenaCd-=dt; if(arenaCd<=0){ arenaCd=2.0; arenaSpawnWave(); } }
  // Vendor proximity. The HUD button is gone -- the prompt above the stall opens the panel now --
  // so all this still tracks is WHICH stall you are at, which is what closes a panel you have
  // walked away from.
  if(curRoom.town){
    let nn=null,nd=1e9;
    for(const np of SHOPNPCS){ const d=Math.hypot(np.x-player.x,np.y-player.y);
      if(d<nd){nd=d;nn=np;} }
    const near=nd<85?nn:null;
    if((near?near.id:null)!==curShopNear){
      curShopNear=near?near.id:null; shopNear=!!near;
      // Changing stall closes whichever panel the last one owned. Closing on a CHANGE, not only
      // on leaving, stops one vendor's panel being read at another's counter.
      if(typeof closeVendorPanels==='function') closeVendorPanels(); }
  } else if(shopNear){ shopNear=false; curShopNear=null;
    if(typeof closeVendorPanels==='function') closeVendorPanels(); }
  // loot bags: despawn + HYBRID pickup. Public sacks auto-collect on walk-over; soulbound sacks
  // are left for the INTERACT prompt, which opens the bag UI. Decided by BAND, not rarity.
  if(typeof netReapBound==='function') netReapBound(dt);
  // the open sack panel must not outlive its sack, and the sack must not rot while you read it
  if(typeof bagOpen!=='undefined' && bagOpen){
    if(loots.indexOf(bagOpen)<0){ if(typeof closeBagPanel==='function') closeBagPanel(); }
    else bagOpen.life=Math.max(bagOpen.life,8);
  }
  for(let i=loots.length-1;i>=0;i--){ const lb=loots[i];
    // A `remote` bag is a shadow of one the host owns; the only cull for it lives inside
    // netApplyWorld. If this machine stops being a client (disconnect, host migration) that cull
    // never runs again and the shadow sits in the world forever, unclaimable.
    if(lb.remote && (typeof netIsClient!=='function' || !netIsClient())){ loots.splice(i,1); continue; }
    lb.life-=dt; if(lb.life<=0){loots.splice(i,1);continue;}
    if(!bagAuto(lb)) continue;                                   // soulbound -> press INTERACT
    if(lb.own && typeof netOwnsLoot==='function' && !netOwnsLoot(lb)) continue;   // not mine
    if(Math.hypot(lb.x-player.x,lb.y-player.y)<42) claimBag(lb);
  }
  // ability upkeep (mana regen handled at top; abilities cast from the right-side button)
  lastShotT+=dt;
  if(player.bDmgT>0)player.bDmgT-=dt; if(player.bRofT>0)player.bRofT-=dt; if(player.bSpdT>0)player.bSpdT-=dt;
  // active buffs shed colored motes so you can SEE they're running
  if(typeof emitP==='function'){
    if(player.bDmgT>0&&Math.random()<2.5*dt) emitP(player.x+(Math.random()*30-15),player.y+6,{vx:0,vy:-34,life:0.6,col:'#ff8c5a',sz:2,glow:true});
    if(player.bRofT>0&&Math.random()<2.5*dt) emitP(player.x+(Math.random()*30-15),player.y+6,{vx:0,vy:-34,life:0.6,col:'#ffd23d',sz:2,glow:true});
    if(player.bSpdT>0&&Math.random()<2.5*dt) emitP(player.x+(Math.random()*30-15),player.y+6,{vx:0,vy:-34,life:0.6,col:'#7dc47a',sz:2,glow:true}); }
  for(let i=allies.length-1;i>=0;i--){ const al=allies[i];
    al.life-=dt; if(al.life<=0){allies.splice(i,1);continue;}
    let tgt=null,bd=1e9;
    for(const e of enemies){ const d=Math.hypot(e.x-al.x,e.y-al.y); if(d<bd){bd=d;tgt=e;} }
    if(tgt){ if(bd>26){ al.x+=(tgt.x-al.x)/bd*140*dt; al.y+=(tgt.y-al.y)/bd*140*dt; }
      else { al.cd-=dt; if(al.cd<=0){ al.cd=0.5/(1+(player.allyHaste||0));   // Skald tempo
        dealDamage(tgt,al.dmg,{ally:true,silent:true});
        if(player.allyDot) applyStatus(tgt,'poison',2,al.dmg*player.allyDot/2);  // Plaguebringer
        if(al.st) applyStatus(tgt,al.st.id,al.st.dur||2,al.st.val||0);           // Bonecraft: minions inherit your on-hit
        texts.push({x:tgt.x,y:tgt.y-tgt.r-2,txt:al.dmg,col:'#8fd48c',life:0.4}); } } }
    else { const d=Math.hypot(player.x-al.x,player.y-al.y)||1;
      if(d>50){ al.x+=(player.x-al.x)/d*150*dt; al.y+=(player.y-al.y)/d*150*dt; } }
  }
  for(let i=zones.length-1;i>=0;i--){ const z=zones[i]; z.life-=dt; z.tick-=dt;
    if(z.follow){ z.x=player.x; z.y=player.y; }        // a corona is worn, not stood in
    if(z.tick<=0){ z.tick=0.5;
      if(z.healOnly){ if(Math.hypot(player.x-z.x,player.y-z.y)<z.r) healPlayer(9*(z.ap||1)); }
      else {
        for(const e of enemies){ if(Math.hypot(e.x-z.x,e.y-z.y)<z.r){
          dealDamage(e,z.dmg||Math.round(12*(z.ap||1)),{zone:true,silent:true,col:z.col});
          if(z.fire) applyStatus(e,'burn',2,6*(z.ap||1));
          if(z.poison) applyStatus(e,'poison',3,Math.max(2,Math.round((z.dmg||12*(z.ap||1))*0.4))); } }
        if(Math.hypot(player.x-z.x,player.y-z.y)<z.r) player.hp=Math.min(player.maxhp,player.hp+5); } }
    if(z.life<=0) zones.splice(i,1); }
  if(player.spiritT>0){ player.spiritT-=dt;
    for(let i=0;i<8;i++){ const a=performance.now()/300+i*Math.PI/4;
      const ox=player.x+Math.cos(a)*62, oy=player.y+Math.sin(a)*62;
      for(const e of enemies){ if((e.spiritCd||0)<=0 && Math.hypot(e.x-ox,e.y-oy)<e.r+8){
        const sd=Math.round(14*(player.spiritAP||1)); e.hp-=sd; e.flash=0.1; e.spiritCd=0.4;
        texts.push({x:e.x,y:e.y-e.r,txt:sd,col:'#7ab8d4',life:0.4}); } } }
    for(const e of enemies){ if(e.spiritCd>0)e.spiritCd-=dt; } }
  for(let i=fx.length-1;i>=0;i--){ fx[i].life-=dt; if(fx[i].life<=0)fx.splice(i,1); }

  // death
  if(typeof dev!=='undefined'&&dev.god&&player.hp<player.maxhp) player.hp=player.maxhp;
  if(player.hp<=0){ recordBest(player.kills); saveRPG();
    if(curRoom.arena&&arenaActive){ recordArenaBest(); arenaActive=false; }
    // Lv20+ is permadeath: the hearth stops calling you home (see hcCheck/permaDeath)
    // permadeath ONLY on the main island — the starter island (and Hearth) always respawn you.
    // The bridge is the point of no return.
    const _perma=(typeof isHardcore==='function' && isHardcore(rpg)) &&
      (typeof onMainIsland!=='function' || onMainIsland(player.x,player.y));
    if(_perma){ permaDeath(); return; }
    msg('YOU FELL','the hearth calls you home');
    player.hp=player.maxhp; player.mp=player.maxmp; player.inv=1.5;
    res=0; allies=[]; zones=[]; fx=[]; player.spiritT=0; player.deadeye=0; player.thornT=0;
    clearPlayerStatuses();
    const r0=rooms['0,0']; enterRoom('0,0',(r0.px+.5)*TILE,(r0.py+.5)*TILE); spawnPet(); }
  document.getElementById('hpTxt').textContent='HP '+Math.ceil(player.hp);
}
