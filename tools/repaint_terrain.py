#!/usr/bin/env python
"""
Repaint the three dark ground atlases.

WHY. Measured, terr_4/5/8 are luma 51.9 / 52.1 / 49.3 with a standard deviation of about FIVE.
That second number is the real complaint: they are not merely dark, they are nearly flat -- a
single colour carrying a little per-pixel speckle -- so no render-time filter can rescue them.
Brightening a flat field gives a brighter flat field. They needed new paint, and the Lv50 rim
(band 8) is where the endgame lives, so it is the worst place in the game to have it.

terr_8 is also neutral grey (47,50,47) while its own TERR_ACCENT entry in 08_render.js calls it
"ember crust" at (112,52,26). The art and the palette it was written for had drifted apart; this
brings the ground back to the colour the rest of the code already believes it is.

HOW, and why it is safe. The remap is POINTWISE: every pixel's new colour depends only on its own
luminance, never on its neighbours. That matters more than it sounds -- these sheets are seamless
and tile against themselves and each other, and any neighbourhood operation (blur, sharpen, added
low-frequency structure) would break the wrap at the cell edges. A pointwise curve cannot.

Each atlas gets a two-point ramp, shadow -> highlight, and each pixel's luminance decides where on
that ramp it lands. Contrast is set by how much of the ramp the original's own spread is stretched
across: SPAN below 1.0 deliberately holds back from the ends, because mapping a std-5 speckle field
to the full ramp turns fine grain into television static.

ORIGINALS ARE KEPT. First run copies each source to assets/tiles/orig/ and every run reads from
there, so this is reproducible, re-tunable and reversible -- run with --restore to put the
originals back. Re-running never compounds.

USAGE
    py tools/repaint_terrain.py            # repaint from the originals
    py tools/repaint_terrain.py --report   # measure only, change nothing
    py tools/repaint_terrain.py --restore  # put the originals back
"""

import os
import shutil
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILES = os.path.join(ROOT, "assets", "tiles")
ORIG = os.path.join(TILES, "orig")

# band -> (shadow rgb, highlight rgb, span)
# `span` is how much of the ramp the source's own +/-2.5 sigma is stretched across. 1.0 would use
# the whole ramp and read as static on a field this fine-grained.
PLAN = {
    # Wolfwood: forest floor under canopy. Stays a shaded green -- it is a wood, not a lawn --
    # but with enough range between litter and lit moss to read as ground rather than as paper.
    4: ((30, 40, 24), (104, 124, 62), 0.72),
    # Deep Timber: "deep shade" by design and the darkest of the three on purpose. Lifted only
    # as far as it takes to see the ground, and kept cool and mossy.
    5: ((24, 36, 26), (86, 112, 66), 0.68),
    # The Ashfall and the whole Lv50 rim: ember crust. This is the big move -- from neutral grey
    # to the warm ash TERR_ACCENT already describes, with heat in the highlights.
    8: ((42, 28, 24), (168, 96, 52), 0.80),
}

LUMA = (0.2126, 0.7152, 0.0722)


def stats(im):
    px = list(im.convert("RGB").getdata())
    n = len(px)
    lum = [LUMA[0] * p[0] + LUMA[1] * p[1] + LUMA[2] * p[2] for p in px]
    m = sum(lum) / n
    sd = (sum((x - m) ** 2 for x in lum) / n) ** 0.5
    r = sum(p[0] for p in px) / n
    g = sum(p[1] for p in px) / n
    b = sum(p[2] for p in px) / n
    return m, sd, (r, g, b)


def ensure_orig(band):
    src = os.path.join(TILES, "terr_%d.png" % band)
    keep = os.path.join(ORIG, "terr_%d.png" % band)
    if not os.path.isdir(ORIG):
        os.makedirs(ORIG)
    if not os.path.exists(keep):
        shutil.copy2(src, keep)
    return keep


def repaint(band):
    keep = ensure_orig(band)
    im = Image.open(keep)
    alpha = im.split()[3] if im.mode == "RGBA" else None
    rgb = im.convert("RGB")
    m, sd, _ = stats(rgb)
    shadow, high, span = PLAN[band]

    lo = m - 2.5 * sd
    rng = 5.0 * sd
    mid = (1.0 - span) / 2.0

    px = list(rgb.getdata())
    out = []
    for p in px:
        l = LUMA[0] * p[0] + LUMA[1] * p[1] + LUMA[2] * p[2]
        t = (l - lo) / rng if rng > 1e-6 else 0.5
        t = 0.0 if t < 0 else (1.0 if t > 1 else t)
        t = mid + t * span                      # hold back from both ends of the ramp
        out.append(tuple(
            int(round(shadow[c] + (high[c] - shadow[c]) * t)) for c in range(3)))
    new = Image.new("RGB", rgb.size)
    new.putdata(out)
    if alpha is not None:
        new = new.convert("RGBA")
        new.putalpha(alpha)
    dest = os.path.join(TILES, "terr_%d.png" % band)
    new.save(dest)
    return stats(new)


if __name__ == "__main__":
    if "--restore" in sys.argv:
        for b in PLAN:
            keep = os.path.join(ORIG, "terr_%d.png" % b)
            if os.path.exists(keep):
                shutil.copy2(keep, os.path.join(TILES, "terr_%d.png" % b))
                print("restored terr_%d" % b)
        sys.exit(0)

    report_only = "--report" in sys.argv
    for b in sorted(PLAN):
        before = stats(Image.open(os.path.join(TILES, "terr_%d.png" % b)))
        if report_only:
            print("terr_%d  luma %5.1f  std %5.2f  rgb(%3.0f,%3.0f,%3.0f)"
                  % (b, before[0], before[1], before[2][0], before[2][1], before[2][2]))
            continue
        after = repaint(b)
        print("terr_%d  luma %5.1f -> %5.1f   std %5.2f -> %5.2f   "
              "rgb(%3.0f,%3.0f,%3.0f) -> (%3.0f,%3.0f,%3.0f)"
              % (b, before[0], after[0], before[1], after[1],
                 before[2][0], before[2][1], before[2][2],
                 after[2][0], after[2][1], after[2][2]))
