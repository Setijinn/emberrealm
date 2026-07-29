# EmberRealm — project reference

**This file is the DURABLE half.** Architecture, invariants, subsystem rules, QA traps and the two
walls not to build past. It changes when the *design* changes, not when a session ends.

**Current state, what shipped and what to do next live in `KICKOFF.txt`.** Exactly one file owns
the volatile story, on purpose: this document and that one used to both carry "what shipped this
session", they drifted, and the stale one confidently misled. If you are looking for where the
project *is*, you are in the wrong file.

---

## How to work on this project

- Plain numbered JS files loaded in order by `index.html`. **No build step**, no modules.
- **Bump `CACHE` in `sw.js` on every commit** or the service worker serves stale files.
- **Serve on a fresh port for every edit** (`py -m http.server 9NNN`). The cache-first trap is the
  *browser's* HTTP cache, not the SW.
- **Commit AND push every change, fetching first** — a collaborator shares the repo.
- Drive QA with Chrome MCP `javascript_tool`. The tab may be throttled: **step frames manually**
  with `for(let i=0;i<N;i++){update(0.016);}` and never wait on `requestAnimationFrame`.
- **`py tools/selftest.py` is the standing harness**, and it runs with no node and no CDP client —
  neither is installed on this machine. It injects one `<script defer>` into the **real**
  `index.html` (never a hand-maintained copy, which would drift) and reads the results back with
  `chrome --headless=new --dump-dom`. `--headless=new` is required: the old mode was removed and
  exits 21 with no output. It finds the browser itself — `$CHROME` first, then a list of the usual
  install paths, then Playwright's versioned download dir — and adds `--no-sandbox` when it is
  running as root, which Chrome's zygote otherwise refuses. 144 checks today. Run it after any
  change to the tier ladder, the loot tables, the level cap, the forge or the dev workbench.
- Verify by driving the game. Report measurements. Say plainly when something fails, or when you
  did not test it.

**How `sw.js` picks up a new script file:** it does not enumerate them. `ASSETS` precaches only
`index.html`, the manifest and the icons; every `.js` is **network-first**, so a new numbered file
is live as soon as `index.html` lists it.

---

## Invariants — the rules the design rests on

**Tier is the only power axis.** Rarity sets border colour and affix count, nothing else.

**THE LADDER HAS FOURTEEN RUNGS AND THREE OF THEM HAVE RULES.**

| rung | where it comes from |
|---|---|
| T1–T12 | found, wherever `ZONE_TIERS` says |
| **Scavenged Dreams** (index 12) | **dropped**, and only in the Lv50 rim and the ascended dream dungeons |
| **T14 Riftforged** (index 13) | relics. Forged from an SD piece, or found at the dungeon rates |

**Scavenged Dreams is written `SD`, never `T13`.** It is named for what it is — carried out of a
dead god's dream — and a number would say nothing. `tierTag(t)` owns that spelling; never build
`'T'+(t+1)` by hand or the two spellings drift.

**`MAXT` MOVED TO 13 AND THAT WAS DELIBERATE.** The old invariant said it must stay 12, and the
reason was real: `_nTiers()` divided the sprite bands by it, so raising it re-mapped every item in
the game onto the wrong art. `MAXT` was doing two jobs — *how high can a roll go* and *how many
tiers were the sprites drawn for* — and those stopped being the same number the moment SD became
rollable. The second is **`ART_TIERS`** now, frozen at 12 forever because it is a fact about the
files on disk. `_nTiers()` reads `ART_TIERS`; **do not make it read `MAXT` again, or
`TIER_NAMES.length` either** — both of those grow.

With that split, `MAXT-1` lands exactly on `SD_T`: a random draw can reach Scavenged Dreams and can
**never** reach a relic. Three things could have leaked SD and all three are now closed —
`pickWeighted` clamps to the *row's* own ceiling rather than `MAXT-1` (so a T12 row cannot overflow
into SD by accident), and the auction and the event chest carry `AUC_TMAX` / `CHEST_TMAX`. A row may
only pay SD if it **names** SD.

**NOTHING MAY SIT ABOVE `LV_CAP`.** 50 is a hard ceiling — `levelUp` stops there and there is no
prestige level — so any content that computes its own level must land on or under it. Six ascended
dungeons were at Lv53–55 because their clamp was `LV_CAP+10`, which never bound anything; the whole
endgame could only be fought underlevelled and no amount of playing could close the gap. They clamp
at `LV_CAP` now and the top six land flat on 50, which is the right shape: at the ceiling, what
separates the Shattered Vault from the Core Sanctum is `bossPace`, the mechanics and the relic rate,
none of which is the level. A starter dungeon is separately bounded by `ISLAND_LV`
(`STARTER_ZONES * STARTER_LV_PER_ZONE`), **not** by an offset off the cap — it used to read
`LV_CAP-26`, a number that looks derived and is not, and it put Marrow Chapel at Lv22, off its own
island. `_checkLevelCap()` fails at boot on any of this.

