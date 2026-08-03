#!/usr/bin/env python
"""Measure what EmberRealm's art actually IS, so a candidate sprite can be scored instead of admired.

WHY. I cannot judge 64px pixel art by looking at it -- two attempts proved that, and the more
principled of them (real normal-field lighting) came out worse than the naive one. What I can do is
measure, and this project owns 7,912 sprites drawn in one coherent style. That corpus is a training
set in the only sense available here: not weights, but a DISTRIBUTION. Anything I generate can be
scored against it, and "this sprite is unlike every sprite in the game" is a judgement I can make
reliably where "this sprite is ugly" is not.

THE FEATURES, chosen because each one is a thing pixel art gets right and my rules got wrong:
  colours       how many distinct colours in the opaque area. Hand pixel art is frugal; a shading
                formula sprays hundreds.
  rampiness     of the colours present, the fraction lying on a HUE-SHIFTED ramp -- darker steps
                rotated one way, lighter the other. This is the single technique that separates lit
                art from tinted art, and it is measurable: sort by luminance and ask whether hue
                moves monotonically with it.
  outline       fraction of edge pixels darker than the sprite's own median. Pixel art almost always
                has a deliberate outline; a filled polygon does not.
  fill          opaque pixels over the bounding box. Catches a shape that wastes its canvas.
  aspect        bounding box proportions -- my sword sat upright in a square frame while the real one
                used the diagonal.
  lum_spread    p95 - p05 of luminance. Flat shading has a narrow spread.
  dither        fraction of opaque pixels whose 4-neighbours alternate between exactly two colours.

MEASURED PER CATEGORY, AND THAT IS NOT A REFINEMENT -- IT IS THE DIFFERENCE BETWEEN THE THING
WORKING AND ACTIVELY MISLEADING. Scored against the whole corpus, two deliberately bad swords I drew
by hand came out MORE on-model (0.96) than the real PixelLab ones (1.96): a sword lies on a diagonal
in a square frame, so its fill is 0.11 against a corpus median of 0.51, and the corpus is mostly
92x92 characters. The metric was measuring "typical of everything" and calling an atypical-but-
correct sprite wrong. Conditioned on weapons, the same numbers flip the right way round: real
weapons 0.60-0.90, my scratch swords 1.74 and 1.66, and it names the reasons -- 11 colours against a
mean of 49, an outline on every edge against 0.23, contrast 200 against 126.

So: compare like with like, always. A profile is per category, and a sprite is only ever scored
against its own kind.

    py tools/stylestats.py                       # measure per category, write the profile
    py tools/stylestats.py score <file.png>...   # score against the matching category
    py tools/stylestats.py score --as "Items . weapons" <file.png>...   # force a category
"""

import io
import json
import os
import random
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spritelab import categorise          # the same taxonomy the lab and gallery use
ASSETS = os.path.join(ROOT, "assets")
PROFILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "style_profile.json")
SAMPLE = 1200          # enough for stable percentiles, small enough to run in seconds


def rgb2hsl_arr(rgb):
    mx = rgb.max(axis=-1); mn = rgb.min(axis=-1); d = mx - mn
    l = (mx + mn) / 2.0
    s = np.zeros_like(l); nz = d > 1e-9
    s[nz] = np.where(l[nz] > 0.5, d[nz] / np.maximum(2 - mx[nz] - mn[nz], 1e-9),
                     d[nz] / np.maximum(mx[nz] + mn[nz], 1e-9))
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    dd = np.where(nz, d, 1.0)
    h = np.where(mx == r, ((g - b) / dd) % 6, np.where(mx == g, (b - r) / dd + 2, (r - g) / dd + 4)) * 60
    return np.where(nz, h, 0.0), s, l


def features(px):
    a = px[..., 3] > 40
    if a.sum() < 12:
        return None
    rgb = px[..., :3].astype(np.float64) / 255.0
    h, s, l = rgb2hsl_arr(rgb)
    lum = (px[..., 0] * 0.2126 + px[..., 1] * 0.7152 + px[..., 2] * 0.0722)

    cols = px[..., :3][a]
    keys = (cols[:, 0].astype(np.int32) << 16) | (cols[:, 1].astype(np.int32) << 8) | cols[:, 2]
    uniq, counts = np.unique(keys, return_counts=True)

    # RAMPINESS. Take the colours carrying real area, sort by luminance, and ask whether hue rotates
    # monotonically as they get darker. A hue-shifted ramp says yes; a value-only ramp says no; a
    # formula that picks steps by position says nothing at all.
    order = np.argsort(-counts)[:12]
    top = uniq[order]
    tr = np.stack([(top >> 16) & 255, (top >> 8) & 255, top & 255], axis=-1).astype(np.float64)
    th, ts, tl = rgb2hsl_arr(tr / 255.0)
    ramp = 0.0
    if len(top) >= 4:
        by_l = np.argsort(tl)
        hh = np.unwrap(np.deg2rad(th[by_l])) * 180 / np.pi
        steps = np.diff(hh)
        if len(steps):
            same = np.sign(steps)
            ramp = float(max((same > 0).mean(), (same < 0).mean())) * float(min(1.0, np.abs(steps).mean() / 8.0))

    # OUTLINE: edge pixels darker than the sprite's own median
    er = a & ~(np.roll(a, 1, 0) & np.roll(a, -1, 0) & np.roll(a, 1, 1) & np.roll(a, -1, 1))
    med = float(np.median(lum[a]))
    outline = float((lum[er] < med * 0.62).mean()) if er.sum() else 0.0

    ys, xs = np.nonzero(a)
    bw = xs.max() - xs.min() + 1
    bh = ys.max() - ys.min() + 1
    fill = float(a.sum()) / float(bw * bh)

    # DITHER: opaque pixels whose left/right neighbours are equal to each other but not to the pixel
    same_lr = np.zeros_like(a)
    same_lr[:, 1:-1] = (keys_full := ((px[..., 0].astype(np.int32) << 16) |
                                      (px[..., 1].astype(np.int32) << 8) | px[..., 2]))[:, :-2] == keys_full[:, 2:]
    diff_c = np.zeros_like(a)
    diff_c[:, 1:-1] = keys_full[:, 1:-1] != keys_full[:, :-2]
    dither = float((same_lr & diff_c & a).mean()) if a.sum() else 0.0

    return {
        "colours": int(len(uniq)),
        "rampiness": round(ramp, 4),
        "outline": round(outline, 4),
        "fill": round(fill, 4),
        "aspect": round(float(bw) / float(bh), 4),
        "lum_spread": round(float(np.percentile(lum[a], 95) - np.percentile(lum[a], 5)), 2),
        "dither": round(dither, 4),
    }


