// ===================================================================================
// 17i_bossfights.js — THE 25 FIGHTS (user, 2026-07-27: "25 distinct mechanics", and "make the
// dungeon boss and its overworld version kind of have the same mechanics but not all the way")
//
// 12 identities x 2 forms + the arena champion. Each identity is a FAMILY: both forms share the
// core idea so the creature is instantly recognisable, and the dungeon form twists one element and
// adds one of its own — so beating the Grovewarden outside teaches you something about the
// Awakened Grovewarden without teaching you everything.
//
// Every fight is registered into BOSS_MECH (17_bossmech.js) under ow<ring> / dn<ring> / arena, and
// composed from the primitives in 17h_mechlib.js. Nothing here hard-codes a timing: they all read
// bossPace(e), so the same fight is a readable puzzle at Lv4 and a squeeze at Lv50.
//
// Each entry may declare:
//   phases   HP fractions where it escalates (1-4 breaks)
//   anchor   per-phase: does it plant at the arena centre and go untouchable
//   titles   what each stage is called on the banner
//   tick / trigger / draw
// ===================================================================================

function _F(key,def){ BOSS_MECH[key]=def; }
const _sig=(e,n)=>{ if(typeof bossAnim==='function'){ bossAnim(e,n); if(typeof bossAnimFx==='function') bossAnimFx(e,n); } };
const _pdist=(e)=>{ const p=(typeof player!=='undefined')?player:null; return p?Math.hypot(p.x-e.x,p.y-e.y):999; };
const _pxy=()=>{ const p=(typeof player!=='undefined')?player:null; return p?{x:p.x,y:p.y}:{x:0,y:0}; };

// ===================================================================================
// 0  THE GROVEWARDEN — ROOTGRASP.  Roots creep out and hold you; they feed the tree.
// ===================================================================================
_F('ow0',{ phases:[0.66,0.33], titles:['','TAKING ROOT','THE GROVE CLOSES'],
  tick(e,dt,ph,eng){ const M=mkState(e); mechTickCommon(e,dt); if(!eng) return;
    // roots grow from the BOSS outward: standing in one roots you and heals it
    if(mechEvery(e,'t',3.4-ph*0.5,dt)){
      _sig(e,'rootheave');
      const n=2+ph, P=bossPace(e);
      for(let i=0;i<n;i++){ const a=Math.random()*6.283, d=TILE*(1.4+Math.random()*3.0);
        hazAdd(e,e.x+Math.cos(a)*d,e.y+Math.sin(a)*d,
          {r:TILE*1.0,tele:1.0,live:6.0*P.cycle,dmg:0.30,tick:0.5,col:'#4a7a3a',
           inflict:{id:'chill',dur:1.2}}); }
    }
    // every root that has you feeds it
    const p=_pxy();
    for(const h of M.haz) if(h.ph==='live' && Math.hypot(p.x-h.x,p.y-h.y)<h.r){
      e.hp=Math.min(e.maxhp,e.hp+e.maxhp*0.006*dt); break; }
  },
  trigger(e,ph){ _sig(e,'rootheave'); for(let i=0;i<3+ph;i++){ const a=(i/(3+ph))*6.283;
    hazAdd(e,e.x+Math.cos(a)*TILE*2.2,e.y+Math.sin(a)*TILE*2.2,{r:TILE*1.1,tele:0.8,live:7,dmg:0.3,col:'#4a7a3a'}); } },
  draw(e){ mechDrawCommon(e); } });

// Dungeon: same roots, but it PLANTS itself and the roots become the whole fight — you cannot
// hurt it until you cut the four heartwood knots it puts down.
_F('dn0',{ phases:[0.75,0.45,0.20], anchor:[false,true,false,true],
  titles:['','IT TAKES ROOT','THE GROVE CLOSES','HEARTWOOD'],
  tick(e,dt,ph,eng){ const M=mkState(e); mechTickCommon(e,dt); if(!eng) return;
    // The KNOTS are this fight's only gate. It still plants at the centre, but it must not also
    // claim the anchor clock's immunity -- two gates stacked left barely a tenth of the fight
    // hittable, and neither of them was the one the player was being taught to break.
    e.anchorNoInv=1;
    const anchored=bossAnchorPhase(e);
    if(anchored){
      if(M.ph!==ph){ M.ph=ph; wardRaise(e); mechClearAdds(e,'knot');
        mechAdds(e,4,'knot',{node:true,hp:0.55,dist:TILE*3.2,col:'#6fbf5a',scale:false});
        if(typeof msg==='function') msg('CUT THE HEARTWOOD','it cannot be hurt while they stand'); }
      if(mechAddsAlive(e,'knot')===0 && e.wardInv) wardDrop(e);
      if(mechEvery(e,'t',2.0,dt)){ const p=_pxy();
        hazAdd(e,p.x,p.y,{r:TILE*1.2,tele:1.0,live:5,dmg:0.4,col:'#4a7a3a',inflict:{id:'chill',dur:1.4}}); }
    } else {
      if(M.ph!==ph){ M.ph=ph; mechClearAdds(e,'knot'); e.wardInv=0; }
      if(mechEvery(e,'t',2.8,dt)){ _sig(e,'rootheave');
        for(let i=0;i<2+ph;i++){ const a=Math.random()*6.283, d=TILE*(1.2+Math.random()*3.2);
          hazAdd(e,e.x+Math.cos(a)*d,e.y+Math.sin(a)*d,{r:TILE*1.0,tele:0.85,live:6,dmg:0.35,col:'#4a7a3a'}); } }
    }
  },
  trigger(e,ph){ _sig(e,'phase'); },
  draw(e){ mechDrawCommon(e); } });

// ===================================================================================
// 1  THE MISTANTLER — FOGBANK.  Your sight closes; it is in there somewhere.
// ===================================================================================
_F('ow1',{ phases:[0.60,0.28], titles:['','THE FOG THICKENS','NOTHING TO SEE'],
  tick(e,dt,ph,eng){ const M=mkState(e); mechTickCommon(e,dt); if(!eng){ M.fog=0; return; }
    const P=bossPace(e);
    M.fog=Math.min(1,(M.fog||0)+dt*0.5);
    // it fades out, repositions, and flashes its antlers a beat before it charges
    if(mechEvery(e,'t',4.2-ph*0.6,dt)){
      _sig(e,'fade');
      const p=_pxy(), a=Math.random()*6.283, d=TILE*(3.0+Math.random()*2.0);
      // land on ground it can move off again (see the ow7 note): a body inside a wall has no
      // legal move in any direction, so the chase and the anchor walk can never recover it
      { let _nx=p.x+Math.cos(a)*d, _ny=p.y+Math.sin(a)*d;
        if(typeof safeSpot==='function'){ const _sp=safeSpot(curRoom,_nx,_ny); _nx=_sp.x; _ny=_sp.y; }
        e.x=_nx; e.y=_ny; }
      M.tell=0.9*P.tele;
    }
    if(M.tell>0){ M.tell-=dt; if(M.tell<=0){ _sig(e,'lunge');
      const p=_pxy(), a=Math.atan2(p.y-e.y,p.x-e.x);
      for(let i=-1;i<=1;i++) if(typeof eFire==='function') eFire(e,a+i*0.16,240*P.speed); } }
  },
  trigger(e,ph){ _sig(e,'fade'); },
  draw(e){ mechDrawCommon(e);
    const M=e.mk; if(!M||!M.fog) return;
    // sight collapses to a circle around YOU. The boss is only visible when it tells.
    const p=(typeof player!=='undefined')?player:{x:e.x,y:e.y};
    const R=(TILE*7.5)*(1-0.35*(M.fog||0));
    ctx.save(); ctx.globalAlpha=0.72*(M.fog||0);
    const g=ctx.createRadialGradient(p.x,p.y,R*0.55,p.x,p.y,R*1.7);
    g.addColorStop(0,'rgba(150,170,180,0)'); g.addColorStop(1,'rgba(150,170,180,1)');
    ctx.fillStyle=g; ctx.fillRect(p.x-R*1.8,p.y-R*1.8,R*3.6,R*3.6);
    ctx.restore();
    if(M.tell>0){ ctx.save(); ctx.globalCompositeOperation='lighter';
      ctx.globalAlpha=0.8; ctx.fillStyle='#bfe6ff';
      ctx.beginPath(); ctx.arc(e.x,e.y-e.r*0.6,5,0,6.29); ctx.fill(); ctx.restore(); } } });

