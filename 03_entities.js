// ---------- entities ----------
const player={x:0,y:0,r:14,hp:100,maxhp:100,spd:180,dmg:12,fireRate:0.22,fireT:0,kills:0,inv:0};
let curRoom=null, enemies=[], pShots=[], eShots=[], particles=[], embers=[];
let rpg=null, texts=[], respawnT=1, shopNear=false, loots=[];
let allies=[], zones=[], fx=[], res=0, lastShotT=99, abT=0, portalLock=false, curRegionN='';
let portalPrompt=null;   // {kind,x,y,label,...} nearest interactable portal/pillar (USE-gated)
let bossBar=null;        // boss whose big top-screen hp bar is showing (set on first hit)
let arenaActive=false, arenaWave=0, arenaCd=0;
// ---- world bosses + dungeons ----
// 9 zone bosses (bands 0-8), rethemed for the vertical climb. Sprites: assets/mobs/boss_<band>.png.
// CANON (user): these creatures are INVADERS from a dying world — corruption devoured 70% of it,
// so they tore a portal open to flee into the human lands. EACH boss played a role in opening that
// rift, and each is corrupted (worse the nearer the portal). Humans don't know any of this until
// they reach the portal at the end. `lore` = its backstory; `bark` = the two lines it speaks as the
// fight escalates (phase 2 / phase 3); `mech` = its signature in-fight puzzle (see 17_bossmech.js).
const GBOSS=[
 {n:'The Grovewarden',dn:'The Heartwood Hollow',col:'#4f9a3f',pat:'nova',pat2:'spiral',mech:'bloom',
  title:'root-lord who anchored the rift',
  desc:'A patient colossus that erupts in rings of thorns. Weave the gaps and wear it down.',
  lore:'In the dying world it was the root-lord; its living lattice became the anchor the rift grew from. The corruption blooms through it still, seeding this land with the same rot that drowned its own.',
  open:'Careful, little warden. You are standing in my roots — and my roots are the only reason the door has not closed behind us.',
  mid:['I did not want the task. I was simply the largest living thing left, and they needed something that could HOLD.',
       'Nine of us were asked. Not one of us said no. Remember that, when you meet the others.',
       'Your soil is clean. I can feel it through my roots, and I cannot stop what I am doing to it.',
       'We told ourselves it was a door. A door lets you leave. This one only ever let something IN.'],
  bark:['You guard soil already dead — I have seen exactly where this ends. I have seen it from the inside.',
        'I anchored the door. Let it root here too, as it rooted in us, and you will understand why we ran.'],
  death:'Thank you... the dream lets go. I remember green — real green, before the rot took it all. Do not let this place go the way mine did.',
  home:'the Everbloom Canopy, before the blight'},
 {n:'The Mistantler',dn:'The Fogbound Glade',col:'#6aae7a',pat:'spread5',pat2:'charge',mech:'clones',
  title:'scout that parted the veil',
  desc:'Swift and wary, it strafes then lowers its antlers to charge. Punish between its rushes.',
  lore:'It scouted the void between worlds and parted the veil for the exodus. The corruption came through wearing its face — now it is countless mirages, and cannot tell which reflection is itself.',
  open:'Do not look for me. Look for the one of me that casts a shadow — I have not been able to find her in years.',
  mid:['I walked the dark between the worlds and came back with a map. That map is the reason any of us are here.',
       'They cheered me. Do you understand? I was carried through the Vale on their shoulders for finding the way.',
       'The thing on the other side copied me while I walked. It has been wearing my face ever since.',
       'I mapped an escape. I never once thought to ask what was doing the CHASING.'],
  bark:['Which of us is real, little warden? Even I have forgotten, and I am the one who has to choose each morning.',
        'I mapped the fog between worlds. You cannot hide from what I have already walked through twice.'],
  death:'You found the real me. I can stop... running now. Tell them we were only afraid — and that being afraid was not enough of an excuse.',
  home:'the Silvermist Vale, where its herd once ran free'},
 {n:'The Bog Horror',dn:'The Sunken Warren',col:'#5a7a3a',pat:'aimed3',pat2:'spiral',mech:'pools',
  title:'brewer of the corroding reagent',
  desc:'It rises from the muck and flails vine and spore. Bait its lunge, then flank.',
  lore:'It brewed the reagent that ate through the wall between worlds. Where it wades the ground rots to bog, seeding your land with the very blight that dissolved the sky of its own.',
  open:'Stand where you like. Everything I touch becomes fen eventually — that is not a threat, it is simply what I am now.',
  mid:['They brought me the problem: a wall between worlds that nothing could cut. I solved it. I was PROUD.',
       'It took eleven years to brew and one afternoon to pour. The wall went like sugar in rain.',
       'The same reagent got into our water table. That is what actually killed the Fens — not the rot. Me.',
       'You keep asking what opened the door. Nobody opened it. We DISSOLVED it, and something walked in through the hole.'],
  bark:['I brewed the rot that ate our sky. Taste a little of it — this is the mild dose, the one that only takes the skin.',
        'The wall between worlds melted in my hands. So will you, and it will be just as quick, and I will be just as sorry.'],
  death:'We never meant to carry it here. We only wanted to live. That is every excuse I have and I know it is not enough. Forgive—',
  home:'the Lotus Fens, when the water still ran clear'},
 {n:'Stonefist',dn:'The Shattered Vault',col:'#8a8f88',pat:'nova',pat2:'charge',mech:'bloom',
  title:'gate-stone that holds the rift open',
  desc:'Heavy shockwave rings and a crushing charge. Strike hard in the recovery after it lunges.',
  lore:'Forged as the gate-stone that holds the rift open, it cracked under the weight of two worlds. Each blow splits the earth into glowing fissures — the door itself tearing wider.',
  open:'You should not have come this far in. Every step you take toward me, the fissures under your feet go a little wider.',
  mid:['I was cut from the Bastion wall. A gate-stone. One job: hold the shape of the opening and never move.',
       'Two worlds pull on me at once. Do you know what that FEELS like? It has felt like this for nine years.',
       'They said hold it open until everyone is through. Nobody ever came back to say everyone was through.',
       'Break me and the rift closes. Break me and everyone still on the other side stays there. Choose, human.'],
  bark:['I am the stone that holds the door. I do not tire, I only crack, and I have been cracking a long time.',
        'Crack me and the gate cracks with me — is that the price you want? Say it out loud before you swing again.'],
  death:'The door... I held it shut. Or open. I have held it so long I have forgotten which one was ever the mercy.',
  home:'the Highstone Bastion it was carved to guard'},
 {n:'The Crag Gargoyle',dn:'The Windward Roost',col:'#9aa0a8',pat:'spread5',pat2:'aimed3',mech:'pools',
  title:'herald that flew the first scouts through',
  desc:'It dives in erratic passes, raking with claws. Keep moving and answer between the swoops.',
  lore:'The herald that carried the first scouts through the tear. Infected in flight, it falls in tar-black dives, marking this sky for the swarm that follows the trail it left.',
  open:'I have already flown your coast end to end. There is no line you can hold that I have not looked down on.',
  mid:['I carried the first scouts through in my claws. Six of them. Not one of the six is still themselves.',
       'I marked the route so the rest could follow. Every mark is still up there, burning, and they ARE following.',
       'I caught it in the crossing. You cannot see the rot at altitude — you only notice when you stop climbing.',
       'A whole people is behind me and they are not soldiers. They are farmers and children with nowhere to be.'],
  bark:['We flew ahead. Thousands more follow the way I marked, and I cannot unmark it now even if I wanted to.',
        'Your sky is next — I have already watched a sky burn once, and yours has exactly the same colour to it.'],
  death:'There are so many more of us behind me. Frightened. Not evil — only fleeing, the way you would. Spare them if you can...',
  home:'the Windspire Aeries, above a living sea'},
 {n:'Magmaw',dn:'The Scorch Barrows',col:'#c85a2a',pat:'ring8',pat2:'charge',mech:'pools',
  title:'furnace that burned the rift open',
  desc:'Rings of cinder-fire and a molten charge. Orbit the safe lane; do not stand still.',
  lore:'It was the furnace — a world’s worth of fire spent to burn the way open. What survived boils with molten corruption that bursts from the ground it crosses.',
  open:'Do not stand still on my ground. Everything I am is still burning and it has to go somewhere.',
  mid:['You cannot cut a hole between worlds. You have to BURN one, and it takes more fire than a world has.',
       'So we spent ours. All of it. The Emberdeep was the warmest place that ever existed and we spent it in a night.',
       'I was the furnace. They fed my fires with everything that would burn. In the end that included the fires.',
       'Ask yourself what a people has to already have lost, to agree to that. Then ask if you would have refused.'],
  bark:['It cost a world of fire to tear the way open. I am what is left of the fire — and this is what LEFT OVER looks like.',
        'Burn — so your ashes may feed the next door. There is always a next door. That is the part nobody says aloud.'],
  death:'It burned everything. We had nowhere left to stand. So we made a door and we came here. I am sorry. I have been sorry the whole time.',
  home:'the Emberdeep, warm and whole, before the fire turned'},
 {n:'The Ash Wraith',dn:'The Cinder Crypt',col:'#8a857e',pat:'spiral',pat2:'aimed3',mech:'clones',
  title:'the dead burned to fuel the ritual',
  desc:'A blinding spiral of ash with sudden aimed scythes. Find the one gap and stay in it.',
  lore:'All that is left of the people burned to fuel the ritual that opened the door — a drifting grief of ash, copied endlessly, unsure which cinder among them ever lived.',
  open:'Do not swing at the middle of me. There is no middle. There are four hundred of us in here and none of us are the one you want.',
  mid:['The furnace was not enough. Fire alone would not hold the tear. It needed lives, and it needed them WILLING.',
       'Ashenhold volunteered. The whole village. They walked in singing so the children would not be frightened.',
       'I am what came out the other side. Not one of them — all of them, stirred together, and none of us can find our own name.',
       'Everyone else here did something. Anchored, mapped, burned, held. We were only the FUEL. Nobody ever asks about the fuel.'],
  bark:['We paid in our own dead to open it. Do not mourn me — I am only the smoke off something that mattered more.',
        'So many of us in here... which ash was ever truly me? I had a name this morning. I am almost sure of it.'],
  death:'I remember my name now. Just for a moment, right at the end, I remember it — and then... quiet. Thank you. Thank you.',
  home:'the village of Ashenhold, before the night it burned'},
 {n:'The Cinder Demon',dn:'The Ashen Keep',col:'#d4522a',pat:'ring8',pat2:'spiral',mech:'bloom',
  title:'first claimed — it taught them the way',
  desc:'Spinning fire-rings tighten around you. Match its rotation and thread the orbit.',
  lore:'The first of them wholly claimed by the corruption — the demon that taught the others how to open the way. It floods the ground with the rift’s own fire, sparing only the warded few.',
  open:'You are the first of yours to get this far. I remember being the first of mine. It goes badly, in my experience.',
  mid:['It did not force me. That is the part I need you to understand. It ASKED, and it was very patient, and I said yes.',
       'It told me exactly how. The anchor, the map, the reagent, the gate-stone, the fire, the willing dead. Six pieces.',
       'Then I carried the instructions to the others and I made them sound like hope. They believed me. I was good at it.',
       'It never wanted to save us. It wanted us to open a door from the INSIDE, because it cannot open one itself.'],
  bark:['It whispered how to open the door. I had only to say yes — and it made saying yes feel like courage.',
        'Your kind will make the same bargain when it is your world going. They always do. I have stopped judging it.'],
  death:'It lied to us. The bargain was never escape — it only ever wanted a second world to eat, and we carried it here ourselves.',
  home:'the Obsidian Sanctum, before the whisper found it'},
 {n:'The Molten Titan',dn:'The Core Sanctum',col:'#ff7a3d',pat:'spiral',pat2:'summon',mech:'clones',
  title:'the king who ordered the rift torn open',
  desc:'Everything at once: spiral fire, summoned horrors, relentless pressure. The final trial.',
  lore:'Their crowned king, who ordered the portal torn open to flee a world already seven-tenths devoured, and gave his molten core to power it. Wholly corrupted now, he shatters into false idols — the dead world’s last lie.',
  open:'So you are the one who has been walking east through my people, listening to them apologise. Did any of them tell you it was MY order?',
  mid:['Seven tenths. That is how much of my world was gone when they brought me the demon\'s six pieces.',
       'I signed it. The anchor, the map, the reagent, the gate, the fire, the dead. Every one of them did it because I asked.',
       'They have all been telling you they are sorry. They were following orders. The order was mine and I would give it again.',
       'You are not fighting an invasion. You are fighting the last of an evacuation — and the thing that followed it home.'],
  bark:['I gave my crown to open the way, to save what remained of us. I would give yours for the same reason. That is what a king IS.',
        'I am the last lie of a dying world. Kneel — or join it. Those have been the only two options since the night I signed.'],
  death:'We fled a dying world and carried its death here on our backs. The rift still bleeds it. Close it, human — before your world becomes the next dream we drown in.',
  home:'the Molten Crown, at the heart of a world now gone'},
 // ---- Starter island (Lv1-20) ----
 // Same canon as the nine: refugees from a world the corruption ate, who came through the rift.
 // But these three are NOBODIES. They crossed early, drifted west as far as land goes, and are
 // barely touched. They had no hand in opening the door and never knew one was planned — they
 // only know they ran. So they can grieve openly without spoiling anything: everything they say
 // is TRUE and none of it is THE truth. It is an ordinary refugee's account of the same
 // catastrophe the nine will later confess to having CAUSED, which is what makes the confession
 // land. `lore` is the human record — what the isles observed and wrote down; the barks are the
 // creature answering that record mid-fight, in its own words.
 {n:'The Tidewrack',dn:'The Saltworks',col:'#4a90a8',pat:'aimed3',pat2:'nova',mech:'pools',
  gate:'none',dsub:'the salt-house has new tenants',denN:'The Brine Mother',
  title:'thing the tide left behind',
  desc:'It drags itself from the shallows and floods the ground with brine. Keep to dry sand.',
  lore:'The salt-crews found it tangled in their nets after a tide that came in from no sea the fishers know — running the wrong way, warm, and carrying weed no one could name. They cut it free. It has kept the pans flooded ever since, as though something were still expected to arrive by water.',
  bark:['When the way opened, our sea came through it with us. I have been following the water home ever since.',
        'You are standing where my shore should be. It was HERE. I followed the tide exactly.'],
  death:'...the water never ran back. Nothing we carried through ever did.',
  home:'the tide-shrines of a drowned coast, before the rot reached the water'},
 {n:'The Gullwind Harrier',dn:'Gullwind Light',col:'#8fae6a',pat:'spread5',pat2:'charge',mech:'clones',
  gate:'none',dsub:'the lamp is out and the stair is full of wings',denN:'The Roost Tyrant',
  title:'bird that will not turn',
  desc:'It splits into a wheeling flock and stoops from odd angles. Watch which shadow has weight.',
  lore:'The lighthouse keeper logged it for nine years: every dusk it climbs, turns east, and beats itself bloody against the wind until dark. It has never once flown west. The keeper stopped writing after the light went out; the flock roosts in his stair now, and every one of them faces the same way.',
  bark:['I went through first. Scouts always go first. My flock was to follow at dusk — they have not followed yet.',
        'Nine years I have flown east to meet them. Stand ASIDE. They are still coming.'],
  death:'...it is not a flock. I made them, so the sky would not be empty. The real ones never crossed.',
  home:'the cliff-roosts its flock never left'},
 {n:'The Sawgrass Reaper',dn:'Marrow Chapel',col:'#7ea44a',pat:'ring8',pat2:'spiral',mech:'bloom',
  gate:'none',dsub:'someone is still alive in the cloister',denN:'The Cloister Reaper',
  title:'reaper in borrowed armour',
  desc:'It cuts in wide rings through the reeds. Break the rhythm and step inside its swing.',
  lore:'It wears plate — dented, ill-fitting, and stamped with a maker’s mark no smith in the isles has ever used. Whoever it took the armour from, it took the walk as well: the reeds are cut in neat rows, the way a farmer would. It has never once cut outside its own rows.',
  bark:['I worked fields once. The rot came up the furrows a row at a time, and we ran ahead of it until there was nowhere left to run to.',
        'He gave me the armour. He showed me the rows. Then his hands went grey and I finished the field alone.'],
  death:'...I kept his rows. It was all I could keep. It will reach here too — it always reaches.',
  home:'the reed-fields it worked until the rot took them'},
];
// per-ring projectile themes (colour/core/shape/size) — suited to each biome & creature
// Projectile theme per BOSS — indexed by boss id, exactly parallel to GBOSS above.
// (It used to be a 15-entry leftover from the dead 14-zone world whose slots no longer lined up
//  with the bosses reading them — the Grovewarden was firing the Tideworn's brine globs.)
const BOSS_PROJ=[
 {col:'#4f9a3f',core:'#cdf2b6',shape:'orb',size:7},    // 0  Grovewarden — thorn seeds
 {col:'#356b40',core:'#bcdcae',shape:'orb',size:8},    // 1  Mistantler — drifting spores
 {col:'#3f6b58',core:'#c6e6d6',shape:'dart',size:6},   // 2  Bog Horror — barbed vine
 {col:'#8a8f9a',core:'#e2e7ee',shape:'orb',size:9},    // 3  Stonefist — boulders
 {col:'#9a8f80',core:'#e6ded0',shape:'orb',size:7},    // 4  Crag Gargoyle — rockslide
 {col:'#d4622a',core:'#ffd3a0',shape:'orb',size:9},    // 5  Magmaw — magma bombs
 {col:'#c05a3a',core:'#ffc7a0',shape:'diamond',size:7},// 6  Ash Wraith — ash scythes
 {col:'#c86a3a',core:'#ffdca6',shape:'orb',size:7},    // 7  Cinder Demon — cinders
 {col:'#e0552a',core:'#ffd39a',shape:'orb',size:8},    // 8  Molten Titan — fire coils
 {col:'#4a90a8',core:'#cfeaf3',shape:'orb',size:9},    // 9  Tidewrack — brine globs
 {col:'#8fae6a',core:'#eef4cf',shape:'dart',size:6},   // 10 Gullwind Harrier — feather-darts
 {col:'#7ea44a',core:'#e0f2a8',shape:'dart',size:6},   // 11 Sawgrass Reaper — reed spines
];
let groundPortals=[], worldBoss=null, wbCd=18, dunReturn=null, ringBossCd=[];
function ringBossAlive(b){ for(const e of enemies) if(e.wb && e.ring===b) return true; return false; }
// ===== BOSS PLACEMENT =====
// Boss identity used to BE the theme band, which pinned the deepest-lore bosses to the starter
// island (the Grovewarden — the root-lord that anchored the rift — was a Lv4 fight). Identity is
// now CLUMP-indexed while terrain stays BAND-indexed: `grvBandAt` remains the sole authority for
// tilesets/tone/trees/boulders/map colour, and ZBOSS says who rules each of the 13 territories.
// _territories() lays clumps down in a fixed order: 0-2 starter, 3-7 inner main, 8-12 grind rim.
//   -1 = no boss. Clump 10 is The Molten Heart — the rift's own province, held for the final boss.
const ZBOSS=[9,10,11, 0,1,2,3,4, 6,5,-1,7,8];
const BOSS_ZONE=[]; for(let i=0;i<ZBOSS.length;i++) if(ZBOSS[i]>=0) BOSS_ZONE[ZBOSS[i]]=i;
// boss id at a tile (ocean/bridge/unclaimed -> -1). THE spawner key; never assume it equals a band.
function zoneBossAt(tx,ty){ const z=(typeof zoneAt==='function')?zoneAt(tx,ty):-1;
 return (z>=0&&ZBOSS[z]!==undefined)?ZBOSS[z]:-1; }
