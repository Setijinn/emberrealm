// ---------- authoritative world sync over the co-op transport ----------
// 14_coop.js is presence only: it sends each player's position 8x/s and draws the others as
// ghosts. Everything that matters -- enemies, bosses, projectiles, loot -- was simulated
// independently on every machine, so two players "fighting the same boss" were fighting two
// different bosses that merely looked alike, in different places, with different health.
//
// This layer makes one machine (the co-op host, which 14_coop already elects and migrates) the
// AUTHORITY for the shared world, and turns everyone else into a viewer of it:
//
//   host   : runs spawners, enemy AI, boss mechanics and loot exactly as in solo play, stamps a
//            net id on every entity, and broadcasts a world snapshot ~12x/s.
//   client : does NOT simulate enemies at all. It reconciles its enemy list against each snapshot
//            and interpolates toward it, so positions stay smooth between packets.
//
// The local player is never remote-controlled: you always move, aim and shoot locally with zero
// added latency. When your shot connects you apply the hit feel immediately (flash, damage number)
// and report the damage to the host, which owns the real health. That is client prediction with
// server reconciliation, scoped to what actually matters in a co-op PvE game.
//
// Trust model: friends playing together. The host accepts reported damage without validation.
// This is deliberate -- anti-cheat costs latency and complexity that a private co-op game does not
// need, and there is nothing to gain by cheating in someone else's session.

const NET_HZ = 12;                  // world snapshots per second
const NET_LERP = 0.28;              // how hard a client pulls entities toward the latest snapshot
let _netSeq = 0, _netNid = 1, _netLast = 0;
let netEnts = null;                 // client: nid -> {tx,ty} interpolation targets

function netOn(){ return typeof coop!=='undefined' && coop && coop.on && coop.conns.length>0; }
function netIsHost(){ return netOn() && coop.host; }
function netIsClient(){ return netOn() && !coop.host; }
// The one predicate the rest of the game asks: "should I be simulating the shared world?"
// Solo play and the host both say yes, so single-player behaviour is completely unchanged.
function netSimulates(){ return !netIsClient(); }

// ONE id space for ownership tags, presence keys and grant addressing. The host is always 'H'
// (forced at both host entry points in 14_coop); a client uses its full peer id, which is exactly
// what the host sees as conn.peer. Offline returns 'S', which nothing ever compares against.
function netSelfId(){ return (typeof coop==='undefined'||!coop)?'S':(coop.id||'S'); }
// True for public bags, my own bags, and EVERY bag in solo play — `own` is only ever set when
// networked, so the short-circuit at the call sites means solo pays one undefined read.
function netOwnsLoot(b){ return !b || !b.own || b.own===netSelfId(); }
// Everyone entitled to their own independent soulbound roll for a kill at (x,y): [{id,fort}].
// Solo short-circuits on the first boolean and never touches coop.peers.
const LOOT_ELIG_R=520;      // "near the kill" — much tighter than the 1100 group-scaling radius
const LOOT_ELIG_AGE=2500;   // same freshness bar bossArenaHasPlayer uses
function netLootRoster(x,y){
  const me={id:netSelfId(), fort:(typeof player!=='undefined'&&player.fortune)||0};
  if(!netOn()) return [me];
  const out=(typeof player!=='undefined'&&player.hp>0)?[me]:[];
  if(typeof coopNearPeers==='function')
    for(const p of coopNearPeers(x,y,LOOT_ELIG_R,LOOT_ELIG_AGE)){
      if((p.hp||0)<=0) continue;          // a corpse two rooms into a death timer earns nothing
      out.push({id:p.id, fort:p.fo||0}); }
  return out; }

function netId(e){ if(e && !e.nid) e.nid=_netNid++; return e?e.nid:0; }
function _netSend(m){ if(typeof coop==='undefined'||!coop.conns) return;
  for(const c of coop.conns){ if(c.open){ try{ c.send(m); }catch(err){} } } }

