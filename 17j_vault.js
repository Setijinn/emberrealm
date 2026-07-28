// ---------- THE VAULT (user, 2026-07-27: "let's build the storage room") ----------
// The room has existed since the Hearth was laid out — a strongbox block, a portal, and a sign
// reading "STASH — coming soon". This is the stash.
//
// IT IS ACCOUNT-WIDE AND UNGATED, BY DECISION.
// The vault hangs off `users[curUser]`, not off a character, so it survives the hero who filled
// it, and anything in it can be withdrawn by any hero at any level. That was asked for explicitly
// after the alternative was put on the table, so it is written here plainly rather than quietly
// softened: a fresh Lv1 can walk into the Hearth, open the strongbox and put on a T12. Permadeath
// still ends the RUN and still takes everything the hero was carrying — it no longer takes what
// they banked. If that ever needs walking back, the gate belongs in vaultCanWithdraw() below,
// which exists as the single seam for exactly that and today always says yes.
//
// WHAT IT WILL NOT TAKE, and why these are not balance gates:
//   * nothing while you are dead or without a hero — there is no inventory to move things to
//   * pet eggs — an egg is not an item you own, it goes to the incubator the moment you take it,
//     and there is no code path that puts one back in a satchel to be deposited
//   * a satchel that is already full cannot receive a withdrawal (the satchel cap is unchanged)

// The satchel cap is a bare 20 in eight different files. Naming it here does not change any of
// them -- it just means the vault asks a question with a name on it instead of a magic number.
const INV_CAP = 20;

const VAULT_SLOTS = 60;          // deliberately generous; the panel pages rather than truncates
const VAULT_PAGE  = 20;

// Account-level, created on first use. Same LS.set('er-users') persistence as glory and bounties.
function vaultStore(){
  const u=(typeof users!=='undefined'&&curUser)?users[curUser]:null;
  if(!u) return null;
  if(!Array.isArray(u.vault)) u.vault=[];
  return u;
}
function vaultItems(){ const u=vaultStore(); return u?u.vault:[]; }
function vaultSave(){ if(typeof LS!=='undefined') LS.set('er-users',users); }
function vaultFull(){ return vaultItems().length>=VAULT_SLOTS; }

// THE SEAM. Every withdrawal asks this first. It always returns true today — the vault is ungated
// on purpose — but a level or tier rule would live here and nowhere else, so adding one later is
// one function and not a hunt through the UI.
function vaultCanWithdraw(it,ch){ return !!(it&&ch); }

// An egg never reaches a satchel, so it can never reach the vault; the check is here anyway so
// that a future item kind that behaves like one fails loudly at the door instead of half-working.
function vaultCanDeposit(it){ return !!it && it.k!=='egg'; }

function vaultDeposit(i){
  const ch=(typeof curChar==='function')?curChar():null; const u=vaultStore();
  if(!ch||!u||!ch.inv) return false;
  const it=ch.inv[i]; if(!it) return false;
  if(!vaultCanDeposit(it)){ if(typeof msg==='function') msg('IT WILL NOT GO IN','that is not a thing you can store'); return false; }
  if(vaultFull()){ if(typeof msg==='function') msg('THE VAULT IS FULL',VAULT_SLOTS+' is all it holds'); return false; }
  ch.inv.splice(i,1); u.vault.push(it);
  vaultSave(); if(typeof saveRPG==='function') saveRPG();
  return true;
}
function vaultWithdraw(i){
  const ch=(typeof curChar==='function')?curChar():null; const u=vaultStore();
  if(!ch||!u) return false;
  if(!ch.inv) ch.inv=[];
  const it=u.vault[i]; if(!it) return false;
  if(!vaultCanWithdraw(it,ch)){ if(typeof msg==='function') msg('NOT FOR YOU','not yet'); return false; }
  if(ch.inv.length>=INV_CAP){ if(typeof msg==='function') msg('YOUR SATCHEL IS FULL','make room first'); return false; }
  u.vault.splice(i,1); ch.inv.push(it);
  vaultSave(); if(typeof saveRPG==='function') saveRPG();
  return true;
}
// Bulk moves, because moving twenty things one tap at a time is the actual cost of a stash.
function vaultDepositAll(){
  const ch=(typeof curChar==='function')?curChar():null; if(!ch||!ch.inv) return 0;
  let n=0;
  for(let i=ch.inv.length-1;i>=0;i--){ if(vaultFull()) break;
    if(!vaultCanDeposit(ch.inv[i])) continue;
    if(vaultDeposit(i)) n++; }
  if(typeof msg==='function' && n) msg('STORED',n+(n===1?' piece':' pieces')+' put away');
  return n;
}

