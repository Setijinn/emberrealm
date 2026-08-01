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
// 8 TILES WAS TOO WIDE TO READ. The props sit on a ring at roughly 0.6-1.0 of the radius, so at 8
// that ring is ~39 tiles of circumference and a dozen props on it are one every three tiles -- a
// scattering, not a structure. At 6 the same dozen sit close enough to be one place, and the camp
// still comfortably holds ten bodies at CAMP_MOB_GAP apart (a 6-tile disc is 113 tiles of area
// against the ~80 that ten enemies at 1.6 tiles of personal space need).
const CAMP_R         = 6;    // tiles: the camp's own radius
const CAMP_MIN_GAP   = 46;   // tiles between two camps
const CAMP_LAIR_GAP  = 44;   // tiles clear of any lair, so a camp never bleeds into a boss fight
const CAMP_MOB_GAP   = 3.2;  // tiles between two enemies inside a camp
const CAMP_PROP_GAP  = 2.2;  // tiles between two props
const CAMP_PER_ZONE  = 2;    // camps per territory
const CAMP_MOBS      = [5,8];// roamers per camp, low..high by zone level
const CAMP_ELITES    = 2;    // "including a couple elites"

// ---- the themes ----------------------------------------------------------------------------------
// One per terrain band, so a camp is made of what its zone is made of. `props` is the vocabulary
// drawCampProp knows how to draw; `col` tints the ground scar and the banner.
const CAMP_THEMES = [
  // 0 LANDING SANDS -- wreckers living off what the tide brings in
  {k:'wreck',  col:'#8a7a5a', props:['spar','net','fire','driftpile','fishrack','shellheap','crate','anchor','oarrack','lamp']},
  // 1 GULLWIND SHORE -- the same trade, further out, in worse weather
  {k:'wreck',  col:'#7f8a92', props:['spar','net','fire','sailpost','saltpan','gullcage','barrel','ropecoil','shipwheel','lamp']},
  // 2 SAWGRASS FENS -- fen-folk on stilts, trapping what lives in the water
  {k:'stilts', col:'#6f7a4a', props:['reed','hut','fire','eelpot','mudpot','reedbundle','rack','punt','herbline','lamp']},
  // 3 VERDANT BELT -- a proper stockade: the first camp that is an OUTPOST rather than a shelter
  {k:'palis',  col:'#5c7a44', props:['stake','tent','fire','weaponstand','boarspit','woodpile','crate','grindstone','trough','campbanner']},
  // 4 WOLFWOOD -- hunters. Everything here is about the kill and what you do with it afterwards
  {k:'palis',  col:'#4d6b3c', props:['stake','tent','fire','peltframe','huntstand','boarspit','rack','antlerpile','smokerack','snare']},
  // 5 DEEP TIMBER -- something worse lives here and the camp has started to imitate it
  {k:'bone',   col:'#6b6250', props:['bone','totem','fire','skullpike','cauldron','fungus','rack','candlerow','wardstone','graveheap']},
  // 6 STONEBROW RISE -- a working quarry: cut stone, tools, and the ore it is all for
  {k:'quarry', col:'#8a8a8a', props:['block','crane','fire','orebox','pickrack','rubble','crate','orecart','chiselbench','lamp']},
  // 7 CINDERWATCH -- a forge camp. The fire is the point rather than the comfort
  {k:'slag',   col:'#a05a32', props:['slag','brazier','anvil','ingotstack','bellows','weaponstand','crate','quenchtrough','coalpile','moldrack']},
  // 8 THE ASHFALL -- what is left when a forge camp burns and the survivors stay
  {k:'slag',   col:'#8a4a4a', props:['slag','brazier','ashurn','emberpit','charskull','totem','bone','burnttent','firepike','ashdrift']},
  // 9 THE RIFT -- nobody is living here. They are digging something up
  {k:'rift',   col:'#8a6ad4', props:['shard','crystalbox','riftpylon','floatstone','brazier','totem','surveypost','cagedshard','chalkslate']},
];
// ===================================================================================================
//  REAL ART, ALREADY ON DISK
// ---------------------------------------------------------------------------------------------------
//  Everything a camp is built from below is canvas primitives, drawn because the generation budget
//  is spent. But the boss dens already ship 36 pieces of PixelLab decor -- assets/env/ldec_<set>_<i>
//  -- and they were only ever drawn INSIDE an arena. They are exactly the right kind of object for
//  a camp (skulls, cairns, braziers, crystal, stumps, gravestones, fire pits) and they are the same
//  hand the rest of the world was drawn with, so mixing them in is the single biggest thing that
//  can be done for how a camp looks without generating anything.
//
//  The sets are keyed by BOSS ART SLOT, not by terrain band, so the mapping below is by eye: each
//  band borrows the den decor that is made of the same material its ground is made of.
// ===================================================================================================
// WHICH PIECES, NOT WHICH SET. Borrowing a den's whole set of four put a nest of eggs and a ghost
// on a stump inside a war camp, because those sets were assembled for an ARENA, where a nest is
// scenery and nothing is expected to have been carried there by anyone. Six of the 36 are wrong for
// a camp at any level and are deliberately absent below:
//   ldec_0_3, ldec_4_1  nests of eggs  -- wildlife, and a camp would have eaten them
//   ldec_1_1            a ghost        -- it reads as a mob, and players will swing at it
//   ldec_6_2            a dead beast   -- a corpse nobody has cleared, in a camp that is lived in
//   ldec_8_2, ldec_8_3  gold, a crown  -- they read as lootable, and nothing in a camp is
//   ldec_4_0            a gargoyle     -- a den centrepiece; it outranks the camp it would stand in
// The rest are chosen per band by MATERIAL: a camp borrows only what its own ground is made of, so
// no cattail stands on scorched rock and no lava crystal turns up on a beach.
const CAMP_DEC = [
  // 0 LANDING SANDS -- bare stone above the tide, and what the sea leaves
  ['4_2','4_3','2_1','7_3'],          // cairn, feather on stones, ribcage, campfire
  // 1 GULLWIND SHORE -- the same coast in worse weather
  ['4_2','2_1','7_3','5_2'],          // cairn, ribcage, campfire, stone fire pit
  // 2 SAWGRASS FENS -- standing water and what died in it
  ['2_0','2_1','2_3','7_3'],          // cattails, ribcage, mossed stump, campfire
  // 3 VERDANT BELT -- the first proper wood
  ['0_1','0_2','1_2','7_3'],          // mushrooms, mossed arch, hanging vine, campfire
  // 4 WOLFWOOD -- hunters, so the trophies are the decor
  ['1_3','0_0','1_0','5_2'],          // antlers, horned skull, stump, stone fire pit
  // 5 DEEP TIMBER -- deeper wood, and the camp has started keeping bones
  ['0_0','5_1','1_0','6_3'],          // horned skull, skull pile, stump, standing brazier
  // 6 STONEBROW RISE -- a working quarry: everything here is cut rock
  ['3_1','3_0','3_2','3_3'],          // rubble, cut stump, pillar, a face half out of the stone
  // 7 CINDERWATCH -- a forge camp; the fire is the point
  ['6_3','5_0','7_3','6_1'],          // brazier, molten pit, campfire, gravestone
  // 8 THE ASHFALL -- it burned, and the survivors stayed
  ['7_0','5_1','7_2','6_0'],          // ram skull, skull pile, burnt rune, gravestone still alight
  // 9 THE RIFT -- nobody lives here, they are digging
  ['7_1','5_3','3_2','5_0']           // lava crystal, crystal cluster, a survey pillar, molten pit
];
// THE POOL COMES FROM THE ZONE'S BOSS, not from the ground. bossDecArt() is the same call the den
// makes -- 03_entities:350, DEC_SLOT with a bossArt() fallback -- so a camp in the Grovewarden's
// province is dressed out of the Grovewarden's set, and walking from its camps into its lair is one
// continuous place. That is also what makes a province worth grinding: the camps look like they
// belong to the thing at the end of it.
//
// Then two corrections on top of the raw set:
//   - the seven pieces above are still cut, whatever set they came from
//   - and every pool is TOPPED UP TO SIX, because four pieces against five or six art props per
//     camp meant a repeat on screen -- the Verdant camp showed the same arch twice and Cinderwatch
//     showed the molten pit twice. Fire tops up first: a campfire belongs in every camp that has
//     ever been lived in, whoever rules the province.
const CAMP_DEC_BAN  = {0:[3], 1:[1], 4:[0,1], 6:[2], 8:[2,3]};
// A CAMP HAS ONE FIRE. These three are campfires -- a stone fire pit, a log fire, a standing
// brazier -- and while they were in the ring pool as well as the centre, a camp came out with a
// fire in the middle and another two burning out on the circle, which reads as three camps sharing
// a clearing rather than one camp. They are held back for the centrepiece and never placed on the
// ring. 5_0 (a molten pit) and 6_0 (a grave with a flame at its foot) are NOT in this list: they
// are lit, but neither is something anybody sits around.
const CAMP_DEC_FIRE = ['5_2','7_3','6_3'];
// Stone and bone, for the sets the exclusions leave short. Four of the nine sets keep only two or
// three usable pieces, and spoil, a cairn, a skull pile and a cut pillar are things any camp could
// have without claiming a theme that is not its own.
const CAMP_DEC_FILL = ['3_1','5_1','3_2','4_2'];
const CAMP_DEC_N    = 5;     // ring pieces, the centre fire on top of them

