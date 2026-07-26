# EmberRealm — session handoff

Written 2026-07-26. Everything below is shipped and pushed to `main` unless marked otherwise.
Current service-worker version: **`emberrealm-v334`** (`sw.js`, bump every release).

**How `sw.js` picks up a new script file** (this was an open question): it does not enumerate them.
`ASSETS` precaches only `index.html`, the manifest and the icons, and every `.js` is **network-first**,
so a new numbered file is live as soon as `index.html` lists it. The cache-first trap is the *browser's*
HTTP cache, not the SW — hence the fresh-port rule below, which is real and cost time again today.

---

## How to work on this project

- Plain numbered JS files loaded in order by `index.html`. **No build step.**
- **Bump `CACHE` in `sw.js` on every commit** or the service worker serves stale files.
- **Serve on a fresh port for every edit** (`py -m http.server 86NN`) — the SW is cache-first.
- Drive QA with Chrome MCP `javascript_tool`. The tab may be throttled; step frames manually with
  `for(let i=0;i<N;i++){update(0.016);}`.
- **Commit AND push every change, fetching first** — a collaborator shares the repo.

### QA traps that have cost real time
- Place the QA player in verified **open ground** (LOS clear in 16 directions), and re-check the
  room didn't change after the first `update()` — placing across a room boundary teleports the
  player thousands of px and every measurement silently becomes nonsense.
- Clear `allies` each frame when measuring weapon DPS, or the pet's damage lands in the total.
- Enemy AI is **host-only**; a co-op client interpolates snapshots and runs none of it.
- An ascension's capstone only applies when the character's class owns that ascension.
- The global CSS rule is `canvas{position:fixed;inset:0;width:100vw}` — it exists for the
  fullscreen game canvas, so **every in-panel canvas must opt out** with `position:relative;inset:auto`
  or it stacks invisibly at its card's origin at full viewport size.
- `fire()` is polled once per frame and discards the remainder, so **fire rate is quantised to
  16ms steps**. A rof change that doesn't cross a frame boundary does nothing. Always measure.

---

## What shipped this session

**Loot rework (the approved plan, complete).**
- Two live co-op bugs fixed: clients could never loot (a 6-char id prefix meant grant addressing
  never matched, so pickups *destroyed* the item), and both boss branches minted duplicate bags on
  every machine.
- **Rarity is no longer power.** It sets border colour and affix count only; `RAR_MULT` is deleted.
  Tier is the sole power axis.
- **Per-area tier tables** (`ZONE_TIERS`, keyed by the 13 clumps `zoneAt()` returns). Public gear
  caps at T8 everywhere; everything above is soulbound. 5% overflow tail.
- **Bags hold typed slots** (`BAG_SLOTS`) — ~0.94 items/roll, 35% empty, occasionally 2–3.
- **Two channels**: public (2.5% trash, shared) and soulbound (rolled independently per eligible
  player, guaranteed once per boss). Soulbound rows are filtered *per connection* at send time, so
  another player's T12 never reaches the wire.
- **Sack panel** with per-item TAKE / EQUIP / COMPARE, sprites, and stat deltas vs equipped.
- Tier is **stamped into the item icon**, in whichever corner the art left empty.
- **12 dungeon relics**, one per dungeon; 12% from the dungeon boss, 1.5% from its overworld form.

**Economy (directives, not a formal plan).**
- **Gold wiped entirely.** Selling removed with it.
- **Glory**: account-level, awarded *only* on permanent death, scored from what the run did
  (dungeons 240 each, bosses, kills, fog uncovered, levels, relics, deepest zone). One `GLORY` table.
- **Permadeath is the bridge**, not `rpg.lvl >= 20`.
- **Potions refill themselves** — one per 48s, cap 5.
- **Neutral glory value per item, ±50% listing band.**
- **Loot boosters are the premium tier**: coins 300/6,000/120,000, drop 0.6%/10%; the Scroll of
  Plunder is deleted and Fortune is not trainable at all.
- **Permanent trainable stat halved** (`TRAIN_BASE` 12→6, badly-scaled steps fixed).
- **Auction house** shipped as a **house rotation**: 6 items derived from the calendar date via a
  seeded PRNG, so everyone sees the same shelf with nothing stored or synced.

---

## The four stalls (items 1–3 — done 2026-07-26)

| stall | role | opens |
|---|---|---|
| **Bram** | **BLACKSMITH — reserved for item fusion, untouched** | the old shop panel (T1–T3 weapons, weapon relics) |
| Sella | diamond merchant | the exchange: diamond packs (stubbed) + the cosmetic catalogue |
| Maren | auctioneer | the date-seeded house rotation |
| Odo | event NPC | the daily bounty board |

- **Stalls are opened at the stall.** The HUD shop button is gone; vendors register a `portalPrompt`
  of `kind:'vendor'` and the prompt above the stall reads SHOP / AUCTION / BOUNTIES / DIAMONDS.
  The Wardrobe's mirror uses the same path (`kind:'wardrobe'`, from `ROOM_DEFS.COSMETICS.wardrobe`).
