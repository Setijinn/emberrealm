// Four shots: the same lair approached from four sides, so the bubble should appear on four
// different edges. ?side=e|w|n|s puts the player on that side of the lair.
(function(){
  function go(){
    try{
      users['_st']={pass:'x',chars:[{name:'St',cls:'knight',inv:[],rpg:{lvl:22,wpn:5,arm:5,helm:5}}],cur:0,mats:{},vault:[]};
      curUser='_st'; play();
      if(typeof devTeleport==='function') devTeleport('G');
      const lairs=[]; for(const k in (curRoom.lairs||{})){ const l=curRoom.lairs[k]; if(l&&l.cx!=null) lairs.push(l); }
      lairs.sort((a,b)=>a.b-b.b);
      const T=lairs[0];
      const side=(new URLSearchParams(location.search).get('side'))||'w';
      const D=900;
      if(side==='w'){ player.x=T.cx-D; player.y=T.cy; }        // boss is EAST of us
      else if(side==='e'){ player.x=T.cx+D; player.y=T.cy; }   // boss is WEST
      else if(side==='n'){ player.x=T.cx; player.y=T.cy-D; }   // boss is SOUTH
      else { player.x=T.cx; player.y=T.cy+D; }                 // boss is NORTH
      if(typeof fogReveal==='function') for(let i=0;i<40;i++) fogReveal(curRoom,0.2);
      document.title='READY';
    }catch(e){ document.title='ERR '+e.message; }
  }
  if(document.readyState==='complete') setTimeout(go,2600);
  else window.addEventListener('load',()=>setTimeout(go,2600));
})();