// the territory a boss rules — carries {name, band, lvmin, lvmax, sx,sy,n} straight off _territories
function bossClump(bid){ const R=rooms['G'], RG=R&&R.rings; if(!RG||!RG.radial) return null;
 const T=_territories(R), z=BOSS_ZONE[bid]; return (T&&z!=null&&T[z])?T[z]:null; }
// a boss's THEME band — for art fallbacks and dungeon mob naming/tint (NOT for its identity)
function bossBand(bid){ const t=bossClump(bid); return t?t.band:Math.max(0,Math.min(8,bid)); }
// ART SLOT per boss. Sprite/animation/den/dungeon-tile art follows the BOSS; ground tilesets,
// lair walls and decals follow the BAND. Bosses 0-8 were authored as art 0-8, so identity is the
// default; an entry here lets a boss without its own art borrow an existing slot. Loader loops
// walk the DISTINCT values, so a borrowed slot costs zero extra image requests.
// (named BOSS_SLOT, not BOSS_ART — 09_sprites already owns BOSS_ART, the procedural sprite table)
// Add an entry here to make a boss BORROW another's art slot until its own sprites land
// (9/10/11 did, until v218). Empty = every boss wears its own slot.
const BOSS_SLOT={};
function bossArt(i){ return (BOSS_SLOT[i]!==undefined)?BOSS_SLOT[i]:i; }
const BOSS_SLOT_N=12;                            // grows with the roster
function bossArtSlots(){ const s=[]; for(let i=0;i<BOSS_SLOT_N;i++){ const a=bossArt(i); if(s.indexOf(a)<0) s.push(a); } return s; }
// Borrowing is PER ASSET KIND, because a boss gets its sprite long before it gets a whole
// tileset and its scatter decor. Leave a boss in one of these and it still wears its own face.
const TILE_SLOT={};                    // dungeon tilesets — 9/10/11 have their own since v218
const DEC_SLOT={9:0,10:1,11:2};        // lair scatter decor — shared, same idea as DECAL_SRC
// A boss ARENA is that boss's den, so its walls and floor must carry the BOSS's theme — not the
// theme of whatever terrain it happens to stand in. Keying lair tiles to the terrain band (which
// is right for open ground) meant the Grovewarden fought in a stone room, the brine Tidewrack in
// a forest, and four different grind bosses all shared one molten tileset.
// Only slots 0-8 have a lairset_N sheet, so the starter three borrow the closest fit.
const LAIR_TILE={9:2, 10:4, 11:0};     // brine->sunken warren, harrier->windward crag, reaper->green
function lairTileSet(b){ return (LAIR_TILE[b]!==undefined)?LAIR_TILE[b]:bossArt(b); }
function bossTileArt(i){ return (TILE_SLOT[i]!==undefined)?TILE_SLOT[i]:bossArt(i); }
function bossDecArt(i){ return (DEC_SLOT[i]!==undefined)?DEC_SLOT[i]:bossArt(i); }
function bossTileSlots(){ const s=[]; for(let i=0;i<BOSS_SLOT_N;i++){ const a=bossTileArt(i); if(s.indexOf(a)<0) s.push(a); } return s; }
// ---- Boss surface lairs: tile-built enterable compounds stamped into the grove ----
// 'X' = lair wall (solid, themed tileset), '.' = interior floor -> 'F'. Bottom gap = doorway.
// (LAIR_TEMPLATES lived here: 147 lines of ASCII arena blueprints. They stopped being READ when
//  the organic carve landed — only their width/height was measured — and LAIR_SIZE now states
//  those dimensions outright, so the blueprints were deleted rather than left to mislead.)
const LAIR_BOSSES=[0,1,2,3,4,5,6,7,8,9,10,11];       // every boss gets a lair
// Arena footprint in tiles, SCALED BY THE BOSS'S LEVEL (user: "the higher level the boss fight
// the bigger the arena should be, unless certain boss fight mechanics demand otherwise").
// The old fixed ~20x15 was smaller than one screen — the whole arena fit in view with room to
// spare, which is why every fight felt cramped. A Lv4 shore brute now gets a yard (~30x23) and a
// Lv50 gets a hall (~48x36, wider than the viewport and about twice its height).
// `szMul` on a LAIR_ARCH entry is the "unless mechanics demand otherwise" escape hatch:
//   pools  — hazard puddles ACCUMULATE; a tight floor becomes unplayable, so give them room
//   clones — decoys need somewhere to spread, or the puzzle is solved by standing still
//   tower  — a lighthouse drum is compact BY NATURE; scaling it up stops reading as a tower
function lairSizeFor(b,lv){
 const t=Math.max(0,Math.min(1,((lv||4)-4)/46));
 const m=(LAIR_ARCH[b]&&LAIR_ARCH[b].szMul)||1;
 // The FLOOR is deliberately generous: even the Lv4 fight gets ~34x26 (still wider and taller
 // than the old maximum), because a low-level boss arena shouldn't feel like a broom cupboard.
 const w=Math.round((34+t*18)*m), h=Math.round((26+t*13)*m);
 // A round arena inscribes a circle, whose diameter is limited by the SHORTER side — so a wide
 // box gave the caldera a much smaller floor than its level deserved. Square it up.
 return (LAIR_ARCH[b]&&LAIR_ARCH[b].round)?[w,w]:[w,h]; }
