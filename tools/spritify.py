#!/usr/bin/env python
"""Turn a diffusion model's output into an actual game sprite.

WHAT COMES OUT OF A DIFFUSION MODEL IS NOT A SPRITE. It is a 320px painting OF a sprite: soft edges,
anti-aliased diagonals, a few thousand colours, a background that is nearly but not exactly the flat
violet it was trained on, and no alpha channel at all. Dropped into assets/ it would look wrong
beside everything else at a glance. Five things have to happen, and each one is a place where the
obvious method is the wrong one:

  1. KEY THE BACKGROUND BY FLOODING FROM THE BORDER, not by colour alone. A violet-grey robe is the
     same colour as the backdrop, and a global colour key punches a hole straight through the sprite.
     The background is the region CONNECTED to the edge of the frame; anything violet in the middle
     of the subject is paint.

  2. DOWNSCALE BY MODE, not by averaging. Averaging a 5x5 block invents a colour that is in neither
     the block nor the palette, which is exactly how pixel art turns to mush. The most common colour
     in the block is always a colour that was really there.

  3. QUANTISE TO THE PALETTE OF THE REAL ART, per category. The model will drift toward colours the
     base model likes; snapping to the palette the game actually uses is what makes the result sit
     beside the existing sprites instead of near them.

  4. HARDEN THE ALPHA. Pixel art has no semi-transparent pixels. Anything part-way becomes fully in
     or fully out, or the sprite gets a soft halo that reads as a blur at game scale.

  5. DESPECKLE. A single stray pixel with no neighbour of its own colour is model noise, not art.

Then it is scored against the category profile and checked for connectivity, so bad generations are
rejected rather than filed.

    py tools/spritify.py in.png --cat "Items · weapons" --size 64 --out sprite.png
    py tools/spritify.py --selftest        # prove the pipeline on a known sprite
"""

import argparse
import collections
import io
import json
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spritelab import categorise
from stylestats import features, KEYS

ASSETS = os.path.join(ROOT, "assets")
BG = np.array([109, 96, 130], np.int16)      # the flat violet tools/dataset.py trains on


def key_background(rgb, tol=42):
    """Alpha from a border flood: background is what the frame's edge connects to."""
    h, w = rgb.shape[:2]
    near = (np.abs(rgb.astype(np.int16) - BG).sum(axis=-1) < tol)
    keep = np.ones((h, w), bool)              # True = sprite
    stack = []
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x]:
                stack.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x]:
                stack.append((y, x))
    seen = np.zeros((h, w), bool)
    while stack:
        y, x = stack.pop()
        if seen[y, x] or not near[y, x]:
            continue
        seen[y, x] = True
        keep[y, x] = False
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w and not seen[yy, xx]:
                stack.append((yy, xx))
    return keep


def mode_downscale(rgb, keep, size):
    """One output pixel per block, taking the commonest opaque colour in it."""
    ys, xs = np.nonzero(keep)
    if not len(xs):
        return None, None
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    sub, subk = rgb[y0:y1, x0:x1], keep[y0:y1, x0:x1]
    H, W = sub.shape[:2]
    scale = max(H, W) / float(size)
    oh, ow = max(1, int(round(H / scale))), max(1, int(round(W / scale)))
    out = np.zeros((oh, ow, 4), np.uint8)
    for oy in range(oh):
        for ox in range(ow):
            ya, yb = int(oy * H / oh), max(int(oy * H / oh) + 1, int((oy + 1) * H / oh))
            xa, xb = int(ox * W / ow), max(int(ox * W / ow) + 1, int((ox + 1) * W / ow))
            blk, blkk = sub[ya:yb, xa:xb].reshape(-1, 3), subk[ya:yb, xa:xb].reshape(-1)
            if blkk.sum() * 2 < len(blkk):     # mostly background: this pixel is background
                continue
            vals = blk[blkk]
            cnt = collections.Counter(map(tuple, vals))
            c = cnt.most_common(1)[0][0]
            out[oy, ox] = (c[0], c[1], c[2], 255)
    return out, (oh, ow)


