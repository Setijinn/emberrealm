#!/usr/bin/env python
"""
Render a panel and save a PNG of it.

WHY THIS EXISTS. The browser extension available here is attached to a Chrome that is not on this
machine, so it cannot reach this machine's dev server -- every navigation to localhost lands on
Chrome's network error page. Headless Chrome on this box can, and --screenshot gives real rendered
pixels, which is the only way to actually LOOK at a panel before shipping it.

    py tools/shot.py forge 1280 900
    py tools/shot.py dev   390 844  levels
    py tools/shot.py map   980 700  map  dens=all

Anything after the tab is passed through to the page as extra query args, which is how a shot asks
for world state it would otherwise have to be earned in-game (every lair gate open, say).

Writes to _shots/<name>.png.
"""

import io
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "_shots")
PORT = 10500

CHROMES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
    "/usr/bin/google-chrome",
]

INJECT = '<script defer src="_shot.js"></script>\n'


def build():
    with io.open(os.path.join(ROOT, "index.html"), encoding="utf-8") as f:
        html = f.read()
    out = html.replace("</body>", INJECT + "</body>")
    path = os.path.join(ROOT, "_shot.html")
    with io.open(path, "w", encoding="utf-8") as f:
        f.write(out)
    return path


def chrome():
    for p in CHROMES:
        if os.path.exists(p):
            return p
    sys.exit("no Chrome found")


def shoot(what, w, h, tab, extra=()):
    if not os.path.isdir(OUT):
        os.makedirs(OUT)
    name = "%s_%s_%dx%d" % (what, tab, w, h)
    dest = os.path.join(OUT, name + ".png")
    # 127.0.0.1, NOT localhost: serve.py binds 127.0.0.1 explicitly, and Chrome resolves localhost
    # to ::1 first, which nothing is listening on -- it lands on the network error page.
    url = "http://127.0.0.1:%d/_shot.html?shot=%s&tab=%s" % (PORT, what, tab)
    for kv in extra:
        url += "&" + kv
    # A FRESH PROFILE EVERY RUN. A reused profile keeps Chrome's own HTTP cache, and the thing this
    # tool exists to photograph is CSS -- so a stale stylesheet would be rendered faithfully and the
    # screenshot would be a picture of the previous edit. serve.py sends no-store, but the cheap
    # guarantee is to not have a cache at all. This is the same trap as the old fresh-port ritual,
    # wearing a different hat.
    profile = tempfile.mkdtemp(prefix="emberrealm_shot_")
    cmd = [
        chrome(), "--headless=new", "--disable-gpu",
        "--user-data-dir=" + profile,
        "--hide-scrollbars",
        "--force-device-scale-factor=2",     # retina-ish, so pixel art is legible in the PNG
        "--window-size=%d,%d" % (w, h),
        "--virtual-time-budget=25000",
        "--screenshot=" + dest,
        url,
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if not os.path.exists(dest):
        sys.exit("no screenshot written -- is tools/serve.py running?")
    print("%s  (%d bytes)" % (dest, os.path.getsize(dest)))
    return dest


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "forge"
    w = int(sys.argv[2]) if len(sys.argv) > 2 else 1280
    h = int(sys.argv[3]) if len(sys.argv) > 3 else 900
    tab = sys.argv[4] if len(sys.argv) > 4 else what
    extra = sys.argv[5:]
    build()
    shoot(what, w, h, tab, extra)
