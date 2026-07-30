// ===================================================================================
// 17m_integrity.js — THE TABLES MUST AGREE, AND SOMETHING MUST SAY SO
//
// This project's characteristic bug is not a crash. It is a table that quietly stopped lining up
// with the table beside it, degrading through a `||` default or an `if(!B) continue` that hides the
// miss. A full audit found six of them at once, and one was introduced the same day by the person
// writing the audit:
//
//   * MOB_ARCH declared 37 keys TWICE with conflicting values — 37 species rendered as the wrong
//     archetype, and which one won was decided by lexical position in an object literal.
//   * MOBSPEC grew to 10 bands while its three expansion tables stayed at 9, so the new zone
//     shipped with 3 chasers where every other band has 7+. The merge loop's `if(!A||!B) continue`
//     swallowed it in silence.
//   * ELITE_TITLES has 9 rows for an index space that reaches 12, so a Lv12 quarry handed out the
//     Lv50 Ashfall crown-titles.
//   * DSHAPE is dereferenced immediately (st.rmax) — a missing entry is a TypeError.
//   * DDEPTH falls back to `||ring`, so a missing entry silently builds a 482-wide dungeon.
//   * Ten DUNSPEC species had no MOB_ARCH row and fell back to the generic hound.
//
// Adding one boss means touching eighteen hand-synced tables and NOTHING checked that they agreed.
// This is that check. It runs once at boot, costs a few milliseconds, and its whole job is to fail
// loudly the moment two tables disagree instead of a month later when a player notices a Lv12 mob
// wearing a Lv50 title.
//
// It is deliberately NOT a throw in production: a shipped game that refuses to start because a
// cosmetic table is one row short is worse than the bug. It logs, and the dev panel shows it.
// ===================================================================================

const INTEGRITY = { errors: [], warns: [], ran: false };

function _iErr(msg){ INTEGRITY.errors.push(msg); }
function _iWarn(msg){ INTEGRITY.warns.push(msg); }

// Parallel arrays that are all indexed by BOSS ID. Any disagreement here is the class of bug that
// produced DSHAPE (a TypeError) and DDEPTH (a silently enormous dungeon).
function _checkBossTables(){
  if(typeof GBOSS==='undefined') return;
  const n=GBOSS.length;
  const arrays={ BOSS_PROJ:(typeof BOSS_PROJ!=='undefined')?BOSS_PROJ:null,
                 DPUZ:(typeof DPUZ!=='undefined')?DPUZ:null,
                 DPUZ_LABEL:(typeof DPUZ_LABEL!=='undefined')?DPUZ_LABEL:null,
                 DSHAPE:(typeof DSHAPE!=='undefined')?DSHAPE:null,
                 DDEPTH:(typeof DDEPTH!=='undefined')?DDEPTH:null,
                 DUNSPEC:(typeof DUNSPEC!=='undefined')?DUNSPEC:null };
  for(const k in arrays){ const a=arrays[k];
    if(!a){ _iWarn(k+' is not defined'); continue; }
    if(a.length!==n) _iErr(k+' has '+a.length+' entries, GBOSS has '+n);
  }
  // keyed-by-boss objects: every boss needs an entry or the lookup falls through
  if(typeof LAIR_ARCH!=='undefined') for(let i=0;i<n;i++)
    if(!LAIR_ARCH[i]) _iErr('LAIR_ARCH has no entry for boss '+i+' ('+(GBOSS[i]&&GBOSS[i].n)+')');
  if(typeof LAIR_BOSSES!=='undefined' && LAIR_BOSSES.length!==n)
    _iErr('LAIR_BOSSES lists '+LAIR_BOSSES.length+' of '+n+' bosses');
  if(typeof BOSS_SLOT_N!=='undefined' && BOSS_SLOT_N!==n)
    _iErr('BOSS_SLOT_N is '+BOSS_SLOT_N+', GBOSS has '+n);
  // ZBOSS maps clump -> boss id; every boss must rule exactly one clump or it can never spawn
  if(typeof ZBOSS!=='undefined'){
    const seen={};
    for(const b of ZBOSS){ if(b>=0){ if(seen[b]) _iErr('ZBOSS gives boss '+b+' two territories'); seen[b]=1; } }
    for(let i=0;i<n;i++) if(!seen[i]) _iWarn('boss '+i+' ('+(GBOSS[i]&&GBOSS[i].n)+') rules no territory — it can never spawn');
  }
  // a puzzle key with no implementation leaves the chamber empty
  if(typeof DPUZ!=='undefined'){
    const known=['regrow','chase','order','simon','hold','relay','candles','ambush','timing'];
    DPUZ.forEach((k,i)=>{ if(k && known.indexOf(k)<0) _iErr('DPUZ['+i+'] is "'+k+'", which nothing implements'); });
  }
}

