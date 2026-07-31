// ---------- controls ----------
// TOUCH: left half = move stick, right half = cast the armed ability at the tap.
// PC (auto-detected): WASD/arrows move, click casts at the cursor, 1/2/3 cast slots,
// E interact, F take loot, Q tonic, G mana flask, I targeting mode, B satchel, K skills, L abilities, M map, Esc closes menus,
// Z/C rotate the camera view (hold, smooth), X snaps the view back to north.
// inputMode follows the LAST input used, so hybrid devices switch seamlessly.
let inputMode=(typeof matchMedia==='function' && matchMedia('(pointer:fine)').matches)?'pc':'touch';
function _setMode(m){ inputMode=m; if(document.body) document.body.classList.toggle('pcmode', m==='pc'); }
addEventListener('DOMContentLoaded',()=>_setMode(inputMode));
// ---------- iOS zoom lockout ----------
// A zoom in the middle of a fight is unrecoverable: the viewport stays scaled, the thumb stick is
// off its origin, and there is no gesture to undo it one-handed. CSS touch-action kills double-tap
// on every element (see style.css), and these two cover what CSS cannot:
//   * gesturestart/change/end are WebKit-only pinch events, unaffected by touch-action.
//   * a canvas double-tap on iOS <13, which predates touch-action support.
// The double-tap guard is scoped to the canvas ON PURPOSE. preventDefault on touchend also
// suppresses the synthesised click, so applying it to the HUD would eat the second tap of a
// potion-mash. Canvas input runs on pointerdown, which preventDefault here cannot touch.
for(const g of ['gesturestart','gesturechange','gestureend'])
  addEventListener(g,e=>e.preventDefault(),{passive:false});
let _lastTap=0,_lastTapX=0,_lastTapY=0;
addEventListener('touchend',e=>{
  if(!e.target || e.target.tagName!=='CANVAS') return;
  const t=e.changedTouches&&e.changedTouches[0]; if(!t) return;
  const now=performance.now();
  if(now-_lastTap<320 && Math.hypot(t.clientX-_lastTapX,t.clientY-_lastTapY)<44) e.preventDefault();
  _lastTap=now; _lastTapX=t.clientX; _lastTapY=t.clientY;
},{passive:false});
addEventListener('dblclick',e=>{ if(e.target&&e.target.tagName==='CANVAS') e.preventDefault(); },{passive:false});

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
  // the floating prompts take top precedence. TAKE is tested first: it is the smaller, lower
  // button, so if the two ever overlap the tap should belong to the one you had to aim at.
  if(typeof hitLootPrompt==='function' && hitLootPrompt(e.clientX,e.clientY)){
    if(typeof useLootPrompt==='function') useLootPrompt(); return; }
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
    for(const id of ['invScr','loadScr','shopScr','bagScr','aucScr','bntScr','dmdScr','wrdScr']){ const el=document.getElementById(id);
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
  // E uses the world (portal, pillar, stall, switch); F takes loot. Two keys because they are two
  // different mistakes to make: walking into a dungeon when you meant to open a sack costs a run.
  else if(k==='e'){ if(typeof portalPrompt!=='undefined' && portalPrompt && typeof usePortalPrompt==='function') usePortalPrompt(); }
  else if(k==='f'){ if(typeof lootPrompt!=='undefined' && lootPrompt && typeof useLootPrompt==='function') useLootPrompt(); }
  // two flasks, two keys -- Q heals, G restores mana. Separate stocks, separate decisions.
  else if(k==='q'){ const b=document.getElementById('potBtn'); if(b) b.click(); }
  else if(k==='g'){ const b=document.getElementById('mpotBtn'); if(b) b.click(); }
  // I is TARGETING MODE now (user). The satchel keeps B, which it already answered to -- so
  // nothing lost a binding, one just stopped having two.
  else if(k==='i'){ if(typeof cycleTargetMode==='function') cycleTargetMode(); }
  else if(k==='b'){ const b=document.getElementById('invBtn'); if(b) b.click(); }
  else if(k==='k'){ const b=document.getElementById('skillBtn'); if(b) b.click(); }
  else if(k==='l'){ const b=document.getElementById('loadBtn'); if(b) b.click(); }
  // the map BUTTON is gone (there is a live minimap in the corner now); M still opens the big map
  else if(k==='m'){ const sc=document.getElementById('mapScr');
    if(sc){ if(sc.style.display==='flex'){ if(typeof closeMap==='function') closeMap(); }
      else { sc.style.display='flex'; if(typeof drawMap==='function') drawMap();
        if(typeof mapInt!=='undefined'&&!mapInt) mapInt=setInterval(drawMap,220); } } }
  else if(k==='h'||k==='r'){ const b=document.getElementById('hearthBtn'); if(b) b.click(); }   // recallhome
  // V mounts and dismounts. Z/X/C are the camera, so V is the only free key still under the hand
  // that is holding WASD — every other spare letter is on the right of the board and would mean
  // letting go of movement to get on a horse.
  else if(k==='v'){ if(typeof mountToggle==='function') mountToggle(); }
  // F lands a flyer, or puts it back up. Deliberately a separate key from V: dismounting in the air
  // is refused anyway, so one key that means both "get off" and "come down" would refuse half the
  // time and teach the player nothing.
  else if(k==='f'){ if(typeof mountToggleFlight==='function') mountToggleFlight(); }
});
addEventListener('keyup',e=>{ if(e.key) keys[e.key.toLowerCase()]=false; });
// A KEYUP YOU NEVER RECEIVE LEAVES YOU WALKING. Alt-tab, a notification or an OS overlay while
// holding a direction sends the keyup to the window that took focus, so `keys` kept that key true
// and keyMove() returned a permanent vector -- the hero walked into a wall until you pressed and
// released the key again. Under permadeath that is run-ending, so drop everything held on any
// loss of focus and let the player re-press.
function _releaseAllKeys(){ for(const k in keys) keys[k]=false; }
addEventListener('blur', _releaseAllKeys);
document.addEventListener('visibilitychange', ()=>{ if(document.hidden) _releaseAllKeys(); });
// normalized WASD/arrow vector, consumed by update() when the touch stick is idle.
// Screen-relative: with the camera rotated, "up" still moves toward the top of the screen.
function keyMove(){ let x=0,y=0;
  if(keys['a']||keys['arrowleft'])x--; if(keys['d']||keys['arrowright'])x++;
  if(keys['w']||keys['arrowup'])y--;   if(keys['s']||keys['arrowdown'])y++;
  if(!x&&!y) return null; const d=Math.hypot(x,y); x/=d; y/=d;
  if(typeof camRot!=='undefined' && camRot){ const c=Math.cos(-camRot), s=Math.sin(-camRot);
    return {x:x*c-y*s, y:x*s+y*c}; }
  return {x:x, y:y}; }
