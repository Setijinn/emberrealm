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

// ---- THE ONE YOU SHOULD BE WALKING TOWARD ----------------------------------------------------
// User, 2026-07-31: "make sure the quest always points towards the boss of the appropriate player
// level."
//
// bossCompassTargets is a PROXIMITY query -- it answers "what is near me", and near me may be
// nothing at all. Stand in the middle of a 3700x1700 world with every lair beyond bcRange and the
// tracker is empty, which is exactly when a player most wants to be told where to go. And when it
// is not empty it is still sorted by distance, so at a boundary it will happily point you at the
// Lv 44 lair forty tiles away while you are Lv 22.
//
// So there is one more target, chosen by LEVEL rather than by distance and never range-capped: the
// live lair whose boss level is closest to yours. Ties break toward the nearer one, and toward the
// one you can actually fight -- a lair on its half-hour lockout is only offered if nothing else is
// available, because sending you across the map to a locked door is worse than saying nothing.
function bossPrimaryTarget(){
  if(typeof curRoom==='undefined'||!curRoom||!curRoom.lairs) return null;
  if(typeof player==='undefined'||!player) return null;
  const plv=(typeof rpg!=='undefined'&&rpg&&rpg.lvl)?rpg.lvl:1;
  let best=null, bestScore=Infinity;
  for(const k in curRoom.lairs){
    const L=curRoom.lairs[k]; if(!L||L.cx==null) continue;
    const lv=(typeof grvLvAt==='function')?Math.round(grvLvAt(L.cx/TILE,L.cy/TILE)):0;
    const cd=(typeof ringBossCd!=='undefined'&&ringBossCd)?(ringBossCd[L.b]||0):0;
    const d=Math.hypot(L.cx-player.x, L.cy-player.y);
    // the level gap dominates; distance only separates equals, and a locked lair is pushed behind
    // every unlocked one by a margin no level gap on a 1..50 ladder can reach
    const score=Math.abs(lv-plv)*1000 + Math.min(999,d/TILE) + (cd>0?1e6:0);
    if(score<bestScore){ bestScore=score; best={b:L.b, x:L.cx, y:L.cy, d:d, alive:cd<=0, lv:lv, primary:true}; }
  }
  return best;
}