**Glory must never buy power, and nothing may mint spendable glory mid-run.** It is account-level
and paid only on permanent death, scored from what the run accomplished. Bounties *bank* onto the
run and pay out on death for exactly this reason.

**Loot from a kill is always a sack**, and its art follows the best item inside it
(`bagAt` → `bandOfTier(bagTopTier)`), so a relic makes it a reliquary. Progression reads through
material and ornament, never through shape. The Emberwrought chest is not a drop — it is a placed
event object that looks like nothing else precisely so it can never be mistaken for something a
monster left behind.

**One sack per kill, PLUS a creature carrier when one is owed** (user, 2026-07-27). Mounts and pet
eggs drop in their own sack, always, and always *together* — one carrier however many creatures are
in it. This is a deliberate, argued exception: eggs had been folded *into* the gear sack the day
before for exactly the reason the rule exists, and the exception was taken anyway, so keep it
narrow. Pet **food** stays in the gear sack — it drops on 5.5% of trash and 60% of bosses, and a
carrier after most kills would make the carrier mean nothing. The carrier is band `-2` (the chest
is `-1`), carries its own sprite, is always bound, and rides the existing per-connection filter
rather than a new guarantee. `isCreatureItem()` is the predicate; adding a third kind is one line.

**In co-op, bound loot never crosses another player's wire.** Soulbound rows are filtered *per
connection* at send time rather than tagged and filtered client-side. One shared sack plus your own
bound one is the confirmed shape.

**Only one machine simulates a given room.** That is the actual rule, and it is positional, not
role-based: `netSimulates()` is true for solo, for the host, and for a client whose host is in a
*different* room. A client whose host is standing next to it stands down. Getting this wrong as
"clients never simulate" left anyone paired with a distant stranger in a permanently empty world.

**Enemy AI still runs only where `netSimulates()` says so.** Anything that damages the player from
an enemy needs three parts: serialize in `netBroadcast`, deserialize in `netApplyWorld`, apply
client-side in `netHazards` (all `14b_netsync.js`).

**`NKIND`'s kind field is 4 bits now, not 3.** It was 3 bits and completely full — `egg` took the
last slot — and `mount` needed a ninth, so the field was *widened* into bits 12–15 (16+ of the bag
word were unused) rather than anything being renumbered. The renumbering ban still stands and
always will: an index is packed into the co-op bag word, and moving one makes an older peer read
every coin sack as a tonic. A peer on a pre-widening build reads a mount sack as a weapon sack,
which is cosmetic only — `netUnpackBag` builds a **display-only ghost bag** and only the host's `G`
grant ever carries real contents.

**The enemy snapshot row is APPEND-ONLY and has no length validation.** Every optional trailing
element must be null-guarded on read: an unguarded `a[n].map()` throws inside the PeerJS data
handler and silently kills the rest of that packet — the remaining entities, the shot replacement
and the whole loot reconcile — on every snapshot. Same rule as `NKIND`: append, never renumber.

**A `remote` entity is not an entity**, it is a rendering of someone else's, with none of the
fields the simulation needs. It must never be handed to the local AI — `netDropRemote()` clears
them whenever co-op ends.

**Cosmetics are colour only** — never a stat, never a silhouette.

**Permadeath is the bridge**, not a level number.

**The Vault is account-wide and UNGATED, by explicit decision.** It hangs off `users[curUser]`,
not off a character, so it survives the hero who filled it and any hero may withdraw anything at
any level — `canEquip` has no level gate, so a fresh Lv1 can wear a T12. That was raised before it
was built and chosen anyway. Permadeath still ends the run and still takes everything the hero was
*carrying*; it no longer takes what they banked. If it ever needs walking back, the gate belongs in
`vaultCanWithdraw(it,ch)` and nowhere else — it exists for exactly that and today always says yes.

**The Scroll Registry follows the same rule** and for the same reason: a hero who cannot use a
scroll passes it to one who can. Counts per stat, not slots. A full registry *refuses* rather than
destroying — the scroll stays in the character's bank.

**Food is the only thing that grows a pet.** Kills give a pet nothing. If you ever want pets to
grow another way, that is a design change and not a bug to fix.

**Fusion is a place.** `petFuse` refuses unless the player is standing at the Fusion Altar in the
Sanctuary. Incubation is wall-clock time by rarity, not kills.

**A safe room is not a dungeon.** The rim vignette has three cases, not two: town gets the warm
tint, `safe`/`petRoom` get a gentle neutral 0.20, everything else gets the dungeon 0.42. Every side
room used to fall to the dungeon side and get its edges crushed.

**`MOVE_SCALE` (01_constants.js) scales LOCOMOTION ONLY.** Not projectile speeds, telegraph timers,
fire cadence, dash distances or knockback impulses — those are not movement speed and slowing them
would silently re-tune every boss window in the game. It rides on `eSpdMul()`, which covers every
enemy and boss in one place; the two summon sites set speed flat and need it explicitly.

**Ascension opens at `ASCEND_LV` (45), not at the cap.** One constant in `13_skills.js`; the gate,
the locked button and the attributes status line all read from it. Ascending early is deliberate —
it hands you the prestige caps while there are still levels left to earn.

