# EmberRealm — session handoff

Written 2026-07-26. Everything below is shipped and pushed to `main` unless marked otherwise.
Current service-worker version: **`emberrealm-v303`** (`sw.js`, bump every release).

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

## Do this next, in order

1. **Wire the auctioneer NPC to `openAuction()`.** It works and is tested but *nothing calls it*.
   Smallest, most self-contained next step.
2. **Rework the four Hearth vendors** → blacksmith, event NPC, auctioneer, diamond merchant.
   **LEAVE THE BLACKSMITH ALONE** — it is reserved for a future item-**fusion** system. Open design
   work: invent the items fusion consumes (materials / catalysts / duplicate gear) and where they drop.
3. **Cosmetics portal + diamonds.** The Wardrobe room exists as a "coming soon" sign. The currency,
   catalogue, gating and UI are all buildable; **collecting real money is not possible client-side**
   (needs a payment provider and a server to verify).

### Then, older outstanding items
- **1–20 zone progression.** The user's long-standing complaint that "the spawn is weird with how
  the territories are laid out". Root cause found: **theme band and radial level are separate
  mappings**, so The Landing Sands is described Lv1–8 but spawns Lv20 in places.
- **Per-class stat caps.** `spd` is hard-flattened to 8 for every class by a `FLAT_CAP` override
  that bypasses the affinity maths; `vit`/`luck` come out near-identical so they carry no identity.
  `def`/`wis` already work correctly (Knight DEF cap 11 vs caster 6).
- **The tier above T12.** Architecture reserved: one `LOOT_BANDS` row, one sprite, one `TIER_NAMES`
  entry, no protocol change. Name candidates: Riftforged, Sunderborn, Cindercrown, Emberheart.
- **Verify how `sw.js` picks up new script files.** `17b_auction.js` was added and the cache
  manifest does not enumerate scripts — confirm before a release rather than assuming.

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
