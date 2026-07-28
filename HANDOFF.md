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
- Verify by driving the game. Report measurements. Say plainly when something fails, or when you
  did not test it.

**How `sw.js` picks up a new script file:** it does not enumerate them. `ASSETS` precaches only
`index.html`, the manifest and the icons; every `.js` is **network-first**, so a new numbered file
is live as soon as `index.html` lists it.

---

## Invariants — the rules the design rests on

**Tier is the only power axis.** Rarity sets border colour and affix count, nothing else.

**`MAXT` stays 12. Do not raise it.** It is the top *rollable* tier and every random draw clamps to
`MAXT-1`, which is the only thing keeping T13 out of drop tables, auction shelves and shops.
`_nTiers()` in `08c_embersprites.js` reads `MAXT` for the same reason — counting the 13th tier name
would re-map every existing tier onto the wrong sprite.

**Glory must never buy power, and nothing may mint spendable glory mid-run.** It is account-level
and paid only on permanent death, scored from what the run accomplished. Bounties *bank* onto the
run and pay out on death for exactly this reason.

**Loot from a kill is always a sack.** One sack per kill; its art follows the best item inside it
(`bagAt` → `bandOfTier(bagTopTier)`), so a relic makes it a reliquary. Progression reads through
material and ornament, never through shape. The Emberwrought chest is the ONE exception, and it is
not a drop — it is a placed event object that looks like nothing else precisely so it can never be
mistaken for something a monster left behind.

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

### Relics — T13 Riftforged
- Forty-eight relics in **twelve four-piece sets** (`17e_relics.js`). `RELIC_T` (12) is the index
  of the 13th `TIER_NAMES` entry.
- A relic is an **ordinary item** with `relic:id` — same equip path, satchel, compare and icon.
  Its id rides in `rpg.eqAff[slot].rel`.
- It drops **shaped for its finder** (their class's `wt`/`mt`), so `canEquip` just works.
- Fixed exclusive affixes no roll can reach; some carry a trait, and set bonuses reuse the `player`
  flag family the ascension capstones already set — **no new combat branches**. Flags read only by
  `12b_abilities` modify one ability rather than always applying, so they are deliberately unused.
- Six dungeons drop them, two sets each, `relicChanceFor()` returning 0 everywhere else.
- `RELIC_COL` / `--relic` (#ffd24a) is the one gold for everything relic. The icon stamps **R**
  where ordinary items stamp their tier.

### Bosses
- Twelve identities in `GBOSS`; a boss's index is its **`ring`** everywhere in the code (a legacy
  name — it is a boss id, not a terrain band).
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
  Sweep test: spawn every fight, drive it to 0 with fixed DPS, assert `kill != NEVER` and that the
  longest immune streak is <= `ANCHOR_WIN`.
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
| **Bram** | **BLACKSMITH — reserved for item fusion. Leave alone.** Stock is empty by design; the stall stays. |
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

- **Top-level `const` is a LEXICAL global, not a `window` property.** `window[name]` lookups against
  const-declared images silently return `undefined` — this is why every loot sack in the game drew
  as plain burlap for weeks.
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
- `emberrealm-economy-roadmap.md` — glory rules, the blacksmith fusion reservation, vendor roles,
  and why the auction cannot take player listings.
