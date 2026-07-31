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
# Tuned against failures, not guessed. The first pass lost 13 of 80 directions in two distinct ways:
#
#   "only N pixels survived"    a DARK knight on a DARK animal (infernal, wyvern) barely moves any
#                               channel, so a threshold tuned on a steel knight against a brown horse
#                               threw the whole rider away. DIFF_MIN comes down, and brightness is no
#                               longer the only signal -- a pixel whose COLOUR SPREAD swung counts too.
#   "wider than the animal"     the rider fragments into helmet, torso and leg, and "largest blob"
#                               then picked a re-rendered patch of animal instead. Fragments are
#                               welded with a dilate before labelling, and the winner is chosen by
#                               being PERSON-SHAPED rather than by being biggest.
DIFF_MIN = 26        # per-channel move that counts as "this pixel changed", not re-render dither
HUE_MIN = 40         # or a colour spread that swung this far, for a dark rider on a dark animal
ALPHA_ON = 8
# A rider is narrow COMPARED TO THE ANIMAL -- but an animal seen from directly behind is itself
# narrow, and against a 32px-wide wolf rump a perfectly good 29px knight looked like the animal. So
# the width test is only failed when the blob is wide against the animal's width AND against its
# height, which a rear view never is.
RIDER_MAX = 0.72     # of the animal's width
RIDER_MAX_H = 0.50   # and of its height, both must be exceeded to call it a failure
# THE FLOOR IS WHAT PROTECTS THE CHOOSER. Dropping it to 14 so a nearly-hidden rider could qualify
# made things worse, not better: a 5-pixel speck of dither scores well on "narrow" and "upright" and
# beat the actual knight on three directions. So the floor stays high for the first pass, and only
# if NOTHING clears it does a second pass drop to MIN_PIX_LOW -- because a rider seen head-on really
# can be almost entirely behind the animal (the wolf facing south hides all but a sliver of helmet,
# and 19 pixels is the honest answer there, not a failure).
MIN_PIX = 45         # a component must be at least this big to be considered a rider at all
MIN_PIX_LOW = 12     # ...unless nothing at all qualified, in which case the sliver is the rider
# A rider the extraction is RIGHT about but that nobody can see. Facing the camera, the wolf's own
# state hides the knight behind its head almost completely -- 19 surviving pixels, faithfully
# extracted, and in game your rider simply vanishes when you turn south. Below this a direction is
# treated as having no usable rider and is borrowed from a donor archetype instead.
MIN_VISIBLE = 60
# A rider CUT OFF by the canvas. The wolf's state draws the knight flush with the top edge, so his
# helmet is sliced flat in all eight directions -- extracted perfectly and wrong on screen. Same
# contiguous-run test tools/mountclip.py uses on the animals: a few pixels touching a border is an
# edge reached, a long run is a slice.
EDGE_CUT = 5
# Margin added on every side when refitting. A knight fitted from a small animal onto a large one is
# scaled UP, and on the wolf that pushed his helmet through the top of the 68px frame -- swapping one
# cut-off rider for another. blit() centres a sprite and scales about that centre, so a canvas grown
# by the SAME amount on all four sides draws in exactly the same place: pixel (PAD+u) of a padded
# layer lands where pixel u of an unpadded one would. The margin is therefore free, and the game
# accepts any layer whose canvas is symmetrically larger than the animal's.
PAD = 20
WELD = 1             # dilate by this before labelling, so a fragmented rider counts as one object


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


def dilate(mask, w, h, r):
    """Grow a mask by r, so a rider broken into helmet / torso / leg welds into one object."""
    cur = mask
    for _ in range(r):
        nxt = bytearray(cur)
        for i in range(w * h):
            if not cur[i]:
                continue
            x = i % w
            if x > 0: nxt[i-1] = 1
            if x < w-1: nxt[i+1] = 1
            if i >= w: nxt[i-w] = 1
            if i < w*(h-1): nxt[i+w] = 1
        cur = nxt
    return cur


