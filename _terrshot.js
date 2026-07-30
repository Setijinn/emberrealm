// SCREENSHOT HARNESS. Puts a hero on real overworld ground in one named territory and lets the
// real render() draw it, so a change to the terrain can be LOOKED AT instead of argued about.
//
// Read-only with respect to content: it stands up a throwaway account in memory (never saved),
// walks to a province centre and steps frames. `?z=N` picks the territory index, `?hud=0` hides
// the HUD so the ground is not covered by orbs.
//
// Run it with `py tools/terrshot.py <index>`; the page is captured with chrome --screenshot.
(function(){
  const Q=new URLSearchParams(location.search);
  const ZI=parseInt(Q.get('z')||'0',10);
  const HUD=Q.get('hud')!=='0';
  // `?nc=1` renders the SAME province with the corruption stain switched off. It is a diagnostic,
  // not a proposal: the question "is the stain what is flattening the eastern world, or is the
  // terrain art underneath it just as flat" cannot be answered by looking at one picture.
  // corruptAt is a function DECLARATION, so it is a window property and can be replaced; the
  // lexical-global rule that bites `let`/`const` does not apply to it.
  const NOCOR=Q.get('nc')==='1';
  // `?nt=1` renders with the per-band TONE WASH removed. _bandTone is a flat fillRect painted over
  // every ground tile of bands 0/7/8/9 to correct a PixelLab palette that came back wrong -- and
  // it is applied outside the atlas fallback branch, so it lands on the newer terr_N atlases too,
  // whether or not those needed correcting.
  const NOTONE=Q.get('nt')==='1';
  const tag=(s)=>{ const el=document.getElementById('shotlabel'); if(el) el.textContent=s; };

  function openGround(cx,cy){
    // The QA note that matters: place the player in VERIFIED open ground. A spiral out from the
    // province centre, in tiles, taking the first non-solid cell.
    // AND NOT WATER. `solid()` does not refuse shallows, so the first two attempts at this
    // harness photographed the sea twice and called it terrain.
    const G=curRoom&&curRoom.grid;
    const wet=(tx,ty)=>{ const r=G&&G[ty|0]; const c=r&&r[tx|0]; return c==='w'||c==='W'; };
    for(let r=0;r<40;r++){
      for(let a=0;a<Math.max(1,r*8);a++){
        const th=a/Math.max(1,r*8)*6.2832;
        const txf=cx+Math.cos(th)*r, tyf=cy+Math.sin(th)*r;
        const x=(txf+0.5)*TILE, y=(tyf+0.5)*TILE;
        if(x>TILE&&y>TILE&&!solid(x,y)&&!wet(txf,tyf)) return {x:x,y:y};
      }
    }
    return {x:(cx+0.5)*TILE, y:(cy+0.5)*TILE};
  }

  function go(){
    try{
      users['_shot']={pass:'x',chars:[{name:'Shot',cls:'knight',inv:[],
        rpg:{lvl:50,xp:0,wpn:8,arm:8,helm:8}}],cur:0,mats:{},vault:[]};
      curUser='_shot';
      play();                       // a real run, so every system is in the state it ships in
      devTeleport('G');             // the radial overworld
      // FREEZE THE WORLD, NOT THE FRAMES. The live loop must not keep simulating underneath the
      // harness -- it walked the hero into a portal AFTER the harness returned and three shots of
      // the Hearth came back labelled as overworld provinces. The original fix was to no-op
      // requestAnimationFrame, and it is why this tool produced a black picture for its whole life:
      //
      //   A 2D CANVAS ONLY REACHES THE SCREENSHOT THROUGH A COMPOSITED FRAME. Killing rAF kills
      //   loop(), and with it every future frame, so `chrome --screenshot` captured a compositor
      //   frame from BEFORE the harness drew. The canvas bitmap was correct the entire time --
      //   getImageData at the centre read (60,64,86) while the PNG showed near-black, and
      //   elementFromPoint confirmed nothing was covering it. The DOM label appeared because text
      //   paints on its own path, which is exactly what made the failure look like a render bug.
      //   tools/shot.py never had this problem because it never touched rAF.
      //
      // So: leave rAF alone and stub UPDATE instead. loop() keeps calling render() and keeps
      // producing real frames; nothing advances the simulation. The harness drives the placement
      // frames it needs through a private reference to the real one.
      const _upd=(typeof update==='function')?update:null;
      window.update=function(){};
      const _step=(dt)=>{ if(_upd) _upd(dt); };
      const T=_territories(curRoom);
      const t=T[Math.max(0,Math.min(T.length-1,ZI))];
      // `?ox=&oy=` walk the sample point across the SAME province, in tiles. Standing still and
      // re-rendering cannot show a drift that is designed to happen over tens of tiles -- the
      // question "does this province vary across itself" needs more than one place in it.
      const OX=parseInt(Q.get('ox')||'0',10), OY=parseInt(Q.get('oy')||'0',10);
      // `?seam=1` hunts for a province BOUNDARY and stands on it, because the blend between two
      // grounds is the one thing that cannot be judged from the middle of a province.
      let bx=t.cx+OX, by=t.cy+OY;
      if(Q.get('seam')==='1'){
        const b0=grvBandXY(t.cx,t.cy);
        let best=null;
        for(let r=6;r<90&&!best;r+=2){
          for(let a=0;a<r*6;a++){
            const th=a/(r*6)*6.2832;
            const sx=Math.round(t.cx+Math.cos(th)*r), sy=Math.round(t.cy+Math.sin(th)*r);
            if(sx<2||sy<2||sx>=curRoom.w-2||sy>=curRoom.h-2) continue;
            if(grvBandXY(sx,sy)!==b0 && !solid((sx+0.5)*TILE,(sy+0.5)*TILE)){ best={x:sx,y:sy}; break; }
          }
        }
        if(best){ bx=best.x; by=best.y; }
      }
      let p=openGround(bx,by);
      // `?lair=N&dens=all` stands at boss N's lair GATE instead of the province centre, which is the
      // only way to photograph the arena staging: drawLairs only draws it within rx+900 of the lair,
      // and a province centroid is further off than that once LAIR_NUDGE has pushed the lair clear
      // of the map label.
      const LI=Q.get('lair');
      if(LI!==null && curRoom.lairs && curRoom.lairs[LI|0] && curRoom.lairs[LI|0].gate){
        const gt=curRoom.lairs[LI|0].gate;
        if(Q.get('dens')==='all' && typeof openDen==='function'){
          const n=(typeof GBOSS!=='undefined')?GBOSS.length:0;
          for(let i=0;i<n;i++) openDen(i); }
        // stand back from the gate so the whole doorway is in frame rather than under the hero.
        // The camera centres on the player, so this offset is also how far off-centre the gate sits.
        p={x:gt.x-Math.cos(gt.a)*150, y:gt.y-Math.sin(gt.a)*150};
      }
      player.x=p.x; player.y=p.y;
      const roomBefore=curRoom;
      _step(0.016);
      // re-check the room did not change under the placement -- crossing a boundary teleports the
      // player thousands of px and every frame after it is of somewhere else entirely
      if(curRoom!==roomBefore){ tag('ROOM CHANGED — placement rejected'); return; }
      // CROSSING THE BRIDGE RAISES THE PERMADEATH MODAL, which dims the whole world behind it --
      // three of the first fourteen shots came back flat black and looked like broken terrain.
      // Mark it seen and close it, the same two things the I UNDERSTAND button does.
      rpg.hcSeen=1;
      const hc=document.getElementById('hcScr'); if(hc) hc.style.display='none';
      if(NOCOR) window.corruptAt=function(){ return 0; };
      if(NOTONE && typeof _bandTone!=='undefined'){ for(const k in _bandTone) delete _bandTone[k]; }
      if(Q.get('noblend')==='1') window._noBlend=1;   // isolate the seam crossfade from the warp
      // AND KEEP CHECKING. Checking the room once after the first update is not enough: a portal
      // the placement happened to land on fires during the SETTLE frames, and three provinces came
      // back showing the Hearth's cobbles while the numbers underneath them were reported as a
      // 167% improvement in terrain variation. A shot of the wrong room is worse than no shot.
      for(let i=0;i<30;i++){
        _step(0.016);
        if(curRoom!==roomBefore){ tag('ROOM CHANGED at settle frame '+i+' — placement rejected'); return; }
      }
      const band=grvBandAt(player.x/TILE, player.y/TILE);
      const lv=Math.round(grvLvAt(player.x/TILE, player.y/TILE));
      // The DOM chrome can be hidden by id; the orbs, banner and minimap are drawn INSIDE render()
      // on the canvas and cannot be. That is why tools/terrshot.py crops a clean strip rather than
      // trusting this to give it an empty screen.
      if(!HUD){ for(const id of ['hudTop','hudBot','hud','menuBtn','devBtn2','flasks','invBtn']){
          const e=document.getElementById(id); if(e) e.style.display='none'; } }
      // render() here is for the frame-cost measurement below and to get one frame in immediately;
      // the live loop is what actually keeps the composited frame current for the screenshot.
      // NOTE: resize() ends with `cv.width=...`, which resets the bitmap, and 01_constants queues it
      // at +150/+600/+900ms. That was a suspect and is NOT a problem while the loop runs, because
      // the next frame repaints straight over it. Do not stub resize -- it also owns the portrait
      // gate, and stubbing it was measured to fix nothing.
      render();
      // Frame cost, because every one of these ground passes is per-tile per-frame and the honest
      // way to know what a noise octave costs is to time it rather than to reason about it.
      const t0=performance.now(); for(let i=0;i<20;i++) render();
      const ms=(performance.now()-t0)/20;
      // `?diag=1` ADDS THE FIELDS THAT FOUND THE BLANK-CANVAS BUG. Kept, opt-in, because a dead
      // canvas and a correctly-labelled dead canvas are indistinguishable without them:
      //   buf/css/W-H  drawing buffer vs laid-out element -- resize() derives one from the other,
      //                so an unlaid-out canvas draws nothing while every name still reads right
      //   set/terr     atlas naturalWidth and .complete, because drawAtlas silently returns false
      //                unless BOTH hold. (_groundSet[b] is one Image, not a list -- reading .length
      //                printed 0 for a perfectly good atlas and cost a detour.)
      //   top          elementFromPoint at screen centre. Every overlay here is a translucent
      //                near-black panel, so one left visible looks exactly like a dead canvas.
      //   px           getImageData at the canvas centre -- THE decisive field. It read (60,64,86)
      //                while the PNG was near-black, which proved the bitmap was correct and the
      //                fault was that no composited frame ever reached the screenshot.
      const _cv=document.querySelector('canvas');
      let _lab='z'+ZI+'  '+t.name+'   band '+band+'   Lv'+lv+'   render '+ms.toFixed(2)+'ms';
      if(Q.get('diag')==='1'){
        _lab+='   buf '+(_cv?(_cv.width+'x'+_cv.height):'none')
          +'   css '+(_cv?(_cv.clientWidth+'x'+_cv.clientHeight):'none')
          +'   W/H '+(typeof W!=='undefined'?W+'/'+H:'?')
          +'   set '+((typeof _groundSet!=='undefined'&&_groundSet[band])?(_groundSet[band].naturalWidth+'w/'+_groundSet[band].complete):'none')
          +'   terr '+((typeof _terrSet!=='undefined'&&_terrSet[band])?(_terrSet[band].naturalWidth+'w/'+_terrSet[band].complete):'none')
          +'   top '+(function(){ try{ const e=document.elementFromPoint((_cv?_cv.clientWidth:1264)/2,
                (_cv?_cv.clientHeight:625)/2); return e?(e.tagName+'#'+(e.id||'-')):'null'; }catch(e){ return 'err'; } })()
          +'   px '+(function(){ try{ const d=ctx.getImageData(Math.round((_cv?_cv.width:0)/2),
                Math.round((_cv?_cv.height:0)/2),1,1).data; return d[0]+','+d[1]+','+d[2]; }catch(e){ return 'err'; } })(); }
      tag(_lab);
    }catch(e){
      tag('SHOT THREW: '+(e&&e.message));
    }
  }
  if(document.readyState==='complete') setTimeout(go,900);
  else window.addEventListener('load',()=>setTimeout(go,900));
})();