// Resolved once per camp at stamp time and stored on it, so the draw is a lookup and the tables are
// read exactly once. ZBOSS and bossDecArt both live in 03_entities, which loads before this file.
// Returns {ring:[ids], fire:id} -- the ring is what circles the camp, the fire is its middle.
function campDecPool(z, band, tx, ty){
  const ring=[];
  let set=-1;
  const boss=(typeof ZBOSS!=='undefined' && ZBOSS[z]!==undefined) ? ZBOSS[z] : -1;
  if(boss>=0 && typeof bossDecArt==='function'){
    set=bossDecArt(boss);
    const ban=CAMP_DEC_BAN[set]||[];
    for(let k=0;k<4;k++){
      const id=set+'_'+k;
      if(ban.indexOf(k)<0 && CAMP_DEC_FIRE.indexOf(id)<0) ring.push(id);
    }
  } else {
    // A PROVINCE WITH NO BOSS still gets a camp, and ZBOSS carries two -1s. Fall back to the
    // material the ground is made of, which is what this file used before the bosses did.
    const list=CAMP_DEC[Math.max(0,Math.min(CAMP_DEC.length-1, band|0))];
    for(const id of list) if(CAMP_DEC_FIRE.indexOf(id)<0) ring.push(id);
  }
  for(const id of CAMP_DEC_FILL) if(ring.length<CAMP_DEC_N && ring.indexOf(id)<0) ring.push(id);

  // ITS OWN FIRE IF ITS SET HAS ONE -- the graves burn a brazier, Deep keeps a stone pit, the
  // Ashfall a log fire. Where the set owns none it is hashed rather than fixed, because taking the
  // first would have stood the identical pit at the centre of ten of the thirteen provinces.
  let fire=null;
  if(set>=0) for(const id of CAMP_DEC_FIRE) if(id.charAt(0)===(''+set)) { fire=id; break; }
  if(!fire) fire=CAMP_DEC_FIRE[_campHash(tx|0, ty|0, 950)%CAMP_DEC_FIRE.length];
  return {ring:ring, fire:fire};
}

const _campDec = {};
function campDecImg(id){
  if(_campDec[id]) return _campDec[id];
  if(typeof window==='undefined' || typeof Image==='undefined') return null;
  const im=new Image(); im.src='assets/env/ldec_'+id+'.png';
  _campDec[id]=im;
  return im;
}

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
                  cx:(tx+.5)*TILE, cy:(ty+.5)*TILE, props:[], mobs:0, elites:0,
                  dec:campDecPool(z, band, tx, ty)};
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
  const nProp=10+Math.round(_campRnd(camp.tx,camp.ty,11)*4);
  const fireId=camp.dec?camp.dec.fire:null;
  const ringDec=(camp.dec&&camp.dec.ring)?camp.dec.ring:[];
  for(let i=0;i<nProp;i++){
    for(let tryN=0; tryN<18; tryN++){
      const a=(i/nProp)*6.28318 + (_campRnd(camp.tx,camp.ty,100+i*7+tryN)-0.5)*0.7;
      const rr=CAMP_R*(0.62+0.36*_campRnd(camp.tx,camp.ty,200+i*13+tryN));
      const x=camp.tx+Math.cos(a)*rr, y=camp.ty+Math.sin(a)*rr;
      if(!legal(x,y) || !far(x,y,CAMP_PROP_GAP)) continue;
      // WITHOUT REPEATING while there is anything unused left. Picking independently per prop meant
      // a nine-prop camp could show the same crate four times and never show the boar on the spit,
      // which is the one thing that tells you what KIND of camp it is. Walk a hash-rotated copy of
      // the band's list instead, and only start over once every kind has been used once.
      // EVERY THIRD ONE IS REAL ART. Not all of them: the four den pieces per band are landscape
      // features (a cairn, a stump, a gravestone) and a camp made only of those is a clearing with
      // scenery in it, not somewhere people live. The drawn props carry the human half -- the spit,
      // the weapon stand, the crates -- and the art carries the weight. Mixed, the camp reads as
      // built by somebody in a place that was already there.
      // HALF AND HALF. It started at one in three and the art plainly carries the camp better than
      // the shapes do, so the split moved: the drawn props are the human half a den has no piece for.
      if(i%2===1 && ringDec.length){
        // walked, not drawn independently, so all five show before any shows twice
        const id=ringDec[(_campHash(camp.tx,camp.ty,900)+((i/2)|0))%ringDec.length];
        camp.props.push({t:'art', id:id, x:x, y:y});
      } else {
        const kind=theme.props[(_campHash(camp.tx,camp.ty,300)+i)%theme.props.length];
        camp.props.push({t:kind, x:x, y:y});
      }
      taken.push({x:x,y:y});
      break;
    }
  }
  // the fire in the middle, wherever the middle is still free -- it is what makes the centre read
  // as occupied, but it never displaces a body
  // THE CENTREPIECE IS REAL ART. It was the drawn flame in every camp -- a 20px canvas fire at the
  // middle of the one place a camp is supposed to be read from -- while bands 0 and 4 were already
  // showing a proper stone fire pit out on the ring, which made the centre the worst-looking thing
  // in the camp. The drawn one stays as the fallback for a pool that somehow has no fire in it.
  if(far(camp.tx,camp.ty,1.6)){
    camp.props.push(fireId ? {t:'art', id:fireId, x:camp.tx, y:camp.ty}
                        : {t:'fire', x:camp.tx, y:camp.ty});
  }

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
// ONE SCALE FOR EVERYTHING WAS THE BUG (user, 2026-08-01: "make the props logical size"). At a flat
// 1.75x a coil of rope stood as tall as a hut and a crate came up to a knight's chest, because the
// shapes below are all drawn at roughly the same 20-28 unit height and the multiplier never asked
// what the thing was. The table is the prop's size AGAINST A PLAYER: a tile is 44px and the knight
// is about 40 tall, so ~0.8 is ankle-to-shin litter, ~1.2 is waist-height gear you would put a hand
// on, ~1.6 is head height, and 2.0+ is a thing you walk under or into. CAMP_PROP_SC is left as a
// master dial at 1 so the whole set can still be nudged in one place.
const CAMP_PROP_SC = 1.0;
const CAMP_PROP_SZ = {
  // --- you walk into it, or under it -------------------------------------------------------------
  hut:2.4, huntstand:2.4, crane:2.3, tent:2.2, sailpost:2.2, riftpylon:2.2, burnttent:2.0,
  totem:2.0, campbanner:2.0,
  // --- taller than a knight ----------------------------------------------------------------------
  skullpike:1.9, firepike:1.9, oarrack:1.9, punt:1.9, orecart:1.8, stake:1.8, weaponstand:1.7,
  peltframe:1.7, surveypost:1.7, shard:1.7,
  // --- about head height -------------------------------------------------------------------------
  rack:1.6, smokerack:1.6, fishrack:1.6, boarspit:1.6, brazier:1.6, lamp:1.6, wardstone:1.6,
  shipwheel:1.6, cagedshard:1.6, floatstone:1.6, moldrack:1.5, pickrack:1.5, herbline:1.5,
  gullcage:1.5, reedbundle:1.5, fungus:1.5, spar:1.5,
  // --- chest, and things you lean on -------------------------------------------------------------
  net:1.4, reed:1.4, slag:1.3, fire:1.3, anchor:1.3, bellows:1.3, chiselbench:1.3,
  // --- waist height ------------------------------------------------------------------------------
  crate:1.2, barrel:1.2, block:1.2, trough:1.2, quenchtrough:1.2, orebox:1.2, crystalbox:1.2,
  cauldron:1.2, woodpile:1.2, driftpile:1.2, emberpit:1.2, candlerow:1.2, chalkslate:1.2,
  anvil:1.1, grindstone:1.1, eelpot:1.1, ashurn:1.1, antlerpile:1.1, graveheap:1.1, coalpile:1.1,
  // --- litter, and things lying flat on the ground -----------------------------------------------
  snare:1.0, saltpan:1.0, mudpot:1.0, rubble:1.0, ashdrift:1.0,
  ingotstack:0.9, shellheap:0.9, bone:0.9, charskull:0.9, ropecoil:0.7
};

