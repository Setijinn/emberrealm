// PROJECTILE SPEED AUDIT. Drives real shots through the real update loop and measures how far
// they go and how long they take, because the whole risk in PROJ_SCALE is that reach is not a
// number anyone wrote down -- it is speed x life -- and a change that reads as "slower bolts"
// silently becomes "every weapon is shorter ranged" if the two halves get out of step.
//
// The pass condition is deliberately blunt: DISTANCE MUST NOT MOVE, TIME MUST.
//
// Read-only. Run with `py tools/audit.py _projaudit.js`.
(function(){
  const L=[];
  const say=(s)=>L.push(s===undefined?'':s);
  const row=(k,v)=>L.push('  '+String(k).padEnd(34,' ')+' '+v);
  const hd=(s)=>{ L.push(''); L.push('--- '+s+' ---'); };
  function dump(){ const el=document.getElementById('testout');
    if(el) el.textContent=L.join('\n'); document.title='AUDIT DONE'; }
  let pass=0, fail=0;
  function ok(name,cond,detail){ (cond?pass++:fail++);
    L.push('  '+(cond?'PASS':'FAIL')+'  '+name+(detail?('  ['+detail+']'):'')); }

  // fly one projectile through the REAL integration and report what happened to it
  function fly(arr,shot){
    arr.length=0;
    arr.push(shot);
    const x0=shot.x, y0=shot.y;
    let t=0; const dt=1/120;                    // fine step so quantisation is not the finding
    // WATCH THE BOLT, NOT THE ARRAY. Waiting for eShots to empty measured 33.3s for a 3.3s
    // flight -- the loop's own iteration cap -- because thirty seconds of update() spawns fresh
    // enemies that fire fresh bolts into the same array, so it never empties. The distance was
    // right the whole time and only the clock was wrong, which is the more dangerous shape of
    // harness bug: it looks like a real finding.
    for(let i=0;i<4000 && arr.indexOf(shot)>=0;i++){ update(dt); t+=dt; }
    return {dist:Math.hypot((shot.x-x0),(shot.y-y0)), time:t, gone:arr.indexOf(shot)<0};
  }

  function run(){
    users['_p']={pass:'x',chars:[{name:'P',cls:'knight',inv:[],rpg:{lvl:50}}],cur:0,mats:{},vault:[]};
    curUser='_p'; play();
    window.requestAnimationFrame=function(){ return 0; };   // the live loop must not also step
    devTeleport('G');
    // open ground, nothing alive: an enemy would eat the shot and a wall would end it early
    const R=curRoom;
    let px=0,py=0;
    for(let r=0;r<60&&!px;r++) for(let a=0;a<Math.max(1,r*8);a++){
      const th=a/Math.max(1,r*8)*6.2832;
      const tx=Math.round(R.w/2+Math.cos(th)*r), ty=Math.round(R.h/2+Math.sin(th)*r);
      const gx=(tx+0.5)*TILE, gy=(ty+0.5)*TILE;
      // need a long clear run to the EAST, or the shot dies on a wall and the distance is a lie
      let clear=true;
      for(let d=0;d<26;d++) if(solid(gx+d*TILE,gy)){ clear=false; break; }
      if(clear && !solid(gx,gy)){ px=gx; py=gy; break; }
    }
    player.x=px; player.y=py; player.inv=999;
    enemies.length=0; allies.length=0;
    update(1/120);
    enemies.length=0;

    say('===== PROJECTILE SPEED AUDIT =====');
    row('PROJ_SCALE', (typeof PROJ_SCALE!=='undefined')?PROJ_SCALE:'NOT DEFINED');
    row('MOVE_SCALE (must be untouched)', MOVE_SCALE);
    row('test ground', Math.round(px)+','+Math.round(py));

    // ---------------------------------------------------------------------------------------
    hd('A PLAYER BOLT, FLOWN');
    // 600 px/s for 1.0s: 600px of reach, whatever the scale does to how long it takes
    const P=fly(pShots,{x:px,y:py,px:px,py:py,vx:600,vy:0,r:5,life:1.0,dmg:0,
                        pierce:0,lastHit:null,nohome:1,age:0});
    row('nominal reach (600 x 1.0)', '600 px');
    row('measured distance', P.dist.toFixed(1)+' px');
    row('measured flight time', P.time.toFixed(3)+' s');
    row('expected time (1.0 / PROJ_SCALE)', (1/PROJ_SCALE).toFixed(3)+' s');
    ok('reach is unchanged by the scale', Math.abs(P.dist-600)<12, P.dist.toFixed(1)+' vs 600');
    ok('the bolt actually expired rather than timing out', P.gone, 'gone='+P.gone);
    ok('flight takes proportionally longer', Math.abs(P.time-1/PROJ_SCALE)<0.03,
       P.time.toFixed(3)+' vs '+(1/PROJ_SCALE).toFixed(3));

    // ---------------------------------------------------------------------------------------
    hd('AN ENEMY BOLT, FLOWN');
    // eFire's own numbers: default 200 px/s, fixed life of 3
    const E=fly(eShots,{x:px,y:py,px:px,py:py,vx:200,vy:0,r:6,life:3,bd:0,owner:null});
    row('nominal reach (200 x 3)', '600 px');
    row('measured distance', E.dist.toFixed(1)+' px');
    row('measured flight time', E.time.toFixed(3)+' s');
    ok('enemy reach is unchanged', Math.abs(E.dist-600)<12, E.dist.toFixed(1)+' vs 600');
    ok('the bolt actually expired rather than timing out', E.gone, 'gone='+E.gone);
    ok('enemy bolt is slower in the same ratio', Math.abs(E.time-3/PROJ_SCALE)<0.06,
       E.time.toFixed(3)+' vs '+(3/PROJ_SCALE).toFixed(3));

    // ---------------------------------------------------------------------------------------
    hd('EVERY WEAPON — reach held, time stretched');
    say('  reach = spd x life and is what the auto-aim cap reads, so it must not move.');
    for(const k in WTYPE){
      const W=WTYPE[k]; if(W.legacy) continue;
      const reach=(W.spd||520)*(W.life||1);
      const t0=(W.life||1), t1=(W.life||1)/PROJ_SCALE;
      row(W.n, 'reach '+Math.round(reach)+'px   flight '+t0.toFixed(2)+'s -> '+t1.toFixed(2)+'s'
        +'   ('+Math.round((W.spd||520)*PROJ_SCALE)+' px/s, was '+(W.spd||520)+')');
    }

    // ---------------------------------------------------------------------------------------
    hd('THE AUTO-AIM LEAD');
    say('  aimPoint solves an intercept in real seconds. Feed it the raw speed while the bolt');
    say('  actually flies slower and it under-leads every moving target -- which reads as broken');
    say('  aim rather than as slower shots. Both arguments have to be in the integration frame.');
    const tgt={x:player.x+300,y:player.y,tvx:0,tvy:220,r:14};
    const rawP=aimPoint(tgt,600,1.0);                        // wrong frame
    const effP=aimPoint(tgt,600*PROJ_SCALE,1.0/PROJ_SCALE);  // what fire() now passes
    const rawLead=Math.abs(rawP.y-tgt.y), effLead=Math.abs(effP.y-tgt.y);
    row('lead, raw speed/life', rawLead.toFixed(1)+' px');
    row('lead, effective speed/life', effLead.toFixed(1)+' px');
    ok('the effective frame leads further', effLead>rawLead+1,
       effLead.toFixed(1)+' > '+rawLead.toFixed(1));
    ok('and it is close to 1/PROJ_SCALE of it', rawLead>0 && Math.abs(effLead/rawLead-1/PROJ_SCALE)<0.08,
       rawLead>0?('ratio '+(effLead/rawLead).toFixed(3)):'no lead');

    // ---------------------------------------------------------------------------------------
    hd('WHAT MUST NOT HAVE MOVED');
    ok('MOVE_SCALE is still 0.80', MOVE_SCALE===0.80, 'MOVE_SCALE='+MOVE_SCALE);
    ok('PROJ_SCALE is a slight cut, not a big one', PROJ_SCALE>=0.80 && PROJ_SCALE<1,
       'PROJ_SCALE='+PROJ_SCALE);

    say('');
    say('RESULT '+(fail?'FAIL':'PASS')+'  '+pass+' passed, '+fail+' failed');
  }

  function boot(){ try{ run(); }catch(e){ say('THREW: '+(e&&e.message)); say((e&&e.stack)||''); } dump(); }
  if(document.readyState==='complete') setTimeout(boot,900);
  else window.addEventListener('load',()=>setTimeout(boot,900));
})();
