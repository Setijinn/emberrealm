// ============================================================
//  THE HEARTH — social hub + sub-rooms (built procedurally so
//  we can size them freely for an open, many-player server).
//  Adds rooms to ROOM_DEFS before worldbuild reads it.
// ============================================================
(function(){
 function room(w,h,floor){ const g=[];
  for(let y=0;y<h;y++){ let r='';
   for(let x=0;x<w;x++) r+=(x===0||y===0||x===w-1||y===h-1)?'W':floor; g.push(r); }
  return g; }
 function put(g,x,y,ch){ if(y<0||y>=g.length||x<0||x>=g[0].length) return; g[y]=g[y].slice(0,x)+ch+g[y].slice(x+1); }
 function block(g,x0,y0,x1,y1,ch){ for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++) put(g,x,y,ch); }
 function border(g,x0,y0,x1,y1,ch){ for(let x=x0;x<=x1;x++){put(g,x,y0,ch);put(g,x,y1,ch);}
  for(let y=y0;y<=y1;y++){put(g,x0,y,ch);put(g,x1,y,ch);} }

 // ------------------------------------------------------------- THE HEARTH (hub)
 // Town-square layout: fountain plaza centre, market pairs flanking east/west,
 // walkway roads ('p' floor) linking every portal + stall, portals in stone alcoves.
 const HW=42, HH=26;
 const hub=room(HW,HH,'f');
 // central fountain — open water pool, fountain art dead centre, no stone rim
 // (water is solid in collision, so the pool needs no blocking border)
 block(hub,19,10,23,13,'w');
 // brazier-lined avenue up to THE REALM portal
 [[18,5],[24,5],[18,7],[24,7]].forEach(p=>put(hub,p[0],p[1],'H'));
 // walkway roads (only pave plain floor; stones/braziers stay)
 function walk(x0,y0,x1,y1){ for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)
  if(hub[y][x]==='f') put(hub,x,y,'p'); }
 walk(17,8,25,15);    // plaza apron: 2-wide paved ring wrapped around the pool
 walk(20,3,22,8);     // avenue: REALM portal -> plaza
 walk(20,15,22,21);   // plaza -> south garden
 walk(7,4,35,5);      // top road: COSMETICS - REALM - VAULT
 walk(7,19,35,20);    // bottom road: GUILD - garden - ARENA
 walk(11,11,17,12);   // west stall spur
 walk(25,11,31,12);   // east stall spur
 // plaza corner braziers + lamps by the stalls
 [[16,9],[26,9],[16,14],[26,14]].forEach(p=>put(hub,p[0],p[1],'H'));
 [[12,5],[12,18],[30,5],[30,18]].forEach(p=>put(hub,p[0],p[1],'l'));
 // south garden: planters framing the spawn
 [[18,18],[24,18],[17,21],[25,21],[20,22],[22,22]].forEach(p=>put(hub,p[0],p[1],'h'));
 // flowers ring each portal at a small remove (radius 2) — ONLY on plain floor,
 // never on a walkway, so every portal keeps its road approach clear
 function dressPortal(px,py){
  for(const [dx,dy] of [[-2,-2],[0,-2],[2,-2],[-2,0],[2,0],[-2,2],[0,2],[2,2]]){
   const nx=px+dx, ny=py+dy;
   if(nx>0&&ny>0&&nx<HW-1&&ny<HH-1&&hub[ny][nx]==='f') put(hub,nx,ny,'h'); } }
 dressPortal(21,2); dressPortal(6,5); dressPortal(35,5); dressPortal(6,20); dressPortal(35,20);
 // GRASS (user, 2026-07-27). Four lawns, deliberately placed where nobody has to walk: the two
 // shoulders of the south garden and the two quiet corners behind the stalls. Roads and the plaza
 // apron stay stone, so grass never interrupts the way anyone actually crosses the square -- it
 // fills the dead space that was cobble for no reason, and it gives the flock somewhere to be.
 // Eroded at the edges by a position hash: a perfect rectangle of lawn reads as a rug someone put
 // down, and the whole point is that grass grew here. The interior is solid; only the border cells
 // are thinned, and corners are thinned hardest, which rounds the shape.
 function lawn(x0,y0,x1,y1){
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   if(!hub[y]||hub[y][x]!=='f') continue;
   const ex=(x===x0||x===x1), ey=(y===y0||y===y1);
   let keep=100;
   if(ex&&ey) keep=25; else if(ex||ey) keep=62;
   if(keep<100){ let m=(Math.imul(x,374761393)+Math.imul(y,668265263))>>>0;
    m=(m^(m>>>15))>>>0; if((m%100)>=keep) continue; }
   put(hub,x,y,'g'); } }
 lawn(14,16,19,21);   // south garden, west shoulder
 lawn(23,16,28,21);   // south garden, east shoulder
 lawn(8,8,14,15);     // behind the west stalls
 lawn(28,8,34,15);    // behind the east stalls
 // a few tufts of grass creeping out of the lawns onto neighbouring cobble
 for(const [gx,gy] of [[13,15],[20,15],[29,7],[15,7],[9,16],[33,16],[19,22],[24,22]])
  if(hub[gy]&&hub[gy][gx]==='f') put(hub,gx,gy,'g');
 put(hub,21,17,'P');                     // spawn south of the fountain, facing the realm
 // The flock (03b_critters.js). Not enemies, not pets, no stats — they are here so the town reads
 // as somewhere people live. Counts are deliberately modest: a dozen hens would be a farmyard, six
 // is a village square.
 // THE MIRROR IN THE SQUARE. The Sanctuary took the COSMETICS portal, which would have left the
 // wardrobe -- and therefore every diamond ever spent -- behind a door with no handle. Rather than
 // delete a feature the user only asked to move past, the mirror itself comes to the Hearth: same
 // `wardrobe` interactable the COSMETICS room used, same prompt, two tiles off the top road so it
 // sits in the corner of the square people already associate with appearance.
 ROOM_DEFS['0,0']={ name:'The Hearth', town:true, hub:true, map:hub,
  wardrobe:{x:9.5, y:7.4},
  critters:{chicken:6, sheep:4},
  portalDefs:[
   {tx:21, ty:2,  to:'G',         label:'THE REALM',  col:'#ff9c50', big:true},
   // The Sanctuary took this slot from COSMETICS (user). It was previously reachable ONLY through
   // a button inside the pets panel, and only once you already owned a pet -- so the one room in
   // the game built to be looked at was the one room you could not walk to.
   {tx:6,  ty:5,  to:'PETS',      label:'SANCTUARY',  col:'#8ee0a0'},
   {tx:35, ty:5,  to:'VAULT',     label:'VAULT',      col:'#e8b34b'},
   {tx:6,  ty:20, to:'GUILD',     label:'GUILD HALL', col:'#7ab8d4'},
   {tx:35, ty:20, to:'ARENA',     label:'ARENA',      col:'#e2604c'},
  ],
  // Pool tiles are x19-23, y10-13, so its centre is (21.5, 12) -- and the sprite IS drawn centred
  // on this anchor. It still read as sitting low because the ART is not centred inside its own
  // frame: measured, the basin band occupies rows 54-112 of 125, so its middle is 21px (0.49 tile)
  // below the frame's middle while the thin spire fills the top. Anchoring half a tile high puts
  // the BASIN -- the part the eye reads as "the fountain" -- on the square's true centre.
  decor:[{t:'fountain',x:21.5,y:11.5},{t:'mirror',x:9.5,y:7.6}],
  stalls:[ {id:'bram', x:9.5,y:10.8}, {id:'sella',x:9.5,y:18.3}, {id:'maren',x:32.5,y:10.8}, {id:'odo',x:32.5,y:18.3} ],
 };

 // ------------------------------------------------------------- ARENA
 const AW=42, AH=30;
 const arena=room(AW,AH,'f');
 // four cover pillars
 [[12,10],[29,10],[12,19],[29,19]].forEach(p=>block(arena,p[0],p[1],p[0]+1,p[1]+1,'W'));
 put(arena,20,26,'P');
 ROOM_DEFS['ARENA']={ name:'The Proving Grounds', arena:true, lv:1, map:arena,
  portalDefs:[ {tx:20, ty:28, to:'0,0', label:'LEAVE', col:'#7dc47a'} ],
  decor:[{t:'sign',x:20,y:23,txt:'SURVIVE THE WAVES'}] };

 // ------------------------------------------------------------- VAULT
 // THE VAULT -- reworked (user: "rework the visuals for entire storage room").
 // It was a 28x18 box of market cobble with a wall block in it, which is what every other side
 // room looks like. A strongroom is the one place in the game that has to look like money was
 // spent on it, so the whole room is built as an approach: you come up the crimson runner, the
 // great door is dead ahead behind a wall of deposit boxes, and your own strongbox stands between
 // you and it. Everything else -- crates, coin, candlelight -- flanks that line and stays out of it.
 // The floor, walls, box doors and runner are drawn in 08_render.js under curRoom.key==='VAULT'.
 const vault=room(30,18,'f');
 // The rack art spans a 2x3-tile unit anchored to a GLOBAL grid (08_render.js, the 'h' branch),
 // so every rack block starts on an even column and a row divisible by three. Off-grid blocks
 // still draw, they just start mid-rack -- these are placed to land flush.
 block(vault,4,3,25,5,'h');              // the back wall of scroll racks, wall to wall
 block(vault,2,6,3,11,'h');              // ...and returns down both sides, so the room is
 block(vault,26,6,27,11,'h');            // enclosed BY racks rather than by empty stone
 // The runner is an AISLE, not a floor covering. The first pass carpeted a plus-sign across half
 // the room and the stone stopped being the room; this is four tiles wide with one apron where
 // the strongbox stands, so the carpet only ever says "walk here, that is the thing".
 block(vault,13,7,16,16,'p');
 block(vault,11,7,18,9,'p');
 // Candlelight down both sides, and only four of them. Glows are ADDITIVE (09_sprites) -- eight
 // sources washed the granite out to khaki before anything else was even wrong with it.
 // 'l' rather than a decor entry so 02_worldbuild's glow pass lights the room for free.
 [[9,8],[21,8],[9,13],[21,13]].forEach(q=>put(vault,q[0],q[1],'l'));
 put(vault,15,13,'P');
 ROOM_DEFS['VAULT']={ name:'The Vault', town:false, safe:true, map:vault,
  portalDefs:[ {tx:15, ty:16, to:'0,0', label:'LEAVE', col:'#7dc47a'} ],
  // The strongbox is the real interactable (17j_vault.js). It stands on open carpet in FRONT of
  // the bank, never on it -- decor drawn inside a solid block is painted over and invisible,
  // which is how the two chests were lost on the first pass. It sits CLOSE to the great door on
  // purpose: the camera follows the player, so a strongbox further down the aisle would push the
  // door off the top of the screen exactly when you are standing at the thing you came for.
  strongbox:{tx:15, ty:8},
  // ORDER IS DRAW ORDER. The great door goes first so everything else stands in front of it --
  // it is the backdrop the room is arranged around, not a prop in it.
  // WHERE THE GREAT DOOR SITS, and why it is not on the back wall.
  // The camera centres on the player and shows about seven tiles above them, and the STORE banner
  // is drawn at a FIXED SCREEN position near the top rather than in the world. A door mounted on
  // the actual back wall therefore has no good height: from the aisle it is off the top of the
  // screen, and from the strongbox -- the one moment it should land -- the banner covers it.
  // So the door stands almost level with the strongbox, flush under the bank of boxes above it.
  // Its foot is hidden by the strongbox itself (decor is drawn in list order, door first), which
  // reads exactly right: a small iron coffer standing in front of a great vault door.
  decor:[{t:'v_door',x:15,y:8.4,w:100},
         {t:'strongbox',x:15,y:8.5},
         {t:'sign',x:15,y:11.5,txt:'THE VAULT'},
         {t:'v_boxes', x:5.6,y:5.9},{t:'v_boxes', x:24.4,y:5.9},
         {t:'v_crates',x:4.2,y:8.2},{t:'v_crates',x:25.8,y:8.2},
         {t:'v_sacks', x:4.6,y:11.0},{t:'v_sacks',x:25.4,y:11.0},
         {t:'v_coins', x:5.4,y:13.6},{t:'v_coins',x:24.6,y:13.6},
         {t:'chest',x:11.4,y:11.4},{t:'chest',x:18.6,y:11.4}] };

 // ------------------------------------------------------------- GUILD HALL
 const guild=room(32,20,'f');
 block(guild,13,6,18,7,'h');             // long table
 [[8,5],[23,5]].forEach(p=>put(guild,p[0],p[1],'H'));
 put(guild,16,16,'P');
 ROOM_DEFS['GUILD']={ name:'Guild Hall', town:false, safe:true, map:guild,
  portalDefs:[ {tx:16, ty:18, to:'0,0', label:'LEAVE', col:'#7dc47a'} ],
  decor:[{t:'sign',x:16,y:12,txt:'GUILDS — coming soon'},{t:'banner',x:16,y:3}] };

 // ------------------------------------------------------------- COSMETICS
 const cos=room(28,18,'f');
 [[10,6],[14,6],[18,6]].forEach(p=>put(cos,p[0],p[1],'l')); // display pedestals
 put(cos,14,14,'P');
 // The mirror between the three pedestals is the interactable: stand at it and the wardrobe opens
 // (07_update turns `wardrobe` into a prompt, exactly like a stall or a portal).
 ROOM_DEFS['COSMETICS']={ name:'The Wardrobe', town:false, safe:true, map:cos,
  portalDefs:[ {tx:14, ty:16, to:'0,0', label:'LEAVE', col:'#7dc47a'} ],
  wardrobe:{x:14.5, y:7.2},
  decor:[{t:'sign',x:14,y:11,txt:'DRESS AS YOU LIKE'}] };
})();
