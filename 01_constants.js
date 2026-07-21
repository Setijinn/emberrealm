// ---------- constants ----------
const TILE=44;
const cv=document.getElementById('cv'), ctx=cv.getContext('2d');
let W=0,H=0,DPR=Math.min(devicePixelRatio||1,2);
function resize(){W=innerWidth;H=innerHeight;cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0); ctx.imageSmoothingEnabled=false;
  document.getElementById('rotate').style.display = H>W ? 'flex':'none';}
resize(); addEventListener('resize',resize);
addEventListener('orientationchange',()=>setTimeout(resize,300));
if(window.visualViewport) visualViewport.addEventListener('resize',resize);
// safety net: some in-app viewers never fire resize — poll every frame
function checkSize(){ if(innerWidth!==W||innerHeight!==H) resize(); }