// Dungeon: the fog stays, but now the fog SPEAKS — false antler-flashes at empty air, and only
// one of them is really it.
_F('dn1',{ phases:[0.70,0.40,0.15], titles:['','THE FOG THICKENS','FALSE LIGHTS','NOTHING TO SEE'],
  tick(e,dt,ph,eng){ const M=mkState(e); mechTickCommon(e,dt); if(!eng){ M.fog=0; return; }
    const P=bossPace(e);
    M.fog=Math.min(1,(M.fog||0)+dt*0.6);
    if(!M.lights) M.lights=[];
    if(ph>=1 && mechEvery(e,'t2',2.6,dt)){
      M.lights.length=0;
      const n=2+ph;
      for(let i=0;i<n;i++){ const a=Math.random()*6.283, d=TILE*(2.5+Math.random()*3.0);
        M.lights.push({x:e.x+Math.cos(a)*d,y:e.y+Math.sin(a)*d,t:1.2*P.tele,real:false}); }
      M.lights.push({x:e.x,y:e.y-e.r*0.6,t:1.2*P.tele,real:true});
    }
    for(let i=M.lights.length-1;i>=0;i--){ const L=M.lights[i]; L.t-=dt;
      if(L.t<=0){ // every light fires; only the real one is where the boss actually is
        const p=_pxy(), a=Math.atan2(p.y-L.y,p.x-L.x);
        if(typeof eFire==='function'){ const src={x:L.x,y:L.y,bd:e.bd*(L.real?1:0.6),
          pcol:e.pcol,pcore:e.pcore,pshape:e.pshape,psize:e.psize};
          for(let k=-1;k<=1;k+=(L.real?1:2)) eFire(src,a+k*0.14,235*P.speed); }
        M.lights.splice(i,1); } }
    if(mechEvery(e,'t',3.4,dt)){ _sig(e,'fade');
      const p=_pxy(), a=Math.random()*6.283, d=TILE*(2.6+Math.random()*2.2);
      // land on ground it can move off again (see the ow7 note): a body inside a wall has no
      // legal move in any direction, so the chase and the anchor walk can never recover it
      { let _nx=p.x+Math.cos(a)*d, _ny=p.y+Math.sin(a)*d;
        if(typeof safeSpot==='function'){ const _sp=safeSpot(curRoom,_nx,_ny); _nx=_sp.x; _ny=_sp.y; }
        e.x=_nx; e.y=_ny; } }
    // THE FOG ITSELF IS THE THREAT. Every point of damage in this fight was an aimed bolt, and a
    // player who keeps moving is never hit by one: the whole four-phase Lv48 fight measured under
    // 4% of a hero's bar per second, the softest in the game. The fog closes now -- stay near
    // where it last showed itself or the cold gets you -- which is the mechanic the fight is
    // already named for rather than a new one bolted on.
    M.close=(M.close||0)+dt;
    if(M.close>0.7){ M.close=0;
      const p=_pxy(), dd=Math.hypot(p.x-e.x,p.y-e.y), safe=TILE*(7.0-ph*1.2);
      if(dd>safe){ _hurt(mechDmg(e,0.26+ph*0.05));
        if(typeof playerStatus==='function') playerStatus('chill',2.0,0); } }
  },
  trigger(e,ph){ _sig(e,'fade'); },
  draw(e){ mechDrawCommon(e);
    const M=e.mk; if(!M) return;
    const p=(typeof player!=='undefined')?player:{x:e.x,y:e.y};
    const R=(TILE*6.6)*(1-0.35*(M.fog||0));
    ctx.save(); ctx.globalAlpha=0.78*(M.fog||0);
    const g=ctx.createRadialGradient(p.x,p.y,R*0.5,p.x,p.y,R*1.7);
    g.addColorStop(0,'rgba(140,160,175,0)'); g.addColorStop(1,'rgba(140,160,175,1)');
    ctx.fillStyle=g; ctx.fillRect(p.x-R*1.8,p.y-R*1.8,R*3.6,R*3.6);
    ctx.restore();
    if(M.lights) for(const L of M.lights){ ctx.save(); ctx.globalCompositeOperation='lighter';
      ctx.globalAlpha=0.85; ctx.fillStyle='#bfe6ff';
      ctx.beginPath(); ctx.arc(L.x,L.y,4.5,0,6.29); ctx.fill(); ctx.restore(); } } });

// ===================================================================================
// 2  THE BOG HORROR — SINKING MIRE.  The floor floods; dry ground runs out.
// ===================================================================================
_F('ow2',{ phases:[0.62,0.30], anchor:[false,false,true],
  titles:['','THE WATER RISES','NOTHING DRY LEFT'],
  tick(e,dt,ph,eng){ mechTickCommon(e,dt); if(!eng) return;
    if(mechEvery(e,'t',5.0-ph*0.8,dt)){ _sig(e,'surge'); safeStart(e,4-ph,{r:TILE*1.2,tele:2.4,dmg:1.4,col:'#8fd48c'}); }
    if(mechEvery(e,'t2',2.2,dt)){ const p=_pxy();
      hazAdd(e,p.x+(Math.random()-0.5)*TILE*2,p.y+(Math.random()-0.5)*TILE*2,
        {r:TILE*1.05,tele:0.9,live:5.5,dmg:0.42,col:'#4a6a3a',inflict:{id:'poison',dur:3}}); }
  },
  trigger(e,ph){ _sig(e,'surge'); safeStart(e,4-ph,{r:TILE*1.2,tele:2.0,dmg:1.5,col:'#8fd48c'}); },
  draw(e){ mechDrawCommon(e); } });

// Dungeon: the mire does not recede. It rises for good, and the safe ground is islands that SINK
// one at a time while you stand on them.
_F('dn2',{ phases:[0.72,0.45,0.18], anchor:[false,false,false,true],
  titles:['','THE WATER RISES','THE ISLANDS GO','DROWNED'],
  tick(e,dt,ph,eng){ const M=mkState(e); mechTickCommon(e,dt); if(!eng) return;
    const P=bossPace(e);
    if(!M.isles) M.isles=[];
    if(M.ph!==ph){ M.ph=ph; M.isles.length=0;
      const n=Math.max(2,5-ph);
      for(let i=0;i<n;i++){ const a=(i/n)*6.283+0.4, d=TILE*(2.4+Math.random()*1.4);
        M.isles.push({x:e.x+Math.cos(a)*d,y:e.y+Math.sin(a)*d,r:TILE*1.25,life:99}); }
      if(typeof msg==='function') msg('THE ISLANDS SINK','stay off the water'); }
    // whichever island you are standing on begins to go under
    const p=_pxy();
    let on=null;
    for(const s of M.isles) if(Math.hypot(p.x-s.x,p.y-s.y)<s.r){ on=s; break; }
    if(on){ on.life-=dt*(0.9*P.speed); on.r=Math.max(TILE*0.35,on.r-dt*4.5*P.speed);
      if(on.life<=0){ M.isles.splice(M.isles.indexOf(on),1); } }
    else { M.wet=(M.wet||0)+dt;
      if(M.wet>0.5){ M.wet=0; _hurt(mechDmg(e,0.30));
        if(typeof playerStatus==='function') playerStatus('chill',1.4,0); } }
    // THE LAST PHASE NEEDED THIS MOST. `ph<3` excluded phase 3 -- and the islands sink BECAUSE
    // you stand on them, so once the last one went the else branch above ticked mechDmg(0.30)
    // plus chill every 0.5s forever, while the boss was anchor-immune 9s out of every 16.5s.
    // That is not a hard phase, it is a coin flip on whether your DPS beats an undodgeable
    // drain. One island in the final phase keeps it brutal and keeps it a fight.
    if(M.isles.length===0){
      const n=Math.max(1,5-ph);
      for(let i=0;i<n;i++){ const a=Math.random()*6.283, d=TILE*(2.2+Math.random()*1.6);
        M.isles.push({x:e.x+Math.cos(a)*d,y:e.y+Math.sin(a)*d,r:TILE*1.25,life:99}); } }
    if(mechEvery(e,'t',2.6,dt)){ _sig(e,'surge');
      const a=Math.atan2(p.y-e.y,p.x-e.x);
      if(typeof eFire==='function') for(let i=-2;i<=2;i++) eFire(e,a+i*0.18,215*P.speed); }
  },
  trigger(e,ph){ _sig(e,'phase'); },
  draw(e){ mechDrawCommon(e);
    const M=e.mk; if(!M) return;
    arenaWash(e,'rgba(30,60,64,1)',0.30);
    if(M.isles) for(const s of M.isles){ ctx.save();
      ctx.fillStyle='rgba(96,110,70,0.9)';
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,6.29); ctx.fill();
      ctx.strokeStyle='rgba(150,170,110,0.8)'; ctx.lineWidth=2; ctx.stroke(); ctx.restore(); } } });

// ===================================================================================
// 3  STONEFIST — PILLARS & SLAM.  It plants and hammers; get behind something.
// ===================================================================================
_F('ow3',{ phases:[0.66,0.33], anchor:[false,true,true],
  titles:['','IT PLANTS ITS FEET','THE VAULT COMES DOWN'],
  tick(e,dt,ph,eng){ const M=mkState(e); mechTickCommon(e,dt); if(!eng) return;
    const P=bossPace(e);
    if(!M.pillars) M.pillars=[];
    if(M.ph!==ph){ M.ph=ph;
      M.pillars.length=0;
      const n=Math.max(2,4-ph+1);
      for(let i=0;i<n;i++){ const a=(i/n)*6.283+0.7, d=TILE*2.9;
        M.pillars.push({x:e.x+Math.cos(a)*d,y:e.y+Math.sin(a)*d,hp:2}); }
      if(ph>=1 && typeof msg==='function') msg('GET BEHIND A PILLAR','the slam does not bend'); }
    if(mechEvery(e,'t',3.6,dt)){
      _sig(e,'slam'); M.slam=0.65*P.tele;
    }
    if(M.slam>0){ M.slam-=dt;
      if(M.slam<=0){
        // a shockwave that a standing pillar BLOCKS: the pillar between you and it is your cover
        const p=_pxy();
        let covered=false;
        for(const q of M.pillars){ if(q.hp<=0) continue;
          const ax=q.x-e.x, ay=q.y-e.y, bx=p.x-e.x, by=p.y-e.y;
          const la=Math.hypot(ax,ay)||1, lb=Math.hypot(bx,by)||1;
          const cos=(ax*bx+ay*by)/(la*lb);
          if(cos>0.955 && la<lb+TILE) covered=true; }
        // THE RING IS THE PROMISE. There was no distance test here at all, so the slam hit from
        // anywhere on the map while both the draw and the fx ring depicted a 7-tile shockwave --
        // unavoidable damage from outside the only tell the fight gives you.
        const _d=Math.hypot(p.x-e.x,p.y-e.y);
        if(_d>TILE*7){ /* outside the shockwave entirely */ }
        else if(!covered){ _hurt(mechDmg(e,1.15)); if(typeof addShake==='function') addShake(14); }
        else if(typeof msg==='function') msg('BLOCKED','');
        // each slam shatters one pillar, so cover runs out
        const alive=M.pillars.filter(q=>q.hp>0);
        if(alive.length) alive[Math.floor(Math.random()*alive.length)].hp--;
        if(typeof fx!=='undefined') fx.push({t:'ring',x:e.x,y:e.y,r:TILE*7,life:0.45,col:'#c9b08a'});
      } }
  },
  trigger(e,ph){ _sig(e,'slam'); },
  draw(e){ mechDrawCommon(e);
    const M=e.mk; if(!M||!M.pillars) return;
    for(const q of M.pillars){ if(q.hp<=0) continue;
      ctx.save(); ctx.fillStyle=q.hp>1?'#8a8074':'#6a6058';
      ctx.fillRect(q.x-11,q.y-26,22,32);
      ctx.fillStyle='rgba(0,0,0,.3)'; ctx.fillRect(q.x-11,q.y-26,22,4);
      ctx.restore(); }
    if(M.slam>0){ ctx.save(); ctx.globalAlpha=0.4+0.4*Math.sin(performance.now()/40);
      ctx.strokeStyle='#ffd07a'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(e.x,e.y,TILE*7,0,6.29); ctx.stroke(); ctx.restore(); } } });

