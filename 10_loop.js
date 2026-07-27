// ---------- loop ----------

let last=performance.now();
// The banner used to show the FIRST error and then go silent forever, which made a recurring
// fault look like a single mystery and hid whatever actually broke second. It shows each DISTINCT
// error once now, with the first stack frame and a repeat count, because "the game crashed" is
// not a bug report and this is what turns it into one.
let errShown=false, _errSeen={}, _errBox=null;
function showErr(e){
 try{
  const msg=(e&&e.message)?e.message:(''+e);
  const at=(e&&e.stack)?((e.stack.split('\n')[1]||'').trim().slice(0,90)):'';
  const key=msg+'|'+at;
  if(_errSeen[key]){ _errSeen[key].n++;
    if(_errSeen[key].el) _errSeen[key].el.textContent='⚠ '+msg+(at?('  — '+at):'')+'  ×'+_errSeen[key].n;
    return; }
  errShown=true;
  if(!_errBox){ _errBox=document.createElement('div');
    _errBox.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99;max-height:40vh;overflow:auto;'
      +'background:#7a1f1f;color:#fff;font:12px monospace;padding:4px 10px;';
    _errBox.onclick=function(){ _errBox.remove(); _errBox=null; _errSeen={}; errShown=false; };
    document.body.appendChild(_errBox); }
  const row=document.createElement('div');
  row.textContent='⚠ '+msg+(at?('  — '+at):'');
  _errBox.appendChild(row);
  _errSeen[key]={n:1, el:row};
 }catch(_){}}
window.addEventListener('error',function(ev){ showErr(ev.error||ev.message); });
function loop(now){ const dt=Math.min(0.05,(now-last)/1000); last=now;
  checkSize();
  if(W>H&&inGame){
    try{ update(dt); }catch(e){ showErr(e); }
    try{ render(); }catch(e){ showErr(e); }
  }
  requestAnimationFrame(loop); }
