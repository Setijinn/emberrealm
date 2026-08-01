// ===================================================================================
// 09d_bosscompass.js — BOSS COMPASS (user, 2026-07-27: "an arrow in the direction the boss is in,
// tiny, on the edge of the screen, with a picture of what boss and the level range")
//
// The overworld hides its bosses. Each one sits in a lair somewhere on a 1160x720-tile map and
// there is nothing on screen telling you a fight exists, which way it is, or whether you are
// anywhere near ready for it. You found them by wandering.
//
// Small markers pinned to the screen edge, one per lair in range: the boss's own sprite, an arrow
// pointing at it, and the level band of the ground it stands on. Deliberately TINY and dim -- this
// is orientation, not a quest log, and it must never compete with the fight in front of you. A
// marker brightens as you close, and disappears entirely once the boss is actually on screen,
// because at that point the arrow is telling you something your eyes already know.
// ===================================================================================

// A hard distance cap and a hard count cap, both deliberate (user). The compass is orientation,
// not a map: six arrows around the edge is a HUD, two is a hint. Anything past the cap is not
// somewhere you are going right now, and pointing at it would just be clutter you learn to ignore.
// 3000px ~= 68 tiles, on a 1160-tile map. Measured against the actual world: the CLOSEST pair of
// lairs is 5103px apart, so at 1800 the two-marker cap could never engage and you only ever got a
// marker once you were nearly standing on the lair. At 3000 you pick one up around halfway
// between two, which is when "which way, and am I ready" is an actual question.
// DERIVED FROM THE WORLD, NOT TYPED, because the number 3000 only means anything relative to how far
// apart the lairs actually are. At five times the island size the same 3000 would put us straight back
// in the state it was raised to fix, giving you a marker only once you are nearly standing on the lair.
// Expressed as the RATIO, it reproduces the hand-tuned 3000 on today's world and follows the world
// when it grows.
// THE 5103 ABOVE IS STALE and is kept only because it records why 3000 was chosen. Re-measured from
// R.lairs cx/cy at load (the harness prints it): the closest pair is 4622px, not 5103 -- the earlier
// figure predates LAIR_NUDGE moving anchors off their coastlines. 3000/4622 = 0.65, so that is the
// ratio, and the selftest asserts it still lands on 3000 rather than trusting this comment.
// Measured once and cached on the room: lair positions are fixed at load by stampLairs.
const BC_RANGE_FRAC = 0.65;
const BC_RANGE_MIN  = 1800;      // px: below this a marker is useless however small the world is
function bcRange(){
  const R=(typeof curRoom!=='undefined')?curRoom:null;
  if(!R||!R.lairs) return 3000;
  if(R._bcRange) return R._bcRange;
  const L=[]; for(const k in R.lairs){ const l=R.lairs[k]; if(l&&l.cx!=null) L.push(l); }
  let closest=Infinity;
  for(let i=0;i<L.length;i++) for(let j=i+1;j<L.length;j++){
    const d=Math.hypot(L[i].cx-L[j].cx, L[i].cy-L[j].cy);
    if(d<closest) closest=d; }
  // one lair or none: nothing to be halfway between, so fall back to the measured original
  R._bcRange = isFinite(closest) ? Math.max(BC_RANGE_MIN, Math.round(closest*BC_RANGE_FRAC)) : 3000;
  return R._bcRange;
}
const BC_MAX     = 2;      // never more than two on screen, nearest first
const BC_NEAR    = 700;    // px: inside this it is "close" and the marker goes bright
const BC_MARGIN  = 34;     // px from the screen edge to the marker's centre
const BC_SIZE    = 22;     // px: the boss portrait