---

## Subsystem map

### Items and loot
- An item is `{k, wt|mt|st, t, rar, aff:[…]}`. `k` ∈ `wpn|arm|helm|ring|coin|scroll|egg|leg|pot`.
- `LOOT_BANDS` picks a sack sprite by tier band. Resolve sprites through **`lootSackImg()`** — see
  the `const` trap below.
- **Public gear caps at T8** (`PUB_TMAX`); everything above is soulbound.
- `mkItem(k,t,fort,cls)` / `rollBagSlots(…,cls)` take the *recipient*. **Omitting `cls` means no
  class bias**, which is what the shared co-op sack wants; a bound sack passes the owner's class.
- `bagVerdict()` rates a piece for the sack panel. The panel's sort is a **VIEW** — `bagTakeOne`
  splices the bag by index, so sorting the array itself makes every button take the wrong piece.

### Relics — T14 Riftforged
- Forty-eight relics in **twelve four-piece sets** (`17e_relics.js`). `RELIC_T` (13) is the index
  of the 14th `TIER_NAMES` entry. Relics used to sit at index 12 and moved up a rung when
  Scavenged Dreams was inserted underneath them; the *name* went with them, so a saved relic still
  reads 'Riftforged'. `migrateForgeTiers()` (`18_forge.js`) moves the index on anything older,
  across every character's satchel and the account Vault, and is idempotent.
- A relic is an **ordinary item** with `relic:id` — same equip path, satchel, compare and icon.
  Its id rides in `rpg.eqAff[slot].rel`.