// Dungeon: same slam, same cover — but the pillars are FALLING now, dropped from above on a
// telegraph, and one can crush you as easily as shield you.
_F('dn3',{ phases:[0.70,0.42,0.16], anchor:[false,true,true,true],
  titles:['','IT PLANTS ITS FEET','THE ROOF COMES DOWN','NOTHING LEFT STANDING'],
  tick(e,dt,ph,eng){ const M=mkState(e); mechTickCommon(e,dt); if(!eng) return;
    const P=bossPace(e);
    if(!M.pillars) M.pillars=[];
    if(mechEvery(e,'t2',2.9,dt)){
      // a pillar falls: telegraphed, damaging where it lands, standing afterwards as cover
      const p=_pxy(), a=Math.random()*6.283, d=TILE*(1.4+Math.random()*2.4);
      const x=p.x+Math.cos(a)*d, y=p.y+Math.sin(a)*d;
      const h=hazAdd(e,x,y,{r:TILE*0.95,tele:1.25,live:0.35,dmg:1.1,col:'#c9b08a'});
      h.dropPillar=true;
    }
    // a hazard that just expired and was a falling pillar becomes cover
    for(let i=M.haz.length-1;i>=0;i--){ const h=M.haz[i];
      if(h.dropPillar && h.ph==='live' && h.t<=dt){ M.pillars.push({x:h.x,y:h.y,hp:2}); } }
    if(M.pillars.length>7) M.pillars.shift();
    if(mechEvery(e,'t',3.1,dt)){ _sig(e,'slam'); M.slam=0.55*P.tele; }
    if(M.slam>0){ M.slam-=dt;
      if(M.slam<=0){ const p=_pxy();
        let covered=false;
        for(const q of M.pillars){ if(q.hp<=0) continue;
          const ax=q.x-e.x, ay=q.y-e.y, bx=p.x-e.x, by=p.y-e.y;
          const la=Math.hypot(ax,ay)||1, lb=Math.hypot(bx,by)||1;
          if((ax*bx+ay*by)/(la*lb)>0.955 && la<lb+TILE) covered=true; }
        // same missing range test as ow3; the fx ring below promises 7.5 tiles
        const _d=Math.hypot(p.x-e.x,p.y-e.y);
        if(_d<=TILE*7.5 && !covered){ _hurt(mechDmg(e,1.25)); if(typeof addShake==='function') addShake(15); }
        const alive=M.pillars.filter(q=>q.hp>0);
        if(alive.length) alive[Math.floor(Math.random()*alive.length)].hp--;
        if(typeof fx!=='undefined') fx.push({t:'ring',x:e.x,y:e.y,r:TILE*7.5,life:0.45,col:'#c9b08a'}); } }
  },
  trigger(e,ph){ _sig(e,'phase'); },
  draw(e){ mechDrawCommon(e);
    const M=e.mk; if(!M) return;
    if(M.pillars) for(const q of M.pillars){ if(q.hp<=0) continue;
      ctx.save(); ctx.fillStyle=q.hp>1?'#8a8074':'#6a6058';
      ctx.fillRect(q.x-11,q.y-28,22,34);
      ctx.fillStyle='rgba(0,0,0,.3)'; ctx.fillRect(q.x-11,q.y-28,22,4); ctx.restore(); }
    if(M.slam>0){ ctx.save(); ctx.globalAlpha=0.4+0.4*Math.sin(performance.now()/40);
      ctx.strokeStyle='#ffd07a'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(e.x,e.y,TILE*7.5,0,6.29); ctx.stroke(); ctx.restore(); } } });

// ===================================================================================
// 4  THE CRAG GARGOYLE — UPDRAFT.  The wind pushes; it perches and dives the line.
// ===================================================================================
_F('ow4',{ phases:[0.60,0.28], anchor:[false,true,false],
  titles:['','IT TAKES THE RIM','THE WIND TURNS'],
  tick(e,dt,ph,eng){ const M=mkState(e); mechTickCommon(e,dt); if(!eng){ M.gust=0; return; }
    const P=bossPace(e);
    if(mechEvery(e,'t',4.4,dt)){ M.gustA=Math.random()*6.283; M.gust=2.2; _sig(e,'wind'); }
    if(M.gust>0){ M.gust-=dt;
      // a real shove on the player, not a slow. You fight the drift while dodging.
      const pl=(typeof player!=='undefined')?player:null;
      if(pl && typeof moveCircle==='function'){
        const s=92*P.speed*dt;
        moveCircle(pl,Math.cos(M.gustA)*s,Math.sin(M.gustA)*s);
      } }
    if(ph>=1 && mechEvery(e,'t2',3.0,dt)){ _sig(e,'dive');
      const p=_pxy(), a=Math.atan2(p.y-e.y,p.x-e.x);
      hazAdd(e,p.x,p.y,{r:TILE*1.3,tele:0.85,live:0.3,dmg:1.0,col:'#a8b8c8'});
      if(typeof eFire==='function') for(let i=-1;i<=1;i++) eFire(e,a+i*0.2,250*P.speed); }
  },
  trigger(e,ph){ _sig(e,'dive'); },
  draw(e){ mechDrawCommon(e);
    const M=e.mk; if(!M||!(M.gust>0)) return;
    // streaks showing which way the wind is going
    ctx.save(); ctx.globalAlpha=0.3; ctx.strokeStyle='#cfe0f0'; ctx.lineWidth=2;
    const t=performance.now()/220;
    for(let i=0;i<14;i++){ const o=((t+i*0.7)%1);
      const bx=e.x+Math.cos(M.gustA+1.57)*(i-7)*26, by=e.y+Math.sin(M.gustA+1.57)*(i-7)*26;
      const sx=bx+Math.cos(M.gustA)*(o*260-130), sy=by+Math.sin(M.gustA)*(o*260-130);
      ctx.beginPath(); ctx.moveTo(sx,sy);
      ctx.lineTo(sx+Math.cos(M.gustA)*22,sy+Math.sin(M.gustA)*22); ctx.stroke(); }
    ctx.restore(); } });