// ---- host: broadcast the world ----
// Packed as arrays rather than objects: at 12Hz with a few dozen entities the difference between
// [nid,x,y,hp] and {nid:..,x:..} is most of the packet.
function netBroadcast(){
  if(!netIsHost() || typeof curRoom==='undefined' || !curRoom) return;
  const now=performance.now();
  if(now-_netLast < 1000/NET_HZ) return;
  _netLast=now;
  const ents=[];
  for(const e of enemies){
    if(e.decoy) continue;                       // images are cosmetic, each client draws its own
    // statuses ride along so a damage-over-time build reads the same on every screen, and the
    // boss's telegraphs (pools, bloom safe-zones) go with it so the client can see the hazard it
    // is standing in -- without them a client takes no mechanic damage and dodges nothing.
    let st=null;
    if(e.st){ for(const id in e.st){ const s=e.st[id]; if(s&&s.t>0){ (st=st||[]).push([id,+s.t.toFixed(2)]); } } }
    let po=null;
    if(e.pools&&e.pools.length){ po=[]; for(const p of e.pools)
      po.push([Math.round(p.x),Math.round(p.y),Math.round(p.r),p.ph==='tele'?0:1]); }
    let bl=null;
    if(e.bloom){ const b=e.bloom;
      bl=[b.ph==='tele'?0:1, +b.t.toFixed(2), Math.round(b.sr),
          (b.safes||[]).map(s=>[Math.round(s.x),Math.round(s.y)])]; }
    ents.push([netId(e), e.type||'c', Math.round(e.x), Math.round(e.y),
               Math.round(e.hp), Math.round(e.maxhp||e.hp), Math.round(e.r||12),
               e.ring===undefined?-1:e.ring, e.lv||1, e.phase||0,
               (e.wb?1:0)|(e.boss?2:0)|(e.hidden?4:0)|(e.woke?8:0), e.name||'', st, po, bl]);
  }
  const sh=[];
  for(const s of eShots) sh.push([Math.round(s.x),Math.round(s.y),Math.round(s.vx),Math.round(s.vy),
                                  Math.round(s.r||6),Math.round(s.bd||8)]);
  // LOOT. Contents never cross the wire — only the 'G' grant carries a real item. What the client
  // needs is enough to DRAW the sack: which band (sprite), best rarity (border), how many pieces.
  // Soulbound rows are filtered per CONNECTION rather than tagged and filtered client-side, so
  // another player's T12 never reaches the wire at all and no client bug can reveal or request it.
  const ltPub=[], ltOwn={}, me=netSelfId();
  for(const b of loots){ if(!b.lid) b.lid=_netNid++;
    const row=[b.lid, Math.round(b.x), Math.round(b.y), netPackBag(b)];
    if(!b.own) ltPub.push(row);
    // A bound sack's REAL contents ride along, but only on the row going to the one player it
    // belongs to — so they can open the sack panel and compare before choosing, exactly like the
    // host can. It is their own loot; nobody else's connection ever sees this array.
    else if(b.own!==me){ row.push((typeof bagItems==='function')?bagItems(b):[b.item]);
      (ltOwn[b.own]=ltOwn[b.own]||[]).push(row); }
    // my own bound sacks are never broadcast: I render them straight out of `loots`
  }
  const m={t:'W', rm:(curRoom.key||'?'), seq:++_netSeq, ents:ents, sh:sh, lt:ltPub};
  // one object, `lt` swapped between sends — BinaryPack encodes synchronously inside c.send()
  for(const c of coop.conns){ if(!c.open) continue;
    const mine=ltOwn[c.peer];
    m.lt = mine ? ltPub.concat(mine) : ltPub;
    try{ c.send(m); }catch(err){} }
}
// bag -> one int: rarity(3) | band(2) | count(3) | topTier(4) | kind of the headline piece(3)
const NKIND=['wpn','arm','helm','ring','pot','coin','scroll'];
function netPackBag(b){
  const its=(typeof bagItems==='function')?bagItems(b):(b.item?[b.item]:[]);
  const head=its[0]||{};
  const k=Math.max(0,NKIND.indexOf(head.k||'wpn'));
  const t=Math.max(0,Math.min(15,(typeof bagTopTier==='function')?bagTopTier(b):(head.t|0)));
  const r=Math.max(0,Math.min(7,(typeof bagTopRar==='function')?bagTopRar(b):(b.rar|0)));
  const bd=Math.max(0,Math.min(3,(typeof bagBand==='function')?bagBand(b):0));
  const n=Math.max(0,Math.min(7,its.length));
  return r | (bd<<3) | (n<<5) | (t<<8) | (k<<12);
}
// The client rebuilds a DISPLAY-ONLY bag. `ghost` marks every item here as unawardable: only the
// host's grant carries real contents, and nothing must ever be able to put one of these in a bag.
function netUnpackBag(f){
  const r=f&7, bd=(f>>3)&3, n=(f>>5)&7, t=(f>>8)&15, k=NKIND[(f>>12)&7]||'wpn';
  const items=[]; for(let i=0;i<Math.max(1,n);i++) items.push({k:(i?'arm':k), t:t, rar:i?0:r, ghost:true});
  return {items:items, rar:r, band:bd, top:t};
}

