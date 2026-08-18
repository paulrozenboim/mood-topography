# The Mood Topography — technical notes

Everything operational, in the order you'd need it. The conceptual description of
the piece is in [README.md](README.md); this file is the manual.

**The one thing that cannot be fixed afterwards:** `PUBLIC_BASE` in
`docs/assets/core.js` is the URL printed on every receipt. Check it before a print
run — paper cannot be patched. See *The printed receipt* below.

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

Every receipt carries a QR to the **results page** and the path as a typed code
underneath. The two do different jobs on purpose — **the QR opens everyone's map, the
code finds yours**:

```
         SEE THE RESULTS
             [ QR ]              → …/mood-topography/
      ┌──────────────────┐
      │  YOUR PATH CODE  │
      │    MT-45FVYX     │
      └──────────────────┘
  Enter it under “Every journey”
    to find your route again
```

The QR used to carry `#q=<their code>`, so scanning landed on the collective map with
their own route already picked out of it. It read well in theory and badly in the room:
the journey gallery showed a single card, which looks like the whole gallery, and nobody
scrolled past it. It now opens the page unfiltered. Anyone who wants their own route back
types the code — which is also what they read out to a friend. Receipts already printed
with `#q=` still resolve, since the search box has not changed.

**The kiosk screen shows no QR**, only the code. The receipt in the participant's hand
carries the same one and the operator hands it over; a second copy on the glass only made
the modal taller and invited people to scan a tablet they were about to give back. The
code stays on screen because if the printer jams, that box is the only thing left.

### Printing leaves the canvas in print mode

`beforeprint` schedules a deferred redraw as a backup for browsers that apply print styles
late — but **the print dialog freezes `requestAnimationFrame`.** On Chrome the callback did
not run until the dialog closed, which is *after* `afterprint` had already restored the
screen render, so the print draw landed last and stayed: the constellation sat at 249px on
a white ground, a third of its box, until the modal was reopened. Both `tablet.html` and
`view.html` now carry a `printing` flag that the deferred draw checks. If you add another
deferred draw around printing, guard it the same way.

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

### Naming the event

**Manifest** is the festival. **Who Cares** (מה זה משנה) is what the festival is called.
**Teder** is the venue, inside **Beit Romano**, Derech Yaffo 9, Tel Aviv. In English that
composes as *Manifest — Who Cares Festival*; in Hebrew, מניפסט ~ פסטיבל "מה זה משנה".
Getting that order wrong reached a printed receipt once already.

Keep every string that can reach paper **Latin-only.** The bundled Archivo and Martian
Mono carry no Hebrew glyphs — verified against their cmap tables, not assumed — so the
Hebrew name comes out as tofu on a 72mm thermal roll, with RTL to argue about on top.
`—`, `·` and `~` are all present and safe.

The name lives in four places and nowhere else:

- `EVENT_DEFAULTS` in `assets/results.js` — everything the results page reads off data
- the matching `event` block in the Freeze payload in `settings.html`
- the print-credit rows in `tablet.html` and `view.html` — the receipt
- the header lines on `backstage.html` and `projection.html`

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

It is deliberately **standalone**: it loads neither `store.js` nor `remote-config.js`,
writes nothing to localStorage beyond its own theme and a session flag, and never sends
on the sync channel. Nothing a visitor does can touch the show.

The one thing it writes is a visit record — see below. That goes to `/visits`, a node
nothing subscribes to, precisely so it can never be replayed into the wall.

### The visitor counter

A bare number at the foot of the results page and the 3D view, with no label, because
the only person it means anything to already knows what it counts. `assets/visits.js`,
loaded by both.

One record per browser session: `{ t: <epoch ms>, p: "results" | "landscape" }`. That is
the entire payload — no address, no fingerprint, no referrer, nothing that distinguishes
one visitor from another. Only that somebody opened a page, and when.

It does not count `?demo=1` or `?visits=1`, since both are the operator's own hatches,
and a reload inside one session is not a new person.

**`?visits=1` is the "and when" half** — total, first and last, the last hour, the last
24 hours, a split by page and a count per day. Rendered only for somebody who typed it
into the address bar, so it can afford to be legible.

Everything in there fails silently. A counter is not worth one pixel of a broken results
page, so a failure leaves the number blank rather than showing an error to a stranger.
`sessionStorage` throwing (Safari private browsing) takes the same path.

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

Only the cycling is local. The replay cap is now 5000 as a backstop.

### What the bulletins look for

