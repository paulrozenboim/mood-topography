# The Mood Topography

**A live data-sculpture about how people got to where they are.**

Made for **Manifest — the Who Cares Festival** (מניפסט ~ פסטיבל "מה זה משנה"), and the
final exhibition of the מה זה משנה art lab. Teder, Beit Romano, Derech Yaffo 9, Tel Aviv.
19 August 2026, 18:00.

---

## The piece

Thirty-six human states are laid out as a transit map — Apathy, Grief, Doubt, Solitude,
Routine, Trust, Solidarity, Curiosity, Resilience, Hope — grouped into four regions the
way a metro map groups its lines:

| | |
|---|---|
| **Friction & Resistance** | what gets in the way |
| **Foundations & Reflection** | what holds still |
| **Connection & Empathy** | what happens between people |
| **Momentum & Vision** | what moves |

A visitor is asked one question:

> ### What path brought you to now?

They anchor the station where this chapter of their life began, then trace a route of
three to ten stops through what they crossed to get here, ending exactly where they
stand today. There is no timer, no right answer, and no shared route.

The moment they cast it, their path leaves the kiosk and joins a projection on the wall,
where every path from the night is drawn on top of every other. The wall announces each
arrival before drawing it — *new path detected* — so the person who cast it has time to
look up and watch their own route appear among the others. Then it says what it has
found: the heaviest link, the busiest interchange, the station nobody has been near, the
one person who walked a route nobody else did.

They leave with a thermal-printed receipt — their own constellation, a code, and a QR to
the map of everyone.

## What it's arguing

The lab asked what difference an individual action makes. This piece answers by building
something that does not exist without one.

The map starts empty. Every route on it was traced by somebody who chose to stop and
trace it, and the shape of the thing — which links are bright, which stations are
crowded, which corners never get visited — is nothing but the sum of those choices. A
path added at 21:40 changes what the wall says at 21:41. Nobody's route is anonymous in
aggregate; it is *legible* in aggregate.

And the question is deliberately backwards-looking. It doesn't ask where you're going,
which is easy to answer and costs nothing. It asks what you crossed to get here — which
is a claim that the route mattered, that arriving at Hope by way of Grief is a different
thing from arriving at it by way of Curiosity, and that a room full of those routes says
something a room full of destinations wouldn't.

**It is not a piece about everyone turning out to be the same.** A seven-stop route is
one of about sixty-six billion, and on the first thirty-six real casts, thirty-five were
unlike any other. Nobody walks your road. Looking for people who did was the wrong
question, and the readings that hunted for it sat silent all night waiting for a
coincidence.

What the room actually produces is overlap. Eleven journeys ended at Hope by ten
different roads. Four set out from Frustration and finished in four different places.
Forty-seven per cent of the room crossed Vulnerability at some point, no two of them the
same way. That is the finding, and it is a better one: **shared infrastructure, not
shared itineraries.** You are not alone on the map, and you are not a copy of anyone on
it either. The wall says that, and the results page lets you click your own starting
station to meet the strangers who stood there too.

## The three surfaces

**The kiosk** — a tablet, one question, a field of 36 stations. Tap to anchor, tap or
drag through the rest, cast. Ends with a receipt.

**The wall** — the live aggregate. Overlapping routes blend additively, so the segments
many people share burn brighter than the ones only one person walked. Between arrivals it
cycles through what it can see in the accumulated data and writes it out in short
bulletins.

**The map afterwards** — a public page anyone can open, on a phone, from the QR on their
receipt. Their own route is picked out of the collective one; clearing the search leaves
them in everyone else's. It is searchable by station, by route, by the part a station
played in a journey, and it carries a 3D view where each station's height is how many
people passed through it.

## The receipt

```
         SEE THE RESULTS
             [ QR ]
      ┌──────────────────┐
      │  YOUR PATH CODE  │
      │    MT-45FVYX     │
      └──────────────────┘
  Enter it under "Every journey"
    to find your route again
```

The two halves do different jobs. The **QR opens everyone's map**; the **code finds
yours**. It used to be one job — the QR arrived pre-filtered to the scanner's own path,
which meant a gallery of exactly one card, and people read that as the whole thing and
never scrolled.

The physical object matters. It is the part that leaves the building — a private artefact
of a public act, and the thing that lets someone find their own route again a week later
among four hundred others.

## Where things are

| | |
|---|---|
| `/` | the public results map — what you share afterwards |
| `landscape.html` | the 3D terrain, also public |
| `backstage.html` | the operator menu — everything below is reached from here |
| `tablet.html` | the kiosk |
| `projection.html` | the wall |
| `settings.html` | live controls, demo paths, freezing the results |
| `archive.html` | every path cast, as a grid |

Live at **paulrozenboim.github.io/mood-topography**.

## Running the night

1. Open `projection.html` on the wall, `tablet.html` on the kiosk. Both should show a
   green **Live** dot — if one is amber or red, it is not talking to the other.
2. **Settings → Demo paths → off** before anyone arrives.
   Set **Seconds per view** there too if 15 feels wrong for the room.
3. **Settings → Clear demo paths** once there is something real to show.
4. Reload the kiosk if it has been open since before a deploy — a red band appears when
   it would otherwise print a dead QR code.
5. Afterwards: **Settings → Freeze results** pins the night permanently.

Everything else — the sync model, the search grammar, what happens when the wifi drops,
how the receipt is typeset, why the auto-pilot stays off the wire — is in
**[TECHNICAL.md](TECHNICAL.md)**.

## Built with

No framework and no build step. Vanilla JavaScript, canvas 2D, a hand-rolled 3D
projection, variable fonts bundled locally, a QR library vendored, and a Firebase
Realtime Database doing nothing more than passing messages between two devices. It runs
from a folder of static files, which is the point: it has to work on venue wifi, on a
laptop hotspot, or on nothing at all.

Made by [@unapaulogetic_](https://www.instagram.com/unapaulogetic_).
