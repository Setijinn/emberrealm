// ---------- 8-bit sprites ----------
const HERO_A=[
"......OOOO......",
".....OMMMMO.....",
"....OMMMMMMO....",
"....OSSSSSSO....",
"....OSESSESO....",
"....OSSSSSSO....",
".....OSSSSO.....",
"...OOBBBBBBOO...",
"..OBBBDBBDBBBO..",
"..OBGBBBBBBGBO..",
"..OBBBBBBBBBBO..",
"...OBBBBBBBBO...",
"...OLLLLLLLLO...",
"...OLL.OO.LLO...",
"...OLL....LLO...",
"...Oll....llO...",
"...OO......OO..."];
const HERO_B=[
"......OOOO......",
".....OMMMMO.....",
"....OMMMMMMO....",
"....OSSSSSSO....",
"....OSESSESO....",
"....OSSSSSSO....",
".....OSSSSO.....",
"...OOBBBBBBOO...",
"..OBBBDBBDBBBO..",
"..OBGBBBBBBGBO..",
"..OBBBBBBBBBBO..",
"...OBBBBBBBBO...",
"...OLLLLLLLLO...",
"..OLL..OO..LLO..",
"..OLL......LLO..",
"..Oll......llO..",
"..OO........OO.."];
const HOUND=[
"....OOOOOOOO....",
"...ORRRRRRRRO...",
"..ORRERRRRERRO..",
"..ORRRRRRRRRRO..",
"..ORTTRRRRTTRO..",
"...ORRRRRRRRO...",
"..ORRRRRRRRRRO..",
"..ORrRRRRRRrRO..",
"..ORRO.OO.ORRO..",
"..ORRO....ORRO..",
"..OOO......OOO.."];
const CULT=[
"....OOOOOO....",
"...OPPPPPPO...",
"..OPPPPPPPPO..",
"..OPKKKKKKPO..",
"..OPKEKKEKPO..",
"..OPKKKKKKPO..",
"..OPPPPPPPPO..",
".OPPPpPPpPPPO.",
".OPPPPPPPPPPO.",
".OPPPPPPPPPPO.",
".OPpPPPPPPpPO.",
".OPPPPPPPPPPO.",
"..OPPPPPPPPO..",
"..OppPPPPppO..",
"..OPPPPPPPPO..",
"..OOOOOOOOOO.."];
const TYRANT=[
".OO................OO.",
".OHHO............OHHO.",
"..OHHO..OOOOOO..OHHO..",
"..OHHOOTTTTTTTTOOHHO..",
"...OOOTTTTTTTTTTOOO...",
"...OTTTTTTTTTTTTTTO...",
"..OTETTTTTTTTTTTTETO..",
"..OTTTTTTTTTTTTTTTTO..",
"..OTTMMMMMMMMMMMMTTO..",
"..OTTMHMHMHMHMHMHTTO..",
"..OTTTTTTTTTTTTTTTTO..",
".OTTTTtTTTTTTTTtTTTTO.",
".OTTTTTTTTTTTTTTTTTTO.",
".OTTTTTTTTTTTTTTTTTTO.",
".OtTTTTTTTTTTTTTTTTtO.",
"..OTTTTTTTTTTTTTTTTO..",
"..OTTTOO.OOOO.OOTTTO..",
"..OTTTO........OTTTO..",
"..OttTO........OTttO..",
"..OOOO..........OOOO.."];
const MAREN=[
"..OOOOOOOOOO..",
".OAAAAAAAAAAO.",
"OAAAAAAAAAAAAO",
"OaaaaaaaaaaaaO",
"..OSSSSSSSSO..",
"..OSESSSSESO..",
"..OSSSSSSSSO..",
"...OSSSSSSO...",
"..ORRRRRRRRO..",
".ORRGGGGGGRRO.",
".ORGGGGGGGGRO.",
".ORGGGGGGGGRO.",
".ORGGGGGGGGRO.",
".ORRGGGGGGRRO.",
"..ORRRRRRRRO..",
"..OrrRRRRrrO..",
"..OOOOOOOOOO.."];
function makeSprite(rows,pal){ const h=rows.length,w=rows[0].length;
 const cv2=document.createElement('canvas'); cv2.width=w; cv2.height=h;
 const c=cv2.getContext('2d');
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){ const ch=rows[y][x];
  if(ch==='.'||!pal[ch]) continue; c.fillStyle=pal[ch]; c.fillRect(x,y,1,1); }
 return cv2; }
// run a draw callback counter-rotated about (x,y) so world-anchored TEXT stays upright
// while the camera is rotated (PC view rotation). fn receives the anchor as (0,0)-local coords.
function upright(x,y,fn){ const rot=(typeof camRot!=='undefined')?camRot:0;
 if(!rot){ fn(x,y); return; }
 ctx.save(); ctx.translate(x,y); ctx.rotate(-rot); fn(0,0); ctx.restore(); }
function blit(sp,x,y,sc,flip){ ctx.save(); ctx.translate(x,y);
 if(flip) ctx.scale(-1,1);
 ctx.imageSmoothingEnabled=false;
 ctx.drawImage(sp,-sp.width*sc/2,-sp.height*sc/2,sp.width*sc,sp.height*sc);
 ctx.restore(); }
const sprHound=makeSprite(HOUND,{O:'#140b0b',R:'#c04a3d',r:'#8d3227',E:'#ffd07a',T:'#e8e0d0'});
const sprCult=makeSprite(CULT,{O:'#140b14',P:'#8a5ac0',p:'#5f3d8a',E:'#ffd07a',K:'#241530'});
const sprTyrant=makeSprite(TYRANT,{O:'#1b0d08',T:'#e07a2e',t:'#a8551c',E:'#fff0c0',H:'#e8e0d0',M:'#401510'});
const sprMaren=makeSprite(MAREN,{O:'#140d08',A:'#5c3826',a:'#45291c',S:'#ecc795',R:'#7a5a30',r:'#5a411f',G:'#e8b34b',E:'#140d08'});
const sprBram=makeSprite(MAREN,{O:'#140d08',A:'#3a3344',a:'#262031',S:'#ecc795',R:'#5d6670',r:'#3f4750',G:'#c9d2da',E:'#140d08'});
const sprSella=makeSprite(MAREN,{O:'#140d08',A:'#45291c',a:'#2e1a10',S:'#ecc795',R:'#7a3f22',r:'#5a2d18',G:'#e07a2e',E:'#140d08'});
const sprOdo=makeSprite(MAREN,{O:'#140d08',A:'#2e4034',a:'#1d2a22',S:'#ecc795',R:'#3f6b52',r:'#2c4a39',G:'#8fd48c',E:'#140d08'});
const sprNyx=makeSprite(MAREN,{O:'#140d08',A:'#241530',a:'#170d20',S:'#c9b8d8',R:'#5f3d8a',r:'#432a63',G:'#c07ad4',E:'#140d08'});
const sprWisp=makeSprite(["..OO..",".OTTO.","OTWWTO","OTWWTO",".OTTO.","..OO.."],{O:'#1b0d08',T:'#ff8c3a',W:'#ffd07a'});
const BAG=[
"...OOOO...",
"..OGGGGO..",
".OLLLLLLO.",
"OLLLLLLLLO",
"OLLLLLLLLO",
"OLlLLLLlLO",
"OLLLLLLLLO",
".OLLLLLLO.",
"..OOOOOO.."];
const sprBag=makeSprite(BAG,{O:'#140d08',L:'#8a6a3a',l:'#6a4f28',G:'#e8b34b'});
const sprWolf=makeSprite(HOUND,{O:'#101418',R:'#8d97a3',r:'#5d6670',E:'#d8f0fa',T:'#e8e0d0'});
const sprSkel=makeSprite(CULT,{O:'#141414',P:'#d8d2c8',p:'#a39d94',E:'#7dc47a',K:'#2a2a2a'});
const WSPR={
 sword:["...T........","GGTWWWWWWWWW","...T........"],
 dagger:["..T.....","GGWWWWW.","..T....."],
 bow:["..WWWW....",".W....W...","T......G..",".W....W...","..WWWW...."],
 xbow:["..W..W....","GGWWWWWWT.","..W..W...."],
 staff:["..........T.","GGGGGGGGGGTT","..........T."],
 wand:["GGWWWWT."],
};
const wpnCache={};
function wpnSpr(type,tier){ const k=type+'_'+tier;
 if(!wpnCache[k]){ wpnCache[k]=makeSprite(WSPR[type]||WSPR.sword,
  {W:'#cfd6dd',G:'#5c3826',T:tierCol(tier|0),O:'#14101b'}); }
 return wpnCache[k]; }
function blitRot(sp,x,y,sc,ang){ ctx.save(); ctx.translate(x,y); ctx.rotate(ang);
 ctx.imageSmoothingEnabled=false;
 ctx.drawImage(sp,-sp.width*sc*0.2,-sp.height*sc/2,sp.width*sc,sp.height*sc);
 ctx.restore(); }

// ---------- inventory item sprites ----------
const MATCOL={plate:'#9aa3ad',leather:'#8a6a3a',robe:'#7a5aa0'};
const ARMOR_A=[".OO...OO.","OBBO.OBBO","OBBBGBBBO","OBGGGGGBO","OBGGGGGBO","OBGGGGGBO","OBBGGGBBO",".OBGGGBO.",".OBBBBBO.","..OOOOO.."];
const HELM_A=["..OOOOO..",".OBBBBBO.","OBBGGGBBO","OBGGGGGBO","OBGOOOGBO","OBBGGGBBO",".OOOOOOO."];
const RING_A=["..OEO..",".OGEGO.","OG...GO","OG...GO",".OG.GO.","..OGO.."];
const POTION=["..OOO..",".O.O.O.",".OGOGO.",".OGGGO.","OWWWWWO","OWPPPWO","OWPPPWO","OWWWWWO",".OWWWO.","..OOO.."];
const sprPotion=makeSprite(POTION,{O:'#140d08',G:'#5c3826',W:'#3a2a40',P:'#7dc47a'});
const _armC={},_helmC={},_ringC={};
function armorSpr(mt,t){ const k=mt+'_'+t; if(!_armC[k]) _armC[k]=makeSprite(ARMOR_A,{O:'#140d08',B:MATCOL[mt]||'#888',G:tierCol(t)}); return _armC[k]; }
function helmSpr(mt,t){ const k=mt+'_'+t; if(!_helmC[k]) _helmC[k]=makeSprite(HELM_A,{O:'#140d08',B:MATCOL[mt]||'#888',G:tierCol(t)}); return _helmC[k]; }
function ringSpr(st,t){ const k=st+'_'+t;
 if(!_ringC[k]){ const gem=(typeof RING_DEF!=='undefined'&&RING_DEF[st])?RING_DEF[st].col:'#ffc94d';
   _ringC[k]=makeSprite(RING_A,{O:'#140d08',G:tierCol(t),E:gem}); }
 return _ringC[k]; }
// prefer the real PixelLab ally art (08c _allyImg), fall back to the procedural sprite
function allyImg(spr){ const im=(typeof _allyImg!=='undefined')?_allyImg[spr]:null;
  return (im&&im.complete&&im.naturalWidth)?im:null; }
function petSprite(p){ return p==='wolf'?sprWolf:p==='skel'?sprSkel:sprWisp; }
// Draw an item's icon into a 2d context box (cw x ch), centered. Prefers the real
// PixelLab tier-band art (fractional fit); falls back to the procedural sprite (pixel
// floor-scale). Used by equipment slots, the satchel grid, and shop rows.
function drawItemIcon(g,it,cw,ch){ if(!it) return; g.imageSmoothingEnabled=false;
 const real=(typeof itemArtImg==='function')?itemArtImg(it):null;
 if(real){ const sc=Math.min((cw-4)/real.naturalWidth,(ch-4)/real.naturalHeight);
   const w=real.naturalWidth*sc, h=real.naturalHeight*sc;
   g.drawImage(real,Math.round((cw-w)/2),Math.round((ch-h)/2),Math.round(w),Math.round(h)); return; }
 const sp=itemSprite(it); if(sp&&sp.width){ const sc=Math.max(1,Math.floor(Math.min((cw-4)/sp.width,(ch-4)/sp.height)));
   g.drawImage(sp,Math.round((cw-sp.width*sc)/2),Math.round((ch-sp.height*sc)/2),sp.width*sc,sp.height*sc); } }
function itemSprite(it){ if(!it) return null;
 if(it.k==='pot') return sprPotion;
 if(it.k==='wpn') return wpnSpr(it.wt,it.t);
 if(it.k==='arm') return armorSpr(it.mt,it.t);
 if(it.k==='helm') return helmSpr(it.mt,it.t);
 if(it.k==='ring') return ringSpr(it.st,it.t);
 return null; }

