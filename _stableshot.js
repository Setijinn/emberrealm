// The combat banner where it now lives. msg() hides itself after MSG_HOLD and the screenshot rig
// runs on virtual time, which fast-forwards that hold to nothing -- so this writes the same markup
// msg() would and adds .show, with no timer to take it away again.
(function(){
  function go(){
    try{
      users['_st']={pass:'x',chars:[{name:'St',cls:'knight',inv:[],rpg:{lvl:45,wpn:5,arm:5,helm:5}}],cur:0,mats:{},vault:[]};
      curUser='_st'; play();
      const Q=new URLSearchParams(location.search);
      const m=document.getElementById('msg');
      if(Q.get('quiet')==='1'){
        m.innerHTML='The Sunken Warren<small>a patient colossus that erupts in rings of thorns</small>';
        m.className='quiet show';
      } else {
        m.innerHTML='STRIKE NOW<small>it plants itself \u2014 the roots are open</small>';
        m.className='show';
      }
      setInterval(()=>{ m.classList.add('show'); },16);   // survive any pump that tries to clear it
      document.title='MSG READY';
    }catch(e){ document.title='ERR '+e.message; }
  }
  if(document.readyState==='complete') setTimeout(go,2600);
  else window.addEventListener('load',()=>setTimeout(go,2600));
})();
