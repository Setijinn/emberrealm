#!/usr/bin/env python
"""
Download the twelve Scavenged Dreams reagent sprites and install them into assets/items/.

Same contract as install_forge_art.py -- the job ids live here so the batch is reproducible and so
anyone can see which prompt produced which reagent without digging through a chat log, and re-running
is safe because anything already on disk is skipped unless --force.

ONE DIFFERENCE THAT MATTERS: these were made with create_map_object, not create_image, so they come
off a DIFFERENT endpoint -- /mcp/map-objects/<id>/download rather than /mcp/images/<id>/download.
Using the images URL returns 404 for every one of them, which looks exactly like "the job is still
running" and will happily retry for five minutes before giving up.

AND THEY EXPIRE. A map object auto-deletes eight hours after it is created, so this script is only
good until then; after that the ids are a record of what was asked for, not something to re-fetch.
The PNGs on disk are the artifact.
"""

import io
import os
import sys
import time
import zipfile
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "items")
URL = "https://api.pixellab.ai/mcp/map-objects/%s/download"

# reagent id -> pixellab object id.
#
# THE STYLE BRIEF, so a redraw does not have to rediscover it: these are the RAREST things in the
# game and they sit above the relic gold, so every one is "ornate legendary artifact, magenta-pink
# inner light, radiant" -- SD_COL's own colour family -- at high detail with detailed shading, 64x64,
# high top-down. Each names the PART it becomes rather than the finished item, because the whole point
# of the twelve is that a reagent tells you what it makes.
#
# Written the way HANDOFF.md says PixelLab negatives have to be written: stated in the POSITIVE and
# repeated, because a bare "no handle" is unreliable on its own -- "the bare narrow tang, a slim
# pointed shank with no handle and no grip ... NO handle, NO hilt".
# FIVE OF THE TWELVE ARE SECOND OR THIRD TAKES, and every one of those failures was invisible until
# the set was tiled into one image (tools/../_shots/sd_contact.png). Individually each looked fine.
# That is HANDOFF's contact-sheet rule earning itself again, so the reasons are kept here:
#   tang    came back a COMPLETE SWORD, twice, through negatives stated three ways. A tang IS
#           sword-shaped, so no prompt was going to move it -- the fix was to change the SUBJECT to a
#           FANG, which still means "dagger" and has a silhouette nothing can confuse for a sword.
#           The material's display name changed with it: "Silent Tang" -> "Whisper Fang".
#   sliver  came back a cartoon FLAME, and orange -- wrong subject and off-palette. Fixed by insisting
#           on a SOLID cold shard of char ("stone-hard", "lying still", "NOT burning").
#   blank   read as a framed MIRROR or a window. Fixed with "SOLID METAL all the way through" and
#           "NO frame, NO glass, NO reflection".
#   stave   collided with `bough` -- both brown branches side by side. Fixed by making the stave a
#           MANUFACTURED bow limb: "sanded smooth and lacquered", "NO bark, NO twigs".
#   hide    was brown and carried no dream light, so it did not read as an SD reagent at all.
JOBS = {
    "sd_billet":  "91a962ae-4dff-4120-9901-beecf8b26f81",   # forged bar, sword blade length
    "sd_tang":    "0e851075-9361-4169-9c1a-b15b4fbb4655",   # 3rd take: a FANG, not a tang
    "sd_stave":   "e13e2ac3-4e93-44c7-b592-ed29ee3d514a",   # 2nd take: polished bow limb, no bark
    "sd_spring":  "f5320280-8d71-44de-b3d4-84e853019911",   # coiled crossbow spring
    "sd_bough":   "da7383db-9e3c-4038-ac0b-9fcc062d3028",   # forked branch, no leaves
    "sd_sliver":  "166fbac2-03b5-402c-808e-07aabdb79529",   # 2nd take: solid char shard, not flame
    "sd_knuckle": "a3a806ea-7d68-4d25-ab37-880d0288f01c",   # gauntlet knuckle plate, no hand
    "sd_blank":   "5f282be4-1efb-4f34-8e20-4c8256d30804",   # 2nd take: solid slab, not a mirror
    "sd_hide":    "8b8f4dba-37a9-46d3-b341-ab14d94ed626",   # 2nd take: black hide with dream light
    "sd_bolt":    "07af695b-1d65-47a4-b81b-6e3981220023",   # rolled bolt of silk
    "sd_circlet": "0dd4f157-791e-44a0-b327-d7771f3538f1",   # thin head-band circlet, no head
    "sd_bead":    "00010808-3f48-4dc0-bf76-455bcc36b169",   # single drilled glass bead
}


def fetch(job_id, tries=40, wait=8):
    """The endpoint 423s (or 404s) while the job is still running. Wait it out."""
    last = None
    for _ in range(tries):
        try:
            with urllib.request.urlopen(URL % job_id, timeout=60) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001 - any transport hiccup is worth retrying
            last = e
            time.sleep(wait)
    raise RuntimeError("gave up on %s: %s" % (job_id, last))


def as_png(blob):
    if blob[:8] == b"\x89PNG\r\n\x1a\n":
        return blob
    if blob[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(blob)) as z:
            names = [n for n in z.namelist() if n.lower().endswith(".png")]
            if not names:
                raise RuntimeError("zip held no png: %s" % z.namelist())
            return z.read(sorted(names)[0])
    raise RuntimeError("not a png or a zip (first bytes %r)" % blob[:8])


def main():
    sys.stdout.reconfigure(encoding="utf-8")   # cp1252 cannot encode this project's report glyphs
    force = "--force" in sys.argv
    if not os.path.isdir(OUT):
        sys.exit("no %s" % OUT)
    got = skipped = failed = 0
    for name, job in sorted(JOBS.items()):
        path = os.path.join(OUT, "mat_" + name + ".png")
        if os.path.exists(path) and not force:
            skipped += 1
            continue
        try:
            blob = as_png(fetch(job))
        except Exception as e:  # noqa: BLE001 - report and keep going; one dud must not stop the batch
            print("  FAIL %-24s %s" % (name, e))
            failed += 1
            continue
        with open(path, "wb") as f:
            f.write(blob)
        got += 1
        print("  %-24s %6d bytes" % ("mat_" + name + ".png", len(blob)))
    print("installed %d, skipped %d, failed %d" % (got, skipped, failed))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
