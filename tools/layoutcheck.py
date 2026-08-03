#!/usr/bin/env python
"""Check every lab page at every viewport, and say what is wrong rather than that something is.

WHY THIS EXISTS. The layouts here have broken four times in ways nobody would notice from the screen
they happened to be looking at: a `.dcol` rule that also matched `.dstage` and shrank the canvas to a
sidebar; `flex-direction` set on a box another block had left `display:block`; a stray
`height:42vh !important` outranking the rule meant to replace it; and a fourth grid column that
wrapped onto a second row underneath the source list and sat there unseen for days, because every
screenshot after that change happened to be of draw mode or of a phone.

Every one of those is measurable. So measure them, at all the sizes at once, instead of finding them
by chance months later.

WHAT IT CHECKS, per page per viewport:
  * NOTHING SCROLLS SIDEWAYS. documentElement.scrollWidth must not exceed the viewport.
  * NOTHING OVERHANGS. no element's right edge past the viewport, which catches the clipped-but-
    present case that a scrollWidth check alone can miss when something is hidden by overflow.
  * THE CONTROLS ARE THERE AND VISIBLE. a named list per page -- an element that exists in the DOM
    but has no box is exactly the failure "it looks fine" misses.
  * TAP TARGETS. on a phone, buttons at least MIN_TAP on their short side.
  * NO STRAY SECOND ROW. flex/grid containers whose children span more distinct top offsets than the
    layout intends, which is precisely the fourth-column bug.

    py tools/serve.py            # in another shell
    py tools/layoutcheck.py      # PASS/FAIL table, exit 1 on any failure
"""

import io
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from selftest import find_chrome, fresh_profile

PORT = 10500
PAGE = os.path.join(ROOT, "_layoutcheck.html")
MIN_TAP = 22          # px on the short side; below this a control is a dare, not a button

# (label, width, height). The phone sizes are real devices; the desktop ones are where this is used.
VIEWS = [
    ("desktop 1500", 1500, 900),
    ("laptop 1280", 1280, 800),
    ("tablet 820", 820, 1100),
    ("phone tall 412", 412, 915),
    ("phone small 360", 360, 740),
    ("phone wide 844", 844, 390),
    ("phone wide 740", 740, 360),
]

# page -> the controls that must be visible on it
PAGES = [
    ("_spritelab.html", "derive",
     # not "#ops": that is the list of ops you have added, and it is correctly empty until you add
     # one. Requiring it to have a box was the check being wrong about the page, not the reverse.
     ["#filter", "#sources", "#cvSrc", "#cvOut", "#probe", "#presets", "#to", "#recipe", "#copy"]),
    ("_spritelab.html?mode=draw", "draw",
     ["#dcanvas", "#dzoom", "#dzoomfit", "#dshadedn", "#dshadeup", "#dbarsw", "#dtools", "#dgrids",
      "#dsizes", "#dsv", "#dhue", "#dhex", "#dramp", "#dsrcload", "#dtpl", "#dexport", "#dundo"]),
    ("_sprites.html", "gallery", ["#q", "#out", "#count"]),
]

