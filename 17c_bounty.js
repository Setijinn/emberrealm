// ---------- THE BOUNTY BOARD ----------
// Odo keeps the board. Three objectives a day, the same three for everybody, drawn from the
// calendar date through the same seeded PRNG the auction house uses -- so like the auction it
// needs no storage, no sync and no server to agree with the next player.
//
// WHAT A BOUNTY PAYS, AND WHY IT DOES NOT PAY IT NOW.
// Glory is minted by dying, never during a run: nothing mid-run may create spendable glory, or a
// farm loop could bankroll the auction from inside a single life. A claimed bounty therefore does
// not hand you glory at the board -- it is BANKED ONTO THE RUN and pays out with everything else
// the run earned, on the death that ends it. The board says so plainly.
//
// Progress is per ACCOUNT and per DAY, so it survives the hero who made it, and it is collected by
// the same runNote() calls that already score a run -- one hook, no new counters.

const BOUNTY_SLOTS=3, BOUNTY_HOURS=24;
function bountyPeriod(){ return Math.floor(Date.now()/(BOUNTY_HOURS*3600*1000)); }
function bountyRefreshIn(){ const per=BOUNTY_HOURS*3600*1000; return Math.max(0,per-(Date.now()%per)); }

// The objectives a day can ask for. Each is a counter runNote() already increments, so nothing
// here has to be tracked separately. `steps` are the sizes a bounty of that kind can be drawn at,
// paired with what it banks -- the rarer the act, the better it pays per unit.
const BOUNTY_KINDS=[
  {k:'mobs',     name:'Cull the realm',   verb:'Fell {n} creatures',      steps:[[30,70],[55,120],[90,190]]},
  {k:'elites',   name:'Break the strong', verb:'Fell {n} elites',         steps:[[4,80],[8,150],[14,250]]},
  {k:'bosses',   name:'Answer a warden',  verb:'Fell {n} world bosses',   steps:[[1,110],[2,210],[3,300]]},
  {k:'dungeons', name:'Walk a dream',     verb:'Clear {n} dungeon',       steps:[[1,240],[2,460]]},
  {k:'relics',   name:'Take what is kept',verb:'Take {n} relic',          steps:[[1,300]]},
];
// Today's three. Distinct kinds, so the board never asks for the same thing twice in a day -- and
// the FIRST slot is always drawn from the everyday acts (kills), because a purely random draw can
// hand out a day of "clear a dungeon / fell 3 world bosses / take a relic", which is a board a
// short session cannot touch at all. One reliable objective, then two drawn freely.
const BOUNTY_EVERYDAY=['mobs','elites'];
function bountyToday(){
  const seed=bountyPeriod();
  const rnd=(typeof _aucRng==='function')?_aucRng((seed*2246822519)>>>0):Math.random;
  const pool=BOUNTY_KINDS.slice(), out=[];
  const easy=pool.filter(k=>BOUNTY_EVERYDAY.indexOf(k.k)>=0);
  function take(kind){
    pool.splice(pool.indexOf(kind),1);
    const st=kind.steps[(rnd()*kind.steps.length)|0];
    out.push({ id:'b'+seed+'_'+kind.k, k:kind.k, name:kind.name,
      need:st[0], pay:st[1], text:kind.verb.replace('{n}',st[0]) });
  }
  if(easy.length) take(easy[(rnd()*easy.length)|0]);
  while(out.length<BOUNTY_SLOTS && pool.length) take(pool[(rnd()*pool.length)|0]);
  return out;
}
// Period-keyed and self-clearing: a new day simply does not match, so yesterday's progress and
// claims are dropped without any cleanup code. Same trick as auctionTaken().
function bountyState(){ const u=users[curUser]; if(!u) return null;
  if(!u.bnt || u.bnt.p!==bountyPeriod()) u.bnt={p:bountyPeriod(),prog:{},done:{}};
  return u.bnt; }
function bountyProgress(b){ const s=bountyState(); if(!s) return 0;
  return Math.min(b.need, s.prog[b.k]||0); }
function bountyDone(b){ const s=bountyState(); return !!(s&&s.done[b.id]); }
function bountyReady(b){ return !bountyDone(b) && bountyProgress(b)>=b.need; }
// Called from runNote(), which every kill/clear/relic already goes through.
function bountyNote(k,n){ const s=bountyState(); if(!s) return;
  s.prog[k]=(s.prog[k]||0)+(n===undefined?1:n);
  if(typeof LS!=='undefined') LS.set('er-users',users); }
// Claim: stamp it for the day and bank it onto the run. `runNote('bounty', pay)` puts it in the
// same stats object the death screen scores, so it shows up as its own line there.
function bountyClaim(b){
  const s=bountyState(); if(!s||!b) return false;
  if(bountyDone(b)) return false;
  if(bountyProgress(b)<b.need){ msg('NOT YET',b.text); return false; }
  if(typeof runStats!=='function' || !runStats()){ msg('NO HERO','a bounty banks onto a run'); return false; }
  s.done[b.id]=1;
  runNote('bounty',b.pay);
  LS.set('er-users',users); if(typeof saveRPG==='function') saveRPG();
  msg('BOUNTY CLAIMED','+'+b.pay+' glory banked onto this run');
  return true;
}
function bountyClaimable(){ return bountyToday().filter(bountyReady).length; }

// ---------- panel ----------
function openBounties(){ const s=$s('bntScr'); if(!s) return; s.style.display='flex'; paintBounties(); }
function closeBounties(){ const s=$s('bntScr'); if(s) s.style.display='none'; }
function paintBounties(){
  const u=users[curUser]; if(!u) return;
  const st=runStats&&runStats();
  $s('bntBanked').innerHTML='<span class="purse">✦ '+((st&&st.bounty)||0)+' banked on this run</span>';
  $s('bntNote').textContent='the board is rewritten in '+((typeof _aucClock==='function')?_aucClock(bountyRefreshIn()):'a day');
  const box=$s('bntRows'); box.innerHTML='';
  for(const b of bountyToday()){
    const have=bountyProgress(b), done=bountyDone(b), ready=bountyReady(b);
    const card=document.createElement('div');
    card.className='shopcard bounty'+(done?' broke':(ready?' ready':''));
    const ico=document.createElement('div'); ico.className='shopico emoji';
    ico.textContent=done?'✓':(ready?'✦':'⚔');
    card.appendChild(ico);
    const txt=document.createElement('div'); txt.className='shoptext';
    const pct=Math.round(have/b.need*100);
    txt.innerHTML='<div class="shopname">'+b.text+'</div>'
      +'<div class="shopdesc">'+(done?'claimed — banked onto this run'
         :(ready?'done · tap to bank it':(have+' / '+b.need)))+'</div>'
      +'<div class="bntBar"><i style="width:'+pct+'%"></i></div>';
    card.appendChild(txt);
    const pr=document.createElement('div'); pr.className='shopprice'+(done?' free':'');
    pr.textContent=done?'✓':('+'+b.pay+'✦');
    card.appendChild(pr);
    if(!done) card.onclick=function(){ if(bountyClaim(b)) paintBounties();
      else navigator.vibrate&&navigator.vibrate(20); };
    box.appendChild(card);
  }
}
