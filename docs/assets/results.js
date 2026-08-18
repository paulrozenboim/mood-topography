/* ============================================================
   THE TOPOGRAPHY OF US — results page
   The public, shareable read-out of one night. Deliberately standalone:
   it does NOT load store.js or remote-config.js, because those exist to
   *participate* in the show (they write localStorage, broadcast on the sync
   channel, and pull the Firebase SDK). This page only ever reads.

   Data resolution, in order:
     1. ?data=<url>          — any snapshot JSON
     2. results.json         — a frozen snapshot sitting next to this page
     3. live                 — the local relay if we're on it, else Firebase
                               over plain REST (no SDK, no writes)

   `analyse()` in core.js caches against Store.version, so we stand up a tiny
   read-only Store shim (see index.html) and bump its version when the data
   set changes. Nothing else in this page touches Store.
   ============================================================ */
"use strict";

/* ---------------- configuration ---------------- */
const RTDB = "https://topography-of-us-default-rtdb.europe-west1.firebasedatabase.app";
const EVENT_DEFAULTS = {
  title: "The Mood Topography",
  occasion: "Who Cares · Manifest Festival at Teder",
  venue: "Beit Romano",
  city: "Tel Aviv"
};
const PAGE_SIZE = 48;
const THEME_KEY = "topo.results.theme";

const CAT_BY_NAME = Object.fromEntries(Object.entries(CATS).map(([k, v]) => [v.name.toLowerCase(), k]));
const CAT_ORDER = ["F", "R", "C", "M"];

/* ---------------- page state ---------------- */
const S = {
  all: [],            // every path in the snapshot / log
  paths: [],          // the working set the whole page reports on
  includeDemo: false, // flipped automatically when a night has no real casts
  hasReal: false,
  event: { ...EVENT_DEFAULTS },
  source: null,       // {kind, label}
  theme: "dark",
  // browser controls
  q: "", fam: "all", len: "all", sort: "new", station: null,
  pos: "any",        // where a text-matched station sat: any | start | mid | end
  order: "ordered",  // how a chained route is matched: ordered | any | exact
  neverMode: "any",  // which role the "never used" list reports on
  famPos: "any",     // the part the chosen mood category played in the journey
  shown: PAGE_SIZE,
  results: []
};

const $ = id => document.getElementById(id);

/* Draw into a canvas as soon as its parent has a measured size.
   ---
   These used to be requestAnimationFrame callbacks, which is the reflex for
   "wait for layout" — but rAF does not fire at all while a tab is hidden or
   otherwise not compositing, so a thumbnail or a lightbox opened in that state
   never painted and stayed blank once the tab came back. Reading the parent's
   rect forces layout synchronously anyway, so the common case draws right now;
   the timeout is only for elements that genuinely have no box yet (a section
   revealed this tick), and setTimeout keeps running when rAF doesn't. */
function paintWhenSized(canvas, draw, tries = 20) {
  const box = canvas && canvas.parentElement;
  if (!box) return;
  if (box.getBoundingClientRect().width > 0) { draw(); return; }
  if (tries > 0) setTimeout(() => paintWhenSized(canvas, draw, tries - 1), 50);
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ============================================================
   LOADING
   ============================================================ */
async function getJSON(url, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, cache: "no-store" });
    if (!r.ok) throw new Error(r.status + " " + r.statusText);
    return await r.json();
  } finally { clearTimeout(t); }
}

/* A message log — from Firebase or from the local relay — collapsed down to the
   set of paths still standing. Mirrors store.js's Sync._receive semantics:
   `clear` wipes, `clearSeeded` drops rehearsal paths, `remove` drops one,
   and a repeated id is ignored (Store.addPath dedupes the same way). */
function reduceLog(msgs) {
  const byId = new Map();
  for (const m of msgs) {
    if (!m || !m.k) continue;
    if (m.k === "clear") byId.clear();
    else if (m.k === "clearSeeded") { for (const [id, p] of [...byId]) if (p.seeded) byId.delete(id); }
    else if (m.k === "remove") byId.delete(m.id);
    else if (m.k === "path" && m.p && m.p.id && Array.isArray(m.p.nodes)) {
      if (!byId.has(m.p.id)) byId.set(m.p.id, m.p);
    }
  }
  return [...byId.values()];
}

function sanitise(paths) {
  const seen = new Set();
  return (paths || []).filter(p => {
    if (!p || !p.id || seen.has(p.id)) return false;
    if (!Array.isArray(p.nodes) || p.nodes.length < 2) return false;
    if (p.nodes.some(i => !Number.isInteger(i) || i < 0 || i >= NODES.length)) return false;
    seen.add(p.id);
    return true;
  }).map(p => ({ id: p.id, nodes: p.nodes, t: Number(p.t) || 0, seeded: !!p.seeded }));
}

function probeLocal() {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 600);
  return fetch("/health", { signal: ctl.signal, cache: "no-store" })
    .then(r => r.ok).catch(() => false).finally(() => clearTimeout(t));
}

/* The local relay has no REST endpoint for its log — it replays everything down
   the SSE stream on connect instead. So: open it, hoover up the replay, and
   close as soon as the stream goes quiet. */
function collectFromRelay() {
  return new Promise(resolve => {
    const msgs = [];
    let quiet = null, done = false;
    let es;
    const finish = () => {
      if (done) return; done = true;
      clearTimeout(quiet); try { es.close(); } catch (_) {}
      resolve(msgs);
    };
    try { es = new EventSource("/sub"); } catch (_) { return resolve(msgs); }
    es.onmessage = ev => {
      try { msgs.push(JSON.parse(ev.data)); } catch (_) {}
      clearTimeout(quiet); quiet = setTimeout(finish, 700);
    };
    es.onerror = finish;
    setTimeout(finish, 8000);   // hard cap so a stalled stream can't hang the page
  });
}

async function collectFromFirebase() {
  const obj = await getJSON(RTDB + "/messages.json");
  // Push keys are chronologically ordered by construction, which is a more
  // trustworthy sequence than client-stamped `ts` when several devices are
  // casting at once — and order matters, because `clear` truncates.
  return Object.entries(obj || {}).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, v]) => v);
}

async function loadData() {
  const qp = new URLSearchParams(location.search);
  const explicit = qp.get("data");

  if (explicit) {
    const snap = await getJSON(explicit);
    return { paths: sanitise(snap.paths), event: snap.event, kind: "snapshot", label: explicit, at: snap.exported };
  }

  if (qp.get("live") !== "1") {
    try {
      const snap = await getJSON("results.json", 4000);
      if (snap && Array.isArray(snap.paths)) {
        return { paths: sanitise(snap.paths), event: snap.event, kind: "snapshot", label: "results.json", at: snap.exported };
      }
    } catch (_) { /* no frozen snapshot — fall through to live */ }
  }

  const onRelay = await probeLocal();
  const msgs = onRelay
    ? (await collectFromRelay()).sort((a, b) => (a.ts || 0) - (b.ts || 0))
    : await collectFromFirebase();
  return {
    paths: sanitise(reduceLog(msgs)),
    kind: "live",
    label: onRelay ? "local relay" : "live",
    at: new Date().toISOString()
  };
}

/* ============================================================
   FORMATTING
   ============================================================ */
const fmtTime = t => t ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
const fmtDateTime = t => t ? new Date(t).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Time not recorded";
const fmtDay = t => new Date(t).toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" });
/* One night reads as a date; a set stitched together from several sessions
   (rehearsals, a run of nights) reads as a range rather than quietly claiming
   the earliest one. */
function fmtNightOf(paths) {
  const ts = paths.map(p => p.t).filter(Boolean);
  if (!ts.length) return "";
  const a = fmtDay(Math.min(...ts)), b = fmtDay(Math.max(...ts));
  return a === b ? a : `${a} – ${b}`;
}
/* The event line wants the month, not the day — "August 2026" reads as an
   occasion, "2 August 2026 – 6 August 2026" reads as a database export. */
function fmtSpanOf(paths) {
  const ts = paths.map(p => p.t).filter(Boolean);
  if (!ts.length) return "";
  const opts = { month: "long", year: "numeric" };
  const a = new Date(Math.min(...ts)).toLocaleDateString([], opts);
  const b = new Date(Math.max(...ts)).toLocaleDateString([], opts);
  return a === b ? a : `${a} – ${b}`;
}

/* Bulletin copy arrives with {Station} / {Category} braces; resolve each to
   its mood-category colour, exactly as the projection does.
   ---
   Split before escaping, not after: the category names contain an ampersand
   ("Momentum & Vision"), so escaping the whole string first turns the brace
   contents into "Momentum &amp; Vision" and the name lookup silently misses —
   which is how every category name lost its colour. */
function bulletinHTML(line) {
  return String(line).split(/(\{[^}]+\})/).map(part => {
    const m = part.match(/^\{([^}]+)\}$/);
    if (!m) return esc(part);
    const name = m[1];
    const node = NODE_BY_NAME[name];
    const cat = node ? node.c : CAT_BY_NAME[name.toLowerCase()];
    const col = cat ? catColor(cat, S.theme) : null;
    return col ? `<b style="color:${col}">${esc(name)}</b>` : `<b>${esc(name)}</b>`;
  }).join("");
}

const pathLabel = p => `${NODES[p.nodes[0]].n} → ${NODES[p.nodes[p.nodes.length - 1]].n}`;

/* ============================================================
   THE AGGREGATE MAP
   Every journey drawn over the field at once, station size = traffic. Same
   geometry helpers the wall uses, but fit-to-box and non-interactive beyond
   tapping a station.
   ============================================================ */
const mapCanvas = $("mapCanvas");
let mapHits = [];   // {id, x, y, r} in CSS px, for tap targets

/* The map is built once into two offscreen layers and then composited every
   frame, because redrawing several hundred gradient splines plus a greedy
   label solve at 60fps is not affordable on a phone:

     routesLayer — background + every journey, drawn full
     overlayLayer — stations and their names, transparent behind

   A frame is routesLayer → the animated travellers → overlayLayer, so the
   moving lights read as traffic on the routes and never cover a station name.
   buildMap() re-runs only when the data, theme, size or selection changes. */
