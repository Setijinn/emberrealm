// ---------- constants ----------
const TILE=44;
const LV_CAP=50;   // level cap (world rework: was 150). Everything level-scaled keys off this.
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
function resize(){
  // Let CSS (position:fixed, 100dvw x 100dvh, viewport-fit=cover) decide the on-screen box —
  // that spans the full landscape screen edge-to-edge — and read it straight back so the
  // drawing buffer matches EXACTLY. Sizing H from visualViewport.height (as before) left the
  // canvas short of the safe-area / toolbar strip in Safari landscape, and the near-black page
  // background showed through as a band along the bottom. Measuring the element can't do that:
  // whatever the browser paints as full-screen IS the buffer. _vp* stay as the 0-fallback.
  W = cv.clientWidth || _vpW();
  H = cv.clientHeight || _vpH();
  cv.width=Math.round(W*DPR); cv.height=Math.round(H*DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0); ctx.imageSmoothingEnabled=false;
  document.getElementById('rotate').style.display = H>W ? 'flex':'none'; }
resize(); addEventListener('resize',resize);
// re-measure once the mobile viewport settles (address bar collapse etc.)
addEventListener('load',()=>{ resize(); setTimeout(resize,150); setTimeout(resize,600); });
// Mobile viewport metrics settle a few frames LATE after a rotation, and later still if the
// rotation happens WHILE the app is loading — a single 300ms re-measure could catch a stale value
// and leave the canvas short (a black band along the bottom in landscape). Re-measure on a burst.
addEventListener('orientationchange',()=>{ resize(); for(const d of [80,200,350,550,800,1200]) setTimeout(resize,d); });
// Entering/leaving fullscreen changes the visible area but the viewport metrics settle a
// few frames LATER on mobile — re-measure across the transition. This is the correction
// that orientationchange used to provide by accident, and it fires whether or not the
// phone was rotated, so opening the game already sideways is covered too.
for(const ev of ['fullscreenchange','webkitfullscreenchange']) addEventListener(ev,()=>{
  resize(); setTimeout(resize,120); setTimeout(resize,400); setTimeout(resize,900); });
addEventListener('visibilitychange',()=>{ if(!document.hidden){ resize(); setTimeout(resize,200); } });
if(window.visualViewport){ visualViewport.addEventListener('resize',resize); visualViewport.addEventListener('scroll',resize); }
// safety net: some in-app viewers never fire events — poll every frame
function checkSize(){ if((cv.clientWidth||_vpW())!==W||(cv.clientHeight||_vpH())!==H) resize(); }
// Boot heal: the per-frame checkSize() only starts once the main loop is running, and a rotation
// mid-load can leave the canvas sized to the stale/portrait viewport before then. Poll for the
// first few seconds (independent of the loop) so a rotate-while-loading always heals the black
// band once the landscape metrics settle. Uses checkSize (no needless canvas clears).
(function _bootHeal(n){ checkSize(); if(n<50) setTimeout(()=>_bootHeal(n+1),100); })(0);

// ---------- build id ----------
// A playtester has to be able to say which build they are on, and sw.js's CACHE is the only
// version string that exists anywhere. Do NOT duplicate it into a constant here: HANDOFF
// already makes bumping CACHE a per-commit ritual, and a second thing to bump WILL drift —
// a version tag that lies is worse than no tag at all. So read it back out of the Cache
// Storage API, which the page can see from window scope on any secure context (the live
// site, and localhost for dev). That makes sw.js the single source of truth.
// No service worker yet (fresh local port, very first load) leaves it 'dev' — the honest
// answer, since on those the code came straight off the wire.
// ---------------------------------------------------------------------------------------------
// MOVE_SCALE (user: "lower the move speed of everything in the game").
// ONE dial, applied to locomotion only. Everything that walks is scaled by it and nothing else is
// -- projectile speeds, telegraph timers, fire cadence, dash DISTANCES and knockback impulses all
// stay exactly as they were, because those are not movement speed and slowing them would quietly
// re-tune every boss window in the game.
// Applied uniformly to the hero and to everything hostile, so the relative footrace is unchanged:
// the game gets heavier and more deliberate, it does not get easier or harder. The one place it
// lands unevenly is the ambient wildlife, which is scaled too simply because it would look odd
// striding past a slowed hero.
const MOVE_SCALE = 0.80;

let BUILD='dev';
function paintBuildTag(){ for(const el of document.querySelectorAll('.bTag')) el.textContent='build '+BUILD; }
function _readBuild(){
  if(!self.caches) return;                       // insecure context — no Cache Storage at all
  caches.keys().then(ks=>{
    // Between a new SW's install and its activate BOTH caches exist, so take the highest.
    // sw.js now keeps TWO caches -- code and art -- versioned separately so a code bump stops
    // evicting 38MB of art. The build a tester is on is the CODE one; the art version moves
    // only when art does and would be a misleading thing to report. Old single-cache names
    // (emberrealm-v###) are still matched so a client mid-upgrade reports something sane.
    const vs=ks.map(n=>{ const m=/^emberrealm-(?:code-)?v(\d+)$/.exec(n); return m?parseInt(m[1],10):NaN; })
               .filter(n=>!isNaN(n)).sort((a,b)=>b-a);
    if(vs.length) BUILD='v'+vs[0];
    paintBuildTag();
  }).catch(()=>{});
}
paintBuildTag(); _readBuild();
