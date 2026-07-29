#!/usr/bin/env python
"""
Download the forge's PixelLab art and install it into assets/items/.

The job ids are recorded here so the batch is reproducible and so anyone can see
which prompt produced which material without digging through a chat log. The
download endpoint is no-auth; a single-frame job returns a PNG directly, a
multi-frame one returns a zip (we take the first member).

Re-running is safe: anything already on disk is skipped unless --force.
"""

import io
import os
import sys
import time
import zipfile
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "items")
URL = "https://api.pixellab.ai/mcp/images/%s/download"

# material id -> pixellab job id.  seed/forge_ui are not materials:
#   mat_seed    is the shared Riftseed sprite, tinted per dungeon by GBOSS[ring].col
#   forge_ui    is the anvil plate at the top of the panel
#
# THIS IS THE SECOND BATCH (seeds 2001-2028). The first (1001-1028) drew these as what they
# literally are -- lumps of ore, a heap of ash, a chipped block of granite -- and they read as
# debris. They are the tree that ends in a T14 relic, so the whole set was redrawn as treasure:
# ornate gold work, inner light, "legendary artifact", detailed shading throughout, escalating from
# the raw island drops through the masterwork crafted rungs to the radiant rift reagents. The old
# ids are kept in git history rather than here; there is no reason to reinstall them.
JOBS = {
    # Five redraws (seeds 3001-3005). The majestic pass drifted off-subject on these: cinder came
    # back as a coin with a dragon on it, gatestone grew a feather and collided with pinion,
    # truecore read as a ring like gravebind, and rememberash came back as ice. Fixed the way the
    # handoff says negatives have to be fixed -- said three ways at once and stated in the positive
    # ("NO coin, NO medallion, just one armour scale"), because a bare negative is unreliable.
    "cinder":      "443b319a-13ad-4339-8365-a31b4a5764a6",
    "bogiron":     "6dbcf756-b602-46d7-be4c-2c4ad1ba0b30",
    "sap":         "630277bf-5a3c-4f5d-9ff6-60b8ae91ddf9",
    "glass":       "b74ba4c7-e320-455e-b877-619f81694537",
    "salt":        "0a443ad5-767b-497e-a8bf-46e56ac3795f",
    "drakeash":    "f80695ae-dc98-430d-938d-5b1b5c743aa6",
    "emberalloy":  "9f5cd247-7f10-4433-9a13-2464f1704563",
    "quench":      "9c2e9d56-8242-4f19-b322-8d587d89e455",
    "flux":        "3c38cde8-3743-4427-b1a6-d9a5206460cb",
    "stormsteel":  "4606005b-aa27-4913-8595-020abc0f0095",
    "gravebind":   "e0497313-8f1a-4802-bc7d-1cd344937593",
    "drakeflux":   "40c75094-a309-4677-b0c4-79d19ab9edb3",
    "truecore":    "d27516b8-112e-473f-b623-5f6b0ccfcbc9",
    "forgeheart":  "73368e1c-d3c8-4ef3-adc3-c8d531580f52",
    "riftcore":    "02b75c68-a3c8-450a-856d-60895ca103c8",
    "riftbloom":   "718008b0-faf2-4019-a4d9-de779cbca2e6",
    "riftheart":   "f8cd3115-2c22-4989-8ab4-cf988f2fa14f",
    "anchorroot":  "26bf7001-f5e2-4354-8d69-e0b1875d9523",
    "veilshard":   "50f258ea-e800-402d-8e0c-c69b27db0237",
    "wallrot":     "3684028d-1d0c-4a2f-9e97-364896309ca0",
    "gatestone":   "3fd601de-a397-455a-877d-25524880f21a",
    "pinion":      "5bc8517a-2904-4040-a088-e774f5c6225e",
    "clinker":     "b32efec8-053a-4068-ac32-927d4df407af",
    "rememberash": "78ba61c3-6aea-4c52-9981-9aede6a33c1b",
    "firstcinder": "f87f6640-63a7-4af5-a4a6-9f86d18043da",
    "titanheart":  "f9cb52b8-e2c8-4078-bb3f-f0e4c22b5237",
    "seed":        "c821c023-c88e-4563-a8dc-368f1f5b3210",
}
UI_JOBS = {
    "forge_ui":    "ac0a47c6-43d5-4f58-8cb2-f9a82c1cbe32",
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
    force = "--force" in sys.argv
    if not os.path.isdir(OUT):
        sys.exit("no %s" % OUT)
    todo = [("mat_%s" % k, v) for k, v in sorted(JOBS.items())]
    todo += [(k, v) for k, v in sorted(UI_JOBS.items())]
    got = skipped = 0
    for name, job in todo:
        path = os.path.join(OUT, name + ".png")
        if os.path.exists(path) and not force:
            skipped += 1
            continue
        blob = as_png(fetch(job))
        with open(path, "wb") as f:
            f.write(blob)
        got += 1
        print("  %-22s %6d bytes" % (name + ".png", len(blob)))
    print("installed %d, skipped %d (already present)" % (got, skipped))


if __name__ == "__main__":
    main()
