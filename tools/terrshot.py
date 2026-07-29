#!/usr/bin/env python
"""
Screenshot one overworld territory, headless.

WHY. "The terrain needs work" is a claim about what the ground LOOKS like, and this project's
stated QA method is to drive the game rather than assume. This drives it and takes the picture.

USAGE
    py tools/serve.py                      # in another shell
    py tools/terrshot.py 0                     # one territory by index
    py tools/terrshot.py all                   # every territory, into shots/
"""

import io
import os
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from selftest import find_chrome, PORT, ROOT

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


def shoot(idx, hud=False):
    if not os.path.isdir(OUT):
        os.makedirs(OUT)
    dest = os.path.join(OUT, "z%02d.png" % idx)
    chrome = find_chrome()
    cmd = [
        chrome, "--headless=new", "--disable-gpu",
        "--user-data-dir=" + os.path.join(tempfile.gettempdir(), "emberrealm_terrshot_profile"),
        "--window-size=1280,720",
        "--virtual-time-budget=30000",
        "--screenshot=" + dest,
    ]
    if hasattr(os, "geteuid") and os.geteuid() == 0:
        cmd.append("--no-sandbox")
    cmd.append("http://localhost:%d/%s?z=%d&hud=%d" % (PORT, PAGE, idx, 1 if hud else 0))
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    ok = os.path.exists(dest) and os.path.getsize(dest) > 0
    print("%s  %s" % ("ok " if ok else "FAIL", dest))
    return ok


if __name__ == "__main__":
    build()
    arg = sys.argv[1] if len(sys.argv) > 1 else "0"
    if arg == "all":
        for i in range(14):
            shoot(i)
    else:
        shoot(int(arg))
