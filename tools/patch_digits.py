#!/usr/bin/env python
"""Redraw '2' and '5' in Pixelify Sans so they cannot be read as 'S'.

WHY. In Pixelify Sans at 9-14px the glyphs for 2, 5 and S trace almost the same path. Read out of the
font, all three sit on the same 5x7 pixel grid spanning x 60..525, y -12..631, and:

    S   top bar -> LEFT down -> middle bar -> RIGHT down -> bottom bar
    2   top bar -> RIGHT down -> middle bar -> LEFT down -> bottom bar     (S mirrored)
    5   S, plus one extra step

So a bounty reading "Fell 22 creatures" rendered as "Fell SS creatures" and a reward of +120 read as
+1S0. In a game that is almost entirely numbers -- levels, tiers, damage, counts, timers -- that is
not a cosmetic complaint. (User, 2026-07-30.)

WHY NOT SUBSTITUTE A DIFFERENT FONT. That was the first attempt: trim the digits out of Pixelify's
unicode-range and let a system monospace claim U+0030-0039, which needs no font surgery at all and
works in the DOM and on the canvas alike, because font matching is per-glyph. It reads perfectly and
looks wrong -- "those are too plain, they aren't pixelated like the others" -- and the user is right.
A pixel game's numbers have to be pixels.

HOW. A TrueType glyph may have many contours, and the nonzero winding rule fills their union as long
as they wind the same way. So each glyph here is emitted as ONE SQUARE CONTOUR PER LIT PIXEL of a 5x7
bitmap, laid out on the grid the font's own digits already use. No tracing, no curve fitting, and the
result is exactly the pixel art it claims to be.

    2   .###.      5   #####
        #...#          #....
        ....#          ####.
        ...#.          ....#
        ..#..          ....#
        .#...          #...#
        #####          .###.

The 2 gets a stair-step diagonal, which no S has. The 5 gets a flat top bar and a straight left stem,
where S rounds. Neither can be confused with the other or with S at any size.

    py tools/patch_digits.py            # rewrites assets/font/pixelifysans-500.woff2 in place
    py tools/patch_digits.py --dry      # report only

gvar IS DROPPED FOR THESE TWO GLYPHS. This is a variable font (one wght axis, 400-700) and gvar deltas
are per-point: a glyph whose outline is replaced has deltas that no longer describe it, which renders
as garbage at weight 700 -- and the stylesheet asks for 700. Removing the two entries makes these
digits weight-invariant, which for a pixel font is what they already were in practice.
"""

import io
import os
import shutil
import sys

from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import Glyph, GlyphCoordinates
from fontTools.misc.roundTools import otRound

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, 'assets', 'font', 'pixelifysans-500.woff2')

# The grid the font's own digits sit on, read out of the file rather than guessed: every one of
# '2', '5' and 'S' has bbox (60, -12, 525, 631).
X0, X1 = 60, 525
Y0, Y1 = -12, 631
COLS, ROWS = 5, 7

BITMAPS = {
    'two': [
        '.###.',
        '#...#',
        '....#',
        '...#.',
        '..#..',
        '.#...',
        '#####',
    ],
    'five': [
        '#####',
        '#....',
        '####.',
        '....#',
        '....#',
        '#...#',
        '.###.',
    ],
}


def build_glyph(rows):
    """One closed square contour per lit pixel, all wound the same direction."""
    cw = (X1 - X0) / float(COLS)
    ch = (Y1 - Y0) / float(ROWS)
    pts, ends = [], []
    for r, line in enumerate(rows):
        # row 0 is the TOP of the bitmap and the TOP of the glyph, so y counts down from Y1
        y_top = Y1 - r * ch
        y_bot = Y1 - (r + 1) * ch
        for c, cell in enumerate(line):
            if cell != '#':
                continue
            x_l = X0 + c * cw
            x_r = X0 + (c + 1) * cw
            quad = [(x_l, y_bot), (x_r, y_bot), (x_r, y_top), (x_l, y_top)]
            for (x, y) in quad:
                pts.append((otRound(x), otRound(y)))
            ends.append(len(pts) - 1)
    g = Glyph()
    g.numberOfContours = len(ends)
    g.coordinates = GlyphCoordinates(pts)
    g.endPtsOfContours = ends
    g.flags = bytearray([1] * len(pts))          # every point on-curve
    # AN EMPTY PROGRAM, NOT None. glyf.compile() calls self.program.getBytecode() unconditionally for
    # any glyph with contours, so a None here is an AttributeError at save time and nothing else.
    from fontTools.ttLib.tables import ttProgram
    g.program = ttProgram.Program()
    g.program.fromBytecode(b'')
    return g


def main():
    dry = '--dry' in sys.argv
    f = TTFont(FONT)
    glyf, hmtx = f['glyf'], f['hmtx']
    gvar = f['gvar'] if 'gvar' in f else None

    for name, rows in BITMAPS.items():
        old = glyf[name]
        adv, lsb = hmtx[name]
        g = build_glyph(rows)
        print('%-5s  contours %d -> %d   points %d   bbox (%d,%d,%d,%d)'
              % (name, old.numberOfContours, g.numberOfContours, len(g.coordinates),
                 X0, Y0, X1, Y1))
        if dry:
            continue
        glyf[name] = g
        g.recalcBounds(glyf)
        hmtx[name] = (adv, g.xMin)               # advance unchanged; lsb follows the new outline
        if gvar is not None and name in gvar.variations:
            del gvar.variations[name]            # see the note at the top: per-point deltas
    if dry:
        return

    shutil.copy2(FONT, FONT + '.bak')
    f.flavor = 'woff2'
    f.save(FONT)
    print('wrote %s (%d bytes; previous kept as .bak)' % (os.path.basename(FONT), os.path.getsize(FONT)))


if __name__ == '__main__':
    main()
