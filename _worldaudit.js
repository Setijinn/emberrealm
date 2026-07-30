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
    note('== land, per island ==');
    const land=[0,0,0]; const mix={}; let water=0;
    const isleOfXY=(x,y)=>{
      if(x<ISLE_A_W) return 0;
      let best=-1, bd=1e18;
      for(const I of R.isles){ if(I.baked||I.cx==null) continue;
        const dx=x-I.cx, dy=y-I.cy, d=dx*dx+dy*dy, rr=I.r*1.45;
        if(d<=rr*rr && d<bd){ bd=d; best=I.id|0; } }
      return best;
    };
    for(let y=0;y<H;y++){
      const row=D.map[y];
      for(let x=0;x<W;x++){
        const c=row[x];
        mix[c]=(mix[c]||0)+1;
        if(c==='w'){ water++; continue; }
        const i=isleOfXY(x,y); if(i>=0) land[i]++;
      }
    }
    // Island A is BAKED, so this is bytes and gets zero tolerance. B and C are generated from a
    // radius chosen as sqrt(5) x the old main island, so 5x the old island's 371,974 is the target.
    // ISLAND A IS CHECKED AGAINST ITS OWN BAKE, TILE BY TILE -- not against a count.
    //
    // A count is a weak assertion: two different islands can share one. And the number kept moving
    // for legitimate reasons (the bake was re-cut at the bridge's EAST end, which recovered 3,251
    // tiles of east shore that a cut at the west end had guillotined into a razor-straight vertical
    // coast) and for illegitimate ones (island B's field reaching back west over A's water). Only a
    // byte comparison tells those apart.
    //
    // The causeway is the one sanctioned difference: the generator stamps 'b' across the bridge
    // rows, so those tiles are excluded rather than counted as a mismatch.
    {
      const baked=wgRleRows(ISLE_A_RLE, ISLE_A_W, 720);
      const B=R.bridge, bhalf=(B.w/2)|0;
      let diff=0, first='';
      for(let y=0;y<720;y++){
        const wy=y+ISLE_A_DY, row=D.map[wy], src=baked[y];
        for(let x=0;x<ISLE_A_W;x++){
          if(wy>=B.cy-bhalf && wy<B.cy-bhalf+B.w && x>=B.x0 && x<=B.x1) continue;   // the causeway
          if(row[x]!==src[x]){ if(!diff) first=x+','+wy+' world "'+row[x]+'" vs baked "'+src[x]+'"'; diff++; }
        }
      }
      if(diff){ bad++; L.push('  BAD  island A differs from its bake in '+diff+' tiles (first at '+first+')'); }
      else L.push('  ok   island A is byte-identical to its bake  ['+ISLE_A_W+' cols x 720 rows]');
      L.push('       '+land[0]+' land tiles counted in the world (bake: 77575 + the causeway)');
    }
    cmp('island B land tiles', land[1], 371974*5, 0.12);
    cmp('island C land tiles', land[2], 371974*5, 0.12);
    note('  world '+W+'x'+H+' = '+(W*H)+' tiles, '+(land[0]+land[1]+land[2])+' of them land ('
         +(100*(land[0]+land[1]+land[2])/(W*H)).toFixed(1)+'%)');
    note('');

    // ---- THE WATER GAP, which is what the flight gate rests on ----
    // A proxy, and labelled as one: the real proof is the reachability fill in _selftest.js, which
    // walks the world rather than measuring one line across it. This number is here because it is
    // the thing to TUNE if that fill ever fails.
    note('== the flight gap ==');
    // ADJACENCY, NOT AN X-GAP. Two earlier versions of this measured a distance along a row and both
    // reported a 1-tile gap that flatly contradicted the reachability fill -- because "the last B
    // tile and the first C tile on this row" is not the same question as "can you walk from one to
    // the other". The island id is assigned by NEAREST CENTRE, so it flips at the perpendicular
    // bisector: a bay of C's land that reaches west of x=2064 sits one tile from a spur of B's that
    // reaches east of it, on a row where the two are nowhere near each other in the water.
    //
    // What actually breaks the gate is a land tile of island B sharing an EDGE with a land tile of
    // island C. That is a one-pass scan and it is unambiguous.
    let touch=0, touchAt='';
    for(let y=1;y<H-1;y++){
      const row=D.map[y], nxt=D.map[y+1];
      for(let x=1;x<W-1;x++){
        if(row[x]==='w') continue;
        const a=isleOfXY(x,y);
        if(a<1) continue;
        if(row[x+1]!=='w' && isleOfXY(x+1,y)>=1 && isleOfXY(x+1,y)!==a){ if(!touch) touchAt=x+','+y+' -> '+(x+1)+','+y; touch++; }
        if(nxt[x]!=='w'  && isleOfXY(x,y+1)>=1 && isleOfXY(x,y+1)!==a){ if(!touch) touchAt=x+','+y+' -> '+x+','+(y+1); touch++; }
      }
    }
    if(touch){ bad++; L.push('  BAD  '+touch+' places where island B land touches island C land (first at '+touchAt+')'); }
    else L.push('  ok   no land tile of island B shares an edge with a land tile of island C');
    // and the open water between them, measured the only way that means anything: the widest
    // uninterrupted run of water on the row through both island centres
    const midY=WG_ISLES[1].cy|0;
    let run=0, best=0;
    for(let x=WG_ISLES[1].cx|0; x<(WG_ISLES[2].cx|0); x++){
      if(D.map[midY][x]==='w'){ run++; if(run>best) best=run; } else run=0;
    }
    note('  widest open water between the island centres, on row y='+midY+': '+best+' tiles');
    if(best<FLY_GAP_MIN){ bad++; L.push('  BAD  that is under FLY_GAP_MIN ('+FLY_GAP_MIN+')'); }
    else L.push('  ok   clears FLY_GAP_MIN ('+FLY_GAP_MIN+'). The widest player displacement is');
    L.push('       dash(200) = 4.5 tiles, solid()-gated and los()-swept, and the flight water');
    L.push('       exemption is gated on _pmove, which a dash does not set.');
    L.push('       A GAP IS STILL ONLY A PROXY. The proof is the reachability fill in _selftest.js,');
    L.push('       which walks the world from the starter landing and asserts that island C');
    L.push('       contains zero reached cells.');
    note('');

    // ---- the ground mix, which is what the place looks like ----
    note('== ground mix ==');
    const keys=Object.keys(mix).sort((a,b)=>mix[b]-mix[a]);
    for(const k of keys) L.push('  '+pad("'"+k+"'",6)+pad(mix[k],11)+(100*mix[k]/(W*H)).toFixed(2)+'%');
    note('');

    // ---- spawns: the density that decides whether the world feels populated ----
    note('== spawns ==');
    const spawns=(mix['c']||0)+(mix['s']||0);
    const totLand=land[0]+land[1]+land[2];
    note('  '+spawns+' markers, '+(100*spawns/totLand).toFixed(2)+'% of land');
    // the artifact ran 1.68%, and density is what has to hold when the world grows, not the count
    cmp('spawn density (% of land)', +(100*spawns/totLand).toFixed(2), 1.68, 0.15, '%');
    note('');

    // ---- contiguity: every land tile east of the bridge must be walkable from the bridge ----
    // The generator drowns orphans, so this must come back at zero. It is asserted anyway, because
    // the fill and this check disagree the moment the fill's seed or its neighbour test changes.
    note('== contiguity ==');
    // Per island, from its own arrival point. What this checks is that an island is ONE walkable
    // mass -- not that the islands connect to each other, which for C they deliberately must not.
    const solidStr='WhlHwXD';
    for(const I of R.isles){
      const ax=I.arrX, ay=I.arrY;
      const seen=new Uint8Array(W*H), st=new Int32Array(W*H);
      let sp=0, reach=0;
      for(let rad=0;rad<40&&sp===0;rad++){
        for(let dy=-rad;dy<=rad;dy++) for(let dx=-rad;dx<=rad;dx++){
          if(Math.abs(dx)!==rad&&Math.abs(dy)!==rad) continue;
          const x=ax+dx, y=ay+dy;
          if(x<0||y<0||x>=W||y>=H) continue;
          const i=y*W+x;
          if(seen[i]||solidStr.indexOf(D.map[y][x])>=0) continue;
          seen[i]=1; st[sp++]=i; } }
      while(sp>0){ const i=st[--sp]; reach++;
        const x=i%W, y=(i-x)/W;
        if(x+1<W && !seen[i+1] && solidStr.indexOf(D.map[y][x+1])<0){ seen[i+1]=1; st[sp++]=i+1; }
        if(x-1>=0 && !seen[i-1] && solidStr.indexOf(D.map[y][x-1])<0){ seen[i-1]=1; st[sp++]=i-1; }
        if(y+1<H && !seen[i+W] && solidStr.indexOf(D.map[y+1][x])<0){ seen[i+W]=1; st[sp++]=i+W; }
        if(y-1>=0 && !seen[i-W] && solidStr.indexOf(D.map[y-1][x])<0){ seen[i-W]=1; st[sp++]=i-W; }
      }
      let own=0, got=0;
      for(let y=0;y<H;y++){ const row=D.map[y];
        for(let x=0;x<W;x++){ if(row[x]==='w') continue;
          if(isleOfXY(x,y)!==I.id) continue;
          own++; if(seen[y*W+x]) got++; } }
      const frac=own?got/own:0;
      if(frac<0.9){ bad++; L.push('  BAD  island '+I.id+' is '+(100*frac).toFixed(1)
        +'% reachable from its own arrival point ('+got+'/'+own+')'); }
      else L.push('  ok   island '+I.id+' is one walkable mass  ['+(100*frac).toFixed(1)+'%, '+got+'/'+own+']');
    }
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
