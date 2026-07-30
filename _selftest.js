// Headless verification for the forge / Scavenged Dreams work. Loaded LAST (defer) against the
// real index.html, so it sees the game exactly as it boots. Writes its results into #testout,
// which is what `chrome --headless --dump-dom` hands back.
//
// This is not a substitute for driving the game by hand -- it is the parse check and the table
// check the project already requires, plus the assertions specific to this change.
(function(){
  const L=[]; let pass=0, fail=0;
  const ok =(n,v,d)=>{ if(v){pass++; L.push('  PASS  '+n+(d?('  ['+d+']'):''));} else {fail++; L.push('  FAIL  '+n+(d?('  ['+d+']'):''));} };
  const note=(s)=>L.push(s);

  function dump(){
    const el=document.getElementById('testout');
    const head='RESULT '+(fail?'FAIL':'PASS')+'  '+pass+' passed, '+fail+' failed';
    if(el) el.textContent=head+'\n'+L.join('\n');
    document.title='TEST '+(fail?'FAIL':'PASS');
  }

  async function run(){
    // ---------- 1. PARSE CHECK EVERY FILE ----------
    // Manual stepping does not need the rAF loop, so a syntax error is invisible to every other
    // test in this file. This has to come first.
    note('== parse check ==');
    const srcs=[...document.querySelectorAll('script[src]')]
      .map(s=>s.getAttribute('src')).filter(s=>s && !/^https?:/.test(s));
    for(const s of srcs){
      try{
        const t=await fetch(s).then(r=>r.ok?r.text():Promise.reject(new Error('HTTP '+r.status)));
        new Function(t);
        ok('parses: '+s, true);
      }catch(e){ ok('parses: '+s, false, e.message); }
    }

    // ---------- 2. THE INTEGRITY CHECK ----------
    note('== integrity ==');
    if(typeof runIntegrityCheck==='function'){
      const R=runIntegrityCheck();
      await new Promise(r=>setTimeout(r,400));           // the duplicate-key scan lands late
      ok('integrity: no errors', R.errors.length===0, R.errors.join(' | ')||'clean');
      note('  warnings: '+(R.warns.length?R.warns.join(' | '):'none'));
    } else ok('runIntegrityCheck exists', false);

    // ---------- 3. THE LADDER ----------
    note('== tier ladder ==');
    // THE TOP IS T12 -> RELIC -> SD (user, 2026-07-29). The pair swapped: relics are the drop, SD is
    // the crafted pinnacle, and MAXT came back down because neither is rollable.
    ok('MAXT is 12', MAXT===12, 'MAXT='+MAXT);
    ok('RELIC_T is 12', RELIC_T===12, 'RELIC_T='+RELIC_T);
    ok('SD_T is 13', SD_T===13, 'SD_T='+SD_T);
    ok('SD sits above the relic', SD_T===RELIC_T+1);
    ok('MAXT-1 lands on the top of the ORDINARY ladder', MAXT-1===11, 'MAXT-1='+(MAXT-1));
    ok('neither crafted rung is rollable', MAXT-1<RELIC_T && MAXT-1<SD_T);
    ok('TIER_NAMES[SD_T] is Scavenged Dreams', TIER_NAMES[SD_T]==='Scavenged Dreams', TIER_NAMES[SD_T]);
    ok('TIER_NAMES[RELIC_T] is Riftforged', TIER_NAMES[RELIC_T]==='Riftforged', TIER_NAMES[RELIC_T]);
    ok('ladder has no tail', TIER_NAMES.length===SD_T+1, 'len='+TIER_NAMES.length);
    ok('SD is written "SD"', tierTag(SD_T)==='SD', tierTag(SD_T));
    // 'T13' must not be a string this game can produce -- the old hard rule said SD is never written
    // T13, and giving the relic rung a tag rather than a number keeps that literally true.
    ok('the relic rung is written "RF", not "T13"', tierTag(RELIC_T)==='RF', tierTag(RELIC_T));
    ok('nothing anywhere on the ladder reads "T13"',
       TIER_NAMES.every((_,i)=>tierTag(i)!=='T13'),
       TIER_NAMES.map((_,i)=>tierTag(i)).join(','));
    ok('ordinary tiers still read T<n>', tierTag(0)==='T1' && tierTag(11)==='T12', tierTag(0)+'/'+tierTag(11));
    // THE POWER STEP, which is the whole point of the two top rungs (relic 2x T12, SD 5x relic)
    {
      const w12=gearBaseStats('wpn',11).atk, wRf=gearBaseStats('wpn',RELIC_T).atk, wSd=gearBaseStats('wpn',SD_T).atk;
      ok('a relic is 2x the top found tier', Math.abs(wRf/w12-2.0)<0.02, w12+' -> '+wRf);
      ok('SD is 5x a relic', Math.abs(wSd/wRf-5.0)<0.02, wRf+' -> '+wSd);
      ok('and 10x the top found tier', Math.abs(wSd/w12-10.0)<0.02, w12+' -> '+wSd);
      // the multiplier must land on the WHOLE block, or armour and rings become sidegrades up top
      const a12=gearBaseStats('arm',11,'plate').def, aSd=gearBaseStats('arm',SD_T,'plate').def;
      ok('the step applies to armour too', Math.abs(aSd/a12-10.0)<0.05, a12+' -> '+aSd);
    }
    // the art divisor must NOT have followed the ladder up
    ok('ART_TIERS frozen at 12', typeof ART_TIERS!=='undefined' && ART_TIERS===12, 'ART_TIERS='+ART_TIERS);
    ok('_nTiers() returns 12, not MAXT', typeof _nTiers==='function' && _nTiers()===12, '_nTiers()='+(typeof _nTiers==='function'?_nTiers():'n/a'));
    // three distinct colours at the top of the ladder or the rungs blur
    const cT12=tierCol(11), cSD=tierCol(SD_T), cREL=tierCol(RELIC_T);
    ok('T12 / SD / relic are three different colours',
       cT12!==cSD && cSD!==cREL && cT12!==cREL, cT12+' '+cSD+' '+cREL);

    // ---------- 4. NOTHING RANDOM MAY REACH SD OR A RELIC ----------
    note('== the clamp ==');
    let worst=-1;
    for(let i=0;i<4000;i++){ const it=mkItem(['wpn','arm','helm','ring'][i&3], 40, 0, 'knight');
      if(it.t>worst) worst=it.t; }
    ok('mkItem cannot reach either crafted rung even when asked for T44',
       worst<RELIC_T, 'highest t seen = '+worst);
    ok('mkItem still reaches the top of the ordinary ladder', worst===MAXT-1, 'highest t seen = '+worst);
    // mkTopItem is the sanctioned way in, and it must refuse to be a back door to anything lower
    if(typeof mkTopItem==='function'){
      ok('mkTopItem makes a relic-tier piece', (mkTopItem('wpn',RELIC_T,'knight')||{}).t===RELIC_T);
      ok('mkTopItem makes an SD piece', (mkTopItem('wpn',SD_T,'knight')||{}).t===SD_T);
      ok('mkTopItem refuses the ordinary ladder', mkTopItem('wpn',11,'knight')===null);
    }

    // the auction shelf, across a year of periods
    let aucMax=-1;
    if(typeof auctionListings==='function'){
      const realPeriod=window.auctionPeriod;
      for(let d=0; d<365; d++){
        window.auctionPeriod=()=>d;
        try{ for(const l of auctionListings()) if(l.item && l.item.t>aucMax) aucMax=l.item.t; }catch(e){}
      }
      window.auctionPeriod=realPeriod;
      ok('auction never stocks a crafted rung over 365 periods', aucMax<RELIC_T, 'highest shelf tier = '+aucMax);
    }
    // the event chest. relicP:0 turns off the relic it grants ON PURPOSE, so anything at or above
    // RELIC_T here came out of the ordinary gear rolls, which is the leak being tested for.
    let chestMax=-1;
    if(typeof rollEventChest==='function'){
      for(let i=0;i<600;i++) for(const it of rollEventChest(50,'knight',{relicP:0}))
        if(it.t>chestMax) chestMax=it.t;
      ok('event chest gear rolls never reach a crafted rung', chestMax<RELIC_T, 'highest chest tier = '+chestMax);
    }
    // pickWeighted's overflow tail adds a step ABOVE the row's ceiling, so a T12 row is exactly the
    // case that could tail into the relic band
    if(typeof pickWeighted==='function'){
      let ovf=-1;
      for(let i=0;i<20000;i++){ const t=pickWeighted([[10,45],[11,55]],200); if(t>ovf) ovf=t; }
      ok('a T11/T12 row cannot overflow into the relic band', ovf<RELIC_T, 'highest = '+ovf);
      // and a row that names 12 outright -- which no shipped row does any more -- is still clamped
      let bad=-1;
      for(let i=0;i<20000;i++){ const t=pickWeighted([[10,42],[11,50],[12,8]],200); if(t>bad) bad=t; }
      ok('even a row naming index 12 is clamped off the relic band', bad<RELIC_T, 'highest = '+bad);
    }

    // ---------- 5. NEITHER CRAFTED RUNG MAY BE NAMED BY A ZONE ROW ----------
    note('== drop tables ==');
    if(typeof ZONE_TIERS!=='undefined'){
      const named=[];
      ZONE_TIERS.forEach((z,i)=>{
        if((z.sb||[]).some(r=>r[0]>=RELIC_T)) named.push('sb'+i);
        if((z.pub||[]).some(r=>r[0]>=RELIC_T)) named.push('pub'+i);
      });
      // The five rim rows carried [12,8] for dropped SD. Index 12 is the RELIC band now, so leaving
      // them would have paid relics out of the ordinary soulbound channel on a rim trash kill.
      ok('no zone row names a crafted rung', named.length===0, named.join(',')||'none');
      ok('public rows still cap at PUB_TMAX',
         ZONE_TIERS.every(z=>(z.pub||[]).every(r=>r[0]<=PUB_TMAX)));
    }
    // the SD injector is gone, not zeroed: a weight of 0 is still a table entry naming index 12
    ok('_sdAugmentRow is retired', typeof _sdAugmentRow==='undefined');
    ok('SD_DUN_W is retired', typeof SD_DUN_W==='undefined');
    // the reliquary sack must still point at relics, which is the band that has now moved twice
    if(typeof LOOT_BANDS!=='undefined' && typeof bandOfTier==='function'){
      ok('LOOT_BANDS still has exactly four rows (2 bits on the wire)', LOOT_BANDS.length===4, 'len='+LOOT_BANDS.length);
      ok('a relic lands in the reliquary band', bandOfTier(RELIC_T)===LOOT_BANDS.length-1, 'band '+bandOfTier(RELIC_T));
      ok('a T12 does NOT', bandOfTier(11)===LOOT_BANDS.length-2, 'band '+bandOfTier(11));
    }

    // ---------- 6. THE MATERIAL TREE ----------
    note('== materials ==');
    ok('MATERIALS defined', typeof MATERIALS==='object');
    ok('every recipe takes exactly two inputs',
       Object.values(MAT_RECIPES).every(r=>r.a&&r.b&&r.out&&Object.keys(r).length===4));
    ok('the starter island pays three materials', matPool('starter').length===3, matPool('starter').join(','));
    ok('the main island pays three materials', matPool('main').length===3, matPool('main').join(','));
    ok('recipe lookup is order-independent',
       matRecipe('cinder','bogiron') === matRecipe('bogiron','cinder'));

    // ---- the ascended bosses and their signatures ----
    note('== boss -> material link ==');
    {
      const ascended=[]; for(let r=0;r<GBOSS.length;r++) if(GBOSS[r].gate!=='none') ascended.push(r);
      ok('there are nine ascended bosses', ascended.length===9, ascended.join(','));
      ok('every ascended boss pays a signature material',
         ascended.every(r=>!!matForRing(r)),
         ascended.map(r=>r+':'+(matForRing(r)?matForRing(r).id:'NONE')).join(' '));
      ok('no starter boss pays one',
         [9,10,11,12].every(r=>!matForRing(r)));
      ok('the rift pool is exactly the nine', matPool('rift').length===9, matPool('rift').length+'');
      // The link itself: a kill in a dungeon pays THAT dungeon's material, not a random one.
      // curRoom is a top-level `let` -- a LEXICAL global, not a window property -- so it has to be
      // assigned directly. Writing window.curRoom silently does nothing and every ring reads null,
      // which is the same trap that made every loot sack in the game draw as plain burlap.
      const realRoom=curRoom;
      let linked=true, detail=[];
      for(const r of ascended){
        curRoom={dungeon:true, ring:r};
        const m=riftMatForKill({type:'B'});
        if(!m || m.ring!==r){ linked=false; detail.push(r+':'+(m?m.id:'null')); }
      }
      curRoom=realRoom;
      ok('a boss kill pays its own dungeon\'s material', linked, detail.join(' ')||'all nine matched');
    }

    // ---- the six seeds ----
    note('== riftseeds ==');
    {
      const rings=[]; for(const S of RELIC_SETS) if(rings.indexOf(S.ring)<0) rings.push(S.ring);
      ok('six dungeons host relic sets', rings.length===6, rings.sort((a,b)=>a-b).join(','));
      ok('each has a seed', rings.every(r=>!!MATERIALS[seedIdFor(r)]));
      ok('each seed is made from Riftheart plus its own dungeon\'s material',
         rings.every(r=>{ const rec=matRecipe('riftheart', matForRing(r).id);
           return rec && rec.out===seedIdFor(r); }));
      ok('a seed reaches exactly its own dungeon\'s two sets',
         rings.every(r=>{ const s=forgeSetsFor('helm', r);
           return s.length===2 && s.every(x=>x.set.ring===r); }));
      ok('no seed exists for a dungeon with no sets',
         MAT_KEYS.filter(k=>MATERIALS[k].seed).every(k=>rings.indexOf(MATERIALS[k].ring)>=0));
      // the rift chain must be walked in order -- you cannot reach a seed without the first three
      ok('the Riftheart needs all three early depths',
         !!matRecipe('forgeheart','anchorroot') && !!matRecipe('riftcore','veilshard')
         && !!matRecipe('riftbloom','wallrot'));
    }

    // ---------- 7. THE FORGE, DRIVEN ----------
    note('== the forge ==');
    // stand up a throwaway account so curChar()/matStore() answer
    users['_t']={pass:'x', chars:[{cls:'knight', inv:[], rpg:{}}], cur:0, mats:{}, vault:[]};
    curUser='_t';
    // ownsRelic() short-circuits on a null `rpg`, so a harness that leaves it null cannot see its
    // own satchel and the duplicate guard reads as broken. The forge only ever opens at Bram's
    // stall, which is mid-run, so a live rpg is the honest model of the only state it runs in.
    rpg={relics:[], eqAff:{}, pots:0, mpots:0};
    const ch=curChar();
    ok('test character exists', !!ch && ch.cls==='knight');
    ok('a live run is what the forge runs in', !!rpg);

    matAdd('cinder',2); matAdd('bogiron',2);
    ok('pouch banks what it is given', matCount('cinder')===2, 'cinder='+matCount('cinder'));
    const p1=forgePlan({kind:'mat',id:'bogiron'},{kind:'mat',id:'cinder'});
    ok('bogiron + cinder is a legal join', p1.ok && p1.out==='emberalloy', p1.ok?p1.out:p1.why);
    const r1=forgeDo({kind:'mat',id:'bogiron'},{kind:'mat',id:'cinder'});
    ok('forging consumes both and pays one',
       r1.ok && matCount('emberalloy')===1 && matCount('cinder')===1 && matCount('bogiron')===1,
       'alloy='+matCount('emberalloy')+' cinder='+matCount('cinder')+' iron='+matCount('bogiron'));
    // a pair with no recipe
    const pBad=forgePlan({kind:'mat',id:'cinder'},{kind:'mat',id:'emberalloy'});
    ok('a pair with no recipe is refused', !pBad.ok, pBad.why);
    // spending is all-or-nothing
    const before=matCount('emberalloy');
    const pShort=forgePlan({kind:'mat',id:'emberalloy'},{kind:'mat',id:'glass'});
    ok('a join you lack the second half of is refused', !pShort.ok, pShort.why);
    ok('a refused join takes nothing', matCount('emberalloy')===before);

    // ---- RUNG 2: a T12 piece + a Riftseed -> a relic of a set you choose ----
    // Ring 8 is the Core Sanctum, whose two sets are 'throne' and 'tide'.
    const SEED8=seedIdFor(8);
    ch.inv.push(mkItem('helm',MAXT-1,0,'knight'));     // index 0 -- a T12, the body of a relic
    ch.inv.push(mkItem('helm',5,0,'knight'));          // index 1 -- ordinary, must NOT be an input
    matAdd(SEED8,1);
    const pLow=forgePlan({kind:'item',i:1},{kind:'mat',id:SEED8});
    ok('a mid-tier piece is refused by a Riftseed', !pLow.ok, pLow.why);
    const pNoSet=forgePlan({kind:'item',i:0},{kind:'mat',id:SEED8});
    ok('a T12 piece asks which of the two sets', !pNoSet.ok && !!pNoSet.needSet, pNoSet.why);
    ok('a seed offers only its own dungeon\'s two sets',
       pNoSet.needSet && pNoSet.needSet.length===2 && pNoSet.needSet.every(s=>s.set.ring===8),
       (pNoSet.needSet||[]).map(s=>s.set.id).join(','));
    ok('it does NOT offer all twelve', pNoSet.needSet.length < RELIC_SETS.length,
       pNoSet.needSet.length+' of '+RELIC_SETS.length);
    const setId=pNoSet.needSet[0].set.id;
    const rRel=forgeDo({kind:'item',i:0},{kind:'mat',id:SEED8},{set:setId});
    ok('forging pays a relic into the same satchel slot',
       rRel.ok && ch.inv[0] && !!ch.inv[0].relic, rRel.ok?('relic='+ch.inv[0].relic):rRel.why);
    ok('the forged relic sits at RELIC_T', ch.inv[0] && ch.inv[0].t===RELIC_T, 't='+(ch.inv[0]&&ch.inv[0].t));
    ok('it belongs to the seed\'s own dungeon', relicRing(ch.inv[0].relic)===8, 'ring '+relicRing(ch.inv[0].relic));
    ok('and it is equippable by its maker', typeof canEquip==='function' && canEquip(ch.inv[0],ch));
    ok('the seed was spent', matCount(SEED8)===0, SEED8+'='+matCount(SEED8));

    // ---- RUNG 3: that relic + the reagent it is MADE OF -> Scavenged Dreams ----
    const relIt=ch.inv[0];
    const need=sdMatFor(relIt);
    ok('the relic names the reagent it is made of', !!need, need?need.n:'none');
    ok('and it is keyed to the ITEM, not the slot',
       sdMatFor({k:'wpn',wt:'bow'}) !== sdMatFor({k:'wpn',wt:'wand'}),
       (sdMatFor({k:'wpn',wt:'bow'})||{}).n+' vs '+(sdMatFor({k:'wpn',wt:'wand'})||{}).n);
    // the WRONG reagent is refused by name, so the panel can say what is missing
    const wrongId=(sdMatFor({k:'wpn',wt:'bow'}).id!==need.id)?sdMatFor({k:'wpn',wt:'bow'}).id
                                                             :sdMatFor({k:'ring'}).id;
    matAdd(wrongId,1);
    const pWrongMat=forgePlan({kind:'item',i:0},{kind:'mat',id:wrongId});
    ok('the wrong reagent is refused, by name', !pWrongMat.ok && /needs a /.test(pWrongMat.why||''), pWrongMat.why);
    matAdd(need.id,1);
    // NOT `before` -- the materials section above already declares that in this same block scope, and
    // a duplicate `const` is a SyntaxError, which means the whole harness silently never runs and
    // #testout just keeps saying "pending". Nothing reports a failure; there is simply no report.
    const statsPre=itemStats(ch.inv[0],'knight');
    const pSD=forgePlan({kind:'item',i:0},{kind:'mat',id:need.id});
    ok('a relic plus its own reagent is ready with nothing to ask', pSD.ok, pSD.ok?pSD.label:pSD.why);
    ok('and needs no set chooser -- the relic already IS its set', !pSD.needSet);
    const rSD=forgeDo({kind:'item',i:0},{kind:'mat',id:need.id});
    ok('raising replaces the piece in its own slot', rSD.ok, rSD.ok?'':rSD.why);
    ok('the raised piece sits at SD_T', ch.inv[0] && ch.inv[0].t===SD_T, 't='+(ch.inv[0]&&ch.inv[0].t));
    // THE SET SURVIVES THE UPGRADE, which is what stops the top rung being a trap
    ok('it keeps its relic id, so its set bonus still counts',
       ch.inv[0] && ch.inv[0].relic===relIt.relic, 'relic='+(ch.inv[0]&&ch.inv[0].relic));
    ok('it keeps its exclusive affixes',
       ch.inv[0] && Array.isArray(ch.inv[0].aff) && ch.inv[0].aff.length>0,
       'aff='+((ch.inv[0]&&ch.inv[0].aff)?ch.inv[0].aff.length:'none'));
    ok('and the raise is a real power step',
       itemStats(ch.inv[0],'knight').wis > statsPre.wis,
       statsPre.wis+' -> '+itemStats(ch.inv[0],'knight').wis);
    ok('the reagent was spent', matCount(need.id)===0, need.id+'='+matCount(need.id));
    // an already-raised piece has nothing left to do to it
    matAdd(need.id,1);
    const pAgain=forgePlan({kind:'item',i:0},{kind:'mat',id:need.id});
    ok('an SD piece cannot be raised again', !pAgain.ok, pAgain.why);
    // and the SD reagents fall ONLY from the awakened depths
    if(typeof sdMatDropFor==='function'){
      const _room=curRoom;
      curRoom={dungeon:true, ring:8, rings:null};
      let hits=0; for(let i=0;i<4000;i++) if(sdMatDropFor({type:'B',x:0,y:0})) hits++;
      ok('an ascended boss can pay an SD reagent', hits>0, hits+'/4000');
      curRoom={dungeon:true, ring:9, rings:null};        // ring 9 is a walk-in starter den
      let starter=0; for(let i=0;i<4000;i++) if(sdMatDropFor({type:'B',x:0,y:0})) starter++;
      ok('a starter den never pays one', starter===0, starter+'/4000');
      let trash=0;
      curRoom={dungeon:true, ring:8, rings:null};
      for(let i=0;i<4000;i++) if(sdMatDropFor({type:'c',x:0,y:0,elite:1})) trash++;
      ok('and neither does trash, elite or not', trash===0, trash+'/4000');
      curRoom=_room;
    }

    // ---------- 7b. THE RECIPE BOOK'S DISCOVERY RULE ----------
    // "Not after you spend it, after you loot it at least one time" (user, 2026-07-29). So the book
    // reveals an ingredient on ACQUISITION and never takes it back -- matCount cannot answer this,
    // because spending your last one would re-black a recipe you had already learned.
    note('');
    note('== recipe book ==');
    if(typeof matSeen==='function' && typeof matSeenStore==='function'){
      const s=matSeenStore(), m=matStore();
      delete s['drakeash']; delete m['drakeash'];
      ok('an unlooted material is not discovered', !matSeen('drakeash'));
      matAdd('drakeash',1);
      ok('looting one discovers it', matSeen('drakeash'));
      matSpend({drakeash:1});
      ok('and SPENDING it does not un-discover it', matSeen('drakeash'), 'count='+matCount('drakeash'));
      ok('the count really did go to zero', matCount('drakeash')===0);
      // a save from before this record existed must not present a full pouch as a dark book
      delete s['drakeash']; matAdd('drakeash',1); delete s['drakeash'];
      ok('a pre-record save falls back to the count', matSeen('drakeash'));
      // the book renders, hides what is unfound, and never hides an OUTPUT
      if(typeof _forgeRecipesHtml==='function'){
        const before=matSeenStore();
        const saved=Object.assign({},before);
        for(const k in before) delete before[k];
        const m2=matStore(); const savedM=Object.assign({},m2);
        for(const k in m2) delete m2[k];
        const dark=_forgeRecipesHtml();
        ok('with nothing found the book hides ingredients', /\?\?\?\?\?/.test(dark));
        ok('and still names every output', /Emberalloy/.test(dark), 'output visible');
        ok('it reports how many joins are ready', /0 of \d+ material joins ready/.test(dark),
           (dark.match(/\d+ of \d+ material joins ready/)||[''])[0]);
        // now the other end of the rule: mark EVERY material discovered (restoring the prior state
        // would not do it -- the forge section above spent several, so "before" was never everything)
        for(const k of MAT_KEYS) before[k]=1;
        const lit=_forgeRecipesHtml();
        ok('with everything found nothing is hidden', !/\?\?\?\?\?/.test(lit));
        for(const k in before) delete before[k];
        for(const k in saved) before[k]=saved[k];
        for(const k in savedM) m2[k]=savedM[k];
      }
    } else ok('matSeen exists', false);

    // ---------- 8. THE SAVE MIGRATION ----------
    // The most destructive thing in the ladder swap: a wrong pass silently rewrites the best gear
    // every save owns. Driven over a synthetic save rather than reasoned about, and run TWICE --
    // idempotency is the property that makes a schema marker unnecessary.
    //
    // The fixture is a POST-FIRST-SWAP save, which is what real saves actually look like: relics at
    // the old index 13, Scavenged Dreams at the old index 12, and an ordinary T12 that must not move.
    // `users` is a lexical `let`, so this mutates the object rather than rebinding the name.
    note('== migration ==');
    const _relA='gate_helm', _relB='pyre_wpn';
    users['_m']={cur:0,
      chars:[{cls:'knight',
        inv:[{k:'helm',mt:'plate',t:13,relic:_relA,rar:5,aff:[]},   // relic at the OLD index
             {k:'arm', mt:'plate',t:12,rar:3,aff:[]},               // SD at the OLD index
             {k:'ring',st:'luck', t:11,rar:2,aff:[]}],              // ordinary, must not move
        // EQUIPPED GEAR, which the old migration never walked at all: the tier is a bare number on
        // rpg and the relic id lives off in eqAff, so an equipped relic kept a stale index through
        // the FIRST swap and has been computing as the wrong tier ever since.
        rpg:{wpn:13, arm:12, helm:11, ring:{st:'luck',t:12},
             eqAff:{wpn:{r:5,a:null,rel:_relB}, arm:{r:0,a:null,rel:null},
                    ring:{r:0,a:null,rel:null}}}
      }],
      vault:[{k:'wpn',wt:'sword',t:13,relic:_relB,rar:5,aff:[]},
             {k:'helm',mt:'plate',t:12,rar:3,aff:[]}]};
    const moved=migrateForgeTiers();
    const _mc=users['_m'].chars[0], _mr=_mc.rpg;
    ok('migration moved something', moved>=7, moved+' moved');
    ok('a satchel relic lands on RELIC_T', _mc.inv[0].t===RELIC_T, 't='+_mc.inv[0].t);
    ok('a satchel SD piece lands on SD_T', _mc.inv[1].t===SD_T, 't='+_mc.inv[1].t);
    ok('an ordinary T12 is left alone', _mc.inv[2].t===11, 't='+_mc.inv[2].t);
    ok('a vault relic lands on RELIC_T', users['_m'].vault[0].t===RELIC_T, 't='+users['_m'].vault[0].t);
    ok('a vault SD piece lands on SD_T', users['_m'].vault[1].t===SD_T, 't='+users['_m'].vault[1].t);
    ok('an EQUIPPED relic is migrated', _mr.wpn===RELIC_T, 'wpn='+_mr.wpn);
    ok('an EQUIPPED SD piece is migrated', _mr.arm===SD_T, 'arm='+_mr.arm);
    ok('an equipped ordinary tier is left alone', _mr.helm===11, 'helm='+_mr.helm);
    ok('an equipped ring follows the same rule', _mr.ring.t===SD_T, 'ring='+_mr.ring.t);
    // AND AGAIN -- a second pass must be a complete no-op, or the swap bounces every time the game
    // loads and the ladder oscillates for the life of the save.
    const _snap=JSON.stringify(users['_m']);
    ok('migration is idempotent', migrateForgeTiers()===0);
    ok('and the save is byte-identical after a second pass', JSON.stringify(users['_m'])===_snap);
    delete users['_m'];

    // ---------- 9. THE WIRE ----------
    note('== co-op packing ==');
    ok('NKIND has room and mat was appended', NKIND[9]==='mat' && NKIND.length<=16, 'len='+NKIND.length);
    ok('NKIND indices 0-8 did not move',
       NKIND.slice(0,9).join(',')==='wpn,arm,helm,ring,pot,coin,scroll,egg,mount');
    ok('LOOT_BANDS still fits the 2-bit band field', LOOT_BANDS.length<=4, LOOT_BANDS.length+' rows');
    ok('the relic band points at RELIC_T', LOOT_BANDS[LOOT_BANDS.length-1].min===RELIC_T);
    if(typeof netPackBag==='function' && typeof netUnpackBag==='function'){
      const bag={items:[{k:'helm',mt:'plate',t:SD_T,rar:3}], rar:3, band:2};
      const round=netUnpackBag(netPackBag(bag));
      ok('an SD tier survives the wire', round.items[0].t===SD_T, 't='+round.items[0].t);
      const rbag={items:[{k:'wpn',wt:'sword',t:RELIC_T,rar:5}], rar:5, band:3};
      const rround=netUnpackBag(netPackBag(rbag));
      ok('a relic tier survives the wire', rround.items[0].t===RELIC_T, 't='+rround.items[0].t);
    }

    // ---------- 9b. THE LEVEL CAP ----------
    // 50 is a hard ceiling: levelUp stops there and there is no prestige level. Anything that
    // computes its own level has to land on or under it, or it is content the player is
    // structurally forbidden from matching -- which is what six ascended dungeons were.
    note('== level cap ==');
    ok('ASCEND_LV is reachable', ASCEND_LV<=LV_CAP, 'ASCEND_LV='+ASCEND_LV+' cap='+LV_CAP);
    ok('the Stable opens below the cap', MOUNT_LV<LV_CAP, 'MOUNT_LV='+MOUNT_LV);
    ok('ISLAND_LV is derived from its own provinces',
       ISLAND_LV===STARTER_ZONES*STARTER_LV_PER_ZONE, 'ISLAND_LV='+ISLAND_LV);
    ok('the island leaves a mainland below the cap', ISLAND_LV<LV_CAP);
    {
      const over=[], isleOver=[];
      for(let ring=0; ring<GBOSS.length; ring++){
        let d=null; try{ d=genDungeon(ring); }catch(e){ continue; }
        if(!d||d.lv===undefined) continue;
        if(d.lv>LV_CAP) over.push(ring+':Lv'+d.lv);
        if(isStarterBoss(ring) && d.lv>ISLAND_LV) isleOver.push(ring+':Lv'+d.lv);
      }
      ok('no dungeon sits above the cap', over.length===0, over.join(' ')||'all 13 at or under Lv'+LV_CAP);
      ok('no starter dungeon leaves the island', isleOver.length===0, isleOver.join(' ')||'all on-island');
    }
    {
      const T=_territories(rooms['G']);
      ok('no territory reaches past the cap', T.every(t=>t.lvmax<=LV_CAP),
         'highest = Lv'+Math.max.apply(null,T.map(t=>t.lvmax)));
    }
    // the tree budget: raised so the cap reads as an arrival, but never enough to buy a whole tree
    note('== skill budget ==');
    {
      const atCap=perkTotalFor(LV_CAP);
      ok('the cap pays 44 points', atCap===44, atCap+' points');
      ok('points rise with level', perkTotalFor(LV_CAP)>perkTotalFor(ASCEND_LV),
         perkTotalFor(ASCEND_LV)+' at ascension -> '+atCap+' at cap');
      let dearest=0, cheapest=1e9;
      for(const cls in CLASS_TREE){ let full=0;
        for(const b of CLASS_TREE[cls].branches)
          for(const n of b.nodes) full+=(n.cost||1)*(n.max||1);
        dearest=Math.max(dearest,full); cheapest=Math.min(cheapest,full); }
      ok('no class can buy its whole tree at the cap', atCap<cheapest,
         atCap+' points vs a cheapest tree of '+cheapest);
      ok('the cap funds more than half the dearest tree', atCap/dearest>0.5,
         (100*atCap/dearest).toFixed(0)+'% of '+dearest);
      // TREE_VER must NOT have moved: a bump wipes every saved tree to hand out points that
      // grantPerkPoints delivers on its own
      ok('TREE_VER unchanged at 4', TREE_VER===4, 'TREE_VER='+TREE_VER);
      // a capped hero must actually receive the raise
      const fake={lvl:LV_CAP, perkEarned:35, perkPts:0, tree:{}, treeVer:TREE_VER, ascension:null};
      grantPerkPoints(fake);
      ok('a Lv50 hero on the old budget banks the difference', fake.perkPts===atCap-35,
         '+'+fake.perkPts+' points');
    }

    // ---------- 9c. THE DEV MENU ----------
    // Every tab is painted for real and its controls counted. A dev panel is exactly the kind of
    // thing that rots silently: it reads live tables, so a rename anywhere throws inside one tab
    // and nobody notices until they open it mid-investigation.
    note('== dev menu ==');
    if(typeof DEV_TABS!=='undefined' && typeof DEV_PANE!=='undefined'){
      ok('every tab has a pane', DEV_TABS.every(t=>typeof DEV_PANE[t[0]]==='function'),
         DEV_TABS.filter(t=>typeof DEV_PANE[t[0]]!=='function').map(t=>t[0]).join(',')||'all '+DEV_TABS.length);
      let totalBtns=0; const broke=[], counts=[];
      for(const [id] of DEV_TABS){
        const host=document.createElement('div');
        try{ DEV_PANE[id](host); }
        catch(e){ broke.push(id+': '+e.message); continue; }
        const n=host.querySelectorAll('button').length;
        totalBtns+=n; counts.push(id+':'+n);
        if(!n && id!=='levels') broke.push(id+': painted zero controls');
      }
      ok('every dev tab paints without throwing', broke.length===0, broke.join(' | ')||counts.join(' '));
      ok('the workbench still has a lot of controls', totalBtns>300, totalBtns+' buttons');
      // the two new tabs specifically
      ok('there is a FORGE tab', DEV_TABS.some(t=>t[0]==='forge'));
      ok('there is a LEVELS tab', DEV_TABS.some(t=>t[0]==='levels'));
      // and the forge tab must offer every material, not a hand-typed subset
      {
        const host=document.createElement('div'); DEV_PANE.forge(host);
        const txt=host.textContent;
        const missing=MAT_KEYS.filter(k=>txt.indexOf(MATERIALS[k].n)<0);
        ok('the FORGE tab lists every material', missing.length===0,
           missing.join(',')||MAT_KEYS.length+' materials');
      }
      // the LEVELS tab must name every dungeon so an above-cap one cannot hide
      {
        const host=document.createElement('div'); DEV_PANE.levels(host);
        const txt=host.textContent;
        const missing=[]; for(let r=0;r<GBOSS.length;r++)
          if(txt.indexOf(GBOSS[r].dn||GBOSS[r].n)<0) missing.push(r);
        ok('the LEVELS tab names every dungeon', missing.length===0, missing.join(',')||GBOSS.length+' dungeons');
        ok('and flags none of them as above the cap', txt.indexOf('ABOVE CAP')<0);
      }
      // tierTag, not a raw T-number, anywhere the dev panel prints a tier
      {
        const host=document.createElement('div'); DEV_PANE.sacks(host);
        ok('the SACKS tab writes SD, not T13', host.textContent.indexOf('T13')<0,
           host.textContent.indexOf('SD')>=0?'says SD':'no tier text found');
      }
    } else ok('dev panel loaded', false);

    // ---------- 10. THE PANEL ----------
    note('== panel ==');
    ok('the forge panel exists in the DOM', !!document.getElementById('forgeScr'));
    ok('the forge body exists', !!document.getElementById('forgeBody'));
    ok('Bram carries the forge flag',
       typeof SHOPNPCS!=='undefined' && SHOPNPCS.some(n=>n.id==='bram' && n.forge===true));
    ok('no other stall carries it',
       SHOPNPCS.filter(n=>n.forge).length===1);
    ok('the forge panel is on the vendor close list',
       typeof VENDOR_PANELS!=='undefined' && VENDOR_PANELS.indexOf('forgeScr')>=0);
    // painting away from the stall must say so rather than offering the anvil
    curShopNear=null;
    if(typeof paintForge==='function'){
      document.getElementById('forgeScr').style.display='flex';
      paintForge();
      const txt=document.getElementById('forgeBody').textContent;
      ok('away from the stall the forge is cold', /forge is cold/i.test(txt), txt.slice(0,60));
      curShopNear='bram';
      paintForge();
      const txt2=document.getElementById('forgeBody').textContent;
      ok('at the stall the anvil is offered', /THE POUCH/.test(txt2), txt2.slice(0,60));
      document.getElementById('forgeScr').style.display='none';
    }

    // ---------- 10c. SCROLLS ARE CARRIED, AND CHOSEN ----------
    // "Elites at good rates, bosses drop several more and trash drops none ever" (user, 2026-07-29),
    // and the scroll became an item you hold instead of a counter you never see.
    note('');
    note('== stat scrolls ==');
    if(typeof scrollDropFor==='function'){
      const _room2=curRoom; curRoom=null;
      const rate=(e,n)=>{ let hits=0, items=0;
        for(let i=0;i<n;i++){ const r=scrollDropFor(e);
          if(!r) continue; hits++; items+=Array.isArray(r)?r.length:1; }
        return {p:hits/n, per:hits?items/hits:0}; };
      // TRASH IS EXACTLY ZERO, at the top of the level range and with Fortune irrelevant. Not "low".
      const trash=rate({type:'c',lv:50},20000);
      ok('trash never drops a scroll', trash.p===0, (trash.p*100).toFixed(3)+'%');
      const shooter=rate({type:'s',lv:50},20000);
      ok('nor does a shooter', shooter.p===0, (shooter.p*100).toFixed(3)+'%');
      const elite=rate({type:'c',lv:50,elite:1},20000);
      ok('an elite pays at a good rate', elite.p>0.15&&elite.p<0.26, (elite.p*100).toFixed(1)+'%');
      ok('and pays exactly one', Math.abs(elite.per-1)<0.001, elite.per.toFixed(2));
      const boss=rate({type:'B',lv:50},20000);
      ok('a boss pays often', boss.p>0.5, (boss.p*100).toFixed(1)+'%');
      ok('and pays SEVERAL when it does', boss.per>1.9&&boss.per<4.1, boss.per.toFixed(2)+' per drop');
      // the level gate is the Lv40-50 stretch, not "past the starter island"
      ok('nothing below Lv40 pays', rate({type:'B',lv:39},4000).p===0);
      ok('and a Lv40 boss does', rate({type:'B',lv:40},4000).p>0);
      // a boss's several must not all be the same stat, or a capped stat wastes the whole windfall
      let multi=0;
      for(let i=0;i<400;i++){ const r=scrollDropFor({type:'B',lv:50});
        if(Array.isArray(r)&&r.length>1){ const s={}; for(const x of r) s[x.st]=1;
          if(Object.keys(s).length>1) multi++; } }
      ok('a boss drop spreads across stats', multi>0, multi+'/400 had two or more distinct stats');
      curRoom=_room2;
    } else ok('scrollDropFor exists', false);
    // A SCROLL IS NO LONGER JUNK: it must open the sack rather than being vacuumed up on walk-over.
    if(typeof bagAuto==='function')
      ok('a lone scroll sack is not auto-collected',
         !bagAuto({items:[{k:'scroll',st:'atk'}]}));
    if(typeof bagAuto==='function')
      ok('a lone coin sack still is', bagAuto({items:[{k:'coin',t:0}]}));
    // ---- carried, and consumed by choice ----
    if(typeof itemUsable==='function' && typeof useItem==='function'){
      ok('a scroll is usable', itemUsable({k:'scroll',st:'atk'}));
      ok('gear is not', !itemUsable(mkItem('wpn',5,0,'knight')));
      const ch2=curChar();
      if(ch2){
        if(typeof initTrain==='function') initTrain(rpg);
        // pick a stat with room left, so the happy path is actually reachable
        let st=null;
        for(const s of (typeof SCROLL_STATS!=='undefined'?SCROLL_STATS:['atk']))
          if(((rpg.train&&rpg.train[s])||0) < trainCap(ch2.cls,s,rpg.prestige||0)){ st=s; break; }
        if(st){
          const was=(rpg.train[st]||0), n0=ch2.inv.length;
          ch2.inv.push({k:'scroll',st:st});
          const r=useItem(ch2.inv.length-1);
          ok('using a scroll raises its stat', r.ok && rpg.train[st]===was+1,
             r.ok?(was+' -> '+rpg.train[st]):r.why);
          ok('and consumes exactly the one item', ch2.inv.length===n0, 'inv '+n0+' -> '+ch2.inv.length);
          // AT THE CAP IT REFUSES AND KEEPS THE SCROLL. It must not silently file it to the Vault.
          const cap=trainCap(ch2.cls,st,rpg.prestige||0);
          rpg.train[st]=cap;
          ch2.inv.push({k:'scroll',st:st});
          const idx2=ch2.inv.length-1, n1=ch2.inv.length;
          const r2=useItem(idx2);
          ok('a capped stat refuses', !r2.ok, r2.why);
          ok('and the scroll is still in the satchel', ch2.inv.length===n1 && ch2.inv[idx2]
             && ch2.inv[idx2].k==='scroll');
          rpg.train[st]=was;
          ch2.inv.splice(idx2,1);
        } else ok('a stat with room to train exists', false);
      }
    } else ok('itemUsable/useItem exist', false);

    // ---------- 10c2. A TINTED SPRITE STILL DRAWS ----------
    // itemArtImg tints two kinds of item -- a Riftseed and a stat scroll -- and a tint returns a
    // CANVAS, which has `width` but no `naturalWidth`. drawItemIcon read naturalWidth outright, so the
    // scale came out NaN and drawImage silently drew nothing: every Riftseed rendered BLANK in the
    // satchel and the sack panel. Nothing threw, and the forge panel hid it by using an <img> tag.
    // This asserts pixels, because that is the only thing that could have caught it.
    note('');
    note('== tinted item art ==');
    if(typeof drawItemIcon==='function' && typeof _tintImg==='function'){
      const paint=(it)=>{
        const c=document.createElement('canvas'); c.width=44; c.height=38;
        const g=c.getContext('2d');
        drawItemIcon(g,it,44,38,true);
        const d=g.getImageData(0,0,44,38).data;
        let n=0; for(let i=3;i<d.length;i+=4) if(d[i]>8) n++;
        return n;
      };
      // a plain gear icon is the control: if this is blank the harness itself is wrong
      ok('an ordinary item draws pixels', paint(mkItem('wpn',5,0,'knight'))>0);
      // EVERY ITEM MUST DRAW BEFORE ITS ART HAS LOADED, which is the case that was broken. A lazy
      // image returns null on its first call, so this is the state a player is actually in the first
      // time a material drops -- and materials were the one kind with no procedural fallback at all.
      const seedId=(typeof seedIdFor==='function')?seedIdFor(8):null;
      if(seedId) ok('a Riftseed draws before its art loads', paint({k:'mat',m:seedId})>0,
                    paint({k:'mat',m:seedId})+' opaque px');
      ok('an ordinary material draws too', paint({k:'mat',m:'bogiron'})>0,
         paint({k:'mat',m:'bogiron'})+' opaque px');
      ok('a scroll draws', paint({k:'scroll',st:'atk'})>0, paint({k:'scroll',st:'atk'})+' opaque px');
      ok('pet food draws', paint({k:'food',t:2})>0, paint({k:'food',t:2})+' opaque px');
      // AND THEN THE REAL ART PATH, once the files have actually decoded. This is the half that
      // catches the tinted-canvas bug: a tint returns a canvas with `width` and no `naturalWidth`, so
      // measuring it wrongly yields NaN and drawImage silently draws nothing.
      const load=(src)=>new Promise(r=>{ const i=new Image(); i.onload=()=>r(i); i.onerror=()=>r(null); i.src=src; });
      await Promise.all(['assets/items/mat_seed.png','assets/items/item_scroll.png',
                         'assets/items/food_2.png','assets/items/mat_bogiron.png'].map(load));
      if(typeof _tintImg==='function'){
        const im=await load('assets/items/mat_seed.png');
        if(im){
          const t=_tintImg(im,'#ff9bf0',0.42,0);
          ok('a tint returns something with measurable size',
             (t.naturalWidth||t.width)>0, 'w='+(t.naturalWidth||t.width)+' (naturalWidth='+t.naturalWidth+')');
          ok('and it is a CANVAS, which is why naturalWidth alone was not enough',
             t.naturalWidth===undefined || t===im, 'naturalWidth='+t.naturalWidth);
        }
      }
    } else ok('drawItemIcon/_tintImg exist', false);

    // ---------- 10d. EVERY FIGHT HAS AN EXIT THE PLAYER CAN REACH ----------
    // The rule whose violation once made TWELVE of fifteen anchored fights literally unkillable, and
    // dn5 unfightable at all. It has always been checkable and was only ever reachable by a human
    // clicking a dev button; now that all nine ascended dungeons sit on the cap -- so every one of
    // them runs at bossPace's saturated d=1 -- it is exactly the wrong thing to leave to hand-testing.
    note('');
    note('== killability ==');
    if(typeof devKillabilitySweep==='function'){
      const sw=devKillabilitySweep();
      ok('every registered fight is killable', sw.ok, sw.fails.length?sw.fails.join(' · '):sw.text);
      ok('all 27 fights were driven', sw.total===27, sw.total+' keys');
      // an anchor gate is a TIMED window, so its streak must stay under ANCHOR_WIN plus pace headroom.
      // A ward gate is uncapped BY DESIGN -- killing the adds is the exit -- so the two are reported
      // apart; judging a ward fight by ANCHOR_WIN flags dn0 and ow8 on every clean run.
      ok('worst anchor streak is inside its cap', sw.worstAnchor<=sw.cap,
         sw.worstAnchor.toFixed(1)+'s of '+sw.cap.toFixed(1)+'s');
    } else ok('devKillabilitySweep exists', false);

    // ---------- 11. DENS THAT STAY OPEN ----------
    // A dungeon used to be reachable only through a 45-second portal at a corpse. Beating a boss's
    // overworld form now opens its lair gate for good. These assertions exist because the failure
    // mode is invisible: a door that quietly stops appearing, or one that appears and lets a
    // pre-ascension hero into the awakened depths.
    note('');
    note('== dens ==');
    if(typeof denOpened==='function' && typeof openDen==='function'){
      const _saved=(typeof LS!=='undefined')?LS.get('er-dens',[]):[];
      ok('a den nobody has opened is shut', !denOpened(4));
      ok('opening one reports that it is new', openDen(4)===true);
      ok('and it reads open afterwards', denOpened(4)===true);
      ok('opening it twice is not new again', openDen(4)===false);
      ok('it persists to storage', (LS.get('er-dens',[])||[]).indexOf(4)>=0);
      ok('opening one den does not open another', !denOpened(5));

      // THE DOOR IS KEYED BY BOSS ID, which is the whole reason it survives a world rebuild: a
      // territory index shifts when a territory is added, an identity does not.
      const G=rooms['G'];
      let gated=0, walkin=0;
      if(typeof GBOSS!=='undefined') for(let r=0;r<GBOSS.length;r++){
        if(GBOSS[r].gate==='none') walkin++; else gated++; }
      ok('nine awakened depths and four walk-ins', gated===9&&walkin===4, gated+'/'+walkin);

      // Drive the actual prompt: stand at a lair gate whose den is open and it must offer the
      // dungeon; with the den shut it must offer nothing.
      if(G&&G.lairs&&G.lairs[4]&&G.lairs[4].gate){
        const gt=G.lairs[4].gate, _pr=curRoom, _px=player.x, _py=player.y;
        curRoom=G; player.x=gt.x; player.y=gt.y;
        portalPrompt=null; portalLock=false;
        update(0.016);
        const p1=portalPrompt;
        ok('an open gate offers its dungeon',
           !!p1 && p1.kind==='ground' && p1.gp && p1.gp.ring===4,
           p1?(p1.kind+'/'+(p1.gp?p1.gp.ring:'-')):'none');
        ok('and names the dungeon it leads to',
           !!p1 && p1.ctx===GBOSS[4].dn, p1?String(p1.ctx):'none');
        // a shut den offers nothing from the same spot
        const keep=LS.get('er-dens',[]).filter(x=>x!==4);
        LS.set('er-dens',keep); _denSet=null;
        portalPrompt=null; update(0.016);
        ok('a gate that was never opened offers nothing',
           !portalPrompt || portalPrompt.kind!=='ground');
        LS.set('er-dens',[4]); _denSet=null;
        // AND THE ASCENSION GATE STILL BITES. Boss 4 is one of the nine, so a hero with no
        // ascension must be refused even though the door is open -- the door opening and the door
        // letting you through are separate questions.
        portalPrompt=null; update(0.016);
        const _asc=rpg.ascension; rpg.ascension=null;
        const _room=curRoom;
        if(portalPrompt) usePortalPrompt();
        ok('an un-ascended hero is refused at an awakened door', curRoom===_room);
        rpg.ascension=_asc;
        curRoom=_pr; player.x=_px; player.y=_py;
      } else ok('lair 4 has a gate to stand at', false);

      if(typeof LS!=='undefined'){ LS.set('er-dens',_saved); _denSet=null; }
    } else ok('denOpened/openDen exist', false);
  }

  function boot(){
    run().catch(e=>{ fail++; L.push('  FAIL  harness threw: '+(e&&e.stack||e)); }).then(dump);
  }
  if(document.readyState==='complete') setTimeout(boot,300);
  else window.addEventListener('load',()=>setTimeout(boot,300));
})();
