// Stand in the overworld near a lair so the compass and the objective tracker both have targets,
// and put one lair on its respawn lockout so the "back in mm:ss" state is on screen too.
(function(){
  function go(){
    try{
      users['_st']={pass:'x',chars:[{name:'St',cls:'knight',inv:[],rpg:{lvl:22,wpn:5,arm:5,helm:5}}],cur:0,mats:{},vault:[]};
      curUser='_st'; play();
      if(typeof devTeleport==='function') devTeleport('G');
      // walk to a spot between two lairs so two markers qualify
      const R=curRoom, L=[];
      for(const k in (R.lairs||{})){ const l=R.lairs[k]; if(l&&l.cx!=null) L.push(l); }
      L.sort((a,b)=>a.b-b.b);
      if(L.length>=2){
        // a point just outside the nearest lair, offset so neither boss is on screen
        player.x=L[0].cx+520; player.y=L[0].cy+430;
      }
      if(typeof fogReveal==='function') for(let i=0;i<40;i++) fogReveal(curRoom,0.2);
      // one of them freshly killed, so the tracker shows a live objective and a locked one
      if(L.length>=2 && typeof ringBossCd!=='undefined') ringBossCd[L[1].b]=1543;
      document.title='BOSS READY';
    }catch(e){ document.title='ERR '+e.message; document.body.innerHTML='<pre style="color:#f88">'+e.stack+'</pre>'; }
  }
  if(document.readyState==='complete') setTimeout(go,2600);
  else window.addEventListener('load',()=>setTimeout(go,2600));
})();