// Where every boss in this room is, and how far. Overworld lairs only -- a dungeon has exactly one
// boss and you are already walking toward it, so a compass would be noise.
function bossCompassTargets(){
  const out=[];
  if(typeof curRoom==='undefined'||!curRoom||!curRoom.lairs) return out;
  if(typeof player==='undefined'||!player) return out;
  for(const k in curRoom.lairs){
    const L=curRoom.lairs[k]; if(!L) continue;
    const d=Math.hypot(L.cx-player.x, L.cy-player.y);
    if(d>bcRange()) continue;
    // "Is there a fight here?" is NOT ringBossAlive() -- a lair boss only exists as an entity
    // while you are standing near it, so that is false almost always and every marker drew dim.
    // The real signal is the respawn cooldown: a lair you just cleared is on the clock, everything
    // else is a fight waiting for you.
    const cd=(typeof ringBossCd!=='undefined'&&ringBossCd)?(ringBossCd[L.b]||0):0;
    out.push({b:L.b, x:L.cx, y:L.cy, d:d, alive:cd<=0});
  }
  // a dead lair never takes one of the two slots from a live one
  out.sort((a,b)=>((a.alive?0:1)-(b.alive?0:1)) || (a.d-b.d));
  return out.slice(0,BC_MAX);
}
// THE BOSS'S OWN LEVEL (user, 2026-07-31: "give it the boss level"). It used to widen the reading
// into the band its zone spans -- "20-22" -- which is the ground's level, not the animal's. The
// boss is spawned with lv = grvLvAt at its own lair (spawnRingBoss), so reading the same function
// at the same point gives exactly the number the thing you are walking toward will have.
function bossCompassLv(L){
  if(curRoom && curRoom.rings && typeof grvLvAt==='function')
    return Math.round(grvLvAt(L.x/TILE, L.y/TILE));
  return 0;
}
// mm:ss, for a lockout that is now half an hour rather than half a minute
function bossCdText(sec){
  sec=Math.max(0,Math.ceil(sec));
  const m=Math.floor(sec/60), ss=sec%60;
  return m+':'+(ss<10?'0':'')+ss;
}
function drawBossCompass(){
  if(typeof ctx==='undefined'||!ctx) return;
  if(typeof curRoom==='undefined'||!curRoom||curRoom.town||curRoom.dungeon) return;
  const targets=bossCompassTargets();
  if(!targets.length) return;
  const us=(typeof UIS!=='undefined')?UIS:1;
  const sz=Math.round(BC_SIZE*us), mg=Math.round(BC_MARGIN*us);
  // Keep out of the HUD's way at BOTH ends. The bottom edge is the orbs, the XP bar and the
  // ability buttons -- a marker parked there is invisible and in the way at once -- and the top
  // is the minimap and the button row.
  const loY=Math.round(96*us), hiY=H-Math.round(120*us);
  for(const t of targets){
    // is it already on screen? then say nothing.
    const sp=(typeof w2s==='function')?w2s(t.x,t.y):{x:W/2,y:H/2};
    const onScreen=(sp.x>-40&&sp.x<W+40&&sp.y>-40&&sp.y<H+40);
    if(onScreen) continue;
    // direction from the CENTRE of the screen, then pushed out to the edge
    const ang=Math.atan2(sp.y-H/2, sp.x-W/2);
    const hw=W/2-mg, hh=(H/2-mg);
    // ray-box: how far along `ang` until we hit the edge rectangle
    const cs=Math.cos(ang), sn=Math.sin(ang);
    const tx=(cs===0)?1e9:Math.abs(hw/cs), ty=(sn===0)?1e9:Math.abs(hh/sn);
    const r=Math.min(tx,ty);
    let mx=W/2+cs*r, my=H/2+sn*r;
    my=Math.max(loY, Math.min(hiY, my));
    // Floor the alpha well above "did I imagine that". The first pass faded to 0.22 for a lair on
    // respawn cooldown and 0.50 at the edge of range, which on a bright overworld read as nothing.
    const near=t.d<BC_NEAR;
    const a=t.alive ? (near?1.0:0.72+0.28*(1-Math.min(1,t.d/bcRange()))) : 0.42;
    ctx.save();
    ctx.globalAlpha=a;
    // the arrow: a small triangle pointing the way, drawn OUTSIDE the portrait
    const axr=mx+cs*(sz*0.72), ayr=my+sn*(sz*0.72);
    ctx.translate(axr,ayr); ctx.rotate(ang);
    ctx.fillStyle=t.alive?'#ffd07a':'#6a6472';
    ctx.beginPath(); ctx.moveTo(sz*0.34,0); ctx.lineTo(-sz*0.20,sz*0.24); ctx.lineTo(-sz*0.20,-sz*0.24);
    ctx.closePath(); ctx.fill();
    // BACK TO THE CANVAS BASE, NOT TO IDENTITY. 01_constants.js establishes
    // setTransform(DPR,0,0,DPR,0,0) as this canvas's identity. Resetting to a true 1:1 matrix
    // drew everything below at 1/DPR scale AND 1/DPR position -- correct on a non-retina desktop,
    // wrong on every phone this PWA targets. The arrow above is drawn before the reset, which is
    // why it looked right while the plate floated half-size in the wrong place.
    ctx.setTransform(DPR,0,0,DPR,0,0);
    // the portrait plate
    ctx.globalAlpha=a;
    const GB=(typeof GBOSS!=='undefined')?GBOSS[t.b]:null;
    ctx.fillStyle='rgba(12,9,16,0.82)';
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(mx-sz/2-2,my-sz/2-2,sz+4,sz+4,4); else ctx.rect(mx-sz/2-2,my-sz/2-2,sz+4,sz+4);
    ctx.fill();
    ctx.lineWidth=1.5; ctx.strokeStyle=(GB&&GB.col)?GB.col:'#8a6a34'; ctx.stroke();
    // the boss's own art, through the same path the world uses
    const slot=(typeof bossArt==='function')?bossArt(t.b):t.b;
    let im=null;
    if(typeof _bossAnim!=='undefined' && _bossAnim[slot] && _bossAnim[slot].idle
       && _bossAnim[slot].idle[0] && _bossAnim[slot].idle[0].naturalWidth) im=_bossAnim[slot].idle[0];
    if(!im && typeof _bossImg!=='undefined' && _bossImg[slot] && _bossImg[slot].naturalWidth) im=_bossImg[slot];
    if(im){
      const bb=(typeof _imgBBox==='function')?_imgBBox(im):{x:0,y:0,w:im.naturalWidth,h:im.naturalHeight};
      const sc=sz/Math.max(bb.w,bb.h), w=bb.w*sc, h=bb.h*sc;
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(im, bb.x,bb.y,bb.w,bb.h, Math.round(mx-w/2), Math.round(my-h/2), Math.round(w), Math.round(h));
    } else if(GB){
      ctx.fillStyle=GB.col||'#c8a06a';
      ctx.beginPath(); ctx.arc(mx,my,sz*0.32,0,6.29); ctx.fill();
    }
    // the boss's level, under the plate. This is the number that decides whether to walk toward it.
    const lv=bossCompassLv(t);
    if(lv){
      const txt='Lv '+lv;
      const fs=Math.max(8,Math.round(9*us));
      ctx.font='bold '+fs+'px "Pixelify Sans",monospace';
      ctx.textAlign='center';
      const ly=my+sz/2+fs+1;
      ctx.fillStyle='rgba(0,0,0,.75)'; ctx.fillText(txt,mx+1,ly+1);
      ctx.fillStyle=t.alive?'#d8cfb8':'#6a6472'; ctx.fillText(txt,mx,ly);
      ctx.textAlign='left';
    }
    ctx.restore();
  }
}


