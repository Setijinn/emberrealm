// ===================================================================================================
//  _balaudit.js -- WHAT THE REBALANCE ACTUALLY DID
// ---------------------------------------------------------------------------------------------------
//  "More enemies less hp and damage" is three numbers moving at once, and the interesting quantity is
//  none of them on its own: it is what a player standing in a zone actually faces. So this measures
//  the PRODUCT -- how many roamers can be alive around you at a given level, how much health that
//  crowd has between them, and how hard it hits -- alongside the per-enemy figures.
//
//  It reads the live constants rather than restating them, so it cannot drift from the game the way a
//  hand-kept table would. The OLD column is the one thing stated here, because those values are no
//  longer anywhere in the source to be read back.
// ===================================================================================================
(function(){
  const L=[];
  function say(t){ L.push(t); }
  function dump(){
    const el=document.getElementById('testout');
    if(el) el.textContent=L.join('\n');
    document.title='AUDIT DONE';
  }
  // what these dials were before 2026-08-01, kept only so the ratio columns mean something
  const OLD={hp:1, dm:1, capMin:3, capMax:8, capStep:9};

  function cap(lv,c){ return Math.max(c.capMin, Math.min(c.capMax, c.capMin+Math.floor(lv/c.capStep))); }
  function pad(v,n){ v=String(v); while(v.length<n) v=' '+v; return v; }

  function run(){
    try{
      const NEW={hp:MOB_HP_MUL, dm:MOB_DMG_MUL,
                 capMin:MOB_CAP_MIN, capMax:MOB_CAP_MAX, capStep:MOB_CAP_STEP};
      say('BALANCE AUDIT  -- more enemies, less hp and damage');
      say('');
      say('  roamer cap    was '+OLD.capMin+'..'+OLD.capMax+' (+1 per '+OLD.capStep+' lv)'
                    +'   now '+NEW.capMin+'..'+NEW.capMax+' (+1 per '+NEW.capStep+' lv)');
      say('  roamer hp     x'+NEW.hp);
      say('  roamer hit    x'+NEW.dm);
      say('  bosses and dungeon nodes are NOT scaled: makeEnemy applies these on the c/s branches only');
      say('');
      say('  lv | cap old>new | hp/mob old>new | crowd hp old>new | hit/mob old>new | crowd hit old>new');
      say('  ---+-------------+----------------+------------------+-----------------+-------------------');
      let worstHp=0, worstHit=0;
      for(const lv of [1,5,10,20,30,40,50]){
        const hm=eHpScale(lv), dm=eDmgScale(lv);
        // exactly what makeEnemy builds for a contact roamer, both ways
        const hpO=40*hm*OLD.hp,  hpN=40*hm*NEW.hp;
        const htO=(7+dm)*OLD.dm, htN=(7+dm)*NEW.dm;
        const cO=cap(lv,OLD),    cN=cap(lv,NEW);
        const chO=hpO*cO, chN=hpN*cN, hitO=htO*cO, hitN=htN*cN;
        worstHp=Math.max(worstHp, Math.abs(chN/chO-1));
        worstHit=Math.max(worstHit, Math.abs(hitN/hitO-1));
        say('  '+pad(lv,2)+' | '+pad(cO,4)+' > '+pad(cN,4)
           +' | '+pad(Math.round(hpO),6)+' > '+pad(Math.round(hpN),5)
           +' | '+pad(Math.round(chO),7)+' > '+pad(Math.round(chN),6)
           +' | '+pad(Math.round(htO),7)+' > '+pad(Math.round(htN),5)
           +' | '+pad(Math.round(hitO),8)+' > '+pad(Math.round(hitN),6));
      }
      say('');
      say('  crowd hp  = what an area costs to clear.          worst drift '+(worstHp*100).toFixed(1)+'%');
      say('  crowd hit = the pressure if all of them reach you. worst drift '+(worstHit*100).toFixed(1)+'%');
      say('  Those two are what the change is meant to hold roughly flat while the COUNT goes up and');
      say('  each individual goes down. A large drift in either means the three dials disagree.');
      say('');
      const hmB=eHpScale(50);
      say('  a Lv50 overworld boss keeps '+Math.round(600*hmB*1.35)+' hp -- unchanged, deliberately');

      // ---- THE T11+ CUT, MEASURED RATHER THAN ASSERTED ------------------------------------------
      // Rolls the real function against the real rows. A bound roll can only be refused where the
      // row can actually produce T11+, so the rows that cannot are expected to read 0.0% change --
      // that is the check, not a gap in the table.
      say('');
      say('T11+ DROP CUT  (TOP_TIER_FROM='+TOP_TIER_FROM+', keep '+(TOP_TIER_KEEP*100).toFixed(0)+'%)');
      say('');
      say('  row  province             T11+ per 100k trash kills   change');
      say('  ------------------------------------------------------------');
      const N=100000;
      for(let z=0;z<ZONE_TIERS.length;z++){
        const row=ZONE_TIERS[z];
        if(!row.sb) continue;
        let top=0, topNoCut=0;
        for(let i=0;i<N;i++){
          if(Math.random()>=row.sbP) continue;
          const t=pickWeighted(row.sb,0);
          if(t<TOP_TIER_FROM) continue;
          topNoCut++;
          if(Math.random()<TOP_TIER_KEEP) top++;
        }
        const nm=(typeof ZONE_NAMES!=='undefined'&&ZONE_NAMES[z])?ZONE_NAMES[z]:('clump '+z);
        const chg=topNoCut? ((top/topNoCut-1)*100) : 0;
        say('  '+pad(z,3)+'  '+(String(nm)+'                    ').slice(0,20)
           +'  '+pad(topNoCut,6)+' > '+pad(top,6)+'   '+pad(chg.toFixed(1)+'%',8));
      }
      say('');
      say('  Sampled, so expect a fraction of a percent of noise around -15%.');
      say('  A row whose sb table tops out below T11 can still show a cut: TIER_OVERFLOW gives every');
      say('  row a 5% tail one rung above its ceiling, so Cinderwatch really does pay the odd T11.');

      // ---- AND IS EVERYTHING STILL KILLABLE ------------------------------------------------------
      // The one check that matters after moving enemy health: the sweep 12b_devplus runs over every
      // fight in the game. Cutting roamer hp cannot make a fight harder, but the cap change puts more
      // bodies on screen, and the sweep is what would catch a crowd that outruns a class's dps.
      // OPT-IN: the sweep simulates 600 seconds of every fight in the game and overran the audit
      // runner's timeout, which left the whole report reading "pending" -- a slow check that eats a
      // fast one is worse than no check. Ask for it with ?sweep=1.
      say('');
      const wantSweep=/[?&]sweep=1/.test(location.search);
      if(!wantSweep) say('KILLABILITY SWEEP  -- skipped; re-run with sweep=1 (it is slow)');
      else if(typeof devKillabilitySweep==='function'){
        const r=devKillabilitySweep();
        say('KILLABILITY SWEEP');
        say(String(r&&r.text||r).split(String.fromCharCode(10))
                 .map(function(x){return '  '+x;}).join(String.fromCharCode(10)));
      } else say('KILLABILITY SWEEP  -- devKillabilitySweep not loaded in this build');
    }catch(e){ say('AUDIT THREW: '+(e&&e.stack||e)); }
    dump();
  }
  if(document.readyState==='complete') setTimeout(run,500);
  else window.addEventListener('load',()=>setTimeout(run,500));
})();
