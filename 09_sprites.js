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
 tome:["GTTTTT","GWWWWW","GWWWWW","GWWWWW","GWWWWW","GTTTTT"],
 axe:["....WW..","GGGGWWWT","....WWW.","....WW.."],
 hammer:["....WWWW","GGGGWTTW","....WWWW"],
 spear:["............W.","GGGGGGGGGGWWT.",".............."],
 harp:["TWWWT","W...W","W.W.W","W...W","TWWWT"],
 totem:["TTTT","WWWW","GWWG","WWWW","GGGG"],
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
function ringSpr(st,t){ const k=st+'_'+t; if(!_ringC[k]) _ringC[k]=makeSprite(RING_A,{O:'#140d08',G:tierCol(t),E:{hp:'#8fd48c',dmg:'#e2604c',spd:'#9ad4ef'}[st]||'#ffc94d'}); return _ringC[k]; }
function petSprite(p){ return p==='wolf'?sprWolf:p==='skel'?sprSkel:sprWisp; }
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
 squire:{p:'#5a7a9c',s:'#3c5570'}, ranger:{p:'#4f7d45',s:'#37592f'},
 pyro:{p:'#d4622a',s:'#96421c'}, knight:{p:'#7d8a99',s:'#565f6b'},
 rogue:{p:'#4a3d5c',s:'#322a40'}, cleric:{p:'#d8cfb8',s:'#a89c7f'},
 berserker:{p:'#a83232',s:'#742020'}, warlock:{p:'#6b3d99',s:'#482968'},
 frost:{p:'#6fb8d4',s:'#4a8aa8'}, storm:{p:'#c9b23c',s:'#8f7d24'},
 hunter:{p:'#8a6a3a',s:'#64491f'}, arbalest:{p:'#6b6b3f',s:'#4a4a28'},
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
const HEADGEAR={ squire:'helm', knight:'ghelm', paladin:'circlet', cleric:'circlet',
 berserker:'horns', dragoon:'crest', ranger:'hood', hunter:'hood', rogue:'hood',
 warlock:'skull', necro:'skull', arbalest:'cap', monk:'topknot', bard:'feather',
 pyro:'wizhat', frost:'wizhat', storm:'wizhat', shaman:'mask' };
const ATK_STYLE={ sword:'swing',axe:'swing',hammer:'swing', spear:'thrust',dagger:'thrust',
 bow:'draw',xbow:'draw', staff:'cast',wand:'cast',tome:'cast',harp:'cast',totem:'cast' };