// ===================================================================================
// THE SCROLL REGISTRY (user: "players can stash extra stat scrolls they find but are already
// maxed on, scrolls can be inserted manually or are automatically added to it when attempted to
// be consumed when at max").
//
// The problem it solves is real and was invisible: a stat scroll banks on the CHARACTER
// (rpg.scrolls[st]) and applyScroll silently refuses to invest it once rpg.train[st] reaches the
// class cap. So every scroll you find for a stat you have already maxed sat in your bank doing
// nothing and then died with you. Late-game, when the caps are the whole grind, that is most of
// what drops.
//
// Stored ACCOUNT-WIDE, in the same place and for the same reason as the gear vault: the entire
// point is that the hero who cannot use a scroll passes it to one who can. Same ungated decision
// applies -- see the header of this file.
//
// Counts, not slots. A scroll has no identity beyond which stat it feeds, so a per-stat tally is
// the honest model and the panel can render it in the grid the gear side already uses.
const SVAULT_CAP = 99;                       // per stat; a bound, not a balance lever

function scrollVault(){ const u=vaultStore(); if(!u) return null;
  if(!u.scrolls || typeof u.scrolls!=='object' || Array.isArray(u.scrolls)) u.scrolls={};
  return u.scrolls; }
function svCount(st){ const v=scrollVault(); return (v&&v[st])||0; }
function svTotal(){ const v=scrollVault(); if(!v) return 0; let n=0;
  for(const k in v) n+=v[k]||0; return n; }
// which stats a scroll can even exist for -- Fortune is never scroll-trainable
function svStats(){ return (typeof SCROLL_STATS!=='undefined')?SCROLL_STATS
  :((typeof STATS!=='undefined')?STATS.filter(s=>s!=='fort'):[]); }

// Move n scrolls from the CHARACTER's bank into the registry. Returns how many actually moved.
function svDeposit(st,n){
  const v=scrollVault(); if(!v||typeof rpg==='undefined'||!rpg) return 0;
  if(typeof initTrain==='function') initTrain(rpg);
  if(!rpg.scrolls) return 0;
  let moved=0; n=(n===undefined)?1:n;
  while(moved<n && (rpg.scrolls[st]||0)>0 && (v[st]||0)<SVAULT_CAP){ rpg.scrolls[st]--; v[st]=(v[st]||0)+1; moved++; }
  if(moved){ vaultSave(); if(typeof saveRPG==='function') saveRPG();
    if(typeof updateStatsBtn==='function') updateStatsBtn(); }
  return moved; }

// ...and back out again, into the bank, where the attributes screen can invest it.
function svWithdraw(st,n){
  const v=scrollVault(); if(!v||typeof rpg==='undefined'||!rpg) return 0;
  if(typeof initTrain==='function') initTrain(rpg);
  if(!rpg.scrolls) rpg.scrolls={};
  let moved=0; n=(n===undefined)?1:n;
  while(moved<n && (v[st]||0)>0){ v[st]--; rpg.scrolls[st]=(rpg.scrolls[st]||0)+1; moved++; }
  if(moved){ vaultSave(); if(typeof saveRPG==='function') saveRPG();
    if(typeof updateStatsBtn==='function') updateStatsBtn(); }
  return moved; }

