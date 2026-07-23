// ---------- co-op: the EMBER SERVER (public P2P room everyone auto-joins) ----------
// WebRTC data channels via PeerJS (free public broker) — NO game server needed.
// Everyone who enters the game auto-connects to one public room, presented as
// "EMBER SERVER". Under the hood: the first player claims the well-known peer id
// and acts as the relay; if they leave, remaining players race to claim it (host
// migration) and everyone reconnects automatically. Private code rooms still work.
const COOP_PUB_ID='emberrealm-public-server-1';
let coop={on:false, host:false, code:null, peer:null, conns:[], peers:{}, id:null, err:null,
          auto:true, pub:false, _trying:false};
function _coopPid(code){ return 'emberrealm-room-'+code.toLowerCase(); }
function _coopRand(){ const A='BCDFGHJKMNPQRSTVWXYZ23456789'; let s='';
  for(let i=0;i<4;i++) s+=A[Math.floor(Math.random()*A.length)]; return s; }
function _coopReset(keepAuto){ const au=keepAuto?coop.auto:true;
  for(const c of coop.conns){ try{c.close();}catch(e){} }
  if(coop.peer){ try{coop.peer.destroy();}catch(e){} }
  coop={on:false,host:false,code:null,peer:null,conns:[],peers:{},id:null,err:null,
        auto:au,pub:false,_trying:false}; }
// ---- public server auto-connect (claim the server id, else join whoever holds it) ----
function _pubAttempt(){ if(typeof Peer==='undefined'||coop._trying||coop.on) return;
  coop._trying=true;
  const p=new Peer(COOP_PUB_ID);
  p.on('open',()=>{ // I hold the server id -> I'm the relay
    coop.peer=p; coop.host=true; coop.pub=true; coop.on=true; coop.id='H'; coop.code='SERVER';
    coop._trying=false; _coopPanel();
    p.on('connection',c=>_coopWire(c)); });
  p.on('error',e=>{
    if(e.type==='unavailable-id'){ // someone else is the server -> join them
      try{p.destroy();}catch(err){}
      const g=new Peer();
      g.on('open',id=>{ coop.peer=g; coop.id=id.slice(0,6); coop.pub=true; coop.code='SERVER';
        const c=g.connect(COOP_PUB_ID,{reliable:false}); _coopWire(c);
        setTimeout(()=>{ coop._trying=false; if(!coop.on){ try{g.destroy();}catch(err2){} coop.peer=null; } },7000); });
      g.on('error',()=>{ coop._trying=false; });
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
  coop.peer.on('open',id=>{ coop.id=id.slice(0,6);
    const c=coop.peer.connect(_coopPid(coop.code),{reliable:false}); _coopWire(c);
    setTimeout(()=>{ if(!coop.on) _coopMsg('could not reach room '+coop.code); },6000); });
  coop.peer.on('error',e=>{ coop.err=''+e.type; _coopMsg('co-op error: '+e.type); });
}
function coopSolo(){ _coopReset(false); coop.auto=false; _coopMsg('gone solo'); _coopPanel(); }
function coopOnline(){ coop.auto=true; _coopMsg('reconnecting to the server…'); _coopPanel(); }
function _coopWire(c){
  c.on('open',()=>{ coop.conns.push(c); coop.on=true; coop._trying=false;
    if(!coop.pub) _coopMsg(coop.host?'a hero joined your room':'joined room '+coop.code);
    else if(!coop.host) _coopMsg('connected to the EMBER SERVER');
    _coopPanel(); });
  c.on('data',d=>{ if(!d||d.t!=='s'||!d.id) return;
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
    atk:player.atkT>0?1:0, rm:curRoom.key||'?'};
  if(coop.host) m.id='H';
  for(const c of coop.conns){ if(c.open){ try{c.send(m);}catch(e){} } }
},120);
// render peers that are in MY room and fresh (<2.5s)
function drawCoopPeers(pn){
  if(!coop.on) return; const now=performance.now();
  for(const id in coop.peers){ const p=coop.peers[id];
    if(now-p.ts>2500 || p.rm!==(curRoom.key||'?')) continue;
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