let mapLayers = null;   // {routes, overlay, w, h, dpr}
let mapGeom = null;     // [{sp, cats, on}] screen-space splines for the animation
let mapAnim = { raf: 0, last: 0, intro: 0, travellers: [], visible: true };

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function drawAggregate() {
  const canvas = mapCanvas, box = canvas.parentElement;
  const r = box.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, r.width * dpr);
  canvas.height = Math.max(1, r.height * dpr);

  const mk = () => {
    const c = document.createElement("canvas");
    c.width = canvas.width; c.height = canvas.height;
    const cx = c.getContext("2d");
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { c, cx };
  };
  const routes = mk(), overlay = mk();
  const ctx = routes.cx;

  const cs = getComputedStyle(document.documentElement);
  const bg = cs.getPropertyValue("--bg-2").trim();
  const ink = cs.getPropertyValue("--ink").trim();
  const ink3 = cs.getPropertyValue("--ink-3").trim();
  const dark = S.theme === "dark";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, r.width, r.height);

  const paths = S.paths;
  if (!paths.length) {
    mapLayers = null; mapGeom = null;
    const main = canvas.getContext("2d");
    main.setTransform(dpr, 0, 0, dpr, 0, 0);
    main.fillStyle = bg; main.fillRect(0, 0, r.width, r.height);
    return;
  }
  const A = analyse(paths);

  // Fit, with a capped anisotropic stretch so a squarish phone box doesn't
  // leave the field floating in empty bands (same trick MapView uses).
  const pad = clamp(Math.min(r.width, r.height) * 0.09, 16, 54);
  let kx = (r.width - pad * 2) / WORLD.w, ky = (r.height - pad * 2) / WORLD.h;
  const k = Math.max(0.02, Math.min(kx, ky));
  // The field is 1.7:1, a phone's map box is nearly square, so a faithful fit
  // leaves a third of the height empty — and that empty height is exactly the
  // room 36 names need. Below 560px the stretch cap opens up: the layout is an
  // abstract field, not a geography, and stations spreading apart vertically
  // costs nothing while buying every label a clean slot.
  const stretch = r.width < 560 ? 1.9 : (Math.max(kx, ky) / k > 1.5 ? 1.35 : 1.16);
  kx = Math.min(kx, k * stretch); ky = Math.min(ky, k * stretch);
  const ox = (r.width - WORLD.w * kx) / 2, oy = (r.height - WORLD.h * ky) / 2;
  const toS = p => ({ x: p.x * kx + ox, y: p.y * ky + oy });

  const sel = S.station;
  const selPaths = sel == null ? null : new Set(paths.filter(p => p.nodes.includes(sel)).map(p => p.id));

  // Route strokes. Alpha falls off as the night fills up so a busy map builds
  // density rather than turning into a solid slab of colour.
  const base = clamp(12 / paths.length, 0.07, 0.4);
  const lw = clamp(k * 2.2, 1, 2.6);
  // Decimated screen-space samples of every route, so the label placer can
  // prefer slots that don't sit on top of the drawing. Capped — with a few
  // hundred journeys the full point set would make placement quadratic-slow.
  const inkPts = [];
  const everyNth = Math.max(4, Math.ceil(paths.length / 12));
  mapGeom = [];
  for (const p of paths) {
    const on = !selPaths || selPaths.has(p.id);
    const cats = p.nodes.map(i => NODES[i].c);
    const sp = splinePoints(p.nodes.map(i => ({ x: NODES[i].x, y: NODES[i].y })), null).map(toS);
    strokeGradientPath(ctx, sp, cats, S.theme, {
      lineWidth: on && selPaths ? lw + 0.9 : lw,
      alpha: selPaths ? (on ? 0.9 : base * 0.22) : base,
      composite: dark ? "lighter" : "multiply"
    });
    mapGeom.push({ sp, cats, on });
    if (inkPts.length < 1600) for (let i = 0; i < sp.length; i += everyNth) inkPts.push(sp[i]);
  }

  // Everything from here paints the overlay: stations and their names sit
  // above the animated travellers, so a moving light never hides a name.
  const octx = overlay.cx;
  const maxT = Math.max(1, ...A.traffic);
  mapHits = [];
  for (const n of NODES) {
    const s = toS(n), t = A.traffic[n.id] || 0;
    const heat = Math.sqrt(t / maxT);
    const rad = t ? 2.8 + heat * clamp(k * 12, 5, 11) : 2.4;
    const col = catColor(n.c, S.theme);
    const dim = sel != null && sel !== n.id;
    octx.save();
    octx.globalAlpha = dim ? 0.3 : 1;
    if (t) {
      octx.beginPath(); octx.arc(s.x, s.y, rad + 5, 0, 7);
      octx.globalAlpha = (dim ? 0.3 : 1) * 0.13; octx.fillStyle = col; octx.fill();
      octx.globalAlpha = dim ? 0.3 : 1;
    }
    octx.beginPath(); octx.arc(s.x, s.y, rad, 0, 7);
    octx.fillStyle = t ? col : bg; octx.fill();
    octx.lineWidth = 1.4; octx.strokeStyle = col;
    octx.globalAlpha = (dim ? 0.3 : 1) * (t ? 1 : 0.55);
    octx.stroke();
    if (sel === n.id) {
      octx.beginPath(); octx.arc(s.x, s.y, rad + 9, 0, 7);
      octx.globalAlpha = 1; octx.lineWidth = 1.6; octx.strokeStyle = ink; octx.stroke();
    }
    octx.restore();
    mapHits.push({ id: n.id, x: s.x, y: s.y, r: Math.max(rad + 8, 15) });
  }

  /* ---- Labels: every station, always ------------------------------------
     A greedy multi-slot placer, same shape as the one core.js uses for print.
     Hardest (widest) name first so short ones can tuck into what's left; each
     one takes the highest-scoring of twelve candidate slots around its dot.
     Nothing is ever dropped — if a station has no clean slot it still gets its
     best one, because a map missing a third of its names is worse than a map
     with a couple of tight pairs. A translucent plate behind each label keeps
     it readable where it does cross a route. */
  const fs = clamp(k * 11, 6.4, 12.5);
  const lh = fs + 2, gap = 3;
  octx.font = `600 ${fs}px 'Martian Mono',monospace`;
  octx.textAlign = "left";
  octx.textBaseline = "top";

  const radOf = t => (t ? 2.8 + Math.sqrt(t / maxT) * clamp(k * 12, 5, 11) : 2.4);
  const items = NODES.map(n => {
    const t = A.traffic[n.id] || 0, label = n.n.toUpperCase();
    return { n, t, s: toS(n), rad: radOf(t), label, tw: octx.measureText(label).width };
  });

  // [horizontal side, vertical row, alignment]. Order is preference order:
  // directly below, directly above, beside, then the diagonals, then further
  // out. A tie goes to the earlier candidate.
  const CAND = [
    [0, 1, "c"], [0, -1, "c"], [1, 0, "l"], [-1, 0, "r"],
    [1, 1, "l"], [-1, 1, "r"], [1, -1, "l"], [-1, -1, "r"],
    [0, 2, "c"], [0, -2, "c"], [0, 3, "c"], [0, -3, "c"]
  ];
  const rectFor = (it, ci) => {
    const [, row, al] = CAND[ci];
    const y = row > 0 ? it.s.y + it.rad + gap + (row - 1) * lh
      : row < 0 ? it.s.y - it.rad - gap - fs - (-row - 1) * lh
        : it.s.y - fs / 2;
    let x = al === "c" ? it.s.x - it.tw / 2
      : al === "l" ? it.s.x + it.rad + gap
        : it.s.x - it.rad - gap - it.tw;
    // Slide a label that would run off the edge back inside, keeping its slot.
    if (x < 2) x = 2;
    if (x + it.tw > r.width - 2) x = r.width - 2 - it.tw;
    return { x, y, x0: x - 1.5, x1: x + it.tw + 1.5, y0: y - 1, y1: y + fs + 1 };
  };

  // Dots are obstacles from the start; labels join the set as they're placed.
  const blockers = items.map(it => ({
    x0: it.s.x - it.rad - 1, x1: it.s.x + it.rad + 1,
    y0: it.s.y - it.rad - 1, y1: it.s.y + it.rad + 1
  }));
  const placements = new Array(items.length);
  const order = items.map((_, i) => i).sort((a, b) => items[b].tw - items[a].tw);

  for (const idx of order) {
    const it = items[idx];
    let best = null, bestScore = -Infinity;
    for (let ci = 0; ci < CAND.length; ci++) {
      const rect = rectFor(it, ci);
      let hits = 0;
      for (const q of blockers) {
        if (rect.x0 < q.x1 && q.x0 < rect.x1 && rect.y0 < q.y1 && q.y0 < rect.y1) hits++;
      }
      let onInk = 0;
      for (const q of inkPts) {
        if (q.x > rect.x0 && q.x < rect.x1 && q.y > rect.y0 && q.y < rect.y1) onInk++;
      }
      const clipped = (rect.y0 < 1 || rect.y1 > r.height - 1) ? 1 : 0;
      const score = -hits * 100 - Math.min(onInk, 10) * 3 - clipped * 60 - ci;
      if (score > bestScore) { bestScore = score; best = rect; }
    }
    // Vertical clamp, mirroring the horizontal one in rectFor.
    if (best.y0 < 1) { const d = 1 - best.y0; best = { ...best, y: best.y + d, y0: 1, y1: best.y1 + d }; }
    if (best.y1 > r.height - 1) { const d = best.y1 - (r.height - 1); best = { ...best, y: best.y - d, y0: best.y0 - d, y1: r.height - 1 }; }
    placements[idx] = best;
    blockers.push(best);
  }

  items.forEach((it, i) => {
    const pos = placements[i];
    const isSel = sel === it.n.id;
    const dim = sel != null && !isSel;
    octx.globalAlpha = dim ? 0.4 : (it.t ? 1 : 0.62);
    // Plate first — enough to lift the name off a dense tangle of routes
    // without reading as a solid box.
    octx.fillStyle = bg;
    octx.globalAlpha *= 0.74;
    octx.fillRect(pos.x0, pos.y0, pos.x1 - pos.x0, pos.y1 - pos.y0);
    octx.globalAlpha = dim ? 0.4 : (it.t ? 1 : 0.62);
    octx.fillStyle = isSel ? catColor(it.n.c, S.theme) : (it.t ? ink : ink3);
    octx.fillText(it.label, pos.x, pos.y);
    octx.globalAlpha = 1;
  });

  mapLayers = { routes: routes.c, overlay: overlay.c, w: r.width, h: r.height, dpr, bg, dark };
  startMapAnimation();
}

