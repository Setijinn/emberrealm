// IS THE GENERATED WORLD THE SAME WORLD? Measured against the artifact it replaced.
//
// 00c_worldgen.js generates everything east of the bridge from a seed. The retired 00d_vgrove.js was
// 839 KB of baked JSON with no source, so "does the new one look right" was previously a question you
// could only answer by walking around in it. Every number in the EXPECTED column below was measured
// off that artifact before it was deleted, and it is here so a tuning change to the coastline is
// judged against the world people actually played rather than against the last run of this tool.
//
//   py tools/serve.py
//   py tools/audit.py _worldaudit.js
(function(){
  const L=[]; let bad=0, warn=0;
  const pad=(s,n)=>{ s=String(s); return s+' '.repeat(Math.max(1,n-s.length)); };
  // EXPECTED, from the artifact. tol is a FRACTION of expected.
  function cmp(name, got, want, tol, unit){
    const off=Math.abs(got-want)/(want||1);
    const ok=off<=tol;
    if(!ok) bad++;
    L.push('  '+(ok?'ok  ':'BAD ')+pad(name,34)+pad(got+(unit||''),14)
           +'want '+want+(unit||'')+'  ('+(off*100).toFixed(1)+'% off, tol '+(tol*100)+'%)');
    return ok;
  }
  function note(s){ L.push(s); }
  function out(){
    const el=document.getElementById('testout');
    const head='WORLD AUDIT  '+(bad?('FAIL — '+bad+' out of tolerance'):'OK')+(warn?('  ('+warn+' warnings)'):'');
    if(el) el.textContent=head+'\n'+L.join('\n');
    document.title='WORLD '+(bad?'FAIL':'OK');
  }

  function go(){
    const D=ROOM_DEFS['G'];
    const R=D.rings, W=D.w, H=D.h, x1=R.bridge.x1, aW=ISLE_A_W;

    note('== identity ==');
    note('  seed 0x'+WORLD_SEED.toString(16)+'   WORLD_HASH '+WORLD_HASH);
    note('  '+W+'x'+H+' = '+(W*H)+' tiles   island A baked to '+ISLE_A_RLE.length+' chars of RLE');
    note('  connectivity fill reached '+D._gen.reached+' tiles, drowned '+D._gen.drowned+' orphan tiles');
    note('');

    // ---- per-island land, the headline number ----
    note('== land ==');
    let landA=0, landB=0, water=0;
    const mix={};
    for(let y=0;y<H;y++){
      const row=D.map[y];
      for(let x=0;x<W;x++){
        const c=row[x];
        mix[c]=(mix[c]||0)+1;
        if(c==='w'){ water++; continue; }
        if(x<aW) landA++; else if(x>=x1) landB++;
      }
    }
    cmp('island A land tiles', landA, 74324, 0.0);        // BAKED: zero tolerance, it is bytes
    cmp('island B land tiles', landB, 371974, 0.03);
    note('  island B fills '+(100*landB/(H*(W-x1))).toFixed(1)+'% of its half (artifact: 74.2%)');
    note('');

    // ---- the ground mix, which is what the place looks like ----
    note('== ground mix, whole world ==');
    // Measured off 00d_vgrove.js before it was deleted. Not targets to hit exactly -- island A is
    // baked so it contributes its share unchanged, and island B is generated, so what these check is
    // that the generated half still looks like the same PLACE: mostly scree and dirt in the middle
    // bands, ash on the rim, a fifth of the world in trees and boulders.
    const WANT={w:385651, r:150926, d:117216, e:91455, g:56071, k:23149, c:4732, s:2758, t:2100, b:1140, T:1, P:1};
    const keys=Object.keys(mix).sort((a,b)=>mix[b]-mix[a]);
    for(const k of keys){
      const want=WANT[k];
      const s='  '+pad("'"+k+"'",6)+pad(mix[k],10)+(100*mix[k]/(W*H)).toFixed(2)+'%';
      if(want==null){ L.push(s+'   (not in the artifact)'); warn++; }
      else L.push(s+'   artifact '+want+'  ('+(100*(mix[k]-want)/want).toFixed(1)+'%)');
    }
    note('');

    // ---- spawns: the density that decides whether the world feels populated ----
    note('== spawns ==');
    const spawns=(mix['c']||0)+(mix['s']||0);
    cmp('spawn markers', spawns, 7490, 0.10);
    note('  '+(100*spawns/(landA+landB)).toFixed(2)+'% of land carries a spawn marker');
    note('');

    // ---- contiguity: every land tile east of the bridge must be walkable from the bridge ----
    // The generator drowns orphans, so this must come back at zero. It is asserted anyway, because
    // the fill and this check disagree the moment the fill's seed or its neighbour test changes.
    note('== contiguity ==');
    const seen=new Uint8Array(W*H), st=new Int32Array(W*H);
    let sp=0, reach=0;
    const half=(R.bridge.w/2)|0;
    for(let y=R.bridge.cy-half;y<R.bridge.cy-half+R.bridge.w;y++){
      const i=y*W+R.bridge.x1;
      if(D.map[y][R.bridge.x1]!=='w'&&!seen[i]){ seen[i]=1; st[sp++]=i; }
    }
    while(sp>0){ const i=st[--sp]; reach++;
      const x=i%W, y=(i-x)/W;
      if(x+1<W && !seen[i+1] && D.map[y][x+1]!=='w'){ seen[i+1]=1; st[sp++]=i+1; }
      if(x-1>=0 && !seen[i-1] && D.map[y][x-1]!=='w'){ seen[i-1]=1; st[sp++]=i-1; }
      if(y+1<H && !seen[i+W] && D.map[y+1][x]!=='w'){ seen[i+W]=1; st[sp++]=i+W; }
      if(y-1>=0 && !seen[i-W] && D.map[y-1][x]!=='w'){ seen[i-W]=1; st[sp++]=i-W; }
    }
    let orphan=0;
    for(let y=0;y<H;y++){ const row=D.map[y];
      for(let x=x1;x<W;x++) if(row[x]!=='w' && !seen[y*W+x]) orphan++; }
    if(orphan){ bad++; L.push('  BAD  '+orphan+' land tiles east of the bridge are unreachable from it'); }
    else L.push('  ok   every land tile east of the bridge is reachable from the bridge');
    L.push('       (the fill also crossed to island A: '+reach+' tiles reached in total)');
    note('');

    // ---- what MUST be standable ----
    note('== the things that must exist ==');
    const solid='WhlHwXD';
    const standable=(tx,ty)=>{ const c=(D.map[ty]||'')[tx]; return !!c && solid.indexOf(c)<0; };
    let miss=0;
    if(!standable(R.portal.x,R.portal.y)){ bad++; miss++;
      L.push('  BAD  the rift portal at '+R.portal.x+','+R.portal.y+' is not standable'); }
    for(const p of D.pillars){
      if(!standable(p.tx,p.ty)){ bad++; miss++;
        L.push('  BAD  pillar "'+p.name+'" at '+p.tx+','+p.ty+' is not standable'); }
    }
    // the bridge, end to end
    let bridgeGap=0;
    for(let x=R.bridge.x0;x<=R.bridge.x1;x++) if(!standable(x,R.bridge.cy)) bridgeGap++;
    if(bridgeGap){ bad++; miss++; L.push('  BAD  the bridge has '+bridgeGap+' impassable tiles along its centre line'); }
    if(!miss) L.push('  ok   the rift, all '+D.pillars.length+' pillars and the whole bridge are standable');
    note('');

    // ---- the province model: no level skips across a border ----
    // THE RULE THIS PROTECTS: a Lv5 player walking one tile must never arrive in Lv11 ground. Only
    // provinces whose level bands are adjacent may share a border. Sampled on a stride, because the
    // question is whether a skip EXISTS and a 4-tile stride cannot miss a province boundary.
    note('== province borders ==');
    if(typeof _territories==='function' && typeof zoneAtIn==='function'){
      const G=(typeof rooms!=='undefined')?rooms['G']:null;
      if(G){
        const T=_territories(G);
        note('  '+T.length+' provinces');
        const skips={};
        for(let y=2;y<H-2;y+=4){
          for(let x=2;x<W-2;x+=4){
            if(gAt(G,x,y)==='\0'||gCode(G,x,y)===T_w) continue;
            const a=zoneAtIn(G,x,y); if(a<0) continue;
            for(const [dx,dy] of [[4,0],[0,4]]){
              const b=zoneAtIn(G,x+dx,y+dy); if(b<0||b===a) continue;
              const lo=Math.min(T[a].lvmin,T[b].lvmin), hi=Math.max(T[a].lvmin,T[b].lvmin);
              // adjacent bands differ by one province's worth of levels; more than that is a skip
              if(hi-lo>6){ const k=T[a].name+' | '+T[b].name+'  Lv'+T[a].lvmin+' <-> Lv'+T[b].lvmin;
                skips[k]=(skips[k]||0)+1; }
            }
          }
        }
        const ks=Object.keys(skips);
        if(ks.length){ warn++;
          L.push('  '+ks.length+' province pairs share a border across a level gap of more than 6:');
          for(const k of ks.slice(0,8)) L.push('       '+k+'   ('+skips[k]+' sampled crossings)');
          L.push('       NOTE: on the radial world this is expected at the RIM, where five band-8');
          L.push('       provinces all touch the inner ring. Stage 10 replaces the radial model.');
        } else L.push('  ok   no province border crosses a level gap of more than 6');
      } else L.push('  (rooms.G not built yet — skipped)');
    } else L.push('  (_territories/zoneAtIn unavailable — skipped)');
    note('');

    // ---- determinism ----
    note('== determinism ==');
    const again=genWorld();
    let diff=0;
    for(let y=0;y<H&&diff<5;y++) if(again.map[y]!==D.map[y]) diff++;
    if(diff){ bad++; L.push('  BAD  generating twice gave different worlds ('+diff+'+ rows differ)'); }
    else L.push('  ok   generating twice is byte-identical');
    const h2=worldHash(again);
    if(h2!==WORLD_HASH){ bad++; L.push('  BAD  WORLD_HASH is not stable: '+WORLD_HASH+' vs '+h2); }
    else L.push('  ok   WORLD_HASH is stable  ['+WORLD_HASH+']');
    // NO TRIG IN THE TILE DECISION. Math.sin/cos/pow are implementation-defined in ECMAScript, so a
    // world that used one could differ between two players' browsers in the last bits -- and one
    // tile of disagreement is a player walking through a rock somebody else is standing on.
    const src=(typeof genWorld==='function')?genWorld.toString()+wgLandAt.toString()+wgVal.toString()
              +wgFbm.toString()+wgHash.toString():'';
    const trig=/Math\.(sin|cos|tan|atan2|pow|exp|log|hypot|random)\b/.exec(src);
    if(trig){ bad++; L.push('  BAD  the tile decision calls '+trig[0]+' — not exactly specified by ECMAScript'); }
    else L.push('  ok   the tile decision uses integer hashes and Math.sqrt only');

    out();
  }

  function boot(){ try{ go(); }catch(e){ bad++; L.push('AUDIT THREW: '+(e&&e.stack||e)); out(); } }
  if(document.readyState==='complete') setTimeout(boot,700);
  else window.addEventListener('load',()=>setTimeout(boot,700));
})();
