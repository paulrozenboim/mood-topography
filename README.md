# The Mood Topography

A live data-sculpture for **Who Cares**, the final exhibition of the מה זה משנה art lab,
shown at the Manifest Festival at Teder — Beit Romano, Derech Yaffo 9, Tel Aviv,
19 August 2026.

The event is named in one place per surface and nowhere else: `EVENT_DEFAULTS` in
`assets/results.js` (and the matching block in the Freeze payload in `settings.html`) for
anything read off the data, and the print-credit rows in `tablet.html` / `view.html` for
the receipt. Keep it **Latin-only** — the bundled Archivo and Martian Mono carry no Hebrew
glyphs, so the lab's Hebrew name comes out as tofu on a 72mm thermal roll. "Who Cares" is
the exhibition's own English title and stands in for it.

Participants
trace a path across 36 human states on a tablet, and a public projection aggregates
every path into a shared civic map, narrating what it finds in short bulletins as
the night goes on.

## Pages

All under `docs/`:

- `index.html` — the **public results page**. This is the site: a bare
  `…/mood-topography/` lands a stranger on the map, not on the controls. See below.
- `backstage.html` — the operator landing, the menu of every page. It used to be
  `index.html`, which meant anyone who trimmed a URL back to the slash arrived at a
  tile linking straight to Settings. Renaming it is the fix.
- `results.html` — a redirect to `./` that keeps its hash. Receipts printed before the
  move point at `results.html#q=MT-…`; **do not delete it.**
- `tablet.html` — the **Cast Path** kiosk. **One question: "What path brought you to
  now?"** Anchor the station where this chapter began, then tap or drag through 3–10 more,
  ending exactly where you stand today. Ends with a receipt modal (constellation + QR).

  The direction matters and everything downstream assumes it: **the first station is the
  past and the last one is the present.** An earlier version asked where you are now and
  where you are heading, which pointed the data the other way and made "destination"
  mean something still ahead. If the question is ever reworded again, the copy that
  describes it lives in three places — the kiosk prompt and both instruction lines, the
  results page's "How it worked", and the position filter labels in `results.js`.

  The draw-phase instruction is **written twice** — once in the markup and once in
  `instrDraw.innerHTML` near the top of the script, which rebuilds it from `MIN_STOPS`
  and `MAX_STOPS` so the numbers can't drift. The JS runs at load and wins, so an edit
  made only in the HTML never reaches the screen. Change both.
- `projection.html` — the public wall. Live aggregate map, per-bulletin animations,
  auto-pilot cycling.
- `landscape.html` — 3D terrain view, **also public**: linked from the results page and
  opens in its own tab. Station height is traffic, paths arc between them as gradient
  curves. Has a path player and a first-person fly-through.
- `settings.html` — operator controls: filter, theme, seed/clear, sync mode, archive.
- `archive.html` — every path cast this session as a grid; click to open its keepsake.
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
             [ QR ]              → …/mood-topography/#q=MT-45FVYX
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

The receipt modal is used twice in a row for the same person — preview, then the cast state
with the QR and code added. That second state is ~235px taller, and because the veil centres
the modal, committing used to throw the drawing 118px up the screen. The modal now has a
**fixed height** and the constellation box flexes: the QR block slides in underneath and
nothing above it moves. Measured at zero shift on every viewport from 375px up; below about
340px wide there is genuinely not enough room and it scrolls.

There is also only **one code on the receipt** now. It used to carry `№ CNDEATR` — the
internal storage id — a few centimetres above `MT-45FVYX`, with no way to tell which one
the search box wanted.

## Who can reach what

Two public pages — `index.html` and `landscape.html` — and everything else is the
operator's. That split is enforced by three things, none of which is a password:

- **The public page is the root.** Trimming a URL back to the slash, the one thing
  people actually do, lands on the results page.
- **The operator landing is `backstage.html`**, a name nobody types on a guess.
- **Every operator page carries `<meta name="robots" content="noindex, nofollow">`**,
  so they stay out of search results — the other way people arrive somewhere they were
  never linked to.

Be clear about what this is: obscurity, not access control. `settings.html` is still
served to anyone who types it, because GitHub Pages has no server-side auth to hang a
login on. It raises the bar past wandering and stops there. If you ever need more than
that, the honest options are moving the operator pages into a folder with an
unguessable name, or not deploying them at all and running the booth off the local
Python server.

## The results page

