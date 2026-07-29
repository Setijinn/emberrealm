# CLAUDE.md

Guidance for AI assistants (Claude Code and others) working in this repository.

## What this project is

**EmberRealm** — a static-PWA pixel-art action RPG. Plain, numbered JavaScript files loaded
in order by `index.html`. **No build step, no bundler, no package manager, no dependencies**
(the one external script is PeerJS, loaded from a CDN for co-op). It ships as-is to GitHub Pages
and installs as a phone app via the service worker.

Repo: `Setijinn/emberrealm`. Everything lives at the repo root with relative paths so it works
on GitHub Pages out of the box.

## Read these first — they are authoritative, not this file

This project keeps its real documentation in two files, split by lifespan on purpose. **When they
disagree with anything here, they win.**

1. **`KICKOFF.txt`** — the **volatile** half. Current state, what shipped most recently, the
   hard rules, and what to do next. Read all of it; it is kept current. Start here every session.
2. **`HANDOFF.md`** — the **durable** half. Architecture, invariants, the subsystem map, QA traps,
   and the two architectural walls not to build past. Changes when the *design* changes, not when
   a session ends.

They are deliberately split because they used to both carry "what shipped this session", drifted,
and the stale one confidently misled. Exactly one file (`KICKOFF.txt`) owns where the project *is*;
the other owns how it *works*. **Preserve that split** — do not add current-state notes to
`HANDOFF.md`, and do not add durable architecture rules only to `KICKOFF.txt`.

Also referenced by `HANDOFF.md`: two memory files under
`~/.claude/projects/C--Users-darkc/memory/` (`emberrealm-mob-rules.md`,
`emberrealm-economy-roadmap.md`). These live on the original author's machine and may not be
present in your environment; don't block on them.

## Repository layout

- **`index.html`** — DOM, then loads `boot.js` and every ordered module `<script defer>` in a
  fixed order (see below). This ordering **is** the dependency graph — there are no imports.
- **`boot.js`** — service-worker registration, safe-moment auto-reload, fullscreen/landscape lock.
- **`style.css`** — all UI styling (~72 KB).
- **`sw.js`** — service worker / offline cache. **Two caches**: `CODE_CACHE` (bump on every commit)
  and `ART_CACHE` (bump only when art files change). See the note at the top of the file.
- **`NN_name.js` / `NNx_name.js`** — the game, in load order. The numeric prefix is the load
  slot; a letter suffix (`00b`, `17e`) inserts a file near its siblings. Rough map:
  - `00*` data & prebaked worlds (`00d_vgrove.js` is a large generated grove — ~820 KB)
  - `01_constants.js` — `LV_CAP`, `MAXT`, `MOVE_SCALE`, and other axis constants
  - `02_worldbuild.js`, `03_entities.js` (world/zones/enemies — large), `03b_critters.js`
  - `04_collision.js`, `05*` controls/targeting/keyboard
  - `06_combat.js`, `07_update.js`, `08*` render/sprites, `09*` sprites/minimap/detail/compass
  - `10_loop.js` + `10b_loading.js`, `11_ui.js` (panels/vendors/map — very large)
  - `12_devpanel.js` + `12b_*` dev tools & abilities, `13*` skills/perks/ults
  - `14_coop.js` + `14b_netsync.js` (PeerJS co-op), `15_pets.js`, `16_maxstats.js`
  - `17*` bosses (mech/anim/profiles/fights), auction, bounty, cosmetics, relics, vault, mounts,
    boosts, integrity
  - `18_forge.js` — the Forge
- **`assets/`** — sprites, fonts, audio, per-class and per-boss art (~86 subfolders).
- **`tools/`** — Python dev/QA scripts (see below).
- **`README.txt`, `SETUP.md`** — deploy/install guides (Netlify, GitHub Pages, Cloudflare).
- Generated/ignored: `_selftest.html`, `_lvaudit.html`, `.claude/` (see `.gitignore`).

### Load order matters

`index.html` lists the scripts in the exact order they must run. A file may reference globals
defined by an earlier file but **not** by a later one (top-level `const` is in its temporal dead
zone until declared). When adding a file, insert its `<script defer>` at the correct slot in
`index.html` — the service worker does not enumerate scripts; every `.js` is network-first, so a
new file goes live the moment `index.html` lists it.

## Development workflow

There is nothing to build. To work on the game:

1. **Serve it** with `python tools/serve.py` (the docs write `py`; any Python 3 works). It binds
   one fixed port (**10500**), sends `no-store` on every response, and kills its own previous
   instance before binding. **Do not** fall back to `python -m http.server` on a fresh port per
   edit — that leaks a process every time (one session found 232 orphaned servers holding 3.2 GB).
   `serve.py` fixes the caching instead of dodging it. Verify it is actually serving (fetch the URL
   and check the byte count) before navigating.
