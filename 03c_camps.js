// ===================================================================================================
//  03c_camps.js — WAR CAMPS (user, 2026-08-01)
// ---------------------------------------------------------------------------------------------------
//  "Procedurally generate structures matching the zones theme and enemies where group of enemies will
//   be found including a couple elites. Make sure it's not too tightly packed."
//  "It gives the area purpose for grinding gear outside of the world boss fights."
//
//  THAT LAST LINE IS THE DESIGN. Before this, a zone had exactly one reason to be in it -- its boss --
//  and the boss is now on a thirty-minute lockout. Everything between lairs was scattered roaming
//  trash on a per-hero cap of 3-8, which is fine for travel and useless for farming: you cannot
//  clear anything, because there is nothing that is a THING. A camp is a place you can arrive at,
//  fight through, and leave empty, with two elites in it that drop what elites drop.
//
//  WHY DECOR AND SPAWN POINTS, AND NOT TERRAIN. A camp could have been carved into the tile grid the
//  way stampLairs carves a den. It deliberately is not:
//    * the tile alphabet is 5 bits and full -- see 02_worldbuild's assert
//    * carving walls into open ground risks the connectivity the generator guarantees, and the
//      selftest's flood fill from the landing is the thing that proves island C is unreachable
//    * a camp should be somewhere you walk INTO, not a room with a door
//  So a camp is props (R.decor) plus spawn points (R.spawns), both of which the world already
//  streams by proximity, and neither of which can strand a player.
//
//  DETERMINISTIC. Placed from the world seed, never Math.random: co-op peers must agree about where
//  a camp is without exchanging a message, and "the ridge camp" should be a place you learn rather
//  than a slot machine. Same reasoning as eliteRoll hashing the spawn point.
// ===================================================================================================

// ---- the shape of a camp -------------------------------------------------------------------------
// NOT TOO TIGHTLY PACKED, which the user asked for twice over -- camps apart from each other, and
// the enemies inside one apart from each other. Both are enforced as minimum distances rather than
// hoped for: a rejection sample with a floor is the only thing that actually guarantees spacing.
const CAMP_R         = 8;    // tiles: the camp's own radius
const CAMP_MIN_GAP   = 46;   // tiles between two camps
const CAMP_LAIR_GAP  = 44;   // tiles clear of any lair, so a camp never bleeds into a boss fight
const CAMP_MOB_GAP   = 3.2;  // tiles between two enemies inside a camp
const CAMP_PROP_GAP  = 2.9;  // tiles between two props -- wider now the props are 1.75x
const CAMP_PER_ZONE  = 2;    // camps per territory
const CAMP_MOBS      = [5,8];// roamers per camp, low..high by zone level
const CAMP_ELITES    = 2;    // "including a couple elites"

// ---- the themes ----------------------------------------------------------------------------------
// One per terrain band, so a camp is made of what its zone is made of. `props` is the vocabulary
// drawCampProp knows how to draw; `col` tints the ground scar and the banner.
const CAMP_THEMES = [
  {k:'wreck',   col:'#8a7a5a', props:['spar','net','fire','crate']},        // 0 landing sands
  {k:'wreck',   col:'#7f8a92', props:['spar','net','fire','barrel']},       // 1 gullwind shore
  {k:'stilts',  col:'#6f7a4a', props:['reed','rack','fire','hut']},         // 2 sawgrass fens
  {k:'palis',   col:'#5c7a44', props:['stake','tent','fire','crate']},      // 3 verdant belt
  {k:'palis',   col:'#4d6b3c', props:['stake','tent','fire','rack']},       // 4 wolfwood
  {k:'bone',    col:'#6b6250', props:['bone','totem','fire','rack']},       // 5 deep timber
  {k:'quarry',  col:'#8a8a8a', props:['block','crane','fire','crate']},     // 6 stonebrow
  {k:'slag',    col:'#a05a32', props:['slag','brazier','anvil','crate']},   // 7 cinderwatch
  {k:'slag',    col:'#8a4a4a', props:['slag','brazier','totem','bone']},    // 8 the ashfall
  {k:'rift',    col:'#8a6ad4', props:['shard','totem','brazier','bone']},   // 9 rift band
];
function campTheme(band){
  const i=Math.max(0,Math.min(CAMP_THEMES.length-1, band|0));
  return CAMP_THEMES[i];
}