// ---------- 15 unique ring mini-boss sprites ----------
const BOSS_ART=[
 {p:{O:'#0d2630',C:'#4a90a8',B:'#2e5f70',E:'#cfeaf3'},r:[   // 0 Tideworn Colossus (crab-titan)
  "..OO........OO..",".OCCO......OCCO.",".OCCO.OOOO.OCCO.","..OCOOCCCCOOCO..","...OCCCCCCCCO...",
  "..OCCECCCCECCO..","..OCCCCCCCCCCO..",".OCBBBBBBBBBBCO.",".OCBBBBBBBBBBCO.","..OCCCCCCCCCCO..",
  "..OCCOOCCOOCCO..",".OCCO.OCCO.OCCO.",".OCO...OO...OCO.","..O..........O.."]},
 {p:{O:'#1b2a12',W:'#8fae6a',B:'#b7a06a',E:'#e8f0c0',K:'#3a2a10',L:'#6a4f28'},r:[ // 1 Gullwind Harrier (raptor)
  "OO............OO","OWO..........OWO","OWWO.OOOOOO.OWWO",".OWWO.WBBW.OWWO.",".OWWWOBEEBOWWWO.",
  "..OWWWBBBBWWWO..","...OWWBKKBWWO...","....OWBBBBWO....","....OBBBBBBO....","....OBLLLLBO....",
  ".....OLLLLO.....",".....OL..LO.....","....OO....OO...."]},
 {p:{O:'#16240f',W:'#7ea44a',M:'#3a2a14',K:'#e0f2a8'},r:[   // 2 Sawgrass Devourer (reed maw)
  "...O......O.....","..OWO....OWO....","..OWWO..OWWO....","...OWWOOWWO.....","..OWWWWWWWWWO...",
  ".OWWMMMMMMMWWO..",".OWMKMKMKMKMWO..",".OWMMMMMMMMMWO..",".OWMKMKMKMKMWO..",".OWWMMMMMMMWWO..",
  "..OWWWWWWWWWO...","...OWWWWWWWO....","....OWWWWWO.....",".....OOOOO......"]},
 {p:{O:'#14240f',G:'#4f9a3f',E:'#cdf2b6',K:'#2a3a1a'},r:[   // 3 Verdant Warden (treant-golem)
  "....OOOOOO......","...OGGGGGGO.....","..OGGEGGEGGO....","..OGGGGGGGGO....","..OGGKGGKGGO....",
  "...OGGGGGGO.....",".OOGGGGGGGGOO...","OGGOGGGGGGOGGO..","OGGOGGGGGGOGGO..",".OOGGGGGGGGOO...",
  "...OGGGGGGO.....","...OGGOOGGO.....","..OGGO..OGGO....","..OOO....OOO...."]},
 {p:{O:'#101812',W:'#6d7d5a',R:'#4a5a3a',E:'#d8f0b0',K:'#2a1a10'},r:[ // 4 Wolfwood Alpha (great wolf)
  ".O..........O...","OWO........OWO..","OWWO.OOOO.OWWO..",".OWWOWWWWOWWO...",".OWWWWEWEWWWWO..",
  "..OWWWWKKWWWWO..","..OWWWWWWWWWWO..","..OWWRWWWWRWWO..","..OWWWWWWWWWWO..","..OWWOWWWWOWWO..",
  "..OWO.OWWO.OWO..",".OWO...OO...OWO.",".OO..........OO."]},
 {p:{O:'#122010',G:'#356b40',B:'#3a2a14',E:'#b0d0a0',K:'#1a2a12'},r:[ // 5 Timberfell Ancient (mossy elder)
  "...OO..OO..OO...","..OGGOOGGOOGGO..","...OGGGGGGGGO...","..OGGGGGGGGGGO..",".OGGEGGGGGGEGGO.",
  ".OGGGGGGGGGGGGO.",".OGGGKKKKKKGGGO.",".OGGGGGGGGGGGGO.","..OGGGGGGGGGGO..","..OBBGGGGGGBBO..",
  "..OBBOGGGGOBBO..","..OBBO.OO.OBBO..","..OBO..OO..OBO..","..OO........OO.."]},
 {p:{O:'#12201a',T:'#3f6b58',B:'#24140a',E:'#c6e6d6',M:'#1a2a22'},r:[ // 6 Bramble Tyrant (thorn crown)
  ".O.O.O..O.O.O...","OTOTOTOOTOTOTO..",".OTTTTTTTTTTO...","..OTTTTTTTTTO...","..OTBBTTBBTTO...",
  "..OTBEBTBEBTO...","..OTBBTTBBTTO...","..OTTTTTTTTTO...","..OTTTMMTTTTO...","..OTTTTTTTTTO...",
  "...OTTTTTTTO....","...OTTOOTTTO....","..OTTO..OTTO....","..OO......OO...."]},
 {p:{O:'#1a1c20',S:'#8a8f9a',K:'#e2e7ee',M:'#3a3d44'},r:[   // 7 Stonebrow Goliath (stone golem)
  "...OOOOOOOO.....","..OSSSSSSSSO....",".OSSSSSSSSSSO...",".OSSKSSSSKSSO...",".OSSSSSSSSSSO...",
  ".OSSSSMMSSSSO...","OOSSSSSSSSSSOO..","OSSOSSSSSSOSSO..","OSSOSSSSSSOSSO..","OOSSSSSSSSSSOO..",
  ".OSSSSSSSSSSO...",".OSSOO..OOSSO...",".OSO......OSO...",".OO........OO..."]},
 {p:{O:'#1c1814',K:'#9a8f80',E:'#ffd0a0'},r:[               // 8 Scree Stalker (rockslide beast)
  "O..............O","OKO..........OKO",".OKKO.OOOO..OKO.","..OKKOKKKKOKKO..","...OKKKEEKKKO...",
  "...OKKKKKKKKO...","..OKKKKKKKKKKO..",".OKKOKKKKKKOKKO.",".OKOKKKKKKKKOKO.","..O.OKKKKKKO.O..",
  "....OKO..OKO....","...OKO....OKO...","..OO........OO.."]},
 {p:{O:'#1c110a',A:'#8a5a4a',E:'#ffdca6',K:'#c86a3a'},r:[   // 9 Cinderwatch Sentinel (armoured warden)
  "....OOOOOO......","...OAAAAAAO.....","..OAAEAAEAAO....","..OAAAAAAAAO....","...OAAAAAAO.....",
  "..OOAAAAAAOO....",".OAAAAAAAAAAO...",".OAAKAAAAKAAO...",".OAAAAAAAAAAO...",".OAAAAAAAAAAO...",
  "..OAAAOOAAAO....","..OAAO..OAAO....","..OAO....OAO....","..OO......OO...."]},
 {p:{O:'#140d14',P:'#3a2a3a',K:'#c05a3a',S:'#c8c0b0'},r:[   // 10 Ashfall Reaper (cloaked, scythe)
  ".......OO......S","...OOOOOO.....SS","..OPPPPPPO...SSO",".OPPPPPPPPO.SSO.",".OPPKPPKPPOSSO..",
  ".OPPPPPPPPPSO...",".OPPPPPPPPPO....","..OPPPPPPPPO....","..OPPPPPPPPO....","...OPPPPPPO.....",
  "...OPPPPPPO.....","...OPPOOPPO.....","..OPPO..OPPO....","..OO......OO...."]},
 {p:{O:'#1c0f08',T:'#a5502f',E:'#ffb060',K:'#3a1a0a'},r:[   // 11 Charstep Behemoth (flaming brute)
  "..O........O....",".OEO......OEO...",".OEEO.OO.OEEO...","..OEOOTTOOEO....","...OTTTTTTTO....",
  "..OTTEETTEETO...",".OTTTTTTTTTTO...","OTTTKKTTKKTTTO..","OTTTTTTTTTTTTO..","OTTTTTTTTTTTTO..",
  ".OTTTOOOOTTTO...",".OTTO....OTTO...",".OTO......OTO...",".OO........OO..."]},
 {p:{O:'#2a1e0a',L:'#e0a83a',G:'#fff4c8',E:'#c86a1a'},r:[   // 12 Glowing Horror (light being)
  "...O..OO..O.....","..OLO.OLO.OL....","...OLLLLLLO.....","..OLGGGGGGLO....",".OLGGEGGEGGLO...",
  ".OLGGGGGGGGLO...",".OLGGGGGGGGLO...",".OLGGEGGEGGLO...","..OLGGGGGGLO....","...OLLLLLLO.....",
  "..OLO.OO.OLO....",".OLO..OO..OLO...",".OO........OO..."]},
 {p:{O:'#2a1008',W:'#e0552a',E:'#ffd39a',K:'#5a1a08'},r:[   // 13 Emberflow Wyrm (serpent)
  ".......OOOO.....","....OOOWWWWO....","..OOWWWWWWWWO...",".OWWWWWWWWWWWO..","OWWEWWWWWWWWWO..",
  "OWWWWWWKKWWWWO..",".OWWWWKKKKWWO...","..OWWWWWWWWO....","...OOWWWWOO.....",".....OWWO.......",
  "....OWWWWO......","...OWWOOWWO.....","..OWO....OWO....","..OO......OO...."]},
 {p:{O:'#2a0d05',F:'#ff7a3d',E:'#fff0c0',K:'#7a1a08',H:'#e0552a'},r:[ // 14 Heart Devourer (core demon)
  ".O..OOOO..O.....","OHO.OFFFFO.OHO..","OHHOFFFFFFOHHO..",".OHOFFFFFFOHO...","..OFFEFFEFFO....",
  "..OFFFFFFFFO....",".OFFFKKKKFFFO...",".OFFFFFFFFFFO...",".OFFFFFFFFFFO...","..OFFFFFFFFO....",
  "..OFFOOOOFFO....",".OFFO....OFFO...",".OHO......OHO...",".OO........OO.."]},
];
const sprBoss=BOSS_ART.map(a=>makeSprite(a.r,a.p));
// themed enemy projectile
function drawEShot(s){
 if(s.pk){ const sp2=projSprite(s.pk,s.col||undefined,s.core||undefined);
   const ang=Math.atan2(s.vy,s.vx), sc=Math.max(0.75,(s.r||6)/6);
   ctx.globalAlpha=0.32; ctx.drawImage(sp2,(s.px+s.x)/2-10*sc,(s.py+s.y)/2-10*sc,20*sc,20*sc); ctx.globalAlpha=1;
   ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(ang);
   ctx.drawImage(sp2,-15*sc,-15*sc,30*sc,30*sc); ctx.restore(); return; }
 const col=s.col||'#e2604c', core=s.core||'#ffc0b0', r=s.r||6, ang=Math.atan2(s.vy,s.vx);
 ctx.globalAlpha=0.3; ctx.fillStyle=col;
 ctx.beginPath(); ctx.arc((s.px+s.x)/2,(s.py+s.y)/2,r*0.7,0,6.29); ctx.fill(); ctx.globalAlpha=1;
 if(s.shape==='diamond'){ ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(ang);
   ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(r*1.2,0); ctx.lineTo(0,r*0.8); ctx.lineTo(-r*1.2,0); ctx.lineTo(0,-r*0.8); ctx.closePath(); ctx.fill();
   ctx.fillStyle=core; ctx.fillRect(-r*0.4,-r*0.3,r*0.8,r*0.6); ctx.restore(); }
 else if(s.shape==='dart'){ ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(ang);
   ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(r*1.3,0); ctx.lineTo(-r*0.7,r*0.7); ctx.lineTo(-r*0.7,-r*0.7); ctx.closePath(); ctx.fill();
   ctx.fillStyle=core; ctx.fillRect(-r*0.1,-r*0.22,r*0.6,r*0.44); ctx.restore(); }
 else { ctx.fillStyle=col; ctx.beginPath(); ctx.arc(s.x,s.y,r,0,6.29); ctx.fill();
   ctx.fillStyle=core; ctx.beginPath(); ctx.arc(s.x,s.y,r*0.5,0,6.29); ctx.fill(); }
}

const CTHEME={
 ranger:{p:'#4f7d45',s:'#37592f'},
 pyro:{p:'#d4622a',s:'#96421c'}, knight:{p:'#7d8a99',s:'#565f6b'},
 rogue:{p:'#4a3d5c',s:'#322a40'}, assassin:{p:'#8a3548',s:'#5a2130'}, cleric:{p:'#d8cfb8',s:'#a89c7f'},
 berserker:{p:'#a83232',s:'#742020'}, warlock:{p:'#6b3d99',s:'#482968'},
 frost:{p:'#6fb8d4',s:'#4a8aa8'}, storm:{p:'#c9b23c',s:'#8f7d24'},
 hunter:{p:'#8a6a3a',s:'#64491f'},
 monk:{p:'#d49a3a',s:'#a06f1f'}, paladin:{p:'#d4b96a',s:'#a08a42'},
 necro:{p:'#5f8a4f',s:'#3f6134'}, bard:{p:'#9c4a6b',s:'#6f3049'},
 shaman:{p:'#3f8a7d',s:'#2a6157'}, dragoon:{p:'#b5652f',s:'#82461e'},
};
function mixc(a,b,t){
 const pa=parseInt(a.slice(1),16), pb=parseInt(b.slice(1),16);
 const r=Math.round(((pa>>16)&255)*(1-t)+((pb>>16)&255)*t);
 const g=Math.round(((pa>>8)&255)*(1-t)+((pb>>8)&255)*t);
 const bl=Math.round((pa&255)*(1-t)+(pb&255)*t);
 return '#'+((1<<24)|(r<<16)|(g<<8)|bl).toString(16).slice(1);
}
// ---------- detailed, animated hero models ----------
// per-class headgear + attack style give every class a distinct, animated look
const HEADGEAR={ knight:'ghelm', paladin:'circlet', cleric:'circlet',
 berserker:'horns', dragoon:'crest', ranger:'hood', hunter:'hood', rogue:'hood',
 warlock:'skull', necro:'skull', monk:'topknot', bard:'feather', assassin:'hood',
 pyro:'wizhat', frost:'wizhat', storm:'wizhat', shaman:'mask' };
