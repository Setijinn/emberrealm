// ---------- controls ----------
// LEFT half of the screen = move stick.
// RIGHT half = one big invisible ability button (tap anywhere to cast).
// Aiming is automatic (nearest enemy) — there is no aim stick.
const stick={move:{id:null,ox:0,oy:0,dx:0,dy:0}};
addEventListener('pointerdown',e=>{
  if(!inGame || W<=H) return;
  if(e.target && e.target!==cv) return;      // taps on HUD buttons handle themselves
  if(e.clientX < W/2){
    if(stick.move.id!==null) return;
    const s=stick.move; s.id=e.pointerId; s.ox=e.clientX; s.oy=e.clientY; s.dx=0; s.dy=0;
  } else {
    if(typeof doAbility==='function') doAbility();
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
