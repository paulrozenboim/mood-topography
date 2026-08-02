/* ============================================================
   Firebase Realtime Database — implements the TOPO_REMOTE contract that
   store.js looks for. When this file is present and Firebase is reachable,
   every path/filter/theme/clear routes over Firebase; otherwise store.js
   falls back to BroadcastChannel (same-device tabs only).

   Loaded on tablet.html, projection.html, settings.html.
   Not loaded on view.html (read-only from URL hash, no Store interaction)
   or index.html (static landing page).

   Load order in each page's <head>, BEFORE assets/store.js:
     firebase-app-compat.js  → firebase-database-compat.js  → this file
   ============================================================ */
"use strict";

firebase.initializeApp({
  apiKey: "AIzaSyBHzt9jQ0by9P0Obn3Abplfuezet4eruX8",
  authDomain: "topography-of-us.firebaseapp.com",
  databaseURL: "https://topography-of-us-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "topography-of-us",
  storageBucket: "topography-of-us.firebasestorage.app",
  messagingSenderId: "578893298967",
  appId: "1:578893298967:web:43f6a5a753557d3d734b52"
});

const _ref = firebase.database().ref("messages");
const _connectTime = Date.now();

window.TOPO_REMOTE = {
  send(msg){
    // Handshake messages ("hello", "state") are BroadcastChannel-specific — they
    // let two same-device tabs bootstrap each other. Over Firebase, child_added
    // replay handles hydration natively; pushing hello would just pollute the log.
    if(msg.k === "hello" || msg.k === "state") return;

    // A full "clear" needs to purge the durable log too, otherwise any new
    // client joining after the clear would re-hydrate the "cleared" paths from
    // Firebase's history. Wipe first, then push the clear message so live peers
    // still see it and reset their own local Store.
    if(msg.k === "clear"){
      _ref.remove().then(()=>_ref.push({...msg, ts: Date.now()}));
      return;
    }

    _ref.push({...msg, ts: Date.now()});
  },
  subscribe(fn){
    // limitToLast(500) caps the initial replay so a client joining after a very
    // busy night isn't held hostage by hydration. Store.addPath already dedupes
    // by path.id, so overlapping localStorage-hydrated state and Firebase replay
    // is safe — duplicates are silently dropped.
    _ref.limitToLast(500).on("child_added", snap => {
      const v = snap.val(); if(!v) return;
      // Messages older than ~2s before we connected are historical — hydrate
      // silently. Anything newer is a live event from another device: let the
      // projection's injection animation fire, let the wall's stats update.
      if(v.ts && v.ts < _connectTime - 2000) v._historical = true;
      fn(v);
    });
  }
};
