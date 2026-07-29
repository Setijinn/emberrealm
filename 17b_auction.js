// ---------- THE AUCTION HOUSE ----------
// Players will eventually list their own gear here. That cannot be done honestly on the current
// architecture -- peer-to-peer with an elected host means no neutral party to escrow the item or
// the glory, no storage that outlives the host's tab, and a glory balance that lives in the
// buyer's own save where anyone can edit it. So the market opens with HOUSE stock only.
//
// Everything below is shaped so that adding real player listings later is a change of SOURCE and
// nothing else: the UI, the buy path, the price rules and the glory ledger all operate on a
// generic listing {id, item, price, seller}. auctionListings() is the one function that would
// learn to merge a server's rows in beside the house's.
//
// The house rotation needs no storage at all: the stock is DERIVED from the calendar date, so
// every player sees the same shelf on the same day without anything being saved or synced.

const AUCTION_SLOTS=6;        // items on the shelf at once
// The highest tier the house will ever stock. Deliberately its own constant rather than MAXT-1:
// see the note at the tier draw below. This is the top of the ORDINARY ladder (T12) and must stay
// below SD_T, whatever the clamp does next.
const AUC_TMAX=SD_T-1;
const AUCTION_HOURS=24;       // how long a shelf lasts

// deterministic PRNG — same seed, same shelf, on every machine
function _aucRng(seed){ let a=seed>>>0;
  return function(){ a|=0; a=(a+0x6D2B79F5)|0;
    let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t;
    return ((t^(t>>>14))>>>0)/4294967296; }; }
// which shelf we are on. UTC so players in different timezones share it.
function auctionPeriod(){ return Math.floor(Date.now()/(AUCTION_HOURS*3600*1000)); }
function auctionRefreshIn(){
  const per=AUCTION_HOURS*3600*1000;
  return Math.max(0, per-(Date.now()%per)); }

// The shelf. Tiers are drawn from the whole ladder but weighted toward the middle, so the auction
// is where you patch a gap rather than where you buy an endgame set -- the top tiers still have to
// be earned off a boss. Prices sit anywhere in each item's legal +/-50% band, which is what makes
// the shelf worth reading rather than a fixed price list.
function auctionListings(){
  const seed=auctionPeriod();
  const rnd=_aucRng(seed*2654435761);
  const kinds=['wpn','arm','arm','helm','ring'];
  const mats=['plate','leather','robe'];
  const out=[];
  for(let i=0;i<AUCTION_SLOTS;i++){
    const k=kinds[(rnd()*kinds.length)|0];
    // triangular-ish tier draw: middle tiers common, the ends rare.
    // AUC_TMAX, NOT MAXT-1. The shelf used to top out at MAXT-1 because that was the top of the
    // ordinary ladder; Scavenged Dreams raised the clamp, and a house rotation that could stock SD
    // would put the rim's exclusive reward behind a glory price instead of behind the rim. The
    // auction sells what the world sells, and the world does not sell this.
    const t=Math.max(0,Math.min(AUC_TMAX, Math.round((rnd()+rnd()+rnd())/3*AUC_TMAX)));
    let it;
    // same rule as mkItem: a retired type carries `legacy` and never reaches a shelf
    if(k==='wpn'){ const ws=Object.keys(WTYPE).filter(x=>!WTYPE[x].legacy);
      it={k:'wpn',wt:ws[(rnd()*ws.length)|0],t:t}; }
    else if(k==='ring') it={k:'ring',st:RING_STATS[(rnd()*RING_STATS.length)|0],t:t};
    else it={k:k,mt:mats[(rnd()*3)|0],t:t};
    // rarity, and its matching number of rolled affixes — same rules as a real drop
    it.rar=Math.max(0,Math.min(5,Math.floor(rnd()*rnd()*6)));
    it.aff=[];
    const keys=Object.keys(AFFIX_PREFIX), used={};
    for(let a=0;a<it.rar;a++){ let key,g=0;
      do{ key=keys[(rnd()*keys.length)|0]; }while(used[key]&&g++<12);
      used[key]=1; it.aff.push({s:key,v:affixValue(key,it.t,it.rar)}); }
    const band=gloryPriceRange(it);
    const price=clampGloryPrice(it, Math.round(band.min+rnd()*(band.max-band.min)));
    out.push({id:'h'+seed+'_'+i, item:it, price:price, seller:'house'});
  }
  return out;
}
// What the account has already bought off this shelf. Keyed by period so it clears itself on
// rotation -- no cleanup, and a listing cannot be bought twice.
function auctionTaken(){ const u=users[curUser]; if(!u) return {};
  if(!u.auc || u.auc.p!==auctionPeriod()) u.auc={p:auctionPeriod(),ids:{}};
  return u.auc.ids; }