KEYS = ["colours", "rampiness", "outline", "fill", "lum_spread", "dither"]


def walk():
    out = []
    for cur, subs, names in os.walk(ASSETS):
        subs[:] = [s for s in subs if s not in ("font", "orig")]
        for n in names:
            if n.lower().endswith(".png"):
                out.append(os.path.join(cur, n))
    return out


def cat_of(path):
    rel = os.path.relpath(os.path.abspath(path), ROOT).replace("\\", "/")
    return categorise(os.path.dirname(rel), os.path.basename(rel))


def build():
    buckets = {}
    for f in walk():
        buckets.setdefault(cat_of(f), []).append(f)
    random.seed(7)                     # a fixed sample per category, so the profile is reproducible
    prof = {}
    for cat, files in sorted(buckets.items()):
        if len(files) > SAMPLE:
            files = random.sample(files, SAMPLE)
        rows = []
        for f in files:
            try:
                v = features(np.asarray(Image.open(f).convert("RGBA")))
            except Exception:
                continue
            if v:
                rows.append(v)
        # under a dozen examples the standard deviation is noise, and a noisy scorer is worse than
        # none: it would flag correct sprites with confidence
        if len(rows) < 12:
            continue
        prof[cat] = {"n": len(rows)}
        for k in KEYS:
            vals = np.array([r[k] for r in rows], dtype=np.float64)
            prof[cat][k] = {"mean": float(vals.mean()), "sd": float(vals.std() or 1e-6),
                            "p05": float(np.percentile(vals, 5)),
                            "p50": float(np.percentile(vals, 50)),
                            "p95": float(np.percentile(vals, 95))}
    with io.open(PROFILE, "w", encoding="utf-8") as f:
        json.dump(prof, f, indent=1)
    print("profiled %d categories -> %s" % (len(prof), os.path.basename(PROFILE)))
    print()
    print("%-24s %5s %8s %8s %8s %8s" % ("category", "n", "colours", "rampy", "outline", "fill"))
    for cat in sorted(prof, key=lambda c: -prof[c]["n"]):
        pc = prof[cat]
        print("%-24s %5d %8.1f %8.2f %8.2f %8.2f"
              % (cat[:24], pc["n"], pc["colours"]["mean"], pc["rampiness"]["mean"],
                 pc["outline"]["mean"], pc["fill"]["mean"]))
    return 0


def score(args):
    forced = None
    if args and args[0] == "--as":
        forced, args = args[1], args[2:]
    with io.open(PROFILE, encoding="utf-8") as f:
        prof = json.load(f)
    print("%-26s %-20s %s" % ("sprite", "compared with", "  ".join("%-10s" % k[:10] for k in KEYS)))
    for p2 in args:
        v = features(np.asarray(Image.open(p2).convert("RGBA")))
        if not v:
            print("%-26s (empty)" % os.path.basename(p2))
            continue
        cat = forced or cat_of(p2)
        if cat not in prof:
            print("%-26s no profile for %r -- pass --as to choose one" % (os.path.basename(p2), cat))
            continue
        pc = prof[cat]
        cells, zs = [], []
        for k in KEYS:
            z = (v[k] - pc[k]["mean"]) / pc[k]["sd"]
            zs.append(abs(z))
            flag = "" if abs(z) < 2 else ("!" if abs(z) < 4 else "!!")
            cells.append("%7.2f%-3s" % (v[k], flag))
        print("%-26s %-20s %s   off-model %.2f"
              % (os.path.basename(p2)[:26], cat[:20], "  ".join(cells), float(np.mean(zs))))
    print()
    print("Scored against its OWN CATEGORY. Whole-corpus scoring ranked two bad swords ABOVE the real")
    print("ones, because a sword is atypical of a corpus that is mostly 92x92 characters.")
    print("! is over 2 SD from that category, !! over 4. Lower off-model is nearer the game's art.")
    return 0


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "score":
        sys.exit(score(sys.argv[2:]))
    sys.exit(build())
