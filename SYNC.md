# Sync modes

The app runs in one of two sync modes, decided automatically at page-load time
based on where the page is served from. Both use the same `TOPO_REMOTE` contract
inside `store.js` — the rest of the code doesn't know or care which is active.

## Cloud (default)

**When it's active:** you're visiting `paulrozenboim.github.io/topography-of-us/`
or any host that isn't running `sync-server.py`.

**How it works:** every path/filter/theme/clear is pushed to Firebase Realtime
Database; every other client subscribed to the same database receives it in
real time. Works from anywhere with internet — including from a phone hotspot,
including in a nightclub basement, as long as the hotspot itself has signal.

**Setup:** none. Already wired.

**Fine print — Firebase security.** The Realtime DB is in test mode for 30 days
from creation. To keep working past that, log into the Firebase console →
Realtime Database → Rules and set `.read`/`.write` to `true`, or wire in Auth.
For a nightclub piece with no login flow, permissive rules + URL obscurity is
enough.

## Local (event-hardened, zero internet)

**When it's active:** you open the app from `http://<laptop-ip>:8765/` — i.e. the
operator laptop's Python relay is serving both the static site and the sync
endpoints on port 8765.

**How it works:** the tablet and projection connect to a network (any network —
laptop hotspot, phone hotspot, travel router, whatever). Both point their
browsers at the laptop's LAN address. The Python relay stores messages in
memory + appends them to `sync-log.jsonl` on disk, and streams them via
Server-Sent Events to every subscriber. No internet is touched at any point.

**Durability.** On startup, `sync-server.py` reloads `sync-log.jsonl` from disk.
So a laptop reboot, a Ctrl+C, or a crash never loses the night's casts. The log
file is `.gitignore`d so it stays on the operator's machine.

**Setup on event night — the network:**

Three ways to get both devices on the same LAN. Pick the one that fits.

1. **Phone hotspot** (works with any phone that has cell signal — iPhone,
   Galaxy, Pixel).
   - Phone: turn on Personal Hotspot / Mobile Hotspot.
   - Laptop: Wi-Fi menu → join the phone.
   - iPad: Settings → Wi-Fi → join the phone.
   - Works even if cell signal drops — the phone is still a local Wi-Fi router,
     clients on it can still reach each other.

2. **Travel router** (the most reliable, ~$25).
   - GL.iNet Beryl, TP-Link TL-WR902AC, or similar.
   - Plug into any USB port for power, it broadcasts its own Wi-Fi.
   - Laptop + iPad both join.
   - No cell signal needed. No phone battery drain.

3. **macOS Internet Sharing** (works, but with caveats).
   - Only works if you have an actual connected source interface (Ethernet with
     a live cable is safest — the Ethernet doesn't need working internet, but the
     cable has to be plugged in for macOS to consider the interface "up").
   - System Settings → General → Sharing → click the ⓘ next to "Internet
     Sharing" → "Share from" some real interface → "To devices using: Wi-Fi" →
     set the Wi-Fi name/password → back on the pane, toggle Internet Sharing ON.
   - iPad joins that Wi-Fi. Laptop is at `192.168.2.1`.
   - Note: you can NOT share Wi-Fi to Wi-Fi (same radio). You can NOT enable it
     with no source connected.

**Setup on event night — the server:**

1. On the operator laptop, from the repo root:
   ```
   python3 sync-server.py
   ```
   The banner prints two URLs — the localhost one for the laptop itself, and the
   LAN one for other devices.

2. On the iPad Safari, open the LAN URL. Add to Home Screen so it opens
   full-screen without Safari chrome.

3. On the laptop, in a browser, open `http://localhost:8765/projection.html`
   (loopback — never leaves the machine). Press **F** for fullscreen. Attach
   the projector.

4. In a second window on the laptop: `http://localhost:8765/settings.html`.
   The Sync mode panel should say **"Local — via this laptop's relay"** on both
   the laptop and the iPad.

**How to know it's working:** on the operator laptop's terminal, every path cast
prints a `POST /send` line. On the Settings page's status pill: "Connected —
local relay (this network)".

**Clearing between sessions:** the relay holds up to 5000 messages in memory
(replay cap) but the on-disk log has no cap. Clicking "Clear everything" on
Settings wipes both the durable log and every client's local state.

## Offline fallback

If neither Firebase nor the local relay is reachable, `store.js` falls back to
`BroadcastChannel` — same-device tab-to-tab sync only. Cast a path in one tab and
it appears in another tab on the same browser; separate devices don't see each
other. The Sync mode panel reports "Offline — this device only".

Useful for single-laptop rehearsal with no network at all, or as a "everything
else failed" degradation path.

## The event plan

For Democracy Week Tel Aviv 2026 at Teder, the current plan is:

- **Galaxy hotspot** on for both the MacBook and the iPad.
- The MacBook and iPad both open `https://paulrozenboim.github.io/topography-of-us/`
  — GitHub Pages URL, cloud (Firebase) mode active.
- Everything syncs through Firebase over the phone's cell connection.
- **Fallback if signal fails during the show:** `git clone`d local copy is on the
  MacBook at `~/Desktop/topography-of-us`. Run `python3 sync-server.py`. Both
  devices reload against the LAN URL. Sync continues via the local relay, no
  internet needed.
