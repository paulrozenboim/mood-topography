/* ============================================================
   LIVE SYNC STATUS — a standing answer to "is this thing talking to the wall?"

   Every operator surface gets the same small pill. It is not decoration: the
   failure it exists to show is completely silent otherwise. If the transport
   never comes up — a wifi blip during the second the page happens to load —
   the kiosk keeps accepting casts, keeps printing receipts, keeps looking
   perfectly healthy, and none of it reaches the wall or the cloud log.

   Three states:
     live      the transport is up (local relay or cloud). Quiet green dot.
     waiting   still connecting, or reconnecting after a drop. Amber, pulsing.
     holding   offline AND casts are queued in the outbox. Loud, and it says
               how many are waiting, because that number is the thing an
               operator would want to know before deciding to reload anything.

   Nothing here is a control — there is no button to press. remote-config.js
   retries on its own and store.js flushes the outbox when it succeeds. The
   pill only reports.
   ============================================================ */
"use strict";

function initSyncPill({corner = "bl", loud = false, mount = null} = {}){
  const pill = document.createElement("div");
  // `mount` drops it into an existing chrome cluster (the kiosk's corner
  // buttons) instead of pinning it to a screen corner. The kiosk has no free
  // corner: the head spans the full width and the foot carries the route strip
  // and the cast button, so a floating pill sits on top of something whatever
  // corner it picks.
  pill.className = "sync-pill " + (mount ? "inline" : corner);
  pill.innerHTML = '<i></i><span class="sync-pill-text"></span>';
  (mount || document.body).appendChild(pill);
  const text = pill.querySelector(".sync-pill-text");

  Sync.onStatus((mode, info = {}) => {
    const pending = info.pending || 0;
    const live = !!info.live;
    // "local"/"cloud" only mean anything once a transport was actually adopted.
    // Before that, mode still reads "local" from its initial value, which is
    // exactly the ambiguity that made the silent failure invisible.
    const state = live ? "live" : (pending ? "holding" : "waiting");
    pill.dataset.state = state;
    // The kiosk shouts, because there it means receipts are being printed for
    // paths the wall will never show. Elsewhere it is a quiet read-out.
    pill.classList.toggle("loud", loud && state === "holding");

    text.textContent =
      state === "live"    ? (mode === "local" ? "Live · local relay" : "Live · cloud")
    : state === "holding" ? `Not syncing · ${pending} cast${pending === 1 ? "" : "s"} waiting`
    :                       "Connecting…";
  });

  return pill;
}
