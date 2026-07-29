// TERRAIN VARIATION AUDIT. What the ground actually does across a province, in numbers.
//
// WHY. "Vary the colour a bit more" and "make some areas noticeable" are both claims about a
// DISTRIBUTION, and a screenshot samples one point of it. A low-frequency field can be perfectly
// correct and still invisible in every screenshot you happen to take, which is exactly what the
// first attempt at this looked like. This walks tens of thousands of real world tiles and reports
// coverage and amplitude, so the dials get set against a measurement.
//
// Read-only. Run with `py tools/audit.py _terraudit.js`.
(function(){
  const L=[];
  const say=(s)=>L.push(s===undefined?'':s);
  const row=(k,v)=>L.push('  '+String(k).padEnd(40,' ')+' '+v);
  const hd=(s)=>{ L.push(''); L.push('--- '+s+' ---'); };
  function dump(){ const el=document.getElementById('testout');
    if(el) el.textContent=L.join('\n'); document.title='AUDIT DONE'; }

  function run(){
    users['_t']={pass:'x',chars:[{name:'T',cls:'knight',inv:[],rpg:{lvl:50}}],cur:0,mats:{},vault:[]};
    curUser='_t'; play(); devTeleport('G');
    const R=curRoom, RG=R&&R.rings;
    if(!RG){ say('no overworld'); return; }
    const T=_territories(R);
    say('===== TERRAIN VARIATION AUDIT =====');
    row('territories', T.length);
    row('room size (tiles)', R.w+' x '+R.h);
    const SCREEN=Math.round(1280/TILE);
    row('tiles across one screen', SCREEN);

    // ---- 1. BLOOM COVERAGE, per province, over its real footprint -------------------------------
    hd('BLOOM FIELDS — what fraction of a province is in flower');
    say('  A patch you can navigate by wants to be a MINORITY of the ground. All of it is');
    say('  wallpaper; none of it is what we had. Target is roughly 10-25% of tiles blooming,');
    say('  gathered into patches rather than spread evenly.');
    for(let zi=0;zi<T.length;zi++){
      const t=T[zi];
      let n=0, inPatch=0, bloomTiles=0, patchDens=0;
      // sample the province's own bounding area, keeping only tiles that really belong to it
      const r=48;
      for(let dy=-r;dy<=r;dy+=2) for(let dx=-r;dx<=r;dx+=2){
        const x=Math.round(t.cx+dx), y=Math.round(t.cy+dy);
        if(x<1||y<1||x>=R.w-1||y>=R.h-1) continue;
        if(zoneAt(x,y)!==zi) continue;
        n++;
        const fld=vnoise(x+877,y+149,17.0)*0.70+vnoise(x+311,y+643,6.5)*0.30;
        if(fld>0.635){ inPatch++;
          const dens=Math.min(1,(fld-0.635)*9); patchDens+=dens;
          const gh=hmix(x*3+7,y*5+11)>>>0;
          if((gh>>>4)%100 < 22+dens*74) bloomTiles++; }
      }
      if(!n) continue;
      row('z'+zi+' '+String(t.name).slice(0,20), 'band '+t.band+'   in a patch '+(100*inPatch/n).toFixed(0)
        +'%   actually blooming '+(100*bloomTiles/n).toFixed(0)+'%   mean density '
        +(inPatch?(patchDens/inPatch).toFixed(2):'0'));
    }

    // ---- 2. SHADE DRIFT: how far apart are two points in the SAME province ----------------------
    hd('SHADE DRIFT — how much a province varies within itself');
    say('  Reported as the tint alpha each drift field applies. If the max is small, or if the');
    say('  field barely changes across one screen, the province reads as one flat colour however');
    say('  many shades the table lists.');
    for(let zi=0;zi<T.length;zi++){
      const t=T[zi];
      let wMax=0,kMax=0,n=0, wMin=1,kMin=1;
      let scrDelta=0, scrN=0;
      const r=48;
      for(let dy=-r;dy<=r;dy+=2) for(let dx=-r;dx<=r;dx+=2){
        const x=Math.round(t.cx+dx), y=Math.round(t.cy+dy);
        if(x<1||y<1||x>=R.w-1||y>=R.h-1) continue;
        if(zoneAt(x,y)!==zi) continue;
        n++;
        const w=vnoise(x+401,y+37,19.0)*0.68+vnoise(x+59,y+503,8.0)*0.32;
        const dd=(w-0.5)*2;
        const wa=dd>0?dd*0.42:0, ka=dd<0?(-dd)*0.42:0;
        if(wa>wMax)wMax=wa; if(ka>kMax)kMax=ka;
        if(wa<wMin)wMin=wa; if(ka<kMin)kMin=ka;
        // how much does the warm field move across ONE SCREEN width?
        const w2=vnoise(x+SCREEN+401,y+37,19.0)*0.68+vnoise(x+SCREEN+59,y+503,8.0)*0.32;
        scrDelta+=Math.abs(w2-w); scrN++;
      }
      if(!n) continue;
      row('z'+zi+' band '+t.band, 'warm '+wMin.toFixed(3)+'-'+wMax.toFixed(3)
        +'   cool '+kMin.toFixed(3)+'-'+kMax.toFixed(3)
        +'   change per screen '+(scrN?(scrDelta/scrN).toFixed(3):'0'));
    }

    // ---- 3. THE BAND WARP: how far the painted seam moves off the true one ----------------------
    hd('BAND WARP — how ragged the province seam is now');
    let moved=0, tot=0, maxOff=0;
    for(let y=2;y<R.h-2;y+=3) for(let x=2;x<R.w-2;x+=3){
      const trueB=grvBandAt(x,y), paintB=grvBandXY(x,y);
      tot++; if(trueB!==paintB) moved++;
    }
    row('tiles painted as a NEIGHBOUR band', (100*moved/tot).toFixed(1)+'%  of '+tot+' sampled');
    say('  This is the interlock. It should be a few percent -- every one of those tiles is a');
    say('  finger of one province reaching into the next. Zero means the seam is still a clean');
    say('  Voronoi edge; a large number means the warp is eating whole provinces.');
    say('  Gameplay is unaffected by construction: grvBandAt is what spawns/levels/minimap read.');
  }

  function boot(){ try{ run(); }catch(e){ say('THREW: '+(e&&e.message)); say((e&&e.stack)||''); } dump(); }
  if(document.readyState==='complete') setTimeout(boot,900);
  else window.addEventListener('load',()=>setTimeout(boot,900));
})();
