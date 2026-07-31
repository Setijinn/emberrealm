#!/usr/bin/env python
"""Measure every mount sprite for the two faults you can see on screen.

WHY A SCRIPT AND NOT AN AUDIT PAGE. Both faults live in the PNG's alpha channel, which python can
read directly and exactly. Doing it in the browser would mean drawing each one to a canvas and
calling getImageData 300 times to learn something the file already says.

WHAT IT LOOKS FOR
  CLIPPED     opaque pixels touching the canvas edge. PixelLab composes a subject inside a frame; if
              the subject runs off it, the animal is cut -- a muzzle that just ends, a tail sliced
              flat. Any edge with opaque pixels on it is reported with which edge and how many.
  SEE-THROUGH the fraction of the subject that is PARTLY transparent (0 < a < 250). HANDOFF already
              records that create_map_object returns ~67%-opaque bodies with a soft border; on a
              68-species roster nobody checked which ones came back that way. Above SOFT_BAD the
              ground shows through the animal.
  TINY        an opaque box far smaller than its canvas, which draws small and soft because
              mountDrawUnder scales it UP to MOUNT_DRAW_H.

    py tools/mountart.py                 every sprite, worst first
    py tools/mountart.py --bad           only the ones that fail
    py tools/mountart.py --csv           machine-readable, for a regeneration list
"""

import io
import os
import struct
import sys
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOUNTS = os.path.join(ROOT, 'assets', 'mounts')

SOFT_BAD = 0.22        # >22% of the subject partly transparent reads as see-through in game
EDGE_BAD = 3           # opaque pixels on an edge; 1-2 can be a legitimate touch
FILL_MIN = 0.18        # opaque area below 18% of the canvas draws soft when scaled up


def read_png_rgba(path):
    """Decode a PNG to (w, h, bytes RGBA). Handles the colour types PixelLab emits (6 and 2)."""
    d = io.open(path, 'rb').read()
    if d[:8] != b'\x89PNG\r\n\x1a\n':
        return None
    pos, idat, w, h, bd, ct, plte, trns = 8, [], 0, 0, 8, 6, None, None
    while pos < len(d):
        ln = struct.unpack('>I', d[pos:pos+4])[0]
        typ = d[pos+4:pos+8]
        body = d[pos+8:pos+8+ln]
        if typ == b'IHDR':
            w, h, bd, ct = struct.unpack('>IIBB', body[:10])
        elif typ == b'PLTE':
            plte = body
        elif typ == b'tRNS':
            trns = body
        elif typ == b'IDAT':
            idat.append(body)
        elif typ == b'IEND':
            break
        pos += 12 + ln
    if bd != 8:
        return None
    raw = zlib.decompress(b''.join(idat))
    chans = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}.get(ct)
    if not chans:
        return None
    stride = w * chans
    out = bytearray(w * h * 4)
    prev = bytearray(stride)
    p = 0
    for y in range(h):
        f = raw[p]; p += 1
        line = bytearray(raw[p:p+stride]); p += stride
        # undo the per-line filter
        for i in range(stride):
            a = line[i-chans] if i >= chans else 0
            b = prev[i]
            c = prev[i-chans] if i >= chans else 0
            x = line[i]
            if f == 1: x = (x + a) & 255
            elif f == 2: x = (x + b) & 255
            elif f == 3: x = (x + ((a + b) >> 1)) & 255
            elif f == 4:
                pp = a + b - c
                pa, pb, pc = abs(pp-a), abs(pp-b), abs(pp-c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                x = (x + pr) & 255
            line[i] = x
        prev = line
        for x in range(w):
            o = (y*w + x) * 4
            if ct == 6:
                out[o:o+4] = line[x*4:x*4+4]
            elif ct == 2:
                out[o:o+3] = line[x*3:x*3+3]; out[o+3] = 255
            elif ct == 3:
                idx = line[x]
                if plte: out[o:o+3] = plte[idx*3:idx*3+3]
                out[o+3] = trns[idx] if (trns and idx < len(trns)) else 255
            elif ct == 4:
                g = line[x*2]; out[o] = out[o+1] = out[o+2] = g; out[o+3] = line[x*2+1]
            else:
                g = line[x]; out[o] = out[o+1] = out[o+2] = g; out[o+3] = 255
    return w, h, bytes(out)


def measure(path):
    got = read_png_rgba(path)
    if not got:
        return None
    w, h, px = got
    opaque = soft = 0
    minx, maxx, miny, maxy = w, -1, h, -1
    edges = {'top': 0, 'bottom': 0, 'left': 0, 'right': 0}
    for y in range(h):
        for x in range(w):
            a = px[(y*w + x)*4 + 3]
            if a < 8:
                continue
            opaque += 1
            if a < 250:
                soft += 1
            if x < minx: minx = x
            if x > maxx: maxx = x
            if y < miny: miny = y
            if y > maxy: maxy = y
            if a >= 250:
                if y == 0: edges['top'] += 1
                if y == h-1: edges['bottom'] += 1
                if x == 0: edges['left'] += 1
                if x == w-1: edges['right'] += 1
    if opaque == 0:
        return {'w': w, 'h': h, 'empty': True}
    return {'w': w, 'h': h, 'empty': False,
            'opaque': opaque, 'soft': soft, 'softFrac': soft/float(opaque),
            'fill': opaque/float(w*h),
            'bbox': (minx, miny, maxx, maxy),
            'edges': edges, 'clipped': sum(1 for k in edges if edges[k] >= EDGE_BAD)}


def walk():
    out = []
    for dirpath, _dirs, files in os.walk(MOUNTS):
        _dirs[:] = [d for d in _dirs if d != '_old']   # replaced sets are kept on disk, not measured
        for f in files:
            if f.lower().endswith('.png'):
                out.append(os.path.join(dirpath, f))
    return sorted(out)


def main():
    only_bad = '--bad' in sys.argv
    as_csv = '--csv' in sys.argv
    files = walk()
    rows = []
    for path in files:
        m = measure(path)
        if not m:
            continue
        rel = os.path.relpath(path, ROOT).replace('\\', '/')
        if m['empty']:
            rows.append((99.0, rel, 'EMPTY — nothing opaque in the file'))
            continue
        why = []
        if m['softFrac'] > SOFT_BAD:
            why.append('SEE-THROUGH %.0f%% of the subject is partly transparent' % (100*m['softFrac']))
        if m['clipped']:
            e = ', '.join('%s:%d' % (k, v) for k, v in m['edges'].items() if v >= EDGE_BAD)
            why.append('CLIPPED opaque pixels on the canvas edge (%s)' % e)
        if m['fill'] < FILL_MIN:
            why.append('TINY subject fills only %.0f%% of its canvas' % (100*m['fill']))
        score = m['softFrac'] + m['clipped'] + (0.5 if m['fill'] < FILL_MIN else 0)
        rows.append((score, rel, '; '.join(why) if why else 'ok'))
    rows.sort(key=lambda r: -r[0])
    bad = [r for r in rows if r[2] != 'ok']

    if as_csv:
        for _s, rel, why in rows:
            print('%s\t%s' % (rel, why))
        return

    print('%d mount sprites scanned' % len(rows))
    print('%d have something wrong' % len(bad))
    print('')
    for _s, rel, why in (bad if only_bad else rows):
        print('%-58s %s' % (rel, why))


if __name__ == '__main__':
    main()
