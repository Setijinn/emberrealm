// A NEW BUILD MUST NEVER RELOAD YOU MID-RUN.
// This used to call location.reload() the moment a new service worker activated, which on a fresh
// visit is one to three seconds in -- right after you had picked a character. It read as the game
// refreshing itself for no reason, and on a permadeath run it is worse than rude. The reload is
// still automatic, it just waits for a moment when you are not holding anything: not in a run, and
// not still behind the loading curtain.
window.__emberReloadPending = false;
function _emberApplyUpdate(){
  if(window.__emberReloadPending===false && window.inGame){ window.__emberReloadPending=true; return; }
  if(window.inGame) return;                       // already queued; wait for a safe moment
  location.reload();
}
// called by the menu when a run ends or the player steps out of one (11_ui.js)
window.emberReloadIfPending = function(){
  if(window.__emberReloadPending && !window.inGame){ location.reload(); return true; }
  return false;
};
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').then(function(reg){
  reg.update().catch(function(){});   // check for a newer build right away on load
  // auto-reload when a new version activates so players always get the latest build
  reg.addEventListener('updatefound', function(){
    var nw = reg.installing; if(!nw) return;
    nw.addEventListener('statechange', function(){
      if(nw.state==='activated' && navigator.serviceWorker.controller) _emberApplyUpdate();
    });
  });
  // check for a new build whenever the tab regains focus
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) reg.update().catch(function(){}); });
}).catch(function(){});
document.addEventListener('pointerdown', async function lockOnce(e){
  if(e.pointerType==='mouse') return;   // PC play: never force fullscreen/orientation on a click
  // settings: "Fullscreen on touch" can be disabled (er-opts is written by 11_ui.js)
  try{ var _o=JSON.parse(localStorage.getItem('er-opts')||'{}'); if(_o&&_o.fs===false) return; }catch(err){}
  document.removeEventListener('pointerdown', lockOnce);
  try{
    if(!document.fullscreenElement && document.documentElement.requestFullscreen)
      await document.documentElement.requestFullscreen();
    if(screen.orientation && screen.orientation.lock)
      await screen.orientation.lock('landscape');
  }catch(e){}
});
