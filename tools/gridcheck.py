#!/usr/bin/env python
"""Run the lab's own autoGrid over one sprite of EVERY distinct size in the project, and check the
grid it picks is actually usable.

WHY EVERY SIZE. This project has 316 distinct sprite dimensions across 7,912 files -- 92x92 heroes,
68x68 critters, 113x113 and 136x136 and 170x170 mounts, 56x72 pillars, 62x63 swords, 40x48 rings.
"The grid matches the sprite" is therefore 316 separate claims, and testing it on a golem proves one
of them. A cell that divides 64x72 beautifully leaves a ragged part-cell against 62x63.

THE INVARIANTS, checked per sprite:
  * cell divides BOTH dimensions -- this is the whole point. If it does not, the last row and column
    of cells are partial and the lines stop meaning anything exactly at the edges, which is where
    placement matters most.
  * cell is a whole multiple of the detected pixel size, so a 2x sprite never gets a cell that cuts
    its blocks in half.
  * cell >= 1 and scale >= 1.
And on synthetic 2x/3x upscales of real art, that the detected scale is exactly 2 and 3 -- the
detector has to find chunky art, not just cope with it.

It drives the SHIPPING code (window.spritedraw.autoGrid) rather than a copy, for the same reason
labparity does: a copy is a thing that drifts.

    py tools/serve.py          # in another shell
    py tools/gridcheck.py
"""

import collections
import io
import json
import os
import re
import subprocess
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from selftest import find_chrome, fresh_profile

PORT = 10500
PAGE = os.path.join(ROOT, "_gridcheck.html")
ASSETS = os.path.join(ROOT, "assets")


def representatives():
    """One sprite per distinct (w,h), so every shape in the project is covered exactly once."""
    rep = {}
    for cur, subs, names in os.walk(ASSETS):
        subs[:] = [s for s in subs if s not in ("font", "orig")]
        for n in sorted(names):
            if not n.lower().endswith(".png"):
                continue
            p = os.path.join(cur, n)
            try:
                sz = Image.open(p).size
            except Exception:
                continue
            rep.setdefault(sz, os.path.relpath(p, ROOT).replace("\\", "/"))
    return [rep[k] for k in sorted(rep)]


HTML = """<!doctype html><meta charset="utf-8"><body style="margin:0;background:#111">
<iframe id="f" src="/_spritelab.html?mode=draw" style="width:900px;height:500px;border:0"></iframe>
<pre id="out">running</pre>
<script>
const PATHS = %s;
// Load through a plain Image + canvas rather than spritelab.loadImage: that one caches every sprite
// it has ever seen, and 316 full-size frames held at once is what stalled the first run. Each load
// also gets its own timeout, so one bad file cannot take the whole sweep down with it.
function px(src){
  return new Promise(res => {
    const img = new Image();
    const done = ok => res(ok);
    const t = setTimeout(() => done(null), 4000);
    img.onload = () => {
      clearTimeout(t);
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d', {willReadFrequently:true});
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height);
      done({w: c.width, h: c.height, d: d.data});
    };
    img.onerror = () => { clearTimeout(t); done(null); };
    img.src = '/' + src;
  });
}
(async () => {
  const w = document.getElementById('f').contentWindow;
  for(let i = 0; i < 100 && !(w.spritedraw && w.spritedraw.autoGrid); i++)
    await new Promise(r => setTimeout(r, 100));
  const S = w.spritedraw;
  const rows = [];
  if(!S){ document.getElementById('out').textContent = JSON.stringify([{p:'-',err:'spritedraw missing'}]); return; }
  for(const p of PATHS){
    const im = await px(p);
    if(!im){ rows.push({p, err: 'could not load'}); continue; }
    try { const g = S.autoGrid(im); rows.push({p, w: im.w, h: im.h, scale: g.scale, cx: g.cellX, cy: g.cellY}); }
    catch(e){ rows.push({p, err: String(e.message || e)}); }
  }
  const base = await px('assets/mobs/anim/arch_golem/idle_0.png');
  if(base){
    const up = (src, n) => {
      const o = {w: src.w*n, h: src.h*n, d: new Uint8ClampedArray(src.w*n*src.h*n*4)};
      for(let y=0;y<o.h;y++) for(let x=0;x<o.w;x++){
        const si = (((y/n)|0)*src.w + ((x/n)|0))*4, di = (y*o.w+x)*4;
        for(let k=0;k<4;k++) o.d[di+k] = src.d[si+k];
      }
      return o;
    };
    for(const n of [2, 3, 4]){
      const g = S.autoGrid(up(base, n));
      rows.push({p: 'synthetic ' + n + 'x', w: base.w*n, h: base.h*n, scale: g.scale, cx: g.cellX, cy: g.cellY, want: n});
    }
  }
  document.getElementById('out').textContent = JSON.stringify(rows);
})();
</script></body>
"""


