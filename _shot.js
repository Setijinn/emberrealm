// Screenshot rig. Stands up a throwaway account, stocks the pouch, opens a panel, and holds it
// still so `chrome --headless --screenshot` catches it. Which panel is chosen by ?shot= on the URL.
//
// This exists because the browser extension on this machine is attached to a Chrome that cannot
// reach this machine's dev server, so the only way to LOOK at a panel is to render it here.
(function(){
  const Q=new URLSearchParams(location.search);
  const WANT=Q.get('shot')||'forge';
  const TAB=Q.get('tab')||'forge';

  function setup(){
    // a real account with a real character, so curChar()/matStore() answer honestly
    users['_shot']={pass:'x', chars:[{cls:'knight', inv:[], rpg:{}}], cur:0, mats:{}, vault:[]};
    curUser='_shot';
    rpg={lvl:50, xp:0, relics:[], eqAff:{}, pots:5, mpots:5, train:{}, scrolls:{}, tree:{}, perkPts:44};
    const ch=curChar();
    // a pouch with a spread across every source, so the strip is realistically full
    for(const k of MAT_KEYS) matAdd(k, 1+Math.floor(Math.random()*8));
    // and the gear the anvil actually takes
    for(const k of ['wpn','arm','helm','ring']) ch.inv.push(mkItem(k, SD_T, 0, ch.cls));
    ch.inv.push(mkItem('wpn', MAXT-2, 0, ch.cls));
    // stand at Bram's counter
    curShopNear='bram';
  }

  function hideChrome(){
    // the loading curtain and the game HUD would sit on top of whatever we are photographing
    for(const id of ['loadCurtain','menuBtn','invBtn','abBtn','flasks','hudTop','boostStrip']){
      const el=document.getElementById(id); if(el) el.style.display='none'; }
    const cv=document.querySelector('canvas'); if(cv) cv.style.display='none';
    // AND EVERY OTHER SCREEN. The panel background is rgba(9,7,12,.92) -- deliberately translucent
    // -- so the login and character-select text underneath bleeds straight through it and reads as
    // though the panel's own layout were overlapping itself. The first screenshot of this panel
    // showed "hero name" and "ENTER THE REALM" ghosted behind the recipe list and I spent a while
    // treating it as a layout bug. It was the rig.
    for(const s of ['loginScr','menuScr','charScr','classScr','devScr','setScr','fallenScr',
                    'hcScr','deathScr','invScr','mapScr','skillScr','statsScr','sheetScr']){
      if(s===WANT+'Scr') continue;            // never hide the thing we came to photograph
      const el=document.getElementById(s); if(el) el.style.display='none'; }
    document.body.style.background='#0b0910';
  }

  function open(){
    setup(); hideChrome();
    if(WANT==='forge'){
      openForge();
    } else if(WANT==='map'){
      // THE FULL MAP needs a real world, not just a panel: mapTerrain reads rooms['G'] and
      // _territories(), and drawMap plots lairs, pillars and portals in world coordinates. So put
      // the hero on the overworld first, then draw ONE frame -- drawMap is normally driven by
      // mapInt on an interval, which a screenshot never waits for.
      // `?dens=all` opens every lair gate so the open-door styling can be photographed without
      // farming thirteen bosses first. It writes only to the throwaway '_shot' account's storage.
      if(typeof devTeleport==='function') devTeleport('G');
      if(Q.get('dens')==='all' && typeof openDen==='function'){
        const n=(typeof GBOSS!=='undefined')?GBOSS.length:0;
        for(let i=0;i<n;i++) openDen(i); }
      if(typeof fogReveal==='function' && typeof curRoom!=='undefined')
        for(let i=0;i<40;i++) fogReveal(curRoom,0.2);      // uncover where we stand, so labels show
      const ms=document.getElementById('mapScr'); if(ms) ms.style.display='flex';
      if(typeof drawMap==='function') drawMap();
    } else if(WANT==='dev'){
      // the workbench. openDev builds the tabs; then jump to the requested one.
      if(typeof openDev==='function') openDev();
      const scr=document.getElementById('devScr'); if(scr) scr.style.display='flex';
      if(typeof _devTab!=='undefined'){
        try{ eval('_devTab='+JSON.stringify(TAB)); }catch(e){}
      }
      if(typeof devPaintTabs==='function') devPaintTabs();
      if(typeof devPaintBody==='function') devPaintBody();
    }
    document.title='SHOT READY '+WANT+'/'+TAB;
  }

  function boot(){ try{ open(); }catch(e){ document.title='SHOT FAILED: '+e.message;
    const d=document.createElement('pre'); d.style.cssText='position:fixed;left:0;top:0;color:#f66;background:#000;z-index:99999;font:12px monospace';
    d.textContent='SHOT FAILED\n'+(e&&e.stack||e); document.body.appendChild(d); } }
  if(document.readyState==='complete') setTimeout(boot,400);
  else window.addEventListener('load',()=>setTimeout(boot,400));
})();
