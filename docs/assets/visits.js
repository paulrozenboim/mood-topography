/* ============================================================
   VISITOR COUNTER — a quiet answer to "did anyone actually open this?"

   Deliberately tiny in every sense. One record per browser session:

       { t: <epoch ms>, p: "results" | "landscape" }

   That is the whole payload. No address, no fingerprint, no referrer, no
   identifier of any kind — there is nothing here that could tell one visitor
   from another, only that somebody opened a page and when.

   It writes to /visits, which NOTHING subscribes to. This matters: the sync log
   at /messages is replayed into every client that connects, and 82% of it was
   once auto-pilot noise. A page-view landing in there would be replayed to the
   wall forever. Different node, different life.

   Everything here fails silently. A counter is not worth one pixel of a broken
   results page, so every call is wrapped and every failure leaves the number
   blank rather than showing an error to a stranger.
   ============================================================ */
"use strict";

const VISITS_URL = "https://topography-of-us-default-rtdb.europe-west1.firebasedatabase.app/visits.json";

async function initVisits(el, page){
  if(!el) return;
  try{
    const qp = new URLSearchParams(location.search);
    // Don't count the operator looking at their own page: ?demo=1 is the private
    // preview hatch and ?visits=1 is this readout. Both are theirs, neither is a
    // visitor.
    const counts = !qp.has("demo") && !qp.has("visits");
    // One per browser session, so a reload or a back-button is not a new person.
    const key = "topo.visited." + page;
    if(counts && !sessionStorage.getItem(key)){
      sessionStorage.setItem(key, "1");
      await fetch(VISITS_URL, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ t: Date.now(), p: page })
      }).catch(()=>{});
    }

    if(qp.has("visits")){ await renderVisitDetail(el); return; }

    // shallow=true returns keys only — the count without the payload.
    const r = await fetch(VISITS_URL + "?shallow=true", {cache:"no-store"});
    const obj = await r.json();
    el.textContent = obj ? Object.keys(obj).length : 0;
  }catch(_){ /* leave it blank */ }
}

/* ?visits=1 — the "and when" half. Only ever rendered for someone who typed it
   into the address bar, so it can afford to be legible. */
async function renderVisitDetail(el){
  const r = await fetch(VISITS_URL, {cache:"no-store"});
  const obj = await r.json();
  const all = Object.values(obj || {}).filter(v => v && v.t).sort((a,b)=>a.t-b.t);
  if(!all.length){ el.textContent = "no visits yet"; return; }

  const now = Date.now(), H = 3600e3;
  const since = ms => all.filter(v => now - v.t < ms).length;
  const fmt = t => new Date(t).toLocaleString([], {dateStyle:"medium", timeStyle:"short"});
  const byPage = all.reduce((m,v)=>{ m[v.p||"?"] = (m[v.p||"?"]||0)+1; return m }, {});

  // Per-day, most recent first — the shape of "during or after the event".
  const days = {};
  for(const v of all){
    const d = new Date(v.t).toLocaleDateString([], {month:"short", day:"numeric"});
    days[d] = (days[d]||0)+1;
  }

  el.innerHTML =
    `<div class="visit-detail">` +
    `<b>${all.length}</b> visit${all.length===1?"":"s"} · first ${fmt(all[0].t)} · last ${fmt(all[all.length-1].t)}<br>` +
    `last hour <b>${since(H)}</b> · last 24h <b>${since(24*H)}</b><br>` +
    Object.entries(byPage).map(([k,v])=>`${k} <b>${v}</b>`).join(" · ") + `<br>` +
    Object.entries(days).reverse().map(([d,n])=>`${d} <b>${n}</b>`).join(" · ") +
    `</div>`;
}
