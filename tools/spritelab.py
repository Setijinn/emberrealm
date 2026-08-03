#!/usr/bin/env python
"""Build the source index for the Sprite Lab and open it.

WHAT THE LAB IS. A live editor for spritegen recipes: pick any sprite already in assets/, stack ops
on it, watch the result beside the source at whatever zoom, scrub or play an animated set, and copy
out the recipe JSON when it looks right. It exists because spritegen's dials are not guessable --
ramp.mix at 0.45 barely reads and at 0.75 flattens the accent trim that carries a creature's
identity, and the only way to know which you have is to look. That loop used to be edit JSON, run
the tool, open a contact sheet, repeat.

WHY THE INDEX IS GENERATED AND ALSO COMMITTED. The lab is a static page and a static page cannot
list a directory, so it needs a manifest of what art exists. Generated, then -- and by the rule the
rest of this repo follows (_lab.html, _selftest.html) a generated file is never committed, precisely
so it cannot drift.

This one is the exception, and the reason is the phone. The lab is served to a phone over the public
Pages site, and a static host has nothing to run: if the index is not in the repo, the hosted lab
comes up with no sources at all. So it ships. The drift risk is handled by regenerating it on every
single run -- opening the lab is what rewrites it -- and by saying so out loud below when the file
on disk no longer matches what is committed, since it is only ever the HOSTED copy that can lag.

ON A PHONE, ON DATA. That is what the Pages site is for; --mobile/--lan is for the local files.
   local files, same wifi   spritelab.cmd --mobile   -> http://<this machine>:10500/...
   anywhere, on data        merge to main            -> https://setijinn.github.io/emberrealm/_spritelab.html
The hosted one shows the art as committed, which is the point of it and also its one limitation:
art you have generated but not pushed is not there yet.

DERIVED ART IS INCLUDED, AND FLAGGED. It used to be excluded, on the reasoning that offering it as a
source invites deriving from a derivation -- two ramps in sequence give a muddy result that is hard
to diagnose later, because the file looks like a normal source. That reasoning only ever covered the
DERIVE side. The draw side opens a frame to FIX it, and a derived frame is exactly as likely to need
fixing as any other; excluding them meant 457 of the project's sprites simply could not be opened.
So they are listed, marked `derived` so the picker can show which they are and you never mistake one
for an original.

    py tools/spritelab.py             # index, start the server if needed, open the browser
    py tools/spritelab.py --mobile    # ...and print the address to type into a phone
    py tools/spritelab.py --no-open   # everything except opening the browser

or just double-click spritelab.cmd in the repo root, which finds a working interpreter for you --
`py` on this machine is the Store alias stub and will not do.

IT STARTS THE SERVER ITSELF. The instruction used to be "run serve.py in another shell, or nothing
loads", which is a step you forget exactly once: the lab comes up blank with a fetch error and looks
broken rather than unserved.

Like tools/lab.py this one is NOT headless. It builds the page's data and gets out of the way.
Interpreter is Python312 by full path; `py` is broken on this machine.
"""

import io
import json
import os
import re
import socket
import subprocess
import sys
import time
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
    dirs, files, derived = [], [], []
    for cur, subs, names in os.walk(ASSETS):
        subs[:] = [s for s in subs if s not in SKIP_DIRS]
        rel = os.path.relpath(cur, ROOT).replace("\\", "/")
        pngs = sorted(n for n in names if n.lower().endswith(".png"))
        if not pngs:
            continue
        framey = sum(1 for n in pngs if FRAME_RE.match(n))
        if len(pngs) > 1 and framey >= SET_SHARE * len(pngs):
            dirs.append({"path": rel, "frames": pngs, "derived": rel in ddirs})
        else:
            for n in pngs:
                full = "%s/%s" % (rel, n)
                files.append(full)
                if full in dfiles:
                    derived.append(full)
    # Loose single sprites live in the big flat folders (assets/mobs, assets/items, ...) and there are
    # hundreds; a directory that is a real animation set is the more useful thing to show first, and
    # both lists are sorted so the picker is stable between runs.
    dirs.sort(key=lambda d: d["path"])
    files.sort()
    return {"dirs": dirs, "files": files, "derivedFiles": sorted(derived)}


def port_open(host, port, timeout=0.35):
    with socket.socket() as s:
        s.settimeout(timeout)
        return s.connect_ex((host, port)) == 0