// THE AUTOMATIC PATH. Called from applyScroll (16_maxstats) the moment a stat is at its cap and
// there are still scrolls banked for it -- the exact moment the player "attempts to consume at
// max". Deliberately silent about failure: if the registry is full the scroll simply stays in the
// bank rather than being destroyed.
function svOverflow(st){
  if(typeof rpg==='undefined'||!rpg||!rpg.scrolls) return 0;
  const have=rpg.scrolls[st]||0; if(have<=0) return 0;
  const moved=svDeposit(st,have);
  if(moved && typeof msg==='function')
    msg('TO THE REGISTRY', moved+' '+((typeof scrollName==='function')?scrollName(st):'scroll')
      +(moved===1?'':'s')+' stored — '+st.toUpperCase()+' is maxed');
  return moved; }
// every maxed stat at once, for APPLY ALL
function svOverflowAll(){ const ch=(typeof curChar==='function')?curChar():null;
  if(!ch||typeof rpg==='undefined'||!rpg||typeof statMaxed!=='function') return 0;
  let n=0; for(const s of svStats()) if(statMaxed(ch.cls,rpg,s)) n+=svDeposit(s,rpg.scrolls[s]||0);
  return n; }

// ---------------- panel ----------------
let vaultPage=0, vaultSel=-1, vaultSide='vault';   // which column the selection is in
// GEAR or SCROLLS. Both modes drive the SAME two grids: a scroll has no identity beyond the stat
// it feeds, so it renders as a stack in a cell exactly like a piece of gear does, and the panel
// that was already fought into its frame does not need a second layout.
let vaultTab='gear';
let _svKeys={vault:[],bag:[]};      // stat id per displayed cell, parallel to the grids

function openVault(){
  const s=(typeof $s==='function')?$s('vaultScr'):document.getElementById('vaultScr');
  if(!s) return;
  vaultSel=-1; vaultPage=0; vaultTab='gear';
  s.style.display='flex';
  paintVault();
}
function closeVault(){
  const s=(typeof $s==='function')?$s('vaultScr'):document.getElementById('vaultScr');
  if(s) s.style.display='none';
}

function _vaultCell(it,sel,onClick){
  const d=document.createElement('div'); d.className='islot'+(sel?' sel':'');
  if(it.rar && typeof RAR_COL!=='undefined') d.style.borderColor=RAR_COL[it.rar];
  const cvs=document.createElement('canvas'); cvs.width=44; cvs.height=38; cvs.className='isprite';
  const cc=cvs.getContext('2d'); cc.imageSmoothingEnabled=false;
  if(typeof drawItemIcon==='function') drawItemIcon(cc,it,44,38);
  d.appendChild(cvs);
  if(it.k==='pot'||it.k==='scroll'||it.t===undefined){
    const b=document.createElement('span'); b.className='tbadge'; b.textContent='✦';
    if(typeof itemRarCol==='function') b.style.color=itemRarCol(it);
    d.appendChild(b); }
  d.onclick=onClick;
  return d;
}

