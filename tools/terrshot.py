#!/usr/bin/env python
"""
Screenshot one overworld territory, headless.

WHY. "The terrain needs work" is a claim about what the ground LOOKS like, and this project's
stated QA method is to drive the game rather than assume. This drives it and takes the picture.

USAGE
    py tools/serve.py                      # in another shell
    py tools/terrshot.py 0                     # one territory by index
    py tools/terrshot.py all                   # every territory, into shots/
    py tools/terrshot.py 0 hud=1               # with the HUD, so the minimap is in frame
    py tools/terrshot.py 0 hud=1 size=390x844  # at a phone viewport

SIZE IS A REAL TEST, NOT A CONVENIENCE. This is a mobile-first PWA whose HUD scales through UIS,
and every screenshot this tool has ever taken was 1280x720 -- so nothing in the harness has ever
looked at the layout the majority of players actually get. `size=` drives the same frame at a phone
viewport, and the filename records it so a desktop and a phone shot of the same ground sit side by
side rather than overwriting each other.
"""

import io
import os
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from selftest import find_chrome, fresh_profile, PORT, ROOT

PAGE = "_terrshot_run.html"
OUT = os.path.join(ROOT, "shots")


def build():
    with io.open(os.path.join(ROOT, "index.html"), encoding="utf-8") as f:
        html = f.read()
    inject = (
        '<div id="shotlabel" style="position:fixed;left:0;bottom:0;z-index:99999;'
        'background:#000c;color:#0f0;font:14px monospace;padding:3px 8px">pending</div>\n'
        '<script defer src="_terrshot.js"></script>\n'
    )
    with io.open(os.path.join(ROOT, PAGE), "w", encoding="utf-8") as f:
        f.write(html.replace("</body>", inject + "</body>"))


def shoot(idx, hud=False, extra=(), name=None, size="1280,720"):
    if not os.path.isdir(OUT):
        os.makedirs(OUT)
    stem = name or ("z%02d" % idx)
    if size != "1280,720":
        stem += "_" + size.replace(",", "x")
    dest = os.path.join(OUT, stem + ".png")
    chrome = find_chrome()
    cmd = [
        chrome, "--headless=new", "--disable-gpu",
        "--user-data-dir=" + fresh_profile("terrshot"),   # never reuse: see fresh_profile
        "--window-size=" + size,
        "--virtual-time-budget=30000",
        "--screenshot=" + dest,
    ]
    if hasattr(os, "geteuid") and os.geteuid() == 0:
        cmd.append("--no-sandbox")
    # 127.0.0.1, NOT localhost: serve.py binds 127.0.0.1 explicitly and Chrome tries ::1 first,
    # where nothing is listening -- same trap tools/shot.py documents.
    url = "http://127.0.0.1:%d/%s?z=%d&hud=%d" % (PORT, PAGE, idx, 1 if hud else 0)
    for kv in extra:
        url += "&" + kv
    cmd.append(url)
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    ok = os.path.exists(dest) and os.path.getsize(dest) > 0
    print("%s  %s" % ("ok " if ok else "FAIL", dest))
    return ok


if __name__ == "__main__":
    build()
    arg = sys.argv[1] if len(sys.argv) > 1 else "0"
    extra = list(sys.argv[2:])
    # hud= and size= are ours; everything else is passed through to the page untouched
    hud = False
    size = "1280,720"
    passthru = []
    for kv in extra:
        if kv.startswith("hud="):
            hud = kv.split("=", 1)[1] not in ("0", "", "no", "false")
        elif kv.startswith("size="):
            size = kv.split("=", 1)[1].replace("x", ",")
        else:
            passthru.append(kv)
    extra = passthru
    if arg == "all":
        for i in range(14):
            shoot(i, hud=hud, extra=extra, size=size)
    else:
        # a lair shot is not a territory shot -- name the file after what it is
        nm = None
        for kv in extra:
            if kv.startswith("lair="):
                nm = "lair" + kv.split("=", 1)[1]
        shoot(int(arg), hud=hud, extra=extra, name=nm, size=size)
