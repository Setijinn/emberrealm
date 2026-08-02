#!/usr/bin/env python
"""Build the source index for the Sprite Lab and open it.

WHAT THE LAB IS. A live editor for spritegen recipes: pick any sprite already in assets/, stack ops
on it, watch the result beside the source at whatever zoom, scrub or play an animated set, and copy
out the recipe JSON when it looks right. It exists because spritegen's dials are not guessable --
ramp.mix at 0.45 barely reads and at 0.75 flattens the accent trim that carries a creature's
identity, and the only way to know which you have is to look. That loop used to be edit JSON, run
the tool, open a contact sheet, repeat.

WHY THE INDEX IS GENERATED AND NOT COMMITTED. The lab is a static page and a static page cannot list
a directory, so it needs a manifest of what art exists. Committing one would mean committing a list
that goes stale the moment anyone adds a sprite, and stale in the quiet way -- the lab would simply
not offer the new art, with no error. Same rule as _lab.html and _selftest.html: generated from the
real thing on every run, gitignored, cannot drift.

DERIVED ART IS EXCLUDED from the index. Everything spritegen has already written is listed in
assets/_derived.json, and offering those as sources invites deriving from a derivation -- two ramps
in sequence give a muddy result that is very hard to diagnose later, because the file looks like a
normal source.

    py tools/serve.py                 # in another shell, or nothing loads
    py tools/spritelab.py             # write the index, print the URL
    py tools/spritelab.py --open      # ...and open the browser at it

Like tools/lab.py this one is NOT headless. It builds the page's data and gets out of the way.
Interpreter is Python312 by full path; `py` is broken on this machine.
"""

import io
import json
import os
import re
import sys
import webbrowser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
INDEX = os.path.join(ROOT, "_spritelab_index.json")
PORT = 10500
PAGE = "_spritelab.html"

# Folders with nothing a sprite recipe wants: fonts, and the scratch areas .gitignore already keeps
# out of the repo.
SKIP_DIRS = {"font", "orig", "_old", "_pending", "_composites"}
# WHAT COUNTS AS AN ANIMATED SET. Not "a directory with several PNGs in it" -- the first cut used
# that and called assets/mobs a single 91-frame animation, because it is a flat drawer of unrelated
# creatures that happens to be one folder. A set is a directory whose files are FRAMES, and the way
# to tell is the naming the loaders in 08c_embersprites.js already probe for. Everything else is a
# drawer, and its contents are offered one sprite at a time.
FRAME_RE = re.compile(r"^(idle|walk|attack|ride)(_[nsew]{1,2})?(_\d+)?\.png$", re.I)
SET_SHARE = 0.6            # this much of a folder must look like frames before it is called a set


def derived_paths():
    p = os.path.join(ASSETS, "_derived.json")
    if not os.path.exists(p):
        return set(), set()
    with io.open(p, encoding="utf-8") as f:
        man = json.load(f)
    files, dirs = set(), set()
    for ent in man.get("sets", {}).values():
        for rel in ent.get("files", []):
            files.add(rel.replace("\\", "/"))
        dirs.add(ent.get("to", "").replace("\\", "/"))
    return files, dirs


def build_index():
    dfiles, ddirs = derived_paths()
    dirs, files = [], []
    for cur, subs, names in os.walk(ASSETS):
        subs[:] = [s for s in subs if s not in SKIP_DIRS]
        rel = os.path.relpath(cur, ROOT).replace("\\", "/")
        if rel in ddirs:
            continue
        pngs = sorted(n for n in names if n.lower().endswith(".png"))
        pngs = [n for n in pngs if "%s/%s" % (rel, n) not in dfiles]
        if not pngs:
            continue
        framey = sum(1 for n in pngs if FRAME_RE.match(n))
        if len(pngs) > 1 and framey >= SET_SHARE * len(pngs):
            dirs.append({"path": rel, "frames": pngs})
        else:
            files += ["%s/%s" % (rel, n) for n in pngs]
    # Loose single sprites live in the big flat folders (assets/mobs, assets/items, ...) and there are
    # hundreds; a directory that is a real animation set is the more useful thing to show first, and
    # both lists are sorted so the picker is stable between runs.
    dirs.sort(key=lambda d: d["path"])
    files.sort()
    return {"dirs": dirs, "files": files}


def main():
    idx = build_index()
    with io.open(INDEX, "w", encoding="utf-8") as f:
        json.dump(idx, f, indent=1)
        f.write("\n")
    nfr = sum(len(d["frames"]) for d in idx["dirs"])
    print("wrote %s" % os.path.basename(INDEX))
    print("  %d animated set(s), %d frames" % (len(idx["dirs"]), nfr))
    print("  %d single sprite(s)" % len(idx["files"]))
    # 127.0.0.1, NOT localhost: serve.py binds the IPv4 loopback only, and a browser that resolves
    # `localhost` to ::1 first gets connection-refused on a server that is running perfectly.
    url = "http://127.0.0.1:%d/%s" % (PORT, PAGE)
    print()
    print(url)
    print()
    print("  PRESETS   the shipped element chains, so the lab starts where the art is")
    print("  PROBE     the source's hue histogram -- two bands is why the elements are ramps")
    print("  NAMING    to / variant / rename, with the resulting filenames listed live")
    print("  RECIPE    paste into tools/sprite_recipes.json, then")
    print("            python tools/spritegen.py <name> --sheet")
    print()
    print("  Every op in the lab is a port of the op of the same name in spritegen.py -- what you")
    print("  see IS what the tool writes. Edit one, edit both.")
    if "--open" in sys.argv:
        webbrowser.open(url)
    return 0


if __name__ == "__main__":
    sys.exit(main())
