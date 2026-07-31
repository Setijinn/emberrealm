// Drop the hero at the Hearth's paddock and photograph it. The stable is a room-def interactable,
// so nothing in _shot.js's scene list reaches it -- and the whole point is to see it IN the world.
(function(){
  function go(){
    try{
      users['_st']={pass:'x',chars:[{name:'St',cls:'knight',inv:[],rpg:{lvl:30,wpn:5,arm:5,helm:5}}],cur:0,mats:{},vault:[]};
      curUser='_st'; play();
      for(const id of ['loadCurtain','menuBtn','invBtn','abBtn','flasks','hudTop','boostStrip','mountBtn','flyBtn']){
        const el=document.getElementById(id); if(el) el.style.display='none'; }
      const st=curRoom&&curRoom.stable;
      if(st){ player.x=st.x; player.y=st.y+70; }
      document.title='STABLE READY';
    }catch(e){ document.title='ERR '+e.message; }
  }
  if(document.readyState==='complete') setTimeout(go,2200);
  else window.addEventListener('load',()=>setTimeout(go,2200));
})();
