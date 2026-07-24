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
function damagePlayer(raw){ let hit=raw;
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
  const B=(typeof EBEH!=='undefined'&&EBEH[e.beh])||{};
  let tx=player.x, ty=player.y, smul=1;
  // AMBUSHER: dormant (inert) until you step into range, then a short fast lunge
  if(e.beh==='ambusher'){
    if(e.dormant){
      if(dd<B.wake){ e.dormant=false; e.burstT=B.burstT; e.flash=0.25;
        if(typeof boom==='function') boom(e.x,e.y,e.col,10); }
      else return {tx:e.x,ty:e.y,smul:0,move:false};
    }
    if(e.burstT>0){ e.burstT-=dt; smul=B.burst||1; }
  }
  // SENTINEL: guards home. Once you leave its territory it disengages and patrols a small circle.
  if(e.beh==='sentinel'){
    const hd=Math.hypot(player.x-e.home.x,player.y-e.home.y);
    if(hd>(B.leash||360)){
      if(Math.hypot(e.x-e.home.x,e.y-e.home.y)<40){ e.roamA+=dt*1.1;
        tx=e.home.x+Math.cos(e.roamA)*46; ty=e.home.y+Math.sin(e.roamA)*46; smul=0.5; }
      else { tx=e.home.x; ty=e.home.y; smul=0.85; }
    }
  }
  // ROAMER: wanders the ground when you're far off, hunts when you close in
  if(e.beh==='roamer' && dd>(B.engage||540)){
    e.roamA+=(Math.random()-0.5)*dt*3;
    tx=e.x+Math.cos(e.roamA)*120; ty=e.y+Math.sin(e.roamA)*120; smul=B.wander||0.42;
  }
  // PACK: blend your position with the local pack centroid so they clump and flank together,
  // and hit a little harder in numbers
  if(e.beh==='pack'){
    let cx=0,cy=0,n=0;
    for(const o of enemies){ if(o!==e && o.beh==='pack'){
      const d2=Math.hypot(o.x-e.x,o.y-e.y); if(d2<(B.cohesion||150)){ cx+=o.x; cy+=o.y; n++; } } }
    if(n){ cx/=n; cy/=n; tx=player.x*0.72+cx*0.28; ty=player.y*0.72+cy*0.28;
      smul=1+(B.packBuff||0.16)*Math.min(3,n); }
  }
  return {tx,ty,smul,move:true};
}
let _pmove=false;   // true only while the PLAYER is being moved (Pathwarden terrain ghost)
function update(dt){
  // move: touch stick when held, else keyboard (WASD/arrows) at full speed
  const m=stick.move;
  const sp=player.spd*(typeof dev!=='undefined'?dev.spd:1)*(player.bSpdT>0?(player.bSpdM||1):1)
    *((typeof dynSpd==='function')?dynSpd():1);
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

  fire(dt);

  // enemies
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
        player.inv=Math.max(player.inv,0.7); chargeRes('hurt'); boom(player.x,player.y,'#c04a3d',6);
        if(player.thorns>0){ const rf=Math.round(hit*player.thorns*4); if(rf>0){ e.hp-=rf; e.flash=0.15; texts.push({x:e.x,y:e.y-e.r,txt:rf,col:'#c9d2da',life:0.5}); } } }
    }
    if(e.type==='s'){
      const ai=enemyAI(e,dx,dy,dd,dt);
      if(e.beh==='skirmisher'){
        // kite: back off when crowded, close the gap when out of range, strafe in the pocket
        const B=EBEH.skirmisher; let mvx,mvy;
        if(dd<B.kiteMin){ mvx=-dx/dd; mvy=-dy/dd; }
        else if(dd>B.kiteMax){ mvx=dx/dd; mvy=dy/dd; }
        else { mvx=-dy/dd; mvy=dx/dd; }
        moveCircle(e,mvx*e.spd*slowF(e)*dt,mvy*e.spd*slowF(e)*dt);
      } else if(ai.move && dd>200){
        const ax=ai.tx-e.x, ay=ai.ty-e.y, al=Math.hypot(ax,ay)||1;
        moveCircle(e,(ax/al)*e.spd*ai.smul*slowF(e)*dt,(ay/al)*e.spd*ai.smul*slowF(e)*dt);
      }
      e.fireT-=dt;
      if(e.fireT<=0){ e.fireT=1.4; e.animAtk=0.45; const base=Math.atan2(dy,dx);
        for(let i=-1;i<=1;i++) eFire(e, base+i*0.22, 210); }
    }
    if(e.type==='B'){
      const enraged=e.hp<e.maxhp*0.45;
      const pat=(enraged&&e.pat2)?e.pat2:(e.pat||'ring8');
      const spd=170+ (e.lv||10)*0.7;   // projectile speed scales with zone
      e.ang+=dt*(enraged?3.2:2.2);
      // movement: charge bosses lunge, others drift toward the player
      if(pat==='charge'){
        e.chargeT-=dt;
        if(e.chargeT<=0){ e.chargeT=1.6+Math.random();
          e.cvx=(dx/dd)*e.spd*4.2; e.cvy=(dy/dd)*e.spd*4.2; e.cdur=0.45; }
        if(e.cdur>0){ e.cdur-=dt; moveCircle(e,e.cvx*dt,e.cvy*dt); }
        else moveCircle(e,(dx/dd)*e.spd*0.4*slowF(e)*dt,(dy/dd)*e.spd*0.4*slowF(e)*dt);
      } else {
        moveCircle(e,(dx/dd)*e.spd*slowF(e)*dt,(dy/dd)*e.spd*slowF(e)*dt);
      }
      e.fireT-=dt;
      if(e.fireT<=0){ e.animAtk=0.5;
        e.fireT=bossVolley(e,pat,Math.atan2(dy,dx),spd,enraged); }
      // design rule 5: high-level bosses LAYER their two patterns into one crazier
      // combined pattern — the second pattern fires on its own (slower) timer.
      // Awakened dungeon bosses (e.awk) ALWAYS layer, whatever their level.
      const other=(pat===e.pat2)?e.pat:e.pat2;
      if(((e.lv||1)>=60||e.awk) && other && other!==pat && other!=='charge' && other!=='summon'){
        e.fireT2=(e.fireT2===undefined?1.2:e.fireT2)-dt;
        if(e.fireT2<=0){ e.animAtk=0.5;
          e.fireT2=bossVolley(e,other,Math.atan2(dy,dx),spd,enraged)*1.5; } }
    }
  }
  // player shots
  for(let i=pShots.length-1;i>=0;i--){ const s=pShots[i];
    s.px=s.x; s.py=s.y;
    // Falconer capstone: shots seek out foes (gentle steering)
    if(player.homing&&!s.forked){ let bn=null,bd2=1e9;
      for(const e of enemies){ const d2=Math.hypot(e.x-s.x,e.y-s.y); if(d2<420&&d2<bd2){bd2=d2;bn=e;} }
      if(bn){ const want=Math.atan2(bn.y-s.y,bn.x-s.x), cur=Math.atan2(s.vy,s.vx);
        let diff=want-cur; while(diff>Math.PI)diff-=6.283; while(diff<-Math.PI)diff+=6.283;
        const na=cur+Math.max(-3.2*dt,Math.min(3.2*dt,diff)), sp2=Math.hypot(s.vx,s.vy);
        s.vx=Math.cos(na)*sp2; s.vy=Math.sin(na)*sp2; } }
    s.x+=s.vx*dt; s.y+=s.vy*dt; s.life-=dt;
    if(s.life<=0||solid(s.x,s.y)){ pShots.splice(i,1); continue; }
    for(const e of enemies){ if(e!==s.lastHit && Math.hypot(e.x-s.x,e.y-s.y)<e.r+s.r){
      // execute/shatter/curse scaling, lifesteal, damage text and the on-hit perk triggers
      // all live in dealDamage now — shot-only extras (fork/chain/splash/critBolt) stay here.
      const dmg=dealDamage(e,(s.dmg||player.dmg)*(typeof dev!=='undefined'?dev.dmg:1),{crit:s.crit});
      s.lastHit=e; chargeRes('hit');
      if(s.slow) applyStatus(e,'chill',1,0);
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
          dmg:Math.round((s.dmg||player.dmg)*0.45),crit:false,pierce:0,lastHit:e,forked:true,pk:s.pk,pcore:s.pcore}); }
      fxHit(s.x,s.y,'#ffc94d');
      if(s.pierce>0){ s.pierce--; } else { pShots.splice(i,1); }
      break; } }
  }
  // enemy deaths
  for(let i=enemies.length-1;i>=0;i--){ if(enemies[i].hp<=0){
    const de=enemies[i];
    fxDeath(de.x,de.y,de.col,de.r);
    if(de.boss) msg('THRONE SHATTERED','the realm is yours — for now');
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
      if(de.wb && de.ring>=0 && !curRoom.dungeon){ worldBoss=null; ringBossCd[de.ring]=32+Math.random()*20;
        groundPortals.push({x:de.x,y:de.y,ring:de.ring,life:45});
        for(let q=0;q<2;q++) loots.push(bagAt(de,mkDrop(Math.min(11,Math.round(de.lv/12.5)+1))));
        msg('A PORTAL TEARS OPEN',GBOSS[de.ring].dn+' awaits'); }
      else if(curRoom.dungeon && de.boss){
        const rt2=Math.min(11,Math.round((curRoom.lv||10)/12.5)+2);
        for(let q=0;q<3;q++) loots.push(bagAt(de,mkDrop(rt2)));
        loots.push(bagAt(de,{k:'pot'}));
        groundPortals.push({x:de.x+TILE,y:de.y,ring:-1,life:600,home:true});
        msg('THE CONSCIOUSNESS SHATTERS','its mind falls quiet — step through to return'); }
      else rollLoot(de);
    } } }
  // enemy shots
  for(let i=eShots.length-1;i>=0;i--){ const s=eShots[i];
    s.px=s.x; s.py=s.y; s.x+=s.vx*dt; s.y+=s.vy*dt; s.life-=dt;
    if(s.life<=0||solid(s.x,s.y)){ eShots.splice(i,1); continue; }
    if(player.inv<=0 && Math.hypot(player.x-s.x,player.y-s.y)<player.r+s.r){
      damagePlayer((s.bd||8)*(1-(player.dr||0))); player.inv=Math.max(player.inv,0.35); chargeRes('hurt'); boom(player.x,player.y,'#c04a3d',5); eShots.splice(i,1); }
  }
  // particles (gravity + drag are optional per-particle fields)
  for(let i=particles.length-1;i>=0;i--){ const p=particles[i];
    if(p.g) p.vy+=p.g*dt;
    if(p.drag){ const f=Math.max(0,1-p.drag*dt); p.vx*=f; p.vy*=f; }
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt; if(p.life<=0) particles.splice(i,1); }
  ambientParts(dt);
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
  if(curRoom.rings){ const cb=grvBandXY(player.x/TILE,player.y/TILE);
    ringBossCd[cb]=(ringBossCd[cb]||0)-dt;
    if(ringBossCd[cb]<=0){ ringBossCd[cb]=14+Math.random()*12;
      if(!ringBossAlive(cb) && Math.random()<0.85) spawnRingBoss(cb); } }
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
  if(respawnT<=0 && !curRoom.dungeon){ respawnT=0.5; const rn=Date.now();
    for(const sp of curRoom.spawns){
      if(enemies.some(e=>e.sref===sp)) continue;
      const sx=(sp.x+.5)*TILE, sy=(sp.y+.5)*TILE;
      const d=Math.hypot(sx-player.x,sy-player.y);
      if(sp.dead){ if(sp.dead<=rn && d>500 && (!curRoom.big||d<800)){ sp.dead=0; enemies.push(makeEnemy(sp)); } }
      else if(curRoom.big && d>240 && d<800) enemies.push(makeEnemy(sp));
    }
    if(curRoom.big){ for(let i=enemies.length-1;i>=0;i--){ const e=enemies[i];
      if(e.sref && !e.boss && Math.hypot(e.x-player.x,e.y-player.y)>1100) enemies.splice(i,1); } }
    if(curRoom.regions||curRoom.rings){ const rg=regionAtPx(player.x,player.y);
      if(rg && rg.n!==curRegionN){ curRegionN=rg.n; msg(rg.n,'a hunting ground for Lv '+rg.lv+(rg.lv2?'–'+rg.lv2:'')); } }
  }
  // find the nearest interactable portal/pillar and show a USE prompt above the hero.
  // Nothing auto-fires anymore — the player must press the prompt (see usePortalPrompt).
  // portalLock suppresses the prompt right after interacting, until you step clear.
  // boss bar vanishes when the boss dies, you leave the room, or you get far away
  if(bossBar && (bossBar.hp<=0 || enemies.indexOf(bossBar)<0
      || Math.hypot(player.x-bossBar.x,player.y-bossBar.y)>1100)) bossBar=null;
  portalPrompt=null;
  if(!portalLock){ let _pbest=1e9;
    if(curRoom.portals) for(const pt of curRoom.portals){ const d=Math.hypot(pt.x-player.x,pt.y-player.y);
      if(d<44 && d<_pbest){ _pbest=d; portalPrompt={kind:'portal',x:pt.x,y:pt.y,to:pt.to||'0,0',ctx:pt.label||'Portal'}; } }
    for(const gp of groundPortals){ const d=Math.hypot(gp.x-player.x,gp.y-player.y);
      if(d<44 && d<_pbest){ _pbest=d; portalPrompt={kind:'ground',x:gp.x,y:gp.y,gp:gp,ctx:gp.home?'The Vale':'The Dungeon'}; } }
    if(curRoom.pillars) for(const pl of curRoom.pillars){ const d=Math.hypot(pl.x-player.x,pl.y-player.y);
      if(d<46 && d<_pbest){ _pbest=d; portalPrompt={kind:'pillar',x:pl.x,y:pl.y,pl:pl,ctx:pillarUnlocked(pl.band)?pl.name:'Attune '+pl.name}; } }
    for(const lb of loots){ const rar=(lb.item&&lb.item.rar)||0; if(rar<2||lb.item.k==='pot') continue;
      const d=Math.hypot(lb.x-player.x,lb.y-player.y);
      if(d<48 && d<_pbest){ _pbest=d; portalPrompt={kind:'loot',x:lb.x,y:lb.y,bag:lb,ctx:(RAR_NAMES[rar]||'')}; } }
    if(curRoom.switches) for(const sw of curRoom.switches){ if(sw.on) continue;
      const d=Math.hypot(sw.x-player.x,sw.y-player.y);
      if(d<46 && d<_pbest){ _pbest=d; portalPrompt={kind:'switch',x:sw.x,y:sw.y,sw:sw,ctx:'Awaken'}; } }
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
  // vendor proximity
  if(curRoom.town){
    let nn=null,nd=1e9;
    for(const np of SHOPNPCS){ const d=Math.hypot(np.x-player.x,np.y-player.y);
      if(d<nd){nd=d;nn=np;} }
    const near=nd<85?nn:null;
    if((near?near.id:null)!==curShopNear){
      curShopNear=near?near.id:null; shopNear=!!near;
      const b=document.getElementById('shopBtn');
      b.style.display=near?'flex':'none';
      if(near) b.textContent='🏪 '+near.name.toUpperCase();
      if(!near) document.getElementById('shopScr').style.display='none'; }
  } else if(shopNear){ shopNear=false; curShopNear=null;
    document.getElementById('shopBtn').style.display='none';
    document.getElementById('shopScr').style.display='none'; }
  // loot bags: despawn + HYBRID pickup. Commons/uncommons/potions auto-collect on
  // walk-over; rare+ (rar>=2) are left on the ground for the INTERACT prompt (below).
  for(let i=loots.length-1;i>=0;i--){ const lb=loots[i];
    lb.life-=dt; if(lb.life<=0){loots.splice(i,1);continue;}
    const rar=(lb.item&&lb.item.rar)||0;
    if(rar>=2 && lb.item.k!=='pot') continue;                 // rare+ -> press INTERACT
    if(Math.hypot(lb.x-player.x,lb.y-player.y)<42){
      const ch=curChar(); if(!ch||!rpg) continue; if(!ch.inv)ch.inv=[];
      if(lb.item.k==='coin'){ addCoin(); recalcStats();
        texts.push({x:lb.x,y:lb.y-14,txt:'+Fortune Coin',col:'#ffd07a',life:1.2}); }
      else if(lb.item.k==='pot'){ rpg.pots++; hudRPG();
        texts.push({x:lb.x,y:lb.y-14,txt:'+Tonic',col:'#7dc47a',life:1}); }
      else if(ch.inv.length<20){ ch.inv.push(lb.item);
        texts.push({x:lb.x,y:lb.y-14,txt:itemName(lb.item),col:itemRarCol(lb.item),life:1.3}); }
      else { continue; }
      loots.splice(i,1); saveRPG();
    } }
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
    if(typeof isHardcore==='function' && isHardcore(rpg)){ permaDeath(); return; }
    msg('YOU FELL','the hearth calls you home');
    player.hp=player.maxhp; player.mp=player.maxmp; player.inv=1.5;
    res=0; allies=[]; zones=[]; fx=[]; player.spiritT=0; player.deadeye=0;
    const r0=rooms['0,0']; enterRoom('0,0',(r0.px+.5)*TILE,(r0.py+.5)*TILE); spawnPet(); }
  document.getElementById('hpTxt').textContent='HP '+Math.ceil(player.hp);
}