- It drops **shaped for its finder** (their class's `wt`/`mt`), so `canEquip` just works.
- Fixed exclusive affixes no roll can reach; some carry a trait, and set bonuses reuse the `player`
  flag family the ascension capstones already set — **no new combat branches**. Flags read only by
  `12b_abilities` modify one ability rather than always applying, so they are deliberately unused.
- Six dungeons drop them, two sets each, `relicChanceFor()` returning 0 everywhere else.
- `RELIC_COL` / `--relic` (#ffd24a) is the one gold for everything relic. The icon stamps **R**
  where ordinary items stamp their tier.

### Serving it while you work
- **`py tools/serve.py`** — one fixed port (10500), `no-store` on every response, and it stops any
  previous instance of itself before binding. Re-run it as often as you like.
- Do NOT go back to `python -m http.server` on a new port per edit. That ritual existed because
  `http.server` stamps `Last-Modified` and answers `If-Modified-Since` with a 304, so an edited .js
  kept coming from the browser's HTTP cache — but it leaked a process every time. One session found
  **232 orphaned servers holding 3.2 GB**. `serve.py` fixes the caching instead of dodging it.
- Stripping the `Last-Modified` *response* header is not sufficient on its own: `send_head`
  compares against the file mtime and returns a bare 304 before any response header is written.
  `serve.py` deletes the conditional *request* headers too. Verified both ways.
- **This only covers the browser HTTP cache.** The service worker is cache-first and is a separate
  layer, so you must still bump `CACHE` in `sw.js` on every commit.

### The world's zones
- **14 territories**, laid down by `_territories()` in a FIXED order that `ZBOSS` and `ZONE_TIERS`
  are both indexed by: **0-3 starter island, 4-8 inner main, 9-13 grind rim.** Adding one shifts
  every later index — including the raw numbers in `17e_relics.js` (`RELIC_ZONE_MIN`,
  `RELIC_ZONE_RIM`), which read a clump index and would silently pay relics out of the wrong band.
- Every zone is a warped-Voronoi province with irregular borders. The starter island's four are
  no different from the main island's ten; the two islands just partition over their own seeds so
  neither bleeds into the other.
- **The starter island is a west-to-east march.** `rings.starter` is the LANDING on the west shore
  — it is the level-ramp origin AND the arrival point (`usePortal('G')`), deliberately one value so
  spawn and Lv1 cannot drift apart. It used to be the island's MIDDLE, which is what made three
  zones that each spanned Lv1-20: they radiated from the spawn as wedges.
- **The province owns the level, not a radius.** Each starter province holds exactly five levels and
  `grvLvAtR` reads the band off the province a tile belongs to. Inside a province the five levels
  are cut by AREA (a per-province reach histogram split at its own quintiles), because a province is
  widest through its middle and an even distance split starves its first and last levels.
- Seeds were measured, not guessed, on four counts: area share, monotonic distance from the landing,
  contiguity, and **no skips — only CONSECUTIVE provinces may share a border.** That last one is
  what stops a Lv5 player walking out of the first zone straight into Lv11 ground.
- `STARTER_ZONES` / `STARTER_BANDS` / `STARTER_SEED` are declared beside `ZBOSS` near the top of
  `03_entities.js`, NOT next to `_territories` 2000 lines down: `stampLairs()` runs at load and a
  `const` further down the file is still in its temporal dead zone.
- **`rings.names` is BAND-indexed, not zone-indexed** (`11_ui.js` reads `names[pl.band]` for fast
  travel; `02_worldbuild.js` appends the grind name gated on `length===8`). The four starter names
  live in their own `rings.starterZones`; do not add a ninth entry to `names`.
- **Terrain bands are a SEPARATE index space from zones**, 0-9, and `MOBSPEC` is keyed by it — so a
  zone with no band of its own gets another band's creature roster. The Cairnworks borrowed band 6
  briefly and spawned the Lv39-45 Stonebrow list at Lv12; it has band 9 now.
- **Band 9 is APPENDED, never inserted** — pillar band ids are `er-pillars` save keys. That makes it
  numerically the highest band while sitting between 1 and 2 on the ground, so the two places that
  read band as an ORDERED ramp special-case it: the gold "danger rises" seam (`08_render.js`) and
  the hot-band secondary-terrain rule.
- **`MOBNAME`/`MOBTINT` are indexed by two different things that both start at 0**: a terrain band
  on the overworld, a boss ART SLOT in a dungeon. Rows 0-8 serve both deliberately; rows 9-12 are
  the starter bosses' slots. `BAND_ROW` maps a terrain band to its row — without it, band 9 reads
  the Tidewrack's name and tint. The dev panel's mob preview passes a raw band and needs it too.
- **`GBANDCOL[bd]` is the one that crashes rather than degrades.** It is indexed unguarded on the
  fallback path taken every session before `set_N` decodes, so a band without an entry is a
  TypeError inside the tile loop. Add it in the same commit as the band.
- A new band needs: `set_N`/`setv_N`/`terr_N` art, the `b<=N` loader loops, `DECAL_SRC`,
  `GBANDCOL`, `TERR_ACCENT`, `MRAMP`, `_bandTree`/`_bandBoulder`/`_bandTone`, `MOBSPEC[N]` (+
  `MOB_ARCH` rows for every species), and a `BAND_ROW` entry. It does NOT need `lairset/floor/wall`:
  arena tiles are keyed to the BOSS (`lairTileSet`), never to the ground it stands on.
- **PixelLab will not give you a texture if you ask for one.** Asking for a "seamless ground
  texture" returns a composed SUBJECT — a blob ringed by pebbles. You have to say *no centre, no
  focal point, no border, uniform density edge to edge*, and separately *no straight lines, no
  seams, no stripes* or it returns something that will not tile. When the palette comes back wrong,
  correct it with `_bandTone` rather than burning generations chasing it; bands 0, 7, 8 and 9 all do.

### Bosses
- Thirteen identities in `GBOSS`; a boss's index is its **`ring`** everywhere in the code (a legacy
  name — it is a boss id, not a terrain band).
- **`gate:'none'` marks a starter-island boss** — walk-in dungeon, den elder rather than dream form,
  dungeon level stepped off its own tile. `isStarterBoss()` reads it. This used to be
  `LAIR_RAD[ring]!==undefined`, an art-placement table doing duty as an identity test.
- Art borrowing is PER ASSET KIND: `BOSS_SLOT` (sprite/anim/den), `TILE_SLOT` (dunset),
  `DEC_SLOT` (ldec), `LAIR_TILE` (arena walls/floor). `bossArtSlots()` walks `0..BOSS_SLOT_N` at
  LOAD and requests every distinct slot, so a new boss must either ship its art or carry a borrow
  entry — a missing file 404s every session against a cache-first service worker.
- `DSHAPE[ring]` is dereferenced immediately (`st.rmax`): a missing entry is a TypeError.
  `DDEPTH[ring]` falls back to `||ring`, so a missing entry silently builds an enormous dungeon.
- A fight is keyed by identity AND form: `ow<ring>` / `dn<ring>` / `arena`, registered in
  `BOSS_MECH`. Both forms of a boss share a family; the dungeon form twists one element.
- **Per-fight phase counts** (`bossPhases`), 1–4 breaks. The boss bar reads the same list.
- **Anchored phases**: the boss walks to its arena centre and plants. Overworld lairs store their
  centre in `R.lairs[b]`; dungeon chambers in `room.bossCh`.
  **The immunity is a TIMED WINDOW, never a state.** `ANCHOR_WIN` (9s) untouchable and firing, then
  `IT IS EXPOSED` and `ANCHOR_CD` (7.5s, scaled by `bossPace().cycle`) vulnerable, then it re-plants.
  It is not immune until it actually ARRIVES at the centre. A fight that owns its own gate (cut the
  knots, break the conduits) sets `e.anchorNoInv=1` and uses `wardInv`, so the two rules never stack
  — two gates at once left barely a tenth of dn0/ow8 hittable.
  **Rule for any new immunity: there must be an exit the player can reach.** `anchor` shipped as an
  unbounded per-phase state and made twelve of fifteen fights unkillable; dn5 pinned `mechInv` for
  phases 0-2 whose only exit was HP it forbade you from taking, so it could never be fought at all.
  Sweep test: **dev panel -> BALANCE -> "Killability sweep"**. Drives all 27 registered fights on a
  simulated clock at fixed DPS and asserts the one rule that matters -- there is an exit the player
  can reach. Runs in ~200ms and restores combat state afterwards.
  **Two gate types, two yardsticks.** An anchor-clock fight's immunity is timed, so its streak must
  stay under `ANCHOR_WIN` plus pace headroom. A ward fight (`anchorNoInv=1` + `wardInv`, gated on
  killing conduits/knots) is uncapped by design -- what must hold is that the ward drops when the
  adds die. Judging ward fights by `ANCHOR_WIN` flags dn0 and ow8 on every clean run; the sweep
  reports the two separately for exactly that reason. The harness must also put damage into the
  adds while the boss is warded, or every ward fight reads as unkillable.
  Last run: 27/27 pass, worst anchor streak 8.6s of a 12.2s cap.
- **Difficulty scales through one dial**, `bossPace(e)`. No mechanic may hard-code a timing.
- Everything a fight puts on the field lives on **`e.mk`** — one object per boss, so `bossReset`
  clears a fight completely and the netcode has one place to look.
- `bossImmune()` (`06_combat.js`) is the single immunity rule: `mechInv`, `phaseInv`, `dlgInv`,
  `bloom`, `anchorInv`, `wardInv`.
- Animation: shared beats in `17f_bossanim.js`, per-identity profiles in `17g_bossprofiles.js`.
  Procedural transform scaled **about the feet**. `bossAnimFrames` is the seam for real frames.

### Enemies
- `MOBSPEC` holds a **list** of species per band per type; which one a spawn point gets is hashed
  from the point, so a spot keeps its character across respawns. `sp.spec` names one outright.
- **`DUNSPEC` is the dungeon roster, keyed by the boss's RING** — the dungeon's identity — not by
  the terrain band its index happens to land on. `mobPool(band,t,dun,ring)` prefers it, then falls
  back to `MOBSPEC[band].d`, then to the overworld list. Two invariants worth asserting after any
  roster change: no species in two dungeons, and no dungeon species on the surface.
- **An elite is a species, grown, not a new creature.** `eliteRoll(sp)` is hashed from the spawn
  POINT (its own constants, so "is elite" never correlates with "is a wolf"), and `makeElite`
  multiplies the FINISHED creature — after species, behaviour and corruption. `e.arch` is stamped
  before the elite title renames `e.spn`, or the archetype lookup misses on every elite.
- **Twelve archetypes carry every species.** `MOB_ARCH` maps name → archetype; anything unlisted
  falls back to `beast`/`caster`, so a new species without an entry degrades rather than blanks.
  The band tint is what makes the same crab a sand crab or a peat-stained one.
- **Every creature is animated.** Archetypes have 9-frame idle+attack under
  `assets/mobs/anim/arch_<name>/`; allies under `ally_<name>/`; pets under
  `assets/pets/anim/<spr>/`, loaded LAZILY per species. Every layer falls back: animated set →
  static sprite → hound/cultist → procedural shape.
- `EBEH` is the engagement rule (when to approach, when to break off); a species' `sig` is its
  movement *shape*. Both are needed or every creature walks the same straight line.
- Shot count and cadence ramp with level (`eShotCount`, `eFireCd`). The flat damage floors in
  `makeEnemy` are the low-level difficulty dial.

### Mounts (`17k_mounts.js`)
**A mount is a ride, not a stat line: it carries you faster and it carries you UNARMED.** No
attacks, no abilities. Without that trade a mount is a pure buff on a traversal tool, which makes
"stay mounted" correct everywhere — the same shape as an immunity with no exit. There are three
exits and all are cheap: dismount on demand (instant, no cooldown), damage throws you (cumulative
while mounted vs a fraction of maxhp, so it self-scales and needs no second dial), and a live boss
engagement throws you and keeps you off. **Getting ON takes 1.5s and damage interrupts it; getting
OFF is instant, deliberately** — a dismount you had to channel would be the trap the exits prevent.

**Mounts live on the USER**, like pets and the Vault, so they survive permadeath. Claimed at the
**Stable** in the Hearth, which opens at Lv20 — the same beat as the bridge crossing and the onset
of permadeath. The gate reads the highest level *any* character reached, so an alt does not re-earn
it. Riding and swapping live in the **MOUNTS tab of the companion panel**, not the Stable, so you
never walk back to town to get on a horse.

**Archetypes carry the art; a species is an archetype in a COAT.** Twelve sprites, 14 coats, 78
mounts — the same trick `MOB_ARCH`/`MOBTINT` uses for 252 creatures on 12 drawings. Every species
carries its **own** speed around its rarity's baseline and the bands **overlap on purpose**, so a
mount you like is never strictly obsoleted by the next rarity you pull. `tough` is the counterweight.

**Draw it by its OPAQUE BOX** (`mountDrawUnder`) — the first pass scaled by canvas height, came out
0.73× the hero and disappeared behind him. The rider's lift is derived from the same numbers that
plant the animal's feet, so changing `MOUNT_DRAW_H` moves both together.

**Drops are main-island only** (`onMainIsland` — the Lv20-50 zone) and very rare: boss 1.11%, elite
0.315%, trash 0.075% measured. They arrive in the creature carrier, never the gear sack, and a
mount goes to the Stable rather than the satchel, exactly as an egg goes to the incubator.

**FLYING MOUNTS ARE NOT BUILT.** They are planned for Lv40. `MOUNT_FLY_LV`, `mountIsFlyer()` and
`mountFlyOk()` are a declared seam that nothing reads yet, and **zero shipped species carry `fly`**
— assert that stays true. Flight additionally needs a collision exemption (`04_collision.js`
already has the shape in `player.terrainGhost`, gated on `_pmove`), a decision on whether it clears
only water/chasm or everything, and an answer to which enemies can reach a flyer at all.

### The Forge (`18_forge.js`)
**The machine takes exactly two things, at every rung.** Two materials join into a better material;
a Scavenged Dreams piece plus a Riftseed becomes a relic. There is one panel because there is one
gesture. **Bram joins things; he does not improve them** — the ordinary ladder is found, never made,
and SD is found too.

- **Thirty-two materials, four sources.** `src` on the def is what `matDropFor` reads, so the
  comment cannot drift from the behaviour: `starter` (the Lv1–20 island, 3), `main` (Lv20–50, 3),
  `rift` (**post-ascension dungeon bosses only**, 9), `craft` (never dropped — 11 crafted rungs
  plus 6 generated seeds). The rift pool is the whole content gate on the T14 rung and it is not a
  new mechanism — those dungeons already refuse to open without an ascension, so gating the
  material gates the relic for free.
- **A rift material belongs to ONE boss.** `matDropFor` does not draw that pool at random;
  `riftMatForKill` returns the material carrying the dead boss's `ring`, so a reagent in the pouch
  is a record of which door you got through. Nine ascended bosses, nine signatures — assert that
  every ascended boss has exactly one and no starter boss has any (`17m_integrity.js` does).
- **Seventeen recipes, keyed by the two inputs SORTED**, so a recipe cannot be written twice and
  the lookup never cares which slot was filled first. Eleven are written; **six are generated**
  from `RELIC_SETS` + `GBOSS`, because a seed is entirely determined by the boss it belongs to and
  six near-identical hand-written rows is how two lists drift apart.
- **The first three depths host no relic sets** (`RELIC_SETS` starts at ring 3), so their drops
  build the universal half of a seed: Forgeheart + Anchorroot → Riftcore + Veilshard → Riftbloom
  + Wallrot → Riftheart. That is what makes the awakened depths walk **in order** — there is no
  route to the Core Sanctum's seed that skips the Heartwood Hollow.
- **Each of the six relic dungeons has its own Riftseed, and a seed forges only that dungeon's two
  sets.** That is the whole reason materials are tied to bosses: you do not pick a set off a menu
  of twelve, you kill the thing that owns the one you want, so crafting and finding answer to the
  same map. Where only one of the two is still unowned the forge stops asking.
- **Material art is lazy and falls back to the glyph.** `matArtImg()` returns null on the *first*
  call — that call only starts the load — so the panel draws the coloured glyph for one repaint and
  the sprite takes over on the next; never a broken img. The six seeds **share one sprite tinted by
  `GBOSS[ring].col`**, the same trick `MOBTINT` and the mounts use. `itemArtImg` routes `mat` out
  **before** the tier-band maths, exactly as it does `boost`: a material is not on the tier ladder,
  so dividing by a tier it does not have lands it on sprite 0 of a set it does not belong to.
- **Materials are account-level**, like pets, mounts and the Vault, and for the reason the starter
  island exists: it was the one stretch of the game that produced nothing permanent.
- They ride in the **ordinary gear sack** beside pet food and boost draughts — one-sack-per-kill is
  intact and Fortune finds them. `mat` is `NKIND[9]`, an append into space the mount widening
  already bought.
- **A relic is crafted INTO a set you choose** — from the two its seed's dungeon keeps — and the
  piece is decided by the slot of the SD item you feed it. That is the point of crafting one: a
  drop is 0.25–1% spread across forty-eight pieces, and this completes the set you are actually
  wearing. It refuses a duplicate.
- **A failed craft must put back exactly what `plan.cost` took.** The refund path once named a
  hard-coded `'riftseed'` that no longer existed, which would have minted a material out of nothing.
- **`atForge()` has no "I opened it here" latch, on purpose.** That is the shape of the pet-panel
  bug fixed in `f9e13e2` — a latch outlives the condition it was set for. `curShopNear` is the live
  answer and its own transition already calls `closeVendorPanels()`.
- **SD shares the T11–T12 sack** rather than getting a fifth `LOOT_BANDS` row, because the band
  field on the wire is **2 bits** and `LOOT_BANDS` has exactly four rows. A fifth would silently
  alias to band 0 on an older peer.

### The Vault (`17j_vault.js`) and the Scroll Registry
Account-wide storage reached from the strongbox in the VAULT room. 60 gear slots paged 20 at a
time, plus a SCROLLS tab holding surplus stat scrolls as a per-stat tally. `applyScroll`
(`16_maxstats.js`) files the overflow automatically the moment a stat is at its cap with scrolls
still banked — that is the "attempted to consume at max" moment. The Attributes screen shows STORE
instead of a disabled +1/MAX on a full row, because that was the one moment the overflow is for and
the buttons used to be dead there.

### Pets (`15_pets.js`)
Rebuilt around three rules: **food is the only growth**, **fusion is a place**, **incubation is a
clock**. Five food tiers on the shared rarity ladder (1/3/8/20/50 feed power) drop from anything
you kill, tier weighted by level and by what died. A pet carries ONE level (`lvl`) and a `fed`
remainder; the old `abilLvl` is migration-only. `petFuseKit` interleaves the parents' kits — it
must not concatenate, because a parent carries three abilities and a child has three slots, so
concatenating silently drops the second parent entirely.
The Incubator and Fusion Altar screens use the shared `equip_panel.png` plate (`.embCard` in
style.css), aspect-locked with percentage padding exactly like the vault panel.

### The four stalls
| stall | role |
|---|---|
| **Bram** | **THE FORGE** (`forge:true`, `18_forge.js`). The reservation is spent — see below. |
| Sella | diamond merchant — the exchange and the cosmetic catalogue |
| Maren | auctioneer — a date-seeded house rotation |
| Odo | event NPC — the daily bounty board |

Stalls are opened **at the stall** (`portalPrompt` of `kind:'vendor'`), never from a HUD button.

### Date-seeded content
The auction and the bounty board derive their contents from the calendar date via a seeded PRNG, so
everyone sees the same shelf with nothing stored or synced. Per-account records are period-keyed and
self-clearing (`if(u.x.p!==period) reset`).

---

## QA traps that have cost real time

- **Top-level `const` and `let` are LEXICAL globals, not `window` properties.** `window[name]`
  lookups against const-declared images silently return `undefined` — this is why every loot sack in
  the game drew as plain burlap for weeks. It cuts the other way too: `window.curRoom = x` in a test
  harness assigns a *new* property and the game's own `curRoom` never moves, so every read comes
  back null and the harness reports the system broken.
- **Size sprites by their opaque bounding box** (`_imgBBox`), never `naturalWidth`. PixelLab files
  carry transparent margin: scaling by canvas size made the relic sack the *smallest* bag in the
  game and rendered the entire Hearth flock as specks.
- **When editing files with a script, build the whole text in memory and write to a temp before
  moving it into place.** Opening the target for writing first will TRUNCATE it if anything later
  throws. This destroyed `11_ui.js` once.
- **`fire()` is polled once per frame and discards the remainder**, so fire rate is quantised to
  16ms steps. A rate change that does not cross a frame boundary does literally nothing. Measure.
- **`touch-action` does not inherit.** Setting it on `html`/`body` says nothing about the canvas or
  the buttons on top of it.
- **`.scr` centres its children**, and a flex container centring content taller than itself clips
  BOTH ends — the top becomes unreachable whatever `scrollTop` says. A child with only a
  `max-height` also gets flex-shrunk to its min-content.
- **The global rule is `canvas{position:fixed;inset:0;width:100vw}`** — it exists for the fullscreen
  game canvas, so **every in-panel canvas must opt out** with `position:relative;inset:auto` or it
  stacks invisibly at its card's origin at full viewport size.
- **Place the QA player in verified open ground** and re-check the room did not change after the
  first `update()` — placing across a room boundary teleports the player thousands of px and every
  measurement silently becomes nonsense.
- **Clear `allies` when measuring weapon DPS**, or the pet's damage lands in the total.
- **Loops driven by wall clock cannot be probed by stepping a frame counter.** Stub
  `performance.now()` or they read as motionless.
- **A SYNTAX ERROR IS INVISIBLE TO THIS PROJECT'S QA METHOD.** Manual `update()`/`render()`
  stepping does not need the rAF loop, so a file that fails to parse still passes every stepped
  test while the actual game is dead. After any scripted edit, reload and read the console for
  `SyntaxError` before trusting a single measurement.
- **Zero frames in a background tab is throttling, not a break.** Take a screenshot to force a
  paint before concluding the loop is broken.
- **Place the QA player where spawn points actually are.** The overworld activation band is
  240–800px from a hero; `devTeleport('G')` lands somewhere with none in range, so the spawner
  correctly does nothing and it looks like a bug.
- **An ascension's capstone only applies when the character's class owns that ascension.**

---

### Traps added this session

**A DUPLICATE function declaration silently wins, and the parse check cannot see it.** Removing
`petFeed` left the old `petFeedNeed` behind; being declared later in the file it overrode the new
one, and feeding gave more than twice what the table said. Every file parsed. Only running the
numbers against a hand-computed ladder exposed it. After deleting a function, grep for anything
declared *beside* it.

**A stretched frame's border is a PERCENTAGE inset.** `equip_panel.png` is 448x600 painted at
`background-size:100% 100%`, so its usable field sits at ~16.5% top / 18% bottom / 16% sides of
whatever box it is given, while `#shopInner` pads a fixed 46/40/44px. Those agree at exactly one
card size. `scrollHeight <= clientHeight` will report "fits" while content sits visibly outside the
border — measure against the art's real field instead.

**The last ~330px of any room belongs to the HUD.** The camera clamps at the room edge, so anything
there is pushed under the orbs no matter where the player stands. Every side room's exit sat 1.5
tiles off the back wall and rendered at screen y=603, behind them. The vault door learned the same
lesson against the STORE banner, which is drawn at a fixed SCREEN position rather than in the world.

**PixelLab `create_map_object` always composes an OBJECT on transparency**, however hard the prompt
asks for a full-bleed texture — measured 67% opaque with a 0%-opaque border on two separate grass
attempts, and the previews hide it. `create_image` is not implemented on this server. For a ground
tile, crop to the largest fully-opaque square and stamp it with random orientations.

**WHAT ACTUALLY WORKS IN A PIXELLAB PROMPT** — learned across ~30 mount and sack generations, and
worth following rather than rediscovering:
- **Describe anatomy, not the species name.** "eagle head and front talons, tawny lion
  hindquarters" produced a griffon; "a griffon" produced something small and muddy. "carved
  granite slabs, glowing orange runes in the cracks" produced a stone construct; "a stone golem
  mount" produced a green lizard.
- **Negatives are unreliable and need repeating in the positive.** "wingless ground drake" came
  back with wings. What worked was saying it three ways at once: "NO wings at all", "running on
  two muscular hind legs", "ground mount".
- **Say how much of the frame to fill.** The first griffon rendered small and dark in a 64px
  canvas. "large ... filling the frame, bright warm colours" fixed it in one retry. There is no
  way to ask for a size directly, so frame language is the lever.
- **"in profile" reliably gives a clean side view** for a quadruped, which is what a mount wants.
  For the 8-direction pipeline drop it — the rotation set decides the angles itself.
- **Add "no rider" to anything rideable.** Without it the model sometimes bakes a figure into the
  saddle, which is unusable when the hero is a separate layer.
- **`view:'low top-down'`** matches this game's camera. `'side'` reads too flat next to the hero
  art and `'high top-down'` loses the animal's silhouette.
- Two prompts that differ only in wording still produce **different palettes** — see the grass
  tiles above. Anything meant to sit side by side needs one prompt and one batch, or gain-matching
  afterwards.

**`create_8_direction_object` bills 20 generations, ON COMPLETION, not when queued.** The balance
does not move while a batch is processing, so `get_balance` mid-run will under-report what you have
already committed to. Budget from the number of jobs you fired, never from the balance.

**An 8-direction animation costs 8 generations total, not 8 per direction** — measured. It is far
cheaper than the object it animates. The binding constraint is not budget but the **20-concurrent-job
cap**: an 8-direction animation is 8 jobs, so only two archetypes animate at a time and a full
roster is hours of wall clock.

**A PARTIAL ANIMATION LOOKS EXACTLY LIKE A SLOW ONE.** The signature is a frame count of `63/72` —
one direction short of eight. Count frames *per direction*, not per archetype, or you cannot tell
which is missing. `animate_object` takes `animation_group_id` + `directions`, so re-firing a single
direction costs 1 generation instead of 8 and the other seven keep their existing timing.

**But check `pending jobs` with `get_object` BEFORE re-firing.** The download endpoint locks (423)
while *any* job on the object is pending, and a re-fired direction does not replace a slow one — it
queues *alongside* it. Because the lock waits for both, re-firing a direction that was merely slow
makes the install strictly **later**. The destrier lost about fifteen minutes to exactly that, with
two south-east jobs running at once.

**Two independently generated textures will not tone-match.** The two grass tiles came out with
means of (41,86,14) and (66,143,49) and read as a quilt. Gain-match the second to the first.

**Verify the server is actually serving before navigating.** `py -m http.server ... && echo serving`
after a failed command prints the echo and starts nothing — I spent several probes debugging an
empty page. Fetch the URL and check the byte count.

---

## Two architectural walls — do not build past these

**The auction cannot host player listings.** Static PWA on GitHub Pages, peer-to-peer WebRTC with an
elected host: no neutral party to escrow the item or the glory, no storage outliving the host's tab,
and a glory balance sitting in the buyer's own editable save. It is built on a generic
`{id, item, price, seller}` listing and **`auctionListings()` is the single function a backend would
extend** — the UI, buy path, price rules and ledger all work unchanged. Real listings need a server.

**Diamonds cannot collect real money client-side.** Build the currency, catalogue, gating and UI;
stub the purchase. `diamondPacks()` is the one function a payment provider would replace.

---

## Memory files

`~/.claude/projects/C--Users-darkc/memory/` — read these first:
- `emberrealm-mob-rules.md` — movement signatures, weapon-only projectile count, fire-rate
  quantisation, QA traps.
- `emberrealm-economy-roadmap.md` — glory rules, the forge, vendor roles, and why the auction
  cannot take player listings.