const heroCache={};
function buildHero(cls,frame,armT){
 const CW=26, CH=34, cv=document.createElement('canvas'); cv.width=CW; cv.height=CH;
 const c=cv.getContext('2d'); c.imageSmoothingEnabled=false;
 const th=CTHEME[cls]||CTHEME.squire, arch=(CARMOR[cls]||'robe');
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
 const cls=look.cls||'squire', at=look.armT|0, k=cls+'_'+frame+'_'+at;
 if(!heroCache[k]) heroCache[k]=buildHero(cls,frame,at);
 return heroCache[k];
}
function drawEnemySprite(e,pn){
 const flip = player.x < e.x;
 if(e.type==='c') blit(sprHound,e.x,e.y+Math.sin(pn*6+e.x)*1,2.0,flip);
 else if(e.type==='s') blit(sprCult,e.x,e.y+Math.sin(pn*3+e.x)*1.5,2.1,flip);
 else { const sp=(e.wb && sprBoss[e.ring])?sprBoss[e.ring]:sprTyrant;
   const sc=(e.r*2.6)/sp.width;
   blit(sp,e.x,e.y+Math.sin(pn*2)*1.5,sc,flip); }
}
const ENAME={c:'Cinder Hound',s:'Ashbound Cultist',B:'CINDER TYRANT'};
// ---------- hub / world decor ----------
function drawPortal(pt){
 const t=performance.now()/1000, col=pt.col||'#c07ad4', R=pt.big?36:20;
 const g=ctx.createRadialGradient(pt.x,pt.y,2,pt.x,pt.y,R*1.9);
 g.addColorStop(0,col); g.addColorStop(0.45,col+'66'); g.addColorStop(1,'rgba(0,0,0,0)');
 ctx.globalAlpha=0.55+Math.sin(t*3)*0.12; ctx.fillStyle=g;
 ctx.beginPath(); ctx.arc(pt.x,pt.y,R*1.9,0,6.29); ctx.fill(); ctx.globalAlpha=1;
 for(let i=0;i<3;i++){ ctx.strokeStyle=col; ctx.lineWidth=pt.big?4:3; ctx.globalAlpha=0.85-i*0.22;
   ctx.beginPath(); ctx.arc(pt.x,pt.y,R-i*7+Math.sin(t*4+i*2)*3,0,6.29); ctx.stroke(); }
 ctx.globalAlpha=1;
 ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(pt.x,pt.y,pt.big?7:4,0,6.29); ctx.fill();
 if(pt.label){ const ly=pt.y-R-(pt.big?26:18);
   ctx.font=(pt.big?'bold 16px':'bold 12px')+' "Pixelify Sans",monospace'; ctx.textAlign='center';
   const w=ctx.measureText(pt.label).width+16;
   ctx.fillStyle='rgba(12,10,16,0.82)'; ctx.fillRect(pt.x-w/2,ly-12,w,17);
   ctx.strokeStyle=col; ctx.lineWidth=1; ctx.strokeRect(pt.x-w/2,ly-12,w,17);
   ctx.fillStyle=col; ctx.fillText(pt.label,pt.x,ly);
   ctx.textAlign='left'; }
}
function drawFountain(x,y){ const t=performance.now()/1000;
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
function drawShopSign(np){ const x=np.x, sy=np.y-54;
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
function render(){
  ctx.fillStyle='#0b0a10'; ctx.fillRect(0,0,W,H);
  const roomW=curRoom.w*TILE, roomH=curRoom.h*TILE;
  const zoom=H/(VIEW_TILES_H*TILE);
  const vw=W/zoom, vh=H/zoom;
  camX = roomW<=vw ? (roomW-vw)/2 : Math.max(0,Math.min(roomW-vw, player.x-vw/2));
  camY = roomH<=vh ? (roomH-vh)/2 : Math.max(0,Math.min(roomH-vh, player.y-vh/2));
  ctx.save(); ctx.scale(zoom,zoom); ctx.translate(-camX,-camY);
  const tx0=Math.max(0,Math.floor(camX/TILE)), ty0=Math.max(0,Math.floor(camY/TILE));
  const tx1=Math.min(curRoom.w-1,Math.ceil((camX+vw)/TILE)), ty1=Math.min(curRoom.h-1,Math.ceil((camY+vh)/TILE));
  for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++) drawTileG(tx,ty);
  const pn=performance.now()/1000;
  if(curRoom.glows) for(const gl of curRoom.glows){
    const fl=1+Math.sin(pn*9+gl.x)*0.16;
    if(gl.t==='H'){
      ctx.fillStyle='#ff8c3a'; ctx.beginPath(); ctx.arc(gl.x,gl.y+2,12*fl,0,6.29); ctx.fill();
      ctx.fillStyle='#ffd07a'; ctx.beginPath(); ctx.arc(gl.x,gl.y-2,6.5*fl,0,6.29); ctx.fill();
    } else if(gl.t==='l'){
      ctx.fillStyle='#fff0c0'; ctx.fillRect(gl.x-4,gl.y-17+Math.sin(pn*11+gl.x),8,9);
    } }
  if(curRoom.portals) for(const pt of curRoom.portals) drawPortal(pt);
  if(curRoom.decor) for(const d of curRoom.decor){ const dx=d.x*TILE, dy=d.y*TILE;
    if(d.t==='fountain') drawFountain(dx,dy);
    else if(d.t==='sign') drawSign(dx,dy,d.txt);
    else if(d.t==='chest') drawChest(dx,dy);
    else if(d.t==='banner') drawBanner(dx,dy); }
  for(const p of particles){ ctx.globalAlpha=p.life/0.4; ctx.fillStyle=p.col;
    ctx.fillRect(p.x-2,p.y-2,4,4); } ctx.globalAlpha=1;
  for(const s of pShots) drawShot(s,s.crit?'#ffd23d':'#ffc94d',s.crit?'#fff8d8':'#fff4cc');
  for(const s of eShots) drawEShot(s);
  for(const z of zones){ ctx.globalAlpha=0.20; ctx.fillStyle='#ffd07a';
    ctx.beginPath(); ctx.arc(z.x,z.y,z.r,0,6.29); ctx.fill();
    ctx.globalAlpha=0.55; ctx.strokeStyle='#ffd07a'; ctx.lineWidth=2; ctx.stroke(); ctx.globalAlpha=1; }
  for(const gp of groundPortals){ const pp=performance.now()/220;
    const cols=gp.home?['#7dc47a','#4f8a4c','#d8ffd8']:['#c07ad4','#8a5ac0','#e8d8ff'];
    for(let i=0;i<3;i++){ ctx.strokeStyle=cols[i]; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(gp.x,gp.y,11+i*7+Math.sin(pp+i*2)*3,0,6.29); ctx.stroke(); }
    ctx.fillStyle=gp.home?'#d8ffd8':'#e8d8ff'; ctx.fillRect(gp.x-3,gp.y-3,6,6);
    ctx.font='10px monospace'; ctx.textAlign='center'; ctx.fillStyle='#e8d8ff';
    ctx.fillText(gp.home?'EXIT':(GBOSS[gp.ring]?GBOSS[gp.ring].dn:'DUNGEON'),gp.x,gp.y-24); ctx.textAlign='left'; }
  for(const lb of loots){ shadow(lb.x,lb.y+8,10);
    blit(sprBag,lb.x,lb.y,2.0,false);
    ctx.fillStyle=lb.item.k==='pot'?'#7dc47a':tierCol(lb.item.t);
    ctx.fillRect(lb.x-3,lb.y-2,6,6); }
  for(const e of enemies){
    shadow(e.x,e.y+e.r*0.8,e.r*1.05);
    drawEnemySprite(e,pn);
    if(e.slowT>0){ ctx.globalAlpha=0.35; ctx.fillStyle='#9ad4ef';
      ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,6.29); ctx.fill(); ctx.globalAlpha=1; }
    if(e.flash>0){ ctx.globalAlpha=Math.min(1,e.flash*8); ctx.fillStyle='#fff';
      ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,6.29); ctx.fill(); ctx.globalAlpha=1; }
    ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(e.x-e.r-2,e.y-e.r-15,(e.r+2)*2,4);
    ctx.fillStyle=e.boss?'#ff9c50':'#7dc47a';
    ctx.fillRect(e.x-e.r-2,e.y-e.r-15,(e.r+2)*2*Math.max(0,e.hp/e.maxhp),4);
    ctx.font='10px monospace'; ctx.textAlign='center'; ctx.fillStyle='#cfc8bd';
    if(e.wb){ ctx.fillStyle='#ff6b5a'; ctx.font='12px "Pixelify Sans",monospace';
      ctx.fillText('\u2620 '+e.name+' \u2620',e.x,e.y-e.r-30);
      ctx.font='10px monospace'; ctx.fillStyle='#ffd07a'; ctx.fillText('WORLD BOSS · Lv'+e.lv,e.x,e.y-e.r-19); }
    else ctx.fillText((ENAME[e.type]||'')+(e.lv?' · Lv'+e.lv:''),e.x,e.y-e.r-19);
    ctx.textAlign='left';
  }
  for(const al of allies){ shadow(al.x,al.y+8,10);
    blit(al.spr==='wolf'?sprWolf:al.spr==='skel'?sprSkel:sprWisp,al.x,al.y,al.spr==='wisp'?2.2:1.6,player.x<al.x); }
  if(player.spiritT>0){ for(let i=0;i<8;i++){ const a2=performance.now()/300+i*Math.PI/4;
    const ox=player.x+Math.cos(a2)*62, oy=player.y+Math.sin(a2)*62;
    ctx.fillStyle='#7ab8d4'; ctx.fillRect(ox-4,oy-4,8,8);
    ctx.fillStyle='#d8f0fa'; ctx.fillRect(ox-2,oy-2,4,4); } }
  for(const f of fx){ if(f.t==='ring'){ ctx.globalAlpha=Math.min(1,f.life*2.5); ctx.strokeStyle=f.col; ctx.lineWidth=4;
      ctx.beginPath(); ctx.arc(f.x,f.y,f.r*(1.4-f.life*2),0,6.29); ctx.stroke(); ctx.globalAlpha=1; }
    else if(f.t==='bolt'){ ctx.globalAlpha=Math.min(1,f.life*3); ctx.strokeStyle=f.col; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(f.pts[0].x,f.pts[0].y);
      for(let i=1;i<f.pts.length;i++) ctx.lineTo(f.pts[i].x,f.pts[i].y);
      ctx.stroke(); ctx.globalAlpha=1; } }
  if(curRoom.town){
    for(const np of SHOPNPCS){
      drawStall(np);
      shadow(np.x,np.y+14,13);
      const sp=np.id==='maren'?sprMaren:np.id==='bram'?sprBram:np.id==='sella'?sprSella:np.id==='odo'?sprOdo:sprNyx;
      blit(sp,np.x,np.y+2,1.9,false);
      drawShopSign(np); }
  }
  ctx.font='13px monospace'; ctx.textAlign='center';
  for(const t2 of texts){ ctx.globalAlpha=Math.min(1,t2.life*1.4); ctx.fillStyle=t2.col;
    ctx.fillText(t2.txt,t2.x,t2.y); }
  ctx.globalAlpha=1; ctx.textAlign='left';
  const aa=player.aim||0;
  const chW=curChar();
  const wtype=chW?(CWEAP[chW.cls]||'sword'):'sword', style=ATK_STYLE[wtype]||'swing';
  const ATK_DUR=0.2;
  const phase = player.atkT>0 ? 1-Math.min(1,player.atkT/ATK_DUR) : 0;
  const swng = phase>0 ? Math.sin(phase*Math.PI) : 0;
  const lunge=(style==='thrust'?5:style==='swing'?3:2)*swng;
  const lx=Math.cos(aa)*lunge, ly=Math.sin(aa)*lunge;
  shadow(player.x,player.y+player.r*0.85,player.r*1.05);
  const moving=stick.move.id!==null;
  const bob=Math.sin(pn*11)*(moving?1.8:0.5);
  ctx.globalAlpha = player.inv>0 ? (Math.sin(performance.now()/40)>0?0.45:1) : 1;
  const hframe = moving ? (1+(Math.floor(pn*8)%2)) : 0;
  const _es = (typeof emberSprite==='function')
    ? emberSprite(player.look||{cls:'squire'}, {aim:aa, moving, attacking:player.atkT>0, atkPhase:phase, clock:pn})
    : null;
  if(_es){
    // real PixelLab art: 92px sprite, scaled down; already holds its weapon
    blit(_es.img, player.x+lx, player.y-8+bob*0.4+ly*0.5, EMBER_SC, _es.flip);
  } else {
    blit(heroSprite(player.look||{cls:'squire'},hframe), player.x+lx, player.y-16+bob*0.4+ly*0.5, 1.8, Math.cos(aa)<0);
  }
  if(!_es && chW&&rpg){
    const tier=rpg.wpnL?11:(rpg.wpn||0);
    let reach=player.r+2, wang=aa, glow=0;
    if(style==='swing'){ wang=aa+(phase-0.5)*1.7; reach+=swng*3; }
    else if(style==='thrust'){ reach+=swng*9; }
    else if(style==='draw'){ reach+=swng*4; }
    else if(style==='cast'){ wang=aa-swng*0.35; glow=swng; }
    const wx=player.x+lx+Math.cos(wang)*reach, wy=player.y+ly+Math.sin(wang)*reach;
    if(glow>0){ const gx=wx+Math.cos(aa)*9, gy=wy+Math.sin(aa)*9;
      const gg=ctx.createRadialGradient(gx,gy,1,gx,gy,9*glow+4);
      gg.addColorStop(0,(CTHEME[chW.cls]||CTHEME.squire).p); gg.addColorStop(1,'rgba(0,0,0,0)');
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
  // ---- bottom bars: HP / MP / XP ----
  const bx=W/2-97, bw=194;
  ctx.fillStyle='rgba(0,0,0,.68)'; ctx.fillRect(bx,H-34,bw,32);
  ctx.strokeStyle='rgba(216,210,200,.30)'; ctx.lineWidth=1; ctx.strokeRect(bx-0.5,H-34.5,bw+1,33);
  const hc=player.hp/player.maxhp>0.3;
  const hg=ctx.createLinearGradient(0,H-32,0,H-22);
  hg.addColorStop(0,hc?'#8fd48c':'#f07a64'); hg.addColorStop(1,hc?'#4f8a4c':'#a83a2a');
  ctx.fillStyle=hg; ctx.fillRect(bx+2,H-32,(bw-4)*Math.max(0,player.hp/player.maxhp),10);
  ctx.fillStyle='#08110a'; ctx.font='8px monospace'; ctx.textAlign='left';
  ctx.fillText(Math.ceil(player.hp)+' / '+player.maxhp,bx+5,H-24);
  const mp=player.mp||0, mm=player.maxmp||1;
  ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(bx+2,H-20,bw-4,7);
  const mg=ctx.createLinearGradient(0,H-20,0,H-13);
  mg.addColorStop(0,'#7ab8d4'); mg.addColorStop(1,'#3f6f8a');
  ctx.fillStyle=mg; ctx.fillRect(bx+2,H-20,(bw-4)*Math.max(0,Math.min(1,mp/mm)),7);
  const cost=(typeof abilityCost==='function')?abilityCost():1e9;
  if(mp>=cost){ ctx.strokeStyle='rgba(255,201,77,'+(0.5+Math.sin(performance.now()/200)*0.35)+')';
    ctx.lineWidth=1.5; ctx.strokeRect(bx+1.5,H-20.5,bw-3,8); }
  if(rpg){ ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(bx+2,H-11,bw-4,5);
    ctx.fillStyle='#c9a04a'; ctx.fillRect(bx+2,H-11,(bw-4)*Math.min(1,rpg.xp/xpNeed(rpg.lvl)),5); }
  // ability hint (right-side invisible button)
  if(rpg&&player.resDef){ const ready=mp>=cost;
    ctx.textAlign='right'; ctx.font='11px "Pixelify Sans",monospace';
    ctx.fillStyle=ready?player.resDef.col:'rgba(216,210,200,0.45)';
    ctx.fillText((ready?'▶ ':'◇ ')+player.resDef.res+'  ·  tap right to cast',W-12,H-42);
    ctx.textAlign='left'; }
  // arena wave banner
  if(curRoom.arena){ ctx.textAlign='center';
    ctx.font='bold 18px "Pixelify Sans",monospace'; ctx.fillStyle='rgba(0,0,0,.6)';
    ctx.fillText('WAVE '+arenaWave, W/2+1, 47); ctx.fillStyle='#e2604c'; ctx.fillText('WAVE '+arenaWave, W/2, 46);
    ctx.font='11px monospace'; ctx.fillStyle='#cfc8bd';
    ctx.fillText('best: wave '+((rpg&&rpg.arenaBest)||0)+'   ·   foes left: '+enemies.length, W/2, 64);
    ctx.textAlign='left'; }
  fpsCount++; const fn=performance.now();
  if(fn-fpsLast>500){fpsNow=Math.round(fpsCount*1000/(fn-fpsLast));fpsCount=0;fpsLast=fn;}
  if(typeof dev!=='undefined'&&dev.fps){ctx.fillStyle='#7dc47a';ctx.font='14px monospace';ctx.fillText(fpsNow+' fps',10,H-10);}
}
