"""LEARN each archetype's seat height from a rider composite, per direction.

The problem this solves: one seat number cannot describe a horse's back, a moth that is mostly
wing, a sky wyrm that is a coil, and a dragon whose neck rises in front of its shoulders. And
guessing from the sprite fails too -- scanning the central slice for the topmost opaque row finds
a BACK on a side view and finds the EARS on a horse facing north.

So we do not guess. PixelLab already knows where a rider goes: ask it to put one on, subtract the
riderless source, and MEASURE where the rider's backside ended up. That number is the seat.

    seat = (mount_foot_row - rider_bottom_row) / mount_height        # fraction, up from the feet

Emits a JS table ready to paste into 17k_mounts.js.

Usage: calibrate_seats.py <arch> <composite_id> [<arch> <composite_id> ...]
"""
import io, json, os, sys, urllib.request, zipfile
from PIL import Image, ImageChops, ImageFilter

MANIFEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mount_objects.json")
DIRMAP = {"north": "n", "north-east": "ne", "east": "e", "south-east": "se",
          "south": "s", "south-west": "sw", "west": "w", "north-west": "nw"}
THRESH = 28


def zget(oid):
    req = urllib.request.Request("https://api.pixellab.ai/mcp/objects/%s/download" % oid,
                                 headers={"User-Agent": "emberrealm-qa"})
    return zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(req, timeout=180).read()))


def rider_mask(base, comp):
    """Same union mask the extractor uses: colour change OR newly-opaque."""
    d = ImageChops.difference(base.convert("RGB"), comp.convert("RGB")).convert("L")
    changed = d.point(lambda v: 255 if v > THRESH else 0)
    grew = ImageChops.subtract(comp.getchannel("A"), base.getchannel("A")).point(lambda v: 255 if v > 40 else 0)
    m = ImageChops.lighter(changed, grew)
    # drop specks before measuring, or one stray pixel decides the seat
    return m.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))


def _lowest_dense_row(mask, min_px=3):
    """Lowest row holding at least `min_px` set pixels — the rider's real lower edge, not a speck."""
    w, h = mask.size
    px = mask.load()
    for y in range(h - 1, -1, -1):
        n = 0
        for x in range(w):
            if px[x, y] > 0:
                n += 1
                if n >= min_px:
                    return y
    return None


def calibrate(arch, comp_id, base_id):
    zc, zb = zget(comp_id), zget(base_id)
    seats = {}
    for long, short in DIRMAP.items():
        n = "rotations/%s.png" % long
        if n not in zc.namelist() or n not in zb.namelist():
            continue
        a = Image.open(io.BytesIO(zb.read(n))).convert("RGBA")
        b = Image.open(io.BytesIO(zc.read(n))).convert("RGBA")
        if a.size != b.size:
            continue
        ab = a.getbbox()
        if not ab:
            continue
        mount_foot, mount_h = ab[3] - 1, ab[3] - ab[1]
        m = rider_mask(a, b)
        mb = m.getbbox()
        if not mb:
            continue
        # NOT the bounding box. A handful of stray pixels survive under the animal -- regeneration
        # noise around its feet -- and the bbox bottom then reports THEM as the rider's lower edge:
        # measured on the horse, the clean directions all agreed on ~0.66 while the speckled ones
        # read 0.36. Scan up for the lowest row that actually has some rider IN it.
        rider_bottom = _lowest_dense_row(m, min_px=3)
        if rider_bottom is None:
            continue
        frac = (mount_foot - rider_bottom) / float(max(1, mount_h))
        # a seat below the feet or above the withers is a failed measurement, not a discovery
        if 0.15 <= frac <= 0.95:
            seats[short] = round(frac, 3)
    return seats


def main():
    man = json.load(open(MANIFEST))["archetypes"]
    args = sys.argv[1:]
    out = {}
    for i in range(0, len(args), 2):
        arch, comp = args[i], args[i + 1]
        base = man.get(arch)
        if not base:
            print("// %s: not in manifest" % arch); continue
        try:
            s = calibrate(arch, comp, base)
        except Exception as e:
            print("// %s: %s" % (arch, e)); continue
        if not s:
            print("// %s: no usable measurement" % arch); continue
        out[arch] = s
        vals = sorted(s.values())
        print("// %-14s %d dirs  range %.2f-%.2f  median %.2f"
              % (arch, len(s), vals[0], vals[-1], vals[len(vals) // 2]))

    if out:
        # THE MEDIAN, not the per-direction values. A saddle does not move when the animal turns,
        # so the eight readings are eight samples of ONE number -- and a couple of them are always
        # contaminated by regeneration speckle under the animal's feet (measured on the horse: six
        # directions agreed on 0.63-0.78, two read 0.36). The median throws those away for free,
        # where a per-direction table would bake them in.
        print("\n// --- paste into MOUNT_SEATS (17k_mounts.js) ---")
        for arch, s in out.items():
            key = arch.replace("arch_", "")
            v = sorted(s.values())
            med = v[len(v) // 2] if len(v) % 2 else (v[len(v) // 2 - 1] + v[len(v) // 2]) / 2.0
            spread = v[-1] - v[0]
            print("  %-10s {seat:%.2f},   // %d dirs, spread %.2f%s"
                  % (key + ":", med, len(v), spread,
                     "  <-- CHECK, wide spread" if spread > 0.30 else ""))


main()
