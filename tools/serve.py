"""Serve the game on ONE fixed port, with caching disabled.

WHY THIS EXISTS. `python -m http.server` sends Last-Modified and answers conditional requests with
304, and a `?v=` on index.html does not bust the *script* URLs -- so an edited .js file kept being
served from the browser's HTTP cache. The workaround was to serve every edit on a brand new port.
That worked, and it leaked: 232 orphaned http.server processes holding 3.2 GB were found in one
session, because nothing ever stopped the old ones.

The actual problem was never the port, it was the caching. This sends no-store on every response,
so one port can be reused forever and there is nothing to leak. It also stops any previous instance
of itself before binding, so re-running it is always safe.

    py tools/serve.py            # http://127.0.0.1:10500
    py tools/serve.py 10501      # if you want a second one alongside

NOTE this only defeats the BROWSER HTTP cache. The service worker is cache-first and is a separate
layer -- you must still bump CACHE in sw.js on every commit, or the sw will serve the old file no
matter what this sends.
"""
import functools
import http.server
import os
import socket
import subprocess
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 10500
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_header(self, key, value):
        # SimpleHTTPRequestHandler stamps Last-Modified from the file mtime, which is what lets the
        # browser send If-Modified-Since next time.
        if key.lower() == "last-modified":
            return
        super().send_header(key, value)

    def send_head(self):
        # Dropping the Last-Modified *response* header is not enough on its own. send_head compares
        # If-Modified-Since against the file mtime and returns a bare 304 before any of our headers
        # are written, so a browser holding an old copy from before this server existed would still
        # be told "unchanged". Verified: stripping only the response header still answered 304.
        # Delete the conditional REQUEST headers and there is nothing left to match on.
        for h in ("If-Modified-Since", "If-None-Match", "If-Range"):
            while h in self.headers:
                del self.headers[h]
        return super().send_head()

    def log_message(self, fmt, *args):
        pass          # a request log per asset is 5000 lines of noise on this project


def free_the_port(port):
    """Stop whatever is already listening, so re-running this is never a 'port in use' error."""
    with socket.socket() as s:
        s.settimeout(0.3)
        if s.connect_ex(("127.0.0.1", port)) != 0:
            return
    try:
        out = subprocess.run(["netstat", "-ano", "-p", "TCP"],
                             capture_output=True, text=True, timeout=15).stdout
    except Exception:
        return
    pids = {line.split()[-1] for line in out.splitlines()
            if f"127.0.0.1:{port} " in line and "LISTENING" in line}
    for pid in pids:
        if pid.isdigit() and int(pid) != os.getpid():
            subprocess.run(["taskkill", "/F", "/PID", pid],
                           capture_output=True, timeout=15)
            print(f"stopped previous server on {port} (pid {pid})")


def main():
    free_the_port(PORT)
    handler = functools.partial(NoCacheHandler, directory=ROOT)
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    print(f"emberrealm -> http://127.0.0.1:{PORT}/index.html   (no-store; reuse this port)")
    print("remember: bump CACHE in sw.js too -- the service worker is a separate cache")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()


main()