const ATK_STYLE={ sword:'swing',dagger:'thrust', bow:'draw',xbow:'draw', staff:'cast',wand:'cast', fists:'thrust' };
const heroCache={};
function buildHero(cls,frame,armT){
 const CW=26, CH=34, cv=document.createElement('canvas'); cv.width=CW; cv.height=CH;
 const c=cv.getContext('2d'); c.imageSmoothingEnabled=false;
 const th=CTHEME[cls]||CTHEME.knight, arch=(CARMOR[cls]||'robe');
 const OL='#140f1a', SK='#ecc795', SKH='#f6dbac', SKD='#c2925f';
 let base=th.p, dark=th.s;
 if(arch==='plate'){ base=mixc(th.p,'#aab2bb',0.42); dark=mixc(th.s,'#5a626c',0.42); }
 else if(arch==='leather'){ base=mixc(th.p,'#8a6a3c',0.30); dark=mixc(th.s,'#4a3620',0.42); }
 const hi=mixc(base,'#ffffff',0.30), sh=mixc(dark,'#000000',0.18);
 const trim=(armT>=0?tierCol(armT):'#caa15a'), BOOT='#5c3826', BOOTD='#3f2718';
 const M='#c9d2da', Md='#7a828c', Mh='#eaeff4';
 function shp(col,x,y,w,h,h1,s1){ c.fillStyle=OL; c.fillRect(x-1,y-1,w+2,h+2);
   c.fillStyle=col; c.fillRect(x,y,w,h);
   if(h1){c.fillStyle=h1; c.fillRect(x,y,w,1); c.fillRect(x,y,1,h);}
   if(s1){c.fillStyle=s1; c.fillRect(x,y+h-1,w,1); c.fillRect(x+w-1,y,1,h);} }
 function px(col,x,y,w,h){ c.fillStyle=col; c.fillRect(x,y,w,h); }
 const lF=frame===1?1:0, rF=frame===2?1:0;
 // legs / robe
 if(arch==='robe'){ shp(dark,6,22,14,9,hi,sh); px(mixc(dark,'#000',0.25),6,29,14,2);
   px(trim,6,23,14,1); shp(BOOT,9,29+lF,3,3,null,BOOTD); shp(BOOT,14,29+rF,3,3,null,BOOTD); }
 else { shp(dark,8,24,4,6,hi,sh); shp(BOOT,8,29+lF,4,3,null,BOOTD);
   shp(dark,14,24,4,6,hi,sh); shp(BOOT,14,29+rF,4,3,null,BOOTD); }
 // arms + hands
 shp(base,4,16,3,7,hi,sh); px(SK,4,22,3,2);
 shp(base,19,16,3,7,hi,sh); px(SK,19,22,3,2);
 // torso
 shp(base,7,15,12,10,hi,sh); px(trim,12,16,2,7); px(sh,7,24,12,1);
 if(arch==='plate'){ shp(hi,3,14,5,4,mixc(hi,'#fff',0.3),sh); shp(hi,18,14,5,4,mixc(hi,'#fff',0.3),sh); px(trim,10,16,6,1); }
 else if(arch==='leather'){ px(BOOTD,8,16,10,1); px(BOOTD,9,17,8,1); px(trim,7,23,12,1); }
 else { px(trim,7,20,12,1); shp(base,3,16,3,6,hi,sh); shp(base,20,16,3,6,hi,sh); }
 px(trim,12,18,2,2); px(mixc(trim,'#fff',0.4),12,18,1,1);
 // neck + head + eyes
 px(SKD,11,13,4,2); shp(SK,9,7,8,7,SKH,SKD); px('#140f1a',11,10,1,2); px('#140f1a',14,10,1,2); px(SKD,9,12,8,1);
 // headgear
 const hg=HEADGEAR[cls]||'helm';
 if(hg==='helm'){ shp(M,9,5,8,4,Mh,Md); px(Md,12,8,2,4); }
 else if(hg==='ghelm'){ shp(M,9,4,8,9,Mh,Md); px('#0c0a12',10,9,6,1); px(Md,9,4,8,1); }
 else if(hg==='circlet'){ px(trim,9,7,8,1); shp(trim,11,5,4,2,mixc(trim,'#fff',0.4),null);
   if(cls==='paladin'){ px('#ffe9b0',9,3,8,1); px('#ffe9b0',10,2,6,1); } }
 else if(hg==='horns'){ shp(M,9,6,8,4,Mh,Md); shp('#e8e0d0',6,2,3,5,'#fff',Md); shp('#e8e0d0',17,2,3,5,'#fff',Md); }
 else if(hg==='crest'){ shp(M,9,6,8,4,Mh,Md); shp(base,12,1,2,6,hi,sh); px(trim,12,1,2,2); }
 else if(hg==='hood'){ shp(dark,7,4,12,8,mixc(dark,'#fff',0.18),mixc(dark,'#000',0.2)); px(base,9,6,8,3); px('#0c0a12',10,10,6,2); }
 else if(hg==='cap'){ shp(dark,8,6,10,3,hi,sh); px(dark,9,5,8,1); }
 else if(hg==='topknot'){ px(SKD,9,6,8,2); shp(dark,11,2,4,4,hi,sh); }
 else if(hg==='feather'){ shp(dark,8,6,10,3,hi,sh); shp(trim,17,1,2,6,mixc(trim,'#fff',0.3),sh); }
 else if(hg==='wizhat'){ shp(dark,5,9,16,2,mixc(dark,'#fff',0.2),sh); shp(base,9,4,8,6,hi,sh); shp(base,10,1,5,4,hi,sh); px(trim,10,3,5,1); px(trim,11,0,3,2); }
 else if(hg==='skull'){ shp(dark,7,4,12,8,mixc(dark,'#fff',0.15),mixc(dark,'#000',0.2)); px('#e8e0d0',10,8,6,4); px('#140f1a',11,9,1,2); px('#140f1a',14,9,1,2); }
 else if(hg==='mask'){ shp('#8a5a34',9,6,8,7,'#a8794a','#5c3a1e'); px(trim,10,8,2,3); px(trim,14,8,2,3); px('#e8e0d0',12,7,2,1); }
 return cv;
}
function heroSprite(look,frame){
 const cls=look.cls||'knight', at=look.armT|0, k=cls+'_'+frame+'_'+at;
 if(!heroCache[k]) heroCache[k]=buildHero(cls,frame,at);
 return heroCache[k];
}
// pick the current animation frame for an enemy: attack burst (e.animAtk timer) else idle loop
function _enemyFrame(anim,e,pn){
  if(!anim) return null;
  const atk = (e.animAtk>0 && anim.attack && anim.attack.length && anim.attack[0].naturalWidth);
  const set = atk ? anim.attack : anim.idle;
  if(!set || !set.length || !set[0].naturalWidth) return null;
  let idx;
  if(atk) idx = Math.min(set.length-1, Math.floor((1-e.animAtk/0.5)*set.length));
  else idx = Math.floor(pn*7 + e.x*0.05) % set.length;
  return set[idx];
}
function drawEnemySprite(e,pn){
 const flip = player.x < e.x;
 // A DORMANT ambusher is drawn dark and still (a coiled shape, no bob) so the ambush is a
 // fair surprise you could have spotted, not a cheap hit (rule 5b). It wakes on approach.
 if(e.dormant){ ctx.save(); ctx.globalAlpha=0.5;
   ctx.fillStyle='rgba(20,16,24,0.85)';
   ctx.beginPath(); ctx.ellipse(e.x,e.y+e.r*0.4,e.r*0.95,e.r*0.7,0,0,6.29); ctx.fill();
   ctx.fillStyle='rgba(200,60,60,'+(0.25+0.2*Math.sin(pn*3+e.x)).toFixed(2)+')';   // faint watching glint
   ctx.beginPath(); ctx.arc(e.x-3,e.y,1.6,0,6.29); ctx.arc(e.x+3,e.y,1.6,0,6.29); ctx.fill();
   ctx.restore(); return; }
 if(e.type==='N'){ // dungeon objective node: pulsing dream-heart
   const t=performance.now()/1000, pu=1+Math.sin(t*5+e.x)*0.15;
   ctx.save(); ctx.globalCompositeOperation='lighter';
   const g2=ctx.createRadialGradient(e.x,e.y,2,e.x,e.y,e.r*2.2);
   g2.addColorStop(0,e.col); g2.addColorStop(1,'rgba(0,0,0,0)');
   ctx.globalAlpha=0.45; ctx.fillStyle=g2;
   ctx.beginPath(); ctx.arc(e.x,e.y,e.r*2.2,0,6.29); ctx.fill(); ctx.restore(); ctx.globalAlpha=1;
   ctx.fillStyle=e.col; ctx.beginPath(); ctx.arc(e.x,e.y,e.r*0.8*pu,0,6.29); ctx.fill();
   ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(e.x,e.y,e.r*0.34*pu,0,6.29); ctx.fill();
   return; }
 const bd=enemyBand(e);
 if(e.type==='c'){ const fr=_enemyFrame((typeof _mobAnim!=='undefined')?_mobAnim.c:null,e,pn);
   if(fr){ const t=tintedMob(fr,bd); blit(t,e.x,e.y+Math.sin(pn*6+e.x)*1,(e.r*2.7)/t.width,flip); }
   else { const im=(typeof _mobHound!=='undefined')?_mobHound:null;
     if(im&&im.naturalWidth){ const t=tintedMob(im,bd); blit(t,e.x,e.y+Math.sin(pn*6+e.x)*1,(e.r*2.7)/t.width,flip); }
     else blit(sprHound,e.x,e.y+Math.sin(pn*6+e.x)*1,2.0,flip); } }
 else if(e.type==='s'){ const fr=_enemyFrame((typeof _mobAnim!=='undefined')?_mobAnim.s:null,e,pn);
   if(fr){ const t=tintedMob(fr,bd); blit(t,e.x,e.y+Math.sin(pn*3+e.x)*1.5,(e.r*2.7)/t.width,flip); }
   else { const im=(typeof _mobCultist!=='undefined')?_mobCultist:null;
     if(im&&im.naturalWidth){ const t=tintedMob(im,bd); blit(t,e.x,e.y+Math.sin(pn*3+e.x)*1.5,(e.r*2.7)/t.width,flip); }
     else blit(sprCult,e.x,e.y+Math.sin(pn*3+e.x)*1.5,2.1,flip); } }
 else { // awakened dungeon bosses use their spectral sprite when it exists
   if(e.awk && typeof _awakImg!=='undefined'){ const ai=_awakImg[e.ring];
     if(ai&&ai.complete&&ai.naturalWidth){ blit(ai,e.x,e.y+Math.sin(pn*2)*1.5,(e.r*2.6)/ai.width,flip); return; } }
   const fr=_enemyFrame((typeof _bossAnim!=='undefined')?_bossAnim[e.ring]:null,e,pn);
   if(fr) blit(fr,e.x,e.y+Math.sin(pn*2)*1.5,(e.r*2.6)/fr.width,flip);
   else { const im=(typeof _bossImg!=='undefined')?_bossImg[e.ring]:null;
     if(im&&im.naturalWidth) blit(im,e.x,e.y+Math.sin(pn*2)*1.5,(e.r*2.6)/im.width,flip);
     else { const sp=(e.wb && sprBoss[e.ring])?sprBoss[e.ring]:sprTyrant;
       blit(sp,e.x,e.y+Math.sin(pn*2)*1.5,(e.r*2.6)/sp.width,flip); } } }
}
const ENAME={c:'Cinder Hound',s:'Ashbound Cultist',B:'CINDER TYRANT'};
// Zone-themed mob variants (roadmap #3 polish): same base art, per-band name +
// cached hue wash so packs read native to their zone (band 5 = base cinder look).
const MOBNAME={
 c:['Briar Hound','Mist Hound','Bog Hound','Stone Hound','Crag Hound','Cinder Hound','Ash Hound','Char Hound','Molten Hound'],
 s:['Grove Cultist','Fog Cultist','Mire Cultist','Vault Cultist','Wind Cultist','Ember Cultist','Ashbound Cultist','Flame Cultist','Core Cultist'],
};
const MOBTINT=['rgba(96,168,72,0.30)','rgba(120,190,160,0.30)','rgba(128,148,64,0.30)',
 'rgba(148,150,160,0.30)','rgba(186,196,206,0.30)',null,'rgba(150,138,132,0.30)',
 'rgba(255,116,44,0.28)','rgba(255,176,64,0.28)'];
