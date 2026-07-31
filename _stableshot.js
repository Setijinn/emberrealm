// The stable panel in its UNLOCKED state -- lessons bought, stalls full. The locked state was the
// only one ever photographed, and it is the one with the least in it.
(function(){
  function go(){
    try{
      users['_st']={pass:'x',chars:[{name:'St',cls:'knight',inv:[],rpg:{lvl:45,wpn:5,arm:5,helm:5}}],cur:0,mats:{},vault:[]};
      curUser='_st'; play();
      for(const id of ['loadCurtain','menuBtn','invBtn','abBtn','flasks','hudTop','boostStrip','mountBtn','flyBtn']){
        const el=document.getElementById(id); if(el) el.style.display='none'; }
      const cv=document.querySelector('canvas'); if(cv) cv.style.display='none';
      const u=mountStore();
      if(u){ u.mountLv=99; }
      const L=lessonStore(); if(L){ L.ride=1; L.fly=1; }
      users['_st'].glory=12000;
      // a spread of rarities, and one flyer, so every chip style is on screen at once
      const want=['sablewolf','duskstag','emberdrake','stormpeg','voidwyrm','dawnroc'];
      let n=0;
      for(const m of MOUNT_DB){ if(n>=7) break;
        if(want.indexOf(m.id)>=0 || n<7){ giveMount(m.id); n++; } }
      setActiveMount(mountsOwned()[0]?mountsOwned()[0].id:null);
      openStable();
      const s=document.getElementById('stableScr'); if(s) s.style.display='flex';
      document.body.style.background='#0b0910';
      document.title='STABLE READY';
    }catch(e){ document.title='ERR '+e.message; document.body.innerHTML='<pre style="color:#f88;font:14px monospace">'+e.stack+'</pre>'; }
  }
  if(document.readyState==='complete') setTimeout(go,2500);
  else window.addEventListener('load',()=>setTimeout(go,2500));
})();