function _svCell(st,count,sel,onClick){
  const d=document.createElement('div'); d.className='islot'+(sel?' sel':'');
  const col=(typeof STAT_META!=='undefined'&&STAT_META[st])?STAT_META[st].col:'#e6c76a';
  d.style.borderColor=col;
  const cvs=document.createElement('canvas'); cvs.width=44; cvs.height=38; cvs.className='isprite';
  const cc=cvs.getContext('2d'); cc.imageSmoothingEnabled=false;
  // the real in-game scroll sprite, tinted by its stat -- the same thing you picked up
  if(typeof drawItemIcon==='function') drawItemIcon(cc,{k:'scroll',st:st},44,38,true);
  d.appendChild(cvs);
  const b=document.createElement('span'); b.className='tbadge'; b.style.color=col;
  b.textContent='x'+count; d.appendChild(b);
  const ab=document.createElement('small'); ab.className='svAbbr'; ab.style.color=col;
  ab.textContent=(typeof STAT_META!=='undefined'&&STAT_META[st])?STAT_META[st].s:st;
  d.appendChild(ab);
  d.onclick=onClick;
  return d;
}
function _paintScrolls(){
  const ch=(typeof curChar==='function')?curChar():null;
  const v=scrollVault(); if(!v) return;
  if(typeof rpg!=='undefined'&&rpg&&typeof initTrain==='function') initTrain(rpg);
  const stats=svStats();
  _svKeys={vault:[],bag:[]};
  const cnt=(typeof $s==='function')?$s('vaultCount'):document.getElementById('vaultCount');
  if(cnt) cnt.innerHTML='<span class="purse">'+svTotal()+' scrolls in the registry</span>';
  const hd=(typeof $s==='function')?$s('vaultHeadStored'):document.getElementById('vaultHeadStored');
  if(hd) hd.textContent='REGISTRY';
  const hb=document.getElementById('vaultHeadBag');
  if(hb) hb.innerHTML='CARRIED <span id="vaultBagCount" class="mnote"></span>';
  const g=(typeof $s==='function')?$s('vaultGrid'):document.getElementById('vaultGrid');
  if(g){ g.innerHTML='';
    let any=0;
    for(const st of stats){ const n=v[st]||0; if(n<=0) continue; any++;
      const i=_svKeys.vault.length; _svKeys.vault.push(st);
      g.appendChild(_svCell(st,n,(vaultSide==='vault'&&vaultSel===i),
        ()=>{ vaultSide='vault'; vaultSel=i; paintVault(); })); }
    if(!any){ const e=document.createElement('div'); e.className='mnote';
      e.textContent='Empty. Scrolls you cannot use land here instead of dying with you.';
      g.appendChild(e); } }
  const g2=(typeof $s==='function')?$s('vaultBag'):document.getElementById('vaultBag');
  if(g2){ g2.innerHTML='';
    let any=0;
    const bank=(typeof rpg!=='undefined'&&rpg&&rpg.scrolls)?rpg.scrolls:{};
    for(const st of stats){ const n=bank[st]||0; if(n<=0) continue; any++;
      const i=_svKeys.bag.length; _svKeys.bag.push(st);
      g2.appendChild(_svCell(st,n,(vaultSide==='bag'&&vaultSel===i),
        ()=>{ vaultSide='bag'; vaultSel=i; paintVault(); })); }
    if(!any){ const e=document.createElement('div'); e.className='mnote';
      e.textContent='You are carrying no scrolls.'; g2.appendChild(e); } }
  const bagc=(typeof $s==='function')?$s('vaultBagCount'):document.getElementById('vaultBagCount');
  if(bagc) bagc.textContent=(typeof scrollsBanked==='function'&&typeof rpg!=='undefined'&&rpg)
    ? String(scrollsBanked(rpg)) : '';
  // the selected stack, and whether THIS hero can actually still use it
  const side=vaultSide, keys=_svKeys[side]||[];
  const st=keys[vaultSel];
  const info=(typeof $s==='function')?$s('vaultSel'):document.getElementById('vaultSel');
  if(info){
    if(st){
      const col=(typeof STAT_META!=='undefined'&&STAT_META[st])?STAT_META[st].col:'#fff';
      let html='<b style="color:'+col+'">'+((typeof scrollName==='function')?scrollName(st):st)+'</b>';
      if(ch&&typeof trainCap==='function'&&typeof rpg!=='undefined'&&rpg){
        const cap=trainCap(ch.cls,st,rpg.prestige||0), inv=(rpg.train&&rpg.train[st])||0;
        html+=' <span class="mnote">'+inv+'/'+cap+' trained</span>';
        if(inv>=cap) html+=' · <span style="color:#e2604c">maxed — this hero cannot use it</span>';
      }
      info.innerHTML=html;
    } else info.textContent='Tap a scroll on either side';
  }
  const bIn =(typeof $s==='function')?$s('vaultIn'):document.getElementById('vaultIn');
  const bOut=(typeof $s==='function')?$s('vaultOut'):document.getElementById('vaultOut');
  if(bIn){ bIn.textContent='STORE ▸'; bIn.style.display=(side==='bag'&&st)?'':'none'; }
  if(bOut){ bOut.textContent='◂ TAKE'; bOut.style.display=(side==='vault'&&st)?'':'none'; }
  const all=(typeof $s==='function')?$s('vaultAll'):document.getElementById('vaultAll');
  if(all) all.textContent='STORE ALL SPARE';
  const pv=(typeof $s==='function')?$s('vaultPrev'):document.getElementById('vaultPrev');
  const nx=(typeof $s==='function')?$s('vaultNext'):document.getElementById('vaultNext');
  if(pv) pv.style.display='none';
  if(nx) nx.style.display='none';
}
function paintVault(){
  const gT=document.getElementById('vTabGear'), sT=document.getElementById('vTabScroll');
  if(gT) gT.className='vTab'+(vaultTab==='gear'?' on':'');
  if(sT) sT.className='vTab'+(vaultTab==='scrolls'?' on':'');
  if(vaultTab==='scrolls'){ _paintScrolls(); return; }
  const hb0=document.getElementById('vaultHeadBag');
  if(hb0 && hb0.textContent.indexOf('SATCHEL')<0)
    hb0.innerHTML='SATCHEL <span id="vaultBagCount" class="mnote"></span>';
  const bIn0=document.getElementById('vaultIn'), bOut0=document.getElementById('vaultOut'),
        all0=document.getElementById('vaultAll');
  if(bIn0) bIn0.textContent='STORE IT ▸';
  if(bOut0) bOut0.textContent='◂ TAKE IT';
  if(all0) all0.textContent='STORE EVERYTHING';
  _paintGear();
}
function _paintGear(){
  const ch=(typeof curChar==='function')?curChar():null;
  const u=vaultStore(); if(!u) return;
  const _hdG=document.getElementById('vaultHeadStored');
  if(ch && !ch.inv) ch.inv=[];
  const store=u.vault;
  const pages=Math.max(1,Math.ceil(store.length/VAULT_PAGE));
  if(vaultPage>=pages) vaultPage=pages-1;

  const cnt=(typeof $s==='function')?$s('vaultCount'):document.getElementById('vaultCount');
  if(cnt) cnt.innerHTML='<span class="purse">'+store.length+' / '+VAULT_SLOTS+' stored</span>';
  // the page marker rides in the column header rather than on a line of its own -- it is four
  // characters and the panel does not have a spare line to give it
  const hd=(typeof $s==='function')?$s('vaultHeadStored'):document.getElementById('vaultHeadStored');
  if(hd) hd.textContent='STORED'+(pages>1?(' · '+(vaultPage+1)+'/'+pages):'');

  // the vault side
  const g=(typeof $s==='function')?$s('vaultGrid'):document.getElementById('vaultGrid');
  if(g){ g.innerHTML='';
    const from=vaultPage*VAULT_PAGE, to=Math.min(store.length,from+VAULT_PAGE);
    for(let i=from;i<to;i++){ const it=store[i];
      g.appendChild(_vaultCell(it,(vaultSide==='vault'&&vaultSel===i),
        ()=>{ vaultSide='vault'; vaultSel=i; paintVault(); })); }
    if(to===from){ const e=document.createElement('div'); e.className='mnote';
      e.textContent='Empty. Anything you put here outlives the hero who found it.';
      g.appendChild(e); }
  }
  // the satchel side
  const g2=(typeof $s==='function')?$s('vaultBag'):document.getElementById('vaultBag');
  if(g2){ g2.innerHTML='';
    const inv=(ch&&ch.inv)?ch.inv:[];
    inv.forEach((it,i)=>{ g2.appendChild(_vaultCell(it,(vaultSide==='bag'&&vaultSel===i),
      ()=>{ vaultSide='bag'; vaultSel=i; paintVault(); })); });
    if(!inv.length){ const e=document.createElement('div'); e.className='mnote';
      e.textContent='Your satchel is empty.'; g2.appendChild(e); }
  }
  const bagc=(typeof $s==='function')?$s('vaultBagCount'):document.getElementById('vaultBagCount');
  if(bagc) bagc.textContent=((ch&&ch.inv)?ch.inv.length:0)+' / '+INV_CAP;

  // the selected piece, described the same way the satchel describes it
  const sel=(vaultSide==='vault')?store[vaultSel]:((ch&&ch.inv)?ch.inv[vaultSel]:null);
  const info=(typeof $s==='function')?$s('vaultSel'):document.getElementById('vaultSel');
  if(info){
    if(sel){
      let html='<b style="color:'+((typeof itemRarCol==='function')?itemRarCol(sel):'#fff')+'">'
        +((typeof itemName==='function')?itemName(sel):'Item')+'</b>';
      if(sel.rar && typeof RAR_NAMES!=='undefined')
        html+=' <span style="color:'+RAR_COL[sel.rar]+'">('+RAR_NAMES[sel.rar]+')</span>';
      if(ch && sel.k!=='pot' && typeof canEquip==='function' && !canEquip(sel,ch))
        html+=' · <span style="color:#c04a3d">wrong class</span>';
      if(sel.k!=='pot' && ch && typeof itemStats==='function'){
        const s2=itemStats(sel,ch.cls); let sl='';
        for(const k of STATS){ if(s2[k]) sl+='<span style="color:'+STAT_META[k].col+'">+'+s2[k]+' '+STAT_META[k].s+'</span> '; }
        html+='<div class="istats">'+sl+'</div>'; }
      info.innerHTML=html;
    } else info.textContent='Tap a piece on either side';
  }
  const bIn =(typeof $s==='function')?$s('vaultIn'):document.getElementById('vaultIn');
  const bOut=(typeof $s==='function')?$s('vaultOut'):document.getElementById('vaultOut');
  if(bIn)  bIn.style.display =(vaultSide==='bag'   && sel)?'':'none';
  if(bOut) bOut.style.display=(vaultSide==='vault' && sel)?'':'none';
  const pv=(typeof $s==='function')?$s('vaultPrev'):document.getElementById('vaultPrev');
  const nx=(typeof $s==='function')?$s('vaultNext'):document.getElementById('vaultNext');
  if(pv) pv.style.display=(pages>1)?'':'none';
  if(nx) nx.style.display=(pages>1)?'':'none';
}