// Bands index a DIFFERENT space from boss ids, and conflating the two is its own recurring bug —
// it is what BAND_ROW exists to prevent and what ELITE_TITLES still gets wrong.
function _checkBandTables(){
  if(typeof MOBSPEC==='undefined') return;
  const n=MOBSPEC.length;
  // Named directly rather than looked up by string: these are lexical globals, not window
  // properties, so there is no dynamic way to reach them that is not eval.
  const expansions=[['MOBSPEC_MORE',  (typeof MOBSPEC_MORE!=='undefined')?MOBSPEC_MORE:null],
                    ['MOBSPEC_MORE2', (typeof MOBSPEC_MORE2!=='undefined')?MOBSPEC_MORE2:null],
                    ['MOBSPEC_NIGHT', (typeof MOBSPEC_NIGHT!=='undefined')?MOBSPEC_NIGHT:null]];
  for(const [k,a] of expansions){
    if(!a) continue;
    if(a.length!==n) _iErr(k+' has '+a.length+' bands, MOBSPEC has '+n+
      ' — the merge loop skips the difference in silence');
  }
  // every band that a territory actually uses must have the art and data tables it needs
  const R=(typeof rooms!=='undefined')?rooms['G']:null;
  const T=(R && typeof _territories==='function')?_territories(R):null;
  if(T) for(const t of T){ const b=t.band;
    if(typeof GBANDCOL!=='undefined' && !GBANDCOL[b])
      _iErr('band '+b+' ('+t.name+') has no GBANDCOL — indexed unguarded, this is a TypeError');
    if(typeof MRAMP!=='undefined' && !MRAMP[b]) _iWarn('band '+b+' ('+t.name+') has no MRAMP colour');
    if(typeof MOBSPEC!=='undefined' && !MOBSPEC[b]) _iErr('band '+b+' ('+t.name+') has no MOBSPEC roster');
    if(typeof BAND_ROW!=='undefined' && BAND_ROW[b]===undefined)
      _iErr('band '+b+' ('+t.name+') has no BAND_ROW — it will read a boss art slot\'s name and tint');
    if(typeof ELITE_TITLES!=='undefined' && !ELITE_TITLES[b])
      _iWarn('band '+b+' ('+t.name+') has no ELITE_TITLES row — it inherits another band\'s titles');
  }
}

// Every species that can spawn needs an archetype, or it silently renders as the generic hound.
// And no species may appear in two dungeons, or on the surface AND in a dungeon.
function _checkSpecies(){
  if(typeof MOB_ARCH==='undefined') return;
  const need=new Set(), where={};
  const add=(list,tag)=>{ if(!list) return; for(const m of list){ if(!m||!m.n) continue;
    need.add(m.n); (where[m.n]=where[m.n]||[]).push(tag); } };
  if(typeof MOBSPEC!=='undefined') MOBSPEC.forEach((b,i)=>{ if(!b) return;
    add(b.c,'band'+i); add(b.s,'band'+i);
    if(b.d){ add(b.d.c,'band'+i+'.d'); add(b.d.s,'band'+i+'.d'); } });
  if(typeof DUNSPEC!=='undefined') DUNSPEC.forEach((d,i)=>{ if(!d) return; add(d.c,'dun'+i); add(d.s,'dun'+i); });
  for(const nm of need) if(!MOB_ARCH[nm])
    _iWarn('species "'+nm+'" has no MOB_ARCH row — it falls back to the generic beast/caster art');
  // the stated invariant: no species in two dungeons
  for(const nm in where){
    const duns=where[nm].filter(t=>t.indexOf('dun')===0);
    const uniq=[...new Set(duns)];
    if(uniq.length>1) _iErr('species "'+nm+'" appears in '+uniq.join(' and ')+' — no species may be in two dungeons');
  }
}