function enemyBand(e){
 if(curRoom&&curRoom.rings) return grvBandXY(e.x/TILE,e.y/TILE);
 if(curRoom&&typeof curRoom.ring==='number') return curRoom.ring;
 return -1; }
function mobLabel(e){ const t=MOBNAME[e.type]; if(!t) return ENAME[e.type]||'';
 const bd=enemyBand(e); return (bd>=0&&t[bd])||ENAME[e.type]||''; }
const _mobTintCache=new Map();
function tintedMob(im,bd){ const tint=(bd>=0)?MOBTINT[bd]:null; if(!tint) return im;
 const k=im.src+'|'+bd; let cv=_mobTintCache.get(k);
 if(!cv){ cv=document.createElement('canvas'); cv.width=im.naturalWidth; cv.height=im.naturalHeight;
  const c=cv.getContext('2d'); c.imageSmoothingEnabled=false; c.drawImage(im,0,0);
  c.globalCompositeOperation='source-atop'; c.fillStyle=tint; c.fillRect(0,0,cv.width,cv.height);
  _mobTintCache.set(k,cv); }
 return cv; }
// ---------- hub / world decor ----------
// HP/MP liquid orb: dark glass + colored fill (bottom->frac) inside the ornate frame
function drawOrb(cx,cy,R,frac,c1,c2,txt,glow){
  frac=Math.max(0,Math.min(1,frac||0));
  const rIn=R*0.56;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx,cy,rIn,0,6.29); ctx.clip();
  ctx.fillStyle='#0b0910'; ctx.fillRect(cx-rIn,cy-rIn,rIn*2,rIn*2);
  const surf=cy+rIn-2*rIn*frac;
  const lg=ctx.createLinearGradient(0,surf,0,cy+rIn);
  lg.addColorStop(0,c1); lg.addColorStop(1,c2);
  ctx.fillStyle=lg; ctx.fillRect(cx-rIn,surf,rIn*2,cy+rIn-surf);
  if(frac>0.02&&frac<0.99){ ctx.fillStyle='rgba(255,255,255,0.22)';
    ctx.beginPath(); ctx.moveTo(cx-rIn,surf);
    for(let x=-rIn;x<=rIn;x+=3) ctx.lineTo(cx+x,surf+Math.sin(performance.now()/280+x*0.14)*1.8);
    ctx.lineTo(cx+rIn,surf+3); ctx.lineTo(cx-rIn,surf+3); ctx.closePath(); ctx.fill(); }
  const gs=ctx.createRadialGradient(cx-rIn*0.35,cy-rIn*0.4,1,cx-rIn*0.35,cy-rIn*0.4,rIn*1.1);
  gs.addColorStop(0,'rgba(255,255,255,0.20)'); gs.addColorStop(0.6,'rgba(255,255,255,0)');
  ctx.fillStyle=gs; ctx.fillRect(cx-rIn,cy-rIn,rIn*2,rIn*2);
  ctx.restore();
  if(glow){ ctx.strokeStyle='rgba(255,201,77,'+(0.4+Math.sin(performance.now()/200)*0.35).toFixed(2)+')';
    ctx.lineWidth=3; ctx.beginPath(); ctx.arc(cx,cy,R*0.9,0,6.29); ctx.stroke(); }
  if(_uiOrb&&_uiOrb.complete&&_uiOrb.naturalWidth) ctx.drawImage(_uiOrb,cx-R,cy-R,R*2,R*2);
  else { ctx.strokeStyle='#c9a24d'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(cx,cy,R*0.82,0,6.29); ctx.stroke(); }
  // auto-fit the % label inside the glass (never touching the ornate ring)
  let fs=Math.round(R*0.4); ctx.font='bold '+fs+'px "Pixelify Sans",monospace';
  const maxW=R*0.95, tw=ctx.measureText(txt).width;
  if(tw>maxW){ fs=Math.max(8,Math.floor(fs*maxW/tw)); ctx.font='bold '+fs+'px "Pixelify Sans",monospace'; }
  ctx.textAlign='center';
  const ty2=cy+Math.round(fs*0.35);
  ctx.fillStyle='rgba(0,0,0,0.9)'; ctx.fillText(txt,cx+1,ty2+1);
  ctx.fillStyle='#fff'; ctx.fillText(txt,cx,ty2); ctx.textAlign='left';
}
// Loot bag: rarity-signaled art + glow + light beam + floating label.
// rar 0 common (drab sack, no glow) climbing to a tall radiant beam for Mythical.
function drawLootBag(lb,pn){
  const isPot=lb.item&&lb.item.k==='pot';
  const rar=isPot?0:((lb.item&&lb.item.rar)||0);
  const col=isPot?'#7dc47a':(RAR_COL[rar]||'#cfc8bd');
  const t=performance.now()/1000, pulse=0.5+Math.sin(t*2.4+lb.x*0.05)*0.5;
  if(rar>=1||isPot){ const gr=14+rar*7;
    const g=ctx.createRadialGradient(lb.x,lb.y+6,1,lb.x,lb.y+6,gr);
    g.addColorStop(0,col+(rar>=3?'aa':'66')); g.addColorStop(1,col+'00');
    ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(lb.x,lb.y+6,gr,gr*0.5,0,0,6.29); ctx.fill(); }
  if(rar>=2){ const bh=40+rar*22, bw=6+rar*1.5, a=(0.10+rar*0.05)*(0.6+pulse*0.4);
    const bg=ctx.createLinearGradient(0,lb.y-bh,0,lb.y+4);
    const ah=Math.round(a*180).toString(16).padStart(2,'0');
    bg.addColorStop(0,col+'00'); bg.addColorStop(0.65,col+ah); bg.addColorStop(1,col+'00');
    ctx.fillStyle=bg; ctx.beginPath();
    ctx.moveTo(lb.x-bw*0.35,lb.y-bh); ctx.lineTo(lb.x+bw*0.35,lb.y-bh);
    ctx.lineTo(lb.x+bw,lb.y+2); ctx.lineTo(lb.x-bw,lb.y+2); ctx.closePath(); ctx.fill(); }
  shadow(lb.x,lb.y+8,10);
  const useChest=rar>=3;
  const img=useChest?(typeof _lootChest!=='undefined'?_lootChest:null):(typeof _lootSack!=='undefined'?_lootSack:null);
  const bob=rar>=2?Math.sin(t*2.2+lb.x*0.03)*1.5:0;
  if(img&&img.complete&&img.naturalWidth){ const sc=(useChest?26:22)/img.naturalWidth;
    ctx.save(); ctx.imageSmoothingEnabled=false;
    if(rar>=4){ ctx.shadowColor=col; ctx.shadowBlur=10*pulse; }
    ctx.drawImage(img,Math.round(lb.x-img.naturalWidth*sc/2),Math.round(lb.y-img.naturalHeight*sc/2+bob),img.naturalWidth*sc,img.naturalHeight*sc);
    ctx.restore();
  } else { blit(sprBag,lb.x,lb.y+bob,2.0,false); }
  if(!useChest){ ctx.fillStyle=col; ctx.fillRect(lb.x-3,lb.y-2+bob,6,6); }
  if(rar>=2){ ctx.font='bold 10px "Pixelify Sans",monospace'; ctx.textAlign='center';
    const ly=lb.y-20+bob;
    ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillText(RAR_NAMES[rar],lb.x+1,ly+1);
    ctx.fillStyle=col; ctx.fillText(RAR_NAMES[rar],lb.x,ly); ctx.textAlign='left'; }
}
// Big reusable INTERACT button (screen space) — anchored above the interactable, clamped on-screen.
function portalPromptRect(){ if(typeof portalPrompt==='undefined'||!portalPrompt) return null;
  const w=Math.round(Math.max(150,Math.min(238,W*0.34))*UIS), h=Math.round(w*0.403);  // match plate 216x87
  const sp=w2s(portalPrompt.x,portalPrompt.y);    // through the full camera transform (incl. rotation)
  const cx=Math.max(w/2+8,Math.min(W-w/2-8,sp.x));
  const cy=Math.max(h/2+34,sp.y - h*0.6 - 62);
  return {cx,cy,w,h,ctx:portalPrompt.ctx||''}; }
function drawPortalPrompt(){ const b=portalPromptRect(); if(!b) return;
  const x=b.cx-b.w/2, y=b.cy-b.h/2; const pulse=0.6+Math.sin(performance.now()/230)*0.3;
  ctx.save();
  // soft amber glow behind the button
  const gg=ctx.createRadialGradient(b.cx,b.cy,4,b.cx,b.cy,b.w*0.62);
  gg.addColorStop(0,'rgba(255,180,70,'+(0.18*pulse+0.1).toFixed(2)+')'); gg.addColorStop(1,'rgba(255,180,70,0)');
  ctx.fillStyle=gg; ctx.fillRect(b.cx-b.w,b.cy-b.h,b.w*2,b.h*2);
  // plate: PixelLab art if loaded, else a styled fallback
  if(typeof _btnInteract!=='undefined' && _btnInteract && _btnInteract.complete && _btnInteract.naturalWidth){
    ctx.imageSmoothingEnabled=false; ctx.drawImage(_btnInteract,x,y,b.w,b.h);
  } else {
    ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(x,y,b.w,b.h,10); else ctx.rect(x,y,b.w,b.h);
    ctx.fillStyle='rgba(20,15,26,0.94)'; ctx.fill();
    ctx.lineWidth=2.5; ctx.strokeStyle='rgba(255,201,77,'+pulse.toFixed(2)+')'; ctx.stroke();
  }
  // INTERACT label (crisp, dark for legibility on the gold plate) — reusable; swap the
  // string for other interactions later.
  const plate=(typeof _btnInteract!=='undefined' && _btnInteract && _btnInteract.complete && _btnInteract.naturalWidth);
  const fs=Math.round(b.h*0.34);
  ctx.font='bold '+fs+'px "Pixelify Sans",monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
  const lbl=(typeof inputMode!=='undefined' && inputMode==='pc')?'[E] INTERACT':'INTERACT';
  ctx.fillStyle=plate?'rgba(255,232,180,0.6)':'rgba(0,0,0,0.85)'; ctx.fillText(lbl,b.cx,b.cy-1);   // highlight
  ctx.fillStyle=plate?'#3a2208':'#ffe6ad'; ctx.fillText(lbl,b.cx,b.cy+1);                          // main
  ctx.restore(); ctx.textAlign='left'; ctx.textBaseline='alphabetic';
}
function hitPortalPrompt(sx,sy){ const b=portalPromptRect(); if(!b) return false;
  return Math.abs(sx-b.cx)<=b.w/2+10 && Math.abs(sy-b.cy)<=b.h/2+12; }
