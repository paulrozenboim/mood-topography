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
- `landscape.html` — 3D terrain view, **also public**: linked from the results page and
  opens in its own tab. Station height is traffic, paths arc between them as gradient
  curves. Has a path player and a first-person fly-through.
- `settings.html` — operator controls: filter, theme, seed/clear, sync mode, archive.
- `archive.html` — every path cast this session as a grid; click to open its keepsake.
- `results.html` — the **public results page**. What you send round when the night is
  over. See below.
- `view.html` — a single path on its own. Reads a base36-encoded path from the URL hash,
  renders the constellation, shows its **path code**, and prints the thermal receipt that
  `archive.html`'s reprint button uses. Reached from the archive now, not handed out —
  no share QR and no URL on screen, because the code is the thing an operator wants off
  it. The results page's journey lightbox no longer links here either.

## Demo paths

Rehearsal paths (`seeded: true`) are **hidden on every surface by default**. One switch in
**Settings → Demo paths** turns them on while there is nothing real to show yet; it rides
the sync channel, so the wall, the kiosk, the terrain and the archive all change together.

Everything that draws goes through `activePaths()` in `core.js` rather than reading
`Store.paths` directly — that is the single place the toggle takes effect, and the reason
no page can quietly disagree with another. `Store.paths` still holds everything: this is a
view, not a delete, and **Clear demo paths** is still what removes them.

There is no longer a real/demo split in any read-out. Either the rehearsal paths are shown
and counted, or they are not there at all.

The public results page never shows them, toggle or not — it has no access to operator
settings. `?demo=1` is a private hatch for previewing that page before anything real has
been cast.

## The printed receipt

Every receipt carries a QR to the **results page** with that person's path already
found, and the same path as a typed code underneath:

```
        SEE THE WHOLE MAP
             [ QR ]              → …/results.html#q=MT-45FVYX
      ┌──────────────────┐
      │  YOUR PATH CODE  │
      │    MT-45FVYX     │
      └──────────────────┘
  Enter it under “Every journey”
    to find your route again
```

Scanning opens the collective map with their route picked out of it; clearing the search
leaves them in everyone else's. The code is the fallback for anyone who doesn't scan, and
it is also what they read out to a friend.

**`PUBLIC_BASE` in `docs/assets/core.js` is the URL that gets printed.** It is
deliberately not derived from `location`: the kiosk usually runs off a LAN address, and a
QR encoding `192.168.x.x` is dead paper the moment someone leaves the room. Check it
before a print run — it is the one thing here that cannot be fixed after the fact.

The kiosk guards the other half of that problem itself. A tablet stays open for hours; deploy
a change — or rename the repo — while it sits there and the tab keeps printing the address it
loaded this morning. When `tablet.html` is served over https from anywhere that isn't
underneath `PUBLIC_BASE`, it puts a red band across the top telling the operator to reload
before printing. Local http is exempt, since the relay is *supposed* to be on a LAN address.

The code is the same base36 the URL hash uses, upper-cased behind an `MT-` prefix. The
prefix is load-bearing rather than decorative: the alphabet overlaps station names
exactly, so a bare `hope` is both a station to search for and a valid four-stop path
(h,o,p,e). The prefix is what lets one box accept both.

`archive.html`'s reprint button goes through `view.html`, which emits a byte-identical
receipt.

## The results page

`results.html` is the one page built for strangers on phones rather than for the
operator. It links nowhere into the operator pages. The order shows the result first and
explains the process last:

1. **Hero** — title, one sentence, event line. Nothing else. The headcount and the month
   are read off the data, so a frozen snapshot and a live read both describe themselves
   honestly.
2. **The map**, directly under the hero and partly visible in the first viewport on
   desktop, with the four headline figures as a compact read-out beneath it.
3. **What the map found** — the readings, as a drifting strip.
4. **Every journey** — the searchable grid.
5. **The night in numbers** — the charts: all 36 stations by traffic (no inner
   scroller — the list stands full-length), the most-walked two-station segments and
   three-station runs, and a **Never used** panel whose dropdown switches between the
   roles a station was never cast in (visited at all / a starting point / a destination /
   a connection). By the end of a busy night "never visited" is usually empty, which is
   why the other three exist.
6. **How it worked** — the field, the interaction, the collective map. This is where the
   long explanation lives; it used to sit above the visualisation and is the one thing
   most likely to creep back up the page.

**The map** names all 36 stations — a greedy placer gives each one the best of twelve
slots around its dot, and nothing is ever dropped. It assembles itself once on arrival
(routes drawing on in a wave) and then keeps a handful of lights travelling along the
routes, the way traffic moves on a transit diagram. Tapping a station filters the journey
grid and says so in a small notice — it never drags the page there by itself; going is a
button in the notice.

**The readings** run as a full-bleed strip that drifts sideways on its own. A mouse over
it stops it for as long as the pointer stays. Any hand-scroll — drag, wheel, swipe —
parks it for ten seconds and then it picks up again on its own, which is the only
control a touch device has.

Both animations idle when scrolled out of view or when the tab is hidden, and neither
runs at all under `prefers-reduced-motion` — the map stays on its finished frame and the
strip stays hand-scrollable.

It is deliberately **read-only and standalone**: it loads neither `store.js` nor
`remote-config.js`, writes nothing to localStorage beyond its own theme, and never
sends on the sync channel. Nothing a visitor does can touch the show.

### Searching

The search box takes three shapes, decided by what's typed — no mode to set first:

- **A station** (`hope`, `vuln`) — partial names resolve as long as they're
  unambiguous. A dropdown then asks what part it played: anywhere on the path, as a
  starting point, as a destination, as a connection, or **not used** — journeys that
  never reached it, which is the one reading you cannot get to by searching. The same
  dropdown appears for a station picked off the map or the traffic list, so the role
  filter works whichever way the station was chosen.
- **A route** — two or more stations chained with `›`, `>`, `-`, `→` or `,`
  (`Fear > Vulnerability > Hope`). The chips switch to *how* to match: **in this order**
  (those stops run back to back, so a 3-stop query still finds the 10-stop path
  containing it), **same stations, any order**, or **this exact route only** (the whole
  journey and nothing more).
- **A path code** (`MT-4ISJWX`) — the code printed on the receipt. Case, the dash and
  stray spaces are all forgiven.
- **A keepsake link** — pasted whole. Still works for links handed out earlier.

A line under the box states in plain English what the current query means. Everything —
query, mode, mood category, length, sort, selected station — lives in the URL hash, so any
view is itself shareable.

**Mood categories** are a dropdown rather than four chips, with a second dropdown for the
part the category played — the same five readings a station gets. On its own, "touches
Momentum & Vision" is not a filter: nearly two thirds of paths touch all four categories
and by the end of a night that reading is usually 100%. What it is asking is *where* a
category sat: started in Friction, ended in Momentum, only ever passed through Connection,
never reached at all. Those separate the paths; the plain membership does not, which is why
it is one control with a role attached rather than four buttons on their own.

### Where it gets its data

In order:

1. `?data=<url>` — any snapshot JSON. `?data=results-sample.json` previews the page
   against the bundled rehearsal set.
2. `results.json` sitting next to it — a **frozen** snapshot. Wins if present.
3. Live — the local relay's replay if you're on it, else the Firebase log over plain
   REST (no SDK, no writes). Add `?live=1` to force this past a frozen snapshot.

Demo/rehearsal paths are excluded. If a set contains *only* rehearsal paths the page
shows them rather than rendering blank, and says so in the header.

### Freezing the results

Live works immediately after the event with no extra step — but that log keeps growing
and a **Clear everything** wipes it. To pin the night permanently:

**Settings → Public results page → Freeze results.** That downloads `results.json`
(real casts only). Put it in `docs/` next to `results.html` and push. The page then
serves that exact set forever and shows "Final results · frozen &lt;date&gt;" instead of
the live pill.

`assets/og.jpg` is the link-preview image (the aggregate map). Regenerate it from a
1200×630 crop of the map section if you want it to reflect the real night.

## The 3D landscape

Reached from a card on the results page, sitting between the map's figures and What the
map found. That card is a **static WebP** (`assets/landscape-preview.webp`), not an
iframe — the 3D page runs its own canvas pipeline and embedding it would spin up a second
animated renderer inside a page that already has one. The link carries no preload or
prefetch, so nothing about the 3D page costs anything until someone asks for it.
Regenerate the preview by screenshotting the page at a three-quarter angle and cropping
clear of the HUD.

Because it is public it carries the same restrictions as the results page: **no operator
nav** (it would put Settings and Cast Path one tap away), **no `Sync.hello()`**, and the
theme toggle writes with `{broadcast:false}` — a visitor flipping it used to repaint the
live projection and the kiosk. It still *listens* on the sync channel, so it keeps
updating while the night runs.

### Performance

It was redrawing everything sixty times a second whether or not anything had changed.
Now:

- **Paint on demand.** Everything that can alter the picture calls `invalidate()`; an
  idle scene paints nothing at all.
- **Native dashing.** The floor grid used a hand-rolled dash loop — ~250 `stroke()` calls
  per grid line, several thousand a frame before a single route was drawn. `setLineDash`
  does it in one. This was the single biggest cost.
- **Detail drops while moving.** Curves sample every 2nd or 3rd point during a drag,
  auto-rotate or playback, and return to full detail once it settles. The still frame
  anyone actually looks at is never degraded.
- **Colours resolved once** per path in the geometry cache rather than rebuilt per run
  per frame, and the composite/join state is set once for the whole pass.

Other behaviour worth knowing: **Hide paths** no longer silences playback — with something
playing it clears the surrounding traffic but keeps the path being drawn, so the terrain
can be read while a single route traces over it. Stations **ping** as the drawing tip
reaches them, an expanding ring and a flare on the cap, in orbit and in the fly-through
alike. And the theme is shared with the results page through the same `localStorage` key,
so arriving from one to the other doesn't switch appearance mid-journey.

Measured on this machine: 61 paths went 18.1 ms → 2.0 ms per paint; a synthetic 300-path
night sits at 7.8 ms full detail and 3.6 ms while moving.

## Landscape controls

**Camera** — one pointer rotates (unrestricted, including straight down or from
below). Two fingers pinch to zoom and drag to pan; with a mouse that's wheel and
middle-drag. **Double click or double tap resets** the framing — there is no reset
button and no `R` key, because one gesture that works identically on both devices
needs no legend. `Space` toggles auto-rotate, `P` saves a PNG.

The top-left card names what is on screen — one journey while the playlist runs, the
whole field otherwise — and links through to that path on the results page. **Fly the
path** sits under the transport controls rather than in the corner cluster; it is the
best thing the page does and nobody was finding it. The corner icons are paths on/off,
fullscreen, and theme.

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
four mood categories gets its own region of the field; a minimum clearance between
name plates is enforced so labels don't collide from phone up to 1440p projector.
