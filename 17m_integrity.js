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

function runIntegrityCheck(){
  INTEGRITY.errors.length=0; INTEGRITY.warns.length=0;
  try{ _checkBossTables(); }catch(e){ _iWarn('boss-table check threw: '+e.message); }
  try{ _checkBandTables(); }catch(e){ _iWarn('band-table check threw: '+e.message); }
  try{ _checkSpecies(); }catch(e){ _iWarn('species check threw: '+e.message); }
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
