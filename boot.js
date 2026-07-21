if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
document.addEventListener('pointerdown', async function lockOnce(){
  document.removeEventListener('pointerdown', lockOnce);
  try{
    if(!document.fullscreenElement && document.documentElement.requestFullscreen)
      await document.documentElement.requestFullscreen();
    if(screen.orientation && screen.orientation.lock)
      await screen.orientation.lock('landscape');
  }catch(e){}
});
