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
    ok('MAXT is 13', MAXT===13, 'MAXT='+MAXT);
    ok('SD_T is 12', SD_T===12, 'SD_T='+SD_T);
    ok('RELIC_T is 13', RELIC_T===13, 'RELIC_T='+RELIC_T);
    ok('MAXT-1 lands exactly on SD', MAXT-1===SD_T);
    ok('TIER_NAMES[SD_T] is Scavenged Dreams', TIER_NAMES[SD_T]==='Scavenged Dreams', TIER_NAMES[SD_T]);
    ok('TIER_NAMES[RELIC_T] is Riftforged', TIER_NAMES[RELIC_T]==='Riftforged', TIER_NAMES[RELIC_T]);
    ok('ladder has no tail', TIER_NAMES.length===RELIC_T+1, 'len='+TIER_NAMES.length);
    ok('SD is written "SD", not "T13"', tierTag(SD_T)==='SD', tierTag(SD_T));
    ok('ordinary tiers still read T<n>', tierTag(0)==='T1' && tierTag(11)==='T12', tierTag(0)+'/'+tierTag(11));
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
    ok('mkItem never exceeds SD even when asked for T44', worst<=SD_T, 'highest t seen = '+worst);
    ok('mkItem can be pushed to SD by an explicit request', worst===SD_T, 'highest t seen = '+worst);

    // the auction shelf, across a year of periods
    let aucMax=-1;
    if(typeof auctionListings==='function'){
      const realPeriod=window.auctionPeriod;
      for(let d=0; d<365; d++){
        window.auctionPeriod=()=>d;
        try{ for(const l of auctionListings()) if(l.item && l.item.t>aucMax) aucMax=l.item.t; }catch(e){}
      }
      window.auctionPeriod=realPeriod;
      ok('auction never stocks SD over 365 periods', aucMax<SD_T, 'highest shelf tier = '+aucMax);
    }
    // the event chest
    let chestMax=-1;
    if(typeof rollEventChest==='function'){
      for(let i=0;i<600;i++) for(const it of rollEventChest(50,'knight',{relicP:0}))
        if(it.t>chestMax) chestMax=it.t;
      ok('event chest never pays SD', chestMax<SD_T, 'highest chest tier = '+chestMax);
    }
    // pickWeighted's overflow tail must not manufacture SD out of a T12 row
    if(typeof pickWeighted==='function'){
      let ovf=-1;
      for(let i=0;i<20000;i++){ const t=pickWeighted([[10,45],[11,55]],200); if(t>ovf) ovf=t; }
      ok('a T11/T12 row cannot overflow into SD', ovf<SD_T, 'highest = '+ovf);
      let sdrow=-1;
      for(let i=0;i<20000;i++){ const t=pickWeighted([[10,42],[11,50],[12,8]],200); if(t>sdrow) sdrow=t; }
      ok('a row that names SD can reach SD and no further', sdrow===SD_T, 'highest = '+sdrow);
    }

    // ---------- 5. WHERE SD ACTUALLY FALLS ----------
    note('== SD sources ==');
    if(typeof ZONE_TIERS!=='undefined'){
      const sdZones=[], pubLeak=[];
      ZONE_TIERS.forEach((z,i)=>{
        if((z.sb||[]).some(r=>r[0]===SD_T)) sdZones.push(i);
        if((z.pub||[]).some(r=>r[0]>=SD_T)) pubLeak.push(i);
      });
      ok('SD is soulbound everywhere it drops', pubLeak.length===0, pubLeak.join(',')||'no public SD');
      ok('SD falls only in the Lv50 rim (zones 9-13)',
         sdZones.length===5 && sdZones[0]===9 && sdZones[4]===13, 'zones '+sdZones.join(','));
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

    // the gear rung. Ring 8 is the Core Sanctum: two sets, 'throne' and 'tide'.
    const SEED8=seedIdFor(8);
    ch.inv.push(mkItem('helm',11,0,'knight'));            // a T12 -- must NOT be forgeable
    ch.inv.push({k:'helm', mt:'plate', t:SD_T, rar:3, aff:[]});   // a Scavenged Dreams helm
    matAdd(SEED8,1);
    const pT12=forgePlan({kind:'item',i:0},{kind:'mat',id:SEED8});
    ok('a T12 piece is refused by a Riftseed', !pT12.ok, pT12.why);
    const pNoSet=forgePlan({kind:'item',i:1},{kind:'mat',id:SEED8});
    ok('an SD piece asks which of the two sets', !pNoSet.ok && !!pNoSet.needSet, pNoSet.why);
    ok('a seed offers only its own dungeon\'s two sets',
       pNoSet.needSet && pNoSet.needSet.length===2 && pNoSet.needSet.every(s=>s.set.ring===8),
       (pNoSet.needSet||[]).map(s=>s.set.id).join(','));
    ok('it does NOT offer all twelve', pNoSet.needSet.length < RELIC_SETS.length,
       pNoSet.needSet.length+' of '+RELIC_SETS.length);
    const setId=pNoSet.needSet[0].set.id;
    const pRel=forgePlan({kind:'item',i:1},{kind:'mat',id:SEED8},{set:setId});
    ok('with a set chosen the forge is ready', pRel.ok, pRel.ok?pRel.label:pRel.why);
    const rRel=forgeDo({kind:'item',i:1},{kind:'mat',id:SEED8},{set:setId});
    ok('forging pays a relic into the same satchel slot',
       rRel.ok && ch.inv[1] && !!ch.inv[1].relic, rRel.ok?('relic='+ch.inv[1].relic):rRel.why);
    ok('the forged relic sits at T14', ch.inv[1] && ch.inv[1].t===RELIC_T, 't='+(ch.inv[1]&&ch.inv[1].t));
    ok('the forged relic belongs to the seed\'s own dungeon',
       relicRing(ch.inv[1].relic)===8, 'ring '+relicRing(ch.inv[1].relic));
    ok('the forged relic is equippable by its maker',
       typeof canEquip==='function' && canEquip(ch.inv[1],ch), 'mt='+(ch.inv[1]&&ch.inv[1].mt));
    ok('the seed was spent', matCount(SEED8)===0, SEED8+'='+matCount(SEED8));
    // and it cannot be made twice
    ch.inv.push({k:'helm', mt:'plate', t:SD_T, rar:3, aff:[]});
    matAdd(SEED8,1);
    const pDupe=forgePlan({kind:'item',i:2},{kind:'mat',id:SEED8},{set:setId});
    ok('the same relic cannot be forged twice', !pDupe.ok, pDupe.why);
    // a seed from another dungeon cannot reach this one's sets
    const SEED3=seedIdFor(3); matAdd(SEED3,1);
    const pWrong=forgePlan({kind:'item',i:2},{kind:'mat',id:SEED3},{set:setId});
    ok('a seed cannot forge another dungeon\'s set', !pWrong.ok, pWrong.why);

    // ---------- 8. THE SAVE MIGRATION ----------
    note('== migration ==');
    users['_m']={chars:[{cls:'knight', inv:[{k:'helm',mt:'plate',t:12,relic:'gate_helm',rar:5,aff:[]}]}],
                 cur:0, vault:[{k:'wpn',wt:'sword',t:12,relic:'pyre_wpn',rar:5,aff:[]}]};
    const moved=migrateForgeTiers();
    ok('migration moves old relics off index 12', moved>=2, moved+' moved');
    ok('a migrated satchel relic is at T14', users['_m'].chars[0].inv[0].t===RELIC_T);
    ok('a migrated vault relic is at T14', users['_m'].vault[0].t===RELIC_T);
    ok('migration is idempotent', migrateForgeTiers()===0);

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
  }

  function boot(){
    run().catch(e=>{ fail++; L.push('  FAIL  harness threw: '+(e&&e.stack||e)); }).then(dump);
  }
  if(document.readyState==='complete') setTimeout(boot,300);
  else window.addEventListener('load',()=>setTimeout(boot,300));
})();