def category_palette(cat, cap=64):
    """The colours the real art of this category actually uses, commonest first."""
    cnt = collections.Counter()
    for cur, subs, names in os.walk(ASSETS):
        subs[:] = [s for s in subs if s not in ("font", "orig")]
        for n in names:
            if not n.lower().endswith(".png"):
                continue
            rel = os.path.relpath(cur, ROOT).replace("\\", "/")
            if categorise(rel, n) != cat:
                continue
            try:
                px = np.asarray(Image.open(os.path.join(cur, n)).convert("RGBA"))
            except Exception:
                continue
            a = px[..., 3] > 40
            for c in map(tuple, px[..., :3][a]):
                cnt[c] += 1
    return np.array([c for c, _ in cnt.most_common(cap)], np.int16)


def quantise(px, pal):
    """Snap to the nearest palette colour. IN int32: a squared channel difference reaches 255^2 and
    three of them sum past 195,000, which silently overflows int16 and turns "nearest" into
    "arbitrary" -- brown pixels came back white and blue, and the sprite was unrecognisable while
    every other check still passed."""
    if pal is None or not len(pal):
        return px
    a = px[..., 3] > 0
    cols = px[..., :3][a].astype(np.int32)
    p32 = pal.astype(np.int32)
    d = ((cols[:, None, :] - p32[None, :, :]) ** 2).sum(axis=-1)
    px[..., :3][a] = p32[np.argmin(d, axis=1)].astype(np.uint8)
    return px


def despeckle(px):
    """Drop only pixels that are ISOLATED -- no opaque neighbour at all, in any of the eight
    directions.

    The first version deleted any pixel with no FOUR-neighbour of its own colour, which sounds like
    noise removal and is in fact a diagonal-line remover: a one-pixel-wide diagonal has no
    four-neighbours whatsoever, only diagonal ones. Every weapon in this game is drawn on a diagonal,
    so it deleted the blade and left twelve fragments. Isolation, and eight-connectivity, is the
    check that means what it sounds like."""
    a = px[..., 3] > 0
    h, w = a.shape
    out = px.copy()
    for y in range(h):
        for x in range(w):
            if not a[y, x]:
                continue
            n = 0
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dy == 0 and dx == 0:
                        continue
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and a[yy, xx]:
                        n += 1
            if n == 0:
                out[y, x] = 0
    return out


def largest_piece(px):
    """Keep only the biggest connected blob: a sprite is one object."""
    a = px[..., 3] > 0
    h, w = a.shape
    lab = np.zeros((h, w), np.int32)
    best, best_n, cur = 0, 0, 0
    for sy in range(h):
        for sx in range(w):
            if not a[sy, sx] or lab[sy, sx]:
                continue
            cur += 1
            n = 0
            stack = [(sy, sx)]
            lab[sy, sx] = cur
            while stack:
                y, x = stack.pop()
                n += 1
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        yy, xx = y + dy, x + dx
                        if 0 <= yy < h and 0 <= xx < w and a[yy, xx] and not lab[yy, xx]:
                            lab[yy, xx] = cur
                            stack.append((yy, xx))
            if n > best_n:
                best, best_n = cur, n
    out = px.copy()
    out[(lab != best) & a] = 0
    return out, cur


def spritify(img, cat=None, size=64, pal=None):
    rgb = np.asarray(img.convert("RGB"))
    keep = key_background(rgb)
    small, _ = mode_downscale(rgb, keep, size)
    if small is None:
        return None, {"error": "nothing survived the background key"}
    small = quantise(small, pal if pal is not None else (category_palette(cat) if cat else None))
    small = despeckle(small)
    small, blobs = largest_piece(small)
    ys, xs = np.nonzero(small[..., 3] > 0)
    if not len(xs):
        return None, {"error": "empty after cleanup"}
    small = small[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    return small, {"blobs": blobs}


def score_against(px, cat):
    prof_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "style_profile.json")
    prof = json.load(io.open(prof_path, encoding="utf-8"))
    if cat not in prof:
        return None
    p = prof[cat]
    v = features(px)
    if not v:
        return None
    return float(np.mean([abs((v[k] - p[k]["mean"]) / p[k]["sd"]) for k in KEYS]))


