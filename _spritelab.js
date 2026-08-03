// ===================================================================================================
//  SPRITE LAB -- the live editor for tools/spritegen.py
// ---------------------------------------------------------------------------------------------------
//  WHY IT EXISTS. spritegen's dials are not guessable. `ramp.mix` at 0.45 barely reads and at 0.75
//  flattens the accent trim that carries a creature's identity, and the only way to know which you
//  have is to look at it -- which meant edit JSON, run the tool, open a contact sheet, repeat. This
//  collapses that loop to a slider, and prints the recipe you arrived at so it can go straight into
//  tools/sprite_recipes.json.
//
//  THE ONE RULE THIS FILE LIVES BY: WHAT YOU SEE IS WHAT THE TOOL WRITES. Every op below is a port
//  of the op of the same name in tools/spritegen.py, using the same maths in the same order, down to
//  the rounding (floor(x+0.5)) and the 0.14 saturation floor that protects outlines and greys.
//  That is also why spritegen stopped using PIL's GaussianBlur and MaxFilter and spells both kernels
//  out instead: "blur radius r" means three edge-clamped moving averages of window 2r+1, each way,
//  and this file does exactly that. A preview that does not match the file it is previewing is worse
//  than no preview, because you would tune against one image and ship another.
//
//  If you change an op here, change it in spritegen.py in the same commit, and re-run the parity
//  check the lab prints in the console on load.
//
//  Standalone on purpose -- unlike _lab.js this does not need the game, only its art, so it does not
//  get injected into index.html and cannot be broken by a change to the game's script list.
// ===================================================================================================

(() => {
'use strict';

const KEEP_SAT = 0.14;                     // spritegen.KEEP_SAT
// Python's `x % 360` leaves an in-range value untouched and returns non-negative for negatives.
// Reproduce BOTH properties without the extra arithmetic that would shift the last bit.
const wrap360 = x => { let v = x % 360; if(v < 0) v += 360; return v; };
const wrap6   = x => { let v = x % 6;   if(v < 0) v += 6;   return v; };
const $ = s => document.querySelector(s);

// ---------- pixel maths: ports of rgb2hsl / hsl2rgb / dom_hue / band_mask ----------

function rgb2hsl(r, g, b){                 // 0..255 -> [h 0..360, s 0..1, l 0..1]
  r/=255; g/=255; b/=255;
  const mx=Math.max(r,g,b), mn=Math.min(r,g,b), d=mx-mn, l=(mx+mn)/2;
  let s=0, h=0;
  if(d>1e-9){
    s = l>0.5 ? d/Math.max(2-mx-mn,1e-9) : d/Math.max(mx+mn,1e-9);
    // wrap6, not ((x%6)+6)%6 -- same last-bit round-trip as wrap360, and the last one of these left.
    // It cost exactly one green channel in the elite chain: 155.49999999999997 instead of 155.5.
    h = mx===r ? wrap6((g-b)/d) : mx===g ? (b-r)/d+2 : (r-g)/d+4;
    h *= 60;
  }
  return [h,s,l];
}
// -> [r,g,b] in 0..1, NOT 0..255. That is not a style choice: spritegen.hsl2rgb returns 0..1 and its
// callers multiply by 255 afterwards, and doing the multiply INSIDE here instead put the result a
// single ulp away -- 230.50000000000003 against 230.49999999999997 for the same pixel. Both are the
// same number to any purpose except the one that matters, floor(x + 0.5), which tips opposite ways
// and hands back 231 in the lab and 230 in the file. Multiply where Python multiplies.
function hsl2rgb(h, s, l){
  // wrap360/wrap1, NOT ((x%n)+n)%n. Python wraps with a single `%`, and for a value already in
  // range that is a no-op; the +n and second % is an extra add-and-modulo round-trip that moves the
  // last bit. That was worth exactly one grey pixel out of 4,608 -- and one pixel is a FAIL here.
  h = wrap360(h)/360;
  const q = l<0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
  const ch = t => { t = t % 1; if(t<0) t += 1;
    if(t<1/6) return p+(q-p)*6*t;
    if(t<0.5) return q;
    if(t<2/3) return p+(q-p)*(2/3-t)*6;
    return p; };
  return [ch(h+1/3), ch(h), ch(h-1/3)];
}
// Saturation-weighted circular mean. A plain average of hues is wrong on a colour wheel -- 350 and
// 10 average to 180, the opposite colour -- which is why this sums unit vectors.
function domHue(d, only){
  let vx=0, vy=0;
  for(let i=0;i<d.length;i+=4){
    if(d[i+3]<40) continue;
    const [h,s] = rgb2hsl(d[i],d[i+1],d[i+2]);
    if(s<0.2 || !inBand(h,only)) continue;
    const a = h*Math.PI/180; vx += Math.cos(a)*s; vy += Math.sin(a)*s;
  }
  if(!vx && !vy) return 0;
  return wrap360(Math.atan2(vy,vx)*180/Math.PI);
}
function inBand(h, only){
  if(!only) return true;
  const lo=wrap360(only[0]), hi=wrap360(only[1]), hh=wrap360(h);
  return lo<=hi ? (hh>=lo && hh<=hi) : (hh>=lo || hh<=hi);
}
const px8 = v => Math.max(0, Math.min(255, Math.floor(v+0.5)));   // spritegen's clip(x+0.5)

// ---------- the two neighbourhood kernels, matching spritegen.box_blur3 / max_filter ----------

// A PREFIX SUM AND A DIFFERENCE, because that is what numpy does -- not the sliding running-sum a
// box blur is usually written as. The two are the same identity and NOT the same floating-point
// arithmetic: a running sum carries its rounding error along the row and subtracts a different
// accumulation than np.cumsum's, which showed up as one green channel off by one in the elite glow.
// Same identity, same operations, in the same order.
function box1(src, w, h, r, horiz){
  if(r<1) return src.slice();
  const out = new Float64Array(w*h), n = 2*r+1;
  const len = (horiz ? w : h), lines = (horiz ? h : w);
  const cs = new Float64Array(len + 2*r + 1);            // padded prefix sums, leading zero
  for(let li=0; li<lines; li++){
    const at = i => horiz ? src[li*w + i] : src[i*w + li];
    cs[0] = 0;
    for(let i=0;i<len+2*r;i++){
      const j = Math.max(0, Math.min(len-1, i-r));       // edge-clamped padding
      cs[i+1] = cs[i] + at(j);
    }
    for(let i=0;i<len;i++){
      const v = (cs[i+2*r+1] - cs[i]) / n;
      if(horiz) out[li*w + i] = v; else out[i*w + li] = v;
    }
  }
  return out;
}
function boxBlur3(a, w, h, r){
  r = r|0;
  let out = Float64Array.from(a);
  for(let i=0;i<3;i++){ out = box1(out,w,h,r,true); out = box1(out,w,h,r,false); }
  return out;
}
function maxFilter(a, w, h, r){
  r = r|0;
  if(r<1) return a.slice();
  const out = new Float64Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    let m=0;
    for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++){
      const yy=Math.max(0,Math.min(h-1,y+dy)), xx=Math.max(0,Math.min(w-1,x+dx));
      const v=a[yy*w+xx]; if(v>m) m=v;
    }
    out[y*w+x]=m;
  }
  return out;
}

