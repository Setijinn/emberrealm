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

// ---------------- panel ----------------
let vaultPage=0, vaultSel=-1, vaultSide='vault';   // which column the selection is in

function openVault(){
  const s=(typeof $s==='function')?$s('vaultScr'):document.getElementById('vaultScr');
  if(!s) return;
  vaultSel=-1; vaultPage=0;
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

function paintVault(){
  const ch=(typeof curChar==='function')?curChar():null;
  const u=vaultStore(); if(!u) return;
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
    on('vaultIn', ()=>{ if(vaultSide==='bag'&&vaultSel>=0&&vaultDeposit(vaultSel)) vaultSel=-1; paintVault(); });
    on('vaultOut',()=>{ if(vaultSide==='vault'&&vaultSel>=0&&vaultWithdraw(vaultSel)) vaultSel=-1; paintVault(); });
    on('vaultAll',()=>{ vaultDepositAll(); vaultSel=-1; paintVault(); });
    on('vaultPrev',()=>{ vaultPage=Math.max(0,vaultPage-1); vaultSel=-1; paintVault(); });
    on('vaultNext',()=>{ const n=Math.max(1,Math.ceil(vaultItems().length/VAULT_PAGE));
      vaultPage=Math.min(n-1,vaultPage+1); vaultSel=-1; paintVault(); });
  };
  if(document.readyState==='loading') addEventListener('DOMContentLoaded',wire); else wire();
}
