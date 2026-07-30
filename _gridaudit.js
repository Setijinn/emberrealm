// GRID ALPHABET AUDIT — exactly which tile characters exist, across every room.
//
// Stage 6 packs the grid into a Uint8Array, so the first thing that has to be known for certain is
// how many distinct characters there are: the code field's width, and therefore how many bits are
// left for the island id, follows from it. Guessing it from a regex over the data files pulled in
// English prose and came back with 45 candidates; asking the BUILT rooms is the only honest count.
//
// It also reports which chars each room uses, because a character that appears in exactly one room is
// worth knowing about before you assume the table is universal.
//
// Run it with `py tools/audit.py _gridaudit.js`.
(function(){
  const L=[];
  const say=(s)=>L.push(s===undefined?'':s);
  const row=(k,v)=>L.push('  '+String(k).padEnd(34,' ')+' '+v);
  const hd=(s)=>{ L.push(''); L.push('--- '+s+' ---'); };
  function dump(){ const el=document.getElementById('testout');
    if(el) el.textContent=L.join('\n'); document.title='AUDIT DONE'; }

  function go(){
    try{
      const all={}, perRoom={}, sizes=[];
      for(const k in rooms){
        const R=rooms[k]; if(!R) continue;
        if(!R.cells) continue;
        const seen={};
        for(let y=0;y<R.h;y++)
          for(let x=0;x<R.w;x++){ const c=gAt(R,x,y);
            all[c]=(all[c]|0)+1; seen[c]=1; }
        perRoom[k]=Object.keys(seen).sort().join('');
        sizes.push({k:k, w:R.w|0, h:R.h|0, n:(R.w|0)*(R.h|0)});
      }
      const alpha=Object.keys(all).sort();
      hd('THE ALPHABET');
      row('distinct tile characters', alpha.length);
      row('as a string', JSON.stringify(alpha.join('')));
      row('fits in 5 bits (<=31)?', alpha.length<=31 ? 'yes' : 'NO — needs 6');
      row('fits in 6 bits (<=63)?', alpha.length<=63 ? 'yes' : 'NO — needs 7');
      say('');
      say('  char   count      rooms that use it');
      for(const c of alpha){
        const who=Object.keys(perRoom).filter(k=>perRoom[k].indexOf(c)>=0);
        say('   '+JSON.stringify(c).padEnd(6,' ')+String(all[c]).padStart(9,' ')+'   '
          +(who.length>6?(who.length+' rooms'):who.join(',')));
      }
      hd('ROOM SIZES');
      sizes.sort((a,b)=>b.n-a.n);
      let tot=0; for(const s of sizes) tot+=s.n;
      row('rooms with a grid', sizes.length);
      row('total tiles across all rooms', tot.toLocaleString());
      for(const s of sizes.slice(0,8)) row('  '+s.k, s.w+'x'+s.h+' = '+s.n.toLocaleString());
      // ---- THE FINGERPRINT, which is the whole point of running this BEFORE the conversion ----
      // FNV-1a over every tile of every room, in a fixed room order. Stage 6 repacks the grid into a
      // Uint8Array and touches ~48 read sites; the only honest way to know it changed nothing is to
      // hash the world before and after and compare. Pinned into _selftest.js so it keeps checking.
      hd('GRID FINGERPRINT (pin these, then re-run after the conversion)');
      const keys=Object.keys(rooms).filter(k=>rooms[k]&&rooms[k].cells).sort();
      const fnv=(s)=>{ let h=0x811c9dc5>>>0;
        for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,0x01000193)>>>0; }
        return ('00000000'+h.toString(16)).slice(-8); };
      let whole='';
      for(const k of keys){
        const R=rooms[k];
        // read through the ACCESSOR when one exists, so after the conversion this hashes the packed
        // grid by the same route the renderer will
        let s='';
        for(let y=0;y<R.h;y++){ let ln=''; for(let x=0;x<R.w;x++) ln+=gAt(R,x,y); s+=ln; }
        const h=fnv(s);
        whole+=k+':'+h+';';
        row(k+'  ('+R.w+'x'+R.h+')', h+'   '+s.length+' tiles');
      }
      row('WORLD', fnv(whole));
      row('read through', 'gAt() accessor');

      hd('WHAT IT COSTS');
      let bytes=0; for(const k of keys) bytes+=rooms[k].cells.byteLength;
      row('cells, total', bytes.toLocaleString()+' bytes  ('+(bytes/1048576).toFixed(2)+' MB)');
      // The old shape was H arrays of W single-character strings. V8 interns one-char strings, so each
      // SLOT is a pointer -- 8 bytes on a 64-bit build -- plus a JSArray header per row. That is the
      // number this replaces, and it is an estimate on purpose: the real figure is not observable from
      // script, and quoting a measured-looking number for it would be worse than saying so.
      const est=bytes*8 + 1194*96;
      row('the array-of-arrays it replaces', '~'+(est/1048576).toFixed(2)+' MB (estimated: 8B/slot + row headers)');
      row('ratio', '~'+(est/bytes).toFixed(1)+'x smaller');
      say('  At the three-island size (~8M tiles) that is ~8 MB against ~64 MB, which is the whole');
      say('  reason for this change: 64 MB of pointers before any tile data, on a phone.');
      if(typeof performance!=='undefined' && performance.memory)
        row('JS heap used right now', (performance.memory.usedJSHeapSize/1048576).toFixed(1)+' MB');

      hd('WHAT THIS MEANS FOR THE PACKING');
      say('  A Uint8 holds 8 bits. With a '+(alpha.length<=31?'5':'6')+'-bit code field there are '
        +(alpha.length<=31?3:2)+' bits left,');
      say('  which is enough for '+(alpha.length<=31?'eight':'four')+' island ids -- three are needed.');
      say('  Code 0 must stay RESERVED as INVALID so a missed write is detectable rather than silent.');
    }catch(e){ say('AUDIT THREW: '+(e&&e.message)); }
    dump();
  }
  if(document.readyState==='complete') setTimeout(go,900);
  else window.addEventListener('load',()=>setTimeout(go,900));
})();