// A duplicate key in an object literal is legal JavaScript and silently keeps the LAST one. That is
// how 37 creatures ended up wearing the wrong silhouette. The literal is gone by the time this
// runs, so this re-reads the source and counts.
function _checkDuplicateKeys(){
  if(typeof fetch!=='function') return Promise.resolve();
  return fetch('03_entities.js').then(r=>r.text()).then(src=>{
    const i=src.indexOf('const MOB_ARCH={'); if(i<0) return;
    const j=src.indexOf('\n};', i); if(j<0) return;
    const seen={}, dupes=[];
    const re=/'([^']+)'\s*:\s*'([^']+)'/g; let m;
    const block=src.slice(i,j);
    while((m=re.exec(block))){ const k=m[1], v=m[2];
      if(seen[k]!==undefined){ if(seen[k]!==v) dupes.push(k+' ('+seen[k]+' vs '+v+')'); }
      seen[k]=v; }
    if(dupes.length) _iErr('MOB_ARCH declares '+dupes.length+' key(s) twice with CONFLICTING values — '+
      'the last one silently wins: '+dupes.slice(0,6).join(', ')+(dupes.length>6?' …':''));
  }).catch(()=>{});
}

// THE TIER LADDER AND THE FORGE (18_forge.js). The ladder now has two rungs above the ordinary
// one and three constants that have to agree about where they are; getting any of them wrong is
// silent, because every consumer defaults rather than throwing.
function _checkTierLadder(){
  if(typeof TIER_NAMES==='undefined'||typeof MAXT==='undefined') return;
  if(typeof SD_T==='undefined'||typeof RELIC_T==='undefined'){ _iWarn('SD_T/RELIC_T not defined'); return; }
  // the indices must name the tiers they claim to
  if(TIER_NAMES[SD_T]!=='Scavenged Dreams')
    _iErr('SD_T points at "'+TIER_NAMES[SD_T]+'", not Scavenged Dreams');
  if(TIER_NAMES[RELIC_T]!=='Riftforged')
    _iErr('RELIC_T points at "'+TIER_NAMES[RELIC_T]+'", not Riftforged');
  // THE ORDER IS T12 -> RELIC -> SD (user, 2026-07-29). SD is the crafted pinnacle and the relic is
  // the drop that feeds it, so SD sits directly ABOVE the relic -- the reverse of the previous shape.
  if(SD_T!==RELIC_T+1) _iErr('SD_T ('+SD_T+') must sit directly above RELIC_T ('+RELIC_T+')');
  if(TIER_NAMES.length!==SD_T+1)
    _iErr('TIER_NAMES has '+TIER_NAMES.length+' entries; SD_T is '+SD_T+' — the ladder has a gap or a tail');
  // MAXT is the clamp on every random draw, and NEITHER top rung is rollable now: a relic is built by
  // mkRelicItem at its own per-dungeon rate and SD only by the forge. So MAXT-1 must land on the top
  // of the ORDINARY ladder -- one higher and a weighted row's overflow tail starts paying relics.
  if(MAXT-1!==RELIC_T-1) _iErr('MAXT-1 is '+(MAXT-1)+' but the ordinary ladder tops out at '+(RELIC_T-1)+
    ' — a random draw can '+(MAXT-1>=RELIC_T?'reach a CRAFTED rung':'never reach the top found tier'));
  // and the art divisor must still be independent of both
  if(typeof ART_TIERS!=='undefined' && ART_TIERS!==RELIC_T)
    _iErr('ART_TIERS ('+ART_TIERS+') should equal the number of tiers the sprites were drawn for ('+RELIC_T+')');
  // the art divisor must NOT follow the ladder, or every tier re-maps onto the wrong sprite
  if(typeof ART_TIERS!=='undefined'){
    if(ART_TIERS!==12) _iErr('ART_TIERS is '+ART_TIERS+', not 12 — every item sprite has re-mapped');
    if(typeof _nTiers==='function' && _nTiers()!==ART_TIERS)
      _iErr('_nTiers() returns '+_nTiers()+' but ART_TIERS is '+ART_TIERS);
  }
  // SD is the tag, not a number, and one function owns that spelling
  if(typeof tierTag==='function'){
    if(tierTag(SD_T)!=='SD') _iErr('tierTag(SD_T) is "'+tierTag(SD_T)+'", not "SD"');
    if(tierTag(0)!=='T1') _iErr('tierTag(0) is "'+tierTag(0)+'", not "T1"');
  }
  // NOTHING BUT AN EXPLICIT TABLE ENTRY MAY REACH SD, and nothing at all may reach a relic.
  if(typeof ZONE_TIERS!=='undefined'){
    let sdZones=0;
    ZONE_TIERS.forEach((z,i)=>{
      const rows=(z.pub||[]).concat(z.sb||[]);
      for(const r of rows){
        if(r[0]>=RELIC_T) _iErr('ZONE_TIERS['+i+'] names tier '+r[0]+' — that is the relic band');
        if(r[0]===SD_T) sdZones++;
      }
      if((z.pub||[]).some(r=>r[0]>=SD_T))
        _iErr('ZONE_TIERS['+i+'] pays Scavenged Dreams in a PUBLIC sack — SD must be soulbound');
    });
    // NO ROW MAY NAME SD AT ALL NOW. This warned when NO row named SD_T, back when SD was a dropped
    // tier and a table that granted it nowhere meant the rim had lost its reason to exist. Since the
    // 2026-07-29 swap SD is CRAFTED ONLY, so the warning had inverted: it was firing on the correct
    // state and telling the reader to go and add the very entry that would leak the top rung.
    if(sdZones) _iErr(sdZones+' ZONE_TIERS row(s) name SD_T — Scavenged Dreams is crafted only and no drop table may pay it');
  }
  // the two shelves that draw their own tiers must both stop below SD
  if(typeof AUC_TMAX!=='undefined' && AUC_TMAX>=SD_T)
    _iErr('AUC_TMAX is '+AUC_TMAX+' — the auction can stock Scavenged Dreams');
  if(typeof CHEST_TMAX!=='undefined' && CHEST_TMAX>=SD_T)
    _iErr('CHEST_TMAX is '+CHEST_TMAX+' — the event chest can pay Scavenged Dreams');
  // mkItem is the clamp everything else trusts: prove it cannot hand back a relic
  if(typeof mkItem==='function'){
    let worst=-1;
    for(let i=0;i<200;i++){ const it=mkItem('ring',RELIC_T+4,0,null); if(it&&it.t>worst) worst=it.t; }
    if(worst>SD_T) _iErr('mkItem clamped to t='+worst+', above SD_T — a roll can produce a relic');
  }
  // the loot band that carries relics must point at them and nothing else
  if(typeof LOOT_BANDS!=='undefined'){
    const top=LOOT_BANDS[LOOT_BANDS.length-1];
    if(top && top.min!==RELIC_T)
      _iErr('the top LOOT_BANDS row is min:'+top.min+' but RELIC_T is '+RELIC_T+
        ' — '+(top.min<RELIC_T?'Scavenged Dreams claims the reliquary sprite':'relics have no band'));
    // bd is 2 bits on the wire (14b_netsync): a fifth row silently aliases to band 0
    if(LOOT_BANDS.length>4) _iErr('LOOT_BANDS has '+LOOT_BANDS.length+
      ' rows; the co-op band field is 2 bits and holds 4');
  }
}

