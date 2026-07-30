#!/usr/bin/env python
"""
Run an audit script against the REAL index.html, headless.

WHY THIS EXISTS. _lvaudit.js shipped with no runner at all -- it was injected by hand every time,
which is the same drift the self-test harness was built to avoid. This is tools/selftest.py's
injection trick with the script name as an argument, so any `_*audit.js` gets the same treatment:
appended last, after every other script in the real load order, read back with --dump-dom.

An audit MEASURES. It is not a pass/fail gate and it never exits non-zero on its findings -- that is
what tools/selftest.py is for.

USAGE
    py tools/serve.py                    # in another shell, or the fetch()es 404
    py tools/audit.py _forgeaudit.js
    py tools/audit.py _fitaudit.js size=667x375
    py tools/audit.py _lvaudit.js
"""

import io
import os
import re
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from selftest import find_chrome, fresh_profile, PORT, ROOT   # one Chrome-discovery rule, not two


def build(script):
    with io.open(os.path.join(ROOT, "index.html"), encoding="utf-8") as f:
        html = f.read()
    if "</body>" not in html:
        sys.exit("index.html has no </body> to inject before")
    inject = (
        '<pre id="testout" style="position:fixed;left:0;top:0;z-index:99999;'
        'background:#000;color:#0f0;font:12px monospace;white-space:pre-wrap">pending</pre>\n'
        '<script defer src="%s"></script>\n' % script
    )
    out = html.replace("</body>", inject + "</body>")
    name = "_audit_run.html"
    with io.open(os.path.join(ROOT, name), "w", encoding="utf-8") as f:
        f.write(out)
    return name


def run(page, size="1280,720"):
    chrome = find_chrome()
    profile = fresh_profile("audit")          # never reuse: see fresh_profile
    cmd = [
        chrome, "--headless=new", "--disable-gpu",
        "--user-data-dir=" + profile,
        # SIZE MATTERS TO AN AUDIT, NOT JUST TO A SCREENSHOT. This is a mobile-first PWA and every
        # headless run this harness had ever done was an implicit 800x600 desktop window, so a panel
        # that overflows a phone in landscape measured as fitting. `size=WxH` as a trailing argument.
        "--window-size=" + size,
        # an audit runs millions of simulated kills, so it needs a great deal more simulated time
        # than the self-test's 40s budget
        "--virtual-time-budget=600000",
        "--dump-dom",
    ]
    if hasattr(os, "geteuid") and os.geteuid() == 0:
        cmd.append("--no-sandbox")
    cmd.append("http://localhost:%d/%s" % (PORT, page))
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    dom = proc.stdout.decode("utf-8", "replace")
    m = re.search(r'(?s)<pre id="testout"[^>]*>(.*?)</pre>', dom)
    if not m:
        sys.exit("no #testout in the dumped DOM -- did tools/serve.py stop? (%d bytes)" % len(dom))
    body = m.group(1)
    for a, b in (("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"'), ("&amp;", "&")):
        body = body.replace(a, b)
    print(body)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("usage: py tools/audit.py <_something_audit.js>")
    script = sys.argv[1]
    if not os.path.exists(os.path.join(ROOT, script)):
        sys.exit("no such audit script: %s" % script)
    size = "1280,720"
    for kv in sys.argv[2:]:
        if kv.startswith("size="):
            size = kv.split("=", 1)[1].replace("x", ",")
    page = build(script)
    print("built %s around %s at %s" % (page, script, size))
    run(page, size)