// IS THIS TILE, AND A MARGIN AROUND IT, OPEN GROUND? Written against the ROOM rather than calling
// solid()/standable(), which both read `curRoom` -- and at load time curRoom is the Hearth, not the
// overworld, so every test would have been answered about the wrong map. Reads the packed grid the
// same way solid() does, through T_SOLID and T_BLOCKSMALL.
function _campClear(R,tx,ty,margin){
  margin=margin||0;
  for(let dy=-margin; dy<=margin; dy++) for(let dx=-margin; dx<=margin; dx++){
    const x=tx+dx, y=ty+dy;
    if(x<1||y<1||x>=R.w-1||y>=R.h-1) return false;
    const c=(typeof gCode==='function')?gCode(R,x,y):0;
    if(!c) return false;                                   // code 0 is INVALID by construction
    if(typeof T_SOLID!=='undefined' && T_SOLID[c]) return false;
    if(typeof T_BLOCKSMALL!=='undefined' && T_BLOCKSMALL[c]) return false;
  }
  return true;
}

// ---- deterministic noise -------------------------------------------------------------------------
// Integer hash, not Math.sin: the same reason 00c_worldgen refuses trig in a tile decision.
// Math.sin/cos are implementation-defined in ECMAScript, so two browsers can disagree about where a
// camp is, and two co-op peers would each be fighting a camp the other cannot see.
function _campHash(a,b,c){
  let h=(Math.imul(a|0,374761393) + Math.imul(b|0,668265263) + Math.imul(c|0,2246822519))>>>0;
  h^=h>>>13; h=Math.imul(h,1274126177)>>>0; h^=h>>>16;
  return h>>>0;
}
function _campRnd(a,b,c){ return _campHash(a,b,c)/4294967296; }

// ===================================================================================================
//  PLACEMENT
// ---------------------------------------------------------------------------------------------------
//  Runs once, after stampLairs, because it has to know where the lairs are in order to stay away
//  from them. Walks each territory, tries candidate points inside it, and keeps the first that is
//  standable, far enough from every lair, and far enough from every camp already placed.
// ===================================================================================================
let _campsStamped=false;
function stampCamps(){
  const R=(typeof rooms!=='undefined')?rooms['G']:null;
  if(!R||!R.cells||_campsStamped) return;
  if(typeof _territories!=='function') return;
  _campsStamped=true;
  R.camps=[];

  // _territories takes the ROOM. Called bare it reads `R&&R.rings` off `undefined`, returns null,
  // and stampCamps quietly placed nothing -- R.camps came back as an empty array and the whole
  // feature was silently absent. Same for zoneAt below, which reads curRoom: at load time curRoom
  // is not the overworld yet, so the in-its-own-territory test has to be zoneAtIn(R,...).
  const T=_territories(R);
  if(!T||!T.length){ _campsStamped=false; return; }
  // every lair centre, in tiles, so the distance test below is one flat array rather than a lookup
  const lairs=[];
  for(const k in (R.lairs||{})){ const L=R.lairs[k];
    if(L&&L.cx!=null) lairs.push({x:L.cx/TILE, y:L.cy/TILE}); }

  for(let z=0; z<T.length; z++){
    const t=T[z]; if(!t||!t.n) continue;
    const band=(t.band!==undefined)?t.band:0;
    const theme=campTheme(band);
    // the zone's own level decides how busy its camps are, the same way the roaming cap does
    const zlv=(t.lvmin!==undefined)?t.lvmin:1;
    const nMob=Math.round(CAMP_MOBS[0]+(CAMP_MOBS[1]-CAMP_MOBS[0])*Math.min(1,zlv/50));

    let placed=0;
    // A BUDGET, NOT A WHILE-TRUE. A narrow territory can genuinely have nowhere legal left once the
    // lair and the first camp have taken their exclusion discs, and a loop that insists would hang
    // the load. Failing to place the second camp in a cramped zone is an acceptable outcome; hanging
    // is not.
    for(let attempt=0; attempt<220 && placed<CAMP_PER_ZONE; attempt++){
      // candidate: jitter around the territory's centroid, widening as attempts fail
      const spread=(0.25+0.75*(attempt/220))*Math.sqrt(t.n||1)*0.9;
      const a=_campRnd(z,attempt,1)*6.28318;
      const d=_campRnd(z,attempt,2)*spread;
      const tx=Math.round((t.sx/t.n)+Math.cos(a)*d);
      const ty=Math.round((t.sy/t.n)+Math.sin(a)*d);
      if(tx<CAMP_R+2||ty<CAMP_R+2||tx>=R.w-CAMP_R-2||ty>=R.h-CAMP_R-2) continue;
      // it must be in ITS OWN territory, or a camp drifts into the neighbouring level band and a
      // Lv8 player walks into Lv20 elites
      if(typeof zoneAtIn==='function' && zoneAtIn(R,tx,ty)!==z) continue;
      // and on ground a body can stand on, with room around it
      if(!_campClear(R,tx,ty,2)) continue;
      let ok=true;
      for(const L of lairs) if(Math.hypot(L.x-tx,L.y-ty)<CAMP_LAIR_GAP){ ok=false; break; }
      if(ok) for(const c of R.camps) if(Math.hypot(c.tx-tx,c.ty-ty)<CAMP_MIN_GAP){ ok=false; break; }
      if(!ok) continue;

      const camp={tx:tx, ty:ty, z:z, band:band, k:theme.k, col:theme.col,
                  cx:(tx+.5)*TILE, cy:(ty+.5)*TILE, props:[], mobs:0, elites:0};
      _campFill(R, camp, theme, nMob);
      R.camps.push(camp);
      placed++;
    }
  }
  if(typeof console!=='undefined' && console.info)
    console.info('stampCamps: '+R.camps.length+' camps across '+T.length+' territories');
}

