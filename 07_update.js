// ---------- update ----------
function update(dt){
  // move
  const m=stick.move;
  if(m.id!==null){
    const d=Math.hypot(m.dx,m.dy)||1;
    const sp=player.spd*(typeof dev!=='undefined'?dev.spd:1)*(player.bSpdT>0?(player.bSpdM||1):1);
    moveCircle(player,(m.dx/d)*sp*dt*Math.min(1,d/28),(m.dy/d)*sp*dt*Math.min(1,d/28));
  }
  player.inv=Math.max(0,player.inv-dt);
  if(typeof updateAbilCooldowns==='function') updateAbilCooldowns(dt);      // ability cooldowns
  if(player.atkT>0) player.atkT-=dt;                                       // attack animation timer
  if(player.hp<player.maxhp) player.hp+=(player.regen||1)*dt;               // VIT -> regen
  if(player.mp<player.maxmp) player.mp=Math.min(player.maxmp,player.mp+(player.mpregen||2)*dt); // WIS -> mana

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
    const dx=player.x-e.x, dy=player.y-e.y, dd=Math.hypot(dx,dy)||1;
    if(e.type==='c'){
      moveCircle(e,(dx/dd)*e.spd*slowF(e)*dt,(dy/dd)*e.spd*slowF(e)*dt);
      if(dd<e.r+player.r+14) e.animAtk=0.45;   // lunge-bite anim when adjacent
      if(dd<e.r+player.r && player.inv<=0){ const hit=Math.max(1,Math.round(e.touch*(1-(player.dr||0)))); player.hp-=hit; player.inv=0.7; chargeRes('hurt'); boom(player.x,player.y,'#c04a3d',6);
        if(player.thorns>0){ const rf=Math.round(hit*player.thorns*4); if(rf>0){ e.hp-=rf; e.flash=0.15; texts.push({x:e.x,y:e.y-e.r,txt:rf,col:'#c9d2da',life:0.5}); } } }
    }
    if(e.type==='s'){
      if(dd>200) moveCircle(e,(dx/dd)*e.spd*slowF(e)*dt,(dy/dd)*e.spd*slowF(e)*dt);
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
      if(e.fireT<=0){
        e.animAtk=0.5;
        const base=Math.atan2(dy,dx);
        if(pat==='aimed3'){ e.fireT=enraged?0.6:0.95;
          for(let i=-1;i<=1;i++) eFire(e,base+i*0.20,spd); }
        else if(pat==='spread5'){ e.fireT=enraged?0.5:0.8;
          for(let i=-2;i<=2;i++) eFire(e,base+i*0.16,spd*1.1); }
        else if(pat==='nova'){ e.fireT=enraged?1.0:1.5;
          const n=enraged?16:12; for(let i=0;i<n;i++) eFire(e,(i/n)*6.283,spd*0.8); }
        else if(pat==='spiral'){ e.fireT=enraged?0.12:0.18;
          eFire(e,e.ang,spd*0.9); eFire(e,e.ang+Math.PI,spd*0.9); }
        else if(pat==='ring8'){ e.fireT=enraged?0.55:0.9;
          for(let i=0;i<8;i++) eFire(e,e.ang+i*Math.PI/4,spd*0.85);
          if(enraged) eFire(e,base,spd*1.6); }
        else if(pat==='summon'){ e.fireT=2.2;
          e.sumT-=1;
          if(e.sumT<=0){ e.sumT=3;
            const alive=enemies.filter(function(m){return m.summoned;}).length;
            if(alive<6){ for(let q=0;q<3;q++){ const a=Math.random()*6.283;
              const mh=40*(1+(e.lv||10)*0.55);
              enemies.push({type:'c',summoned:true,x:e.x+Math.cos(a)*40,y:e.y+Math.sin(a)*40,
               r:15,hp:Math.round(mh),maxhp:Math.round(mh),spd:120,touch:6+(e.lv||10)*0.3,col:e.col,lv:e.lv}); } } }
          for(let i=-1;i<=1;i++) eFire(e,base+i*0.25,spd); }
        else { e.fireT=0.9; for(let i=0;i<8;i++) eFire(e,e.ang+i*Math.PI/4,spd*0.8); }
      }
    }
  }
  // player shots
  for(let i=pShots.length-1;i>=0;i--){ const s=pShots[i];
    s.px=s.x; s.py=s.y; s.x+=s.vx*dt; s.y+=s.vy*dt; s.life-=dt;
    if(s.life<=0||solid(s.x,s.y)){ pShots.splice(i,1); continue; }
    for(const e of enemies){ if(e!==s.lastHit && Math.hypot(e.x-s.x,e.y-s.y)<e.r+s.r){
      const dmg=Math.round((s.dmg||player.dmg)*(typeof dev!=='undefined'?dev.dmg:1));
      e.hp-=dmg; e.flash=0.12; s.lastHit=e; chargeRes('hit');
      texts.push({x:e.x+(Math.random()*18-9),y:e.y-e.r-2,txt:s.crit?dmg+'!':dmg,col:s.crit?'#ffd23d':'#ffe9b0',life:s.crit?0.85:0.55});
      if(player.ls) player.hp=Math.min(player.maxhp,player.hp+dmg*player.ls);
      if(s.slow) e.slowT=1;
      boom(s.x,s.y,'#ffc94d',4);
      if(s.pierce>0){ s.pierce--; } else { pShots.splice(i,1); }
      break; } }
  }
  // enemy deaths
  for(let i=enemies.length-1;i>=0;i--){ if(enemies[i].hp<=0){
    const de=enemies[i];
    boom(de.x,de.y,de.col,16);
    if(de.boss) msg('THRONE SHATTERED','the realm is yours — for now');
    if(de.sref) de.sref.dead=Date.now()+(de.boss?180000:60000);
    enemies.splice(i,1); player.kills++;
    document.getElementById('killTxt').textContent='Kills '+player.kills;
    const rwB={c:{xp:8,g:3},s:{xp:14,g:6},B:{xp:220,g:120}}[de.type];
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
        msg('LAIR CLEARED','step through to return'); }
      else rollLoot(de);
    } } }
  // enemy shots
  for(let i=eShots.length-1;i>=0;i--){ const s=eShots[i];
    s.px=s.x; s.py=s.y; s.x+=s.vx*dt; s.y+=s.vy*dt; s.life-=dt;
    if(s.life<=0||solid(s.x,s.y)){ eShots.splice(i,1); continue; }
    if(player.inv<=0 && Math.hypot(player.x-s.x,player.y-s.y)<player.r+s.r){
      player.hp-=Math.max(1,Math.round((s.bd||8)*(1-(player.dr||0)))); player.inv=0.35; chargeRes('hurt'); boom(player.x,player.y,'#c04a3d',5); eShots.splice(i,1); }
  }
  // particles
  for(let i=particles.length-1;i>=0;i--){ const p=particles[i];
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt; if(p.life<=0) particles.splice(i,1); }
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
      if(rg && rg.n!==curRegionN){ curRegionN=rg.n; msg(rg.n,'a hunting ground for Lv '+rg.lv); } }
  }
  // find the nearest interactable portal/pillar and show a USE prompt above the hero.
  // Nothing auto-fires anymore — the player must press the prompt (see usePortalPrompt).
  // portalLock suppresses the prompt right after interacting, until you step clear.
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
  for(let i=allies.length-1;i>=0;i--){ const al=allies[i];
    al.life-=dt; if(al.life<=0){allies.splice(i,1);continue;}
    let tgt=null,bd=1e9;
    for(const e of enemies){ const d=Math.hypot(e.x-al.x,e.y-al.y); if(d<bd){bd=d;tgt=e;} }
    if(tgt){ if(bd>26){ al.x+=(tgt.x-al.x)/bd*140*dt; al.y+=(tgt.y-al.y)/bd*140*dt; }
      else { al.cd-=dt; if(al.cd<=0){ al.cd=0.5; tgt.hp-=al.dmg; tgt.flash=0.1;
        texts.push({x:tgt.x,y:tgt.y-tgt.r-2,txt:al.dmg,col:'#8fd48c',life:0.4}); } } }
    else { const d=Math.hypot(player.x-al.x,player.y-al.y)||1;
      if(d>50){ al.x+=(player.x-al.x)/d*150*dt; al.y+=(player.y-al.y)/d*150*dt; } }
  }
  for(let i=zones.length-1;i>=0;i--){ const z=zones[i]; z.life-=dt; z.tick-=dt;
    if(z.tick<=0){ z.tick=0.5;
      for(const e of enemies){ if(Math.hypot(e.x-z.x,e.y-z.y)<z.r){ e.hp-=Math.round(12*(z.ap||1)); e.flash=0.08; } }
      if(Math.hypot(player.x-z.x,player.y-z.y)<z.r) player.hp=Math.min(player.maxhp,player.hp+5); }
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
    msg('YOU FELL','the hearth calls you home');
    player.hp=player.maxhp; player.mp=player.maxmp; player.inv=1.5;
    res=0; allies=[]; zones=[]; fx=[]; player.spiritT=0; player.deadeye=0;
    const r0=rooms['0,0']; enterRoom('0,0',(r0.px+.5)*TILE,(r0.py+.5)*TILE); spawnPet(); }
  document.getElementById('hpTxt').textContent='HP '+Math.ceil(player.hp);
}
