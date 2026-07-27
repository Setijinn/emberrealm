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
const BC_RANGE   = 3000;   // px: past this, no marker at all
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
    if(d>BC_RANGE) continue;
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
// The level band of the ground a lair sits on, as a string. This is the number that decides
// whether you should be walking toward it or away, so it is the one piece of text on the marker.
function bossCompassLv(L){
  const R=curRoom;
  if(R&&R.rings&&typeof grvLvAt==='function'){
    const lv=Math.round(grvLvAt(L.x/TILE, L.y/TILE));
    // widen to the band the zone actually spans, so it reads as a range rather than false precision
    const names=(R.rings.names)||[];
    for(const n of names) if(lv>=n.lv && lv<=(n.lv2||n.lv)) return n.lv+'-'+(n.lv2||n.lv);
    return 'Lv'+lv;
  }
  return '';
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
    const a=t.alive ? (near?1.0:0.72+0.28*(1-Math.min(1,t.d/BC_RANGE))) : 0.42;
    ctx.save();
    ctx.globalAlpha=a;
    // the arrow: a small triangle pointing the way, drawn OUTSIDE the portrait
    const axr=mx+cs*(sz*0.72), ayr=my+sn*(sz*0.72);
    ctx.translate(axr,ayr); ctx.rotate(ang);
    ctx.fillStyle=t.alive?'#ffd07a':'#6a6472';
    ctx.beginPath(); ctx.moveTo(sz*0.34,0); ctx.lineTo(-sz*0.20,sz*0.24); ctx.lineTo(-sz*0.20,-sz*0.24);
    ctx.closePath(); ctx.fill();
    ctx.setTransform(1,0,0,1,0,0);
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
    // the level band, under the plate. This is the number that decides whether to walk toward it.
    const lv=bossCompassLv(t);
    if(lv){
      const fs=Math.max(8,Math.round(9*us));
      ctx.font='bold '+fs+'px "Pixelify Sans",monospace';
      ctx.textAlign='center';
      const ly=my+sz/2+fs+1;
      ctx.fillStyle='rgba(0,0,0,.75)'; ctx.fillText(lv,mx+1,ly+1);
      ctx.fillStyle=t.alive?'#d8cfb8':'#6a6472'; ctx.fillText(lv,mx,ly);
      ctx.textAlign='left';
    }
    ctx.restore();
  }
}
