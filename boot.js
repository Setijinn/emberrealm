// A NEW BUILD MUST NEVER RELOAD YOU MID-RUN.
// This used to call location.reload() the moment a new service worker activated, which on a fresh
// visit is one to three seconds in -- right after you had picked a character. It read as the game
// refreshing itself for no reason, and on a permadeath run it is worse than rude. The reload is
// still automatic, it just waits for a moment when you are not holding anything: not in a run, and
// not still behind the loading curtain.
// `inGame` IS NOT ON window, AND NEVER WAS. 11_ui.js:2 declares it `let inGame=false;` at the top
// level of a classic script, and a top-level `let` creates a lexical binding in the script scope --
// NOT a property of the global object, the way `var` would. Measured in the real page:
// `('inGame' in window) === false`, `window.inGame === undefined`. So every guard below read
// undefined, every one was falsy, and this file has never deferred a single reload: it went
// straight to location.reload() on every service-worker activation, and emberReloadIfPending()
// could never return true because __emberReloadPending was never set. sw.js calls skipWaiting()
// and boot re-checks for a build on every visibilitychange, so the actual behaviour was: deploy,
// player app-switches back, tab reloads under them. Run state -- position, runLive/runChar, the
// world, the kill count, the dungeon layout -- is in memory only, so on a permadeath hero past the
// bridge that reload IS the run.
//
// Read the lexical binding directly instead. `typeof` first because boot.js loads BEFORE 11_ui.js,
// so on the very first activation the binding may not exist yet and a bare read would throw.
function _emberInGame(){ return (typeof inGame!=='undefined') && !!inGame; }
window.__emberReloadPending = false;
function _emberApplyUpdate(){
  if(window.__emberReloadPending===false && _emberInGame()){ window.__emberReloadPending=true; return; }
  if(_emberInGame()) return;                      // already queued; wait for a safe moment
  location.reload();
}
// called by the menu when a run ends or the player steps out of one (11_ui.js)
window.emberReloadIfPending = function(){
  if(window.__emberReloadPending && !_emberInGame()){ location.reload(); return true; }
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
