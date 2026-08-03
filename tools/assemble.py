#!/usr/bin/env python
"""Generate new weapons by recombining real parts. KEPT AS A RECORD OF A DEAD END -- read this first.

WHAT IT DOES AND WHY IT IS NOT THE ANSWER. It cuts weapons into head and handle and pairs them
across families, so a wand's stone can arrive on a bow's shaft. The silhouettes really are new and
every pixel is still PixelLab's. But recombination can only ever rearrange parts that already exist:
it cannot produce a curve, a taper or a structure that is not already in the folder, which is the
thing actually being asked for when someone says "generate new sprites". The user said so and was
right.

THE YIELD SAYS THE SAME THING NUMERICALLY. The first version assumed every weapon points up-right
and produced 359 joined results out of ~2,880 pairings. That assumption was wrong -- measured, the
swords, staves and wands all run the other way -- so the "head" was usually the POMMEL, which is how
an orb ended up on the hilt of a sword. With the orientation detected properly the same code yields
SEVEN. Most of those 359 were parts overlapping by accident because they were attached backwards.

So: a working technique for making a handful of legitimate variant items, and not a route to new
design. The honest path to new curves and structures is a model trained on the corpus, not a
recombination of it.

THE COMPLAINT THIS ANSWERS. Recolouring 84 weapons gives you 84 silhouettes in more colours. It is
variation, not generation: it cannot produce a weapon that is not already in the folder. This cuts
the weapons into HEAD and HANDLE and puts them back together in new pairings, so a sword's blade can
arrive on a staff's shaft and a wand's orb on a dagger's grip. The silhouettes are new; every pixel
is still PixelLab's, which is the only reason the result looks like the game.

WHY THIS IS LOSSLESS, AND WHY THAT DECIDED THE DESIGN. Rotating pixel art by an arbitrary angle
resamples it and destroys the crispness that makes it pixel art, so any scheme needing rotation is
dead. Measured, every axial weapon in this project lies on the SAME diagonal -- swords 135.2 degrees
+-0.3, wands 135.0 +-0.3, staves 133.6 +-0.6, daggers and bows likewise. At 45 degrees the
along-axis coordinate is k = y - x and the cross-axis one is x + y, both integers, and sliding a
part along the axis is exactly (x, y) -> (x - n, y + n). Integer in, integer out: parts meet at the
same angle and nothing is ever resampled.

WHERE THE CUT GOES. Take the width of the sprite along k. Every one of these weapons has one
dominant bulge -- a sword's crossguard, a staff's head, a wand's stone -- and it is the widest point
on the profile. HEAD is everything up to and including that bulge; HANDLE is the rest. Two parts
rather than four on purpose: a four-way split needs the grip and pommel told apart, which the profile
does not reliably say, and a wrong cut is a weapon with two guards.

    py tools/assemble.py            # build, score, write a contact sheet
    py tools/assemble.py --keep     # ...and write the winners into assets/items/
"""

import io
import json
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import spritegen as SG
from stylestats import features, KEYS

ITEMS = os.path.join(ROOT, "assets", "items")
SHOTS = os.path.join(ROOT, "_shots")
AXIAL = ("sword", "dagger", "wand", "staff", "bow")     # the families on the 135-degree diagonal


def load(path):
    return SG.load_rgba(path)