// The forge's own tables: a recipe naming a material that does not exist, or a material nothing can
// ever reach, both degrade silently -- the panel just renders a row that never lights up.
function _checkForge(){
  if(typeof MATERIALS==='undefined'||typeof MAT_RECIPES==='undefined') return;
  const reachable={};
  for(const k in MATERIALS){ const m=MATERIALS[k];
    if(m.id!==k) _iErr('MATERIALS["'+k+'"] carries id "'+m.id+'"');
    if(m.src!=='craft') reachable[k]=1; }
  // walk the recipe graph to closure: anything still unreachable cannot be obtained at all
  for(let pass=0; pass<MAT_KEYS.length+1; pass++){
    for(const key in MAT_RECIPES){ const r=MAT_RECIPES[key];
      if(reachable[r.a]&&reachable[r.b]) reachable[r.out]=1; } }
  for(const key in MAT_RECIPES){ const r=MAT_RECIPES[key];
    for(const side of ['a','b','out'])
      if(!MATERIALS[r[side]]) _iErr('recipe '+key+' names unknown material "'+r[side]+'"');
    if(r.out===r.a||r.out===r.b) _iErr('recipe '+key+' produces one of its own inputs'); }
  for(const k in MATERIALS) if(!reachable[k])
    _iErr('material "'+k+'" ('+MATERIALS[k].n+') can never be obtained — no drop source and no reachable recipe');
  // every drop pool must have something in it, or that whole area silently pays nothing
  if(typeof matPool==='function') for(const src of ['starter','main','rift']){
    if(!matPool(src).length) _iErr('no material carries src "'+src+'" — that pool drops nothing'); }
  // every relic set needs a piece in all four slots or the forge offers a set it cannot deliver
  if(typeof RELIC_SETS!=='undefined' && typeof forgeRelicPieceFor==='function'){
    for(const S of RELIC_SETS) for(const sl of ['wpn','arm','helm','ring'])
      if(!forgeRelicPieceFor(S.id,sl))
        _iErr('relic set "'+S.id+'" has no '+sl+' — the forge lists it and then refuses'); }

  // ---- THE BOSS <-> MATERIAL LINK ----
  // Every ascended boss must pay exactly one signature material, and every relic-hosting dungeon
  // must have a seed that reaches its own sets and nothing else. Any hole here is silent: the boss
  // simply drops nothing, or a seed exists that can never be spent.
  if(typeof GBOSS!=='undefined' && typeof matForRing==='function'){
    const seen={};
    for(const k in MATERIALS){ const m=MATERIALS[k];
      if(m.src!=='rift') continue;
      if(m.ring===undefined){ _iErr('rift material "'+k+'" carries no ring — no boss can drop it'); continue; }
      if(seen[m.ring]!==undefined)
        _iErr('bosses ring '+m.ring+' has two signature materials: '+seen[m.ring]+' and '+k);
      seen[m.ring]=k;
      const gb=GBOSS[m.ring];
      if(!gb) _iErr('rift material "'+k+'" names ring '+m.ring+', which is not a boss');
      else if(gb.gate==='none')
        _iErr('rift material "'+k+'" belongs to '+gb.n+', a STARTER boss — it would drop unascended');
    }
    // and the reverse: every ascended boss must have one
    for(let ring=0; ring<GBOSS.length; ring++){
      const gb=GBOSS[ring]; if(!gb || gb.gate==='none') continue;
      if(!matForRing(ring)) _iErr('ascended boss '+ring+' ('+gb.n+') drops no crafting material');
    }
  }

  // ---- THE TWELVE SCAVENGED DREAMS REAGENTS ----
  // A hole here is silent in the worst way: a piece of gear whose reagent does not exist simply can
  // never be raised, and the player has no way to tell that from "I have not found it yet".
  if(typeof SD_MAT_KEY!=='undefined' && typeof sdMatFor==='function'){
    const pool=(typeof matPool==='function')?matPool('sd'):[];
    // every id the mapping names must be a real material in the 'sd' pool
    const walk=(v,where)=>{
      if(typeof v==='string'){
        if(!MATERIALS[v]) _iErr('SD_MAT_KEY '+where+' names "'+v+'", which is not a material');
        else if(MATERIALS[v].src!=='sd')
          _iErr('SD reagent "'+v+'" ('+where+') is src:'+MATERIALS[v].src+', so no ascended boss drops it');
        return; }
      for(const k in v) walk(v[k], where+'.'+k);
    };
    walk(SD_MAT_KEY,'');
    // and the reverse: every reagent in the pool must be reachable by some real piece of gear, or it
    // is a drop that can never be spent
    const named={};
    const collect=(v)=>{ if(typeof v==='string'){ named[v]=1; return; } for(const k in v) collect(v[k]); };
    collect(SD_MAT_KEY);
    for(const id of pool) if(!named[id])
      _iErr('SD reagent "'+id+'" is dropped but nothing is made out of it');
    // EVERY WEAPON TYPE THE GAME CAN ACTUALLY DROP needs one, or that class's relic is a dead end.
    // Checked against WTYPE rather than a list here, so a new weapon type fails loudly instead of
    // quietly becoming un-raisable.
    if(typeof WTYPE!=='undefined') for(const wt in WTYPE){
      if(WTYPE[wt].legacy) continue;
      if(!sdMatFor({k:'wpn',wt:wt}))
        _iErr('weapon type "'+wt+'" has no SD reagent — a relic of that type could never be raised');
    }
    for(const mt of ['plate','leather','robe'])
      if(!sdMatFor({k:'arm',mt:mt}))
        _iErr('armour material "'+mt+'" has no SD reagent');
    for(const k of ['helm','ring'])
      if(!sdMatFor({k:k})) _iErr('slot "'+k+'" has no SD reagent');
  }
  if(typeof RELIC_SETS!=='undefined' && typeof isSeed==='function' && typeof forgeSetsFor==='function'){
    const relicRings=[]; for(const S of RELIC_SETS) if(relicRings.indexOf(S.ring)<0) relicRings.push(S.ring);
    for(const ring of relicRings){
      const sid=(typeof seedIdFor==='function')?seedIdFor(ring):null;
      if(!sid||!MATERIALS[sid]){ _iErr('relic dungeon ring '+ring+' has no Riftseed'); continue; }
      // the seed must be craftable, and from that dungeon's OWN material
      let made=false;
      for(const key in MAT_RECIPES){ const r=MAT_RECIPES[key];
        if(r.out!==sid) continue;
        made=true;
        const sig=matForRing(ring);
        if(!sig || (r.a!==sig.id && r.b!==sig.id))
          _iErr('the seed for ring '+ring+' is not made from that dungeon\'s own material');
      }
      if(!made) _iErr('Riftseed "'+sid+'" has no recipe — it can never be obtained');
      // and it must reach exactly that dungeon's sets
      const sets=forgeSetsFor('helm', ring);
      const want=RELIC_SETS.filter(S=>S.ring===ring).length;
      if(sets.length!==want)
        _iErr('the seed for ring '+ring+' reaches '+sets.length+' sets, that dungeon hosts '+want);
      for(const s of sets) if(s.set.ring!==ring)
        _iErr('the seed for ring '+ring+' can forge set "'+s.set.id+'" from ring '+s.set.ring);
    }
    // no seed may exist for a dungeon that hosts no sets
    for(const k in MATERIALS){ const m=MATERIALS[k]; if(!m.seed) continue;
      if(relicRings.indexOf(m.ring)<0)
        _iErr('seed "'+k+'" belongs to ring '+m.ring+', which hosts no relic sets'); }
  }
}

