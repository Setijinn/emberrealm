// ---------- entities ----------
const player={x:0,y:0,r:14,hp:100,maxhp:100,spd:180,dmg:12,fireRate:0.22,fireT:0,kills:0,inv:0};
let curRoom=null, enemies=[], pShots=[], eShots=[], particles=[], embers=[];
let rpg=null, texts=[], respawnT=1, shopNear=false, loots=[];
let allies=[], zones=[], fx=[], res=0, lastShotT=99, abT=0, portalLock=false, curRegionN='';
// WHEN A PLACE IS ALLOWED TO ANNOUNCE ITSELF AGAIN.
// The zone banner fired on any change of region and remembered only the LAST one, so a boundary
// re-announced on every crossing -- measured, walking back and forth across one line produced a
// banner every single time, alternating two names forever. Fighting along a border did the same.
// A name is worth saying when you ARRIVE somewhere, not every time you step over a line you are
// standing on, so each region gets a cooldown of its own.
const ZONE_RENOTE=90000, BOSS_RENOTE=120000;
let _zoneNoted={}, _bossNoted={};
function zoneMayNote(n){ const t=Date.now();
  if(t-(_zoneNoted[n]||0) < ZONE_RENOTE) return false;
  _zoneNoted[n]=t; return true; }
function bossMayNote(n){ const t=Date.now();
  if(t-(_bossNoted[n]||0) < BOSS_RENOTE) return false;
  _bossNoted[n]=t; return true; }
let portalPrompt=null;   // {kind,x,y,label,...} nearest interactable portal/pillar (USE-gated)
// LOOT IS ITS OWN PROMPT, not a competitor for the one above. They used to share a single slot, so
// standing on a sack beside a portal offered you exactly one of them and the button did whichever
// happened to be nearer -- which is how you end up in a dungeon when you meant to pick up a T12.
// Two slots, two buttons, two keys: E uses the world, F takes the loot.
let lootPrompt=null;     // {bag,x,y,ctx} nearest sack I am allowed to open
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
 // 12 — The Cairnworks (Lv11-15), the fourth starter province. Same refugee canon as 9-11: a
 // nobody that crossed early and moved into a human building. The other three follow water, fly
 // east, and keep a dead man's rows; this one counts. All four are doing something repetitive and
 // useless that used to be a job, which is the shape grief takes when nobody is left to tell it
 // to stop.
 {n:'The Cairnwright',dn:'The Tally Yard',col:'#9a8f7d',pat:'ring8',pat2:'spread5',mech:'bloom',
  gate:'none',dsub:'the yard is still counting',denN:'The Tally Keeper',
  title:'mason that cannot stop counting',
  desc:'It drives shocks through the ground in rings. The cut stone does not shake — stand on it.',
  lore:'The isles kept a masons’ yard on the rise, for headstones and boundary marks. It moved in the winter the ships stopped coming and has cut nothing since but cairns: small ones, in rows, not one of them marked. The tally scratched into the doorpost passed four thousand some years ago and it is still cutting. No one has ever found a body under any of them.',
  bark:['One stone for each. I carried the count through the door — the count is the only thing that crossed with me.',
        'You are standing on a row. Do not KICK them. I will have to start the row again.'],
  death:'...I lost the number somewhere in the crossing. Every stone since has been a guess.',
  home:'the quarry-terraces its people cut, before the rot came up through the stone'},
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
 {col:'#9a8f7d',core:'#eee6d4',shape:'dart',size:7},   // 12 Cairnwright — flung stone chips
];
let groundPortals=[], worldBoss=null, wbCd=18, dunReturn=null, ringBossCd=[];
function ringBossAlive(b){ for(const e of enemies) if(e.wb && e.ring===b) return true; return false; }
// ===== BOSS PLACEMENT =====
// Boss identity used to BE the theme band, which pinned the deepest-lore bosses to the starter
// island (the Grovewarden — the root-lord that anchored the rift — was a Lv4 fight). Identity is
// now CLUMP-indexed while terrain stays BAND-indexed: `grvBandAt` remains the sole authority for
// tilesets/tone/trees/boulders/map colour, and ZBOSS says who rules each of the 14 territories.
// _territories() lays clumps down in a fixed order: 0-3 starter, 4-8 inner main, 9-13 grind rim.
//   -1 = no boss. Clump 11 is The Molten Heart — the rift's own province, held for the final boss.
// Starter clump 2 (The Cairnworks, Lv11-15) is the new fourth zone; boss 12 takes it in phase 2.
const ZBOSS=[9,10,12,11, 0,1,2,3,4, 6,5,-1,7,8];
// The starter island's four five-level bands, and the TERRAIN band each one wears. Declared up
// here beside ZBOSS, not next to _territories 2000 lines below, because stampLairs() runs at load
// (line ~523) and calls _territories() -- a `const` further down the file is still in its temporal
// dead zone at that point and throws, which takes the whole of 03_entities.js with it.
// Bands are not 0/1/2/3: terrain bands are a separate index space that tops out at 8 and carries
// its own tilesets. The fourth zone borrows band 6, Stonebrow's grey stone and scree, which reads
// as the rocky spine you climb between the shingle and the marsh.
const STARTER_ZONES=4, STARTER_BANDS=[0,1,9,2];   // sand / shingle / quarry stone / marsh
// Seeds for the four starter provinces, marching NW->SE from the landing to the bridge. These are
// REAL territories -- warped Voronoi with irregular borders, the same treatment the main island
// gets -- not rings. Measured against the actual landmass rather than guessed, on four counts:
//   area      17/29/31/23% -- no province is a sliver
//   monotonic each centroid is further from the landing than the last, so the march has an order
//   NO SKIPS  only CONSECUTIVE provinces share a border. This is the one that matters: it is what
//             stops a Lv5 player wandering out of The Landing Sands straight into Lv11 ground.
//             Staggering the middle two north/south is also what stops their map labels colliding.
//   contiguity each province is a single connected blob, not islands of itself
const STARTER_SEED=[[90,290],[168,325],[228,392],[292,438]];
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
const BOSS_SLOT_N=13;                            // grows with the roster
function bossArtSlots(){ const s=[]; for(let i=0;i<BOSS_SLOT_N;i++){ const a=bossArt(i); if(s.indexOf(a)<0) s.push(a); } return s; }
// Borrowing is PER ASSET KIND, because a boss gets its sprite long before it gets a whole
// tileset and its scatter decor. Leave a boss in one of these and it still wears its own face.
// dungeon tilesets — 9/10/11 have their own since v218. 12 has its own sprite, den and animation
// but no dunset_12: a masons' yard IS the Shattered Vault's cut stone, so borrowing 3 is the
// right answer rather than a placeholder. Without this entry bossTileArt(12) falls through to
// bossArt(12)=12 and requests a file that does not exist, every session, against a cache-first sw.
const TILE_SLOT={12:3};
const DEC_SLOT={9:0,10:1,11:2,12:3};   // lair scatter decor — shared, same idea as DECAL_SRC
// A boss ARENA is that boss's den, so its walls and floor must carry the BOSS's theme — not the
// theme of whatever terrain it happens to stand in. Keying lair tiles to the terrain band (which
// is right for open ground) meant the Grovewarden fought in a stone room, the brine Tidewrack in
// a forest, and four different grind bosses all shared one molten tileset.
// Only slots 0-8 have a lairset_N sheet, so the starter three borrow the closest fit.
const LAIR_TILE={9:2, 10:4, 11:0, 12:3};  // brine->sunken warren, harrier->windward crag,
                                       // reaper->green, cairnwright->the Shattered Vault's cut stone