// -----------------------------------------------------------------------------------------------
//  THE PROPS ARE NOT SPRITES, THEY ARE CANVAS SHAPES -- so they were the only things in the world
//  with no outline, no pixel grid and vector-crisp edges, sitting next to art that has all three.
//  That, more than any single shape, is what made the set read as wrong. Each prop is now drawn
//  once into a small offscreen at 1:1, given a dark outline taken from its own alpha, and blitted
//  back scaled with smoothing OFF -- so it lands on the same pixel grid as everything else and
//  carries the same dark keyline. No art files, no generations: it is the existing shapes, shown
//  the way the rest of the game is shown.
// -----------------------------------------------------------------------------------------------
const CP_OFF = 96, CP_AX = 48, CP_AY = 66;      // offscreen size, and where (x,y) sits inside it
const _cpA = (typeof document!=='undefined') ? document.createElement('canvas') : null;
const _cpB = (typeof document!=='undefined') ? document.createElement('canvas') : null;
let _cpAc=null, _cpBc=null;
if(_cpA){ _cpA.width=_cpA.height=CP_OFF; _cpB.width=_cpB.height=CP_OFF;
          _cpAc=_cpA.getContext('2d'); _cpBc=_cpB.getContext('2d'); }

function drawCampProp(p, x, y, col){
  // a borrowed den piece: real art, so it goes straight down at the scale the dens draw it at
  // (TILE*1.1) with its foot on the anchor rather than its middle
  if(p.t==='art'){
    const im=campDecImg(p.id);
    if(im&&im.naturalWidth){
      const w=TILE*1.15, h=w*im.height/im.width;
      ctx.save();
      ctx.globalAlpha=0.28; ctx.fillStyle='#000';
      ctx.beginPath(); ctx.ellipse(x, y, w*0.30, w*0.11, 0, 0, 6.29); ctx.fill();
      ctx.globalAlpha=1;
      ctx.drawImage(im, x-w/2, y-h*0.92, w, h);
      ctx.restore();
    }
    return;
  }
  const S = CAMP_PROP_SC * (CAMP_PROP_SZ[p.t] || 1.2);
  // the ground shadow stays on the MAIN canvas: it belongs under the prop, not inside its outline,
  // and it is sized off the prop so a rope coil does not cast a hut's shadow
  ctx.save();
  ctx.globalAlpha=0.26; ctx.fillStyle='#000';
  ctx.beginPath(); ctx.ellipse(x, y+3*S, 9*S, 3.6*S, 0, 0, 6.29); ctx.fill();
  ctx.globalAlpha=1;
  ctx.restore();

  if(!_cpAc){ _cpBody(ctx, p, x, y, col); return; }   // no DOM (headless audit) -- draw it straight
  _cpAc.clearRect(0,0,CP_OFF,CP_OFF);
  _cpBody(_cpAc, p, CP_AX, CP_AY, col);
  // the outline is the prop's own silhouette in near-black. source-in multiplies the fill by the
  // art's alpha, so a solid timber gets a hard keyline and a flame's glow gets only a faint one --
  // which is what you want, since an opaque ring around a fire would look like a hole.
  _cpBc.clearRect(0,0,CP_OFF,CP_OFF);
  _cpBc.globalCompositeOperation='source-over';
  _cpBc.drawImage(_cpA,0,0);
  _cpBc.globalCompositeOperation='source-in';
  _cpBc.fillStyle='#120c07'; _cpBc.fillRect(0,0,CP_OFF,CP_OFF);
  _cpBc.globalCompositeOperation='source-over';

  const sm=ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled=false;
  const dw=CP_OFF*S, dh=CP_OFF*S, dx=x-CP_AX*S, dy=y-CP_AY*S;
  ctx.drawImage(_cpB, dx-1, dy,   dw, dh);
  ctx.drawImage(_cpB, dx+1, dy,   dw, dh);
  ctx.drawImage(_cpB, dx,   dy-1, dw, dh);
  ctx.drawImage(_cpB, dx,   dy+1, dw, dh);
  ctx.drawImage(_cpA, dx,   dy,   dw, dh);
  ctx.imageSmoothingEnabled=sm;
}