// NOTHING MAY SIT ABOVE THE LEVEL CAP. 50 is a hard ceiling -- levelUp stops there and there is no
// prestige level -- so any content that computes its own level has to land on or under it, or it is
// content the player is structurally forbidden from matching. Six ascended dungeons were at Lv53-55
// for exactly this reason: their clamp was LV_CAP+10, which never bound anything.
function _checkLevelCap(){
  if(typeof LV_CAP==='undefined') return;
  if(typeof ASCEND_LV!=='undefined' && ASCEND_LV>LV_CAP)
    _iErr('ASCEND_LV ('+ASCEND_LV+') is above LV_CAP ('+LV_CAP+') — ascension is unreachable');
  if(typeof MOUNT_LV!=='undefined' && MOUNT_LV>LV_CAP)
    _iErr('MOUNT_LV ('+MOUNT_LV+') is above LV_CAP — the Stable can never open');
  if(typeof MOUNT_FLY_LV!=='undefined' && MOUNT_FLY_LV>LV_CAP)
    _iWarn('MOUNT_FLY_LV ('+MOUNT_FLY_LV+') is above LV_CAP — flight would be unreachable if built');
  // every dungeon computes its own level off its boss's clump; none may exceed the cap
  if(typeof GBOSS!=='undefined' && typeof genDungeon==='function' && typeof rooms!=='undefined' && rooms['G']){
    for(let ring=0; ring<GBOSS.length; ring++){
      let d=null; try{ d=genDungeon(ring); }catch(e){ continue; }
      if(!d||d.lv===undefined) continue;
      if(d.lv>LV_CAP) _iErr('dungeon '+ring+' ('+(GBOSS[ring].dn||GBOSS[ring].n)+') is Lv'+d.lv+
        ', above the Lv'+LV_CAP+' cap — it can only ever be fought underlevelled');
      // a starter dungeon must stay on the island it belongs to
      if(typeof isStarterBoss==='function' && isStarterBoss(ring) && typeof ISLAND_LV!=='undefined'
         && d.lv>ISLAND_LV)
        _iErr('starter dungeon '+ring+' ('+(GBOSS[ring].dn||GBOSS[ring].n)+') is Lv'+d.lv+
          ', above the island ceiling of Lv'+ISLAND_LV);
    }
  }
  // the overworld zones must not promise levels the cap forbids
  if(typeof rooms!=='undefined' && rooms['G'] && typeof _territories==='function'){
    let T=null; try{ T=_territories(rooms['G']); }catch(e){}
    if(T) for(const t of T) if(t.lvmax>LV_CAP)
      _iErr('territory "'+t.name+'" reaches Lv'+t.lvmax+', above the cap');
  }
  // the island's ceiling has to be the sum of its own provinces, not a number typed twice
  if(typeof ISLAND_LV!=='undefined' && typeof STARTER_ZONES!=='undefined'
     && typeof STARTER_LV_PER_ZONE!=='undefined'){
    if(ISLAND_LV!==STARTER_ZONES*STARTER_LV_PER_ZONE)
      _iErr('ISLAND_LV is '+ISLAND_LV+' but the island has '+STARTER_ZONES+' provinces of '+
        STARTER_LV_PER_ZONE);
    if(ISLAND_LV>=LV_CAP) _iErr('ISLAND_LV ('+ISLAND_LV+') leaves no mainland below the cap');
  }
}