// ---------- an image is {w,h,d} with d a Uint8ClampedArray of RGBA ----------

const clone = im => ({w:im.w, h:im.h, d:new Uint8ClampedArray(im.d)});
function parseCol(v){
  if(Array.isArray(v)) return [v[0],v[1],v[2]];
  const s=String(v).replace('#','');
  return [parseInt(s.slice(0,2),16), parseInt(s.slice(2,4),16), parseInt(s.slice(4,6),16)];
}

const OPS = {
  hue(im, ctx, p){
    if(p.by==null && p.to==null) return im;
    const o=clone(im), d=o.d, keep = p.keep_sat==null ? KEEP_SAT : +p.keep_sat;
    let delta;
    if(p.by!=null) delta = +p.by;
    else {
      const ref = p.only ? ctx.bandHue(p.only) : ctx.setHue;
      delta = +p.to - ref;
    }
    if(Math.abs(delta)<=0.5) return im;
    for(let i=0;i<d.length;i+=4){
      if(d[i+3]<8) continue;
      const [h,s,l]=rgb2hsl(d[i],d[i+1],d[i+2]);
      if(s<keep || !inBand(h,p.only)) continue;
      const c=hsl2rgb(h+delta,s,l);
      d[i]=px8(c[0]*255); d[i+1]=px8(c[1]*255); d[i+2]=px8(c[2]*255);
    }
    return o;
  },
  sat(im, ctx, p){
    const o=clone(im), d=o.d, mul=p.mul==null?1:+p.mul, add=p.add==null?0:+p.add;
    for(let i=0;i<d.length;i+=4){
      if(d[i+3]<8) continue;
      const [h,s,l]=rgb2hsl(d[i],d[i+1],d[i+2]);
      if(!inBand(h,p.only)) continue;
      const c=hsl2rgb(h, Math.max(0,Math.min(1,s*mul+add)), l);
      d[i]=px8(c[0]*255); d[i+1]=px8(c[1]*255); d[i+2]=px8(c[2]*255);
    }
    return o;
  },
  light(im, ctx, p){
    const o=clone(im), d=o.d, mul=p.mul==null?1:+p.mul, add=p.add==null?0:+p.add;
    for(let i=0;i<d.length;i+=4){
      if(d[i+3]<8) continue;
      const [h,s,l]=rgb2hsl(d[i],d[i+1],d[i+2]);
      if(!inBand(h,p.only)) continue;
      const c=hsl2rgb(h, s, Math.max(0,Math.min(1,l*mul+add)));
      d[i]=px8(c[0]*255); d[i+1]=px8(c[1]*255); d[i+2]=px8(c[2]*255);
    }
    return o;
  },
  // Pointwise: a pixel's new colour depends only on its own luminance, never its neighbours, so
  // this cannot disturb a seamless tile's wrap or soften an outline.
  ramp(im, ctx, p){
    const o=clone(im), d=o.d;
    const sh=parseCol(p.shadow||'#141414'), hi=parseCol(p.high||'#e6e6e6');
    const span=p.span==null?0.8:+p.span, mix=p.mix==null?1:+p.mix;
    const L=[]; for(let i=0;i<d.length;i+=4){ if(d[i+3]>=8) L.push(d[i]*0.2126+d[i+1]*0.7152+d[i+2]*0.0722); }
    if(!L.length) return o;
    const mean=L.reduce((a,b)=>a+b,0)/L.length;
    const sd=Math.sqrt(L.reduce((a,b)=>a+(b-mean)*(b-mean),0)/L.length);
    let lo=mean-2.5*sd, up=mean+2.5*sd;
    if(up-lo<1e-6) up=lo+1;
    for(let i=0;i<d.length;i+=4){
      if(d[i+3]<8) continue;
      const lum=d[i]*0.2126+d[i+1]*0.7152+d[i+2]*0.0722;
      let t=Math.max(0,Math.min(1,(lum-lo)/(up-lo)));
      t = 0.5+(t-0.5)*span;
      for(let k=0;k<3;k++){
        const r = sh[k]+(hi[k]-sh[k])*t;
        d[i+k]=px8(d[i+k]*(1-mix)+r*mix);
      }
    }
    return o;
  },
  tint(im, ctx, p){
    const o=clone(im), d=o.d, c=parseCol(p.color||'#ffffff'), k=p.amount==null?0.3:+p.amount;
    for(let i=0;i<d.length;i+=4){
      if(d[i+3]<8) continue;
      if(p.only){ const [h]=rgb2hsl(d[i],d[i+1],d[i+2]); if(!inBand(h,p.only)) continue; }
      for(let j=0;j<3;j++) d[i+j]=px8(d[i+j]*(1-k)+c[j]*k);
    }
    return o;
  },
  alpha(im, ctx, p){
    const o=clone(im), d=o.d, mul=p.mul==null?1:+p.mul;
    for(let i=0;i<d.length;i+=4) d[i+3]=px8(d[i+3]*mul);
    return o;
  },
  outline(im, ctx, p){
    const o=clone(im), d=o.d, w=o.w, h=o.h;
    const width = p.width==null ? (p.px_width==null?1:+p.px_width) : +p.width;
    const a=new Float64Array(w*h); for(let i=0,j=3;i<w*h;i++,j+=4) a[i]=d[j];
    const grown=maxFilter(a,w,h,width);
    const c=parseCol(p.color||'#ffd76a'), al=p.alpha==null?255:+p.alpha;
    let any=false;
    for(let i=0;i<w*h;i++){
      if(grown[i]-a[i] > 40){
        any=true; const j=i*4;
        d[j]=c[0]; d[j+1]=c[1]; d[j+2]=c[2]; d[j+3]=al;
      }
    }
    return any?o:im;
  },
  // Behind, not over: a halo painted on top dulls exactly the detail that says which creature it is.
  glow(im, ctx, p){
    const w=im.w, h=im.h, src=im.d;
    let c;
    if(p.hue!=null){ c=hsl2rgb(+p.hue,0.85,0.62).map(v=>Math.max(0,Math.min(255,v*255))); }
    else c=parseCol(p.color||'#ffffff');
    const radius=p.radius==null?4:+p.radius, strength=p.strength==null?0.6:+p.strength;
    const a=new Float64Array(w*h); for(let i=0,j=3;i<w*h;i++,j+=4) a[i]=src[j];
    const blurred=boxBlur3(a,w,h,radius);
    const o={w,h,d:new Uint8ClampedArray(w*h*4)};
    for(let i=0;i<w*h;i++){
      const halo=Math.max(0,Math.min(1, blurred[i]/255*strength));
      const sa=src[i*4+3]/255;
      const oa=sa+halo*(1-sa), safe=Math.max(oa,1e-6);
      for(let k=0;k<3;k++) o.d[i*4+k]=px8((src[i*4+k]*sa + c[k]*halo*(1-sa))/safe);
      o.d[i*4+3]=px8(oa*255);
    }
    return o;
  },
  // Every frame in a set must get the same pad or the animation jitters.
  pad(im, ctx, p){
    const n = (p.amount==null ? (p.px_amount==null?4:+p.px_amount) : +p.amount)|0;
    const w=im.w+2*n, h=im.h+2*n, o={w,h,d:new Uint8ClampedArray(w*h*4)};
    for(let y=0;y<im.h;y++)
      for(let x=0;x<im.w;x++)
        for(let k=0;k<4;k++) o.d[((y+n)*w+(x+n))*4+k]=im.d[(y*im.w+x)*4+k];
    return o;
  },
  // Nearest is not laziness: anything smoother puts intermediate colours between pixel-art clusters
  // and the result stops reading as pixel art.
  scale(im, ctx, p){
    const f=p.factor==null?1:+p.factor;
    const w=Math.max(1,Math.round(im.w*f)), h=Math.max(1,Math.round(im.h*f));
    const o={w,h,d:new Uint8ClampedArray(w*h*4)};
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){
      const sx=Math.min(im.w-1, Math.floor(x/f)), sy=Math.min(im.h-1, Math.floor(y/f));
      for(let k=0;k<4;k++) o.d[(y*w+x)*4+k]=im.d[(sy*im.w+sx)*4+k];
    }
    return o;
  },
  flip(im){
    const o=clone(im);
    for(let y=0;y<im.h;y++) for(let x=0;x<im.w;x++)
      for(let k=0;k<4;k++) o.d[(y*im.w+x)*4+k]=im.d[(y*im.w+(im.w-1-x))*4+k];
    return o;
  },
  // `layer` needs a second file off disk. The lab previews it only when that source is already
  // loaded; spritegen resolves it properly at build time (matching filename inside a directory).
  layer(im, ctx, p){
    const lay = ctx.layers && ctx.layers[p.src];
    if(!lay) return im;
    let L=lay;
    if(p.scale!=null && +p.scale!==1) L=OPS.scale(L,ctx,{factor:p.scale});
    if(p.opacity!=null && +p.opacity!==1) L=OPS.alpha(L,ctx,{mul:p.opacity});
    const W=im.w, H=im.h, o={w:W,h:H,d:new Uint8ClampedArray(W*H*4)};
    const ox=Math.round((W-L.w)/2+(+p.dx||0)), oy=Math.round((H-L.h)/2+(+p.dy||0));
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
      const lx=x-ox, ly=y-oy;
      const inL = lx>=0&&ly>=0&&lx<L.w&&ly<L.h;
      const topSrc = p.under ? im : (inL?L:null);
      const botSrc = p.under ? (inL?L:null) : im;
      const ti = p.under ? (y*W+x)*4 : (inL?(ly*L.w+lx)*4:0);
      const bi = p.under ? (inL?(ly*L.w+lx)*4:0) : (y*W+x)*4;
      const ta = topSrc ? topSrc.d[ti+3]/255 : 0;
      const ba = botSrc ? botSrc.d[bi+3]/255 : 0;
      const oa = ta+ba*(1-ta), safe=Math.max(oa,1e-6);
      for(let k=0;k<3;k++){
        const tv = topSrc?topSrc.d[ti+k]:0, bv = botSrc?botSrc.d[bi+k]:0;
        o.d[(y*W+x)*4+k]=px8((tv*ta + bv*ba*(1-ta))/safe);
      }
      o.d[(y*W+x)*4+3]=px8(oa*255);
    }
    return o;
  }
};