let _lairsStamped=false;
// Lair NUDGE angles (radians). The anchor is the clump's own centroid; this only pushes the lair
// off-centre so it doesn't sit under the zone label drawn at that same centroid on the map screen.
const LAIR_NUDGE={0:1.8,1:-1.8,2:0.3, 3:0.9,4:-0.8,5:0.65,6:-0.5,7:0.45,8:-0.3, 9:1.8,10:-1.8,11:0.3};
// Starter lairs need an explicit RADIUS, not a centroid. The three starter clumps are wedges
// radiating from the spawn, so each spans the whole Lv1-20 range and their centroids all sit at
// much the same distance — three bosses at Lv8/11/9 in no order. This walks them out along their
// own wedge instead, as a fraction of starter.r, giving ~Lv4 / Lv10 / Lv17 to match the zones'
// stated ranges (Landing Sands 1-8, Gullwind Shore 8-14, Sawgrass Flats 14-20).
const LAIR_RAD={9:0.34,10:0.62,11:0.88};
// ---- ARENA ARCHITECTURE, one per boss ----
// (user: "make all the borders of all the boss areas not as consistent and make them represent
// something, like a structure"). Every lair used to carve the SAME wobbling ellipse with the same
// south doorway, so twelve very different creatures all lived in one generic cave. Each boss now
// gets a footprint that means something, and its wall openings sit where that structure would
// actually have them — a caldera blows out downhill, a keep has one gatehouse, a colonnade has no
// wall at all. `k` picks the floor shape; `doors` are [angle, arcWidth] gaps punched in the wall
// ring (0 = east, +y = south); `round` forces a true circle; `den`/`spawn` move the centrepiece
// and the boss's stand in normalized arena coords.
// Door widths are HALF-ARCS of bearing, not tile counts: on a ring of radius r, a w-radian
// half-arc opens roughly 2*w*r tiles. ~0.25 is a 3-tile doorway on these footprints. They read
// much wider on a FLAT wall (every cell along it shares a similar bearing), so masonry gets
// tighter numbers than the organic shapes — 0.55 on the chapel's west wall removed the wall.
const LAIR_ARCH={
 0:{k:'grove',  doors:[[1.57,0.30],[-1.9,0.26],[2.9,0.24]], szMul:1.10},   // root-ring, gaps between buttresses
 1:{k:'glade',  doors:[[1.57,0.55],[-0.6,0.45],[3.0,0.40]], szMul:1.08},   // open clearing; clones need spread
 2:{k:'warren', doors:[[1.57,0.22]], szMul:1.08},                          // bog hollow, one gullet; pools pile up
 3:{k:'vault',  doors:[[1.57,0.20]], den:[0,-0.5]},                        // broken stone hall, square corners
 4:{k:'roost',  doors:[[1.57,0.80]], szMul:1.08},                          // clifftop crescent; pools pile up
 5:{k:'caldera',doors:[[1.4,0.30],[-1.75,0.22]],round:true, szMul:1.10},   // crater rim, two blowouts; pools
 6:{k:'crypt',  doors:[[1.57,0.18],[-1.57,0.15]], szMul:1.08},             // cross-plan catacomb; clones
 7:{k:'keep',   doors:[[1.57,0.16]], den:[0,-0.55], szMul:1.05},           // fortress, corner bastions, one gate
 8:{k:'colonnade',doors:[],round:true,n:14, szMul:1.15},                   // the final gate — the grandest floor
 9:{k:'pans',   doors:[[1.57,0.20],[0,0.14]], den:[0,-0.55], szMul:1.08},  // salt-house pans; pools
 10:{k:'tower', doors:[[1.57,0.22]],round:true,den:[0,-0.5], szMul:0.92},  // a drum stops reading as one if scaled up
 11:{k:'nave',  doors:[[3.14,0.16]], den:[0.5,0], spawn:[-0.1,0.1], szMul:1.12}, // chapel: west door, east apse
};
// Where a boss's lair wants to be, in TILES. Shared by stampLairs and grvLairXY so the stamped
// footprint and the spawn fallback can never drift apart.
function lairAnchor(RG,T,z,b){
 const t=(T&&z>=0)?T[z]:null; if(!t||!t.n) return null;
 const cx=t.sx/t.n, cy=t.sy/t.n;
 if(LAIR_RAD[b]!==undefined && RG.starter){                     // radial walk-out along its wedge
   const S=RG.starter, a=Math.atan2(cy-S.cy,cx-S.cx), f=LAIR_RAD[b];
   return {x:S.cx+Math.cos(a)*S.r*f, y:S.cy+Math.sin(a)*S.r*f}; }
 const ang=(LAIR_NUDGE[b]!==undefined?LAIR_NUDGE[b]:b*0.9), nud=0.35*Math.sqrt(t.n/Math.PI);
 return {x:cx+Math.cos(ang)*nud, y:cy+Math.sin(ang)*nud}; }
