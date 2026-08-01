// ---------- co-op: the EMBER SERVER (public P2P room everyone auto-joins) ----------
// WebRTC data channels via PeerJS (free public broker) — NO game server needed.
// Everyone who enters the game auto-connects to one public room, presented as
// "EMBER SERVER". Under the hood: the first player claims the well-known peer id
// and acts as the relay; if they leave, remaining players race to claim it (host
// migration) and everyone reconnects automatically. Private code rooms still work.
const COOP_PUB_ID='emberrealm-public-server-1';
// `link` BELONGS IN THE LITERAL, not bolted on afterwards. It used to be created once, far below at
// file scope, while _coopReset replaces this whole object with a fresh literal -- so after any
// GO SOLO, lost relay, host migration, coopHost() or coopJoin() (all six route through _coopReset)
// coop.link was undefined and coopLinkScore() threw on `coop.link.score = ...` every second, which
// is the coopElectTick interval. The game's own window.onerror painted the repeat counter across
// the play area in world screenshots, climbing at 1 Hz. Declaring it in both literals is the fix;
// there is no state here worth preserving across a reset, which is why a shared default is right.
const _coopLink=()=>({score:9999, rtt:0, pingT:0, lastPong:0});
let coop={on:false, host:false, code:null, peer:null, conns:[], peers:{}, id:null, err:null,
          auto:true, pub:false, _trying:false, link:_coopLink()};
function _coopPid(code){ return 'emberrealm-room-'+code.toLowerCase(); }
function _coopRand(){ const A='BCDFGHJKMNPQRSTVWXYZ23456789'; let s='';
  for(let i=0;i<4;i++) s+=A[Math.floor(Math.random()*A.length)]; return s; }
// EVERY reset bumps this. A connection attempt captures it and checks it in each async callback:
// PeerJS 'open'/'error' can land seconds after the user has already gone solo or reconnected, and
// those callbacks write coop.peer / coop.host / coop.on wholesale. Without the guard a stale
// attempt resurrects co-op after GO SOLO, or nulls the peer belonging to a NEWER attempt.
let _coopEpoch=0;
function _coopReset(keepAuto){ const au=keepAuto?coop.auto:true; _coopEpoch++;
  // Drop every remote shadow BEFORE the flags flip. One frame with coop.on false and a world full
  // of un-simulable entities is all it takes to crash. This covers coopSolo, a lost relay and a
  // reconnect, because they all come through here.
  if(typeof netDropRemote==='function') netDropRemote();
  for(const c of coop.conns){ try{c.close();}catch(e){} }
  if(coop.peer){ try{coop.peer.destroy();}catch(e){} }
  coop={on:false,host:false,code:null,peer:null,conns:[],peers:{},id:null,err:null,
        auto:au,pub:false,_trying:false,link:_coopLink()}; }