function applyOps(im, ops, ctx){
  let cur = im;
  for(const spec of ops){
    const fn = OPS[spec.op];
    if(!fn){ console.warn('unknown op', spec.op); continue; }
    cur = fn(cur, ctx, spec);
  }
  return cur;
}

// ---------------------------------------------------------------------------------------------------
//  UI
// ---------------------------------------------------------------------------------------------------

// Every field an op takes, so the editor can build controls without a hand-written form per op.
// [key, kind, default, min, max, step]
const SCHEMA = {
  hue:     [['to','num',200,0,360,1], ['by','num',null,-360,360,1], ['only','band',null]],
  sat:     [['mul','num',1,0,3,0.01], ['add','num',0,-1,1,0.01], ['only','band',null]],
  light:   [['mul','num',1,0,3,0.01], ['add','num',0,-1,1,0.01], ['only','band',null]],
  ramp:    [['shadow','col','#16223a'], ['high','col','#bfe6ff'],
            ['span','num',0.78,0,1,0.01], ['mix','num',0.58,0,1,0.01]],
  tint:    [['color','col','#ffffff'], ['amount','num',0.3,0,1,0.01], ['only','band',null]],
  alpha:   [['mul','num',0.62,0,1,0.01]],
  outline: [['color','col','#ffd76a'], ['width','num',1,1,4,1], ['alpha','num',255,0,255,1]],
  glow:    [['hue','num',24,0,360,1], ['color','col',null], ['radius','num',4,0,12,1],
            ['strength','num',0.4,0,1,0.01]],
  pad:     [['amount','num',6,0,32,1]],
  scale:   [['factor','num',1,0.25,4,0.05]],
  flip:    [],
  layer:   [['src','text',''], ['dx','num',0,-64,64,1], ['dy','num',0,-64,64,1],
            ['scale','num',1,0.25,4,0.05], ['opacity','num',1,0,1,0.01], ['under','bool',false]],
};

