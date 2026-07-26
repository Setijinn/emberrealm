// ---------- DIAMONDS, COSMETICS AND THE WARDROBE ----------
// Sella runs the exchange; the Wardrobe room is where you put things on.
//
// THE WALL, STATED ONCE: real money cannot be collected here. This is a static PWA on GitHub
// Pages with no server, so there is nobody to take a card, nobody to verify a receipt and nowhere
// to keep the entitlement. Everything else is real -- the currency, the catalogue, the gating, the
// preview and the ledger -- and the purchase itself is a stub that says so. `diamondPacks()` is
// the single function a payment provider would replace; nothing else needs to know.
//
// WHAT COSMETICS ARE ALLOWED TO BE: colour only. A cosmetic must never touch a stat, and it must
// never change the silhouette either -- another player has to be able to read your class and your
// weapon at a glance, in a game where that tells them what you are about to do. So a skin is a
// recolour of the class's own art through _tintImg, which paints only where the sprite is opaque.

// ---- currency ----------------------------------------------------------------
function accountGems(){ const u=users[curUser]; return (u&&u.gems)||0; }
function spendGems(n){ const u=users[curUser];
  if(!u||n<=0||(u.gems||0)<n) return false;
  u.gems-=n; LS.set('er-users',users); return true; }
function grantGems(n){ const u=users[curUser]; if(!u||n<=0) return 0;
  u.gems=(u.gems||0)+n; LS.set('er-users',users); return u.gems; }

// ---- the catalogue -----------------------------------------------------------
// `col`+`a` are what the tint does. Priced in glory OR diamonds, never both: glory skins are the
// reward for playing, diamond skins are the reward for paying, and mixing the two currencies on
// one item would only make both feel worse.
const COSMETICS=[
  {id:'ember',   n:'Ember Weave',    d:'banked coals under the cloth', col:'#ff7a2a', a:0.30, glory:900},
  {id:'ash',     n:'Ashen Order',    d:'the grey of a cold hearth',    col:'#9aa4b0', a:0.30, glory:900},
  {id:'verdant', n:'Verdant Watch',  d:'moss and old growth',          col:'#4f9a3f', a:0.30, glory:1400},
  {id:'tidal',   n:'Tidal Guard',    d:'the colour under the bridge',  col:'#3f7fa8', a:0.30, glory:1400},
  {id:'bloom',   n:'Rift Bloom',     d:'what the rift does to dye',    col:'#c04ae0', a:0.34, gems:120},
  {id:'gilded',  n:'Gilded Vow',     d:'gold leaf, honestly earned',   col:'#e8b34b', a:0.34, gems:120},
  {id:'void',    n:'Voidtouched',    d:'light goes in and does not come back', col:'#2a2035', a:0.46, gems:260},
];
function cosById(id){ for(const c of COSMETICS) if(c.id===id) return c; return null; }
function cosOwned(id){ const u=users[curUser]; return !!(u&&u.cos&&u.cos.indexOf(id)>=0); }
function cosWorn(){ const u=users[curUser]; return (u&&u.skin)||null; }
// Cosmetics belong to the ACCOUNT, like glory and diamonds -- a skin you bought must not die with
// the hero wearing it.
function cosBuy(c){
  const u=users[curUser]; if(!u||!c) return false;
  if(cosOwned(c.id)) return false;
  if(c.gems){ if(!spendGems(c.gems)){ msg('NOT ENOUGH DIAMONDS',c.gems+' needed'); return false; } }
  else if(!spendGlory(c.glory)){ msg('NOT ENOUGH GLORY',c.glory+' needed'); return false; }
  if(!u.cos) u.cos=[]; u.cos.push(c.id); u.skin=c.id;
  LS.set('er-users',users); msg(c.n,'bought — and worn');
  return true;
}
function cosWear(id){ const u=users[curUser]; if(!u) return;
  if(id && !cosOwned(id)) return;
  u.skin=(u.skin===id)?null:id; LS.set('er-users',users); }

// ---- what the world draws ----------------------------------------------------
// Called from the hero draw. Returns the sprite untouched when nothing is worn, so the normal
// path costs one property read; _tintImg caches per (image, colour, alpha), so a worn skin costs
// one recolour per animation frame ever, not per rendered frame.
function skinImg(im){
  if(!im) return im;
  const c=cosById(cosWorn()); if(!c) return im;
  if(typeof _tintImg!=='function') return im;
  return _tintImg(im,c.col,c.a,0);
}

