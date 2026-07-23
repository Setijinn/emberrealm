// ---------- co-op (P2P presence multiplayer) ----------
// WebRTC data channels via PeerJS (free public broker) — NO game server needed.
// One player HOSTS a room (gets a short code), friends JOIN with the code.
// Star topology: guests connect to the host; the host relays everyone's state.
// MVP scope: you see each other move/aim/fight in the same world (each client
// still runs its own enemies/loot). Foundation for deeper sync later.
let coop={on:false, host:false, code:null, peer:null, conns:[], peers:{}, id:null, err:null};
function _coopPid(code){ return 'emberrealm-room-'+code.toLowerCase(); }
function _coopRand(){ const A='BCDFGHJKMNPQRSTVWXYZ23456789'; let s='';
  for(let i=0;i<4;i++) s+=A[Math.floor(Math.random()*A.length)]; return s; }
function coopHost(){ if(typeof Peer==='undefined'){ _coopMsg('co-op needs internet (PeerJS failed to load)'); return; }
  coopLeave();
  coop.code=_coopRand(); coop.host=true; coop.id='H';
  coop.peer=new Peer(_coopPid(coop.code));
  coop.peer.on('open',()=>{ coop.on=true; _coopMsg('room '+coop.code+' open — friends can join'); _coopPanel(); });
  coop.peer.on('connection',c=>_coopWire(c));
  coop.peer.on('error',e=>{ coop.err=''+e.type; if(e.type==='unavailable-id'){ coopHost(); } else _coopMsg('co-op error: '+e.type); });
}
function coopJoin(code){ if(typeof Peer==='undefined'){ _coopMsg('co-op needs internet (PeerJS failed to load)'); return; }
  if(!code) return; coopLeave();
  coop.code=code.toUpperCase(); coop.host=false;
  coop.peer=new Peer();
  coop.peer.on('open',id=>{ coop.id=id.slice(0,6);
    const c=coop.peer.connect(_coopPid(coop.code),{reliable:false});
    _coopWire(c);
    setTimeout(()=>{ if(!coop.on) _coopMsg('could not reach room '+coop.code); },6000); });
  coop.peer.on('error',e=>{ coop.err=''+e.type; _coopMsg('co-op error: '+e.type); });
}
function coopLeave(){ for(const c of coop.conns){ try{c.close();}catch(e){} }
  if(coop.peer){ try{coop.peer.destroy();}catch(e){} }
  coop={on:false,host:false,code:null,peer:null,conns:[],peers:{},id:null,err:null}; _coopPanel(); }
function _coopWire(c){
  c.on('open',()=>{ coop.conns.push(c); coop.on=true;
    _coopMsg(coop.host?'a hero joined your realm':'joined room '+coop.code); _coopPanel(); });
  c.on('data',d=>{ if(!d||d.t!=='s'||!d.id) return;
    d.ts=performance.now(); coop.peers[d.id]=d;
    if(coop.host){ for(const o of coop.conns){ if(o!==c && o.open){ try{o.send(d);}catch(e){} } } } });
  const drop=()=>{ coop.conns=coop.conns.filter(x=>x!==c);
    if(!coop.host && !coop.conns.length){ coop.on=false; _coopMsg('left the room'); }
    _coopPanel(); };
  c.on('close',drop); c.on('error',drop);
}
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
    // name + hp sliver
    ctx.font='10px "Pixelify Sans",monospace'; ctx.textAlign='center';
    ctx.fillStyle='rgba(0,0,0,.7)'; ctx.fillText(p.n||'ally',p.x+1,p.y-31);
    ctx.fillStyle='#8fd48c'; ctx.fillText(p.n||'ally',p.x,p.y-32);
    ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(p.x-14,p.y-28,28,3);
    ctx.fillStyle='#7dc47a'; ctx.fillRect(p.x-14,p.y-28,28*Math.min(1,(p.hp||0)/100),3);
    ctx.textAlign='left';
  }
}
// ---- tiny UI: host / join / leave panel ----
function openCoop(){ const ov=document.getElementById('coopScr'); if(!ov) return;
  ov.style.display='flex'; _coopPanel(); }
function _coopPanel(){ const el=document.getElementById('coopBody'); if(!el) return;
  const n=Object.keys(coop.peers).filter(id=>performance.now()-(coop.peers[id].ts||0)<3000).length;
  if(coop.on) el.innerHTML='<div class="coopCode">ROOM <b>'+coop.code+'</b></div>'
    +'<div class="mnote">'+(coop.host?'you are hosting — share the code':'connected')+' · '+n+' other hero'+(n===1?'':'es')+' online</div>'
    +'<button class="mbtn dev" onclick="coopLeave()">LEAVE ROOM</button>';
  else el.innerHTML='<button class="mbtn go" onclick="coopHost()">HOST A ROOM</button>'
    +'<div class="mnote" style="margin:8px 0 4px">or join a friend:</div>'
    +'<div style="display:flex;gap:8px"><input id="coopCodeIn" maxlength="4" placeholder="CODE" autocomplete="off">'
    +'<button class="mbtn dev" onclick="coopJoin(document.getElementById(\'coopCodeIn\').value)">JOIN</button></div>'
    +(coop.err?'<div class="mnote" style="color:#c04a3d">last error: '+coop.err+'</div>':'');
}
function _coopMsg(t){ if(typeof msg==='function') msg('CO-OP',t); }