Five readings were removed and five added. **Exact repeats essentially cannot happen** —
a seven-stop route is one of about 66 billion — so "Well-worn path" (`N of you traced the
exact same route`) was waiting all night for a coincidence. Three others ("Average
journey", "Kept it short", "Went the distance") were arithmetic about the data rather than
anything about the room, and "Widest reach" described one path's geometry.

In their place, five that measure overlap. The table below is a **smoke test against a
rehearsal set, not a finding about people** — every cast in the log so far was made by the
artist while building this. It shows the five fire and produce sensible sentences on
realistic input; what a room of strangers produces is what the night is for.

| tag | on the rehearsal set |
|---|---|
| **Convergence** | 11 journeys ended at Hope, by 10 different roads |
| **Divergence** | 4 started at Frustration and ended in 4 different places |
| **Shared road** | 3 crossed Resilience, Vision and Hope back to back |
| **Different roads** | 4 went Conflict → Hope, by 3 different routes |
| **Common ground** | 47% of the room passed through Vulnerability |

Computed in `_analyse()` as `convergence`, `divergence`, `sharedRun`, `sameEnds` and
`crossing`. Two details worth keeping:

- `touched[]` counts how many paths *reach* a station, not how many times it is visited.
  Using `traffic[]` would let a path that doubles back count twice and push a percentage
  above the size of the room.
- **"Shared road" only claims "no two of you walked the same route" when that is true.**
  `A.repeatTop` is set the moment any two paths match exactly, and it does occasionally
  happen. The wall must not assert something its own data contradicts.

`castBulletin()` gained the same idea per-cast — the stretch this path shares with the
most other people — and "Full spectrum" is gated to the first four, because roughly two
thirds of paths touch all four categories and it was firing 13 times in 36 casts to
announce "one of 24 tonight to do so".

### Shared stretches

The charts used to be two fixed panels: segments (two in a row) and runs (three).
`runs(paths, n)` now counts every stretch of length `n`, direction-folded, cached per
length, and the numbers section builds **one block per length from 2 to 10** — rendering
only the lengths where something was walked by more than one person. Most of the night
that is 2 and 3; the page grows a "Shared runs of 5" heading the first time five people's
worth of road lines up, and loses it again if the data never gets there.

Every row is a button that opens the journeys that walked it.

**The counts are direction-folded, so the search a row opens has to be too.** That is what
the `run` order mode is for: back to back, either direction. Without it a row saying 6
would open a list of 4 and the page would be caught contradicting its own chart. The mode
is a normal member of `ORDER_MODES`, so it shows in the match chips, survives in the hash
(`&order=run`) and restores from a shared link.

Verified by planting three journeys sharing a five-station run with one of them walking it
**backwards**: the row reports 4 and the click returns all 4, the reversed one included.

### The lightbox is a pivot, not a receipt

Opening a journey used to end on "Route traced by this person alone", which is true of
very nearly every path and therefore says nothing. It now carries three ways out:

- two **pivot buttons** — *N others started at X*, *N others ended at Y* — that close the
  lightbox and re-filter the page onto those strangers, leaving a hash like
  `#q=Hope&pos=end`;
- **the journeys that walked with you** — every other path that shares a stretch of road,
  ranked by how long that stretch is, each one opening that journey. The lightbox becomes
  something you can walk along.

  The first version listed *segments* instead: "Hope › Routine — 2". It named a piece of
  your own route and a number, and left you to work out that the number was people. The
  question worth answering is who came closest to walking with you, and for how far.

  It shows six and expands. An earlier "see all N in the grid" button filtered on the
  path's **first segment** — two arbitrary stations with nothing to do with the journeys
  it had just counted, so it named one number and showed a different set. Expanding in
  place is the honest version of the same offer.

The pivot buttons go through `showRun()`, the same entry point the chart rows use.

### Two lanes of readings

The strip is two rows drifting against each other, readings alternating between them so
neither ends up carrying all the long cards. One row is a ticker; two moving opposite ways
reads as a field of things being said at once, which is nearer to what the wall feels like
in the room. The second lane is `aria-hidden` — same readings, split for rhythm, and a
screen reader should hear each once. It hides itself when there is not enough for two.

Each lane keeps its own pause state, so hovering one does not stop the other. The
right-drifting lane is parked on the seam between the duplicated copies at start-up,
because it has nowhere to go from a `scrollLeft` of 0.

Behind the constellation, up to eight **ghosts**: the routes of others who ended where
this one did, drawn faintly via `opts.ghosts` in `renderConstellation`. They are
deliberately excluded from the bounding-box calculation — including them would shrink the
path you opened the lightbox to look at, and a ghost running off the edge is the honest
picture anyway. Print ignores them; the receipt stays one clean line.

Tuned by measurement rather than by eye: at the first alpha they were **two thirds of the
ink on the canvas**, which inverts the picture the frame exists to make. At 0.16 dark /
0.20 light the path's peak intensity is untouched and the mean halves — present, clearly
secondary. (If you re-measure this: `renderConstellation` reads `--bg-2` from the live
document, so you must set `documentElement.dataset.theme` too, not just pass a theme
argument. Passing `"light"` to a dark document composites onto black and draws nothing.)

### The wall's views

Six of them, cycled in this order: the whole map, the last twelve journeys, the heaviest
links, Friction & Resistance alone, the whole map again, Momentum & Vision alone. The
rotation lives in `tick()` on `projection.html` rather than on its own timer, so the
dwell time can change under it with nothing to tear down.

Settings used to offer nine hand-pickable views. They were VJ controls for a show that
turned out to run itself — the only one ever reached for was the on/off — so they are
gone, replaced by the thing that was actually missing: **Seconds per view**, defaulting
to 15, clamped to 4–120. The floor is there because the cast choreography alone runs
twelve seconds and anything shorter reads as a flicker. That setting *does* broadcast,
but only when the operator changes it, which is not the same as once per cycle.

Rotation holds in three cases: auto-pilot off, the bulletin transport paused from the
projection's own menu (they read as one thing from the floor, and a pause that left the
map cycling was the wrong answer to what the button looks like it does), and for the
whole of a cast.

Because no UI can pick a view by hand any more, `projection.html` corrects any filter the
rotation does not own — a `blank` left in localStorage, or one arriving in a state
handshake from a device nobody reloaded — back to the full map. It is checked on every
store event rather than only at load: the handshake lands asynchronously and used to
overwrite a load-time correction a moment after it ran.

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
