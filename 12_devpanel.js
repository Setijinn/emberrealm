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
// Spawn via makeEnemy so the enemy scales to the current zone level (not a flat stat block).
function devSpawn(t){
 if(!curRoom||!player){return;}
 const W=(curRoom.w||RW), H=(curRoom.h||RH);
 for(let tries=0;tries<80;tries++){
  const a=Math.random()*6.283, d=140+Math.random()*200;
  const x=player.x+Math.cos(a)*d, y=player.y+Math.sin(a)*d;
  if(x>TILE&&y>TILE&&x<(W-1)*TILE&&y<(H-1)*TILE&&!solid(x,y)){
   const sp={x:x/TILE-0.5,y:y/TILE-0.5,t:t};
   const e=(typeof makeEnemy==='function')?makeEnemy(sp):null;
   if(e){ enemies.push(e); curRoom.cleared=false; } return; } }
}
// ---- character cheats ----
function devMax(){ if(!rpg){loadRPG();} if(!rpg){return;}
 rpg.lvl=150; rpg.xp=0;
 rpg.wpn=MAXT-1; rpg.arm=MAXT-1; rpg.helm=MAXT-1;
 rpg.ring={t:MAXT-1,st:RING_STATS[0]};   // armor material is class-derived (CARMOR) in recalcStats
 // mythical rarity + full affixes on every equipped slot
 rpg.eqAff=rpg.eqAff||{};
 rpg.eqAff.wpn=devAff(MAXT-1,5); rpg.eqAff.arm=devAff(MAXT-1,5);
 rpg.eqAff.helm=devAff(MAXT-1,5); rpg.eqAff.ring=devAff(MAXT-1,5);
 rpg.gold=(rpg.gold||0)+1000000; rpg.pots=99;
 if(typeof grantPerkPoints==='function') grantPerkPoints(rpg);
 rpg.perkPts=(rpg.perkPts||0)+75;
 recalcStats(); player.hp=player.maxhp; player.mp=player.maxmp;
 saveRPG(); hudRPG(); devToast('Character maxed');
}
// build an {a:affixArray,r:rarity} eqAff entry at a tier+rarity
function devAff(t,rar){ const keys=Object.keys(AFFIX_PREFIX),used={},a=[];
 for(let i=0;i<rar;i++){ let k,g=0; do{k=keys[Math.floor(Math.random()*keys.length)];}while(used[k]&&g++<12); used[k]=1;
  a.push({s:k,v:affixValue(k,t,rar)}); }
 return {a:a,r:rar}; }
// spawn a fresh item of a kind at the current dev tier+rarity into the satchel
let devItemTier=MAXT-1, devItemRar=5;
const RAR_LBL=['Common','Uncommon','Rare','Epic','Legendary','Mythical'];
function devMkItem(kind){ const t=devItemTier, rar=devItemRar; let it;
 const ch=curChar(); if(!ch){return;}
 const cls=ch.cls;
 // spawn class-appropriate gear so it's actually equippable (canEquip matches CWEAP/CARMOR)
 if(kind==='wpn') it={k:'wpn',wt:CWEAP[cls]||'sword',t:t};
 else if(kind==='arm') it={k:'arm',mt:CARMOR[cls]||'plate',t:t};
 else if(kind==='helm') it={k:'helm',mt:CARMOR[cls]||'plate',t:t};
 else it={k:'ring',st:RING_STATS[Math.floor(Math.random()*RING_STATS.length)],t:t};
 it.rar=rar; const aff=devAff(t,rar); it.aff=aff.a;
 if(!ch.inv)ch.inv=[];
 if(ch.inv.length>=20){ devToast('Satchel full (20)'); return; }
 ch.inv.push(it); saveRPG();
 devToast('+ T'+(t+1)+' '+RAR_LBL[rar]+' '+kind);
}
function devToast(t){ if(typeof msg==='function'){ msg('DEV',t); } }
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
$s('dSpawnN').onclick=()=>{devSpawn('N');};
// character cheats
$s('dMax').onclick=()=>{devMax();};
$s('dLvl').onclick=()=>{ if(!rpg)return; rpg.lvl=Math.min(150,rpg.lvl+10); rpg.xp=0;
 if(typeof grantPerkPoints==='function')grantPerkPoints(rpg);
 recalcStats(); player.hp=player.maxhp; player.mp=player.maxmp; saveRPG(); hudRPG(); devToast('Lv '+rpg.lvl); };
$s('dGold').onclick=()=>{ if(!rpg)return; rpg.gold+=100000; saveRPG(); hudRPG(); devToast('+100k gold'); };
$s('dPots').onclick=()=>{ if(!rpg)return; rpg.pots=Math.min(99,(rpg.pots||0)+25); saveRPG(); hudRPG(); devToast('+25 potions'); };
$s('dPerk').onclick=()=>{ if(!rpg)return; rpg.perkPts=(rpg.perkPts||0)+20; saveRPG(); devToast('+20 perk pts'); };
$s('dRefill').onclick=()=>{ if(!player)return; player.hp=player.maxhp; player.mp=player.maxmp; devToast('HP/MP refilled'); };
// item spawner
$s('dItemTier').onclick=()=>{ devItemTier=(devItemTier+1)%MAXT; $s('dItemTier').textContent='Tier '+(devItemTier+1); };
$s('dItemRar').onclick=()=>{ devItemRar=(devItemRar+1)%6; $s('dItemRar').textContent='Rarity: '+RAR_LBL[devItemRar]; };
$s('dItemW').onclick=()=>{devMkItem('wpn');};
$s('dItemA').onclick=()=>{devMkItem('arm');};
$s('dItemH').onclick=()=>{devMkItem('helm');};
$s('dItemR').onclick=()=>{devMkItem('ring');};
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
