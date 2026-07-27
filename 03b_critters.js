// ===================================================================================
// 03b_critters.js — HEARTH LIVESTOCK (user, 2026-07-27: "chickens and sheep roaming around the
// hearth, for a warmer and calming feeling")
//
// These are the only creatures in the game that cannot hurt you and cannot be hurt. They are not
// enemies, they are not pets, and they carry no stats — they exist so the town reads as a place
// people live rather than a menu with a floor. Deliberately kept out of `enemies` entirely: one
// stray membership there and every AoE, every sweep, every "kill room" would slaughter the flock.
//
// The behaviour is written for CALM. Nothing here is fast, nothing startles hard, and the two
// species idle differently on purpose: a hen is busy and jittery (peck, peck, look up, scurry) and
// a sheep is slow and heavy (graze for a long time, amble, stop). Watching them should lower your
// pulse a little after a run.
// ===================================================================================

let critters=[];

// Each species: how it moves, how long it dwells, how big it draws, and what it does standing still.
const CRITTERS={
  chicken:{
    n:'chicken', spd:26, r:7, draw:23,
    wander:[0.6,1.6],        // seconds spent walking
    dwell:[1.2,3.4],         // seconds spent stopped
    flee:74, fleeSpd:88, fleeFor:1.5,
    idle:'peck',             // dips its head on a fast beat
    bobF:9.5, bobA:1.3,      // a quick nervous bounce while walking
  },
  sheep:{
    n:'sheep', spd:15, r:11, draw:34,
    wander:[1.4,3.2],
    dwell:[3.0,7.5],         // sheep stand around for a LONG time
    flee:56, fleeSpd:46, fleeFor:1.1,
    idle:'graze',            // head down, barely moving
    bobF:3.2, bobA:0.8,
  },
};
function _crRnd(a){ return a[0]+Math.random()*(a[1]-a[0]); }

// Place a flock. Called from enterRoom for the Hearth; safe to call twice (it clears first).
function spawnCritters(room){
  critters=[];
  if(!room || !room.critters) return;
  for(const spec in room.critters){
    const C=CRITTERS[spec]; if(!C) continue;
    const n=room.critters[spec];
    for(let i=0;i<n;i++){
      const p=_critterSpot(room);
      if(!p) continue;
      critters.push({
        spec:spec, x:p.x, y:p.y, hx:p.x, hy:p.y,   // hx/hy = the patch it belongs to
        dir:Math.floor(Math.random()*4), ang:Math.random()*6.283,
        st:'dwell', t:_crRnd(C.dwell), fr:Math.random()*4, seed:Math.random()*6.283,
        idleT:0, fleeT:0,
      });
    }
  }
}
// somewhere open, and not on top of the fountain or a stall
function _critterSpot(room){
  const W=(room.w||RW), H=(room.h||RH);
  for(let i=0;i<200;i++){
    const x=(2+Math.random()*(W-4))*TILE, y=(2+Math.random()*(H-4))*TILE;
    if(typeof solid==='function' && solid(x,y)) continue;
    if(typeof standable==='function' && !standable(x,y,10)) continue;
    return {x,y};
  }
  return null;
}
// 4-direction facing from a heading, matching the sprite set (south/east/north/west)
function _critterDir(vx,vy){
  if(Math.abs(vx)>Math.abs(vy)) return vx>0?1:3;
  return vy>0?0:2;
}
const CR_DIRN=['south','east','north','west'];

function tickCritters(dt){
  if(!critters.length) return;
  for(const c of critters){
    const C=CRITTERS[c.spec]; if(!C) continue;
    // A hero running past should ruffle them — but gently, and briefly. They scatter a step or two
    // and settle again; nothing in the Hearth should ever look panicked.
    let fleeing=false;
    if(typeof player!=='undefined' && player){
      const dx=c.x-player.x, dy=c.y-player.y, d=Math.hypot(dx,dy);
      if(d<C.flee && d>0.01){ c.fleeT=C.fleeFor; c.ang=Math.atan2(dy,dx); }
    }
    if(c.fleeT>0){ c.fleeT-=dt; fleeing=true; }

    if(fleeing){
      const s=C.fleeSpd*dt;
      _critterMove(c,Math.cos(c.ang)*s,Math.sin(c.ang)*s);
      c.dir=_critterDir(Math.cos(c.ang),Math.sin(c.ang));
      c.fr=(c.fr+dt*11)%4;
      c.st='wander'; c.t=_crRnd(C.dwell);
      continue;
    }

    c.t-=dt;
    if(c.st==='dwell'){
      c.idleT+=dt;
      if(c.t<=0){
        c.st='wander'; c.t=_crRnd(C.wander);
        // drift back toward its patch rather than wandering off across the whole town
        const hx=c.hx-c.x, hy=c.hy-c.y, hd=Math.hypot(hx,hy);
        c.ang = (hd>110) ? Math.atan2(hy,hx) + (Math.random()-0.5)*1.1
                         : Math.random()*6.283;
      }
    } else {
      const s=C.spd*dt;
      const vx=Math.cos(c.ang), vy=Math.sin(c.ang);
      if(!_critterMove(c,vx*s,vy*s)) c.ang+=2.2+Math.random();   // walked into something: turn
      c.dir=_critterDir(vx,vy);
      c.fr=(c.fr+dt*6.5)%4;
      if(c.t<=0){ c.st='dwell'; c.t=_crRnd(C.dwell); c.idleT=0; }
    }
  }
}
// move if the destination is walkable; returns false when blocked
function _critterMove(c,dx,dy){
  const C=CRITTERS[c.spec], nx=c.x+dx, ny=c.y+dy;
  if(typeof standable==='function' && !standable(nx,ny,C.r)) return false;
  if(typeof solid==='function' && solid(nx,ny)) return false;
  c.x=nx; c.y=ny; return true;
}