function stampLairs(){ const R=rooms['G']; if(!R||!R.grid||_lairsStamped) return; _lairsStamped=true; R.lairs={};
 const RG=R.rings, NZ=(RG&&RG.names.length)||9;
 const P=(RG&&RG.portal)||null;
 // Territories are built HERE, before any carving — deliberately. The clump raster must be sampled
 // from the natural grid so the 'X'/'F' tiles carved below inherit the zone they sit in. Do not
 // "fix" this to run after stamping.
 const TT=(RG&&RG.radial)?_territories(R):null, ZG=(RG&&RG._zg)||null;
 for(const b of LAIR_BOSSES){
  const z=(BOSS_ZONE[b]!==undefined)?BOSS_ZONE[b]:-1;
  // CLUMP-CENTROID anchor. This is the only anchor that guarantees the lair lands inside the
  // territory its boss rules — and it must, because spawnRingBoss rejects every candidate whose
  // clump doesn't match and then just gives up after 40 tries, SILENTLY.
  const an=(RG&&RG.radial)?lairAnchor(RG,TT,z,b):null;
  // Size scales with the boss's LEVEL (user) — read it at the anchor, before placement, since
  // nothing about the anchor depends on the footprint.
  const _lv=(an&&RG&&RG.radial)?grvLvAtR(RG,an.x,an.y):10;
  const SZ=lairSizeFor(b,_lv);
  let TW=SZ[0], TH=SZ[1];
  let tcx, tcy;
  if(an){ tcx=an.x; tcy=an.y; }
  else { tcx=R.w/2; tcy=Math.max(TH,Math.min(R.h-TH-1,Math.round(R.h*(1-(b+0.5)/NZ)))); }
  // The footprint is a BOUNDING BOX but the arena carved inside it is an inscribed shape, so its
  // box corners are never part of the arena. Testing them rejected placements that would have
  // been perfectly fine and forced big arenas to shrink — the Lv28 hall ended up smaller than the
  // Lv4 one. Both tests now only look at cells the arena will actually occupy.
  const _inside=(dx,dy)=>{ const nx=(dx-TW/2)/(TW/2), ny=(dy-TH/2)/(TH/2); return nx*nx+ny*ny<=1.04; };
  const inZone=(px,py)=>{ if(!ZG||z<0) return true;
    const pts=[[px+(TW>>1),py+(TH>>1)],                                          // centre must match
      [px+Math.round(TW*0.20),py+(TH>>1)],[px+Math.round(TW*0.80),py+(TH>>1)],
      [px+(TW>>1),py+Math.round(TH*0.20)],[px+(TW>>1),py+Math.round(TH*0.80)]];
    const zr0=ZG[pts[0][1]]; if(!zr0||zr0[pts[0][0]]!==z) return false;
    let hit=1; for(let i=1;i<pts.length;i++){ const zr=ZG[pts[i][1]]; if(zr&&zr[pts[i][0]]===z) hit++; }
    return hit>=4; };                                                            // centre + 3 of 4 arms
  const clear=(px,py)=>{ if(px<1||py<1||px+TW>=R.w-1||py+TH>=R.h-1) return false;
    if(!inZone(px,py)) return false;
    // A rim clump beside the sea can never fit a big arena if a SINGLE ocean tile disqualifies it,
    // which is what pinned Magmaw's Lv50 caldera below the Lv42 hall. The carve already skips
    // non-ground cells, so a few tiles of shore just bite an organic notch out of the edge — allow
    // a small fraction, but keep the middle strictly clear so the arena can never be cut in two.
    let bad=0, tot=0;
    for(let ty=py-1;ty<=py+TH;ty++)for(let tx=px-1;tx<=px+TW;tx++){
      if(!_inside(tx-px,ty-py)) continue;                                        // skip the dead corners
      const row=R.grid[ty]; const c=row&&row[tx], off=(c==null||'wWhHlXFb'.indexOf(c)>=0);
      tot++; if(off){ bad++;
        const nx=(tx-px-TW/2)/(TW/2), ny=(ty-py-TH/2)/(TH/2);
        if(nx*nx+ny*ny<=0.42) return false; } }                                  // core must be solid ground
    if(bad>tot*0.04) return false;
    if(P){ const cx2=px+TW/2, cy2=py+TH/2; if(Math.hypot(cx2-P.x,cy2-P.y)<TW) return false; }  // keep clear of the portal ruins
    for(const pl of (R.pillars||[])){ const plx=(pl.x!=null?pl.x/TILE:pl.tx),ply=(pl.y!=null?pl.y/TILE:pl.ty);
      if(plx>px-2&&plx<px+TW+2&&ply>py-2&&ply<py+TH+2) return false; }
    for(const pt of (R.portals||[])){ const ptx=pt.x/TILE,pty=pt.y/TILE; if(ptx>px-2&&ptx<px+TW+2&&pty>py-2&&pty<py+TH+2) return false; }
    return true; };
  // spiral outward from the anchor for a clear footprint (the Voronoi warp is severe, so the
  // reach needs to be generous — 28 rings at a 2-tile step ≈ 56 tiles)
  // rmax is capped hard on the full-size attempts. WHERE a lair sits decides its level and which
  // clump it belongs to, so a big footprint must SHRINK rather than wander — letting it roam 56
  // tiles to find room dragged the Sawgrass Reaper from Lv16 to Lv6 and made the Lv50 arenas
  // smaller than the Lv34 one. Only the final, smallest attempt is allowed to range widely.
  const spiral=(ax,ay,rmax)=>{ const sx=Math.round(ax-TW/2), sy=Math.round(ay-TH/2);
    for(let r=0;r<(rmax||28);r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
      if(Math.max(Math.abs(dx),Math.abs(dy))!==r) continue;                      // ring at radius r only
      const px=sx+dx*2, py=sy+dy*2; if(clear(px,py)) return {px,py}; }
    return null; };
  // nearest tile that genuinely belongs to this clump — thin coastal clumps can have a centroid
  // that isn't even inside their own territory
  const inClump=()=>{ if(!ZG||z<0) return null; let bx=-1,by=-1,bd=1e18;
    for(let ty=0;ty<R.h;ty++){ const zr=ZG[ty]; if(!zr) continue;
      for(let tx=0;tx<R.w;tx++){ if(zr[tx]!==z) continue;
        const d=(tx-tcx)*(tx-tcx)+(ty-tcy)*(ty-tcy); if(d<bd){bd=d;bx=tx;by=ty;} } }
    return bx>=0?[bx,by]:null; };
  // Big arenas can simply not fit a cramped coastal clump. Rather than clamp one into a
  // neighbour's territory (which silently kills its boss's spawn), shrink and try again —
  // so the level-scaled size is a TARGET, and the land gets the final say.
  let place=null;
  const STEPS=[[1,8],[0.92,8],[0.84,10],[0.76,10],[0.68,12],[0.58,28]];   // [shrink, spiral reach]
  for(const s of STEPS){
    TW=Math.max(15,Math.round(SZ[0]*s[0])); TH=Math.max(12,Math.round(SZ[1]*s[0]));
    place=spiral(tcx,tcy,s[1]);
    if(!place && s[1]>=28){ const st=inClump(); if(st) place=spiral(st[0],st[1],28); }
    if(place){ if(s[0]<1) console.info('stampLairs: boss '+b+' fitted at '+TW+'x'+TH); break; } }
  if(!place){ const cx0=Math.round(tcx-TW/2), cy0=Math.round(tcy-TH/2);
    console.warn('stampLairs: no clear footprint for boss '+b+' (zone '+z+') — clamping');
    place={px:Math.max(1,Math.min(R.w-TW-1,cx0)), py:Math.max(1,Math.min(R.h-TH-1,cy0))}; }
  const {px,py}=place;
  // ---- carve the arena as an actual STRUCTURE (see LAIR_ARCH) ----
  const A=LAIR_ARCH[b]||{k:'cavern',doors:[[1.57,0.8]]};
  const cx=px+TW/2, cy=py+TH/2;
  let rx=TW/2-0.6, ry=TH/2-0.6;
  if(A.round){ const r0=Math.min(rx,ry); rx=r0; ry=r0; }     // a drum is a drum, whatever the footprint
  const _lh=(tx,ty)=>{ let h=(Math.imul(tx+b*131+7,374761393)+Math.imul(ty+b*257+3,668265263))>>>0;
    h=Math.imul(h^(h>>>13),1274126177)>>>0; return ((h^(h>>>16))&255)/255; };
  const _sup=(nx,ny,p,w)=>Math.pow(Math.abs(nx),p)+Math.pow(Math.abs(ny),p) < Math.pow(w,p);
  const _disc=(nx,ny,ox,oy,r)=>((nx-ox)*(nx-ox)+(ny-oy)*(ny-oy)) < r*r;
  const floorAt=(tx,ty)=>{ const nx=(tx+0.5-cx)/rx, ny=(ty+0.5-cy)/ry;
    const a=Math.atan2(ny,nx), n=_lh(tx,ty)-0.5, d2=nx*nx+ny*ny;
    switch(A.k){
     // masonry: straight runs and real corners, roughened only a little so it still reads as built
     case 'vault':  return _sup(nx,ny,6,0.93+0.03*n) && !(nx>0.45&&ny<-0.45);          // one corner fallen in
     case 'keep':   return _sup(nx,ny,8,0.84+0.02*n) ||                                 // curtain wall...
                           _disc(nx,ny,-0.8,-0.8,0.30)||_disc(nx,ny,0.8,-0.8,0.30)||
                           _disc(nx,ny,-0.8,0.8,0.30)||_disc(nx,ny,0.8,0.8,0.30);       // ...+ 4 corner bastions
     case 'crypt':  return _sup(nx,ny*2.1,8,0.95)||_sup(nx*2.1,ny,8,0.95);              // cross plan, nave + transept
     case 'nave':   return (nx<0.45 && _sup(nx,ny*1.28,8,0.96)) || _disc(nx,ny,0.42,0,0.62); // hall + rounded apse
     case 'pans':   return _sup(nx,ny,6,0.94+0.02*n);                                   // plain rectangular works
     case 'tower':  return d2 < Math.pow(0.90+0.025*n,2);                               // drum
     case 'caldera':return d2 < Math.pow(0.93+0.05*Math.sin(a*7)+0.03*n,2);             // crater rim, scalloped
     case 'colonnade':return d2 < Math.pow(0.92+0.02*n,2);                              // open ring floor
     // natural: keep the lobed organic feel, but distinct per creature
     case 'roost':  return d2 < Math.pow(0.95+0.04*n,2) && !_disc(nx,ny,0.0,1.05,0.62); // crescent ledge, bitten open
     case 'glade':  return d2 < Math.pow(0.78+0.22*Math.sin(a*2+b)+0.14*Math.sin(a*3-b)+0.08*n,2);
     case 'grove':  return d2 < Math.pow(0.84+0.13*Math.sin(a*6+b)+0.07*n,2);           // ring of roots
     default:       return d2 < Math.pow(0.80+0.17*Math.sin(a*3+b)+0.10*Math.sin(a*5-b*2)+0.05*n,2); } };
  // an opening is where a wall cell's bearing falls inside one of this structure's doors
  const doorAt=(tx,ty)=>{ const a=Math.atan2((ty+0.5-cy)/ry,(tx+0.5-cx)/rx);
    for(const d of (A.doors||[])){ let da=Math.abs(a-d[0]); if(da>Math.PI) da=6.2832-da;
      if(da<d[1]) return true; }
    return false; };
  const inGrid=(tx,ty)=>tx>0&&ty>0&&tx<R.w-1&&ty<R.h-1;
  const ground=(tx,ty)=>{ const c=R.grid[ty]&&R.grid[ty][tx]; return c!=null&&'wWhHlXFDP'.indexOf(c)<0; };
  const bx0=px-3,bx1=px+TW+3,by0=py-3,by1=py+TH+3;
  // Remember which boss owns each carved tile, so the renderer can theme the room to its BOSS
  // instead of to the ground it stands on.
  if(!R.lairAt) R.lairAt={};
  const own=(tx,ty)=>{ R.lairAt[ty*R.w+tx]=b; };
  // pass 1: floor
  for(let ty=by0;ty<by1;ty++)for(let tx=bx0;tx<bx1;tx++) if(inGrid(tx,ty)&&floorAt(tx,ty)&&ground(tx,ty)){ R.grid[ty][tx]='F'; own(tx,ty); }
  // pass 2: the wall itself — every ground cell touching floor, minus the doorways
  for(let ty=by0;ty<by1;ty++)for(let tx=bx0;tx<bx1;tx++){ if(!inGrid(tx,ty)||R.grid[ty][tx]==='F'||!ground(tx,ty)) continue;
    let touch=false; for(let dy=-1;dy<=1&&!touch;dy++)for(let dx=-1;dx<=1;dx++){ if(R.grid[ty+dy]&&R.grid[ty+dy][tx+dx]==='F'){touch=true;break;} }
    if(!touch) continue;
    if(doorAt(tx,ty)) continue;
    // a colonnade has no curtain wall at all — just standing pillars at regular bearings
    if(A.k==='colonnade'){ const a=Math.atan2((ty+0.5-cy)/ry,(tx+0.5-cx)/rx);
      const f=((a+Math.PI)/6.2832)*(A.n||12); if((f-Math.floor(f))>0.42) continue; }
    R.grid[ty][tx]='X'; own(tx,ty); }
  // pass 3: interior structure — what's INSIDE says as much as the outline
  const put=(tx,ty)=>{ if(inGrid(tx,ty)&&R.grid[ty][tx]==='F') R.grid[ty][tx]='X'; };
  if(A.k==='pans'){                                    // evaporation pans: two dividing walls, gap each
    for(const fx of [-0.34,0.34]){ const wx=Math.round(cx+fx*rx);
      for(let ty=Math.round(cy-ry*0.8);ty<=Math.round(cy+ry*0.8);ty++) if(Math.abs(ty-cy)>ry*0.28) put(wx,ty); } }
  else if(A.k==='nave'||A.k==='crypt'){                // two rows of columns down the hall
    for(let i=-2;i<=2;i++){ const tx=Math.round(cx+i*rx*0.26);
      if(Math.abs(i)===0) continue; put(tx,Math.round(cy-ry*0.42)); put(tx,Math.round(cy+ry*0.42)); } }
  else if(A.k==='keep'){                               // a keep is mostly open ground inside its walls
    put(Math.round(cx),Math.round(cy-ry*0.62)); }
  else if(A.k!=='colonnade'){                          // everything else: scattered natural cover
    for(let i=0;i<5;i++){ const a=(i/5)*6.283+b, rr=0.42+0.28*_lh(px+i,py+i);
      const tx=Math.round(cx+Math.cos(a)*rx*rr), ty=Math.round(cy+Math.sin(a)*ry*rr);
      if(inGrid(tx,ty)&&R.grid[ty][tx]==='F'&&Math.hypot(tx-cx,ty-cy)>2.4&&!doorAt(tx,ty)){
        put(tx,ty); if(_lh(tx+1,ty)>0.5) put(tx+1,ty); } } }
  // decor scattered on the INTERIOR floor
  const _decos=[]; for(let i=0;i<7;i++){ const a=(i/7)*6.283+b*1.3, rr=0.40+0.22*_lh(px+i*3,py-i);
    const dx=cx+Math.cos(a)*rx*rr, dy=cy+Math.sin(a)*ry*rr, tx=Math.round(dx), ty=Math.round(dy);
    if(R.grid[ty]&&R.grid[ty][tx]==='F'&&Math.hypot(tx-cx,ty-cy)>1.6) _decos.push({x:dx*TILE,y:dy*TILE,i:i%4}); }
  // Snap the boss's stand and the centrepiece onto real floor. The shapes are no longer all
  // centre-filled — a crescent ledge or an apse can leave the old fixed offsets inside a wall,
  // and a boss anchored in rock never spawns (spawnRingBoss just fails quietly).
  const snap=(fx,fy)=>{ const ox=cx+fx*rx, oy=cy+fy*ry;
    for(let r=0;r<9;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
      if(Math.max(Math.abs(dx),Math.abs(dy))!==r) continue;
      const tx=Math.round(ox)+dx, ty=Math.round(oy)+dy;
      if(inGrid(tx,ty)&&R.grid[ty][tx]==='F') return {x:(tx+0.5)*TILE,y:(ty+0.5)*TILE}; }
    return {x:ox*TILE,y:oy*TILE}; };
  const sp0=A.spawn||[0,0.20], dn0=A.den||[0,-0.55];
  // ---- STAGING for the arena's presence (drawLairs): a lit gateway, braziers ringing the
  // floor, and a sigil under the boss. Anchors are computed HERE, once, against the carved
  // grid, so the renderer never has to search tiles per frame.
  const _door=(A.doors&&A.doors.length)?A.doors[0][0]:1.57;
  const gate={x:(cx+Math.cos(_door)*rx*0.99)*TILE, y:(cy+Math.sin(_door)*ry*0.99)*TILE, a:_door};
  // brazier count follows the arena's size, or a huge floor ends up lit by a handful of dots
  const _nb=Math.max(6,Math.min(16,Math.round((rx+ry)/5)));
  const braz=[]; for(let i=0;i<_nb;i++){ const a=(i/_nb)*6.283+0.39;
    let da=Math.abs(a-_door); if(da>Math.PI) da=6.2832-da; if(da<0.42) continue;   // never in the doorway
    const tx=Math.round(cx+Math.cos(a)*rx*0.72), ty=Math.round(cy+Math.sin(a)*ry*0.72);
    if(inGrid(tx,ty)&&R.grid[ty][tx]==='F') braz.push({x:(tx+0.5)*TILE, y:(ty+0.5)*TILE, p:i*0.7}); }
  R.lairs[b]={ b, px, py, tw:TW, th:TH, arch:A.k,
    spawn:snap(sp0[0],sp0[1]),                              // where the boss stands
    sprite:snap(dn0[0],dn0[1]),                             // den centrepiece
    cx:cx*TILE, cy:cy*TILE, rx:rx*TILE, ry:ry*TILE,         // arena bounds, for staging + tint
    gate, braz, col:(typeof GBOSS!=='undefined'&&GBOSS[b])?GBOSS[b].col:'#c8a06a',
    decos:_decos };
  // drop any arrival landing points that now fall inside this compound (avoid spawning trapped)
  if(R.arrivals) R.arrivals=R.arrivals.filter(a=>!(a[0]>=px-1&&a[0]<=px+TW&&a[1]>=py-1&&a[1]<=py+TH));
 }
}
// Boss spawn anchor = its lair interior (falls back to band centre if unstamped).
function grvLairXY(b){ const R=rooms['G']; if(!R) return null;
 if(R.lairs && R.lairs[b]) return R.lairs[b].spawn;
 const RG=R.rings; if(!RG) return null;
 if(RG.radial){ const an=lairAnchor(RG,_territories(R),BOSS_ZONE[b],b);   // same anchor as stampLairs
   return an?{x:an.x*TILE, y:an.y*TILE}:null; }
 const NZ=RG.names.length, tyc=Math.max(1,Math.min(R.h-2,Math.floor(R.h*(1-(b+0.5)/NZ))));
 return {x:(R.w/2)*TILE, y:(tyc+0.5)*TILE}; }
