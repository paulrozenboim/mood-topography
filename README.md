# The Topography of Us

A live data-sculpture: participants trace a path across 36 human states on a tablet;
a public projection aggregates every path into a shared civic map.

## Structure

```
docs/                        ← GitHub Pages serves from here
  index.html                 landing page, links to the three device roles
  tablet.html                 the kiosk — where people cast a path
  projection.html              the public wall
  vj.html                       operator control panel
  assets/
    style.css                  shared design tokens + components
    core.js                    station data, geometry, analysis, the map renderer
    store.js                   app state + sync transport
    seed.js                    rehearsal/demo data generator (vj.html only)
    remote-config.example.js   template for real cross-device sync (see below)
```

Three separate pages, not three tabs of one app — each is a real URL you can open on
its own device and bookmark: the tablet on the kiosk iPad, the projection on the
laptop driving the display, the VJ panel on your phone or a third laptop.

## Deploying to GitHub Pages

```
git init
git add .
git commit -m "Topography of Us — working draft"
git branch -M main
git remote add origin https://github.com/<you>/topography-of-us.git
git push -u origin main
```

Then in the repo: **Settings → Pages → Build and deployment → Source: Deploy from a
branch → Branch: main, folder: /docs → Save.** GitHub gives you a URL a minute or two
later — `https://<you>.github.io/topography-of-us/`. `tablet.html`, `projection.html`,
and `vj.html` hang off that same URL.

## What syncs today, and what doesn't yet

Out of the box, pages sync via `BroadcastChannel`, which only reaches **other tabs on
the same browser, same device.** That's genuinely enough for rehearsing the whole flow
alone — open `tablet.html` and `projection.html` in two windows on one laptop and cast
a few paths.

It is **not** enough for the real setup: a tablet and a separate projection laptop are
two different devices, and `BroadcastChannel` cannot cross that gap. Once it's on
GitHub Pages, opening the tablet on your phone and the projection on your laptop will
each show its own, unsynced copy of the map until a real backend is wired in.

`assets/remote-config.example.js` documents the two-function contract
(`send` / `subscribe`) that `store.js` already looks for. Whichever backend gets
wired in, nothing else in the app changes.

## The live event itself

Independent of whichever sync backend ends up wired in for rehearsal, the actual
Teder installation should still run on a laptop acting as its own local router or
hotspot, with the tablet and projection joined to that same local network — not
routed over venue wifi or the public internet. A packed nightlife venue is exactly
the environment where you don't want the piece's uptime depending on someone else's
router. GitHub Pages and a hosted backend are for rehearsal, remote testing, and
letting collaborators see it — not the dependency you want live on the night.

## Station layout

`docs/assets/core.js` embeds pre-solved coordinates for all 36 stations. They come
from a relaxation solver (kept outside this repo) that gives each of the four lines
its own region of the field, pulls semantically related stations toward each other
across lines, and enforces a hard minimum clearance between every station's name
plate — verified collision-free from a phone screen up to a 1440p projector. If
stations are ever renamed or added, re-run the solver rather than hand-editing
coordinates; hand-nudging one station can reopen a collision somewhere else on the map.
