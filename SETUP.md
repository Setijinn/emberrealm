# Emberrealm — deploy on GitHub Pages (FREE, unlimited, no credit meter)

Static PWA game. No build step, no dependencies. Everything is at repo root
with relative paths, so it works on GitHub Pages out of the box.

====================================================================
PHONE PATH (no computer needed) — ~5 minutes
====================================================================

1. CREATE THE REPO
   - In your phone browser go to github.com and sign in (or make a free account).
   - Tap the + (top right) -> "New repository".
     (If the mobile site hides it, open browser menu -> "Desktop site".)
   - Name it:  emberrealm
   - Set to Public.  Do NOT add a README/gitignore (repo must start empty).
   - Tap "Create repository".

2. UPLOAD THE GAME FILES
   - On the new empty repo page, tap "uploading an existing file"
     (or "Add file" -> "Upload files").
   - Unzip emberrealm-repo.zip on your phone first (Files app -> tap the zip
     -> it extracts to a folder).
   - Select ALL the files inside the emberrealm-src folder — every .js, .css,
     .html, .webmanifest, the two .png icons, sw.js, netlify.toml, .gitignore.
     IMPORTANT: upload the files themselves, not the folder, so index.html
     lands at the repo root.
   - Tap "Commit changes".

3. TURN ON GITHUB PAGES
   - In the repo: "Settings" -> "Pages" (left menu; use Desktop site if needed).
   - Under "Build and deployment" -> Source: "Deploy from a branch".
   - Branch: main   Folder: / (root).  Save.
   - Wait ~1 minute. The page shows your live URL:
        https://YOURNAME.github.io/emberrealm/

4. INSTALL THE GAME
   - Open that URL on your phone.
   - Browser menu -> "Add to Home Screen".  Launches fullscreen like an app.

To UPDATE later: repo -> the file -> edit (pencil) or re-upload -> commit.
Pages redeploys automatically in ~1 min, free, forever. Bump the CACHE
name in sw.js when you change code so your phone pulls the new version.

====================================================================
COMPUTER PATH (when you're at your PC) — git CLI
====================================================================
   git init
   git add .
   git commit -m "Emberrealm v32"
   git branch -M main
   git remote add origin https://github.com/YOURNAME/emberrealm.git
   git push -u origin main
Then do step 3 above to enable Pages. After this, `git push` = instant deploy.
Install Claude Code in this folder and Claude can edit files + push directly.

====================================================================
BACKUP HOST — Cloudflare Pages (drag-and-drop, also free/unlimited)
====================================================================
If you'd rather not touch git yet: pages.cloudflare.com -> Create ->
"Upload assets" -> drop the unzipped files. Same deal, no credit meter.

## File map
- index.html ........ loads boot.js, DOM, then the ordered module scripts
- boot.js ........... service-worker registration + landscape lock
- style.css ......... all UI styling
- 00_data.js ........ ROOM_DEFS: Emberhearth + the EmberGrove island
- 01..12_*.js ....... engine, world, entities, combat, update, render,
                      sprites, loop, UI (vendors/equipment/map), dev panel
- sw.js ............. offline cache (bump CACHE name to force an update)
