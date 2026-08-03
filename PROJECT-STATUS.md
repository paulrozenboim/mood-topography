# The Topography of Us — Project Status

*Last updated after the cross-device sync + archive + self-hosted-fonts pass.*

## What this is

A live data-sculpture for Democracy Month Art Lab at Teder, Tel Aviv. Participants
trace a path across 36 human states on a tablet; a public projection aggregates
every path into a shared civic map, narrating what it finds in short bulletins as
the night goes on.

## Where it stands — shipped

**Six pages, each its own URL.** `index`, `tablet` (labelled "Cast Path" in the
UI), `projection`, `settings`, `archive`, and `view` (the participant-side keepsake
that a phone reaches by scanning the QR on the cast-receipt modal).

**Cross-device sync, both modes wired.** Two clients on two devices are guaranteed
to see the same paths in real time:

- **Cloud** — Firebase Realtime Database. This is what the deployed
  `paulrozenboim.github.io/topography-of-us/` URL uses. Persistent, works over any
  internet.
- **Local** — a zero-dependency Python 3 script (`sync-server.py`) that serves the
  site AND relays messages via Server-Sent Events. Zero internet needed. The relay
  writes every message to `sync-log.jsonl` on disk so nothing is lost across
  Ctrl+C or laptop reboots.

Which mode is active is decided automatically at page-load time via a `/health`
probe. Firebase SDK is only fetched when cloud mode wins, so an offline visitor
doesn't get a 30-second stall waiting on `gstatic.com`.

**Post-cast keepsake.** After a participant casts a path, the receipt modal shows
a QR code and a shareable URL that encodes the path (base36 station IDs) + cast
timestamp into the URL hash. Scanning opens `view.html` on the participant's phone,
which decodes the URL, renders the constellation as a `<img>` (long-press to save on
mobile), and shows credits. The link stays live indefinitely — participants can
re-open it, share it, or forward it after the night.

**Bulletin visualizations.** Every bulletin the wall speaks is paired with a
matched animation on the map: edge traverse for "heaviest link", node pulse for
"busiest station", category glow for "heaviest line", cascade for "just now" and
"went the distance", and so on. See `MapView.drawMotion` in `core.js`.

**Bulletin truthfulness.** Every stat the wall states has been audited: "longest
journey" honestly says "one of the longest" when multiple paths tie; "went the
distance" no longer implies "visited every station on the map"; "sole traveller"
only fires when a path has every edge unique; "direction of travel" uses plurality
language ("the most common anchor…") instead of majority language ("most of you").

**Gradient path strokes.** Every artery — tablet draft, aggregate map, cast
constellation, injection animation, cascade — transitions colour along its length
from each station's line into the next. Draft line while a participant is casting
picks up the current tip's colour on its rubber-band tail.

**Persistence at every layer.**
- Every browser saves to `localStorage` on every mutation.
- Cloud mode: Firebase Realtime DB is the durable log.
- Local mode: `sync-log.jsonl` on disk is the durable log.
- Settings has a one-click "Download as JSON" and a "Import from JSON" that
  preserves each path's original seeded/real flag.
- `archive.html` is a browsable gallery of every path in the current session,
  each rendered as a thumbnail with a link to `view.html` for that path.

**Self-hosted fonts.** Archivo and Martian Mono variable fonts live in
`docs/assets/fonts/`. No Google Fonts CDN request. The whole app runs pixel-perfect
offline.

**Tablet as a locked kiosk.** Nav menu removed from `tablet.html` so participants
can't wander into Settings or Projection. Only a small top-right corner theme
toggle remains for the operator. Opening prompt rotates through six variants
("Where are you right now?", "What state are you in tonight?", …) so returning
participants don't see the identical question twice.

**Layout robustness.**
- Cast-receipt modal is `max-height: calc(100dvh - 40px)` with an internally
  scrolling body and pinned foot — Print + Done buttons are always reachable no
  matter the viewport orientation.
- Settings collapses from two columns to one below 960 px viewport width.
- Instructions on the tablet are centered and enlarged so participants actually
  read them.

**Print path unified with `view.html`.** Same header format, same stops list, same
credits block. Print CSS neutralises the modal transform chain so content flows
from page 1 top (no more blank half-page).

**Credits.** `view.html` and the printed keepsake both credit *@unapaulogetic_* with
a mobile-tappable Instagram link and "Democracy Week · Tel Aviv · 2026".

## Where it stands — not built yet, deferred on purpose

- **The generative audio layer** (Tone.js chords keyed to each line) — from the
  original master document, still not built. Decide close to the event.
- **Physical thermal-printer receipt** — the QR + view.html + save-image flow
  covers the "take-home" need without hardware. Thermal is nice-to-have if you
  want a physical artefact people can pin to a wall.
- **Closing before/after morph** of the whole night's shape — not built.
- **Three station names still off-register:** Logic, Pragmatism, Observation are
  cognitive stances where the other 33 are felt states. Flagged early, not
  resolved.
- **Gravity currently bends the arteries, not the stations themselves** — a
  deliberate legibility trade-off. Worth revisiting if there's ever visible drift
  under real data.

## Where it stands — untested

- **Nothing has touched real Teder hardware yet.** Every check to date is a
  headless browser + numeric verification. Real MacBook + real iPad + real
  projector under real room light is the last unknown.
- **Real concurrent load** on Firebase or on the Python relay. The free Firebase
  tier tolerates 100 simultaneous connections and 10 GB/month transfer — a
  packed night is well within limits, but not yet observed.
- **The venue's own network** at Teder. Both sync paths (cloud over a phone
  hotspot, or offline via `sync-server.py` + a phone hotspot providing only the
  LAN) are ready; which one wins on the night depends on what actually works in
  that basement.

## Suggested next steps

- [ ] Rehearse on real hardware — the actual MacBook + iPad + projector, under
      real lighting. Verify touch targets, contrast, projection size, participant
      flow.
- [ ] Verify Galaxy hotspot at Teder — either on the actual location or somewhere
      with comparable signal conditions. If cell signal is unreliable, plan for a
      travel router or USB-Ethernet dongle as a hardware fallback.
- [ ] Decide cold-start seeding for the actual event night — empty at 20:00, or
      pre-seeded with a week of collected paths.
- [ ] Load-test with rapid concurrent casts. Revisit whether one tablet is enough
      for expected foot traffic, or whether the original plan for 2–3 kiosks
      still holds.
- [ ] Resolve Logic / Pragmatism / Observation, or confirm they stay as-is.
- [ ] Decide whether to build the generative audio layer, the thermal-printer
      receipt, and the closing morph, or leave them out of this iteration.
- [ ] Tighten Firebase security rules before the free 30-day test-mode window
      expires (either flip to always-open or wire in Firebase Auth).
