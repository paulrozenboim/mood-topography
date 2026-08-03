# The Topography of Us

A live data-sculpture for Democracy Month Art Lab at Teder, Tel Aviv. Participants
trace a path across 36 human states on a tablet — where they are now, where they're
heading — and a public projection aggregates every path into a shared civic map,
narrating what it finds in short bulletins as the night goes on.

## The pages

Five pages, each a real bookmarkable URL:

- `index.html` — landing, links to the others
- `tablet.html` — the **Cast Path** page. Anchor a station, drag through 3–10 more,
  no timer, Mini-Metro–style undo. Ends in a receipt modal with the constellation +
  a QR code that opens `view.html` on the participant's phone.
- `projection.html` — the public wall. Aggregate map with gradient path strokes,
  per-bulletin animations (traverse, pulse, cascade, glow), pan/zoom, dark/light theme,
  side-mounted live stats, standalone bulletin footer, auto-pilot cycling.
- `settings.html` — control room. Two-column layout. Left: what the wall shows,
  theme, tonight's data (seed/clear), sync mode, archive (export/import + gallery
  link). Right: tonight's numbers and the full bulletin queue.
- `archive.html` — every path cast in the current session as a grid of thumbnail
  cards, click one to open its `view.html`.
- `view.html` — the participant's keepsake page. Reads a base36-encoded path from
  the URL hash, renders the same constellation as an `<img>` (long-press to save on
  mobile), shows credits + cast timestamp.

## Sync

Two modes, chosen automatically at page-load time:

- **Cloud** — Firebase Realtime Database. Works from anywhere with internet. This is
  what runs on the deployed GitHub Pages URL.
- **Local** — the operator laptop runs `sync-server.py`, becomes both the static
  server AND the sync relay. Zero internet dependency. Every message is also
  persisted to `sync-log.jsonl` so nothing is lost across Ctrl+C or reboots.

Detection is by a same-origin probe of `/health` — if the Python relay answers,
local mode wins; otherwise the browser dynamically loads the Firebase SDK.

See [SYNC.md](SYNC.md) for the event-night runbook (network setup, both hotspot
paths, verification, cleanup).

## Deploying to GitHub Pages

Push, then in the repo: **Settings → Pages → Source: Deploy from a branch → main /
`/docs` → Save.** URL lands ~1 min later at `https://<you>.github.io/topography-of-us/`.

The site is self-contained: variable fonts are bundled in `docs/assets/fonts/`, the
QR library is vendored, no CDN dependencies at page-load (Firebase SDK is fetched
dynamically only when cloud mode is active).

## Running locally

From the repo root:

```bash
python3 sync-server.py
```

The banner prints a localhost URL and a LAN URL. Open the localhost one for
same-machine tests; the LAN one is what other devices on the same network use.

## Station layout

`docs/assets/core.js` embeds pre-solved coordinates for all 36 stations. They come
from a relaxation solver (kept outside this repo) that gives each of the four lines
its own region of the field, pulls semantically related stations toward each other
across lines, and enforces a hard minimum clearance between every station's name
plate — verified collision-free from a phone screen up to a 1440p projector.

## Working copies

- `docs/` is what GitHub Pages serves — the live version.
- `v4/` is the current development mirror. Edits go here first, then `robocopy` (or
  equivalent) syncs into `docs/` before pushing.
- `v1/`, `v2/`, `v3/` are earlier iterations, gitignored — kept locally as
  reference, not shipped.

## Status + next steps

See [PROJECT-STATUS.md](PROJECT-STATUS.md).
