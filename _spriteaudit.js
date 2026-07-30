// SPRITE AUDIT — what does the game ask for that is not on disk?
//
// WHY IT HAS TO RUN IN THE GAME. Most art paths in this project are BUILT FROM A VARIABLE --
// `assets/items/mat_`+id, `assets/mobs/anim/arch_`+name+`/idle_`+d+`_`+f, one per relic, per tier, per
// weapon type, per band. A grep over the source finds 93 literal paths and 36 templates it cannot
// expand, so a static pass can only ever check the 93 that were never the risk. Asking the LIVE tables
// is the only way to enumerate the real set.
//
// AND A MISS IS EXPENSIVE HERE. The service worker is cache-first for art, so a path nothing ships is
// a 404 every session for the life of the install; HANDOFF's rule is that a new boss must either ship
// its art or carry a borrow entry, and this is the check that rule wants.
//
// It reports rather than gates: every layer in this game falls back (animated set -> static sprite ->
// hound/cultist -> procedural shape), so a missing file is a downgrade, not a crash. What matters is
// knowing WHICH downgrade you are looking at.
//
// Run it with `py tools/audit.py _spriteaudit.js`.
(function(){
  const L=[];
  const say=(s)=>L.push(s===undefined?'':s);
  const row=(k,v)=>L.push('  '+String(k).padEnd(40,' ')+' '+v);
  const hd=(s)=>{ L.push(''); L.push('--- '+s+' ---'); };
  function dump(){
    const el=document.getElementById('testout');
    if(el) el.textContent=L.join('\n');
    document.title='AUDIT DONE';
  }

  // HEAD, not GET, and one at a time behind a small concurrency cap: this can be a couple of thousand
  // probes and firing them all at once makes the dev server the bottleneck rather than the answer.
  function head(url){
    return new Promise(res=>{
      const x=new XMLHttpRequest();
      x.open('HEAD',url,true);
      x.onload=()=>res(x.status>=200&&x.status<300);
      x.onerror=()=>res(false);
      x.send();
    });
  }
  async function checkAll(list,limit){
    const missing=[]; let i=0;
    async function worker(){
      while(i<list.length){
        const n=i++; const e=list[n];
        if(!(await head(e.url))) missing.push(e);
      }
    }
    const w=[]; for(let k=0;k<(limit||12);k++) w.push(worker());
    await Promise.all(w);
    return missing;
  }

  async function run(){
    const want=[];   // {url, what}
    const add=(url,what)=>want.push({url:url,what:what});

    // ---- items: every material, every relic, every tier of every gear kind ----
    if(typeof MAT_KEYS!=='undefined') for(const k of MAT_KEYS){
      const d=MATERIALS[k];
      // a seed has no file of its own -- it shares mat_seed.png tinted by its dungeon's colour
      if(d && d.seed) continue;
      add('assets/items/mat_'+k+'.png','material '+k);
    }
    add('assets/items/mat_seed.png','the shared Riftseed sprite');
    if(typeof RELICS!=='undefined') for(const R of RELICS)
      add('assets/items/relic_'+R.id+'.png','relic '+R.id);
    if(typeof ART_TIERS!=='undefined'){
      if(typeof WTYPE!=='undefined') for(const w in WTYPE){
        if(WTYPE[w].legacy) continue;
        for(let t=0;t<ART_TIERS;t++) add('assets/items/wpn_'+w+'_'+t+'.png','weapon '+w+' T'+(t+1));
      }
      for(const m of ['plate','leather','robe']) for(let t=0;t<ART_TIERS;t++){
        add('assets/items/arm_'+m+'_'+t+'.png','armour '+m+' T'+(t+1));
        add('assets/items/helm_'+m+'_'+t+'.png','helm '+m+' T'+(t+1));
      }
      if(typeof RING_STATS!=='undefined') for(const s of RING_STATS)
        for(let t=0;t<ART_TIERS;t++) add('assets/items/ring_'+s+'_'+t+'.png','ring '+s+' T'+(t+1));
    }
    for(let c=0;c<3;c++) add('assets/items/coin_'+c+'.png','coin tier '+c);
    // THE TWO THAT USED TO BE DRAWN IN CODE, and the reason this audit reporting "0 missing" was true
    // and still not the whole answer: a procedural shape never asks for a path, so scrollSpr() and
    // foodSpr() were invisible to a check built on "what does the game request". They have files now,
    // and they are listed here so they cannot quietly go back to being invisible.
    add('assets/items/item_scroll.png','the stat-scroll sprite (tinted per stat)');
    for(let f=0;f<5;f++) add('assets/items/food_'+f+'.png','pet food tier '+f);

    // ---- creatures: one static sprite and one animated set per archetype ----
    // TWO ARCHETYPES BORROW ON PURPOSE and must not be reported as gaps: `beast` and `caster` are the
    // FALLBACKS (`e.arch = MOB_ARCH[spn] || (type==='s' ? 'caster' : 'beast')`), and _mobArchImg maps
    // them straight onto the hound and the cultist -- which have their own animated sets. That is the
    // documented chain working, not a hole. Asking MOB_ARCH for its values alone would have listed
    // both of them as missing art, which is how this audit lied on its first run.
    const BORROWED={beast:1, caster:1};
    // The frame naming is `idle_N.png` / `attack_N.png` -- NOT `idle_s_0`. Guessed wrong first time
    // and got 24 confident false positives, so it is written here the way the loader writes it.
    if(typeof MOB_ARCH!=='undefined'){
      const arch={}; for(const k in MOB_ARCH) arch[MOB_ARCH[k]]=1;
      for(const a in arch){
        if(BORROWED[a]) continue;
        add('assets/mobs/arch_'+a+'.png','archetype '+a+' static sprite');
        add('assets/mobs/anim/arch_'+a+'/idle_0.png','archetype '+a+' idle frames');
        add('assets/mobs/anim/arch_'+a+'/attack_0.png','archetype '+a+' attack frames');
      }
    }
    for(const k of ['wolf','skel','wisp'])
      add('assets/mobs/anim/ally_'+k+'/idle_0.png','ally '+k+' idle frames');
    // ---- bosses: sprite, den, and the awakened form ----
    if(typeof GBOSS!=='undefined') for(let r=0;r<GBOSS.length;r++){
      const slot=(typeof bossArt==='function')?bossArt(r):r;
      add('assets/mobs/boss_'+slot+'.png','boss '+r+' sprite (slot '+slot+')');
      add('assets/env/lair_'+slot+'.png','boss '+r+' den art (slot '+slot+')');
    }
    // ---- pets and mounts ----
    if(typeof PETS!=='undefined') for(const p of PETS)
      if(p&&p.spr) add('assets/pets/'+p.spr+'.png','pet '+p.spr);
    if(typeof MOUNT_ARCH!=='undefined') for(const a in MOUNT_ARCH)
      add('assets/mounts/arch_'+a+'.png','mount archetype '+a);

    hd('WHAT THE GAME ASKS FOR');
    row('distinct art paths enumerated', want.length);
    const missing=await checkAll(want,12);

    hd('WHAT IS NOT ON DISK');
    row('missing', missing.length);
    if(!missing.length) say('  Nothing. Every enumerated path resolves.');
    else {
      // group, because "48 relics have no art" is one fact and forty-eight lines is noise
      const by={};
      for(const m of missing){ const k=m.what.replace(/[\d_].*$/,'').trim()||m.what;
        (by[k]=by[k]||[]).push(m); }
      for(const k of Object.keys(by).sort()){
        const g=by[k];
        row(k, g.length+' missing');
        for(const m of g.slice(0,6)) say('      '+m.url);
        if(g.length>6) say('      … and '+(g.length-6)+' more');
      }
    }
    say('');
    say('  Every one of these has a fallback -- animated set -> static sprite -> hound/cultist ->');
    say('  procedural shape -- so a miss is a DOWNGRADE, not a crash. It is still a 404 every');
    say('  session against a cache-first service worker.');
  }

  function boot(){ run().catch(e=>{ say('AUDIT THREW: '+(e&&e.message));
    say(e&&e.stack?String(e.stack).split('\n').slice(0,4).join('\n'):''); }).then(dump); }
  if(document.readyState==='complete') setTimeout(boot,900);
  else window.addEventListener('load',()=>setTimeout(boot,900));
})();