// lairs are stamped once the world exists — radially for the new isles, band-Y for old worlds
if(typeof rooms!=='undefined' && rooms['G']) stampLairs();
// each ring has its own unique mini-boss; only one of a given ring's boss lives at a time
function spawnRingBoss(b){
 if(!curRoom||!curRoom.rings) return;
 if(ringBossAlive(b)) return;
 const lair=(typeof grvLairXY==='function')?grvLairXY(b):null;
 for(let tries=0;tries<40;tries++){
  let bx,by;
  if(lair && tries<14){ const a=Math.random()*6.283, d=15+Math.random()*45; bx=lair.x+Math.cos(a)*d; by=lair.y+Math.sin(a)*d; } // guard its lair (stay inside)
  else { const a=Math.random()*6.283, d=300+Math.random()*220; bx=player.x+Math.cos(a)*d; by=player.y+Math.sin(a)*d; }
  if(bx<TILE*2||by<TILE*2||bx>(curRoom.w-2)*TILE||by>(curRoom.h-2)*TILE) continue;
  // a boss is a big body -- test that it actually FITS, not merely that the centre point is clear,
  // or it lands wedged in a tree clump where neither it nor the player can move
  if(typeof standable==='function' ? !standable(bx,by,30) : solid(bx,by)) continue;
  if(zoneBossAt(bx/TILE,by/TILE)!==b) continue;   // must stand in ITS OWN territory, not just its band
  const lv=grvLvAt(bx/TILE,by/TILE);   // boss level matches where its lair sits in the zone
  const GB=GBOSS[b], PJ=BOSS_PROJ[b]||{};
  // matched to zone: modest early, monstrous late — on the unified difficulty curve
  const chaserHp=40*eHpScale(lv);
  const edef=eDef(lv), edr=eDR(edef), edex=eDex(lv), espd=eSpdMul(lv), emp=eMp(lv);  // scaling stat block
  // Bosses were barely larger than a regular mob — 24px at Lv1 in a world of 44px tiles, which
  // is not a boss, it is a slightly big hound. Base and range both up so even the first one has
  // presence and the Molten Titan genuinely towers.
  const size=38+ (lv/LV_CAP)*34;       // imposing on the sands, enormous at the core
  const bhp=Math.round(chaserHp*6*(1-edr));   // TTK-neutral hp (def mitigation applied in dealDamage)
  const boss={type:'B',wb:true,ring:b,x:bx,y:by,r:size,hp:bhp,maxhp:bhp,
   spd:(34+(lv/LV_CAP)*26)*espd,fireT:1.4,ang:0,col:GB.col,bd:5+eDmgScale(lv)*0.56,lv:lv,boss:true,name:GB.n,
   def:edef,dr:edr,dex:edex,maxmp:emp,mp:emp,mech:GB.mech,
   pat:GB.pat,pat2:GB.pat2,chargeT:0,sumT:3,
   pcol:PJ.col,pcore:PJ.core,pshape:PJ.shape,psize:PJ.size||7};
  // Bind the boss to its den. The lair footprint is in TILES; store it in world units, padded a
  // little so the boss can use the doorway lip without escaping. Without this a boss drifts out
  // into open ground where its arena mechanics mean nothing.
  const _L=curRoom.lairs&&curRoom.lairs[b];
  if(_L){ const pad=TILE*0.5;
    boss.arena={x0:_L.px*TILE-pad, y0:_L.py*TILE-pad,
                x1:(_L.px+_L.tw)*TILE+pad, y1:(_L.py+_L.th)*TILE+pad};
    boss.woke=false; }
  enemies.push(boss);
  msg('\u2620 '+GB.n,GB.title);
  setTimeout(function(){ if(enemies.indexOf(boss)>=0) msg(GB.n,GB.desc); },1700);
  return;
 }
}
// ---- Awakened dungeons: the slain boss's CONSCIOUSNESS ----
// A long 4-chamber gauntlet — each middle chamber locks the next gate behind a themed
// objective (destroy nodes / gather essences / awaken seals / slay every phantom),
// ending in the AWAKENED boss's arena. Themed nouns keep each mind distinct.
// (DOBJ_NOUN lived here — defined, never referenced anywhere. Removed rather than grown to 12.)
// Every mind has ONE signature puzzle (alternating with combat chambers):
// regrow / chase / order / simon / hold / relay / candles / ambush / timing.
// 9-11 (the starter three) REUSE implemented puzzle keys — no new puzzle code.
const DPUZ=['regrow','chase','order','simon','hold','relay','candles','ambush','timing',
 'order','chase','hold'];
const DPUZ_LABEL=[
 'Sever the Root-Hearts before the grove reknits',
 'Catch the fleeing Wisp',
 'Open the Drain Valves — in order',
 'Repeat the Rune Plates',
 'Channel the Gale Circles',
 'Ember Relay — keep the flame moving',
 'Keep every Grave Candle lit',
 'Shatter the War Idols — survive the ambush',
 'Awaken the Titan Locks as they glow',
 'Work the Sluice Gates — seaward first',
 'Run down the Lamp-Thief',
 'Hold the Chapel Wards while they burn'];
const DOBJ_PLAN={};
for(let r=0;r<DPUZ.length;r++) DOBJ_PLAN[r]=[DPUZ[r],'waves'];
// Per-ring dungeon ARCHITECTURE: room shape, edge irregularity, radii, corridor
// wobble/width, spacing. This is what makes each mind read differently on the map.
const DSHAPE=[
 {room:'blob', irr:0.55,rmin:8, rmax:12,wob:2.5,cw:2.0,gap:9 },  // 0 root caves
 {room:'round',irr:0.10,rmin:6, rmax:9, wob:3.5,cw:1.6,gap:15},  // 1 misty glades, thin winding paths
 {room:'blob', irr:0.80,rmin:8, rmax:12,wob:3.0,cw:2.3,gap:10},  // 2 ragged bog warren
 {room:'vault',irr:0.0, rmin:7, rmax:10,wob:0.0,cw:2.0,gap:14},  // 3 shattered vault (elbow halls)
 {room:'round',irr:0.15,rmin:5, rmax:7, wob:4.2,cw:1.5,gap:17},  // 4 wind ledges + perches
 {room:'blob', irr:0.50,rmin:9, rmax:13,wob:2.0,cw:2.6,gap:9 },  // 5 magma caverns
 {room:'cells',irr:0.35,rmin:8, rmax:11,wob:1.5,cw:1.6,gap:9 },  // 6 catacomb cell-clusters
 {room:'vault',irr:0.0, rmin:9, rmax:12,wob:0.0,cw:2.4,gap:15},  // 7 fortress halls
 {room:'round',irr:0.08,rmin:10,rmax:13,wob:1.0,cw:2.2,gap:10},  // 8 grand sanctums
 // 9-11: HUMAN structures the fleeing creatures moved into — not corruption-dreams. Built rooms,
 // straight walls, short runs: a salt-house, a lighthouse stair, a hedge-chapel.
 {room:'cells',irr:0.20,rmin:6, rmax:9, wob:1.2,cw:1.8,gap:11},  // 9  flooded salt-house
 {room:'vault',irr:0.0, rmin:5, rmax:8, wob:0.0,cw:1.6,gap:13},  // 10 lighthouse + keeper's stair
 {room:'cells',irr:0.15,rmin:6, rmax:9, wob:1.0,cw:1.9,gap:10},  // 11 chapel cloister
];
// Living NPCs found inside a dungeon, by boss id. He speaks one line per interaction and then
// repeats the last — deliberately vague: he has the shape of the truth and none of the facts.
const DUN_NPC={
 11:{name:'Warden Ivor', col:'#e8d8a0',
   lines:['Don\'t— ...you\'re not one of them. Forgive me. I\'ve been holding this door eleven days.',
          'It isn\'t a sickness. It has a direction. Everything it touches leans the same way — east.',
          'The thing in the cloister was a man\'s size once. It still cuts the reeds in rows.',
          'I can hold the ward. I can\'t hold the ground under it. Go on ahead — and don\'t stop at the water.']}};