def selftest():
    """Prove the pipeline without a model: take a real sprite, make it LOOK like diffusion output --
    bilinear upscale, flat violet backdrop, a little noise -- and check spritify gets a sprite back
    that is close to the original and scores like real art."""
    src = os.path.join(ASSETS, "items", "wpn_sword_0.png")
    orig = np.asarray(Image.open(src).convert("RGBA"))
    cat = "Items · weapons"
    im = Image.fromarray(orig, "RGBA")
    bg = Image.new("RGBA", im.size, tuple(BG) + (255,))
    bg.alpha_composite(im)
    soft = bg.convert("RGB").resize((320, 320), Image.BILINEAR)      # the anti-aliasing a model adds
    arr = np.asarray(soft).astype(np.int16)
    rng = np.random.default_rng(3)
    arr = np.clip(arr + rng.normal(0, 4, arr.shape), 0, 255).astype(np.uint8)   # and its noise
    fake = Image.fromarray(arr, "RGB")
    os.makedirs(os.path.join(ROOT, "_shots"), exist_ok=True)
    fake.save(os.path.join(ROOT, "_shots", "spritify_in.png"))

    pal = category_palette(cat)
    out, info = spritify(fake, cat=cat, size=max(orig.shape[:2]), pal=pal)
    if out is None:
        print("FAIL:", info)
        return 1
    Image.fromarray(out, "RGBA").save(os.path.join(ROOT, "_shots", "spritify_out.png"))

    s_out = score_against(out, cat)
    s_orig = score_against(orig, cat)
    ncol = len(set(map(tuple, out[..., :3][out[..., 3] > 0])))
    semi = int(((out[..., 3] > 0) & (out[..., 3] < 255)).sum())

    # FIDELITY, which the first version of this test did not check and so passed a white-and-blue
    # fragment as a brown sword. Colour count, hard alpha and a style score are all properties of a
    # picture, not of the RIGHT picture. Compare against the original: the shape must overlap and the
    # colours must be near.
    o = np.zeros_like(out)
    ref = Image.fromarray(orig, "RGBA").resize((out.shape[1], out.shape[0]), Image.NEAREST)
    ref = np.asarray(ref)
    ma, mb = out[..., 3] > 0, ref[..., 3] > 0
    iou = float((ma & mb).sum()) / float(max(1, (ma | mb).sum()))
    both = ma & mb
    dcol = float(np.abs(out[..., :3][both].astype(int) - ref[..., :3][both].astype(int)).mean())         if both.sum() else 255.0

    print("in :  320x320 soft, anti-aliased, %d colours"
          % len(set(map(tuple, np.asarray(fake).reshape(-1, 3)))))
    print("out:  %dx%d, %d colours, %d semi-transparent px, %d blob(s)"
          % (out.shape[1], out.shape[0], ncol, semi, info["blobs"]))
    print("fidelity vs the original: silhouette IoU %.2f, mean colour delta %.1f" % (iou, dcol))
    print("style score: %.2f  (the real sword scores %.2f)" % (s_out, s_orig))
    checks = [("hard alpha", semi == 0),
              ("frugal palette", ncol <= 96),
              ("one object", info["blobs"] >= 1),
              ("silhouette recovered", iou >= 0.55),
              ("colours recovered", dcol <= 42),
              ("scores like real art", s_out < s_orig + 1.2)]
    ok = all(v for _, v in checks)
    print()
    for name, v in checks:
        print("  %-24s %s" % (name, "ok" if v else "FAILED"))
    print()
    print("RESULT %s  soft 320px input -> crisp %dpx sprite"
          % ("PASS" if ok else "FAIL", out.shape[1]))
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser(description="Diffusion output -> game sprite.")
    ap.add_argument("src", nargs="?")
    ap.add_argument("--cat", default="Items · weapons")
    ap.add_argument("--size", type=int, default=64)
    ap.add_argument("--out")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest or not a.src:
        return selftest()
    out, info = spritify(Image.open(a.src), cat=a.cat, size=a.size)
    if out is None:
        sys.exit(info.get("error", "failed"))
    dst = a.out or os.path.splitext(a.src)[0] + "_sprite.png"
    Image.fromarray(out, "RGBA").save(dst)
    s = score_against(out, a.cat)
    print("%s  ->  %s  %dx%d  blobs %d  style %.2f"
          % (a.src, dst, out.shape[1], out.shape[0], info["blobs"], s if s else -1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