// Props and spawn points for one camp, both spaced by rejection sampling against what is already
// down. The two share a rejection list on purpose: an enemy standing inside a tent reads as a bug.
function _campFill(R, camp, theme, nMob){
  const taken=[];
  const far=(x,y,gap)=>{ for(const p of taken) if(Math.hypot(p.x-x,p.y-y)<gap) return false; return true; };
  const legal=(x,y)=>_campClear(R,Math.round(x),Math.round(y),1);

  // ---- THE ENEMIES GO DOWN FIRST ----
  // Order matters and the first version had it backwards. Props were laid first and the enemies
  // rejected against them, so the props ate the centre of the disc -- which is exactly where the
  // elites are placed -- and 30 camps came out with 12 elites between them instead of 60, and 2-4
  // roamers instead of 5-8. The fight is the point of a camp and the scenery is dressing, so the
  // fight is placed first and the scenery works around it.
  const want=nMob+CAMP_ELITES;
  for(let i=0;i<want;i++){
    const isElite=(i<CAMP_ELITES);
    let done=false;
    for(let tryN=0; tryN<60 && !done; tryN++){
      const a=_campRnd(camp.tx,camp.ty,400+i*17+tryN)*6.28318;
      // elites toward the middle, roamers toward the edge: you fight your way in
      const band=isElite ? (0.12+0.38*_campRnd(camp.tx,camp.ty,500+i*11+tryN))
                         : (0.42+0.55*_campRnd(camp.tx,camp.ty,500+i*11+tryN));
      const rr=CAMP_R*band;
      const x=Math.round(camp.tx+Math.cos(a)*rr), y=Math.round(camp.ty+Math.sin(a)*rr);
      if(!legal(x,y) || !far(x,y,CAMP_MOB_GAP)) continue;
      // 'c' is a roamer; the spawner streams these exactly like any other spawn point, so a camp
      // costs nothing until you are within 800px of it
      const sp={t:'c', x:x, y:y, camp:1};
      if(isElite){ sp.elite=1; camp.elites++; } else camp.mobs++;
      R.spawns.push(sp);
      taken.push({x:x,y:y});
      done=true;
    }
    // A CAMP THAT CANNOT FIT ITS SECOND ELITE STILL GETS ONE. Relaxing the spacing for the last
    // resort is better than a camp with no elite in it: the elites are the reason to clear it.
    if(!done && isElite){
      for(let tryN=0; tryN<40 && !done; tryN++){
        const a=_campRnd(camp.tx,camp.ty,700+i*23+tryN)*6.28318;
        const rr=CAMP_R*(0.15+0.75*_campRnd(camp.tx,camp.ty,800+i*29+tryN));
        const x=Math.round(camp.tx+Math.cos(a)*rr), y=Math.round(camp.ty+Math.sin(a)*rr);
        if(!legal(x,y) || !far(x,y,CAMP_MOB_GAP*0.62)) continue;
        R.spawns.push({t:'c', x:x, y:y, camp:1, elite:1});
        camp.elites++; taken.push({x:x,y:y}); done=true;
      }
    }
  }

  // ---- then the props: the structure ----
  // A ring rather than a scatter, because a ring reads as a camp and a scatter reads as litter.
  // They reject against the enemies as well as against each other, so nothing stands inside a tent.
  const nProp=9+Math.round(_campRnd(camp.tx,camp.ty,11)*4);
  for(let i=0;i<nProp;i++){
    for(let tryN=0; tryN<18; tryN++){
      const a=(i/nProp)*6.28318 + (_campRnd(camp.tx,camp.ty,100+i*7+tryN)-0.5)*0.7;
      const rr=CAMP_R*(0.58+0.40*_campRnd(camp.tx,camp.ty,200+i*13+tryN));
      const x=camp.tx+Math.cos(a)*rr, y=camp.ty+Math.sin(a)*rr;
      if(!legal(x,y) || !far(x,y,CAMP_PROP_GAP)) continue;
      const kind=theme.props[_campHash(camp.tx,camp.ty,300+i)%theme.props.length];
      camp.props.push({t:kind, x:x, y:y});
      taken.push({x:x,y:y});
      break;
    }
  }
  // the fire in the middle, wherever the middle is still free -- it is what makes the centre read
  // as occupied, but it never displaces a body
  if(far(camp.tx,camp.ty,1.6)) camp.props.push({t:'fire', x:camp.tx, y:camp.ty});

  // the spawn bucket index is built once per room and cached; adding points after it exists would
  // leave them invisible to the streamer
  if(R._spGrid) R._spGrid=null;
}