// ---- public server auto-connect (claim the server id, else join whoever holds it) ----
function _pubAttempt(){ if(typeof Peer==='undefined'||coop._trying||coop.on) return;
  // A HANDOVER IS IN PROGRESS AND I AM NOT THE ONE ELECTED. Racing for the id here is exactly the
  // rule the election replaces -- it would hand the relay to whoever reconnects fastest. Wait; the
  // lock expires on its own, so a handover that never completes degrades to the old race rather
  // than to a session with no host at all.
  if(typeof _hostClaimLock!=='undefined' && performance.now() < _hostClaimLock) return;
  coop._trying=true;
  const ep=_coopEpoch;                       // this attempt belongs to THIS epoch and no other
  const stale=()=>_coopEpoch!==ep;
  const p=new Peer(COOP_PUB_ID);
  p.on('open',()=>{ // I hold the server id -> I'm the relay
    if(stale()){ try{p.destroy();}catch(err){} return; }
    coop.peer=p; coop.host=true; coop.pub=true; coop.on=true; coop.id='H'; coop.code='SERVER';
    coop._trying=false; _coopPanel();
    p.on('connection',c=>_coopWire(c)); });
  p.on('error',e=>{
    if(stale()){ try{p.destroy();}catch(err){} return; }
    if(e.type==='unavailable-id'){ // someone else is the server -> join them
      try{p.destroy();}catch(err){}
      const g=new Peer();
      // FULL peer id, never a prefix. _coopWire hands netOnMessage the raw conn.peer, so the
      // host addresses its loot grants with the full id ({t:'G',to:...}); a 6-char coop.id could
      // never match it and every client pickup silently destroyed the item instead of awarding it.
      // Presence keys (coop.peers[d.id]) and ownership tags ride the same id, so it must be one space.
      g.on('open',id=>{
        if(stale()){ try{g.destroy();}catch(err2){} return; }
        coop.peer=g; coop.id=id; coop.pub=true; coop.code='SERVER';
        const c=g.connect(COOP_PUB_ID,{reliable:false}); _coopWire(c);
        setTimeout(()=>{ if(stale()){ try{g.destroy();}catch(err2){} return; }
          coop._trying=false; if(!coop.on){ try{g.destroy();}catch(err2){} coop.peer=null; } },7000); });
      g.on('error',()=>{ if(stale()) return; coop._trying=false; });
    } else { coop.err=''+e.type; coop._trying=false; try{p.destroy();}catch(err){} }
  });
}
// keep us on the server whenever we're in-game (also handles host-migration reconnects)
setInterval(function(){
  if(typeof inGame==='undefined'||!inGame) return;
  if(coop.auto && !coop.on && !coop._trying) _pubAttempt();
},3000+Math.floor(Math.random()*2500));
// ---- private code rooms (optional, replaces the public server while active) ----
function coopHost(){ if(typeof Peer==='undefined'){ _coopMsg('co-op needs internet'); return; }
  _coopReset(false); coop.auto=false;
  coop.code=_coopRand(); coop.host=true; coop.id='H';
  coop.peer=new Peer(_coopPid(coop.code));
  coop.peer.on('open',()=>{ coop.on=true; _coopMsg('private room '+coop.code+' open'); _coopPanel(); });
  coop.peer.on('connection',c=>_coopWire(c));
  coop.peer.on('error',e=>{ coop.err=''+e.type; if(e.type==='unavailable-id') coopHost(); else _coopMsg('co-op error: '+e.type); });
}
function coopJoin(code){ if(typeof Peer==='undefined'){ _coopMsg('co-op needs internet'); return; }
  if(!code) return; _coopReset(false); coop.auto=false;
  coop.code=code.toUpperCase(); coop.host=false;
  coop.peer=new Peer();
  coop.peer.on('open',id=>{ coop.id=id;    // full id — see the note in _pubAttempt
    const c=coop.peer.connect(_coopPid(coop.code),{reliable:false}); _coopWire(c);
    setTimeout(()=>{ if(!coop.on) _coopMsg('could not reach room '+coop.code); },6000); });
  coop.peer.on('error',e=>{ coop.err=''+e.type; _coopMsg('co-op error: '+e.type); });
}
function coopSolo(){ _coopReset(false); coop.auto=false; _coopMsg('gone solo'); _coopPanel(); }
function coopOnline(){ coop.auto=true; _coopMsg('reconnecting to the server…'); _coopPanel(); }
function _coopWire(c){
  const ep=_coopEpoch, stale=()=>_coopEpoch!==ep;
  c.on('open',()=>{
    if(stale()){ try{c.close();}catch(e){} return; }
    coop.conns.push(c); coop.on=true; coop._trying=false;
    if(!coop.pub) _coopMsg(coop.host?'a hero joined your room':'joined room '+coop.code);
    else if(!coop.host) _coopMsg('connected to the EMBER SERVER');
    _coopPanel(); });
  c.on('data',d=>{ if(!d) return;
    // world-sync traffic (snapshots, hit reports, loot arbitration) is handled by 14b_netsync.
    // The host relays presence between clients but NOT snapshots -- it is the only source of those.
    if(d.t!=='s'){
      if(typeof netOnMessage==='function' && netOnMessage(d, c.peer)) return;
      return; }
    if(!d.id) return;
    d.ts=performance.now(); coop.peers[d.id]=d;
    if(coop.host){ for(const o of coop.conns){ if(o!==c && o.open){ try{o.send(d);}catch(e){} } } } });
  const drop=()=>{ coop.conns=coop.conns.filter(x=>x!==c);
    if(!coop.host && !coop.conns.length){ // lost the relay -> auto-reconnect (migration)
      const wasPub=coop.pub; _coopReset(true);
      if(wasPub) coop.auto=true;
    }
    _coopPanel(); };
  c.on('close',drop); c.on('error',drop);
}
addEventListener('pagehide',()=>{ if(coop.peer){ try{coop.peer.destroy();}catch(e){} } });
// broadcast my state ~8x/s while in-game
setInterval(function(){
  if(!coop.on || !coop.conns.length || typeof inGame==='undefined' || !inGame || !curRoom) return;
  const ch=(typeof curChar==='function')?curChar():null; if(!ch) return;
  const m={t:'s', id:coop.id||'?', n:ch.name, cls:ch.cls,
    x:Math.round(player.x), y:Math.round(player.y), aim:+(player.aim||0).toFixed(2),
    hp:Math.round(100*Math.max(0,player.hp)/(player.maxhp||1)),
    mv:(stick.move.id!==null || (typeof keyMove==='function'&&keyMove()))?1:0,
    // fo: my Fortune. The HOST rolls everyone's soulbound loot, so without this only the host's
    // Fortune would ever count -- your coins and Prosperous rolls would do nothing in co-op.
    fo:Math.round(player.fortune||0),
    atk:player.atkT>0?1:0, rm:netRoomKey()};
  if(coop.host) m.id='H';
  for(const c of coop.conns){ if(c.open){ try{c.send(m);}catch(e){} } }
},120);
// render peers that are in MY room and fresh (<2.5s)
function drawCoopPeers(pn){
  if(!coop.on) return; const now=performance.now();
  for(const id in coop.peers){ const p=coop.peers[id];
    if(now-p.ts>2500 || p.rm!==netRoomKey()) continue;
    if(typeof shadow==='function') shadow(p.x,p.y+12,15);
    const es=(typeof emberSprite==='function')
      ? emberSprite({cls:p.cls||'knight'}, {aim:p.aim||0, moving:!!p.mv, attacking:!!p.atk, atkPhase:0, clock:pn+(id.charCodeAt(0)%7)})
      : null;
    if(es && typeof blit==='function') blit(es.img, p.x, p.y-8, EMBER_SC, es.flip);
    else { ctx.fillStyle='#7ab8d4'; ctx.beginPath(); ctx.arc(p.x,p.y,12,0,6.29); ctx.fill(); }
    ctx.font='10px "Pixelify Sans",monospace'; ctx.textAlign='center';
    ctx.fillStyle='rgba(0,0,0,.7)'; ctx.fillText(p.n||'ally',p.x+1,p.y-31);
    ctx.fillStyle='#8fd48c'; ctx.fillText(p.n||'ally',p.x,p.y-32);
    ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(p.x-14,p.y-28,28,3);
    ctx.fillStyle='#7dc47a'; ctx.fillRect(p.x-14,p.y-28,28*Math.min(1,(p.hp||0)/100),3);
    ctx.textAlign='left';
  }
}
// how many heroes (incl. me) are live on my connection
function coopCount(){ const now=performance.now();
  return 1+Object.keys(coop.peers).filter(id=>now-(coop.peers[id].ts||0)<3000).length; }