// ---- client: adopt the host's world ----
function netApplyWorld(m){
  if(!netIsClient() || !curRoom) return;
  if(m.rm !== (curRoom.key||'?')) return;        // host is somewhere else; keep our own room quiet
  if(!netEnts) netEnts={};
  const seen={};
  for(const a of m.ents){
    const nid=a[0]; seen[nid]=1;
    let e=null;
    for(const x of enemies){ if(x.nid===nid){ e=x; break; } }
    if(!e){                                      // new to us: materialise it at the host's position
      e={nid:nid,type:a[1],x:a[2],y:a[3],hp:a[4],maxhp:a[5],r:a[6],ring:a[7],lv:a[8],
         phase:a[9],name:a[11],col:'#e07a2e',remote:true,fireT:9e9,spd:0,st:{}};
      const GB=(typeof GBOSS!=='undefined'&&a[7]>=0)?GBOSS[a[7]]:null;
      if(GB){ e.col=GB.col; e.pat=GB.pat; e.pat2=GB.pat2; e.mech=GB.mech; }
      enemies.push(e);
    }
    // interpolate rather than snap: 12Hz teleporting reads as stuttering
    netEnts[nid]={tx:a[2],ty:a[3]};
    e.hp=a[4]; e.maxhp=a[5]; e.r=a[6]; e.lv=a[8]; e.phase=a[9];
    const f=a[10]; e.wb=!!(f&1); e.boss=!!(f&2); e.hidden=!!(f&4); e.woke=!!(f&8);
    if(a[11]) e.name=a[11];
    // statuses: rebuilt each snapshot so an expiry on the host clears here too
    e.st={}; if(a[12]) for(const s of a[12]) e.st[s[0]]={t:s[1],val:0};
    e.pools = a[13] ? a[13].map(p=>({x:p[0],y:p[1],r:p[2],rmax:p[2],ph:p[3]?'live':'tele',t:1,dcd:0})) : null;
    e.bloom = a[14] ? {ph:a[14][0]?'live':'tele', t:a[14][1], dur:a[14][1], sr:a[14][2],
                       safes:a[14][3].map(s=>({x:s[0],y:s[1]}))} : null;
  }
  for(let i=enemies.length-1;i>=0;i--){ const e=enemies[i];
    if(e.remote && !seen[e.nid]){ enemies.splice(i,1); if(netEnts) delete netEnts[e.nid]; } }
  // enemy fire is a shared threat, so it has to be the host's -- clients replace theirs wholesale
  eShots.length=0;
  for(const s of m.sh) eShots.push({x:s[0],y:s[1],px:s[0],py:s[1],vx:s[2],vy:s[3],
                                    r:s[4],bd:s[5],life:3,remote:true});
  const lseen={};
  for(const b of m.lt){ lseen[b[0]]=1;
    let g=null; for(const x of loots){ if(x.lid===b[0]){ g=x; break; } }
    if(!g){ const u=netUnpackBag(b[3]);
      // b[4] is present only on MY OWN bound sacks: real contents, so the panel can compare them
      if(b[4]&&b[4].length){ u.items=b[4]; }
      // life is effectively infinite here: the host owns despawn and the lseen cull below is what
      // removes it. A shorter local life expired bags the host still had, which then reappeared on
      // the next snapshot — a visible flicker on exactly the long-lived rare bags you care about.
      loots.push({lid:b[0],x:b[1],y:b[2],items:u.items,item:u.items[0],
                  rar:u.rar,band:u.band,life:1e9,remote:true}); }
    else { g.x=b[1]; g.y=b[2]; } }
  for(let i=loots.length-1;i>=0;i--){ if(loots[i].remote && !lseen[loots[i].lid]) loots.splice(i,1); }
}

// Called every frame on clients: ease entities toward the last snapshot instead of snapping.
function netInterp(dt){
  if(!netIsClient() || !netEnts) return;
  const k=Math.min(1, NET_LERP*(dt*60));
  for(const e of enemies){ const t=netEnts[e.nid]; if(!t) continue;
    e.px=e.x; e.py=e.y;
    e.x+=(t.tx-e.x)*k; e.y+=(t.ty-e.y)*k; }
  for(const s of eShots){ s.px=s.x; s.py=s.y; s.x+=s.vx*dt; s.y+=s.vy*dt; }  // dead-reckon between packets
}