def components(mask, w, h):
    """Every 4-connected component, as lists of indices."""
    seen = bytearray(w * h)
    out = []
    for s0 in range(w * h):
        if not mask[s0] or seen[s0]:
            continue
        comp = []
        stack = [s0]
        seen[s0] = 1
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
        out.append(comp)
    return out


def pick_rider(mask, w, h, box, floor=None):
    """The component most like a PERSON, not the one that is biggest.

    Biggest is the wrong test. On a moth the wings re-render more pixels than the knight occupies, so
    "biggest" hands back a wing. A rider is recognisable instead by shape and place: narrow relative
    to the animal, upright, near its centre line, sitting in its upper half. Each component scores on
    those four and the best wins.
    """
    ax0, ay0, ax1, ay1 = box
    aw = max(1, ax1 - ax0 + 1)
    ah = max(1, ay1 - ay0 + 1)
    acx = (ax0 + ax1) / 2.0
    best, bestscore, bestn = None, -1e9, 0
    lim = MIN_PIX if floor is None else floor
    for comp in components(mask, w, h):
        if len(comp) < lim:
            continue
        xs = [i % w for i in comp]
        ys = [i // w for i in comp]
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        cw, chh = x1 - x0 + 1, y1 - y0 + 1
        if cw > aw * RIDER_MAX and cw > ah * RIDER_MAX_H:
            continue                                    # wide against BOTH: that is the animal
        cx = sum(xs) / float(len(xs))
        cy = sum(ys) / float(len(ys))
        score = 0.0
        score += 2.5 * (1.0 - min(1.0, cw / float(aw)))              # narrow is rider-like
        score += 1.5 * min(1.0, chh / float(max(1, cw) * 1.6))       # upright is rider-like
        score += 2.0 * (1.0 - min(1.0, abs(cx - acx) / (aw / 2.0)))  # near the animal's centre line
        score += 2.0 * max(0.0, (ay1 - cy) / float(ah))              # in its upper half
        score += 0.6 * min(1.0, len(comp) / 400.0)                   # and substantial
        if score > bestscore:
            bestscore, best, bestn = score, comp, len(comp)
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
        # a dark knight on a dark animal moves no channel much, but it does change the COLOUR SPREAD
        # -- charcoal plate against black scale is a different kind of dark
        hb = max(bp[o], bp[o+1], bp[o+2]) - min(bp[o], bp[o+1], bp[o+2])
        hs = max(sp[o], sp[o+1], sp[o+2]) - min(sp[o], sp[o+1], sp[o+2])
        if d >= DIFF_MIN or abs(hb - hs) >= HUE_MIN:
            mask[i] = 1
    # the animal's own box, for judging what a person-sized component looks like on THIS animal
    ax0, ax1, ay0, ay1 = bw, -1, bh, -1
    for i in range(n):
        if bp[i*4+3] > ALPHA_ON:
            x, y = i % bw, i // bw
            if x < ax0: ax0 = x
            if x > ax1: ax1 = x
            if y < ay0: ay0 = y
            if y > ay1: ay1 = y
    # weld fragments, choose by shape, then intersect back so only genuinely changed pixels are kept
    grown = dilate(mask, bw, bh, WELD)
    chosen, got = pick_rider(grown, bw, bh, (ax0, ay0, ax1, ay1))
    note = ''
    if not got:
        # nothing cleared the floor: the rider is probably behind the animal in this direction
        chosen, got = pick_rider(grown, bw, bh, (ax0, ay0, ax1, ay1), MIN_PIX_LOW)
        if got:
            note = ' (mostly hidden behind the animal)'
    for i in range(n):
        mask[i] = 1 if (mask[i] and chosen[i]) else 0
    cnt = sum(mask)
    if cnt < MIN_PIX_LOW:
        return None, 'only %d pixels survived -- no rider found' % cnt
    rx0, rx1, ry0, ry1 = bw, -1, bh, -1
    for i in range(n):
        if mask[i]:
            x, y = i % bw, i // bw
            if x < rx0: rx0 = x
            if x > rx1: rx1 = x
            if y < ry0: ry0 = y
            if y > ry1: ry1 = y
    aw = ax1 - ax0 + 1
    ah = ay1 - ay0 + 1
    rw = rx1 - rx0 + 1
    if aw > 0 and rw > aw * RIDER_MAX and rw > ah * RIDER_MAX_H:
        return None, ('kept blob is %dx%d against the animal\'s %d wide -- that is the animal, '
                      'not a rider' % (rw, ry1-ry0+1, aw))
    out = bytearray(n * 4)
    for i in range(n):
        if mask[i]:
            out[i*4:i*4+4] = sp[i*4:i*4+4]
    return (bw, bh, out), '%dx%d rider, %d px, animal is %d wide%s' % (rw, ry1-ry0+1, cnt, aw, note)


def bbox(px, w, h):
    x0, y0, x1, y1 = w, h, -1, -1
    for i in range(w * h):
        if px[i*4+3] > ALPHA_ON:
            x, y = i % w, i // w
            if x < x0: x0 = x
            if x > x1: x1 = x
            if y < y0: y0 = y
            if y > y1: y1 = y
    return (x0, y0, x1, y1) if x1 >= 0 else None


def refit(rider, oldbase, newpath):
    """Move a rider extracted against one drawing of an animal onto a different drawing of it.

    WHY THIS IS NEEDED. Three archetypes -- dragon, roc, wolf -- had their art regenerated at a
    larger canvas to fix wings that ran off the frame, so the object the game draws is no longer the
    object the ridden state was made from. Asking PixelLab for a fresh state on the NEW object does
    not help: it re-renders the animal rather than overlaying it (the wolf came back black and a size
    larger), so there is nothing clean to subtract.

    The original object still has a state that subtracts perfectly, and the two drawings are the same
    ANIMAL. So the rider is placed by where he sits ON the animal rather than by canvas coordinates:
    his position is taken as a fraction of the animal's opaque box -- sideways from its centre line,
    upwards from its feet -- and re-applied to the new box, scaled by the ratio of the two box
    heights so he stays the same size relative to the beast he is sitting on.
    """
    ow, oh, op = oldbase
    ob = bbox(op, ow, oh)
    ng = read_png_rgba(newpath)
    if not ob or not ng:
        return None, 'no box to fit against'
    nw, nh, np_ = ng
    nb = bbox(np_, nw, nh)
    if not nb:
        return None, 'new art is empty'
    ox0, oy0, ox1, oy1 = ob
    nx0, ny0, nx1, ny1 = nb
    obw, obh = ox1 - ox0 + 1, oy1 - oy0 + 1
    nbw, nbh = nx1 - nx0 + 1, ny1 - ny0 + 1
    # SAMPLE FROM THE DESTINATION, not the source. Walking the source and stamping k x k blocks
    # forces k to be a whole number, and the first version rounded 1.4 down to 1 -- the rider stayed
    # the size he was on a 68px canvas while the animal around him was drawn half again as large, so
    # he read as a lump of tack rather than a man. Going the other way -- for each destination pixel,
    # ask which source pixel belongs there -- handles a fractional ratio exactly.
    ocx = (ox0 + ox1) / 2.0
    ncx = (nx0 + nx1) / 2.0
    rw, rh, rp = rider
    pw, ph = nw + 2*PAD, nh + 2*PAD
    out = bytearray(pw * ph * 4)
    drawn = 0
    for Y in range(ph):
        fy = ((Y - PAD) - ny1) / float(nbh)      # upwards from the animal's feet, as a fraction
        sy = int(round(oy1 + fy * obh))
        if sy < 0 or sy >= rh:
            continue
        for X in range(pw):
            fx = ((X - PAD) - ncx) / float(nbw)  # sideways from its centre line, as a fraction
            sx = int(round(ocx + fx * obw))
            if sx < 0 or sx >= rw:
                continue
            o = (sy * rw + sx) * 4
            if rp[o+3] <= ALPHA_ON:
                continue
            out[(Y*pw + X)*4:(Y*pw + X)*4+4] = rp[o:o+4]
            drawn += 1
    if not drawn:
        return None, 'refit landed nothing on the canvas'
    return (pw, ph, out), 'refitted onto %dx%d (+%d margin) at x%.2f' % (pw, ph, PAD,
                                                                        float(nbh) / max(1, obh))


def top_run(got):
    """Longest contiguous opaque run along any border of an extracted rider."""
    w, h, px = got

    def run(seq):
        best = cur = 0
        for v in seq:
            cur = cur + 1 if v else 0
            if cur > best:
                best = cur
        return best
    return max(
        run([px[(0*w + x)*4+3] > ALPHA_ON for x in range(w)]),
        run([px[((h-1)*w + x)*4+3] > ALPHA_ON for x in range(w)]),
        run([px[(y*w + 0)*4+3] > ALPHA_ON for y in range(h)]),
        run([px[(y*w + (w-1))*4+3] > ALPHA_ON for y in range(h)]))


def borrow(arch, d, donor):
    """This direction's rider taken from another archetype and refitted onto this animal.

    The knight is the same knight on every mount, so when an archetype's own state does not show him
    -- because the animal is standing in front of him -- another archetype's view of the same
    direction is a better answer than nothing. The donor's layer is aligned to the donor's art, so
    it is remapped by the two animals' opaque boxes exactly the way --fit remaps a rider onto
    regenerated art: sideways as a fraction of the animal's width, upwards as a fraction of its
    height from the feet.
    """
    dl = os.path.join(ROOT, 'assets', 'riders', donor, 'knight', 'ride_%s.png' % d)
    dm = os.path.join(ROOT, 'assets', 'mounts', donor, 'idle_%s.png' % d)
    tm = os.path.join(ROOT, 'assets', 'mounts', arch, 'idle_%s.png' % d)
    if not (os.path.exists(dl) and os.path.exists(dm) and os.path.exists(tm)):
        return None, 'donor %s has no %s layer to borrow' % (donor, d)
    rid = read_png_rgba(dl)
    base = read_png_rgba(dm)
    if not rid or not base:
        return None, 'donor art unreadable'
    got, note = refit(rid, base, tm)
    if not got:
        return None, 'borrow from %s failed: %s' % (donor, note)
    return got, 'borrowed from %s (its own state hides the rider here)' % donor


def main(argv):
    if len(argv) < 4:
        print('usage: riderextract.py <arch> <base.zip|dir> <state.zip|dir> [--dry]')
        return 2
    arch, basesrc, statesrc = argv[1], argv[2], argv[3]
    dry = '--dry' in argv
    donor = argv[argv.index('--borrow') + 1] if '--borrow' in argv else None
    # --fit: the game's art for this archetype is a DIFFERENT drawing from the one the state was
    # made against, so put the extracted rider back onto it by where he sits on the animal
    fit = '--fit' in argv
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
        # visible, or merely present? a 19-pixel rider is extracted correctly and invisible in game
        if donor and got:
            vis = sum(1 for i in range(got[0]*got[1]) if got[2][i*4+3] > ALPHA_ON)
            cut = top_run(got)
            if vis < MIN_VISIBLE or cut > EDGE_CUT:
                got2, note2 = borrow(arch, d, donor)
                if got2:
                    why = ('%d px visible' % vis) if vis < MIN_VISIBLE else ('cut %dpx at a border' % cut)
                    got, note = got2, '%s -- %s' % (why, note2)
        if not got and donor:
            got2, note2 = borrow(arch, d, donor)
            if got2:
                got, note = got2, note + ' — ' + note2
        if got and fit:
            newpath = os.path.join(ROOT, 'assets', 'mounts', arch, 'idle_%s.png' % d)
            if os.path.exists(newpath):
                got2, note2 = refit(got, decode(brot[d]), newpath)
                if got2:
                    got, note = got2, note + ' · ' + note2
                else:
                    got, note = None, note + ' · ' + note2
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