function drawPillar(pl){
  const un=(typeof pillarUnlocked==='function')&&pillarUnlocked(pl.band);
  const t=performance.now()/1000, pulse=0.55+0.45*Math.sin(t*3);
  const img=(typeof _waypointImg!=='undefined'&&_waypointImg&&_waypointImg.complete&&_waypointImg.naturalWidth)?_waypointImg:null;
  if(img){
    const w=TILE*1.55, h=w*img.height/img.width, gy=pl.y-h*0.55;
    // radiant light-magic aura (bright when unlocked, dim when dormant), + a couple of orbiting motes
    ctx.save(); ctx.globalCompositeOperation='lighter';
    const rad=un?TILE*1.5:TILE*0.7, ga=(un?0.34*pulse:0.12);
    const g=ctx.createRadialGradient(pl.x,gy,1,pl.x,gy,rad);
    g.addColorStop(0,'rgba(255,244,200,'+ga.toFixed(3)+')'); g.addColorStop(0.5,'rgba(210,190,255,'+(ga*0.6).toFixed(3)+')'); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(pl.x,gy,rad,0,6.29); ctx.fill();
    if(un) for(let i=0;i<3;i++){ const a=t*1.4+i*2.09, rr=TILE*0.6;
      ctx.fillStyle='rgba(255,250,225,'+(0.5+0.4*Math.sin(t*4+i)).toFixed(3)+')';
      ctx.fillRect(pl.x+Math.cos(a)*rr-1, gy+Math.sin(a)*rr*0.6-1, 2, 2); }
    ctx.restore();
    ctx.fillStyle='rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(pl.x,pl.y-2,w*0.32,w*0.12,0,0,6.29); ctx.fill();
    ctx.imageSmoothingEnabled=false;
    ctx.globalAlpha=un?1:0.7; ctx.drawImage(img, pl.x-w/2, pl.y-h, w, h); ctx.globalAlpha=1;
  } else {
    const col=un?'#c9a24d':'#5a6070', gy=pl.y-24;
    ctx.fillStyle='#241f2b'; ctx.fillRect(pl.x-7,pl.y-4,14,20);
    ctx.fillStyle='#3a3442'; ctx.fillRect(pl.x-6,pl.y-22,12,20);
    ctx.fillStyle='#4a4452'; ctx.fillRect(pl.x-6,pl.y-22,12,2);
    const rad=un?16:9;
    const g=ctx.createRadialGradient(pl.x,gy,1,pl.x,gy,rad);
    g.addColorStop(0,col); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.globalAlpha=un?0.85*pulse:0.4; ctx.fillStyle=g;
    ctx.beginPath(); ctx.arc(pl.x,gy,rad,0,6.29); ctx.fill(); ctx.globalAlpha=1;
    ctx.fillStyle=col; ctx.beginPath(); ctx.arc(pl.x,gy,3.5,0,6.29); ctx.fill();
  }
  ctx.font='9px monospace'; ctx.textAlign='center';
  ctx.fillStyle=un?'#ffd07a':'#8a8290';
  ctx.fillText(un?'WAYPOINT':'✦ dormant', pl.x, pl.y+28); ctx.textAlign='left';
}
function drawPortal(pt){
 const t=performance.now()/1000, col=pt.col||'#c07ad4', R=pt.big?36:20;
 // destination-themed portal art in the hub (smaller than the shared arch); shared arch elsewhere
 const dkey=pt.to==='G'?'realm':pt.to==='COSMETICS'?'cos':pt.to==='VAULT'?'vault':pt.to==='GUILD'?'guild':pt.to==='ARENA'?'arena':null;
 const ded=(dkey&&typeof _hearth!=='undefined')?_hearth['portal_'+dkey]:null;
 const hasDed=!!(ded&&ded.complete&&ded.naturalWidth);
 const pimg=hasDed?ded:(typeof _hearth!=='undefined')?_hearth.portal:null;
 // colored ground glow (behind the arch)
 const g=ctx.createRadialGradient(pt.x,pt.y,2,pt.x,pt.y,R*1.9);
 g.addColorStop(0,col); g.addColorStop(0.45,col+'66'); g.addColorStop(1,'rgba(0,0,0,0)');
 ctx.globalAlpha=(0.5+Math.sin(t*3)*0.12)*(pimg&&pimg.complete&&pimg.naturalWidth?0.7:1); ctx.fillStyle=g;
 ctx.beginPath(); ctx.arc(pt.x,pt.y,R*1.9,0,6.29); ctx.fill(); ctx.globalAlpha=1;
 if(pimg&&pimg.complete&&pimg.naturalWidth){
   const w=hasDed?(pt.big?88:60):(pt.big?106:76), h=pimg.naturalHeight*(w/pimg.width);
   ctx.imageSmoothingEnabled=false; ctx.drawImage(pimg,Math.round(pt.x-w/2),Math.round(pt.y-h*0.64),Math.round(w),Math.round(h));
   // shared arch only: tint the vortex toward the portal's colour (dedicated art has its own)
   if(!hasDed){
   ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=0.32+Math.sin(t*3)*0.16;
   const vy=pt.y-h*0.14, vg=ctx.createRadialGradient(pt.x,vy,1,pt.x,vy,w*0.32);
   vg.addColorStop(0,col); vg.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=vg;
   ctx.beginPath(); ctx.arc(pt.x,vy,w*0.32,0,6.29); ctx.fill(); ctx.restore(); }
 } else {
   for(let i=0;i<3;i++){ ctx.strokeStyle=col; ctx.lineWidth=pt.big?4:3; ctx.globalAlpha=0.85-i*0.22;
     ctx.beginPath(); ctx.arc(pt.x,pt.y,R-i*7+Math.sin(t*4+i*2)*3,0,6.29); ctx.stroke(); }
   ctx.globalAlpha=1;
   ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(pt.x,pt.y,pt.big?7:4,0,6.29); ctx.fill();
 }
 if(pt.label){ const ly=pt.y-R-(pt.big?26:18);
   upright(pt.x,ly,(lx,lly)=>{
   ctx.font=(pt.big?'bold 16px':'bold 12px')+' "Pixelify Sans",monospace'; ctx.textAlign='center';
   const w=ctx.measureText(pt.label).width+16;
   ctx.fillStyle='rgba(12,10,16,0.82)'; ctx.fillRect(lx-w/2,lly-12,w,17);
   ctx.strokeStyle=col; ctx.lineWidth=1; ctx.strokeRect(lx-w/2,lly-12,w,17);
   ctx.fillStyle=col; ctx.fillText(pt.label,lx,lly);
   ctx.textAlign='left'; }); }
}
// draw a PixelLab object scaled to width w with its BASE (feet) at (cx, baseY)
function drawObjBottom(img,cx,baseY,w){ if(!img||!img.complete||!img.naturalWidth) return false;
 const h=img.naturalHeight*(w/img.naturalWidth); ctx.imageSmoothingEnabled=false;
 ctx.drawImage(img,Math.round(cx-w/2),Math.round(baseY-h),Math.round(w),Math.round(h)); return true; }
