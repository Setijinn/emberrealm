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

**Enemy AI is host-only.** A co-op client interpolates snapshots and runs none of it
(`netIsClient()` guard in `07_update.js`). Anything that damages the player from an enemy needs
three parts: serialize in `netBroadcast`, deserialize in `netApplyWorld`, apply client-side in
`netHazards` (all `14b_netsync.js`). The snapshot row is a **fixed 15-slot array**.

**Cosmetics are colour only** — never a stat, never a silhouette.

**Permadeath is the bridge**, not a level number.

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
- **Anchored phases**: the boss walks to its arena centre and goes untouchable. Overworld lairs
  store their centre in `R.lairs[b]`; dungeon chambers in `room.bossCh`.
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
- `EBEH` is the engagement rule (when to approach, when to break off); a species' `sig` is its
  movement *shape*. Both are needed or every creature walks the same straight line.
- Shot count and cadence ramp with level (`eShotCount`, `eFireCd`). The flat damage floors in
  `makeEnemy` are the low-level difficulty dial.

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
- **An ascension's capstone only applies when the character's class owns that ascension.**

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