// PEERS (not me) near a point in MY room, still sending. One scan, two consumers: enemy group
// scaling wants the count, soulbound loot wants the actual list so it can roll for each of them.
function coopNearPeers(x,y,rad,maxAge){
  const out=[]; if(!coop.on) return out;
  const now=performance.now(), rk=netRoomKey(), R=rad||1100, A=maxAge||3000;
  for(const id in coop.peers){ const p=coop.peers[id];
    if(!p || p.rm!==rk || now-(p.ts||0)>A) continue;
    if(Math.hypot((p.x||0)-x,(p.y||0)-y)<R) out.push(p); }
  return out; }
// how many heroes (incl. me) are near a point in MY room — drives enemy group scaling
function coopNearCount(x,y){ return coop.on?(1+coopNearPeers(x,y,1100,3000).length):1; }
// ---- panel ----
function openCoop(){ const ov=document.getElementById('coopScr'); if(!ov) return;
  ov.style.display='flex'; _coopPanel(); }
function _coopPanel(){ const el=document.getElementById('coopBody'); if(!el) return;
  let top;
  if(coop.on && coop.pub) top='<div class="coopCode">⚔ EMBER SERVER</div>'
    +'<div class="mnote" style="text-align:center">online · <b style="color:#8fd48c">'+coopCount()+'</b> hero'+(coopCount()===1?'':'es')+' in the realm'+(coop.host?' · you are the relay':'')+'</div>'
    +'<button class="mbtn dev" onclick="coopSolo()">GO SOLO (offline)</button>';
  else if(coop.on) top='<div class="coopCode">PRIVATE ROOM <b>'+coop.code+'</b></div>'
    +'<div class="mnote" style="text-align:center">'+(coop.host?'share the code':'connected')+' · '+coopCount()+' hero'+(coopCount()===1?'':'es')+'</div>'
    +'<button class="mbtn dev" onclick="coopOnline()">BACK TO THE SERVER</button>';
  else if(coop.auto) top='<div class="coopCode">⚔ EMBER SERVER</div>'
    +'<div class="mnote" style="text-align:center">connecting…</div>'
    +'<button class="mbtn dev" onclick="coopSolo()">GO SOLO (offline)</button>';
  else top='<div class="coopCode" style="color:#8a8494">SOLO</div>'
    +'<button class="mbtn go" onclick="coopOnline()">GO ONLINE (EMBER SERVER)</button>';
  el.innerHTML=top
    +'<div class="mnote" style="margin:12px 0 4px;border-top:1px solid #2c2633;padding-top:10px;">private room with friends:</div>'
    +'<button class="mbtn dev" onclick="coopHost()">HOST PRIVATE ROOM</button>'
    +'<div style="display:flex;gap:8px;margin-top:6px"><input id="coopCodeIn" maxlength="4" placeholder="CODE" autocomplete="off">'
    +'<button class="mbtn dev" style="margin-top:0" onclick="coopJoin(document.getElementById(\'coopCodeIn\').value)">JOIN</button></div>'
    +(coop.err?'<div class="mnote" style="color:#c04a3d">last error: '+coop.err+'</div>':'');
}
function _coopMsg(t){ if(typeof msg==='function') msg('CO-OP',t); }


