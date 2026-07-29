// FORGE ECONOMY AUDIT. The one part of the crafting system that was never a measurement.
//
// WHY THIS EXISTS. KICKOFF.txt has said since v547 that the material drop rates are "a first guess,
// chosen against pet food's 5.5%/60% as the nearest comparison" and that "nobody has farmed the tree
// end to end and timed how long a Riftseed actually takes". This farms it, ten thousand times, by
// calling the SHIPPED functions rather than re-deriving the arithmetic from the constants -- the
// difference matters, because the constants are not the rate: matDropFor doubles for an elite,
// scales with Fortune, and then draws UNIFORMLY from a three-material pool, and that last step is
// what actually decides the wait.
//
// Read-only. It measures, it does not change anything, and it puts back every global it touched.
// Same harness as tools/selftest.py -- injected last into the real index.html, read back with
// --dump-dom. Run it with `py tools/audit.py _forgeaudit.js`.
(function(){
  const L=[];
  const say=(s)=>L.push(s===undefined?'':s);
  const row=(k,v)=>L.push('  '+String(k).padEnd(44,' ')+' '+v);
  const hd=(s)=>{ L.push(''); L.push('--- '+s+' ---'); };
  function dump(){
    const el=document.getElementById('testout');
    if(el) el.textContent=L.join('\n');
    document.title='AUDIT DONE';
  }

  // ---- small helpers -------------------------------------------------------------------------
  const pct=(x)=>(100*x).toFixed(2)+'%';
  const f1=(x)=>x.toFixed(1);
  function median(a){ const b=a.slice().sort((x,y)=>x-y); const h=b.length>>1;
    return b.length%2 ? b[h] : (b[h-1]+b[h])/2; }
  function pctile(a,p){ const b=a.slice().sort((x,y)=>x-y);
    return b[Math.min(b.length-1,Math.max(0,Math.floor(p*b.length)))]; }
  function mean(a){ let s=0; for(const x of a) s+=x; return s/a.length; }

  function run(){
    if(typeof MATERIALS==='undefined'){ say('18_forge.js is not loaded — nothing to audit.'); return; }

    // Every global this touches, taken back at the end. curRoom is a top-level `let`, so it is a
    // LEXICAL global: it is assigned bare here on purpose. `window.curRoom = x` would silently
    // create an unrelated property and every ring would read null.
    const save={room:curRoom, fort:(typeof player!=='undefined')?player.fortune:undefined};
    if(typeof player!=='undefined') player.fortune=0;   // baseline; the Fortune term is reported apart

    say('===== FORGE ECONOMY AUDIT =====');
    say('Everything below is measured by calling the shipped functions, not by re-deriving the');
    say('constants. Fortune is pinned to 0 for the baseline and reported separately.');

    // =============================================================================================
    hd('WHAT THE TREE COSTS, walked back to things that actually drop');
    // =============================================================================================
    // matRecipesFor(id) is the shipped lookup. A material with no recipe producing it is a LEAF --
    // i.e. something a kill pays -- which is why this walk cannot drift from the recipe table.
    function leafCost(id){
      const need={};
      (function walk(x,n){
        const made=(typeof matRecipesFor==='function')?matRecipesFor(x):[];
        if(!made.length){ need[x]=(need[x]||0)+n; return; }
        const r=made[0], batches=Math.ceil(n/(r.n||1));
        walk(r.a,batches); walk(r.b,batches);
      })(id,1);
      return need;
    }
    const seedIds=MAT_KEYS.filter(k=>MATERIALS[k].seed);
    row('relic-hosting dungeons with a seed', seedIds.length);
    let sample=null;
    for(const sid of seedIds){
      const need=leafCost(sid);
      const by={starter:[],main:[],rift:[]};
      let tot=0;
      for(const id in need){ const d=MATERIALS[id]; tot+=need[id];
        (by[d.src]||by.rift).push(d.n+'×'+need[id]); }
      say('  '+MATERIALS[sid].n);
      say('      starter  '+(by.starter.join(', ')||'—'));
      say('      main     '+(by.main.join(', ')||'—'));
      say('      rift     '+(by.rift.join(', ')||'—'));
      say('      '+tot+' raw drops in total');
      if(!sample) sample={id:sid,need:need};
    }
    say('  Every seed costs the same nine island/mainland drops; only the rift half differs, and');
    say('  only in WHICH dungeon pays the last one.');

    // =============================================================================================
    hd('MEASURED DROP RATES — matDropFor(), 400,000 kills per row');
    // =============================================================================================
    const T=400000;
    // Real coordinates from the real overworld, so onMainIsland() decides the pool rather than a
    // stub. The bridge is the island boundary the function actually reads.
    const G=(typeof rooms!=='undefined')?rooms['G']:null;
    const RG=G&&G.rings;
    let starterXY=null, mainXY=null;
    if(RG&&RG.bridge&&typeof TILE!=='undefined'){
      starterXY={x:(RG.bridge.x1-20)*TILE, y:(RG.bridge.y1||RG.bridge.y0||100)*TILE};
      mainXY   ={x:(RG.bridge.x1+20)*TILE, y:(RG.bridge.y1||RG.bridge.y0||100)*TILE};
    }
    row('overworld room found', G?'yes':'NO — pool rows below are unmeasurable');
    if(RG) row('onMainIsland split at bridge.x1 (tiles)', RG.bridge?RG.bridge.x1:'?');

    function sample1(type,elite,xy){
      const e={type:type,x:xy.x,y:xy.y}; if(elite) e.elite=1;
      return matDropFor(e);
    }
    function measure(label,type,elite,xy){
      let hits=0, units=0;
      const byId={};
      for(let i=0;i<T;i++){
        const d=sample1(type,elite,xy);
        if(!d) continue;
        hits++; units+=d.n; byId[d.m]=(byId[d.m]||0)+d.n;
      }
      row(label, pct(hits/T)+' of kills, '+(units/T).toFixed(4)+' materials/kill');
      return {p:hits/T, perKill:units/T, byId:byId};
    }
    const M={};
    if(starterXY){
      curRoom=G;
      say('  STARTER ISLAND (Lv1–'+((typeof ISLAND_LV!=='undefined')?ISLAND_LV:20)+')');
      M.sc = measure('    chaser  (type c)', 'c', false, starterXY);
      M.ss = measure('    shooter (type s)', 's', false, starterXY);
      M.sN = measure('    ambush  (type N)', 'N', false, starterXY);
      M.se = measure('    elite chaser',     'c', true,  starterXY);
      M.sB = measure('    BOSS',             'B', false, starterXY);
      say('  MAIN ISLAND (Lv20–'+((typeof LV_CAP!=='undefined')?LV_CAP:50)+')');
      M.mc = measure('    chaser  (type c)', 'c', false, mainXY);
      M.me = measure('    elite chaser',     'c', true,  mainXY);
      M.mB = measure('    BOSS',             'B', false, mainXY);
      // the pool draw is the part the constants do not tell you
      const ids=Object.keys(M.sc.byId);
      row('  starter pool size (uniform draw)', ids.length+'  → '+pct(M.sc.p/Math.max(1,ids.length))+' per SPECIFIC material');
      const bstack=M.sB.perKill/Math.max(1e-9,M.sB.p);
      row('  boss stack size (measured mean)', bstack.toFixed(2)+' per drop');
    }

    // rift: one boss, one reagent, and only its own
    say('  ASCENDED DUNGEON BOSSES (the rift pool)');
    const ascended=[];
    if(typeof GBOSS!=='undefined') for(let r=0;r<GBOSS.length;r++) if(GBOSS[r]&&GBOSS[r].gate!=='none') ascended.push(r);
    row('    ascended rings', ascended.length+'  ['+ascended.join(',')+']');
    let riftP=0, riftWrong=0;
    if(ascended.length){
      const r=ascended[0];
      curRoom={dungeon:true, ring:r};
      let hits=0; const seen={};
      for(let i=0;i<T;i++){ const d=matDropFor({type:'B',x:0,y:0}); if(!d) continue; hits++;
        seen[d.m]=(seen[d.m]||0)+d.n; if(d.n!==1) riftWrong++; }
      riftP=hits/T;
      row('    BOSS pays its own reagent', pct(riftP)+' of clears');
      row('    distinct materials paid', Object.keys(seen).length+'  ('+Object.keys(seen).join(',')+')');
      row('    stacks larger than 1', riftWrong===0?'none — a reagent never stacks':riftWrong+' — RULE BROKEN');
    }

    // =============================================================================================
    hd('THE CHASE, SIMULATED — 20,000 runs to ONE Riftseed');
    // =============================================================================================
    const RUNS=20000;
    // NOT named ELITE_P: a local const of that name shadows the global one for the whole function
    // and then throws on its own initialiser, which is the TDZ trap this project's notes already
    // carry for `const` at top level. Same rule, one scope down.
    const eliteRate=(typeof ELITE_P!=='undefined')?ELITE_P:0.075;
    // A farming run is simulated as kills against the real matDropFor, not against a rate: the
    // uniform pool draw means you cannot aim at the material you are short of, and that waste is
    // most of the answer.
    function farm(needMap,xy,room,eliteRate){
      curRoom=room;
      const have={};
      let kills=0;
      const want=Object.keys(needMap);
      for(;;){
        const isElite=Math.random()<eliteRate;
        const e={type:Math.random()<0.5?'c':'s',x:xy.x,y:xy.y}; if(isElite) e.elite=1;
        const d=matDropFor(e);
        kills++;
        if(d) have[d.m]=(have[d.m]||0)+d.n;
        let done=true;
        for(const k of want) if((have[k]||0)<needMap[k]){ done=false; break; }
        if(done) return kills;
        if(kills>200000) return kills;   // runaway guard; never hit in practice
      }
    }
    const need=sample?sample.need:{};
    const needStarter={}, needMain={}, needRift={};
    for(const id in need){ const s=MATERIALS[id].src;
      (s==='starter'?needStarter:s==='main'?needMain:needRift)[id]=need[id]; }

    if(starterXY){
      const A=[],B=[];
      for(let i=0;i<RUNS;i++) A.push(farm(needStarter,starterXY,G,0));
      for(let i=0;i<RUNS;i++) B.push(farm(needStarter,starterXY,G,eliteRate));
      row('starter leg, trash only (median kills)', median(A)+'   mean '+f1(mean(A))+'   p90 '+pctile(A,0.90));
      row('starter leg, with '+pct(eliteRate)+' elites', median(B)+'   mean '+f1(mean(B))+'   p90 '+pctile(B,0.90));
      const C=[],D=[];
      for(let i=0;i<RUNS;i++) C.push(farm(needMain,mainXY,G,0));
      for(let i=0;i<RUNS;i++) D.push(farm(needMain,mainXY,G,eliteRate));
      row('mainland leg, trash only (median kills)', median(C)+'   mean '+f1(mean(C))+'   p90 '+pctile(C,0.90));
      row('mainland leg, with '+pct(eliteRate)+' elites', median(D)+'   mean '+f1(mean(D))+'   p90 '+pctile(D,0.90));
      say('  A boss is worth far more than a trash kill on these legs — see the rates above — so');
      say('  these are the PURE-TRASH ceiling, the slowest honest way to walk the island.');
    }

    // rift leg: one boss per clear, per dungeon, measured through the same function.
    // Kept at function scope so the SD section below can put the two halves of a relic against
    // each other in the same unit -- which is the whole question this audit was run to answer.
    var totalClearsRef=null;
    if(ascended.length && Object.keys(needRift).length){
      let totalClears=[];
      totalClearsRef=totalClears;
      for(let i=0;i<RUNS;i++){
        let clears=0;
        for(const id in needRift){
          const r=MATERIALS[id].ring;
          curRoom={dungeon:true, ring:r};
          let got=0;
          while(got<needRift[id]){ const d=matDropFor({type:'B',x:0,y:0}); clears++; if(d) got+=d.n; }
        }
        totalClears.push(clears);
      }
      row('rift leg (median dungeon CLEARS)', median(totalClears)+'   mean '+f1(mean(totalClears))+'   p90 '+pctile(totalClears,0.90));
      row('  distinct dungeons that must be cleared', Object.keys(needRift).length+'  (rings '+Object.keys(needRift).map(k=>MATERIALS[k].ring).join(',')+')');
      say('  Each is a full ascended dungeon, so a clear is not a kill — it is a run.');
    }

    // =============================================================================================
    hd('THE OTHER HALF OF A RELIC — Scavenged Dreams gear');
    // =============================================================================================
    // The anvil takes an SD piece PLUS a seed, and the relic you get takes the SLOT of that piece.
    // So the seed is only half the wait, and this half has never been measured either.
    if(typeof rollSoulboundItems==='function' && typeof ZONE_TIERS!=='undefined'){
      const who={fort:0, cls:(typeof curChar==='function'&&curChar())?curChar().cls:'knight'};
      function sdRate(label,row_,type,n){
        let kills=0, sd=0, slots={};
        for(let i=0;i<n;i++){
          curRoom=G;
          const items=rollSoulboundItems({type:type,x:0,y:0},row_,who);
          kills++;
          for(const it of items) if(it.t===SD_T){ sd++; slots[it.k]=(slots[it.k]||0)+1; }
        }
        row(label, (sd/kills===0?'0':pct(sd/kills))+' of kills'+(sd? '   → 1 in '+Math.round(kills/sd):''));
        return {p:sd/kills, slots:slots};
      }
      const rim=ZONE_TIERS[ZONE_TIERS.length-1];
      row('rim row sb weights', JSON.stringify(rim.sb)+'  sbP='+rim.sbP);
      const rimTrash=sdRate('  rim trash kill pays an SD piece', rim, 'c', 400000);
      const rimShoot=sdRate('  rim shooter (sbP×3)',              rim, 's', 400000);
      // A rim BOSS rolls one guaranteed bound drop (p=1, n=1 outside a dungeon), so it reads the
      // SD weight of 8 almost directly. This is the open world's real SD source; the trash rows
      // above are the ones people will actually spend their kills on, which is the comparison.
      const rimBoss =sdRate('  rim BOSS (one guaranteed bound roll)', rim, 'B', 200000);
      // an ascended dungeon boss: p=1, two rolls, and the row is augmented with SD_DUN_W
      if(ascended.length){
        const r=ascended[ascended.length-1];
        curRoom={dungeon:true, ring:r, rings:null};
        let clears=0, sd=0, slots={};
        for(let i=0;i<200000;i++){
          const row_=zoneTierRow(0,0);
          const items=rollSoulboundItems({type:'B',x:0,y:0},row_,who);
          clears++;
          for(const it of items) if(it.t===SD_T){ sd++; slots[it.k]=(slots[it.k]||0)+1; }
        }
        row('  ascended dungeon BOSS pays SD', pct(sd/clears)+' of clears   ('+(sd/clears).toFixed(3)+' pieces/clear)');
        const ks=Object.keys(slots);
        row('  slots an SD piece can land in', ks.length+'  ['+ks.join(',')+']');
        if(sd&&ks.length){
          const perSlot=(sd/clears)/ks.length;
          row('  clears for ANY SD piece (mean)', f1(clears/sd));
          row('  clears for a SPECIFIC slot (mean)', f1(1/perSlot));
          say('  That is the number that matters: the relic you forge takes the SLOT of the SD piece');
          say('  you feed the anvil, so wanting a relic HELM means waiting for an SD helm.');
          say('');
          say('  SO WHICH HALF IS THE WAIT? Put the two against each other, in the same unit:');
          row('    clears for the SEED half', median(totalClearsRef||[0])+' (median)');
          row('    clears for the SD half, any slot', f1(clears/sd));
          row('    clears for the SD half, chosen slot', f1(1/perSlot));
        }
      }
      if(rimTrash.p>0) row('  rim trash kills for one SD piece', Math.round(1/rimTrash.p));
      if(rimShoot.p>0) row('  rim shooter kills for one SD piece', Math.round(1/rimShoot.p));
    } else {
      say('  rollSoulboundItems not reachable — SD half not measured.');
    }

    // =============================================================================================
    hd('THE FORTUNE TERM');
    // =============================================================================================
    if(starterXY && typeof player!=='undefined'){
      curRoom=G;
      const base=M.sc?M.sc.p:0;
      for(const F of [0,25,50,100]){
        player.fortune=F;
        let hits=0;
        for(let i=0;i<200000;i++) if(matDropFor({type:'c',x:starterXY.x,y:starterXY.y})) hits++;
        row('Fortune '+F, pct(hits/200000)+(base?'   ×'+((hits/200000)/base).toFixed(2)+' of baseline':''));
      }
      player.fortune=0;
    }

    // =============================================================================================
    hd('WHAT THIS DOES NOT MEASURE');
    // =============================================================================================
    say('  Wall-clock. Everything above is in KILLS and CLEARS, which is the unit that is actually');
    say('  a property of the drop tables; seconds are a property of the hero swinging, and this');
    say('  harness has no honest number for how long a Lv50 clears an ascended dungeon. The dev');
    say('  BALANCE sweep drives fights at a FIXED TTK=60s input, so it cannot be read as one.');

    // put everything back
    curRoom=save.room;
    if(typeof player!=='undefined'&&save.fort!==undefined) player.fortune=save.fort;
    say('');
    say('globals restored: curRoom, player.fortune');
  }

  function boot(){
    try{ run(); }
    catch(e){ say(''); say('AUDIT THREW: '+(e&&e.message)); say((e&&e.stack)||''); }
    dump();
  }
  if(document.readyState==='complete') setTimeout(boot,600);
  else window.addEventListener('load',()=>setTimeout(boot,600));
})();
