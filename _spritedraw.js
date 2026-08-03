// ===================================================================================================
//  SPRITE DRAW -- the hand-drawing half of the Sprite Lab
// ---------------------------------------------------------------------------------------------------
//  The other half DERIVES sprites from art that already exists. This one lets you draw one, in the
//  game's own palettes, on whichever lattice the thing you are drawing actually sits on -- and then
//  hand it straight to the derive side, so the same ops that make a frost golem out of a golem can
//  be run on something you drew ten seconds ago.
//
//  THREE THINGS IT TAKES SERIOUSLY.
//
//  COLOUR IS NOT ONE SWATCH. Pixel art is made of RAMPS, not colours, and a ramp that only changes
//  lightness reads as dead grey plastic. The ramp builder here hue-shifts as it descends -- shadows
//  toward the cool end, highlights toward the warm -- which is the single technique that makes hand-
//  drawn pixel art look lit rather than tinted. It is also exactly what spritegen's `ramp` op does to
//  a whole sprite, so a ramp you build here and a ramp you apply there mean the same thing.
//  You can also pull a palette straight out of any sprite in the game, which is the fastest way to
//  draw something that belongs beside the art already in assets/.
//
//  THE GRID IS NOT ALWAYS SQUARE. This project has square top-down tiles, isometric tiles, and
//  sprites that must land on a 44px game tile. Drawing an isometric roof on a square grid is how you
//  get a roof that is subtly wrong in a way nobody can point at, so the lattice you draw on is a
//  setting: square, block subdivisions, isometric 2:1, hex, and the game's own tile guide.
//
//  IT HAS TO WORK WITH A FINGER. Pointer events throughout, so a phone on the Pages site is a real
//  drawing surface and not a demo.
// ===================================================================================================