// Dungeon DEPTH drives length/size. Boss ids keep their old depth so every canon dungeon is
// byte-identical to before; the starter three are deliberately short (4-5 chambers).
const DDEPTH=[0,1,2,3,4,5,6,7,8, 0,0,1];
function genDungeon(ring){
 // the mind is a step beyond the zone's peak — "matching but a little more difficult".
 // Measured off the boss's OWN clump (which _territories already samples from the smooth radial
 // curve), so there's no parallel level table to keep in sync — and no names[8] to fall off.
 const _t=bossClump(ring), _n=rooms['G'].rings.names[ring]||{lv:1};
 let lv;
 if(LAIR_RAD[ring]!==undefined){
   // Starter dungeons step past THIS BOSS, not the island's peak. The three starter clumps are
   // wedges spanning all of Lv1-20, so their lvmax is 20 for every one of them — a Lv4 boss would
   // otherwise drop a Lv25 dungeon nobody at that level could enter.
   const L=grvLairXY(ring), RGs=rooms['G'].rings;
   lv=Math.max(3,Math.min(LV_CAP-26,Math.round(grvLvAtR(RGs,L.x/TILE,L.y/TILE))+4));
 } else lv=Math.min(LV_CAP+10,(_t?_t.lvmax:(_n.lv2!==undefined?_n.lv2:_n.lv))+5);
 // seeded PRNG — every ring gets its OWN layout, stable across visits.
 // MIRRORED 1:1 by scratchpad dun_gen2.py (structural validation) — keep in sync.
 let _s=(ring*7919+1013)>>>0;
 const rng=function(){ _s=(_s+0x6D2B79F5)>>>0;
  let t=Math.imul(_s^(_s>>>15),1|_s); t=(t+Math.imul(t^(t>>>7),61|t))^t;
  return ((t^(t>>>14))>>>0)/4294967296; };
 const seed=ring*7919+1013;
 const chash=(x,y)=>{ let h=(Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(seed,971))>>>0;
  h=Math.imul(h^(h>>>13),1274126177)>>>0; return ((h^(h>>>16))>>>0)/4294967296; };
 const st=DSHAPE[ring], dep=(DDEPTH[ring]!==undefined)?DDEPTH[ring]:ring;
 const W2=170+dep*26, H2=84, g=[];
 for(let y=0;y<H2;y++){ const row=[]; for(let x=0;x<W2;x++) row.push('W'); g.push(row); }
 // deeper minds are LONGER: ring 0 ~4-5 chambers, ring 8 ~8-9
 const NCH=4+Math.floor(dep*0.55)+Math.floor(rng()*2);
 const chs=[]; let cx=18, cy=36;
 const step=st.rmax+st.gap+st.rmax;
 for(let i=0;i<NCH;i++){
  let r=st.rmin+rng()*(st.rmax-st.rmin);
  const aspect=st.room==='round'?0.7+rng()*0.5:0.85+rng()*0.3;
  if(i===NCH-1) r*=1.25;                        // boss arena is grander
  chs.push({cx:cx,cy:cy,r:r,ry:r*aspect,out:'E'});
  if(i===NCH-1) break;
  const d=rng();
  const vstep=Math.min(step,24);                // vertical hops shorter — grid is wide, not tall
  let dir=(d<0.55||i===NCH-2)?'E':(d<0.775?'N':'S');
  if(dir==='E'&&cx+step>W2-20) dir=(cy>Math.floor(H2/2))?'N':'S';
  if(dir==='N'&&cy-vstep<16) dir='S';
  if(dir==='S'&&cy+vstep>H2-16) dir='N';
  if(dir==='E') cx+=step; else cy+=(dir==='S'?1:-1)*vstep;
  cx=Math.min(cx,W2-18); cy=Math.max(16,Math.min(H2-16,cy));
  chs[i].out=dir;
 }
 const carveCell=(x,y)=>{ if(x>=1&&x<W2-1&&y>=1&&y<H2-1) g[y][x]='.'; };
 // ---- carve rooms in the ring's architecture ----
 for(const c of chs){
  const r=c.r, ry=c.ry;
  if(st.room==='blob'||st.room==='round'||st.room==='cells'){
   let subs=[[0,0,1.0]];
   if(st.room==='cells'){ const k=3+Math.floor(rng()*2); subs=[];
    for(let q=0;q<4;q++){ const ox=(rng()*2-1)*r*0.75, oy=(rng()*2-1)*ry*0.75;
     if(q<k) subs.push([ox,oy,0.55]); } }
   for(const sub of subs){ const ox=sub[0], oy=sub[1], fr=sub[2];
    const rr=r*fr, rry=ry*fr;
    const x0=Math.floor(c.cx+ox-rr-3), x1=Math.floor(c.cx+ox+rr+3);
    const y0=Math.floor(c.cy+oy-rry-3), y1=Math.floor(c.cy+oy+rry+3);
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
     const dx=(x-(c.cx+ox))/rr, dy=(y-(c.cy+oy))/rry;
     const dd=Math.sqrt(dx*dx+dy*dy);
     const edge=1.0+(chash(x,y)-0.5)*st.irr*2;
     if(dd<=edge) carveCell(x,y); } }
  } else { // vault: main hall + 2 offset side rooms (asymmetric composite)
   const w=Math.floor(r*1.5), h=Math.floor(ry*1.1);
   for(let y=Math.floor(c.cy-h);y<=Math.floor(c.cy+h);y++)
    for(let x=Math.floor(c.cx-w);x<=Math.floor(c.cx+w);x++) carveCell(x,y);
   for(let q=0;q<2;q++){ const sw=Math.floor(3+rng()*3), sh=Math.floor(2+rng()*3);
    const sx=Math.floor(c.cx+(rng()*2-1)*(w-sw-1));
    const sy=Math.floor(c.cy+(rng()<0.5?1:-1)*(h+sh-1));
    for(let y=sy-sh;y<=sy+sh;y++)for(let x=sx-sw;x<=sx+sw;x++) carveCell(x,y); } }
 }
 // ---- corridors (wavy polyline or elbow) with dream-path spine; gates stamped LAST ----
 const brush=(fx,fy,rad)=>{ for(let y=Math.floor(fy-rad);y<=Math.floor(fy+rad);y++)
  for(let x=Math.floor(fx-rad);x<=Math.floor(fx+rad);x++)
   if((x-fx)*(x-fx)+(y-fy)*(y-fy)<=rad*rad) carveCell(x,y); };
 const gatePts=[], gatesByCh=[];
 for(let i=0;i<NCH-1;i++){ const a=chs[i], b=chs[i+1];
  const ph=rng()*6.283, midf=0.35+rng()*0.3;
  const ax=a.cx, ay=a.cy, bx=b.cx, by=b.cy;
  const dist=Math.hypot(bx-ax,by-ay), steps=Math.max(8,Math.floor(dist*2));
  const pts=[]; let gpt=null;
  if(st.room==='vault'){
   let segs;
   if(a.out==='E'){ const mx=ax+(bx-ax)*midf; segs=[[ax,ay],[mx,ay],[mx,by],[bx,by]]; gpt=[mx,(ay+by)/2]; }
   else { const my=ay+(by-ay)*midf; segs=[[ax,ay],[ax,my],[bx,my],[bx,by]]; gpt=[(ax+bx)/2,my]; }
   for(let si=0;si<segs.length-1;si++){ const x0=segs[si][0],y0=segs[si][1],x1=segs[si+1][0],y1=segs[si+1][1];
    const sl=Math.max(2,Math.floor(Math.hypot(x1-x0,y1-y0)*2));
    for(let t=0;t<=sl;t++){ const f=t/sl; pts.push([x0+(x1-x0)*f, y0+(y1-y0)*f]); } }
  } else {
   const pxn=-(by-ay)/(dist||1), pyn=(bx-ax)/(dist||1);
   for(let t=0;t<=steps;t++){ const f=t/steps;
    const fade=Math.sin(f*Math.PI);              // no wobble at the ends
    const off=Math.sin(f*Math.PI*2+ph)*st.wob*fade;
    pts.push([ax+(bx-ax)*f+pxn*off, ay+(by-ay)*f+pyn*off]); }
   gpt=pts[Math.floor(pts.length/2)];
  }
  for(const p2 of pts) brush(p2[0],p2[1],st.cw);
  // dream-path spine along the corridor
  for(const p2 of pts){ const fx=p2[0], fy=p2[1];
   for(let y=Math.floor(fy-1);y<=Math.floor(fy+1);y++)
    for(let x=Math.floor(fx-1);x<=Math.floor(fx+1);x++)
     if((x-fx)*(x-fx)+(y-fy)*(y-fy)<=1.0&&x>=1&&x<W2-1&&y>=1&&y<H2-1&&g[y][x]==='.') g[y][x]='p'; }
  if(i>0) gatePts.push(gpt);
 }
 for(const gp of gatePts){ const gx=gp[0], gy=gp[1], cells=[];
  const rad=st.cw+1.6;
  for(let y=Math.floor(gy-rad)-1;y<=Math.floor(gy+rad)+1;y++)
   for(let x=Math.floor(gx-rad)-1;x<=Math.floor(gx+rad)+1;x++)
    if((x-gx)*(x-gx)+(y-gy)*(y-gy)<=rad*rad&&x>0&&x<W2-1&&y>0&&y<H2-1&&(g[y][x]==='.'||g[y][x]==='p')){
     g[y][x]='D'; cells.push({x:x,y:y}); }
  gatesByCh.push(cells);
 }
 // `ring` is a BOSS ID here, not a band. Anything wanting a 0-8 theme index (mob names/tints,
 // tile fallbacks) goes through bossArt(ring) — the dream wears the boss's own theme.
 const room={key:'DUN',grid:g,w:W2,h:H2,lv:lv,band:'boss',town:false,big:false,dungeon:true,
  glows:[],portals:[],spawns:[],regions:null,rings:null,ring:ring,
  px:Math.floor(chs[0].cx),py:Math.floor(chs[0].cy),
  orbs:[], switches:[], plates:[], circles:[], chases:[], objs:[], ddec:[] };
 // objectives: chambers 1..NCH-2 alternate the ring's SIGNATURE puzzle with combat
 for(let ci=1;ci<NCH-1;ci++){ const c=chs[ci], oi=ci-1;
  const isSig=(oi%2===0);
  const type=isSig?DPUZ[ring]:'waves';
  const obj={type:type,mode:type,ch:oi,need:3,got:0,done:false,gateCells:gatesByCh[oi]||[],
   bounds:{x0:Math.floor(c.cx-c.r)-4,y0:Math.floor(c.cy-c.ry)-4,
           x1:Math.floor(c.cx+c.r)+4,y1:Math.floor(c.cy+c.ry)+4},
   label:type==='waves'?'Slay every phantom':DPUZ_LABEL[ring],
   spots:[], rgT:0, snuffT:0, demoT:0, timer:0};
  if(isSig){
   // 3 puzzle spots via rejection sampling on the organic floor (mirrored by the sim)
   for(let q=0;q<3;q++){ let sx=null, sy=null;
    for(let t2=0;t2<24;t2++){ const tx2=Math.floor(c.cx+(rng()*2-1)*c.r*0.7);
     const ty2=Math.floor(c.cy+(rng()*2-1)*c.ry*0.7);
     if(tx2>0&&tx2<W2-1&&ty2>0&&ty2<H2-1&&g[ty2][tx2]==='.'){ sx=tx2; sy=ty2; break; } }
    if(sx===null){ sx=Math.floor(c.cx)+q; sy=Math.floor(c.cy); }
    const px2=(sx+.5)*TILE, py2=(sy+.5)*TILE;
    obj.spots.push({tx:sx,ty:sy,x:px2,y:py2});
    if(type==='regrow'||type==='ambush') room.spawns.push({t:'N',x:sx,y:sy,ch:oi});
    else if(type==='order'||type==='relay'||type==='timing')
     room.switches.push({x:px2,y:py2,ch:oi,on:false,idx:q,mode:type});
    else if(type==='simon'||type==='candles')
     room.plates.push({x:px2,y:py2,ch:oi,on:false,idx:q,mode:type});
    else if(type==='hold') room.circles.push({x:px2,y:py2,ch:oi,prog:0,lit:false}); }
   if(type==='chase') room.chases.push({ch:oi,x:obj.spots[0].x,y:obj.spots[0].y,wt:0});
  } else obj.need=-1;
  // mob packs in this chamber (denser deeper into the mind); 2 rng draws per pack
  const nm=3+Math.floor(rng()*2)+Math.floor(ci*0.7);
  for(let q=0;q<nm;q++){ const ra=rng(), rb=rng();
   const sx=Math.floor(c.cx+(ra*2-1)*c.r*0.8), sy=Math.floor(c.cy+(rb*2-1)*c.ry*0.8);
   if(sx>0&&sx<W2-1&&sy>0&&sy<H2-1&&g[sy][sx]==='.')
    room.spawns.push({t:ra<0.4?'s':'c',x:sx,y:sy,ch:oi}); }
  room.objs.push(obj); }
 const bc=chs[NCH-1];
 room.spawns.push({t:'B',x:Math.floor(bc.cx),y:Math.floor(bc.cy),ch:99});
 // entry + boss centres guaranteed open (mirror: python brushes these at the end)
 brush(chs[0].cx,chs[0].cy,2.5); brush(bc.cx,bc.cy,3.0);
 // --- everything below is JS-only garnish (no grid mutation the sim needs) ---
 // a light welcome pack in the entry chamber
 for(let q=0;q<2;q++){ const c=chs[0];
  const sx=Math.floor(c.cx+(rng()*2-1)*c.r*0.7), sy=Math.floor(c.cy+(rng()*2-1)*c.ry*0.7);
  if(sx>0&&sx<W2-1&&sy>0&&sy<H2-1&&g[sy][sx]==='.'&&(sx!==room.px||sy!==room.py))
   room.spawns.push({t:'c',x:sx,y:sy,ch:-1}); }
 // dream decor scattered through every chamber (crystals, saplings, sunken faces,
 // spectral braziers, memory shards, rune stumps)
 chs.forEach(function(c,i){ const k=2+Math.floor(rng()*3);
  for(let q=0;q<k;q++){ const dx2=Math.floor(c.cx+(rng()*2-1)*c.r*0.8);
   const dy2=Math.floor(c.cy+(rng()*2-1)*c.ry*0.8);
   if(dx2<=0||dx2>=W2-1||dy2<=0||dy2>=H2-1) continue;
   if(g[dy2][dx2]!=='.'||(Math.abs(dx2-c.cx)<3&&Math.abs(dy2-c.cy)<3)) continue;
   room.ddec.push({x:(dx2+.5)*TILE,y:(dy2+.5)*TILE,i:Math.floor(rng()*6)}); } });
 room.bossRing=ring;
 // THE WARDEN. One living human still inside a starter dungeon, holding a ward that is losing.
 // He is the first on-screen hint that the corruption is a THING being resisted rather than
 // weather — and the seed of the reveal the canon bosses finish much later. Placed in a middle
 // chamber (never the boss arena) so he's found on the way in.
 if(DUN_NPC[ring] && chs.length>2){ const c=chs[1];
  room.npc=Object.assign({x:(c.cx+.5)*TILE, y:(c.cy+.5)*TILE, said:0}, DUN_NPC[ring]); }
 rooms['DUN']=room;
 return room;
}
function enterDungeon(ring){
 dunReturn={x:player.x,y:player.y};
 genDungeon(ring);
 curRoom=rooms['DUN']; // set so makeEnemy reads dungeon lv
 enterRoom('DUN',(rooms['DUN'].px+.5)*TILE,(rooms['DUN'].py+.5)*TILE);
 // Canon dungeons ARE the boss's corruption-dream: it dreams of the home it lost before the rift.
 // The starter three are plain places — a salt-house, a lighthouse, a chapel — so they say so.
 const gb=GBOSS[ring];
 msg(gb.dn, gb.dsub || (gb.n+' dreams of '+(gb.home||'a world now lost')));
}