def main():
    paths = representatives()
    with io.open(PAGE, "w", encoding="utf-8") as f:
        f.write(HTML % json.dumps(paths))
    chrome = find_chrome()
    cmd = [chrome, "--headless=new", "--disable-gpu",
           "--user-data-dir=" + fresh_profile("gridcheck"),
           "--window-size=1000,600", "--virtual-time-budget=240000", "--dump-dom"]
    if hasattr(os, "geteuid") and os.geteuid() == 0:
        cmd.append("--no-sandbox")
    cmd.append("http://127.0.0.1:%d/%s" % (PORT, os.path.basename(PAGE)))
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    m = re.search(r'(?s)<pre id="out"[^>]*>(.*?)</pre>',
                  proc.stdout.decode("utf-8", "replace"))
    if not m:
        sys.exit("no #out -- is tools/serve.py running on %d?" % PORT)
    body = m.group(1).strip()
    if not body.startswith("["):
        sys.exit("the check did not finish: %s" % body[:300])
    rows = json.loads(body.replace("&quot;", '"').replace("&amp;", "&")
                          .replace("&lt;", "<").replace("&gt;", ">"))

    bad, cells, scales, ones = 0, collections.Counter(), collections.Counter(), []
    for r in rows:
        if r.get("err"):
            print("  FAIL  %-44s %s" % (r["p"], r["err"]))
            bad += 1
            continue
        w, h, cx, cy, scale = r["w"], r["h"], r["cx"], r["cy"], r["scale"]
        cell = "%dx%d" % (cx, cy) if cx != cy else str(cx)
        why = []
        if cx < 1 or cy < 1 or scale < 1:
            why.append("cell/scale below 1")
        if w % cx:
            why.append("cell width %d does not divide %d -- a partial column at the edge" % (cx, w))
        if h % cy:
            why.append("cell height %d does not divide %d -- a partial row at the edge" % (cy, h))
        if cx % scale or cy % scale:
            why.append("cell %s is not a multiple of the %dx pixel size" % (cell, scale))
        if r.get("want") and scale != r["want"]:
            why.append("chunky art: detected %dx, expected %dx" % (scale, r["want"]))
        if why:
            bad += 1
            print("  FAIL  %-44s %dx%d cell %s scale %d : %s"
                  % (r["p"], w, h, cell, scale, "; ".join(why)))
        else:
            cells[cell] += 1
            scales[scale] += 1
            if cx == 1 and cy == 1:
                ones.append("%dx%d" % (w, h))

    print()
    print("cells chosen:  " + "  ".join("%s->%d" % (c, n) for c, n in
          sorted(cells.items(), key=lambda kv: -kv[1])[:14]))
    print("scales found:  " + "  ".join("%dx->%d" % (s, n) for s, n in sorted(scales.items())))
    if ones:
        print("no coarse guide on EITHER axis (both dimensions prime): %d sizes, e.g. %s"
              % (len(ones), ", ".join(ones[:8])))
    print()
    print("RESULT %s  %d of %d sprite sizes get a usable grid"
          % ("FAIL" if bad else "PASS", len(rows) - bad, len(rows)))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
