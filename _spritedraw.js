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
  ramp: [],
  palette: [],
  recent: [],
  undo: [], redo: [],
};

const idx = (x, y) => (y * D.w + x) * 4;
const inside = (x, y) => x >= 0 && y >= 0 && x < D.w && y < D.h;

function blank(w, h){
  D.w = w; D.h = h;
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
    const b = D.block;
    g.strokeStyle = 'rgba(255,176,46,0.34)';
    g.beginPath();
    for(let x = b; x < D.w; x += b){ g.moveTo(x*z+0.5, 0); g.lineTo(x*z+0.5, H); }
    for(let y = b; y < D.h; y += b){ g.moveTo(0, y*z+0.5); g.lineTo(W, y*z+0.5); }
    g.stroke();
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
function paint(){
  const z = D.zoom, W = D.w * z, H = D.h * z;
  cv.width = W; cv.height = H;
  ctx.imageSmoothingEnabled = false;

  // checkerboard, so transparent reads as transparent and not as black
  const c = 8;
  ctx.fillStyle = '#1a1620'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle = '#221d2a';
  for(let y = 0; y < H; y += c) for(let x = 0; x < W; x += c)
    if(((x/c|0) + (y/c|0)) & 1) ctx.fillRect(x, y, c, c);

  if(D.onion){
    ctx.globalAlpha = 0.28;
    tmp.width = D.onion.w; tmp.height = D.onion.h;
    tmp.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(D.onion.d), D.onion.w, D.onion.h), 0, 0);
    ctx.drawImage(tmp, 0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  tmp.width = D.w; tmp.height = D.h;
  tmp.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(D.px), D.w, D.h), 0, 0);
  ctx.drawImage(tmp, 0, 0, W, H);

  drawGrid(ctx, W, H, z);
  const st = $('#dstats');
  if(st) st.textContent = `${D.w}x${D.h}  zoom ${z}x  ${GRIDS[D.grid]}`;
}

// ---------------------------------------------------------------------------------------------------
//  INPUT. Pointer events only -- one code path for mouse, pen and finger.
// ---------------------------------------------------------------------------------------------------

let drawing = false, last = null, shapeFrom = null, before = null;

function atEvent(e){
  const r = cv.getBoundingClientRect();
  return [Math.floor((e.clientX - r.left) / (r.width / D.w)),
          Math.floor((e.clientY - r.top)  / (r.height / D.h))];
}

function pickAt(x, y){
  if(!inside(x,y)) return;
  const i = idx(x,y);
  if(D.px[i+3] < 8) return;
  setColor([D.px[i], D.px[i+1], D.px[i+2]]);
}

function down(e){
  cv.setPointerCapture(e.pointerId);
  const [x, y] = atEvent(e);
  const erase = D.tool === 'eraser' || e.button === 2;
  if(D.tool === 'picker'){ pickAt(x, y); return; }
  snapshot();
  if(D.tool === 'fill'){ fill(x, y, D.color); paint(); return; }
  if(D.tool === 'line' || D.tool === 'rect' || D.tool === 'ellipse'){
    shapeFrom = [x, y];
    before = new Uint8ClampedArray(D.px);
    drawing = true;
    return;
  }
  drawing = true; last = [x, y];
  stamp(x, y, erase);
  paint();
}

function move(e){
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

function up(){
  drawing = false; last = null; shapeFrom = null; before = null;
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

function renderSwatches(){
  const put = (id, list) => {
    const n = $(id); if(!n) return;
    n.innerHTML = '';
    list.forEach(c => n.appendChild(swatchEl(c, rgb => setColor(rgb.slice()))));
  };
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
  const tools = ['pencil','eraser','fill','line','rect','ellipse','picker'];
  const tw = $('#dtools');
  tools.forEach(t => tw.appendChild(el('button', {class:'tool' + (t===D.tool?' on':''), 'data-tool':t,
    onclick:(e) => { D.tool = t; [...tw.children].forEach(b => b.classList.toggle('on', b.dataset.tool===t)); }
  }, [t])));

  // grids
  const gw = $('#dgrids');
  Object.keys(GRIDS).forEach(g => gw.appendChild(el('button', {class:'tool' + (g===D.grid?' on':''), 'data-grid':g,
    onclick:() => { D.grid = g; [...gw.children].forEach(b => b.classList.toggle('on', b.dataset.grid===g)); paint(); }
  }, [GRIDS[g]])));

  // canvas size
  const sizes = [[16,16],[24,24],[32,32],[48,48],[64,64],[64,72],[92,92],[44,44]];
  const sw = $('#dsizes');
  sizes.forEach(([w,h]) => sw.appendChild(el('button', {class:'tool',
    onclick:() => { if(confirm(`New ${w}x${h} canvas? This clears the drawing.`)){ blank(w,h); paint(); } }
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
  $('#dzoom').addEventListener('input', e => { D.zoom = +e.target.value; paint(); });
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

  cv.addEventListener('pointerdown', down);
  cv.addEventListener('pointermove', move);
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('contextmenu', e => e.preventDefault());

  document.addEventListener('keydown', e => {
    if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if((e.ctrlKey||e.metaKey) && e.key === 'z'){ e.preventDefault(); e.shiftKey ? redo() : undo(); }
    const k = {b:'pencil', e:'eraser', g:'fill', l:'line', r:'rect', o:'ellipse', i:'picker'}[e.key];
    if(k){ D.tool = k; [...$('#dtools').children].forEach(b => b.classList.toggle('on', b.dataset.tool===k)); }
  });

  setColor(D.color);
  $('#daltsw').style.background = hex(D.alt);
  rebuildRamp();
  paint();
}

window.spritedraw = { D, boot, paint, buildRamp, paletteFrom, hsv2rgb, rgb2hsv,
                      blank, exportPNG,
                      // handed to the derive side so ops can be previewed on a drawing
                      current: () => ({ w: D.w, h: D.h, d: new Uint8ClampedArray(D.px) }) };

document.addEventListener('DOMContentLoaded', () => { if($('#dcanvas')) boot(); });
})();