2. **`serve.py` only defeats the browser HTTP cache.** The service worker is a separate,
   cache-first layer for art. **Bump `CODE_CACHE` in `sw.js` on every commit** or players get
   stale files. Bump `ART_CACHE` only when art files are added or replaced.
3. **Run the self-test** after touching the tier ladder, loot tables, the level cap, or the forge:
   `python tools/selftest.py`. It injects one `<script defer>` into the **real** `index.html`
   (never a hand-copy, which would drift), runs it via `chrome --headless=new --dump-dom`, and
   reads results back — no Node, no CDP client required. `--headless=new` is mandatory. Requires
   `serve.py` running in another shell.
4. **QA by driving the game and reporting measurements** — not by assuming. Step frames manually
   (`for(let i=0;i<N;i++){update(0.016);}`); never wait on `requestAnimationFrame` (a throttled or
   background tab reports zero frames, which looks like a break but isn't). **A syntax error is
   invisible to manual frame-stepping** — after any scripted edit, reload and read the console for
   `SyntaxError` before trusting a measurement.
5. Say plainly when something fails or when you did not test it.

Other `tools/` scripts (`install_mounts.py`, `install_forge_art.py`, `extract_riders.py`,
`calibrate_seats.py`) are one-off art/asset pipelines driven by PixelLab; see `HANDOFF.md` for the
hard-won lessons on prompting and generation budgets before running them.

## Git workflow

- **Commit AND push every change, fetching first** — a collaborator shares this repo.
- Branch conventions and the current working branch are given by the task/session, not this file.
- Do not open a pull request unless explicitly asked.

## Hard rules — invariants, not preferences

These are load-bearing. `HANDOFF.md` explains the reasoning for each; the short forms:

- **Nothing may sit above `LV_CAP` (50).** `levelUp` stops there and there is no prestige level.
  Content that computes its own level must clamp to `LV_CAP` (or `ISLAND_LV` = 20 for starter
  content). `_checkLevelCap()` fails at boot on violations.
- **Tier is the only power axis.** Rarity sets border colour and affix count, nothing else.
- **The ladder has 14 rungs.** T1–T12 are *found*. **Scavenged Dreams** (index 12) is *dropped*
  and written **`SD`, never `T13`** — go through `tierTag()`. **T14 Riftforged** (index 13) is
  relics. `MAXT` is 13; the sprite-band divisor is the separate `ART_TIERS` (frozen at 12) — do
  not make `_nTiers()` read `MAXT` or `TIER_NAMES.length` again.
- **Loot from a kill is always a sack**, one per kill, band decided by the best item inside it.
  The Emberwrought chest is the one exception — a placed event object, not a drop. A creature
  carrier (mounts/eggs) is the one *additional* sack, when owed.
- **Glory must never buy power, and nothing may mint spendable glory mid-run.** It is
  account-level and paid only on permadeath.
- **Do not build player-to-player auction listings**, and **do not collect real money for
  diamonds client-side.** The peer-to-peer static-PWA architecture cannot host either honestly.
  These are the two "walls" in `HANDOFF.md`; `auctionListings()` and `diamondPacks()` are the
  single functions a real backend would replace.
- **Co-op invariants:** only one machine simulates a room (`netSimulates()`), bound loot is
  filtered per-connection at send time, and the wire formats (`NKIND` kind field, the enemy
  snapshot row) are **append-only, never renumbered** — an older peer decodes by index.

## Conventions & gotchas worth internalizing

- **Top-level `const` is a lexical global, not a `window` property** — `window[name]` returns
  `undefined` for it. Resolve sprites through helper functions (e.g. `lootSackImg()`), not
  `window` lookups.
- **Size sprites by their opaque bounding box** (`_imgBBox`), never `naturalWidth` — PixelLab art
  carries transparent margin.
- **Editing files with a script:** build the whole text in memory and write to a temp before
  moving it into place. Opening the target for writing first truncates it if anything throws.
- **Difficulty scales through one dial** (`bossPace(e)`); no mechanic may hard-code a timing.
  `MOVE_SCALE` scales locomotion only — not projectile speeds, telegraphs, or cadence.
- **Any new immunity needs an exit the player can reach.** Verify with dev panel → BALANCE →
  "Killability sweep" (drives all registered fights and asserts a reachable exit).
- Account-level things (pets, mounts, the Vault, forge materials) survive permadeath; per-run
  things do not.

See `HANDOFF.md` → "QA traps that have cost real time" for the full, current list.
