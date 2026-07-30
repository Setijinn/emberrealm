// ===================================================================================================
//  _lab.js — THE PATTERN LAB.  Build a projectile pattern or a weapon, watch it fire, paste it out.
// ---------------------------------------------------------------------------------------------------
//  WHY THIS EXISTS. Every boss pattern in this game is a hand-written `for` loop inside a fight's
//  tick() -- `for(let i=-2;i<=2;i++) eFire(e, a+i*0.18, 215*P.speed)` -- and the only way to see what
//  one felt like was to edit 17i_bossfights.js, reload, walk to the boss, and fight it. That is a
//  thirty-second round trip on a change you want to make twenty times, so in practice nobody iterates:
//  patterns get written once and left. Weapons are worse -- the WEAP row decides shots, spread, speed,
//  reach and rate all at once, and those five numbers only mean anything together, in motion.
//
//  THIS DRIVES THE REAL CODE. It does not simulate anything. Patterns go through eFire() into eShots
//  and are moved, collided and drawn by update()/render(); the weapon half edits the live WEAP row and
//  fires through the player's own fire(). What you watch is what ships -- and what it prints is
//  pasteable into the file it came from.
//
//    py tools/lab.py            build it and print the URL
//    py tools/lab.py --open     ...and open a browser at it
//
//  IT IS A DEV PAGE, NOT A FEATURE. It is built from index.html the same way _selftest.html is, so it
//  cannot drift from the game, and nothing here is loaded by index.html itself.
// ===================================================================================================
(function(){
  const $=(id)=>document.getElementById(id);

  // ---- THE PATTERN MODEL -------------------------------------------------------------------------
  // Every field here is something the shipped fights actually vary. Read 17i_bossfights.js: they fan
  // (`i=-2..2` off the aim), they ring (`(i/n)*6.283`), they spin a ring by `e.ang`, they burst, and
  // they scale speed by bossPace. Nothing else. So those are the dials, and the exporter writes the
  // same shape of loop the fights are already written in.
  const P = {
    mode:'fan',        // fan | ring | spiral | random | wall
    count:5,
    spread:0.18,       // radians BETWEEN shots, for fan/wall — matches the fights' `i*0.18`
    speed:215,
    every:1.6,         // seconds between volleys
    burst:1,           // volleys per trigger
    burstGap:0.10,     // seconds between them
    spin:0.35,         // radians the ring/spiral turns per volley
    jitter:0.0,        // random radians added per shot
    aim:'player',      // player | fixed | outward
    // the look — these are exactly the four fields of a BOSS_PROJ row
    col:'#d4622a', core:'#ffd3a0', shape:'orb', size:7,
    // the caster
    dmg:8, casterLv:40
  };
  const SHAPES=['orb','dart','diamond'];
  const MODES=['fan','ring','spiral','random','wall'];
  const AIMS=['player','fixed','outward'];

  // ---- THE WEAPON MODEL --------------------------------------------------------------------------
  // These ARE the fields of a WEAP row in 11_ui.js. The lab edits the live table, so the player's own
  // fire() reads them on the next shot with no reload.
  const WKEYS=['shots','spread','spd','life','size','dm','rof','pierce','par'];
  let wtype='sword', wbackup=null;

  // ---- state -------------------------------------------------------------------------------------
  let caster=null, t=0, volley=0, ang=0, live=true, tab='pat';

  // WHERE THE MUZZLE STANDS. Not the room's centre: in the Hearth that is the FOUNTAIN, and the
  // first run of this put the caster inside it -- a ring half-hidden behind masonry, firing from
  // somewhere you cannot see. It stands a fixed distance from the player instead, snapped to ground
  // you could walk on, which is also where a boss would actually be.
  function casterSpot(){
    const p=(typeof player!=='undefined')?player:null;
    const R=(typeof curRoom!=='undefined')?curRoom:null;
    if(!p||!R) return {x:600,y:400};
    let x=p.x+TILE*6, y=p.y;
    if(x>(R.w-2)*TILE) x=p.x-TILE*6;
    if(typeof nearestStandable==='function'){ const s2=nearestStandable(x,y); if(s2) return s2; }
    return {x:x,y:y};
  }
  function makeCaster(){
    // NOT a real enemy: eFire only reads x/y/psize/bd/pcol/pcore/pshape/inf off its owner, and a real
    // one would also be moved, damaged and despawned by update(). A plain object is the honest way to
    // say "this is a muzzle, not a monster".
    const s2=casterSpot();
    // `st` is the status bag every real enemy carries -- eFire multiplies by statusDmgOut(e), which
    // reads it. A muzzle still has to look enough like an entity for the functions it calls.
    return {x:s2.x, y:s2.y, lv:P.casterLv, bd:P.dmg, psize:P.size, st:{}, r:14, hp:1, maxhp:1,
            pcol:P.col, pcore:P.core, pshape:P.shape, name:'LAB', _lab:1};
  }

  function aimAt(){
    if(P.aim==='fixed') return 0;
    if(P.aim==='outward') return ang;
    const p=(typeof player!=='undefined')?player:null;
    return p ? Math.atan2(p.y-caster.y, p.x-caster.x) : 0;
  }

  // ONE VOLLEY, and this is the function the exporter prints. Keeping the fired code and the exported
  // code as the same expression is the whole point: a lab that prints something it did not run is a
  // lab that lies.
  let lastErr='';
  function volleyOnce(){ try{ _volley(); }catch(e){
    // A THROW IN HERE USED TO KILL THE LAB SILENTLY. This runs from the lab's own rAF, so one
    // exception ends the callback chain and the panel keeps working while nothing ever fires again --
    // which reads exactly like a pattern that does not work. Now it says so.
    lastErr=String(e&&e.message||e);
    const o=$('labErr'); if(o){ o.textContent='fire threw: '+lastErr; o.style.display='block'; }
  } }
  function _volley(){
    if(!caster || typeof eFire!=='function') return;
    caster.bd=P.dmg; caster.psize=P.size;
    caster.pcol=P.col; caster.pcore=P.core; caster.pshape=P.shape;
    const a0=aimAt(), n=Math.max(1,P.count|0), jt=()=>(P.jitter?(Math.random()*2-1)*P.jitter:0);
    if(P.mode==='fan'){
      for(let i=0;i<n;i++) eFire(caster, a0+(i-(n-1)/2)*P.spread+jt(), P.speed);
    } else if(P.mode==='ring'){
      for(let i=0;i<n;i++) eFire(caster, (i/n)*6.283+ang+jt(), P.speed);
    } else if(P.mode==='spiral'){
      for(let i=0;i<n;i++) eFire(caster, ang+(i/n)*6.283+jt(), P.speed);
    } else if(P.mode==='random'){
      for(let i=0;i<n;i++) eFire(caster, Math.random()*6.283, P.speed);
    } else if(P.mode==='wall'){
      // a line of shots abreast, all travelling the same way -- the "wall you step through a gap in"
      for(let i=0;i<n;i++){
        const off=(i-(n-1)/2)*(P.spread*60);
        const px=caster.x+Math.cos(a0+Math.PI/2)*off, py=caster.y+Math.sin(a0+Math.PI/2)*off;
        const save={x:caster.x,y:caster.y};
        caster.x=px; caster.y=py; eFire(caster, a0+jt(), P.speed);
        caster.x=save.x; caster.y=save.y;
      }
    }
    ang+=P.spin;
    volley++;
  }

  // ---- the exporter ------------------------------------------------------------------------------
  // Prints the loop in the idiom 17i_bossfights.js already uses, including bossPace -- because a
  // pattern tuned here at a flat speed still has to obey the fight's pacing when it lands in a real
  // tick(), and leaving that out is how a lab's numbers stop matching the game's.
  function exportPattern(){
    const n=Math.max(1,P.count|0);
    const L=[];
    L.push('// pattern from the lab — paste inside a fight\'s tick(e,dt,ph,eng) in 17i_bossfights.js');
    L.push('if(mechEvery(e,\'t\','+P.every.toFixed(2)+'-ph*0.2,dt)){');
    L.push('  const P=bossPace(e);');
    if(P.burst>1){
      L.push('  for(let b=0;b<'+P.burst+';b++) setTimeout(()=>{');
      L.push('    if(enemies.indexOf(e)<0) return;   // it may have died mid-burst');
    }
    const ind=(P.burst>1)?'    ':'  ';
    const jt=P.jitter?('+(Math.random()*2-1)*'+P.jitter.toFixed(2)):'';
    if(P.mode==='fan'){
      L.push(ind+'const a=Math.atan2(player.y-e.y,player.x-e.x);');
      L.push(ind+'for(let i=0;i<'+n+';i++) eFire(e, a+(i-'+((n-1)/2).toFixed(1)+')*'+P.spread.toFixed(2)+jt+', '+P.speed+'*P.speed);');
    } else if(P.mode==='ring'){
      L.push(ind+'for(let i=0;i<'+n+';i++) eFire(e, (i/'+n+')*6.283+e.ang'+jt+', '+P.speed+'*P.speed);');
    } else if(P.mode==='spiral'){
      L.push(ind+'e.ang=(e.ang||0)+'+P.spin.toFixed(2)+';');
      L.push(ind+'for(let i=0;i<'+n+';i++) eFire(e, e.ang+(i/'+n+')*6.283'+jt+', '+P.speed+'*P.speed);');
    } else if(P.mode==='random'){
      L.push(ind+'for(let i=0;i<'+n+';i++) eFire(e, Math.random()*6.283, '+P.speed+'*P.speed);');
    } else if(P.mode==='wall'){
      L.push(ind+'const a=Math.atan2(player.y-e.y,player.x-e.x), ox=Math.cos(a+Math.PI/2), oy=Math.sin(a+Math.PI/2);');
      L.push(ind+'const _x=e.x,_y=e.y;');
      L.push(ind+'for(let i=0;i<'+n+';i++){ const o=(i-'+((n-1)/2).toFixed(1)+')*'+(P.spread*60).toFixed(0)+';');
      L.push(ind+'  e.x=_x+ox*o; e.y=_y+oy*o; eFire(e, a'+jt+', '+P.speed+'*P.speed); }');
      L.push(ind+'e.x=_x; e.y=_y;');
    }
    if(P.burst>1) L.push('  }, b*'+Math.round(P.burstGap*1000)+');');
    L.push('}');
    L.push('');
    L.push('// and its BOSS_PROJ row (03_entities.js) — the look, per boss id');
    L.push("{col:'"+P.col+"',core:'"+P.core+"',shape:'"+P.shape+"',size:"+P.size+"},");
    return L.join('\n');
  }

  function exportWeapon(){
    const W=(typeof WEAP!=='undefined')?WEAP[wtype]:null;
    if(!W) return '// no WEAP row for '+wtype;
    const parts=WKEYS.filter(k=>W[k]!==undefined&&W[k]!==null).map(k=>k+':'+W[k]);
    return '// weapon row from the lab — replace this line in WEAP, 11_ui.js\n'
         + ' '+wtype+":{n:'"+(W.n||wtype)+"',"+parts.join(',')+'},';
  }

  // ---- the panel ---------------------------------------------------------------------------------
  // Its own overlay, deliberately NOT one of UI_PANEL_IDS: those pause the world, and a pattern lab
  // that stops time the moment you touch a slider is useless.
  function row(label, el){
    const d=document.createElement('div'); d.className='labRow';
    const l=document.createElement('label'); l.textContent=label; d.appendChild(l);
    d.appendChild(el); return d;
  }
  function slider(key, min, max, step, fmt){
    const wrap=document.createElement('div'); wrap.className='labSlide';
    const i=document.createElement('input'); i.type='range';
    i.min=min; i.max=max; i.step=step; i.value=P[key];
    const v=document.createElement('span'); v.className='labVal';
    const show=()=>{ v.textContent=fmt?fmt(P[key]):P[key]; };
    i.oninput=()=>{ P[key]=parseFloat(i.value); show(); };
    show(); wrap.appendChild(i); wrap.appendChild(v); return wrap;
  }
  function picker(key, opts){
    const wrap=document.createElement('div'); wrap.className='labPick';
    for(const o of opts){
      const b=document.createElement('button');
      b.textContent=o; b.className=(P[key]===o)?'on':'';
      b.onclick=()=>{ P[key]=o; build(); };
      wrap.appendChild(b);
    }
    return wrap;
  }
  function colour(key){
    const i=document.createElement('input'); i.type='color'; i.value=P[key];
    i.oninput=()=>{ P[key]=i.value; };
    return i;
  }
  function wslider(key, min, max, step){
    const W=WEAP[wtype];
    const wrap=document.createElement('div'); wrap.className='labSlide';
    const i=document.createElement('input'); i.type='range';
    i.min=min; i.max=max; i.step=step; i.value=(W[key]!==undefined?W[key]:0);
    const v=document.createElement('span'); v.className='labVal';
    const show=()=>{ v.textContent=(W[key]!==undefined?W[key]:0); };
    i.oninput=()=>{ W[key]=parseFloat(i.value); show(); };
    show(); wrap.appendChild(i); wrap.appendChild(v); return wrap;
  }

  function build(){
    const body=$('labBody'); if(!body) return;
    body.innerHTML='';
    if(tab==='pat'){
      body.appendChild(row('mode', picker('mode', MODES)));
      body.appendChild(row('aim', picker('aim', AIMS)));
      body.appendChild(row('count', slider('count',1,40,1)));
      body.appendChild(row('spread', slider('spread',0.02,1.2,0.01,v=>v.toFixed(2)+' rad')));
      body.appendChild(row('speed', slider('speed',60,600,5)));
      body.appendChild(row('every', slider('every',0.15,6,0.05,v=>v.toFixed(2)+'s')));
      body.appendChild(row('burst', slider('burst',1,8,1)));
      body.appendChild(row('burst gap', slider('burstGap',0.03,0.6,0.01,v=>v.toFixed(2)+'s')));
      body.appendChild(row('spin', slider('spin',-1.2,1.2,0.01,v=>v.toFixed(2)+' rad')));
      body.appendChild(row('jitter', slider('jitter',0,0.6,0.01,v=>v.toFixed(2)+' rad')));
      body.appendChild(row('shape', picker('shape', SHAPES)));
      body.appendChild(row('size', slider('size',3,16,1)));
      body.appendChild(row('body', colour('col')));
      body.appendChild(row('core', colour('core')));
      body.appendChild(row('damage', slider('dmg',1,60,1)));
    } else {
      const W=(typeof WEAP!=='undefined')?WEAP[wtype]:null;
      const pick=document.createElement('div'); pick.className='labPick';
      for(const k of Object.keys(WEAP||{})){
        if(WEAP[k].legacy) continue;
        const b=document.createElement('button'); b.textContent=k;
        b.className=(wtype===k)?'on':'';
        b.onclick=()=>{ restoreWeapon(); wtype=k; backupWeapon(); build(); equipLabWeapon(); };
        pick.appendChild(b);
      }
      body.appendChild(row('type', pick));
      if(W){
        body.appendChild(row('shots', wslider('shots',1,7,1)));
        body.appendChild(row('spread', wslider('spread',0,0.6,0.01)));
        body.appendChild(row('parallel', wslider('par',0,26,1)));
        body.appendChild(row('speed', wslider('spd',120,1200,10)));
        body.appendChild(row('reach', wslider('life',0.1,2.5,0.05)));
        body.appendChild(row('size', wslider('size',2,14,1)));
        body.appendChild(row('damage x', wslider('dm',0.2,3,0.05)));
        body.appendChild(row('rate x', wslider('rof',0.3,3,0.01)));
        body.appendChild(row('pierce', wslider('pierce',0,99,1)));
      }
    }
  }

  function backupWeapon(){ if(typeof WEAP==='undefined') return;
    wbackup=Object.assign({}, WEAP[wtype]); }
  function restoreWeapon(){ if(wbackup && typeof WEAP!=='undefined') Object.assign(WEAP[wtype], wbackup); }
  // put the chosen type in the player's hands, so fire() reads the row being edited
  function equipLabWeapon(){
    const ch=(typeof curChar==='function')?curChar():null;
    if(!ch || typeof CWEAP==='undefined') return;
    for(const cls in CWEAP) if(CWEAP[cls]===wtype){ ch.cls=cls; break; }
    if(typeof recalcStats==='function') recalcStats();
  }

  function panel(){
    const css=document.createElement('style');
    css.textContent=
      '#labPanel{position:fixed;left:0;top:0;bottom:0;width:min(46vw,330px);z-index:60;overflow-y:auto;'
      +'background:rgba(10,8,14,.94);border-right:1px solid #3a3244;color:#d8cfb8;'
      +"font:12px 'Pixelify Sans',monospace;padding:8px 10px 60px;}"
      +'#labPanel h1{font-size:15px;color:#ffc94d;letter-spacing:.1em;margin:2px 0 6px;}'
      +'#labTabs{display:flex;gap:6px;margin-bottom:8px;}'
      +'#labTabs button,#labActs button{flex:1;background:#221c2b;border:1px solid #4a3d5c;color:#d8cfb8;'
      +"font:12px 'Pixelify Sans',monospace;padding:7px 4px;border-radius:7px;min-height:34px;}"
      +'#labTabs button.on{background:#e07a2e;border-color:#ffc94d;color:#0b0a10;}'
      +'.labRow{display:flex;align-items:center;gap:6px;margin:3px 0;}'
      +'.labRow>label{flex:0 0 64px;color:#8a8494;font-size:11px;}'
      +'.labSlide{flex:1;display:flex;align-items:center;gap:6px;}'
      +'.labSlide input{flex:1;min-width:0;}'
      +'.labVal{flex:0 0 62px;text-align:right;color:#ffd07a;font-size:11px;}'
      +'.labPick{flex:1;display:flex;flex-wrap:wrap;gap:4px;}'
      +'.labPick button{background:#221c2b;border:1px solid #4a3d5c;color:#d8cfb8;'
      +"font:11px 'Pixelify Sans',monospace;padding:5px 7px;border-radius:6px;min-height:30px;}"
      +'.labPick button.on{background:#e07a2e;border-color:#ffc94d;color:#0b0a10;}'
      +'#labActs{display:flex;gap:6px;margin-top:10px;}'
      +'#labOut{width:100%;height:150px;margin-top:8px;background:#07060b;color:#9f9;'
      +'border:1px solid #2e2738;border-radius:6px;font:11px ui-monospace,Consolas,monospace;padding:6px;}'
      +'#labHint{color:#6a6472;font-size:10px;margin-top:6px;line-height:1.35;}';
    document.head.appendChild(css);

    const d=document.createElement('div'); d.id='labPanel';
    d.innerHTML='<h1>PATTERN LAB</h1>'
      +'<div id="labTabs"><button id="labTabP" class="on">PATTERN</button>'
      +'<button id="labTabW">WEAPON</button></div>'
      +'<div id="labBody"></div>'
      +'<div id="labActs"><button id="labFire">FIRE ONCE</button>'
      +'<button id="labRun">PAUSE</button><button id="labClear">CLEAR</button>'
      +'<button id="labMove">MOVE HERE</button></div>'
      +'<div id="labActs2" style="display:flex;gap:6px;margin-top:6px;">'
      +'<button id="labCopy" style="flex:1;background:#3a2c20;border:1px solid #7a4a1e;color:#e8e0d0;'
      +"font:12px 'Pixelify Sans',monospace;padding:7px;border-radius:7px;min-height:34px;\">COPY CODE</button></div>"
      +'<textarea id="labOut" readonly></textarea>'
      +'<div id="labStat" style="color:#8a8494;font-size:11px;margin-top:6px;"></div>'
      +'<div id="labErr" style="display:none;color:#e2604c;font-size:11px;margin-top:6px;'
      +'border:1px solid #7a2a2a;border-radius:6px;padding:5px;"></div>'
      +'<div id="labHint">Walk with WASD to dodge it. The caster sits at the middle of the room; '
      +'everything you see goes through the game’s own eFire/update/render, and COPY CODE gives '
      +'you the loop in the form 17i_bossfights.js already uses.</div>';
    document.body.appendChild(d);

    $('labTabP').onclick=()=>{ tab='pat'; $('labTabP').className='on'; $('labTabW').className=''; build(); refresh(); };
    $('labTabW').onclick=()=>{ tab='wpn'; $('labTabW').className='on'; $('labTabP').className='';
      backupWeapon(); equipLabWeapon(); build(); refresh(); };
    $('labFire').onclick=()=>volleyOnce();
    $('labRun').onclick=()=>{ live=!live; $('labRun').textContent=live?'PAUSE':'RESUME'; };
    $('labClear').onclick=()=>{ if(typeof eShots!=='undefined') eShots.length=0;
      if(typeof pShots!=='undefined') pShots.length=0; };
    // WHERE it fires from is part of the pattern -- a fan that is fair at six tiles is a wall at two.
    $('labMove').onclick=()=>{ const s2=casterSpot(); if(caster){ caster.x=s2.x; caster.y=s2.y; } };
    $('labCopy').onclick=()=>{ const ta=$('labOut'); ta.select();
      try{ document.execCommand('copy'); }catch(e){}
      if(typeof msg==='function') msg('COPIED','paste it into the file it names'); };
  }
  function refresh(){
    const o=$('labOut'); if(o) o.value=(tab==='pat')?exportPattern():exportWeapon();
    // COUNTS, NOT IMPRESSIONS. "I cannot see any shots" has two very different causes -- nothing is
    // being fired, or something is firing and being deleted -- and only a number tells them apart.
    // 07_update.js drops any enemy shot the instant solid(s.x,s.y) is true, which is how the first
    // stage (the Hearth) ate every volley against its masonry.
    const st=$('labStat');
    if(st) st.textContent='volleys '+volley+'  ·  in flight '
      +((typeof eShots!=='undefined')?eShots.length:'?')
      +'  ·  mine '+((typeof pShots!=='undefined')?pShots.length:'?');
  }

  // ---- the stage ---------------------------------------------------------------------------------
  function go(){
    // a throwaway account, exactly like the screenshot rig's -- nothing here is saved to a real one
    users['_lab']={pass:'x', chars:[{name:'Lab', cls:'knight', inv:[], rpg:{lvl:50}}], cur:0, mats:{}, vault:[]};
    curUser='_lab';
    play();
    // THE STAGE IS OPEN OVERWORLD, and it has to be. The first version used the Hearth, reasoning
    // that nothing spawns in a town -- but 07_update.js line 883 deletes any enemy shot the moment
    // `solid(s.x,s.y)` is true, and the Hearth is a plaza ringed by buildings, stalls and a fountain.
    // Every volley died against masonry within a few tiles and the lab looked like it was not firing
    // at all. A pattern needs room to BE a pattern.
    //
    // The spawn table is emptied instead of relying on a safe room: curRoom.spawns is what the
    // spawner draws from, so clearing it once makes the province permanently quiet without touching
    // any spawn logic. enemies is cleared alongside it for anything already on the field.
    if(typeof devTeleport==='function') devTeleport('G');
    if(typeof curRoom!=='undefined' && curRoom){
      // AND STAND ON THE ROOM'S OWN SPAWN. devTeleport swaps the room and KEEPS the player's
      // coordinates -- which were the Hearth's, about (880,660) in pixels. On a 42-tile town that is
      // the middle of the plaza; on a 3700-tile world it is open ocean, and the lab opened with the
      // hero and the muzzle both bobbing in the sea. curRoom.px/py is the 'P' marker the world
      // builder read, which is where a new character actually arrives.
      if(curRoom.px!==undefined && typeof player!=='undefined' && player){
        player.x=(curRoom.px+0.5)*TILE; player.y=(curRoom.py+0.5)*TILE;
        if(typeof nearestStandable==='function'){
          const sp=nearestStandable(player.x,player.y);
          if(sp){ player.x=sp.x; player.y=sp.y; }
        }
      }
      if(curRoom.spawns) curRoom.spawns.length=0;
      if(typeof enemies!=='undefined') enemies.length=0;
      curRoom.cleared=true;
    }
    if(typeof rpg!=='undefined' && rpg) rpg.lvl=50;
    // god mode, because the point is to WATCH the pattern, not to survive it. Turn it off in the dev
    // panel if what you want to know is whether it is dodgeable.
    if(typeof god!=='undefined') { try{ eval('god=1'); }catch(e){} }
    if(typeof player!=='undefined' && player) player.god=1;
    caster=makeCaster();
    panel(); build(); refresh();

    // ONE OWN rAF, not a hook into loop(). The game's loop owns update/render; this only needs to
    // decide WHEN to fire, and doing that from a separate frame callback keeps the lab entirely
    // outside the code it is testing -- nothing in the shipped files knows this file exists.
    let last=performance.now(), acc=0, burstLeft=0, burstT=0;
    (function tick(){
      const now=performance.now(), dt=Math.min(0.05,(now-last)/1000); last=now;
      // the field stays empty: anything that wanders in is removed before it can shoot back, so what
      // is on screen is only ever what the lab fired
      if(typeof enemies!=='undefined' && enemies.length) enemies.length=0;
      if(live && caster){
        acc+=dt;
        if(acc>=P.every){ acc=0; burstLeft=Math.max(1,P.burst|0); burstT=0; }
        if(burstLeft>0){
          burstT-=dt;
          if(burstT<=0){ volleyOnce(); burstLeft--; burstT=P.burstGap; }
        }
      }
      refresh();
      requestAnimationFrame(tick);
    })();

    // draw the caster itself, so you can see where it is firing from. A plain ring: it is a muzzle,
    // and dressing it as a boss would suggest it has a hitbox, which it does not.
    const _r=(typeof render==='function')?render:null;
    if(_r) window.render=function(){
      _r();
      try{
        if(!caster || typeof w2s!=='function') return;
        const s=w2s(caster.x,caster.y);
        ctx.save();
        ctx.strokeStyle=P.col; ctx.lineWidth=2; ctx.globalAlpha=0.9;
        ctx.beginPath(); ctx.arc(s.x,s.y,13,0,6.283); ctx.stroke();
        ctx.globalAlpha=0.35; ctx.beginPath(); ctx.arc(s.x,s.y,20,0,6.283); ctx.stroke();
        ctx.restore();
      }catch(e){}
    };
  }

  function boot(){ try{ go(); }catch(e){
    const d=document.createElement('pre');
    d.style.cssText='position:fixed;left:0;top:0;z-index:99999;color:#f66;background:#000;font:12px monospace;padding:8px';
    d.textContent='LAB FAILED\n'+(e&&e.stack||e); document.body.appendChild(d); } }
  if(document.readyState==='complete') setTimeout(boot,500);
  else window.addEventListener('load',()=>setTimeout(boot,500));
})();