// ===================================================================================================
//  WHO SHOULD BE THE RELAY (user, 2026-07-30: "automatically detect the user with the best
//  connection and make them host")
// ---------------------------------------------------------------------------------------------------
//  WHAT IT WAS. Whoever grabbed the fixed PeerJS id first. `new Peer(COOP_PUB_ID)` succeeds for
//  exactly one browser and fails with 'unavailable-id' for everyone else, so the host was the person
//  who happened to press play first -- which is uncorrelated with anything that matters. The host is
//  the RELAY: every client's snapshot passes through it, so a host on a bad line degrades the session
//  for everybody while four people on fibre watch.
//
//  WHAT DECIDES IT NOW. Every peer scores its own link and reports it in the presence packet it is
//  already sending eight times a second. The host compares, and if someone is clearly and durably
//  better it hands the relay over.
//
//  THE SCORE, and why these terms. Lower is better; it is a latency in milliseconds with penalties.
//    * measured RTT to the host        the only end-to-end number that exists, and the one that
//                                      actually describes the path the packets take
//    * navigator.connection.rtt        where the browser will say. Not everywhere -- Safari and
//                                      Firefox do not implement it -- so it is a bonus term, never
//                                      the basis
//    * downlink                        a host relays N-1 streams; bandwidth is what it runs out of
//    * saveData / cellular             a metered or mobile link should not be volunteering to relay
//  A peer that cannot measure anything scores WORSE than one that can, deliberately: an unknown link
//  is not a good link, and this must never promote someone on the strength of missing data.
//
//  HYSTERESIS IS THE WHOLE DESIGN. A handover costs a reconnect for everyone, so it must never fire
//  on noise. Three guards, all of them necessary:
//    MARGIN   the challenger must be 35% better, not merely better
//    WINDOW   sustained across HOST_SAMPLES consecutive comparisons, not one lucky sample
//    COOLDOWN no second handover for HOST_COOLDOWN after one, so two similar peers cannot ping-pong
//
//  AND THE HANDOVER IS DIRECTED, not a race. Freeing COOP_PUB_ID and letting everyone scramble for it
//  would hand the relay to whoever reconnects fastest -- the same "first past the post" rule this
//  replaces. The host announces {t:'HO', to:<id>} first: everyone else sets a claim lock and stays
//  off the id, the elected peer claims it, and the lock expires on its own if the elected peer never
//  arrives, so a failed handover degrades to the old race rather than to nobody hosting.
// ===================================================================================================
const HOST_MARGIN   = 0.65;    // challenger must score below 65% of the host's score
const HOST_SAMPLES  = 8;       // consecutive comparisons it must win (~8s at the presence rate)
const HOST_COOLDOWN = 45000;   // ms before another handover may fire
const HOST_CLAIM_LOCK = 9000;  // ms a non-elected peer stays off COOP_PUB_ID during a handover