function drawFountain(x,y){ const t=performance.now()/1000;
 const fimg=(typeof _hearth!=='undefined')?_hearth.fountain:null;
 if(fimg&&fimg.complete&&fimg.naturalWidth){ const w=132, h=fimg.naturalHeight*(w/fimg.naturalWidth);
   ctx.fillStyle='rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(x,y+h*0.3,38,13,0,0,6.29); ctx.fill();
   ctx.imageSmoothingEnabled=false; ctx.drawImage(fimg,Math.round(x-w/2),Math.round(y-h/2),Math.round(w),Math.round(h)); return; }
 ctx.fillStyle='rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x,y+10,30,11,0,0,6.29); ctx.fill();
 ctx.fillStyle='#6d6560'; ctx.beginPath(); ctx.ellipse(x,y+4,22,9,0,0,6.29); ctx.fill();
 ctx.fillStyle='#847c76'; ctx.fillRect(x-7,y-20,14,24);
 ctx.fillStyle='#9a928c'; ctx.beginPath(); ctx.ellipse(x,y-20,10,4,0,0,6.29); ctx.fill();
 ctx.strokeStyle='rgba(150,210,235,0.7)'; ctx.lineWidth=2;
 for(let i=0;i<6;i++){ const a=t*1.6+i*Math.PI/3;
   ctx.beginPath(); ctx.moveTo(x,y-22);
   ctx.quadraticCurveTo(x+Math.cos(a)*20,y-34,x+Math.cos(a)*30,y-2); ctx.stroke(); }
 ctx.fillStyle='#bfe3ef'; ctx.beginPath(); ctx.arc(x,y-26+Math.sin(t*4)*2,3.5,0,6.29); ctx.fill();
}
function drawSign(x,y,txt){
 ctx.fillStyle='#4a3524'; ctx.fillRect(x-3,y-2,6,24);
 ctx.fillStyle='#5c3f28'; ctx.fillRect(x-32,y-26,64,22);
 ctx.strokeStyle='#3a2a1c'; ctx.lineWidth=2; ctx.strokeRect(x-32,y-26,64,22);
 ctx.fillStyle='#e8d8c0'; ctx.font='9px "Pixelify Sans",monospace'; ctx.textAlign='center';
 const words=(txt||'').split(' '); let line='', lines=[];
 for(const wd of words){ if((line+wd).length>13){lines.push(line.trim());line=wd+' ';} else line+=wd+' '; }
 if(line.trim())lines.push(line.trim());
 lines.slice(0,3).forEach((ln,i)=>ctx.fillText(ln,x,y-16+i*9));
 ctx.textAlign='left';
}
function drawChest(x,y){
 ctx.fillStyle='#5c3f28'; ctx.fillRect(x-11,y-6,22,14);
 ctx.fillStyle='#74543a'; ctx.beginPath(); ctx.moveTo(x-11,y-6); ctx.lineTo(x,y-15); ctx.lineTo(x+11,y-6); ctx.closePath(); ctx.fill();
 ctx.fillStyle='#e8b34b'; ctx.fillRect(x-2,y-4,4,7);
 ctx.strokeStyle='#3a2a1c'; ctx.lineWidth=1; ctx.strokeRect(x-11,y-6,22,14);
}
function drawBanner(x,y){
 ctx.fillStyle='#7a3f22'; ctx.fillRect(x-2,y,4,44);
 ctx.fillStyle='#8a2c2c'; ctx.beginPath();
 ctx.moveTo(x-18,y); ctx.lineTo(x+18,y); ctx.lineTo(x+18,y+36); ctx.lineTo(x,y+28); ctx.lineTo(x-18,y+36); ctx.closePath(); ctx.fill();
 ctx.fillStyle='#e8b34b'; ctx.beginPath(); ctx.arc(x,y+15,6,0,6.29); ctx.fill();
}
function drawStall(np){ const x=np.x, y=np.y, awn=np.awn||'#b5482f';
 ctx.fillStyle='#3a2a1c'; ctx.fillRect(x-34,y-22,5,44); ctx.fillRect(x+29,y-22,5,44);
 ctx.fillStyle='#4a3524'; ctx.fillRect(x-32,y-8,64,24);
 ctx.fillStyle='#3a2a1c'; ctx.fillRect(x-32,y-8,64,3);
 ctx.fillStyle='#5c3f28'; ctx.fillRect(x-36,y+16,72,11);
 ctx.fillStyle='#74543a'; ctx.fillRect(x-36,y+16,72,3);
 ctx.fillStyle='#2a1c12'; ctx.fillRect(x-38,y-30,76,4);
 for(let i=0;i<9;i++){ ctx.fillStyle=i%2?awn:'#efe3d0'; ctx.fillRect(x-36+i*8,y-26,8,10);
   ctx.beginPath(); ctx.moveTo(x-36+i*8,y-16); ctx.lineTo(x-32+i*8,y-11); ctx.lineTo(x-28+i*8,y-16); ctx.closePath(); ctx.fill(); }
}
function drawShopSign(np){ const x=np.x, sy=np.y-96;
 ctx.textAlign='center'; ctx.font='bold 13px "Pixelify Sans",monospace';
 const label=np.name.toUpperCase();
 const w=Math.max(ctx.measureText(label).width,32)+20;
 ctx.strokeStyle='#5a5250'; ctx.lineWidth=1; ctx.beginPath();
 ctx.moveTo(x-w/2+7,sy-13); ctx.lineTo(x-w/2+7,sy-20); ctx.moveTo(x+w/2-7,sy-13); ctx.lineTo(x+w/2-7,sy-20); ctx.stroke();
 ctx.fillStyle='rgba(20,14,9,0.92)'; ctx.fillRect(x-w/2,sy-13,w,30);
 ctx.strokeStyle=np.awn||'#7a4a1e'; ctx.lineWidth=2; ctx.strokeRect(x-w/2,sy-13,w,30);
 ctx.fillStyle='#ffd07a'; ctx.fillText(label,x,sy);
 ctx.font='9px monospace'; ctx.fillStyle='#cfc8bd'; ctx.fillText(np.role,x,sy+12);
 ctx.textAlign='left';
}
// Boss lairs — interior dressing for the tile-built compounds: a den centrepiece at the
// back wall plus themed corner decorations. The walls/floor themselves are drawn as tiles.
function drawLairs(){
  const R=curRoom; if(!R||!R.rings||R.dungeon||R.town||!R.lairs) return;
  if(typeof _lair==='undefined') return;
  ctx.imageSmoothingEnabled=false;
  for(const b in R.lairs){ const L=R.lairs[b];
    // corner decorations (bones, mushrooms, lava pools, braziers…)
    const dec=(typeof _lairDec!=='undefined')?_lairDec[b]:null;
    if(dec) for(const d of L.decos){ const im=dec[d.i]; if(im&&im.naturalWidth){
      const w=TILE*1.1, h=w*im.height/im.width; ctx.drawImage(im, d.x-w/2, d.y-h*0.72, w, h); } }
    // den centrepiece (the exterior lair art, reused as an interior back-wall feature)
    const cp=_lair[b];
    if(cp&&cp.naturalWidth){ const w=TILE*3.1, h=w*cp.height/cp.width;
      ctx.fillStyle='rgba(0,0,0,0.30)'; ctx.beginPath(); ctx.ellipse(L.sprite.x,L.sprite.y+8,w*0.30,w*0.10,0,0,6.29); ctx.fill();
      ctx.drawImage(cp, L.sprite.x-w/2, L.sprite.y+12-h, w, h); }
  }
}
// The infection portal — the corrupting rift landmark on the far shore (lore only, no
// interaction). Base-anchored like a lair den, with a pulsing violet ground-glow beneath it.
function drawWorldFeatures(){
  const R=curRoom; if(!R||!R.rings||!R.rings.radial||R.dungeon||R.town) return;
  const P=R.rings.portal; if(!P) return;
  if(typeof _portalImg==='undefined'||!_portalImg||!_portalImg.complete||!_portalImg.naturalWidth) return;
  ctx.imageSmoothingEnabled=false;
  const px=P.x*TILE, py=P.y*TILE, t=performance.now()/1000;
  const pul=0.5+0.5*Math.sin(t*1.6);
  // ground bloom of corruption
  ctx.save(); ctx.globalCompositeOperation='lighter';
  const gr=ctx.createRadialGradient(px,py,4,px,py,TILE*3.6);
  gr.addColorStop(0,'rgba(150,40,180,'+(0.20+pul*0.14).toFixed(3)+')');
  gr.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=gr; ctx.beginPath(); ctx.arc(px,py,TILE*3.6,0,6.29); ctx.fill();
  ctx.restore();
  const w=TILE*5.0, h=w*_portalImg.height/_portalImg.width, RISE=TILE*1.6;  // lift the rift so it stands within the ring
  ctx.save(); ctx.translate(px,py-RISE); ctx.rotate(t*0.10);      // slow ominous swirl
  ctx.globalAlpha=0.92+pul*0.08;
  ctx.drawImage(_portalImg,-w/2,-h/2,w,h); ctx.restore();
  // The ruined stone circle: a ring of crumbling pillars around the rift, back-to-front so the
  // near ones overlap the far ones. Each was a town-portal monument, now cracked and corrupted.
  if(typeof _portalPillars!=='undefined'&&_portalPillars){
    const N=8, rx=TILE*3.6, ry=TILE*2.5;
    const ring=[]; for(let i=0;i<N;i++){ const a=t*0.02 + i*(6.2832/N);   // barely-perceptible drift
      ring.push({a, ppx:px+Math.cos(a)*rx, ppy:py+Math.sin(a)*ry, im:_portalPillars[i%_portalPillars.length]}); }
    ring.sort((A,B)=>A.ppy-B.ppy);   // painter's order: far (small y) first
    for(const p of ring){ const im=p.im; if(!im||!im.naturalWidth) continue;
      const pw=TILE*1.7, ph=pw*im.height/im.width;
      ctx.fillStyle='rgba(30,6,40,0.45)'; ctx.beginPath(); ctx.ellipse(p.ppx,p.ppy,pw*0.34,pw*0.13,0,0,6.29); ctx.fill();
      const gy=0.10+0.08*Math.sin(t*1.6+p.a*3);   // violet base glow seeping from the cracks
      ctx.save(); ctx.globalCompositeOperation='lighter';
      const pg=ctx.createRadialGradient(p.ppx,p.ppy-ph*0.3,1,p.ppx,p.ppy-ph*0.3,pw*0.7);
      pg.addColorStop(0,'rgba(150,50,190,'+gy.toFixed(3)+')'); pg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=pg; ctx.beginPath(); ctx.arc(p.ppx,p.ppy-ph*0.3,pw*0.7,0,6.29); ctx.fill();
      ctx.restore();
      ctx.drawImage(im, p.ppx-pw/2, p.ppy-ph, pw, ph); }
  }
}
function render(){
  ctx.fillStyle='#0b0a10'; ctx.fillRect(0,0,W,H);
  const roomW=curRoom.w*TILE, roomH=curRoom.h*TILE;
  const zoom=H/(viewTilesH()*TILE);
  const vw=W/zoom, vh=H/zoom;
  camX = roomW<=vw ? (roomW-vw)/2 : Math.max(0,Math.min(roomW-vw, player.x-vw/2));
  camY = roomH<=vh ? (roomH-vh)/2 : Math.max(0,Math.min(roomH-vh, player.y-vh/2));
  ctx.save(); ctx.scale(zoom,zoom);
  const rot=(typeof camRot!=='undefined')?camRot:0;
  if(rot){ ctx.translate(vw/2,vh/2); ctx.rotate(rot); ctx.translate(-vw/2,-vh/2); }
  ctx.translate(-camX,-camY);
  // visible tile range — rotated view sweeps a wider box, so use the half-diagonal
  let tx0,ty0,tx1,ty1;
  if(rot){ const ccx=camX+vw/2, ccy=camY+vh/2, hd=Math.hypot(vw,vh)/2;
    tx0=Math.max(0,Math.floor((ccx-hd)/TILE)); ty0=Math.max(0,Math.floor((ccy-hd)/TILE));
    tx1=Math.min(curRoom.w-1,Math.ceil((ccx+hd)/TILE)); ty1=Math.min(curRoom.h-1,Math.ceil((ccy+hd)/TILE));
  } else {
    tx0=Math.max(0,Math.floor(camX/TILE)); ty0=Math.max(0,Math.floor(camY/TILE));
    tx1=Math.min(curRoom.w-1,Math.ceil((camX+vw)/TILE)); ty1=Math.min(curRoom.h-1,Math.ceil((camY+vh)/TILE));
  }
  for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++) drawTileG(tx,ty);
  if(typeof drawLairs==='function') drawLairs();
  if(typeof drawWorldFeatures==='function') drawWorldFeatures();
  const pn=performance.now()/1000;
  // light sources: soft additive halos only — the FIRE itself is the sprite art
  // (brazier/lamp) plus the ember particles; no more painted orange orbs
  if(curRoom.glows) for(const gl of curRoom.glows){
    const fl=1+Math.sin(pn*9+gl.x)*0.10, warm=gl.t==='H';
    const gy2=gl.y-(warm?8:16), rr=(warm?32:24)*fl;
    ctx.save(); ctx.globalCompositeOperation='lighter';
    const gh=ctx.createRadialGradient(gl.x,gy2,2,gl.x,gy2,rr);
    gh.addColorStop(0,warm?'rgba(255,150,60,0.34)':'rgba(255,230,160,0.28)');
    gh.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=gh; ctx.beginPath(); ctx.arc(gl.x,gy2,rr,0,6.29); ctx.fill();
    ctx.restore(); }
  if(curRoom.portals) for(const pt of curRoom.portals) drawPortal(pt);
  if(curRoom.pillars) for(const pl of curRoom.pillars) drawPillar(pl);
  // dungeon objective props: essence orbs (collect) + dream seals (switch)
  if(curRoom.dungeon){
    const t9=performance.now()/1000;
    // dream decor scattered through the chambers
    if(curRoom.ddec&&typeof _dunDec!=='undefined') for(const d of curRoom.ddec){
      const im=_dunDec[d.i];
      if(im&&im.complete&&im.naturalWidth){
        ctx.fillStyle='rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(d.x,d.y+9,13,5,0,0,6.29); ctx.fill();
        drawObjBottom(im,d.x,d.y+12,38); } }
    if(curRoom.orbs) for(const o of curRoom.orbs){ if(o.got) continue;
      const bob=Math.sin(t9*3+o.x)*3;
      ctx.save(); ctx.globalCompositeOperation='lighter';
      const g3=ctx.createRadialGradient(o.x,o.y+bob,2,o.x,o.y+bob,26);
      g3.addColorStop(0,'#bfe6f5'); g3.addColorStop(1,'rgba(0,0,0,0)');
      ctx.globalAlpha=0.6; ctx.fillStyle=g3; ctx.beginPath(); ctx.arc(o.x,o.y+bob,26,0,6.29); ctx.fill();
      ctx.restore(); ctx.globalAlpha=1;
      ctx.fillStyle='#e8f6fc'; ctx.beginPath(); ctx.arc(o.x,o.y+bob,7,0,6.29); ctx.fill();
      ctx.fillStyle='#8fd0ea'; ctx.beginPath(); ctx.arc(o.x,o.y+bob,4,0,6.29); ctx.fill(); }
    // fleeing wisps (chase puzzle)
    if(curRoom.chases) for(const cz of curRoom.chases){
      const bob=Math.sin(t9*5+cz.wt)*3;
      ctx.save(); ctx.globalCompositeOperation='lighter';
      const gw=ctx.createRadialGradient(cz.x,cz.y+bob,2,cz.x,cz.y+bob,24);
      gw.addColorStop(0,'#e8f6fc'); gw.addColorStop(1,'rgba(0,0,0,0)');
      ctx.globalAlpha=0.7; ctx.fillStyle=gw; ctx.beginPath(); ctx.arc(cz.x,cz.y+bob,24,0,6.29); ctx.fill();
      ctx.restore(); ctx.globalAlpha=1;
      ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(cz.x,cz.y+bob,6,0,6.29); ctx.fill(); }
    // rune plates (simon) + grave candles — walk-over props
    if(curRoom.plates) for(const pl of curRoom.plates){
      if(pl.mode==='candles'){
        ctx.fillStyle='rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(pl.x,pl.y+8,9,4,0,0,6.29); ctx.fill();
        ctx.fillStyle='#e8e2d4'; ctx.fillRect(pl.x-3,pl.y-10,6,18);
        if(pl.on){ ctx.save(); ctx.globalCompositeOperation='lighter';
          const gc=ctx.createRadialGradient(pl.x,pl.y-14,1,pl.x,pl.y-14,16);
          gc.addColorStop(0,'#ffe08a'); gc.addColorStop(1,'rgba(0,0,0,0)');
          ctx.globalAlpha=0.8; ctx.fillStyle=gc; ctx.beginPath(); ctx.arc(pl.x,pl.y-14,16,0,6.29); ctx.fill();
          ctx.restore(); ctx.globalAlpha=1;
          ctx.fillStyle='#ffd07a'; ctx.beginPath(); ctx.arc(pl.x,pl.y-14,3.5,0,6.29); ctx.fill(); }
      } else {
        // flashing demo shows the order until the sequence is begun
        const ob=curRoom.objs&&curRoom.objs[pl.ch];
        const demo=(ob&&!ob.done&&ob.got===0)?Math.floor((ob.demoT/0.7)%4):-1;
        const flash=demo===pl.idx&&(ob.demoT%0.7)<0.4;
        ctx.fillStyle='rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(pl.x,pl.y+6,15,6,0,0,6.29); ctx.fill();
        ctx.fillStyle=pl.on?'#8a7442':flash?'#b8d8ea':'#4e4658';
        ctx.beginPath(); ctx.arc(pl.x,pl.y,13,0,6.29); ctx.fill();
        ctx.fillStyle=pl.on?'#ffd07a':flash?'#eef8ff':'#241f2e';
        ctx.beginPath(); ctx.arc(pl.x,pl.y,7,0,6.29); ctx.fill(); } }
    // gale circles (hold-to-channel)
    if(curRoom.circles) for(const cc of curRoom.circles){
      ctx.strokeStyle=cc.lit?'#bfe6f5':'#5a6a78'; ctx.lineWidth=3; ctx.globalAlpha=cc.lit?0.9:0.55;
      ctx.beginPath(); ctx.arc(cc.x,cc.y,30,0,6.29); ctx.stroke();
      if(!cc.lit&&cc.prog>0){ ctx.strokeStyle='#e8f6fc'; ctx.globalAlpha=0.9;
        ctx.beginPath(); ctx.arc(cc.x,cc.y,30,-Math.PI/2,-Math.PI/2+(cc.prog/3)*6.283); ctx.stroke(); }
      ctx.globalAlpha=1;
      if(cc.lit){ ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=0.4;
        const gg2=ctx.createRadialGradient(cc.x,cc.y,2,cc.x,cc.y,28);
        gg2.addColorStop(0,'#bfe6f5'); gg2.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=gg2; ctx.beginPath(); ctx.arc(cc.x,cc.y,28,0,6.29); ctx.fill();
        ctx.restore(); ctx.globalAlpha=1; } }
    if(curRoom.switches) for(const sw of curRoom.switches){
      ctx.fillStyle='rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(sw.x,sw.y+10,14,5,0,0,6.29); ctx.fill();
      ctx.fillStyle=sw.on?'#5a5245':'#6a6255'; ctx.fillRect(sw.x-9,sw.y-14,18,24);
      ctx.fillStyle=sw.on?'#ffd07a':'#39424e';
      ctx.beginPath(); ctx.arc(sw.x,sw.y-4,5,0,6.29); ctx.fill();
      // Titan Locks pulse while their window is open
      if(sw.mode==='timing'&&!sw.on&&typeof dunSealLit==='function'&&dunSealLit(sw.idx)){
        ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=0.55;
        const gt=ctx.createRadialGradient(sw.x,sw.y-4,2,sw.x,sw.y-4,22);
        gt.addColorStop(0,'#ffd07a'); gt.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=gt; ctx.beginPath(); ctx.arc(sw.x,sw.y-4,22,0,6.29); ctx.fill();
        ctx.restore(); ctx.globalAlpha=1; }
      // order pips: I / II / III — sequence puzzles read their number
      if(sw.idx!==undefined&&sw.mode!=='timing'){ ctx.fillStyle=sw.on?'#ffd07a':'#cfc8bd';
        for(let pi=0;pi<=sw.idx;pi++) ctx.fillRect(sw.x-6+pi*5,sw.y-22,3,6); }
      if(sw.on){ ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=0.5;
        const g4=ctx.createRadialGradient(sw.x,sw.y-4,2,sw.x,sw.y-4,20);
        g4.addColorStop(0,'#ffd07a'); g4.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=g4; ctx.beginPath(); ctx.arc(sw.x,sw.y-4,20,0,6.29); ctx.fill(); ctx.restore(); ctx.globalAlpha=1; } }
  }
  if(curRoom.decor) for(const d of curRoom.decor){ const dx=d.x*TILE, dy=d.y*TILE;
    if(d.t==='fountain') drawFountain(dx,dy);
    else if(d.t==='sign') drawSign(dx,dy,d.txt);
    else if(d.t==='chest') drawChest(dx,dy);
    else if(d.t==='banner') drawBanner(dx,dy); }
  // particles: normal pass, then additive pass for glow ones (embers, magic, sparks)
  let _anyGlow=false;
  for(const p of particles){ if(p.glow){ _anyGlow=true; continue; }
    const ml=p.maxlife||0.4, al=Math.max(0,Math.min(1,p.life/ml));
    const s=(p.sz||4)*(p.shrink?(0.4+0.6*al):1);
    ctx.globalAlpha=al; ctx.fillStyle=p.col; ctx.fillRect(p.x-s/2,p.y-s/2,s,s); }
  if(_anyGlow){ ctx.globalCompositeOperation='lighter';
    for(const p of particles){ if(!p.glow) continue;
      const ml=p.maxlife||0.4, al=Math.max(0,Math.min(1,p.life/ml));
      const s=(p.sz||4)*(p.shrink?(0.4+0.6*al):1);
      ctx.globalAlpha=al*0.9; ctx.fillStyle=p.col; ctx.fillRect(p.x-s/2,p.y-s/2,s,s); }
    ctx.globalCompositeOperation='source-over'; }
  ctx.globalAlpha=1;
  for(const s of pShots) drawShot(s,s.crit?'#ffd23d':'#ffc94d',s.crit?'#fff8d8':'#fff4cc');
  for(const s of eShots) drawEShot(s);
  for(const z of zones){
    const zc=z.healOnly?'#8fd48c':z.fire?'#ff8c3a':'#ffd07a';
    // rune circle sprite under the glow (spins slowly)
    if(typeof _fxRune!=='undefined'&&_fxRune&&_fxRune.complete&&_fxRune.naturalWidth){
      ctx.save(); ctx.globalAlpha=0.75; ctx.imageSmoothingEnabled=false;
      ctx.translate(z.x,z.y); ctx.rotate(performance.now()/2400);
      ctx.drawImage(_fxRune,-z.r,-z.r,z.r*2,z.r*2); ctx.restore(); }
    ctx.globalAlpha=0.16; ctx.fillStyle=zc;
    ctx.beginPath(); ctx.arc(z.x,z.y,z.r,0,6.29); ctx.fill();
    ctx.globalAlpha=0.5; ctx.strokeStyle=zc; ctx.lineWidth=2; ctx.stroke(); ctx.globalAlpha=1; }
  for(const gp of groundPortals){ const pp=performance.now()/220;
    // dungeon drops render as a miniature of that zone boss's DEN (the lair centrepiece art);
    // the EXIT portal (and zones whose den art hasn't shipped) keep the swirl rings.
    const den=(!gp.home && typeof _lair!=='undefined')?_lair[gp.ring]:null;
    if(den && den.naturalWidth){
      const w=74, h=w*den.height/den.width, bob=Math.sin(pp*0.9)*2;
      const glw=0.30+Math.sin(pp*1.6)*0.12;
      ctx.fillStyle='rgba(192,122,212,'+glw.toFixed(2)+')';
      ctx.beginPath(); ctx.ellipse(gp.x,gp.y+8,w*0.5,w*0.2,0,0,6.29); ctx.fill();
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(den, gp.x-w/2, gp.y+10-h+bob, w, h);
      ctx.font='10px monospace'; ctx.textAlign='center'; ctx.fillStyle='#e8d8ff';
      ctx.fillText(GBOSS[gp.ring]?GBOSS[gp.ring].dn:'DUNGEON',gp.x,gp.y+10-h-6+bob); ctx.textAlign='left';
      continue; }
    const cols=gp.home?['#7dc47a','#4f8a4c','#d8ffd8']:['#c07ad4','#8a5ac0','#e8d8ff'];
    for(let i=0;i<3;i++){ ctx.strokeStyle=cols[i]; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(gp.x,gp.y,11+i*7+Math.sin(pp+i*2)*3,0,6.29); ctx.stroke(); }
    ctx.fillStyle=gp.home?'#d8ffd8':'#e8d8ff'; ctx.fillRect(gp.x-3,gp.y-3,6,6);
    ctx.font='10px monospace'; ctx.textAlign='center'; ctx.fillStyle='#e8d8ff';
    ctx.fillText(gp.home?'EXIT':(GBOSS[gp.ring]?GBOSS[gp.ring].dn:'DUNGEON'),gp.x,gp.y-24); ctx.textAlign='left'; }
  for(const lb of loots) drawLootBag(lb,pn);
  if(typeof drawEggDrops==='function') drawEggDrops();
  if(typeof drawPet==='function') drawPet();                   // active companion pet
  for(const e of enemies){
    shadow(e.x,e.y+e.r*0.8,e.r*1.05);
    drawEnemySprite(e,pn);
    if(e.slowT>0){ ctx.globalAlpha=0.35; ctx.fillStyle='#9ad4ef';
      ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,6.29); ctx.fill(); ctx.globalAlpha=1; }
    if(e.flash>0){ ctx.globalAlpha=Math.min(1,e.flash*8); ctx.fillStyle='#fff';
      ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,6.29); ctx.fill(); ctx.globalAlpha=1; }
    // hp bar: plain fill under an ornate display-cover frame, kept upright
    upright(e.x,e.y-e.r-15,(bx,by)=>{
      const bw=(e.r+2)*2, bh=e.boss?6:4;
      ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(bx-bw/2,by-bh/2,bw,bh);
      ctx.fillStyle=e.boss?'#ff9c50':'#7dc47a';
      ctx.fillRect(bx-bw/2,by-bh/2,bw*Math.max(0,e.hp/e.maxhp),bh);
      if(_hpbarImg&&_hpbarImg.complete&&_hpbarImg.naturalWidth){
        ctx.imageSmoothingEnabled=false;
        const fw=bw*1.22, fh=Math.max(10,bh*2.4);
        ctx.drawImage(_hpbarImg,bx-fw/2,by-fh/2,fw,fh); }
      // status pips above the bar
      if(e.st){ let px3=bx-bw/2;
        for(const id in e.st){ if(e.st[id].t<=0) continue;
          const ic=(typeof _stIcons!=='undefined')?_stIcons[id]:null;
          if(ic&&ic.complete&&ic.naturalWidth){ ctx.imageSmoothingEnabled=false;
            ctx.drawImage(ic,px3,by-16,9,9); }
          else { ctx.fillStyle=(typeof STATUS!=='undefined'&&STATUS[id])?STATUS[id].col:'#fff';
            ctx.fillRect(px3,by-13,6,6); }
          px3+=11; } } });
    ctx.font='10px monospace'; ctx.textAlign='center'; ctx.fillStyle='#cfc8bd';
    if(e.wb){ upright(e.x,e.y-e.r-30,(lx,ly)=>{ ctx.fillStyle='#ff6b5a'; ctx.font='12px "Pixelify Sans",monospace';
      ctx.fillText('\u2620 '+e.name+' \u2620',lx,ly); });
      upright(e.x,e.y-e.r-19,(lx,ly)=>{
        ctx.font='10px monospace'; ctx.fillStyle='#ffd07a'; ctx.fillText('WORLD BOSS · Lv'+e.lv,lx,ly); }); }
    else if(e.type!=='N') upright(e.x,e.y-e.r-19,(lx,ly)=>ctx.fillText(mobLabel(e)+(e.lv?' · Lv'+e.lv:''),lx,ly));
    ctx.textAlign='left';
  }
  for(const al of allies){ shadow(al.x,al.y+8,10);
    const aim=allyImg(al.spr);
    if(aim){ const bob=Math.sin(pn*4+al.x)*(al.spr==='wisp'?2.5:1);
      // scale by the LONGER side so a tall skeleton and a wide wolf both land ~small & even
      const tsz=al.spr==='wisp'?26:al.spr==='wolf'?36:32;
      blit(aim,al.x,al.y+bob,tsz/Math.max(aim.width,aim.height),player.x<al.x); }
    else blit(al.spr==='wolf'?sprWolf:al.spr==='skel'?sprSkel:sprWisp,al.x,al.y,al.spr==='wisp'?2.2:1.6,player.x<al.x); }
  // ascension shield (Bishop/Warden/Guardian/Soulflayer): cyan ward ring while charged
  if((player.shield||0)>0){ const sf=Math.min(1,player.shield/(player.maxhp*0.2));
    const r=26+Math.sin(performance.now()/200)*2, n=Math.max(20,Math.round(r*0.9)), base=0.25+sf*0.35;
    ctx.fillStyle='#9ad4ef';   // ward ring drawn from orbiting pixels, not a solid stroke
    for(let i=0;i<n;i++){ const hh=hmix(i*3+2,(r|0)+i), a=(i/n)*6.283+performance.now()/1400+((hh&15)/15-0.5)*0.15, jr=r+((hh>>4)%3)-1;
      ctx.globalAlpha=base*(0.5+0.5*((hh>>8)&3)/3); ctx.fillRect((player.x+Math.cos(a)*jr)|0,(player.y-8+Math.sin(a)*jr)|0,2,2); }
    ctx.globalAlpha=1; }
  if(player.spiritT>0){ for(let i=0;i<8;i++){ const a2=performance.now()/300+i*Math.PI/4;
    const ox=player.x+Math.cos(a2)*62, oy=player.y+Math.sin(a2)*62;
    ctx.fillStyle='#7ab8d4'; ctx.fillRect(ox-4,oy-4,8,8);
    ctx.fillStyle='#d8f0fa'; ctx.fillRect(ox-2,oy-2,4,4); } }
  for(const f of fx){ if(f.t==='ring'){
      // ability shock-ring built from a BUNCH OF PIXELS, not a solid stroke (user rule for
      // projectiles/abilities): jittered 2x2 dots around the expanding circumference.
      const al=Math.min(1,f.life*2.5), r=Math.max(2,f.r*(1.4-f.life*2)), n=Math.max(18,Math.round(r*0.55));
      ctx.fillStyle=f.col;
      for(let i=0;i<n;i++){ const hh=hmix(i*3+1,(r|0)+i), a=(i/n)*6.283+((hh&15)/15-0.5)*0.18;
        const jr=r+((hh>>4)%5)-2, px=(f.x+Math.cos(a)*jr)|0, py=(f.y+Math.sin(a)*jr)|0;
        ctx.globalAlpha=al*(0.55+0.45*((hh>>8)&3)/3); ctx.fillRect(px,py,2,2); }
      ctx.globalAlpha=1; }
    else if(f.t==='bolt'){
      // lightning/chain as a scatter of jittered pixels along each segment (no solid line)
      const al=Math.min(1,f.life*3); ctx.fillStyle=f.col;
      for(let s=0;s<f.pts.length-1;s++){ const a=f.pts[s], b=f.pts[s+1];
        const steps=Math.max(2,Math.round(Math.hypot(b.x-a.x,b.y-a.y)/3));
        for(let i=0;i<=steps;i++){ const t=i/steps, hh=hmix(s*17+i,(a.x|0)+(b.y|0));
          const px=(a.x+(b.x-a.x)*t+((hh&7)-3))|0, py=(a.y+(b.y-a.y)*t+(((hh>>3)&7)-3))|0;
          ctx.globalAlpha=al*(0.5+0.5*((hh>>6)&3)/3); ctx.fillRect(px,py,2,2); } }
      ctx.globalAlpha=1; }
    else if(f.t==='img'&&f.img&&f.img.naturalWidth){ // sprite flash (slash arcs, glyphs)
      const al=Math.max(0,f.life/(f.max||0.3));
      ctx.save(); ctx.globalAlpha=al; ctx.imageSmoothingEnabled=false;
      const dy2=f.rise?(1-al)*-f.rise:0;
      ctx.translate(f.x,f.y+dy2); if(f.ang) ctx.rotate(f.ang);
      const w2=f.img.width*(f.sc||1), h2=f.img.height*(f.sc||1);
      ctx.drawImage(f.img,-w2/2,-h2/2,w2,h2); ctx.restore(); ctx.globalAlpha=1; } }
  if(curRoom.town){
    for(const np of SHOPNPCS){
      const simg=(typeof _hearth!=='undefined')?_hearth['stall_'+np.id]:null;
      if(simg&&simg.complete&&simg.naturalWidth){
        ctx.fillStyle='rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(np.x,np.y+22,30,11,0,0,6.29); ctx.fill();
        drawObjBottom(simg,np.x,np.y+26,108); }
      else { drawStall(np); shadow(np.x,np.y+14,13);
        const sp=np.id==='maren'?sprMaren:np.id==='bram'?sprBram:np.id==='sella'?sprSella:np.id==='odo'?sprOdo:sprNyx;
        blit(sp,np.x,np.y+2,1.9,false); }
      drawShopSign(np); }
  }
  ctx.font='13px monospace'; ctx.textAlign='center';
  // damage numbers can be muted in settings; xp/gold/loot texts always show
  const _hideDmg=(typeof OPTS!=='undefined'&&OPTS.dmgTxt===false);
  for(const t2 of texts){ if(_hideDmg&&/^\d+!?$/.test(''+t2.txt)) continue;
    ctx.globalAlpha=Math.min(1,t2.life*1.4); ctx.fillStyle=t2.col;
    upright(t2.x,t2.y,(lx,ly)=>ctx.fillText(t2.txt,lx,ly)); }
  ctx.globalAlpha=1; ctx.textAlign='left';
  const aa=player.aim||0;
  const chW=curChar();
  const wtype=chW?(CWEAP[chW.cls]||'sword'):'sword', style=ATK_STYLE[wtype]||'swing';
  const ATK_DUR=0.2;
  const phase = player.atkT>0 ? 1-Math.min(1,player.atkT/ATK_DUR) : 0;
  const swng = phase>0 ? Math.sin(phase*Math.PI) : 0;
  const lunge=(style==='thrust'?5:style==='swing'?3:2)*swng;
  if(typeof drawCoopPeers==='function') drawCoopPeers(pn);   // co-op allies (behind the local hero)
  const lx=Math.cos(aa)*lunge, ly=Math.sin(aa)*lunge;
  shadow(player.x,player.y+player.r*0.85,player.r*1.05);
  // moving = touch stick held OR keyboard direction pressed (PC)
  const _kv=(stick.move.id===null && typeof keyMove==='function')?keyMove():null;
  const moving=stick.move.id!==null || !!_kv;
  const bob=Math.sin(pn*11)*(moving?1.8:0.5);
  ctx.globalAlpha = player.inv>0 ? (Math.sin(performance.now()/40)>0?0.45:1) : 1;
  const hframe = moving ? (1+(Math.floor(pn*8)%2)) : 0;
  // Facing: SHOOTING wins (face the aim while the attack anim is live), otherwise face
  // the direction you're walking; idle falls back to aim.
  const _mv=stick.move;
  const _moveAng = (_mv.id!==null && (_mv.dx||_mv.dy)) ? Math.atan2(_mv.dy,_mv.dx)
                 : (_kv ? Math.atan2(_kv.y,_kv.x) : aa);
  const _shooting = player.atkT>0;
  // Facing priority: attacking -> aim; walking -> move dir; idle -> the LAST real facing
  // (remembered below), defaulting to south so a fresh/idle hero faces the camera, not
  // hard-right. player.aim only changes when firing, so idle must not fall back to it.
  let faceAng;
  if(_shooting) faceAng = aa;
  else if(moving) faceAng = _moveAng;
  else faceAng = (player.face!==undefined ? player.face : Math.PI/2);
  if(_shooting || moving) player.face = faceAng;   // remember for the next idle frame
  const _attacking = player.atkT>0 && !moving;
  const _es = (typeof emberSprite==='function')
    ? emberSprite(player.look||{cls:'knight'}, {aim:faceAng, moving, attacking:_attacking, atkPhase:phase, clock:pn})
    : null;
  if(_es){
    // real PixelLab art: 92px sprite, scaled down; already holds its weapon
    blit(_es.img, player.x+lx, player.y-8+bob*0.4+ly*0.5, EMBER_SC, _es.flip);
  } else {
    blit(heroSprite(player.look||{cls:'knight'},hframe), player.x+lx, player.y-16+bob*0.4+ly*0.5, 1.8, Math.cos(faceAng)<0);
  }
  if(!_es && chW&&rpg && wtype!=='fists'){
    const tier=rpg.wpnL?11:(rpg.wpn||0);
    let reach=player.r+2, wang=aa, glow=0;
    if(style==='swing'){ wang=aa+(phase-0.5)*1.7; reach+=swng*3; }
    else if(style==='thrust'){ reach+=swng*9; }
    else if(style==='draw'){ reach+=swng*4; }
    else if(style==='cast'){ wang=aa-swng*0.35; glow=swng; }
    const wx=player.x+lx+Math.cos(wang)*reach, wy=player.y+ly+Math.sin(wang)*reach;
    if(glow>0){ const gx=wx+Math.cos(aa)*9, gy=wy+Math.sin(aa)*9;
      const gg=ctx.createRadialGradient(gx,gy,1,gx,gy,9*glow+4);
      gg.addColorStop(0,(CTHEME[chW.cls]||CTHEME.knight).p); gg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.globalAlpha=0.6*glow; ctx.fillStyle=gg; ctx.beginPath(); ctx.arc(gx,gy,9*glow+4,0,6.29); ctx.fill(); ctx.globalAlpha=1; }
    blitRot(wpnSpr(wtype,tier), wx,wy, 2.0, wang);
  }
  ctx.globalAlpha=1;
  ctx.font='11px monospace'; ctx.textAlign='center'; ctx.fillStyle='#ffd07a';
  ctx.fillText((player.cname||'Hero')+(rpg?' · Lv '+rpg.lvl:''),player.x,player.y-player.r-11);
  ctx.textAlign='left';
  if(curRoom.glows&&curRoom.glows.length){
    ctx.globalCompositeOperation='lighter';
    for(const gl of curRoom.glows){
      const fl=1+Math.sin(pn*7+gl.x)*0.06+Math.sin(pn*13+gl.y)*0.05;
      const rad=gl.r*fl;
      const gr=ctx.createRadialGradient(gl.x,gl.y,4,gl.x,gl.y,rad);
      gr.addColorStop(0,'rgba(255,160,60,0.42)');
      gr.addColorStop(0.5,'rgba(235,115,40,0.16)');
      gr.addColorStop(1,'rgba(235,115,40,0)');
      ctx.fillStyle=gr; ctx.beginPath(); ctx.arc(gl.x,gl.y,rad,0,6.29); ctx.fill();
    }
    ctx.globalCompositeOperation='source-over';
  }
  ctx.fillStyle='#ffb066';
  for(const em of embers){ ctx.globalAlpha=Math.min(1,em.life*0.8); ctx.fillRect(em.x-1.5,em.y-1.5,3,3); }
  ctx.globalAlpha=1;
  ctx.restore();
  const vg=ctx.createRadialGradient(W/2,H/2,H*0.25,W/2,H/2,H*0.95);
  if(curRoom.town){ vg.addColorStop(0,'rgba(255,140,50,0.05)'); vg.addColorStop(1,'rgba(110,45,10,0.22)'); }
  else { vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.42)'); }
  ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
  { const s=stick.move;
    if(s.id!==null){ ctx.strokeStyle='rgba(216,210,200,.25)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(s.ox,s.oy,50,0,6.29); ctx.stroke();
      ctx.fillStyle='rgba(216,210,200,.35)';
      ctx.beginPath(); ctx.arc(s.ox+s.dx,s.oy+s.dy,20,0,6.29); ctx.fill(); } }
  // ---- HP / MP orbs + XP bar ----
  const mp=player.mp||0, mm=player.maxmp||1;
  const cost=(typeof abilityCost==='function')?abilityCost():1e9;
  // HP + MP orbs flanking the bottom-centre; resource+XP strip beneath, status text above. All
  // scale with UIS and stack bottom-up with UIS-scaled gaps so nothing overlaps at any UI size
  // (the old fixed 8/15px offsets sank into the orbs once they grew).
  const orbR=Math.round(Math.min(34, W*0.08)*UIS);
  const _xbh=Math.max(4,Math.round(6*UIS)), _xby=H-Math.round(10*UIS)-_xbh;
  const oy=_xby-Math.round(24*UIS)-orbR, _og=Math.round(5*UIS);
  const hpF=Math.max(0,player.hp/player.maxhp), mpF=Math.max(0,Math.min(1,mp/mm));
  drawOrb(W/2-orbR-_og, oy, orbR, hpF, '#f0705a','#8a1f14', Math.round(100*hpF)+'%', false);
  drawOrb(W/2+orbR+_og, oy, orbR, mpF, '#6ab8e0','#274f7a', Math.round(100*mpF)+'%', mp>=cost);
  if(rpg){ const xbw=orbR*4+10, xbx=W/2-xbw/2, xbh=_xbh, xby=_xby;
    // class resource meter (only for classes whose tree actually uses one)
    if(typeof drawResMeter==='function') drawResMeter(W/2,xby,xbw);
    ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(xbx,xby,xbw,xbh);
    ctx.fillStyle='#c9a04a'; ctx.fillRect(xbx,xby,xbw*Math.min(1,rpg.xp/xpNeed(rpg.lvl)),xbh);
    ctx.strokeStyle='rgba(216,210,200,.2)'; ctx.lineWidth=1; ctx.strokeRect(xbx-0.5,xby-0.5,xbw+1,xbh+1);
    // integrated status line above the orbs (replaces the old top HUD bar)
    const zn=(typeof curRegionN!=='undefined'&&curRegionN)?curRegionN:(curRoom.name||'');
    const syB=oy-orbR-Math.round(7*UIS), syT=syB-Math.round(15*UIS);
    ctx.textAlign='center';
    ctx.font='bold '+Math.round(13*UIS)+'px "Pixelify Sans",monospace';
    // ☠ = this hero is past Lv20, so death is permanent — keep the stakes visible
    const l1='Lv '+rpg.lvl+((typeof isHardcore==='function'&&isHardcore(rpg))?' ☠':'')+'  ·  '+zn;
    ctx.fillStyle='rgba(0,0,0,.65)'; ctx.fillText(l1,W/2+1,syT+1);
    ctx.fillStyle='#ffd07a'; ctx.fillText(l1,W/2,syT);
    ctx.font=Math.round(11*UIS)+'px "Pixelify Sans",monospace';
    const l2=rpg.gold+'g   ·   '+(player.kills||0)+' kills';
    ctx.fillStyle='rgba(0,0,0,.65)'; ctx.fillText(l2,W/2+1,syB+1);
    ctx.fillStyle='#d8cfb8'; ctx.fillText(l2,W/2,syB);
    ctx.textAlign='left'; }
  // ability loadout buttons (bottom-left) + "tap right to cast" hint
  if(typeof drawAbilButtons==='function') drawAbilButtons();
  if(typeof drawUltButton==='function') drawUltButton();
  // floating USE prompt above the hero when near a portal/pillar (button-gated)
  drawPortalPrompt();
  // big boss bar, top of screen — shows from the first hit on a boss
  if(typeof bossBar!=='undefined' && bossBar){
    const bw=Math.min(W*0.62,540), bh=15, bx=W/2, by=34;
    ctx.textAlign='center'; ctx.font='bold 15px "Pixelify Sans",monospace';
    ctx.fillStyle='rgba(0,0,0,.65)'; ctx.fillText(bossBar.name||'CHAMPION',bx+1,by-8);
    ctx.fillStyle='#ff9c50'; ctx.fillText(bossBar.name||'CHAMPION',bx,by-9);
    ctx.fillStyle='rgba(8,6,10,.82)'; ctx.fillRect(bx-bw/2,by,bw,bh);
    const fr=Math.max(0,bossBar.hp/bossBar.maxhp);
    const grd=ctx.createLinearGradient(bx-bw/2,0,bx+bw/2,0);
    grd.addColorStop(0,'#c03a2a'); grd.addColorStop(1,'#ff9c50');
    ctx.fillStyle=grd; ctx.fillRect(bx-bw/2,by,bw*fr,bh);
    if(_hpbarImg&&_hpbarImg.complete&&_hpbarImg.naturalWidth){
      ctx.imageSmoothingEnabled=false;
      const fw=bw*1.06, fh=bh*2.3;
      ctx.drawImage(_hpbarImg,bx-fw/2,by+bh/2-fh/2,fw,fh); }
    ctx.textAlign='left';
  }
  // dungeon objective banner (screen space): the first unfinished chamber's task
  if(curRoom.dungeon && curRoom.objs && !(typeof bossBar!=='undefined'&&bossBar)){
    const o=curRoom.objs.find(x=>!x.done);
    ctx.textAlign='center';
    if(o){ let prog=o.type==='waves'?'':('  '+o.got+' / '+o.need);
      if(o.mode==='relay'&&o.got>0&&!o.done) prog+='  ·  '+Math.max(0,Math.ceil(o.timer))+'s';
      ctx.font='bold 14px "Pixelify Sans",monospace';
      ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillText(o.label+prog, W/2+1, 47);
      ctx.fillStyle='#ffe08a'; ctx.fillText(o.label+prog, W/2, 46); }
    else { ctx.font='bold 14px "Pixelify Sans",monospace';
      ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillText('FACE THE AWAKENED', W/2+1, 47);
      ctx.fillStyle='#ff6b5a'; ctx.fillText('FACE THE AWAKENED', W/2, 46); }
    ctx.textAlign='left';
  }
  // arena wave banner
  if(curRoom.arena){ ctx.textAlign='center';
    ctx.font='bold 18px "Pixelify Sans",monospace'; ctx.fillStyle='rgba(0,0,0,.6)';
    ctx.fillText('WAVE '+arenaWave, W/2+1, 47); ctx.fillStyle='#e2604c'; ctx.fillText('WAVE '+arenaWave, W/2, 46);
    ctx.font='11px monospace'; ctx.fillStyle='#cfc8bd';
    ctx.fillText('best: wave '+((rpg&&rpg.arenaBest)||0)+'   ·   foes left: '+enemies.length, W/2, 64);
    ctx.textAlign='left'; }
  // ability hover tooltip draws last so it sits on top of the whole HUD
  if(typeof drawAbilTooltip==='function') drawAbilTooltip();
  fpsCount++; const fn=performance.now();
  if(fn-fpsLast>500){fpsNow=Math.round(fpsCount*1000/(fn-fpsLast));fpsCount=0;fpsLast=fn;}
  if((typeof dev!=='undefined'&&dev.fps)||(typeof OPTS!=='undefined'&&OPTS.fps)){ctx.fillStyle='#7dc47a';ctx.font='14px monospace';ctx.fillText(fpsNow+' fps',10,H-10);}
}