// ---- the exchange (Sella) ----------------------------------------------------
// Diamond packs. This is the function a real storefront would replace; today every row explains
// why it cannot charge you rather than pretending to.
function diamondPacks(){ return [
  {id:'p1', n:'A Handful',  gems:120,  price:'$1.99'},
  {id:'p2', n:'A Pouch',    gems:700,  price:'$9.99'},
  {id:'p3', n:'A Coffer',   gems:2000, price:'$24.99'},
]; }
function openDiamonds(){ const s=$s('dmdScr'); if(!s) return; s.style.display='flex'; paintDiamonds(); }
function closeDiamonds(){ const s=$s('dmdScr'); if(s) s.style.display='none'; }
function paintDiamonds(){
  const u=users[curUser]; if(!u) return;
  $s('dmdPurse').innerHTML='<span class="purse">✦ '+accountGlory()+' glory</span>'
    +' <span class="purse gem">◈ '+accountGems()+' diamonds</span>';
  const box=$s('dmdRows'); box.innerHTML='';
  const stub=document.createElement('div'); stub.className='dmdStub';
  stub.textContent='Diamonds cannot be bought yet — taking real payment needs a server, and this realm has none.';
  box.appendChild(stub);
  for(const p of diamondPacks()){
    const card=document.createElement('div'); card.className='shopcard gem broke';
    const ico=document.createElement('div'); ico.className='shopico emoji'; ico.textContent='◈';
    card.appendChild(ico);
    const txt=document.createElement('div'); txt.className='shoptext';
    txt.innerHTML='<div class="shopname">'+p.n+'</div><div class="shopdesc">'+p.gems+' diamonds · '+p.price+'</div>';
    card.appendChild(txt);
    const pr=document.createElement('div'); pr.className='shopprice gem'; pr.textContent='—';
    card.appendChild(pr);
    card.onclick=function(){ msg('NOT YET','diamond purchases need a payment provider');
      navigator.vibrate&&navigator.vibrate(20); };
    box.appendChild(card);
  }
  const head=document.createElement('div'); head.className='shopnote';
  head.textContent='Cosmetics are colour only — never a stat, never a silhouette.';
  box.appendChild(head);
  for(const c of COSMETICS) box.appendChild(cosCard(c,true));
}
// One card, used by both the exchange (where it can be bought) and the wardrobe (where it can be
// worn), so a skin looks and reads the same in either place.
function cosCard(c,forSale){
  const owned=cosOwned(c.id), worn=cosWorn()===c.id;
  const card=document.createElement('div');
  const afford=owned || (c.gems?accountGems()>=c.gems:accountGlory()>=c.glory);
  card.className='shopcard'+(c.gems?' gem':'')+(worn?' worn':'')+((owned||afford)?'':' broke');
  const ico=document.createElement('div'); ico.className='shopico';
  const cv=document.createElement('canvas'); cv.width=42; cv.height=36; cv.className='isprite';
  paintCosSwatch(cv,c); ico.appendChild(cv); card.appendChild(ico);
  const txt=document.createElement('div'); txt.className='shoptext';
  txt.innerHTML='<div class="shopname">'+c.n+'</div><div class="shopdesc">'
    +(worn?'worn · tap to take off':(owned?'owned · tap to wear':c.d))+'</div>';
  card.appendChild(txt);
  const pr=document.createElement('div');
  pr.className='shopprice'+(c.gems?' gem':'')+(owned?' free':'');
  pr.textContent=owned?(worn?'✓':'wear'):(c.gems?(c.gems+'◈'):(c.glory+'✦'));
  card.appendChild(pr);
  card.onclick=function(){
    if(owned){ cosWear(c.id); }
    else if(forSale){ if(!cosBuy(c)){ navigator.vibrate&&navigator.vibrate(20); return; } }
    else { msg(c.n,'not yours yet — see the exchange'); return; }
    navigator.vibrate&&navigator.vibrate(15);
    if($s('dmdScr').style.display!=='none') paintDiamonds();
    if($s('wrdScr').style.display!=='none') paintWardrobe();
  };
  return card;
}
// The swatch is the hero's OWN art in that colour, not an abstract colour chip -- you are choosing
// how you will look, so the sample has to be you.
function paintCosSwatch(cv,c){
  const g=cv.getContext('2d'); g.imageSmoothingEnabled=false;
  g.clearRect(0,0,cv.width,cv.height);
  const ch=(typeof curChar==='function')?curChar():null;
  let im=null;
  if(ch && typeof _emberReady!=='undefined' && _emberReady[ch.cls] && typeof _emberIdle==='function') im=_emberIdle(ch.cls,'s');
  if(im&&im.complete&&im.naturalWidth&&typeof _tintImg==='function'){
    const t=_tintImg(im,c.col,c.a,0);
    const sc=Math.min(cv.width/im.naturalWidth,cv.height/im.naturalHeight);
    const w=im.naturalWidth*sc, h=im.naturalHeight*sc;
    g.drawImage(t,Math.round((cv.width-w)/2),Math.round((cv.height-h)/2),w,h);
  } else { g.fillStyle=c.col; g.fillRect(6,4,cv.width-12,cv.height-8); }
}

// ---- the Wardrobe room -------------------------------------------------------
function openWardrobe(){ const s=$s('wrdScr'); if(!s) return; s.style.display='flex'; paintWardrobe(); }
function closeWardrobe(){ const s=$s('wrdScr'); if(s) s.style.display='none'; }
function paintWardrobe(){
  const u=users[curUser]; if(!u) return;
  const owned=COSMETICS.filter(c=>cosOwned(c.id));
  $s('wrdNote').textContent=owned.length
    ? 'wearing: '+((cosById(cosWorn())||{}).n||'your own colours')
    : 'nothing here yet — the exchange in the Hearth stocks it';
  const box=$s('wrdRows'); box.innerHTML='';
  const bare=document.createElement('div');
  bare.className='shopcard'+(cosWorn()?'':' worn');
  bare.innerHTML='<div class="shopico emoji">🧍</div><div class="shoptext">'
    +'<div class="shopname">Your own colours</div><div class="shopdesc">'
    +(cosWorn()?'tap to take everything off':'worn')+'</div></div>'
    +'<div class="shopprice free">'+(cosWorn()?'':'✓')+'</div>';
  bare.onclick=function(){ const u2=users[curUser]; if(u2){ u2.skin=null; LS.set('er-users',users); } paintWardrobe(); };
  box.appendChild(bare);
  for(const c of owned) box.appendChild(cosCard(c,false));
}
