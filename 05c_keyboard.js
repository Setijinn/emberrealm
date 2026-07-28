// ===================================================================================
// 05c_keyboard.js — THE MENUS ARE MOUSE-AND-TOUCH ONLY, AND THAT IS HALF THE PLATFORMS
//
// The game itself plays beautifully from the keyboard: WASD moves, 1-4 casts, E/F/Q/G/B/K/L/M/V
// are all bound, and 05_controls.js documents why each one sits where it does. Then you press the
// menu button and it all stops. Every card in every panel -- the hero list, the class picker, the
// vendor stalls, the vault, the stable, the loadout -- is a plain <div> with `.onclick` assigned
// in JS. A <div> is not in the tab order, does not fire click on Enter, and shows no focus ring,
// so from a keyboard those panels are inert pictures. You could not select a character to start.
//
// Rather than hand-annotate the ~40 places that build these cards (and miss the next one someone
// adds), this leans on a fact that is already true everywhere: THIS CODEBASE WIRES CLICKS BY
// ASSIGNING `el.onclick`. So `typeof el.onclick === 'function'` is a reliable, self-maintaining
// signal for "this thing is a button", and it costs nothing to keep it accurate -- panels rebuild
// when they open, not per frame, so an observer here is idle during play.
//
// Three pieces, nothing more:
//   1. stamp   -- anything clickable becomes focusable (tabindex) and announces itself (role)
//   2. activate-- Enter and Space on a focused control click it, the way a real button would
//   3. Escape  -- closes the top panel, or opens the menu when nothing is open
//
// Deliberately NOT here: a focus trap, arrow-key roving, or aria-live regions. Those are real
// accessibility work with real behavioural risk, and the gap this closes -- "cannot reach the
// controls at all" -- is the one that stops a keyboard player from starting the game.
// ===================================================================================

(function(){
  if(typeof document==='undefined') return;

  // Native controls already do all of this; stamping them would break their own semantics.
  const NATIVE=/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/;

  // The `el.onclick` signal cannot see a control wired with addEventListener, and a handful are.
  // Almost all of those turned out to be real <button> elements -- which need nothing from this
  // file -- so the exceptions are a short, checkable list rather than a mechanism.
  const STATIC='#menuBtn,#devBtn2,.setRow';

  function stampOne(el, force){
    if(!el || el._kb) return;
    if(NATIVE.test(el.tagName)) { el._kb=1; return; }
    if(typeof el.onclick!=='function' && !force) return;
    if(el.hasAttribute('tabindex')) { el._kb=1; return; }
    el.setAttribute('tabindex','0');
    if(!el.hasAttribute('role')) el.setAttribute('role','button');
    el._kb=1;
  }

  // A single sweep. Guarded because it runs off a MutationObserver and a thrown error there is
  // silent -- it would just stop observing and the panels would quietly go dead again.
  function stamp(root){
    try{
      const r=root||document.body; if(!r||!r.querySelectorAll) return;
      stampOne(r);
      const all=r.querySelectorAll('*');
      for(let i=0;i<all.length;i++) stampOne(all[i]);
      const st=r.querySelectorAll(STATIC);
      for(let i=0;i<st.length;i++) stampOne(st[i], true);
      if(r.matches && r.matches(STATIC)) stampOne(r, true);
    }catch(e){}
  }

  // Coalesce to one sweep per frame, and sweep only what CHANGED. Walking the whole document on
  // every mutation would be a walk per second all through a fight -- the boost strip rewrites its
  // countdown on the second -- for a subtree that never contains a button.
  let pending=0, queue=[];
  function schedule(recs){
    for(const r of recs) for(const n of r.addedNodes) if(n.nodeType===1) queue.push(n);
    if(pending || !queue.length) return;
    pending=1;
    requestAnimationFrame(()=>{ pending=0; const q=queue; queue=[]; for(const n of q) stamp(n); });
  }

  if(window.MutationObserver){
    new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  }
  stamp(document.body);
  addEventListener('load',()=>stamp(document.body));

  // ---- Enter / Space activate the focused control ----
  // Capture phase so this resolves before 05_controls.js sees the key: a focused card must not
  // also arm an ability. Space is preventDefault'd because its default is to scroll the page.
  addEventListener('keydown',function(e){
    if(!e.key) return;
    const t=document.activeElement;
    if(!t || t===document.body) return;
    if(NATIVE.test(t.tagName)) return;                 // let a real button be a real button
    if(e.key!=='Enter' && e.key!==' ' && e.key!=='Spacebar') return;
    // Either wiring counts. `.onclick` is how the card builders do it; `_kb` covers the few static
    // controls that use addEventListener, whose handler this cannot see but whose click it can
    // still dispatch. Anything else that happens to hold the focus is left alone.
    if(typeof t.onclick!=='function' && !t._kb) return;
    e.preventDefault(); e.stopPropagation();
    try{ t.click(); }catch(_){ }
  }, true);

  // ---- Escape: close the top panel, or open the menu ----
  // 05_controls.js already closes panels on Escape. What it cannot do is the other half: with
  // nothing open, a keyboard player had no way to reach the pause menu at all, because #menuBtn
  // is a <div> that no key was bound to. Escape is the key every player already tries.
  // Runs in the BUBBLE phase and checks the panel state itself, so the existing handler gets
  // first refusal -- one press closes a panel, the next opens the menu, never both at once.
  addEventListener('keydown',function(e){
    if(!e.key || e.key!=='Escape') return;
    if(e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if(typeof inGame==='undefined' || !inGame) return;
    if(typeof uiPanelOpen==='function' && uiPanelOpen()) return;   // the other handler just closed one
    const b=document.getElementById('menuBtn');
    if(b && b.style.display!=='none') b.click();
  });

  // ---- give the first control in a freshly opened panel the focus ----
  // Without this, tabbing into a panel starts from wherever the focus happened to be left, which
  // after a click is usually nowhere -- so the first Tab does nothing visible and it reads broken.
  function focusFirst(el){
    try{
      if(!el || !el.querySelectorAll) return;
      const c=el.querySelector('[tabindex="0"],button,input,select,textarea');
      if(c && typeof c.focus==='function') c.focus({preventScroll:true});
    }catch(_){ }
  }
  if(typeof window!=='undefined') window.kbFocusFirst=focusFirst;
})();
