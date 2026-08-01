// Stand in a camp. ?band=N picks the first camp whose theme band is N, so the themed structures can
// be compared against each other.
(function(){
  function go(){
    try{
      users['_st']={pass:'x',chars:[{name:'St',cls:'knight',inv:[],rpg:{lvl:40,wpn:8,arm:8,helm:8}}],cur:0,mats:{},vault:[]};
      curUser='_st'; play();
      if(typeof devTeleport==='function') devTeleport('G');
      const want=+((new URLSearchParams(location.search).get('band'))||3);
      const C=(curRoom.camps||[]);
      const cp=C.find(c=>c.band===want)||C[0];
      if(cp){ player.x=cp.cx; player.y=cp.cy+150; }
      if(typeof fogReveal==='function') for(let i=0;i<40;i++) fogReveal(curRoom,0.2);
      document.title='READY';
    }catch(e){ document.title='ERR '+e.message; }
  }
  if(document.readyState==='complete') setTimeout(go,3000);
  else window.addEventListener('load',()=>setTimeout(go,3000));
})();