function runIntegrityCheck(){
  INTEGRITY.errors.length=0; INTEGRITY.warns.length=0;
  try{ _checkBossTables(); }catch(e){ _iWarn('boss-table check threw: '+e.message); }
  try{ _checkBandTables(); }catch(e){ _iWarn('band-table check threw: '+e.message); }
  try{ _checkSpecies(); }catch(e){ _iWarn('species check threw: '+e.message); }
  try{ _checkTierLadder(); }catch(e){ _iWarn('tier-ladder check threw: '+e.message); }
  try{ _checkForge(); }catch(e){ _iWarn('forge check threw: '+e.message); }
  try{ _checkLevelCap(); }catch(e){ _iWarn('level-cap check threw: '+e.message); }
  INTEGRITY.ran=true;
  const report=()=>{
    if(INTEGRITY.errors.length){
      console.error('[integrity] '+INTEGRITY.errors.length+' ERROR(S):');
      for(const m of INTEGRITY.errors) console.error('  ✖ '+m);
    }
    if(INTEGRITY.warns.length){
      console.warn('[integrity] '+INTEGRITY.warns.length+' warning(s):');
      for(const m of INTEGRITY.warns) console.warn('  • '+m);
    }
    if(!INTEGRITY.errors.length && !INTEGRITY.warns.length)
      console.log('[integrity] all tables agree');
  };
  // the duplicate-key scan needs the source text, so it lands a moment later
  _checkDuplicateKeys().then(report);
  return INTEGRITY;
}

// Run once the world exists — _territories needs rooms['G'], which worldbuild builds at load.
if(typeof window!=='undefined') setTimeout(function(){ try{ runIntegrityCheck(); }catch(e){} }, 0);
