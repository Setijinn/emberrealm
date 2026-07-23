// ---------- constants ----------
const TILE=44;
let UIS=1;   // global UI scale factor — set from device settings (er-opts) in 11_ui.js
const cv=document.getElementById('cv'), ctx=cv.getContext('2d');
let W=0,H=0,DPR=Math.min(devicePixelRatio||1,2);
// Use the visual viewport (the actually-visible area) so the drawing buffer always
// matches what's on screen — avoids the mobile 100vh/innerHeight mismatch that shifted
// the picture up with a black bar at the bottom on load.
function _vpW(){ const vv=window.visualViewport; return Math.round(vv?vv.width:innerWidth); }
function _vpH(){ const vv=window.visualViewport; return Math.round(vv?vv.height:innerHeight); }
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
if(window.visualViewport){ visualViewport.addEventListener('resize',resize); visualViewport.addEventListener('scroll',resize); }
// safety net: some in-app viewers never fire events — poll every frame
function checkSize(){ if(_vpW()!==W||_vpH()!==H) resize(); }
