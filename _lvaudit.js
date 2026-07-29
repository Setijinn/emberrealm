// LEVEL-CAP AUDIT. Reports what the game actually computes around LV_CAP, rather than what the
// comments claim. Read-only: it measures, it does not change anything. Same harness as
// tools/selftest.py -- injected last into the real index.html and read back with --dump-dom.
(function(){
  const L=[];
  const say=(s)=>L.push(s);
  const row=(k,v)=>L.push('  '+String(k).padEnd(46,' ')+' '+v);
  function dump(){
    const el=document.getElementById('testout');
    if(el) el.textContent=L.join('\n');
    document.title='AUDIT DONE';
  }
  function run(){
    say('===== LEVEL CAP AUDIT =====');
    row('LV_CAP', LV_CAP);
    row('ASCEND_LV', ASCEND_LV);
    row('MOUNT_LV (stable opens)', typeof MOUNT_LV!=='undefined'?MOUNT_LV:'n/a');
    row('MOUNT_FLY_LV (declared, unbuilt)', typeof MOUNT_FLY_LV!=='undefined'?MOUNT_FLY_LV:'n/a');

    say('');
    say('--- XP curve ---');
    let tot=0; const marks={};
    for(let l=1;l<LV_CAP;l++){ tot+=xpNeed(l); if([19,20,39,40,44,45,49].indexOf(l)>=0) marks[l]=tot; }
    row('total XP 1 -> '+LV_CAP, tot.toLocaleString());
    row('XP for the last level ('+(LV_CAP-1)+'->'+LV_CAP+')', xpNeed(LV_CAP-1).toLocaleString());
    row('last level as % of whole run', (100*xpNeed(LV_CAP-1)/tot).toFixed(1)+'%');
    row('XP_EXP_FROM / XP_EXP_BASE', XP_EXP_FROM+' / '+XP_EXP_BASE);
    row('cumulative at Lv20 (island done)', (marks[20]||0).toLocaleString()+'  ('+(100*(marks[20]||0)/tot).toFixed(1)+'% of run)');
    row('cumulative at Lv45 (ascension)', (marks[45]||0).toLocaleString()+'  ('+(100*(marks[45]||0)/tot).toFixed(1)+'% of run)');
    row('levels 45-50 as % of whole run', (100*(tot-(marks[44]||0))/tot).toFixed(1)+'%');
    row('xpNeed(LV_CAP) [should be unreachable]', xpNeed(LV_CAP).toLocaleString());

    say('');
    say('--- skill tree at the cap ---');
    row('perk points at Lv'+LV_CAP, perkTotalFor(LV_CAP));
    row('perk points at ASCEND_LV', perkTotalFor(ASCEND_LV));
    row('points earned in the last 5 levels', perkTotalFor(LV_CAP)-perkTotalFor(LV_CAP-5));
    // what a full tree costs, per class, measured
    let cheapest=1e9, dearest=0, worstKey=0, names=[];
    for(const cls in CLASS_TREE){
      const T=CLASS_TREE[cls]; let full=0, branchMax=0, keyMin=1e9;
      for(const b of T.branches){ let bc=0;
        for(const n of b.nodes){ const c=(n.cost||1)*(n.max||1); bc+=c; full+=c;
          if(n.key||n.keystone) keyMin=Math.min(keyMin,c); }
        branchMax=Math.max(branchMax,bc); }
      if(full<cheapest) cheapest=full;
      if(full>dearest){ dearest=full; }
      names.push(cls+':'+full);
    }
    row('classes in CLASS_TREE', Object.keys(CLASS_TREE).length);
    row('full-tree cost range', cheapest+' .. '+dearest+' points');
    row('cap funds this share of the dearest tree', (100*perkTotalFor(LV_CAP)/dearest).toFixed(0)+'%');

    say('');
    say('--- stat training at the cap ---');
    const cls0='knight';
    let capSum=0, capSumP=0;
    for(const s of STATS){ capSum+=trainCap(cls0,s,0); capSumP+=trainCap(cls0,s,1); }
    row('trainCap total, knight, no prestige', capSum);
    row('trainCap total, knight, 1 prestige', capSumP);
    row('TRAIN_BASE', TRAIN_BASE);
    row('all stats maxed is the ascension gate', 'at Lv'+ASCEND_LV);

    say('');
    say('--- zones: what level is where ---');
    const RG=rooms['G'].rings;
    const T=_territories(rooms['G']);
    for(let i=0;i<T.length;i++){
      const t=T[i];
      row('zone '+String(i).padStart(2,' ')+'  '+t.name.padEnd(20,' '),
          'Lv'+t.lvmin+'-'+t.lvmax+'   band '+t.band);
    }

    say('');
    say('--- dungeons: level, gate, and whether it is above the cap ---');
    for(let ring=0; ring<GBOSS.length; ring++){
      let lv='?';
      try{ const d=genDungeon(ring); lv=d.lv!==undefined?d.lv:'?'; }catch(e){ lv='threw: '+e.message; }
      const gb=GBOSS[ring];
      const gate=(gb.gate==='none')?'starter (walk in)':'ASCENDED';
      const over=(typeof lv==='number' && lv>LV_CAP)?('  <-- '+(lv-LV_CAP)+' ABOVE CAP'):'';
      row('dun '+String(ring).padStart(2,' ')+'  '+String(gb.dn||gb.n).slice(0,22).padEnd(24,' '),
          'Lv'+lv+'   '+gate+over);
    }

    say('');
    say('--- overworld lair levels ---');
    for(let ring=0; ring<GBOSS.length; ring++){
      const t=(typeof bossClump==='function')?bossClump(ring):null;
      if(t) row('lair '+String(ring).padStart(2,' ')+'  '+String(GBOSS[ring].n).slice(0,22).padEnd(24,' '),
                'zone Lv'+t.lvmin+'-'+t.lvmax);
    }

    say('');
    say('--- the arena ---');
    if(typeof arenaWave!=='undefined'){
      row('arena reaches LV_CAP at wave', Math.ceil((LV_CAP-2)/1.3));
    }

    say('');
    say('--- enemy scaling at the cap ---');
    if(typeof eDmgScale==='function'){
      row('eDmgScale(1) / (20) / (45) / (50)',
        [1,20,45,50].map(l=>eDmgScale(l).toFixed(2)).join('  /  '));
    }
    if(typeof eFireCd==='function'){
      row('eFireCd(1) / (20) / (45) / (50)',
        [1,20,45,50].map(l=>eFireCd(l).toFixed(2)).join('  /  '));
    }
    if(typeof eShotCount==='function'){
      row('eShotCount(1) / (20) / (45) / (50)',
        [1,20,45,50].map(l=>eShotCount(l)).join('  /  '));
    }
    if(typeof bossPace==='function'){
      const p50=bossPace({lv:50}), p45=bossPace({lv:45}), p20=bossPace({lv:20});
      row('bossPace telegraph  20 / 45 / 50',
        [p20,p45,p50].map(p=>(p.tell!==undefined?p.tell:p.cycle).toFixed(2)).join('  /  '));
      row('bossPace cycle      20 / 45 / 50',
        [p20,p45,p50].map(p=>p.cycle.toFixed(2)).join('  /  '));
    }

    say('');
    say('--- loot: where the ladder tops out ---');
    if(typeof ZONE_TIERS!=='undefined'){
      ZONE_TIERS.forEach((z,i)=>{
        const pmax=Math.max.apply(null,(z.pub||[[0,0]]).map(r=>r[0]));
        const smax=(z.sb&&z.sb.length)?Math.max.apply(null,z.sb.map(r=>r[0])):-1;
        row('ZONE_TIERS['+String(i).padStart(2,' ')+']',
            'pub top T'+(pmax+1)+'   bound top '+(smax<0?'none':tierTag(smax))
            +'   sbP '+(z.sbP*100).toFixed(2)+'%');
      });
    }
    if(typeof relicChanceFor==='function'){
      say('');
      say('--- relic drop gate ---');
      for(let ring=0; ring<GBOSS.length; ring++){
        const c=relicChanceFor(ring);
        if(c>0) row('relics from dun '+ring+' ('+String(GBOSS[ring].dn||GBOSS[ring].n).slice(0,20)+')',
                    (c*100).toFixed(2)+'% per boss kill');
      }
    }
  }
  function boot(){ try{ run(); }catch(e){ say('AUDIT THREW: '+(e&&e.stack||e)); } dump(); }
  if(document.readyState==='complete') setTimeout(boot,500);
  else window.addEventListener('load',()=>setTimeout(boot,500));
})();
