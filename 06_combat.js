// ---------- combat ----------
function los(x1,y1,x2,y2){
  const d=Math.hypot(x2-x1,y2-y1), steps=Math.ceil(d/14);
  for(let i=1;i<steps;i++){ const t=i/steps;
    if(solid(x1+(x2-x1)*t, y1+(y2-y1)*t)) return false; }
  return true;
}
function fire(dt){
  player.fireT-=dt;
  if(player.fireT>0) return;
  // auto-aim: PC favors the enemy nearest the CURSOR; touch favors the nearest to the player.
  // LOS is always from the player (you still can't shoot through walls).
  let ref={x:player.x,y:player.y};
  if(typeof inputMode!=='undefined' && inputMode==='pc' && typeof mouseWorld==='function') ref=mouseWorld();
  const wt=player.wt||WTYPE.sword;
  // auto-aim range cap: only engage targets the weapon can actually reach (+15% grace)
  const wRange=((wt.spd||520)*(player.projSpd||1))*(wt.life||1)*1.15;
  let ang=null, best=null, bd=1e9;
  for(const e of enemies){ const d=Math.hypot(e.x-ref.x,e.y-ref.y);
    if(d<bd && Math.hypot(e.x-player.x,e.y-player.y)<=wRange && los(player.x,player.y,e.x,e.y)){bd=d;best=e;} }
  if(best) ang=Math.atan2(best.y-player.y,best.x-player.x);
  if(ang===null) return;
  player.fireT=player.fireRate/(player.bRofT>0?(player.bRofM||1.5):1);
  player.aim=ang;
  player.atkT=0.2;                     // trigger the attack animation
  const de3=player.deadeye>0;
  const crit=Math.random()<(player.crit||0);          // LUCK -> crit chance
  let dm=player.dmg*(wt.dm||1)*(player.bDmgT>0?(player.bDmgM||1.5):1);
  if(crit) dm*=(player.critMult||1.5);
  let pr=(wt.pierce||0)+(player.pierce||0);
  if(de3){ dm*=3; pr=99; }
  const psp=(wt.spd||520)*(player.projSpd||1);          // DEX -> projectile speed
  const n=Math.min(7,(wt.shots||1)+((player.shots||1)-1));
  // projectile forge key: every (class, weapon type, tier, rarity) combo has its own look
  const _cls=(typeof curChar==='function'&&curChar())?curChar().cls:'x';
  const _rar=(typeof eqRar==='function')?(eqRar('wpn')||0):0;
  const pk='w:'+_cls+':'+((typeof CWEAP!=='undefined'&&CWEAP[_cls])||'sword')+':'+(rpg?rpg.wpn:0)+':'+_rar;
  const pcore=(_rar>0&&typeof RAR_COL!=='undefined')?RAR_COL[_rar]:undefined;
  for(let i=0;i<n;i++){
    let sx=player.x, sy=player.y, sa=ang;
    if(wt.par && n>1){ const off=(i-(n-1)/2)*wt.par;
      sx+=Math.cos(ang+Math.PI/2)*off; sy+=Math.sin(ang+Math.PI/2)*off; }
    else if(n>1){ sa=ang+(i-(n-1)/2)*(wt.spread||0.15); }
    pShots.push({x:sx,y:sy,px:sx,py:sy,
      vx:Math.cos(sa)*psp,vy:Math.sin(sa)*psp,
      r:wt.size||5,life:wt.life||1,dmg:dm,crit:crit,
      pierce:pr,lastHit:null,slow:player.slowShot,pk:pk,pcore:pcore});
  }
  if(de3) player.deadeye--;
  chargeRes('shot'); lastShotT=0;
}
function eFire(e,ang,spd=200){
  // per-family forged look: each boss by name, mobs by type + level bracket
  const pk='e:'+(e.name?('B_'+e.name):(e.type+'_'+Math.floor((e.lv||1)/12)));
  eShots.push({x:e.x,y:e.y,px:e.x,py:e.y,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,
    r:e.psize||6,life:3,bd:e.bd||8,col:e.pcol||null,core:e.pcore||null,shape:e.pshape||null,pk:pk});
}
function boom(x,y,col,n=10){
  for(let i=0;i<n;i++){ const a=Math.random()*6.28,s=40+Math.random()*120;
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.4,col}); }
}
// ---- richer particle emitters (same `particles` array; extra fields are all optional:
// maxlife for fade-norm, sz size, g gravity, drag, glow = additive pass, shrink) ----
const PART_CAP=420;
function emitP(x,y,o){ if(particles.length>=PART_CAP) return;
  const life=(o&&o.life)||0.6;
  particles.push({x,y,vx:(o&&o.vx)||0,vy:(o&&o.vy)||0,life,maxlife:life,
    col:(o&&o.col)||'#fff',sz:(o&&o.sz)||3,g:(o&&o.g)||0,drag:(o&&o.drag)||0,
    glow:!!(o&&o.glow),shrink:true}); }
// combat: glowing spark spray on hit
function fxHit(x,y,col){ for(let i=0;i<5;i++){ const a=Math.random()*6.28,s=60+Math.random()*130;
  emitP(x,y,{vx:Math.cos(a)*s,vy:Math.sin(a)*s-20,life:0.22+Math.random()*0.2,col,sz:2+Math.random()*2,g:180,glow:true}); } }
// combat: death shower scaled by radius — colored sparks + pale chips + smoke puffs
function fxDeath(x,y,col,r){ const n=Math.min(26,10+Math.round((r||14)*0.7));
  for(let i=0;i<n;i++){ const a=Math.random()*6.28,s=30+Math.random()*160;
    emitP(x,y,{vx:Math.cos(a)*s,vy:Math.sin(a)*s-30,life:0.35+Math.random()*0.45,
      col:Math.random()<0.7?col:'#f5e9d2',sz:2+Math.random()*3,g:150,drag:1.2,glow:Math.random()<0.5}); }
  for(let i=0;i<4;i++) emitP(x+(Math.random()*16-8),y+(Math.random()*10-5),
    {vx:Math.random()*24-12,vy:-24-Math.random()*26,life:0.8+Math.random()*0.5,
     col:'rgba(120,110,105,0.5)',sz:5+Math.random()*3,drag:1.5}); }