// ONE OBJECTIVE, NEVER TWO (user, 2026-08-01: "only one quest bubble should ever be active at a
// time"). It listed the level-appropriate boss plus whatever else was in range, which put two cards
// on screen with two level numbers and two arrows pointing different ways -- and a card that moves
// to the side its boss is on cannot have a companion without the pair fighting over the same edge.
// Two objectives is not an objective, it is a menu.
//
// The one that survives is the LEVEL-APPROPRIATE one, because that is the question the tracker
// exists to answer. bossCompassTargets is kept as the proximity fallback for the case where nothing
// scores at all -- an empty lair table, or a room with no rings.
function bossObjectiveList(){
  const pri=bossPrimaryTarget();
  if(pri) return [pri];
  const near=bossCompassTargets();
  return near.length?[near[0]]:[];
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
  // the same list the tracker shows, so the arrow and the row can never disagree about what you
  // are being sent at
  const targets=bossObjectiveList();
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
    // ON SCREEN USED TO MEAN SILENCE. That is right for a boss you can see, and wrong for the
    // several frames where it is technically within the viewport rectangle but behind terrain, or
    // a pixel inside the edge -- the arrow blinked out and back. It fades instead, so there is
    // never a moment with nothing pointing.
    const onScreen=(sp.x>40&&sp.x<W-40&&sp.y>40&&sp.y<H-40);
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
    // THE PLATE AND THE LEVEL MOVED INTO THE BUBBLE. What is left here is the one thing a
    // bubble parked under the minimap cannot express: which way to walk. A portrait at the screen
    // edge was always a compromise -- 22px of a boss is a smudge -- and now that its name, level,
    // distance and description are all in one place, repeating a worse copy of it out here would
    // only split the player's attention between two objects saying the same thing.
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
// ONE BUBBLE, WITH THE SPRITE IN IT (user, 2026-07-31: "make the description and level and
// everything part of the bubble with the sprite").
//
// It was two objects saying halves of the same thing: a 22px portrait pinned to the screen edge,
// and a separate text row under the minimap. You had to look in two places and join them up
// yourself, and neither had room for the one line that tells you what the fight actually is --
// GBOSS carries a `desc` for every boss ("A patient colossus that erupts in rings of thorns. Weave
// the gaps and wear it down.") and nothing had ever shown it outside the boss-intro banner.
//
// Now the bubble is the whole objective: the boss's own art on the left, then its name, its level,
// how far, and what it does. The screen edge keeps a bare ARROW -- direction is the one thing a
// bubble parked under the minimap genuinely cannot express.
// SQUARE, not a letterbox (user, 2026-08-01: "make it more of a perfect square"). It was 232 wide
// and about 54 tall -- a strip, which is what you get when the sprite sits BESIDE the text and the
// description then has to run sideways. Stacking it instead, portrait over name over stats over
// description, gives a card whose height falls out of its own contents at roughly its own width,
// and a bigger portrait for free: 54px against 40.
const BO_W     = 152;     // px at UI scale 1
const BO_SPR   = 54;      // the portrait, now on its own row above the text
const BO_PAD   = 8;
const BO_LEFT  = 10;

// Wrap `txt` to `max` px at the current font, at most `lines` lines, ellipsising the last.
function _boWrap(txt,max,lines){
  const words=String(txt).split(/\s+/);
  const out=[]; let cur='';
  for(const wd of words){
    const t=cur?cur+' '+wd:wd;
    if(ctx.measureText(t).width<=max){ cur=t; continue; }
    if(cur) out.push(cur);
    cur=wd;
    if(out.length>=lines) break;
  }
  if(cur && out.length<lines) out.push(cur);
  if(out.length>=lines){
    // the last line carries whatever is left, cut to fit
    let last=out[lines-1];
    if(ctx.measureText(last).width>max || words.join(' ').length>out.join(' ').length){
      while(last.length>1 && ctx.measureText(last+'\u2026').width>max) last=last.slice(0,-1);
      if(words.join(' ').length>out.join(' ').length) last+='\u2026';
      out[lines-1]=last;
    }
  }
  return out.slice(0,lines);
}

function drawBossObjectives(){
  if(typeof ctx==='undefined'||!ctx) return;
  if(typeof curRoom==='undefined'||!curRoom||curRoom.town||curRoom.dungeon) return;
  const targets=bossObjectiveList();
  if(!targets.length) return;
  const us=(typeof UIS!=='undefined')?UIS:1;
  // SMALLER ON A PHONE (user, 2026-08-01: "make the quest box a little smaller on mobile"). UIS
  // already scales the HUD, but it scales UP as well as down and a 152px card is a fifth of the
  // width of an 812px landscape phone while being a tenth of a desktop's -- the same card is
  // proportionally twice the screen. Keyed on HEIGHT, the same axis style.css uses for the banner,
  // because this is a landscape-only game and height is what actually varies between a phone and a
  // desktop. The description drops to two lines at the same time: three lines of 8px text on a
  // 375px-tall screen is a paragraph in the middle of a fight.
  const small=(typeof H!=='undefined' && H<=470);
  const k=small?0.78:1;
  const w=Math.round(BO_W*us*k), spr=Math.round(BO_SPR*us*k), pad=Math.round(BO_PAD*us*k);

  // THE BUBBLE SITS ON THE SIDE THE BOSS IS ON (user, 2026-08-01). Parked under the minimap it was
  // in a fixed corner regardless of where you were being sent, so the arrow was doing all the work
  // and the bubble was doing none of it. Placed by bearing, the panel itself becomes the pointer:
  // the boss is north-east, the bubble is up and to the right, and you have read the direction
  // before you have read a word of it.
  const mr=(typeof miniRect==='function')?miniRect():null;
  const pad2=Math.round(10*us);
  // the HUD owns both ends: the minimap and the button row at the top, the orbs, xp bar and
  // ability buttons at the bottom. The same band the edge arrows are clamped to.
  const loY=Math.round(96*us), hiY=H-Math.round(150*us);
  const placed=[];

  ctx.save();
  ctx.setTransform(DPR,0,0,DPR,0,0);
  for(const t of targets){
    // bearing first: it decides where the whole thing goes, so it is computed before the layout.
    // World bearing plus the camera's rotation -- 08_render's camRot is driven by Z/C on PC, and
    // ignoring it points a confident arrow at the wrong quarter of the map.
    const ang=Math.atan2(t.y-player.y, t.x-player.x)
            + ((typeof camRot!=='undefined')?camRot:0);
    const cs=Math.cos(ang), sn=Math.sin(ang);
    const GB=(typeof GBOSS!=='undefined')?GBOSS[t.b]:null;
    const col=(GB&&GB.col)?GB.col:'#c8a06a';
    const lv=(t.lv!==undefined)?t.lv:bossCompassLv(t);
    const cd=(typeof ringBossCd!=='undefined'&&ringBossCd)?(ringBossCd[t.b]||0):0;
    const tiles=Math.round(t.d/TILE);
    const f1=Math.max(9,Math.round(10.5*us*k));    // name
    const f2=Math.max(8,Math.round(9*us*k));       // level + distance
    const f3=Math.max(7,Math.round(8.5*us*k));     // description

    // ONLY THE PRIMARY GETS ITS DESCRIPTION. Two full bubbles is a wall; the second entry is
    // context, not an objective, so it stays a single line.
    // WIDTH ONLY, not position. The text is centred on the card, so where it starts depends on x --
    // and x is not chosen until the placement block below. Reading it here put a `let` in its
    // temporal dead zone and drawBossObjectives threw on every frame ("Cannot access 'x' before
    // initialization"), the same trap the mount draw fell into with `_up`. The wrap only needs the
    // WIDTH, which is a property of the card rather than of where the card ends up.
    const txtW=w-pad*2;
    let desc=[];
    if(t.primary && GB && GB.desc){
      ctx.font=f3+'px "Pixelify Sans",monospace';
      desc=_boWrap(GB.desc, txtW, small?2:3);
    }
    // the height is whatever the stack needs, so a card with no description is simply shorter
    // rather than a square with a hole in it
    const h=pad + spr + Math.round(6*us) + f1 + Math.round(5*us) + f2
            + (desc.length?Math.round(4*us)+desc.length*(f3+Math.round(2*us)):0) + pad;

    // ---- WHERE IT GOES, from the bearing ----
    // Left or right when the bearing is more sideways than vertical, top or bottom otherwise, and
    // then clamped inside the band the HUD leaves free. The arrow lives on the OUTWARD side, so it
    // always sits between the bubble and the edge the boss is beyond.
    const sideways=Math.abs(cs)>=Math.abs(sn);
    const arrowGap=Math.round(20*us);
    let x, y;
    if(sideways){
      x = (cs>0) ? (W-w-pad2-arrowGap) : (pad2+arrowGap);
      y = H/2 + sn*(H*0.30) - h/2;
    } else {
      x = W/2 + cs*(W*0.30) - w/2;
      y = (sn>0) ? (H-h-pad2) : pad2;
    }
    x=Math.max(pad2+arrowGap, Math.min(W-w-pad2-arrowGap, x));
    y=Math.max(loY, Math.min(hiY-h, y));
    // KEEP OFF THE MINIMAP. It is a fixed square in the top-left and a bubble laid over it hides
    // the other half of the orientation the player is using.
    if(mr && x < mr.x+mr.w+pad2 && y < mr.y+mr.h+pad2) y = mr.y+mr.h+pad2;
    // ...and off each other. Two objectives on the same bearing would stack in the same place.
    for(const q of placed){
      if(Math.abs(x-q.x)<w && Math.abs(y-q.y)<Math.max(h,q.h)+Math.round(4*us))
        y = q.y+q.h+Math.round(6*us);
    }
    y=Math.max(loY, Math.min(hiY-h, y));
    placed.push({x:x,y:y,h:h});

    ctx.globalAlpha=t.alive?0.94:0.7;
    ctx.fillStyle='rgba(12,9,16,0.82)';
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(x,y,w,h,6); else ctx.rect(x,y,w,h);
    ctx.fill();
    ctx.lineWidth=1; ctx.strokeStyle=t.alive?col:'#4a4552'; ctx.stroke();
    ctx.fillStyle=col; ctx.fillRect(x,y,w,Math.max(2,Math.round(2*us)));   // the rule, along the top
    const cx2=x+w/2;

    // ---- the sprite, through the same path the world draws it with ----
    const slot=(typeof bossArt==='function')?bossArt(t.b):t.b;
    let im=null;
    if(typeof _bossAnim!=='undefined' && _bossAnim[slot] && _bossAnim[slot].idle
       && _bossAnim[slot].idle[0] && _bossAnim[slot].idle[0].naturalWidth) im=_bossAnim[slot].idle[0];
    if(!im && typeof _bossImg!=='undefined' && _bossImg[slot] && _bossImg[slot].naturalWidth) im=_bossImg[slot];
    const sx=x+(w-spr)/2, sy=y+pad+Math.round(2*us);
    if(im){
      const bb=(typeof _imgBBox==='function')?_imgBBox(im):{x:0,y:0,w:im.naturalWidth,h:im.naturalHeight};
      const sc=spr/Math.max(bb.w,bb.h), iw=bb.w*sc, ih=bb.h*sc;
      ctx.imageSmoothingEnabled=false;
      if(!t.alive) ctx.globalAlpha=0.45;
      ctx.drawImage(im, bb.x,bb.y,bb.w,bb.h,
                    Math.round(sx+(spr-iw)/2), Math.round(sy+(spr-ih)/2), Math.round(iw), Math.round(ih));
      ctx.globalAlpha=t.alive?0.94:0.7;
    } else {
      ctx.fillStyle=col; ctx.beginPath(); ctx.arc(sx+spr/2, sy+spr/2, spr*0.3, 0, 6.29); ctx.fill();
    }

    // ---- the text, centred under the portrait ----
    let ty=y+pad+spr+Math.round(6*us)+f1;
    ctx.textAlign='center';
    ctx.font='bold '+f1+'px "Pixelify Sans",monospace';
    ctx.fillStyle=t.alive?'#e8dcc0':'#8a8494';
    // the name gets the card's full width and is cut rather than allowed to run past the frame --
    // "The Sawgrass Reaper" is wider than 152px and there is nowhere for it to go
    ctx.fillText(_boWrap((GB&&GB.n)?GB.n:'A boss', txtW, 1)[0]||'', cx2, ty);

    ty+=Math.round(5*us)+f2;
    // Lv and the distance on one centred line: two measurements, drawn as a unit so the pair stays
    // centred rather than the second half hanging off the middle
    const lvTxt='Lv '+lv;
    const stTxt='  \u00b7  '+(t.alive?(tiles+' tiles'):('back in '+bossCdText(cd)));
    ctx.font='bold '+f2+'px "Pixelify Sans",monospace';
    const lvW=ctx.measureText(lvTxt).width;
    ctx.font=f2+'px "Pixelify Sans",monospace';
    const stW=ctx.measureText(stTxt).width;
    const startX=cx2-(lvW+stW)/2;
    ctx.textAlign='left';
    ctx.font='bold '+f2+'px "Pixelify Sans",monospace';
    ctx.fillStyle=t.alive?col:'#6a6472';
    ctx.fillText(lvTxt, startX, ty);
    ctx.font=f2+'px "Pixelify Sans",monospace';
    ctx.fillStyle=t.alive?'#a89e8c':'#5f5a68';
    ctx.fillText(stTxt, startX+lvW, ty);

    if(desc.length){
      ctx.textAlign='center';
      ctx.font=f3+'px "Pixelify Sans",monospace';
      ctx.fillStyle='#8f8778';
      ty+=Math.round(4*us);
      for(const line of desc){ ty+=f3+Math.round(2*us); ctx.fillText(line, cx2, ty); }
    }

    // ---- THE ARROW, BESIDE THE BUBBLE ----
    // Outside it, on whichever face points at the boss, and rotated to the exact bearing so it is a
    // direction rather than a side. Never inside the panel: an arrow among the text competes with
    // the text, and the whole reason the bubble moved is that the direction should be readable
    // before any of the words are.
    const ar=Math.round(9*us);
    let ax, ay;
    if(sideways){ ax=(cs>0)?(x+w+arrowGap*0.55):(x-arrowGap*0.55); ay=y+h/2; }
    else        { ax=x+w/2; ay=(sn>0)?(y+h+arrowGap*0.55):(y-arrowGap*0.55); }
    ctx.save();
    ctx.translate(ax,ay); ctx.rotate(ang);
    ctx.globalAlpha=t.alive?1:0.55;
    ctx.fillStyle=t.alive?col:'#6a6472';
    ctx.beginPath();
    ctx.moveTo(ar,0); ctx.lineTo(-ar*0.62,ar*0.66); ctx.lineTo(-ar*0.24,0); ctx.lineTo(-ar*0.62,-ar*0.66);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha=1; ctx.textAlign='left';
  ctx.restore();
}
