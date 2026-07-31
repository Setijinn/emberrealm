# ===================================================================================================
#  EXTRACT A SEATED RIDER FROM A PIXELLAB "RIDDEN" STATE
# ---------------------------------------------------------------------------------------------------
#  THE PROBLEM THIS SOLVES. assets/riders/knight/ride_<d>.png is the STANDING hero sprite. Blitted
#  onto a mount it reads as a dark totem balanced on the animal's back with its legs hanging through
#  it, which is what the user has been looking at. There is no seated-rider art in the project at
#  all, and no amount of seat tuning creates one.
#
#  There IS a way to get it without drawing anything new. Every mount archetype is a PixelLab object,
#  and most already carry a STATE -- "add an armoured knight seated in the saddle" -- generated from
#  that same object. A state is rendered on top of its base, so the two are pixel-aligned: the animal
#  is in the same place in both, and the only thing that changed is the rider. Subtract one from the
#  other and what is left IS the rider, in the pose that suits that animal, at the offset that puts
#  him in that animal's saddle.
#
#  That is the whole idea, and it is why this is worth doing per archetype rather than once: a moth's
#  rider leans forward over a thorax and a colossus's sits upright on a block, and PixelLab already
#  drew both.
#
#  WHY SUBTRACTION NEEDS CARE. The state is a re-render, not a copy, so the animal is not bit-identical
#  underneath -- there is dither noise all over it. A naive "any pixel that differs" keeps that noise
#  and hands back most of the animal, which is exactly the failure that shipped: those layers measure
#  60x53 against a person's 27x42, and drew as a second mount inside the first.
#
#  So the difference is filtered three ways, in this order:
#    1. PER-PIXEL THRESHOLD. A pixel counts as changed only if it moved more than DIFF_MIN, or if its
#       alpha appeared where there was none. Re-render dither is small; a knight is not.
#    2. LARGEST CONNECTED COMPONENT. The rider is one object. Noise is thousands of specks. Keep the
#       biggest 4-connected blob and drop everything else.
#    3. A PERSON-SHAPED SANITY CHECK. If what survives is wider than RIDER_MAX x the animal's own
#       width, the subtraction failed and the file is NOT written -- better no layer, and the generic
#       fallback, than a mount inside a mount.
#
#  Output is written at the base canvas size with the rider at his ORIGINAL offset, so the game can
#  blit it with the mount's own transform and never guess a saddle height again.
#
#    py tools/riderextract.py <arch> <base.zip|dir> <state.zip|dir> [--dry]
#  Interpreter is Python312 by full path; `py` is broken on this machine.
# ===================================================================================================
import io
import os
import struct
import sys
import zipfile
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mountart import read_png_rgba

DIRS = {'east': 'e', 'south-east': 'se', 'south': 's', 'south-west': 'sw',
        'west': 'w', 'north-west': 'nw', 'north': 'n', 'north-east': 'ne'}
DIFF_MIN = 44        # per-channel move that counts as "this pixel changed", not re-render dither
ALPHA_ON = 8
RIDER_MAX = 0.72     # kept blob wider than this x the animal's width means the subtraction failed
MIN_PIX = 60         # a rider smaller than this is a failed extraction, not a small rider


def load(src):
    """{relpath: bytes} for every png in a zip or directory (flattened names allowed)."""
    out = {}
    if os.path.isdir(src):
        for f in sorted(os.listdir(src)):
            if f.endswith('.png'):
                out[f.replace('__', '/')] = io.open(os.path.join(src, f), 'rb').read()
    else:
        z = zipfile.ZipFile(src)
        for n in z.namelist():
            if n.endswith('.png'):
                out[n] = z.read(n)
    return out


def rotations(files):
    """{short direction: bytes} from whichever entries are rotations."""
    out = {}
    for rel, data in files.items():
        parts = rel.split('/')
        if parts[0] == 'rotations' and len(parts) == 2:
            d = DIRS.get(parts[1][:-4])
            if d:
                out[d] = data
    return out


def decode(data):
    p = os.path.join(os.environ.get('TEMP', '.'), '_rx_tmp.png')
    io.open(p, 'wb').write(data)
    return read_png_rgba(p)


