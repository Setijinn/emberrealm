// ---------- constants ----------
const TILE=44;
let UIS=1;   // global UI scale factor — set from device settings (er-opts) in 11_ui.js
const cv=document.getElementById('cv'), ctx=cv.getContext('2d');
let W=0,H=0,DPR=Math.min(devicePixelRatio||1,2);
// Use the visual viewport (the actually-visible area) so the drawing buffer always
// matches what's on screen — avoids the mobile 100vh/innerHeight mismatch that shifted
// the picture up with a black bar at the bottom on load.
//
// ...EXCEPT when there is no browser chrome (fullscreen / installed PWA — the manifest
// asks for display:fullscreen). The canvas is position:fixed, so its box resolves against
// the LAYOUT viewport, which with viewport-fit=cover also spans the gesture-bar inset.
// visualViewport can report SHORTER than that: Android keeps handing back the
// pre-fullscreen height for a while after requestFullscreen(), and it can exclude the
// gesture inset. The canvas was then shorter than the area it sits in and the #0b0a10
// page background showed through as a black band along the bottom — and checkSize()
// could never heal it, because it re-read the same short value.
// Rotating AFTER load hid this (orientationchange forces a late re-measure); opening the
// game already sideways never fires that, so the band stayed for the whole session.
function _chromeless(){ return !!(document.fullscreenElement ||
  (window.matchMedia && (matchMedia('(display-mode: fullscreen)').matches ||
                         matchMedia('(display-mode: standalone)').matches))); }
function _vpW(){ const vv=window.visualViewport;
  let w=Math.round(vv?vv.width:innerWidth);
  const lay=Math.round(document.documentElement.clientWidth||innerWidth);
  if(lay>w && _chromeless()) w=lay;      // no chrome -> the layout viewport IS what you see
  return w; }
function _vpH(){ const vv=window.visualViewport;
  let h=Math.round(vv?vv.height:innerHeight);
  const lay=Math.round(document.documentElement.clientHeight||innerHeight);
  if(lay>h && _chromeless()) h=lay;
  return h; }
function resize(){ W=_vpW(); H=_vpH();
  cv.width=Math.round(W*DPR); cv.height=Math.round(H*DPR);
  // pin the element to exact px so the CSS box can never disagree with the buffer
  cv.style.width=W+'px'; cv.style.height=H+'px'; cv.style.right='auto'; cv.style.bottom='auto';
  ctx.setTransform(DPR,0,0,DPR,0,0); ctx.imageSmoothingEnabled=false;
  document.getElementById('rotate').style.display = H>W ? 'flex':'none'; }
resize(); addEventListener('resize',resize);
// re-measure once the mobile viewport settles (address bar collapse etc.)
addEventListener('load',()=>{ resize(); setTimeout(resize,150); setTimeout(resize,600); });
addEventListener('orientationchange',()=>setTimeout(resize,300));
// Entering/leaving fullscreen changes the visible area but the viewport metrics settle a
// few frames LATER on mobile — re-measure across the transition. This is the correction
// that orientationchange used to provide by accident, and it fires whether or not the
// phone was rotated, so opening the game already sideways is covered too.
for(const ev of ['fullscreenchange','webkitfullscreenchange']) addEventListener(ev,()=>{
  resize(); setTimeout(resize,120); setTimeout(resize,400); setTimeout(resize,900); });
addEventListener('visibilitychange',()=>{ if(!document.hidden){ resize(); setTimeout(resize,200); } });
if(window.visualViewport){ visualViewport.addEventListener('resize',resize); visualViewport.addEventListener('scroll',resize); }
// safety net: some in-app viewers never fire events — poll every frame
function checkSize(){ if(_vpW()!==W||_vpH()!==H) resize(); }
