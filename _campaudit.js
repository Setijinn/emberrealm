// Camp placement, dumped at runtime. The audit suite never printed R.camps, so "camps place" and
// "camps clear the pillars" were both assumed rather than measured.
(function(){
  const L=[]; const say=t=>L.push(t);
  function dump(){ const el=document.getElementById('testout');
    if(el) el.textContent=L.join('\n'); document.title='AUDIT DONE'; }
  function run(){
    try{
      const R=rooms['G'];
      const camps=(R&&R.camps)||[];
      const pills=(R&&R.pillars)||[];
      const lairs=[]; for(const k in (R.lairs||{})){ const x=R.lairs[k]; if(x&&x.cx!=null) lairs.push(x); }
      say('CAMP AUDIT');
      say('  camps placed      '+camps.length+'   (CAMP_PER_ZONE='+CAMP_PER_ZONE+' x '+_territories(R).length+' provinces = '+(CAMP_PER_ZONE*_territories(R).length)+' wanted)');
      say('  pillars           '+pills.length);
      say('  lairs             '+lairs.length);
      let mobs=0, elites=0; for(const c of camps){ mobs+=c.mobs||0; elites+=c.elites||0; }
      say('  roamers in camps  '+mobs+'   elites '+elites+'  (CAMP_ELITES='+CAMP_ELITES+' each)');
      say('');
      // the thing this file exists for
      let worstP=1e9, worstPn='', worstL=1e9, worstC=1e9;
      for(const c of camps){
        for(const p of pills){ const d=Math.hypot(p.x/TILE-c.tx, p.y/TILE-c.ty);
          if(d<worstP){ worstP=d; worstPn=(p.name||'?')+' vs camp in z'+c.z; } }
        for(const l of lairs){ const d=Math.hypot(l.cx/TILE-c.tx, l.cy/TILE-c.ty); if(d<worstL) worstL=d; }
        for(const o of camps){ if(o===c) continue; const d=Math.hypot(o.tx-c.tx,o.ty-c.ty); if(d<worstC) worstC=d; }
      }
      const okP=worstP>=CAMP_PILLAR_GAP, okL=worstL>=CAMP_LAIR_GAP, okC=worstC>=CAMP_MIN_GAP;
      say('  closest camp-to-PILLAR  '+worstP.toFixed(1)+' tiles   (gap '+CAMP_PILLAR_GAP+')  '+(okP?'ok':'FAIL')+'   '+worstPn);
      say('  closest camp-to-lair    '+worstL.toFixed(1)+' tiles   (gap '+CAMP_LAIR_GAP+')  '+(okL?'ok':'FAIL'));
      say('  closest camp-to-camp    '+worstC.toFixed(1)+' tiles   (gap '+CAMP_MIN_GAP+')  '+(okC?'ok':'FAIL'));
      say('');
      say('  per province:');
      const byZ={}; for(const c of camps) byZ[c.z]=(byZ[c.z]|0)+1;
      const T=_territories(R);
      for(let z=0;z<T.length;z++) say('   '+String(z).padStart(3)+'  '+(T[z].name+'                    ').slice(0,20)+'  '+(byZ[z]|0)+' camps');
    }catch(e){ say('AUDIT THREW: '+(e&&e.stack||e)); }
    dump();
  }
  if(document.readyState==='complete') setTimeout(run,600);
  else window.addEventListener('load',()=>setTimeout(run,600));
})();