// Dungeon: the wind is a permanent spiral around the roost, and it does not dive — it drops
// stones from the updraft while you are being dragged.
_F('dn4',{ phases:[0.72,0.44,0.18], anchor:[false,true,true,true],
  titles:['','THE ROOST TURNS','STONEFALL','THE EYE'],
  tick(e,dt,ph,eng){ const M=mkState(e); mechTickCommon(e,dt); if(!eng) return;
    const P=bossPace(e);
    // a constant CYCLONE: you are pulled around the boss rather than shoved in a line
    const pl=(typeof player!=='undefined')?player:null;
    if(pl && typeof moveCircle==='function'){
      const dx=pl.x-e.x, dy=pl.y-e.y, d=Math.hypot(dx,dy)||1;
      const tang=(1.0+ph*0.35)*46*P.speed*dt, pull=(18+ph*10)*P.speed*dt;
      moveCircle(pl, (-dy/d)*tang - (dx/d)*pull*0.15, (dx/d)*tang - (dy/d)*pull*0.15);
    }
    // STONEFALL. One rock every 1.9s, scattered up to 3.2 tiles from where you stood a second
    // ago, was the fight's ONLY damage -- and a moving player is never in it: phases 0 and 1 of a
    // Lv55 dungeon boss measured literally zero damage per second across ten seconds. It falls
    // faster and tighter each phase now, and the cyclone's EYE is a real place you cannot stand.
    if(mechEvery(e,'t',1.9-ph*0.28,dt)){
      const n=2+ph, p=_pxy();
      for(let i=0;i<n;i++){ const a=Math.random()*6.283, dd=TILE*(0.4+Math.random()*(2.0-ph*0.25));
        hazAdd(e,p.x+Math.cos(a)*dd,p.y+Math.sin(a)*dd,
          {r:TILE*0.95,tele:1.0-ph*0.12,live:0.35,dmg:0.85,col:'#a8b8c8'}); } }
    // the eye: the cyclone drags you in, and the middle of it is where the stone comes from
    if(pl){ const dEye=Math.hypot(pl.x-e.x,pl.y-e.y);
      M.eye=(M.eye||0)+dt;
      if(dEye<TILE*1.9 && M.eye>0.6){ M.eye=0; _hurt(mechDmg(e,0.30+ph*0.06)); } }
    // and it answers back: a spiral of feathers so the fight has pressure between rockfalls
    if(ph>=1 && mechEvery(e,'t2',2.4-ph*0.3,dt)){ _sig(e,'wind');
      if(typeof eFire==='function'){ const n2=5+ph*2;
        for(let i=0;i<n2;i++) eFire(e,(i/n2)*6.283+e.ang,215*P.speed); } }
  },
  trigger(e,ph){ _sig(e,'phase'); },
  draw(e){ mechDrawCommon(e);
    ctx.save(); ctx.globalAlpha=0.14; ctx.strokeStyle='#cfe0f0'; ctx.lineWidth=2;
    const t=performance.now()/900;
    for(let k=0;k<4;k++){ ctx.beginPath();
      for(let i=0;i<40;i++){ const a=t+k*1.57+i*0.16, r=40+i*7;
        const x=e.x+Math.cos(a)*r, y=e.y+Math.sin(a)*r;
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
      ctx.stroke(); }
    ctx.restore(); } });

// ===================================================================================
// 5  MAGMAW — DEVOUR.  It is under the floor more than on it.
// ===================================================================================
_F('ow5',{ phases:[0.64,0.32],
  titles:['','IT GOES UNDER','THE FLOOR IS GONE'],
  tick(e,dt,ph,eng){ const M=mkState(e); mechTickCommon(e,dt); if(!eng) return;
    const P=bossPace(e);
    if(M.under>0){ M.under-=dt; e.hidden=true; e.mechInv=1;
      if(M.under<=0){ // surfaces where it MARKED, which is the whole point of marking
        // This re-centred the blast on the player at the instant it resolved, with tele:0.0 --
        // hazTick flips tele->live on the first frame and damages on the second, so about 16ms
        // of warning. Meanwhile the dashed ring the player was reading sat where they had been
        // standing 1.5s earlier and the draw painted a third mound under their feet: three
        // contradictory tells and an unavoidable hit. It now erupts AT the marked spot, which
        // is what the ring promised, and dn5:439 already does it this way with tele:0.45.
        const at=M.mark||_pxy();
        e.x=at.x; e.y=at.y; e.hidden=false; e.mechInv=0;
        _sig(e,'erupt');
        hazAdd(e,e.x,e.y,{r:TILE*1.6,tele:0.30*P.tele,live:0.5,dmg:1.15,col:'#ff7a3a'});
        if(typeof addShake==='function') addShake(12);
        if(typeof eFire==='function') for(let i=0;i<10+ph*4;i++) eFire(e,(i/(10+ph*4))*6.283,205*P.speed); }
      return; }
    if(mechEvery(e,'t',5.2-ph*0.7,dt)){ _sig(e,'burrow'); M.under=1.5*P.tele;
      const p=_pxy();
      M.mark={x:p.x,y:p.y};                       // remembered, so the eruption honours the tell
      hazAdd(e,p.x,p.y,{r:TILE*1.6,tele:M.under,live:0.01,dmg:0,col:'#ff7a3a'}); }
    // it leaves scars where it travels
    if(mechEvery(e,'t2',2.4,dt)){
      hazAdd(e,e.x,e.y,{r:TILE*0.95,tele:0.5,live:7,dmg:0.38,col:'#c2452a',inflict:{id:'burn',dur:3}}); }
  },
  trigger(e,ph){ _sig(e,'erupt'); },
  draw(e){ mechDrawCommon(e);
    const M=e.mk; if(M&&M.under>0){ // a moving mound shows roughly where it is
      const p=(typeof player!=='undefined')?player:{x:e.x,y:e.y};
      ctx.save(); ctx.globalAlpha=0.5; ctx.fillStyle='#7a3a1a';
      ctx.beginPath(); ctx.ellipse(p.x,p.y+6,20,10,0,0,6.29); ctx.fill(); ctx.restore(); } } });

const DN5_UNDER=5.0;   // seconds burrowing, untouchable, eating the floor
const DN5_UP   =3.2;   // seconds surfaced -- your whole damage window until the last phase
// Dungeon: it stays under for most of the cycle, surfacing in short punish windows, and only
// comes up FOR GOOD once the arena is nearly gone. The fight is against the SCARS -- the floor it
// has already eaten -- as much as against the thing eating it.
_F('dn5',{ phases:[0.75,0.50,0.25], anchor:[false,false,false,true],
  titles:['','IT EATS THE FLOOR','LESS GROUND','IT SURFACES'],
  tick(e,dt,ph,eng){ const M=mkState(e); mechTickCommon(e,dt); if(!eng) return;
    const P=bossPace(e);
    const last=(ph>=3);
    // IT HAS TO COME UP. The first draft read "it never fully surfaces until the arena is nearly
    // gone" and implemented that literally: mechInv was pinned on for phases 0-2, and the only way
    // OUT of those phases is HP the player was forbidden from taking. The Bog Horror could not be
    // killed, started, or even scratched. It stays a burrowing fight -- it is just under for most
    // of the cycle and up for a short punish window, the exact inverse of its overworld form, which
    // is up for most of the cycle and under for a moment.
    if(!last){
      // it hunts harder every phase: shorter time under, longer surfaced, faster tunnelling
      if(M.up===undefined){ M.up=0; M.dive=DN5_UNDER*P.cycle; }
      M.chase=0.55+ph*0.35;
      if(M.up>0){                                    // SURFACED: hittable, and it hurts to stand near
        M.up-=dt; e.hidden=false; e.mechInv=0;
        if(mechEvery(e,'t3',0.85-ph*0.09,dt) && typeof eFire==='function')
          for(let i=0;i<8+ph*3;i++) eFire(e,(i/(8+ph*3))*6.283+e.ang,200*P.speed);
        // surfaced it also THRASHES: standing next to the thing you came to hit should cost you
        M.thrash=(M.thrash||0)+dt;
        if(M.thrash>0.8 && _pdist(e)<TILE*2.4){ M.thrash=0; _hurt(mechDmg(e,0.34+ph*0.07)); }
        if(M.up<=0){ _sig(e,'burrow'); M.dive=(DN5_UNDER-ph*0.8)*P.cycle; e.hidden=true; e.mechInv=1; }
      } else {
        e.hidden=true; e.mechInv=1;
        M.dive-=dt;
        if(M.dive<=0){                               // erupts under you, telegraphed by the mound
          const p=_pxy(); e.x=p.x; e.y=p.y; M.bx=e.x; M.by=e.y;
          M.up=(DN5_UP+ph*0.5)*P.cycle; e.hidden=false; e.mechInv=0;
          _sig(e,'erupt');
          // telegraphed: the mound shows where it is coming up, so the eruption is dodgeable
          hazAdd(e,e.x,e.y,{r:TILE*1.6,tele:0.45,live:0.5,dmg:0.85,col:'#ff7a3a'});
          if(typeof addShake==='function') addShake(12);
          if(typeof msg==='function') msg('IT SURFACES','hit it before it digs back down');
        }
      }
      // it tunnels beneath, opening permanent scars
      const p=_pxy();
      if(e.mechInv){
        M.bx=(M.bx===undefined)?e.x:M.bx+((p.x-M.bx)*Math.min(1,(M.chase||0.55)*dt));
        M.by=(M.by===undefined)?e.y:M.by+((p.y-M.by)*Math.min(1,(M.chase||0.55)*dt));
        e.x=M.bx; e.y=M.by;
      }
      // THE SCARS ARE FLOOR DENIAL, NOT A DAMAGE ENGINE. One every 1.5s living 30 seconds, laid
      // under a mound that FOLLOWS you, stacked to 26 overlapping zones all sitting on the player:
      // six times a level-matched hero's entire health bar per second. They are the fight's memory
      // of where it has been, so they last -- there are just far fewer of them at once, and the
      // one it lays while surfaced is the punish, not the tunnel.
      if(mechEvery(e,'t',2.8-ph*0.45,dt) && mechHazCount(e)<7+ph*2){
        hazAdd(e,e.x,e.y,{r:TILE*1.0,tele:0.7,live:14,dmg:0.30+ph*0.06,col:'#c2452a',inflict:{id:'burn',dur:3}}); }
    } else {
      e.hidden=false; e.mechInv=0;
      if(M.ph!==3){ M.ph=3; _sig(e,'erupt'); e.hidden=false; e.mechInv=0;
        if(typeof msg==='function') msg('IT COMES UP','');
        if(typeof addShake==='function') addShake(16); }
      // Surfaced for good. This used to be the SAFEST phase in the fight -- burrowing stopped, so
      // the scars stopped with it and damage fell to a fifth. It keeps scarring the floor now, it
      // just does it from where it stands instead of from under you.
      if(mechEvery(e,'t',2.2,dt)){ _sig(e,'roar');
        if(typeof eFire==='function') for(let i=0;i<16;i++) eFire(e,(i/16)*6.283+e.ang,215*P.speed); }
      if(mechEvery(e,'t2',2.4,dt) && mechHazCount(e)<9){ const p2=_pxy();
        hazAdd(e,p2.x,p2.y,{r:TILE*1.2,tele:0.8,live:12,dmg:0.34,col:'#c2452a',inflict:{id:'burn',dur:3}}); }
    }
  },
  trigger(e,ph){ _sig(e,'phase'); },
  draw(e){ mechDrawCommon(e);
    const M=e.mk;
    if(M && e.hidden){ ctx.save(); ctx.globalAlpha=0.55; ctx.fillStyle='#7a3a1a';
      ctx.beginPath(); ctx.ellipse(e.x,e.y+6,22,11,0,0,6.29); ctx.fill();
      ctx.globalAlpha=0.3; ctx.fillStyle='#ff7a3a';
      ctx.beginPath(); ctx.ellipse(e.x,e.y+6,12,6,0,0,6.29); ctx.fill(); ctx.restore(); } } });

// ===================================================================================
// 6  THE ASH WRAITH — CINDER ECHO.  Your own shots come back at you.
// ===================================================================================
_F('ow6',{ phases:[0.62,0.30],
  titles:['','IT REMEMBERS','EVERYTHING RETURNS'],
  tick(e,dt,ph,eng){ const M=mkState(e); mechTickCommon(e,dt); if(!eng){ M.echo=null; return; }
    const P=bossPace(e);
    if(!M.echo) M.echo=[];
    // record where YOU were and which way you shot
    M.rec=(M.rec||0)+dt;
    if(M.rec>0.55){ M.rec=0;
      const pl=(typeof player!=='undefined')?player:null;
      if(pl) M.echo.push({x:pl.x,y:pl.y,a:(pl.aim||0),t:(4.0-ph*0.6)*P.tele}); }
    for(let i=M.echo.length-1;i>=0;i--){ const q=M.echo[i]; q.t-=dt;
      if(q.t<=0){ // fired back from where you stood, along where you were facing
        if(typeof eFire==='function'){ const src={x:q.x,y:q.y,bd:e.bd*0.55,
          pcol:e.pcol,pcore:e.pcore,pshape:e.pshape,psize:e.psize};
          const p=_pxy(), a=Math.atan2(p.y-q.y,p.x-q.x);
          for(let k=-1;k<=1;k++) eFire(src,a+k*0.13,225*P.speed); }
        M.echo.splice(i,1); } }
    if(M.echo.length>26) M.echo.shift();
  },
  trigger(e,ph){ _sig(e,'scatter'); },
  draw(e){ mechDrawCommon(e);
    const M=e.mk; if(!M||!M.echo) return;
    for(const q of M.echo){ const k=Math.max(0,Math.min(1,1-q.t/4));
      ctx.save(); ctx.globalAlpha=0.14+0.5*k; ctx.strokeStyle='#c9a0ff'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(q.x,q.y,10+8*k,0,6.29); ctx.stroke(); ctx.restore(); } } });

// Dungeon: it does not echo your shots — it echoes YOU. Afterimages of your own path walk the
// arena and detonate where you stood.
_F('dn6',{ phases:[0.70,0.42,0.16],
  titles:['','IT REMEMBERS','YOUR OWN STEPS','EVERYTHING RETURNS'],
  tick(e,dt,ph,eng){ const M=mkState(e); mechTickCommon(e,dt); if(!eng){ M.ghosts=null; return; }
    const P=bossPace(e);
    if(!M.ghosts) M.ghosts=[];
    M.rec=(M.rec||0)+dt;
    if(M.rec>0.42){ M.rec=0;
      const pl=(typeof player!=='undefined')?player:null;
      if(pl) M.ghosts.push({x:pl.x,y:pl.y,t:(3.2-ph*0.4)*P.tele}); }
    for(let i=M.ghosts.length-1;i>=0;i--){ const q=M.ghosts[i]; q.t-=dt;
      // THE TRAIL HAS TO LAST LONG ENOUGH TO BE WALKED BACK INTO. It lived 0.3s on a 3.2s delay,
      // so the ground you had stood on was clear again before you could ever loop round to it: the
      // fight measured 2-9% of a hero's bar per second at Lv55, one of the softest in the game,
      // and its own title is EVERYTHING RETURNS. The echo lingers now, and lingers longer as the
      // fight goes on, so circling -- the answer to every other fight here -- is what kills you.
      if(q.t<=0){ hazAdd(e,q.x,q.y,{r:TILE*1.05,tele:0.35,live:1.8+ph*0.7,dmg:0.55,col:'#c9a0ff'});
        M.ghosts.splice(i,1); } }
    if(M.ghosts.length>34) M.ghosts.shift();
    if(mechEvery(e,'t',4.0,dt)){ _sig(e,'scatter'); e.mechInv=1; M.gone=0.8*P.tele; }
    if(M.gone>0){ M.gone-=dt; if(M.gone<=0){ e.mechInv=0;
      // A BODY EMBEDDED IN A WALL HAS NO LEGAL MOVE. moveCircle only ACCEPTS a destination whose
      // sample ring is clear, so a blind teleport into masonry freezes the boss there for good --
      // still firing, but the anchor walk, the chase and the tether can never extract it.
      const p=_pxy(), a=Math.random()*6.283, d=TILE*2.6;
      let nx=p.x+Math.cos(a)*d, ny=p.y+Math.sin(a)*d;
      if(typeof safeSpot==='function'){ const sp=safeSpot(curRoom,nx,ny); nx=sp.x; ny=sp.y; }
      e.x=nx; e.y=ny; } }
  },
  trigger(e,ph){ _sig(e,'scatter'); },
  draw(e){ mechDrawCommon(e);
    const M=e.mk; if(!M||!M.ghosts) return;
    for(const q of M.ghosts){ const k=Math.max(0,Math.min(1,1-q.t/3.2));
      ctx.save(); ctx.globalAlpha=0.10+0.42*k; ctx.fillStyle='#c9a0ff';
      ctx.beginPath(); ctx.ellipse(q.x,q.y,7,11,0,0,6.29); ctx.fill(); ctx.restore(); } } });

// ===================================================================================
// 7  THE CINDER DEMON — BRANDS.  It marks you; find a brazier before it resolves.
// ===================================================================================
_F('ow7',{ phases:[0.66,0.33], anchor:[false,true,false],
  titles:['','IT BRANDS YOU','BURN'],
  tick(e,dt,ph,eng){ const M=mkState(e); mechTickCommon(e,dt); if(!eng) return;
    // PLACED ON GROUND YOU CAN REACH. These were dropped on the first engaged tick at whatever
    // spot the boss happened to be chasing you to, with no solid() test and no arena clamp --
    // engage near a wall or the doorway and one to three of the four landed inside masonry.
    // They are the mark's ONLY cleanse and they are created once, so that persisted for the
    // whole fight. mechAdds already calls safeSpot for exactly this reason; this now does too.
    if(!M.braz){ M.braz=[]; const n=4;
      const C=(typeof bossCentre==='function')?bossCentre(e):{x:e.x,y:e.y};
      for(let i=0;i<n;i++){ const a=(i/n)*6.283+0.5, d=TILE*3.4;
        let bx=C.x+Math.cos(a)*d, by=C.y+Math.sin(a)*d;
        if(typeof safeSpot==='function'){ const sp=safeSpot(curRoom,bx,by); bx=sp.x; by=sp.y; }
        M.braz.push({x:bx,y:by,cd:0}); } }
    for(const b of M.braz) if(b.cd>0) b.cd-=dt;
    // standing in a lit brazier circle cleanses the brand and puts that brazier out for a while
    markTick(e,dt,()=>{ const p=_pxy();
      for(const b of M.braz){ if(b.cd>0) continue;
        if(Math.hypot(p.x-b.x,p.y-b.y)<TILE*1.15){ b.cd=6; return true; } }
      return false; });
    if(!M.mark && mechEvery(e,'t',5.6-ph*0.8,dt)){ _sig(e,'brand');
      markSet(e,{dur:5.0,dmg:1.3,col:'#ff6a3d',stacks:1+ph});
      if(typeof msg==='function') msg('BRANDED','reach a brazier'); }
  },
  trigger(e,ph){ _sig(e,'brand'); },
  draw(e){ mechDrawCommon(e);
    const M=e.mk; if(!M||!M.braz) return;
    const t=performance.now()/1000;
    for(const b of M.braz){ const lit=b.cd<=0;
      ctx.save(); ctx.globalAlpha=lit?(0.45+0.2*Math.sin(t*4)):0.12;
      ctx.strokeStyle=lit?'#ffb04a':'#5a5048'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(b.x,b.y,TILE*1.15,0,6.29); ctx.stroke();
      if(lit){ ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=0.25;
        const g=ctx.createRadialGradient(b.x,b.y,2,b.x,b.y,TILE*1.15);
        g.addColorStop(0,'#ffb04a'); g.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(b.x,b.y,TILE*1.15,0,6.29); ctx.fill(); }
      ctx.restore(); } } });

// Dungeon: the braziers are OUT. You cleanse a brand by carrying it to the boss itself and
// standing in its own fire — which is where you least want to be.
_F('dn7',{ phases:[0.72,0.46,0.20], anchor:[false,true,false,true],
  titles:['','IT BRANDS YOU','BRING IT BACK','BURN'],
  tick(e,dt,ph,eng){ const M=mkState(e); mechTickCommon(e,dt); if(!eng) return;
    const P=bossPace(e);
    // cleanse by standing INSIDE its aura -- which also hurts
    markTick(e,dt,()=>{ const p=_pxy();
      if(Math.hypot(p.x-e.x,p.y-e.y)<TILE*1.5){ _hurt(mechDmg(e,0.35)); return true; }
      return false; });
    if(!M.mark && mechEvery(e,'t',4.6,dt)){ _sig(e,'brand');
      markSet(e,{dur:4.4,dmg:1.45,col:'#ff6a3d',stacks:1+ph});
      if(typeof msg==='function') msg('BRANDED','only its own fire will take it'); }
    if(mechEvery(e,'t2',2.7,dt)){ const p=_pxy();
      hazAdd(e,p.x,p.y,{r:TILE*1.15,tele:0.9,live:4.5,dmg:0.45,col:'#c2452a',inflict:{id:'burn',dur:3}}); }
  },
  trigger(e,ph){ _sig(e,'brand'); },
  draw(e){ mechDrawCommon(e);
    // its aura is the only safe place, and it is not safe
    const t=performance.now()/1000;
    ctx.save(); ctx.globalAlpha=0.22+0.10*Math.sin(t*3);
    ctx.strokeStyle='#ffb04a'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(e.x,e.y,TILE*1.5,0,6.29); ctx.stroke(); ctx.restore(); } });

// ===================================================================================
// 8  THE MOLTEN TITAN — CORE MELTDOWN.  The capstone. It never moves; break its conduits.
// ===================================================================================
_F('ow8',{ phases:[0.70,0.45,0.20], anchor:[true,true,true,true],
  titles:['THE CORE SEALS','FIRST CONDUIT','SECOND CONDUIT','MELTDOWN'],
  tick(e,dt,ph,eng){ const M=mkState(e); mechTickCommon(e,dt); if(!eng) return;
    const P=bossPace(e);
    if(M.ph!==ph){ M.ph=ph; mechClearAdds(e,'conduit');
      mechAdds(e,4,'conduit',{node:true,hp:0.45+ph*0.12,dist:TILE*3.6,col:'#ffb04a',scale:false});
      wardRaise(e); _sig(e,'corebreak');
      if(typeof msg==='function') msg('BREAK THE CONDUITS','it cannot be touched until they fall'); }
    e.anchorNoInv=1;                                               // the CONDUITS gate this fight, not the clock
    if(e.wardInv && mechAddsAlive(e,'conduit')===0) wardDrop(e);
    // it never chases; it blankets. Rotating spokes plus a rising heat.
    if(mechEvery(e,'t',1.6,dt)){ _sig(e,'quake');
      if(typeof eFire==='function'){ const n=6+ph*2;
        for(let i=0;i<n;i++) eFire(e,(i/n)*6.283+e.ang,200*P.speed); } }
    if(mechEvery(e,'t2',3.2,dt)){ const p=_pxy();
      hazAdd(e,p.x,p.y,{r:TILE*1.3,tele:1.1,live:5,dmg:0.5,col:'#ff7a3a',inflict:{id:'burn',dur:3}}); }
  },
  trigger(e,ph){ _sig(e,'corebreak'); },
  draw(e){ mechDrawCommon(e);
    // heat haze rising off the arena, heavier each phase
    arenaWash(e,'rgba(180,60,20,1)',0.05+0.04*(e.phase||0)); } });

// Dungeon: the conduits are gone. The core is EXPOSED but it is venting — the whole arena is a
// closing ring of fire, and the only safe ground is the shrinking circle at its feet.
_F('dn8',{ phases:[0.78,0.55,0.32,0.12], anchor:[true,true,true,true,true],
  titles:['THE CORE OPENS','VENTING','THE RING CLOSES','ALL OF IT','NOTHING LEFT'],
  tick(e,dt,ph,eng){ const M=mkState(e); mechTickCommon(e,dt); if(!eng) return;
    const P=bossPace(e);
    // exposed by design: it can always be HURT, it just cannot be reached safely. It declares
    // anchor so it stays planted at the core, and never claims immunity from the anchor clock.
    e.anchorNoInv=1;
    // a ring of fire closes from the arena edge toward the boss, then resets
    // ESCALATE THE PUNISHMENT, NOT JUST THE SPEED. A faster ring spends LESS time small, so
    // raising only the closing speed made every later phase SAFER: 32%/s of a hero's bar in the
    // first phase down to 9%/s in the last, with the final phase the most survivable in the fight.
    // The ring now closes TIGHTER and burns HARDER and MORE OFTEN each phase, which is what the
    // titles have been promising all along.
    if(M.ring2===undefined) M.ring2=TILE*9;
    // FLOOR IT AT SOMETHING YOU CAN STAND IN. At phase 4 this was TILE*0.72 = 32px -- smaller
    // than the boss's own radius (~50px at Lv50) and barely twice the player's, so "safe ground"
    // meant standing exactly on top of it. The burn interval is simultaneously 0.17s at
    // mechDmg(1.09), which the 26% cap turns into a quarter of your bar every sixth of a second.
    // The squeeze is the mechanic; being physically unable to occupy the safe zone is not.
    const minR=Math.max(TILE*1.15, TILE*(1.6-ph*0.22)) + (e.r||0);
    M.ring2-=dt*(16+ph*4)*P.speed;
    if(M.ring2<minR){ M.ring2=TILE*9; _sig(e,'roar');
      if(typeof addShake==='function') addShake(12); }
    const p=_pxy(), d=Math.hypot(p.x-e.x,p.y-e.y);
    M.burn=(M.burn||0)+dt;
    if(d>M.ring2 && M.burn>(0.45-ph*0.07)){ M.burn=0; _hurt(mechDmg(e,0.45+ph*0.16));
      if(typeof playerStatus==='function') playerStatus('burn',2.5,0); }
    if(mechEvery(e,'t',1.4,dt)){
      if(typeof eFire==='function'){ const n=8+ph*2;
        for(let i=0;i<n;i++) eFire(e,(i/n)*6.283+e.ang,210*P.speed); } }
  },
  trigger(e,ph){ _sig(e,'corebreak'); },
  draw(e){ mechDrawCommon(e);
    const M=e.mk; if(!M) return;
    arenaWash(e,'rgba(200,60,15,1)',0.10+0.04*(e.phase||0));
    if(M.ring2){ ctx.save(); ctx.globalAlpha=0.75; ctx.strokeStyle='#ff8a3d'; ctx.lineWidth=5;
      ctx.beginPath(); ctx.arc(e.x,e.y,M.ring2,0,6.29); ctx.stroke();
      ctx.globalAlpha=0.16; ctx.lineWidth=22; ctx.stroke(); ctx.restore(); } } });

// ===================================================================================
// 9  THE TIDEWRACK — TIDE.  Lv4. One rhythm, taught slowly.
// ===================================================================================
_F('ow9',{ phases:[0.50], titles:['','THE TIDE TURNS'],
  tick(e,dt,ph,eng){ const M=mkState(e); mechTickCommon(e,dt); if(!eng) return;
    const P=bossPace(e);
    // a slow in-and-out. High tide: the outer ring floods. Low tide: it is exposed and slow.
    M.tide=(M.tide||0)+dt*(0.42+ph*0.14)*P.speed;
    const high=Math.sin(M.tide)>0.25;
    e.wardInv=high?1:0;                                     // only vulnerable at low tide
    if(high){
      const p=_pxy(), d=Math.hypot(p.x-e.x,p.y-e.y);
      M.wet=(M.wet||0)+dt;
      if(d>TILE*3.2 && M.wet>0.6){ M.wet=0; _hurt(mechDmg(e,0.38));
        if(typeof playerStatus==='function') playerStatus('chill',1.6,0); }
      if(mechEvery(e,'t',2.4,dt)){ _sig(e,'sweep');
        const a=Math.atan2(p.y-e.y,p.x-e.x);
        if(typeof eFire==='function') for(let i=-1;i<=1;i++) eFire(e,a+i*0.22,190*P.speed); }
    } else if(mechEvery(e,'t',3.0,dt)) _sig(e,'wind');
  },
  trigger(e,ph){ _sig(e,'sweep'); if(typeof msg==='function') msg('THE TIDE TURNS','strike it when the water pulls back'); },
  draw(e){ mechDrawCommon(e);
    const M=e.mk; if(!M) return;
    const high=Math.sin(M.tide||0)>0.25;
    if(high){ ctx.save(); ctx.globalAlpha=0.24; ctx.fillStyle='#2f6f8f';
      const A=(typeof bossArenaOf==='function')?bossArenaOf(e):null;
      if(A) ctx.fillRect(A.x0,A.y0,A.x1-A.x0,A.y1-A.y0);
      ctx.globalCompositeOperation='destination-out';
      ctx.beginPath(); ctx.arc(e.x,e.y,TILE*3.2,0,6.29); ctx.fill();
      ctx.restore();
      ctx.save(); ctx.globalAlpha=0.6; ctx.strokeStyle='#8fd6e8'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(e.x,e.y,TILE*3.2,0,6.29); ctx.stroke(); ctx.restore(); } } });

// Dungeon (THE BRINE MOTHER): the same tide, but the dry ring MOVES — it is wherever she is not,
// and she walks. You are chasing dry ground around the room.
_F('dn9',{ phases:[0.62,0.30], titles:['','THE TIDE TURNS','NOWHERE DRY'],
  tick(e,dt,ph,eng){ const M=mkState(e); mechTickCommon(e,dt); if(!eng) return;
    const P=bossPace(e);
    M.tide=(M.tide||0)+dt*(0.5+ph*0.16)*P.speed;
    const high=Math.sin(M.tide)>0.05;
    e.wardInv=high?1:0;
    // the dry patch sits OPPOSITE her, at a fixed remove -- so it swings as she moves
    const c=(typeof bossCentre==='function')?bossCentre(e):{x:e.x,y:e.y};
    const ax=e.x-c.x, ay=e.y-c.y, al=Math.hypot(ax,ay)||1;
    M.dx=c.x-(ax/al)*TILE*3.0; M.dy=c.y-(ay/al)*TILE*3.0;
    if(high){
      const p=_pxy();
      M.wet=(M.wet||0)+dt;
      if(Math.hypot(p.x-M.dx,p.y-M.dy)>TILE*1.9 && M.wet>0.5){ M.wet=0; _hurt(mechDmg(e,0.42));
        if(typeof playerStatus==='function') playerStatus('chill',1.8,0); }
      if(mechEvery(e,'t',2.0,dt)){ _sig(e,'sweep');
        const a=Math.atan2(p.y-e.y,p.x-e.x);
        if(typeof eFire==='function') for(let i=-2;i<=2;i++) eFire(e,a+i*0.19,200*P.speed); } }
  },
  trigger(e,ph){ _sig(e,'sweep'); },
  draw(e){ mechDrawCommon(e);
    const M=e.mk; if(!M) return;
    const high=Math.sin(M.tide||0)>0.05;
    if(high && M.dx!==undefined){ ctx.save(); ctx.globalAlpha=0.26; ctx.fillStyle='#2f6f8f';
      const A=(typeof bossArenaOf==='function')?bossArenaOf(e):null;
      if(A) ctx.fillRect(A.x0,A.y0,A.x1-A.x0,A.y1-A.y0);
      ctx.globalCompositeOperation='destination-out';
      ctx.beginPath(); ctx.arc(M.dx,M.dy,TILE*1.9,0,6.29); ctx.fill(); ctx.restore();
      ctx.save(); ctx.globalAlpha=0.7; ctx.strokeStyle='#8fd6e8'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(M.dx,M.dy,TILE*1.9,0,6.29); ctx.stroke(); ctx.restore(); } } });

// ===================================================================================
// 10  THE GULLWIND HARRIER — LIGHTHOUSE BEAM.  A sweep you walk around.
// ===================================================================================
_F('ow10',{ phases:[0.55,0.25], anchor:[false,true,true],
  titles:['','IT TAKES THE LAMP','TWO LIGHTS'],
  tick(e,dt,ph,eng){ const M=mkState(e); mechTickCommon(e,dt); if(!eng) return;
    if(ph>=1 && !M.beam){ beamStart(e,{w:0.40,spin:0.62,len:TILE*12,dmg:0.42,life:9999,col:'#ffe6a0'}); }
    if(ph<1 && M.beam) M.beam=null;
    if(mechEvery(e,'t',3.6,dt)){ _sig(e,'stoop');
      const p=_pxy();
      hazAdd(e,p.x,p.y,{r:TILE*1.25,tele:0.9,live:0.3,dmg:0.95,col:'#cfe0f0'}); }
  },
  trigger(e,ph){ _sig(e,'stoop'); },
  draw(e){ mechDrawCommon(e); } });

// Dungeon (THE ROOST TYRANT): two beams, counter-rotating, and the safe wedge between them is
// the only place to stand.
_F('dn10',{ phases:[0.66,0.38,0.14], anchor:[true,true,true,true],
  titles:['THE LAMP TURNS','TWO LIGHTS','FASTER','NO GAP'],
  tick(e,dt,ph,eng){ const M=mkState(e); mechTickCommon(e,dt); if(!eng) return;
    const P=bossPace(e);
    if(!M.beams) M.beams=[{a:0,s:0.55},{a:Math.PI,s:-0.72}];
    if(M.ph!==ph){ M.ph=ph;
      for(const b of M.beams) b.s*= (1+0.22*ph);
      if(ph>=2 && M.beams.length<3) M.beams.push({a:1.9,s:0.44}); }
    const p=_pxy(), dx=p.x-e.x, dy=p.y-e.y, d=Math.hypot(dx,dy);
    const pa=Math.atan2(dy,dx);
    M.hit=(M.hit||0)-dt;
    for(const b of M.beams){ b.a+=b.s*dt*P.speed;
      if(d>TILE*12) continue;
      let a=pa-b.a; while(a>Math.PI) a-=6.283; while(a<-Math.PI) a+=6.283;
      if(Math.abs(a)<0.21 && M.hit<=0){ M.hit=0.5; _hurt(mechDmg(e,0.45)); } }
    if(mechEvery(e,'t',2.6,dt)){ _sig(e,'stoop');
      if(typeof eFire==='function') for(let i=0;i<6;i++) eFire(e,(i/6)*6.283+e.ang,205*P.speed); }
  },
  trigger(e,ph){ _sig(e,'phase'); },
  draw(e){ mechDrawCommon(e);
    const M=e.mk; if(!M||!M.beams) return;
    for(const b of M.beams){ ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=0.42;
      const g=ctx.createRadialGradient(e.x,e.y,4,e.x,e.y,TILE*12);
      g.addColorStop(0,'#ffe6a0cc'); g.addColorStop(1,'#ffe6a000');
      ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(e.x,e.y);
      ctx.arc(e.x,e.y,TILE*12,b.a-0.21,b.a+0.21); ctx.closePath(); ctx.fill(); ctx.restore(); } } });

// ===================================================================================
// 11  THE SAWGRASS REAPER — HARVEST.  Every swing leaves standing grass.
// ===================================================================================
_F('ow11',{ phases:[0.58,0.26],
  titles:['','THE REAPING','THE FIELD IS FULL'],
  tick(e,dt,ph,eng){ const M=mkState(e); mechTickCommon(e,dt); if(!eng) return;
    const P=bossPace(e);
    if(M.swing>0){ M.swing-=dt;
      if(M.swing<=0){ // a wide arc, and the ground it cuts grows back as sawgrass
        const p=_pxy(), a=Math.atan2(p.y-e.y,p.x-e.x);
        let ang=Math.atan2(p.y-e.y,p.x-e.x)-M.arc/2;
        const d=Math.hypot(p.x-e.x,p.y-e.y);
        let inArc=false;
        let da=a-M.aim; while(da>Math.PI) da-=6.283; while(da<-Math.PI) da+=6.283;
        if(d<TILE*4.2 && Math.abs(da)<M.arc/2) inArc=true;
        if(inArc){ _hurt(mechDmg(e,1.0)); if(typeof addShake==='function') addShake(11); }
        for(let i=0;i<5+ph*2;i++){ const t=(i/(4+ph*2))-0.5;
          const aa=M.aim+t*M.arc, rr=TILE*(2.0+Math.random()*1.8);
          hazAdd(e,e.x+Math.cos(aa)*rr,e.y+Math.sin(aa)*rr,
            {r:TILE*0.8,tele:0.4,live:9,dmg:0.32,col:'#8a9a4a',inflict:{id:'bleed',dur:3}}); }
      } }
    else if(mechEvery(e,'t',3.4,dt)){ _sig(e,'reap');
      const p=_pxy(); M.aim=Math.atan2(p.y-e.y,p.x-e.x); M.arc=1.5+ph*0.35;
      M.swing=0.55*P.tele; }
  },
  trigger(e,ph){ _sig(e,'reap'); },
  draw(e){ mechDrawCommon(e);
    const M=e.mk; if(!M||!(M.swing>0)) return;
    ctx.save(); ctx.globalAlpha=0.30+0.25*Math.sin(performance.now()/45);
    ctx.fillStyle='#d8e08a';
    ctx.beginPath(); ctx.moveTo(e.x,e.y);
    ctx.arc(e.x,e.y,TILE*4.2,M.aim-M.arc/2,M.aim+M.arc/2); ctx.closePath(); ctx.fill();
    ctx.restore(); } });

// Dungeon (THE CLOISTER REAPER): it reaps the whole circle, and the sawgrass it leaves is a maze
// that only opens where it last swung.
_F('dn11',{ phases:[0.70,0.42,0.16], anchor:[false,false,true,true],
  titles:['','THE REAPING','THE CLOISTER FILLS','NO ROOM TO STAND'],
  tick(e,dt,ph,eng){ const M=mkState(e); mechTickCommon(e,dt); if(!eng) return;
    const P=bossPace(e);
    if(M.swing>0){ M.swing-=dt;
      if(M.swing<=0){
        const p=_pxy(), d=Math.hypot(p.x-e.x,p.y-e.y);
        const a=Math.atan2(p.y-e.y,p.x-e.x);
        let da=a-M.aim; while(da>Math.PI) da-=6.283; while(da<-Math.PI) da+=6.283;
        if(d<TILE*4.6 && Math.abs(da)>M.gap/2){ _hurt(mechDmg(e,1.05)); if(typeof addShake==='function') addShake(12); }
        // grass fills EVERYWHERE except the wedge it just cut
        const n=14+ph*4;
        for(let i=0;i<n;i++){ const aa=(i/n)*6.283;
          let g=aa-M.aim; while(g>Math.PI) g-=6.283; while(g<-Math.PI) g+=6.283;
          if(Math.abs(g)<M.gap/2) continue;
          const rr=TILE*(1.8+Math.random()*2.4);
          hazAdd(e,e.x+Math.cos(aa)*rr,e.y+Math.sin(aa)*rr,
            {r:TILE*0.75,tele:0.4,live:7,dmg:0.34,col:'#8a9a4a',inflict:{id:'bleed',dur:3}}); }
      } }
    else if(mechEvery(e,'t',3.0,dt)){ _sig(e,'reap');
      const p=_pxy(); M.aim=Math.atan2(p.y-e.y,p.x-e.x)+ (Math.random()-0.5)*2.2;
      M.gap=Math.max(0.7,1.6-ph*0.30); M.swing=0.6*P.tele; }
  },
  trigger(e,ph){ _sig(e,'reap'); },
  draw(e){ mechDrawCommon(e);
    const M=e.mk; if(!M||!(M.swing>0)) return;
    // the SAFE wedge is highlighted, because everything else is about to be cut
    ctx.save(); ctx.globalAlpha=0.26+0.2*Math.sin(performance.now()/45);
    ctx.fillStyle='#8fd48c';
    ctx.beginPath(); ctx.moveTo(e.x,e.y);
    ctx.arc(e.x,e.y,TILE*4.6,M.aim-M.gap/2,M.aim+M.gap/2); ctx.closePath(); ctx.fill();
    ctx.restore(); } });

// ===================================================================================
// 12  THE CAIRNWRIGHT — THE TALLY.  It is laying out a row, and you are standing in it.
// Both forms are about a LINE OF STONES that goes off. Outside, the row is a straight furrow
// through the boss aimed at you, and the answer is to step off the line — one read, one move.
// Inside, the Tally Keeper stops aiming and starts COUNTING: it sets the whole row down at once
// and then works along it in the order it cut them, so you are not dodging a line, you are
// staying ahead of a sequence. Same family, one element twisted, one added.
// Only base BOSS_ANIM beats are used here (slam/wind/roar/plant) — a signature beat with no
// duration registered in BOSS_SIG sits frozen at p=0, which is the trap 17f warns about.
// ===================================================================================
_F('ow12',{ phases:[0.62,0.30],
  titles:['','ANOTHER ROW','THE YARD IS FULL'],
  tick(e,dt,ph,eng){ const M=mkState(e); mechTickCommon(e,dt); if(!eng) return;
    const P=bossPace(e);
    if(M.cut>0){ M.cut-=dt;
      if(M.cut<=0){                                  // the row goes down, then goes off
        for(let r=0;r<M.rows.length;r++){ const a=M.rows[r];
          for(let i=-5;i<=5;i++){ if(!i) continue;
            const rr=TILE*0.95*i;
            hazAdd(e, e.x+Math.cos(a)*rr, e.y+Math.sin(a)*rr,
              {r:TILE*0.62,tele:0.34,live:5,dmg:0.42,col:'#b3a894',inflict:{id:'stun',dur:0.5}}); } }
        if(typeof addShake==='function') addShake(9);
        M.rows=[];
      } }
    else if(mechEvery(e,'t',3.2,dt)){ _sig(e,'slam');
      const p=_pxy(), a0=Math.atan2(p.y-e.y,p.x-e.x);
      M.rows=[]; for(let r=0;r<=ph;r++) M.rows.push(a0 + r*(Math.PI/(ph+1)));   // 1 row, then a cross, then a star
      M.cut=0.62*P.tele; }
  },
  trigger(e,ph){ _sig(e,'roar'); },
  draw(e){ mechDrawCommon(e);
    const M=e.mk; if(!M||!(M.cut>0)||!M.rows) return;
    // chalk the row before the stones land — the whole fight is reading this line
    ctx.save(); ctx.globalAlpha=0.34+0.22*Math.sin(performance.now()/50);
    ctx.strokeStyle='#e8dcc0'; ctx.lineWidth=3; ctx.setLineDash([7,6]);
    for(const a of M.rows){ const L=TILE*5.2;
      ctx.beginPath(); ctx.moveTo(e.x-Math.cos(a)*L, e.y-Math.sin(a)*L);
      ctx.lineTo(e.x+Math.cos(a)*L, e.y+Math.sin(a)*L); ctx.stroke(); }
    ctx.restore(); } });

// Dungeon (THE TALLY KEEPER): it sets the whole row down at once and then counts along it. The
// stone it is about to reach is lit, so the fight is legible — but the count does not wait, and
// in the last phase it plants and runs the row twice as fast, which is when the arena gets small.
_F('dn12',{ phases:[0.68,0.40,0.15], anchor:[false,false,false,true],
  titles:['','THE COUNT','TWO TO A ROW','THE TALLY CLOSES'],
  tick(e,dt,ph,eng){ const M=mkState(e); mechTickCommon(e,dt); if(!eng) return;
    const P=bossPace(e);
    if(!M.seq||!M.seq.length){
      if(mechEvery(e,'t',3.6,dt)){ _sig(e,'slam');
        const n=6+ph*2, a0=Math.random()*6.283, rad=TILE*(2.4+Math.random()*1.6);
        M.seq=[]; for(let i=0;i<n;i++){ const a=a0+(i/n)*6.283;
          M.seq.push({x:e.x+Math.cos(a)*rad, y:e.y+Math.sin(a)*rad}); }
        M.si=0; M.step=0; }
      return; }
    M.step-=dt;
    if(M.step<=0){
      const s=M.seq[M.si];
      if(s) hazAdd(e,s.x,s.y,{r:TILE*1.05,tele:0.30,live:4,dmg:0.50,col:'#b3a894',inflict:{id:'stun',dur:0.6}});
      M.si++;
      // the count speeds up as it goes, and the anchored phase runs it at double
      // P.CYCLE, NOT P.TELE. This is "time between events", which is what cycle means; tele is
      // the telegraph dial (17h:29-31 says which is which). With tele AND a 0.5x anchor bonus
      // it hit 0.068s a stone at Lv50 -- all twelve down in 0.8s, which is not a sequence you
      // stay ahead of, it is a simultaneous stun ring. The whole fight's draw is built on
      // "the NEXT one is lit"; below about a fifth of a second that read does not exist.
      M.step=Math.max(0.18, (0.46 - ph*0.06) * P.cycle * (ph>=3?0.7:1));
      if(M.si>=M.seq.length){ M.seq=[]; M.si=0; }
    } },
  trigger(e,ph){ _sig(e, ph>=3?'plant':'roar'); },
  draw(e){ mechDrawCommon(e);
    const M=e.mk; if(!M||!M.seq||!M.seq.length) return;
    ctx.save();
    // every stone still to come, faint; the NEXT one lit — that is the whole read
    for(let i=M.si;i<M.seq.length;i++){ const s=M.seq[i], next=(i===M.si);
      ctx.globalAlpha=next?(0.55+0.3*Math.sin(performance.now()/40)):0.16;
      ctx.fillStyle=next?'#ffe9b0':'#cfc4ad';
      ctx.beginPath(); ctx.arc(s.x,s.y,TILE*(next?0.85:0.55),0,6.283); ctx.fill(); }
    ctx.restore(); } });

// ===================================================================================
// THE ARENA CHAMPION — the 25th. A wave mode's boss should test what the waves taught you, so
// it has no puzzle: it is a pressure check that reads the arena's own escalation.
// ===================================================================================
// ===================================================================================
// THE ARENA CHAMPION -- THE CHALLENGE.  The one fight that punishes you for dodging.
//
// It had no mechanic of its own: a circle under your feet and some adds, which is every other
// fight's opening move and nothing else. A champion in a proving ground should not fight like a
// monster in a field, and the arena is the one place in the game where the fight is a DUEL rather
// than a hunt.
//
// So it inverts the single instinct all twenty-four other fights have trained. It plants, raises
// its guard, and calls you out: a wedge in front of it turns gold, and everything OUTSIDE that
// wedge becomes the dangerous ground. You have to walk INTO its face and be standing there when it
// swings. Meet it and you parry -- it staggers, and that stagger is the only sustained damage
// window the fight gives you. Run, and it hits the whole floor.
//
// Every escalation tightens the same idea rather than adding a second one: the wedge narrows, the
// telegraph shortens, and the miss hurts more.
// ===================================================================================
const ARENA_CHAL_CD = 6.4;    // seconds between challenges
const ARENA_STAGGER = 2.8;    // free damage window a parry buys you
_F('arena',{ phases:[0.60,0.30], titles:['','CHAMPION RISES','LAST STAND'],
  tick(e,dt,ph,eng){ const M=mkState(e); mechTickCommon(e,dt); if(!eng){ M.chal=0; M.stag=0; return; }
    const P=bossPace(e);

    // STAGGERED: it has been parried and is wide open. It does nothing at all -- no challenge, no
    // hazards, no adds -- because a reward you have to keep dodging through is not a reward.
    if(M.stag>0){ M.stag-=dt; e.flash=Math.max(e.flash||0,0.12); return; }

    // the wedge narrows and the window shortens as it goes
    const wedge = (0.62-ph*0.11);              // half-angle, radians
    const tele  = (1.25-ph*0.22)*P.tele;       // how long the gold wedge is up before it swings

    if(M.chal>0){
      M.chal-=dt;
      if(M.chal<=0){
        const p=_pxy(), d=Math.hypot(p.x-e.x,p.y-e.y);
        const a=Math.atan2(p.y-e.y,p.x-e.x);
        let da=Math.abs(((a-M.chalA+Math.PI*3)%(Math.PI*2))-Math.PI);
        const met = (da<=wedge && d<=TILE*4.2);
        if(met){
          // PARRIED. It over-commits and eats the floor.
          M.stag=ARENA_STAGGER*P.cycle;
          _sig(e,'break');
          if(typeof addShake==='function') addShake(10);
          if(typeof msg==='function') msg('PARRIED','it is wide open');
        } else {
          // you ran. The blow lands on everything that is not where you should have been.
          _sig(e,'roar');
          if(typeof addShake==='function') addShake(16);
          _hurt(mechDmg(e,0.55+ph*0.14));
          if(typeof playerStatus==='function') playerStatus('stun',0.35+ph*0.08,0);
          if(typeof eFire==='function'){ const n=10+ph*4;
            for(let i=0;i<n;i++) eFire(e,(i/n)*6.283+e.ang,225*P.speed); }
          if(typeof msg==='function') msg('YOU GAVE GROUND','meet it next time');
        }
      }
    } else if(mechEvery(e,'t',ARENA_CHAL_CD,dt)){
      // commit to a DIRECTION now, not at resolve -- a wedge that tracks you is not a challenge,
      // it is a laser, and you could never fail it or read it
      const p=_pxy();
      M.chalA=Math.atan2(p.y-e.y,p.x-e.x);
      M.chal=tele; M.chalW=wedge;
      _sig(e,'tell');
      if(typeof msg==='function') msg('IT CALLS YOU OUT','stand in the gold');
    }

    // it still fights between challenges, but lightly -- the challenge is the fight
    if(mechEvery(e,'t2',3.2,dt) && M.chal<=0){ const p=_pxy();
      hazAdd(e,p.x,p.y,{r:TILE*1.2,tele:1.0,live:2.5,dmg:0.34,col:'#e2604c'}); }
    if(ph>=1 && mechEvery(e,'t3',7.5,dt)) mechAdds(e,1+ph,'champ',{hp:0.6});
  },
  trigger(e,ph){ _sig(e,'roar'); },
  draw(e){ mechDrawCommon(e);
    const M=e.mk; if(!M) return;
    if(M.stag>0){
      // the open window, drawn so it is unmistakable from across the arena
      const k=0.5+0.5*Math.sin(performance.now()/90);
      ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=0.30+0.25*k;
      ctx.strokeStyle='#ffd07a'; ctx.lineWidth=4;
      ctx.beginPath(); ctx.arc(e.x,e.y,e.r*1.5,0,6.29); ctx.stroke(); ctx.restore();
      return;
    }
    if(M.chal>0){
      const w=M.chalW||0.6, R=TILE*4.2;
      const k=1-Math.max(0,Math.min(1,M.chal/1.3));     // fills as the swing approaches
      ctx.save();
      ctx.globalAlpha=0.16+0.20*k;
      ctx.fillStyle='#ffd07a';
      ctx.beginPath(); ctx.moveTo(e.x,e.y);
      ctx.arc(e.x,e.y,R,M.chalA-w,M.chalA+w); ctx.closePath(); ctx.fill();
      ctx.globalAlpha=0.55+0.35*k; ctx.strokeStyle='#ffe8aa'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(e.x,e.y);
      ctx.arc(e.x,e.y,R,M.chalA-w,M.chalA+w); ctx.closePath(); ctx.stroke();
      ctx.restore();
    } } });
