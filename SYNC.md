# Sync modes

The app runs in one of two sync modes, decided automatically at page-load time
based on where the page is served from. Both use the same `TOPO_REMOTE` contract
inside `store.js` — the rest of the code doesn't know or care which is active.

## Cloud (default)

**When it's active:** you're visiting `paulrozenboim.github.io/topography-of-us/`
or any other host that isn't running `sync-server.py`.

**How it works:** every path/filter/theme/clear is pushed to Firebase Realtime
Database; every other client subscribed to the same database receives it in
real time. Works from anywhere with internet.

**Setup:** none. Already wired.

**Fine print:** the Firebase security rules are in test mode for 30 days from
creation. To keep working past that, log into the Firebase console → Realtime
Database → Rules and set `.read`/`.write` to `true`, or wire in auth. For a
nightclub piece with no login flow, permissive rules + URL obscurity is fine.

## Local (for the event night)

**When it's active:** you open the app from `http://<laptop-ip>:8765/` — i.e.
the operator laptop's Python relay is serving both the static site and the
sync endpoints on port 8765.

**How it works:** the tablet and projection connect to the operator laptop's
hotspot. Both point their browsers at the laptop's LAN address. The Python
relay stores messages in memory and streams them via Server-Sent Events to
every subscriber. No internet is touched at any point.

**Setup on event night:**

1. On the operator laptop, from the repo root:
   ```
   python sync-server.py
   ```
   The banner it prints tells you two URLs — the localhost one for the laptop
   itself, and the LAN one for other devices.

2. Turn on the laptop's Mobile Hotspot (Windows: **Settings → Network &
   Internet → Mobile hotspot**; macOS: **System Settings → General → Sharing →
   Internet Sharing**).

3. On the iPad, join the hotspot. Open the LAN URL from step 1 in Safari —
   this becomes the tablet's page for the night. Bookmark it.

4. On the projection laptop, open its own browser to the same LAN URL (or
   `http://localhost:8765/` if it IS the operator laptop) and pull up
   `/projection.html`.

5. Everything syncs through the relay. The **Sync mode** panel in Settings
   confirms "Local — via this laptop's relay".

**How to know it's working:** on the operator laptop's terminal, every path
cast prints a `POST /send` line. On the Settings page's top status pill, the
mode shows "Connected — local relay (this network)".

**Clearing between sessions:** the relay holds up to 5000 messages in memory,
enough for many nights of casts. Clicking "Clear everything" on Settings wipes
the log too. Restarting `sync-server.py` also wipes it.

## Offline fallback

If neither Firebase nor the local relay is reachable, `store.js` falls back to
`BroadcastChannel` — same-device tab-to-tab sync only. You'll see the Sync
mode panel report "Offline — this device only". Cast a path in one tab and it
still appears in another tab on the same browser; two separate devices don't
see each other.

This exists so a single-laptop rehearsal still works even without any network.