const state = {
  index: null,       // {dirs:[{path,frames:[..]}], files:[path]}
  source: null,      // path
  frames: [],        // filenames for a directory source
  frame: 0,
  imgs: {},          // path -> {w,h,d}
  ops: [],
  zoom: 3,
  playing: false,
  name: { to: '', v: '', rename: '' },
};

function el(tag, attrs, kids){
  const n=document.createElement(tag);
  for(const k in (attrs||{})){
    if(k==='class') n.className=attrs[k];
    else if(k.startsWith('on')) n.addEventListener(k.slice(2), attrs[k]);
    else if(attrs[k]!=null) n.setAttribute(k, attrs[k]);
  }
  for(const c of (kids||[])) n.appendChild(typeof c==='string'?document.createTextNode(c):c);
  return n;
}

async function loadImage(path){
  if(state.imgs[path]) return state.imgs[path];
  const img = new Image();
  img.src = path;
  await img.decode();
  const c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight;
  const g=c.getContext('2d'); g.imageSmoothingEnabled=false; g.drawImage(img,0,0);
  const dat=g.getImageData(0,0,c.width,c.height);
  const im={w:c.width,h:c.height,d:dat.data};
  state.imgs[path]=im;
  return im;
}

function drawTo(canvas, im, zoom){
  canvas.width = im.w*zoom; canvas.height = im.h*zoom;
  const g=canvas.getContext('2d');
  g.imageSmoothingEnabled=false;
  const tmp=document.createElement('canvas'); tmp.width=im.w; tmp.height=im.h;
  tmp.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(im.d), im.w, im.h),0,0);
  g.clearRect(0,0,canvas.width,canvas.height);
  g.drawImage(tmp,0,0,canvas.width,canvas.height);
}

