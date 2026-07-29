// SCREENSHOT HARNESS. Puts a hero on real overworld ground in one named territory and lets the
// real render() draw it, so a change to the terrain can be LOOKED AT instead of argued about.
//
// Read-only with respect to content: it stands up a throwaway account in memory (never saved),
// walks to a province centre and steps frames. `?z=N` picks the territory index, `?hud=0` hides
// the HUD so the ground is not covered by orbs.
//
// Run it with `py tools/shot.py <index>`; the page is captured with chrome --screenshot.
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
      const T=_territories(curRoom);
      const t=T[Math.max(0,Math.min(T.length-1,ZI))];
      const p=openGround(t.cx,t.cy);
      player.x=p.x; player.y=p.y;
      const roomBefore=curRoom;
      update(0.016);
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
      for(let i=0;i<30;i++) update(0.016);
      const band=grvBandAt(player.x/TILE, player.y/TILE);
      const lv=Math.round(grvLvAt(player.x/TILE, player.y/TILE));
      // The DOM chrome can be hidden by id; the orbs, banner and minimap are drawn INSIDE render()
      // on the canvas and cannot be. That is why tools/shot.py crops a clean strip rather than
      // trusting this to give it an empty screen.
      if(!HUD){ for(const id of ['hudTop','hudBot','hud','menuBtn','devBtn2','flasks','invBtn']){
          const e=document.getElementById(id); if(e) e.style.display='none'; } }
      render();
      tag('z'+ZI+'  '+t.name+'   band '+band+'   Lv'+lv);
    }catch(e){
      tag('SHOT THREW: '+(e&&e.message));
    }
  }
  if(document.readyState==='complete') setTimeout(go,900);
  else window.addEventListener('load',()=>setTimeout(go,900));
})();
