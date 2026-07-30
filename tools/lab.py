#!/usr/bin/env python
"""Build and open the Pattern Lab.

WHAT IT IS. A live editor for boss projectile patterns and for weapon rows, driving the game's own
eFire()/update()/render() and the live WEAP table -- so what you watch is what ships, and what it
prints is pasteable into the file it names. See the header of _lab.js for why.

WHY IT IS GENERATED FROM index.html. Same rule as _selftest.html and _terrshot_run.html: a
hand-maintained copy of the script list is a copy that drifts, and the drift is invisible until the
lab is testing a version of the game that no longer exists. This reads the real index.html, appends
one <script defer>, and writes _lab.html beside it.

    py tools/serve.py            # in another shell, or nothing loads
    py tools/lab.py              # build it and print the URL
    py tools/lab.py --open       # ...and open your browser at it

UNLIKE THE OTHER TOOLS HERE, THIS ONE IS NOT HEADLESS. shot.py and selftest.py drive Chrome and hand
back a picture or a verdict; the lab is a thing you use, so it just builds the page and gets out of
the way.
"""

import io
import os
import sys
import webbrowser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 10500
PAGE = "_lab.html"

INJECT = '<script defer src="_lab.js"></script>\n'


def build():
    with io.open(os.path.join(ROOT, "index.html"), encoding="utf-8") as f:
        html = f.read()
    if "</body>" not in html:
        sys.exit("index.html has no </body> to inject before")
    out = html.replace("</body>", INJECT + "</body>")
    path = os.path.join(ROOT, PAGE)
    with io.open(path, "w", encoding="utf-8") as f:
        f.write(out)
    return path


if __name__ == "__main__":
    path = build()
    url = "http://localhost:%d/%s" % (PORT, PAGE)
    print("built %s" % os.path.basename(path))
    print(url)
    print()
    print("  PATTERN tab   mode / count / spread / speed / rate / spin / burst, and the four")
    print("                BOSS_PROJ look fields. COPY CODE gives you the loop in the form")
    print("                17i_bossfights.js already uses, plus its BOSS_PROJ row.")
    print("  WEAPON tab    edits the live WEAP row for a weapon type and puts it in your hands,")
    print("                so the player's own fire() reads it on the next shot. COPY CODE gives")
    print("                you the row to paste back into 11_ui.js.")
    print()
    print("  WASD to walk into it. God mode is on so you can watch rather than dodge --")
    print("  turn it off in the dev panel when the question is whether it is survivable.")
    if "--open" in sys.argv:
        webbrowser.open(url)
