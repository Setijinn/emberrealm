# ===================================================================================================
#  HOW BADLY IS A MOUNT FRAME ACTUALLY CLIPPED?
# ---------------------------------------------------------------------------------------------------
#  mountart.py flags a frame as CLIPPED when more than EDGE_BAD opaque pixels sit on a canvas border.
#  That is a PROXIMITY test and it does not distinguish the two cases that matter:
#
#     a tail tip or a hoof that happens to reach the last column -- nothing is missing, the animal
#     simply fills its canvas
#          vs
#     a wing sliced off flat against the border -- pixels that were never drawn, which no amount of
#     rendering work can recover and only a regeneration can fix
#
#  The difference is the LENGTH OF THE CONTIGUOUS RUN along the border. A tip touches for a few
#  pixels; a slice runs for tens of them, and a sliced edge is also unnaturally straight. That
#  distinction is what decides whether ~160 PixelLab generations are worth spending, so it gets
#  measured rather than assumed.
#
#  Reported per frame:
#     run     longest contiguous opaque run along any one border
#     frac    that run as a fraction of the border it lies on
#     sides   which borders are involved
#  and per archetype, the counts by severity:
#     TOUCH   run <= 4 px          the animal reaches its edge; nothing is missing
#     NICK    run 5..11 px         a toe or a wing tip is probably shaved
#     SLICE   run >= 12 px         a limb or a wing is genuinely cut off
#
#  Interpreter is Python312 by full path; `py` is broken on this machine.
# ===================================================================================================
import io
import os
import sys
import collections

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mountart import read_png_rgba, ROOT          # reuse the decoder, do not write a second one

ALPHA_ON = 8            # same opacity floor mountart.py uses
TOUCH_MAX = 4           # <= this is the animal reaching its edge
NICK_MAX = 11           # <= this is a tip shaved; above it a limb is cut


def border_runs(px, w, h):
    """Longest contiguous opaque run on each of the four borders."""
    def run(seq):
        best = cur = 0
        for v in seq:
            cur = cur + 1 if v else 0
            if cur > best:
                best = cur
        return best
    top = [px[(0 * w + x) * 4 + 3] > ALPHA_ON for x in range(w)]
    bot = [px[((h - 1) * w + x) * 4 + 3] > ALPHA_ON for x in range(w)]
    lef = [px[(y * w + 0) * 4 + 3] > ALPHA_ON for y in range(h)]
    rig = [px[(y * w + (w - 1)) * 4 + 3] > ALPHA_ON for y in range(h)]
    return {'top': (run(top), w), 'bottom': (run(bot), w),
            'left': (run(lef), h), 'right': (run(rig), h)}


def classify(run):
    if run <= TOUCH_MAX:
        return 'TOUCH'
    if run <= NICK_MAX:
        return 'NICK'
    return 'SLICE'


def main():
    base = os.path.join(ROOT, 'assets', 'mounts')
    per = collections.defaultdict(collections.Counter)
    worst = collections.defaultdict(lambda: (0, '', ''))
    kindof = collections.defaultdict(lambda: collections.defaultdict(collections.Counter))
    scanned = 0
    for dirpath, _dirs, files in os.walk(base):
        for f in sorted(files):
            if not f.endswith('.png'):
                continue
            path = os.path.join(dirpath, f)
            rel = os.path.relpath(path, ROOT).replace('\\', '/')
            arch = os.path.basename(dirpath)
            got = read_png_rgba(path)          # (w, h, bytes RGBA) -- note the order
            if not got:
                print('%-58s DECODE FAILED' % rel)
                continue
            w, h, px = got
            scanned += 1
            runs = border_runs(px, w, h)
            best, side = 0, ''
            for s, (r, _n) in runs.items():
                if r > best:
                    best, side = r, s
            cls = classify(best)
            per[arch][cls] += 1
            kind = ('idle' if f.startswith('idle') else 'walk' if f.startswith('walk')
                    else 'fly' if f.startswith('fly') else 'flat')
            kindof[arch][kind][cls] += 1
            if best > worst[arch][0]:
                worst[arch] = (best, side, rel)

    print('scanned %d frames in %s' % (scanned, os.path.relpath(base, ROOT)))
    print()
    print('  TOUCH  longest border run <= %d px -- the animal fills its canvas, nothing is missing'
          % TOUCH_MAX)
    print('  NICK   %d..%d px -- a tip or a toe is shaved' % (TOUCH_MAX + 1, NICK_MAX))
    print('  SLICE  >= %d px -- a limb or a wing is cut off, only a regeneration fixes it'
          % (NICK_MAX + 1))
    print()
    print('  %-16s %6s %6s %6s   %-6s %s' % ('archetype', 'TOUCH', 'NICK', 'SLICE', 'worst', 'where'))
    print('  ' + '-' * 92)
    tot = collections.Counter()
    for a in sorted(per):
        c = per[a]
        tot.update(c)
        wbest, wside, wrel = worst[a]
        print('  %-16s %6d %6d %6d   %-6s %s (%s)'
              % (a, c['TOUCH'], c['NICK'], c['SLICE'], wbest, wrel.split('/')[-1], wside))
    print('  ' + '-' * 92)
    print('  %-16s %6d %6d %6d' % ('TOTAL', tot['TOUCH'], tot['NICK'], tot['SLICE']))
    print()
    sl = [a for a in sorted(per) if per[a]['SLICE']]
    if not sl:
        print('NO FRAME IS SLICED. Every flagged frame is an animal that reaches its own canvas edge,')
        print('which is what a well-filled 64px sprite looks like. Nothing here needs regenerating.')
    else:
        print('SLICED, by archetype and animation -- these are the only sets a regeneration would fix:')
        for a in sl:
            parts = []
            for k in ('flat', 'idle', 'walk', 'fly'):
                n = kindof[a][k]['SLICE']
                if n:
                    parts.append('%s %d' % (k, n))
            print('  %-16s %3d frames   %s' % (a, per[a]['SLICE'], ', '.join(parts)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
