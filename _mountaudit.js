// ===================================================================================================
//  _mountaudit.js — RIDE EVERY MOUNT, EVERY DIRECTION, AND SEE WHAT SHOWS THROUGH
// ---------------------------------------------------------------------------------------------------
//  THE QUESTION. "Some of them are horrid, you can see through them, and they're clipped off at the
//  sides." tools/mountart.py already proved the PNGs are not the culprit -- not one frame in 1,620 is
//  semi-transparent -- so whatever lets the ground through is in the COMPOSITE: the mount drawn by
//  mountDrawUnder with the rider drawn over it by riderDrawOver, at their real scales and offsets.
//  Nothing but rendering the pair can answer that.
//
//  HOW IT MEASURES TRANSPARENCY, and why this is exact rather than a judgement call. Every pose is
//  drawn TWICE, once on white and once on black, and the two are differenced. A fully opaque pixel is
//  identical on both backgrounds; a partly transparent one differs by exactly (1-alpha) x 255. So the
//  diff IS the alpha map, and "can you see through it" stops being something you squint at.
//
//  It calls the game's own mountDrawUnder and riderDrawOver -- not a copy of them -- onto the real
//  canvas after filling it flat. `ctx` is a const in 01_constants.js and cannot be pointed elsewhere,
//  and it does not need to be: those two are plain globals that draw wherever the current transform
//  says, so a flat fill plus a translate is a clean room.
//
//  WHAT IT REPORTS PER POSE
//    see-through  % of the silhouette that is not fully opaque, and the worst single pixel
//    clipped      whether the drawn silhouette touches the edge of the box it was given, which is
//                 what a sliced muzzle looks like from the outside
//    seat         where the rider sits relative to the animal, so a rider floating above the back or
//                 sunk into it is a number rather than an impression
//
//    py tools/audit.py _mountaudit.js              every archetype, grounded and flying
//    py tools/audit.py _mountaudit.js size=1400x900
//
//  `?sheet=1` on the page instead draws a contact sheet of every direction on a flat yellow field,
//  for looking at rather than measuring.
// ===================================================================================================
(function(){
  const L=[]; let bad=0, warn=0;
  const pad=(s,n)=>{ s=String(s); return s+' '.repeat(Math.max(1,n-s.length)); };
  function out(){
    const el=document.getElementById('testout');
    const head='MOUNT AUDIT  '+(bad?('FAIL — '+bad+' poses show through'):'OK')+(warn?('  ('+warn+' warnings)'):'');
    if(el) el.textContent=head+'\n'+L.join('\n');
    document.title='MOUNT '+(bad?'FAIL':'OK');
  }

  const DIRS=[['e',0],['se',0.785],['s',1.571],['sw',2.356],
              ['w',3.142],['nw',3.927],['n',4.712],['ne',5.498]];
  const BOX=200;                       // the clean room, in canvas px
  const SOFT_BAD=0.04;                 // >4% of the silhouette not fully opaque reads as see-through

  // Draw one pose onto the real canvas, flat-filled, and read the pixels back.
  function shoot(bg){
    const w=BOX, h=BOX;
    ctx.save();
    ctx.setTransform(DPR,0,0,DPR,0,0);
    ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);
    // put the pair in the middle of the box: the draw functions take WORLD coords, so translate the
    // world point we are about to pass them onto the box's centre
    ctx.translate(w/2-player.x, h*0.62-player.y);
    let lift=0;
    // THE FLYER'S SHADOW IS DELIBERATE AND IT IS DRAWN AT globalAlpha 0.30. Counting it made every
    // flyer read as ~30% see-through in all eight directions -- dragon, griffon and infernal, 24
    // poses -- which is the shadow doing its job, not the animal being transparent. It is suppressed
    // for the measurement and reported on its own line instead.
    const _sh=(typeof _mountShadow==='function')?_mountShadow:null;
    if(_sh && !window._mtKeepShadow) window._mountShadow=function(){};
    try{ lift=mountDrawUnder(player.x, player.y, 0, player.aim||0, false, 0)||0; }catch(e){}
    if(_sh) window._mountShadow=_sh;
    try{ if(typeof riderDrawOver==='function') riderDrawOver(player.x, player.y, player.aim||0, null); }catch(e){}
    ctx.restore();
    return {px:ctx.getImageData(0,0,Math.round(w*DPR),Math.round(h*DPR)).data,
            w:Math.round(w*DPR), h:Math.round(h*DPR), lift:lift};
  }

  // Two backgrounds, one answer.
  function measure(){
    const A=shoot('#ffffff'), B=shoot('#000000');
    const n=A.w*A.h;
    let drawn=0, soft=0, worst=0;
    let minx=A.w, maxx=-1, miny=A.h, maxy=-1;
    for(let i=0;i<n;i++){
      const o=i*4;
      // difference between the two backgrounds IS the transparency at this pixel
      const d=Math.max(Math.abs(A.px[o]-B.px[o]), Math.abs(A.px[o+1]-B.px[o+1]), Math.abs(A.px[o+2]-B.px[o+2]));
      const painted=(d<250);      // 255 means nothing was drawn here at all -- pure background
      if(!painted) continue;
      drawn++;
      const x=i%A.w, y=(i-x)/A.w;
      if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y;
      if(d>6){ soft++; if(d>worst) worst=d; }
    }
    return {drawn:drawn, soft:soft, softFrac:drawn?soft/drawn:0, worst:worst,
            bbox:[minx,miny,maxx,maxy], w:A.w, h:A.h, lift:A.lift};
  }

  // WAIT FOR THE PIXELS, DO NOT GUESS AT A DELAY. The first run reported "NOTHING DRAWN" for all 160
  // poses because it measured 2.5s after load and the mount art had not decoded -- 1,620 PNGs, and
  // the tools use a fresh Chrome profile per run so nothing is cached. A timer cannot know that; a
  // decode promise can. Every frame this audit is about to draw is loaded and awaited by name first.
  function preload(archs){
    const urls=[];
    for(const a of archs){
      const spr=(MOUNT_ARCH[a]&&MOUNT_ARCH[a].spr)||('arch_'+a);
      urls.push('assets/mounts/'+spr+'.png');
      for(const [dn] of DIRS){
        urls.push('assets/mounts/'+spr+'/idle_'+dn+'.png');
        urls.push('assets/mounts/'+spr+'/idle_'+dn+'_1.png');
      }
    }
    // the rider too -- riderDrawOver returns false without it and the pose would be a bare animal
    if(typeof RIDER_DIRS!=='undefined') for(const d of RIDER_DIRS) urls.push(d);
    return Promise.all(urls.map(u=>new Promise(res=>{
      const i=new Image();
      i.onload=()=>res(1); i.onerror=()=>res(0);
      i.src=u;
    })));
  }

  function go(){
    users['_ma']={pass:'x', chars:[{name:'Ma', cls:'knight', inv:[], rpg:{lvl:50,wpn:8,arm:8,helm:8}}],
                  cur:0, mats:{}, vault:[]};
    curUser='_ma';
    play();
    if(typeof devTeleport==='function') devTeleport('G');
    if(typeof curRoom!=='undefined' && curRoom && curRoom.px!==undefined){
      player.x=(curRoom.px+0.5)*TILE; player.y=(curRoom.py+0.5)*TILE;
      if(curRoom.spawns) curRoom.spawns.length=0;
      if(typeof enemies!=='undefined') enemies.length=0;
    }
    // every gate open: this is about pixels, not permissions
    const st=(typeof mountStore==='function')?mountStore():null;
    if(st){ st.mountLv=99; }
    if(typeof lessonStore==='function'){ const Ls=lessonStore(); if(Ls){ Ls.ride=1; Ls.fly=1; } }

    // ONE REPRESENTATIVE PER ARCHETYPE. All 130 species share 20 archetypes' art and differ only by
    // tint, so riding all 130 would render the same 20 silhouettes six times over and say nothing new.
    const byArch={};
    for(const m of MOUNT_DB){ if(!byArch[m.arch]) byArch[m.arch]=m; }
    const archs=Object.keys(byArch).sort();
    L.push('  '+archs.length+' archetypes x '+DIRS.length+' directions, each drawn on white and on black');
    L.push('  mounted: '+((typeof mounted==='function')?mounted():'?')+'  ·  player.mnt '+(player.mnt||'none'));
    L.push('  a pose is SEE-THROUGH when >'+(SOFT_BAD*100)+'% of its silhouette differs between the two');
    L.push('');
    L.push('  '+pad('archetype',16)+pad('dir',5)+pad('drawn',8)+pad('see-through',14)+pad('worst',7)
           +pad('size',12)+'notes');
    L.push('  '+'-'.repeat(84));

    for(const a of archs){
      const m=byArch[a];
      // OWN IT BEFORE YOU SIT ON IT. _mountSeat refuses anything mountOwns() says no to, silently --
      // the first run reported "NOTHING DRAWN" for all 160 poses with player.mnt still `none`, which
      // looks exactly like missing art and is not.
      if(typeof giveMount==='function') giveMount(m.id);
      if(typeof player!=='undefined'){ player.mnt=null; player.mntCast=0; player.mntCd=0; }
      if(typeof _mountSeat==='function') _mountSeat(m.id);
      const fly=!!m.fly;
      let archBad=0;
      for(const [dn,ang] of DIRS){
        player.aim=ang; player.faceAng=ang;
        const r=measure();
        if(!r.drawn){ warn++;
          L.push('  '+pad(a,16)+pad(dn,5)+'NOTHING DRAWN — mnt '+(player.mnt||'none')
                 +', art '+((typeof mountArtFor==='function'&&mountArtFor(mountDef(m.id),{aim:ang,moving:false,clock:0}))?'ok':'NONE'));
          continue; }
        const bw=r.bbox[2]-r.bbox[0]+1, bh=r.bbox[3]-r.bbox[1]+1;
        const touches=[];
        if(r.bbox[0]<=1) touches.push('L');
        if(r.bbox[1]<=1) touches.push('T');
        if(r.bbox[2]>=r.w-2) touches.push('R');
        if(r.bbox[3]>=r.h-2) touches.push('B');
        const see=r.softFrac>SOFT_BAD;
        if(see){ bad++; archBad++; }
        const notes=[];
        if(see) notes.push('SEE-THROUGH');
        if(fly) notes.push('shadow suppressed for the measurement');
        if(touches.length) notes.push('touches box edge '+touches.join(''));
        if(fly) notes.push('flyer');
        L.push('  '+pad(a,16)+pad(dn,5)+pad(r.drawn,8)
               +pad((100*r.softFrac).toFixed(1)+'%',14)+pad(r.worst,7)
               +pad(bw+'x'+bh,12)+notes.join(' · '));
      }
      if(archBad) L.push('  '+pad('',16)+'^ '+archBad+' of '+DIRS.length+' directions show through');
    }
    L.push('');
    L.push('  A pose that is 0.0% see-through is fully opaque everywhere it painted. Anything above');
    L.push('  that is letting the background through the animal or the rider, and the two-background');
    L.push('  difference says by how much: 255 would be completely transparent.');
    out();
  }

  // ---- THE CONTACT SHEET ----
  // `?sheet=1` draws every archetype x every direction on a flat field so the pair can be LOOKED at.
  // Yellow by default because it is the one colour nothing in this roster is: a grey wolf, a black
  // dragon and a brown horse all read against it, and so does any hole in one.
  function sheet(byArch, archs, bg){
    // Laid out in TWO COLUMNS OF TEN, not twenty rows: EmberRealm refuses to run in portrait (there
    // is a turn-your-phone-sideways gate over the whole page), so a tall sheet photographs as that
    // notice and nothing else. Landscape is the only shape this page can be shot in.
    // THE GAME LOOP OWNS THIS CANVAS and repaints it every frame, so a sheet drawn onto it survives
    // about 16ms -- the first attempt photographed the live world instead. `ctx` is a const in
    // 01_constants.js and cannot be pointed at an offscreen canvas, so the loop has to stop instead:
    // kill rAF, draw, then freeze the result into an <img> and throw the DOM away, which also takes
    // the HUD and the portrait gate with it.
    window.requestAnimationFrame=function(){ return 0; };
    window.onerror=function(){ return true; };
    const cell=104, cellH=136, cols=DIRS.length, half=Math.ceil(archs.length/2), LBL=96;
    const blockW=LBL+cols*cell, W2=blockW*2+24, H2=half*cellH+64;
    cv.width=Math.round(W2*DPR); cv.height=Math.round(H2*DPR);
    cv.style.width=W2+'px'; cv.style.height=H2+'px';
    ctx.setTransform(DPR,0,0,DPR,0,0);
    ctx.fillStyle=bg; ctx.fillRect(0,0,W2,H2);
    const ink=(bg==='#ffff00'||bg==='#ffffff')?'#000':'#fff';
    ctx.font='11px monospace'; ctx.textBaseline='middle'; ctx.textAlign='left';
    for(let b=0;b<2;b++){
      const ox=b*(blockW+24);
      for(let i=0;i<cols;i++){
        ctx.fillStyle=ink;
        ctx.fillText(DIRS[i][0].toUpperCase(), ox+LBL+i*cell+cell/2-7, 16);
      }
    }
    let rdr=0, rerr='';
    for(let r=0;r<archs.length;r++){
      const a=archs[r], m=byArch[a];
      const b=(r<half)?0:1, row=(r<half)?r:(r-half), ox=b*(blockW+24), oy=46+row*cellH;
      if(typeof giveMount==='function') giveMount(m.id);
      player.mnt=null; player.mntCast=0; player.mntCd=0;
      if(typeof _mountSeat==='function') _mountSeat(m.id);
      // a banded backdrop so a hole in a sprite is obvious against BOTH a light and a dark field --
      // one flat colour can hide a hole that happens to match it
      ctx.fillStyle=(row&1)?'#000000':bg;
      ctx.fillRect(ox, oy, blockW, cellH);
      ctx.fillStyle=(row&1)?'#fff':ink;
      ctx.fillText(a+(m.fly?' ✈':''), ox+4, oy+cellH/2);
      for(let i=0;i<cols;i++){
        player.aim=DIRS[i][1]; player.faceAng=DIRS[i][1];
        ctx.save();
        ctx.beginPath(); ctx.rect(ox+LBL+i*cell, oy, cell, cellH); ctx.clip();
        ctx.translate(ox+LBL+i*cell+cell/2-player.x, oy+cellH*0.74-player.y);
        try{ mountDrawUnder(player.x,player.y,0,player.aim,false,0); }catch(e){}
        try{ if(riderDrawOver(player.x,player.y,player.aim,null)!==false) rdr++; }catch(e){ rerr=rerr||(''+e); }
        ctx.restore();
      }
    }
    ctx.fillStyle=ink; ctx.textAlign='left';
    ctx.fillText('rider drew on '+rdr+' of '+(archs.length*cols)+' poses'+(rerr?('  ['+rerr+']'):''), 4, H2-12);
    const url=cv.toDataURL('image/png');
    for(let n=document.body.firstElementChild;n;n=n.nextElementSibling) n.style.display='none';
    document.body.style.cssText='margin:0;padding:0;background:'+bg;
    const im=new Image(); im.src=url; im.style.cssText='display:block;width:'+W2+'px;height:'+H2+'px';
    document.body.appendChild(im);
    document.title='SHEET READY';
  }

  function boot(){
    // stand the account up first so MOUNT_DB/MOUNT_ARCH exist, then WAIT for the art, then measure
    try{
      users['_ma']={pass:'x', chars:[{name:'Ma', cls:'knight', inv:[], rpg:{lvl:50,wpn:8,arm:8,helm:8}}],
                    cur:0, mats:{}, vault:[]};
      curUser='_ma';
      const byArch={}; for(const m of MOUNT_DB){ if(!byArch[m.arch]) byArch[m.arch]=m; }
      preload(Object.keys(byArch)).then(rs=>{
        const okN=rs.filter(Boolean).length;
        L.push('  warmed the cache with '+okN+' of '+rs.length+' urls');
        // PRIME THE GAME'S OWN IMAGE OBJECTS. Loading the same URLs into my own Images only warms
        // the HTTP cache -- _mountArt and the frame tables hold their own lazy Images, created on
        // first call and null until they decode. Five lizard directions reported "art NONE" with the
        // files sitting right there for exactly this reason. Calling the real accessor once per
        // archetype and direction creates them; a settle lets them decode.
        for(const a in byArch){
          const d=mountDef(byArch[a].id);
          for(const [dn,ang] of DIRS){
            try{ mountArtFor(d,{aim:ang,moving:false,clock:0}); }catch(e){}
            try{ mountArtFor(d,{aim:ang,moving:true,clock:0.3}); }catch(e){}
          }
          try{ mountImg(d.spr); }catch(e){}
        }
        const Q=new URLSearchParams(location.search);
        setTimeout(()=>{
          try{
            if(Q.get('seats')==='1'){
              // WHERE THE RIDER ACTUALLY LANDS, per archetype x direction, and which source won.
              // The table is measured; the live central slice is a per-frame refinement that must
              // not be allowed to relocate a rider onto a wing. This prints both so the clamp can
              // be checked rather than eyeballed off a contact sheet.
              const L2=[]; let over=0, kept=0;
              L2.push('  archetype        seat   ' + DIRS.map(d=>d[0].padStart(6)).join(''));
              L2.push('  ' + '-'.repeat(78));
              Object.keys(byArch).sort().forEach(function(a){
                const m=byArch[a];
                if(typeof giveMount==='function') giveMount(m.id);
                player.mnt=null; if(typeof _mountSeat==='function') _mountSeat(m.id);
                const d=mountDef(m.id), st=mountSeatOf(d);
                const cells=DIRS.map(function(dd){
                  const mref=_mountFrame(d.spr,'idle_'+dd[0]) || _mountFrame(d.spr,'idle_'+dd[0]+'_0')
                          || mountImg(d.spr);
                  const sm=mref?mountSeatY(mref):null;
                  if(!sm||!(sm.h>0)) return '     -';
                  const frac=(sm.foot-sm.top)/sm.h;
                  // the old clause used the slice whenever it landed in 0.40..0.75; mark those
                  const wouldFire=(frac>=0.40 && frac<=0.75);
                  if(wouldFire) over++; else kept++;
                  return (wouldFire?'*':' ')+frac.toFixed(2)+'  ';
                });
                L2.push('  '+a.padEnd(16)+st.seat.toFixed(2)+'   '+cells.join(''));
              });
              L2.push('');
              L2.push('  The live central slice reads (bboxBottom - topOfCentralSlice) / bboxHeight.');
              L2.push('  It is NOT a saddle height: it sits at 0.71..0.99 on every archetype, while the');
              L2.push('  measured seats run 0.29..0.68. riderDrawOver no longer consults it -- MOUNT_SEATS');
              L2.push('  is the only source. * marks the '+over+' of '+(over+kept)+' poses where the old');
              L2.push('  0.40..0.75 clause would have fired and moved the rider off the measured seat.');
              const el2=document.getElementById('testout');
              if(el2){ el2.textContent='RIDER SEATS\n\n'+L2.join('\n'); el2.style.display='block'; }
              document.title='SEATS READY';
              return;
            }
            if(Q.get('sheet')==='1'){
              // the sheet needs the same world the audit does: a room, a seat and the gates open
              play(); if(typeof devTeleport==='function') devTeleport('G');
              if(curRoom&&curRoom.px!==undefined){ player.x=(curRoom.px+0.5)*TILE; player.y=(curRoom.py+0.5)*TILE; }
              const st2=(typeof mountStore==='function')?mountStore():null; if(st2) st2.mountLv=99;
              if(typeof lessonStore==='function'){ const Ls=lessonStore(); if(Ls){ Ls.ride=1; Ls.fly=1; } }
              // PRIME THE RIDER THROUGH THE GAME'S OWN CACHE. `_rideAt` creates the Image on first
              // ask and returns null until it has loaded, so a sheet that draws immediately draws
              // an empty saddle on all 160 poses -- which is exactly what the first one did. Ask
              // once for every arch x direction, wait, then draw against a warm cache. The loop is
              // still running here; it is only stopped inside sheet().
              const _d8=['n','ne','e','se','s','sw','w','nw'];
              Object.keys(byArch).forEach(function(a){
                const m=byArch[a]; if(typeof giveMount==='function') giveMount(m.id);
                player.mnt=null; if(typeof _mountSeat==='function') _mountSeat(m.id);
                _d8.forEach(function(dd){ try{ rideImg('knight',dd,(mountDef(m.id)||{}).spr); }catch(e){} });
              });
              setTimeout(function(){
                sheet(byArch, Object.keys(byArch).sort(), Q.get('bg')||'#ffff00');
              }, 2000);
            } else go();
          }catch(e){ bad++; L.push('AUDIT THREW: '+(e&&e.stack||e)); out(); }
        }, 2500);
      });
    }catch(e){ bad++; L.push('BOOT THREW: '+(e&&e.stack||e)); out(); }
  }
  if(document.readyState==='complete') setTimeout(boot,600);
  else window.addEventListener('load',()=>setTimeout(boot,600));
})();