// Boss hazards are evaluated against the LOCAL player on every machine. The host's mech tick only
// ever tested its own player, so without this a client could stand in a lava pool or miss every
// bloom safe-zone and take nothing -- the mechanic would be theatre for everyone but the host.
function netHazards(dt){
  if(!netIsClient() || typeof damagePlayer!=='function') return;
  for(const e of enemies){
    if(e.pools) for(const p of e.pools){
      if(p.ph!=='live') continue;
      p.dcd=(p.dcd||0)-dt; if(p.dcd>0) continue;
      if(Math.hypot(player.x-p.x,player.y-p.y) < p.r*0.92){
        p.dcd=0.35; damagePlayer((e.bd||10)*0.55);
        if(typeof boom==='function') boom(player.x,player.y,'#c04a3d',4); } }
    const b=e.bloom;
    if(b && b.ph==='live' && !b._done){
      b._done=1;                                    // resolves once, like the host's version
      const safe=(b.safes||[]).some(s=>Math.hypot(player.x-s.x,player.y-s.y)<=b.sr);
      if(!safe){ damagePlayer(typeof bossPunishDmg==='function'?bossPunishDmg(e):(e.bd||10)*2);
        player.inv=Math.max(player.inv||0,0.35); }
      else if(typeof texts!=='undefined')
        texts.push({x:player.x,y:player.y-30,txt:'SAFE!',col:'#8fd48c',life:0.9}); }
  }
}
// A status the client applies has to reach the host, or its damage-over-time ticks against a
// health bar the host does not know is burning.
function netReportStatus(e,id,dur,val){
  if(!netIsClient() || !e || !e.nid) return;
  _netSend({t:'A', nid:e.nid, sid:id, dur:dur, val:val});
}
function netHostApplyStatus(m){
  if(!netIsHost() || typeof applyStatus!=='function') return;
  for(const e of enemies){ if(e.nid===m.nid){ applyStatus(e,m.sid,m.dur,m.val); return; } }
}
// ---- damage: predicted locally, resolved by the host ----
// The client shows the hit instantly so combat feels responsive, and tells the host what happened.
// The next snapshot carries the real health, so a disagreement corrects itself within ~80ms.
function netReportHit(e,dmg,crit){
  if(!netIsClient() || !e || !e.nid) return;
  _netSend({t:'H', nid:e.nid, dmg:Math.round(dmg), crit:crit?1:0});
}
function netHostTakeHit(m){
  if(!netIsHost()) return;
  for(const e of enemies){ if(e.nid===m.nid){
    if(typeof bossImmune==='function' && bossImmune(e)) return;
    e.hp-=m.dmg; e.flash=0.15;
    if(typeof texts!=='undefined') texts.push({x:e.x,y:e.y-e.r,txt:Math.round(m.dmg),
      col:m.crit?'#ffd23d':'#c9d2da',life:0.5});
    return; } }
}
// Loot is single-instance: two players grabbing the same bag must not both get it, so the host
// arbitrates and the first request wins.
function netRequestPickup(b){ if(netIsClient()&&b&&b.lid) _netSend({t:'P', lid:b.lid}); }
function netHostPickup(m,fromId){
  if(!netIsHost()) return;
  for(let i=0;i<loots.length;i++){ const b=loots[i];
    if(b.lid!==m.lid) continue;
    if(b.own && b.own!==fromId) return;      // bound to someone else — deny (the wire already hid it)
    loots.splice(i,1);
    _netSend({t:'G', lid:m.lid, to:fromId, items:(typeof bagItems==='function')?bagItems(b):[b.item]});
    return; }
  // already taken: answer anyway so the loser clears its in-flight latch instead of retrying
  _netSend({t:'G', lid:m.lid, to:fromId, items:null});
}
// Host-only: retire soulbound sacks whose owner is gone, so they stop eating a snapshot row and a
// slot in the world forever. Grace periods, not instant despawn — a player who dies, respawns or
// hitches for two seconds must not lose a T12 for it.
function netReapBound(dt){
  if(!netIsHost()) return;                                     // solo + clients: one boolean, out
  const now=performance.now(), rk=(curRoom&&curRoom.key)||'?', me=netSelfId();
  for(let i=loots.length-1;i>=0;i--){ const b=loots[i];
    if(!b.own || b.own===me) continue;
    const p=coop.peers[b.own];
    // a reconnect gets a brand new peer id, so a disconnected owner can never come back for it
    if(!p || now-(p.ts||0)>4000){ b._orph=(b._orph||0)+dt; if(b._orph>10) loots.splice(i,1); continue; }
    b._orph=0;
    if(p.rm!==rk){ b._away=(b._away||0)+dt; if(b._away>30) loots.splice(i,1); }
    else b._away=0; }
}
// Route an inbound message. 14_coop.js calls this for anything that is not a presence packet.
function netOnMessage(d, fromId){
  if(!d||!d.t) return false;
  if(d.t==='W'){ netApplyWorld(d); return true; }
  if(d.t==='H'){ netHostTakeHit(d); return true; }
  if(d.t==='A'){ netHostApplyStatus(d); return true; }
  if(d.t==='P'){ netHostPickup(d, fromId); return true; }
  if(d.t==='G'){
    if(d.to!==netSelfId()) return true;
    // drop the local ghost NOW rather than waiting up to 83ms for the next snapshot's cull, or the
    // bag lingers under your feet and re-arms the prompt you just answered
    for(let i=loots.length-1;i>=0;i--) if(loots[i].lid===d.lid) loots.splice(i,1);
    const list=d.items||(d.item?[d.item]:null);
    if(list && typeof takeLoot==='function') for(const it of list) takeLoot(it);
    return true; }
  return false;
}