def ensure_server(lan):
    """Start tools/serve.py if nothing is answering, and wait until it does.

    THE OLD INSTRUCTIONS WERE 'run serve.py in another shell, or nothing loads', which is a step that
    is only ever forgotten once -- the lab comes up as a blank page with a fetch error and looks
    broken rather than unserved. There is nothing to think about here: if the port answers, use it;
    if it does not, start one. Detached, so closing this window does not take the server with it."""
    # WITH --mobile IT IS NOT ENOUGH THAT SOMETHING IS ANSWERING. A server already up from an earlier
    # run is bound to the loopback only, so the phone URL this would go on to print is unreachable --
    # and it would print it confidently. Check the address the phone will actually use, and if that
    # is not answering, start a server that binds it. serve.py stops the previous instance itself.
    want = lan_ip() if lan else "127.0.0.1"
    if port_open("127.0.0.1", PORT) and (not lan or port_open(want, PORT)):
        return "already running"
    rebind = lan and port_open("127.0.0.1", PORT)
    cmd = [sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "serve.py")]
    if lan:
        cmd.append("--lan")
    kw = {}
    if os.name == "nt":
        # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP -- no console window, and it outlives this one.
        kw["creationflags"] = 0x00000008 | 0x00000200
    else:
        kw["start_new_session"] = True
    subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, cwd=ROOT, **kw)
    for _ in range(40):                       # up to ~6s; a cold python start is about half of that
        if port_open(want, PORT):
            return "restarted on the network" if rebind else "started"
        time.sleep(0.15)
    return "FAILED to start -- run `python tools/serve.py%s` yourself and look at the error" % (
        " --lan" if lan else "")


def lan_ip():
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        try:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
        except Exception:
            return "127.0.0.1"


PAGES = "https://setijinn.github.io/emberrealm/" + PAGE


def index_is_committed():
    """True if the index on disk matches the one git has. The hosted lab serves the COMMITTED copy,
    so this is the only thing that can leave the phone looking at a different set of sources than
    the desktop -- worth one line of output rather than a puzzled phone."""
    try:
        out = subprocess.run(["git", "status", "--porcelain", "--", os.path.basename(INDEX)],
                             cwd=ROOT, capture_output=True, text=True, timeout=10)
        return out.returncode == 0 and not out.stdout.strip()
    except Exception:
        return True                      # no git, or no answer: say nothing rather than cry wolf


def main():
    idx = build_index()
    with io.open(INDEX, "w", encoding="utf-8") as f:
        json.dump(idx, f, indent=1)
        f.write("\n")
    nfr = sum(len(d["frames"]) for d in idx["dirs"])
    print("wrote %s" % os.path.basename(INDEX))
    print("  %d animated set(s), %d frames" % (len(idx["dirs"]), nfr))
    print("  %d single sprite(s)" % len(idx["files"]))
    nd = sum(len(d["frames"]) for d in idx["dirs"] if d.get("derived")) + len(idx["derivedFiles"])
    print("  %d of those are derived (marked in the picker)" % nd)

    mobile = "--mobile" in sys.argv or "--lan" in sys.argv
    print()
    print("server: %s" % ensure_server(mobile))

    # 127.0.0.1, NOT localhost: serve.py binds the IPv4 loopback only, and a browser that resolves
    # `localhost` to ::1 first gets connection-refused on a server that is running perfectly.
    url = "http://127.0.0.1:%d/%s" % (PORT, PAGE)
    print()
    print("  on this machine   %s" % url)
    if mobile:
        ip = lan_ip()
        print("  on your phone     http://%s:%d/%s" % (ip, PORT, PAGE))
        print()
        print("  Same wifi, then type that in. --lan means every device on this network can read")
        print("  this folder for as long as the server runs; close it when you are done.")
        if ip == "127.0.0.1":
            print("  (could not work out this machine's network address -- is wifi up?)")
    else:
        print("  same wifi         re-run with --mobile")
    print("  on data, anywhere %s" % PAGES)
    if not index_is_committed():
        print("                    (the hosted one is behind: commit %s and push)"
              % os.path.basename(INDEX))
    print()
    print("  PRESETS   the shipped element chains, so the lab starts where the art is")
    print("  PROBE     the source's hue histogram -- two bands is why the elements are ramps")
    print("  NAMING    to / variant / rename, with the resulting filenames listed live")
    print("  RECIPE    paste into tools/sprite_recipes.json, then")
    print("            python tools/spritegen.py <name> --sheet")
    print()
    print("  Every op in the lab is a port of the op of the same name in spritegen.py -- what you")
    print("  see IS what the tool writes. Edit one, edit both.")
    # Opens by default. lab.py needs --open because building the Pattern Lab is also how you rebuild
    # it for someone else; this one has no such second job, so the common case should be the bare
    # command. --no-open is there for scripts.
    if "--no-open" not in sys.argv:
        webbrowser.open(url)
    return 0


if __name__ == "__main__":
    sys.exit(main())