// ===================================================================================================
//  THE OBJECTIVE TRACKER (user, 2026-07-31: "make it like a quest objective thing, give it the
//  boss level")
// ---------------------------------------------------------------------------------------------------
//  The edge markers answer WHICH WAY. They cannot answer what it is called, how far, what level, or
//  whether it is even there right now -- a 22px portrait has no room for any of that, and a boss on
//  a thirty-minute lockout looks identical to one waiting for you except for being slightly dimmer.
//
//  So the same targets also get a small tracker, in the shape every game uses for an objective: a
//  rule down the left edge in the boss's own colour, its name, its level, the distance, and a state
//  line. It sits UNDER THE MINIMAP, which is the one part of the screen already given over to
//  orientation -- the minimap is 146px square at 10,10, so everything below y=166 on the left is
//  free, and the HUD button row and the ability bar are both on the other side or the bottom.
//
//  It never appears in town or in a dungeon, for the same reason the compass does not: in a dungeon
//  there is one boss and you are already walking at it.
const BO_W    = 132;    // px, before UI scale
const BO_ROW  = 30;
const BO_LEFT = 10;

function drawBossObjectives(){
  if(typeof ctx==='undefined'||!ctx) return;
  if(typeof curRoom==='undefined'||!curRoom||curRoom.town||curRoom.dungeon) return;
  const targets=bossCompassTargets();
  if(!targets.length) return;
  const us=(typeof UIS!=='undefined')?UIS:1;
  const w=Math.round(BO_W*us), rowh=Math.round(BO_ROW*us);
  // under the minimap when there is one, and tight to the top corner when there is not
  // miniRect is the ONE geometry function the minimap's painter and hit-test both read, so asking
  // it is how this stays under the panel when the panel resizes rather than guessing 148px.
  const mr=(typeof miniRect==='function')?miniRect():null;
  const mmB=mr ? (mr.y+mr.h) : Math.round((10+148)*us);
  let y=Math.round(mmB+8*us), x=mr?mr.x:Math.round(BO_LEFT*us);

  ctx.save();
  ctx.setTransform(DPR,0,0,DPR,0,0);
  for(const t of targets){
    const GB=(typeof GBOSS!=='undefined')?GBOSS[t.b]:null;
    const col=(GB&&GB.col)?GB.col:'#c8a06a';
    const lv=bossCompassLv(t);
    const cd=(typeof ringBossCd!=='undefined'&&ringBossCd)?(ringBossCd[t.b]||0):0;
    // DISTANCE IN TILES, not pixels. A tile is the unit the player actually moves in and 3000px
    // means nothing to anybody; 68 tiles is a walk you can picture.
    const tiles=Math.round(t.d/TILE);

    ctx.globalAlpha=t.alive?0.92:0.66;
    ctx.fillStyle='rgba(12,9,16,0.78)';
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(x,y,w,rowh,5); else ctx.rect(x,y,w,rowh);
    ctx.fill();
    ctx.fillStyle=col; ctx.fillRect(x,y,Math.max(2,Math.round(2*us)),rowh);   // the rule

    const padL=x+Math.round(7*us);
    const f1=Math.max(9,Math.round(10*us)), f2=Math.max(8,Math.round(8.5*us));
    ctx.textAlign='left';
    ctx.font='bold '+f1+'px "Pixelify Sans",monospace';
    ctx.fillStyle=t.alive?'#e8dcc0':'#8a8494';
    const nm=(GB&&GB.n)?GB.n:'A boss';
    ctx.fillText(nm, padL, y+f1+Math.round(3*us));

    ctx.font=f2+'px "Pixelify Sans",monospace';
    // Lv in the boss's colour so the eye lands on it first -- it is the decision, the rest is detail
    const lvTxt='Lv '+lv;
    ctx.fillStyle=t.alive?col:'#6a6472';
    ctx.fillText(lvTxt, padL, y+rowh-Math.round(5*us));
    const lvW=ctx.measureText(lvTxt).width;
    ctx.fillStyle=t.alive?'#a89e8c':'#5f5a68';
    const state = t.alive ? (tiles+' tiles') : ('back in '+bossCdText(cd));
    ctx.fillText('  \u00b7  '+state, padL+lvW, y+rowh-Math.round(5*us));

    y+=rowh+Math.round(4*us);
  }
  ctx.globalAlpha=1; ctx.textAlign='left';
  ctx.restore();
}
