if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').then(function(reg){
  reg.update().catch(function(){});   // check for a newer build right away on load
  // auto-reload when a new version activates so players always get the latest build
  reg.addEventListener('updatefound', function(){
    var nw = reg.installing; if(!nw) return;
    nw.addEventListener('statechange', function(){
      if(nw.state==='activated' && navigator.serviceWorker.controller) location.reload();
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