// The shapes themselves. `ctx` is a PARAMETER here, shadowing the global one, so every case below
// draws into whichever canvas it is handed -- the offscreen normally, the screen when there is no
// DOM to make one on. Nothing in the switch had to change for that.
function _cpBody(ctx, p, x, y, col){
  const t=(typeof performance!=='undefined')?performance.now()/1000:0;
  ctx.save();
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
    // ---- shared: a light source. A camp that is occupied after dark has one, and only the
    //      coastal and working camps would actually hang a lamp rather than just build a fire ----
    case 'lamp': {
      ctx.fillStyle='#4a3524'; ctx.fillRect(x-2,y-24,4,28);
      ctx.fillStyle='#5c3f28'; ctx.fillRect(x-2,y-26,12,2.5);
      ctx.fillStyle='#3a3a42'; ctx.fillRect(x+6,y-24,7,8);
      const f=0.7+0.3*Math.sin(t*4.4+x*0.07);
      ctx.fillStyle='rgba(255,210,130,0.95)'; ctx.fillRect(x+7.5,y-22.5,4,5);
      ctx.globalCompositeOperation='lighter';
      ctx.fillStyle='rgba(255,190,90,'+(0.22*f).toFixed(3)+')';
      ctx.beginPath(); ctx.arc(x+9.5,y-20,14,0,6.29); ctx.fill();
      ctx.globalCompositeOperation='source-over';
      break; }
    // ---- 0 LANDING SANDS, second round ----
    case 'anchor': {                                      // dragged up the beach and left
      ctx.fillStyle='#6a6a72'; ctx.fillRect(x-1.6,y-22,3.2,22);
      ctx.fillRect(x-8,y-18,16,3);
      ctx.beginPath(); ctx.arc(x,y-24,4,0,6.29); ctx.fill();
      ctx.fillStyle='#5a5a62';
      ctx.beginPath(); ctx.moveTo(x-11,y-2); ctx.quadraticCurveTo(x,y+6,x+11,y-2);
      ctx.lineTo(x+8,y-5); ctx.quadraticCurveTo(x,y+1,x-8,y-5); ctx.closePath(); ctx.fill();
      break; }
    case 'oarrack': {                                     // oars, stood where they will dry
      ctx.fillStyle='#4a3524'; ctx.fillRect(x-12,y-13,24,3);
      for(let i=0;i<4;i++){ const ox=x-8+i*5.4;
        ctx.save(); ctx.translate(ox,y); ctx.rotate((i-1.5)*0.14);
        ctx.fillStyle='#7a6248'; ctx.fillRect(-1.4,-26,2.8,26);
        ctx.beginPath(); ctx.ellipse(0,-28,3,5,0,0,6.29); ctx.fill();
        ctx.restore(); }
      break; }
    // ---- 1 GULLWIND SHORE, second round ----
    case 'ropecoil': {                                    // heavy line, coiled where it was dropped
      ctx.strokeStyle='#8a7a58'; ctx.lineWidth=3; ctx.globalAlpha=0.95;
      for(let i=0;i<4;i++){ ctx.beginPath(); ctx.ellipse(x,y-i*1.6,12-i*2.4,6-i*1.2,0,0,6.29); ctx.stroke(); }
      ctx.globalAlpha=1; break; }
    case 'shipwheel': {                                   // the one piece of the wreck worth keeping
      ctx.strokeStyle='#6b5438'; ctx.lineWidth=3.4;
      ctx.beginPath(); ctx.arc(x,y-13,10,0,6.29); ctx.stroke();
      ctx.fillStyle='#5c3f28';
      for(let i=0;i<6;i++){ const a=i*1.047;
        ctx.save(); ctx.translate(x,y-13); ctx.rotate(a); ctx.fillRect(-1.4,-15,2.8,30); ctx.restore(); }
      ctx.fillStyle='#4a3524'; ctx.beginPath(); ctx.arc(x,y-13,3.4,0,6.29); ctx.fill();
      break; }
    // ---- 2 SAWGRASS FENS, second round ----
    case 'punt': {                                        // a flat boat, the only way across the fen
      ctx.fillStyle='#6b5438';
      ctx.beginPath(); ctx.moveTo(x-17,y-2); ctx.quadraticCurveTo(x,y+7,x+17,y-2);
      ctx.lineTo(x+15,y-7); ctx.quadraticCurveTo(x,y-1,x-15,y-7); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#4a3a28';
      ctx.beginPath(); ctx.moveTo(x-15,y-7); ctx.quadraticCurveTo(x,y-1,x+15,y-7);
      ctx.lineTo(x+15,y-9); ctx.quadraticCurveTo(x,y-3,x-15,y-9); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#7a6248'; ctx.save(); ctx.translate(x+6,y-6); ctx.rotate(-0.9);
      ctx.fillRect(-1.2,-16,2.4,20); ctx.restore();
      break; }
    case 'herbline': {                                    // fen physick, hung to dry
      ctx.fillStyle='#4a3524'; ctx.fillRect(x-14,y-20,3,24); ctx.fillRect(x+11,y-20,3,24);
      ctx.strokeStyle='#8a7a58'; ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.moveTo(x-13,y-18); ctx.lineTo(x+12,y-18); ctx.stroke();
      const G=['#7a9a52','#8aa860','#6f8a4a'];
      for(let i=0;i<5;i++){ const hx=x-10+i*5.2;
        ctx.fillStyle=G[i%3];
        ctx.beginPath(); ctx.ellipse(hx,y-13,2.6,5.5,0,0,6.29); ctx.fill(); }
      break; }
    // ---- 3 VERDANT BELT, second round ----
    case 'grindstone': {                                  // where the weapon stand's edges come from
      ctx.fillStyle='#4a3524'; ctx.fillRect(x-11,y-4,4,8); ctx.fillRect(x+7,y-4,4,8);
      ctx.fillStyle='#8a8a8a'; ctx.beginPath(); ctx.arc(x,y-9,9,0,6.29); ctx.fill();
      ctx.fillStyle='#6a6a6a'; ctx.beginPath(); ctx.arc(x,y-9,3,0,6.29); ctx.fill();
      ctx.fillStyle='#5c3f28'; ctx.fillRect(x-1.4,y-9,10,2.4);
      break; }
    case 'trough': {                                      // water, because a stockade holds horses
      ctx.fillStyle='#5a4630'; ctx.fillRect(x-14,y-7,28,12);
      ctx.fillStyle='#3a2a1c'; ctx.fillRect(x-14,y-7,28,2.5);
      ctx.fillStyle='#2f4a58'; ctx.fillRect(x-12,y-4,24,7);
      ctx.globalAlpha=0.5; ctx.fillStyle='#7fb0c4';
      ctx.fillRect(x-12,y-4+Math.sin(t*1.5)*0.6,24,2); ctx.globalAlpha=1;
      break; }
    case 'campbanner': {                                  // whose camp it is
      ctx.fillStyle='#4a3524'; ctx.fillRect(x-2,y-30,4,34);
      ctx.fillStyle=col;
      ctx.beginPath(); ctx.moveTo(x+2,y-28); ctx.lineTo(x+16,y-28); ctx.lineTo(x+13,y-21);
      ctx.lineTo(x+16,y-14); ctx.lineTo(x+2,y-14); ctx.closePath(); ctx.fill();
      ctx.globalAlpha=0.35; ctx.fillStyle='#000';
      ctx.beginPath(); ctx.moveTo(x+2,y-21); ctx.lineTo(x+16,y-21); ctx.lineTo(x+16,y-14);
      ctx.lineTo(x+2,y-14); ctx.closePath(); ctx.fill(); ctx.globalAlpha=1;
      break; }
    // ---- 4 WOLFWOOD, second round ----
    case 'antlerpile': {                                  // the season's take
      ctx.strokeStyle='#c9c2ae'; ctx.lineWidth=2.2;
      for(let i=0;i<3;i++){ const ax=x-7+i*7, ay=y-2-(i%2)*3;
        ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(ax+2,ay-9);
        ctx.moveTo(ax+2,ay-9); ctx.lineTo(ax-2,ay-13);
        ctx.moveTo(ax+2,ay-9); ctx.lineTo(ax+6,ay-12); ctx.stroke(); }
      break; }
    case 'smokerack': {                                   // meat, over a low smoke
      ctx.fillStyle='#4a3524'; ctx.fillRect(x-13,y-20,3,24); ctx.fillRect(x+10,y-20,3,24);
      ctx.fillStyle='#5c3f28'; ctx.fillRect(x-13,y-20,26,3); ctx.fillRect(x-13,y-13,26,2);
      ctx.fillStyle='#7a4a3a';
      for(let i=0;i<4;i++) ctx.fillRect(x-9+i*6,y-18,4,6);
      ctx.globalAlpha=0.20; ctx.fillStyle='#cfc8bd';
      ctx.beginPath(); ctx.ellipse(x,y-26+Math.sin(t*0.9)*2,10,6,0,0,6.29); ctx.fill();
      ctx.globalAlpha=1; break; }
    case 'snare': {                                       // set, and still waiting
      ctx.fillStyle='#4a3524'; ctx.fillRect(x-1.4,y-18,2.8,20);
      ctx.strokeStyle='#8a7a58'; ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.moveTo(x,y-17); ctx.quadraticCurveTo(x+9,y-14,x+8,y-6); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x+8,y-4,4.5,2.6,0,0,6.29); ctx.stroke();
      break; }
    // ---- 5 DEEP TIMBER, second round ----
    case 'candlerow': {                                   // somebody is still keeping a vigil
      for(let i=0;i<4;i++){ const cx4=x-7+i*4.8, h4=6+((i*5)%5);
        ctx.fillStyle='#d8d0bc'; ctx.fillRect(cx4-1.4,y-h4,2.8,h4);
        const f=0.7+0.3*Math.sin(t*5+i*1.7);
        ctx.globalCompositeOperation='lighter';
        ctx.fillStyle='rgba(255,210,140,'+(0.55*f).toFixed(3)+')';
        ctx.beginPath(); ctx.ellipse(cx4,y-h4-2.4,1.5*f,3*f,0,0,6.29); ctx.fill();
        ctx.globalCompositeOperation='source-over'; }
      break; }
    case 'wardstone': {                                   // a stone set against whatever is out there
      ctx.fillStyle='#6a6470';
      ctx.beginPath(); ctx.moveTo(x-8,y+2); ctx.lineTo(x-6,y-20); ctx.lineTo(x+6,y-22);
      ctx.lineTo(x+8,y+2); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#8a6ad4'; ctx.globalAlpha=0.85;
      ctx.fillRect(x-3,y-16,6,2); ctx.fillRect(x-3,y-11,6,2); ctx.fillRect(x-2,y-6,4,2);
      ctx.globalAlpha=1; break; }
    case 'graveheap': {                                   // and losing
      ctx.fillStyle='#4a4238';
      ctx.beginPath(); ctx.ellipse(x,y-2,14,6,0,0,6.29); ctx.fill();
      ctx.fillStyle='#5a5248';
      ctx.beginPath(); ctx.ellipse(x-1,y-4,10,4,0,0,6.29); ctx.fill();
      ctx.fillStyle='#4a3524'; ctx.save(); ctx.translate(x+4,y-8); ctx.rotate(0.25);
      ctx.fillRect(-1.4,-10,2.8,12); ctx.fillRect(-5,-7,10,2.4); ctx.restore();
      break; }
    // ---- 6 STONEBROW RISE, second round ----
    case 'orecart': {                                     // how it leaves the quarry
      ctx.fillStyle='#5a4630'; ctx.fillRect(x-13,y-14,26,12);
      ctx.fillStyle='#3a2a1c'; ctx.fillRect(x-13,y-14,26,2.5);
      ctx.fillStyle='#b8863a';
      for(let i=0;i<4;i++) ctx.fillRect(x-9+i*5.5,y-17,4,3.5);
      ctx.fillStyle='#3a3a42';
      ctx.beginPath(); ctx.arc(x-8,y-1,4.5,0,6.29); ctx.fill();
      ctx.beginPath(); ctx.arc(x+8,y-1,4.5,0,6.29); ctx.fill();
      break; }
    case 'chiselbench': {                                 // where the blocks are squared
      ctx.fillStyle='#5a4630'; ctx.fillRect(x-14,y-10,28,4);
      ctx.fillStyle='#4a3524'; ctx.fillRect(x-12,y-6,3,10); ctx.fillRect(x+9,y-6,3,10);
      ctx.fillStyle='#9a9a9a'; ctx.fillRect(x-6,y-16,10,6);
      ctx.fillStyle='#8a8a92'; ctx.save(); ctx.translate(x+8,y-12); ctx.rotate(-0.5);
      ctx.fillRect(-1.2,-7,2.4,9); ctx.restore();
      break; }
    // ---- 7 CINDERWATCH, second round ----
    case 'quenchtrough': {                                // steel goes in hot and comes out done
      ctx.fillStyle='#3a3a42'; ctx.fillRect(x-13,y-8,26,12);
      ctx.fillStyle='#1f2a30'; ctx.fillRect(x-11,y-6,22,8);
      ctx.globalAlpha=0.35; ctx.fillStyle='#cfc8bd';
      ctx.beginPath(); ctx.ellipse(x-2,y-12+Math.sin(t*1.3)*1.5,7,3.5,0,0,6.29); ctx.fill();
      ctx.globalAlpha=1; break; }
    case 'coalpile': {                                    // fuel, and a lot of it
      ctx.fillStyle='#241f22';
      ctx.beginPath(); ctx.moveTo(x-14,y+3); ctx.lineTo(x-4,y-12); ctx.lineTo(x+5,y-9);
      ctx.lineTo(x+13,y+3); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#37303a';
      for(let i=0;i<5;i++) ctx.fillRect(x-10+i*4.6, y-2-((i*3)%6), 3.4, 3);
      break; }
    case 'moldrack': {                                    // the shapes the ingots are cast in
      ctx.fillStyle='#4a3524'; ctx.fillRect(x-13,y-12,26,3); ctx.fillRect(x-13,y-12,3,16);
      ctx.fillRect(x+10,y-12,3,16);
      ctx.fillStyle='#5a5a62';
      for(let i=0;i<3;i++) ctx.fillRect(x-9+i*7,y-9,5,10);
      ctx.fillStyle='#3a3a42';
      for(let i=0;i<3;i++) ctx.fillRect(x-8+i*7,y-8,3,7);
      break; }
    // ---- 8 THE ASHFALL, second round ----
    case 'burnttent': {                                   // the camp this camp is standing on
      ctx.fillStyle='#2f2a28';
      ctx.beginPath(); ctx.moveTo(x-16,y+4); ctx.lineTo(x-3,y-14); ctx.lineTo(x+6,y-3);
      ctx.lineTo(x+15,y+4); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#3f3634';
      ctx.beginPath(); ctx.moveTo(x-16,y+4); ctx.lineTo(x-3,y-14); ctx.lineTo(x-6,y+4);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle='#4a3524'; ctx.save(); ctx.translate(x+8,y-2); ctx.rotate(0.7);
      ctx.fillRect(-1.4,-12,2.8,14); ctx.restore();
      break; }
    case 'firepike': {                                    // a pike driven in and left burning
      ctx.fillStyle='#3a3230'; ctx.fillRect(x-2,y-28,4,32);
      ctx.fillStyle='#5a4a44'; ctx.fillRect(x-5,y-30,10,4);
      const f=0.7+0.3*Math.sin(t*6.6+x*0.09);
      ctx.globalCompositeOperation='lighter';
      ctx.fillStyle='rgba(255,120,50,0.55)';
      ctx.beginPath(); ctx.ellipse(x,y-34,4.5*f,9*f,0,0,6.29); ctx.fill();
      ctx.fillStyle='rgba(255,200,120,0.6)';
      ctx.beginPath(); ctx.ellipse(x,y-33,2.2*f,4.5*f,0,0,6.29); ctx.fill();
      ctx.globalCompositeOperation='source-over';
      break; }
    case 'ashdrift': {                                    // it never stops falling here
      ctx.fillStyle='#4a4444'; ctx.globalAlpha=0.85;
      ctx.beginPath(); ctx.ellipse(x,y,15,6,0,0,6.29); ctx.fill();
      ctx.fillStyle='#5a5454';
      ctx.beginPath(); ctx.ellipse(x-3,y-3,9,4,0,0,6.29); ctx.fill();
      ctx.globalAlpha=1;
      ctx.fillStyle='#6a6462';
      for(let i=0;i<4;i++) ctx.fillRect(x-8+i*5, y-6-((i*3)%4), 2.2, 2.2);
      break; }
    // ---- 9 THE RIFT, second round ----
    case 'surveypost': {                                  // somebody is measuring the hole
      ctx.fillStyle='#4a4258'; ctx.fillRect(x-1.6,y-26,3.2,30);
      ctx.fillStyle='#d8d0bc'; ctx.fillRect(x-8,y-26,16,7);
      ctx.fillStyle='#3a3448';
      for(let i=0;i<3;i++) ctx.fillRect(x-6,y-24+i*2,10,1);
      ctx.fillStyle='#8a6ad4'; ctx.fillRect(x-8,y-28,16,2);
      break; }
    case 'cagedshard': {                                  // whatever they pulled out, restrained
      ctx.fillStyle='#3a3448';
      ctx.fillRect(x-11,y-2,22,4); ctx.fillRect(x-11,y-22,22,3);
      for(let i=0;i<4;i++) ctx.fillRect(x-10+i*6.6,y-22,2.4,22);
      ctx.fillStyle='rgba(170,140,255,0.92)';
      ctx.beginPath(); ctx.moveTo(x,y-20); ctx.lineTo(x+6,y-11); ctx.lineTo(x,y-3);
      ctx.lineTo(x-6,y-11); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation='lighter';
      ctx.fillStyle='rgba(150,120,240,'+(0.18+0.12*Math.sin(t*2.6)).toFixed(3)+')';
      ctx.beginPath(); ctx.arc(x,y-11,15,0,6.29); ctx.fill();
      ctx.globalCompositeOperation='source-over';
      break; }
    case 'chalkslate': {                                  // the dig's notes, propped on a crate
      ctx.fillStyle='#5a4630'; ctx.fillRect(x-11,y-8,22,12);
      ctx.fillStyle='#2f2a34'; ctx.save(); ctx.translate(x,y-12); ctx.rotate(-0.12);
      ctx.fillRect(-10,-12,20,15);
      ctx.fillStyle='#cfc8bd';
      for(let i=0;i<4;i++) ctx.fillRect(-7,-9+i*3.2, 6+((i*5)%8), 1.2);
      ctx.restore();
      break; }
    // ---- 0 LANDING SANDS ----
    case 'driftpile': {                                   // salvaged timber, stacked to dry
      ctx.fillStyle='#6b5438';
      for(let i=0;i<4;i++) ctx.fillRect(x-13+i*2, y-2-i*4, 26-i*4, 4);
      ctx.fillStyle='#4a3a28'; for(let i=0;i<4;i++) ctx.fillRect(x-13+i*2, y-2-i*4, 26-i*4, 1);
      break; }
    case 'fishrack': {                                    // the catch, split and hung
      ctx.fillStyle='#4a3524'; ctx.fillRect(x-13,y-15,3,19); ctx.fillRect(x+10,y-15,3,19);
      ctx.fillStyle='#5c3f28'; ctx.fillRect(x-13,y-15,26,3);
      ctx.fillStyle='#9aa6a8';
      for(let i=0;i<4;i++){ const fx=x-9+i*6;
        ctx.beginPath(); ctx.moveTo(fx,y-12); ctx.lineTo(fx+3,y-4); ctx.lineTo(fx,y+2);
        ctx.lineTo(fx-3,y-4); ctx.closePath(); ctx.fill(); }
      break; }
    case 'shellheap': {                                   // a midden -- what the camp has eaten
      for(let i=0;i<9;i++){ const a=i*0.7, r=3+((i*7)%8);
        ctx.fillStyle=(i%3)?'#d8cfc0':'#bfae9a';
        ctx.beginPath(); ctx.ellipse(x+Math.cos(a)*r, y+Math.sin(a)*r*0.5, 3.5, 2.4, a, 0, 6.29); ctx.fill(); }
      break; }
    // ---- 1 GULLWIND SHORE ----
    case 'sailpost': {                                    // a torn sail lashed to a spar for shelter
      ctx.fillStyle='#4a3524'; ctx.fillRect(x-2,y-26,4,30);
      ctx.fillStyle='#cfc6b4'; ctx.globalAlpha=0.9;
      ctx.beginPath(); ctx.moveTo(x+2,y-24); ctx.lineTo(x+18,y-16); ctx.lineTo(x+15,y-2);
      ctx.lineTo(x+2,y-6); ctx.closePath(); ctx.fill();
      ctx.globalAlpha=1; ctx.fillStyle='#a89e8c';
      ctx.beginPath(); ctx.moveTo(x+15,y-2); ctx.lineTo(x+18,y-16); ctx.lineTo(x+16,y-9); ctx.closePath(); ctx.fill();
      break; }
    case 'saltpan': {                                     // seawater left to dry
      ctx.fillStyle='#5a4630'; ctx.fillRect(x-13,y-8,26,13);
      ctx.fillStyle='#e8e4d8'; ctx.fillRect(x-11,y-6,22,9);
      ctx.fillStyle='#cfc6b4'; ctx.fillRect(x-11,y-6,22,2);
      break; }
    case 'gullcage': {                                    // birds, kept alive until needed
      ctx.fillStyle='#4a3524'; ctx.fillRect(x-9,y-14,18,18);
      ctx.fillStyle='#1a1410'; ctx.fillRect(x-7,y-12,14,14);
      ctx.strokeStyle='#6b5438'; ctx.lineWidth=1.2;
      for(let i=0;i<4;i++){ ctx.beginPath(); ctx.moveTo(x-7+i*4.6,y-12); ctx.lineTo(x-7+i*4.6,y+2); ctx.stroke(); }
      ctx.fillStyle='#e8e4d8'; ctx.beginPath(); ctx.ellipse(x-1,y-4,3.5,2.6,0,0,6.29); ctx.fill();
      break; }
    // ---- 2 SAWGRASS FENS ----
    case 'eelpot': {                                      // woven traps, stacked wet
      ctx.fillStyle='#7a6a44';
      for(let i=0;i<3;i++){ ctx.beginPath();
        ctx.ellipse(x-7+i*7, y-3-(i%2)*6, 6, 4, 0.3, 0, 6.29); ctx.fill(); }
      ctx.strokeStyle='#5c5030'; ctx.lineWidth=1;
      for(let i=0;i<3;i++){ ctx.beginPath();
        ctx.ellipse(x-7+i*7, y-3-(i%2)*6, 6, 4, 0.3, 0, 6.29); ctx.stroke(); }
      break; }
    case 'mudpot': {                                      // the fen breathing
      ctx.fillStyle='#3f3a26'; ctx.beginPath(); ctx.ellipse(x,y,12,7,0,0,6.29); ctx.fill();
      ctx.fillStyle='#575030'; ctx.beginPath(); ctx.ellipse(x,y-1,8,4.5,0,0,6.29); ctx.fill();
      const b=(t*0.8)%1;
      ctx.fillStyle='rgba(120,120,80,0.55)';
      ctx.beginPath(); ctx.arc(x-3+b*6, y-2-b*5, 1.6+b*1.4, 0, 6.29); ctx.fill();
      break; }
    case 'reedbundle': {                                  // cut reed, tied and standing
      ctx.fillStyle='#8a8a52';
      for(let i=0;i<7;i++) ctx.fillRect(x-8+i*2.4, y-18+((i*5)%4), 2, 22);
      ctx.fillStyle='#6b5438'; ctx.fillRect(x-9,y-8,19,2.5);
      break; }
    // ---- 3 VERDANT BELT ----
    case 'weaponstand': {                                 // spears and axes, upright and ready
      ctx.fillStyle='#4a3524'; ctx.fillRect(x-12,y-4,24,4); ctx.fillRect(x-12,y-16,24,3);
      const SH=['#8a8a92','#9a9aa2','#7a7a82'];
      for(let i=0;i<4;i++){ const wx=x-8+i*5.4;
        ctx.fillStyle='#5c3f28'; ctx.fillRect(wx-1,y-26,2,24);       // the haft
        ctx.fillStyle=SH[i%3];
        if(i%2){ ctx.beginPath(); ctx.moveTo(wx,y-33); ctx.lineTo(wx+3,y-26); ctx.lineTo(wx-3,y-26);
                 ctx.closePath(); ctx.fill(); }                       // spear
        else   { ctx.fillRect(wx-4,y-30,8,5); }                       // axe head
      }
      break; }
    case 'boarspit': {                                    // a boar over the fire -- the camp is eating
      ctx.fillStyle='#4a3524';                                        // the two forks
      ctx.fillRect(x-14,y-20,3,24); ctx.fillRect(x+11,y-20,3,24);
      ctx.fillStyle='#6b5438'; ctx.fillRect(x-16,y-19,32,2.5);        // the spit
      ctx.fillStyle='#5a3a2a';                                        // the carcass
      ctx.beginPath(); ctx.ellipse(x,y-13,12,6.5,0,0,6.29); ctx.fill();
      ctx.fillStyle='#6d4632';
      ctx.beginPath(); ctx.ellipse(x-2,y-14,9,4.5,0,0,6.29); ctx.fill();
      ctx.fillStyle='#4a2f22';                                        // snout and legs
      ctx.beginPath(); ctx.ellipse(x+11,y-13,4,3,0,0,6.29); ctx.fill();
      ctx.fillRect(x-6,y-8,2.4,5); ctx.fillRect(x+3,y-8,2.4,5);
      ctx.fillStyle='#e8e0cf';                                        // a tusk
      ctx.beginPath(); ctx.moveTo(x+13,y-14); ctx.lineTo(x+16,y-16); ctx.lineTo(x+13,y-12);
      ctx.closePath(); ctx.fill();
      const f=0.6+0.4*Math.sin(t*7.2+x*0.05);                         // embers under it
      ctx.globalCompositeOperation='lighter';
      ctx.fillStyle='rgba(255,140,50,'+(0.30*f).toFixed(3)+')';
      ctx.beginPath(); ctx.ellipse(x,y-2,10,4,0,0,6.29); ctx.fill();
      ctx.globalCompositeOperation='source-over';
      break; }
    case 'woodpile': {                                    // split logs against the fire going out
      ctx.fillStyle='#5c3f28';
      for(let r=0;r<3;r++) for(let i=0;i<4-r;i++)
        ctx.fillRect(x-11+r*3+i*6, y-2-r*5, 5.5, 5);
      ctx.fillStyle='#8a6a44';
      for(let r=0;r<3;r++) for(let i=0;i<4-r;i++)
        ctx.beginPath(), ctx.arc(x-11+r*3+i*6+2.7, y+0.5-r*5, 2, 0, 6.29), ctx.fill();
      break; }
    // ---- 4 WOLFWOOD ----
    case 'peltframe': {                                   // a hide stretched to cure
      ctx.fillStyle='#4a3524'; ctx.fillRect(x-13,y-22,3,26); ctx.fillRect(x+10,y-22,3,26);
      ctx.fillStyle='#5c3f28'; ctx.fillRect(x-13,y-22,26,3);
      ctx.fillStyle='#7a6250';
      ctx.beginPath(); ctx.moveTo(x-8,y-19); ctx.lineTo(x+8,y-19); ctx.lineTo(x+6,y-2);
      ctx.lineTo(x,y+2); ctx.lineTo(x-6,y-2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle='#3a2a1c'; ctx.lineWidth=1; ctx.stroke();
      break; }
    case 'huntstand': {                                   // a watch platform over the trees
      ctx.fillStyle='#4a3524';
      ctx.fillRect(x-11,y-24,3,28); ctx.fillRect(x+8,y-24,3,28);
      ctx.fillRect(x-9,y-14,20,2.5);
      ctx.fillStyle='#5c3f28'; ctx.fillRect(x-14,y-27,28,4);
      ctx.fillStyle='#6b5438'; ctx.fillRect(x-14,y-33,3,7); ctx.fillRect(x+11,y-33,3,7);
      break; }
    // ---- 5 DEEP TIMBER ----
    case 'skullpike': {                                   // a warning, or an offering
      ctx.fillStyle='#4a3524'; ctx.fillRect(x-2,y-28,4,32);
      ctx.fillStyle='#c9c2ae';
      ctx.beginPath(); ctx.ellipse(x,y-32,7,6,0,0,6.29); ctx.fill();
      ctx.fillRect(x-4,y-28,8,4);
      ctx.fillStyle='#2a2620';
      ctx.beginPath(); ctx.arc(x-2.6,y-33,1.7,0,6.29); ctx.fill();
      ctx.beginPath(); ctx.arc(x+2.6,y-33,1.7,0,6.29); ctx.fill();
      break; }
    case 'cauldron': {                                    // something is being rendered down
      ctx.fillStyle='#3a3a42'; ctx.fillRect(x-13,y-6,3,10); ctx.fillRect(x+10,y-6,3,10);
      ctx.fillStyle='#2f2f36';
      ctx.beginPath(); ctx.ellipse(x,y-8,11,8,0,0,6.29); ctx.fill();
      ctx.fillStyle='#4a5a3a';
      ctx.beginPath(); ctx.ellipse(x,y-12,8.5,3.4,0,0,6.29); ctx.fill();
      ctx.fillStyle='rgba(150,190,120,0.45)';
      ctx.beginPath(); ctx.arc(x-2+Math.sin(t*1.6)*3, y-16-((t*0.6)%1)*6, 2.2, 0, 6.29); ctx.fill();
      break; }
    case 'fungus': {                                      // the wood growing over the camp
      for(let i=0;i<3;i++){ const fx=x-7+i*7, fy=y-2-(i%2)*4;
        ctx.fillStyle='#5c4a6a'; ctx.fillRect(fx-1.4,fy-6,3,8);
        ctx.fillStyle=(i%2)?'#8a6ad4':'#7a5ac0';
        ctx.beginPath(); ctx.ellipse(fx,fy-7,6,3.6,0,0,6.29); ctx.fill(); }
      break; }
    // ---- 6 STONEBROW RISE ----
    case 'orebox': {                                      // boxes of raw ore, what the quarry is for
      ctx.fillStyle='#5a4630'; ctx.fillRect(x-12,y-10,24,14);
      ctx.fillStyle='#3a2a1c'; ctx.fillRect(x-12,y-10,24,2.5); ctx.fillRect(x-1,y-10,2,14);
      const ORE=['#b8863a','#8a8a92','#5aa0c0'];
      for(let i=0;i<6;i++){ const ox=x-9+ (i%3)*7, oy=y-13-((i/3)|0)*4;
        ctx.fillStyle=ORE[i%3];
        ctx.beginPath(); ctx.moveTo(ox,oy-3); ctx.lineTo(ox+3.4,oy); ctx.lineTo(ox,oy+3);
        ctx.lineTo(ox-3.4,oy); ctx.closePath(); ctx.fill(); }
      break; }
    case 'pickrack': {                                    // tools, downed for the night
      ctx.fillStyle='#4a3524'; ctx.fillRect(x-12,y-16,24,3);
      ctx.fillStyle='#4a3524'; ctx.fillRect(x-12,y-16,3,20); ctx.fillRect(x+9,y-16,3,20);
      for(let i=0;i<3;i++){ const px=x-6+i*6;
        ctx.fillStyle='#5c3f28'; ctx.fillRect(px-1,y-14,2,16);
        ctx.fillStyle='#8a8a92'; ctx.save(); ctx.translate(px,y-15); ctx.rotate(0.35);
        ctx.fillRect(-6,-1.6,12,3.2); ctx.restore(); }
      break; }
    case 'rubble': {                                      // spoil, tipped where it fell
      ctx.fillStyle='#7a7a7a';
      for(let i=0;i<7;i++){ const a=i*0.9, r=3+((i*11)%9);
        ctx.beginPath(); ctx.moveTo(x+Math.cos(a)*r, y+Math.sin(a)*r*0.5-2);
        ctx.lineTo(x+Math.cos(a)*r+4, y+Math.sin(a)*r*0.5+2);
        ctx.lineTo(x+Math.cos(a)*r-3, y+Math.sin(a)*r*0.5+3); ctx.closePath(); ctx.fill(); }
      break; }
    // ---- 7 CINDERWATCH ----
    case 'ingotstack': {                                  // the forge's output, cooling
      for(let r=0;r<3;r++) for(let i=0;i<3-r;i++){
        ctx.fillStyle=(r===0)?'#8a8a92':'#9a9aa2';
        ctx.fillRect(x-10+r*3.5+i*7, y-2-r*4.5, 6.5, 4);
        ctx.fillStyle='#6a6a72'; ctx.fillRect(x-10+r*3.5+i*7, y-2-r*4.5, 6.5, 1); }
      break; }
    case 'bellows': {                                     // what keeps the fire hot enough
      ctx.fillStyle='#5a4630';
      ctx.beginPath(); ctx.moveTo(x-13,y-4); ctx.lineTo(x+4,y-12); ctx.lineTo(x+4,y+2);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle='#3a2a1c'; ctx.fillRect(x+3,y-7,12,3);
      ctx.fillStyle='#6b5438'; ctx.fillRect(x-15,y-9,4,10);
      break; }
    // ---- 8 THE ASHFALL ----
    case 'ashurn': {                                      // they are keeping their dead
      ctx.fillStyle='#3f3a3a';
      ctx.beginPath(); ctx.ellipse(x,y-9,9,11,0,0,6.29); ctx.fill();
      ctx.fillStyle='#4f4a4a';
      ctx.beginPath(); ctx.ellipse(x,y-18,6,3,0,0,6.29); ctx.fill();
      ctx.fillStyle='#8a4a4a'; ctx.fillRect(x-9,y-11,18,2.5);
      break; }
    case 'emberpit': {                                    // a fire that has been burning far too long
      ctx.fillStyle='#2a2020';
      ctx.beginPath(); ctx.ellipse(x,y,15,8,0,0,6.29); ctx.fill();
      ctx.globalCompositeOperation='lighter';
      for(let i=0;i<5;i++){ const a=i*1.257+t*0.4, r=4+((i*7)%7);
        ctx.fillStyle='rgba(255,120,40,'+(0.22+0.14*Math.sin(t*3+i)).toFixed(3)+')';
        ctx.beginPath(); ctx.arc(x+Math.cos(a)*r, y+Math.sin(a)*r*0.5, 3.2, 0, 6.29); ctx.fill(); }
      ctx.globalCompositeOperation='source-over';
      break; }
    case 'charskull': {                                   // whatever it was, the ash took it
      ctx.fillStyle='#3a3230';
      ctx.beginPath(); ctx.ellipse(x,y-5,9,7,0.2,0,6.29); ctx.fill();
      ctx.fillStyle='#241f1e';
      ctx.beginPath(); ctx.arc(x-3,y-6,2.2,0,6.29); ctx.fill();
      ctx.beginPath(); ctx.arc(x+2,y-7,2.2,0,6.29); ctx.fill();
      ctx.globalCompositeOperation='lighter';
      ctx.fillStyle='rgba(255,90,40,0.35)';
      ctx.beginPath(); ctx.arc(x-3,y-6,3,0,6.29); ctx.fill();
      ctx.globalCompositeOperation='source-over';
      break; }
    // ---- 9 THE RIFT ----
    case 'crystalbox': {                                  // boxes of shard, crated for carrying out
      ctx.fillStyle='#4a4258'; ctx.fillRect(x-12,y-9,24,13);
      ctx.fillStyle='#2f2a3c'; ctx.fillRect(x-12,y-9,24,2.5); ctx.fillRect(x-1,y-9,2,13);
      for(let i=0;i<5;i++){ const cx3=x-8+i*4.2, cy3=y-12-((i*5)%4);
        ctx.fillStyle='rgba(160,130,255,0.9)';
        ctx.beginPath(); ctx.moveTo(cx3,cy3-5); ctx.lineTo(cx3+2.6,cy3); ctx.lineTo(cx3,cy3+3);
        ctx.lineTo(cx3-2.6,cy3); ctx.closePath(); ctx.fill(); }
      ctx.globalCompositeOperation='lighter';
      ctx.fillStyle='rgba(150,120,240,'+(0.14+0.08*Math.sin(t*2.1)).toFixed(3)+')';
      ctx.beginPath(); ctx.ellipse(x,y-12,14,7,0,0,6.29); ctx.fill();
      ctx.globalCompositeOperation='source-over';
      break; }
    case 'riftpylon': {                                   // whatever is holding the dig open
      ctx.fillStyle='#3a3448'; ctx.fillRect(x-5,y-4,10,8);
      ctx.fillStyle='#4a4258'; ctx.fillRect(x-3,y-26,6,24);
      ctx.fillStyle='rgba(160,130,255,0.9)';
      ctx.beginPath(); ctx.moveTo(x,y-36); ctx.lineTo(x+5,y-26); ctx.lineTo(x,y-22);
      ctx.lineTo(x-5,y-26); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation='lighter';
      ctx.fillStyle='rgba(150,120,240,'+(0.16+0.10*Math.sin(t*1.7)).toFixed(3)+')';
      ctx.beginPath(); ctx.arc(x,y-29,13,0,6.29); ctx.fill();
      ctx.globalCompositeOperation='source-over';
      break; }
    case 'floatstone': {                                  // the rift does not respect the ground
      const bob=Math.sin(t*1.1+x*0.03)*3;
      ctx.globalAlpha=0.22; ctx.fillStyle='#000';
      ctx.beginPath(); ctx.ellipse(x,y+2,8,3,0,0,6.29); ctx.fill(); ctx.globalAlpha=1;
      ctx.fillStyle='#5a5468';
      ctx.beginPath(); ctx.moveTo(x-8,y-14+bob); ctx.lineTo(x+2,y-19+bob); ctx.lineTo(x+9,y-12+bob);
      ctx.lineTo(x+1,y-7+bob); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#6a6478';
      ctx.beginPath(); ctx.moveTo(x-8,y-14+bob); ctx.lineTo(x+2,y-19+bob); ctx.lineTo(x+1,y-13+bob);
      ctx.closePath(); ctx.fill();
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
