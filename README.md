# The Mood Topography

A live data-sculpture for Democracy Month Art Lab at Teder, Tel Aviv. Participants
trace a path across 36 human states on a tablet, and a public projection aggregates
every path into a shared civic map, narrating what it finds in short bulletins as
the night goes on.

## Pages

All under `docs/`:

- `index.html` — landing
- `tablet.html` — the **Cast Path** kiosk. Anchor a station, drag through 3–10 more,
  ends with a receipt modal (constellation + QR to `view.html`).
- `projection.html` — the public wall. Live aggregate map, per-bulletin animations,
  auto-pilot cycling.
- `landscape.html` — 3D terrain view. Station height is traffic, paths arc between
  them as gradient curves. Has a path player and a first-person fly-through.
- `settings.html` — operator controls: filter, theme, seed/clear, sync mode, archive.
- `archive.html` — every path cast this session as a grid; click to open its keepsake.
- `view.html` — participant keepsake. Reads a base36-encoded path from the URL hash,
  renders the constellation, long-press-saveable on mobile.

## Landscape controls

**Camera** — drag to rotate (unrestricted, including straight down or from
below), middle-drag to pan, wheel to zoom. `R` resets to the frontal elevation,
`Space` toggles auto-rotate, `P` saves a PNG.

**Sliders** — Height scales the columns, Size sets how strongly a station's
radius reflects its traffic, Opacity fades the paths, Speed scales playback
(0.2×–2×) including the fly-through.

**Path player** — works like an audio player. Play runs through the paths one
after another; Prev/Next skip; Stop returns to the static view. Repeat cycles
off → all → one (loop the current path). **ALL** is separate: every path draws
at once, staggered. The camera button flies first-person along whichever path is
playing — dragging exits it and hands the orbit camera back.

## Running locally

From the repo root:

```bash
python sync-server.py
```

Serves `docs/` and acts as the sync relay. Open the printed localhost URL for
same-machine tests; the LAN URL is what other devices on the same network use.

## Sync

Two modes, auto-detected at page load:

- **Local** — `sync-server.py` is the static server and the SSE relay. Zero internet.
  Messages persist to `sync-log.jsonl` so nothing is lost across restarts.
- **Cloud** — Firebase Realtime Database. Used when the Python relay isn't reachable.
  This is what runs on the deployed GitHub Pages URL.

Detection is a same-origin probe of `/health`.

## Deploying to GitHub Pages

Push to `main`. In the repo: **Settings → Pages → Source: Deploy from a branch →
main / `/docs` → Save.** URL lands ~1 min later.

The site is self-contained: variable fonts bundled in `docs/assets/fonts/`, QR
library vendored, no CDN dependencies at page-load (Firebase SDK is fetched
dynamically only when cloud mode is active).

## Station layout

`docs/assets/core.js` embeds pre-solved coordinates for all 36 stations. Each of the
four mood families gets its own region of the field; a minimum clearance between
name plates is enforced so labels don't collide from phone up to 1440p projector.