function auctionIsTaken(l){ return !!auctionTaken()[l.id]; }
// Buy. Glory is the ACCOUNT's, so this is the one purchase in the game that outlives the
// character. A house sale burns the glory; a player sale would credit the seller here instead.
function auctionBuy(l){
  const u=users[curUser], ch=curChar();
  if(!u||!ch||!rpg||!l) return false;
  if(auctionIsTaken(l)) return false;
  if((u.glory||0)<l.price){ msg('NOT ENOUGH GLORY',l.price+' needed'); return false; }
  if(!ch.inv) ch.inv=[];
  if(ch.inv.length>=20){ msg('SATCHEL FULL','make room first'); return false; }
  u.glory-=l.price;
  ch.inv.push(l.item);
  auctionTaken()[l.id]=1;
  LS.set('er-users',users); saveRPG();
  msg(itemName(l.item),'bought for '+l.price+' glory');
  return true;
}

// ---------- panel ----------
function openAuction(){ const s=$s('aucScr'); if(!s) return;
  s.style.display='flex'; paintAuction(); }
function closeAuction(){ const s=$s('aucScr'); if(s) s.style.display='none'; }
function _aucClock(ms){ const h=Math.floor(ms/3600000), m=Math.floor(ms%3600000/60000);
  return h>0?(h+'h '+m+'m'):(m+'m'); }
function paintAuction(){
  const u=users[curUser]; if(!u) return;
  $s('aucGlory').innerHTML='<span class="purse">✦ '+(u.glory||0)+' glory</span>';
  $s('aucNote').textContent='the house restocks in '+_aucClock(auctionRefreshIn());
  const box=$s('aucRows'); box.innerHTML='';
  for(const l of auctionListings()){
    const taken=auctionIsTaken(l), afford=(u.glory||0)>=l.price;
    const card=document.createElement('div');
    card.className='shopcard'+(taken?' broke':(afford?'':' broke'));
    const ico=document.createElement('div'); ico.className='shopico';
    const cv=document.createElement('canvas'); cv.width=42; cv.height=36; cv.className='isprite';
    drawItemIcon(cv.getContext('2d'),l.item,42,36);
    ico.appendChild(cv); card.appendChild(ico);
    const band=gloryPriceRange(l.item);
    const vs=l.price<band.base?'under':(l.price>band.base?'over':'at');
    const txt=document.createElement('div'); txt.className='shoptext';
    txt.innerHTML='<div class="shopname" style="color:'+itemRarCol(l.item)+'">'+itemName(l.item)+'</div>'
      +'<div class="shopdesc">'+(taken?'sold to you this rotation'
        :(vs+' the going rate of '+band.base+'  ·  sold by the house'))+'</div>';
    card.appendChild(txt);
    const pr=document.createElement('div'); pr.className='shopprice';
    pr.textContent=taken?'✓':(l.price+'✦');
    card.appendChild(pr);
    if(!taken) card.onclick=function(){ if(auctionBuy(l)) paintAuction();
      else navigator.vibrate&&navigator.vibrate(20); };
    box.appendChild(card);
  }
}