- **Bounties** (`17c_bounty.js`): 3 date-seeded objectives, first slot always an everyday kill goal
  so a short session can always touch the board. Progress is per account per day, collected off the
  existing `runNote()` calls. **Claiming BANKS the glory onto the run** and it pays out on death —
  nothing may mint spendable glory mid-run.
- **Cosmetics** (`17d_cosmetics.js`): account-level diamonds (`u.gems`), a 7-item catalogue priced in
  glory *or* diamonds but never both, worn via `u.skin`, applied by recolouring the class's own art
  through `_tintImg`. **Colour only — never a stat, never a silhouette.** Diamond packs are a stub;
  `diamondPacks()` is the one function a payment provider would replace.
- **Relics moved to the equipment screen** (`paintRelics`). They own the `wpnL`/`armL` slot and used
  to be equippable *only* from inside a vendor's shop rows, so retiring a stall would have stranded
  any armour relic you had earned.
- **Retired**: Sella's T2/T3 armour + helms and Odo's three bought pets — both were glory buying
  power, and the pets were a second follower system running beside the egg/Sanctuary one.

## Relics: twelve four-piece T13 sets (done 2026-07-26)

The band above the ladder exists, and forty-eight relics in twelve SETS live on it. Data in
`17e_relics.js`; `11_ui.js` keeps only the machinery that turns one into a wearable item.

- `TIER_NAMES` has a 13th entry, **Riftforged**; `RELIC_T` (12) is its index.
- **`MAXT` stays 12 — do not raise it.** It is the top *rollable* tier and every random draw clamps
  to `MAXT-1`, which is the only thing keeping a T13 out of drop tables, auction shelves and shops.
  `_nTiers()` in `08c_embersprites.js` reads `MAXT` for the same reason: counting the 13th name
  would re-map every existing tier onto the wrong sprite.
- A relic is an **ordinary item** (`{k, wt|mt, t:RELIC_T, relic:id, aff:[...]}`) — same equip path,
  satchel, compare and icon as anything else. Its id rides in `rpg.eqAff[slot].rel`.
- Each carries **fixed exclusive affixes** no roll can reach; **seven also carry a trait**, which
  reuses the `player` flag its matching ascension capstone already sets (`burnHit`, `splash`,
  `moveRof`, `execute`, `killHeal`, `thorns`, `slowAura`) — no new combat special cases.
