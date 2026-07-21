EMBERREALM — PWA DEPLOY GUIDE
=============================

What's in this folder:
  index.html          the game (with PWA hooks wired in)
  manifest.webmanifest  app metadata: name, icon, landscape lock
  sw.js               service worker (offline caching)
  icon-192.png / icon-512.png   home screen icons

FASTEST DEPLOY — Netlify Drop (no account CLI, ~2 minutes):
  1. On your PC, go to https://app.netlify.com/drop
  2. Drag this whole folder onto the page
  3. It gives you a live URL like https://something.netlify.app
  4. (Optional) Make a free account to keep the site and rename the URL

ALTERNATIVE — Vercel:
  1. Push this folder to a GitHub repo (you know the drill)
  2. Import the repo at https://vercel.com/new
  3. Framework preset: "Other" — no build step needed

INSTALL ON YOUR PHONE:
  Android (Chrome): open the URL, tap the three-dot menu,
    "Add to Home screen" / "Install app". Opens fullscreen,
    locks landscape automatically.
  iPhone (Safari): open the URL, Share button, "Add to Home Screen".
    (iOS ignores the landscape lock in the manifest — just hold it sideways.)

UPDATING THE GAME:
  Replace index.html with a newer version and redeploy
  (drag the folder again on Netlify, or git push on Vercel).
  Bump the CACHE name in sw.js (v1 -> v2) so phones fetch the update.

NOTE: The game saves nothing yet — when we add saves, we'll use
localStorage (works fine in a real browser, unlike the Claude preview).