// (coop.link is declared in the literal above and re-made by _coopReset; this line used to create
// it here and was the reason a reset could leave it undefined.)
let _hostWins = {};            // peer id -> consecutive comparisons won
let _hostLastSwap = 0;
let _hostClaimLock = 0;        // performance.now() until which we must NOT claim the server id

// My own link score. Measured, with the unmeasurable penalised rather than assumed good.
function coopLinkScore(){
  const c = (typeof navigator!=='undefined' && navigator.connection) ? navigator.connection : null;
  // the host measures no RTT to itself; it is judged on what the browser reports plus a small
  // credit for already holding the relay (see HOST_MARGIN -- the challenger has to beat that too)
  let score = coop.host ? 40 : (coop.link.rtt || 400);
  if(c){
    if(typeof c.rtt==='number' && c.rtt>0) score = score*0.6 + c.rtt*0.4;
    if(typeof c.downlink==='number' && c.downlink>0) score += Math.max(0, 60 - c.downlink*6);
    if(c.saveData) score += 250;
    if(c.effectiveType && c.effectiveType!=='4g') score += 200;
  } else {
    score += 120;              // nothing to measure with: an unknown link is not a good link
  }
  if(!coop.host && !coop.link.lastPong) score += 300;   // never heard back at all
  coop.link.score = Math.round(score);
  return coop.link.score;
}

// RTT: the host stamps each presence packet, a client answers, the host records the round trip. It
// rides the packets that already flow, so it costs no extra traffic.
function coopNotePing(d, fromId){
  const now = performance.now();
  if(d.t==='pg'){                       // a ping from the host -> answer it
    for(const c of coop.conns) if(c.open){ try{ c.send({t:'pn', k:d.k, id:coop.id, sc:coopLinkScore()}); }catch(e){} }
    return true;
  }
  if(d.t==='pn'){                       // a client's answer -> record its round trip
    const p = coop.peers[fromId] || (coop.peers[fromId]={});
    p.rtt = Math.max(1, Math.round(now - (d.k||now)));
    p.score = d.sc|0;
    p.ts = now;
    return true;
  }
  if(d.t==='HO'){                       // the host is handing the relay over
    _hostHandover(d);
    return true;
  }
  return false;
}