def write_png(path, w, h, px):
    raw = b''.join(b'\x00' + bytes(px[(y*w)*4:(y*w+w)*4]) for y in range(h))

    def ch(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    io.open(path, 'wb').write(b'\x89PNG\r\n\x1a\n'
                             + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
                             + ch(b'IDAT', zlib.compress(raw, 9)) + ch(b'IEND', b''))


def largest_blob(mask, w, h):
    """Biggest 4-connected component of a boolean mask, as a new mask."""
    seen = bytearray(w * h)
    best, bestn = None, 0
    stack = []
    for s in range(w * h):
        if not mask[s] or seen[s]:
            continue
        comp = []
        stack.append(s)
        seen[s] = 1
        while stack:
            i = stack.pop()
            comp.append(i)
            x = i % w
            if x > 0 and mask[i-1] and not seen[i-1]:
                seen[i-1] = 1; stack.append(i-1)
            if x < w-1 and mask[i+1] and not seen[i+1]:
                seen[i+1] = 1; stack.append(i+1)
            if i >= w and mask[i-w] and not seen[i-w]:
                seen[i-w] = 1; stack.append(i-w)
            if i < w*(h-1) and mask[i+w] and not seen[i+w]:
                seen[i+w] = 1; stack.append(i+w)
        if len(comp) > bestn:
            bestn, best = len(comp), comp
    out = bytearray(w * h)
    for i in (best or []):
        out[i] = 1
    return out, bestn


def extract(base_png, state_png):
    """(w, h, rgba, note) -- the rider alone, at his original offset."""
    bw, bh, bp = decode(base_png)
    sw, sh, sp = decode(state_png)
    if (bw, bh) != (sw, sh):
        return None, 'canvas mismatch %dx%d vs %dx%d' % (bw, bh, sw, sh)
    n = bw * bh
    mask = bytearray(n)
    for i in range(n):
        o = i * 4
        ba, sa = bp[o+3], sp[o+3]
        if sa <= ALPHA_ON:
            continue                                   # nothing in the state here
        if ba <= ALPHA_ON:
            mask[i] = 1                                # rider covers what was empty background
            continue
        d = max(abs(bp[o]-sp[o]), abs(bp[o+1]-sp[o+1]), abs(bp[o+2]-sp[o+2]))
        if d >= DIFF_MIN:
            mask[i] = 1
    mask, cnt = largest_blob(mask, bw, bh)
    if cnt < MIN_PIX:
        return None, 'only %d pixels survived -- no rider found' % cnt
    # the animal's own width, to judge whether what survived is a person or the animal again
    ax0, ax1 = bw, -1
    for i in range(n):
        if bp[i*4+3] > ALPHA_ON:
            x = i % bw
            if x < ax0: ax0 = x
            if x > ax1: ax1 = x
    rx0, rx1, ry0, ry1 = bw, -1, bh, -1
    for i in range(n):
        if mask[i]:
            x, y = i % bw, i // bw
            if x < rx0: rx0 = x
            if x > rx1: rx1 = x
            if y < ry0: ry0 = y
            if y > ry1: ry1 = y
    aw = ax1 - ax0 + 1
    rw = rx1 - rx0 + 1
    if aw > 0 and rw > aw * RIDER_MAX:
        return None, ('kept blob is %dx%d against the animal\'s %d wide -- that is the animal, '
                      'not a rider' % (rw, ry1-ry0+1, aw))
    out = bytearray(n * 4)
    for i in range(n):
        if mask[i]:
            out[i*4:i*4+4] = sp[i*4:i*4+4]
    return (bw, bh, out), '%dx%d rider, %d px, animal is %d wide' % (rw, ry1-ry0+1, cnt, aw)


def main(argv):
    if len(argv) < 4:
        print('usage: riderextract.py <arch> <base.zip|dir> <state.zip|dir> [--dry]')
        return 2
    arch, basesrc, statesrc = argv[1], argv[2], argv[3]
    dry = '--dry' in argv
    brot = rotations(load(basesrc))
    srot = rotations(load(statesrc))
    if not brot or not srot:
        print('%s: no rotations found (base %d, state %d)' % (arch, len(brot), len(srot)))
        return 1
    dest = os.path.join(ROOT, 'assets', 'riders', arch, 'knight')
    ok = fail = 0
    print('%s' % arch)
    for d in ('e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'):
        if d not in brot or d not in srot:
            print('  %-4s missing rotation' % d)
            fail += 1
            continue
        got, note = extract(brot[d], srot[d])
        if not got:
            print('  %-4s SKIPPED — %s' % (d, note))
            fail += 1
            continue
        ok += 1
        print('  %-4s %s' % (d, note))
        if not dry:
            os.makedirs(dest, exist_ok=True)
            write_png(os.path.join(dest, 'ride_%s.png' % d), got[0], got[1], got[2])
    print('  %d extracted, %d skipped%s' % (ok, fail, ' (--dry, nothing written)' if dry else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
