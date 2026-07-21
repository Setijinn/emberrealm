// ---------- loop ----------

let last=performance.now();
let errShown=false;
function showErr(e){ if(errShown) return; errShown=true;
 try{ const d=document.createElement('div');
  d.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99;background:#7a1f1f;color:#fff;font:12px monospace;padding:6px 10px;';
  d.textContent='⚠ '+(e&&e.message?e.message:e);
  d.onclick=function(){d.remove();errShown=false;};
  document.body.appendChild(d);
 }catch(_){}}
window.addEventListener('error',function(ev){ showErr(ev.error||ev.message); });
function loop(now){ const dt=Math.min(0.05,(now-last)/1000); last=now;
  checkSize();
  if(W>H&&inGame){
    try{ update(dt); }catch(e){ showErr(e); }
    try{ render(); }catch(e){ showErr(e); }
  }
  requestAnimationFrame(loop); }
