// ---------- THE LOADING SCREEN ----------
// The realm used to appear before its art did. Every sprite is a plain <img> fetched on demand, so
// a fresh visit painted the world in whatever order the network happened to answer in: procedural
// fallbacks first, then stalls, tiles, heroes and item icons popping in over the next few seconds.
// It read as the game refreshing itself right after you picked a character.
//
// So nothing is shown until the art is in. Every image the boot scripts create registers itself in
// ASSET_IMGS (see _track in 08c_embersprites.js), and this waits on exactly that list -- no
// hand-maintained manifest to fall out of date when a new sprite table lands.
//
// It can never trap anyone: the wait is capped, a 404 counts as settled rather than as pending
// (an image that errored is never coming), and if the whole thing somehow throws the curtain comes
// up anyway. A player who cannot load art still gets to play with procedural fallbacks -- which is
// exactly what they had before this file existed.

const BOOT_MAX_WAIT = 12000;      // hard cap: the curtain always lifts, art or no art
const BOOT_MIN_SHOW = 350;        // don't flash the screen for one frame on a warm cache

(function(){
  if(typeof window==='undefined') return;
  const el=document.getElementById('bootScr');
  if(!el) return;
  const bar=document.getElementById('bootBar');
  const pct=document.getElementById('bootPct');
  const tip=document.getElementById('bootTip');
  const t0=Date.now();
  let done=false;

  // Something to read while it works. Picked once so it does not flicker between frames.
  const TIPS=[
    'Glory is paid only when a hero falls. A run banks nothing until you lose the one who earned it.',
    'Tier is the only power axis. Rarity just decides how many stats an item rolled.',
    'Public gear stops at T8. Anything above it is bound to whoever it dropped for.',
    'The bridge is the point of no return — cross it and death is permanent.',
    'Relics come out of the six deepest dungeons only, and never from an overworld boss.',
    'Four pieces of one relic set add a rule that none of the four carries alone.',
    'Both flasks refill themselves. Nothing you can buy will ever keep you alive.',
    'Where you farm decides what drops, not the level of the thing you killed.',
  ];
  if(tip) tip.textContent=TIPS[Math.floor(Math.random()*TIPS.length)];

  // An image is SETTLED when it has either decoded or failed; both mean it will never change again.
  function settled(im){ return !im || im.complete || !im.src; }

  function progress(){
    const list=(typeof ASSET_IMGS!=='undefined')?ASSET_IMGS:[];
    if(!list.length) return 1;
    let n=0; for(const im of list) if(settled(im)) n++;
    return n/list.length;
  }

  function paint(p){
    const w=Math.round(Math.max(0,Math.min(1,p))*100);
    if(bar) bar.style.width=w+'%';
    if(pct) pct.textContent=w+'%';
  }

  function finish(){
    if(done) return; done=true;
    // hold the last frame briefly so a warm cache does not flash a 1-frame screen
    const wait=Math.max(0, BOOT_MIN_SHOW-(Date.now()-t0));
    setTimeout(()=>{
      paint(1);
      el.classList.add('gone');
      setTimeout(()=>{ el.style.display='none'; }, 420);   // after the fade
      // the world was drawing behind the curtain the whole time; nothing to restart
    }, wait);
  }

  function tick(){
    if(done) return;
    let p=0;
    try{ p=progress(); }catch(e){ p=1; }                    // never let a bad read trap anyone
    paint(p);
    if(p>=1 || Date.now()-t0>BOOT_MAX_WAIT) return finish();
    setTimeout(tick, 60);
  }

  // Fonts matter as much as sprites here: the HUD is a pixel font, and swapping it in late is its
  // own visible re-layout. Never block on it though -- a font that stalls must not hold the game.
  if(document.fonts && document.fonts.ready) document.fonts.ready.catch(()=>{});
  tick();
  // last-resort belt and braces: if anything above wedges, lift the curtain regardless
  setTimeout(finish, BOOT_MAX_WAIT+2000);
})();