if(typeof document!=='undefined'){
  const wire=()=>{
    const on=(id,fn)=>{ const el=document.getElementById(id); if(el) el.addEventListener('click',fn); };
    on('vaultClose',closeVault);
    on('vTabGear',  ()=>{ vaultTab='gear';    vaultSel=-1; vaultPage=0; paintVault(); });
    on('vTabScroll',()=>{ vaultTab='scrolls'; vaultSel=-1; paintVault(); });
    on('vaultIn', ()=>{
      if(vaultTab==='scrolls'){ const st=(_svKeys.bag||[])[vaultSel];
        if(vaultSide==='bag'&&st) svDeposit(st,1); paintVault(); return; }
      if(vaultSide==='bag'&&vaultSel>=0&&vaultDeposit(vaultSel)) vaultSel=-1; paintVault(); });
    on('vaultOut',()=>{
      if(vaultTab==='scrolls'){ const st=(_svKeys.vault||[])[vaultSel];
        if(vaultSide==='vault'&&st) svWithdraw(st,1); paintVault(); return; }
      if(vaultSide==='vault'&&vaultSel>=0&&vaultWithdraw(vaultSel)) vaultSel=-1; paintVault(); });
    on('vaultAll',()=>{
      if(vaultTab==='scrolls'){ const n=svOverflowAll();
        if(typeof msg==='function') msg(n?'STORED':'NOTHING SPARE',
          n?(n+' scroll'+(n===1?'':'s')+' filed'):'no maxed stat is holding one');
        vaultSel=-1; paintVault(); return; }
      vaultDepositAll(); vaultSel=-1; paintVault(); });
    on('vaultPrev',()=>{ vaultPage=Math.max(0,vaultPage-1); vaultSel=-1; paintVault(); });
    on('vaultNext',()=>{ const n=Math.max(1,Math.ceil(vaultItems().length/VAULT_PAGE));
      vaultPage=Math.min(n-1,vaultPage+1); vaultSel=-1; paintVault(); });
  };
  if(document.readyState==='loading') addEventListener('DOMContentLoaded',wire); else wire();
}
