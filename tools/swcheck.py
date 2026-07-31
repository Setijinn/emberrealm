# sw.js is never loaded by index.html, so nothing in the harness has ever parsed it. A syntax error
# in a service worker breaks the install on every device and shows up as nothing at all -- the page
# just quietly stops being offline-capable, or worse, keeps an old worker. Parse it the way the
# selftest parses everything else.
import io, json, os, re, subprocess, sys, tempfile

os.chdir(r'C:\Users\darkc\Desktop\EmberRealm\emberrealm-src')
src = io.open('sw.js', encoding='utf-8').read()
page = (
    '<!doctype html><meta charset="utf-8"><body><pre id="o">pending</pre><script>\n'
    'var SRC = ' + json.dumps(src) + ';\n'
    'try{ new Function(SRC); document.getElementById("o").textContent = "SW PARSES OK"; }\n'
    'catch(e){ document.getElementById("o").textContent = "SW SYNTAX ERROR: " + e.message; }\n'
    '</script>'
)
p = os.path.join(os.getcwd(), '_swcheck.html')
io.open(p, 'w', encoding='utf-8').write(page)
chrome = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
r = subprocess.run([chrome, '--headless=new', '--disable-gpu',
                    '--user-data-dir=' + tempfile.mkdtemp(),
                    '--virtual-time-budget=8000', '--dump-dom',
                    'file:///' + p.replace('\\', '/')],
                   capture_output=True, text=True, timeout=180)
m = re.search(r'<pre id="o">(.*?)</pre>', r.stdout, re.S)
print(m.group(1).strip() if m else 'no output from the parse check')
os.remove(p)