`index.html` is the one page built for strangers on phones rather than for the
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
   roles a station was never cast in (visited at all / a starting point / an end point /
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

### When a path is cast

Four beats on the wall, and the first one exists entirely because of what it looks like
from the floor. Someone hands the tablet back and walks to where they can see the
projection; that takes a few seconds. The drawing used to start immediately, so by the
time they looked up their path was already sitting there among all the others,
indistinguishable from them.

```
 0.0 s   NEW PATH DETECTED — a loader bar fills, status lines count it in
 6.0 s   the path draws itself across the map
10.5 s   what the map makes of it
 ~12 s   auto-pilot resumes
```

The bar is the clock: it shows how long, so the pause reads as anticipation rather than
as the wall having stalled. The status lines underneath name the path as it arrives
("Reading 7 stations", "Finding its place among 41 journeys"), so the wait has something
countable in it.

For the whole sequence the wall holds: no bulletin rotation, no filter rotation, and —
while auto-pilot is in charge — the full map, so the new route is seen joining the others
rather than arriving into a filtered frame. **That hold is also a bug fix.** Rotating to
"heaviest links" fifteen seconds after someone cast would drop their brand-new path
straight back off the map, which is exactly what it looked like when a path "didn't
show".

A second cast landing mid-sequence takes over rather than layering on top — two people
casting twenty seconds apart is normal, and two overlapping countdowns would be nonsense.

**The readings** run as a full-bleed strip that drifts sideways on its own. A mouse over
it stops it for as long as the pointer stays. Any hand-scroll — drag, wheel, swipe —
parks it for ten seconds and then it picks up again on its own, which is the only
control a touch device has.

Both animations idle when scrolled out of view or when the tab is hidden, and neither
runs at all under `prefers-reduced-motion` — the map stays on its finished frame and the
strip stays hand-scrollable.

### On a phone

`style.css` sets `canvas{touch-action:none}`, which is right for the projection and the
kiosk — there, every drag is a gesture the canvas owns. On a page that scrolls it means a
finger landing on the map or on a card just stops the page dead. This page overrides it
back to `auto`: nothing here drags, the map only takes taps.

A `<canvas>` also cannot be long-pressed and saved the way an `<img>` can, and a six-character
code inside a row of chips is not realistically selectable with a thumb. So the journey
lightbox has two explicit controls instead: a **download** button over the picture, which
re-renders the constellation offscreen at 700×450 CSS (a 1400×900 PNG at 2×) rather than
exporting the small on-screen one, and the **path code itself is a button** that copies.
Both flash a tick for a beat — a control that looks like it did nothing gets pressed again.

Station names are placed by the same greedy collision-aware placer the printed receipt
uses (`placeStationLabels` in `core.js`). They used to be drawn at a flat offset below each
dot with no collision test and no clipping guard, which is invisible on a 620px desktop
modal and a mess on a 330px phone — measured at that size, 2 pairs of names overlapped and
6 ran off the canvas; on a card thumbnail it was 8 and 8. It is now zero in both. Type and
dot size scale with the canvas. **The receipt is untouched by this** — print output was
compared pixel-for-pixel across five paths before and after, and is identical.

It is deliberately **read-only and standalone**: it loads neither `store.js` nor
`remote-config.js`, writes nothing to localStorage beyond its own theme, and never
sends on the sync channel. Nothing a visitor does can touch the show.

### Searching

The search box takes three shapes, decided by what's typed — no mode to set first:

- **A station** (`hope`, `vuln`) — partial names resolve as long as they're
  unambiguous. A dropdown then asks what part it played: anywhere on the path, as a
  starting point, as an end point, as a connection, or **not used** — journeys that
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
(real casts only). Put it in `docs/` next to `index.html` and push. The page then
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

### Staying in sync

Three things that were silently missing, all found by a path not showing up on the
wall during a home run-through:

**The connection retries.** The probe used to run once. If the venue's wifi hiccuped
during the second the page happened to load, that page spent the rest of the night on
BroadcastChannel — every cast landing in the kiosk's own localStorage and nowhere else.
A failed attempt now schedules another, backing off to a 30-second heartbeat, and
`store.js` keeps watching for a transport to appear instead of giving up after six
seconds.

**Nothing durable is dropped.** A `path` or `remove` sent while there is no transport
goes into an outbox, persisted to localStorage, and flushes in order the moment one
arrives — across a page reload if need be. Only those two kinds are queued: a `filter`
or `theme` arriving twenty minutes late describes a moment that has passed, and would
be worse than losing it. Replays are safe; `addPath`/`removePath` both no-op on an id
they already know.

**It says so on screen.** Every operator surface carries a live pill
(`assets/syncpill.js`): a green dot for connected, an amber blinking one while
connecting, and on the kiosk a red band naming how many casts are waiting. This is the
whole point — the failure is otherwise completely invisible. The kiosk keeps accepting
paths, keeps printing receipts, and looks perfectly healthy while none of it reaches
anywhere.

The pill only reports; there is no button. Reconnection and flushing happen on their own.

### Auto-pilot stays off the wire

The wall's view rotation is **local to the wall**. It used to broadcast, which meant one
permanent message every 14 seconds — 257 an hour. Measured on a real log, **82% of the
night's messages were view changes** rather than anything that happened, which flooded
the replay window every other client hydrates from: at `limitToLast(500)` the window
held under two hours, so a laptop opened late to freeze the results would have replayed
no paths from the first half of the event and written an incomplete snapshot.

A manual choice in Settings still broadcasts and still locks the wall. Only the cycling
is local. The trade is that while auto-pilot is running, Settings no longer highlights
which view is currently up — it says so on the page. The replay cap is now 5000 as a
backstop.

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
