"""Extract a reusable RIDER LAYER by subtracting the riderless mount from a rider composite.

PixelLab's create_object_state regenerates the whole object, so the composite is not a literal
paste -- the mount pixels shift slightly. The diff is therefore thresholded rather than exact, and
then de-speckled: an 8-neighbour pass drops isolated survivors, which is what removes the scatter
of stray pixels the raw threshold leaves around the animal's outline.

Output: assets/riders/<cls>/ride_<d>.png  for d in n ne e se s sw w nw

Usage: extract_riders.py <cls> <composite_object_id> [base_object_id]
"""
import io, os, sys, urllib.request, zipfile
from PIL import Image, ImageChops, ImageFilter

DEST = r"C:\Users\darkc\Desktop\EmberRealm\emberrealm-src\assets\riders"
BASE_DEFAULT = "781257a0-1fff-4dff-a134-8ef549db12fa"      # the riderless horse
DIRMAP = {"north": "n", "north-east": "ne", "east": "e", "south-east": "se",
          "south": "s", "south-west": "sw", "west": "w", "north-west": "nw"}
THRESH = 28          # per-channel difference that counts as "this pixel changed"
MIN_NEIGHBOURS = 2   # a kept pixel needs this many kept neighbours, or it is speckle


def zget(oid):
    req = urllib.request.Request("https://api.pixellab.ai/mcp/objects/%s/download" % oid,
                                 headers={"User-Agent": "emberrealm-qa"})
    return zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(req, timeout=180).read()))


def largest_cc(mask):
    """Keep only the biggest blob.

    A strong morphological close recovers the rider's body but also pulls in pieces of the animal.
    Those pieces are overwhelmingly DETACHED from him -- a mane, an ear, a loop of rein -- so
    component size separates rider from contamination without needing to know either's colour.
    (Fragments that touch him survive; geometry cannot help there.)
    """
    from collections import deque
    w, h = mask.size
    px = mask.load()
    seen = [[False] * w for _ in range(h)]
    best = []
    for y in range(h):
        for x in range(w):
            if px[x, y] == 0 or seen[y][x]:
                continue
            comp = []
            q = deque([(x, y)])
            seen[y][x] = True
            while q:
                cx, cy = q.popleft()
                comp.append((cx, cy))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
                    xx, yy = cx + dx, cy + dy
                    if 0 <= xx < w and 0 <= yy < h and px[xx, yy] > 0 and not seen[yy][xx]:
                        seen[yy][xx] = True
                        q.append((xx, yy))
            if len(comp) > len(best):
                best = comp
    out = Image.new("L", (w, h), 0)
    op = out.load()
    for cx, cy in best:
        op[cx, cy] = 255
    return out


def fill_holes(mask):
    """Fill anything enclosed by the mask.

    Flood the OUTSIDE from the border; whatever the flood cannot reach is an interior hole and
    becomes solid. This is what stops the animal showing through gaps in the rider's armour --
    a hole surrounded entirely by knight is knight, whatever the colour test said about it.
    """
    w, h = mask.size
    px = mask.load()
    outside = [[False] * w for _ in range(h)]
    stack = []
    for x in range(w):
        for y in (0, h - 1):
            if px[x, y] == 0 and not outside[y][x]:
                outside[y][x] = True; stack.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if px[x, y] == 0 and not outside[y][x]:
                outside[y][x] = True; stack.append((x, y))
    while stack:
        x, y = stack.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            xx, yy = x + dx, y + dy
            if 0 <= xx < w and 0 <= yy < h and px[xx, yy] == 0 and not outside[yy][xx]:
                outside[yy][xx] = True; stack.append((xx, yy))
    out = mask.copy()
    op = out.load()
    for y in range(h):
        for x in range(w):
            if px[x, y] == 0 and not outside[y][x]:
                op[x, y] = 255
    return out


def despeckle(im):
    """Drop pixels with too few opaque neighbours. Two passes: stray dots, then the threads."""
    for _ in range(2):
        a = im.getchannel("A")
        w, h = im.size
        px = a.load()
        keep = Image.new("L", (w, h), 0)
        kp = keep.load()
        for y in range(h):
            for x in range(w):
                if px[x, y] == 0:
                    continue
                n = 0
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        if dx == 0 and dy == 0:
                            continue
                        xx, yy = x + dx, y + dy
                        if 0 <= xx < w and 0 <= yy < h and px[xx, yy] > 0:
                            n += 1
                if n >= MIN_NEIGHBOURS:
                    kp[x, y] = 255
        im = im.copy()
        im.putalpha(ImageChops.multiply(a, keep))
    return im


def main():
    cls = sys.argv[1]
    comp = sys.argv[2]
    base = sys.argv[3] if len(sys.argv) > 3 else BASE_DEFAULT
    zc, zb = zget(comp), zget(base)
    out = os.path.join(DEST, cls)
    os.makedirs(out, exist_ok=True)
    made = []
    for long, short in DIRMAP.items():
        n = "rotations/%s.png" % long
        if n not in zc.namelist() or n not in zb.namelist():
            continue
        a = Image.open(io.BytesIO(zb.read(n))).convert("RGBA")
        b = Image.open(io.BytesIO(zc.read(n))).convert("RGBA")
        if a.size != b.size:
            print("  size mismatch on", long)
            continue
        # TWO SOURCES OF EVIDENCE, unioned. A pure colour-difference mask drops every rider pixel
        # that happens to match the animal underneath it -- which is why the first pass produced a
        # knight full of holes. The stronger signal is GEOMETRY: anywhere the composite is opaque
        # and the riderless source was transparent is unambiguously new, and that recovers the
        # silhouette regardless of colour.
        d = ImageChops.difference(a.convert("RGB"), b.convert("RGB")).convert("L")
        changed = d.point(lambda v: 255 if v > THRESH else 0)
        grew = ImageChops.subtract(b.getchannel("A"), a.getchannel("A")).point(lambda v: 255 if v > 40 else 0)
        mask = ImageChops.lighter(changed, grew)
        # Close one-pixel gaps so the armour reads solid rather than stippled: a hole surrounded on
        # most sides by kept pixels was almost certainly a colour coincidence, not background.
        # CLOSE HARD, then keep one blob. A radius-1 close left the knight with no arms and
        # spindly legs: where his dark armour lies over the horse's dark shading the colours match
        # and the diff throws those pixels away. Radius 3 recovers the body -- and drags in
        # fragments of the animal, which are almost all DETACHED (head, mane, reins), so keeping
        # only the largest connected component removes them.
        mask = mask.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(5))
        mask = largest_cc(mask)
        mask = fill_holes(mask)      # NOTHING of the mount may show through the rider
        rider = b.copy()
        rider.putalpha(ImageChops.multiply(b.getchannel("A"), mask))
        rider = despeckle(rider)
        # HARD ALPHA. A partially transparent rider pixel lets the animal underneath bleed through
        # it, which is exactly the "mount showing through the knight" artefact. Every surviving
        # pixel is fully opaque or fully gone -- and pixel art has no business with soft edges.
        rider.putalpha(rider.getchannel("A").point(lambda v: 255 if v > 96 else 0))
        kept = sum(1 for p in rider.getdata() if p[3] > 0)
        p = os.path.join(out, "ride_%s.png" % short)
        t = p + ".tmp"
        rider.save(t, "PNG")          # explicit: PIL cannot infer a format from a .tmp name
        os.replace(t, p)
        made.append("%s:%d" % (short, kept))
    print("%-10s %d dirs  [%s]" % (cls, len(made), " ".join(made)))


main()
