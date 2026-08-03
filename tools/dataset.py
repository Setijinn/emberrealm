#!/usr/bin/env python
"""Export the sprite corpus as a LoRA training set.

WHY THIS IS THE PART THAT DECIDES THE RESULT. A diffusion fine-tune learns what you show it, and
sprite corpora go wrong in four predictable ways. Each is handled here rather than left to be
discovered after a four-hour training run:

  1. UPSCALE WITH NEAREST, NEVER BILINEAR. A 64px sprite has to reach the trainer's resolution, and
     any smooth resampler turns hard pixel edges into gradients -- so the model learns to produce
     blur, which is the one thing pixel art must not have. Nearest keeps every edge a cliff.

  2. TRAIN SMALL. Guides assume 512 or 1024 because they assume photographs. These are 64-92px
     sprites: at 320 there is nothing left to resolve, and on a 4GB card the difference between 320
     and 512 is the difference between training and an out-of-memory error.

  3. FLATTEN THE ALPHA. Stable Diffusion has no alpha channel. Transparent PNGs load as black, so
     every sprite gains a black halo the model dutifully learns. Composited onto one flat colour that
     the captions then name, so it can be asked for and cut back out afterwards.

  4. DEDUPE THE ANIMATION FRAMES. attack_0..8 are near-identical, and 2,470 of the corpus's frames
     are one 92x92 pose repeated. Left in, the model sees mostly walk cycles and learns the average
     of a walk cycle. Kept at a cap per set, so a nine-frame attack contributes a few poses rather
     than nine.

Captions come from the same taxonomy the lab and the scorer use, so all three agree about what a
thing is.

    py tools/dataset.py                 # everything, to _dataset/
    py tools/dataset.py --only weapons  # one category, which is the sane way to start
"""

import io
import os
import re
import shutil
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spritelab import categorise

ASSETS = os.path.join(ROOT, "assets")
OUT = os.path.join(ROOT, "_dataset")
SIZE = 320                 # what a 4GB card can train; a 64px sprite has nothing more to give
BG = (109, 96, 130)        # a flat mid-violet that appears nowhere in the art, so it cuts back out
FRAME_CAP = 3              # poses per animated set, so a walk cycle does not drown the corpus

TRIGGER = "emberrealm"     # the token that will mean "this project's style"


def orientation(px):
    """Say which way the thing lies, so ORIENTATION IS A TOKEN YOU CAN ASK FOR rather than a habit
    the model inherits.

    Every axial weapon in this corpus happens to be drawn on the same diagonal. Train on that without
    naming it and "sword" silently means "diagonal sword" forever -- the model has no way to know the
    angle was a convention rather than part of what a sword is. Named, it becomes a dial: ask for an
    upright sword and the model has upright things (crossbows, staves, potions) to generalise from.

    Only for elongated shapes; a ring has no orientation worth stating."""
    a = px[..., 3] > 40
    ys, xs = np.nonzero(a)
    if len(xs) < 24:
        return None
    x = xs - xs.mean(); y = ys - ys.mean()
    w, v = np.linalg.eigh(np.cov(np.stack([x, y])))
    if np.sqrt(max(w) / max(min(w), 1e-9)) < 2.0:
        return None                      # too round to have a direction
    ang = np.degrees(np.arctan2(*v[:, np.argmax(w)][::-1])) % 180
    if ang < 22.5 or ang >= 157.5:
        return "horizontal"
    if 67.5 <= ang < 112.5:
        return "upright"
    return "diagonal"


def caption(path, cat, orient=None):
    """A caption the model can be prompted back with. Order matters: trigger, medium, category,
    subject, then attributes -- the earliest tokens carry the most weight."""
    name = os.path.basename(path)[:-4]
    bits = [TRIGGER, "pixel art sprite"]
    bits.append(cat.lower().replace(" · ", " ").replace("(", "").replace(")", ""))
    subj = re.sub(r"^(wpn|arm|helm|ring|mat|relic_r|boost|item)_", "", name)
    subj = re.sub(r"_\d+$", "", subj)
    subj = re.sub(r"_(idle|walk|attack|ride)(_[nsew]{1,2})?$", "", subj)
    subj = subj.replace("_", " ").strip()
    if subj and subj not in bits:
        bits.append(subj)
    if orient:
        bits.append(orient)
    bits.append("flat violet background")
    return ", ".join(bits)


