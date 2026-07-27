// ===================================================================================
// 05b_targeting.js — TARGETING MODES (user, 2026-07-27)
//
// Auto-aim always picked the enemy nearest your cursor (PC) or nearest you (touch). That is the
// right default and the wrong answer surprisingly often: the thing you want dead is frequently the
// boss behind the trash, or the one enemy at 5% HP, or the fat one soaking your damage.
//
// A mode only ever REORDERS the targets you could already hit. Range and line-of-sight are
// enforced before any mode is consulted (see fire() in 06_combat.js), so no mode can let you shoot
// through a wall, past your weapon's reach, or at something you cannot see. That boundary is what
// keeps this a convenience rather than a power increase.
//
// The control is a BUTTON ON TOUCH and the `I` KEY ON PC (user), because a thumb cannot hold a
// modifier and a mouse hand should not leave the mouse.
// ===================================================================================

const TARGET_MODES=[
  {id:'near', n:'NEAREST',    d:'the closest thing you can hit'},
  {id:'hp',   n:'TOUGHEST',   d:'the most health left'},
  {id:'low',  n:'FINISHER',   d:'the least health left'},
  {id:'boss', n:'BOSS FIRST', d:'a boss if one is in range, else the closest'},
];
// Persisted per device alongside the other display preferences, so it survives a reload the way
// every other control choice does.
function targetMode(){
  const v=(typeof OPTS!=='undefined')?OPTS.tgt:null;
  return TARGET_MODES.some(m=>m.id===v) ? v : 'near';
}
function targetModeDef(){ const id=targetMode(); return TARGET_MODES.find(m=>m.id===id)||TARGET_MODES[0]; }
function cycleTargetMode(){
  const i=TARGET_MODES.findIndex(m=>m.id===targetMode());
  const nx=TARGET_MODES[(i+1)%TARGET_MODES.length];
  if(typeof OPTS!=='undefined'){ OPTS.tgt=nx.id; if(typeof saveOpts==='function') saveOpts(); }
  paintTargetBtn();
  if(typeof msg==='function') msg('TARGET · '+nx.n, nx.d);
  navigator.vibrate&&navigator.vibrate(12);
  return nx.id;
}
// The button shows the CURRENT mode, not the next one: a control that displays what it will become
// is a riddle. Icon plus the mode name, so it is readable without having learned the icons.
function paintTargetBtn(){
  const b=(typeof $s==='function')?$s('tgtBtn'):document.getElementById('tgtBtn');
  if(!b) return;
  const m=targetModeDef();
  b.innerHTML='<img class="tgtIc" src="assets/target/'+m.id+'.png" alt="" '
    +'onerror="this.style.display=\'none\'"><span class="tgtTx">'+m.n+'</span>';
  b.title='Targeting: '+m.n+' — '+m.d+'  (I)';
}
// TOUCH ONLY. On PC the key does it and the button would be dead chrome in a row that is already
// full; `inputMode` follows the last input used, so a hybrid device gets it back the moment a
// finger touches the screen.
function updateTargetBtnVisibility(){
  const b=(typeof $s==='function')?$s('tgtBtn'):document.getElementById('tgtBtn');
  if(!b) return;
  const inGameNow=(typeof inGame!=='undefined')&&inGame;
  const touch=(typeof inputMode==='undefined')||inputMode!=='pc';
  b.style.display=(inGameNow&&touch)?'flex':'none';
}

// tap cycles; the visibility rule re-runs on every input switch so a hybrid device is honest
if(typeof document!=='undefined'){
  const _wire=()=>{ const b=document.getElementById('tgtBtn'); if(!b) return;
    b.addEventListener('click',cycleTargetMode);
    paintTargetBtn(); updateTargetBtnVisibility(); };
  if(document.readyState==='loading') addEventListener('DOMContentLoaded',_wire); else _wire();
  addEventListener('pointerdown',()=>setTimeout(updateTargetBtnVisibility,0));
  addEventListener('keydown',()=>setTimeout(updateTargetBtnVisibility,0));
}