def parts(px):
    """Split into head and handle at the widest point, with the TIP END DETECTED, not assumed.

    The first version assumed every weapon points up-right, so the head was always taken from the
    low-k end. Some of these sprites are drawn the other way round, and for those the "head" was the
    POMMEL -- which is how an orb ended up on the hilt of a sword. The tip end is simply the narrower
    one: average the width over the outer fifth at each end and take the thinner as the point.

    The bulge is then the widest place that is not the butt: a crossguard for a sword, the stone for
    a wand or staff. The last 15% is excluded because a pommel is a bulge too, and picking it would
    cut the weapon in half at the wrong end again.
    """
    a = px[..., 3] > 40
    ys, xs = np.nonzero(a)
    if len(xs) < 40:
        return None
    k = ys - xs                                   # along-axis, integer at 45 degrees
    lo, hi = int(k.min()), int(k.max())
    if hi - lo < 12:
        return None
    prof = np.zeros(hi - lo + 1, np.int32)
    for kk in k:
        prof[kk - lo] += 1
    span = len(prof)
    edge = max(2, span // 5)
    tip_at_low = prof[:edge].mean() < prof[-edge:].mean()

    # work tip-first, whichever end that is
    p = prof if tip_at_low else prof[::-1]
    body = p[: int(span * 0.85)]                  # exclude the butt: a pommel is a bulge too
    peak = int(np.argmax(body))
    half = max(2, body[peak] // 2)
    end = peak
    while end + 1 < len(p) and p[end + 1] >= half:
        end += 1

    kk = (np.arange(px.shape[0])[:, None] - np.arange(px.shape[1])[None, :])
    if tip_at_low:
        cut = lo + end
        head_mask = a & (kk <= cut)
        hand_mask = a & (kk > cut)
    else:
        cut = hi - end
        head_mask = a & (kk >= cut)
        hand_mask = a & (kk < cut)
    if head_mask.sum() < 20 or hand_mask.sum() < 20:
        return None
    return {"head": head_mask, "hand": hand_mask, "cut": cut, "k": kk, "a": a,
            "tip_low": bool(tip_at_low)}


def cutout(px, mask):
    out = np.zeros_like(px)
    out[mask] = px[mask]
    return out


def slide(px, n):
    """Move along the axis by n steps: (x, y) -> (x - n, y + n). Integer, so lossless."""
    out = np.zeros_like(px)
    h, w = px.shape[:2]
    ys, xs = np.nonzero(px[..., 3] > 0)
    nx, ny = xs - n, ys + n
    ok = (nx >= 0) & (ny >= 0) & (nx < w) & (ny < h)
    out[ny[ok], nx[ok]] = px[ys[ok], xs[ok]]
    return out


def kspan(px):
    ys, xs = np.nonzero(px[..., 3] > 0)
    if not len(xs):
        return None
    k = ys - xs
    return int(k.min()), int(k.max())


def connected(px):
    """Number of 8-connected opaque blobs. A weapon is one object; two blobs means the join failed."""
    a = px[..., 3] > 40
    seen = np.zeros_like(a)
    n = 0
    h, w = a.shape
    for sy in range(h):
        for sx in range(w):
            if not a[sy, sx] or seen[sy, sx]:
                continue
            n += 1
            if n > 2:
                return n
            stack = [(sy, sx)]
            seen[sy, sx] = True
            while stack:
                y, x = stack.pop()
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        yy, xx = y + dy, x + dx
                        if 0 <= yy < h and 0 <= xx < w and a[yy, xx] and not seen[yy, xx]:
                            seen[yy, xx] = True
                            stack.append((yy, xx))
    return n


def combine(a_px, a_parts, b_px, b_parts, pad=14):
    """A's head, B's handle, slid so the handle BEGINS where the head ENDS.

    The offset comes from the parts' real extents, not from the cut indices. Using the cuts assumed
    both parts started at their cut, which is only true when they are the same length -- pair a small
    wand head with a long staff shaft and the two ended up metres apart with a gap between them.
    The canvas is also grown first, because sliding a long handle into a 62px frame used to push it
    off the edge and lose it."""
    head = cutout(a_px, a_parts["head"])
    hand = cutout(b_px, b_parts["hand"])
    H = max(head.shape[0], hand.shape[0]) + pad * 2
    W = max(head.shape[1], hand.shape[1]) + pad * 2

    def grow(p):
        o = np.zeros((H, W, 4), np.uint8)
        o[pad:pad + p.shape[0], pad:pad + p.shape[1]] = p
        return o

    head, hand = grow(head), grow(hand)
    ka, kb = kspan(head), kspan(hand)
    if not ka or not kb:
        return None
    # Which edge of each part is the JOIN depends on which way that sprite runs. Head-tip-low means
    # the head's join edge is its high-k end and the handle continues upward from there; the other
    # orientation is the mirror of that. Getting this wrong attaches the handle back-to-front.
    if a_parts["tip_low"]:
        want = ka[1] + 1
        have = kb[0] if b_parts["tip_low"] else kb[1]
    else:
        want = ka[0] - 1
        have = kb[1] if b_parts["tip_low"] else kb[0]
    n = int(round((want - have) / 2.0))
    hand = slide(hand, -n)
    out = head.copy()
    m = (hand[..., 3] > 0) & (out[..., 3] == 0)
    out[m] = hand[m]
    # trim back to the content, so the result is a sprite and not a mostly-empty frame
    ys, xs = np.nonzero(out[..., 3] > 0)
    if not len(xs):
        return None
    return out[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def main():
    prof_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "style_profile.json")
    WEAP = json.load(io.open(prof_path, encoding="utf-8"))["Items · weapons"]

    def score(px):
        v = features(px)
        if not v:
            return 99, None
        return float(np.mean([abs((v[k] - WEAP[k]["mean"]) / WEAP[k]["sd"]) for k in KEYS])), v

    srcs = []
    for f in sorted(os.listdir(ITEMS)):
        if not f.startswith("wpn_") or not f.endswith(".png"):
            continue
        kind = f.split("_")[1]
        if kind not in AXIAL:
            continue
        px = load(os.path.join(ITEMS, f))
        p = parts(px)
        if p:
            srcs.append({"f": f, "kind": kind, "px": px, "p": p})
    print("%d axial weapons split into head + handle" % len(srcs))

    # silhouettes we already own, so "new" can be checked rather than assumed
    known = set()
    for s in srcs:
        known.add((s["p"]["a"] > 0).tobytes())

    made = []
    for A in srcs:
        for B in srcs:
            if A["f"] == B["f"] or A["kind"] == B["kind"]:
                continue                      # a sword head on a sword handle is just a sword
            if A["p"]["tip_low"] != B["p"]["tip_low"]:
                continue                      # opposite-running parts would need mirroring
            out = combine(A["px"], A["p"], B["px"], B["p"])
            if out is None or (out[..., 3] > 40).sum() < 40:
                continue
            # THE GATE THAT MATTERS. Four of the first ten came back as a head floating above a
            # detached stub -- obvious once drawn, invisible to a style score, and exactly the kind
            # of thing a connectivity check catches for nothing.
            if connected(out) != 1:
                continue
            if (out[..., 3] > 0).tobytes() in known:
                continue                      # identical to something we already have
            s, v = score(out)
            if v is None:
                continue
            made.append({"a": A["f"], "b": B["f"], "kind": A["kind"] + "/" + B["kind"],
                         "px": out, "score": s})
    print("%d new silhouettes built, joined and single-piece "
          "(disconnected joins rejected outright)" % len(made))

    made.sort(key=lambda c: c["score"])
    best, per_pair, per_a = [], {}, {}
    for c in made:
        if per_pair.get(c["kind"], 0) >= 2:
            continue
        if per_a.get(c["a"], 0) >= 1:
            continue
        best.append(c)
        per_pair[c["kind"]] = per_pair.get(c["kind"], 0) + 1
        per_a[c["a"]] = per_a.get(c["a"], 0) + 1
        if len(best) == 10:
            break

    os.makedirs(os.path.join(SHOTS, "assembled"), exist_ok=True)
    print()
    print("%-3s %-22s %-22s %-14s %s" % ("#", "head from", "handle from", "families", "score"))
    for i, c in enumerate(best, 1):
        print("%-3d %-22s %-22s %-14s %.2f" % (i, c["a"], c["b"], c["kind"], c["score"]))
        Image.fromarray(c["px"], "RGBA").save(
            os.path.join(SHOTS, "assembled", "%02d_%s.png" % (i, c["kind"].replace("/", "-"))))

    Z = 4
    cw = max(c["px"].shape[1] for c in best) * Z + 12
    ch = max(c["px"].shape[0] for c in best) * Z
    sheet = Image.new("RGBA", (cw * len(best), ch * 3 + 20), (22, 19, 26, 255))
    for i, c in enumerate(best):
        rows = [Image.open(os.path.join(ITEMS, c["a"])).convert("RGBA"),
                Image.open(os.path.join(ITEMS, c["b"])).convert("RGBA"),
                Image.fromarray(c["px"], "RGBA")]
        for r, im in enumerate(rows):
            z = im.resize((im.width * Z, im.height * Z), Image.NEAREST)
            sheet.alpha_composite(z, (i * cw + (cw - z.width) // 2, r * ch + (ch - z.height) // 2 + 10))
    out = os.path.join(SHOTS, "assembled.png")
    sheet.save(out)
    print()
    print("wrote %s  (row 1 head donor, row 2 handle donor, row 3 the new weapon)"
          % os.path.relpath(out, ROOT))
    return 0


if __name__ == "__main__":
    sys.exit(main())