/* ============================================================
   MAP ANIMATION — travellers
   Rather than looping the whole map on and off, the finished aggregate stays
   put and lights move along it, the way traffic moves on a transit diagram.
   The first pass draws the routes on progressively so the map assembles itself
   once as you arrive; after that only the travellers move.
   ============================================================ */
const TRAVEL_HEAD = 26;   // spline samples in a traveller's tail

function seedTravellers() {
  if (!mapGeom || !mapGeom.length) { mapAnim.travellers = []; return; }
  const pool = mapGeom.map((g, i) => i).filter(i => mapGeom[i].on);
  const src = pool.length ? pool : mapGeom.map((_, i) => i);
  const n = clamp(Math.round(src.length / 3), 5, 18);
  mapAnim.travellers = Array.from({ length: n }, (_, i) => ({
    g: src[Math.floor(Math.random() * src.length)],
    // Stagger the first lap so they don't set off in a single rank.
    t: -(i / n) * 0.9 - Math.random() * 0.3,
    speed: 0.10 + Math.random() * 0.10
  }));
  mapAnim._pool = src;
}

function drawTravellers(ctx) {
  const dark = mapLayers.dark;
  ctx.save();
  ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
  ctx.lineCap = "round";
  for (const tr of mapAnim.travellers) {
    if (tr.t < 0) continue;
    const g = mapGeom[tr.g];
    if (!g) continue;
    const last = g.sp.length - 1;
    const head = Math.min(last, Math.round(tr.t * last));
    // A short tapering tail behind the head, taking its colour from whichever
    // pair of stations that stretch of the route runs between.
    for (let j = 0; j < TRAVEL_HEAD; j++) {
      const i1 = head - j, i0 = i1 - 1;
      if (i0 < 0) break;
      const fade = 1 - j / TRAVEL_HEAD;
      ctx.globalAlpha = fade * fade * (dark ? 0.85 : 0.6);
      ctx.lineWidth = 1 + fade * 2.2;
      ctx.strokeStyle = catColor(g.cats[Math.min(g.cats.length - 1, Math.floor(i1 / 18))], S.theme);
      ctx.beginPath();
      ctx.moveTo(g.sp[i0].x, g.sp[i0].y);
      ctx.lineTo(g.sp[i1].x, g.sp[i1].y);
      ctx.stroke();
    }
    const h = g.sp[head];
    ctx.globalAlpha = dark ? 0.95 : 0.75;
    ctx.beginPath();
    ctx.arc(h.x, h.y, 2.1, 0, 7);
    ctx.fillStyle = catColor(g.cats[Math.min(g.cats.length - 1, Math.floor(head / 18))], S.theme);
    ctx.fill();
  }
  ctx.restore();
}

function mapFrame(now) {
  mapAnim.raf = 0;
  if (!mapLayers) return;
  const dt = Math.min(0.05, (now - (mapAnim.last || now)) / 1000);
  mapAnim.last = now;

  const ctx = mapCanvas.getContext("2d");
  ctx.setTransform(mapLayers.dpr, 0, 0, mapLayers.dpr, 0, 0);

  if (mapAnim.intro < 1) {
    // Assembling: routes draw on, staggered, over the background.
    mapAnim.intro = Math.min(1, mapAnim.intro + dt / 1.5);
    const e = 1 - Math.pow(1 - mapAnim.intro, 3);
    ctx.fillStyle = mapLayers.bg;
    ctx.fillRect(0, 0, mapLayers.w, mapLayers.h);
    const n = mapGeom.length;
    const lw = 1.6, base = clamp(12 / n, 0.07, 0.4);
    for (let i = 0; i < n; i++) {
      const g = mapGeom[i];
      // Each route starts a little after the one before, so the field fills in
      // as a wave instead of every line growing in lockstep.
      const local = clamp((e - (i / n) * 0.45) / 0.55, 0, 1);
      if (local <= 0) continue;
      strokeGradientPath(ctx, g.sp, g.cats, S.theme, {
        lineWidth: lw, alpha: base, composite: mapLayers.dark ? "lighter" : "multiply",
        lastCutIndex: Math.round(local * (g.sp.length - 1))
      });
    }
    ctx.drawImage(mapLayers.overlay, 0, 0, mapLayers.w, mapLayers.h);
    mapAnim.raf = requestAnimationFrame(mapFrame);
    return;
  }

  ctx.drawImage(mapLayers.routes, 0, 0, mapLayers.w, mapLayers.h);
  for (const tr of mapAnim.travellers) {
    tr.t += tr.speed * dt;
    if (tr.t > 1) {
      tr.t = -Math.random() * 0.5;
      tr.speed = 0.10 + Math.random() * 0.10;
      const pool = mapAnim._pool || [];
      if (pool.length) tr.g = pool[Math.floor(Math.random() * pool.length)];
    }
  }
  drawTravellers(ctx);
  ctx.drawImage(mapLayers.overlay, 0, 0, mapLayers.w, mapLayers.h);
  mapAnim.raf = requestAnimationFrame(mapFrame);
}

/* One static composite — the honest fallback when motion is unwanted, and what
   gets left on screen whenever the loop is parked. */
function paintMapStatic() {
  if (!mapLayers) return;
  const ctx = mapCanvas.getContext("2d");
  ctx.setTransform(mapLayers.dpr, 0, 0, mapLayers.dpr, 0, 0);
  ctx.drawImage(mapLayers.routes, 0, 0, mapLayers.w, mapLayers.h);
  ctx.drawImage(mapLayers.overlay, 0, 0, mapLayers.w, mapLayers.h);
}

function stopMapAnimation() {
  if (mapAnim.raf) cancelAnimationFrame(mapAnim.raf);
  mapAnim.raf = 0;
}

function startMapAnimation() {
  stopMapAnimation();
  if (reducedMotion()) { mapAnim.intro = 1; paintMapStatic(); return; }
  seedTravellers();
  mapAnim.last = 0;
  // Off-screen or a hidden tab: leave the finished map painted and burn nothing.
  // `intro` is deliberately left alone — on a phone the map is below the fold at
  // load, and the assembling pass should be waiting for them when they reach it
  // rather than having been spent on an empty screen.
  if (!mapAnim.visible || document.hidden) { paintMapStatic(); return; }
  mapAnim.raf = requestAnimationFrame(mapFrame);
}

function mapTapped(ev) {
  const r = mapCanvas.getBoundingClientRect();
  const x = ev.clientX - r.left, y = ev.clientY - r.top;
  let best = null, bd = Infinity;
  for (const h of mapHits) {
    const d = Math.hypot(h.x - x, h.y - y);
    if (d < h.r && d < bd) { bd = d; best = h; }
  }
  selectStation(best && best.id !== S.station ? best.id : null, true);
}

/* Selecting a station used to scroll the page down to the grid, which yanked
   the map out from under whoever had just tapped it. It now stays put and says
   what happened, with going there as an offer rather than a side effect. */
let toastTimer = null;
function hideToast() {
  const el = $("filterToast");
  clearTimeout(toastTimer);
  el.classList.remove("on");
  toastTimer = setTimeout(() => { el.hidden = true; }, 250);
}
/* `sticky` leaves it up until dismissed — used when someone arrives from a
   printed QR, where the notice is the only thing telling them their path is
   waiting further down the page. */
function showToast(html, { sticky = false } = {}) {
  const el = $("filterToast");
  clearTimeout(toastTimer);
  $("toastText").innerHTML = html;
  el.hidden = false;
  setTimeout(() => el.classList.add("on"), 20);
  if (!sticky) toastTimer = setTimeout(() => el.classList.remove("on"), 6000);
}

function showFilterToast(id) {
  if (id == null) return hideToast();
  const n = NODES[id], count = S.results.length;
  // No "below": the traffic list that also sets this filter now sits under the
  // journey grid, so the grid is above it as often as not. The verb comes from
  // the role filter, so "Not used" never reads as "journeys through X".
  showToast(
    `Showing ${count} journey${count === 1 ? "" : "s"} ${POS_PHRASE[S.pos] || "through"}
     <b style="color:${catColor(n.c, S.theme)}">${esc(n.n)}</b>`);
}

function selectStation(id, announce) {
  S.station = id;
  drawAggregate();
  renderMapReadout();
  renderBrowser();
  renderCharts();
  syncURL();
  if (announce) showFilterToast(id);
}

