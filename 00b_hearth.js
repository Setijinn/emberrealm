// ============================================================
//  THE HEARTH — social hub + sub-rooms (built procedurally so
//  we can size them freely for an open, many-player server).
//  Adds rooms to ROOM_DEFS before worldbuild reads it.
// ============================================================
(function(){
 function room(w,h,floor){ const g=[];
  for(let y=0;y<h;y++){ let r='';
   for(let x=0;x<w;x++) r+=(x===0||y===0||x===w-1||y===h-1)?'W':floor; g.push(r); }
  return g; }
 function put(g,x,y,ch){ if(y<0||y>=g.length||x<0||x>=g[0].length) return; g[y]=g[y].slice(0,x)+ch+g[y].slice(x+1); }
 function block(g,x0,y0,x1,y1,ch){ for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++) put(g,x,y,ch); }
 function border(g,x0,y0,x1,y1,ch){ for(let x=x0;x<=x1;x++){put(g,x,y0,ch);put(g,x,y1,ch);}
  for(let y=y0;y<=y1;y++){put(g,x0,y,ch);put(g,x1,y,ch);} }

 // ------------------------------------------------------------- THE HEARTH (hub)
 const HW=52, HH=30;
 const hub=room(HW,HH,'f');
 // central fountain — a solid water pool with a stone rim
 block(hub,23,12,28,17,'w');
 border(hub,22,11,29,18,'h');           // stone rim (solid)
 // corner braziers (glow) + wall lamps
 [[7,6],[44,6],[7,23],[44,23]].forEach(p=>put(hub,p[0],p[1],'H'));
 [[16,4],[35,4],[16,25],[35,25]].forEach(p=>put(hub,p[0],p[1],'l'));
 // planter clusters for a lived-in look
 [[10,14],[41,14]].forEach(p=>{ put(hub,p[0],p[1],'h'); put(hub,p[0],p[1]+1,'h'); });
 put(hub,26,25,'P');                     // spawn near the bottom, facing the fountain & realm portal
 ROOM_DEFS['0,0']={ name:'The Hearth', town:true, hub:true, map:hub,
  portalDefs:[
   {tx:26, ty:4,  to:'G',         label:'THE REALM',  col:'#ff9c50', big:true},
   {tx:8,  ty:9,  to:'COSMETICS', label:'COSMETICS',  col:'#e07ad4'},
   {tx:43, ty:9,  to:'VAULT',     label:'VAULT',      col:'#e8b34b'},
   {tx:8,  ty:21, to:'GUILD',     label:'GUILD HALL', col:'#7ab8d4'},
   {tx:43, ty:21, to:'ARENA',     label:'ARENA',      col:'#e2604c'},
  ],
  decor:[{t:'fountain',x:25.5,y:14.5}],
  stalls:[ {id:'bram', x:19,y:26.5}, {id:'sella',x:23.5,y:26.5}, {id:'maren',x:28,y:26.5}, {id:'odo',x:32.5,y:26.5} ],
 };

 // ------------------------------------------------------------- ARENA
 const AW=42, AH=30;
 const arena=room(AW,AH,'f');
 // four cover pillars
 [[12,10],[29,10],[12,19],[29,19]].forEach(p=>block(arena,p[0],p[1],p[0]+1,p[1]+1,'W'));
 put(arena,20,26,'P');
 ROOM_DEFS['ARENA']={ name:'The Proving Grounds', arena:true, lv:1, map:arena,
  portalDefs:[ {tx:20, ty:28, to:'0,0', label:'LEAVE', col:'#7dc47a'} ],
  decor:[{t:'sign',x:20,y:23,txt:'SURVIVE THE WAVES'}] };

 // ------------------------------------------------------------- VAULT
 const vault=room(28,18,'f');
 block(vault,11,6,16,9,'h');             // vault strongbox block
 put(vault,14,14,'P');
 ROOM_DEFS['VAULT']={ name:'The Vault', town:false, safe:true, map:vault,
  portalDefs:[ {tx:14, ty:16, to:'0,0', label:'LEAVE', col:'#7dc47a'} ],
  decor:[{t:'sign',x:14,y:11,txt:'STASH — coming soon'},{t:'chest',x:12.5,y:8},{t:'chest',x:15.5,y:8}] };

 // ------------------------------------------------------------- GUILD HALL
 const guild=room(32,20,'f');
 block(guild,13,6,18,7,'h');             // long table
 [[8,5],[23,5]].forEach(p=>put(guild,p[0],p[1],'H'));
 put(guild,16,16,'P');
 ROOM_DEFS['GUILD']={ name:'Guild Hall', town:false, safe:true, map:guild,
  portalDefs:[ {tx:16, ty:18, to:'0,0', label:'LEAVE', col:'#7dc47a'} ],
  decor:[{t:'sign',x:16,y:12,txt:'GUILDS — coming soon'},{t:'banner',x:16,y:3}] };

 // ------------------------------------------------------------- COSMETICS
 const cos=room(28,18,'f');
 [[10,6],[14,6],[18,6]].forEach(p=>put(cos,p[0],p[1],'l')); // display pedestals
 put(cos,14,14,'P');
 ROOM_DEFS['COSMETICS']={ name:'The Wardrobe', town:false, safe:true, map:cos,
  portalDefs:[ {tx:14, ty:16, to:'0,0', label:'LEAVE', col:'#7dc47a'} ],
  decor:[{t:'sign',x:14,y:11,txt:'COSMETICS — coming soon'}] };
})();