function currentSrcPath(){
  if(!state.source) return null;
  const dir = state.index.dirs.find(d=>d.path===state.source);
  if(dir) return state.source + '/' + state.frames[state.frame % state.frames.length];
  return state.source;
}

// The set's reference hue is measured ONCE off the first frame, exactly as spritegen does -- an
// attack frame lit by its own muzzle flash reports a different dominant hue from the idle beside it,
// so measuring per frame makes the finished animation strobe.
let refCtx = null;
async function buildCtx(){
  const dir = state.index.dirs.find(d=>d.path===state.source);
  const first = dir ? state.source+'/'+state.frames[0] : state.source;
  const im = await loadImage(first);
  const cache = {};
  refCtx = {
    setHue: domHue(im.d, null),
    bandHue: only => { const k=String(only); if(!(k in cache)) cache[k]=domHue(im.d, only); return cache[k]; },
    layers: state.imgs,
  };
}

async function render(){
  const p = currentSrcPath();
  if(!p) return;
  const src = await loadImage(p);
  if(!refCtx) await buildCtx();
  const out = applyOps(src, state.ops, refCtx);
  drawTo($('#cvSrc'), src, state.zoom);
  drawTo($('#cvOut'), out, state.zoom);
  $('#dims').textContent = `${src.w}x${src.h} -> ${out.w}x${out.h}   set hue ${refCtx.setHue.toFixed(1)}deg`;
  $('#recipe').value = recipeText();
  $('#outnames').textContent = nameLines();
}

function recipeText(){
  const name = state.name.v || 'variant';
  const to = state.name.to || 'assets/mobs/anim/my_set';
  const r = { from: state.source || 'assets/...', to, ops: state.ops };
  if(state.name.rename) r.rename = state.name.rename;
  return JSON.stringify({ [ (state.source||'set').split('/').pop().replace(/\.png$/,'') + '_' + name ]: r }, null, 2);
}

function renameOne(fn){
  const pat = state.name.rename;
  if(!pat) return fn;
  const m = fn.match(/^(.*?)(?:_(\d+))?\.png$/);
  const stem = fn.replace(/\.png$/,'');
  const base = m ? m[1] : stem, n = (m && m[2]) ? m[2] : '';
  return pat.replace(/\{stem\}/g,stem).replace(/\{base\}/g,base).replace(/\{n\}/g,n)
            .replace(/\{v\}/g,state.name.v||'').replace(/\{set\}/g,'').replace(/\{ext\}/g,'.png');
}
function nameLines(){
  const dir = state.index.dirs.find(d=>d.path===state.source);
  if(!dir) return state.name.to || '(single file: `to` names it outright)';
  const seen={}, out=[];
  for(const f of state.frames.slice(0,6)){
    const o=renameOne(f);
    out.push(`${f}  ->  ${o}${seen[o]?'   ** COLLISION **':''}`);
    seen[o]=1;
  }
  if(state.frames.length>6) out.push(`... ${state.frames.length-6} more`);
  return out.join('\n');
}