- A relic drops **shaped for its finder** (their class's `wt`/`mt`), so `canEquip` just works.
- **Twelve sets of four** — weapon, armour, helm, ring. Wearing all four adds a rule none of the
  pieces carries alone (`activeRelicSet()`), from the same verified flag family. Set bonuses only
  use flags read in `06_combat`/`07_update`; flags read only by `12b_abilities` modify one ability
  rather than always applying, so they are deliberately not used.
- **Six dungeons drop them**, two sets each: Shattered Vault + Windward Roost at **0.25%**, and
  Cinder Crypt / Scorch Barrows / Ashen Keep / Core Sanctum at **1%**, per boss kill, dungeon only.
  `relicChanceFor()` returns 0 everywhere else — no overworld boss, no shallow dungeon.
- Archetype spread is **5 caster / 4 agile / 3 tank** against 7 robe / 6 leather / 4 plate classes.
  Every set fits every class (pieces adapt to `wt`/`mt`); the STATS are what suit an archetype.
- Forty-eight sprites at `assets/items/relic_<id>.png`. The icon stamps **R** where ordinary items
  stamp their tier, and `RELIC_COL` / `--relic` (#a06bff) is the one violet for everything relic.
- **INSANE DROP!** (`insaneDrop`) fires for the finder as it hits the ground, showing the piece,
  its set and your progress toward four.
- `rpg.relics` is the record (duplicate rule + death-screen scoring); `migrateRelics()` carries old
  `wpnL`/`armL` saves across. The four purchasable legendaries are **not** relics and are unchanged.

## Also shipped 2026-07-26 (later session)

- **Loot: one sack per kill.** Everything a kill pays out goes in one sack (1/kill, ~4.7 pieces off
  a boss). **With other players present the channels stay apart** — one shared sack plus your own
  bound one — because the netsync keeps bound loot off other wires entirely rather than tagging it
  and trusting clients to filter. The user confirmed one personal + one shared is the wanted shape.
  A sack's art follows its best item (`bagAt` → `bandOfTier(bagTopTier)`), so a relic inside makes
  it a reliquary. Anything with gear or 2+ pieces opens the panel; a lone tonic/coin still vacuums.
- **`LOOT_BANDS` sprite lookup was broken** since the art landed: it resolved the sprite name off
  `window`, but those images are `const` (lexical, never a window property), so **every** sack drew
  as plain burlap. Use `lootSackImg()`. It was the only `window[...]` sprite lookup in the codebase.
- **Co-op had no enemies for clients.** Clients never activate spawn points (deliberate), but the
  host measured its spawn ring from its OWN hero, so a client anywhere else walked an empty world.
  The host now anchors on every hero it simulates for (`netSimAnchors`), spawns and culls against
  the nearest, and the swarm cap is per hero using the zone THAT hero stands in.
- **Loading screen** (`10b_loading.js`). Images register in `ASSET_IMGS` at creation (`_track`);
  the curtain waits on exactly that list (~3,500 images), capped at 12s, 404s count as settled.
- **The 1–3s "refresh" was real**: `boot.js` called `location.reload()` the moment a new SW
  activated. It is deferred while `inGame` and taken at the menu (`emberReloadIfPending`).
- **Auto potion** at 5/10/15% with a standing warning that it will not keep you alive, and the
  settings rows an input cannot use (manual aim on touch, vibration/fullscreen on desktop) grey out
  and refuse taps. All eight settings were audited against real behaviour.
- **Minimap** shrunk to 148px, zoom buttons scale off the panel.

## The Monk's weapon (done 2026-07-26)

The Monk was the one class whose weapon slot did not work. `CWEAP.monk` was `'fists'`, and
`'fists'` was filtered out of **both** item generators, so no drop, sack or auction shelf could
ever produce a weapon a Monk could equip — `rpg.wpn` was frozen at 0 for the life of the character
while every other class climbed to a T12 worth +218 ATK. `WSPR` had no `fists` entry either, so
`wpnSpr` fell back to `WSPR.sword`: a Monk's weapon icon had always drawn as a sword.

- **`WTYPE.gauntlet`** ("Gauntlets") is the Monk's weapon, carrying the *identical* numbers fists
  had (reach `spd*life` ≈ 94px, the shortest in the game, hence the fastest rate). Nothing was
  re-derived — the rate rule needs no revisit.
- **`fists` is retired in place** with `legacy:1`, not deleted. The generators now filter on
  `!WTYPE[x].legacy` (`mkItem`, `auctionListings`) instead of matching the name, so retiring a type
  is one flag. Keeping the row is what stops a stale save throwing in `itemBaseName`.
- **`migrateWpnType(ch)`** (beside `migrateRelics`, called from `loadRPG`) retypes satchel weapons
  whose type is `legacy` to the class's current one. Only legacy types are touched — an off-class
  weapon being carried to trade is a supported state and must never become free power. Without it
  a Monk's **T13 relic weapon** would sit unequippable forever.
- 12 sprites at `assets/items/wpn_gauntlet_0..11.png`, registered by adding one word to the list in
  `08c_embersprites.js`; `WSPR.gauntlet` covers the procedural fallback.
- **The gauntlet plays by the same rules as every other weapon** — including drawing in the hand in
  the fallback path. The old `wtype!=='fists'` exception is gone.
- Cost, accepted knowingly: the weapon pool went 6 → 7 types, so every *other* class's chance of a
  usable weapon drop falls 16.7% → 14.3%. Biasing `mkItem` toward the roller's own `CWEAP` would
  fix that (a knight currently sees ~83% unusable weapons) and is a separate design call.

## Do this next

1. **Fusion for the blacksmith.** Still the open design work: invent the items fusion consumes
   (materials / catalysts / duplicate gear) and where they drop. Nothing is built.
2. **Bram still sells power for glory.** T1–T3 weapons and two legendaries, priced in glory, which
   the economy forbids everywhere else. Left alone because the blacksmith is reserved — decide what
   he should be when fusion lands.
3. **The bounty board has no fog objective.** `fogPct()` samples the *current character's* mask, so
   it is not an incremental daily counter. Would need a real per-day tile counter to add one.

### Then, older outstanding items
- **1–20 zone progression.** The user's long-standing complaint that "the spawn is weird with how
  the territories are laid out". Root cause found: **theme band and radial level are separate
  mappings**, so The Landing Sands is described Lv1–8 but spawns Lv20 in places.
- **Per-class stat caps.** `spd` is hard-flattened to 8 for every class by a `FLAT_CAP` override
  that bypasses the affinity maths; `vit`/`luck` come out near-identical so they carry no identity.
  `def`/`wis` already work correctly (Knight DEF cap 11 vs caster 6).
- ~~**The tier above T12.**~~ Built: it is **T13 Riftforged**, and the twelve relics are what sit on
  it. See the relic section above.
- ~~**Verify how `sw.js` picks up new script files.**~~ Answered at the top: it does not enumerate
  them; `.js` is network-first, so a new numbered file is live once `index.html` lists it.

---

## Two architectural walls (do not build past these)

**The auction cannot host player listings.** Static PWA on GitHub Pages, peer-to-peer WebRTC with an
elected host: no neutral party to escrow the item or the glory, no storage outliving the host's tab,
and a glory balance in the buyer's own editable save. It is built on a generic
`{id, item, price, seller}` listing and **`auctionListings()` is the single function a backend would
extend** — the UI, buy path, price rules and ledger all work unchanged. Real listings need a server.

**Diamonds cannot collect real money client-side.** Build the currency, catalogue, gating and UI;
stub the purchase.

---

## Memory files

`~/.claude/projects/C--Users-darkc/memory/` — read these first:
- `emberrealm-mob-rules.md` — movement signatures, weapon-only projectile count, fire-rate
  quantisation, QA traps.
- `emberrealm-economy-roadmap.md` — glory rules, the blacksmith fusion reservation, vendor roles,
  and why the auction can't take player listings.