function renderMapReadout() {
  const el = $("mapReadout");
  // Nothing selected means nothing to report — the standing instruction sits
  // above the map, so an empty bar here would just be a gap with a border.
  if (S.station == null) { el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;
  const n = NODES[S.station], A = analyse(S.paths);
  const through = A.traffic[n.id] || 0;
  el.innerHTML = `
    <b style="color:${catColor(n.c, S.theme)}">${esc(n.n)}</b>
    <span class="rs-dim">${esc(CATS[n.c].name)}</span>
    <span>${through} crossed &middot; ${A.anchors[n.id] || 0} started &middot; ${A.ends[n.id] || 0} ended</span>
    <button type="button" class="rs-clear" id="clearStation">Clear</button>`;
  $("clearStation").onclick = () => selectStation(null);
}

/* ============================================================
   PAGE-ONLY ANALYSIS
   Two things the wall never needed, so they live here rather than in core.js's
   analyse() — nothing the projection runs on changes because of them.
   ============================================================ */

/* Three-station runs, counted the way core.js counts two-station segments: a
   run and its reverse are the same stretch of map walked in the other
   direction, so they fold together under one key. */
let _tripleCache = { v: -1, r: null };
function triples(paths) {
  if (_tripleCache.v === Store.version && _tripleCache.r) return _tripleCache.r;
  const m = new Map();
  for (const p of paths) {
    for (let i = 0; i + 2 < p.nodes.length; i++) {
      const run = [p.nodes[i], p.nodes[i + 1], p.nodes[i + 2]];
      const fwd = run.join(">"), rev = run.slice().reverse().join(">");
      const key = fwd <= rev ? fwd : rev;
      const hit = m.get(key);
      if (hit) hit.v++;
      else m.set(key, { ids: (fwd <= rev ? run : run.slice().reverse()), v: 1 });
    }
  }
  const r = [...m.values()].sort((a, b) => b.v - a.v || a.ids[0] - b.ids[0]);
  _tripleCache = { v: Store.version, r };
  return r;
}

/* "Never visited" is usually empty by the end of a busy night, which makes it a
   dead panel. The interesting question by then is not whether a station was
   reached but what it was never allowed to be — a place to set out from, a
   place to end up, or a place you only pass through. */
const NEVER_MODES = {
  any: { label: "Never visited at all", empty: "Every station was reached at least once.", of: A => NODES.filter(n => !A.traffic[n.id]) },
  first: { label: "Never a starting point", empty: "Every station started a journey at least once.", of: A => NODES.filter(n => !A.anchors[n.id]) },
  last: { label: "Never an end point", empty: "Every station ended a journey at least once.", of: A => NODES.filter(n => !A.ends[n.id]) },
  mid: {
    label: "Never a connection", empty: "Every station was passed through at least once.",
    of: A => NODES.filter(n => (A.traffic[n.id] || 0) - (A.anchors[n.id] || 0) - (A.ends[n.id] || 0) <= 0)
  }
};

/* ============================================================
   HEADLINE + BULLETINS + CHARTS
   ============================================================ */
function animateCount(el, to) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || to > 9999) { el.textContent = to; return; }
  const dur = 900, t0 = performance.now();
  const step = now => {
    const u = clamp((now - t0) / dur, 0, 1);
    el.textContent = Math.round(to * (1 - Math.pow(1 - u, 3)));
    if (u < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function renderHeadline() {
  const A = analyse(S.paths);
  const reached = NODES.length - A.untouched.length;
  const tiles = [
    ["journeys cast", A.total],
    ["stations reached", reached, `of ${NODES.length}`],
    ["distinct routes", A.distinct],
    ["stations per journey", A.avgLen ? A.avgLen.toFixed(1) : "0", "average"]
  ];
  $("stats").innerHTML = tiles.map(([label, v, sub]) => `
    <div class="rs-stat">
      <b data-count="${typeof v === "number" ? v : ""}">${typeof v === "number" ? 0 : v}</b>
      <span>${esc(label)}</span>
      ${sub ? `<em>${esc(sub)}</em>` : ""}
    </div>`).join("");
  $("stats").querySelectorAll("b[data-count]").forEach(el => {
    if (el.dataset.count !== "") animateCount(el, Number(el.dataset.count));
  });

  // The whole of the opening: one sentence, then the event line. Counts are
  // read off the data rather than written in, so a frozen snapshot and a live
  // read both describe themselves honestly.
  $("heroLine").innerHTML = A.total
    ? `<b>${A.total}</b> ${A.total === 1 ? "person traced a path" : "people traced a path"} through
       36 emotional states. Together, their journeys became a live map of the night.`
    : `No journeys have been cast yet.`;

  const where = [S.event.venue, S.event.city].filter(Boolean).join(", ");
  $("eventLine").textContent =
    [S.event.occasion, where, fmtSpanOf(S.all)].filter(Boolean).join(" · ");
}

/* Bulletins written purely as captions for a wall animation. On the projection
   "Where paths tonight anchored themselves" is a title over a map lighting up
   with numbers; sitting alone on a page it says nothing, and the charts below
   carry that information properly anyway. "Just now" is time-relative and goes
   stale the moment the night ends. */
const WALL_ONLY_BULLETINS = new Set([
  "Service notice", "Foot traffic", "Where journeys begin", "Where journeys land", "Just now"
]);
/* Recomputed only when the working set changes, never on a repaint — the
   "No service" line picks its station at random, so re-deriving it on every
   theme flip would shuffle the copy under the reader. */
function buildBulletins() {
  S.bulletins = bulletins(analyse(S.paths)).filter(b => !WALL_ONLY_BULLETINS.has(b.tag));
}

function renderBulletins() {
  const list = S.bulletins || [];
  // The strip shows everything — horizontal space is not a budget the way
  // vertical space was, so there is nothing to hide behind a "show more".
  const shown = list;
  $("bulletins").innerHTML = shown.map(b => {
    // A line like "One person went this way" is deictic — it only lands if you
    // can see the way. Where a bulletin points at one specific path, draw it.
    const p = b.focus && b.focus.type === "path" ? S.paths.find(x => x.id === b.focus.id) : null;
    return `
    <article class="rs-bulletin${p ? " has-path" : ""}"${b.accent ? ` style="--accent:${catColor(b.accent, S.theme)}"` : ""}
      ${p ? `data-open="${esc(p.id)}" role="button" tabindex="0"` : ""}>
      <span class="rs-tag">${esc(b.tag)}</span>
      <p class="rs-bline">${bulletinHTML(b.line)}</p>
      ${b.sub ? `<p class="rs-bsub">${esc(b.sub)}</p>` : ""}
      ${p ? `<span class="rs-bthumb"><canvas></canvas></span>` : ""}
    </article>`;
  }).join("");
  // Rewriting innerHTML replaces the children but leaves the track's own
  // attributes alone, so the "already duplicated" flag has to be cleared by
  // hand — otherwise a theme flip left a single un-doubled run and the drift
  // ran off the end into blank space.
  delete $("bulletins").dataset.doubled;

  $("bulletinsSection").hidden = !list.length;
  // Duplicate the run first, then paint — the clones carry their own canvases
  // and would otherwise sit empty.
  setupMarquee();
  paintBulletinThumbs();
}

/* ============================================================
   THE READINGS STRIP
   Drifts on its own so the section reads as alive rather than as a row that
   happens to overflow. Stops dead under a pointer — nothing should slide out
   from under someone mid-sentence — and hands over completely the moment
   anyone drags, wheels or tabs into it, picking back up a few seconds later.
   ============================================================ */
const MARQUEE_PXPS = 30;      // drift speed, px per second
const MARQUEE_RESUME = 10000; // how long a hand-scroll holds the drift off

let marquee = { raf: 0, last: 0, paused: false, idle: 0, wired: false };

function setupMarquee() {
  const el = $("marquee"), track = $("bulletins");
  if (!el || !track.children.length) return;

  // The drift wraps by resetting to the start once the first copy has passed,
  // so the run has to be duplicated or the reset would be visible as a jump.
  if (!track.dataset.doubled) {
    const half = track.innerHTML;
    track.innerHTML = half + half;
    track.dataset.doubled = "1";
    track.dataset.halfCount = String(track.children.length / 2);
    // The clones are decoration; a screen reader should hear each reading once.
    [...track.children].slice(track.children.length / 2).forEach(c => {
      c.setAttribute("aria-hidden", "true");
      c.removeAttribute("tabindex");
    });
  }

  if (marquee.wired) return;
  marquee.wired = true;

  // Any hand-scroll parks the drift for MARQUEE_RESUME and then it picks up
  // again on its own. That timer is the only control a touch device has —
  // there is no pointer to leave — so it has to be long enough to read a card
  // without the strip creeping away underneath.
  const hold = () => { marquee.paused = true; marquee.idle = MARQUEE_RESUME; };
  // Hover is a mouse-only signal: on touch, pointerenter fires on tap and would
  // read as a permanent stop with nothing to undo it.
  el.addEventListener("pointerenter", ev => { if (ev.pointerType === "mouse") { marquee.paused = true; marquee.idle = 0; } });
  el.addEventListener("pointerleave", ev => { if (ev.pointerType === "mouse") marquee.paused = false; });
  el.addEventListener("pointerdown", hold);
  el.addEventListener("wheel", hold, { passive: true });
  el.addEventListener("touchmove", hold, { passive: true });
  // Deliberately no "scroll" listener: the drift moves scrollLeft itself, so
  // that would fire on every frame and park the animation permanently. The
  // three events above already cover every way a person can move the strip.
  el.addEventListener("focusin", () => { marquee.paused = true; marquee.idle = 0; });
  el.addEventListener("focusout", () => { marquee.paused = false; });

  // Drag-to-scroll with a mouse — the strip looks grabbable, so it should be.
  let drag = null;
  el.addEventListener("pointerdown", ev => {
    if (ev.pointerType !== "mouse") return;
    drag = { x: ev.clientX, left: el.scrollLeft };
  });
  addEventListener("pointermove", ev => {
    if (!drag) return;
    el.scrollLeft = drag.left - (ev.clientX - drag.x);
  });
  addEventListener("pointerup", () => { drag = null; });

  startMarquee();
}

function marqueeFrame(now) {
  marquee.raf = 0;
  const el = $("marquee"), track = $("bulletins");
  if (!el || !track) return;
  const dt = Math.min(0.05, (now - (marquee.last || now)) / 1000);
  marquee.last = now;

  if (marquee.idle > 0) {
    marquee.idle -= dt * 1000;
    if (marquee.idle <= 0) marquee.paused = false;
  }
  if (!marquee.paused) {
    const half = track.scrollWidth / 2;
    let next = el.scrollLeft + MARQUEE_PXPS * dt;
    if (half > 0 && next >= half) next -= half;
    el.scrollLeft = next;
  }
  marquee.raf = requestAnimationFrame(marqueeFrame);
}

function startMarquee() {
  stopMarquee();
  if (reducedMotion()) return;   // still hand-scrollable, just never moves itself
  marquee.last = 0;
  marquee.raf = requestAnimationFrame(marqueeFrame);
}
function stopMarquee() {
  if (marquee.raf) cancelAnimationFrame(marquee.raf);
  marquee.raf = 0;
}

/* Station names are drawn at a fixed 11px, so they only stay legible once the
   drawing is wide enough to spread them out — below that the card carries the
   route in its `sub` line anyway. */
const THUMB_LABEL_MIN_W = 380;
function paintBulletinThumbs() {
  $("bulletins").querySelectorAll(".rs-bulletin.has-path").forEach(card => {
    const p = S.paths.find(x => x.id === card.dataset.open);
    const cv = card.querySelector("canvas");
    if (!p || !cv) return;
    paintWhenSized(cv, () => {
      const w = cv.parentElement.getBoundingClientRect().width;
      renderConstellation(cv, p.nodes, S.theme, { labels: w >= THUMB_LABEL_MIN_W });
    });
  });
}

function renderCharts() {
  const A = analyse(S.paths);

  // --- station traffic, every station, ranked
  const maxT = Math.max(1, ...A.traffic);
  const ranked = NODES.slice().sort((a, b) =>
    (A.traffic[b.id] - A.traffic[a.id]) || a.n.localeCompare(b.n));
  $("traffic").innerHTML = ranked.map(n => {
    const t = A.traffic[n.id] || 0;
    return `<button type="button" class="rs-row${S.station === n.id ? " on" : ""}${t ? "" : " zero"}" data-station="${n.id}">
      <span class="rs-rname"><i style="background:${catColor(n.c, S.theme)}"></i>${esc(n.n)}</span>
      <span class="rs-rbar"><i style="width:${(t / maxT * 100).toFixed(1)}%;background:${catColor(n.c, S.theme)}"></i></span>
      <span class="rs-rval">${t}</span>
    </button>`;
  }).join("");

  // --- where journeys ended, by mood category
  const endTotal = CAT_ORDER.reduce((s, c) => s + (A.catEnd[c] || 0), 0) || 1;
  $("endsBar").innerHTML = CAT_ORDER.map(c => {
    const pct = (A.catEnd[c] || 0) / endTotal * 100;
    return pct ? `<i style="width:${pct.toFixed(2)}%;background:${catColor(c, S.theme)}" title="${esc(CATS[c].name)}"></i>` : "";
  }).join("");
  $("endsLegend").innerHTML = CAT_ORDER.map(c => `
    <div class="rs-leg">
      <i style="background:${catColor(c, S.theme)}"></i>
      <span>${esc(CATS[c].name)}</span>
      <b>${Math.round((A.catEnd[c] || 0) / endTotal * 100)}%</b>
    </div>`).join("");

  // --- heaviest links
  const links = A.edgeList.slice(0, 10);
  const maxV = links.length ? links[0].v : 1;
  $("links").innerHTML = links.length
    // A segment belongs to two mood categories at once, so the bar runs the
    // same colour-to-colour gradient the map draws the route in.
    ? links.map(e => {
      const ca = catColor(NODES[e.a].c, S.theme), cb = catColor(NODES[e.b].c, S.theme);
      return `<div class="rs-row static">
        <span class="rs-rname">
          <i style="background:${ca}"></i>${esc(NODES[e.a].n)}
          <em>&mdash;</em>${esc(NODES[e.b].n)}
        </span>
        <span class="rs-rbar"><i style="width:${(e.v / maxV * 100).toFixed(1)}%;background:linear-gradient(90deg,${ca},${cb})"></i></span>
        <span class="rs-rval">${e.v}</span>
      </div>`;
    }).join("")
    : `<p class="rs-note">No segment was walked more than once.</p>`;

  // --- most-walked runs of three
  const runs = triples(S.paths).filter(t => t.v > 1).slice(0, 8);
  const maxR = runs.length ? runs[0].v : 1;
  $("triples").innerHTML = runs.length
    ? runs.map(t => {
      const cols = t.ids.map(i => catColor(NODES[i].c, S.theme));
      // Joined with real spaces around the separator: without whitespace the
      // three names are one unbreakable token, and a narrow column then splits
      // it mid-name ("ADAPTAT / ION") instead of wrapping between stations.
      const names = t.ids.map((i, k) =>
        `<b style="color:${cols[k]}">${esc(NODES[i].n)}</b>`).join(' <em>&rsaquo;</em> ');
      return `<div class="rs-triple">
        <span class="rs-trun">${names}</span>
        <span class="rs-rbar"><i style="width:${(t.v / maxR * 100).toFixed(1)}%;background:linear-gradient(90deg,${cols[0]},${cols[1]},${cols[2]})"></i></span>
        <span class="rs-rval">${t.v}</span>
      </div>`;
    }).join("")
    : `<p class="rs-note">No three stations in a row were walked together more than once.</p>`;
  $("triplesCount").textContent = runs.length ? `top ${runs.length}` : "none repeated";

  // --- never used as…
  const mode = NEVER_MODES[S.neverMode] ? S.neverMode : "any";
  const list = NEVER_MODES[mode].of(A);
  $("untouched").innerHTML = list.length
    ? list.map(n => `<span class="rs-pill"><i style="background:${catColor(n.c, S.theme)}"></i>${esc(n.n)}</span>`).join("")
    : `<p class="rs-note">${esc(NEVER_MODES[mode].empty)}</p>`;
  $("neverCount").textContent = list.length ? `${list.length} of ${NODES.length}` : "none";
  $("neverMode").value = mode;
}

/* ============================================================
   THE JOURNEY BROWSER — search, filter, sort, lazy thumbnails
   ============================================================ */

/* Two ways to arrive holding your own path: the code printed on the receipt
   (MT-4ISJWX) or an older keepsake link pasted whole. Both decode to the same
   route, and both take priority over reading the box as a text search — which
   is exactly why the printed code carries a prefix. Without it "hope" would be
   both a station to search for and a valid four-stop path. */
function codeFromQuery(q) {
  const printed = parsePathCode(q);
  if (printed.length >= MIN_STOPS) return printed;
  const m = q.match(/(?:^|[#&?])p=([0-9a-z]+)/i) || (/view\.html/i.test(q) && q.match(/([0-9a-z]{3,10})\s*$/i));
  if (!m) return null;
  const ids = decodePath(m[1].toLowerCase());
  return ids.length >= MIN_STOPS ? ids : null;
}

/* Anything a person might reasonably type between two station names. No
   station name contains one of these, so splitting on them is unambiguous —
   and "Fear - Hope", "Fear > Hope", "Fear → Hope" and "Fear, Hope" all mean
   the same thing to whoever is typing. */
const ROUTE_SEP = /\s*(?:›|»|->|→|>|—|–|-|,)\s*/;

/* One typed word → one station. Exact name wins; otherwise a prefix match,
   then a substring match, but only when it is unambiguous — "co" hits Conflict,
   Compromise, Community, Courage, and silently picking one would be a lie. */
function resolveStation(term) {
  const t = term.trim().toLowerCase();
  if (!t) return { miss: term };
  const exact = NODES.find(n => n.n.toLowerCase() === t);
  if (exact) return { node: exact };
  const pre = NODES.filter(n => n.n.toLowerCase().startsWith(t));
  if (pre.length === 1) return { node: pre[0] };
  const inc = NODES.filter(n => n.n.toLowerCase().includes(t));
  if (inc.length === 1) return { node: inc[0] };
  const many = pre.length ? pre : inc;
  return many.length ? { ambiguous: term, options: many } : { miss: term };
}

/* Three shapes of query, decided by what was typed rather than by a mode the
   reader has to set first:
     code  — a pasted keepsake link
     route — two or more stations chained with a separator
     text  — everything else, matched against station and mood-category names */
function parseQuery(raw) {
  const q = (raw || "").trim();
  if (!q) return { kind: "none" };

  const code = codeFromQuery(q);
  if (code) return { kind: "code", ids: code };

  if (ROUTE_SEP.test(q)) {
    const terms = q.split(ROUTE_SEP).map(s => s.trim()).filter(Boolean);
    if (terms.length >= 2) {
      const ids = [], bad = [];
      for (const t of terms) {
        const r = resolveStation(t);
        if (r.node) ids.push(r.node.id);
        else bad.push(r.ambiguous || r.miss);
      }
      return { kind: "route", terms, ids, bad };
    }
  }
  return { kind: "text", tokens: q.toLowerCase().split(/\s+/).filter(Boolean) };
}

/* Does one station answer to every word typed? Used by the role filter, which
   asks about one specific stop rather than the path as a whole. */
function stationMatches(id, tokens) {
  const n = NODES[id];
  const hay = (n.n + " " + CATS[n.c].name).toLowerCase();
  return tokens.every(t => hay.includes(t));
}

/* What part did the subject station play in this journey? `isSubject` says
   which stops count as the subject, so the same test serves both a typed query
   and a station picked off the map. */
function roleMatch(nodes, isSubject, pos) {
  const last = nodes.length - 1;
  if (pos === "start") return isSubject(nodes[0]);
  if (pos === "end") return isSubject(nodes[last]);
  // A connection is crossed without being either end of the journey.
  if (pos === "mid") return nodes.slice(1, last).some(isSubject);
  if (pos === "none") return !nodes.some(isSubject);
  return nodes.some(isSubject);
}

function routeMatches(p, ids, order) {
  if (order === "exact") {
    return p.nodes.length === ids.length && ids.every((v, i) => p.nodes[i] === v);
  }
  if (order === "any") {
    return ids.every(id => p.nodes.includes(id));
  }
  // "ordered": the stations run back-to-back, in this order, somewhere in the
  // journey — so a three-stop query still finds the ten-stop path that contains it.
  for (let i = 0; i + ids.length <= p.nodes.length; i++) {
    let ok = true;
    for (let j = 0; j < ids.length; j++) if (p.nodes[i + j] !== ids[j]) { ok = false; break; }
    if (ok) return true;
  }
  return false;
}

function searchIndex(p) {
  if (p._idx) return p._idx;
  const names = p.nodes.map(i => NODES[i].n.toLowerCase());
  const fams = [...new Set(p.nodes.map(i => CATS[NODES[i].c].name.toLowerCase()))];
  p._idx = [...names, ...fams, fmtTime(p.t)].join(" ");
  return p._idx;
}

function applyFilters() {
  const A = analyse(S.paths);
  const Q = parseQuery(S.q);
  const routeOK = Q.kind === "route" && Q.ids.length >= 2 && !Q.bad.length;

  let out = S.paths.filter(p => {
    // A station picked off the map or the traffic list is a subject too, so the
    // role filter applies to it exactly as it does to a typed one.
    if (S.station != null && !roleMatch(p.nodes, id => id === S.station, S.pos)) return false;
    // "Touches this category" barely narrows anything (63% of journeys touch
    // all four), so the category carries a role exactly as a station does.
    if (S.fam !== "all" && !roleMatch(p.nodes, id => NODES[id].c === S.fam, S.famPos)) return false;
    if (S.len === "short" && p.nodes.length > 4) return false;
    if (S.len === "mid" && (p.nodes.length < 5 || p.nodes.length > 7)) return false;
    if (S.len === "long" && p.nodes.length < 8) return false;
    if (S.len === "fourline" && new Set(p.nodes.map(i => NODES[i].c)).size < 4) return false;
    if (S.len === "unique" && (A.routeKey.get(p.nodes.join(">")) || 0) > 1) return false;

    if (Q.kind === "code") {
      return p.nodes.length === Q.ids.length && Q.ids.every((v, i) => p.nodes[i] === v);
    }
    if (Q.kind === "route") {
      return routeOK ? routeMatches(p, Q.ids, S.order) : false;
    }
    if (Q.kind === "text") {
      const isSubject = id => stationMatches(id, Q.tokens);
      // "Not used" inverts the search: the words must appear nowhere in the
      // journey, so the usual "every word appears somewhere" test would rule
      // out every result before this one got a chance to run.
      if (S.pos === "none") return roleMatch(p.nodes, isSubject, "none");
      // Otherwise: every word has to appear somewhere in the journey…
      if (!Q.tokens.every(t => searchIndex(p).includes(t))) return false;
      // …and when a role is asked for, in a stop playing that role.
      if (S.pos !== "any" && !roleMatch(p.nodes, isSubject, S.pos)) return false;
    }
    return true;
  });

  const by = {
    new: (a, b) => (b.t || 0) - (a.t || 0),
    old: (a, b) => (a.t || 0) - (b.t || 0),
    longest: (a, b) => b.nodes.length - a.nodes.length || (b.t || 0) - (a.t || 0),
    shortest: (a, b) => a.nodes.length - b.nodes.length || (b.t || 0) - (a.t || 0)
  };
  out.sort(by[S.sort] || by.new);
  S.results = out;
  return { out, Q, routeOK };
}

/* The mode row is contextual: asking "was it the start or the end?" only makes
   sense for one station, and asking "in this order?" only makes sense for two
   or more. Showing both at once produced meaningless combinations, so the row
   swaps to whichever question the typed query actually raises. */
/* The role a station played in a journey. "Anywhere" is the no-filter default;
   the four below it are the readings. "Not used" is the inverse — journeys that
   never reached the station at all — which is the one you cannot get to by
   searching, and the reason this is a filter rather than just a sort. */
const POS_MODES = [
  ["any", "Anywhere on the path"],
  ["start", "As a starting point"],
  ["end", "As an end point"],
  ["mid", "As a connection"],
  ["none", "Not used"]
];
/* Phrasing for the toast and the map read-out, so a filtered count never
   describes itself as "journeys through X" when X was excluded. */
const POS_LABEL = { any:"anywhere", start:"as a starting point", end:"as an end point",
                    mid:"as a connection", none:"not used" };
const POS_PHRASE = {
  any: "through", start: "starting at", end: "ending at",
  mid: "passing through", none: "that never reach"
};
const ORDER_MODES = [
  ["ordered", "In this order"],
  ["any", "Same stations, any order"],
  ["exact", "This exact route only"]
];

/* What the role filter is talking about, named properly. A typed "hope"
   resolves to "Hope" so the sentence under the box reads as a station rather
   than as an echo of the keystrokes; an ambiguous fragment stays quoted, since
   it genuinely is just text at that point. */
function subjectName() {
  if (S.station != null) return NODES[S.station].n;
  const q = S.q.trim();
  if (!q) return "";
  const r = resolveStation(q);
  return r.node ? r.node.n : `“${q}”`;
}

function renderSearchModes(Q, routeOK) {
  const row = $("modeRow"), note = $("searchNote");
  const chips = $("modeChips"), sel = $("modeSelectWrap");

  // The role dropdown needs a subject — a typed station or one picked off the
  // map. It shows exactly when it can do something, rather than sitting there
  // greyed out for the whole page.
  const subject = (S.station != null || (Q.kind === "text" && Q.tokens.length))
    ? subjectName() : null;

  if (Q.kind === "route") {
    row.hidden = false; chips.hidden = false; sel.hidden = true;
    $("modeLabel").textContent = "Match";
    chips.innerHTML = ORDER_MODES.map(([v, label]) =>
      `<button type="button" class="rs-chip${S.order === v ? " on" : ""}" data-order="${v}">${esc(label)}</button>`).join("");
    if (!routeOK) {
      const bad = Q.bad.map(b => `“${esc(b)}”`).join(", ");
      note.innerHTML = `<b>No single station matches ${bad}.</b> Type more of the name — station names are things like Fear, Vulnerability, Hope.`;
    } else {
      const names = Q.ids.map(i => `<b>${esc(NODES[i].n)}</b>`).join(" &rsaquo; ");
      note.innerHTML = S.order === "exact"
        ? `Journeys that are exactly ${names} and nothing else.`
        : S.order === "any"
          ? `Journeys that visit ${names} in any order.`
          : `Journeys that go ${names} back to back, in that order.`;
    }
    return;
  }

  if (Q.kind === "code") {
    row.hidden = true;
    note.innerHTML = S.results.length
      ? `<b>Path code ${esc(pathCode(Q.ids))}.</b> This is that journey — clear the search to see it among the rest.`
      : `<b>Path code ${esc(pathCode(Q.ids))}.</b> No journey in this set matches it.`;
    return;
  }

  if (subject) {
    row.hidden = false; chips.hidden = true; sel.hidden = false;
    $("modeLabel").textContent = subject;
    $("posMode").innerHTML = POS_MODES.map(([v, label]) =>
      `<option value="${v}">${esc(label)}</option>`).join("");
    $("posMode").value = POS_MODES.some(m => m[0] === S.pos) ? S.pos : "any";
    const name = `<b>${esc(subject)}</b>`;
    note.innerHTML =
      S.pos === "none" ? `Journeys that never reach ${name}.`
        : S.pos === "start" ? `Journeys that began at ${name}.`
          : S.pos === "end" ? `Journeys that ended at ${name}.`
            : S.pos === "mid" ? `Journeys that crossed ${name} on the way to somewhere else.`
              : `Every journey that touched ${name}. Chain stations with <b>&rsaquo;</b> to search a route instead.`;
    return;
  }

  row.hidden = true;
  note.innerHTML = `<b>Have a path code from the night?</b> Enter it here &mdash; it looks like <b>MT-4ISJWX</b>. Otherwise: type a station to find every journey through it, then narrow by the part it played. Chain stations with <b>&rsaquo;</b> (or a dash) to search a route: <b>Fear &rsaquo; Vulnerability &rsaquo; Hope</b>.`;
}

/* A mode with no subject left to act on is a trap: it stays armed, invisible,
   and silently narrows the next search. Both are dropped the moment the thing
   they describe goes away — the role filter when there is neither a typed
   station nor a selected one, the order filter when the query stops being a
   route. Called from one place so every entry point is covered. */
function normaliseModes() {
  const kind = parseQuery(S.q).kind;
  if (kind !== "route") S.order = "ordered";
  if (kind !== "text" && S.station == null) S.pos = "any";
}

let cardObserver = null;
function renderBrowser() {
  normaliseModes();
  const { out, Q, routeOK } = applyFilters();
  const grid = $("grid");
  const total = S.paths.length;

  $("resultCount").innerHTML = out.length === total
    ? `<b>${total}</b> journey${total === 1 ? "" : "s"}`
    : `<b>${out.length}</b> of ${total}`;
  renderSearchModes(Q, routeOK);

  const active = [];
  if (S.station != null) active.push({ k: "station", label: NODES[S.station].n });
  if (S.fam !== "all") active.push({ k: "fam",
    label: CATS[S.fam].name + (S.famPos === "any" ? "" : " — " + POS_LABEL[S.famPos]) });
  if (S.len !== "all") active.push({ k: "len", label: LEN_LABELS[S.len] });
  if (S.q.trim()) active.push({ k: "q", label: `“${S.q.trim()}”` });
  $("activeFilters").innerHTML = active.map(a =>
    `<button type="button" class="rs-chip on" data-drop="${a.k}">${esc(a.label)} <em>&times;</em></button>`).join("")
    + (active.length > 1 ? `<button type="button" class="rs-chip" data-drop="all">Clear all</button>` : "");

  if (cardObserver) cardObserver.disconnect();

  if (!out.length) {
    // "Nothing matches" is only true if something was actually asked for — an
    // empty set with no filters on means the night simply has no journeys.
    grid.innerHTML = `<p class="rs-empty">${
      !total ? "No journeys have been cast yet."
      : Q.kind === "code" ? "Nothing matches that.<br>That keepsake link doesn't correspond to a journey in this set."
      : Q.kind === "route" && routeOK ? `No journey went that way.<br>Try <b>Same stations, any order</b> above.`
      : Q.kind === "route" ? "Nothing to search for yet — check the station names above."
      : "Nothing matches that.<br>Try a station name — Hope, Doubt, Solidarity — or clear the filters."
    }</p>`;
    $("moreWrap").hidden = true;
    return;
  }

  const slice = out.slice(0, S.shown);
  grid.innerHTML = slice.map(p => `
    <button type="button" class="rs-card" data-id="${esc(p.id)}">
      <span class="rs-thumb"><canvas></canvas></span>
      <span class="rs-cmeta">
        <span class="rs-croute">${esc(pathLabel(p))}</span>
        <span class="rs-csub">${p.nodes.length} stations${p.t ? ` &middot; ${esc(fmtTime(p.t))}` : ""}${p.seeded ? ` <em>demo</em>` : ""}</span>
      </span>
    </button>`).join("");

  // Thumbnails paint only once a card is near the viewport — 300 canvases drawn
  // eagerly is several seconds of jank on a phone.
  cardObserver = new IntersectionObserver((entries, obs) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      obs.unobserve(e.target);
      const p = S.paths.find(x => x.id === e.target.dataset.id);
      const cv = e.target.querySelector("canvas");
      if (p && cv) paintWhenSized(cv, () => renderConstellation(cv, p.nodes, S.theme, { labels: false }));
    }
  }, { rootMargin: "300px 0px" });
  grid.querySelectorAll(".rs-card").forEach(c => cardObserver.observe(c));

  $("moreWrap").hidden = out.length <= S.shown;
  $("moreBtn").textContent = `Show ${Math.min(PAGE_SIZE, out.length - S.shown)} more`;
  $("moreRemaining").textContent = `${out.length - S.shown} left`;
}

const LEN_LABELS = {
  all: "Any length", short: "3–4 stations", mid: "5–7 stations", long: "8–10 stations",
  fourline: "Crosses all four mood categories", unique: "Route nobody repeated"
};

/* ---------------- journey lightbox ---------------- */
function openJourney(id) {
  const p = S.paths.find(x => x.id === id);
  if (!p) return;
  const A = analyse(S.paths);
  const twins = (A.routeKey.get(p.nodes.join(">")) || 1) - 1;
  $("jTitle").textContent = pathLabel(p);
  $("jWhen").textContent = fmtDateTime(p.t);
  $("jStops").innerHTML = p.nodes.map((i, k) => {
    const n = NODES[i];
    return `<span><i style="background:${catColor(n.c, S.theme)}"></i>${k + 1}. ${esc(n.n)}</span>`;
  }).join("");
  $("jFacts").innerHTML = [
    `${p.nodes.length} stations`,
    `${new Set(p.nodes.map(i => NODES[i].c)).size} of 4 mood categories`,
    twins ? `${twins} other${twins === 1 ? "" : "s"} traced this exact route` : "Route traced by this person alone"
  ].map(t => `<span>${esc(t)}</span>`).join("")
    // The code that was on the receipt, so someone can check they have the
    // right path — and read it back out to a friend. A button rather than a
    // span: selecting text inside a chip on a phone is a fight nobody wins.
    + `<button type="button" class="jcode" data-code="${esc(pathCode(p.nodes))}"
         title="Copy path code">${esc(pathCode(p.nodes))}${Icons.copy}</button>`;
  $("jModal").classList.add("on");
  $("jModal").setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  $("jModal")._path = p;
  paintWhenSized($("jCanvas"), () => renderConstellation($("jCanvas"), p.nodes, S.theme));
}
/* Flash a tick on a button for a beat, then put it back. Used by both the copy
   chip and the save button — on a phone neither one produces any visible
   feedback of its own, and a control that looks like it did nothing gets
   pressed again and again. */
function flashDone(btn, restore) {
  btn.classList.add("done");
  clearTimeout(btn._flash);
  btn._flash = setTimeout(() => { btn.classList.remove("done"); restore(); }, 1500);
}

async function copyText(str) {
  try {
    await navigator.clipboard.writeText(str);
    return true;
  } catch (_) {
    // Safari refuses the async clipboard outside a few contexts; the old
    // execCommand path still works there and costs nothing to keep.
    try {
      const ta = document.createElement("textarea");
      ta.value = str;
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch (__) { return false; }
  }
}

/* Save the constellation as a PNG. A <canvas> cannot be long-pressed and saved
   the way an <img> can, so on a phone this is the only route to keeping the
   picture. Re-rendered at 2x into an offscreen canvas rather than exporting the
   one on screen: the on-screen one is sized for a 42vh box and would come out
   as a small, soft image. */
function saveJourneyPNG(p, btn) {
  // CSS pixels, not output pixels. renderConstellation sizes its type against
  // the box it is drawing into and then multiplies by devicePixelRatio, so a
  // 1400px-wide holder would produce 11px labels on a 2800px image. 700x450 at
  // 2x lands a 1400x900 PNG whose labels are the size they look on screen.
  const W = 700, H = 450;
  const holder = document.createElement("div");
  holder.style.cssText = `position:fixed;left:-99999px;top:0;width:${W}px;height:${H}px`;
  const cv = document.createElement("canvas");
  holder.appendChild(cv);
  document.body.appendChild(holder);
  renderConstellation(cv, p.nodes, S.theme);
  const url = cv.toDataURL("image/png");
  holder.remove();

  const a = document.createElement("a");
  a.href = url;
  a.download = `mood-topography-${pathCode(p.nodes)}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (btn) flashDone(btn, () => { btn.innerHTML = Icons.download; });
  if (btn) btn.innerHTML = Icons.check;
}

function closeJourney() {
  $("jModal").classList.remove("on");
  $("jModal").setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  $("jModal")._path = null;
}

/* ============================================================
   URL STATE — so a filtered view is itself shareable
   ============================================================ */
function syncURL() {
  const parts = [];
  // Only carry the mode that the current query actually uses — `pos` on a route
  // search or `order` on a single station does nothing, and leaving it in the
  // hash makes a shared link look like it means more than it does.
  const kind = parseQuery(S.q).kind;
  if (S.q.trim()) parts.push("q=" + encodeURIComponent(S.q.trim()));
  if (S.pos !== "any" && (kind === "text" || S.station != null)) parts.push("pos=" + S.pos);
  if (S.order !== "ordered" && kind === "route") parts.push("order=" + S.order);
  if (S.fam !== "all") parts.push("fam=" + S.fam);
  if (S.famPos !== "any" && S.fam !== "all") parts.push("fampos=" + S.famPos);
  if (S.len !== "all") parts.push("len=" + S.len);
  if (S.sort !== "new") parts.push("sort=" + S.sort);
  if (S.station != null) parts.push("at=" + S.station);
  history.replaceState(null, "", location.pathname + location.search + (parts.length ? "#" + parts.join("&") : "#"));
}
function readURL() {
  const h = new URLSearchParams(location.hash.replace(/^#/, ""));
  S.q = h.get("q") || "";
  S.pos = POS_MODES.some(m => m[0] === h.get("pos")) ? h.get("pos") : "any";
  S.order = ORDER_MODES.some(m => m[0] === h.get("order")) ? h.get("order") : "ordered";
  S.fam = h.get("fam") || "all";
  S.famPos = POS_MODES.some(m => m[0] === h.get("fampos")) ? h.get("fampos") : "any";
  S.len = h.get("len") || "all";
  S.sort = h.get("sort") || "new";
  const at = h.get("at");
  S.station = at !== null && at !== "" && NODES[+at] ? +at : null;
}

/* ============================================================
   THEME
   ============================================================ */
function applyTheme() {
  document.documentElement.dataset.theme = S.theme;
  $("themeBtn").setAttribute("aria-label", S.theme === "dark" ? "Switch to light" : "Switch to dark");
}
function repaintAll() {
  renderBulletins();
  renderCharts();
  renderMapReadout();
  drawAggregate();
  renderBrowser();
  const p = $("jModal")._path;
  if (p) paintWhenSized($("jCanvas"), () => renderConstellation($("jCanvas"), p.nodes, S.theme));
}

/* ============================================================
   WIRING
   ============================================================ */
function wire() {
  // theme
  $("themeBtn").innerHTML = Icons.theme;
  $("themeBtn").onclick = () => {
    S.theme = S.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem(THEME_KEY, S.theme); } catch (_) {}
    applyTheme();
    repaintAll();
  };

  // map
  mapCanvas.addEventListener("click", mapTapped);
  $("mapExpand").innerHTML = Icons.fullscreen;
  $("mapExpand").onclick = () => {
    const box = $("mapBox");
    if (document.fullscreenElement) document.exitFullscreen();
    else (box.requestFullscreen?.({ navigationUI: "hide" }) ?? box.webkitRequestFullscreen?.())?.catch?.(() => {});
  };
  document.addEventListener("fullscreenchange", () => setTimeout(drawAggregate, 60));

  // search
  const search = $("search");

  /* Refining a search keeps its mode ("hope" → "hope fear" stays on Where it
     ended); changing what kind of search it is drops the mode that no longer
     applies. Without this, setting Where it ended once left it silently armed
     for every later search — the next station typed would quietly return only
     the journeys that finished there. */
  function setQuery(v) {
    S.q = v;
    normaliseModes();
    S.shown = PAGE_SIZE;
    renderBrowser();
    syncURL();
  }

  let debounce = null;
  search.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => setQuery(search.value), 140);
  });
  $("searchClear").onclick = () => {
    search.value = ""; setQuery(""); search.focus();
  };

  // Route-matching chips.
  $("modeChips").addEventListener("click", ev => {
    const b = ev.target.closest("[data-order]"); if (!b) return;
    S.order = b.dataset.order;
    S.shown = PAGE_SIZE; renderBrowser(); syncURL();
  });
  // The part the subject station played.
  $("posMode").addEventListener("change", ev => {
    S.pos = ev.target.value;
    S.shown = PAGE_SIZE;
    renderBrowser(); renderMapReadout(); syncURL();
    // If the notice is still on screen it is now quoting a count and a verb
    // that no longer describe what is shown — restate it rather than let it
    // contradict the grid.
    if (S.station != null && $("filterToast").classList.contains("on")) showFilterToast(S.station);
  });

  // family + length chips
  $("famSelect").addEventListener("change", ev => {
    S.fam = ev.target.value;
    if (S.fam === "all") S.famPos = "any";      // no subject, no role
    S.shown = PAGE_SIZE;
    paintControls(); renderBrowser(); syncURL();
  });
  $("famPos").addEventListener("change", ev => {
    S.famPos = ev.target.value; S.shown = PAGE_SIZE;
    renderBrowser(); syncURL();
  });
  $("lenSelect").addEventListener("change", ev => {
    S.len = ev.target.value; S.shown = PAGE_SIZE; renderBrowser(); syncURL();
  });
  $("sortSelect").addEventListener("change", ev => {
    S.sort = ev.target.value; renderBrowser(); syncURL();
  });

  // dismissable active-filter chips
  $("activeFilters").addEventListener("click", ev => {
    const b = ev.target.closest("[data-drop]"); if (!b) return;
    const k = b.dataset.drop;
    if (k === "all") { S.q = ""; S.fam = "all"; S.famPos = "any"; S.len = "all"; S.station = null; S.pos = "any"; S.order = "ordered"; search.value = ""; }
    if (k === "q") { S.q = ""; S.pos = "any"; S.order = "ordered"; search.value = ""; }
    if (k === "fam") { S.fam = "all"; S.famPos = "any"; }
    if (k === "len") S.len = "all";
    if (k === "station") S.station = null;
    S.shown = PAGE_SIZE;
    paintControls(); renderBrowser(); renderCharts(); renderMapReadout(); drawAggregate(); syncURL();
  });

  // traffic chart rows double as station filters
  $("traffic").addEventListener("click", ev => {
    const b = ev.target.closest("[data-station]"); if (!b) return;
    const id = +b.dataset.station;
    S.shown = PAGE_SIZE;
    selectStation(S.station === id ? null : id, true);
  });

  $("neverMode").addEventListener("change", ev => {
    S.neverMode = ev.target.value;
    renderCharts();
  });

  // toast actions
  $("toastGo").onclick = () => {
    $("browser").scrollIntoView({ behavior: "smooth", block: "start" });
    hideToast();
  };
  $("toastClose").onclick = hideToast;

  // bulletins that point at a single path open it, like a card
  $("bulletins").addEventListener("click", ev => {
    const c = ev.target.closest("[data-open]"); if (!c) return;
    openJourney(c.dataset.open);
  });
  $("bulletins").addEventListener("keydown", ev => {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    const c = ev.target.closest("[data-open]"); if (!c) return;
    ev.preventDefault(); openJourney(c.dataset.open);
  });

  // cards
  $("grid").addEventListener("click", ev => {
    const c = ev.target.closest(".rs-card"); if (!c) return;
    openJourney(c.dataset.id);
  });
  $("moreBtn").onclick = () => { S.shown += PAGE_SIZE; renderBrowser(); };

  // lightbox
  $("jClose").innerHTML = Icons.close;
  $("jClose").onclick = closeJourney;
  $("jModal").addEventListener("click", ev => { if (ev.target === $("jModal")) closeJourney(); });
  $("jSave").innerHTML = Icons.download;
  $("jSave").onclick = () => {
    const p = $("jModal")._path;
    if (p) saveJourneyPNG(p, $("jSave"));
  };
  // Delegated: the chip is rebuilt every time a journey opens.
  $("jFacts").addEventListener("click", async ev => {
    const btn = ev.target.closest(".jcode");
    if (!btn) return;
    const code = btn.dataset.code;
    if (await copyText(code)) {
      btn.innerHTML = esc("Copied") + Icons.check;
      flashDone(btn, () => { btn.innerHTML = esc(code) + Icons.copy; });
    }
  });
  document.addEventListener("keydown", ev => { if (ev.key === "Escape") { closeJourney(); closeShare(); } });

  // share
  $("shareBtn").onclick = openShare;
  $("shareVeil").addEventListener("click", closeShare);
  $("copyBtn").onclick = async () => {
    try {
      await navigator.clipboard.writeText(shareLink());
      $("copyBtn").textContent = "Copied";
      setTimeout(() => { $("copyBtn").textContent = "Copy link"; }, 1600);
    } catch (_) { prompt("Copy this link:", shareLink()); }
  };

  // A ResizeObserver rather than a one-shot draw: the box is aspect-ratio sized
  // inside a section that is revealed at boot, so its real dimensions land a
  // frame or two after we unhide it. This also covers rotation and fullscreen.
  let mapT = null;
  new ResizeObserver(() => {
    clearTimeout(mapT);
    mapT = setTimeout(drawAggregate, 60);
  }).observe($("mapBox"));

  // Rotating a phone into landscape crosses the 760px line where the strip's
  // thumbnails switch on, and a canvas revealed from display:none has no
  // drawing in it. Repaint them whenever the width changes.
  let bthumbT = null, lastW = innerWidth;
  addEventListener("resize", () => {
    if (innerWidth === lastW) return;
    lastW = innerWidth;
    clearTimeout(bthumbT);
    bthumbT = setTimeout(paintBulletinThumbs, 160);
  });

  /* Both loops idle whenever nobody can see them. A results page is something
     people leave open in a tab, and two rAF loops running against a map that is
     four screens above the fold is a pointless drain on a phone battery. */
  new IntersectionObserver(entries => {
    mapAnim.visible = entries[0].isIntersecting;
    if (mapAnim.visible && !document.hidden && !reducedMotion()) {
      if (!mapAnim.raf) { mapAnim.last = 0; mapAnim.raf = requestAnimationFrame(mapFrame); }
    } else {
      stopMapAnimation();
      paintMapStatic();
    }
  }, { rootMargin: "120px 0px" }).observe($("mapBox"));

  new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) startMarquee(); else stopMarquee();
  }, { rootMargin: "120px 0px" }).observe($("marquee"));

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { stopMapAnimation(); stopMarquee(); return; }
    if (mapAnim.visible) startMapAnimation();
    startMarquee();
  });
}

/* Share the directory, not the file. The page is index.html, so pathname ends
   in "/index.html" — a URL that works but reads as a filepath on a poster. */
const shareLink = () =>
  location.origin + location.pathname.replace(/index\.html$/, "");

function openShare() {
  const url = shareLink();
  $("shareURL").textContent = url;
  renderQR($("shareQR"), url, 200);
  $("shareVeil").classList.add("on");
}
function closeShare() { $("shareVeil").classList.remove("on"); }

function paintControls() {
  $("famSelect").innerHTML = [["all", "All mood categories"], ...CAT_ORDER.map(c => [c, CATS[c].name])]
    .map(([v, label]) => `<option value="${v}">${esc(label)}</option>`).join("");
  $("famSelect").value = S.fam;
  $("famPosWrap").hidden = S.fam === "all";
  $("famPos").innerHTML = POS_MODES.map(([v, label]) =>
    `<option value="${v}">${esc(label)}</option>`).join("");
  $("famPos").value = POS_MODES.some(m => m[0] === S.famPos) ? S.famPos : "any";
  $("lenSelect").value = S.len;
  $("sortSelect").value = S.sort;
  $("search").value = S.q;

}

function setWorkingSet() {
  // Rehearsal paths never reach the public page. There is no visitor-facing
  // control for this on purpose — the operator's Settings toggle decides what
  // counts as real, and ?demo=1 is a private hatch for previewing the page
  // before anything has been cast.
  S.paths = S.includeDemo ? S.all : S.all.filter(p => !p.seeded);
  S.paths.forEach(p => { p._idx = null; });
  Store.paths = S.paths;
  Store.version++;          // invalidates analyse()'s cache
  buildBulletins();
}

function renderSource() {
  const el = $("source");
  if (!S.source) { el.textContent = ""; return; }
  const { kind, at } = S.source;
  const when = at ? new Date(at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "";
  el.innerHTML = kind === "snapshot"
    ? `<i class="rs-dot"></i>Final results${when ? ` &middot; frozen ${esc(when)}` : ""}`
    : `<i class="rs-dot live"></i>Live${when ? ` &middot; read ${esc(when)}` : ""}
       <button type="button" class="rs-clear" id="reloadBtn">Refresh</button>`;
  const rb = $("reloadBtn");
  if (rb) rb.onclick = () => location.reload();
}

/* ============================================================
   BOOT
   ============================================================ */
async function boot() {
  try { S.theme = localStorage.getItem(THEME_KEY) || "dark"; } catch (_) {}
  applyTheme();
  readURL();

  let data;
  try {
    data = await loadData();
  } catch (err) {
    $("loading").innerHTML = `<p class="rs-empty">Couldn't reach the results.<br>
      <span class="rs-dim">${esc(err.message || String(err))}</span></p>`;
    return;
  }

  S.all = data.paths;
  S.event = { ...EVENT_DEFAULTS, ...(data.event || {}) };
  S.source = { kind: data.kind, label: data.label, at: data.at };
  S.hasReal = S.all.some(p => !p.seeded);
  S.includeDemo = new URLSearchParams(location.search).get("demo") === "1";
  setWorkingSet();

  $("loading").hidden = true;
  $("page").hidden = false;
  $("footWhen").textContent = fmtNightOf(S.all);
  $("rehearsalNote").hidden = !S.includeDemo;

  wire();
  paintControls();
  renderSource();
  renderHeadline();
  renderBulletins();
  renderCharts();
  renderMapReadout();
  renderBrowser();

  /* Arrived from a printed QR. Deliberately no auto-scroll: the hero and the
     map are the designed opening and jumping past them to a grid of thumbnails
     would waste the one moment the piece has. The notice says the path is here
     and offers to go, which leaves the choice with the reader. */
  const arrivedWith = parseQuery(S.q);
  if (arrivedWith.kind === "code") {
    showToast(S.results.length
      ? `Found the journey for <b>${esc(pathCode(arrivedWith.ids))}</b>`
      : `No journey here matches <b>${esc(pathCode(arrivedWith.ids))}</b>`,
      { sticky: true });
  }

  // The bundled variable fonts usually arrive after first paint, and a canvas
  // doesn't re-flow when they do — so repaint the two surfaces that draw text.
  // Deliberately NOT renderBrowser(): that rebuilds the grid, which throws away
  // every thumbnail already painted and re-arms the observer from scratch. Card
  // thumbnails carry no text anyway, so they have nothing to catch up on.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      drawAggregate();
      paintBulletinThumbs();
    });
  }
}

boot();