const SHOPNPCS=[
 {id:'bram', name:'Bram', role:'WEAPONS', title:"BRAM'S WEAPONWORKS", awn:'#b5482f', x:9.5*TILE,  y:10.8*TILE},
 {id:'sella',name:'Sella',role:'ARMOR',   title:"SELLA'S ARMORY",     awn:'#e07a2e', x:9.5*TILE,  y:18.3*TILE},
 {id:'maren',name:'Maren',role:'POTIONS', title:"MAREN'S PROVISIONS", awn:'#4f9a3f', x:32.5*TILE, y:10.8*TILE},
 {id:'odo',  name:'Odo',  role:'PETS',    title:"ODO'S MENAGERIE",    awn:'#7ab8d4', x:32.5*TILE, y:18.3*TILE},
];
let curShopNear=null;
// ---- unified difficulty curve ----
// EVERY enemy stat derives from these two so the whole game rescales in unison.
// Linear early (unchanged feel in the first zones) + quadratic late: player power
// compounds (tier² weapons × rarity × tree × attack speed), so enemies must too —
// with only the old linear curve the realm got EASIER as you climbed.
// RETUNED for the perk trees + ascension ultimates (rule 8c: the curve must assume capstone
// AND ultimate power at endgame). Measured: this curve was calibrated against a hero with NO
// tree investment (TTK 1.2s at Lv1 -> 5.44s at Lv150, matching its design intent), but a
// fully-specced ascended hero cut endgame TTK to 3.10s — the trees alone made the late game
// ~1.75x easier than designed, before ultimates added ~40% more effective DPS.
// hpQuad carries the correction because it is ~nil early and dominant late: enemy HP is
// untouched in the first zones, +36% by Lv40, +60% by Lv150 — tracking how perk points
// actually accumulate. dmQuad rises only slightly: with permadeath from Lv20, death should
// come from readable pattern pressure (rule 5b), not from single hits turning lethal.
// HARDER PASS (user, 2026-07-24 — "make the game overall more difficult"): on top of a ~50%
// spawn-density increase (more enemies = more bullets = the fun, dodgeable axis of harder),
// enemies are tankier and hit harder across the board. hp +9% base / more late, damage +15%
// base — every zone bites now, not only the endgame. Deaths still come from patterns, not
// one-shots (rule 5b), so dmg is raised via the linear term rather than the quadratic.
// LEVEL-AXIS COMPRESSION 150->50 (world rework): the level axis shrank 3x, so an enemy at the
// new lv reads the same as the old enemy at 3*lv. eHpScale/eDmgScale(lv) ~= old(3*lv) means the
// LINEAR terms ×3 and the QUADRATIC terms ×9 (since (3lv)^2 = 9lv^2). Player level-stats/tree/
// gear-tier were scaled to match, so a Lv50 hero vs a Lv50 enemy == the old Lv150 matchup. Then
// verified/nudged with the TTK harness. Old (Lv150): {0.60,0.024,0.95,0.016}.
const DIFF={hpLin:1.80, hpQuad:0.216, dmLin:2.85, dmQuad:0.144};
function eHpScale(lv){ return 1 + lv*DIFF.hpLin + lv*lv*DIFF.hpQuad; }
function eDmgScale(lv){ return lv*DIFF.dmLin + lv*lv*DIFF.dmQuad; }
// ---- enemy RPG STAT BLOCK (user, 2026-07-24): every enemy carries a real spread that scales
// with level, so higher-level foes are tougher across MULTIPLE axes, not just hp sponges.
//   DEF  -> % damage reduction in dealDamage. TTK-NEUTRAL by construction: makeEnemy pre-divides
//           hp by (1-dr), so kills-to-die is unchanged and the measured DIFF curve is preserved;
//           def just re-expresses tankiness as armour (and lets armour-piercing/DoT matter).
//   DEX  -> attack speed + projectile speed for shooters.
//   SPD  -> movement-speed multiplier (bounded so fast foes stay kiteable).
//   MP   -> caster pool: shooters spend it per volley and regen it, so low-level casters can't
//           sustain fire while high-level ones pour it on.
function eDef(lv){ return Math.round(1 + lv*1.3); }
function eDR(def){ return Math.min(0.5, def/(def+120)); }
function eDex(lv){ return Math.round(2 + lv*1.0); }
function eSpdMul(lv){ return 1 + Math.min(0.45, lv*0.010); }
function eMp(lv){ return Math.round(12 + lv*4); }
// ---- enemy BEHAVIOURS (user, 2026-07-24) — each is a personality that changes how the
// enemy SPAWNS (dormant? anchored? in a pack?) and ROAMS (chase / kite / guard / wander),
// consumed by the movement code in 07_update via enemyAI(). Difficulty comes from these +
// the DIFF stat curve, NOT from spawning more of them. Params are tunable here.
//   hunter     relentless chase — but a LOPING one: it weaves as it closes (see below)
//   pack       surrounds you on assigned flanking slots, then collapses in together
//   ambusher   DORMANT until you step close, then a fast lunge burst (spawn: sits inert)
//   sentinel   guards its spawn point; chases only within a leash, else returns and patrols; tankier
//   roamer     wanders the ground when you're far, hunts when you're near (the map feels alive)
//   skirmisher (shooters) KITES — backs off when you close in, holds at range and fires
//
// MOVEMENT SIGNATURE (user, 2026-07-26). The behaviours above are engagement RULES — when to
// approach, when to break off — and every one of them resolved to the same thing once engaged:
// walk the straight line to the player. So a hound, a guard and a cultist all moved identically.
// These fields give each one a shape as well as a rule:
//   sway     how far the heading swings off the straight line, in RADIANS, and its frequency.
//            Radians, not pixels: a fixed lateral offset applied to a target 300px away turns the
//            heading by only atan(off/300) and the path barely bends — measured 2-4px of actual
//            deviation for a 34px offset. An angle serpentines the same way at every range.
//   commit   distance (px) inside which the sway decays to nothing — the final approach is
//            straight, because a lunge that wobbles reads as indecision rather than menace.
//   lunge    hounds only: {min,max} band where it commits to a straight dash, its speed multiple,
//            duration and cooldown. This is the one movement a four-legged pack predator must have.
//   harry    radius it orbits at while its lunge is on cooldown. Without this a hound that closes
//            simply parks on top of you and becomes a stationary damage aura; with it you get the
//            real thing — circle, dart in, peel off, circle.
//   flank    pack only: radius it tries to hold while surrounding, and the distance at which the
//            ring collapses onto the kill.
const EBEH={
  hunter:    {sway:0.55, swayF:2.1, commit:120, harry:74,
              lunge:{min:105,max:260,mul:2.5,dur:0.34,cd:2.4}},
  pack:      {cohesion:150, packBuff:0.16, sway:0.34, swayF:2.6, commit:90, harry:66,
              flank:150, collapse:190, lunge:{min:95,max:240,mul:2.6,dur:0.30,cd:2.0}},
  // breakoff must last long enough to actually clear `rehide`, and rehide must sit clear of
  // `wake` or it re-arms inside its own trigger radius and instantly wakes again
  ambusher:  {wake:200, burst:1.95, burstT:1.4, hpMul:0.85, touchMul:1.35,
              breakoff:1.9, rehide:260, sway:0, commit:0},
  sentinel:  {leash:360, hpMul:1.55, spdMul:0.9, pace:70, sway:0.16, swayF:1.2, commit:150},
  roamer:    {engage:540, wander:0.42, sway:0.45, swayF:1.5, commit:130, harry:82,
              lunge:{min:110,max:250,mul:2.2,dur:0.30,cd:3.0}},
  skirmisher:{kiteMin:175, kiteMax:300, spdMul:2.4, root:0.42},
};
// deterministic per-spawn so a given spot keeps its character across respawns (a guarded
// chokepoint stays guarded). Variety + danger rise with the band.
function pickBehaviour(sp,lv,type){
  const b=Math.max(0,Math.min(8,Math.round(lv/5.5)));   // behaviour-variety band (Lv50 -> full set)
  const h=(Math.imul(sp.x|0,374761393)+Math.imul(sp.y|0,668265263))>>>0;
  const roll=(h^(h>>>13))%100;
  if(type==='s'){
    if(roll < 26+b*4) return 'skirmisher';
    if(roll < 42+b*2) return 'sentinel';
    if(roll < 55)     return 'roamer';
    return 'hunter';
  }
  if(roll < 16+b*3) return 'pack';
  if(roll < 30+b*4) return 'ambusher';
  if(roll < 44+b*2) return 'sentinel';
  if(roll < 58)     return 'roamer';
  return 'hunter';
}
function makeEnemy(sp){
  const lv=roomLvAt(sp);
  const hm=eHpScale(lv), dm=eDmgScale(lv);
  // enemy stat block (scales with level) — see eDef/eDR/eDex/eSpdMul/eMp above
  const edef=eDef(lv), edr=eDR(edef), edex=eDex(lv), espd=eSpdMul(lv), emp=eMp(lv);
  const hpm=hm*(1-edr);   // TTK-neutral: (base*hpm)/(1-edr) == base*hm, so kills-to-die is unchanged
  let e;
  if(sp.t==='c') e={type:'c',r:15,hp:40*hpm,spd:95*espd,touch:12+dm,col:'#c04a3d'};
  else if(sp.t==='s') e={type:'s',r:16,hp:60*hpm,spd:46*espd,fireT:1,bd:8+dm*0.63,col:'#8a5ac0'};
  else if(sp.t==='N'){ // dungeon objective node: stationary, harmless, must be destroyed
    const th=GBOSS[(curRoom&&curRoom.ring)||0];
    e={type:'N',r:16,hp:Math.round(46*hm),spd:0,touch:0,col:th?th.col:'#7ab8d4',node:true}; }
  else { const bring=(curRoom&&curRoom.dungeon)?curRoom.bossRing:-1;
    const GB=bring>=0?GBOSS[bring]:null;
    // dungeon boss = the AWAKENED consciousness: tougher than the flesh it wore,
    // and it always layers both its shot patterns (e.awk bypasses the Lv60 gate).
    // The starter three are NOT dreams — just the creature itself, holed up in a human
    // building — so they keep their own name and don't get the awakened buff or sprite.
    const _awk=!!GB&&GB.gate!=='none';
    // A starter dungeon is not a dream, so its boss is not "Awakened" -- but it must not be the
    // exact same creature you already killed outside either. It is the elder of the ones that
    // moved into the building: its own name, its own sprite (awak_9..11), and a little bigger and
    // harder than the overworld encounter without reaching the awakened tier.
    const _den=!!GB&&!_awk&&bring>=0;
    e={type:'B',r:(GB?32+(lv/LV_CAP)*16:30)*(_den?1.18:1),
     hp:Math.round(600*hpm*(GB?(_awk?1.9:_den?1.55:1.35):1)),spd:(GB?44:38)*espd,fireT:1.5,ang:0,
     col:GB?GB.col:'#e07a2e',boss:true,bd:(8+dm*0.63)*(GB?(_awk?1.25:_den?1.18:1.1):1),
     name:GB?(_awk?'Awakened '+GB.n:(_den&&GB.denN)?GB.denN:GB.n):null,pat:GB?GB.pat:'ring8',pat2:GB?GB.pat2:'spiral',
     ring:bring,mech:GB?GB.mech:null,chargeT:0,sumT:3,wb:!!GB,awk:_awk,den:_den}; }
  e.x=(sp.x+.5)*TILE; e.y=(sp.y+.5)*TILE; e.sref=sp; e.lv=lv; if(sp.ch!==undefined) e.ch=sp.ch;
  // attach the scaling stat block (nodes stay armour-free so their timed destruction is exact)
  e.def=(sp.t==='N')?0:edef; e.dr=(sp.t==='N')?0:edr; e.dex=edex; e.maxmp=emp; e.mp=emp;
  // assign a behaviour to roaming enemies (not dungeon nodes / bosses) and apply its spawn-time
  // tweaks. home = spawn point (sentinels leash to it); ambushers begin dormant.
  if(e.type==='c'||e.type==='s'){
    e.beh=pickBehaviour(sp,lv,e.type); const B=EBEH[e.beh]||EBEH.hunter;
    e.home={x:e.x,y:e.y}; e.roamA=Math.random()*6.283;
    if(B.hpMul) e.hp*=B.hpMul;
    if(B.spdMul) e.spd*=B.spdMul;
    if(B.touchMul&&e.touch) e.touch*=B.touchMul;
    if(e.beh==='ambusher') e.dormant=true;
    // CORRUPTED VARIANTS: the infection mutates creatures more the nearer the rift. A corrupted
    // foe is buffed, violet-stained, and fires violet — the world visibly rots as you push east.
    if(typeof corruptAt==='function'){ const cor=corruptAt(sp.x,sp.y);
      if(Math.random() < cor*0.65){ e.corrupt=true; e.corLvl=cor;
        e.hp*=1.45; e.spd*=1.14; if(e.touch) e.touch*=1.30; if(e.bd) e.bd*=1.30;
        if(e.def){ e.def=Math.round(e.def*1.3); e.dr=eDR(e.def); }
        e.pcol='#b030d0'; e.pcore='#f0c0ff'; e.col='#7a2a8a'; } }
  }
  // NEVER spawn inside a wall — grove lairs stamp 'X' over old spawn spots, and any
  // future caller might pass a bad tile; relocate to the nearest open cell.
  if(typeof solid==='function'&&curRoom&&solid(e.x,e.y)){
    const ss=safeSpot(curRoom,e.x,e.y); e.x=ss.x; e.y=ss.y; }
  // group scaling: enemies grow with how many heroes are actually here (co-op)
  const cn=(typeof coopNearCount==='function')?coopNearCount(e.x,e.y):1;
  if(cn>1){ e.hp*=1+0.65*(cn-1);
    if(e.touch) e.touch*=1+0.22*(cn-1);
    if(e.bd) e.bd*=1+0.22*(cn-1); }
  e.hp=Math.round(e.hp); e.maxhp=e.hp;
  return e;
}
function slowF(e){return e.slowT>0?0.55:1;}
function safeSpot(r,px,py){
 function sol(tx,ty){ if(ty<1||ty>=r.h-1||tx<1||tx>=r.w-1) return true;
  return 'WhlHwtkXD'.indexOf(r.grid[ty][tx])>=0; }   // incl. lair walls + dream gates
 const t0x=Math.floor(px/TILE), t0y=Math.floor(py/TILE);
 for(let rad=0;rad<14;rad++){
  for(let dy=-rad;dy<=rad;dy++)for(let dx=-rad;dx<=rad;dx++){
   if(Math.max(Math.abs(dx),Math.abs(dy))!==rad) continue;
   if(!sol(t0x+dx,t0y+dy)) return {x:(t0x+dx+.5)*TILE,y:(t0y+dy+.5)*TILE};
  } }
 return {x:px,y:py}; }
// ===== RADIAL world model (two islands + bridge; matches genworld.py) =====
// Band 0-8 and level 1-50 come from RADIAL distance: starter island (west) is Lv1-20 by
// distance from its spawn centre; the bridge is the Lv20 gate; the main island (east) is
// Lv20-50 by distance from the CORE (bridge landing), with a flat Lv50 grind ring at the rim.
function _onBridge(R,tx,ty){ const B=R.bridge; return tx>=B.x0&&tx<=B.x1&&Math.abs(ty-B.cy)<=(B.w>>1); }
// Starter-island test. NOT `tx<bridge.x0`: the island is noise-shaped and its east shore spills
// past bridge.x0 (176), so those tiles fell through to the MAIN formulas and read Lv27 +
// main-island corruption on what is plainly the safe island. The bridge gap is pure ocean
// (starter land ends ~190, main land starts ~230), so its MIDPOINT cleanly divides the two.
function _onStarter(R,tx,ty){ return tx<(R.bridge.x0+R.bridge.x1)*0.5; }
// LEVEL is still smooth-radial (danger climbs outward), computed from the rings geometry.
function grvLvAtR(RG,tx,ty){ if(!RG||!RG.radial) return 1;
 if(_onBridge(RG,tx,ty)) return 20;
 if(_onStarter(RG,tx,ty)){ const f=Math.min(1,Math.hypot(tx-RG.starter.cx,ty-RG.starter.cy)/RG.starter.r);
   // EASED starter ramp (f^1.7, not linear): the inner ~40% around the spawn stays Lv1-4 so a
   // brand-new Lv1 hero isn't immediately swarmed by Lv10+ foes it can't dent, and only the far
   // edge / bridge approach reaches the Lv20 gate. (Linear made the whole starter island too steep.)
   return Math.max(1,Math.min(20,Math.round(1+Math.pow(f,1.7)*19))); }
 const gR=RG.grindR||0.8, f=Math.min(1,Math.hypot(tx-RG.core.cx,ty-RG.core.cy)/RG.rmax);
 if(f>=gR) return 50;                                   // flat Lv50 grind ring
 return Math.max(20,Math.min(50,Math.round(20+(f/gR)*29))); }