(() => {
'use strict';

const $ = s => document.querySelector(s);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// ---------------------------------------------------------------------------------------------------
//  COLOUR. hsv here rather than the hsl spritegen uses: hsl is the right model for RECOLOURING art
//  that exists (it preserves what a pixel already is), hsv is the right model for CHOOSING a colour
//  from nothing, because "how bright" and "how saturated" are separate knobs your hand understands.
//  Converted at the edges; every value that leaves this file is rgba.
// ---------------------------------------------------------------------------------------------------

function hsv2rgb(h, s, v){
  h = ((h % 360) + 360) % 360 / 60;
  const c = v * s, x = c * (1 - Math.abs(h % 2 - 1)), m = v - c;
  const t = [[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]][Math.floor(h) % 6];
  return [Math.round((t[0]+m)*255), Math.round((t[1]+m)*255), Math.round((t[2]+m)*255)];
}
function rgb2hsv(r, g, b){
  r/=255; g/=255; b/=255;
  const mx = Math.max(r,g,b), mn = Math.min(r,g,b), d = mx-mn;
  let h = 0;
  if(d > 1e-9){
    if(mx === r) h = ((g-b)/d + 6) % 6;
    else if(mx === g) h = (b-r)/d + 2;
    else h = (r-g)/d + 4;
    h *= 60;
  }
  return [h, mx ? d/mx : 0, mx];
}
const hex = ([r,g,b]) => '#' + [r,g,b].map(v => clamp(v,0,255).toString(16).padStart(2,'0')).join('');
function parseHex(s){
  s = String(s).trim().replace('#','');
  if(s.length === 3) s = s.split('').map(c => c+c).join('');
  if(!/^[0-9a-f]{6}$/i.test(s)) return null;
  return [parseInt(s.slice(0,2),16), parseInt(s.slice(2,4),16), parseInt(s.slice(4,6),16)];
}

// THE RAMP. `hueShift` is the whole point: positive rotates highlights warm and shadows cool, which
// is what makes a ramp read as light falling on a material instead of one colour being dimmed.
// `sat` pulls saturation up in the shadows (dark areas hold colour better than they hold value).
function buildRamp(base, steps, hueShift, satCurve, spread){
  const [h, s, v] = rgb2hsv(base[0], base[1], base[2]);
  const out = [];
  for(let i = 0; i < steps; i++){
    const t = steps === 1 ? 0.5 : i / (steps - 1);       // 0 = deepest shadow, 1 = brightest
    const d = (t - 0.5) * 2;                             // -1..1
    const nv = clamp(v + d * spread, 0.04, 1);
    const ns = clamp(s - d * satCurve, 0, 1);
    // SIGN MATTERS AND IT IS EASY TO GET BACKWARDS. Highlights rotate FORWARD along the wheel
    // (an orange base highlights toward yellow) and shadows rotate BACK (toward red, then purple).
    // The first cut had `-d` here, which gave an orange base yellow shadows and pink highlights --
    // a ramp that looks like a sunset lying on the object rather than light falling on it.
    const nh = h + d * hueShift;
    out.push(hsv2rgb(nh, ns, nv));
  }
  return out;
}

// Pull a palette out of an existing sprite: quantise to a coarse cube, count, take the busiest, then
// sort by luminance so what comes back reads as a ramp rather than a bag of colours.
function paletteFrom(imgData, want){
  const bins = new Map();
  const d = imgData.d;
  for(let i = 0; i < d.length; i += 4){
    if(d[i+3] < 40) continue;
    const key = (d[i] >> 3) << 10 | (d[i+1] >> 3) << 5 | (d[i+2] >> 3);
    let e = bins.get(key);
    if(!e) bins.set(key, e = {n:0, r:0, g:0, b:0});
    e.n++; e.r += d[i]; e.g += d[i+1]; e.b += d[i+2];
  }
  return [...bins.values()]
    .sort((a,b) => b.n - a.n)
    .slice(0, want)
    .map(e => [Math.round(e.r/e.n), Math.round(e.g/e.n), Math.round(e.b/e.n)])
    .sort((a,b) => (a[0]*0.2126+a[1]*0.7152+a[2]*0.0722) - (b[0]*0.2126+b[1]*0.7152+b[2]*0.0722));
}

// ---------------------------------------------------------------------------------------------------
//  THE DOCUMENT
// ---------------------------------------------------------------------------------------------------

const D = {
  w: 32, h: 32,
  px: null,                 // Uint8ClampedArray, w*h*4
  zoom: 12,
  panX: 0, panY: 0,
  zoomRaw: 12,              // continuous, for smooth pinching; D.zoom is this snapped
  artScale: 1,              // the source's true pixel size: 2 means the art is 2x2 blocks
  _fitted: false,           // the first paint with a real canvas size does the initial fit        // where the art's top-left sits in the viewport, in display px
  tool: 'pencil',
  size: 1,
  color: [255, 176, 46],
  alt:   [40, 30, 60],      // the dither partner and the right-drag colour
  alpha: 255,
  grid: 'pixel',
  block: 8,
  dither: 'off',            // off | 50 | 25 | 75
  mirror: 'none',           // none | h | v | both
  onion: null,              // an image shown faintly underneath, for tracing
  tpl: 'none',              // a synthetic proportion guide, drawn behind the art
  tplAlpha: 0.5,
  tplFlip: false,
  tplRot: 0,                // degrees, about the canvas centre
  tplSnap: true,            // round guide coordinates to whole art pixels
  ramp: [],
  inpal: [],
  palette: [],
  recent: [],
  undo: [], redo: [],
};

const idx = (x, y) => (y * D.w + x) * 4;
const inside = (x, y) => x >= 0 && y >= 0 && x < D.w && y < D.h;

function blank(w, h){
  D.w = w; D.h = h;
  D._fitted = false;
  D.px = new Uint8ClampedArray(w * h * 4);
  D.undo = []; D.redo = [];
}

function snapshot(){
  D.undo.push(new Uint8ClampedArray(D.px));
  if(D.undo.length > 80) D.undo.shift();       // 80 x 92x92 is about 2.7 MB, which is nothing
  D.redo.length = 0;
}
function undo(){
  if(!D.undo.length) return;
  D.redo.push(new Uint8ClampedArray(D.px));
  D.px = D.undo.pop();
  paint();
}
function redo(){
  if(!D.redo.length) return;
  D.undo.push(new Uint8ClampedArray(D.px));
  D.px = D.redo.pop();
  paint();
}

// The dither patterns. This is why `alt` exists: a 50% checker of two ramp steps reads as a shade
// BETWEEN them, which is how pixel art gets more tones than it has colours.
function ditherPick(x, y){
  if(D.dither === 'off') return D.color;
  const c = (x + y) & 1, q = ((x & 1) + ((y & 1) << 1));
  if(D.dither === '50') return c ? D.alt : D.color;
  if(D.dither === '25') return q === 0 ? D.color : D.alt;
  if(D.dither === '75') return q === 0 ? D.alt : D.color;
  return D.color;
}

function put(x, y, col, a){
  if(!inside(x, y)) return;
  const i = idx(x, y);
  if(a >= 255){
    D.px[i] = col[0]; D.px[i+1] = col[1]; D.px[i+2] = col[2]; D.px[i+3] = 255;
    return;
  }
  if(a <= 0) return;
  const sa = a / 255, da = D.px[i+3] / 255, oa = sa + da * (1 - sa);
  for(let k = 0; k < 3; k++)
    D.px[i+k] = Math.round((col[k] * sa + D.px[i+k] * da * (1 - sa)) / Math.max(oa, 1e-6));
  D.px[i+3] = Math.round(oa * 255);
}

function stamp(x, y, erase){
  const r = D.size - 1;
  for(let dy = -r; dy <= r; dy++) for(let dx = -r; dx <= r; dx++){
    if(dx*dx + dy*dy > r*r + r) continue;                 // round nib, not square
    for(const [mx, my] of mirrored(x + dx, y + dy)){
      if(erase){
        if(inside(mx,my)){ const i = idx(mx,my); D.px[i]=D.px[i+1]=D.px[i+2]=D.px[i+3]=0; }
      } else {
        put(mx, my, ditherPick(mx, my), D.alpha);
      }
    }
  }
}

// Symmetry. Mirrored about the CENTRE LINE of the canvas, which for an even width falls between two
// columns -- w-1-x, not w-x, or every mirrored stroke lands one pixel off and the sprite is subtly
// lopsided in a way that is maddening to find later.
function mirrored(x, y){
  const out = [[x, y]];
  if(D.mirror === 'h' || D.mirror === 'both') out.push([D.w - 1 - x, y]);
  if(D.mirror === 'v' || D.mirror === 'both') out.push([x, D.h - 1 - y]);
  if(D.mirror === 'both') out.push([D.w - 1 - x, D.h - 1 - y]);
  return out;
}

function line(x0, y0, x1, y1, fn){
  const dx = Math.abs(x1-x0), dy = Math.abs(y1-y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for(;;){
    fn(x0, y0);
    if(x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if(e2 > -dy){ err -= dy; x0 += sx; }
    if(e2 <  dx){ err += dx; y0 += sy; }
  }
}

function fill(x, y, col){
  if(!inside(x, y)) return;
  const i0 = idx(x, y);
  const t = [D.px[i0], D.px[i0+1], D.px[i0+2], D.px[i0+3]];
  if(t[0] === col[0] && t[1] === col[1] && t[2] === col[2] && t[3] === D.alpha) return;
  const stack = [[x, y]];
  const seen = new Uint8Array(D.w * D.h);
  while(stack.length){
    const [cx, cy] = stack.pop();
    if(!inside(cx, cy) || seen[cy*D.w+cx]) continue;
    const i = idx(cx, cy);
    if(D.px[i] !== t[0] || D.px[i+1] !== t[1] || D.px[i+2] !== t[2] || D.px[i+3] !== t[3]) continue;
    seen[cy*D.w+cx] = 1;
    put(cx, cy, ditherPick(cx, cy), D.alpha);
    stack.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
  }
}

// ---------------------------------------------------------------------------------------------------
//  GUIDE OUTLINES -- the blueprint you draw on top of.
//
//  Not the onion skin. The onion skin traces a sprite that already exists; these are SYNTHETIC bases:
//  the proportions of a thing, with no art in them. Pick "sword" and you get a blade axis, a taper,
//  a ricasso, quillons and a pommel at the right relative lengths, and you draw your sword over it.
//
//  TWO LINE WEIGHTS, AND THIS IS THE WHOLE DIFFERENCE BETWEEN A GUIDE AND A MESS. The first version
//  drew everything in one dashed blue and the result read as noise -- you could not tell the edge you
//  were meant to trace from the measurement telling you where it goes. So:
//     HARD  the silhouette. The line your pixels should land on.
//     SOFT  construction: axes, landmark heights, centre lines, fill levels. Never traced, only
//           measured against, and dimmer and finer so it stays out of the way.
//
//  WHY THE GAME'S OWN TAXONOMY AND NOT GENERIC CLIP ART. The seven weapon families are exactly the
//  seven in CWEAP (sword, dagger, bow, xbow, staff, wand, gauntlet) and the armour ones are slots
//  that exist (arm_/helm_ x leather/plate/robe, rings). A guide for a weapon the game cannot equip
//  would be a nicely drawn dead end.
//
//  THE CHARACTER GUIDES ARE A CANON OF PROPORTIONS, not an outline: eye line, chin, shoulder, chest,
//  waist, hip, wrist, knee, ankle, ground. That is what you actually need when the sprite is 92px
//  tall and every landmark is two pixels from its neighbour -- an outline of a person tells you
//  nothing you did not already know, but "the hands end at mid-thigh" does.
//
//  EVERY COORDINATE IS NORMALISED 0..1 and multiplied by the canvas at draw time, so one definition
//  fits a 32px sketch and a 92px hero frame. `fit` is the size that family's real art tends to be,
//  measured off assets/items and assets/knight rather than guessed -- offered, never imposed.
//
//  Drawn BEHIND the pixels, like a light table: your art covers the guide as you lay it down, and it
//  never touches image data so it cannot end up in an exported PNG.
// ---------------------------------------------------------------------------------------------------

// GUIDES SNAP TO THE LATTICE. A blueprint whose edge falls halfway across a pixel cannot be traced
// -- you are left guessing which side of the line the pixel belongs on, every time, and the guess is
// what makes a hand-drawn sprite look wobbly. With a grid on, every guide coordinate is rounded to a
// whole art pixel, so the line you are tracing IS a pixel boundary.
// Set per-draw by drawTemplate, since it needs the art-pixel size in display units.
let SNAPSTEP = 0;
const sx = v => SNAPSTEP ? Math.round(v / SNAPSTEP) * SNAPSTEP : v;

// Path helpers. `S` selects the weight; every template takes it and uses both.
function mkStyle(g, zoom){
  const w = Math.max(1, zoom / 9);
  return kind => {
    if(kind === 'hard'){
      g.strokeStyle = '#8fe3ff'; g.globalAlpha = 1;    g.lineWidth = w * 1.5; g.setLineDash([]);
    } else {
      g.strokeStyle = '#6fa8c8'; g.globalAlpha = 0.62; g.lineWidth = w;
      g.setLineDash([Math.max(2, zoom/3.5), Math.max(2, zoom/3.5)]);
    }
  };
}
function gp(g, W, H, pts, close){
  g.beginPath();
  pts.forEach(([x, y], i) => i ? g.lineTo(sx(x*W), sx(y*H)) : g.moveTo(sx(x*W), sx(y*H)));
  if(close) g.closePath();
  g.stroke();
}
function ge(g, W, H, cx, cy, rx, ry){
  g.beginPath(); g.ellipse(cx*W, cy*H, rx*W, ry*H, 0, 0, 6.2832); g.stroke();
}
function gl(g, W, H, x0, y0, x1, y1){
  g.beginPath(); g.moveTo(sx(x0*W), sx(y0*H)); g.lineTo(sx(x1*W), sx(y1*H)); g.stroke();
}
// a smooth closed outline through points -- quadratic midpoints, which is enough for a blueprint and
// far kinder to read than a polygon pretending to be a curve
function gcurve(g, W, H, pts, close){
  g.beginPath();
  const P = pts.map(([x,y]) => [sx(x*W), sx(y*H)]);
  g.moveTo(P[0][0], P[0][1]);
  for(let i = 1; i < P.length - 1; i++){
    const mx = (P[i][0] + P[i+1][0]) / 2, my = (P[i][1] + P[i+1][1]) / 2;
    g.quadraticCurveTo(P[i][0], P[i][1], mx, my);
  }
  g.quadraticCurveTo(P[P.length-1][0], P[P.length-1][1], P[close?0:P.length-1][0], P[close?0:P.length-1][1]);
  if(close) g.closePath();
  g.stroke();
}
// the horizontal landmark rules that make a proportion guide worth having
function rules(g, W, H, S, list){
  S('soft');
  list.forEach(y => gl(g, W, H, 0.06, y, 0.94, y));
}

const TEMPLATES = {
  none: null,

  // ---- characters ------------------------------------------------------------------------------
  // A 4.5-head canon at 92px: head 0.20 of the frame, shoulders 2.2 head-widths, hands to mid-thigh.
  'character front': { fit:[92,92], draw(g,W,H,S){
    rules(g,W,H,S, [0.155, 0.26, 0.30, 0.385, 0.47, 0.545, 0.72, 0.90]);
    S('soft'); gl(g,W,H, 0.5,0.03, 0.5,0.97);
    S('hard');
    gcurve(g,W,H, [[0.50,0.055],[0.605,0.10],[0.615,0.20],[0.50,0.265],[0.385,0.20],[0.395,0.10]], true);
    gp(g,W,H, [[0.455,0.265],[0.455,0.30]]); gp(g,W,H, [[0.545,0.265],[0.545,0.30]]);
    gcurve(g,W,H, [[0.31,0.315],[0.50,0.295],[0.69,0.315],[0.665,0.47],[0.685,0.55],
                   [0.50,0.575],[0.315,0.55],[0.335,0.47]], true);
    gcurve(g,W,H, [[0.31,0.315],[0.245,0.345],[0.225,0.46],[0.245,0.55],[0.255,0.60]]);
    gcurve(g,W,H, [[0.69,0.315],[0.755,0.345],[0.775,0.46],[0.755,0.55],[0.745,0.60]]);
    gcurve(g,W,H, [[0.355,0.565],[0.345,0.72],[0.365,0.885],[0.44,0.895]]);
    gcurve(g,W,H, [[0.645,0.565],[0.655,0.72],[0.635,0.885],[0.56,0.895]]);
    gp(g,W,H, [[0.33,0.90],[0.47,0.90]]); gp(g,W,H, [[0.53,0.90],[0.67,0.90]]);
    S('soft');
    gl(g,W,H, 0.42,0.155, 0.58,0.155);
    ge(g,W,H, 0.255,0.60, 0.035,0.028); ge(g,W,H, 0.745,0.60, 0.035,0.028);
  }},

  'character side': { fit:[92,92], draw(g,W,H,S){
    rules(g,W,H,S, [0.155, 0.26, 0.30, 0.385, 0.47, 0.545, 0.72, 0.90]);
    S('soft'); gl(g,W,H, 0.5,0.03, 0.5,0.97);
    S('hard');
    gcurve(g,W,H, [[0.505,0.055],[0.61,0.105],[0.60,0.21],[0.50,0.265],[0.415,0.215],[0.415,0.10]], true);
    gp(g,W,H, [[0.475,0.265],[0.47,0.31]]); gp(g,W,H, [[0.55,0.265],[0.555,0.31]]);
    gcurve(g,W,H, [[0.44,0.31],[0.585,0.315],[0.60,0.45],[0.575,0.56],[0.44,0.565],[0.425,0.45]], true);
    gcurve(g,W,H, [[0.50,0.325],[0.455,0.44],[0.475,0.55],[0.49,0.60]]);
    // legs: a stride, not a compass. The far leg trails and both feet stay under the hips -- splayed
    // legs were the first version's tell that this was a stick figure and not a proportion guide.
    gcurve(g,W,H, [[0.475,0.56],[0.435,0.70],[0.445,0.875]]);
    gcurve(g,W,H, [[0.545,0.56],[0.565,0.70],[0.545,0.875]]);
    gp(g,W,H, [[0.395,0.90],[0.515,0.90]]); gp(g,W,H, [[0.495,0.90],[0.615,0.90]]);
    S('soft'); gl(g,W,H, 0.50,0.155, 0.615,0.155);
  }},

  quadruped: { fit:[64,72], draw(g,W,H,S){
    S('soft'); gl(g,W,H, 0.06,0.925, 0.94,0.925); gl(g,W,H, 0.10,0.50, 0.90,0.50);
    S('hard');
    gcurve(g,W,H, [[0.34,0.40],[0.55,0.365],[0.74,0.40],[0.80,0.52],[0.72,0.655],
                   [0.50,0.685],[0.32,0.645],[0.265,0.52]], true);                       // barrel
    // HEAD AND NECK AS SEPARATE PIECES. Two attempts got this wrong in opposite ways: an ellipse
    // with two thin lines to the body read as a balloon on strings, and one smooth closed curve from
    // muzzle to shoulder read as a fin. A skull with a flat muzzle, and a neck that is plainly a
    // wedge between it and the barrel, is legible at 64px in a way neither of those were.
    gp(g,W,H, [[0.085,0.335],[0.115,0.265],[0.195,0.235],[0.275,0.255],
               [0.305,0.325],[0.275,0.395],[0.175,0.415],[0.105,0.395]], true);          // skull
    gp(g,W,H, [[0.275,0.30],[0.395,0.425]]);                                             // neck, top
    gp(g,W,H, [[0.245,0.405],[0.335,0.515]]);                                            // neck, under
    S('soft');
    gl(g,W,H, 0.095,0.355, 0.245,0.345);                                                 // muzzle line
    gp(g,W,H, [[0.215,0.245],[0.245,0.185],[0.285,0.255]]);                              // ear
    S('hard');
    gcurve(g,W,H, [[0.335,0.655],[0.305,0.775],[0.315,0.905]]);
    gcurve(g,W,H, [[0.435,0.675],[0.415,0.79],[0.425,0.905]]);
    gcurve(g,W,H, [[0.625,0.675],[0.645,0.79],[0.635,0.905]]);
    gcurve(g,W,H, [[0.715,0.655],[0.745,0.775],[0.735,0.905]]);
    gcurve(g,W,H, [[0.795,0.455],[0.885,0.385],[0.945,0.475]]);
  }},

  // ---- weapons ---------------------------------------------------------------------------------
  sword: { fit:[64,64], draw(g,W,H,S){
    S('soft'); gl(g,W,H, 0.5,0.02, 0.5,0.98); gl(g,W,H, 0.10,0.60, 0.90,0.60);
    S('hard');
    gp(g,W,H, [[0.50,0.035],[0.585,0.135],[0.575,0.545],[0.555,0.585],
               [0.445,0.585],[0.425,0.545],[0.415,0.135]], true);
    S('soft'); gl(g,W,H, 0.50,0.075, 0.50,0.545);
    S('hard');
    gp(g,W,H, [[0.455,0.585],[0.545,0.585],[0.545,0.625],[0.455,0.625]], true);
    // A CROSSGUARD IS A BAR, NOT AN OVAL. Drawn as a straight tapered polyline: the smooth curve the
    // first pass used rounded the quillons into an ellipse that swallowed the grip behind it.
    gp(g,W,H, [[0.155,0.648],[0.315,0.618],[0.685,0.618],[0.845,0.648],
               [0.685,0.678],[0.315,0.678]], true);
    gp(g,W,H, [[0.455,0.678],[0.545,0.678],[0.535,0.865],[0.465,0.865]], true);
    S('soft'); for(const y of [0.725,0.765,0.805]) gl(g,W,H, 0.468,y, 0.532,y);
    S('hard'); gcurve(g,W,H, [[0.50,0.865],[0.578,0.905],[0.50,0.958],[0.422,0.905]], true);
  }},

  dagger: { fit:[64,64], draw(g,W,H,S){
    S('soft'); gl(g,W,H, 0.5,0.02, 0.5,0.98); gl(g,W,H, 0.12,0.505, 0.88,0.505);
    S('hard');
    gp(g,W,H, [[0.50,0.055],[0.60,0.19],[0.575,0.455],[0.545,0.495],
               [0.455,0.495],[0.425,0.455],[0.40,0.19]], true);
    S('soft'); gl(g,W,H, 0.50,0.10, 0.50,0.455);
    S('hard');
    gp(g,W,H, [[0.255,0.535],[0.395,0.508],[0.605,0.508],[0.745,0.535],
               [0.605,0.562],[0.395,0.562]], true);                                      // guard bar
    gp(g,W,H, [[0.462,0.562],[0.538,0.562],[0.532,0.845],[0.468,0.845]], true);
    S('soft'); for(const y of [0.635,0.695,0.755]) gl(g,W,H, 0.470,y, 0.530,y);
    S('hard'); gcurve(g,W,H, [[0.50,0.845],[0.575,0.885],[0.50,0.935],[0.425,0.885]], true);
  }},

  bow: { fit:[64,64], draw(g,W,H,S){
    S('soft'); gl(g,W,H, 0.10,0.50, 0.94,0.50); gl(g,W,H, 0.70,0.05, 0.70,0.95);
    S('hard');
    // ONE CLOSED LIMB, so the belly and back meet at the tips. Two open arcs left the bow visibly
    // unfinished at both ends -- the exact place a bow's silhouette is most recognisable.
    g.beginPath();
    g.moveTo(0.745*W, 0.055*H);
    g.bezierCurveTo(0.60*W,0.145*H, 0.295*W,0.30*H, 0.29*W,0.50*H);
    g.bezierCurveTo(0.295*W,0.70*H, 0.60*W,0.855*H, 0.745*W,0.945*H);
    g.lineTo(0.705*W, 0.925*H);
    g.bezierCurveTo(0.60*W,0.815*H, 0.365*W,0.675*H, 0.36*W,0.50*H);
    g.bezierCurveTo(0.365*W,0.325*H, 0.60*W,0.185*H, 0.705*W,0.075*H);
    g.closePath(); g.stroke();
    gp(g,W,H, [[0.29,0.415],[0.375,0.415],[0.375,0.585],[0.29,0.585]], true);            // riser grip
    S('soft'); gl(g,W,H, 0.725,0.065, 0.725,0.935);                                      // string
    gl(g,W,H, 0.375,0.50, 0.725,0.50);                                                   // arrow line
  }},

  xbow: { fit:[64,64], draw(g,W,H,S){
    S('soft'); gl(g,W,H, 0.5,0.03, 0.5,0.97); gl(g,W,H, 0.06,0.28, 0.94,0.28);
    S('hard');
    g.beginPath();                                                                       // lath, closed
    g.moveTo(0.115*W,0.335*H);
    g.quadraticCurveTo(0.50*W,0.185*H, 0.885*W,0.335*H);
    g.lineTo(0.865*W,0.278*H);
    g.quadraticCurveTo(0.50*W,0.142*H, 0.135*W,0.278*H);
    g.closePath(); g.stroke();
    S('soft'); gp(g,W,H, [[0.125,0.307],[0.50,0.445],[0.875,0.307]]);
    S('hard');
    gp(g,W,H, [[0.445,0.245],[0.555,0.245],[0.555,0.66],[0.60,0.735],[0.545,0.905],
               [0.415,0.905],[0.445,0.70]], true);
    S('soft'); gl(g,W,H, 0.50,0.245, 0.50,0.66);
    S('hard');
    gp(g,W,H, [[0.455,0.60],[0.545,0.60]]);
    gcurve(g,W,H, [[0.50,0.66],[0.435,0.71],[0.455,0.78]]);
    // stirrup: attached to the nose of the stock, not hovering above it
    gcurve(g,W,H, [[0.455,0.245],[0.44,0.185],[0.50,0.155],[0.56,0.185],[0.545,0.245]]);
  }},

  staff: { fit:[64,64], draw(g,W,H,S){
    S('soft'); gl(g,W,H, 0.5,0.02, 0.5,0.98); gl(g,W,H, 0.12,0.20, 0.88,0.20);
    S('hard');
    gcurve(g,W,H, [[0.50,0.045],[0.655,0.115],[0.50,0.205],[0.345,0.115]], true);
    gp(g,W,H, [[0.415,0.195],[0.585,0.195],[0.565,0.255],[0.435,0.255]], true);
    gp(g,W,H, [[0.455,0.255],[0.545,0.255],[0.535,0.935],[0.465,0.935]], true);
    S('soft'); for(const y of [0.40,0.44,0.48]) gl(g,W,H, 0.465,y, 0.535,y);
    S('hard'); gp(g,W,H, [[0.45,0.935],[0.55,0.935],[0.535,0.975],[0.465,0.975]], true);
  }},

  wand: { fit:[64,64], draw(g,W,H,S){
    S('soft'); gl(g,W,H, 0.5,0.02, 0.5,0.98); gl(g,W,H, 0.14,0.29, 0.86,0.29);
    S('hard');
    gcurve(g,W,H, [[0.50,0.075],[0.615,0.155],[0.575,0.275],[0.425,0.275],[0.385,0.155]], true);
    gp(g,W,H, [[0.44,0.275],[0.56,0.275],[0.55,0.325],[0.45,0.325]], true);
    gp(g,W,H, [[0.465,0.325],[0.535,0.325],[0.565,0.90],[0.435,0.90]], true);
    S('soft'); for(const y of [0.70,0.76,0.82]) gl(g,W,H, 0.45,y, 0.55,y);
    S('hard'); gp(g,W,H, [[0.435,0.90],[0.565,0.90],[0.545,0.95],[0.455,0.95]], true);
  }},

  gauntlet: { fit:[62,62], draw(g,W,H,S){
    S('soft'); gl(g,W,H, 0.5,0.05, 0.5,0.95); gl(g,W,H, 0.10,0.46, 0.90,0.46);
    S('hard');
    // ONE SILHOUETTE, fist into cuff. The first pass drew two rounded boxes with a gap between them
    // and it read as a bread roll on a cup rather than a hand in armour.
    gcurve(g,W,H, [[0.30,0.255],[0.50,0.225],[0.70,0.255],[0.745,0.375],[0.735,0.50],
                   [0.775,0.615],[0.79,0.775],[0.735,0.885],[0.50,0.915],
                   [0.265,0.885],[0.21,0.775],[0.225,0.615],[0.265,0.50],[0.255,0.375]], true);
    S('soft');
    for(const x of [0.395,0.50,0.605]) gl(g,W,H, x,0.245, x,0.44);
    gl(g,W,H, 0.29,0.545, 0.71,0.545);                                                   // wrist line
    S('hard');
    for(const x of [0.345,0.45,0.555,0.66])
      gp(g,W,H, [[x-0.038,0.315],[x+0.038,0.315],[x+0.033,0.375],[x-0.033,0.375]], true);
    gcurve(g,W,H, [[0.262,0.44],[0.185,0.50],[0.232,0.575]]);                            // thumb
    gcurve(g,W,H, [[0.225,0.665],[0.50,0.705],[0.775,0.665]]);                           // cuff rim
  }},

  // ---- armour ----------------------------------------------------------------------------------
  'chest armour': { fit:[58,52], draw(g,W,H,S){
    S('soft'); gl(g,W,H, 0.5,0.03, 0.5,0.97); gl(g,W,H, 0.06,0.30, 0.94,0.30);
    gl(g,W,H, 0.06,0.635, 0.94,0.635);
    S('hard');
    gcurve(g,W,H, [[0.315,0.215],[0.50,0.185],[0.685,0.215],[0.735,0.36],[0.705,0.60],
                   [0.685,0.80],[0.50,0.845],[0.315,0.80],[0.295,0.60],[0.265,0.36]], true);
    // pauldrons that sit ON the shoulder line rather than beside the neck like ears
    gcurve(g,W,H, [[0.315,0.225],[0.185,0.245],[0.115,0.36],[0.175,0.475],[0.295,0.46]], true);
    gcurve(g,W,H, [[0.685,0.225],[0.815,0.245],[0.885,0.36],[0.825,0.475],[0.705,0.46]], true);
    gcurve(g,W,H, [[0.395,0.195],[0.50,0.325],[0.605,0.195]]);
    S('soft');
    gl(g,W,H, 0.30,0.635, 0.70,0.635);
    gl(g,W,H, 0.335,0.44, 0.665,0.44);
    gp(g,W,H, [[0.50,0.325],[0.50,0.80]]);
  }},

  helm: { fit:[40,62], draw(g,W,H,S){
    S('soft'); gl(g,W,H, 0.5,0.03, 0.5,0.97); gl(g,W,H, 0.06,0.46, 0.94,0.46);
    S('hard');
    // A SKULL, NOT AN EGG: narrower crown, a jaw that comes forward, cheeks that step in. The first
    // pass was one ellipse with a cross drawn on it, which is a helmet only if you already know.
    gcurve(g,W,H, [[0.185,0.46],[0.225,0.155],[0.50,0.06],[0.775,0.155],[0.815,0.46],
                   [0.80,0.66],[0.70,0.80],[0.50,0.845],[0.30,0.80],[0.20,0.66]], true);
    gp(g,W,H, [[0.185,0.44],[0.815,0.44],[0.815,0.50],[0.185,0.50]], true);              // brow band
    S('soft'); gl(g,W,H, 0.50,0.075, 0.50,0.44);                                         // crest
    S('hard');
    gp(g,W,H, [[0.29,0.545],[0.435,0.545],[0.435,0.60],[0.29,0.60]], true);              // eye slits
    gp(g,W,H, [[0.565,0.545],[0.71,0.545],[0.71,0.60],[0.565,0.60]], true);
    gp(g,W,H, [[0.475,0.50],[0.525,0.50],[0.525,0.72],[0.475,0.72]], true);              // nasal
    gcurve(g,W,H, [[0.235,0.62],[0.30,0.78],[0.44,0.835]]);                              // cheek L
    gcurve(g,W,H, [[0.765,0.62],[0.70,0.78],[0.56,0.835]]);                              // cheek R
    S('soft'); gcurve(g,W,H, [[0.26,0.70],[0.50,0.755],[0.74,0.70]]);                    // breath line
  }},

  ring: { fit:[40,50], draw(g,W,H,S){
    S('soft'); gl(g,W,H, 0.5,0.03, 0.5,0.97); gl(g,W,H, 0.08,0.705, 0.92,0.705);
    S('hard');
    ge(g,W,H, 0.50,0.705, 0.295,0.245);                                                  // hoop outer
    ge(g,W,H, 0.50,0.705, 0.180,0.150);                                                  // hoop inner
    // A CUT STONE IN A SETTING, drawn with straight facets. Two smooth curves meeting at a point put
    // a leaf beside the hoop rather than a gem on it -- a gem reads as a gem because of its FLAT
    // table and its facet lines, and neither of those survives being drawn as a curve.
    gp(g,W,H, [[0.395,0.465],[0.605,0.465],[0.565,0.545],[0.435,0.545]], true);          // collet
    gp(g,W,H, [[0.375,0.295],[0.625,0.295],[0.605,0.465],[0.395,0.465]], true);          // crown
    gp(g,W,H, [[0.415,0.185],[0.585,0.185],[0.625,0.295],[0.375,0.295]], true);          // table
    S('soft');
    gp(g,W,H, [[0.415,0.185],[0.375,0.295]]); gp(g,W,H, [[0.585,0.185],[0.625,0.295]]);
    gp(g,W,H, [[0.50,0.185],[0.50,0.465]]);
    gp(g,W,H, [[0.455,0.295],[0.455,0.465]]); gp(g,W,H, [[0.545,0.295],[0.545,0.465]]);
  }},

  potion: { fit:[40,50], draw(g,W,H,S){
    S('soft'); gl(g,W,H, 0.5,0.02, 0.5,0.98); gl(g,W,H, 0.10,0.655, 0.90,0.655);
    S('hard');
    gp(g,W,H, [[0.365,0.055],[0.635,0.055],[0.635,0.135],[0.365,0.135]], true);
    gp(g,W,H, [[0.405,0.135],[0.595,0.135],[0.595,0.315],[0.405,0.315]], true);
    gp(g,W,H, [[0.375,0.305],[0.625,0.305]]);
    g.beginPath();
    g.moveTo(0.405*W,0.315*H);
    g.bezierCurveTo(0.105*W,0.45*H, 0.115*W,0.925*H, 0.50*W,0.935*H);
    g.bezierCurveTo(0.885*W,0.925*H, 0.895*W,0.45*H, 0.595*W,0.315*H);
    g.stroke();
    S('soft');
    gcurve(g,W,H, [[0.145,0.655],[0.50,0.685],[0.855,0.655]]);
    ge(g,W,H, 0.315,0.545, 0.055,0.045);
  }},

  shield: { fit:[52,58], draw(g,W,H,S){
    S('soft'); gl(g,W,H, 0.5,0.03, 0.5,0.97); gl(g,W,H, 0.06,0.30, 0.94,0.30);
    S('hard');
    g.beginPath();
    g.moveTo(0.135*W,0.115*H);
    g.quadraticCurveTo(0.50*W,0.065*H, 0.865*W,0.115*H);
    g.bezierCurveTo(0.865*W,0.58*H, 0.70*W,0.865*H, 0.50*W,0.955*H);
    g.bezierCurveTo(0.30*W,0.865*H, 0.135*W,0.58*H, 0.135*W,0.115*H);
    g.closePath(); g.stroke();
    gcurve(g,W,H, [[0.155,0.28],[0.50,0.325],[0.845,0.28]]);
    ge(g,W,H, 0.50,0.50, 0.115,0.10);
    S('soft');
    ge(g,W,H, 0.50,0.50, 0.055,0.048);
    gp(g,W,H, [[0.50,0.075],[0.50,0.955]]);
    gcurve(g,W,H, [[0.19,0.20],[0.50,0.145],[0.81,0.20]]);
  }},
};

function drawTemplate(g, W, H){
  const t = TEMPLATES[D.tpl];
  if(!t) return;
  g.save();
  g.translate(W/2, H/2);

  // ROTATION SHRINKS TO FIT. A 40x62 helm turned on its side is 62 wide, and on a 40-wide canvas the
  // ends would simply be gone -- silently, which is the worst way for a guide to be wrong. So the
  // guide is scaled by however much its own rotated bounding box overruns the canvas, which is 1 at
  // 0 and 180 degrees and only bites in between. Square canvases at right angles are unaffected.
  const a = D.tplRot * Math.PI / 180;
  const ca = Math.abs(Math.cos(a)), sa = Math.abs(Math.sin(a));
  const fit = Math.min(W / (W*ca + H*sa), H / (W*sa + H*ca));
  g.rotate(a);
  g.scale(fit, fit);
  if(D.tplFlip) g.scale(-1, 1);
  g.translate(-W/2, -H/2);

  // one art pixel, in display units -- the step every guide coordinate is rounded to
  // snap to the ART's pixel, which on 2x source is a 2x2 block -- snapping to the file's pixel there
  // would put guide edges inside a block, which is the thing snapping exists to prevent
  SNAPSTEP = (D.tplSnap && D.grid !== 'none') ? (W / D.w) * Math.max(1, D.artScale) : 0;
  const S = mkStyle(g, D.zoom);
  const base = D.tplAlpha;
  // Each template picks its own weight per stroke; tplAlpha scales the lot, so `fade` still does what
  // it says without flattening the hard/soft distinction that makes the guide readable.
  const wrapped = kind => { S(kind); g.globalAlpha *= base; };
  t.draw(g, W, H, wrapped);
  SNAPSTEP = 0;
  g.restore();
}

// ---------------------------------------------------------------------------------------------------
//  THE GRIDS. Every one is drawn in DISPLAY space over the zoomed pixels, never into the art.
// ---------------------------------------------------------------------------------------------------

const GRIDS = {
  none:  'none',
  pixel: 'pixel',
  block: 'block',
  iso:   'isometric 2:1',
  hex:   'hex',
  tile:  'game tile (44)',
};

function drawGrid(g, W, H, z){
  const t = D.grid;
  if(t === 'none') return;
  g.save();
  g.lineWidth = 1;

  if(t === 'pixel' || t === 'block'){
    // The 1px lattice disappears into noise past a certain density; below 6x zoom only the blocks
    // are worth drawing, and they are the useful ones anyway.
    if(t === 'pixel' && z >= 6){
      g.strokeStyle = 'rgba(255,255,255,0.10)';
      g.beginPath();
      for(let x = 1; x < D.w; x++){ g.moveTo(x*z+0.5, 0); g.lineTo(x*z+0.5, H); }
      for(let y = 1; y < D.h; y++){ g.moveTo(0, y*z+0.5); g.lineTo(W, y*z+0.5); }
      g.stroke();
    }
    // A CELL OF 1 IS NOT A CELL. autoGrid falls back to 1 when nothing divides both dimensions (a
    // 62x63 sword), and drawing the accent line at every pixel is a solid orange wash over the art
    // rather than a guide. Below 2 there is nothing to subdivide, so draw nothing.
    const b = D.block;
    if(b >= 2){
      g.strokeStyle = 'rgba(255,176,46,0.34)';
      g.beginPath();
      for(let x = b; x < D.w; x += b){ g.moveTo(x*z+0.5, 0); g.lineTo(x*z+0.5, H); }
      for(let y = b; y < D.h; y += b){ g.moveTo(0, y*z+0.5); g.lineTo(W, y*z+0.5); }
      g.stroke();
    }
  }

  if(t === 'iso'){
    // A 2:1 diamond lattice: the shape a top-down tile becomes when the camera tips. Drawn as two
    // families of parallel lines rather than as diamonds, which is the same picture and far fewer
    // path segments.
    g.strokeStyle = 'rgba(120,200,255,0.30)';
    const step = D.block * z;                 // one diamond is `block` pixels wide
    g.beginPath();
    for(let x = -H*2; x < W + H*2; x += step){
      g.moveTo(x, 0);            g.lineTo(x + H*2, H);       // down-right at 2:1
      g.moveTo(x, 0);            g.lineTo(x - H*2, H);       // down-left
    }
    g.stroke();
  }

  if(t === 'hex'){
    // Pointy-top hexes. `block` is the hex WIDTH in art pixels; height follows from the geometry so
    // the cells stay regular at any zoom.
    g.strokeStyle = 'rgba(180,255,180,0.28)';
    const w = D.block * z, hh = w * 1.1547;               // 2/sqrt(3)
    const rowH = hh * 0.75;
    g.beginPath();
    for(let row = 0; row * rowH < H + hh; row++){
      const oy = row * rowH, ox = (row & 1) ? w/2 : 0;
      for(let col = -1; col * w + ox < W + w; col++){
        const cx = col * w + ox, cy = oy;
        for(let i = 0; i < 6; i++){
          const a1 = Math.PI/180 * (60*i - 90), a2 = Math.PI/180 * (60*(i+1) - 90);
          const x1 = cx + Math.cos(a1)*w/2, y1 = cy + Math.sin(a1)*hh/2;
          const x2 = cx + Math.cos(a2)*w/2, y2 = cy + Math.sin(a2)*hh/2;
          g.moveTo(x1, y1); g.lineTo(x2, y2);
        }
      }
    }
    g.stroke();
  }

  if(t === 'tile'){
    // TILE is 44 in 01_constants.js. A sprite that has to stand on one wants to know where its feet
    // land, so this marks the tile box and its centre line rather than a repeating lattice.
    const T = 44 * z / 1;
    g.strokeStyle = 'rgba(255,90,120,0.45)';
    g.beginPath();
    for(let x = 0; x <= D.w; x += 44){ g.moveTo(x*z+0.5, 0); g.lineTo(x*z+0.5, H); }
    for(let y = 0; y <= D.h; y += 44){ g.moveTo(0, y*z+0.5); g.lineTo(W, y*z+0.5); }
    g.stroke();
    g.strokeStyle = 'rgba(255,90,120,0.22)';
    g.beginPath();
    g.moveTo(W/2 + 0.5, 0); g.lineTo(W/2 + 0.5, H);
    g.stroke();
  }
  g.restore();
}

// ---------------------------------------------------------------------------------------------------
//  PAINTING TO SCREEN
// ---------------------------------------------------------------------------------------------------

let cv, ctx, tmp;

// ---------------------------------------------------------------------------------------------------
//  THE VIEWPORT.
//
//  The canvas used to be sized to the ART -- 64px at 16x meant a 1024px element, and "zooming" grew
//  the element and pushed the page around. That is why zooming was awkward and why pinching drew on
//  the sprite: the canvas had touch-action:none (it must, or a stroke scrolls the page), so the
//  browser's own pinch was off, and there was nothing else offering one.
//
//  Now the canvas is a fixed WINDOW onto the art and zoom/pan are state. Which gives the thing every
//  editor has and this one did not:
//     one finger / pen / left button   draw
//     two fingers                      pinch to zoom, drag to pan -- and the stroke the first finger
//                                      started is UNDONE the moment the second lands, because on
//                                      touch the first finger always arrives first and you never
//                                      meant to draw with it
//     wheel                            zoom about the cursor
//     middle-drag, or space-drag       pan
//     the pan tool                     one-finger pan, for when two fingers are awkward
// ---------------------------------------------------------------------------------------------------

// SIZE THE CANVAS BY MEASUREMENT, not by subtracting a guessed constant from 100vh. Two goes at
// "calc(100vh - 104px)" and "- 124px" both left the undo/export row hanging off the bottom, because
// the chrome above and below it is whatever the font and the wrapping happen to make it. Ask the
// layout what is left instead. Only in landscape; the other layouts are fine in CSS.
function sizeCanvas(){
  const stage = cv.closest('.dstage');
  if(!stage) return;
  if(!matchMedia('(orientation: landscape) and (max-height: 560px)').matches){
    cv.style.height = '';                     // hand it back to the stylesheet
    return;
  }
  // The stage is a flex column and the pane is flex:1, so the pane already holds exactly the space
  // the bars did not take. Match the canvas to it and the arithmetic stops being ours.
  const pane = cv.parentElement;
  const cs = getComputedStyle(pane);
  const inner = pane.clientHeight
    - parseFloat(cs.paddingTop || 0) - parseFloat(cs.paddingBottom || 0);
  cv.style.height = Math.max(90, Math.floor(inner)) + 'px';
}

function viewSize(){
  // Backing store in CSS pixels: no devicePixelRatio scaling, because every draw here is
  // nearest-neighbour pixel art and a fractional backing store is how you get blurry edges.
  const r = cv.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
  if(cv.width !== w || cv.height !== h){ cv.width = w; cv.height = h; }
  return [w, h];
}

function fitView(){
  const [vw, vh] = viewSize();
  const z = Math.max(1, Math.floor(Math.min(vw / D.w, vh / D.h)));
  D.zoom = D.zoomRaw = Math.min(64, z);
  D.panX = Math.round((vw - D.w * D.zoom) / 2);
  D.panY = Math.round((vh - D.h * D.zoom) / 2);
}

// ZOOM IS AN INTEGER AT OR ABOVE 1:1, AND THIS IS WHY THE GRID DRIFTED.
// At a fractional scale the canvas cannot give every art pixel the same width: measured at zoom 11.3
// on a striped test image, on-screen pixels came out 10, 11 AND 12 device pixels wide, while the grid
// stepped a uniform 11.3 -- so the lines slid off the pixel edges further along each row. At integer
// zoom every pixel is exactly z wide and the grid lands on the boundaries by construction.
// Below 1:1 the pixel lattice is not drawn anyway (it would be denser than the pixels), so fractions
// are allowed there.
function snapZoom(z){
  z = clamp(z, 0.25, 64);
  return z >= 1 ? Math.round(z) : z;
}

// The RAW zoom stays continuous so a pinch accumulates smoothly; only what we render is snapped.
// Snapping the value itself would make small gesture deltas round away to nothing and the pinch
// would feel stuck.
function applyZoom(raw, sx, sy){
  const ax = (sx - D.panX) / D.zoom, ay = (sy - D.panY) / D.zoom;
  D.zoomRaw = clamp(raw, 0.25, 64);
  D.zoom = snapZoom(D.zoomRaw);
  D.panX = sx - ax * D.zoom;
  D.panY = sy - ay * D.zoom;
}

// Zoom keeping the art point under (sx,sy) exactly where it is -- the thing that makes zooming feel
// like moving a lens rather than being teleported.
function zoomAt(factor, sx, sy){
  applyZoom((D.zoomRaw || D.zoom) * factor, sx, sy);
}
function zoomTo(z, sx, sy){
  const [vw, vh] = viewSize();
  applyZoom(z, sx === undefined ? vw/2 : sx, sy === undefined ? vh/2 : sy);
}

function paint(){
  const [vw, vh] = viewSize();
  // THE VIEW IS MEASURED, AND AT BOOT THERE IS NOTHING TO MEASURE. _spritedraw boots on
  // DOMContentLoaded while the draw view is still display:none, so the canvas is 0x0 and fitView()
  // computes zoom 1 with the art parked off-screen -- which looked exactly like "zoom is broken".
  // Fit properly the first time the canvas has real dimensions.
  if(!D._fitted && vw > 2 && vh > 2){ D._fitted = true; fitView(); return paint(); }
  const z = D.zoom, W = D.w * z, H = D.h * z;
  const ox = Math.round(D.panX), oy = Math.round(D.panY);
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = '#100e14';
  ctx.fillRect(0, 0, vw, vh);

  ctx.save();
  ctx.beginPath(); ctx.rect(ox, oy, W, H); ctx.clip();     // nothing spills outside the art

  // Checkerboard, so transparent reads as transparent and not as black -- MEASURED IN ART PIXELS,
  // not in screen pixels. At a fixed 8 screen px it was finer than the art at any zoom above 8x and
  // aligned with nothing, so over a transparent area it read as a grid that did not match the
  // sprite. Whole art pixels per square means every square edge IS a pixel edge; the count per
  // square grows as you zoom out so the squares stay a sensible size on screen.
  const cellArt = Math.max(1, Math.round(8 / Math.max(1, z)));
  const c = cellArt * z;
  ctx.fillStyle = '#1a1620'; ctx.fillRect(ox, oy, W, H);
  ctx.fillStyle = '#221d2a';
  for(let gy = 0; gy * c < H; gy++) for(let gx = 0; gx * c < W; gx++)
    if((gx + gy) & 1)
      ctx.fillRect(ox + gx*c, oy + gy*c, Math.min(c, W - gx*c), Math.min(c, H - gy*c));

  ctx.translate(ox, oy);

  if(D.onion){
    ctx.globalAlpha = 0.28;
    tmp.width = D.onion.w; tmp.height = D.onion.h;
    tmp.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(D.onion.d), D.onion.w, D.onion.h), 0, 0);
    ctx.drawImage(tmp, 0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  drawTemplate(ctx, W, H);          // behind the pixels, like a light table

  tmp.width = D.w; tmp.height = D.h;
  tmp.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(D.px), D.w, D.h), 0, 0);
  ctx.drawImage(tmp, 0, 0, W, H);

  drawGrid(ctx, W, H, z);
  ctx.restore();

  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  ctx.strokeRect(ox + 0.5, oy + 0.5, W - 1, H - 1);        // canvas edge, so you can see the bounds

  const st = $('#dstats');
  if(st) st.textContent = `${D.w}x${D.h}  ${z % 1 ? z.toFixed(1) : z}x  ${GRIDS[D.grid]}`;
  const zs = $('#dzoom');
  if(zs && +zs.value !== Math.round(z)) zs.value = Math.round(clamp(z, 1, 32));
}

// ---------------------------------------------------------------------------------------------------
//  INPUT. Pointer events only -- one code path for mouse, pen and finger.
// ---------------------------------------------------------------------------------------------------

let drawing = false, last = null, shapeFrom = null, before = null, snapped = false;
const ptrs = new Map();            // active pointers, for pinch
let gesture = null, panning = null, spaceHeld = false;

function local(e){
  const r = cv.getBoundingClientRect();
  return [(e.clientX - r.left) * (cv.width / r.width),
          (e.clientY - r.top)  * (cv.height / r.height)];
}
function atEvent(e){
  const [sx, sy] = local(e);
  return [Math.floor((sx - D.panX) / D.zoom), Math.floor((sy - D.panY) / D.zoom)];
}

function pickAt(x, y){
  if(!inside(x,y)) return;
  const i = idx(x,y);
  if(D.px[i+3] < 8) return;
  setColor([D.px[i], D.px[i+1], D.px[i+2]]);
}

// THE ONE THAT MATTERS. A pinch begins as a single finger, so by the time the second arrives a stroke
// is already down. Rolling it back off the undo stack is the difference between "zoom" and "zoom, and
// also a dot in the middle of my sprite".
function cancelStroke(){
  if(snapped && D.undo.length){ D.px = D.undo.pop(); }
  drawing = false; last = null; shapeFrom = null; before = null; snapped = false;
}

function beginStroke(e){
  const [x, y] = atEvent(e);
  const erase = D.tool === 'eraser' || e.button === 2;
  if(D.tool === 'picker'){ pickAt(x, y); return; }
  snapshot(); snapped = true;
  if(D.tool === 'fill'){ fill(x, y, D.color); paint(); return; }
  if(D.tool === 'line' || D.tool === 'rect' || D.tool === 'ellipse'){
    shapeFrom = [x, y]; before = new Uint8ClampedArray(D.px); drawing = true; return;
  }
  drawing = true; last = [x, y];
  stamp(x, y, erase);
  paint();
}

function down(e){
  // Capture is a nicety (it keeps a stroke alive if the finger leaves the canvas) and it THROWS for
  // a pointer the browser does not consider active. Unguarded it took the rest of this handler with
  // it, so nothing was ever added to `ptrs` -- no stroke, and no pinch either.
  try { cv.setPointerCapture(e.pointerId); } catch(err){}
  ptrs.set(e.pointerId, local(e));

  if(ptrs.size >= 2){
    cancelStroke();
    const p = [...ptrs.values()];
    gesture = {
      dist: Math.hypot(p[0][0]-p[1][0], p[0][1]-p[1][1]) || 1,
      mid: [(p[0][0]+p[1][0])/2, (p[0][1]+p[1][1])/2],
    };
    return;
  }
  // pan rather than draw: the pan tool, the middle button, or space held down
  if(D.tool === 'pan' || e.button === 1 || spaceHeld){
    panning = { at: local(e), panX: D.panX, panY: D.panY };
    return;
  }
  beginStroke(e);
}

function move(e){
  if(ptrs.has(e.pointerId)) ptrs.set(e.pointerId, local(e));

  if(gesture && ptrs.size >= 2){
    const p = [...ptrs.values()];
    const dist = Math.hypot(p[0][0]-p[1][0], p[0][1]-p[1][1]) || 1;
    const mid  = [(p[0][0]+p[1][0])/2, (p[0][1]+p[1][1])/2];
    zoomAt(dist / gesture.dist, gesture.mid[0], gesture.mid[1]);
    D.panX += mid[0] - gesture.mid[0];            // two-finger drag pans at the same time
    D.panY += mid[1] - gesture.mid[1];
    gesture.dist = dist; gesture.mid = mid;
    paint();
    return;
  }

  if(panning){
    const [sx, sy] = local(e);
    D.panX = panning.panX + (sx - panning.at[0]);
    D.panY = panning.panY + (sy - panning.at[1]);
    paint();
    return;
  }

  if(!drawing) return;
  const [x, y] = atEvent(e);
  if(shapeFrom){
    D.px = new Uint8ClampedArray(before);
    drawShape(shapeFrom[0], shapeFrom[1], x, y);
    paint();
    return;
  }
  const erase = D.tool === 'eraser' || (e.buttons & 2);
  if(last) line(last[0], last[1], x, y, (px, py) => stamp(px, py, erase));
  last = [x, y];
  paint();
}

function up(e){
  if(e && e.pointerId !== undefined) ptrs.delete(e.pointerId);
  if(ptrs.size < 2) gesture = null;
  if(ptrs.size === 0){
    panning = null;
    drawing = false; last = null; shapeFrom = null; before = null; snapped = false;
  }
}

function drawShape(x0, y0, x1, y1){
  const put1 = (x, y) => stamp(x, y, false);
  if(D.tool === 'line') return line(x0, y0, x1, y1, put1);
  if(D.tool === 'rect'){
    line(x0,y0,x1,y0,put1); line(x1,y0,x1,y1,put1);
    line(x1,y1,x0,y1,put1); line(x0,y1,x0,y0,put1);
    return;
  }
  if(D.tool === 'ellipse'){
    const cx = (x0+x1)/2, cy = (y0+y1)/2;
    const rx = Math.abs(x1-x0)/2, ry = Math.abs(y1-y0)/2;
    if(rx < 0.5 || ry < 0.5) return;
    // Sampled rather than midpoint-Bresenham: at these radii the difference is invisible and this
    // cannot leave the gaps a naive integer ellipse does on the shallow parts of the curve.
    const steps = Math.max(24, Math.ceil((rx+ry) * 6));
    let px = null;
    for(let i = 0; i <= steps; i++){
      const a = i / steps * Math.PI * 2;
      const x = Math.round(cx + Math.cos(a)*rx), y = Math.round(cy + Math.sin(a)*ry);
      if(px) line(px[0], px[1], x, y, put1); else put1(x, y);
      px = [x, y];
    }
  }
}

// ---------------------------------------------------------------------------------------------------
//  UI
// ---------------------------------------------------------------------------------------------------

function el(tag, attrs, kids){
  const n = document.createElement(tag);
  for(const k in (attrs||{})){
    if(k === 'class') n.className = attrs[k];
    else if(k.startsWith('on')) n.addEventListener(k.slice(2), attrs[k]);
    else if(attrs[k] != null) n.setAttribute(k, attrs[k]);
  }
  for(const c of (kids||[])) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  return n;
}

let svCv, svCtx;
function setColor(rgb, quiet){
  D.color = rgb;
  const [h, s, v] = rgb2hsv(rgb[0], rgb[1], rgb[2]);
  if(!quiet){
    $('#dhue').value = Math.round(h);
    drawSV(h);
    $('#dsv').dataset.s = s; $('#dsv').dataset.v = v;
  }
  $('#dhex').value = hex(rgb);
  $('#dswatch').style.background = hex(rgb);
  $('#drgb').textContent = `rgb ${rgb[0]} ${rgb[1]} ${rgb[2]}   hsv ${Math.round(h)} ${Math.round(s*100)} ${Math.round(v*100)}`;
  if(!D.recent.some(c => c[0]===rgb[0] && c[1]===rgb[1] && c[2]===rgb[2])){
    D.recent.unshift(rgb.slice()); D.recent = D.recent.slice(0, 16);
    renderSwatches();
  }
}

function drawSV(h){
  const W = svCv.width, H = svCv.height;
  const img = svCtx.createImageData(W, H);
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
    const [r, g, b] = hsv2rgb(h, x/(W-1), 1 - y/(H-1));
    const i = (y*W+x)*4;
    img.data[i]=r; img.data[i+1]=g; img.data[i+2]=b; img.data[i+3]=255;
  }
  svCtx.putImageData(img, 0, 0);
}

function swatchEl(rgb, onPick){
  return el('button', {class:'sw', style:`background:${hex(rgb)}`, title:hex(rgb),
    onclick:() => onPick(rgb),
    oncontextmenu:(e) => { e.preventDefault(); D.alt = rgb.slice(); $('#daltsw').style.background = hex(rgb); }
  }, []);
}

// EVERY COLOUR ALREADY IN THE SPRITE, one tap away. The picker tool grabs one pixel at a time and
// that is the wrong shape for the common job -- you are shading, and you want the four tones this
// sprite is actually built from, together, without hunting for a pixel of each. Read straight off
// the canvas and sorted by luminance, so what comes back reads as the ramp it is.
function grabFromCanvas(){
  D.inpal = paletteFrom({ d: D.px }, 24);
  renderSwatches();
}

function renderSwatches(){
  const put = (id, list) => {
    const n = $(id); if(!n) return;
    n.innerHTML = '';
    list.forEach(c => n.appendChild(swatchEl(c, rgb => setColor(rgb.slice()))));
  };
  put('#dinpal', D.inpal);
  put('#dramp', D.ramp);
  put('#dpal', D.palette);
  put('#drecent', D.recent);
}

function rebuildRamp(){
  D.ramp = buildRamp(D.color, +$('#rsteps').value, +$('#rhue').value,
                     +$('#rsat').value, +$('#rspread').value);
  $('#rlabel').textContent =
    `${$('#rsteps').value} steps   hue ${$('#rhue').value}°   sat ${(+$('#rsat').value).toFixed(2)}   spread ${(+$('#rspread').value).toFixed(2)}`;
  renderSwatches();
}

// ---------------------------------------------------------------------------------------------------
//  FIXING EXISTING SPRITES.
//
//  Drawing from nothing is half the job; the other half is opening a frame that is already in the
//  game and correcting four pixels of it. That wants three things this did not have:
//    * the canvas SIZED TO THE SOURCE, because 64x72 art on a 32x32 canvas is not an edit, it is a
//      different sprite;
//    * the frames GROUPED BY ACTION AND FACING, because a set is `idle_s`, `walk_e_0..3`,
//      `attack_n_0..6` all in one directory listing and the thing you want to fix is one of those
//      runs, not the alphabetical order they happen to sit in;
//    * the previous frame UNDER the current one, because the whole reason a walk cycle breaks is
//      that frame 2 does not line up with frame 1.
// ---------------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------------
//  MATCHING THE GRID TO THE ART IT CAME FROM.
//
//  Two separate things, both of which a fixed "cell = 8" gets wrong:
//
//  1. THE ART'S TRUE PIXEL SIZE. A 128x144 PNG may be a 64x72 sprite drawn at 2x -- every "pixel" is
//     a 2x2 block. Draw single pixels on that and your edit is at a finer resolution than everything
//     around it, which reads as noise against the sprite it is meant to be part of. Detected by
//     asking where the colour actually changes: if every horizontal and vertical change lands on a
//     multiple of N, the art is built from NxN blocks. (Everything currently in assets/ is honest
//     1:1 -- checked -- so this earns its keep on imported or upscaled art rather than today's.)
//
//  2. A CELL THAT DIVIDES THE SPRITE. Cell 8 on a 62x63 sword leaves a ragged part-cell against both
//     edges, so the guide lines stop meaning anything near the boundary -- exactly where placement
//     matters most. Pick a cell that divides both dimensions, nearest to a comfortable 8.
//
//  If nothing divides both (gcd 1, e.g. 62x63), say so by falling back to the pixel size rather than
//  drawing a lattice that does not line up with anything.
// ---------------------------------------------------------------------------------------------------

function pixelScale(im, maxn){
  maxn = maxn || 8;
  const { w, h, d } = im;
  const colEdge = [], rowEdge = [];
  const samePx = (i, j) => d[i] === d[j] && d[i+1] === d[j+1] && d[i+2] === d[j+2] && d[i+3] === d[j+3];
  for(let x = 1; x < w; x++){
    for(let y = 0; y < h; y++){
      if(!samePx((y*w+x)*4, (y*w+x-1)*4)){ colEdge.push(x); break; }
    }
  }
  for(let y = 1; y < h; y++){
    for(let x = 0; x < w; x++){
      if(!samePx((y*w+x)*4, ((y-1)*w+x)*4)){ rowEdge.push(y); break; }
    }
  }
  let best = 1;
  for(let n = 2; n <= maxn; n++){
    if(w % n || h % n) continue;
    if(colEdge.every(x => x % n === 0) && rowEdge.every(y => y % n === 0)) best = n;
  }
  return best;
}

function autoGrid(im){
  const scale = pixelScale(im);
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const g = gcd(im.w, im.h);
  // divisors of gcd(w,h) that are whole multiples of the art's pixel size
  const cands = [];
  for(let n = scale; n <= g; n += scale) if(g % n === 0) cands.push(n);
  if(!cands.length) return { scale, cell: scale };
  // nearest to 8, which is the subdivision that reads as a guide rather than as graph paper
  cands.sort((a, b) => Math.abs(a - 8) - Math.abs(b - 8) || a - b);
  return { scale, cell: cands[0] };
}

// idle_s.png -> {act:'idle', dir:'s', n:null}   walk_e_3.png -> {act:'walk', dir:'e', n:3}
function parseFrame(fn){
  const m = /^([a-z]+?)(?:_([nsew]{1,2}))?(?:_(\d+))?\.png$/i.exec(fn);
  if(!m) return { act: fn.replace(/\.png$/,''), dir: '', n: null };
  return { act: m[1].toLowerCase(), dir: (m[2]||'').toLowerCase(), n: m[3] === undefined ? null : +m[3] };
}
function groupFrames(frames){
  const g = new Map();
  frames.forEach(f => {
    const p = parseFrame(f);
    const key = p.act + (p.dir ? ' ' + p.dir : '');
    if(!g.has(key)) g.set(key, []);
    g.get(key).push({ file: f, n: p.n });
  });
  // numeric order, not lexical: attack_10 comes after attack_9, which "sort()" gets wrong
  g.forEach(list => list.sort((a,b) => (a.n === null ? -1 : a.n) - (b.n === null ? -1 : b.n)));
  return g;
}

let srcSet = null;                    // { path, dir:bool, groups:Map, key, i }

function srcFramePath(){
  if(!srcSet) return null;
  const list = srcSet.groups.get(srcSet.key);
  if(!list || !list.length) return null;
  const f = list[clamp(srcSet.i, 0, list.length - 1)].file;
  return srcSet.dir ? srcSet.path + '/' + f : srcSet.path;
}

async function loadSourceSet(){
  const L = window.spritelab, st = L && L.state;
  if(!st || !st.source){ alert('Pick a source on the derive tab first.'); return false; }
  const dirEnt = st.index.dirs.find(d => d.path === st.source);
  const frames = dirEnt ? dirEnt.frames : [st.source.split('/').pop()];
  srcSet = { path: st.source, dir: !!dirEnt, groups: groupFrames(frames), key: null, i: 0 };
  srcSet.key = [...srcSet.groups.keys()][0];
  const sel = $('#dsrcact');
  sel.innerHTML = '';
  for(const [k, list] of srcSet.groups) sel.appendChild(el('option', {value:k}, [`${k}  (${list.length})`]));
  sel.value = srcSet.key;
  $('#dsrcname').textContent = srcSet.path.replace('assets/','');
  updateFrameUI();
  return true;
}

function updateFrameUI(){
  const list = srcSet ? srcSet.groups.get(srcSet.key) : null;
  const n = list ? list.length : 0;
  $('#dsrcframe').max = Math.max(0, n - 1);
  $('#dsrcframe').value = clamp(srcSet ? srcSet.i : 0, 0, Math.max(0, n - 1));
  const px = D.artScale > 1 ? `  ${D.artScale}x pixels` : '';
  $('#dsrcpos').textContent = n
    ? `${(srcSet.i|0) + 1}/${n}  ${list[clamp(srcSet.i,0,n-1)].file}${px}  cell ${D.block}`
    : '-';
}

// Load the pinned frame INTO the canvas at its own size, with the pixel grid on and the previous
// frame of the same run showing through underneath.
async function loadFrameForEdit(){
  const path = srcFramePath();
  if(!path) return;
  const im = await window.spritelab.loadImage(path);
  blank(im.w, im.h);
  D.px.set(im.d);
  // the grid now describes THIS sprite rather than a default: its own pixel size, and a cell that
  // divides its dimensions instead of leaving a part-cell against the edges
  const ag = autoGrid(im);
  D.artScale = ag.scale;
  D.block = ag.cell;
  $('#dblock').value = Math.min(32, ag.cell);
  $('#dblockl').textContent = ag.cell;
  D.grid = 'pixel';
  [...document.querySelectorAll('#dgrids .tool')].forEach(b => b.classList.toggle('on', b.dataset.grid === 'pixel'));
  // onion: the frame before this one in the same action, which is the only comparison that tells you
  // whether a walk cycle actually lines up
  const list = srcSet.groups.get(srcSet.key);
  const prev = list[srcSet.i - 1];
  D.onion = prev ? await window.spritelab.loadImage(srcSet.dir ? srcSet.path + '/' + prev.file : srcSet.path) : null;
  // name the download after the file it came from, so a fix drops straight back over the original
  $('#dname').value = (list[clamp(srcSet.i,0,list.length-1)].file || '').replace(/\.png$/, '');
  D._fitted = false;
  grabFromCanvas();          // the frame you just opened is exactly the one you want colours from
  paint();
  updateFrameUI();
}

function exportPNG(){
  const c = document.createElement('canvas');
  c.width = D.w; c.height = D.h;
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(D.px), D.w, D.h), 0, 0);
  c.toBlob(b => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = ($('#dname').value || 'sprite') + '.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
}