function lairTileSet(b){ return (LAIR_TILE[b]!==undefined)?LAIR_TILE[b]:bossArt(b); }
function bossTileArt(i){ return (TILE_SLOT[i]!==undefined)?TILE_SLOT[i]:bossArt(i); }
function bossDecArt(i){ return (DEC_SLOT[i]!==undefined)?DEC_SLOT[i]:bossArt(i); }
function bossTileSlots(){ const s=[]; for(let i=0;i<BOSS_SLOT_N;i++){ const a=bossTileArt(i); if(s.indexOf(a)<0) s.push(a); } return s; }
// ---- Boss surface lairs: tile-built enterable compounds stamped into the grove ----
// 'X' = lair wall (solid, themed tileset), '.' = interior floor -> 'F'. Bottom gap = doorway.
// (LAIR_TEMPLATES lived here: 147 lines of ASCII arena blueprints. They stopped being READ when
//  the organic carve landed — only their width/height was measured — and LAIR_SIZE now states
//  those dimensions outright, so the blueprints were deleted rather than left to mislead.)
const LAIR_BOSSES=[0,1,2,3,4,5,6,7,8,9,10,11,12];    // every boss gets a lair
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
// Starter angles are NEGATIVE on purpose. The starter clumps are now level bands running NW->SE
// along the island, so their centroids sit near the south coast; a positive nudge walks the
// footprint straight into the sea. Swept against the 5-point inZone test: -0.90 gives all three
// 4/4 arms on land and <=2% obstruction, while 0.30/0.90/1.20 put the chapel 36-87% underwater,
// which forces the shrink ladder and can drag the lair out of its own zone entirely.
const LAIR_NUDGE={0:1.8,1:-1.8,2:0.3, 3:0.9,4:-0.8,5:0.65,6:-0.5,7:0.45,8:-0.3, 9:-0.9,10:-0.9,11:-0.9, 12:2.95};
// Is this one of the starter island's plain-place bosses? `gate:'none'` is the real flag -- it is
// already what lets you walk into the dungeon without ascending (11_ui.js) and what marks the boss
// a den elder rather than a dream form (makeEnemy). This used to be `LAIR_RAD[ring]!==undefined`,
// an art-placement table doing duty as an identity test, which meant adding a starter boss without
// a radius entry silently gave it a Lv40 dungeon and the awakened buff.
function isStarterBoss(r){ return !!(typeof GBOSS!=='undefined' && GBOSS[r] && GBOSS[r].gate==='none'); }
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
 // A masons' yard: cut-stone walls, one cart gate wide enough to haul blocks through, and a
 // narrow side door. Reuses the 'vault' carve -- a fourth structure does not need a fourth
 // carve routine, and square corners are exactly what a stone yard should have.
 12:{k:'vault', doors:[[1.57,0.22],[3.14,0.13]], den:[0,-0.5], szMul:1.06},
};
// Where a boss's lair wants to be, in TILES. Shared by stampLairs and grvLairXY so the stamped
// footprint and the spawn fallback can never drift apart.
function lairAnchor(RG,T,z,b){
 const t=(T&&z>=0)?T[z]:null; if(!t||!t.n) return null;
 const cx=t.sx/t.n, cy=t.sy/t.n;
 // No starter special case any more. The four starter clumps are genuine level bands, so their
 // centroids already land at ~Lv3 / Lv7 / Lv12 / Lv17, each inside its own zone -- the generic
 // centroid+nudge path below is correct for every boss in the game.
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
  // TWO banners per spawn -- the sighting, and the flavour line 1.7s later -- and a boss
  // respawns 60s after it dies, so a den you keep walking past announced itself over and
  // over in pairs. Both go behind ONE cooldown: seeing it again is worth a line, seeing it
  // every minute is not.
  const _bossNoteOk = (typeof bossMayNote!=='function') || bossMayNote(GB.n);
  if(_bossNoteOk) msg('\u2620 '+GB.n,GB.title);
  setTimeout(function(){ if(enemies.indexOf(boss)>=0 && _bossNoteOk) msg(GB.n,GB.desc); },1700);
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
 'order','chase','hold','simon'];   // 12 reuses simon -- repeating a counted sequence IS the Cairnwright
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
 'Hold the Chapel Wards while they burn',
 'Repeat the Tally Stones — in the order they were cut'];
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
 // DSHAPE is dereferenced immediately in genDungeon (st.rmax) -- a missing entry is a TypeError,
 // not a fallback. Straightest walls of the four: everything in a masons' yard is cut square.
 {room:'vault',irr:0.05,rmin:6, rmax:9, wob:0.4,cw:1.7,gap:12},  // 12 masons' yard + tally rows
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
// A MISSING entry here falls back to `||ring`, so boss 12 would silently get depth 12: a
// 482-wide grid and ~10 chambers for a Lv12 starter dungeon. It is 1, like the other short ones.
const DDEPTH=[0,1,2,3,4,5,6,7,8, 0,0,1, 1];
function genDungeon(ring){
 // the mind is a step beyond the zone's peak — "matching but a little more difficult".
 // Measured off the boss's OWN clump (which _territories already samples from the smooth radial
 // curve), so there's no parallel level table to keep in sync — and no names[8] to fall off.
 const _t=bossClump(ring), _n=rooms['G'].rings.names[ring]||{lv:1};
 let lv;
 if(isStarterBoss(ring)){
   // Starter dungeons step past THIS BOSS, not the island's peak. Belt and braces now that the
   // clumps are real five-level bands (lvmax is 5/10/15/20, not 20 across the board): stepping off
   // the boss's own tile keeps a Lv4 den from dropping a dungeon its owner's killers can't enter.
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
 // A dungeon had no `name`, so the "where you are" label -- which reads curRoom.name -- was BLANK
 // for the entire dungeon. Every other room in the game says where you are; the one place you can
 // get permanently lost said nothing. It is the boss's dream, so it is named after the dream.
 const _dn=(typeof GBOSS!=='undefined'&&GBOSS[ring]&&GBOSS[ring].dn)||'The Deep';
 const room={key:'DUN',name:_dn,grid:g,w:W2,h:H2,lv:lv,band:'boss',town:false,big:false,dungeon:true,
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
 // THE BOSS CHAMBER, PERSISTED. It was computed here and thrown away -- only the {t:'B'} spawn
 // tile survived -- so a dungeon boss had no arena bounds, no lock and no tether, and could not be
 // anchored to the middle of its room the way an overworld lair boss can. In world px, matching
 // the shape of R.lairs[b] so bossCentre/bossArenaOf can read either without caring which it is.
 room.bossCh={cx:(bc.cx+0.5)*TILE, cy:(bc.cy+0.5)*TILE,
              rx:bc.r*TILE, ry:(bc.ry||bc.r)*TILE,
              tx:Math.floor(bc.cx), ty:Math.floor(bc.cy)};
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

// THE FOUR STALLS (user, 2026-07-26). Everyone keeps their id -- and so their stall art -- but
// three of the four changed trade, because what they sold either no longer exists or was glory
// buying power, which the economy forbids:
//   bram   BLACKSMITH   THE FORGE (`forge:true`) -- 18_forge.js. The reservation is spent.
//   sella  DIAMONDS     cosmetics and the premium currency (`diamond:true`)
//   maren  AUCTIONEER   the date-seeded house rotation (`auction:true`)
//   odo    BOUNTIES     the daily board (`event:true`)
// The flag on the row is the whole dispatch: usePortalPrompt reads it to pick the panel.
const SHOPNPCS=[
 // He still sells nothing -- glory must never buy power -- but the stall is no longer waiting for
 // something: `forge:true` opens the two-slot anvil (18_forge.js). What it costs is materials you
 // dug out of the world, which is the one currency the economy has no objection to.
 {id:'bram', name:'Bram', role:'BLACKSMITH', title:"BRAM'S FORGE", plabel:'FORGE', awn:'#b5482f', forge:true, x:9.5*TILE,  y:10.8*TILE},
 {id:'sella',name:'Sella',role:'CURIOS',     title:'THE DIAMOND EXCHANGE', awn:'#c46ee0', diamond:true, x:9.5*TILE,  y:18.3*TILE},
 {id:'maren',name:'Maren',role:'AUCTIONEER', title:'THE AUCTION HOUSE', awn:'#e8b34b', auction:true, x:32.5*TILE, y:10.8*TILE},
 {id:'odo',  name:'Odo',  role:'BOUNTIES',   title:'THE BOUNTY BOARD',  awn:'#7dc47a', event:true,   x:32.5*TILE, y:18.3*TILE},
];
function shopNpc(id){ for(const n of SHOPNPCS) if(n.id===id) return n; return null; }
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
// MOVE_SCALE rides here because every enemy speed in makeEnemy is `base * espd` -- contact,
// caster and boss alike -- so one multiplication covers the whole bestiary, and each species'
// own spd multiplier still applies on top of it.
function eSpdMul(lv){ return (1 + Math.min(0.45, lv*0.010))
  * ((typeof MOVE_SCALE!=='undefined')?MOVE_SCALE:1); }
function eMp(lv){ return Math.round(12 + lv*4); }
// ---- THE AGGRESSION RAMP (user, 2026-07-26): "lower damage and fire rate for the lower level
// parts of the game, introducing higher fire rate and damage as the level goes up."
//
// The stat curve (DIFF) already scaled damage steeply with level, but two things did NOT scale at
// all, and they are the two a new player actually feels:
//   * VOLUME. Every shooter fired a 3-shot spread at every level. A Lv1 Tide Spitter put the same
//     wall of bullets in the air as a Lv50 Core Cultist -- only weaker ones. Volume is the axis
//     that decides whether a fight is readable, so it is the one that should open low.
//   * CADENCE. fireT was 1.4/(1+dex*0.010): 1.36s at Lv1 down to 0.92s at Lv50. A 32% span across
//     the entire game, which is no ramp at all.
// Both ramp now, and the flat damage floors come down so the reduction lands on the FIRST hours
// and barely touches Lv50 (see the floors in makeEnemy: a Lv1 shooter loses ~half its hit, a Lv50
// one loses ~1.5%).
function eShotCount(lv){ return lv<12 ? 1 : lv<30 ? 2 : 3; }
// 1.63s at Lv1 -> 0.80s at Lv50, before DEX. DEX's own term is deliberately smaller than it was
// (0.004, was 0.010) so the two do not compound into a Lv50 machine gun. Tuned by measurement, not
// by feel: the first pass (2.05 base, floors of 3/5) left a Lv1 shooter at 11% of its old pressure
// -- 34 volleys to kill a starting hero, which is not 'gentle', it is furniture.
function eFireCd(lv){ return 1.65 - Math.min(0.85, (lv/LV_CAP)*0.85); }
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
// ---- PER-AREA SPECIES (user, 2026-07-26) ----
// Every theme band gets its OWN creatures, not the same two recoloured. A band's pair differs in
// what it is made of (hp / speed / reach / size), in which behaviours it draws from, and in its
// movement signature — so the Bog fights nothing like the Crags even at the same level.
//   w    behaviour weights, drawn deterministically from the spawn position
//   sig  movement-signature overrides merged over EBEH[beh] in enemyAI (07_update)
//   hp/spd/tch/r  multipliers on the level-scaled base
// Each pair is written for the ground it stands on, and the behaviour weights follow from the
// creature rather than the other way round: a crab has no reason to pounce, a wolf has every
// reason, and a thing that lives in a bog cannot dash through it.
// Bands: 0 Landing Sands, 1 Gullwind Shore, 2 Sawgrass Flats, 3 The Verdant Belt, 4 Wolfwood,
// 5 Deep Timber, 6 Stonebrow Rise, 7 Cinderwatch, 8 The Ashfall, 9 The Cairnworks.
// 9 is APPENDED, not inserted: pillar band ids are `er-pillars` save keys, so renumbering would
// relabel every waypoint a player has already attuned. It is a starter-island band that happens
// to sort last, which is why the two places that treat band as an ordered ramp special-case it.
const MOBSPEC=[
 // 0 THE LANDING SANDS (Lv1-8) — open beach. The first thing a new hero meets, so it is slow,
 // legible and forgiving: it scuttles at you in the open with nowhere to hide.
 {c:[{n:'Sand Crawler',  inf:null,                 hp:0.72,spd:0.88,tch:0.75,r:0.90, w:{roamer:40,hunter:34,sentinel:18,pack:8},
      sig:{sway:0.62,swayF:3.4,commit:40,harry:0,lunge:null}},   // sidles; never dashes
     {n:'Shell Skitter',  inf:null,                 hp:0.48,spd:1.14,tch:0.55,r:0.72, w:{pack:52,roamer:30,hunter:18},
      sig:{sway:0.80,swayF:4.2,commit:34,harry:0,lunge:null,flank:112,collapse:150}}],   // many, tiny, harmless alone
  s:[{n:'Tide Spitter',  inf:{id:'chill',dur:2.0},  hp:0.85,spd:0.80,bd:0.80,r:0.95, w:{sentinel:48,skirmisher:26,roamer:26}},
     {n:'Kelp Lobber',    inf:{id:'chill',dur:1.6},  hp:0.95,spd:0.70,bd:0.70,r:1.04, rof:1.30, w:{sentinel:62,roamer:24,skirmisher:14}}],
  d:{c:[{n:'Drowned Deckhand',inf:{id:'chill',dur:2.4},hp:1.05,spd:0.84,tch:0.85,r:0.98, w:{sentinel:44,hunter:30,roamer:16,ambusher:10},
        sig:{sway:0.30,swayF:1.2,harry:0,lunge:null}}],
     s:[{n:'Brine Warden', inf:{id:'chill',dur:2.6},  hp:1.15,spd:0.74,bd:0.90,r:1.02, rof:1.15, w:{sentinel:56,skirmisher:26,roamer:18}}]}},

 // 1 GULLWIND SHORE (Lv8-14) — wind-scoured cliffs and wrecks. Things here come at you from above.
 {c:[{n:'Cliff Skua',    inf:{id:'bleed',dur:3.0},  hp:0.70,spd:1.22,tch:1.20,r:0.88, w:{ambusher:52,roamer:26,hunter:14,pack:8},
      sig:{sway:0.66,swayF:2.9,commit:70,harry:88,
           lunge:{min:130,max:320,mul:3.0,dur:0.34,cd:2.0},breakoff:1.7,rehide:250}},  // stoops, climbs away
     {n:'Gale Hopper',    inf:null,                 hp:0.62,spd:1.34,tch:0.85,r:0.80, w:{roamer:44,hunter:30,pack:16,ambusher:10},
      sig:{sway:0.74,swayF:3.6,commit:56,harry:70,lunge:{min:110,max:270,mul:2.7,dur:0.26,cd:1.8}}}],
  s:[{n:'Wreck Scavenger',inf:{id:'bleed',dur:3.0}, hp:0.95,spd:1.05,bd:0.90,r:0.98, w:{skirmisher:52,roamer:24,sentinel:14,hunter:10}},
     {n:'Gull Piper',     inf:{id:'weak',dur:3.0},   hp:0.88,spd:1.12,bd:0.85,r:0.92, rof:0.88, w:{skirmisher:60,roamer:24,hunter:16}}],
  d:{c:[{n:'Lamp-Drowned',inf:{id:'chill',dur:3.0},  hp:1.20,spd:0.96,tch:1.05,r:1.05, w:{ambusher:48,sentinel:28,hunter:24},
        sig:{sway:0.36,swayF:1.4,breakoff:1.8,rehide:260,harry:0}}],
     s:[{n:'Beacon Keeper',inf:{id:'shock',dur:2.2}, hp:1.10,spd:0.92,bd:1.00,r:1.00, rof:1.10, w:{sentinel:52,skirmisher:30,roamer:18}}]}},

 // 2 SAWGRASS FLATS (Lv14-20) — waist-deep marsh grass. Everything here is slow and hard to see.
 {c:[{n:'Reed Lurcher',  inf:{id:'poison',dur:4.0}, hp:1.45,spd:0.74,tch:1.25,r:1.12, w:{ambusher:44,sentinel:30,hunter:20,roamer:6},
      sig:{sway:0.22,swayF:0.9,harry:0,lunge:null,breakoff:1.6,rehide:250}},   // wades; cannot dash
     {n:'Marsh Tick',     inf:{id:'poison',dur:5.0}, hp:0.55,spd:1.16,tch:0.70,r:0.70, w:{pack:56,ambusher:24,roamer:12,hunter:8},
      sig:{sway:0.70,swayF:3.8,commit:40,harry:54,flank:120,collapse:160,lunge:{min:80,max:190,mul:2.4,dur:0.22,cd:1.6}}}],
  s:[{n:'Sawgrass Spitter',inf:{id:'poison',dur:4.5},hp:1.10,spd:0.78,bd:1.10,r:1.02, w:{sentinel:46,skirmisher:28,roamer:26}},
     {n:'Bog Piper',      inf:{id:'chill',dur:3.0},  hp:1.22,spd:0.68,bd:1.00,r:1.08, rof:1.25, w:{sentinel:58,roamer:24,skirmisher:18}}],
  d:{c:[{n:'Chapel Husk', inf:{id:'weak',dur:4.5},   hp:1.55,spd:0.70,tch:1.30,r:1.14, w:{sentinel:52,ambusher:26,hunter:22},
        sig:{sway:0.14,swayF:0.8,harry:0,lunge:null,pace:80}}],
     s:[{n:'Marrow Cantor',inf:{id:'curse',dur:4.0}, hp:1.18,spd:0.74,bd:1.15,r:1.04, rof:1.05, w:{sentinel:48,skirmisher:32,roamer:20}}]}},

 // 3 THE VERDANT BELT (Lv20-26) — the first true forest, and the Grovewarden's province. Cultists
 // begin here because this is where the corruption has taken root.
 {c:[{n:'Briar Hound',   inf:{id:'bleed',dur:3.0},  hp:0.88,spd:1.10,tch:0.95,r:0.95, w:{pack:48,hunter:24,roamer:16,ambusher:12},
      sig:{sway:0.58,swayF:2.4,harry:72,lunge:{min:100,max:250,mul:2.5,dur:0.32,cd:2.2}}},
     {n:'Thornback Boar', inf:{id:'bleed',dur:3.5},  hp:1.35,spd:0.98,tch:1.30,r:1.10, w:{hunter:56,roamer:22,sentinel:14,pack:8},
      sig:{sway:0.20,swayF:1.0,commit:170,harry:0,lunge:{min:150,max:380,mul:3.4,dur:0.46,cd:2.8}}}],   // one long charge
  s:[{n:'Grove Cultist', inf:{id:'weak',dur:4.0},   hp:1.00,spd:1.00,bd:1.00,r:1.00, w:{skirmisher:40,sentinel:24,roamer:20,hunter:16}},
     {n:'Bramble Weaver', inf:{id:'poison',dur:4.0}, hp:0.92,spd:0.94,bd:0.95,r:0.96, rof:0.85, w:{skirmisher:48,roamer:26,sentinel:26}}],
  d:{c:[{n:'Heartwood Thrall',inf:{id:'bleed',dur:4.0},hp:1.25,spd:1.02,tch:1.10,r:1.04, w:{pack:44,hunter:32,ambusher:14,roamer:10},
        sig:{sway:0.52,swayF:2.2,harry:70,lunge:{min:100,max:250,mul:2.6,dur:0.30,cd:2.0}}}],
     s:[{n:'Root Speaker', inf:{id:'weak',dur:5.0},   hp:1.20,spd:0.90,bd:1.10,r:1.02, rof:1.10, w:{sentinel:50,skirmisher:30,roamer:20}}]}},

 // 4 WOLFWOOD (Lv26-32) — it is named for what hunts there. The definitive pack: they surround
 // first and commit together.
 {c:[{n:'Dire Wolf',     inf:{id:'bleed',dur:4.0},  hp:0.95,spd:1.18,tch:1.10,r:1.02, w:{pack:70,hunter:18,ambusher:8,roamer:4},
      sig:{sway:0.44,swayF:2.6,commit:90,harry:78,flank:168,collapse:230,
           lunge:{min:105,max:280,mul:2.9,dur:0.32,cd:1.9}}},
     {n:'Wolfwood Stalker',inf:{id:'bleed',dur:4.5}, hp:1.10,spd:1.06,tch:1.25,r:1.06, w:{ambusher:64,hunter:20,pack:12,roamer:4},
      sig:{sway:0.30,swayF:1.8,commit:120,harry:0,breakoff:2.0,rehide:290,lunge:null}}],   // waits, then one hit
  s:[{n:'Wolfwood Seer', inf:{id:'curse',dur:5.0},  hp:1.05,spd:0.98,bd:1.10,r:1.00, w:{sentinel:40,skirmisher:32,roamer:16,hunter:12}},
     {n:'Barkhide Shaman',inf:{id:'chill',dur:3.5},  hp:1.28,spd:0.86,bd:1.20,r:1.08, rof:1.20, w:{sentinel:56,skirmisher:24,roamer:20}}],
  d:{c:[{n:'Fogbound Hound',inf:{id:'weak',dur:4.0}, hp:0.92,spd:1.24,tch:1.05,r:0.98, w:{pack:66,ambusher:20,hunter:14},
        sig:{sway:0.50,swayF:3.0,harry:84,flank:150,collapse:200,lunge:{min:110,max:300,mul:3.0,dur:0.30,cd:1.7}}}],
     s:[{n:'Antler Oracle',inf:{id:'curse',dur:5.5}, hp:1.14,spd:0.96,bd:1.15,r:1.00, rof:0.90, w:{skirmisher:46,sentinel:34,roamer:20}}]}},

 // 5 DEEP TIMBER (Lv32-39) — old growth gone to rot, the Bog Horror's ground. Nothing charges you
 // here; it waits in the standing water until you are past it.
 {c:[{n:'Timber Lurker', inf:{id:'poison',dur:5.0}, hp:1.30,spd:0.92,tch:1.35,r:1.05, w:{ambusher:62,sentinel:20,hunter:12,pack:6},
      sig:{sway:0.68,swayF:1.6,commit:150,breakoff:2.1,rehide:280,harry:0}},
     {n:'Rotfly Swarm',   inf:{id:'poison',dur:6.0}, hp:0.50,spd:1.30,tch:0.65,r:0.74, w:{pack:60,roamer:24,hunter:16},
      sig:{sway:0.90,swayF:4.6,commit:30,harry:48,flank:104,collapse:140,lunge:null}}],   // clouds, not chargers
  s:[{n:'Mire Cultist',  inf:{id:'poison',dur:5.5}, hp:1.15,spd:0.86,bd:1.15,r:1.02, w:{sentinel:44,skirmisher:28,roamer:18,hunter:10}},
     {n:'Fen Whisperer',  inf:{id:'curse',dur:5.0},  hp:1.34,spd:0.72,bd:1.25,r:1.10, rof:1.22, w:{sentinel:60,skirmisher:22,roamer:18}}],
  d:{c:[{n:'Sunken Warden',inf:{id:'poison',dur:6.0},hp:1.70,spd:0.78,tch:1.40,r:1.18, w:{sentinel:56,ambusher:28,hunter:16},
        sig:{sway:0.16,swayF:0.9,harry:0,lunge:null,pace:74,leash:400}}],
     s:[{n:'Drowned Chorus',inf:{id:'poison',dur:6.5},hp:1.22,spd:0.80,bd:1.22,r:1.04, rof:0.92, w:{skirmisher:44,sentinel:36,roamer:20}}]}},

 // 6 STONEBROW RISE (Lv39-45) — bare rock and Stonefist's terraces. Guards, not hunters: they hold
 // a line and make you come through it.
 {c:[{n:'Stone Warden',  inf:{id:'stun',dur:0.7},   hp:1.85,spd:0.80,tch:1.30,r:1.16, w:{sentinel:60,hunter:26,ambusher:8,roamer:6},
      sig:{sway:0.12,swayF:0.8,harry:0,lunge:null,pace:96,leash:430}},
     {n:'Scarp Crawler',  inf:{id:'bleed',dur:4.0},  hp:1.05,spd:1.04,tch:1.05,r:0.96, w:{roamer:42,ambusher:28,hunter:20,pack:10},
      sig:{sway:0.58,swayF:2.6,commit:80,harry:80,lunge:{min:100,max:240,mul:2.6,dur:0.28,cd:2.1}}}],
  s:[{n:'Scree Slinger', inf:{id:'stun',dur:0.6},   hp:1.25,spd:0.76,bd:1.30,r:1.05, w:{sentinel:56,skirmisher:20,hunter:16,roamer:8}},
     {n:'Quarry Sling',   inf:{id:'stun',dur:0.8},   hp:1.45,spd:0.66,bd:1.45,r:1.14, rof:1.35, w:{sentinel:68,roamer:18,skirmisher:14}}],
  d:{c:[{n:'Vault Sentinel',inf:{id:'stun',dur:0.9}, hp:2.05,spd:0.72,tch:1.45,r:1.22, w:{sentinel:70,hunter:22,ambusher:8},
        sig:{sway:0.10,swayF:0.7,harry:0,lunge:null,pace:88,leash:460}}],
     s:[{n:'Shatterstone Adept',inf:{id:'shock',dur:2.4},hp:1.30,spd:0.80,bd:1.30,r:1.06, rof:0.88, w:{skirmisher:46,sentinel:36,hunter:18}}]}},

 // 7 CINDERWATCH (Lv45-50) — the volcanic shelf the Crag Gargoyle roosts on. Everything here leaps.
 {c:[{n:'Crag Leaper',   inf:{id:'burn',dur:3.5},   hp:0.80,spd:1.12,tch:1.20,r:0.94, w:{hunter:38,ambusher:26,pack:22,roamer:14},
      sig:{sway:0.50,swayF:2.8,commit:90,harry:96,
           lunge:{min:120,max:340,mul:3.3,dur:0.40,cd:1.7}}},    // the longest dash in the world
     {n:'Magma Hound',    inf:{id:'burn',dur:4.5},   hp:1.00,spd:1.16,tch:1.15,r:1.00, w:{pack:62,hunter:22,ambusher:10,roamer:6},
      sig:{sway:0.46,swayF:2.9,commit:86,harry:84,flank:158,collapse:214,
           lunge:{min:110,max:300,mul:3.1,dur:0.34,cd:1.8}}}],
  s:[{n:'Ember Cultist', inf:{id:'burn',dur:4.0},   hp:1.05,spd:1.08,bd:1.05,r:0.98, w:{skirmisher:58,hunter:18,roamer:14,sentinel:10}},
     {n:'Ashvent Shaman', inf:{id:'burn',dur:5.0},   hp:1.30,spd:0.90,bd:1.30,r:1.08, rof:1.18, w:{sentinel:52,skirmisher:30,roamer:18}}],
  d:{c:[{n:'Keep Cinderguard',inf:{id:'burn',dur:5.0},hp:1.75,spd:0.94,tch:1.35,r:1.14, w:{sentinel:48,hunter:34,pack:12,ambusher:6},
        sig:{sway:0.22,swayF:1.2,commit:70,harry:0,lunge:{min:110,max:230,mul:2.2,dur:0.36,cd:2.6}}}],
     s:[{n:'Pyre Chanter', inf:{id:'burn',dur:5.5},   hp:1.24,spd:1.02,bd:1.25,r:1.02, rof:0.86, w:{skirmisher:60,hunter:20,sentinel:20}}]}},

 // 8 THE ASHFALL and the grind ring beyond it (Lv50) — burnt ground at the rift's edge. These do
 // not circle, do not break off and do not stop coming.
 {c:[{n:'Ash Revenant',  inf:{id:'burn',dur:4.5},   hp:1.70,spd:0.90,tch:1.35,r:1.10, w:{hunter:58,sentinel:22,pack:12,roamer:8},
      sig:{sway:0.24,swayF:1.1,commit:60,harry:0,
           lunge:{min:110,max:220,mul:1.9,dur:0.40,cd:3.2}}},
     {n:'Cinder Husk',    inf:{id:'burn',dur:5.0},   hp:2.10,spd:0.78,tch:1.50,r:1.22, w:{hunter:52,sentinel:30,ambusher:12,roamer:6},
      sig:{sway:0.12,swayF:0.8,commit:50,harry:0,lunge:null}}],   // never stops, never swerves
  s:[{n:'Core Cultist',  inf:{id:'burn',dur:5.0},   hp:1.30,spd:0.88,bd:1.40,r:1.06, w:{sentinel:44,skirmisher:30,hunter:16,roamer:10}},
     {n:'Rift Chanter',   inf:{id:'curse',dur:6.0},  hp:1.20,spd:0.94,bd:1.30,r:1.02, rof:0.82, w:{skirmisher:52,sentinel:28,hunter:20}}],
  d:{c:[{n:'Sanctum Devout',inf:{id:'burn',dur:5.5}, hp:1.60,spd:1.00,tch:1.30,r:1.08, w:{hunter:44,pack:30,ambusher:16,sentinel:10},
        sig:{sway:0.38,swayF:2.0,commit:80,harry:76,lunge:{min:105,max:260,mul:2.8,dur:0.32,cd:1.9}}}],
     s:[{n:'Molten Herald',inf:{id:'burn',dur:6.0},  hp:1.40,spd:0.90,bd:1.45,r:1.08, rof:0.80, w:{skirmisher:48,sentinel:32,hunter:20}}]}},

 // 9 THE CAIRNWORKS (Lv11-15) -- the worked-out quarry rise, third of the four starter provinces.
 // APPENDED, so it sorts after the Lv50 rim while sitting between bands 1 and 2 on the ground.
 // Before it existed this zone borrowed band 6, which meant a Lv12 player was fighting things named
 // out of the Lv39-45 Stonebrow roster -- Vault Sentinels and Shatterstone Adepts on a starter
 // beach. Slower and heavier than the shore either side of it, but nothing here is fast: it is
 // stone, and the lesson it teaches is that some things you have to walk around.
 {c:[{n:'Grit Crawler',   inf:null,                 hp:0.96,spd:0.84,tch:0.92,r:0.98, w:{roamer:42,sentinel:32,hunter:26},
      sig:{sway:0.44,swayF:2.4,commit:46,harry:0,lunge:null}},
     {n:'Spall Skitter',  inf:null,                 hp:0.62,spd:1.12,tch:0.70,r:0.78, w:{pack:54,roamer:28,hunter:18},
      sig:{sway:0.76,swayF:4.0,commit:34,harry:0,lunge:null,flank:110,collapse:146}},
     {n:'Yard Lurcher',   inf:{id:'weak',dur:3.4},  hp:1.24,spd:0.72,tch:1.06,r:1.06, w:{sentinel:60,ambusher:24,roamer:16},
      sig:{sway:0.16,swayF:0.9,harry:0,lunge:null,pace:62,leash:300}}],
  s:[{n:'Shard Spitter',  inf:{id:'bleed',dur:2.8}, hp:0.92,spd:0.88,bd:0.92,r:0.96, w:{skirmisher:52,sentinel:30,roamer:18}},
     {n:'Wedge Lobber',   inf:{id:'stun',dur:0.6},  hp:1.06,spd:0.74,bd:1.00,r:1.04, rof:1.26, w:{sentinel:62,roamer:24,skirmisher:14}}],
  d:{c:[{n:'Cairn Shade', inf:{id:'chill',dur:3.0}, hp:1.18,spd:0.90,tch:1.00,r:1.00, w:{ambusher:48,sentinel:30,roamer:22},
        sig:{sway:0.26,swayF:1.2,harry:0,lunge:null,breakoff:1.8,rehide:250}}],
     s:[{n:'Dust Warden', inf:{id:'weak',dur:3.6},  hp:1.22,spd:0.78,bd:1.04,r:1.04, rof:1.10, w:{sentinel:58,skirmisher:26,roamer:16}}]}},
];
// A band's pool is a LIST now, not a single creature per type (user: "we need more open world and
// dungeon enemies"). Inside a dungeon the band's `d` entries are appended, so a dream holds things
// that never walk the overworld above it. Which one a spawn point gets is hashed from the point
// itself -- the same rule pickBehaviour uses, with different multipliers so species and behaviour
// stay uncorrelated (or every Dire Wolf in the world would also be the pack one).
// A DUNGEON HAS ITS OWN CREATURES (user, 2026-07-27: "the dungeon mobs need to be separate but
// similar to the overworld mobs for each area"). This used to CONCATENATE -- a dungeon's pool was
// the overworld list plus a few extras -- so most of what you met inside a boss's nightmare was
// the same animal you had just walked past outside it. A nightmare is not the same place with more
// things in it. It is the same place with the things in it WRONG.
//
// The `d` list is now the WHOLE dungeon pool for that band. It is written to rhyme with the
// overworld roster above it, creature for creature, so the ground still reads as the same country
// -- the Sawgrass has its lurchers and pipers in both, they are simply not the same lurchers.
// Falls back to the overworld list if a band has no `d` entries, so a half-filled table degrades
// to the old behaviour rather than to an empty dungeon.
function mobPool(band,t,dun,ring){
  const key=(t==='s')?'s':'c';
  // A DUNGEON'S ROSTER IS ITS OWN. Keyed to the boss's RING, which is the dungeon's identity --
  // not to the terrain band its index happens to land on, which is how a lighthouse crag ended up
  // spawning Wolfwood wolves. Falls back to the band's `d` list, then to the overworld, so a ring
  // without an entry degrades instead of emptying the place.
  if(dun){
    let rg = (ring!==undefined) ? ring
           : (typeof curRoom!=='undefined' && curRoom && typeof curRoom.ring==='number') ? curRoom.ring : -1;
    if(rg>=0 && typeof DUNSPEC!=='undefined' && DUNSPEC[rg]){
      const dl=DUNSPEC[rg][key];
      if(dl && dl.length) return dl;
    }
  }
  const S=MOBSPEC[Math.max(0,Math.min(MOBSPEC.length-1,band|0))]; if(!S) return [];
  if(dun&&S.d){ let ex=S.d[key];
    if(ex){ if(!Array.isArray(ex)) ex=[ex]; if(ex.length) return ex; } }
  let list=S[key]; if(!list) return [];
  if(!Array.isArray(list)) list=[list];
  return list;
}
function mobSpec(band,t,sp,dun){
  // an explicit request wins over the hash -- used by the dev workbench to spawn a named creature
  // (including a dungeon-only one) anywhere, which the position hash by design cannot do
  if(sp && sp.spec){ const all=mobPool(band,t,true).concat(mobPool(band,t,false));
    const hit=all.find(m=>m&&m.n===sp.spec); if(hit) return hit; }
  const list=mobPool(band,t,dun); if(!list.length) return null;
  if(list.length===1||!sp) return list[0];
  const h=(Math.imul(sp.x|0,2246822519)+Math.imul(sp.y|0,3266489917))>>>0;
  return list[((h^(h>>>15))>>>0)%list.length];
}
// deterministic per-spawn so a given spot keeps its character across respawns (a guarded
// chokepoint stays guarded). Weights come from the SPECIES, so which behaviours an area even
// contains is part of what makes that area itself.
function pickBehaviour(sp,lv,type,band,dun){
  const h=(Math.imul(sp.x|0,374761393)+Math.imul(sp.y|0,668265263))>>>0;
  const roll=(h^(h>>>13))%100;
  // must resolve the SAME creature makeEnemy did, or a wolf would inherit a crab's weights
  const S=mobSpec(band===undefined?5:band,type,sp,dun);
  if(S&&S.w){ let acc=0, tot=0;
    for(const k in S.w) tot+=S.w[k];
    const r=(roll/100)*tot;
    for(const k in S.w){ acc+=S.w[k]; if(r<acc) return k; }
  }
  // fallback: the pre-species roll, kept so a caller with no band still gets sane variety
  const b=Math.max(0,Math.min(8,Math.round(lv/5.5)));
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
  // The FLAT terms are the low-level difficulty dial: at Lv1 dm is only ~3, so a floor of 12 was
  // 80% of what a starting hero actually took, while at Lv50 dm is ~502 and the floor is noise.
  // Dropping the floors cuts a Lv1 hit roughly in half and a Lv50 hit by ~1.5% -- exactly where
  // the user asked the reduction to land. Bosses keep their old floors: they are the spike.
  if(sp.t==='c') e={type:'c',r:15,hp:40*hpm,spd:95*espd,touch:7+dm,col:'#c04a3d'};
  else if(sp.t==='s') e={type:'s',r:16,hp:60*hpm,spd:46*espd,fireT:1,bd:5+dm*0.63,col:'#8a5ac0'};
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
    // WHICH creature this is comes from the ground it spawned on. In a dungeon there is no
    // overworld band under the tile, so the boss's art slot stands in — the dream wears the theme
    // of the homeland it remembers, which is the same rule the tileset and mob names already use.
    let _bd = (typeof grvBandXY==='function' && curRoom && curRoom.rings) ? grvBandXY(sp.x,sp.y)
            : (curRoom && typeof curRoom.band==='number') ? curRoom.band
            : (curRoom && typeof curRoom.ring==='number' && typeof bossArt==='function') ? bossArt(curRoom.ring)
            : 5;
    if(!(_bd>=0)) _bd=5;
    e.band=Math.max(0,Math.min(MOBSPEC.length-1,_bd));
    const _dun=!!(curRoom&&curRoom.dungeon);
    const S=mobSpec(e.band,e.type,sp,_dun);
    if(S){
      e.spn=S.n; e.sig=S.sig||null; e.inf=S.inf||null;   // what it leaves on you when it connects
      if(S.hp) e.hp*=S.hp;
      if(S.spd) e.spd*=S.spd;
      if(S.tch&&e.touch) e.touch*=S.tch;
      if(S.bd&&e.bd) e.bd*=S.bd;
      if(S.r) e.r=Math.round(e.r*S.r);
      if(S.rof) e.rof=S.rof;                             // species cadence, on top of the level ramp
    }
    e.beh=pickBehaviour(sp,lv,e.type,e.band,_dun); const B=EBEH[e.beh]||EBEH.hunter;
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
    // ELITE last, so it multiplies the finished creature -- species, behaviour and corruption all
    // already applied. A corrupted elite is therefore both, which is exactly what it should be.
    // stamp the archetype BEFORE the elite renames the species, or "Fen-Swollen Marsh Tick"
    // misses the lookup and an elite silently reverts to the generic hound
    e.arch=(e.spn&&MOB_ARCH[e.spn])||(e.type==='s'?'caster':'beast');
    if(!e.node && !e.summoned && eliteRoll(sp)) makeElite(e,sp);
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
// ---- THE SECOND WAVE (user, 2026-07-27: "we need a lot more mobs") ----
// Appended rather than woven into MOBSPEC above, so the original pairs stay readable as the thing
// that defines each band and this reads as what it is: more of the same ground, not a rewrite.
// Every band gains two more overworld chasers, one more shooter, and one more of each inside its
// dungeon -- 45 creatures, taking the roster from 54 to 99. The rules do not change: which one a
// spawn point gets is still hashed from the point, so a spot keeps its character across respawns.
const MOBSPEC_MORE=[
 // 0 THE LANDING SANDS
 {c:[{n:'Driftwood Snapper',inf:{id:'bleed',dur:2.5}, hp:0.66,spd:0.94,tch:0.80,r:0.86, w:{ambusher:46,roamer:30,hunter:24},
      sig:{sway:0.30,swayF:1.4,harry:0,lunge:null,breakoff:1.5,rehide:220}},
     {n:'Sandfly Cloud',   inf:null,                  hp:0.40,spd:1.26,tch:0.50,r:0.64, w:{pack:64,roamer:24,hunter:12},
      sig:{sway:0.94,swayF:4.8,commit:26,harry:44,flank:100,collapse:132,lunge:null}}],
  s:[{n:'Barnacle Popper', inf:null,                  hp:1.02,spd:0.66,bd:0.75,r:1.06, rof:1.45, w:{sentinel:70,roamer:20,skirmisher:10}}],
  d:{c:[{n:'Salt-Caked Hand',inf:{id:'chill',dur:2.8},hp:1.12,spd:0.80,tch:0.90,r:1.00, w:{ambusher:54,sentinel:30,hunter:16},
        sig:{sway:0.24,swayF:1.0,harry:0,lunge:null,breakoff:1.7,rehide:240}}],
     s:[{n:'Tidewrack Acolyte',inf:{id:'chill',dur:3.0},hp:1.08,spd:0.82,bd:0.95,r:1.00, rof:1.05, w:{sentinel:50,skirmisher:32,roamer:18}}]}},

 // 1 GULLWIND SHORE
 {c:[{n:'Rope-Rot Mariner',inf:{id:'poison',dur:3.5}, hp:1.10,spd:0.88,tch:1.00,r:1.02, w:{sentinel:46,hunter:30,roamer:24},
      sig:{sway:0.26,swayF:1.1,harry:0,lunge:null,pace:76}},
     {n:'Spindrift Wisp',  inf:{id:'chill',dur:2.4},  hp:0.52,spd:1.42,tch:0.70,r:0.74, w:{skirmisher:40,roamer:36,pack:24},
      sig:{sway:0.88,swayF:4.0,commit:44,harry:96,lunge:null}}],
  s:[{n:'Signal Screamer', inf:{id:'stun',dur:0.6},   hp:0.92,spd:1.16,bd:0.88,r:0.94, rof:0.78, w:{skirmisher:64,roamer:22,hunter:14}}],
  d:{c:[{n:'Lens Grinder', inf:{id:'shock',dur:2.0},  hp:1.32,spd:0.90,tch:1.10,r:1.08, w:{sentinel:56,hunter:28,ambusher:16},
        sig:{sway:0.20,swayF:1.0,harry:0,lunge:null,pace:84,leash:400}}],
     s:[{n:'Fogbell Ringer',inf:{id:'weak',dur:3.5},  hp:1.16,spd:0.86,bd:1.05,r:1.02, rof:1.20, w:{sentinel:58,skirmisher:26,roamer:16}}]}},

 // 2 SAWGRASS FLATS
 {c:[{n:'Quagmire Crawler',inf:{id:'poison',dur:4.5}, hp:1.60,spd:0.62,tch:1.35,r:1.18, w:{sentinel:54,ambusher:30,hunter:16},
      sig:{sway:0.12,swayF:0.7,harry:0,lunge:null,pace:66,leash:380}},
     {n:'Sedge Darter',    inf:{id:'bleed',dur:3.0},  hp:0.62,spd:1.28,tch:0.85,r:0.78, w:{skirmisher:44,pack:32,roamer:24},
      sig:{sway:0.82,swayF:4.0,commit:38,harry:62,flank:118,collapse:156,lunge:{min:80,max:200,mul:2.5,dur:0.24,cd:1.5}}}],
  s:[{n:'Rushlight Caller',inf:{id:'curse',dur:3.5},  hp:1.06,spd:0.84,bd:1.05,r:1.00, rof:0.90, w:{skirmisher:52,sentinel:30,roamer:18}}],
  d:{c:[{n:'Pallbearer Husk',inf:{id:'weak',dur:5.0}, hp:1.72,spd:0.64,tch:1.40,r:1.20, w:{sentinel:62,ambusher:24,hunter:14},
        sig:{sway:0.10,swayF:0.6,harry:0,lunge:null,pace:70,leash:420}}],
     s:[{n:'Censer Bearer',inf:{id:'poison',dur:5.0}, hp:1.24,spd:0.78,bd:1.18,r:1.06, rof:1.10, w:{sentinel:54,skirmisher:28,roamer:18}}]}},

 // 3 THE VERDANT BELT
 {c:[{n:'Sap-Drunk Elk',  inf:{id:'stun',dur:0.7},    hp:1.50,spd:1.02,tch:1.35,r:1.14, w:{hunter:60,roamer:24,sentinel:16},
      sig:{sway:0.18,swayF:0.9,commit:180,harry:0,lunge:{min:160,max:400,mul:3.6,dur:0.48,cd:3.0}}},
     {n:'Creeper Vine',    inf:{id:'poison',dur:4.0}, hp:1.20,spd:0.58,tch:1.15,r:1.06, w:{sentinel:66,ambusher:26,roamer:8},
      sig:{sway:0.08,swayF:0.5,harry:0,lunge:null,pace:52,leash:300}}],
  s:[{n:'Spore Puffer',   inf:{id:'poison',dur:5.0},  hp:1.14,spd:0.76,bd:1.05,r:1.06, rof:1.30, w:{sentinel:60,roamer:24,skirmisher:16}}],
  d:{c:[{n:'Grafted Warden',inf:{id:'bleed',dur:4.5}, hp:1.55,spd:0.92,tch:1.25,r:1.12, w:{sentinel:50,hunter:32,ambusher:18},
        sig:{sway:0.16,swayF:0.9,harry:0,lunge:{min:120,max:260,mul:2.4,dur:0.38,cd:2.6}}}],
     s:[{n:'Seedcaster',   inf:{id:'poison',dur:5.5}, hp:1.10,spd:0.98,bd:1.05,r:0.98, rof:0.82, w:{skirmisher:56,roamer:26,sentinel:18}}]}},

 // 4 WOLFWOOD
 {c:[{n:'Yearling Wolf',  inf:{id:'bleed',dur:3.0},   hp:0.62,spd:1.30,tch:0.85,r:0.86, w:{pack:74,roamer:16,hunter:10},
      sig:{sway:0.56,swayF:3.2,commit:70,harry:66,flank:140,collapse:190,lunge:{min:90,max:230,mul:2.7,dur:0.26,cd:1.6}}},
     {n:'Bonepile Scavenger',inf:{id:'poison',dur:4.0},hp:1.42,spd:0.84,tch:1.20,r:1.12, w:{sentinel:48,ambusher:30,hunter:22},
      sig:{sway:0.24,swayF:1.2,harry:0,lunge:null,pace:74}}],
  s:[{n:'Howl-Keeper',    inf:{id:'weak',dur:4.5},    hp:1.18,spd:0.92,bd:1.12,r:1.04, rof:1.15, w:{sentinel:52,skirmisher:30,roamer:18}}],
  d:{c:[{n:'Mist-Blind Pup',inf:{id:'chill',dur:3.0}, hp:0.70,spd:1.36,tch:0.90,r:0.88, w:{pack:70,ambusher:18,roamer:12},
        sig:{sway:0.62,swayF:3.4,harry:78,flank:136,collapse:184,lunge:{min:95,max:250,mul:2.9,dur:0.26,cd:1.5}}}],
     s:[{n:'Cairn Whistler',inf:{id:'curse',dur:5.0}, hp:1.22,spd:0.90,bd:1.18,r:1.02, rof:1.12, w:{sentinel:50,skirmisher:32,roamer:18}}]}},

 // 5 DEEP TIMBER
 {c:[{n:'Bloated Drifter',inf:{id:'poison',dur:6.0},  hp:1.95,spd:0.60,tch:1.45,r:1.26, w:{sentinel:58,ambusher:28,hunter:14},
      sig:{sway:0.10,swayF:0.6,harry:0,lunge:null,pace:60,leash:360}},
     {n:'Leechling',       inf:{id:'bleed',dur:5.0},  hp:0.46,spd:1.22,tch:0.70,r:0.68, w:{pack:62,ambusher:24,roamer:14},
      sig:{sway:0.86,swayF:4.4,commit:32,harry:50,flank:106,collapse:142,lunge:null}}],
  s:[{n:'Peat Spitter',   inf:{id:'poison',dur:5.5},  hp:1.28,spd:0.70,bd:1.20,r:1.08, rof:1.28, w:{sentinel:64,roamer:20,skirmisher:16}}],
  d:{c:[{n:'Silt Revenant',inf:{id:'chill',dur:5.0},  hp:1.80,spd:0.82,tch:1.35,r:1.16, w:{sentinel:50,hunter:30,ambusher:20},
        sig:{sway:0.18,swayF:1.0,harry:0,lunge:null,pace:70,leash:400}}],
     s:[{n:'Reedpipe Mourner',inf:{id:'curse',dur:6.0},hp:1.26,spd:0.76,bd:1.24,r:1.06, rof:0.94, w:{skirmisher:46,sentinel:36,roamer:18}}]}},

 // 6 STONEBROW RISE
 {c:[{n:'Rubble Hulk',    inf:{id:'stun',dur:0.9},    hp:2.30,spd:0.66,tch:1.55,r:1.30, w:{sentinel:64,hunter:26,ambusher:10},
      sig:{sway:0.08,swayF:0.6,harry:0,lunge:null,pace:88,leash:440}},
     {n:'Chip Skitter',    inf:{id:'bleed',dur:3.0},  hp:0.58,spd:1.32,tch:0.80,r:0.74, w:{pack:58,roamer:26,skirmisher:16},
      sig:{sway:0.80,swayF:4.2,commit:36,harry:58,flank:114,collapse:150,lunge:{min:80,max:200,mul:2.6,dur:0.22,cd:1.5}}}],
  s:[{n:'Ridge Whistler', inf:{id:'weak',dur:4.0},    hp:1.12,spd:1.04,bd:1.15,r:1.00, rof:0.80, w:{skirmisher:62,roamer:22,hunter:16}}],
  d:{c:[{n:'Gate Breaker', inf:{id:'stun',dur:1.1},   hp:2.45,spd:0.74,tch:1.60,r:1.32, w:{sentinel:56,hunter:34,ambusher:10},
        sig:{sway:0.10,swayF:0.7,commit:160,harry:0,lunge:{min:150,max:330,mul:2.8,dur:0.46,cd:3.0}}}],
     s:[{n:'Fault Chanter',inf:{id:'shock',dur:2.8},  hp:1.34,spd:0.82,bd:1.34,r:1.08, rof:1.00, w:{sentinel:52,skirmisher:32,roamer:16}}]}},

 // 7 CINDERWATCH
 {c:[{n:'Slagback Brute', inf:{id:'burn',dur:5.0},    hp:2.05,spd:0.82,tch:1.50,r:1.24, w:{sentinel:50,hunter:36,ambusher:14},
      sig:{sway:0.14,swayF:0.8,commit:120,harry:0,lunge:{min:120,max:280,mul:2.4,dur:0.42,cd:2.8}}},
     {n:'Emberfly Swarm',  inf:{id:'burn',dur:3.0},   hp:0.44,spd:1.40,tch:0.65,r:0.66, w:{pack:66,roamer:22,skirmisher:12},
      sig:{sway:0.96,swayF:5.0,commit:24,harry:42,flank:98,collapse:130,lunge:null}}],
  s:[{n:'Vent Howler',    inf:{id:'burn',dur:4.5},    hp:1.16,spd:1.10,bd:1.12,r:1.00, rof:0.76, w:{skirmisher:66,hunter:20,roamer:14}}],
  d:{c:[{n:'Forge Thrall', inf:{id:'burn',dur:5.5},   hp:1.90,spd:0.88,tch:1.40,r:1.18, w:{sentinel:46,hunter:38,pack:16},
        sig:{sway:0.20,swayF:1.1,commit:90,harry:0,lunge:{min:110,max:250,mul:2.5,dur:0.38,cd:2.4}}}],
     s:[{n:'Bellows Adept',inf:{id:'burn',dur:6.0},   hp:1.30,spd:0.96,bd:1.32,r:1.04, rof:0.88, w:{skirmisher:54,sentinel:28,hunter:18}}]}},

 // 8 THE ASHFALL
 {c:[{n:'Clinker Colossus',inf:{id:'burn',dur:6.0},   hp:2.60,spd:0.70,tch:1.70,r:1.36, w:{sentinel:54,hunter:38,ambusher:8},
      sig:{sway:0.08,swayF:0.6,commit:40,harry:0,lunge:null,pace:80,leash:460}},
     {n:'Ashborn Wretch',  inf:{id:'curse',dur:5.0},  hp:0.86,spd:1.28,tch:1.00,r:0.92, w:{pack:56,hunter:26,roamer:18},
      sig:{sway:0.52,swayF:3.0,commit:70,harry:80,flank:150,collapse:200,lunge:{min:100,max:270,mul:3.0,dur:0.28,cd:1.6}}}],
  s:[{n:'Cinderwind Adept',inf:{id:'burn',dur:5.5},   hp:1.24,spd:1.02,bd:1.35,r:1.02, rof:0.78, w:{skirmisher:58,sentinel:24,hunter:18}}],
  d:{c:[{n:'Sanctum Colossus',inf:{id:'burn',dur:6.5},hp:2.75,spd:0.78,tch:1.75,r:1.38, w:{sentinel:50,hunter:40,ambusher:10},
        sig:{sway:0.08,swayF:0.6,commit:120,harry:0,lunge:{min:140,max:320,mul:2.6,dur:0.48,cd:3.2}}}],
     s:[{n:'Rift Cantor',  inf:{id:'curse',dur:7.0},  hp:1.34,spd:0.92,bd:1.48,r:1.04, rof:0.76, w:{skirmisher:50,sentinel:32,hunter:18}}]}},
 // 9 THE CAIRNWORKS (Lv11-15) -- the quarry rise. Added when band 9 was created; without a row
 // here the merge loop's `if(!A||!B) continue` skipped it in silence and the zone shipped with
 // 3 chasers / 2 shooters against 7+/7+ everywhere else. Quarry crews and the stone itself.
 {c:[{n:'Sledge Drudge',  inf:{id:'weak',dur:3.8},  hp:1.16,spd:0.80,tch:1.02,r:1.02, w:{sentinel:54,roamer:28,hunter:18},
      sig:{sway:0.20,swayF:1.0,harry:0,lunge:null,pace:66}},
     {n:'Scree Scuttler', inf:null,                 hp:0.66,spd:1.16,tch:0.72,r:0.78, w:{pack:56,roamer:28,hunter:16},
      sig:{sway:0.78,swayF:4.1,commit:32,harry:0,lunge:null,flank:110,collapse:148}}],
  s:[{n:'Grit Flinger',   inf:{id:'bleed',dur:3.0}, hp:0.94,spd:0.90,bd:0.94,r:0.96, w:{skirmisher:54,sentinel:28,roamer:18}},
     {n:'Chalkline Caller',inf:{id:'weak',dur:3.6}, hp:1.02,spd:0.84,bd:0.98,r:1.00, rof:1.12, w:{sentinel:58,skirmisher:26,roamer:16}}],
  d:{c:[{n:'Quarry Revenant',inf:{id:'chill',dur:3.4},hp:1.26,spd:0.88,tch:1.08,r:1.04, w:{ambusher:48,sentinel:32,roamer:20},
        sig:{sway:0.24,swayF:1.1,harry:0,lunge:null,breakoff:1.8,rehide:250}}],
     s:[{n:'Dust Cantor', inf:{id:'curse',dur:4.6},  hp:1.10,spd:0.86,bd:1.04,r:1.00, rof:1.02, w:{sentinel:54,skirmisher:30,roamer:16}}]}},
];
for(let _b=0;_b<MOBSPEC.length;_b++){
  const A=MOBSPEC[_b], B=MOBSPEC_MORE[_b]; if(!A||!B) continue;
  if(B.c) A.c=A.c.concat(B.c);
  if(B.s) A.s=A.s.concat(B.s);
  if(B.d){ A.d=A.d||{};
    if(B.d.c) A.d.c=(A.d.c||[]).concat(B.d.c);
    if(B.d.s) A.d.s=(A.d.s||[]).concat(B.d.s); }
}

// ---- THE THIRD WAVE (user, 2026-07-27: "a lot more creatures for each zone") ----
// Eleven more per band -- four chasers and three shooters in the open, two more of each inside the
// dungeon -- taking the roster from 99 to 198. Same rules throughout: the pool is a list, the
// species is hashed from the spawn point, and every entry is written for the ground it stands on.
const MOBSPEC_MORE2=[
 // 0 THE LANDING SANDS
 {c:[{n:'Foam Scuttler',   inf:null,                  hp:0.54,spd:1.08,tch:0.60,r:0.74, w:{pack:50,roamer:32,hunter:18},
      sig:{sway:0.76,swayF:3.9,commit:30,harry:0,lunge:null,flank:106,collapse:142}},
     {n:'Bleached Hermit', inf:{id:'bleed',dur:2.0},  hp:1.18,spd:0.62,tch:0.95,r:1.08, w:{sentinel:64,ambusher:24,roamer:12},
      sig:{sway:0.14,swayF:0.8,harry:0,lunge:null,pace:58,leash:300}},
     {n:'Gull-Picked Corpse',inf:{id:'poison',dur:3.0},hp:0.88,spd:0.86,tch:0.85,r:0.96, w:{ambusher:52,sentinel:28,hunter:20},
      sig:{sway:0.20,swayF:1.0,harry:0,lunge:null,breakoff:1.6,rehide:230}},
     {n:'Dune Skipper',    inf:null,                  hp:0.60,spd:1.30,tch:0.70,r:0.78, w:{roamer:48,skirmisher:30,pack:22},
      sig:{sway:0.84,swayF:4.2,commit:40,harry:70,lunge:{min:80,max:190,mul:2.5,dur:0.22,cd:1.6}}}],
  s:[{n:'Spume Caster',    inf:{id:'chill',dur:1.8},  hp:0.90,spd:0.86,bd:0.78,r:0.96, w:{skirmisher:48,sentinel:30,roamer:22}},
     {n:'Reefbone Piper',  inf:{id:'weak',dur:2.5},   hp:1.06,spd:0.72,bd:0.82,r:1.02, rof:1.20, w:{sentinel:60,roamer:26,skirmisher:14}},
     {n:'Shoal Whistler',  inf:null,                  hp:0.80,spd:1.02,bd:0.70,r:0.90, rof:0.90, w:{skirmisher:58,roamer:28,hunter:14}}],
  d:{c:[{n:'Netted Drowned',inf:{id:'chill',dur:3.2}, hp:1.24,spd:0.76,tch:0.95,r:1.04, w:{sentinel:52,ambusher:30,hunter:18},
        sig:{sway:0.18,swayF:0.9,harry:0,lunge:null,pace:64}},
       {n:'Barnacle Thrall',inf:{id:'poison',dur:3.5},hp:1.36,spd:0.68,tch:1.05,r:1.10, w:{sentinel:60,ambusher:26,roamer:14},
        sig:{sway:0.12,swayF:0.7,harry:0,lunge:null,pace:56,leash:320}}],
     s:[{n:'Saltglass Adept',inf:{id:'chill',dur:3.4},hp:1.12,spd:0.80,bd:1.00,r:1.00, rof:1.00, w:{sentinel:54,skirmisher:30,roamer:16}},
        {n:'Wrack Cantor', inf:{id:'curse',dur:3.0},  hp:1.04,spd:0.88,bd:0.95,r:0.98, rof:0.92, w:{skirmisher:52,sentinel:30,roamer:18}}]}},

 // 1 GULLWIND SHORE
 {c:[{n:'Tern Diver',      inf:{id:'bleed',dur:2.5},  hp:0.58,spd:1.38,tch:0.95,r:0.80, w:{ambusher:56,roamer:26,hunter:18},
      sig:{sway:0.70,swayF:3.2,commit:66,harry:92,lunge:{min:120,max:300,mul:3.1,dur:0.30,cd:1.9},breakoff:1.6,rehide:240}},
     {n:'Barnacle Crawler',inf:null,                  hp:1.24,spd:0.70,tch:1.05,r:1.10, w:{sentinel:58,ambusher:26,roamer:16},
      sig:{sway:0.16,swayF:0.9,harry:0,lunge:null,pace:62}},
     {n:'Shipwreck Rat',   inf:{id:'poison',dur:3.0}, hp:0.50,spd:1.34,tch:0.65,r:0.70, w:{pack:66,roamer:22,hunter:12},
      sig:{sway:0.84,swayF:4.4,commit:32,harry:52,flank:108,collapse:144,lunge:null}},
     {n:'Cliffside Ram',   inf:{id:'stun',dur:0.6},   hp:1.40,spd:1.00,tch:1.30,r:1.10, w:{hunter:62,roamer:22,sentinel:16},
      sig:{sway:0.16,swayF:0.9,commit:170,harry:0,lunge:{min:150,max:370,mul:3.4,dur:0.44,cd:2.8}}}],
  s:[{n:'Storm Caller',    inf:{id:'shock',dur:2.0},  hp:0.98,spd:1.06,bd:0.95,r:0.96, w:{skirmisher:56,roamer:26,sentinel:18}},
     {n:'Wreck Crow',      inf:{id:'weak',dur:3.0},   hp:0.84,spd:1.18,bd:0.82,r:0.90, rof:0.82, w:{skirmisher:62,roamer:24,hunter:14}},
     {n:'Rime Slinger',    inf:{id:'chill',dur:2.6},  hp:1.14,spd:0.80,bd:1.00,r:1.02, rof:1.18, w:{sentinel:58,skirmisher:26,roamer:16}}],
  d:{c:[{n:'Keeper’s Shade',inf:{id:'curse',dur:3.5},hp:1.06,spd:1.10,tch:1.00,r:0.98, w:{ambusher:54,roamer:28,pack:18},
        sig:{sway:0.66,swayF:3.2,harry:82,lunge:null,breakoff:1.8,rehide:260}},
       {n:'Oil-Slick Hulk',inf:{id:'burn',dur:3.0},   hp:1.62,spd:0.72,tch:1.25,r:1.16, w:{sentinel:62,hunter:26,ambusher:12},
        sig:{sway:0.12,swayF:0.7,harry:0,lunge:null,pace:70,leash:380}}],
     s:[{n:'Prism Adept',  inf:{id:'shock',dur:2.6},  hp:1.10,spd:0.94,bd:1.06,r:0.98, rof:0.94, w:{skirmisher:54,sentinel:30,roamer:16}},
        {n:'Mirror Chanter',inf:{id:'weak',dur:4.0},  hp:1.20,spd:0.84,bd:1.10,r:1.04, rof:1.14, w:{sentinel:56,skirmisher:28,roamer:16}}]}},

 // 2 SAWGRASS FLATS
 {c:[{n:'Peat Lurcher',    inf:{id:'poison',dur:4.5}, hp:1.50,spd:0.68,tch:1.28,r:1.14, w:{ambusher:50,sentinel:30,hunter:20},
      sig:{sway:0.18,swayF:0.8,harry:0,lunge:null,breakoff:1.7,rehide:250}},
     {n:'Rush Adder',      inf:{id:'poison',dur:6.0}, hp:0.66,spd:1.24,tch:0.90,r:0.78, w:{ambusher:58,pack:24,roamer:18},
      sig:{sway:0.74,swayF:3.6,commit:50,harry:60,lunge:{min:90,max:220,mul:2.8,dur:0.24,cd:1.7},breakoff:1.5,rehide:220}},
     {n:'Bog Shambler',    inf:{id:'weak',dur:4.0},   hp:1.66,spd:0.60,tch:1.32,r:1.18, w:{sentinel:62,ambusher:24,hunter:14},
      sig:{sway:0.10,swayF:0.6,harry:0,lunge:null,pace:60,leash:360}},
     {n:'Fen Skimmer',     inf:{id:'chill',dur:2.5},  hp:0.58,spd:1.32,tch:0.72,r:0.74, w:{skirmisher:48,pack:30,roamer:22},
      sig:{sway:0.88,swayF:4.2,commit:34,harry:64,flank:112,collapse:150,lunge:null}}],
  s:[{n:'Cattail Spitter', inf:{id:'poison',dur:4.0}, hp:1.04,spd:0.86,bd:1.00,r:0.98, w:{skirmisher:50,sentinel:32,roamer:18}},
     {n:'Mudlark Caller',  inf:{id:'weak',dur:3.5},   hp:1.16,spd:0.76,bd:1.08,r:1.04, rof:1.22, w:{sentinel:62,roamer:22,skirmisher:16}},
     {n:'Wisp-Light Piper',inf:{id:'curse',dur:4.0},  hp:0.94,spd:0.98,bd:0.92,r:0.94, rof:0.86, w:{skirmisher:60,roamer:24,sentinel:16}}],
  d:{c:[{n:'Bell-Rot Acolyte',inf:{id:'curse',dur:4.5},hp:1.40,spd:0.78,tch:1.15,r:1.08, w:{sentinel:56,ambusher:26,hunter:18},
        sig:{sway:0.14,swayF:0.8,harry:0,lunge:null,pace:68}},
       {n:'Ossuary Crawler',inf:{id:'bleed',dur:4.0}, hp:1.30,spd:0.90,tch:1.10,r:1.04, w:{ambusher:48,pack:30,hunter:22},
        sig:{sway:0.60,swayF:2.8,harry:66,lunge:{min:90,max:230,mul:2.6,dur:0.26,cd:1.9}}}],
     s:[{n:'Requiem Cantor',inf:{id:'curse',dur:5.0}, hp:1.20,spd:0.80,bd:1.16,r:1.04, rof:1.02, w:{sentinel:52,skirmisher:32,roamer:16}},
        {n:'Grave-Ash Adept',inf:{id:'poison',dur:5.5},hp:1.14,spd:0.86,bd:1.10,r:1.00, rof:0.94, w:{skirmisher:54,sentinel:30,roamer:16}}]}},

 // 3 THE VERDANT BELT
 {c:[{n:'Bramble Stag',    inf:{id:'bleed',dur:3.5},  hp:1.44,spd:1.06,tch:1.28,r:1.12, w:{hunter:58,roamer:26,pack:16},
      sig:{sway:0.22,swayF:1.1,commit:160,harry:0,lunge:{min:150,max:380,mul:3.4,dur:0.46,cd:2.9}}},
     {n:'Moss Lurker',     inf:{id:'poison',dur:4.5}, hp:1.32,spd:0.80,tch:1.18,r:1.08, w:{ambusher:60,sentinel:24,hunter:16},
      sig:{sway:0.24,swayF:1.0,harry:0,lunge:null,breakoff:1.9,rehide:270}},
     {n:'Thicket Whelp',   inf:{id:'bleed',dur:3.0},  hp:0.66,spd:1.26,tch:0.88,r:0.84, w:{pack:68,roamer:20,hunter:12},
      sig:{sway:0.58,swayF:3.2,harry:70,flank:132,collapse:178,lunge:{min:90,max:230,mul:2.7,dur:0.26,cd:1.7}}},
     {n:'Grovewretch',     inf:{id:'curse',dur:4.0},  hp:1.08,spd:0.98,tch:1.02,r:1.00, w:{hunter:44,ambusher:30,roamer:26},
      sig:{sway:0.40,swayF:2.0,harry:60,lunge:{min:100,max:240,mul:2.4,dur:0.30,cd:2.2}}}],
  s:[{n:'Thorn Slinger',   inf:{id:'bleed',dur:4.0},  hp:0.98,spd:1.02,bd:0.98,r:0.96, w:{skirmisher:56,roamer:26,hunter:18}},
     {n:'Sap Priest',      inf:{id:'weak',dur:5.0},   hp:1.22,spd:0.82,bd:1.12,r:1.06, rof:1.16, w:{sentinel:58,skirmisher:26,roamer:16}},
     {n:'Fungal Herald',   inf:{id:'poison',dur:5.5}, hp:1.10,spd:0.88,bd:1.04,r:1.02, rof:1.00, w:{sentinel:48,skirmisher:34,roamer:18}}],
  d:{c:[{n:'Bark-Bound Thrall',inf:{id:'weak',dur:5.0},hp:1.62,spd:0.84,tch:1.28,r:1.14, w:{sentinel:56,hunter:28,ambusher:16},
        sig:{sway:0.14,swayF:0.8,harry:0,lunge:null,pace:72,leash:400}},
       {n:'Rootling Swarm',inf:{id:'poison',dur:4.5}, hp:0.48,spd:1.28,tch:0.68,r:0.70, w:{pack:66,roamer:22,ambusher:12},
        sig:{sway:0.90,swayF:4.6,commit:28,harry:46,flank:102,collapse:136,lunge:null}}],
     s:[{n:'Heartsap Chanter',inf:{id:'curse',dur:5.5},hp:1.24,spd:0.86,bd:1.16,r:1.04, rof:1.06, w:{sentinel:52,skirmisher:32,roamer:16}},
        {n:'Bloomcaster',  inf:{id:'poison',dur:6.0}, hp:1.06,spd:1.00,bd:1.02,r:0.98, rof:0.84, w:{skirmisher:58,roamer:26,sentinel:16}}]}},

 // 4 WOLFWOOD
 {c:[{n:'Timber Alpha',    inf:{id:'bleed',dur:5.0},  hp:1.30,spd:1.14,tch:1.30,r:1.10, w:{pack:66,hunter:22,ambusher:12},
      sig:{sway:0.40,swayF:2.4,commit:100,harry:84,flank:174,collapse:236,lunge:{min:110,max:300,mul:3.0,dur:0.34,cd:1.8}}},
     {n:'Hollow Elk',      inf:{id:'curse',dur:4.5},  hp:1.52,spd:1.00,tch:1.32,r:1.16, w:{hunter:56,sentinel:24,roamer:20},
      sig:{sway:0.18,swayF:0.9,commit:170,harry:0,lunge:{min:150,max:390,mul:3.5,dur:0.48,cd:3.0}}},
     {n:'Carrion Creeper', inf:{id:'poison',dur:5.0}, hp:0.70,spd:1.20,tch:0.80,r:0.80, w:{pack:56,ambusher:28,roamer:16},
      sig:{sway:0.78,swayF:3.8,commit:36,harry:56,flank:116,collapse:154,lunge:null}},
     {n:'Bristle Boar',    inf:{id:'bleed',dur:4.0},  hp:1.48,spd:1.02,tch:1.34,r:1.14, w:{hunter:60,pack:22,roamer:18},
      sig:{sway:0.18,swayF:1.0,commit:165,harry:0,lunge:{min:145,max:365,mul:3.3,dur:0.44,cd:2.7}}}],
  s:[{n:'Moon-Eye Seer',   inf:{id:'curse',dur:5.5},  hp:1.10,spd:0.96,bd:1.14,r:1.00, w:{sentinel:44,skirmisher:34,roamer:22}},
     {n:'Bone Flautist',   inf:{id:'weak',dur:5.0},   hp:1.16,spd:0.90,bd:1.10,r:1.02, rof:1.10, w:{sentinel:54,skirmisher:28,roamer:18}},
     {n:'Pelt-Wrapped Adept',inf:{id:'chill',dur:4.0},hp:1.02,spd:1.08,bd:1.02,r:0.96, rof:0.84, w:{skirmisher:64,roamer:22,hunter:14}}],
  d:{c:[{n:'Fogfang Alpha',inf:{id:'bleed',dur:5.5},  hp:1.34,spd:1.22,tch:1.28,r:1.10, w:{pack:70,ambusher:18,hunter:12},
        sig:{sway:0.48,swayF:3.0,harry:88,flank:160,collapse:214,lunge:{min:115,max:310,mul:3.1,dur:0.30,cd:1.6}}},
       {n:'Antlered Husk', inf:{id:'curse',dur:5.0},  hp:1.58,spd:0.88,tch:1.26,r:1.14, w:{sentinel:54,hunter:30,ambusher:16},
        sig:{sway:0.16,swayF:0.9,harry:0,lunge:null,pace:74,leash:400}}],
     s:[{n:'Cairnlight Seer',inf:{id:'curse',dur:6.0},hp:1.18,spd:0.94,bd:1.18,r:1.00, rof:0.92, w:{skirmisher:48,sentinel:34,roamer:18}},
        {n:'Mist Piper',   inf:{id:'chill',dur:4.5},  hp:1.24,spd:0.86,bd:1.14,r:1.04, rof:1.16, w:{sentinel:56,skirmisher:28,roamer:16}}]}},

 // 5 DEEP TIMBER
 {c:[{n:'Fen Colossus',    inf:{id:'poison',dur:6.5}, hp:2.20,spd:0.56,tch:1.55,r:1.30, w:{sentinel:62,ambusher:24,hunter:14},
      sig:{sway:0.08,swayF:0.5,harry:0,lunge:null,pace:56,leash:360}},
     {n:'Drowned Stag',    inf:{id:'chill',dur:5.0},  hp:1.40,spd:0.96,tch:1.28,r:1.12, w:{hunter:54,sentinel:26,roamer:20},
      sig:{sway:0.20,swayF:1.0,commit:160,harry:0,lunge:{min:140,max:350,mul:3.2,dur:0.44,cd:3.0}}},
     {n:'Grub Nest',       inf:{id:'poison',dur:6.0}, hp:0.42,spd:1.18,tch:0.62,r:0.66, w:{pack:70,roamer:20,ambusher:10},
      sig:{sway:0.92,swayF:4.8,commit:26,harry:42,flank:98,collapse:132,lunge:null}},
     {n:'Mire Stalker',    inf:{id:'bleed',dur:5.0},  hp:1.16,spd:1.04,tch:1.16,r:1.02, w:{ambusher:62,hunter:22,pack:16},
      sig:{sway:0.30,swayF:1.8,commit:130,harry:0,breakoff:2.0,rehide:290,lunge:null}}],
  s:[{n:'Marsh Oracle',    inf:{id:'curse',dur:6.0},  hp:1.20,spd:0.82,bd:1.22,r:1.04, w:{sentinel:48,skirmisher:32,roamer:20}},
     {n:'Spore Chanter',   inf:{id:'poison',dur:6.5}, hp:1.30,spd:0.72,bd:1.26,r:1.08, rof:1.24, w:{sentinel:62,roamer:22,skirmisher:16}},
     {n:'Bog-Light Adept',  inf:{id:'chill',dur:4.5}, hp:1.08,spd:0.94,bd:1.14,r:1.00, rof:0.88, w:{skirmisher:56,sentinel:28,roamer:16}}],
  d:{c:[{n:'Warden of Silt',inf:{id:'poison',dur:7.0},hp:1.94,spd:0.74,tch:1.44,r:1.22, w:{sentinel:60,ambusher:24,hunter:16},
        sig:{sway:0.10,swayF:0.6,harry:0,lunge:null,pace:66,leash:410}},
       {n:'Sunken Whelp', inf:{id:'chill',dur:5.0},   hp:0.74,spd:1.24,tch:0.85,r:0.84, w:{pack:62,ambusher:22,roamer:16},
        sig:{sway:0.66,swayF:3.4,harry:70,flank:124,collapse:166,lunge:{min:95,max:240,mul:2.7,dur:0.26,cd:1.7}}}],
     s:[{n:'Drowned Oracle',inf:{id:'curse',dur:7.0}, hp:1.28,spd:0.78,bd:1.28,r:1.06, rof:0.96, w:{skirmisher:46,sentinel:36,roamer:18}},
        {n:'Rot Cantor',   inf:{id:'poison',dur:7.0}, hp:1.32,spd:0.74,bd:1.24,r:1.08, rof:1.10, w:{sentinel:58,skirmisher:26,roamer:16}}]}},

 // 6 STONEBROW RISE
 {c:[{n:'Terrace Guard',   inf:{id:'stun',dur:0.8},   hp:1.95,spd:0.78,tch:1.35,r:1.18, w:{sentinel:64,hunter:24,ambusher:12},
      sig:{sway:0.10,swayF:0.7,harry:0,lunge:null,pace:92,leash:430}},
     {n:'Cliff Ram',       inf:{id:'stun',dur:0.9},   hp:1.56,spd:1.04,tch:1.40,r:1.14, w:{hunter:64,roamer:22,sentinel:14},
      sig:{sway:0.14,swayF:0.9,commit:180,harry:0,lunge:{min:160,max:400,mul:3.6,dur:0.48,cd:2.8}}},
     {n:'Grit Swarm',      inf:{id:'bleed',dur:2.5},  hp:0.44,spd:1.34,tch:0.62,r:0.66, w:{pack:68,roamer:22,skirmisher:10},
      sig:{sway:0.94,swayF:4.8,commit:26,harry:44,flank:100,collapse:134,lunge:null}},
     {n:'Quarry Lurker',   inf:{id:'bleed',dur:4.0},  hp:1.22,spd:0.96,tch:1.12,r:1.04, w:{ambusher:60,hunter:24,pack:16},
      sig:{sway:0.28,swayF:1.6,commit:120,harry:0,breakoff:1.9,rehide:270,lunge:null}}],
  s:[{n:'Slate Flinger',   inf:{id:'stun',dur:0.7},   hp:1.20,spd:0.84,bd:1.22,r:1.02, w:{sentinel:52,skirmisher:28,roamer:20}},
     {n:'Echo Caller',     inf:{id:'shock',dur:2.4},  hp:1.06,spd:1.00,bd:1.12,r:0.98, rof:0.86, w:{skirmisher:60,roamer:24,hunter:16}},
     {n:'Cairn Sling',     inf:{id:'stun',dur:1.0},   hp:1.50,spd:0.62,bd:1.48,r:1.16, rof:1.38, w:{sentinel:70,roamer:18,skirmisher:12}}],
  d:{c:[{n:'Vault Colossus',inf:{id:'stun',dur:1.2},  hp:2.55,spd:0.68,tch:1.62,r:1.34, w:{sentinel:66,hunter:26,ambusher:8},
        sig:{sway:0.08,swayF:0.6,harry:0,lunge:null,pace:86,leash:470}},
       {n:'Shard Skitter', inf:{id:'bleed',dur:3.5},  hp:0.56,spd:1.36,tch:0.78,r:0.72, w:{pack:60,roamer:24,skirmisher:16},
        sig:{sway:0.82,swayF:4.4,commit:34,harry:56,flank:112,collapse:148,lunge:{min:80,max:200,mul:2.6,dur:0.22,cd:1.4}}}],
     s:[{n:'Deep-Vault Adept',inf:{id:'shock',dur:3.0},hp:1.32,spd:0.84,bd:1.32,r:1.06, rof:0.92, w:{skirmisher:48,sentinel:34,hunter:18}},
        {n:'Stonebell Cantor',inf:{id:'stun',dur:1.0},hp:1.40,spd:0.72,bd:1.38,r:1.10, rof:1.22, w:{sentinel:64,skirmisher:22,roamer:14}}]}},

 // 7 CINDERWATCH
 {c:[{n:'Ashjaw Hound',    inf:{id:'burn',dur:4.5},   hp:1.06,spd:1.20,tch:1.20,r:1.02, w:{pack:64,hunter:22,ambusher:14},
      sig:{sway:0.44,swayF:2.8,harry:86,flank:156,collapse:210,lunge:{min:110,max:300,mul:3.1,dur:0.32,cd:1.7}}},
     {n:'Cinder Ram',      inf:{id:'burn',dur:5.0},   hp:1.60,spd:1.00,tch:1.45,r:1.16, w:{hunter:62,roamer:22,sentinel:16},
      sig:{sway:0.16,swayF:0.9,commit:175,harry:0,lunge:{min:155,max:390,mul:3.5,dur:0.46,cd:2.7}}},
     {n:'Scoria Crawler',  inf:{id:'burn',dur:4.0},   hp:1.30,spd:0.88,tch:1.18,r:1.08, w:{sentinel:50,ambusher:30,hunter:20},
      sig:{sway:0.20,swayF:1.0,harry:0,lunge:null,pace:70}},
     {n:'Flarewing',       inf:{id:'burn',dur:3.5},   hp:0.72,spd:1.34,tch:1.00,r:0.88, w:{ambusher:50,roamer:28,skirmisher:22},
      sig:{sway:0.68,swayF:3.2,commit:60,harry:94,lunge:{min:120,max:320,mul:3.2,dur:0.32,cd:1.8},breakoff:1.6,rehide:250}}],
  s:[{n:'Magma Slinger',   inf:{id:'burn',dur:5.0},   hp:1.24,spd:0.86,bd:1.26,r:1.04, w:{sentinel:52,skirmisher:30,roamer:18}},
     {n:'Cinder Oracle',   inf:{id:'curse',dur:5.0},  hp:1.14,spd:0.96,bd:1.18,r:1.00, rof:0.90, w:{skirmisher:56,sentinel:28,roamer:16}},
     {n:'Vent Piper',      inf:{id:'burn',dur:5.5},   hp:1.34,spd:0.78,bd:1.32,r:1.10, rof:1.26, w:{sentinel:64,roamer:20,skirmisher:16}}],
  d:{c:[{n:'Anvil Colossus',inf:{id:'burn',dur:6.0},  hp:2.35,spd:0.76,tch:1.58,r:1.30, w:{sentinel:56,hunter:34,ambusher:10},
        sig:{sway:0.10,swayF:0.7,commit:130,harry:0,lunge:{min:130,max:290,mul:2.5,dur:0.44,cd:2.9}}},
       {n:'Slagfly Swarm', inf:{id:'burn',dur:3.5},   hp:0.46,spd:1.42,tch:0.66,r:0.68, w:{pack:68,roamer:20,skirmisher:12},
        sig:{sway:0.96,swayF:5.0,commit:24,harry:40,flank:96,collapse:128,lunge:null}}],
     s:[{n:'Quench Adept', inf:{id:'chill',dur:3.5},  hp:1.26,spd:0.92,bd:1.28,r:1.04, rof:0.94, w:{skirmisher:52,sentinel:30,hunter:18}},
        {n:'Forge Cantor', inf:{id:'burn',dur:6.5},   hp:1.36,spd:0.86,bd:1.36,r:1.08, rof:1.10, w:{sentinel:58,skirmisher:26,roamer:16}}]}},

 // 8 THE ASHFALL
 {c:[{n:'Rift Hound',      inf:{id:'curse',dur:5.5},  hp:1.14,spd:1.24,tch:1.22,r:1.04, w:{pack:60,hunter:26,ambusher:14},
      sig:{sway:0.42,swayF:2.8,harry:82,flank:158,collapse:212,lunge:{min:115,max:305,mul:3.1,dur:0.30,cd:1.6}}},
     {n:'Emberbone Giant', inf:{id:'burn',dur:6.5},   hp:2.45,spd:0.74,tch:1.65,r:1.32, w:{sentinel:52,hunter:38,ambusher:10},
      sig:{sway:0.08,swayF:0.6,commit:60,harry:0,lunge:null,pace:78,leash:450}},
     {n:'Cinder Moth',     inf:{id:'burn',dur:4.0},   hp:0.50,spd:1.38,tch:0.70,r:0.72, w:{pack:62,roamer:24,skirmisher:14},
      sig:{sway:0.92,swayF:4.6,commit:28,harry:46,flank:100,collapse:134,lunge:null}},
     {n:'Scorched Stalker',inf:{id:'bleed',dur:5.0},  hp:1.26,spd:1.08,tch:1.24,r:1.04, w:{ambusher:58,hunter:26,pack:16},
      sig:{sway:0.28,swayF:1.7,commit:130,harry:0,breakoff:2.0,rehide:290,lunge:null}}],
  s:[{n:'Ashfall Oracle',  inf:{id:'curse',dur:6.5},  hp:1.22,spd:0.92,bd:1.34,r:1.02, w:{skirmisher:50,sentinel:32,roamer:18}},
     {n:'Emberglass Adept',inf:{id:'burn',dur:5.5},   hp:1.16,spd:1.00,bd:1.30,r:1.00, rof:0.82, w:{skirmisher:60,hunter:22,sentinel:18}},
     {n:'Pyre Sling',      inf:{id:'burn',dur:6.0},   hp:1.44,spd:0.70,bd:1.50,r:1.12, rof:1.32, w:{sentinel:68,roamer:18,skirmisher:14}}],
  d:{c:[{n:'Core Colossus',inf:{id:'burn',dur:7.0},   hp:2.85,spd:0.76,tch:1.80,r:1.40, w:{sentinel:52,hunter:38,ambusher:10},
        sig:{sway:0.08,swayF:0.6,commit:120,harry:0,lunge:{min:140,max:330,mul:2.6,dur:0.48,cd:3.2}}},
       {n:'Sanctum Whelp', inf:{id:'curse',dur:5.0},  hp:0.80,spd:1.32,tch:0.95,r:0.88, w:{pack:64,ambusher:20,hunter:16},
        sig:{sway:0.56,swayF:3.2,harry:82,flank:152,collapse:202,lunge:{min:100,max:270,mul:3.0,dur:0.28,cd:1.5}}}],
     s:[{n:'Heart-Ash Cantor',inf:{id:'curse',dur:7.5},hp:1.38,spd:0.88,bd:1.50,r:1.06, rof:0.78, w:{skirmisher:50,sentinel:32,hunter:18}},
        {n:'Riftglass Adept',inf:{id:'shock',dur:3.4},hp:1.28,spd:0.98,bd:1.42,r:1.02, rof:0.88, w:{skirmisher:58,sentinel:26,hunter:16}}]}},
 // 9 THE CAIRNWORKS (Lv11-15) -- the quarry rise. Added when band 9 was created; without a row
 // here the merge loop's `if(!A||!B) continue` skipped it in silence and the zone shipped with
 // 3 chasers / 2 shooters against 7+/7+ everywhere else. Quarry crews and the stone itself.
 {c:[{n:'Bank Collapser', inf:{id:'stun',dur:0.7},  hp:1.44,spd:0.72,tch:1.16,r:1.10, w:{sentinel:62,hunter:24,ambusher:14},
      sig:{sway:0.12,swayF:0.7,harry:0,lunge:null,pace:58,leash:320}}],
  s:[{n:'Plumbline Seer', inf:{id:'curse',dur:4.2}, hp:1.00,spd:0.92,bd:1.00,r:0.98, rof:0.94, w:{skirmisher:56,sentinel:28,roamer:16}}],
  d:{c:[{n:'Toolmarked Thing',inf:{id:'bleed',dur:4.0},hp:1.20,spd:0.96,tch:1.06,r:1.00, w:{ambusher:52,pack:28,hunter:20},
        sig:{sway:0.52,swayF:2.6,harry:60,lunge:{min:92,max:230,mul:2.6,dur:0.26,cd:2.0}}}],
     s:[{n:'Kiln Whisperer',inf:{id:'weak',dur:4.4}, hp:1.08,spd:0.88,bd:1.02,r:1.00, rof:1.06, w:{sentinel:52,skirmisher:32,roamer:16}}]}},
];
for(let _b=0;_b<MOBSPEC.length;_b++){
  const A=MOBSPEC[_b], B=MOBSPEC_MORE2[_b]; if(!A||!B) continue;
  if(B.c) A.c=A.c.concat(B.c);
  if(B.s) A.s=A.s.concat(B.s);
  if(B.d){ A.d=A.d||{};
    if(B.d.c) A.d.c=(A.d.c||[]).concat(B.d.c);
    if(B.d.s) A.d.s=(A.d.s||[]).concat(B.d.s); }
}

// ---- THE NIGHTMARE ROSTER (user: "separate but similar", and "not dream, nightmare") ----
// Three more chasers and three more shooters per band, dungeon-only, bringing each band's
// nightmare pool to seven and seven -- the same depth as the ground above it. Each one is the echo of an
// overworld creature rather than a new idea: the Landing Sands has its crawlers and its spitters
// in both -- down here they have too many legs, or too many mouths, and they do not stop.
const MOBSPEC_NIGHT=[
 // 0 THE SALTWORKS (the Landing Sands, gone wrong)
 {c:[{n:'Flensed Crawler',inf:{id:'chill',dur:3.0},hp:0.94,spd:0.86,tch:0.90,r:0.96, w:{roamer:42,hunter:32,sentinel:26},
      sig:{sway:0.60,swayF:3.2,commit:44,harry:0,lunge:null}},
     {n:'Chitter-Shell',    inf:null,                 hp:0.62,spd:1.10,tch:0.70,r:0.78, w:{pack:56,roamer:28,hunter:16},
      sig:{sway:0.78,swayF:4.0,commit:34,harry:0,lunge:null,flank:110,collapse:148}},
     {n:'The Halfdrowned',  inf:{id:'curse',dur:4.0}, hp:1.02,spd:0.94,tch:0.92,r:0.98, w:{ambusher:50,roamer:30,sentinel:20},
      sig:{sway:0.30,swayF:1.4,harry:0,lunge:null,breakoff:1.8,rehide:250}}],
  s:[{n:'Drowning Voice', inf:{id:'chill',dur:3.2}, hp:1.00,spd:0.84,bd:0.92,r:0.98, w:{sentinel:52,skirmisher:30,roamer:18}},
     {n:'Saltglass Weeper',  inf:{id:'curse',dur:3.5}, hp:0.92,spd:0.96,bd:0.88,r:0.94, rof:0.90, w:{skirmisher:56,roamer:26,sentinel:18}},
     {n:'Hook-Lantern',inf:{id:'weak',dur:3.0},hp:1.10,spd:0.74,bd:0.96,r:1.02, rof:1.20, w:{sentinel:64,roamer:22,skirmisher:14}}]},

 // 1 GULLWIND LIGHT (the Gullwind Shore, gone wrong)
 {c:[{n:'Skinned Skua',  inf:{id:'bleed',dur:3.0}, hp:0.76,spd:1.26,tch:1.10,r:0.88, w:{ambusher:52,roamer:28,hunter:20},
      sig:{sway:0.66,swayF:3.0,commit:66,harry:88,lunge:{min:120,max:300,mul:3.0,dur:0.32,cd:2.0},breakoff:1.7,rehide:250}},
     {n:'The Keeper’s Hands',     inf:{id:'curse',dur:4.0}, hp:1.16,spd:0.92,tch:1.00,r:1.02, w:{sentinel:48,ambusher:30,roamer:22},
      sig:{sway:0.26,swayF:1.2,harry:0,lunge:null,pace:74}},
     {n:'Rope of Necks',    inf:{id:'weak',dur:4.0},  hp:1.30,spd:0.66,tch:1.08,r:1.10, w:{sentinel:66,ambusher:22,roamer:12},
      sig:{sway:0.10,swayF:0.6,harry:0,lunge:null,pace:56,leash:320}}],
  s:[{n:'Beacon That Screams',inf:{id:'shock',dur:2.4},hp:1.12,spd:0.90,bd:1.02,r:1.00, w:{sentinel:54,skirmisher:30,roamer:16}},
     {n:'Fogbell Toller',    inf:{id:'weak',dur:3.8},  hp:1.06,spd:0.94,bd:0.98,r:0.98, rof:1.10, w:{sentinel:50,skirmisher:32,roamer:18}},
     {n:'Gull With No Eyes',inf:{id:'bleed',dur:3.5}, hp:0.86,spd:1.20,bd:0.90,r:0.92, rof:0.80, w:{skirmisher:62,roamer:24,hunter:14}}]},

 // 2 MARROW CHAPEL (the Sawgrass Flats, gone wrong)
 {c:[{n:'Split Lurcher',inf:{id:'poison',dur:5.0},hp:1.52,spd:0.70,tch:1.26,r:1.14, w:{ambusher:46,sentinel:32,hunter:22},
      sig:{sway:0.20,swayF:0.9,harry:0,lunge:null,breakoff:1.7,rehide:250}},
     {n:'Choir of Open Mouths',    inf:{id:'curse',dur:5.0}, hp:1.34,spd:0.80,tch:1.10,r:1.06, w:{sentinel:56,ambusher:26,hunter:18},
      sig:{sway:0.14,swayF:0.8,harry:0,lunge:null,pace:66}},
     {n:'The Kneeling',inf:{id:'weak',dur:5.5},hp:0.60,spd:1.18,tch:0.74,r:0.74, w:{pack:64,ambusher:22,roamer:14},
      sig:{sway:0.80,swayF:4.0,commit:32,harry:50,flank:108,collapse:144,lunge:null}}],
  s:[{n:'Bell of Teeth', inf:{id:'stun',dur:0.8},  hp:1.26,spd:0.74,bd:1.16,r:1.06, rof:1.24, w:{sentinel:64,roamer:20,skirmisher:16}},
     {n:'Marrow Weeper',     inf:{id:'curse',dur:5.0}, hp:1.14,spd:0.86,bd:1.10,r:1.00, rof:0.96, w:{skirmisher:50,sentinel:32,roamer:18}},
     {n:'Censer of Flies',  inf:{id:'poison',dur:6.0},hp:1.20,spd:0.78,bd:1.12,r:1.04, rof:1.08, w:{sentinel:56,skirmisher:28,roamer:16}}]},

 // 3 THE HEARTWOOD HOLLOW (the Verdant Belt, gone wrong)
 {c:[{n:'Starving Hound', inf:{id:'bleed',dur:4.0}, hp:1.06,spd:1.10,tch:1.08,r:1.00, w:{pack:52,hunter:28,ambusher:20},
      sig:{sway:0.52,swayF:2.6,harry:72,lunge:{min:100,max:250,mul:2.6,dur:0.30,cd:2.0}}},
     {n:'Sapling of Fingers',    inf:{id:'poison',dur:5.0},hp:0.72,spd:1.14,tch:0.82,r:0.82, w:{pack:58,roamer:26,ambusher:16},
      sig:{sway:0.70,swayF:3.4,commit:38,harry:58,flank:114,collapse:152,lunge:null}},
     {n:'Warden Flayed',  inf:{id:'weak',dur:5.0},  hp:1.70,spd:0.80,tch:1.30,r:1.16, w:{sentinel:60,hunter:26,ambusher:14},
      sig:{sway:0.12,swayF:0.7,harry:0,lunge:null,pace:70,leash:400}}],
  s:[{n:'The Grove That Watches',inf:{id:'weak',dur:5.5},  hp:1.18,spd:0.90,bd:1.10,r:1.02, w:{sentinel:50,skirmisher:32,roamer:18}},
     {n:'Bramble Weeper',    inf:{id:'poison',dur:5.5},hp:1.08,spd:0.96,bd:1.04,r:0.98, rof:0.88, w:{skirmisher:56,roamer:26,sentinel:18}},
     {n:'Seed of Mouths',inf:{id:'curse',dur:5.0}, hp:1.24,spd:0.82,bd:1.14,r:1.06, rof:1.14, w:{sentinel:58,skirmisher:26,roamer:16}}]},

 // 4 THE FOGBOUND GLADE (Wolfwood, gone wrong)
 {c:[{n:'Two-Headed Wolf',  inf:{id:'bleed',dur:4.5}, hp:1.02,spd:1.22,tch:1.16,r:1.02, w:{pack:68,ambusher:20,hunter:12},
      sig:{sway:0.48,swayF:2.8,harry:84,flank:158,collapse:212,lunge:{min:110,max:300,mul:3.0,dur:0.30,cd:1.7}}},
     {n:'Stag of Nails',inf:{id:'curse',dur:5.0},hp:1.56,spd:0.98,tch:1.32,r:1.16, w:{hunter:56,sentinel:26,roamer:18},
      sig:{sway:0.18,swayF:0.9,commit:170,harry:0,lunge:{min:150,max:380,mul:3.4,dur:0.46,cd:3.0}}},
     {n:'The Empty Pelt',inf:{id:'chill',dur:4.0},hp:0.68,spd:1.32,tch:0.84,r:0.84, w:{pack:60,roamer:24,ambusher:16},
      sig:{sway:0.74,swayF:3.6,commit:34,harry:62,flank:118,collapse:156,lunge:null}}],
  s:[{n:'Howl With No Throat', inf:{id:'weak',dur:5.0},  hp:1.14,spd:0.94,bd:1.12,r:1.00, w:{sentinel:48,skirmisher:34,roamer:18}},
     {n:'Antler Weeper',     inf:{id:'curse',dur:6.0}, hp:1.20,spd:0.90,bd:1.16,r:1.02, rof:0.92, w:{skirmisher:50,sentinel:32,roamer:18}},
     {n:'Whistling Wound',inf:{id:'chill',dur:4.5},hp:1.26,spd:0.82,bd:1.14,r:1.06, rof:1.18, w:{sentinel:58,skirmisher:26,roamer:16}}]},

 // 5 THE SUNKEN WARREN (Deep Timber, gone wrong)
 {c:[{n:'Bloated Lurker',inf:{id:'poison',dur:6.0},hp:1.44,spd:0.88,tch:1.32,r:1.10, w:{ambusher:58,sentinel:24,hunter:18},
      sig:{sway:0.62,swayF:1.6,commit:140,breakoff:2.0,rehide:270,harry:0}},
     {n:'Colossus of Bones',  inf:{id:'poison',dur:7.0},hp:2.10,spd:0.62,tch:1.50,r:1.28, w:{sentinel:62,ambusher:24,hunter:14},
      sig:{sway:0.08,swayF:0.5,harry:0,lunge:null,pace:58,leash:370}},
     {n:'Silt Brood',    inf:{id:'poison',dur:6.0},hp:0.44,spd:1.24,tch:0.64,r:0.68, w:{pack:68,roamer:20,ambusher:12},
      sig:{sway:0.90,swayF:4.6,commit:26,harry:44,flank:100,collapse:134,lunge:null}}],
  s:[{n:'Voice Under Water',inf:{id:'chill',dur:5.5}, hp:1.22,spd:0.80,bd:1.20,r:1.04, w:{sentinel:52,skirmisher:30,roamer:18}},
     {n:'Fen Weeper',        inf:{id:'curse',dur:6.5}, hp:1.16,spd:0.86,bd:1.18,r:1.02, rof:0.94, w:{skirmisher:52,sentinel:32,roamer:16}},
     {n:'Pipe of Drowned Air',inf:{id:'poison',dur:6.5},hp:1.30,spd:0.72,bd:1.24,r:1.08, rof:1.22, w:{sentinel:62,roamer:22,skirmisher:16}}]},

 // 6 THE SHATTERED VAULT (Stonebrow Rise, gone wrong)
 {c:[{n:'Warden Unmade',inf:{id:'stun',dur:0.9},  hp:2.00,spd:0.76,tch:1.38,r:1.20, w:{sentinel:64,hunter:24,ambusher:12},
      sig:{sway:0.10,swayF:0.7,harry:0,lunge:null,pace:90,leash:440}},
     {n:'The Doorless',  inf:{id:'stun',dur:1.0},  hp:2.25,spd:0.70,tch:1.50,r:1.28, w:{sentinel:70,hunter:22,ambusher:8},
      sig:{sway:0.08,swayF:0.6,harry:0,lunge:null,pace:84,leash:460}},
     {n:'Dust of Masons',   inf:{id:'bleed',dur:3.0}, hp:0.50,spd:1.30,tch:0.70,r:0.70, w:{pack:64,roamer:24,skirmisher:12},
      sig:{sway:0.86,swayF:4.4,commit:30,harry:48,flank:104,collapse:138,lunge:null}}],
  s:[{n:'The Quarry That Chews',inf:{id:'stun',dur:0.9}, hp:1.42,spd:0.68,bd:1.42,r:1.12, rof:1.32, w:{sentinel:68,roamer:18,skirmisher:14}},
     {n:'Slate Weeper',      inf:{id:'shock',dur:2.8}, hp:1.24,spd:0.88,bd:1.26,r:1.04, rof:0.94, w:{skirmisher:50,sentinel:32,hunter:18}},
     {n:'Keystone Screamer',  inf:{id:'weak',dur:4.5},  hp:1.34,spd:0.78,bd:1.30,r:1.08, rof:1.10, w:{sentinel:60,skirmisher:24,roamer:16}}]},

 // 7 THE ASHEN KEEP (Cinderwatch, gone wrong)
 {c:[{n:'Skinless Leaper',inf:{id:'burn',dur:4.5},  hp:0.92,spd:1.16,tch:1.24,r:0.98, w:{hunter:40,ambusher:28,pack:20,roamer:12},
      sig:{sway:0.48,swayF:2.8,commit:88,harry:94,lunge:{min:120,max:330,mul:3.2,dur:0.38,cd:1.8}}},
     {n:'Cinder-Welded Guard',   inf:{id:'burn',dur:5.5},  hp:1.86,spd:0.90,tch:1.42,r:1.18, w:{sentinel:50,hunter:34,pack:12,ambusher:4},
      sig:{sway:0.20,swayF:1.1,commit:80,harry:0,lunge:{min:110,max:240,mul:2.3,dur:0.38,cd:2.5}}},
     {n:'Ash Brood',inf:{id:'burn',dur:3.5},hp:0.46,spd:1.40,tch:0.68,r:0.68, w:{pack:66,roamer:22,skirmisher:12},
      sig:{sway:0.94,swayF:4.8,commit:26,harry:42,flank:98,collapse:130,lunge:null}}],
  s:[{n:'The Pyre That Speaks', inf:{id:'burn',dur:6.0},  hp:1.28,spd:0.92,bd:1.30,r:1.04, w:{sentinel:52,skirmisher:30,hunter:18}},
     {n:'Bellows Weeper',    inf:{id:'burn',dur:5.5},  hp:1.18,spd:1.00,bd:1.24,r:1.00, rof:0.86, w:{skirmisher:58,hunter:22,sentinel:20}},
     {n:'Chanter of Ash',   inf:{id:'curse',dur:5.5}, hp:1.24,spd:0.88,bd:1.26,r:1.04, rof:1.06, w:{sentinel:54,skirmisher:28,roamer:18}}]},

 // 8 THE CORE SANCTUM (The Ashfall, gone wrong)
 {c:[{n:'Revenant Unending',inf:{id:'burn',dur:5.5},hp:1.74,spd:0.94,tch:1.36,r:1.12, w:{hunter:52,sentinel:26,pack:14,roamer:8},
      sig:{sway:0.22,swayF:1.1,commit:60,harry:0,lunge:{min:110,max:230,mul:2.0,dur:0.40,cd:3.0}}},
     {n:'The Devout',       inf:{id:'curse',dur:6.0}, hp:1.20,spd:1.16,tch:1.16,r:1.02, w:{pack:56,hunter:26,ambusher:18},
      sig:{sway:0.50,swayF:2.8,harry:78,flank:150,collapse:202,lunge:{min:100,max:270,mul:2.9,dur:0.28,cd:1.6}}},
     {n:'Last Colossus',    inf:{id:'burn',dur:7.0},  hp:2.90,spd:0.72,tch:1.82,r:1.42, w:{sentinel:52,hunter:40,ambusher:8},
      sig:{sway:0.08,swayF:0.6,commit:110,harry:0,lunge:{min:140,max:320,mul:2.5,dur:0.50,cd:3.4}}}],
  s:[{n:'The Rift That Opens', inf:{id:'curse',dur:7.0}, hp:1.36,spd:0.90,bd:1.46,r:1.04, w:{skirmisher:50,sentinel:32,hunter:18}},
     {n:'Herald Flayed',     inf:{id:'burn',dur:6.5},  hp:1.42,spd:0.86,bd:1.48,r:1.08, rof:0.82, w:{skirmisher:48,sentinel:34,hunter:18}},
     {n:'Cantor of the End',inf:{id:'curse',dur:7.5}, hp:1.30,spd:0.94,bd:1.40,r:1.02, rof:0.88, w:{skirmisher:54,sentinel:28,hunter:18}}]},
 // 9 THE CAIRNWORKS (Lv11-15) -- the quarry rise. Added when band 9 was created; without a row
 // here the merge loop's `if(!A||!B) continue` skipped it in silence and the zone shipped with
 // 3 chasers / 2 shooters against 7+/7+ everywhere else. Quarry crews and the stone itself.
 {c:[{n:'The Unmeasured',  inf:{id:'curse',dur:4.8}, hp:1.30,spd:0.92,tch:1.08,r:1.04, w:{ambusher:50,sentinel:30,roamer:20},
      sig:{sway:0.26,swayF:1.2,harry:0,lunge:null,breakoff:1.7,rehide:240}},
     {n:'Cut Wrong',       inf:{id:'bleed',dur:4.2}, hp:1.14,spd:1.02,tch:1.04,r:0.98, w:{ambusher:54,pack:28,hunter:18},
      sig:{sway:0.54,swayF:2.7,harry:62,lunge:{min:94,max:236,mul:2.7,dur:0.27,cd:1.9}}}],
  s:[{n:'The Tally Wrong', inf:{id:'curse',dur:5.0}, hp:1.06,spd:0.90,bd:1.06,r:1.00, rof:0.98, w:{skirmisher:54,sentinel:30,roamer:16}},
     {n:'Chisel Choir',    inf:{id:'stun',dur:0.7},  hp:1.14,spd:0.82,bd:1.10,r:1.04, rof:1.16, w:{sentinel:60,skirmisher:26,roamer:14}}]},
];
for(let _b=0;_b<MOBSPEC.length;_b++){
  const A=MOBSPEC[_b], B=MOBSPEC_NIGHT[_b]; if(!A||!B) continue;
  A.d=A.d||{};
  if(B.c) A.d.c=(A.d.c||[]).concat(B.c);
  if(B.s) A.d.s=(A.d.s||[]).concat(B.s);
}

// ---- ONE ROSTER PER DUNGEON (user, 2026-07-27: "each dungeon should have its own set of mobs") --
// The dungeon pool was keyed to the TERRAIN BAND, and a boss's dungeon has nothing to do with the
// terrain band its index happens to land on: the Windward Roost -- a lighthouse crag full of birds
// -- was spawning Wolfwood wolves, and three dungeons past band 8 all shared the Ashfall's list.
// Keyed to the boss's RING now, which is the dungeon's own identity, so the Saltworks is brine and
// drowned sailors, Marrow Chapel is bone and choir, and the Roost is wings.
//
// Six chasers and six shooters each. They still rhyme with the overworld -- every dungeon has its
// heavy, its swarm, its lurker, its slinger and its caster -- but not one of them walks the surface.
const DUNSPEC=[
 // 0 THE HEARTWOOD HOLLOW -- inside the Grovewarden. Living wood that has grown through people.
 {c:[{n:'Starving Hound',      inf:{id:'bleed',dur:4.0}, hp:1.06,spd:1.10,tch:1.08,r:1.00, w:{pack:52,hunter:28,ambusher:20},
      sig:{sway:0.52,swayF:2.6,harry:72,lunge:{min:100,max:250,mul:2.6,dur:0.30,cd:2.0}}},
     {n:'Sapling of Fingers',  inf:{id:'poison',dur:5.0},hp:0.72,spd:1.14,tch:0.82,r:0.82, w:{pack:58,roamer:26,ambusher:16},
      sig:{sway:0.70,swayF:3.4,commit:38,harry:58,flank:114,collapse:152,lunge:null}},
     {n:'Warden Flayed',       inf:{id:'weak',dur:5.0},  hp:1.70,spd:0.80,tch:1.30,r:1.16, w:{sentinel:60,hunter:26,ambusher:14},
      sig:{sway:0.12,swayF:0.7,harry:0,lunge:null,pace:70,leash:400}},
     {n:'Heartwood Knot',      inf:{id:'poison',dur:6.0},hp:1.88,spd:0.54,tch:1.34,r:1.22, w:{sentinel:70,ambusher:20,roamer:10},
      sig:{sway:0.06,swayF:0.5,harry:0,lunge:null,pace:48,leash:300}},
     {n:'Grafted Thing',       inf:{id:'bleed',dur:5.0}, hp:1.24,spd:0.98,tch:1.14,r:1.04, w:{ambusher:56,hunter:26,pack:18},
      sig:{sway:0.30,swayF:1.6,commit:120,harry:0,breakoff:1.9,rehide:270,lunge:null}},
     {n:'Bark Chorus',         inf:{id:'weak',dur:4.5},  hp:0.50,spd:1.22,tch:0.68,r:0.70, w:{pack:66,roamer:22,ambusher:12},
      sig:{sway:0.86,swayF:4.4,commit:28,harry:46,flank:104,collapse:138,lunge:null}}],
  s:[{n:'The Grove That Watches',inf:{id:'weak',dur:5.5},hp:1.18,spd:0.90,bd:1.10,r:1.02, w:{sentinel:50,skirmisher:32,roamer:18}},
     {n:'Bramble Weeper',      inf:{id:'poison',dur:5.5},hp:1.08,spd:0.96,bd:1.04,r:0.98, rof:0.88, w:{skirmisher:56,roamer:26,sentinel:18}},
     {n:'Seed of Mouths',      inf:{id:'curse',dur:5.0}, hp:1.24,spd:0.82,bd:1.14,r:1.06, rof:1.14, w:{sentinel:58,skirmisher:26,roamer:16}},
     {n:'Sap-Choked Priest',   inf:{id:'poison',dur:6.0},hp:1.30,spd:0.76,bd:1.18,r:1.08, rof:1.22, w:{sentinel:64,roamer:20,skirmisher:16}},
     {n:'Root-Speaker Flayed', inf:{id:'weak',dur:6.0},  hp:1.14,spd:0.94,bd:1.08,r:1.00, rof:0.92, w:{skirmisher:54,sentinel:30,roamer:16}},
     {n:'Thorncaster',         inf:{id:'bleed',dur:4.5}, hp:1.00,spd:1.06,bd:1.02,r:0.96, rof:0.84, w:{skirmisher:62,roamer:24,hunter:14}}]},

 // 1 THE FOGBOUND GLADE -- inside the Mistantler. You are never sure what you are looking at.
 {c:[{n:'Two-Headed Wolf',     inf:{id:'bleed',dur:4.5}, hp:1.02,spd:1.22,tch:1.16,r:1.02, w:{pack:68,ambusher:20,hunter:12},
      sig:{sway:0.48,swayF:2.8,harry:84,flank:158,collapse:212,lunge:{min:110,max:300,mul:3.0,dur:0.30,cd:1.7}}},
     {n:'Stag of Nails',       inf:{id:'curse',dur:5.0}, hp:1.56,spd:0.98,tch:1.32,r:1.16, w:{hunter:56,sentinel:26,roamer:18},
      sig:{sway:0.18,swayF:0.9,commit:170,harry:0,lunge:{min:150,max:380,mul:3.4,dur:0.46,cd:3.0}}},
     {n:'The Empty Pelt',      inf:{id:'chill',dur:4.0}, hp:0.68,spd:1.32,tch:0.84,r:0.84, w:{pack:60,roamer:24,ambusher:16},
      sig:{sway:0.74,swayF:3.6,commit:34,harry:62,flank:118,collapse:156,lunge:null}},
     {n:'Thing in the Fog',    inf:{id:'weak',dur:5.0},  hp:1.30,spd:0.90,tch:1.18,r:1.06, w:{ambusher:66,sentinel:20,hunter:14},
      sig:{sway:0.34,swayF:1.5,commit:140,harry:0,breakoff:2.1,rehide:300,lunge:null}},
     {n:'Antler Crawler',      inf:{id:'bleed',dur:4.0}, hp:1.10,spd:1.04,tch:1.06,r:1.00, w:{pack:48,ambusher:30,roamer:22},
      sig:{sway:0.62,swayF:3.0,harry:74,lunge:{min:100,max:250,mul:2.7,dur:0.28,cd:1.9}}},
     {n:'Hoofmark Swarm',      inf:{id:'chill',dur:3.5}, hp:0.46,spd:1.34,tch:0.64,r:0.68, w:{pack:70,roamer:20,skirmisher:10},
      sig:{sway:0.92,swayF:4.8,commit:26,harry:42,flank:98,collapse:132,lunge:null}}],
  s:[{n:'Howl With No Throat', inf:{id:'weak',dur:5.0},  hp:1.14,spd:0.94,bd:1.12,r:1.00, w:{sentinel:48,skirmisher:34,roamer:18}},
     {n:'Antler Weeper',       inf:{id:'curse',dur:6.0}, hp:1.20,spd:0.90,bd:1.16,r:1.02, rof:0.92, w:{skirmisher:50,sentinel:32,roamer:18}},
     {n:'Whistling Wound',     inf:{id:'chill',dur:4.5}, hp:1.26,spd:0.82,bd:1.14,r:1.06, rof:1.18, w:{sentinel:58,skirmisher:26,roamer:16}},
     {n:'False Light',         inf:{id:'curse',dur:4.0}, hp:0.90,spd:1.14,bd:0.98,r:0.92, rof:0.80, w:{skirmisher:66,roamer:22,hunter:12}},
     {n:'Cairn That Speaks',   inf:{id:'weak',dur:5.5},  hp:1.34,spd:0.72,bd:1.22,r:1.10, rof:1.26, w:{sentinel:66,roamer:20,skirmisher:14}},
     {n:'Mist Piper',          inf:{id:'chill',dur:5.0}, hp:1.16,spd:0.92,bd:1.10,r:1.00, rof:1.04, w:{sentinel:52,skirmisher:30,roamer:18}}]},

 // 2 THE SUNKEN WARREN -- burrows under standing water. Everything here comes from below.
 {c:[{n:'Bloated Lurker',      inf:{id:'poison',dur:6.0},hp:1.44,spd:0.88,tch:1.32,r:1.10, w:{ambusher:58,sentinel:24,hunter:18},
      sig:{sway:0.62,swayF:1.6,commit:140,breakoff:2.0,rehide:270,harry:0}},
     {n:'Colossus of Bones',   inf:{id:'poison',dur:7.0},hp:2.10,spd:0.62,tch:1.50,r:1.28, w:{sentinel:62,ambusher:24,hunter:14},
      sig:{sway:0.08,swayF:0.5,harry:0,lunge:null,pace:58,leash:370}},
     {n:'Silt Brood',          inf:{id:'poison',dur:6.0},hp:0.44,spd:1.24,tch:0.64,r:0.68, w:{pack:68,roamer:20,ambusher:12},
      sig:{sway:0.90,swayF:4.6,commit:26,harry:44,flank:100,collapse:134,lunge:null}},
     {n:'Warren Digger',       inf:{id:'bleed',dur:5.0}, hp:1.18,spd:1.02,tch:1.14,r:1.02, w:{ambusher:64,pack:22,hunter:14},
      sig:{sway:0.28,swayF:1.7,commit:130,harry:0,breakoff:1.8,rehide:260,lunge:null}},
     {n:'Drowned Burrower',    inf:{id:'chill',dur:5.5}, hp:1.62,spd:0.72,tch:1.30,r:1.16, w:{sentinel:58,ambusher:28,hunter:14},
      sig:{sway:0.12,swayF:0.7,harry:0,lunge:null,pace:62,leash:380}},
     {n:'Thing With Too Many Legs',inf:{id:'poison',dur:5.5},hp:0.78,spd:1.20,tch:0.90,r:0.86, w:{pack:56,ambusher:28,roamer:16},
      sig:{sway:0.80,swayF:4.0,commit:32,harry:54,flank:110,collapse:146,lunge:null}}],
  s:[{n:'Voice Under Water',   inf:{id:'chill',dur:5.5}, hp:1.22,spd:0.80,bd:1.20,r:1.04, w:{sentinel:52,skirmisher:30,roamer:18}},
     {n:'Fen Weeper',          inf:{id:'curse',dur:6.5}, hp:1.16,spd:0.86,bd:1.18,r:1.02, rof:0.94, w:{skirmisher:52,sentinel:32,roamer:16}},
     {n:'Pipe of Drowned Air', inf:{id:'poison',dur:6.5},hp:1.30,spd:0.72,bd:1.24,r:1.08, rof:1.22, w:{sentinel:62,roamer:22,skirmisher:16}},
     {n:'Silt Oracle',         inf:{id:'curse',dur:6.0}, hp:1.10,spd:0.94,bd:1.12,r:0.98, rof:0.90, w:{skirmisher:56,sentinel:28,roamer:16}},
     {n:'Warren Chanter',      inf:{id:'poison',dur:7.0},hp:1.26,spd:0.78,bd:1.22,r:1.06, rof:1.10, w:{sentinel:58,skirmisher:26,roamer:16}},
     {n:'Spitter in the Dark',  inf:{id:'poison',dur:5.0},hp:1.02,spd:1.00,bd:1.06,r:0.96, rof:0.86, w:{skirmisher:60,roamer:24,hunter:16}}]},

 // 3 THE SHATTERED VAULT -- inside Stonefist. Masonry that remembers being a building.
 {c:[{n:'Warden Unmade',       inf:{id:'stun',dur:0.9},  hp:2.00,spd:0.76,tch:1.38,r:1.20, w:{sentinel:64,hunter:24,ambusher:12},
      sig:{sway:0.10,swayF:0.7,harry:0,lunge:null,pace:90,leash:440}},
     {n:'The Doorless',        inf:{id:'stun',dur:1.0},  hp:2.25,spd:0.70,tch:1.50,r:1.28, w:{sentinel:70,hunter:22,ambusher:8},
      sig:{sway:0.08,swayF:0.6,harry:0,lunge:null,pace:84,leash:460}},
     {n:'Dust of Masons',      inf:{id:'bleed',dur:3.0}, hp:0.50,spd:1.30,tch:0.70,r:0.70, w:{pack:64,roamer:24,skirmisher:12},
      sig:{sway:0.86,swayF:4.4,commit:30,harry:48,flank:104,collapse:138,lunge:null}},
     {n:'Vault Crawler',       inf:{id:'bleed',dur:4.0}, hp:1.28,spd:0.98,tch:1.14,r:1.04, w:{ambusher:58,hunter:26,pack:16},
      sig:{sway:0.30,swayF:1.7,commit:120,harry:0,breakoff:1.9,rehide:270,lunge:null}},
     {n:'Buttress Hulk',       inf:{id:'stun',dur:1.1},  hp:2.45,spd:0.66,tch:1.58,r:1.32, w:{sentinel:68,hunter:26,ambusher:6},
      sig:{sway:0.06,swayF:0.5,harry:0,lunge:null,pace:80,leash:470}},
     {n:'Rubble Skitter',      inf:{id:'bleed',dur:3.5}, hp:0.56,spd:1.34,tch:0.76,r:0.72, w:{pack:62,roamer:24,skirmisher:14},
      sig:{sway:0.82,swayF:4.4,commit:32,harry:56,flank:112,collapse:148,lunge:{min:80,max:200,mul:2.6,dur:0.22,cd:1.4}}}],
  s:[{n:'The Quarry That Chews',inf:{id:'stun',dur:0.9}, hp:1.42,spd:0.68,bd:1.42,r:1.12, rof:1.32, w:{sentinel:68,roamer:18,skirmisher:14}},
     {n:'Slate Weeper',        inf:{id:'shock',dur:2.8}, hp:1.24,spd:0.88,bd:1.26,r:1.04, rof:0.94, w:{skirmisher:50,sentinel:32,hunter:18}},
     {n:'Keystone Screamer',   inf:{id:'weak',dur:4.5},  hp:1.34,spd:0.78,bd:1.30,r:1.08, rof:1.10, w:{sentinel:60,skirmisher:24,roamer:16}},
     {n:'Plumbline Adept',     inf:{id:'shock',dur:3.0}, hp:1.18,spd:0.92,bd:1.22,r:1.00, rof:0.88, w:{skirmisher:56,sentinel:28,roamer:16}},
     {n:'Mortar Flinger',      inf:{id:'stun',dur:0.8},  hp:1.48,spd:0.64,bd:1.46,r:1.14, rof:1.36, w:{sentinel:70,roamer:18,skirmisher:12}},
     {n:'Vaultlight Cantor',   inf:{id:'curse',dur:5.0}, hp:1.22,spd:0.86,bd:1.20,r:1.02, rof:1.00, w:{sentinel:54,skirmisher:30,roamer:16}}]},

 // 4 THE WINDWARD ROOST -- inside the Gullwind Harrier. Wings, and a long way down.
 {c:[{n:'Skinned Skua',        inf:{id:'bleed',dur:3.5}, hp:0.80,spd:1.30,tch:1.14,r:0.90, w:{ambusher:52,roamer:28,hunter:20},
      sig:{sway:0.66,swayF:3.0,commit:66,harry:90,lunge:{min:120,max:310,mul:3.1,dur:0.32,cd:1.9},breakoff:1.7,rehide:250}},
     {n:'Roostling Swarm',     inf:{id:'bleed',dur:3.0}, hp:0.44,spd:1.42,tch:0.66,r:0.66, w:{pack:70,roamer:20,skirmisher:10},
      sig:{sway:0.94,swayF:5.0,commit:24,harry:40,flank:96,collapse:128,lunge:null}},
     {n:'Broken-Winged Thing', inf:{id:'bleed',dur:4.5}, hp:1.34,spd:0.86,tch:1.20,r:1.08, w:{sentinel:50,ambusher:30,hunter:20},
      sig:{sway:0.24,swayF:1.2,harry:0,lunge:null,pace:72}},
     {n:'Crag Stalker',        inf:{id:'bleed',dur:5.0}, hp:1.16,spd:1.10,tch:1.22,r:1.02, w:{ambusher:62,hunter:24,pack:14},
      sig:{sway:0.28,swayF:1.7,commit:130,harry:0,breakoff:2.0,rehide:290,lunge:null}},
     {n:'Updraft Hulk',        inf:{id:'stun',dur:0.8},  hp:2.05,spd:0.78,tch:1.42,r:1.22, w:{sentinel:60,hunter:30,ambusher:10},
      sig:{sway:0.10,swayF:0.7,harry:0,lunge:null,pace:86,leash:430}},
     {n:'Nestling',            inf:{id:'bleed',dur:3.0}, hp:0.62,spd:1.28,tch:0.80,r:0.78, w:{pack:64,roamer:22,ambusher:14},
      sig:{sway:0.80,swayF:4.0,commit:32,harry:60,flank:112,collapse:150,lunge:null}}],
  s:[{n:'Gull With No Eyes',   inf:{id:'bleed',dur:3.5}, hp:0.86,spd:1.20,bd:0.90,r:0.92, rof:0.80, w:{skirmisher:62,roamer:24,hunter:14}},
     {n:'The Gale That Screams',inf:{id:'shock',dur:2.4},hp:1.12,spd:1.02,bd:1.12,r:1.00, rof:0.84, w:{skirmisher:60,roamer:24,sentinel:16}},
     {n:'Feather Weeper',      inf:{id:'curse',dur:5.0}, hp:1.18,spd:0.92,bd:1.14,r:1.02, rof:0.96, w:{skirmisher:52,sentinel:30,roamer:18}},
     {n:'Updraft Piper',       inf:{id:'chill',dur:4.0}, hp:1.28,spd:0.80,bd:1.20,r:1.06, rof:1.22, w:{sentinel:60,skirmisher:24,roamer:16}},
     {n:'Wingbone Slinger',    inf:{id:'bleed',dur:4.0}, hp:1.22,spd:0.86,bd:1.24,r:1.04, rof:1.10, w:{sentinel:54,skirmisher:30,roamer:16}},
     {n:'Roost Cantor',        inf:{id:'weak',dur:5.0},  hp:1.14,spd:0.96,bd:1.10,r:0.98, rof:0.90, w:{skirmisher:56,sentinel:28,roamer:16}}]},

 // 5 THE SCORCH BARROWS -- burial mounds burnt open. The dead here were buried standing.
 {c:[{n:'Barrow Standing',     inf:{id:'burn',dur:5.0},  hp:1.90,spd:0.68,tch:1.40,r:1.20, w:{sentinel:68,ambusher:22,hunter:10},
      sig:{sway:0.06,swayF:0.5,harry:0,lunge:null,pace:60,leash:380}},
     {n:'Grave-Ash Hound',     inf:{id:'burn',dur:4.5},  hp:1.00,spd:1.18,tch:1.14,r:1.00, w:{pack:64,hunter:22,ambusher:14},
      sig:{sway:0.46,swayF:2.8,harry:82,flank:152,collapse:206,lunge:{min:105,max:290,mul:3.0,dur:0.32,cd:1.8}}},
     {n:'Cerement Crawler',    inf:{id:'poison',dur:5.0},hp:1.26,spd:0.92,tch:1.16,r:1.06, w:{ambusher:56,sentinel:26,hunter:18},
      sig:{sway:0.26,swayF:1.4,commit:120,harry:0,breakoff:1.8,rehide:260,lunge:null}},
     {n:'Ember Brood',         inf:{id:'burn',dur:3.5},  hp:0.46,spd:1.38,tch:0.66,r:0.68, w:{pack:68,roamer:20,skirmisher:12},
      sig:{sway:0.92,swayF:4.8,commit:26,harry:42,flank:98,collapse:132,lunge:null}},
     {n:'Mound Breaker',       inf:{id:'stun',dur:1.0},  hp:2.20,spd:0.74,tch:1.52,r:1.28, w:{sentinel:58,hunter:34,ambusher:8},
      sig:{sway:0.10,swayF:0.7,commit:150,harry:0,lunge:{min:140,max:320,mul:2.7,dur:0.44,cd:3.0}}},
     {n:'Barrow Kneeler',      inf:{id:'curse',dur:5.0}, hp:1.12,spd:1.00,tch:1.04,r:0.98, w:{ambusher:52,pack:28,roamer:20},
      sig:{sway:0.40,swayF:2.2,harry:64,lunge:{min:95,max:240,mul:2.5,dur:0.28,cd:2.0}}}],
  s:[{n:'The Pyre That Speaks',inf:{id:'burn',dur:6.0},  hp:1.28,spd:0.92,bd:1.30,r:1.04, w:{sentinel:52,skirmisher:30,hunter:18}},
     {n:'Grave-Ash Weeper',    inf:{id:'curse',dur:5.5}, hp:1.20,spd:0.88,bd:1.22,r:1.02, rof:0.94, w:{skirmisher:52,sentinel:32,roamer:16}},
     {n:'Urn Flinger',         inf:{id:'burn',dur:5.0},  hp:1.40,spd:0.70,bd:1.40,r:1.12, rof:1.30, w:{sentinel:66,roamer:20,skirmisher:14}},
     {n:'Mourner of Coals',    inf:{id:'burn',dur:5.5},  hp:1.16,spd:0.98,bd:1.20,r:1.00, rof:0.88, w:{skirmisher:58,sentinel:26,roamer:16}},
     {n:'Barrow Cantor',       inf:{id:'curse',dur:6.0}, hp:1.24,spd:0.84,bd:1.24,r:1.06, rof:1.06, w:{sentinel:56,skirmisher:28,roamer:16}},
     {n:'Ashpipe Caller',      inf:{id:'poison',dur:5.5},hp:1.10,spd:0.96,bd:1.14,r:0.98, rof:0.90, w:{skirmisher:56,roamer:26,sentinel:18}}]},

 // 6 THE CINDER CRYPT -- a crypt that kept burning. Funerary, orderly, and still alight.
 {c:[{n:'Crypt Warden',        inf:{id:'burn',dur:5.5},  hp:1.96,spd:0.76,tch:1.42,r:1.20, w:{sentinel:66,hunter:24,ambusher:10},
      sig:{sway:0.08,swayF:0.6,harry:0,lunge:null,pace:82,leash:440}},
     {n:'Niche Crawler',       inf:{id:'bleed',dur:4.5}, hp:1.20,spd:1.00,tch:1.12,r:1.02, w:{ambusher:60,hunter:24,pack:16},
      sig:{sway:0.28,swayF:1.6,commit:120,harry:0,breakoff:1.8,rehide:260,lunge:null}},
     {n:'Cinder Choir',        inf:{id:'burn',dur:4.0},  hp:0.52,spd:1.30,tch:0.70,r:0.70, w:{pack:66,roamer:22,skirmisher:12},
      sig:{sway:0.88,swayF:4.6,commit:28,harry:44,flank:102,collapse:136,lunge:null}},
     {n:'Coffin Hulk',         inf:{id:'stun',dur:1.0},  hp:2.30,spd:0.68,tch:1.54,r:1.30, w:{sentinel:70,hunter:22,ambusher:8},
      sig:{sway:0.06,swayF:0.5,harry:0,lunge:null,pace:76,leash:460}},
     {n:'Taper-Bearer',        inf:{id:'burn',dur:5.0},  hp:1.14,spd:1.06,tch:1.06,r:0.98, w:{pack:50,hunter:28,ambusher:22},
      sig:{sway:0.44,swayF:2.4,harry:70,lunge:{min:100,max:250,mul:2.6,dur:0.30,cd:2.0}}},
     {n:'Ossuary Thing',       inf:{id:'curse',dur:5.5}, hp:1.42,spd:0.86,tch:1.24,r:1.10, w:{sentinel:52,ambusher:30,hunter:18},
      sig:{sway:0.18,swayF:1.0,harry:0,lunge:null,pace:70}}],
  s:[{n:'Chanter of Ash',      inf:{id:'burn',dur:6.0},  hp:1.24,spd:0.88,bd:1.26,r:1.04, rof:1.06, w:{sentinel:54,skirmisher:28,roamer:18}},
     {n:'Crypt Weeper',        inf:{id:'curse',dur:6.0}, hp:1.18,spd:0.92,bd:1.20,r:1.02, rof:0.94, w:{skirmisher:52,sentinel:32,roamer:16}},
     {n:'Censer Flinger',      inf:{id:'poison',dur:6.0},hp:1.36,spd:0.74,bd:1.32,r:1.10, rof:1.26, w:{sentinel:64,roamer:20,skirmisher:16}},
     {n:'Reliquary Adept',     inf:{id:'burn',dur:5.5},  hp:1.20,spd:0.96,bd:1.24,r:1.00, rof:0.88, w:{skirmisher:56,sentinel:28,roamer:16}},
     {n:'Bell of Cinders',     inf:{id:'stun',dur:0.9},  hp:1.44,spd:0.70,bd:1.38,r:1.12, rof:1.30, w:{sentinel:68,roamer:18,skirmisher:14}},
     {n:'Deathmask Oracle',    inf:{id:'curse',dur:6.5}, hp:1.14,spd:1.00,bd:1.18,r:0.98, rof:0.86, w:{skirmisher:58,sentinel:26,roamer:16}}]},

 // 7 THE ASHEN KEEP -- a garrison that never stood down. These are still on duty.
 {c:[{n:'Skinless Leaper',     inf:{id:'burn',dur:4.5},  hp:0.92,spd:1.16,tch:1.24,r:0.98, w:{hunter:40,ambusher:28,pack:20,roamer:12},
      sig:{sway:0.48,swayF:2.8,commit:88,harry:94,lunge:{min:120,max:330,mul:3.2,dur:0.38,cd:1.8}}},
     {n:'Cinder-Welded Guard', inf:{id:'burn',dur:5.5},  hp:1.86,spd:0.90,tch:1.42,r:1.18, w:{sentinel:50,hunter:34,pack:12,ambusher:4},
      sig:{sway:0.20,swayF:1.1,commit:80,harry:0,lunge:{min:110,max:240,mul:2.3,dur:0.38,cd:2.5}}},
     {n:'Ash Brood',           inf:{id:'burn',dur:3.5},  hp:0.46,spd:1.40,tch:0.68,r:0.68, w:{pack:66,roamer:22,skirmisher:12},
      sig:{sway:0.94,swayF:4.8,commit:26,harry:42,flank:98,collapse:130,lunge:null}},
     {n:'Portcullis Hulk',     inf:{id:'stun',dur:1.1},  hp:2.40,spd:0.72,tch:1.58,r:1.32, w:{sentinel:64,hunter:28,ambusher:8},
      sig:{sway:0.08,swayF:0.6,commit:140,harry:0,lunge:{min:140,max:320,mul:2.6,dur:0.46,cd:3.0}}},
     {n:'Watch That Never Woke',inf:{id:'curse',dur:5.0},hp:1.44,spd:0.84,tch:1.26,r:1.12, w:{sentinel:60,ambusher:26,hunter:14},
      sig:{sway:0.14,swayF:0.8,harry:0,lunge:null,pace:74,leash:410}},
     {n:'Siege Hound',         inf:{id:'burn',dur:5.0},  hp:1.08,spd:1.22,tch:1.20,r:1.02, w:{pack:66,hunter:22,ambusher:12},
      sig:{sway:0.44,swayF:2.8,harry:86,flank:158,collapse:212,lunge:{min:110,max:305,mul:3.1,dur:0.32,cd:1.7}}}],
  s:[{n:'Bellows Weeper',      inf:{id:'burn',dur:5.5},  hp:1.18,spd:1.00,bd:1.24,r:1.00, rof:0.86, w:{skirmisher:58,hunter:22,sentinel:20}},
     {n:'Arrowslit Adept',     inf:{id:'burn',dur:5.0},  hp:1.22,spd:0.92,bd:1.28,r:1.02, rof:0.90, w:{skirmisher:56,sentinel:28,hunter:16}},
     {n:'Trebuchet Thing',     inf:{id:'stun',dur:1.0},  hp:1.52,spd:0.62,bd:1.50,r:1.16, rof:1.38, w:{sentinel:72,roamer:16,skirmisher:12}},
     {n:'Keep Cantor',         inf:{id:'curse',dur:6.0}, hp:1.26,spd:0.86,bd:1.28,r:1.04, rof:1.04, w:{sentinel:56,skirmisher:28,roamer:16}},
     {n:'Oil-Pourer',          inf:{id:'burn',dur:6.5},  hp:1.34,spd:0.78,bd:1.34,r:1.08, rof:1.20, w:{sentinel:62,skirmisher:24,roamer:14}},
     {n:'Muster Piper',        inf:{id:'weak',dur:5.0},  hp:1.14,spd:1.04,bd:1.18,r:0.98, rof:0.84, w:{skirmisher:62,roamer:22,hunter:16}}]},

 // 8 THE CORE SANCTUM -- inside the Molten Titan. The forge that made the rest of it.
 {c:[{n:'Revenant Unending',   inf:{id:'burn',dur:5.5},  hp:1.74,spd:0.94,tch:1.36,r:1.12, w:{hunter:52,sentinel:26,pack:14,roamer:8},
      sig:{sway:0.22,swayF:1.1,commit:60,harry:0,lunge:{min:110,max:230,mul:2.0,dur:0.40,cd:3.0}}},
     {n:'The Devout',          inf:{id:'curse',dur:6.0}, hp:1.20,spd:1.16,tch:1.16,r:1.02, w:{pack:56,hunter:26,ambusher:18},
      sig:{sway:0.50,swayF:2.8,harry:78,flank:150,collapse:202,lunge:{min:100,max:270,mul:2.9,dur:0.28,cd:1.6}}},
     {n:'Last Colossus',       inf:{id:'burn',dur:7.0},  hp:2.90,spd:0.72,tch:1.82,r:1.42, w:{sentinel:52,hunter:40,ambusher:8},
      sig:{sway:0.08,swayF:0.6,commit:110,harry:0,lunge:{min:140,max:320,mul:2.5,dur:0.50,cd:3.4}}},
     {n:'Crucible Brood',      inf:{id:'burn',dur:4.0},  hp:0.48,spd:1.42,tch:0.70,r:0.68, w:{pack:68,roamer:20,skirmisher:12},
      sig:{sway:0.96,swayF:5.0,commit:24,harry:40,flank:96,collapse:128,lunge:null}},
     {n:'Slag Stalker',        inf:{id:'burn',dur:6.0},  hp:1.32,spd:1.06,tch:1.28,r:1.06, w:{ambusher:58,hunter:28,pack:14},
      sig:{sway:0.26,swayF:1.6,commit:130,harry:0,breakoff:2.0,rehide:290,lunge:null}},
     {n:'Anvil Thrall',        inf:{id:'burn',dur:6.0},  hp:2.05,spd:0.82,tch:1.50,r:1.24, w:{sentinel:56,hunter:34,ambusher:10},
      sig:{sway:0.12,swayF:0.8,commit:100,harry:0,lunge:{min:120,max:270,mul:2.4,dur:0.42,cd:2.7}}}],
  s:[{n:'The Rift That Opens', inf:{id:'curse',dur:7.0}, hp:1.36,spd:0.90,bd:1.46,r:1.04, w:{skirmisher:50,sentinel:32,hunter:18}},
     {n:'Herald Flayed',       inf:{id:'burn',dur:6.5},  hp:1.42,spd:0.86,bd:1.48,r:1.08, rof:0.82, w:{skirmisher:48,sentinel:34,hunter:18}},
     {n:'Cantor of the End',   inf:{id:'curse',dur:7.5}, hp:1.30,spd:0.94,bd:1.40,r:1.02, rof:0.88, w:{skirmisher:54,sentinel:28,hunter:18}},
     {n:'Tap-Hole Adept',      inf:{id:'burn',dur:6.0},  hp:1.30,spd:0.90,bd:1.42,r:1.04, rof:0.94, w:{skirmisher:52,sentinel:30,hunter:18}},
     {n:'Ingot Flinger',       inf:{id:'stun',dur:1.0},  hp:1.56,spd:0.64,bd:1.54,r:1.16, rof:1.36, w:{sentinel:70,roamer:18,skirmisher:12}},
     {n:'Core Weeper',         inf:{id:'curse',dur:7.0}, hp:1.28,spd:0.92,bd:1.38,r:1.02, rof:0.92, w:{skirmisher:54,sentinel:30,roamer:16}}]},

 // 9 THE SALTWORKS -- inside the Tidewrack. Brine pans and the men who worked them.
 {c:[{n:'Flensed Crawler',     inf:{id:'chill',dur:3.0}, hp:0.94,spd:0.86,tch:0.90,r:0.96, w:{roamer:42,hunter:32,sentinel:26},
      sig:{sway:0.60,swayF:3.2,commit:44,harry:0,lunge:null}},
     {n:'Chitter-Shell',       inf:null,                 hp:0.62,spd:1.10,tch:0.70,r:0.78, w:{pack:56,roamer:28,hunter:16},
      sig:{sway:0.78,swayF:4.0,commit:34,harry:0,lunge:null,flank:110,collapse:148}},
     {n:'The Halfdrowned',     inf:{id:'curse',dur:4.0}, hp:1.02,spd:0.94,tch:0.92,r:0.98, w:{ambusher:50,roamer:30,sentinel:20},
      sig:{sway:0.30,swayF:1.4,harry:0,lunge:null,breakoff:1.8,rehide:250}},
     {n:'Pan-Scraper',         inf:{id:'bleed',dur:3.5}, hp:1.14,spd:0.80,tch:1.00,r:1.02, w:{sentinel:56,ambusher:26,roamer:18},
      sig:{sway:0.18,swayF:1.0,harry:0,lunge:null,pace:64}},
     {n:'Brine Hulk',          inf:{id:'chill',dur:4.5}, hp:1.72,spd:0.66,tch:1.32,r:1.20, w:{sentinel:66,ambusher:22,hunter:12},
      sig:{sway:0.08,swayF:0.6,harry:0,lunge:null,pace:56,leash:340}},
     {n:'Salt Brood',          inf:null,                 hp:0.42,spd:1.26,tch:0.60,r:0.66, w:{pack:70,roamer:20,skirmisher:10},
      sig:{sway:0.90,swayF:4.6,commit:26,harry:42,flank:98,collapse:130,lunge:null}}],
  s:[{n:'Drowning Voice',      inf:{id:'chill',dur:3.2}, hp:1.00,spd:0.84,bd:0.92,r:0.98, w:{sentinel:52,skirmisher:30,roamer:18}},
     {n:'Saltglass Weeper',    inf:{id:'curse',dur:3.5}, hp:0.92,spd:0.96,bd:0.88,r:0.94, rof:0.90, w:{skirmisher:56,roamer:26,sentinel:18}},
     {n:'Hook-Lantern',        inf:{id:'weak',dur:3.0},  hp:1.10,spd:0.74,bd:0.96,r:1.02, rof:1.20, w:{sentinel:64,roamer:22,skirmisher:14}},
     {n:'Rake-Handed Adept',   inf:{id:'bleed',dur:3.5}, hp:1.04,spd:0.90,bd:0.94,r:0.98, rof:0.96, w:{skirmisher:52,sentinel:30,roamer:18}},
     {n:'Evaporator',          inf:{id:'burn',dur:3.0},  hp:1.18,spd:0.72,bd:1.02,r:1.06, rof:1.26, w:{sentinel:66,roamer:20,skirmisher:14}},
     {n:'Foreman’s Whistle',   inf:{id:'weak',dur:3.5},  hp:0.96,spd:1.04,bd:0.90,r:0.94, rof:0.84, w:{skirmisher:62,roamer:24,hunter:14}}]},

 // 10 GULLWIND LIGHT -- inside the lighthouse. Lamps, lenses, and what they were used for.
 {c:[{n:'The Keeper’s Hands',  inf:{id:'curse',dur:4.0}, hp:1.16,spd:0.92,tch:1.00,r:1.02, w:{sentinel:48,ambusher:30,roamer:22},
      sig:{sway:0.26,swayF:1.2,harry:0,lunge:null,pace:74}},
     {n:'Rope of Necks',       inf:{id:'weak',dur:4.0},  hp:1.30,spd:0.66,tch:1.08,r:1.10, w:{sentinel:66,ambusher:22,roamer:12},
      sig:{sway:0.10,swayF:0.6,harry:0,lunge:null,pace:56,leash:320}},
     {n:'Wrecker’s Shade',     inf:{id:'chill',dur:4.0}, hp:0.88,spd:1.18,tch:0.94,r:0.92, w:{ambusher:54,roamer:28,pack:18},
      sig:{sway:0.64,swayF:3.2,harry:80,lunge:null,breakoff:1.8,rehide:260}},
     {n:'Lens Crawler',        inf:{id:'shock',dur:2.2}, hp:1.26,spd:0.90,tch:1.10,r:1.06, w:{sentinel:54,ambusher:28,hunter:18},
      sig:{sway:0.20,swayF:1.0,harry:0,lunge:null,pace:78}},
     {n:'Stair-Swarm',         inf:{id:'bleed',dur:3.0}, hp:0.48,spd:1.32,tch:0.66,r:0.68, w:{pack:68,roamer:20,skirmisher:12},
      sig:{sway:0.90,swayF:4.6,commit:26,harry:44,flank:100,collapse:134,lunge:null}},
     {n:'Oil-Drowned Hulk',    inf:{id:'burn',dur:4.0},  hp:1.78,spd:0.70,tch:1.34,r:1.20, w:{sentinel:64,hunter:24,ambusher:12},
      sig:{sway:0.10,swayF:0.7,harry:0,lunge:null,pace:66,leash:380}}],
  s:[{n:'Beacon That Screams', inf:{id:'shock',dur:2.4}, hp:1.12,spd:0.90,bd:1.02,r:1.00, w:{sentinel:54,skirmisher:30,roamer:16}},
     {n:'Fogbell Toller',      inf:{id:'weak',dur:3.8},  hp:1.06,spd:0.94,bd:0.98,r:0.98, rof:1.10, w:{sentinel:50,skirmisher:32,roamer:18}},
     {n:'Lampwright',          inf:{id:'burn',dur:4.0},  hp:1.14,spd:0.86,bd:1.06,r:1.02, rof:1.02, w:{sentinel:56,skirmisher:28,roamer:16}},
     {n:'Prism Weeper',        inf:{id:'shock',dur:2.8}, hp:1.08,spd:0.98,bd:1.02,r:0.98, rof:0.90, w:{skirmisher:56,sentinel:28,roamer:16}},
     {n:'Signal Flinger',      inf:{id:'stun',dur:0.7},  hp:1.32,spd:0.72,bd:1.20,r:1.08, rof:1.28, w:{sentinel:66,roamer:20,skirmisher:14}},
     {n:'Watchroom Cantor',    inf:{id:'curse',dur:4.5}, hp:1.16,spd:0.92,bd:1.08,r:1.00, rof:0.94, w:{skirmisher:52,sentinel:32,roamer:16}}]},

 // 11 MARROW CHAPEL -- inside the Sawgrass Reaper. A chapel, and a congregation still in it.
 {c:[{n:'Split Lurcher',       inf:{id:'poison',dur:5.0},hp:1.52,spd:0.70,tch:1.26,r:1.14, w:{ambusher:46,sentinel:32,hunter:22},
      sig:{sway:0.20,swayF:0.9,harry:0,lunge:null,breakoff:1.7,rehide:250}},
     {n:'Choir of Open Mouths',inf:{id:'curse',dur:5.0}, hp:1.34,spd:0.80,tch:1.10,r:1.06, w:{sentinel:56,ambusher:26,hunter:18},
      sig:{sway:0.14,swayF:0.8,harry:0,lunge:null,pace:66}},
     {n:'The Kneeling',        inf:{id:'weak',dur:5.5},  hp:0.60,spd:1.18,tch:0.74,r:0.74, w:{pack:64,ambusher:22,roamer:14},
      sig:{sway:0.80,swayF:4.0,commit:32,harry:50,flank:108,collapse:144,lunge:null}},
     {n:'Pew-Bound Thing',     inf:{id:'weak',dur:6.0},  hp:1.66,spd:0.62,tch:1.30,r:1.18, w:{sentinel:70,ambusher:20,roamer:10},
      sig:{sway:0.08,swayF:0.5,harry:0,lunge:null,pace:52,leash:340}},
     {n:'Marrow Crawler',      inf:{id:'bleed',dur:4.5}, hp:1.22,spd:0.98,tch:1.12,r:1.02, w:{ambusher:56,pack:26,hunter:18},
      sig:{sway:0.58,swayF:2.8,harry:66,lunge:{min:90,max:230,mul:2.6,dur:0.26,cd:1.9}}},
     {n:'Reliquary Hulk',      inf:{id:'stun',dur:0.9},  hp:2.15,spd:0.68,tch:1.46,r:1.26, w:{sentinel:68,hunter:24,ambusher:8},
      sig:{sway:0.08,swayF:0.6,harry:0,lunge:null,pace:70,leash:430}}],
  s:[{n:'Bell of Teeth',       inf:{id:'stun',dur:0.8},  hp:1.26,spd:0.74,bd:1.16,r:1.06, rof:1.24, w:{sentinel:64,roamer:20,skirmisher:16}},
     {n:'Marrow Weeper',       inf:{id:'curse',dur:5.0}, hp:1.14,spd:0.86,bd:1.10,r:1.00, rof:0.96, w:{skirmisher:50,sentinel:32,roamer:18}},
     {n:'Censer of Flies',     inf:{id:'poison',dur:6.0},hp:1.20,spd:0.78,bd:1.12,r:1.04, rof:1.08, w:{sentinel:56,skirmisher:28,roamer:16}},
     {n:'Lectern Oracle',      inf:{id:'curse',dur:5.5}, hp:1.10,spd:0.96,bd:1.08,r:0.98, rof:0.88, w:{skirmisher:58,sentinel:26,roamer:16}},
     {n:'Psalm-Flinger',       inf:{id:'weak',dur:4.5},  hp:1.34,spd:0.70,bd:1.24,r:1.10, rof:1.30, w:{sentinel:68,roamer:18,skirmisher:14}},
     {n:'Vestry Cantor',       inf:{id:'curse',dur:6.0}, hp:1.22,spd:0.84,bd:1.16,r:1.02, rof:1.00, w:{sentinel:54,skirmisher:30,roamer:16}}]},

 // 12 THE TALLY YARD -- inside the Cairnwright. A masons' yard: the crews that cut the stone, and
 // the rows they were counted into. Stone is HEAVY and stone is SLOW: this roster leans hardest of
 // the four starter dungeons on sentinels that hold ground and hit like a dropped block, with one
 // fast swarm so it cannot be kited forever. Sits between the Saltworks (Lv7) and Marrow Chapel
 // (Lv20) in every stat, because its dungeon lands around Lv16.
 {c:[{n:'Tally-Cut Hulk',    inf:{id:'stun',dur:0.9},  hp:1.72,spd:0.66,tch:1.34,r:1.20, w:{sentinel:70,hunter:20,ambusher:10},
      sig:{sway:0.08,swayF:0.5,harry:0,lunge:null,pace:58,leash:360}},
     {n:'Chiselback',        inf:{id:'bleed',dur:3.6}, hp:0.68,spd:1.22,tch:0.78,r:0.76, w:{pack:60,roamer:26,hunter:14},
      sig:{sway:0.80,swayF:4.2,commit:30,harry:56,flank:112,collapse:146,lunge:null}},
     {n:'The Unnumbered',    inf:{id:'curse',dur:4.6}, hp:1.10,spd:0.98,tch:1.02,r:0.98, w:{ambusher:54,roamer:28,sentinel:18},
      sig:{sway:0.28,swayF:1.3,harry:0,lunge:null,breakoff:1.8,rehide:250}},
     {n:'Gravel Kneeler',    inf:{id:'weak',dur:5.0},  hp:1.28,spd:0.78,tch:1.10,r:1.04, w:{sentinel:58,ambusher:26,roamer:16},
      sig:{sway:0.16,swayF:0.9,harry:0,lunge:null,pace:64}},
     {n:'Cairn That Walks',  inf:{id:'stun',dur:1.1},  hp:1.90,spd:0.60,tch:1.42,r:1.26, w:{sentinel:72,hunter:20,ambusher:8},
      sig:{sway:0.06,swayF:0.4,harry:0,lunge:null,pace:50,leash:400}},
     {n:'Splitwedge Crawler',inf:{id:'bleed',dur:4.2}, hp:1.04,spd:1.04,tch:1.06,r:0.96, w:{ambusher:52,pack:30,hunter:18},
      sig:{sway:0.56,swayF:2.7,harry:62,lunge:{min:96,max:240,mul:2.7,dur:0.27,cd:1.9}}}],
  s:[{n:'Reckoning Bell',    inf:{id:'stun',dur:0.8},  hp:1.16,spd:0.76,bd:1.10,r:1.04, rof:1.22, w:{sentinel:64,roamer:20,skirmisher:16}},
     {n:'Marker Stone',      inf:{id:'weak',dur:4.4},  hp:1.34,spd:0.68,bd:1.20,r:1.10, rof:1.32, w:{sentinel:70,roamer:18,skirmisher:12}},
     {n:'Grit Weeper',       inf:{id:'curse',dur:4.8}, hp:1.02,spd:0.92,bd:1.02,r:0.98, rof:0.94, w:{skirmisher:54,sentinel:28,roamer:18}},
     {n:'The Miscounted',    inf:{id:'curse',dur:5.2}, hp:0.94,spd:0.98,bd:0.98,r:0.94, rof:0.86, w:{skirmisher:60,sentinel:24,roamer:16}},
     {n:'Dust of the Yard',  inf:{id:'shock',dur:2.4}, hp:0.88,spd:1.18,bd:0.92,r:0.90, rof:0.78, w:{skirmisher:62,roamer:24,hunter:14}},
     {n:'Chip-Flinger',      inf:{id:'bleed',dur:4.0}, hp:1.08,spd:0.88,bd:1.06,r:1.00, rof:1.04, w:{sentinel:52,skirmisher:32,roamer:16}}]},
];

// ---- ELITES (user, 2026-07-27: "elites among the mobs that spawn more uncommonly") ----
// An elite is not a separate creature. It is one of the band's OWN species that grew: same
// silhouette, same behaviour, same ground -- bigger, tougher, and named for what it became. That
// is the point. A new monster teaches you a new thing; an elite tests what the ordinary one
// already taught you, which is why it has to be recognisably the same animal.
//
// UNCOMMON, AND DETERMINISTIC. Rolled from the spawn point, not from Math.random, so a spot keeps
// its elite across respawns exactly the way it keeps its species -- the outcrop with the Elder
// Stone Warden on it is a place you learn, not a slot machine. Bosses, nodes and summons never
// qualify: a boss is already the thing an elite is a smaller version of.
const ELITE_P = 0.075;                 // about one roaming spawn in thirteen
// Rows 0-8 are terrain bands AND boss art slots 0-8, exactly like MOBNAME/MOBTINT. Rows 9-12 are
// the starter bosses' art slots, row 13 is terrain band 9 -- BAND_ROW maps a band onto its row.
const ELITE_TITLES=[
  ['Tide-Gorged','Barnacled','Shell-Crowned'],        // 0 Landing Sands
  ['Storm-Fed','Wreck-Born','Gale-Torn'],             // 1 Gullwind Shore
  ['Fen-Swollen','Reed-Crowned','Mire-Fat'],          // 2 Sawgrass Flats
  ['Root-Knotted','Thorn-Crowned','Sap-Gorged'],      // 3 Verdant Belt
  ['Pack-Father','Scar-Muzzled','Old-Blooded'],       // 4 Wolfwood
  ['Rot-Swollen','Grave-Fat','Bog-Crowned'],          // 5 Deep Timber
  ['Granite-Cased','Quarry-Born','Stone-Crowned'],    // 6 Stonebrow Rise
  ['Slag-Cased','Ember-Crowned','Vent-Fed'],          // 7 Cinderwatch
  ['Rift-Touched','Ash-Crowned','Cinder-Fat'],        // 8 The Ashfall
  // ---- boss art slots 9-12: the starter island's dungeons ----
  ['Brine-Bloated','Net-Wound','Salt-Crusted'],       // 9  the Saltworks
  ['Lamp-Blind','Wind-Flayed','Stair-Bound'],         // 10 Gullwind Light
  ['Bone-Choired','Pew-Bound','Marrow-Fat'],          // 11 Marrow Chapel
  ['Tally-Cut','Chisel-Marked','Stone-Fed'],          // 12 the Tally Yard
  // ---- terrain band 9, where BAND_ROW sends it ----
  ['Quarry-Grown','Grit-Scarred','Spall-Crowned'],    // 13 The Cairnworks (band 9)
];
// Every multiplier here is on top of the species and the behaviour, so an elite Rubble Hulk is
// still a wall and an elite Sandfly Cloud is still a cloud -- just one you cannot ignore.
const ELITE_HP=2.9, ELITE_TCH=1.45, ELITE_BD=1.45, ELITE_R=1.24, ELITE_SPD=1.05, ELITE_DEF=1.35;
function eliteRoll(sp){
  if(!sp) return false;
  // its own hash constants: sharing them with the species or behaviour picker would correlate
  // "is elite" with "is a wolf", and every elite in the world would be the same creature.
  const h=(Math.imul(sp.x|0,2654435761)+Math.imul(sp.y|0,1597334677))>>>0;
  return (((h^(h>>>16))>>>0)%1000) < Math.round(ELITE_P*1000);
}
// BAND, THROUGH THE SAME INDIRECTION MOBNAME/MOBTINT USE. This clamped to ELITE_TITLES.length-1,
// so terrain band 9 (The Cairnworks, Lv11-15) and all four starter dungeons -- whose _bd reaches
// a boss ART SLOT as high as 12 -- were handed row 8, the Lv50 Ashfall crown-titles. A quarry
// elite called "Rift-Touched" at Lv12. 09_sprites.js:634 fixed exactly this collision for
// MOBNAME/MOBTINT with BAND_ROW and the fix was never applied here.
function eliteTitle(band,sp){
  let bi=band|0;
  if(typeof BAND_ROW!=='undefined' && BAND_ROW[bi]!==undefined) bi=BAND_ROW[bi];
  const T=ELITE_TITLES[bi]||ELITE_TITLES[Math.max(0,Math.min(ELITE_TITLES.length-1,band|0))]||ELITE_TITLES[0];
  const h=(Math.imul(sp?sp.x|0:1,374761393)+Math.imul(sp?sp.y|0:1,2246822519))>>>0;
  return T[((h^(h>>>11))>>>0)%T.length];
}
function makeElite(e,sp){
  e.elite=1;
  e.hp*=ELITE_HP; e.spd*=ELITE_SPD;
  if(e.touch) e.touch*=ELITE_TCH;
  if(e.bd) e.bd*=ELITE_BD;
  e.r=Math.round(e.r*ELITE_R);
  if(e.def){ e.def=Math.round(e.def*ELITE_DEF); if(typeof eDR==='function') e.dr=eDR(e.def); }
  // the name carries it, because the health bar is the last place you want to learn this
  if(e.spn) e.spn=eliteTitle(e.band,sp)+' '+e.spn;
  return e;
}
// ---- ARCHETYPES (user, 2026-07-27: "make sure all the mobs and elites also have sprites") ----
// 99 species were sharing TWO sprites -- one hound for every chaser in the game and one cultist
// for every shooter -- tinted by band. A crab, a swarm of flies, a stone golem and a walking briar
// were all the same dog.
//
// Ninety-nine bespoke sets is the wrong answer: at the 44px these render at, most of that detail
// is noise, and it is hours of generation for silhouettes nobody can tell apart. What actually
// reads at this size is the SHAPE. So the roster maps onto ten archetypes, each with its own
// sprite, still tinted per band -- ninety distinct looks, and a crab now looks like a crab.
// Anything not listed falls back to its type's archetype, so a new species without an entry
// degrades to exactly today's behaviour rather than to a blank.
const MOB_ARCH={
  // These ten had no row and fell through mobArch()'s beast/caster default. Six really are
  // hounds and the fallback was right for them -- named explicitly so the integrity check can
  // tell "deliberately generic" from "forgotten". The other four are not: Sunken Warden is a
  // 1.70hp/1.18r sentinel and Sanctum Devout a heavy, and both were rendering as the hound.
  'Briar Hound':'beast',
  'Fogbound Hound':'beast',
  'Magma Hound':'beast',
  'Mist-Blind Pup':'beast',
  'Dire Wolf':'beast',
  'Yearling Wolf':'beast',
  'Crag Leaper':'boar',
  'Heartwood Thrall':'husk',
  'Sanctum Devout':'acolyte',
  'Sunken Warden':'golem',
  // DEDUPED. 38 keys were declared twice and 37 of them DISAGREED, so which archetype a
  // creature wore was decided by lexical position in an object literal -- a reorder or a merge
  // would have silently flipped 37 species. The earlier, generic "shooter silhouette" entry
  // was removed and the later thematic one kept, which is exactly what the engine already
  // rendered (last key wins), so nothing changes on screen. 17m_integrity now fails on this.
  // per-dungeon rosters
  // The Cairnworks band-9 expansion rows (MOBSPEC_MORE / _MORE2 / _NIGHT)
  'Sledge Drudge':'golem',
  'Scree Scuttler':'crab',
  'Grit Flinger':'slinger',
  'Chalkline Caller':'shaman',
  'Quarry Revenant':'husk',
  'Dust Cantor':'acolyte',
  'Bank Collapser':'golem',
  'Plumbline Seer':'wisp',
  'Toolmarked Thing':'crab',
  'Kiln Whisperer':'shaman',
  'The Unmeasured':'husk',
  'Cut Wrong':'crab',
  'The Tally Wrong':'acolyte',
  'Chisel Choir':'wisp',
  // The Cairnworks, terrain band 9 (overworld + its dungeon fallback pool)
  'Grit Crawler':'crab',
  'Spall Skitter':'crab',
  'Yard Lurcher':'golem',
  'Shard Spitter':'slinger',
  'Wedge Lobber':'slinger',
  'Cairn Shade':'wisp',
  'Dust Warden':'shaman',
  // The Tally Yard (boss 12). Every species here needs a row or mobArch() drops it to the
  // hound/cultist fallback -- silently, and it looks fine until you notice the whole dungeon
  // is two silhouettes. Stone leans on golem; the yard crews are husks; the grit is a swarm.
  'Tally-Cut Hulk':'golem',
  'Chiselback':'crab',
  'The Unnumbered':'husk',
  'Gravel Kneeler':'husk',
  'Cairn That Walks':'golem',
  'Splitwedge Crawler':'crab',
  'Reckoning Bell':'wisp',
  'Marker Stone':'golem',
  'Grit Weeper':'shaman',
  'The Miscounted':'acolyte',
  'Dust of the Yard':'swarm',
  'Chip-Flinger':'slinger',
  'Antler Crawler':'crab',
  'Cerement Crawler':'crab',
  'Grafted Thing':'crab',
  'Lens Crawler':'crab',
  'Marrow Crawler':'crab',
  'Niche Crawler':'crab',
  'Pan-Scraper':'crab',
  'Rubble Skitter':'crab',
  'Salt Brood':'crab',
  'Thing With Too Many Legs':'crab',
  'Vault Crawler':'crab',
  'Warren Digger':'crab',
  'Bark Chorus':'swarm',
  'Cinder Choir':'swarm',
  'Crucible Brood':'swarm',
  'Ember Brood':'swarm',
  'Hoofmark Swarm':'swarm',
  'Roostling Swarm':'swarm',
  'Stair-Swarm':'swarm',
  'Broken-Winged Thing':'bird',
  'Nestling':'bird',
  'Wrecker’s Shade':'bird',
  'Barrow Kneeler':'husk',
  'Barrow Standing':'husk',
  'Crag Stalker':'husk',
  'Drowned Burrower':'husk',
  'Ossuary Thing':'husk',
  'Pew-Bound Thing':'husk',
  'Slag Stalker':'husk',
  'Taper-Bearer':'husk',
  'Thing in the Fog':'husk',
  'Watch That Never Woke':'husk',
  'Anvil Thrall':'golem',
  'Brine Hulk':'golem',
  'Buttress Hulk':'golem',
  'Coffin Hulk':'golem',
  'Crypt Warden':'golem',
  'Heartwood Knot':'golem',
  'Mound Breaker':'golem',
  'Oil-Drowned Hulk':'golem',
  'Portcullis Hulk':'golem',
  'Reliquary Hulk':'golem',
  'Updraft Hulk':'golem',
  'Grave-Ash Hound':'boar',
  'Siege Hound':'boar',
  'Ashpipe Caller':'slinger',
  'Bell of Cinders':'slinger',
  'Cairn That Speaks':'slinger',
  'Censer Flinger':'slinger',
  'Evaporator':'slinger',
  'Ingot Flinger':'slinger',
  'Lampwright':'slinger',
  'Mortar Flinger':'slinger',
  'Oil-Pourer':'slinger',
  'Psalm-Flinger':'slinger',
  'Sap-Choked Priest':'slinger',
  'Signal Flinger':'slinger',
  'Trebuchet Thing':'slinger',
  'Updraft Piper':'slinger',
  'Urn Flinger':'slinger',
  'Wingbone Slinger':'slinger',
  'Deathmask Oracle':'shaman',
  'False Light':'shaman',
  'Foreman’s Whistle':'shaman',
  'Lectern Oracle':'shaman',
  'Mourner of Coals':'shaman',
  'Muster Piper':'shaman',
  'Rake-Handed Adept':'shaman',
  'Root-Speaker Flayed':'shaman',
  'Silt Oracle':'shaman',
  'Spitter in the Dark':'shaman',
  'The Gale That Screams':'shaman',
  'Thorncaster':'shaman',
  'Arrowslit Adept':'acolyte',
  'Barrow Cantor':'acolyte',
  'Core Weeper':'acolyte',
  'Crypt Weeper':'acolyte',
  'Feather Weeper':'acolyte',
  'Grave-Ash Weeper':'acolyte',
  'Keep Cantor':'acolyte',
  'Plumbline Adept':'acolyte',
  'Prism Weeper':'acolyte',
  'Reliquary Adept':'acolyte',
  'Roost Cantor':'acolyte',
  'Tap-Hole Adept':'acolyte',
  'Vaultlight Cantor':'acolyte',
  'Vestry Cantor':'acolyte',
  'Warren Chanter':'acolyte',
  'Watchroom Cantor':'acolyte',
  // the nightmare roster
  'Chitter-Shell':'crab',
  'Dust of Masons':'crab',
  'Flensed Crawler':'crab',
  'Silt Brood':'crab',
  'Split Lurcher':'crab',
  'Bloated Lurker':'husk',
  'Choir of Open Mouths':'husk',
  'Cinder-Welded Guard':'husk',
  'Revenant Unending':'husk',
  'The Devout':'husk',
  'The Halfdrowned':'husk',
  'The Keeper’s Hands':'husk',
  'Warden Flayed':'husk',
  'Antler Weeper':'wisp',
  'Beacon That Screams':'wisp',
  'Bell of Teeth':'wisp',
  'Bellows Weeper':'wisp',
  'Bramble Weeper':'wisp',
  'Drowning Voice':'wisp',
  'Fen Weeper':'wisp',
  'Fogbell Toller':'wisp',
  'Herald Flayed':'wisp',
  'Howl With No Throat':'wisp',
  'Marrow Weeper':'wisp',
  'Saltglass Weeper':'wisp',
  'Slate Weeper':'wisp',
  'The Empty Pelt':'wisp',
  'The Grove That Watches':'wisp',
  'The Pyre That Speaks':'wisp',
  'The Quarry That Chews':'wisp',
  'The Rift That Opens':'wisp',
  'Voice Under Water':'wisp',
  'Gull With No Eyes':'bird',
  'Skinned Skua':'bird',
  'Skinless Leaper':'boar',
  'Stag of Nails':'boar',
  'Starving Hound':'boar',
  'Two-Headed Wolf':'boar',
  'Colossus of Bones':'golem',
  'Last Colossus':'golem',
  'The Doorless':'golem',
  'Warden Unmade':'golem',
  'Rope of Necks':'plant',
  'Sapling of Fingers':'plant',
  'Seed of Mouths':'plant',
  'Ash Brood':'swarm',
  'The Kneeling':'swarm',
  'Censer of Flies':'slinger',
  'Hook-Lantern':'slinger',
  'Pipe of Drowned Air':'slinger',
  'Whistling Wound':'slinger',
  'Cantor of the End':'acolyte',
  'Chanter of Ash':'acolyte',
  'Keystone Screamer':'acolyte',
  // shooter silhouettes
  'Bog Piper':'slinger',
  'Cairn Sling':'slinger',
  'Censer Bearer':'slinger',
  'Kelp Lobber':'slinger',
  'Magma Slinger':'slinger',
  'Mudlark Caller':'slinger',
  'Peat Spitter':'slinger',
  'Pyre Sling':'slinger',
  'Quarry Sling':'slinger',
  'Reefbone Piper':'slinger',
  'Rime Slinger':'slinger',
  'Scree Slinger':'slinger',
  'Slate Flinger':'slinger',
  'Spume Caster':'slinger',
  'Tide Spitter':'slinger',
  'Vent Piper':'slinger',
  'Antler Oracle':'shaman',
  'Ashvent Shaman':'shaman',
  'Barkhide Shaman':'shaman',
  'Bone Flautist':'shaman',
  'Core Cultist':'shaman',
  'Ember Cultist':'shaman',
  'Grove Cultist':'shaman',
  'Howl-Keeper':'shaman',
  'Mire Cultist':'shaman',
  'Pelt-Wrapped Adept':'shaman',
  'Ridge Whistler':'shaman',
  'Storm Caller':'shaman',
  'Vent Howler':'shaman',
  'Wolfwood Seer':'shaman',
  'Beacon Keeper':'acolyte',
  'Bellows Adept':'acolyte',
  'Bog-Light Adept':'acolyte',
  'Brine Warden':'acolyte',
  'Cinderwind Adept':'acolyte',
  'Deep-Vault Adept':'acolyte',
  'Emberglass Adept':'acolyte',
  'Fault Chanter':'acolyte',
  'Fogbell Ringer':'acolyte',
  'Forge Cantor':'acolyte',
  'Grave-Ash Adept':'acolyte',
  'Molten Herald':'acolyte',
  'Prism Adept':'acolyte',
  'Pyre Chanter':'acolyte',
  'Quench Adept':'acolyte',
  'Rift Chanter':'acolyte',
  'Riftglass Adept':'acolyte',
  'Saltglass Adept':'acolyte',
  'Shatterstone Adept':'acolyte',
  'Stonebell Cantor':'acolyte',
  'Tidewrack Acolyte':'acolyte',
  // third wave
  'Barnacle Crawler':'crab',
  'Bleached Hermit':'crab',
  'Dune Skipper':'crab',
  'Fen Skimmer':'crab',
  'Foam Scuttler':'crab',
  'Ossuary Crawler':'crab',
  'Peat Lurcher':'crab',
  'Quarry Lurker':'crab',
  'Scoria Crawler':'crab',
  'Shard Skitter':'crab',
  'Carrion Creeper':'swarm',
  'Cinder Moth':'swarm',
  'Grit Swarm':'swarm',
  'Grub Nest':'swarm',
  'Rootling Swarm':'swarm',
  'Rush Adder':'swarm',
  'Shipwreck Rat':'swarm',
  'Slagfly Swarm':'swarm',
  'Flarewing':'bird',
  'Shoal Whistler':'bird',
  'Tern Diver':'bird',
  'Wreck Crow':'bird',
  'Antlered Husk':'husk',
  'Bark-Bound Thrall':'husk',
  'Barnacle Thrall':'husk',
  'Bell-Rot Acolyte':'husk',
  'Bog Shambler':'husk',
  'Grovewretch':'husk',
  'Gull-Picked Corpse':'husk',
  'Mire Stalker':'husk',
  'Netted Drowned':'husk',
  'Scorched Stalker':'husk',
  'Anvil Colossus':'golem',
  'Core Colossus':'golem',
  'Emberbone Giant':'golem',
  'Fen Colossus':'golem',
  'Oil-Slick Hulk':'golem',
  'Terrace Guard':'golem',
  'Vault Colossus':'golem',
  'Warden of Silt':'golem',
  'Bloomcaster':'plant',
  'Cattail Spitter':'plant',
  'Fungal Herald':'plant',
  'Heartsap Chanter':'plant',
  'Moss Lurker':'plant',
  'Sap Priest':'plant',
  'Spore Chanter':'plant',
  'Thorn Slinger':'plant',
  'Ashfall Oracle':'wisp',
  'Cairnlight Seer':'wisp',
  'Cinder Oracle':'wisp',
  'Drowned Oracle':'wisp',
  'Echo Caller':'wisp',
  'Heart-Ash Cantor':'wisp',
  'Keeper’s Shade':'wisp',
  'Marsh Oracle':'wisp',
  'Mirror Chanter':'wisp',
  'Mist Piper':'wisp',
  'Moon-Eye Seer':'wisp',
  'Requiem Cantor':'wisp',
  'Rot Cantor':'wisp',
  'Wisp-Light Piper':'wisp',
  'Wrack Cantor':'wisp',
  'Ashjaw Hound':'boar',
  'Bramble Stag':'boar',
  'Bristle Boar':'boar',
  'Cinder Ram':'boar',
  'Cliff Ram':'boar',
  'Cliffside Ram':'boar',
  'Drowned Stag':'boar',
  'Fogfang Alpha':'boar',
  'Hollow Elk':'boar',
  'Rift Hound':'boar',
  'Sanctum Whelp':'boar',
  'Sunken Whelp':'boar',
  'Thicket Whelp':'boar',
  'Timber Alpha':'boar',
  'Ash Revenant':'husk',
  'Ashborn Wretch':'husk',
  'Barnacle Popper':'crab',
  'Bloated Drifter':'husk',
  'Bonepile Scavenger':'husk',
  'Bramble Weaver':'plant',
  'Cairn Whistler':'wisp',
  'Chapel Husk':'husk',
  'Chip Skitter':'crab',
  'Cinder Husk':'husk',
  'Cliff Skua':'bird',
  'Clinker Colossus':'golem',
  'Creeper Vine':'plant',
  'Driftwood Snapper':'crab',
  'Drowned Chorus':'wisp',
  'Drowned Deckhand':'husk',
  'Emberfly Swarm':'swarm',
  'Fen Whisperer':'wisp',
  'Forge Thrall':'boar',
  'Gale Hopper':'swarm',
  'Gate Breaker':'golem',
  'Grafted Warden':'plant',
  'Gull Piper':'bird',
  'Keep Cinderguard':'boar',
  'Lamp-Drowned':'husk',
  'Leechling':'swarm',
  'Lens Grinder':'golem',
  'Marrow Cantor':'wisp',
  'Marsh Tick':'crab',
  'Pallbearer Husk':'husk',
  'Quagmire Crawler':'crab',
  'Reed Lurcher':'plant',
  'Reedpipe Mourner':'wisp',
  'Rift Cantor':'wisp',
  'Root Speaker':'plant',
  'Rope-Rot Mariner':'husk',
  'Rotfly Swarm':'swarm',
  'Rubble Hulk':'golem',
  'Rushlight Caller':'wisp',
  'Salt-Caked Hand':'husk',
  'Sanctum Colossus':'golem',
  'Sand Crawler':'crab',
  'Sandfly Cloud':'swarm',
  'Sap-Drunk Elk':'boar',
  'Sawgrass Spitter':'plant',
  'Scarp Crawler':'crab',
  'Sedge Darter':'swarm',
  'Seedcaster':'plant',
  'Shell Skitter':'crab',
  'Signal Screamer':'bird',
  'Silt Revenant':'husk',
  'Slagback Brute':'golem',
  'Spindrift Wisp':'wisp',
  'Spore Puffer':'plant',
  'Stone Warden':'golem',
  'Thornback Boar':'boar',
  'Timber Lurker':'plant',
  'Vault Sentinel':'golem',
  'Wolfwood Stalker':'boar',
  'Wreck Scavenger':'bird',
};
// An ELITE keeps its species' shape -- it is the same animal, grown; only the crown is new. That
// is why e.arch is stamped at spawn BEFORE the elite prefix renames the species: looking it up
// afterwards by name would miss on every elite in the game.
function mobArch(e){
  if(!e) return null;
  return e.arch || (e.spn&&MOB_ARCH[e.spn]) || (e.type==='s' ? 'caster' : 'beast');
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
 if(_onStarter(RG,tx,ty)){ const S=RG.starter, d=Math.hypot(tx-S.cx,ty-S.cy);
   // THE TERRITORY OWNS THE LEVEL. Level is not a radius here: the four starter provinces each
   // hold exactly five levels, and inside a province the danger ramps from its floor to its
   // ceiling with distance from the landing. So The Landing Sands is Lv1-5 everywhere in it and
   // Gullwind Shore is Lv6-10 everywhere in it, no matter what shape the border happens to take.
   // Crossing a border is a real step, which is the point of a border.
   // (Before this the island was a smooth radial ramp with the zones cut off it, which made them
   // concentric rings; before THAT the ramp was centred on the spawn in the island's middle,
   // which made all three of them span Lv1-20 at once.)
   const T=RG._terr, zg=RG._zg;
   if(T&&zg){ const zr=zg[Math.floor(ty)], z=zr?zr[Math.floor(tx)]:-1;
     if(z>=0&&z<STARTER_ZONES){ const t=T[z], q=t.dq;
       if(!q) return t.lvmin;
       let lv=t.lvmin; for(let k=0;k<4;k++) if(d>=q[k]) lv++;
       return lv; } }
   // Off-land (coast, shallows) or called before the territories exist: no province to ask, so
   // approximate smoothly across the island. Only water and the bridge approach take this path.
   return Math.max(1,Math.min(20,Math.round(1+Math.min(1,d/S.r)*19))); }
 const gR=RG.grindR||0.8, f=Math.min(1,Math.hypot(tx-RG.core.cx,ty-RG.core.cy)/RG.rmax);
 if(f>=gR) return 50;                                   // flat Lv50 grind ring
 return Math.max(20,Math.min(50,Math.round(20+(f/gR)*29))); }
function grvLvAt(tx,ty){ const R=curRoom&&curRoom.rings; if(!R||!R.radial) return (curRoom&&curRoom.lv)||1;
 return grvLvAtR(R,tx,ty); }
// ----- Clumped zones (territories) -----
// 14 clumps: 4 starter + 5 inner main + 5 grind. Order is FIXED and load-bearing --
// 0-3 starter, 4-8 inner main, 9-13 grind rim -- because ZBOSS and ZONE_TIERS are indexed by it.
//
// EVERY zone in the game is an organic clump: a warped Voronoi province around its own seed, with
// irregular borders. The starter island's four are no different from the main island's ten -- what
// changed is where their seeds sit. They used to be three seeds all placed within ~20 tiles of the
// spawn point in the island's middle, which does not make three provinces, it makes three pie
// WEDGES radiating outward; combined with a level that came from distance-to-spawn, every one of
// them spanned the whole Lv1-20 range and the map read "Lv1-20" three times over.
// The seeds now march NW->SE across the island, and each province owns a five-level band outright
// (grvLvAtR reads the band off the province, not off a radius). Territory first, level second.
function _territories(R){ const RG=R&&R.rings; if(!RG||!RG.radial) return null; if(RG._terr) return RG._terr;
 const S=RG.starter, C=RG.core, Rm=RG.rmax, nm=RG.names, sz=RG.starterZones||[], gr=RG.grind||[], T=[];
 const add=(cx,cy,name,band,gi)=>{ T.push({cx,cy,name,band,gi:(gi==null?-1:gi),lvmin:99,lvmax:0,sx:0,sy:0,n:0,dlo:1e18,dhi:-1e18,dq:null}); };
 for(let i=0;i<STARTER_ZONES;i++) add(STARTER_SEED[i][0],STARTER_SEED[i][1],(sz[i]&&sz[i].n)||('Zone '+i),STARTER_BANDS[i]);
 const iAng=[0.5,-0.7,0.95,-0.35,0.35];                                                            // main inner (bands 3-7)
 // nm is BAND-indexed, not clump-indexed: nm[3+i] stays 3+i even though these are now clumps 4-8.
 for(let i=0;i<5;i++){ const b=3+i, f=(b-2.4)/6; add(Math.round(C.cx+Math.cos(iAng[i])*Rm*f),Math.round(C.cy+Math.sin(iAng[i])*Rm*f),nm[3+i].n,b); }
 const gAng=[-0.8,-0.35,0.05,0.45,0.85];                                                           // grind clumps (band 8)
 for(let i=0;i<gr.length;i++){ add(Math.round(C.cx+Math.cos(gAng[i])*Rm*0.9),Math.round(C.cy+Math.sin(gAng[i])*Rm*0.9),gr[i],8,i); }
 // Reach histogram per starter province, one bucket per tile of distance from the landing. Used
 // below to cut each province's five levels by AREA rather than by raw distance -- a province is
 // widest in its middle, so an even distance split leaves its first and last levels with almost
 // no ground on them (Lv15 came out with 167 tiles of the 21,296 in its province).
 const DQN=420, sHist=[]; for(let i=0;i<STARTER_ZONES;i++) sHist.push(new Int32Array(DQN));
 const W=R.w,H=R.h,grid=R.grid,zg=new Array(H);
 for(let ty=0;ty<H;ty++){ const row=grid[ty], zr=new Int8Array(W); zg[ty]=zr;
   for(let tx=0;tx<W;tx++){ const ch=row&&row[tx];
     if(ch==null||ch==='w'||ch==='b'){ zr[tx]=-1; continue; }
     // Same warped-Voronoi rule on both islands -- only the candidate seeds differ. Restricting
     // the search to one island's own seeds is what stops them bleeding into each other: with a
     // single unrestricted search, 653 tiles of the starter island's east spill were claimed by
     // The Verdant Belt -- Lv20 ground paying a main-island loot table, owned by a boss whose lair
     // sat 130 tiles away, so nothing ever spawned there.
     const wx=tx+7*Math.sin(ty*0.21+tx*0.05)+4*Math.sin(ty*0.61), wy=ty+7*Math.cos(tx*0.21+ty*0.05)+4*Math.cos(tx*0.61);
     const st=_onStarter(RG,tx,ty), i0=st?0:STARTER_ZONES, i1=st?STARTER_ZONES:T.length;
     let bi=i0,bd=1e18;
     for(let i=i0;i<i1;i++){ const dx=wx-T[i].cx,dy=wy-T[i].cy,d=dx*dx+dy*dy; if(d<bd){bd=d;bi=i;} }
     zr[tx]=bi; const t=T[bi];
     t.sx+=tx; t.sy+=ty; t.n++;
     if(st){ // how far this province reaches, so its five levels can be spread across it
       const d=Math.hypot(tx-S.cx,ty-S.cy); if(d<t.dlo)t.dlo=d; if(d>t.dhi)t.dhi=d;
       sHist[bi][Math.max(0,Math.min(DQN-1,Math.round(d)))]++; }
     else { const lv=grvLvAtR(RG,tx,ty); if(lv<t.lvmin)t.lvmin=lv; if(lv>t.lvmax)t.lvmax=lv; } } }
 // A starter province's level range is its own by definition, not something measured off a curve.
 // Set before _terr is published, because grvLvAtR reads lvmin and dq straight back out of it.
 for(let i=0;i<STARTER_ZONES;i++){ const t=T[i]; t.lvmin=5*i+1; t.lvmax=5*i+5;
   if(t.dhi<t.dlo){ t.dlo=0; t.dhi=1; }                                  // province with no land
   // Quartile cuts by area: each of the five levels gets a fifth of the province's ground.
   const h=sHist[i], tot=t.n||1, q=[0,0,0,0]; let acc=0, k=0;
   for(let d=0;d<DQN && k<4;d++){ acc+=h[d];
     while(k<4 && acc>=tot*(k+1)/5){ q[k]=d; k++; } }
   for(;k<4;k++) q[k]=DQN;
   t.dq=q; }
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
 // Off-land starter tiles (coast, shallows): mirror the on-land rule -- band from the LEVEL, via
 // the same STARTER_BANDS table, so a beach tile never themes differently from the sand behind it.
 if(_onStarter(RG,tx,ty)) return STARTER_BANDS[Math.max(0,Math.min(STARTER_ZONES-1,Math.floor((grvLvAtR(RG,tx,ty)-1)/5)))];
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

// ROOM IDENTITY FOR THE NETWORK, which is not the same thing as the rooms[] index. All twelve
// dungeons are stored at rooms['DUN'] and therefore all reported key 'DUN', so the net layer
// believed a player in the Saltworks and a player in Marrow Chapel were in the same room: the
// host's enemies materialised inside your unrelated layout, netSimulates handed simulation to a
// host who was somewhere else entirely, and coopNearPeers made someone 520px away IN A DIFFERENT
// DUNGEON eligible for your soulbound and relic rolls. Kept separate from `key` so rooms[] and
// the curRoom.key==='VAULT' render tests are untouched.
function netRoomKey(R){ const r=R||(typeof curRoom!=='undefined'?curRoom:null); if(!r) return '?';
  const k=r.key||'?';
  if(r.dungeon && r.bossRing!==undefined) return k+':'+r.bossRing;
  if(r.id && !r.key) return String(r.id);          // buildPetRoom sets id and no key
  return k; }
function enterRoom(key, px, py){
  curRoom=rooms[key];
  player.x=px; player.y=py;
  enemies=[]; pShots=[]; eShots=[]; embers=[]; loots=[]; zones=[]; fx=[];
  worldBoss=null; ringBossCd=[]; if(!curRoom||!curRoom.dungeon) groundPortals=[];
  for(const al of allies){al.x=player.x;al.y=player.y;}
  if(typeof spawnCritters==='function') spawnCritters(curRoom);   // the Hearth flock
  buildRoomCache();
  curRegionN=''; _zoneNoted={}; _bossNoted={};
  const rnow=Date.now();
  if(!curRoom.big){ for(const sp of curRoom.spawns){ if(!sp.dead||sp.dead<=rnow) enemies.push(makeEnemy(sp)); } }
  document.getElementById('roomTxt').textContent=curRoom.name;
  // entering a room is the most frequent banner in the game and the least newsworthy of them
  // curRoom.band is a DISPLAY RANGE on the old rooms ('141-150') and the sentinel 'boss' on a
  // dungeon -- truthy either way, so every dungeon entry announced 'a hunting ground for Lv boss'.
  const _bandTxt=(curRoom.band&&curRoom.band!=='boss')?('a hunting ground for Lv '+curRoom.band):'';
  msg(curRoom.name, curRoom.town?'the hearth never dies':_bandTxt, 'quiet');
}
// The banner used to CLOBBER: innerHTML= plus one shared clearTimeout, so two calls inside the same
// second meant only the second was ever read. That is not a hypothetical -- boss phase barks were
// being erased by the mechanic warning that fired a frame later (see the note in 07_update.js), and
// the workaround was to not write the second one. It queues now: a banner gets its full time on
// screen and the next one waits its turn. A repeat of the line already showing is dropped rather
// than queued, so a per-frame caller cannot build a backlog.
// HOLD TIMES. A banner that snaps on and off reads as a FLASH; one that fades reads as a notice,
// even at the same duration. The gap between lines matters as much as the hold -- back-to-back
// banners with no breath between them are what made a busy moment strobe.
const MSG_HOLD=1500, MSG_QUIET_HOLD=950, MSG_GAP=260;
let _msgQ=[], _msgT=0, _msgCur=null, _msgGap=0;
// kind: 'alert' (default, the full banner) or 'quiet' (routine notice -- smaller, dimmer, shorter).
// Opt-in per call site, so none of the 101 existing calls change behaviour.
function msg(t,sub='',kind){
  const html=t+(sub?`<small>${sub}</small>`:'');
  if(_msgCur===html) return;                       // already on screen
  if(_msgQ.length && _msgQ[_msgQ.length-1].html===html) return;
  if(_msgQ.length>3) _msgQ.shift();                // never hoard: the oldest unseen line loses
  _msgQ.push({html:html, quiet:(kind==='quiet')});
  if(!_msgCur && !_msgGap) _msgPump();
}
function _msgPump(){
  const m=document.getElementById('msg'); if(!m) return;
  const it=_msgQ.shift();
  if(it===undefined){ _msgCur=null; m.classList.remove('show'); return; }
  _msgCur=it.html; m.innerHTML=it.html;
  m.classList.toggle('quiet', !!it.quiet);
  m.classList.add('show');
  clearTimeout(_msgT);
  _msgT=setTimeout(()=>{
    m.classList.remove('show'); _msgCur=null;
    // THE GAP IS STILL THE QUEUE'S TURN. _msgCur is null across this window, so a msg() landing
    // inside it saw an idle queue and pumped immediately -- and then the timeout below pumped
    // again, clearTimeout-ing the hold of the banner it had just put up. The middle line of a
    // burst flashed for a fraction of its hold, which is the exact bug this queue exists to fix.
    if(_msgQ.length){ _msgGap=1; setTimeout(()=>{ _msgGap=0; _msgPump(); },MSG_GAP); }
  }, it.quiet?MSG_QUIET_HOLD:MSG_HOLD);
}

// ---- portal routing: every portal carries a destination `to` ----
function usePortal(to){
  if(to==='_petback'){ if(typeof leavePetRoom==='function') leavePetRoom(); return; }   // exit the Sanctuary
  // The Sanctuary is BUILT ON DEMAND (buildPetRoom), so rooms['PETS'] does not exist until someone
  // asks for it -- the generic `rooms[to]` lookup below would silently do nothing. enterPetRoom
  // builds it, records where to come back to, and spawns the wanderers, so the portal and the
  // pets-panel button now arrive by exactly the same path.
  if(to==='PETS'){ if(typeof enterPetRoom==='function') enterPetRoom(); return; }
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
  a.lv=Math.round(Math.min(LV_CAP, 2+arenaWave*1.3));   // every other level source rounds; this one printed 'Lv5.8999999999999995'   // arena scales to the Lv50 cap over its waves
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
