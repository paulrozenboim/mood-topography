# The Topography of Us — Project Status

*Last updated after the multi-page rebuild + nav/legibility pass.*

## What this is

A live data-sculpture for Democracy Month Art Lab at Teder, Tel Aviv. Participants
trace a path across 36 human states on a tablet — where they are now, where they're
heading — and a public projection aggregates every path into a shared civic map,
narrating what it finds in short bulletins as the night goes on.

## Where it stands

**Structure.** A real multi-page site (`docs/`), not a single-file SPA — ready to push
straight to GitHub Pages. Four pages, each its own bookmarkable URL:

- `index.html` — landing page, links to the other three
- `tablet.html` — the kiosk. Anchor a station, drag through 3–10 more, no timer,
  Mini Metro–style undo (drag back over a station to erase to that point), a
  print-ready "constellation" preview before casting
- `projection.html` — the public wall. Aggregate map, pan/zoom, dark/light theme,
  an injection animation when a new path is cast, side-mounted live stats, a
  standalone bulletin footer (not an overlay), auto-pilot cycling through views
- `settings.html` — control room. Override what the wall shows, toggle theme, seed
  or clear demo data independently from real casts, watch the live bulletin queue

**Shared core** (`assets/`): station data and the layout solver's output, the canvas
renderer (`MapView`), the aggregate analysis + bulletin-writing logic, and `Store` /
`Sync` — app state cleanly separated from its transport, so a real backend can be
wired in later without touching anything else.

**Station layout.** Solved algorithmically, not placed by hand: each of the four
lines (Friction, Foundations, Connection, Momentum) fills its own region of the
field, semantically related stations pull toward each other across lines, and every
station keeps a hard minimum clearance from every other. Verified collision-free
from a phone screen up to a 1440p projector.

**A small auto-hiding nav** sits on all four pages — a slim handle at the top edge;
tap it for links between pages plus (on tablet/projection) the Theme/Fit controls.
It only opens on deliberate contact with the handle and closes itself after a few
seconds, so it never fights with drawing a path or panning the map.

**Bugs found and fixed along the way** (each confirmed against a running instance,
not just read-through): a header-reflow bug that made the whole map visibly jump the
moment you selected an anchor; idle stations that were nearly invisible with no
data yet; the rubber-band line continuing past the 10-station cap; a light-theme
text color with a measured 2.16:1 contrast ratio (now 4.59:1, clears AA); the seed
button promising to "rehearse the wall" while the bulletin engine silently ignored
demo data; and a bulletin footer that would have reintroduced the jump bug if its
height weren't locked independent of text length.

## What's deliberately not done yet

- **Cross-device sync.** Today's transport is `BroadcastChannel`, which only
  reaches other tabs on the *same* browser, same device — enough to rehearse
  alone, not enough for a tablet and a separate projection laptop. `Store`/`Sync`
  are already shaped to receive a real backend; which one (Firebase, PocketBase on
  Railway, a small Node+SSE server) is still an open decision, deferred on purpose
  rather than guessed at.
- **The live event's own network.** Independent of whichever backend gets wired in
  for rehearsal, the actual Teder night should still run on a laptop acting as its
  own local router — not venue wifi, not the public internet.
- **From the original master document, not yet built:** the generative audio layer
  (Tone.js chords keyed to each line), a physical thermal-printer receipt (today's
  print is a browser print dialog, not real hardware), the QR/Instagram share, and
  the closing before/after morph of the whole night's shape.
- **Gravity currently bends the *arteries*, not the stations themselves** — a
  deliberate legibility trade-off from early on. Worth revisiting once there's real
  data to see whether station-drift would still read clearly.
- **Three station names are still off-register:** Logic, Pragmatism, and
  Observation are cognitive stances where the other 33 stations are felt states —
  flagged early, never resolved.
- **Nothing has touched real hardware yet.** Every check so far is a headless
  browser plus numeric verification (pixel sampling, DOM measurement, contrast
  ratios) — rigorous, but not the same as a hand on an actual iPad under actual
  venue lighting.

## Next steps

- [ ] Decide the sync backend (Firebase / PocketBase+Railway / Node+SSE) and wire
      it in behind the existing `Sync` interface
- [ ] Push to GitHub, enable Pages, and once sync is wired in, test the tablet and
      projection as two genuinely separate devices for the first time
- [ ] Rehearse on real hardware — an actual tablet, actual projector, actual room
      light — to sanity-check contrast, touch targets, and text size in person
- [ ] Resolve Logic / Pragmatism / Observation, or confirm they stay
- [ ] Decide whether to build the generative audio layer, the thermal-printer
      receipt, and the closing morph, or leave them out of this iteration
- [ ] Load-test with rapid concurrent casts once real sync exists — and revisit
      whether one tablet is enough for expected foot traffic, or whether the
      original plan for 2–3 kiosks is still the right call
- [ ] Decide on cold-start seeding for the actual event night (empty at 20:00, or
      pre-seeded with a week of collected paths, as originally discussed)