function boot(){
  cv = $('#dcanvas'); ctx = cv.getContext('2d');
  tmp = document.createElement('canvas');
  svCv = $('#dsv'); svCtx = svCv.getContext('2d');

  blank(32, 32);

  // tools
  const tools = ['pencil','eraser','fill','line','rect','ellipse','picker','pan'];
  const tw = $('#dtools');
  tools.forEach(t => tw.appendChild(el('button', {class:'tool' + (t===D.tool?' on':''), 'data-tool':t,
    onclick:(e) => { D.tool = t; [...tw.children].forEach(b => b.classList.toggle('on', b.dataset.tool===t)); }
  }, [t])));

  // grids
  const gw = $('#dgrids');
  Object.keys(GRIDS).forEach(g => gw.appendChild(el('button', {class:'tool' + (g===D.grid?' on':''), 'data-grid':g,
    onclick:() => { D.grid = g; [...gw.children].forEach(b => b.classList.toggle('on', b.dataset.grid===g)); paint(); }
  }, [GRIDS[g]])));

  // guides
  const gt = $('#dtpl');
  Object.keys(TEMPLATES).forEach(k => gt.appendChild(el('option', {value:k}, [k])));
  gt.addEventListener('change', () => {
    D.tpl = gt.value;
    const t = TEMPLATES[D.tpl];
    // Offer the size that family's real art tends to be. Offered, never imposed -- resizing throws
    // the drawing away, so it cannot happen as a side effect of picking a guide.
    $('#dfit').textContent = t ? `fit ${t.fit[0]}x${t.fit[1]}` : 'fit';
    $('#dfit').style.display = t ? '' : 'none';
    paint();
  });
  $('#dfit').addEventListener('click', () => {
    const t = TEMPLATES[D.tpl]; if(!t) return;
    if(confirm(`Resize to ${t.fit[0]}x${t.fit[1]}? This clears the drawing.`)){
      blank(t.fit[0], t.fit[1]); fitView(); paint();
    }
  });
  $('#dtplalpha').addEventListener('input', e => { D.tplAlpha = +e.target.value; paint(); });
  const showRot = () => { $('#dtplrotl').textContent = D.tplRot + '\u00b0'; $('#dtplrot').value = D.tplRot; };
  $('#dtplrot').addEventListener('input', e => { D.tplRot = +e.target.value; showRot(); paint(); });
  // Quarter turns are the ones you actually want -- a weapon guide laid flat for an item icon, or a
  // 45 for a sprite held on the diagonal. Cycling by button beats hunting for exactly 90 on a slider.
  $('#dtplrot90').addEventListener('click', () => {
    D.tplRot = ((D.tplRot + 90 + 180) % 360) - 180; showRot(); paint(); });
  $('#dtplrot0').addEventListener('click', () => { D.tplRot = 0; showRot(); paint(); });
  showRot();
  $('#dtplflip').addEventListener('click', () => { D.tplFlip = !D.tplFlip;
    $('#dtplflip').classList.toggle('on', D.tplFlip); paint(); });

  // canvas size
  const sizes = [[16,16],[24,24],[32,32],[48,48],[64,64],[64,72],[92,92],[44,44]];
  const sw = $('#dsizes');
  sizes.forEach(([w,h]) => sw.appendChild(el('button', {class:'tool',
    onclick:() => { if(confirm(`New ${w}x${h} canvas? This clears the drawing.`)){ blank(w,h); fitView(); paint(); } }
  }, [`${w}x${h}`])));

  // colour field
  svCv.addEventListener('pointerdown', e => {
    const grab = ev => {
      const r = svCv.getBoundingClientRect();
      const s = clamp((ev.clientX - r.left) / r.width, 0, 1);
      const v = 1 - clamp((ev.clientY - r.top) / r.height, 0, 1);
      setColor(hsv2rgb(+$('#dhue').value, s, v), true);
      $('#dsv').dataset.s = s; $('#dsv').dataset.v = v;
    };
    grab(e);
    const mv = ev => grab(ev);
    const up2 = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up2); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up2);
  });
  $('#dhue').addEventListener('input', e => {
    drawSV(+e.target.value);
    setColor(hsv2rgb(+e.target.value, +($('#dsv').dataset.s||1), +($('#dsv').dataset.v||1)), true);
  });
  $('#dhex').addEventListener('change', e => { const c = parseHex(e.target.value); if(c) setColor(c); });
  $('#dalpha').addEventListener('input', e => { D.alpha = +e.target.value; $('#dalphal').textContent = D.alpha; });
  $('#dsize').addEventListener('input', e => { D.size = +e.target.value; $('#dsizel').textContent = D.size; });
  $('#dzoom').addEventListener('input', e => { zoomTo(+e.target.value); paint(); });
  $('#dzoomin').addEventListener('click',  () => { zoomTo(D.zoom * 1.5); paint(); });
  $('#dzoomout').addEventListener('click', () => { zoomTo(D.zoom / 1.5); paint(); });
  $('#dzoomfit').addEventListener('click', () => { fitView(); paint(); });
  $('#dblock').addEventListener('input', e => { D.block = +e.target.value; $('#dblockl').textContent = D.block; paint(); });
  $('#ddither').addEventListener('change', e => { D.dither = e.target.value; });
  $('#dmirror').addEventListener('change', e => { D.mirror = e.target.value; });

  ['rsteps','rhue','rsat','rspread'].forEach(id =>
    $('#'+id).addEventListener('input', rebuildRamp));
  $('#rmake').addEventListener('click', rebuildRamp);
  $('#rpal').addEventListener('click', async () => {
    // the palette of whatever the DERIVE side currently has selected -- draw in the game's colours
    const L = window.spritelab;
    const st = L && L.state;
    if(!st || !st.source){ alert('Pick a source on the derive tab first.'); return; }
    const dir = st.index.dirs.find(d => d.path === st.source);
    const path = dir ? st.source + '/' + st.frames[0] : st.source;
    const im = await L.loadImage(path);
    D.palette = paletteFrom(im, 24);
    renderSwatches();
  });

  $('#dsrcload').addEventListener('click', async () => { if(await loadSourceSet()) loadFrameForEdit(); });
  $('#dsrcact').addEventListener('change', e => {
    if(!srcSet) return;
    srcSet.key = e.target.value; srcSet.i = 0; updateFrameUI(); loadFrameForEdit();
  });
  $('#dsrcframe').addEventListener('input', e => {
    if(!srcSet) return;
    srcSet.i = +e.target.value; updateFrameUI(); loadFrameForEdit();
  });
  $('#dsrcprev').addEventListener('click', () => {
    if(!srcSet) return;
    srcSet.i = Math.max(0, srcSet.i - 1); updateFrameUI(); loadFrameForEdit();
  });
  $('#dsrcnext').addEventListener('click', () => {
    if(!srcSet) return;
    const n = srcSet.groups.get(srcSet.key).length;
    srcSet.i = Math.min(n - 1, srcSet.i + 1); updateFrameUI(); loadFrameForEdit();
  });
  $('#dtplsnap').addEventListener('click', () => {
    D.tplSnap = !D.tplSnap;
    $('#dtplsnap').classList.toggle('on', D.tplSnap);
    paint();
  });
  $('#dtplsnap').classList.toggle('on', D.tplSnap);

  $('#dgrab').addEventListener('click', grabFromCanvas);
  $('#dundo').addEventListener('click', undo);
  $('#dredo').addEventListener('click', redo);
  $('#dclear').addEventListener('click', () => { snapshot(); D.px.fill(0); paint(); });
  $('#dexport').addEventListener('click', exportPNG);
  $('#donion').addEventListener('click', async () => {
    const L = window.spritelab, st = L && L.state;
    if(!st || !st.source){ alert('Pick a source on the derive tab first.'); return; }
    const dir = st.index.dirs.find(d => d.path === st.source);
    D.onion = await L.loadImage(dir ? st.source + '/' + st.frames[0] : st.source);
    paint();
  });
  $('#donionoff').addEventListener('click', () => { D.onion = null; paint(); });

  // phone tabs. The buttons are always in the DOM and the stylesheet hides the bar above 900px, so
  // there is one layout to reason about and no resize listener deciding which one you are in.
  const dtabs = [...document.querySelectorAll('.dtabs button')];
  const dpanels = [...document.querySelectorAll('.dpanel')];
  const showDTab = key => {
    dtabs.forEach(t => t.classList.toggle('on', t.dataset.dtab === key));
    dpanels.forEach(p => p.classList.toggle('show', p.dataset.dpanel === key));
  };
  dtabs.forEach(t => t.addEventListener('click', () => showDTab(t.dataset.dtab)));

  cv.addEventListener('pointerdown', down);
  cv.addEventListener('pointermove', move);
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', e => { if(!cv.hasPointerCapture ||
    !cv.hasPointerCapture(e.pointerId)) up(e); });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  // passive:false, or the browser scrolls the page instead of letting us zoom
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const [sx, sy] = local(e);
    zoomAt(e.deltaY < 0 ? 1.15 : 1/1.15, sx, sy);
    paint();
  }, { passive: false });
  const relayout = () => { sizeCanvas(); D._fitted = false; paint(); };
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', relayout);

  document.addEventListener('keyup', e => { if(e.code === 'Space') spaceHeld = false; });
  document.addEventListener('keydown', e => {
    if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if(e.code === 'Space'){ spaceHeld = true; e.preventDefault(); }
    if(e.key === '+' || e.key === '='){ zoomTo(D.zoom * 1.5); paint(); }
    if(e.key === '-' || e.key === '_'){ zoomTo(D.zoom / 1.5); paint(); }
    if(e.key === '0'){ fitView(); paint(); }
    if((e.ctrlKey||e.metaKey) && e.key === 'z'){ e.preventDefault(); e.shiftKey ? redo() : undo(); }
    const k = {b:'pencil', e:'eraser', g:'fill', l:'line', r:'rect', o:'ellipse', i:'picker', h:'pan'}[e.key];
    if(k){ D.tool = k; [...$('#dtools').children].forEach(b => b.classList.toggle('on', b.dataset.tool===k)); }
  });

  setColor(D.color);
  $('#daltsw').style.background = hex(D.alt);
  rebuildRamp();
  sizeCanvas();
  fitView();
  paint();
}

window.spritedraw = { D, boot, paint, sizeCanvas, pixelScale, autoGrid, buildRamp, paletteFrom, grabFromCanvas, hsv2rgb, rgb2hsv, TEMPLATES,
                      groupFrames, parseFrame, loadSourceSet, loadFrameForEdit,
                      fitView, zoomAt, zoomTo,
                      blank, exportPNG,
                      // handed to the derive side so ops can be previewed on a drawing
                      current: () => ({ w: D.w, h: D.h, d: new Uint8ClampedArray(D.px) }) };

document.addEventListener('DOMContentLoaded', () => { if($('#dcanvas')) boot(); });
})();
