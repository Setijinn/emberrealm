#!/usr/bin/env python
"""
Build and run the headless self-test.

WHY THIS EXISTS. The project's stated QA method is "drive the game and report measurements", and
the two traps it keeps hitting are (a) a syntax error is invisible to manual frame-stepping,
because stepping update()/render() by hand never needs the rAF loop, and (b) two tables that stopped
agreeing degrade through a `||` default instead of throwing. Both are cheap to catch and expensive
to miss, so they get a harness.

HOW IT WORKS. It does NOT hand-maintain a copy of index.html -- that copy would drift, which is the
exact failure mode the whole file is about. It reads the real index.html, appends one <script defer>
and one <pre> to it, and writes _forgetest.html beside it. Because the injected script is `defer` and
last, it runs after every other script in the real load order, against the real DOM.

The results are read back out of the DOM with `chrome --headless=new --dump-dom`, which needs no
CDP client and no node -- neither of which is installed on this machine.

USAGE
    py tools/serve.py            # in another shell, or the fetch()es 404
    py tools/selftest.py

    py tools/selftest.py --build-only     # just write _forgetest.html
"""

import io
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 10500

CHROMES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]

INJECT = (
    '<pre id="testout" style="position:fixed;left:0;top:0;z-index:99999;'
    'background:#000;color:#0f0;font:12px monospace;white-space:pre-wrap">pending</pre>\n'
    '<script defer src="_forgetest.js"></script>\n'
)


def build():
    with io.open(os.path.join(ROOT, "index.html"), encoding="utf-8") as f:
        html = f.read()
    if "</body>" not in html:
        sys.exit("index.html has no </body> to inject before")
    out = html.replace("</body>", INJECT + "</body>")
    path = os.path.join(ROOT, "_forgetest.html")
    with io.open(path, "w", encoding="utf-8") as f:
        f.write(out)
    return path


def find_chrome():
    for p in CHROMES:
        if os.path.exists(p):
            return p
    sys.exit("no Chrome binary found; add yours to CHROMES in this file")


def run():
    chrome = find_chrome()
    profile = os.path.join(tempfile.gettempdir(), "emberrealm_selftest_profile")
    # --headless=new is required: the old headless mode was removed and exits 21 with no output.
    cmd = [
        chrome, "--headless=new", "--disable-gpu",
        "--user-data-dir=" + profile,
        "--virtual-time-budget=40000",
        "--dump-dom",
        "http://localhost:%d/_forgetest.html" % PORT,
    ]
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    dom = proc.stdout.decode("utf-8", "replace")
    m = re.search(r'(?s)<pre id="testout"[^>]*>(.*?)</pre>', dom)
    if not m:
        sys.exit("no #testout in the dumped DOM -- did tools/serve.py stop? (%d bytes)" % len(dom))
    body = m.group(1)
    for a, b in (("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"'), ("&amp;", "&")):
        body = body.replace(a, b)
    print(body)
    return 1 if body.lstrip().startswith("RESULT FAIL") else 0


if __name__ == "__main__":
    path = build()
    print("built %s" % os.path.basename(path))
    if "--build-only" in sys.argv:
        sys.exit(0)
    sys.exit(run())