// ===================================================================================================
//  DRAWING
// ---------------------------------------------------------------------------------------------------
//  Called from the decor pass in 09_sprites. Everything here is canvas primitives: the art budget is
//  spent (9 generations left of 9,355) and a camp is timber, cloth and stone, which is what the
//  wardrobe mirror and the market stalls are already drawn with.
// ===================================================================================================
// A TILE IS 44px AND THE FIRST PASS DREW PROPS AT ABOUT 20. Against terrain boulders that are
// already bigger than that, a camp read as "a worn patch with some litter on it" rather than as a
// structure -- which is the one thing it has to read as. Everything below is drawn at its original
// numbers and scaled about its own anchor, so the shapes keep their proportions and only their
// presence changes.
const CAMP_PROP_SC = 1.75;
function drawCampProp(p, x, y, col){
  const t=(typeof performance!=='undefined')?performance.now()/1000:0;
  ctx.save();
  ctx.translate(x,y); ctx.scale(CAMP_PROP_SC,CAMP_PROP_SC); ctx.translate(-x,-y);
  // every prop gets the same soft ground shadow, so they read as one set rather than as stickers
  ctx.globalAlpha=0.26; ctx.fillStyle='#000';
  ctx.beginPath(); ctx.ellipse(x, y+3, 11, 4.5, 0, 0, 6.29); ctx.fill();
  ctx.globalAlpha=1;
  switch(p.t){
    case 'fire': {
      ctx.fillStyle='#3a2a1c';
      for(let i=0;i<5;i++){ const a=i*1.257;
        ctx.fillRect(x+Math.cos(a)*8-2, y+Math.sin(a)*4-1, 4, 3); }
      const f=0.7+0.3*Math.sin(t*6.1);
      ctx.globalCompositeOperation='lighter';
      ctx.fillStyle='rgba(255,150,60,0.55)';
      ctx.beginPath(); ctx.ellipse(x, y-6, 6*f, 11*f, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle='rgba(255,220,140,0.75)';
      ctx.beginPath(); ctx.ellipse(x, y-5, 3*f, 6*f, 0, 0, 6.29); ctx.fill();
      ctx.globalCompositeOperation='source-over';
      break; }
    case 'tent': {
      ctx.fillStyle='#4a3a28'; ctx.beginPath();
      ctx.moveTo(x-15,y+4); ctx.lineTo(x,y-18); ctx.lineTo(x+15,y+4); ctx.closePath(); ctx.fill();
      ctx.fillStyle=col; ctx.globalAlpha=0.5;
      ctx.beginPath(); ctx.moveTo(x-15,y+4); ctx.lineTo(x,y-18); ctx.lineTo(x-3,y+4); ctx.closePath(); ctx.fill();
      ctx.globalAlpha=1;
      ctx.fillStyle='#2a1f16'; ctx.fillRect(x-2,y-6,4,10);            // the doorway
      break; }
    case 'hut': {
      ctx.fillStyle='#5a4630'; ctx.fillRect(x-13,y-12,26,16);
      ctx.fillStyle='#6b5438'; ctx.beginPath();
      ctx.moveTo(x-16,y-12); ctx.lineTo(x,y-22); ctx.lineTo(x+16,y-12); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#241a12'; ctx.fillRect(x-4,y-6,8,10);
      break; }
    case 'stake': {
      ctx.fillStyle='#4a3524';
      for(let i=-1;i<=1;i++){ ctx.fillRect(x+i*7-2, y-16, 4, 20);
        ctx.beginPath(); ctx.moveTo(x+i*7-2,y-16); ctx.lineTo(x+i*7,y-21); ctx.lineTo(x+i*7+2,y-16);
        ctx.closePath(); ctx.fill(); }
      ctx.fillStyle='#5c3f28'; ctx.fillRect(x-11,y-11,22,3);
      break; }
    case 'spar': {
      ctx.save(); ctx.translate(x,y); ctx.rotate(-0.5);
      ctx.fillStyle='#6b5438'; ctx.fillRect(-16,-3,32,6);
      ctx.fillStyle='#4a3a28'; ctx.fillRect(-16,-3,32,2);
      ctx.restore(); break; }
    case 'net': {
      ctx.strokeStyle='#7a6a4a'; ctx.lineWidth=1; ctx.globalAlpha=0.85;
      for(let i=-2;i<=2;i++){ ctx.beginPath(); ctx.moveTo(x+i*5,y-10); ctx.lineTo(x+i*5,y+4); ctx.stroke(); }
      for(let j=0;j<4;j++){ ctx.beginPath(); ctx.moveTo(x-10,y-10+j*4); ctx.lineTo(x+10,y-10+j*4); ctx.stroke(); }
      ctx.globalAlpha=1; break; }
    case 'reed': {
      ctx.strokeStyle='#6f7a4a'; ctx.lineWidth=2;
      for(let i=0;i<6;i++){ const dx=(i-2.5)*3;
        ctx.beginPath(); ctx.moveTo(x+dx,y+3); ctx.lineTo(x+dx+Math.sin(t*0.8+i)*2, y-14); ctx.stroke(); }
      break; }
    case 'rack': {
      ctx.fillStyle='#4a3524'; ctx.fillRect(x-12,y-14,3,18); ctx.fillRect(x+9,y-14,3,18);
      ctx.fillStyle='#5c3f28'; ctx.fillRect(x-12,y-14,24,3);
      ctx.fillStyle='#7a5a3a';
      for(let i=0;i<3;i++) ctx.fillRect(x-8+i*7,y-11,3,8);          // hides hung to cure
      break; }
    case 'crate': {
      ctx.fillStyle='#5a4630'; ctx.fillRect(x-9,y-11,18,15);
      ctx.fillStyle='#6b5438'; ctx.fillRect(x-9,y-11,18,3);
      ctx.fillStyle='#3a2a1c'; ctx.fillRect(x-9,y-4,18,2); ctx.fillRect(x-1,y-11,2,15);
      break; }
    case 'barrel': {
      ctx.fillStyle='#5a4630'; ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(x-7,y-14,14,18,3); else ctx.rect(x-7,y-14,14,18);
      ctx.fill();
      ctx.fillStyle='#3a2a1c'; ctx.fillRect(x-7,y-9,14,2); ctx.fillRect(x-7,y-2,14,2);
      break; }
    case 'block': {
      ctx.fillStyle='#8a8a8a'; ctx.fillRect(x-11,y-13,22,17);
      ctx.fillStyle='#9a9a9a'; ctx.fillRect(x-11,y-13,22,3);
      ctx.fillStyle='#6a6a6a'; ctx.fillRect(x-11,y-5,22,1);
      break; }
    case 'crane': {
      ctx.fillStyle='#4a3524'; ctx.fillRect(x-2,y-24,4,28);
      ctx.save(); ctx.translate(x,y-22); ctx.rotate(0.4);
      ctx.fillStyle='#5c3f28'; ctx.fillRect(0,-2,20,4); ctx.restore();
      ctx.strokeStyle='#3a2a1c'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(x+18,y-14); ctx.lineTo(x+18,y-4); ctx.stroke();
      break; }
    case 'slag': {
      ctx.fillStyle='#3a2a24';
      ctx.beginPath(); ctx.moveTo(x-13,y+4); ctx.lineTo(x-5,y-11); ctx.lineTo(x+4,y-6);
      ctx.lineTo(x+12,y+4); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation='lighter';
      ctx.fillStyle='rgba(255,110,40,'+(0.30+0.12*Math.sin(t*2.2)).toFixed(3)+')';
      ctx.beginPath(); ctx.ellipse(x-1,y-2,6,3,0,0,6.29); ctx.fill();
      ctx.globalCompositeOperation='source-over';
      break; }
    case 'brazier': {
      ctx.fillStyle='#3a3a42'; ctx.fillRect(x-2,y-10,4,14);
      ctx.fillStyle='#4a4a54'; ctx.beginPath(); ctx.ellipse(x,y-12,8,4,0,0,6.29); ctx.fill();
      const f=0.7+0.3*Math.sin(t*5.3+x*0.1);
      ctx.globalCompositeOperation='lighter';
      ctx.fillStyle='rgba(255,140,60,0.6)';
      ctx.beginPath(); ctx.ellipse(x,y-17,4*f,8*f,0,0,6.29); ctx.fill();
      ctx.globalCompositeOperation='source-over';
      break; }
    case 'anvil': {
      ctx.fillStyle='#3a3a42'; ctx.fillRect(x-4,y-4,8,8);
      ctx.fillRect(x-9,y-11,18,6); ctx.fillRect(x-11,y-9,4,3);
      break; }
    case 'bone': {
      ctx.fillStyle='#c9c2ae';
      ctx.fillRect(x-10,y-1,20,3);
      ctx.beginPath(); ctx.arc(x-10,y,3,0,6.29); ctx.fill();
      ctx.beginPath(); ctx.arc(x+10,y,3,0,6.29); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x-2,y-9,6,5,0,0,6.29); ctx.fill();      // a skull on top
      ctx.fillStyle='#2a2620';
      ctx.beginPath(); ctx.arc(x-4,y-9,1.4,0,6.29); ctx.fill();
      ctx.beginPath(); ctx.arc(x,y-9,1.4,0,6.29); ctx.fill();
      break; }
    case 'totem': {
      ctx.fillStyle='#4a3524'; ctx.fillRect(x-4,y-22,8,26);
      ctx.fillStyle=col;
      ctx.beginPath(); ctx.moveTo(x-9,y-22); ctx.lineTo(x,y-30); ctx.lineTo(x+9,y-22); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#2a1f16'; ctx.fillRect(x-4,y-16,8,2); ctx.fillRect(x-4,y-10,8,2);
      break; }
    case 'shard': {
      ctx.fillStyle='rgba(138,106,212,0.85)';
      ctx.beginPath(); ctx.moveTo(x,y-22); ctx.lineTo(x+7,y-4); ctx.lineTo(x,y+4);
      ctx.lineTo(x-7,y-4); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation='lighter';
      ctx.fillStyle='rgba(160,130,255,'+(0.20+0.12*Math.sin(t*1.9)).toFixed(3)+')';
      ctx.beginPath(); ctx.arc(x,y-9,12,0,6.29); ctx.fill();
      ctx.globalCompositeOperation='source-over';
      break; }
  }
  ctx.restore();
}

// The camp's ground scar, drawn UNDER everything else so props and bodies sit on it. A trodden
// patch is what says "this is a place" before any single prop does.
function drawCampGround(camp){
  const x=camp.cx, y=camp.cy, r=CAMP_R*TILE;
  ctx.save();
  ctx.globalAlpha=0.26;
  ctx.fillStyle='#151009';
  ctx.beginPath(); ctx.ellipse(x, y, r*0.92, r*0.66, 0, 0, 6.29); ctx.fill();
  ctx.globalAlpha=0.16; ctx.fillStyle=camp.col||'#8a7a5a';
  ctx.beginPath(); ctx.ellipse(x, y, r*0.62, r*0.44, 0, 0, 6.29); ctx.fill();
  ctx.restore();
}

// Stamped at load, immediately after 03_entities has placed the lairs (its own tail calls
// stampLairs, and this file is loaded after it). Guarded on rooms['G'] the same way, so a build
// that has not generated the overworld yet simply does nothing.
if(typeof rooms!=='undefined' && rooms['G']) stampCamps();
