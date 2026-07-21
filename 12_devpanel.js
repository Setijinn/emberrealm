// ---------- dev panel ----------
const dev={god:false,dmg:1,spd:1,fps:false};
let fpsNow=0,fpsCount=0,fpsLast=performance.now();
function devPaint(){
 $s('dGod').textContent='God mode: '+(dev.god?'ON':'OFF'); $s('dGod').classList.toggle('on',dev.god);
 $s('dDmg').textContent='Damage \u00d7'+dev.dmg; $s('dDmg').classList.toggle('on',dev.dmg>1);
 $s('dSpd').textContent='Speed \u00d7'+dev.spd; $s('dSpd').classList.toggle('on',dev.spd>1);
 $s('dFps').textContent='FPS: '+(dev.fps?'ON':'OFF'); $s('dFps').classList.toggle('on',dev.fps);
}
function openDev(){ devPaint();
 const box=$s('devRooms'); box.innerHTML='';
 for(const k in rooms){ const b=document.createElement('button'); b.className='mbtn user';
  b.textContent=rooms[k].name+(rooms[k].cleared?' \u2713':'');
  b.onclick=()=>{ devTeleport(k); };
  box.appendChild(b); }
 inGame=false; show('devScr');
}
function devTeleport(k){
 hideAll(); $s('menuBtn').style.display='flex'; $s('potBtn').style.display='flex'; $s('invBtn').style.display='flex';
 if(isAdmin)$s('devBtn2').style.display='flex';
 inGame=true;
 let cx=(RW/2+.5)*TILE, cy=(RH/2+.5)*TILE;
 curRoom=rooms[k];
 for(let ring=0;ring<10&&solid(cx,cy);ring++){ cx+=TILE; }
 enterRoom(k,cx,cy);
}
function devSpawn(t){
 const defs={c:{type:'c',r:15,hp:40,maxhp:40,spd:95,touch:12,col:'#c04a3d'},
  s:{type:'s',r:16,hp:60,maxhp:60,spd:45,fireT:1,col:'#8a5ac0'},
  B:{type:'B',r:30,hp:600,maxhp:600,spd:35,fireT:1.5,ang:0,col:'#e07a2e',boss:true}};
 for(let tries=0;tries<60;tries++){
  const a=Math.random()*6.283, d=140+Math.random()*180;
  const x=player.x+Math.cos(a)*d, y=player.y+Math.sin(a)*d;
  if(x>TILE&&y>TILE&&x<(RW-1)*TILE&&y<(RH-1)*TILE&&!solid(x,y)){
   const e=Object.assign({x,y},defs[t]); enemies.push(e); curRoom.cleared=false; return; } }
}
$s('dGod').onclick=()=>{dev.god=!dev.god;devPaint();};
$s('dDmg').onclick=()=>{dev.dmg=dev.dmg>=100?1:dev.dmg*10;devPaint();};
$s('dSpd').onclick=()=>{dev.spd=dev.spd>=4?1:dev.spd*2;devPaint();};
$s('dFps').onclick=()=>{dev.fps=!dev.fps;devPaint();};
$s('dHeal').onclick=()=>{player.hp=player.maxhp;};
$s('dKill').onclick=()=>{for(const e of enemies)e.hp=0;};
$s('dClear').onclick=()=>{for(const k in rooms)for(const sp of rooms[k].spawns)sp.dead=Date.now()+3600000;enemies=[];openDev();};
$s('dReset').onclick=()=>{for(const k in rooms)for(const sp of rooms[k].spawns)sp.dead=0;openDev();};
$s('dSpawnC').onclick=()=>{devSpawn('c');};
$s('dSpawnS').onclick=()=>{devSpawn('s');};
$s('dSpawnB').onclick=()=>{devSpawn('B');};
$s('dWipe').onclick=()=>{ if(confirm('Delete ALL user accounts on this device?')){
 users={}; LS.set('er-users',users); LS.set('er-last',null); isAdmin=false; curUser=null;
 refreshUserList(); show('loginScr'); } };
$s('dResume').onclick=()=>{ if(!curRoom){play();return;}
 hideAll(); $s('menuBtn').style.display='flex';
 if(isAdmin)$s('devBtn2').style.display='flex'; inGame=true; };
$s('dBack').onclick=openMenu;
$s('devBtn2').addEventListener('click',openDev);
$s('devMenuBtn').addEventListener('click',()=>{ if(!curRoom){
  loadRPG(); recalcStats(); player.hp=player.maxhp; hudRPG();
 } openDev(); });
// boot
refreshUserList();
const lastU=LS.get('er-last',null);
if(lastU&&users[lastU]){curUser=lastU;openMenu();}else show('loginScr');
requestAnimationFrame(loop);
