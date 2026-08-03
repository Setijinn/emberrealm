#!/usr/bin/env python
"""Index every sprite in assets/ for the gallery page.

WHY A SECOND INDEX rather than reusing _spritelab_index.json. That one is built for the lab and is
deliberately partial: it hides derived art (so you cannot derive from a derivation), skips fonts and
the scratch folders, and splits directories into "animated sets" and "single sprites" because that is
the distinction the lab's picker needs. A gallery wants the opposite -- everything, in the folders it
actually lives in, including the derived families, because "what does this project own" is the whole
question it answers.

Generated and gitignored like the lab's, EXCEPT that it is committed for the same reason the lab's is:
the page is served from Pages, a static host has nothing to run, and an ignored index means the
hosted gallery is empty. Re-run it whenever art moves.

    py tools/gallery.py
    -> _sprites_index.json, and http://127.0.0.1:10500/_sprites.html
"""

import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
OUT = os.path.join(ROOT, "_sprites_index.json")

# Fonts are not sprites; `orig` holds the pre-repaint terrain backups. Everything else is fair game,
# including _old/_pending/_composites -- if it is on disk it is part of the answer.
SKIP = {"font", "orig"}


def build():
    groups = []
    total = 0
    for cur, subs, names in os.walk(ASSETS):
        subs[:] = sorted(s for s in subs if s not in SKIP)
        pngs = sorted(n for n in names if n.lower().endswith(".png"))
        if not pngs:
            continue
        rel = os.path.relpath(cur, ROOT).replace("\\", "/")
        bytes_ = sum(os.path.getsize(os.path.join(cur, n)) for n in pngs)
        groups.append({"path": rel, "files": pngs, "bytes": bytes_})
        total += len(pngs)
    groups.sort(key=lambda g: g["path"])
    return {"groups": groups, "total": total}


def main():
    idx = build()
    with io.open(OUT, "w", encoding="utf-8") as f:
        json.dump(idx, f, separators=(",", ":"))
        f.write("\n")
    mb = sum(g["bytes"] for g in idx["groups"]) / 1048576.0
    print("wrote %s" % os.path.basename(OUT))
    print("  %d sprites in %d folders, %.1f MB" % (idx["total"], len(idx["groups"]), mb))
    print("  %.0f KB index" % (os.path.getsize(OUT) / 1024.0))
    print()
    print("  http://127.0.0.1:10500/_sprites.html")
    print("  https://setijinn.github.io/emberrealm/_sprites.html  (once pushed)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
