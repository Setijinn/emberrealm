// ---------- touch controls (twin stick) ----------
const stick={move:{id:null,ox:0,oy:0,dx:0,dy:0}, aim:{id:null,ox:0,oy:0,dx:0,dy:0}};
function stickFor(x){ return x<W/2? stick.move : stick.aim; }
addEventListener('pointerdown',e=>{
  const s=stickFor(e.clientX);
  if(s.id!==null) return;
  s.id=e.pointerId; s.ox=e.clientX; s.oy=e.clientY; s.dx=0; s.dy=0;
});
addEventListener('pointermove',e=>{
  for(const k of ['move','aim']){ const s=stick[k];
    if(s.id===e.pointerId){
      s.dx=e.clientX-s.ox; s.dy=e.clientY-s.oy;
      const d=Math.hypot(s.dx,s.dy);
      if(d>50){ s.dx*=50/d; s.dy*=50/d; }
    } }
});
function endPointer(e){ for(const k of ['move','aim']){ const s=stick[k];
  if(s.id===e.pointerId){ s.id=null; s.dx=0; s.dy=0; } } }
addEventListener('pointerup',endPointer);
addEventListener('pointercancel',endPointer);