def prep(px):
    """Flatten onto the background, then nearest-upscale to SIZE keeping the aspect."""
    im = Image.fromarray(px, "RGBA")
    bg = Image.new("RGBA", im.size, BG + (255,))
    bg.alpha_composite(im)
    im = bg.convert("RGB")
    s = max(1, min(SIZE // max(im.width, im.height), 16))
    if s > 1:
        im = im.resize((im.width * s, im.height * s), Image.NEAREST)
    # pad to a square canvas: the trainer wants one shape, and padding with the same flat colour
    # keeps the model from learning a letterbox
    out = Image.new("RGB", (SIZE, SIZE), BG)
    out.paste(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2))
    return out


def gather(only=None):
    """Walk the corpus, capping frames per animated directory."""
    items = []
    for cur, subs, names in os.walk(ASSETS):
        subs[:] = [s for s in subs if s not in ("font", "orig")]
        pngs = sorted(n for n in names if n.lower().endswith(".png"))
        if not pngs:
            continue
        rel = os.path.relpath(cur, ROOT).replace("\\", "/")
        # PER FILE, not per directory. assets/items is a flat drawer of weapons, armour, rings and
        # relics; categorising it once from its first file labelled all 365 as armour, which would
        # have trained every sword with the caption "armour".
        dir_cat = categorise(rel, pngs[0])
        # an animated set is one subject: take a few poses, not the whole cycle
        anim = sum(1 for n in pngs if re.match(r"^(idle|walk|attack|ride)", n)) > len(pngs) * 0.6
        chosen = pngs
        if anim and len(pngs) > FRAME_CAP:
            groups = {}
            for n in pngs:
                groups.setdefault(re.sub(r"_\d+\.png$", "", n), []).append(n)
            chosen = []
            for g in sorted(groups):
                chosen += groups[g][:1]                  # one pose per action+facing
            chosen = chosen[:max(FRAME_CAP, 1) * 4]
        for n in chosen:
            c = categorise(rel, n)
            if only and only.lower() not in c.lower():
                continue
            items.append((os.path.join(cur, n), c))
    return items


def main():
    only = None
    if "--only" in sys.argv:
        only = sys.argv[sys.argv.index("--only") + 1]
    items = gather(only)
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT, exist_ok=True)

    counts = {}
    n = 0
    for path, cat in items:
        try:
            px = np.asarray(Image.open(path).convert("RGBA")).copy()
        except Exception:
            continue
        if (px[..., 3] > 40).sum() < 24:
            continue
        orient = orientation(px)
        variants = [(px, orient)]
        # A MIRROR IS LOSSLESS, and it is the one augmentation pixel art survives -- rotating would
        # resample and teach the model to blur. It also halves the diagonal bias: the corpus leans
        # one way, the mirror leans the other.
        if orient and "--noflip" not in sys.argv:
            variants.append((px[:, ::-1].copy(), orient))
        for vi, (vpx, vor) in enumerate(variants):
            im = prep(vpx)
            stem = "%05d_%s%s" % (n, os.path.basename(path)[:-4], "_m" if vi else "")
            im.save(os.path.join(OUT, stem + ".png"))
            with io.open(os.path.join(OUT, stem + ".txt"), "w", encoding="utf-8") as f:
                f.write(caption(path, cat, vor))
            counts[cat] = counts.get(cat, 0) + 1
            n += 1

    print("wrote %d images + captions to %s at %dx%d" % (n, os.path.relpath(OUT, ROOT), SIZE, SIZE))
    print()
    for cat in sorted(counts, key=lambda c: -counts[c]):
        print("  %-26s %5d" % (cat, counts[cat]))
    print()
    print("trigger word: %r -- prompt with it to get this style back" % TRIGGER)
    print("background:   rgb%s, named in every caption so it can be prompted and keyed out" % (BG,))
    return 0


if __name__ == "__main__":
    sys.exit(main())