function opRow(spec, i){
  const fields = SCHEMA[spec.op]||[];
  const body = el('div',{class:'fields'});
  for(const [key,kind,def,min,max,step] of fields){
    const wrap = el('label',{class:'f'},[key]);
    let input;
    if(kind==='num'){
      input = el('input',{type:'number', step:step||0.01, min:min, max:max,
                          value: spec[key]!=null?spec[key]:''});
      input.placeholder = def==null?'-':String(def);
      input.addEventListener('input', ()=>{
        if(input.value===''){ delete spec[key]; } else spec[key]=parseFloat(input.value);
        render();
      });
    } else if(kind==='col'){
      input = el('input',{type:'text', value: spec[key]!=null?spec[key]:''});
      input.placeholder = def||'#rrggbb';
      const sw = el('input',{type:'color', value: spec[key]||def||'#888888'});
      sw.addEventListener('input', ()=>{ spec[key]=sw.value; input.value=sw.value; render(); });
      input.addEventListener('input', ()=>{
        if(input.value==='') delete spec[key]; else spec[key]=input.value;
        if(/^#[0-9a-f]{6}$/i.test(input.value)) sw.value=input.value;
        render();
      });
      wrap.appendChild(sw);
    } else if(kind==='bool'){
      input = el('input',{type:'checkbox'});
      input.checked = !!spec[key];
      input.addEventListener('change', ()=>{ spec[key]=input.checked; render(); });
    } else if(kind==='band'){
      input = el('input',{type:'text', value: spec[key]?spec[key].join(','):''});
      input.placeholder='lo,hi';
      input.addEventListener('input', ()=>{
        const v=input.value.split(',').map(x=>parseFloat(x.trim()));
        if(v.length===2 && v.every(x=>!isNaN(x))) spec[key]=v; else delete spec[key];
        render();
      });
    } else {
      input = el('input',{type:'text', value: spec[key]!=null?spec[key]:''});
      input.addEventListener('input', ()=>{
        if(input.value==='') delete spec[key]; else spec[key]=input.value; render(); });
    }
    wrap.appendChild(input);
    body.appendChild(wrap);
  }
  const up = el('button',{class:'mini', onclick:()=>{ if(i>0){ const t=state.ops[i-1]; state.ops[i-1]=state.ops[i]; state.ops[i]=t; refresh(); } }},['↑']);
  const dn = el('button',{class:'mini', onclick:()=>{ if(i<state.ops.length-1){ const t=state.ops[i+1]; state.ops[i+1]=state.ops[i]; state.ops[i]=t; refresh(); } }},['↓']);
  const rm = el('button',{class:'mini danger', onclick:()=>{ state.ops.splice(i,1); refresh(); }},['✕']);
  return el('div',{class:'op'},[
    el('div',{class:'ophead'},[el('b',{},[spec.op]), el('span',{class:'spacer'}), up, dn, rm]),
    body
  ]);
}

function refresh(){
  const list = $('#ops'); list.innerHTML='';
  state.ops.forEach((s,i)=>list.appendChild(opRow(s,i)));
  render();
}

// Starting points, straight out of tools/sprite_recipes.json so the lab agrees with the shipped art.
const PRESETS = {
  frost:  [{op:'ramp',shadow:'#16223a',high:'#bfe6ff',span:0.78,mix:0.58},{op:'sat',mul:0.95}],
  venom:  [{op:'ramp',shadow:'#142a14',high:'#b6ee5e',span:0.76,mix:0.58},{op:'sat',mul:1.10}],
  shadow: [{op:'ramp',shadow:'#140f20',high:'#8f7ec2',span:0.72,mix:0.68},{op:'sat',mul:0.75},
           {op:'glow',hue:275,radius:5,strength:0.34}],
  ember:  [{op:'ramp',shadow:'#2c1008',high:'#ff8a2a',span:0.78,mix:0.58},{op:'sat',mul:1.15},
           {op:'glow',hue:24,radius:4,strength:0.28}],
  elite:  [{op:'pad',amount:6},{op:'sat',mul:1.12},{op:'outline',color:'#ffd76a',width:1,alpha:210},
           {op:'glow',color:'#ffb02e',radius:5,strength:0.5}],
  spectral:[{op:'sat',mul:0.5},{op:'light',mul:1.1},{op:'alpha',mul:0.62},
           {op:'glow',hue:190,radius:6,strength:0.4}],
};

async function pickSource(path){
  state.source = path;
  const dir = state.index.dirs.find(d=>d.path===path);
  state.frames = dir ? dir.frames : [];
  state.frame = 0;
  refCtx = null;
  $('#framewrap').style.display = dir ? '' : 'none';
  if(dir){ $('#frame').max = state.frames.length-1; $('#frame').value = 0; }
  if(!state.name.to) { $('#to').value = (path.replace(/\.png$/,'') + '_{v}' + (dir?'':'.png')); state.name.to=$('#to').value; }
  await buildCtx();
  // Probe: the histogram is what tells you a sprite has two colour families, which is why the
  // elements are ramps and not hue rotations. Shown here so the choice stays measured.
  const im = state.imgs[dir ? path+'/'+state.frames[0] : path];
  $('#probe').textContent = probeText(im);
  refresh();
}

function probeText(im){
  const bins = new Array(24).fill(0);
  let n=0;
  for(let i=0;i<im.d.length;i+=4){
    if(im.d[i+3]<40) continue;
    const [h,s]=rgb2hsl(im.d[i],im.d[i+1],im.d[i+2]);
    if(s<0.2) continue;
    bins[Math.min(23,Math.floor(h/15))]++; n++;
  }
  if(!n) return 'greyscale -- `hue` will do nothing here; use ramp or tint.';
  const peak=Math.max(...bins);
  const rows=[];
  bins.forEach((c,i)=>{ if(c) rows.push(`${String(i*15).padStart(3)}-${String(i*15+15).padStart(3)} ${'#'.repeat(Math.max(1,Math.round(24*c/peak)))}`); });
  return `${n} coloured px   dominant ${domHue(im.d,null).toFixed(1)}deg\n` + rows.join('\n');
}

let booting = true;
async function boot(){
  // Only build the UI on the lab's own page. tools/labparity.py loads this file into a bare page to
  // drive the ops directly, and boot() used to run there anyway and die on the first missing element
  // -- an unhandled rejection that made a passing parity run look like a broken one while it was
  // being read. The ops are exported at module scope and never needed any of this.
  if(!document.getElementById('sources')) return;
  let idx;
  try {
    idx = await (await fetch('_spritelab_index.json?'+Date.now())).json();
  } catch(e){
    $('#sources').appendChild(el('div',{class:'warn'},[
      'No _spritelab_index.json. Run:  python tools/spritelab.py']));
    return;
  }
  state.index = idx;

  const sel = $('#sources');
  const mk = (label, path) => {
    const b = el('button',{class:'src', onclick:()=>{
      [...sel.querySelectorAll('.src')].forEach(x=>x.classList.remove('on'));
      b.classList.add('on'); pickSource(path);
      if(!booting && onPhone()) showTab('ops');   // not on the boot-time click: that would
      // land you on `ops` before you had chosen anything
    }},[label]);
    return b;
  };
  // A dot marks art spritegen wrote rather than art someone drew. They are listed now -- the draw
  // side opens a frame to FIX it, and a derived frame needs fixing exactly as often as any other --
  // but you should never be unsure which kind you have picked.
  const derivedFiles = new Set(idx.derivedFiles || []);
  const g1 = el('div',{class:'grp'},[`animated sets (${idx.dirs.length})`]);
  sel.appendChild(g1);
  idx.dirs.forEach(d=>{
    const b = mk(d.path.replace('assets/','')+`  (${d.frames.length})`, d.path);
    if(d.derived) b.classList.add('derived');
    sel.appendChild(b);
  });
  const g2 = el('div',{class:'grp'},[`single sprites (${idx.files.length})`]);
  sel.appendChild(g2);
  idx.files.forEach(f=>{
    const b = mk(f.replace('assets/',''), f);
    if(derivedFiles.has(f)) b.classList.add('derived');
    sel.appendChild(b);
  });

  // There are thousands of single sprites -- a scrolling column of them is not a picker without this.
  $('#filter').addEventListener('input', e=>{
    const q = e.target.value.toLowerCase();
    [...sel.querySelectorAll('.src')].forEach(b=>{
      b.style.display = !q || b.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  const addSel = $('#addop');
  Object.keys(OPS).forEach(k=>addSel.appendChild(el('option',{value:k},[k])));
  $('#add').addEventListener('click', ()=>{
    const op = addSel.value, spec={op};
    (SCHEMA[op]||[]).forEach(([k,kind,def])=>{ if(def!=null && kind!=='band') spec[k]=def; });
    state.ops.push(spec); refresh();
  });
  Object.keys(PRESETS).forEach(k=>{
    $('#presets').appendChild(el('button',{class:'preset', onclick:()=>{
      state.ops = JSON.parse(JSON.stringify(PRESETS[k]));
      if(!state.name.v){ state.name.v=k; $('#v').value=k; }
      refresh();
    }},[k]));
  });
  $('#clear').addEventListener('click', ()=>{ state.ops=[]; refresh(); });
  $('#zoom').addEventListener('input', e=>{ state.zoom=+e.target.value; render(); });
  $('#frame').addEventListener('input', e=>{ state.frame=+e.target.value; render(); });
  $('#play').addEventListener('click', ()=>{
    state.playing=!state.playing;
    $('#play').textContent = state.playing?'stop':'play';
    if(state.playing) tick();
  });
  $('#to').addEventListener('input', e=>{ state.name.to=e.target.value; render(); });
  $('#v').addEventListener('input', e=>{ state.name.v=e.target.value; render(); });
  $('#rename').addEventListener('input', e=>{ state.name.rename=e.target.value; render(); });
  $('#copy').addEventListener('click', async ()=>{
    const ta = $('#recipe');
    let ok = false;
    try {
      // Must be the first await in the handler or Safari has already lost the user gesture.
      await navigator.clipboard.writeText(ta.value);
      ok = true;
    } catch(e){
      // iOS refuses the async clipboard in plenty of ordinary situations. Selecting the text is
      // not a consolation prize on a phone -- it is the normal way you copy there, and it always
      // works. setSelectionRange, because ta.select() alone does nothing on iOS.
      ta.focus(); ta.setSelectionRange(0, ta.value.length);
      try { ok = document.execCommand('copy'); } catch(e2){}
    }
    $('#copy').textContent = ok ? 'copied' : 'selected — hold to copy';
    setTimeout(()=>$('#copy').textContent='copy recipe', 1400);
  });

  // PHONE TABS. The buttons exist in the DOM always and the stylesheet hides the bar above 900px,
  // so there is one layout to reason about and no resize listener deciding which one you are in.
  // Picking a source jumps to `ops`, because on a phone that is unmistakably what you wanted next
  // and the alternative is hunting for a tab after every choice.
  const tabs = [...document.querySelectorAll('.tabs button')];
  const panels = [...document.querySelectorAll('.col.tabbed')];
  const showTab = key => {
    tabs.forEach(t => t.classList.toggle('on', t.dataset.tab === key));
    panels.forEach(p => p.classList.toggle('show', p.dataset.panel === key));
  };
  tabs.forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
  const onPhone = () => getComputedStyle(document.querySelector('.tabs')).display !== 'none';

  // ?src=<path>&preset=<name> -- so a look can be linked to rather than described, and so
  // tools/labparity.py and the screenshot pass can open a specific state without clicking.
  const q = new URLSearchParams(location.search);
  const want = q.get('src');
  const btns = [...sel.querySelectorAll('.src')];
  const hit = want && btns.find(b => b.textContent.trim().startsWith(want.replace('assets/','')));
  (hit || btns[0]).click();
  const pre = q.get('preset');
  if(pre && PRESETS[pre]){
    state.ops = JSON.parse(JSON.stringify(PRESETS[pre]));
    state.name.v = pre; $('#v').value = pre;
    refresh();
  }
  // DERIVE / DRAW. Both views stay mounted -- the draw canvas holds unsaved pixels and tearing it
  // down to switch modes would throw them away.
  const setMode = m => {
    const draw = m === 'draw';
    document.querySelector('.wrap').style.display = draw ? 'none' : '';
    $('#drawview').style.display = draw ? '' : 'none';
    $('#m-draw').classList.toggle('on', draw);
    $('#m-derive').classList.toggle('on', !draw);
    if(draw && window.spritedraw){
      // the draw view was display:none until this instant, so nothing in it had a size to
      // measure; size the canvas first, then paint
      window.spritedraw.sizeCanvas();
      window.spritedraw.D._fitted = false;
      window.spritedraw.paint();
    }
  };
  $('#m-derive').addEventListener('click', () => setMode('derive'));
  $('#m-draw').addEventListener('click', () => setMode('draw'));
  if(new URLSearchParams(location.search).get('mode') === 'draw') setMode('draw');

  booting = false;
  console.log('[spritelab] ops are ports of tools/spritegen.py -- if you edit one, edit both.');
}

let last=0;
function tick(ts){
  if(!state.playing) return;
  if(ts-last > 110 && state.frames.length){
    last=ts; state.frame=(state.frame+1)%state.frames.length;
    $('#frame').value=state.frame; render();
  }
  requestAnimationFrame(tick);
}

// Exposed so the parity check can drive the same code the UI does.
window.spritelab = { OPS, applyOps, domHue, rgb2hsl, hsl2rgb, boxBlur3, maxFilter, loadImage, state };

document.addEventListener('DOMContentLoaded', boot);
})();