// Every peer runs this; only the host acts on it.
function coopElectTick(){
  if(!coop.on || !coop.pub) return;
  coopLinkScore();
  if(!coop.host) return;
  const now = performance.now();
  // ping every client, so their RTT is fresh rather than remembered
  for(const c of coop.conns) if(c.open){ try{ c.send({t:'pg', k:now}); }catch(e){} }
  if(now - _hostLastSwap < HOST_COOLDOWN) return;
  const mine = coop.link.score;
  let best=null, bestId=null;
  for(const id in coop.peers){
    const p = coop.peers[id];
    if(!p || typeof p.score!=='number') continue;
    if(now - (p.ts||0) > 4000) continue;                 // stale: they may already be gone
    if(best===null || p.score < best){ best=p.score; bestId=id; }
  }
  if(bestId===null){ _hostWins={}; return; }
  if(best < mine*HOST_MARGIN){
    _hostWins[bestId] = (_hostWins[bestId]|0) + 1;
    for(const k in _hostWins) if(k!==bestId) _hostWins[k]=0;
    if(_hostWins[bestId] >= HOST_SAMPLES){
      _hostWins = {}; _hostLastSwap = now;
      _coopMsg('handing the relay to a better connection');
      // tell EVERYONE, so the ones who are not elected stay off the id
      for(const c of coop.conns) if(c.open){ try{ c.send({t:'HO', to:bestId, by:coop.id}); }catch(e){} }
      // give the announcement a moment to land before releasing the id
      setTimeout(()=>{ _hostStepDown(); }, 400);
    }
  } else {
    _hostWins = {};
  }
}

// I am the outgoing host: drop the relay and come back as an ordinary client.
function _hostStepDown(){
  if(!coop.host) return;
  _hostClaimLock = performance.now() + HOST_CLAIM_LOCK;   // do not immediately re-claim it myself
  try{ coop.peer && coop.peer.destroy(); }catch(e){}
  coop.peer=null; coop.conns=[]; coop.host=false; coop.on=false; coop.id=null;
  _coopEpoch++;                                           // invalidate anything in flight
  coop._trying=false;
  _coopPanel();
  // the in-game keepalive below will reconnect us as a client once the new host holds the id
}

// A handover was announced. Either it is me -- claim the id after the old host lets go -- or it is
// not, in which case stay off it for a while so the elected peer wins uncontested.
function _hostHandover(d){
  const me = coop.id;
  if(d.to && me && d.to===me){
    _hostClaimLock = 0;
    setTimeout(()=>{
      try{ coop.peer && coop.peer.destroy(); }catch(e){}
      coop.peer=null; coop.conns=[]; coop.on=false; coop.host=false;
      _coopEpoch++; coop._trying=false;
      _coopMsg('you are the relay now');
      _pubAttempt();
    }, 700);
  } else {
    _hostClaimLock = performance.now() + HOST_CLAIM_LOCK;
  }
}
// A readable line for the co-op panel and the dev workbench: who is relaying and how everyone scores.
function coopLinkReport(){
  const rows=[];
  rows.push((coop.host?'me (relay)':'me')+'  score '+coop.link.score
            +(coop.link.rtt?('  rtt '+coop.link.rtt+'ms'):''));
  for(const id in coop.peers){ const p=coop.peers[id];
    if(!p||typeof p.score!=='number') continue;
    rows.push(String(id).slice(0,6)+'  score '+p.score+(p.rtt?('  rtt '+p.rtt+'ms'):''));
  }
  return rows;
}
setInterval(coopElectTick, 1000);
