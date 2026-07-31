# ===================================================================================================
#  IS THIS SET LIT THE SAME WAY ALL THE WAY ROUND?
# ---------------------------------------------------------------------------------------------------
#  User, 2026-07-31: "why is some dark as hell and some are lit up".
#
#  Because PixelLab renders each of the eight rotations semi-independently, and the exposure drifts
#  between them. It is NOT a light direction -- a light source sweeps smoothly round the compass,
#  brightest facing it and darkest away. A drifting generation jumps: one ram measured 71, 124, 48,
#  61, 72, 56, 49, 97 going round, with south-east twice as bright as south.
#
#  The fault is invisible in a single frame and obvious the moment the animal turns, which is exactly
#  the kind of thing a per-frame eyeball check misses. So it gets a number: the mean brightness of the
#  DRAWN pixels per facing, and the spread between the brightest and the darkest.
#
#  Measured on what is already in the game, which is where the threshold comes from:
#     hand-authored unridden art   spread  4 - 9
#     ridden sets that look right  spread  9 - 21
#     the ram that does not        spread 75
#
#    py tools/mountlight.py                 every ridden set
#    py tools/mountlight.py <dir>           any folder of idle_<d>.png
#  Interpreter is Python312 by full path; `py` is broken on this machine.
# ===================================================================================================
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mountart import read_png_rgba

DIRS = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne']
SPREAD_OK = 25          # above this the set visibly flickers as you turn
ALPHA_ON = 8


def brightness(path):
    got = read_png_rgba(path)
    if not got:
        return None
    w, h, px = got
    tot = n = 0
    for i in range(w * h):
        if px[i*4+3] <= ALPHA_ON:
            continue
        tot += 0.299*px[i*4] + 0.587*px[i*4+1] + 0.114*px[i*4+2]
        n += 1
    return (tot / n) if n else None


def check(label, folder):
    vals = []
    for d in DIRS:
        p = os.path.join(folder, 'idle_%s.png' % d)
        if not os.path.exists(p):
            return None
        b = brightness(p)
        if b is None:
            return None
        vals.append(b)
    spread = max(vals) - min(vals)
    flag = 'OK  ' if spread <= SPREAD_OK else 'DRIFT'
    print('  %-5s %-18s %s   spread %3.0f' % (flag, label, ''.join('%6.0f' % v for v in vals), spread))
    return spread


def main(argv):
    print('mean brightness of the drawn pixels per facing, and the spread across the eight')
    print('        %-18s %s' % ('', ''.join('%6s' % d for d in DIRS)))
    print('  ' + '-' * 74)
    if len(argv) > 1:
        check(os.path.basename(os.path.normpath(argv[1])), argv[1])
        return 0
    base = os.path.join(ROOT, 'assets', 'mounts')
    bad = 0
    for arch in sorted(os.listdir(base)):
        f = os.path.join(base, arch, 'ridden')
        if os.path.isdir(f):
            s = check(arch + ' ridden', f)
            if s is not None and s > SPREAD_OK:
                bad += 1
    print('  ' + '-' * 74)
    print('  %d ridden set(s) drift by more than %d' % (bad, SPREAD_OK))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