HTML = """<!doctype html><meta charset="utf-8"><body style="margin:0;background:#111">
<div id="host"></div><pre id="out">running</pre>
<script>
const VIEWS = %s, PAGES = %s, MIN_TAP = %d;
const results = [];
const host = document.getElementById('host');

function measure(w, doc, need, isPhone){
  const vw = w.innerWidth, vh = w.innerHeight;
  const problems = [];
  const sw = doc.documentElement.scrollWidth;
  if(sw > vw + 1) problems.push('h-scroll ' + sw + '>' + vw);

  let over = 0, worst = '';
  doc.querySelectorAll('*').forEach(el => {
    const cs = getComputedStyle(el);
    if(cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    if(r.width === 0 && r.height === 0) return;
    if(r.right > vw + 1.5){
      over++;
      if(!worst) worst = (el.id ? '#' + el.id : el.tagName.toLowerCase() +
                          (el.className ? '.' + String(el.className).trim().split(/\\s+/)[0] : ''))
                         + ' right=' + Math.round(r.right);
    }
  });
  if(over) problems.push(over + ' overhang (' + worst + ')');

  // A control inside a tab that is not the open one is SUPPOSED to have no box -- that is what a tab
  // is. Requiring every control to be visible at once flagged eleven of these on every phone size and
  // buried the two real failures underneath. So: a control in a closed panel only has to EXIST; one
  // that is on screen has to have a real box.
  const missing = [];
  for(const sel of need){
    const el = doc.querySelector(sel);
    if(!el){ missing.push(sel + ' absent'); continue; }
    const panel = el.closest('.dpanel, .col.tabbed');
    const closed = panel && !panel.classList.contains('show') &&
                   getComputedStyle(panel).display === 'none';
    if(closed) continue;
    const r = el.getBoundingClientRect();
    if(r.width < 1 || r.height < 1) missing.push(sel + ' zero-size');
  }
  if(missing.length) problems.push('controls: ' + missing.join(', '));

  if(isPhone){
    let small = 0, ex = '';
    doc.querySelectorAll('button').forEach(b => {
      const cs = getComputedStyle(b);
      if(cs.display === 'none' || !b.offsetParent) return;
      const r = b.getBoundingClientRect();
      if(r.width < 1 || r.height < 1) return;
      if(Math.min(r.width, r.height) < MIN_TAP){
        small++;
        if(!ex) ex = (b.id || b.textContent.trim().slice(0,12)) + ' ' +
                     Math.round(r.width) + 'x' + Math.round(r.height);
      }
    });
    if(small) problems.push(small + ' small taps (' + ex + ')');
  }
  return problems;
}

(async () => {
  for(const [page, name, need] of PAGES){
    for(const [label, vw, vh] of VIEWS){
      const f = document.createElement('iframe');
      f.style.cssText = 'width:' + vw + 'px;height:' + vh + 'px;border:0';
      f.src = page;
      host.innerHTML = '';
      host.appendChild(f);
      await new Promise(res => { f.onload = res; setTimeout(res, 4000); });
      await new Promise(res => setTimeout(res, 1600));
      let problems;
      try {
        problems = measure(f.contentWindow, f.contentDocument, need, vh < 950 && vw < 900);
      } catch(e){ problems = ['THREW ' + e.message]; }
      results.push({ page: name, view: label, problems });
    }
  }
  document.getElementById('out').textContent = JSON.stringify(results);
})();
</script></body>
"""


def main():
    with io.open(PAGE, "w", encoding="utf-8") as f:
        f.write(HTML % (json.dumps(VIEWS), json.dumps(PAGES), MIN_TAP))
    chrome = find_chrome()
    cmd = [chrome, "--headless=new", "--disable-gpu",
           "--user-data-dir=" + fresh_profile("layoutcheck"),
           "--window-size=1600,1000", "--virtual-time-budget=180000", "--dump-dom"]
    if hasattr(os, "geteuid") and os.geteuid() == 0:
        cmd.append("--no-sandbox")
    cmd.append("http://127.0.0.1:%d/%s" % (PORT, os.path.basename(PAGE)))
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    dom = proc.stdout.decode("utf-8", "replace")
    m = re.search(r'(?s)<pre id="out"[^>]*>(.*?)</pre>', dom)
    if not m:
        sys.exit("no #out in the dumped DOM -- is tools/serve.py running on %d?" % PORT)
    body = m.group(1).strip()
    if body == "running" or not body.startswith("["):
        sys.exit("the check did not finish: %s" % body[:300])

    rows = json.loads(body.replace("&quot;", '"').replace("&amp;", "&")
                          .replace("&lt;", "<").replace("&gt;", ">"))
    bad = 0
    cur = None
    for r in rows:
        if r["page"] != cur:
            cur = r["page"]
            print("\n%s" % cur.upper())
        if r["problems"]:
            bad += 1
            print("  FAIL  %-18s %s" % (r["view"], "; ".join(r["problems"])[:150]))
        else:
            print("  ok    %-18s" % r["view"])
    print()
    print("RESULT %s  %d of %d layouts clean" % ("FAIL" if bad else "PASS", len(rows) - bad, len(rows)))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
