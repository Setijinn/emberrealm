// ---------- controls ----------
// TOUCH: left half = move stick, right half = cast the armed ability at the tap.
// PC (auto-detected): WASD/arrows move, click casts at the cursor, 1/2/3 cast slots,
// E interact, Q potion, I equipment, K skills, L abilities, M map, Esc closes menus,
// Z/C rotate the camera view (hold, smooth), X snaps the view back to north.
// inputMode follows the LAST input used, so hybrid devices switch seamlessly.
let inputMode=(typeof matchMedia==='function' && matchMedia('(pointer:fine)').matches)?'pc':'touch';
function _setMode(m){ inputMode=m; if(document.body) document.body.classList.toggle('pcmode', m==='pc'); }
addEventListener('DOMContentLoaded',()=>_setMode(inputMode));
const stick={move:{id:null,ox:0,oy:0,dx:0,dy:0}};
const mouse={x:0,y:0};
function mouseWorld(){ return s2w(mouse.x,mouse.y); }
addEventListener('pointerdown',e=>{
  _setMode(e.pointerType==='touch'?'touch':'pc');
  if(!inGame || (inputMode==='touch' && W<=H)) return;
  if(e.target && e.target!==cv) return;      // taps on HUD buttons handle themselves
  // minimap zoom buttons sit in the top-left corner and must not also fire a shot
  if(typeof miniHit==='function'){ const mh=miniHit(e.clientX,e.clientY);
    if(mh){ if(mh==='in') miniZoomIn(); else miniZoomOut(); return; } }
  // the floating USE prompt (portal/pillar) takes top precedence
  if(typeof hitPortalPrompt==='function' && hitPortalPrompt(e.clientX,e.clientY)){
    if(typeof usePortalPrompt==='function') usePortalPrompt(); return; }
  // the ULT button fires on press — no arming, no aiming (rule 5b: a thumb must manage it)
  if(typeof hitUltButton==='function' && hitUltButton(e.clientX,e.clientY)){ castUlt(); return; }
  // ability loadout buttons (bottom-left) take precedence: tap to arm a slot
  if(typeof hitAbilButton==='function'){ const hs=hitAbilButton(e.clientX,e.clientY);
    if(hs>=0){ armSlot(hs); return; } }
  if(e.pointerType!=='touch'){
    // mouse/pen: ANY canvas click casts at the cursor (movement is on the keyboard)
    if(typeof doAbility==='function'){ const mw=s2w(e.clientX,e.clientY); doAbility(mw.x,mw.y); }
    return;
  }
  if(e.clientX < W/2){
    if(stick.move.id!==null) return;
    const s=stick.move; s.id=e.pointerId; s.ox=e.clientX; s.oy=e.clientY; s.dx=0; s.dy=0;
  } else {
    // cast the armed ability; pass the tapped point in world space for aimed abilities
    if(typeof doAbility==='function'){ const mw=s2w(e.clientX,e.clientY); doAbility(mw.x,mw.y); }
  }
});
addEventListener('pointermove',e=>{ const s=stick.move;
  if(s.id===e.pointerId){
    s.dx=e.clientX-s.ox; s.dy=e.clientY-s.oy;
    const d=Math.hypot(s.dx,s.dy);
    if(d>50){ s.dx*=50/d; s.dy*=50/d; }
  }
});
function endPointer(e){ const s=stick.move; if(s.id===e.pointerId){ s.id=null; s.dx=0; s.dy=0; } }
addEventListener('pointerup',endPointer);
addEventListener('pointercancel',endPointer);

// ---------- keyboard (PC) ----------
const keys={};
addEventListener('pointermove',e=>{ if(e.pointerType!=='touch'){ mouse.x=e.clientX; mouse.y=e.clientY; } });
addEventListener('keydown',e=>{
  if(e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;   // never swallow typing in fields
  if(!e.key) return;   // synthetic/IME events can arrive without a key
  _setMode('pc');
  const k=e.key.toLowerCase(); keys[k]=true;
  if(e.repeat) return;
  if(k==='escape'){
    if(typeof closeSkills==='function' && (document.getElementById('skillScr')||{}).style && document.getElementById('skillScr').style.display==='flex') closeSkills();
    if(typeof closeBagPanel==='function') closeBagPanel();
    for(const id of ['invScr','loadScr','shopScr','bagScr','aucScr']){ const el=document.getElementById(id);
      if(el && el.style.display && el.style.display!=='none') el.style.display='none'; }
    return;
  }
  if(!inGame) return;
  if(k==='1'||k==='2'||k==='3'){
    if(typeof armSlot==='function') armSlot(+k-1);
    const mw=mouseWorld(); if(typeof doAbility==='function') doAbility(mw.x,mw.y);
  }
  // R was the ultimate; it is the Hearth recall now (user request), so the ult keeps 4 only
  else if(k==='4'){ if(typeof castUlt==='function') castUlt(); }    // ascension ultimate
  else if(k==='e'){ if(typeof portalPrompt!=='undefined' && portalPrompt && typeof usePortalPrompt==='function') usePortalPrompt(); }
  else if(k==='q'){ const b=document.getElementById('potBtn'); if(b) b.click(); }
  else if(k==='i'||k==='b'){ const b=document.getElementById('invBtn'); if(b) b.click(); }
  else if(k==='k'){ const b=document.getElementById('skillBtn'); if(b) b.click(); }
  else if(k==='l'){ const b=document.getElementById('loadBtn'); if(b) b.click(); }
  // the map BUTTON is gone (there is a live minimap in the corner now); M still opens the big map
  else if(k==='m'){ const sc=document.getElementById('mapScr');
    if(sc){ if(sc.style.display==='flex'){ if(typeof closeMap==='function') closeMap(); }
      else { sc.style.display='flex'; if(typeof drawMap==='function') drawMap();
        if(typeof mapInt!=='undefined'&&!mapInt) mapInt=setInterval(drawMap,220); } } }
  else if(k==='h'||k==='r'){ const b=document.getElementById('hearthBtn'); if(b) b.click(); }   // recallhome
});
addEventListener('keyup',e=>{ if(e.key) keys[e.key.toLowerCase()]=false; });
// normalized WASD/arrow vector, consumed by update() when the touch stick is idle.
// Screen-relative: with the camera rotated, "up" still moves toward the top of the screen.
function keyMove(){ let x=0,y=0;
  if(keys['a']||keys['arrowleft'])x--; if(keys['d']||keys['arrowright'])x++;
  if(keys['w']||keys['arrowup'])y--;   if(keys['s']||keys['arrowdown'])y++;
  if(!x&&!y) return null; const d=Math.hypot(x,y); x/=d; y/=d;
  if(typeof camRot!=='undefined' && camRot){ const c=Math.cos(-camRot), s=Math.sin(-camRot);
    return {x:x*c-y*s, y:x*s+y*c}; }
  return {x:x, y:y}; }
