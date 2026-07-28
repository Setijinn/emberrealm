"""Download completed PixelLab 8-direction mount objects and install them into the game's layout.

PixelLab archive:
    rotations/<long-dir>.png
    animations/<slugified description>/<long-dir>/frame_NNN.png

Game layout (17k_mounts.js: mountFrameFor / _mountFrame):
    assets/mounts/<arch>/idle_<d>.png
    assets/mounts/<arch>/walk_<d>_<i>.png          d in n ne e se s sw w nw

Usage:  install_mounts.py [arch_name ...]      (default: every arch in the manifest)

Everything is built in memory and moved into place, and nothing is written unless the whole
archive parsed -- opening a target for writing first is what destroyed 11_ui.js once.
"""
import io, json, os, sys, urllib.request, urllib.error, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
MANIFEST = os.path.join(HERE, "mount_objects.json")
DEST_ROOT = r"C:\Users\darkc\Desktop\EmberRealm\emberrealm-src\assets\mounts"
URL = "https://api.pixellab.ai/mcp/objects/%s/download"

DIRMAP = {
    "north": "n", "north-east": "ne", "east": "e", "south-east": "se",
    "south": "s", "south-west": "sw", "west": "w", "north-west": "nw",
}
# Which animation slug becomes which game prefix; anything unmatched is skipped LOUDLY, which is
# how the wolf's "running_at_a_steady_lope" was caught -- the list had "loping" but the slug said
# "lope", and "running" was missing entirely. Match on short stems, not whole words.
# Both locomotion kinds land on the same `walk_` prefix on purpose: the game asks for "the moving
# frames", and whether the animal trots, lopes or beats its wings is the archetype's business.
#
# A FLYER'S WING-BEAT INSTALLS AS `idle_`, NOT `walk_`. Its resting state IS the flap -- it plays
# whether or not you are moving -- so the frames belong to the idle clip, and the renderer then
# prefers an animated idle over the static rotation. Checked BEFORE the locomotion list because
# "flapping wings" would otherwise be caught by nothing and "gliding forward" by neither.
ANIM_PREFIX = {"idle": ("idle", ("flap", "wing", "hover", "beat", "idle")),
               "walk": ("walk", ("walk", "trot", "gallop", "lope", "run", "stride",
                                 "pad", "march", "fly", "soar", "glide"))}
ANIM_ORDER = ["idle", "walk"]      # first match wins; order is the tie-break


def classify(slug):
    """Map a PixelLab animation folder name onto a game frame prefix.

    Ordered, not dict-order-dependent: a wing-beat must be tested before the locomotion list or
    "flying" would claim it as a walk cycle.
    """
    s = slug.lower()
    for key in ANIM_ORDER:
        prefix, words = ANIM_PREFIX[key]
        if any(w in s for w in words):
            return prefix
    return None


def install(name, oid):
    try:
        req = urllib.request.Request(URL % oid, headers={"User-Agent": "emberrealm-qa"})
        data = urllib.request.urlopen(req, timeout=180).read()
    except urllib.error.HTTPError as e:
        return "%-15s HTTP %s (not ready?)" % (name, e.code)
    except Exception as e:
        return "%-15s %s" % (name, e)
    if data[:2] != b"PK":
        return "%-15s not a zip yet (%d bytes)" % (name, len(data))

    z = zipfile.ZipFile(io.BytesIO(data))
    out = {}          # relative path -> bytes, built fully before anything touches disk
    anims = set()
    for n in z.namelist():
        parts = n.split("/")
        if parts[0] == "rotations" and n.endswith(".png"):
            d = DIRMAP.get(parts[1][:-4])
            if d:
                out["idle_%s.png" % d] = z.read(n)
        elif parts[0] == "animations" and len(parts) == 4 and n.endswith(".png"):
            slug, longdir, fname = parts[1], parts[2], parts[3]
            prefix = classify(slug)
            d = DIRMAP.get(longdir)
            if not prefix or not d:
                anims.add("SKIPPED:" + slug)
                continue
            anims.add(slug)
            try:
                idx = int(fname.replace("frame_", "").replace(".png", ""))
            except ValueError:
                continue
            out["%s_%s_%d.png" % (prefix, d, idx)] = z.read(n)

    if not out:
        return "%-15s archive had nothing usable" % name

    dest = os.path.join(DEST_ROOT, name)
    os.makedirs(dest, exist_ok=True)
    for rel, blob in out.items():
        p = os.path.join(dest, rel)
        t = p + ".tmp"
        with open(t, "wb") as f:
            f.write(blob)
        os.replace(t, p)

    idles = sum(1 for k in out if k.startswith("idle_"))
    walks = sum(1 for k in out if k.startswith("walk_"))
    return "%-15s %d idle + %d walk frames  [%s]" % (name, idles, walks, ", ".join(sorted(anims)) or "no anims")


def main():
    man = json.load(open(MANIFEST))["archetypes"]
    names = sys.argv[1:] or sorted(man)
    for nm in names:
        if nm not in man:
            print("%-15s not in manifest" % nm); continue
        print(install(nm, man[nm])); sys.stdout.flush()


main()