function grvLvAt(tx,ty){ const R=curRoom&&curRoom.rings; if(!R||!R.radial) return (curRoom&&curRoom.lv)||1;
 return grvLvAtR(R,tx,ty); }
// ----- Clumped zones (territories) -----
// The named zones are ORGANIC CLUMPS, not concentric rings: ~13 seeds (3 starter + 5 inner main +
// 5 grind) partition the land into Voronoi provinces with a wavy warp so borders are irregular.
// Seeds are placed inner->outer, so each clump's THEME-BAND (tileset/tone) still trends green->red
// while difficulty (grvLvAt above) climbs smoothly outward. Built once per world, cached on rings.
function _territories(R){ const RG=R&&R.rings; if(!RG||!RG.radial) return null; if(RG._terr) return RG._terr;
 const S=RG.starter, C=RG.core, Rm=RG.rmax, nm=RG.names, gr=RG.grind||[], T=[];
 const add=(cx,cy,name,band,gi)=>{ T.push({cx,cy,name,band,gi:(gi==null?-1:gi),lvmin:99,lvmax:0,sx:0,sy:0,n:0}); };
 add(S.cx-7,S.cy+3, nm[0].n,0); add(S.cx+3,S.cy-15,nm[1].n,1); add(S.cx+17,S.cy+12,nm[2].n,2);   // starter clumps
 const iAng=[0.5,-0.7,0.95,-0.35,0.35];                                                            // main inner (bands 3-7)
 for(let i=0;i<5;i++){ const b=3+i, f=(b-2.4)/6; add(Math.round(C.cx+Math.cos(iAng[i])*Rm*f),Math.round(C.cy+Math.sin(iAng[i])*Rm*f),nm[3+i].n,b); }
 const gAng=[-0.8,-0.35,0.05,0.45,0.85];                                                           // grind clumps (band 8)
 for(let i=0;i<gr.length;i++){ add(Math.round(C.cx+Math.cos(gAng[i])*Rm*0.9),Math.round(C.cy+Math.sin(gAng[i])*Rm*0.9),gr[i],8,i); }
 const W=R.w,H=R.h,grid=R.grid,zg=new Array(H);
 for(let ty=0;ty<H;ty++){ const row=grid[ty], zr=new Int8Array(W); zg[ty]=zr;
   for(let tx=0;tx<W;tx++){ const ch=row&&row[tx];
     if(ch==null||ch==='w'||ch==='b'){ zr[tx]=-1; continue; }
     const wx=tx+7*Math.sin(ty*0.21+tx*0.05)+4*Math.sin(ty*0.61), wy=ty+7*Math.cos(tx*0.21+ty*0.05)+4*Math.cos(tx*0.61);
     let bi=0,bd=1e18; for(let i=0;i<T.length;i++){ const dx=wx-T[i].cx,dy=wy-T[i].cy,d=dx*dx+dy*dy; if(d<bd){bd=d;bi=i;} }
     zr[tx]=bi; const t=T[bi], lv=grvLvAtR(RG,tx,ty);
     if(lv<t.lvmin)t.lvmin=lv; if(lv>t.lvmax)t.lvmax=lv; t.sx+=tx; t.sy+=ty; t.n++; } }
 RG._zg=zg; RG._terr=T; return T; }
// tx/ty arrive as FLOAT tile coords from every entity-position caller (px/TILE), so they MUST be
// floored — an unfloored _zg[222.3] is undefined, which silently returned -1 and made every such
// lookup fall through to the coarse radial approximation instead of the real clump.
function zoneAt(tx,ty){ const R=curRoom, RG=R&&R.rings; if(!RG||!RG.radial) return -1;
 _territories(R); const x=Math.floor(tx), y=Math.floor(ty);
 const zr=RG._zg&&RG._zg[y]; return (zr&&x>=0&&x<zr.length)?zr[x]:-1; }
// THEME band from the clump the tile sits in (drives tileset/tone/tree/boulder + map colour).
function grvBandAt(tx,ty){ const R=curRoom, RG=R&&R.rings; if(!RG||!RG.radial) return 0;
 const T=_territories(R), zi=zoneAt(tx,ty);
 if(zi>=0) return T[zi].band;
 if(_onBridge(RG,tx,ty)) return 3;                       // bridge/water: theme unused, approximate radially
 if(_onStarter(RG,tx,ty)){ const f=Math.min(1,Math.hypot(tx-RG.starter.cx,ty-RG.starter.cy)/RG.starter.r); return Math.max(0,Math.min(2,Math.floor(f*3))); }
 const f=Math.min(1,Math.hypot(tx-RG.core.cx,ty-RG.core.cy)/RG.rmax); return Math.max(3,Math.min(8,3+Math.floor(f*6))); }
// zone identity: the clump's name + its actual level range (min..max of the smooth curve within it).
// Off-land tiles (bridge/coast) have no territory, so fall back to the NEAREST clump — never the
// old angular-sector guess, which mislabelled the bridge as a random grind zone.
function ringInfoAt(tx,ty){ const R=curRoom, RG=R&&R.rings; if(!RG) return null;
 const T=_territories(R); if(!T||!T.length) return null;
 let t=T[zoneAt(tx,ty)];
 if(!t){ let bi=0,bd=1e18; for(let i=0;i<T.length;i++){ const dx=tx-T[i].cx,dy=ty-T[i].cy,d=dx*dx+dy*dy; if(d<bd){bd=d;bi=i;} } t=T[bi]; }
 return {n:t.name, lv:t.lvmin, lv2:t.lvmax}; }
// 0..1 corruption — a WORLD-WIDE gradient (drives the ground stain + corrupted enemy spread).
// The safe western starter island is barely touched; the main island ramps from the bridge
// landing out to the rift, with an intense local bloom right at the portal. Matches the canon:
// the infection is eating this world from the rift outward, worse the closer you press east.
function corruptAt(tx,ty){ const R=curRoom&&curRoom.rings; if(!R||!R.portal) return 0;
 const dd=Math.hypot(tx-R.portal.x,ty-R.portal.y);
 const local=Math.max(0,1-dd/70);                       // fierce bloom at the rift itself
 let grad=0.04;                                         // starter island: a faint taint only
 if(R.core && !(R.bridge && _onStarter(R,tx,ty))){
   const f=Math.min(1,Math.hypot(tx-R.core.cx,ty-R.core.cy)/(R.rmax||300));
   grad=0.10+f*0.78; }                                  // main island: deepens core -> rift
 return Math.max(0,Math.min(1, Math.max(local,grad))); }
function regionAtPx(px,py){ if(!curRoom) return null;
 if(curRoom.rings) return ringInfoAt(px/TILE,py/TILE);
 if(!curRoom.regions) return null;
 const tx=px/TILE, ty=py/TILE;
 for(const rg of curRoom.regions){ if(tx>=rg.x1&&tx<rg.x2&&ty>=rg.y1&&ty<rg.y2) return rg; }
 return null; }
// true once you have crossed the bridge onto the main island (permadeath territory)
function onMainIsland(px,py){ const R=curRoom&&curRoom.rings; return !!(R&&R.radial&&px/TILE>R.bridge.x1); }
function roomLvAt(sp){
 if(curRoom&&curRoom.rings) return grvLvAt(sp.x,sp.y);
 if(curRoom&&curRoom.regions){
  for(const rg of curRoom.regions){ if(sp.x>=rg.x1&&sp.x<rg.x2&&sp.y>=rg.y1&&sp.y<rg.y2) return rg.lv; } }
 return (curRoom&&curRoom.lv)?curRoom.lv:1; }

function enterRoom(key, px, py){
  curRoom=rooms[key];
  player.x=px; player.y=py;
  enemies=[]; pShots=[]; eShots=[]; embers=[]; loots=[]; zones=[]; fx=[];
  worldBoss=null; ringBossCd=[]; if(!curRoom||!curRoom.dungeon) groundPortals=[];
  for(const al of allies){al.x=player.x;al.y=player.y;}
  buildRoomCache();
  curRegionN='';
  const rnow=Date.now();
  if(!curRoom.big){ for(const sp of curRoom.spawns){ if(!sp.dead||sp.dead<=rnow) enemies.push(makeEnemy(sp)); } }
  document.getElementById('roomTxt').textContent=curRoom.name;
  msg(curRoom.name, curRoom.town?'the hearth never dies':(curRoom.band?'a hunting ground for Lv '+curRoom.band:''));
}
function msg(t,sub=''){ const m=document.getElementById('msg');
  m.innerHTML=t+(sub?`<small>${sub}</small>`:''); m.classList.add('show');
  clearTimeout(msg.t); msg.t=setTimeout(()=>m.classList.remove('show'),1500); }

// ---- portal routing: every portal carries a destination `to` ----
function usePortal(to){
  if(to==='_petback'){ if(typeof leavePetRoom==='function') leavePetRoom(); return; }   // exit the Sanctuary
  if(curRoom&&curRoom.arena&&arenaActive){ recordArenaBest(); arenaActive=false; }
  if(to==='G'){ const gv=rooms['G']; if(!gv) return;
    // Arrive at the LOW-LEVEL HEART of the starter island (Lv1), not the baked P point — P sits
    // off-centre in a Lv5 pocket where the surrounding radial ramp already puts nearby foes at
    // Lv6-10, which a brand-new Lv1 hero can't dent. Spawning at the starter centre means the
    // first ~12 tiles in every direction are Lv1-4. Falls back to P for non-radial worlds.
    const RG=gv.rings;
    let ax,ay;
    if(RG&&RG.radial&&RG.starter){ ax=(RG.starter.cx+.5)*TILE; ay=(RG.starter.cy+.5)*TILE; }
    else { ax=(gv.px!=null?gv.px+.5:gv.w/2)*TILE; ay=(gv.py!=null?gv.py+.5:gv.h/2)*TILE; }
    const sp=safeSpot(gv,ax,ay); enterRoom('G',sp.x,sp.y);
    const rg=(typeof regionAtPx==='function')?regionAtPx(sp.x,sp.y):null;
    msg((rg&&rg.n||'THE LANDING SANDS').toUpperCase(),'your journey begins'); return; }
  const dst=rooms[to]; if(!dst) return;
  const sp=safeSpot(dst,(dst.px+.5)*TILE,(dst.py+.5)*TILE);
  enterRoom(to,sp.x,sp.y);
  if(dst.arena) startArena();
}
// ---- Arena: endless escalating waves ----
function recordArenaBest(){ if(!rpg) return; const survived=Math.max(0,arenaWave-1);
  if(survived>(rpg.arenaBest||0)){ rpg.arenaBest=survived; msg('NEW RECORD','wave '+survived+' survived'); }
  if(typeof saveRPG==='function') saveRPG(); }
function startArena(){ arenaActive=true; arenaWave=0; arenaCd=1.6; enemies=[]; eShots=[];
  msg('THE PROVING GROUNDS', (rpg&&rpg.arenaBest)?'best: wave '+rpg.arenaBest:'survive as long as you can'); }
function arenaSpawnWave(){ const a=rooms['ARENA']; if(!a) return;
  arenaWave++;
  a.lv=Math.min(LV_CAP, 2+arenaWave*1.3);   // arena scales to the Lv50 cap over its waves
  const boss=(arenaWave%5===0);
  const n=boss?1:Math.min(22, 3+Math.floor(arenaWave*1.6));
  for(let i=0;i<n;i++){
    let x,y,tries=0;
    do{ x=(2+Math.random()*(a.w-4))*TILE; y=(2+Math.random()*(a.h-4))*TILE; tries++; }
    while(tries<30 && (solid(x,y) || Math.hypot(x-player.x,y-player.y)<170));
    const t=boss?'B':(arenaWave>2 && i%4===0)?'s':'c';
    enemies.push(makeEnemy({t:t,x:Math.floor(x/TILE),y:Math.floor(y/TILE)}));
  }
  msg('WAVE '+arenaWave, boss?'a champion approaches':n+' foes');
}
