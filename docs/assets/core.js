/* ============================================================
   THE TOPOGRAPHY OF US — shared core
   Station data, geometry, aggregate analysis, and the canvas renderer.
   Loaded after store.js on every page (index does not need it).
   ============================================================ */
"use strict";

const CATS = {
  F:{name:"Friction & Resistance",   color:"#E8402A"},
  R:{name:"Foundations & Reflection",color:"#3B57C4"},
  C:{name:"Connection & Empathy",    color:"#00A277"},
  M:{name:"Momentum & Vision",       color:"#F2A007"}
};
const CATS_LIGHT = {F:"#C42B18", R:"#2A42A6", C:"#00785A", M:"#C47A00"};
// Grayscale palette for print — thermal printers dither greys cleanly, and
// distinct values per line preserve some of the on-screen visual variation
// without pretending it's colour.
const CATS_PRINT = {F:"#1e1e1e", R:"#3d3d3d", C:"#5a5a5a", M:"#2d2d2d"};
const catColor = (c,theme)=>
  theme==="print" ? CATS_PRINT[c] :
  theme==="light" ? CATS_LIGHT[c] :
  CATS[c].color;

// Solved by relax2.js: each of the four mood categories fills its own region with a
// real gutter between quadrants, semantic bridges pull related stations toward each other,
// and every station keeps a minimum ~155px of clear space from every other. Re-run the
// solver rather than hand-editing coordinates if stations are ever added or renamed.
const NODES = [
  {n:"Apathy",         c:"F", x:383, y:202},
  {n:"Burnout",        c:"F", x:82,  y:279},
  {n:"Stagnation",     c:"F", x:115, y:107},
  {n:"Frustration",    c:"F", x:306, y:50},
  {n:"Conflict",       c:"F", x:530, y:50},
  {n:"Fear",           c:"F", x:473, y:372},
  {n:"Doubt",          c:"F", x:647, y:360},
  {n:"Unknown",        c:"F", x:606, y:198},
  {n:"Grief",          c:"F", x:265, y:357},
  {n:"Memory",         c:"R", x:79,  y:604},
  {n:"Solitude",       c:"R", x:229, y:545},
  {n:"Tradition",      c:"R", x:383, y:565},
  {n:"Routine",        c:"R", x:81,  y:445},
  {n:"Stillness",      c:"R", x:82,  y:764},
  {n:"Security",       c:"R", x:608, y:755},
  {n:"Pragmatism",     c:"R", x:586, y:564},
  {n:"Logic",          c:"R", x:447, y:755},
  {n:"Observation",    c:"R", x:264, y:751},
  {n:"Vulnerability",  c:"C", x:782, y:523},
  {n:"Care",           c:"C", x:1057,y:446},
  {n:"Listening",      c:"C", x:1312,y:647},
  {n:"Dialogue",       c:"C", x:1149,y:764},
  {n:"Trust",          c:"C", x:1111,y:602},
  {n:"Compromise",     c:"C", x:802, y:733},
  {n:"Belonging",      c:"C", x:1262,y:461},
  {n:"Community",      c:"C", x:941, y:567},
  {n:"Solidarity",     c:"C", x:972, y:764},
  {n:"Adaptation",     c:"M", x:862, y:359},
  {n:"Curiosity",      c:"M", x:918, y:90},
  {n:"Disruption",     c:"M", x:782, y:222},
  {n:"Courage",        c:"M", x:753, y:50},
  {n:"Resilience",     c:"M", x:1004,y:235},
  {n:"Idealism",       c:"M", x:1115,y:64},
  {n:"Hope",           c:"M", x:1329,y:250},
  {n:"Vision",         c:"M", x:1161,y:277},
  {n:"Playfulness",    c:"M", x:1289,y:58}
].map((d,i)=>({id:i,...d}));

const WORLD = {w:1400, h:820};
const NODE_BY_NAME = Object.fromEntries(NODES.map(n=>[n.n,n]));
const MIN_STOPS = 3, MAX_STOPS = 10;

/* ============================================================
   PATH URL ENCODING
   Each station id (0–35) packs into a single base36 char, so a 10-stop path
   becomes 10 chars. Short enough to fit comfortably inside a scannable QR code
   with room for the surrounding URL. The URL is the "receipt" a participant
   takes home — see view.html.
   ============================================================ */
function encodePath(nodeIds){
  return nodeIds.map(i=>i.toString(36)).join("");
}
function decodePath(str){
  if(!str) return [];
  const ids=[...String(str)].map(c=>parseInt(c,36));
  if(ids.some(n=>isNaN(n)||n<0||n>=NODES.length)) return [];
  return ids;
}
/* ------------------------------------------------------------------
   PUBLIC ADDRESS + PATH CODES

   PUBLIC_BASE is the deployed, publicly reachable address of the site. It is
   PRINTED on receipts, so it must be the real public URL and not wherever the
   kiosk happens to be served from — a QR encoding a laptop's LAN address is
   dead paper the moment the participant walks out of the room. Update this if
   the site ever moves.

   A path code is the same base36 the URL hash uses, upper-cased and prefixed so
   a person can read it off thermal paper and type it in. The prefix is load-
   bearing: a bare code is indistinguishable from a station search, because the
   alphabet overlaps completely — "hope" is a perfectly valid four-stop code
   (h,o,p,e → Hope, Care, Listening, Belonging).
   ------------------------------------------------------------------ */
const PUBLIC_BASE  = "https://paulrozenboim.github.io/mood-topography/";
const CODE_PREFIX  = "MT";

function pathCode(nodeIds){
  return CODE_PREFIX + "-" + encodePath(nodeIds).toUpperCase();
}
// Forgiving about how it arrives: any case, dash optional, stray spaces fine.
function parsePathCode(str){
  const m = String(str||"").trim().match(/^mt[\s\-–—_.]*([0-9a-z]+)$/i);
  return m ? decodePath(m[1].toLowerCase()) : [];
}
// The address a receipt points at: the results page with this path already found.
function resultsURLFor(nodeIds){
  return PUBLIC_BASE + "#q=" + encodeURIComponent(pathCode(nodeIds));
}

/* Is the address we are about to PRINT stale?
   A kiosk stays open for hours. Deploy a change — or rename the repo — while
   it sits there and the tab keeps running the JavaScript it loaded this
   morning, including the old PUBLIC_BASE. Every receipt printed after that
   carries a QR to an address that no longer exists, and paper cannot be
   patched. If we are being served from the public site, our own URL must sit
   underneath PUBLIC_BASE; when it doesn't, this page is out of date.
   Skipped on http (the local relay is deliberately on a LAN address that has
   nothing to do with the public URL). */
function printAddressLooksStale(){
  if(location.protocol !== "https:") return false;
  return !location.href.startsWith(PUBLIC_BASE);
}

// Cast timestamp piggybacks on the URL so view.html can show WHEN the path was cast,
// not the visit time. Base36 of seconds-since-epoch fits comfortably in 7 chars.
function encodeTime(ts){ return Math.floor(ts/1000).toString(36) }
function decodeTime(str){
  const n = parseInt(str,36);
  return (isFinite(n) && n>0) ? n*1000 : 0;
}

/* ============================================================
   WHAT EVERY SURFACE ACTUALLY SHOWS
   Store.paths is the full record, rehearsal paths included. Nothing that
   DISPLAYS should read it directly — the wall, the terrain, the archive and
   the analysis all go through here, so one toggle in Settings governs the lot.
   Store.paths itself stays complete: hiding demo paths is a view, not a delete,
   and "Clear demo paths" is still the thing that removes them.
   ============================================================ */
function activePaths(){
  return Store.showDemo ? Store.paths : Store.paths.filter(p => !p.seeded);
}

/* ============================================================
   AGGREGATE ANALYSIS — what the projection's bulletins speak from
   ============================================================ */
let _aCache={v:-1,r:null};
function analyse(paths){
  if(_aCache.v===Store.version && _aCache.r) return _aCache.r;
  const r=_analyse(paths); _aCache={v:Store.version, r}; return r;
}
function _analyse(paths){
  const edges = new Map();
  const traffic = new Array(NODES.length).fill(0);
  const anchors = new Array(NODES.length).fill(0);
  const ends    = new Array(NODES.length).fill(0);
  const catEnd  = {F:0,R:0,C:0,M:0};
  const routeKey = new Map();

  for(const p of paths){
    const ns=p.nodes;
    anchors[ns[0]]++; ends[ns[ns.length-1]]++;
    catEnd[NODES[ns[ns.length-1]].c]++;
    ns.forEach(id=>traffic[id]++);
    for(let i=0;i<ns.length-1;i++){
      const k = ns[i]<ns[i+1] ? ns[i]+"-"+ns[i+1] : ns[i+1]+"-"+ns[i];
      edges.set(k,(edges.get(k)||0)+1);
    }
    routeKey.set(ns.join(">"),(routeKey.get(ns.join(">"))||0)+1);
  }
  const edgeList=[...edges.entries()].map(([k,v])=>{
    const [a,b]=k.split("-").map(Number); return {a,b,v,k};
  }).sort((x,y)=>y.v-x.v);

  let outlier=null, worst=Infinity;
  for(const p of paths){
    if(p.nodes.length<2) continue;
    let s=0;
    for(let i=0;i<p.nodes.length-1;i++){
      const a=p.nodes[i],b=p.nodes[i+1];
      const k=a<b?a+"-"+b:b+"-"+a;
      s += (edges.get(k)||1)-1;
    }
    const score = s/(p.nodes.length-1);
    if(score<worst){worst=score; outlier=p}
  }
  const idx = arr=>arr.indexOf(Math.max(...arr));
  const untouched = NODES.filter(n=>traffic[n.id]===0);

  /* ---- convergence -------------------------------------------------------
     A seven-stop route is one of about 66 billion, so two people tracing the
     identical thing is not a finding, it is a coincidence — and the bulletins
     that hunted for exact matches sat silent all night waiting for one. What
     the room actually produces is overlap: different routes crossing the same
     ground. These are the numbers for saying that.
     ------------------------------------------------------------------------ */

  // How many paths TOUCH a station, as opposed to how many times it is visited.
  // A path that doubles back would otherwise count twice and the percentage
  // could exceed the room.
  const touched = new Array(NODES.length).fill(0);
  for(const p of paths) for(const id of new Set(p.nodes)) touched[id]++;

  // Convergence: the station most journeys ended at, and how many genuinely
  // different routes got there. "12 arrived, 12 different ways" is the claim.
  let convergence = null;
  for(let id=0; id<NODES.length; id++){
    if(ends[id] < 2) continue;
    const routes = new Set(paths.filter(p=>p.nodes[p.nodes.length-1]===id).map(p=>p.nodes.join(">")));
    if(!convergence || ends[id] > convergence.count)
      convergence = {id, count:ends[id], routes:routes.size};
  }

  // Divergence: the station most journeys STARTED at, and how many different
  // places they ended up. Only interesting when they scattered.
  let divergence = null;
  for(let id=0; id<NODES.length; id++){
    if(anchors[id] < 2) continue;
    const dests = new Set(paths.filter(p=>p.nodes[0]===id).map(p=>p.nodes[p.nodes.length-1]));
    // Ranked by how far they scattered, not by how many set off. The busiest
    // anchor is often the least interesting one — five people leaving the same
    // station for two destinations is a crowd, not a divergence.
    if(!divergence || dests.size > divergence.dests ||
       (dests.size === divergence.dests && anchors[id] > divergence.count))
      divergence = {id, count:anchors[id], dests:dests.size};
  }

  // Same anchor AND same destination, by different roads. The strongest version
  // of the whole idea, and it does occur: on 36 real casts, four people went
  // Conflict to Hope and three of those routes were distinct.
  let sameEnds = null;
  const pairMap = new Map();
  for(const p of paths){
    const k = p.nodes[0] + ">" + p.nodes[p.nodes.length-1];
    if(!pairMap.has(k)) pairMap.set(k, []);
    pairMap.get(k).push(p.nodes.join(">"));
  }
  for(const [k, routes] of pairMap){
    if(routes.length < 2) continue;
    const [a,b] = k.split(">").map(Number);
    if(a === b) continue;                       // loops have their own bulletin
    const distinct = new Set(routes).size;
    if(!sameEnds || routes.length > sameEnds.count)
      sameEnds = {a, b, count:routes.length, distinct};
  }

  // Three stations walked back to back by more than one person. A shared
  // stretch of road rather than a shared journey — direction-folded, because
  // crossing the same ground the other way is still the same ground.
  const runs = new Map();
  for(const p of paths){
    for(let i=0;i<p.nodes.length-2;i++){
      const t=[p.nodes[i],p.nodes[i+1],p.nodes[i+2]];
      const k=(t[0]<t[2]?t:[...t].reverse()).join(">");
      runs.set(k,(runs.get(k)||0)+1);
    }
  }
  let sharedRun = null;
  for(const [k,v] of runs){
    if(v < 2) continue;
    if(!sharedRun || v > sharedRun.count) sharedRun = {nodes:k.split(">").map(Number), count:v};
  }

  // The station the largest share of the room passed through at some point.
  let crossing = null;
  if(paths.length >= 4){
    let best = -1;
    for(let id=0; id<NODES.length; id++) if(touched[id] > best){ best = touched[id]; crossing = {id, count:best} }
    if(crossing) crossing.pct = Math.round(100 * crossing.count / paths.length);
  }

  let totalStops=0, longest=null, minimalCount=0, maximalCount=0, recentCount=0;
  const now=Date.now();
  const minimalIds=[], maximalIds=[], recentIds=[];
  for(const p of paths){
    totalStops += p.nodes.length;
    if(!longest || p.nodes.length>longest.nodes.length) longest=p;
    if(p.nodes.length===MIN_STOPS){ minimalCount++; minimalIds.push(p.id) }
    if(p.nodes.length===MAX_STOPS){ maximalCount++; maximalIds.push(p.id) }
    if(now-p.t < 15*60*1000){ recentCount++; recentIds.push(p.id) }
  }
  // Count how many paths tie the longest — so the bulletin can honestly say
  // "one of the longest" instead of "the longest" when multiple share the record.
  let longestCount = 0;
  if(longest){
    for(const p of paths) if(p.nodes.length===longest.nodes.length) longestCount++;
  }
  // Small sample sets for motion:cascade — take the tail (newest) so the animation
  // feels like the room's most recent activity, not an arbitrary slice from hours ago.
  const sampleAny = paths.slice(-8).map(p=>p.id);
  const sampleMin = minimalIds.slice(-5);
  const sampleMax = maximalIds.slice(-5);
  const sampleRecent = recentIds.slice(-8);

  // Per-path category-set signatures for the new "stayed on one line" / "touched
  // every line" / "signature transfer" bulletins. Building this here so bulletin
  // logic stays a pure lookup pass over A.
  const singleCatIds = {F:[], R:[], C:[], M:[]};
  const fourLineIds = [];
  let widest = null, widestArea = 0;
  const anchorSet = new Set();
  const catTransfer = {}; // "F>C" -> count
  for(const p of paths){
    anchorSet.add(p.nodes[0]);
    const cs = new Set(p.nodes.map(i=>NODES[i].c));
    if(cs.size===1) singleCatIds[NODES[p.nodes[0]].c].push(p.id);
    if(cs.size===4) fourLineIds.push(p.id);
    // spatial span — the bounding-box area, so "widest" means largest reach across the map
    const xs=p.nodes.map(i=>NODES[i].x), ys=p.nodes.map(i=>NODES[i].y);
    const area = (Math.max(...xs)-Math.min(...xs)) * (Math.max(...ys)-Math.min(...ys));
    if(area>widestArea){ widestArea=area; widest=p }
    // category transitions — only count actual crossings (skip same-line neighbours)
    for(let i=0; i<p.nodes.length-1; i++){
      const ca=NODES[p.nodes[i]].c, cb=NODES[p.nodes[i+1]].c;
      if(ca!==cb){ const k=ca+">"+cb; catTransfer[k]=(catTransfer[k]||0)+1 }
    }
  }
  const topTransfer = Object.entries(catTransfer).sort((a,b)=>b[1]-a[1])[0] || null;

  // Truly unique paths for the "sole traveller" bulletin — every edge appears in
  // this path and NO other. Only then is "nobody else did" honest.
  // Same pass counts EVERY such path (solitaryCount / solitaryIds), so the
  // "alone in a crowd" bulletin can report the population.
  let solitary = null;
  const solitaryIds = [];
  for(const p of paths){
    if(p.nodes.length<2) continue;
    let allUnique = true;
    for(let i=0;i<p.nodes.length-1;i++){
      const a=p.nodes[i],b=p.nodes[i+1];
      const k=a<b?a+"-"+b:b+"-"+a;
      if((edges.get(k)||0) > 1){ allUnique=false; break }
    }
    if(allUnique){
      if(!solitary) solitary=p;
      solitaryIds.push(p.id);
    }
  }

  // Distinct end stations, mirroring the anchorCount already tracked.
  const endStationSet = new Set();
  for(const p of paths){ if(p.nodes.length) endStationSet.add(p.nodes[p.nodes.length-1]) }
  const endCount = endStationSet.size;

  // Loop-shaped paths — anchor and end in the same mood category.
  const loopIds = [];
  for(const p of paths){
    if(!p.nodes.length) continue;
    const ac = NODES[p.nodes[0]].c;
    const ec = NODES[p.nodes[p.nodes.length-1]].c;
    if(ac === ec) loopIds.push(p.id);
  }
  const loopCount = loopIds.length;

  // "Hinge" station — the one passed through most WITHOUT starting or ending.
  // Anchor + end already anchor a station visually; transit is what makes it
  // a connector rather than a destination.
  let hingeStation = null, hingeCount = 0;
  for(const n of NODES){
    const t = (traffic[n.id]||0) - (anchors[n.id]||0) - (ends[n.id]||0);
    if(t > hingeCount){ hingeCount = t; hingeStation = n; }
  }

  // Narrowest cross-mood transition still walked at least once tonight —
  // where the map is thinnest.
  let narrowestTransition = null;
  const transferEntries = Object.entries(catTransfer);
  if(transferEntries.length){
    narrowestTransition = transferEntries.slice().sort((a,b)=>a[1]-b[1])[0];
  }
  const catTraffic={F:0,R:0,C:0,M:0};
  NODES.forEach(n=>{ catTraffic[n.c]+=traffic[n.id] });

  let repeatTop=null;
  for(const [rk,count] of routeKey.entries()){
    if(count>1 && (!repeatTop || count>repeatTop.count)) repeatTop={rk, count};
  }
  const repeatExample = repeatTop ? paths.find(p=>p.nodes.join(">")===repeatTop.rk) : null;

  return {edges, edgeList, traffic, anchors, ends, catEnd, catTraffic, routeKey,
          outlier, outlierScore:worst,
          topNode: paths.length?NODES[idx(traffic)]:null,
          topAnchor: paths.length?NODES[idx(anchors)]:null,
          topEnd: paths.length?NODES[idx(ends)]:null,
          untouched, distinct: routeKey.size, total: paths.length,
          real: paths.filter(p=>!p.seeded).length, seeded: paths.filter(p=>p.seeded).length,
          avgLen: paths.length? totalStops/paths.length : 0,
          longest, longestCount, minimalCount, maximalCount, recentCount,
          sampleAny, sampleMin, sampleMax, sampleRecent,
          singleCatIds, fourLineIds, widest, anchorCount:anchorSet.size,
          topTransfer, solitary,
          endCount, loopCount, loopIds, solitaryCount:solitaryIds.length, solitaryIds,
          hingeStation, hingeCount, narrowestTransition,
          repeatTop, repeatExample,
          touched, convergence, divergence, sameEnds, sharedRun, crossing};
}

function bulletins(A){
  const out=[];
  if(A.total<3){
    out.push({tag:"Service notice", line:"The map is empty. Trace the first route.", sub:"Awaiting first cast"});
    return out;
  }
  const pct = n=> Math.round(n/A.total*100);
  if(A.edgeList[0] && A.edgeList[0].v>1){
    const e=A.edgeList[0];
    out.push({tag:"Heaviest link", accent:NODES[e.a].c,
      line:`${e.v} of you moved between {${NODES[e.a].n}} and {${NODES[e.b].n}}.`,
      sub:"The most walked segment tonight",
      focus:{type:"edge", e, motion:"traverse"}});
  }
  if(A.topNode){
    out.push({tag:"Interchange", accent:A.topNode.c,
      line:`{${A.topNode.n}} is the busiest station tonight.`,
      sub:`Crossed by ${A.traffic[A.topNode.id]} of ${A.total} journeys`,
      focus:{type:"node", id:A.topNode.id, motion:"pulse"}});
  }
  if(A.topAnchor && A.topEnd && A.topAnchor.id!==A.topEnd.id){
    // Old wording said "Most of you" — that means >50%, but the analysis picks a
    // plurality (the single most common), which could be far short of a majority.
    // "The most common" is the honest phrasing.
    out.push({tag:"Direction of travel", accent:A.topEnd.c,
      line:`The most common anchor was {${A.topAnchor.n}}. The most common destination, {${A.topEnd.n}}.`,
      sub:`${A.anchors[A.topAnchor.id]} started there · ${A.ends[A.topEnd.id]} ended there`,
      focus:{type:"edge", e:{a:A.topAnchor.id, b:A.topEnd.id}, motion:"traverse"}});
  }
  const cats=Object.entries(A.catEnd).sort((a,b)=>b[1]-a[1]);
  if(cats[0][1]>0){
    out.push({tag:"Destination", accent:cats[0][0],
      line:`${pct(cats[0][1])}% of journeys end in {${CATS[cats[0][0]].name}}.`,
      sub:`${cats[0][1]} of ${A.total} paths`,
      focus:{type:"cat", c:cats[0][0], motion:"glow"}});
  }
  // Only claim "nobody else did" when EVERY segment of this path appears in it and
  // in no other. The old outlier score (<0.35) let paths through with several
  // shared edges — a lie. If no fully-unique path exists, fall back to the honest
  // "least like any other" phrasing on the outlier.
  if(A.solitary){
    const names=A.solitary.nodes.map(i=>NODES[i].n);
    out.push({tag:"Sole traveller", accent:NODES[A.solitary.nodes[0]].c,
      line:`One person went this way. Nobody else did.`,
      sub:names.join("  →  "),
      focus:{type:"path", id:A.solitary.id, motion:"traverse"}, hold:true});
  } else if(A.outlier && A.outlierScore<0.4){
    const names=A.outlier.nodes.map(i=>NODES[i].n);
    out.push({tag:"Least like the others", accent:NODES[A.outlier.nodes[0]].c,
      line:`This path is the least like any other tonight.`,
      sub:names.join("  →  "),
      focus:{type:"path", id:A.outlier.id, motion:"traverse"}, hold:true});
  }
  if(A.untouched.length){
    const u=A.untouched[Math.floor(Math.random()*A.untouched.length)];
    out.push({tag:"No service", accent:u.c,
      line:`No one has passed through {${u.n}} tonight.`,
      sub:"Station open, unvisited",
      focus:{type:"node", id:u.id, motion:"pulse"}});
  }
  if(A.longest && A.longest.nodes.length>=6){
    // Ties for "the longest" get honest phrasing — several 10-stop paths from different
    // anchors would make the singular version misleading. "Longest journey" the tag,
    // "one of the longest" the sentence.
    const uniq = A.longestCount<=1;
    const opener = uniq ? "The longest journey tonight" : "One of the longest journeys tonight";
    const anchor = uniq ? `, starting at {${NODES[A.longest.nodes[0]].n}}` : "";
    out.push({tag:"Longest journey", accent:NODES[A.longest.nodes[0]].c,
      line:`${opener} ran {${A.longest.nodes.length}} stations${anchor}.`,
      sub:A.longest.nodes.map(i=>NODES[i].n).join("  →  "),
      focus:{type:"path", id:A.longest.id, motion:"traverse"}});
  }
  const catT=Object.entries(A.catTraffic).sort((a,b)=>b[1]-a[1]);
  if(catT[0][1]>0){
    out.push({tag:"Heaviest mood", accent:catT[0][0],
      line:`{${CATS[catT[0][0]].name}} carries the most foot traffic tonight.`,
      sub:`${catT[0][1]} station crossings within that mood alone`,
      focus:{type:"cat", c:catT[0][0], motion:"glow"}});
  }
  if(A.recentCount>0 && A.sampleRecent.length){
    out.push({tag:"Just now", line:`${A.recentCount} journeys have joined the wall in the last 15 minutes.`,
      sub:"The map is still moving",
      focus:{type:"paths", ids:A.sampleRecent, motion:"cascade"}});
  }
  if(A.edgeList[1] && A.edgeList[1].v>1){
    // Old wording: "${e.v} more of you..." — implies "more of the same edge as
    // the last bulletin", but this is a DIFFERENT edge. Reword to "also walked".
    const e=A.edgeList[1];
    out.push({tag:"Also well-travelled", accent:NODES[e.a].c,
      line:`${e.v} of you also walked between {${NODES[e.a].n}} and {${NODES[e.b].n}}.`,
      sub:"The second most walked segment tonight",
      focus:{type:"edge", e, motion:"traverse"}});
  }

  /* ---- convergence bulletins ---------------------------------------------
     These replaced five that were either arithmetic ("the average journey
     visits 7.5 stations") or a hunt for identical routes. A seven-stop path is
     one of sixty-six billion; two people tracing the same one is a coincidence,
     not a finding, and the bulletin waiting for it stayed silent all night.
     Nobody walks the same road. Plenty of people walk the same stretch of it,
     and that is the thing worth saying out loud.
     ------------------------------------------------------------------------ */

  if(A.convergence && A.convergence.count >= 3){
    const n = NODES[A.convergence.id], c = A.convergence;
    out.push({tag:"Convergence", accent:n.c,
      line: c.routes === c.count
        ? `{${c.count}} journeys ended at {${n.n}} — and no two took the same road.`
        : `{${c.count}} journeys ended at {${n.n}}, by {${c.routes}} different roads.`,
      sub:"Same place, different ways of getting there",
      focus:{type:"node", id:n.id, motion:"pulse"}});
  }

  if(A.divergence && A.divergence.count >= 3 && A.divergence.dests >= 2){
    const n = NODES[A.divergence.id], d = A.divergence;
    out.push({tag:"Divergence", accent:n.c,
      line:`{${d.count}} of you started at {${n.n}} and ended in {${d.dests}} different places.`,
      sub:"Where you begin does not decide where you land",
      focus:{type:"node", id:n.id, motion:"pulse"}});
  }

  if(A.sharedRun && A.sharedRun.count >= 2){
    const [a,b,c] = A.sharedRun.nodes.map(i=>NODES[i]);
    // The "no two of you" clause is a claim about the data, so it is only made
    // when the data supports it. A.repeatTop is set the moment any two paths
    // match exactly, which does happen — rarely, and usually because a route
    // reads as a story rather than by chance.
    const allUnique = !A.repeatTop;
    out.push({tag:"Shared road", accent:b.c,
      line: allUnique
        ? `No two of you walked the same route — but {${A.sharedRun.count}} crossed {${a.n}}, {${b.n}} and {${c.n}} back to back.`
        : `{${A.sharedRun.count}} of you crossed {${a.n}}, {${b.n}} and {${c.n}} back to back.`,
      sub:"A stretch of road in common",
      focus:{type:"edge", e:{a:A.sharedRun.nodes[0], b:A.sharedRun.nodes[1], v:A.sharedRun.count}, motion:"traverse"}});
  }

  if(A.sameEnds && A.sameEnds.count >= 2 && A.sameEnds.distinct >= 2){
    const a = NODES[A.sameEnds.a], b = NODES[A.sameEnds.b];
    out.push({tag:"Different roads", accent:b.c,
      line:`{${A.sameEnds.count}} of you went from {${a.n}} to {${b.n}} — and took {${A.sameEnds.distinct}} different ways to get there.`,
      sub:"Same start, same end, different road",
      focus:{type:"node", id:b.id, motion:"pulse"}});
  }

  if(A.crossing && A.crossing.pct >= 25 && A.total >= 6){
    const n = NODES[A.crossing.id];
    out.push({tag:"Common ground", accent:n.c,
      line:`{${A.crossing.pct}%} of the room passed through {${n.n}} at some point tonight.`,
      sub:`${A.crossing.count} of ${A.total} journeys, all of them different`,
      focus:{type:"node", id:n.id, motion:"pulse"}});
  }

  // --- New bulletins --------------------------------------------------------

  // Stayed on one line — paths whose stations all belong to a single category
  const stayed = Object.entries(A.singleCatIds).map(([c,ids])=>[c,ids]).filter(([,ids])=>ids.length>0)
                       .sort((a,b)=>b[1].length-a[1].length);
  if(stayed[0]){
    const [c,ids]=stayed[0];
    out.push({tag:"Stayed on one mood", accent:c,
      line:`${ids.length} of you stayed entirely in {${CATS[c].name}}.`,
      sub:"Never crossed to another mood",
      focus:{type:"cat", c, motion:"glow"}});
  }

  // Touched every line — paths spanning F, R, C, M
  if(A.fourLineIds.length){
    out.push({tag:"Touched every mood",
      line:`${A.fourLineIds.length} of you crossed all four moods in one path.`,
      sub:"The full width of the map, in a single journey",
      focus:{type:"paths", ids:A.fourLineIds.slice(-5), motion:"cascade"}});
  }

  // Widest span — the path with the largest spatial bounding box

  // Distinct anchors — how many different starting stations
  if(A.anchorCount>=2){
    out.push({tag:"Different starts",
      line:`Tonight's journeys began at {${A.anchorCount}} different stations.`,
      sub:`Out of ${NODES.length} on the map`});
  }

  // Signature transfer — the most common category-to-category crossing
  if(A.topTransfer && A.topTransfer[1]>=2){
    const [from,to] = A.topTransfer[0].split(">");
    out.push({tag:"Signature transfer", accent:to,
      line:`The most common crossing tonight: from {${CATS[from].name}} to {${CATS[to].name}}.`,
      sub:`${A.topTransfer[1]} steps between the two moods`,
      focus:{type:"cat", c:to, motion:"glow"}});
  }

  // --- Count-based bulletins (motion:"counts" draws a numeric pill on each station) ---

  if(A.total > 0){
    out.push({tag:"Foot traffic", accent:null,
      line:`Every station's foot traffic tonight.`,
      sub:`Number by each station = journeys that crossed it`,
      focus:{type:"counts", counts:A.traffic, motion:"counts"}});
  }

  if(A.total > 0){
    out.push({tag:"Where journeys begin",
      line:`Where paths tonight anchored themselves.`,
      sub:`Number by each station = journeys that started there`,
      focus:{type:"counts", counts:A.anchors, motion:"counts"}});
  }

  if(A.total > 0){
    out.push({tag:"Where journeys land",
      line:`Where paths tonight arrived.`,
      sub:`Number by each station = journeys that ended there`,
      focus:{type:"counts", counts:A.ends, motion:"counts"}});
  }

  // --- Five more mined from the data ---

  // 1. The hinge — most-crossed station that isn't a start or an end. The map's
  //    connector, not its destination.
  if(A.hingeStation && A.hingeCount >= 2){
    out.push({tag:"The hinge", accent:A.hingeStation.c,
      line:`{${A.hingeStation.n}} is the map's hinge tonight — {${A.hingeCount}} journeys cross it without stopping.`,
      sub:`A connector, not a destination`,
      focus:{type:"node", id:A.hingeStation.id, motion:"pulse"}});
  }

  // 2. Narrow crossing — the thinnest inter-mood transition still walked.
  if(A.narrowestTransition && A.narrowestTransition[1] > 0
     && (!A.topTransfer || A.narrowestTransition[0] !== A.topTransfer[0])){
    const [key, count] = A.narrowestTransition;
    const [from, to] = key.split(">");
    out.push({tag:"Narrow crossing", accent:to,
      line:`Only ${count} step${count===1?"":"s"} tonight moved from {${CATS[from].name}} to {${CATS[to].name}}.`,
      sub:`The map's thinnest mood transition`,
      focus:{type:"cat", c:to, motion:"glow"}});
  }

  // 3. Alone in a crowd — paths whose every segment is unique to them.
  if(A.solitaryCount >= 1){
    const many = A.solitaryCount === 1
      ? `One journey tonight shares not a single segment with any other.`
      : `${A.solitaryCount} journeys tonight share not a single segment with any other.`;
    out.push({tag:"Alone in a crowd",
      line:many,
      sub:`Truly solitary routes across the map`,
      focus:{type:"paths", ids:A.solitaryIds.slice(-5), motion:"cascade"}});
  }

  // 4. Return trips — anchor mood == destination mood. The shape of coming
  //    back to where you started, without following the same route.
  if(A.loopCount >= 2){
    out.push({tag:"Return trips",
      line:`${A.loopCount} of tonight's paths ended where they began — same mood, different way home.`,
      sub:`A shape like a loop`,
      focus:{type:"paths", ids:A.loopIds.slice(-5), motion:"cascade"}});
  }

  // 5. Where the map opens and closes — distinct anchor + end counts side by
  //    side. Says something about spread: many starts vs one destination is a
  //    convergence; few starts vs many destinations is a divergence.
  if(A.anchorCount >= 2 && A.endCount >= 2){
    out.push({tag:"Anchors and destinations",
      line:`{${A.anchorCount}} stations tonight were a starting point. {${A.endCount}} were a destination.`,
      sub:`Out of ${NODES.length} on the map`,
      focus:{type:"counts", counts:A.anchors, motion:"counts"}});
  }

  // Network status — old wording said "unrepeated" but `distinct` = distinct
  // route strings; a route with count=3 counts once in `distinct`, but the three
  // paths sharing it are all "repeated". Say what we actually mean.
  out.push({tag:"Network status",
    line:`${A.total} journeys cast. ${A.distinct} distinct routes among them.`,
    sub:"Every line on this wall was traced by hand"});
  return out;
}

/* ============================================================
   CAST BULLETIN — what the wall says the moment a new path arrives.
   Picks one comparison between the just-cast path and everything else on the
   wall, in a priority order that favours the most dramatic / rarest fact.
   Fires only when a real cast lands (not on historical hydration).
   ============================================================ */
function castBulletin(newPath, allPaths){
  const others = allPaths.filter(p => p.id !== newPath.id);
  const total = allPaths.length;
  const anchor = NODES[newPath.nodes[0]];
  const dest = NODES[newPath.nodes[newPath.nodes.length-1]];

  // 1. Solo debut: this path is the first to touch some previously-untouched station
  const debut = newPath.nodes.find(id =>
    !others.some(p => p.nodes.includes(id))
  );
  if(debut != null && others.length > 0){
    const n = NODES[debut];
    return {tag:"First to visit", accent:n.c,
      line:`This path is the first to touch {${n.n}}.`,
      sub:`A corner of the map, opened for the first time tonight`,
      focus:{type:"node", id:n.id, motion:"pulse"}, hold:true};
  }

  // 2. Exact-route match with someone else — you're not alone
  const routeKey = newPath.nodes.join(">");
  const echoes = others.filter(p => p.nodes.join(">") === routeKey);
  if(echoes.length > 0){
    return {tag:"Well-worn path", accent:anchor.c,
      line:`${echoes.length + 1} of you have now traced this exact route.`,
      sub:newPath.nodes.map(i=>NODES[i].n).join("  →  "),
      focus:{type:"path", id:newPath.id, motion:"traverse"}, hold:true};
  }

  /* 3. All four mood categories in one path — but only while that is still
     unusual. Roughly two thirds of paths touch all four, so this used to be the
     message 13 times in 36 casts, announcing "one of 24 tonight to do so" — a
     sameness claim, and a dull one by the twenty-fourth time. Past the first
     few it falls through to something specific about this path instead. */
  const cats = new Set(newPath.nodes.map(i => NODES[i].c));
  const priorFour = others.filter(p =>
    new Set(p.nodes.map(i => NODES[i].c)).size === 4
  ).length;
  if(cats.size === 4 && priorFour < 4){
    return {tag:"Full spectrum", accent:dest.c,
      line:`This path touches all four moods — ${priorFour ? "one of "+(priorFour+1) : "the first"} tonight to do so.`,
      sub:newPath.nodes.map(i=>NODES[i].n).join("  →  "),
      focus:{type:"path", id:newPath.id, motion:"traverse"}, hold:true};
  }

  // 4. Longest so far — strict > against every other path
  if(others.length && others.every(p => p.nodes.length < newPath.nodes.length)){
    return {tag:"Longest so far", accent:anchor.c,
      line:`The longest journey of the night so far — {${newPath.nodes.length}} stations.`,
      sub:newPath.nodes.map(i=>NODES[i].n).join("  →  "),
      focus:{type:"path", id:newPath.id, motion:"traverse"}, hold:true};
  }

  // 5. Popular anchor — three or more people also started here
  const sharedAnchor = others.filter(p => p.nodes[0] === newPath.nodes[0]).length;
  if(sharedAnchor >= 3){
    return {tag:"Common ground", accent:anchor.c,
      line:`This path joins {${sharedAnchor + 1}} of you who started at {${anchor.n}}.`,
      sub:`Out of ${total} casts, ${anchor.n} is a shared starting point`,
      focus:{type:"node", id:anchor.id, motion:"pulse"}};
  }

  // 6. Popular destination — three or more also ended here
  const sharedEnd = others.filter(p => p.nodes[p.nodes.length-1] === newPath.nodes[newPath.nodes.length-1]).length;
  if(sharedEnd >= 3){
    return {tag:"Shared destination", accent:dest.c,
      line:`This path arrives at {${dest.n}} — where ${sharedEnd + 1} of you have landed tonight.`,
      sub:`A gathering point on the map`,
      focus:{type:"node", id:dest.id, motion:"pulse"}};
  }

  /* 6b. The stretch this path shares with the most people. Almost always fires
     once a few paths are down, and it is the personal version of the whole
     argument: nobody walked your route, but you did not walk it alone either. */
  if(others.length >= 2){
    let best = null;
    for(let i=0; i<newPath.nodes.length-1; i++){
      const a = newPath.nodes[i], b = newPath.nodes[i+1];
      let n = 0;
      for(const o of others){
        for(let j=0; j<o.nodes.length-1; j++){
          if((o.nodes[j]===a && o.nodes[j+1]===b) || (o.nodes[j]===b && o.nodes[j+1]===a)){ n++; break }
        }
      }
      if(n > 0 && (!best || n > best.n)) best = {a, b, n};
    }
    if(best && best.n >= 2){
      const A2 = NODES[best.a], B2 = NODES[best.b];
      return {tag:"Shared road", accent:A2.c,
        line:`Nobody else traced this route — but {${best.n}} of you walked {${A2.n}} to {${B2.n}}.`,
        sub:`A stretch of road in common`,
        focus:{type:"edge", e:{a:best.a, b:best.b, v:best.n+1}, motion:"traverse"}};
    }
  }

  // 7. Stayed entirely on one line
  if(cats.size === 1){
    const c = [...cats][0];
    const sameLine = others.filter(p =>
      new Set(p.nodes.map(i=>NODES[i].c)).size === 1 &&
      NODES[p.nodes[0]].c === c
    ).length;
    return {tag:"Stayed on one mood", accent:c,
      line:`This journey never left {${CATS[c].name}}.`,
      sub:sameLine ? `${sameLine + 1} of tonight's paths kept to that mood` : "The first single-mood path of the night",
      focus:{type:"cat", c, motion:"glow"}};
  }

  // 8. Fallback — welcome to the night, keep the injection front-and-centre
  const ord = ["1st","2nd","3rd"][total-1] || `${total}th`;
  return {tag:"Just cast", accent:anchor.c,
    line:`The ${ord} journey of the night, from {${anchor.n}} to {${dest.n}}.`,
    sub:newPath.nodes.map(i=>NODES[i].n).join("  →  "),
    focus:{type:"path", id:newPath.id, motion:"traverse"}};
}

/* ============================================================
   GEOMETRY — sweeping arteries, gravity-bent
   ============================================================ */
function splinePoints(pts, gravity){
  if(pts.length<2) return pts;
  const P=[pts[0],...pts,pts[pts.length-1]];
  const out=[];
  for(let i=1;i<P.length-2;i++){
    const p0=P[i-1],p1=P[i],p2=P[i+1],p3=P[i+2];
    for(let t=0;t<1;t+=1/18){
      const t2=t*t,t3=t2*t;
      let x=.5*((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3);
      let y=.5*((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3);
      if(gravity){
        const dx=gravity.x-x, dy=gravity.y-y, d=Math.hypot(dx,dy)||1;
        const bell=Math.sin(t*Math.PI);
        const pull=gravity.k*bell*Math.min(1,180/d);
        x+=dx/d*pull*38; y+=dy/d*pull*38;
      }
      out.push({x,y});
    }
  }
  out.push(pts[pts.length-1]);
  return out;
}
const pathPts = p => p.nodes.map(i=>({x:NODES[i].x,y:NODES[i].y}));

/* ============================================================
   GRADIENT STROKE — walk the spline in per-station-segment slices, each stroked
   with a linear gradient from that station's line color into the next station's.
   The spline emits 18 sample points per station-to-station segment (see
   splinePoints), so the slice boundaries land exactly at station transitions.
   Neighbouring segments share their meeting color, so joins are seamless.
   ---
   sp        : screen-space spline points (already toScreen'd)
   catCodes  : one category code per station (length N)
   theme     : "dark" | "light"
   opts      : {lineWidth, alpha, composite, lastCutIndex}
     lastCutIndex is used by progressive-draw callers (injection, cascade) so the
     final partial segment fades to its next-station color even mid-reveal.
   ============================================================ */
const SPLINE_STEPS = 18;
function strokeGradientPath(ctx, sp, catCodes, theme, opts={}){
  const N = catCodes.length;
  if(N<2 || sp.length<2) return;
  const {lineWidth=2, alpha=1, composite=null, lastCutIndex=null, lineCap="round", lineJoin="round"} = opts;
  ctx.save();
  if(composite) ctx.globalCompositeOperation = composite;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = lineCap;
  ctx.lineJoin = lineJoin;
  const cutIndex = (lastCutIndex==null || lastCutIndex>=sp.length-1) ? sp.length-1 : lastCutIndex;
  for(let k=0; k<N-1; k++){
    const iStart = k*SPLINE_STEPS;
    if(iStart >= cutIndex) break;
    const iEnd = Math.min(cutIndex, (k+1)*SPLINE_STEPS);
    const s = sp[iStart], e = sp[iEnd];
    // guard against a zero-length segment producing an invalid gradient
    const grad = (s.x===e.x && s.y===e.y)
      ? catColor(catCodes[k], theme)
      : (()=>{
          const g = ctx.createLinearGradient(s.x, s.y, e.x, e.y);
          g.addColorStop(0, catColor(catCodes[k], theme));
          g.addColorStop(1, catColor(catCodes[k+1], theme));
          return g;
        })();
    ctx.strokeStyle = grad;
    ctx.beginPath();
    for(let i=iStart; i<=iEnd; i++){
      const p = sp[i];
      i===iStart ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/* ============================================================
   SHARED CONSTELLATION RENDER — the take-home version of a single path.
   Same picture drawn in the tablet's cast modal and on view.html. Sizes to the
   canvas's parent, reads its own theme tokens off :root so it always matches
   the surrounding page. Pure — never touches Store.
   ============================================================ */
// 66mm of printable paper (72mm roll less 3mm margins) at 96dpi. Every print
// path renders against this so receipts are identical whatever measured them.
const PRINT_CSS_W = 249;
/* ============================================================
   STATION-LABEL PLACER
   Greedy, collision-aware placement of the numbered station names around a
   drawn path. Longest labels go first so short ones can slot around them; each
   one picks the highest-scoring of twelve candidate slots, scored against
   already-placed rectangles (dots, numbers, earlier labels), against the drawn
   curve itself (a soft penalty — crossing the line is ugly but better than
   nowhere to go), and against running off the canvas.

   This began as print-only. On screen the names were drawn at a flat offset
   below each dot with no collision test and no clipping guard at all, which is
   invisible on a 620px desktop modal and a mess on a 330px phone: names sat on
   top of each other and ran off both edges. Same problem, same solution — so
   the two callers now share one placer and differ only in their constants.
   ============================================================ */
function placeStationLabels(ctx, o){
  const {pts, toS, sp, cssW, cssH, nameFS, numFS, dotClear, radiusAt,
         nameWeight = 700, numWeight = 700} = o;
  const LINE_H = nameFS + 2.5;

  // Numbers sit at a fixed position above each dot; they are obstacles for the
  // names rather than participants in the placement.
  ctx.font = `${numWeight} ${numFS}px 'Martian Mono',monospace`;
  const numRects = pts.map((n,i)=>{
    const s = toS(n);
    const nw = ctx.measureText(String(i+1)).width;
    return {x0: s.x - nw/2 - 1, x1: s.x + nw/2 + 1,
            y0: s.y - dotClear - numFS - 2, y1: s.y - dotClear + 2};
  });
  const dotRects = pts.map((n,i)=>{
    const s = toS(n), rad = radiusAt(i) + 1;
    return {x0: s.x - rad, x1: s.x + rad, y0: s.y - rad, y1: s.y + rad};
  });

  ctx.font = `${nameWeight} ${nameFS}px 'Martian Mono',monospace`;
  const labels = pts.map((n,i)=>{
    const s = toS(n);
    return {s, label: n.n.toUpperCase(), tw: ctx.measureText(n.n.toUpperCase()).width, i};
  });

  // Candidate positions (dy is where the top of the text sits). Order matters —
  // the first-preferred candidate wins ties. Below-center is the default.
  const CAND = [
    {dx: 0,         dy:  dotClear + 2,               al:"center"},   // below
    {dx: 0,         dy: -dotClear - numFS - LINE_H,  al:"center"},   // above (over the number)
    {dx:  dotClear, dy: -nameFS/2 + 1,               al:"left"  },   // right of the dot
    {dx: -dotClear, dy: -nameFS/2 + 1,               al:"right" },   // left of the dot
    // Diagonals — the four cardinal slots alone leave crowded clusters with
    // nowhere to go, which is where the collisions came from.
    {dx:  dotClear, dy:  dotClear + 1,               al:"left"  },   // lower right
    {dx: -dotClear, dy:  dotClear + 1,               al:"right" },   // lower left
    {dx:  dotClear, dy: -dotClear - nameFS,          al:"left"  },   // upper right
    {dx: -dotClear, dy: -dotClear - nameFS,          al:"right" },   // upper left
    {dx: 0,         dy:  dotClear + 2 + LINE_H,      al:"center"},   // 2 lines below
    {dx: 0,         dy: -dotClear - numFS - LINE_H*2, al:"center"},  // 2 lines above
  ];
  const rectFor = (ls, c) => {
    const ly = ls.s.y + c.dy;
    let lx;
    if(c.al === "center")    lx = ls.s.x - ls.tw/2;
    else if(c.al === "left") lx = ls.s.x + c.dx;
    else /* right */         lx = ls.s.x + c.dx - ls.tw;
    return {x0: lx, x1: lx + ls.tw, y0: ly - 1, y1: ly + nameFS + 1, lx, ly};
  };

  const placed = [...dotRects, ...numRects];
  // Sampled points along the drawn curve, so a name does not land straight on
  // top of the path itself (RESILIENCE sitting on the line).
  const pathPts = [];
  for(let i=0; i<sp.length; i+=2) pathPts.push(sp[i]);
  const finalPos = new Array(labels.length);

  // Greedy: place hardest labels first (widest) so short labels slot around them.
  const order = labels.map((_,i)=>i).sort((a,b)=>labels[b].tw - labels[a].tw);
  for(const idx of order){
    const ls = labels[idx];
    let best = null, bestScore = -Infinity;
    for(let ci=0; ci<CAND.length; ci++){
      let r = rectFor(ls, CAND[ci]);
      // Horizontal clamp — if a candidate would slide off the canvas, shift it in.
      // This preserves the vertical slot (below/above/etc) while keeping it visible.
      if(r.x0 < 1){ const d = 1 - r.x0; r = {...r, lx: r.lx + d, x0: 1, x1: r.x1 + d}; }
      if(r.x1 > cssW - 1){ const d = r.x1 - (cssW - 1); r = {...r, lx: r.lx - d, x0: r.x0 - d, x1: cssW - 1}; }
      let hits = 0;
      for(const q of placed){
        if(r.x0 < q.x1 && q.x0 < r.x1 && r.y0 < q.y1 && q.y0 < r.y1) hits++;
      }
      let onPath = 0;
      for(const q of pathPts){
        if(q.x > r.x0 && q.x < r.x1 && q.y > r.y0 && q.y < r.y1) onPath++;
      }
      const yClipped = (r.y0 < 0 || r.y1 > cssH) ? 1 : 0;
      const score = -hits*100 - Math.min(onPath, 8)*6 - yClipped*30 - ci;
      if(score > bestScore){ bestScore = score; best = r; }
    }
    // Vertical clamp, mirroring the horizontal one. If every candidate would
    // have run past an edge the placer still had to pick one — without this the
    // label was simply drawn off the canvas.
    if(best.y0 < 1){ const d = 1 - best.y0; best = {...best, ly: best.ly + d, y0: 1, y1: best.y1 + d}; }
    if(best.y1 > cssH - 1){ const d = best.y1 - (cssH - 1); best = {...best, ly: best.ly - d, y0: best.y0 - d, y1: cssH - 1}; }
    finalPos[idx] = best;
    placed.push({x0: best.x0, x1: best.x1, y0: best.y0, y1: best.y1});
  }
  return {labels, finalPos};
}

function renderConstellation(canvas, nodeIds, theme, opts={}){
  if(!nodeIds || !nodeIds.length) return;
  const print = !!opts.print;
  const dark = print ? false : theme==="dark";
  const ctx = canvas.getContext("2d");
  const parent = canvas.parentElement;
  const r = parent.getBoundingClientRect();
  const dpr = print ? 3 : Math.min(devicePixelRatio||1, 2);
  const rs = getComputedStyle(document.documentElement);
  const bg  = print ? "#ffffff" : rs.getPropertyValue("--bg-2").trim();
  const ink = print ? "#000000" : rs.getPropertyValue("--ink").trim();
  const ink3= print ? "#666666" : rs.getPropertyValue("--ink-3").trim();

  const pts=nodeIds.map(i=>NODES[i]);
  const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
  // Print needs a wider margin than screen: the receipt is only ~66mm across, so
  // a station name is a big fraction of the width and needs somewhere to sit
  // without running off the paper.
  // Most of the screen padding exists so station names have somewhere to sit;
  // with labels off the route can breathe into it and fill the frame instead.
  const worldPad = print ? 165 : (opts.labels === false ? 46 : 90);
  const bx0=Math.min(...xs)-worldPad, bx1=Math.max(...xs)+worldPad,
        by0=Math.min(...ys)-worldPad, by1=Math.max(...ys)+worldPad;
  const worldW = bx1-bx0, worldH = by1-by0;

  // Print: canvas fills parent width and its HEIGHT auto-derives from the
  // drawing's aspect ratio — no letterboxing above/below wide paths.
  // Screen: canvas fills the wrap in both dimensions (drawing centers inside).
  let cssW, cssH, k, ox, oy;
  if(print){
    // FIXED reference width, deliberately not the measured parent.
    // Every printed receipt is the same 72mm roll with 3mm margins = 66mm of
    // paper, which is 249 CSS px at 96dpi. Measuring instead made the output
    // depend on *when* the draw happened: browsers disagree about whether
    // beforeprint fires before or after print styles apply, so on some devices
    // the element still reported its on-screen width (~800px). Labels were then
    // sized for 800px and squashed onto 249px of paper — the same path printed
    // from the kiosk and from the archive came out at different scales.
    // Sizing against the paper makes both pages produce identical geometry
    // regardless of layout timing; CSS width:100% maps it onto the real roll.
    cssW = PRINT_CSS_W;
    k = cssW / worldW;
    cssH = worldH * k;
    ox = -bx0 * k;
    oy = -by0 * k;
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
  } else {
    cssW = r.width; cssH = r.height;
    k = Math.min(r.width/worldW, r.height/worldH);
    ox = (r.width - worldW*k)/2 - bx0*k;
    oy = (r.height - worldH*k)/2 - by0*k;
    canvas.style.width = ""; canvas.style.height = "";
  }
  canvas.width = cssW*dpr; canvas.height = cssH*dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle=bg; ctx.fillRect(0,0,cssW,cssH);
  const toS=p=>({x:p.x*k+ox, y:p.y*k+oy});

  // Starfield only on screen — adds visual noise on thermal paper.
  if(!print){
    ctx.save(); ctx.globalAlpha=dark?.5:.35;
    let sr=1234567;
    const rnd=()=>{sr=(sr*1103515245+12345)&0x7fffffff; return sr/0x7fffffff};
    for(let i=0;i<60;i++){
      ctx.beginPath(); ctx.arc(rnd()*cssW, rnd()*cssH, rnd()*1.1+0.3, 0, 7);
      ctx.fillStyle=dark?"#8B939C":"#9AA2A7"; ctx.fill();
    }
    ctx.restore();
  }

  /* opts.ghosts — other people's routes, drawn faintly underneath this one.
     Screen only; the receipt stays a single clean line.

     They are deliberately NOT included in the bounding box above. Letting them
     widen it would shrink the path you came to look at, and a ghost running off
     the edge of the frame is the honest picture anyway: everyone else's journey
     continues past the edges of yours. */
  if(!print && opts.ghosts && opts.ghosts.length){
    ctx.save();
    ctx.globalCompositeOperation = dark ? "lighter" : "multiply";
    ctx.strokeStyle = dark ? "#7C868F" : "#B9C0C6";
    ctx.lineWidth = 0.9;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // Faint enough that ten of them overlapping still sit under the one route
    // this frame is about. At 0.30 they accounted for two thirds of the ink on
    // the canvas, which inverts the picture: the crowd shouted over the person.
    ctx.globalAlpha = dark ? 0.16 : 0.20;
    for(const g of opts.ghosts){
      if(!g || g.length < 2) continue;
      const gs = splinePoints(g.map(i=>({x:NODES[i].x, y:NODES[i].y})), null).map(toS);
      ctx.beginPath();
      ctx.moveTo(gs[0].x, gs[0].y);
      for(let i=1;i<gs.length;i++) ctx.lineTo(gs[i].x, gs[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  const sp=splinePoints(pts.map(p=>({x:p.x,y:p.y})), null).map(toS);
  // Both modes use the gradient helper — in print, theme="print" pulls from the
  // CATS_PRINT grayscale palette so the stroke still has line-to-line variation
  // (dark → medium → dark grey) instead of a flat black line.
  if(print){
    strokeGradientPath(ctx, sp, pts.map(p=>p.c), "print", {lineWidth:2.4, alpha:1});
  } else {
    strokeGradientPath(ctx, sp, pts.map(p=>p.c), theme, {
      lineWidth:2.6, alpha:.9, composite: dark?"lighter":"multiply"
    });
  }

  if(print){
    // ------- Print: two-pass rendering with greedy collision-aware labels -------
    // Pass 1: draw every dot up front so they're background for the labels.
    // Pass 2: place the station name labels one at a time, longest first, choosing
    //         the highest-scoring candidate slot (below → above → right → left →
    //         further-below → further-above). Score penalises overlaps with any
    //         already-placed rect (dot, number, or previously placed label) plus
    //         off-canvas clipping. This is a print-simplified port of MapView's
    //         labelMetrics greedy placer.
    // Sized as a fraction of the receipt width rather than fixed px. At 72mm
    // paper the canvas is only ~250px wide, so the old flat 10px made
    // "VULNERABILITY" span a third of the paper — labels collided and ran off
    // the edge. ~2.7% of width lands near 7px there, which is still comfortably
    // legible at 203dpi while leaving the 15pt title clearly dominant.
    // Midway between the two extremes we tried on paper: the original flat 10px
    // was legible but collided constantly, and 6.7px cleared the collisions at
    // the cost of readability. ~8.5px at 66mm keeps names comfortably readable
    // while leaving the placer enough room to resolve overlaps.
    const NAME_FS = Math.max(6.5, Math.min(10, cssW * 0.034));
    const NUM_FS  = Math.max(5, NAME_FS - 2.5);
    const DOT_CLEAR = 5, LINE_H = NAME_FS + 2.5;

    // Draw the dots.
    // Dots scale with the label size so the drawing stays proportional at any
    // paper width instead of turning into big blobs beside small type.
    const DOT_END = NAME_FS * 0.58, DOT_MID = NAME_FS * 0.42;
    pts.forEach((n,i)=>{
      const s = toS(n);
      const isEnd = i===0 || i===pts.length-1;
      ctx.beginPath(); ctx.arc(s.x, s.y, isEnd ? DOT_END : DOT_MID, 0, 7);
      ctx.fillStyle = isEnd ? "#000" : catColor(n.c, "print");
      ctx.fill();
    });

    const {labels, finalPos} = placeStationLabels(ctx, {
      pts, toS, sp, cssW, cssH,
      nameFS: NAME_FS, numFS: NUM_FS, dotClear: DOT_CLEAR,
      radiusAt: i => (i===0 || i===pts.length-1) ? DOT_END : DOT_MID
    });

    // Draw the numbers (centered above each dot — always-placed positions).
    ctx.font = `700 ${NUM_FS}px 'Martian Mono',monospace`;
    ctx.fillStyle = ink3;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    pts.forEach((n,i)=>{
      const s = toS(n);
      ctx.fillText(String(i+1), s.x, s.y - DOT_CLEAR - 1);
    });

    // Draw the station name labels at their final positions.
    ctx.font = `700 ${NAME_FS}px 'Martian Mono',monospace`;
    ctx.fillStyle = "#000";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    labels.forEach((ls,i)=>{
      const pos = finalPos[i];
      ctx.fillText(ls.label, pos.lx, pos.ly);
    });
    return;
  }

  // ------- Screen: dots first, then the same greedy placer print uses -------
  // opts.labels:false draws the route and its stations but no text — thumbnail
  // grids pass false and name the path in their own caption instead.
  const showLabels = opts.labels !== false;
  // Type and dots scale with the canvas. They used to be flat 10/11px with
  // radius 7/5 at every size, which is why the phone-sized modal came out with
  // names three times too big for the drawing they were annotating.
  const dotScale = showLabels ? Math.max(.62, Math.min(1, cssW/420))
                              : Math.max(.55, Math.min(1, cssW/260));
  const radiusAt = i => ((i===0 || i===pts.length-1) ? 7 : 5) * dotScale;

  pts.forEach((n,i)=>{
    const s2 = toS(n);
    const col = catColor(n.c, theme);
    ctx.beginPath(); ctx.arc(s2.x, s2.y, radiusAt(i), 0, 7);
    ctx.fillStyle = i===0 ? col : bg; ctx.fill();
    ctx.lineWidth = 1.8*dotScale; ctx.strokeStyle = col; ctx.stroke();
  });
  if(!showLabels) return;

  const NAME_FS   = Math.max(7.5, Math.min(11, cssW * 0.028));
  const NUM_FS    = Math.max(6.5, NAME_FS - 2);
  const DOT_CLEAR = radiusAt(0) + 3;
  const {labels: lbls, finalPos} = placeStationLabels(ctx, {
    pts, toS, sp, cssW, cssH,
    nameFS: NAME_FS, numFS: NUM_FS, dotClear: DOT_CLEAR, radiusAt,
    nameWeight: 400, numWeight: 600
  });

  ctx.font = `600 ${NUM_FS}px 'Martian Mono',monospace`;
  ctx.fillStyle = ink3; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  pts.forEach((n,i)=>{ const s2 = toS(n); ctx.fillText(String(i+1), s2.x, s2.y - DOT_CLEAR - 1); });

  ctx.font = `400 ${NAME_FS}px 'Martian Mono',monospace`;
  ctx.fillStyle = ink; ctx.textAlign = "left"; ctx.textBaseline = "top";
  lbls.forEach((ls,i)=>{ const pos = finalPos[i]; ctx.fillText(ls.label, pos.lx, pos.ly); });
}

/* ============================================================
   QR RENDERER — thin wrapper over the vendored qrcode-generator (assets/qrcode.min.js).
   Draws crisp on canvas at devicePixelRatio, always black-on-white for scan reliability.
   ============================================================ */
function renderQR(canvas, text, sizeCSS){
  if(typeof qrcode!=="function") return;
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const dpr = Math.min(devicePixelRatio||1, 2);
  const size = sizeCSS*dpr;
  const cell = Math.floor(size/(n+4));
  const margin = Math.floor((size - cell*n)/2);
  canvas.width=size; canvas.height=size;
  canvas.style.width=sizeCSS+"px"; canvas.style.height=sizeCSS+"px";
  const ctx=canvas.getContext("2d");
  ctx.fillStyle="#fff"; ctx.fillRect(0,0,size,size);
  ctx.fillStyle="#000";
  for(let r=0;r<n;r++) for(let c=0;c<n;c++)
    if(qr.isDark(r,c)) ctx.fillRect(margin+c*cell, margin+r*cell, cell, cell);
}

/* ============================================================
   MAP RENDERER
   opts.role: "projection" | "tablet"
   opts.showAggregate: whether OTHER people's paths are ever drawn (false on the tablet —
     the casting surface stays a blank instrument, per design: no distraction while tracing)
   opts.navigable: pan/zoom enabled (projection only)
   ============================================================ */
class MapView{
  constructor(canvas, opts){
    this.cv=canvas; this.ctx=canvas.getContext("2d");
    this.opts=Object.assign({role:"projection", labels:true, interactive:false,
                              showAggregate:true, navigable:false}, opts);
    this.view={x:0,y:0,kx:1,ky:1,k:1};
    this.user={z:1,dx:0,dy:0};
    this.aggCache=document.createElement("canvas");
    this.dirty=true;
    this.hot=null;
    this.draft=null;
    this.inject=null;
    this.focus=null;
    this.pulse=0;
    this.resize();
    this._ro=new ResizeObserver(()=>this.resize()); this._ro.observe(canvas.parentElement);
    if(this.opts.navigable) this.enableNavigation();
    this.loop=this.loop.bind(this); requestAnimationFrame(this.loop);
  }
  get theme(){ return Store.theme[this.opts.role==="tablet"?"tablet":"projection"] }
  css(v){
    if(this._cssV!==Store.version+"|"+this.theme){ this._cssV=Store.version+"|"+this.theme; this._css={} }
    if(this._css[v]==null){
      this._css[v]=getComputedStyle(this.cv.closest("[data-theme]")||document.documentElement).getPropertyValue(v).trim();
    }
    return this._css[v];
  }
  resize(){
    const r=this.cv.parentElement.getBoundingClientRect();
    const dpr=Math.min(devicePixelRatio||1,2);
    this.w=r.width; this.h=r.height;
    this.cv.width=Math.max(1,r.width*dpr); this.cv.height=Math.max(1,r.height*dpr);
    this.ctx.setTransform(dpr,0,0,dpr,0,0);
    this.aggCache.width=this.cv.width; this.aggCache.height=this.cv.height;
    this.fit(); this.dirty=true;
  }
  fit(){
    const base = this.opts.role==="projection" ? 64 : 44;
    const pad = Math.max(20, Math.min(base, Math.min(this.w,this.h)*0.06));
    let kx=(this.w-pad*2)/WORLD.w, ky=(this.h-pad*2)/WORLD.h;
    const k=Math.max(0.05,Math.min(kx,ky));
    const STRETCH = Math.max(kx,ky)/k > 1.5 ? 1.35 : 1.16;
    kx=Math.min(kx,k*STRETCH); ky=Math.min(ky,k*STRETCH);
    this.view={kx,ky,k:Math.min(kx,ky),x:(this.w-WORLD.w*kx)/2,y:(this.h-WORLD.h*ky)/2};
  }
  resetView(){ this.user={z:1,dx:0,dy:0}; this.fit(); this.dirty=true }
  get scale(){ return this.view.k*this.user.z }
  toScreen(p){
    const v=this.view,u=this.user,cx=this.w/2,cy=this.h/2;
    return {x:(p.x*v.kx+v.x-cx)*u.z+cx+u.dx, y:(p.y*v.ky+v.y-cy)*u.z+cy+u.dy};
  }
  toWorld(p){
    const v=this.view,u=this.user,cx=this.w/2,cy=this.h/2;
    return {x:(((p.x-cx-u.dx)/u.z)+cx-v.x)/v.kx, y:(((p.y-cy-u.dy)/u.z)+cy-v.y)/v.ky};
  }
  nearest(sp,maxPx=36){
    let best=null,bd=maxPx;
    for(const n of NODES){
      const s=this.toScreen(n); const d=Math.hypot(s.x-sp.x,s.y-sp.y);
      if(d<bd){bd=d;best=n}
    }
    return best;
  }
  enableNavigation(){
    const cv=this.cv, at=ev=>{const r=cv.getBoundingClientRect(); return {x:ev.clientX-r.left,y:ev.clientY-r.top}};
    cv.style.cursor="grab";
    // Zoom scales with how far the wheel actually moved, rather than applying a
    // flat step per event. A mouse notch sends one event with |deltaY|~100, but a
    // Mac trackpad sends a rapid stream of small deltas — the old fixed 1.12 per
    // event compounded those into huge jumps and made fine positioning
    // impossible. deltaMode is normalised first (0=px, 1=line, 2=page) since
    // some mice report lines, then the exponential keeps zoom-in and zoom-out
    // exactly symmetric.
    cv.addEventListener("wheel",ev=>{
      ev.preventDefault();
      const unit = ev.deltaMode===1 ? 16 : ev.deltaMode===2 ? 400 : 1;
      const dy = Math.max(-240, Math.min(240, ev.deltaY*unit));   // clamp flings
      this.zoomAt(at(ev), Math.exp(-dy*0.0012));
    },{passive:false});
    let drag=null;
    cv.addEventListener("pointerdown",ev=>{ drag={x:ev.clientX,y:ev.clientY}; cv.setPointerCapture(ev.pointerId); cv.style.cursor="grabbing" });
    cv.addEventListener("pointermove",ev=>{
      const sp=at(ev); const n=this.nearest(sp,34); this.hot=n?n.id:null;
      if(!drag) return;
      this.user.dx+=ev.clientX-drag.x; this.user.dy+=ev.clientY-drag.y;
      drag={x:ev.clientX,y:ev.clientY}; this.dirty=true;
    });
    const up=()=>{drag=null; cv.style.cursor="grab"};
    cv.addEventListener("pointerup",up); cv.addEventListener("pointercancel",up);
    cv.addEventListener("dblclick",()=>this.resetView());
  }
  zoomAt(sp,factor){
    const w0=this.toWorld(sp);
    this.user.z=Math.max(0.55,Math.min(4.5,this.user.z*factor));
    const s1=this.toScreen(w0);
    this.user.dx+=sp.x-s1.x; this.user.dy+=sp.y-s1.y;
    this.dirty=true;
  }

  // ---- Label geometry: shared source of truth, greedy multi-slot placement ----
  labelMetrics(){
    const fs=Math.max(8, Math.min(20, this.scale*13));
    const key=[fs.toFixed(2),this.view.kx.toFixed(3),this.view.ky.toFixed(3),
               this.user.z.toFixed(3),this.user.dx|0,this.user.dy|0,this.w|0,this.h|0].join("_");
    if(this._lp && this._lp.key===key) return this._lp;
    const ctx=this.ctx, dot=15.5;  // matches the max station radius (base 4.0 + up to 11.0 heat)
    ctx.save();
    ctx.font=`400 ${fs}px 'Martian Mono','SFMono-Regular',monospace`;
    const h=fs*1.18, g=5;
    const CAND=[
      {dx:0,      dy: dot+fs*0.62,          al:"center"},
      {dx:0,      dy:-dot-fs*1.35,          al:"center"},
      {dx: dot+g, dy:-fs*0.59,              al:"left"  },
      {dx:-dot-g, dy:-fs*0.59,              al:"right" },
      {dx:0,      dy: dot+fs*0.62+fs*1.5,   al:"center"},
      {dx:0,      dy:-dot-fs*2.85,          al:"center"},
      {dx: dot+g, dy: dot+fs*0.95,          al:"left"  },
      {dx:-dot-g, dy: dot+fs*0.95,          al:"right" },
      {dx: dot+g, dy:-dot-fs*1.55,          al:"left"  },
      {dx:-dot-g, dy:-dot-fs*1.55,          al:"right" },
      {dx:0,      dy: dot+fs*0.62+fs*3.0,   al:"center"},
      {dx:0,      dy:-dot-fs*4.35,          al:"center"}
    ];
    const plateX=(c,sx,tw)=> c.al==="center" ? sx-tw/2-3 : (c.al==="left" ? sx+c.dx-3 : sx+c.dx-tw-3);
    const meta=NODES.map(n=>{
      const sc=this.toScreen(n);
      return {id:n.id, tw:ctx.measureText(n.n.toUpperCase()).width, sx:sc.x, sy:sc.y};
    });
    const order=meta.slice().sort((a,b)=>b.tw-a.tw);
    const placed=[], rows=new Array(NODES.length).fill(0);
    for(const m of order){
      let best=0, bestScore=-Infinity;
      for(let ci=0; ci<CAND.length; ci++){
        const c=CAND[ci], ly=m.sy+c.dy, x0=plateX(c,m.sx,m.tw);
        const r={x0, x1:x0+m.tw+6, y0:ly-1, y1:ly+h};
        let hits=0;
        for(const q of placed) if(r.x0<q.x1&&q.x0<r.x1&&r.y0<q.y1&&q.y0<r.y1) hits++;
        const clipped=(r.x0<0||r.x1>this.w||r.y0<0||r.y1>this.h)?1:0;
        const score = -hits*100 - clipped*60 - ci;
        if(score>bestScore){ bestScore=score; best=ci }
      }
      rows[m.id]=best;
      const cb=CAND[best], lyb=m.sy+cb.dy, xb=plateX(cb,m.sx,m.tw);
      placed.push({x0:xb, x1:xb+m.tw+6, y0:lyb-1, y1:lyb+h});
    }
    ctx.restore();
    this._lp={key, fs, h, dot, CAND, rows, plateX};
    return this._lp;
  }
  labelRect(n, ctx, m){
    m=m||this.labelMetrics();
    const s=this.toScreen(n);
    const txt=n.n.toUpperCase();
    ctx.font=`400 ${m.fs}px 'Martian Mono','SFMono-Regular',monospace`;
    const tw=ctx.measureText(txt).width, row=m.rows[n.id], c=m.CAND[row];
    const x0=m.plateX(c, s.x, tw);
    return {txt, tw, x0, ly:s.y+c.dy, al:c.al, sx:s.x, sy:s.y, h:m.h, row};
  }

  visiblePaths(){
    if(!this.opts.showAggregate) return [];
    const f=Store.filter, ps=activePaths();
    if(f.type==="blank") return [];
    if(f.type==="recent") return ps.slice(-12);
    if(f.type==="cat")    return ps.filter(p=>p.nodes.some(i=>NODES[i].c===f.c));
    if(f.type==="outlier"){const A=this.A; return A&&A.outlier?[A.outlier]:[]}
    if(f.type==="heaviest"){
      const A=this.A; if(!A) return ps;
      const top=new Set(A.edgeList.slice(0,5).map(e=>e.k));
      return ps.filter(p=>{
        for(let i=0;i<p.nodes.length-1;i++){
          const a=p.nodes[i],b=p.nodes[i+1];
          if(top.has(a<b?a+"-"+b:b+"-"+a)) return true;
        } return false;
      });
    }
    if(f.type==="longest"){ const A=this.A; return A&&A.longest?[A.longest]:[] }
    if(f.type==="signature"){
      const A=this.A; if(!A||!A.repeatTop) return [];
      // every path whose ordered route matches the top-repeat route key
      return ps.filter(p=>p.nodes.join(">")===A.repeatTop.rk);
    }
    if(f.type==="uniques"){
      const A=this.A; if(!A) return ps;
      // routes that appear exactly once — one traveller, one path
      return ps.filter(p=>A.routeKey.get(p.nodes.join(">"))===1);
    }
    if(f.type==="fourline"){
      // paths whose stations span all four categories
      return ps.filter(p=>{
        const cs=new Set(p.nodes.map(i=>NODES[i].c));
        return cs.size===4;
      });
    }
    return ps;
  }
  gravity(){
    if(!this.opts.showAggregate) return null;
    const A=this.A; if(!A||!A.total) return null;
    let sx=0,sy=0,s=0;
    NODES.forEach(n=>{const w=A.traffic[n.id]; sx+=n.x*w; sy+=n.y*w; s+=w});
    if(!s) return null;
    return {x:sx/s, y:sy/s, k:Math.min(1, s/(A.total*6))};
  }
  drawAggregate(){
    const c=this.aggCache.getContext("2d");
    const dpr=Math.min(devicePixelRatio||1,2);
    c.setTransform(dpr,0,0,dpr,0,0);
    c.clearRect(0,0,this.w,this.h);
    if(!this.opts.showAggregate){ this.dirty=false; return }
    const theme=this.theme, dark=theme==="dark";
    c.globalCompositeOperation = dark?"lighter":"multiply";
    // gravity kept only for the animation-focused overlays' compatibility;
    // aggregate paths now use straight catmull-rom (null gravity) so their
    // curves match view.html's constellation and the archive thumbnails.
    const paths=this.visiblePaths();
    const focus=this.focus;
    const solo = Store.filter.type==="outlier";
    for(const p of paths){
      const pts=splinePoints(pathPts(p), null).map(q=>this.toScreen(q));
      let a = p.seeded ? (dark?0.19:0.14) : (dark?0.36:0.27);
      let lw = p.seeded?1.1:1.9;
      if(solo){ a = dark?0.95:0.78; lw = 3.6 }
      else if(Store.filter.type==="heaviest"){ a*=1.5; lw+=0.5 }
      if(focus && focus.type==="path"){ const on=focus.id===p.id; a=on?(dark?.95:.8):a*.18; lw=on?3.4:lw }
      if(focus && focus.type==="cat"){ const on=p.nodes.some(i=>NODES[i].c===focus.c); if(!on) a*=.16 }
      if(focus && focus.type==="node"){ const on=p.nodes.includes(focus.id); if(!on) a*=.2; else a*=1.7 }
      // "paths" (cascade) dims every underlying path uniformly — the motion overlay
      // brightens one at a time on top, so we don't want any base-layer boosting.
      if(focus && focus.type==="paths"){ a*=.14 }
      strokeGradientPath(c, pts, p.nodes.map(i=>NODES[i].c), theme,
        {lineWidth:lw, alpha:a});
    }
    c.globalCompositeOperation="source-over"; c.globalAlpha=1;
    this.dirty=false;
  }
  loop(ts){
    this.A = analyse(activePaths());
    if(this.dirty) this.drawAggregate();
    const ctx=this.ctx, theme=this.theme, dark=theme==="dark";
    const bg=this.css("--bg"), ink=this.css("--ink"), ink2=this.css("--ink-2");
    ctx.clearRect(0,0,this.w,this.h);
    ctx.fillStyle=bg; ctx.fillRect(0,0,this.w,this.h);
    this.pulse=ts/1000;

    const inj=this.inject;
    let dim=1;
    if(inj && this.opts.showAggregate){
      const e=(ts-inj.t0)/1000;
      dim = e<0.35 ? 1-(e/0.35)*0.85 : (e>2.6 ? 0.15+Math.min(1,(e-2.6)/0.9)*0.85 : 0.15);
      if(e>3.8) this.inject=null;
    }
    if(this.opts.showAggregate){
      ctx.save(); ctx.globalAlpha=dim;
      ctx.drawImage(this.aggCache,0,0,this.w,this.h);
      ctx.restore();
    }

    // Legacy pulsing edge highlight — only used when the edge has NO motion.
    // If focus.motion is set (traverse), drawMotion draws the moving trail on
    // the same edge, and adding this stroke on top produces a jittery double
    // highlight that reads as visual noise.
    if(this.opts.showAggregate && this.focus && this.focus.type==="edge" && !this.focus.motion){
      const e=this.focus.e;
      const pts=splinePoints([NODES[e.a],NODES[e.b]].map(n=>({x:n.x,y:n.y})), null).map(q=>this.toScreen(q));
      ctx.save(); ctx.globalCompositeOperation=dark?"lighter":"source-over";
      ctx.strokeStyle=catColor(NODES[e.a].c,theme); ctx.lineWidth=4; ctx.globalAlpha=.55+Math.sin(this.pulse*2.4)*.2;
      ctx.beginPath(); pts.forEach((q,i)=> i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)); ctx.stroke(); ctx.restore();
    }
    if(this.opts.showAggregate && this.focus && this.focus.motion){
      // Guard the motion draw — any exception here would prevent the frame
      // from reaching requestAnimationFrame() at the bottom of loop() and the
      // map would freeze permanently. Log once and drop the focus so we don't
      // repeat the same error next frame.
      try{
        this.drawMotion(ctx, ts, theme, dark);
      }catch(e){
        console.warn("drawMotion error, clearing focus:", e);
        this.focus = null;
      }
    }

    const A=this.A;
    const lm=this.labelMetrics();
    const liveNodes = (this.opts.showAggregate && Store.filter.type!=="all")
      ? new Set(this.visiblePaths().flatMap(p=>p.nodes)) : null;

    for(const n of NODES){
      const s=this.toScreen(n);
      const traffic = this.opts.showAggregate ? (A.traffic[n.id]||0) : 0;
      const heat = (this.opts.showAggregate && A.total) ? Math.min(1,traffic/Math.max(3,A.total*0.35)) : 0;
      const col=catColor(n.c,theme);
      let em=1;
      if(liveNodes && liveNodes.size) em = liveNodes.has(n.id)?1:.24;
      if(this.focus){
        if(this.focus.type==="node") em = this.focus.id===n.id?1:.22;
        if(this.focus.type==="cat")  em = this.focus.c===n.c?1:.22;
        if(this.focus.type==="edge") em = (this.focus.e.a===n.id||this.focus.e.b===n.id)?1:.22;
        if(this.focus.type==="path"){const p=activePaths().find(x=>x.id===this.focus.id); em=p&&p.nodes.includes(n.id)?1:.22}
      }
      const active = this.draft && this.draft.nodes.includes(n.id);
      const hot = this.hot===n.id;
      // Physical scaling in response to bulletin motions — "the busiest station"
      // bulletin now actually makes that dot bigger and breathe. Category glow
      // does the same on every node in the line, staggered by node id so the
      // group ripples rather than pulsing in unison.
      let focusScale = 1;
      if(this.focus && this.focus.motion && this.opts.showAggregate && !this.inject){
        // While an injection animation is playing, hold the nodes at their base
        // size — the injection is the only motion on the map for those 3–4s.
        const T = (ts - (this.focusT0||ts)) / 1000;
        if(this.focus.motion==="pulse" && this.focus.type==="node" && this.focus.id===n.id){
          focusScale = 1.55 + 0.55*Math.sin(T*2.6);
        } else if(this.focus.motion==="glow" && this.focus.type==="cat" && this.focus.c===n.c){
          focusScale = 1.18 + 0.20*Math.sin(T*1.5 + n.id*0.42);
        } else if(this.focus.motion==="traverse" && this.focus.type==="path"){
          // Punch each station on the focused path slightly, so it reads as
          // "these are the stations that path visits" without the trail alone.
          const p = activePaths().find(x=>x.id===this.focus.id);
          if(p && p.nodes.includes(n.id)) focusScale = 1.15 + 0.08*Math.sin(T*3 + n.id*0.3);
        }
      }
      // stations must read clearly as "stations" from a projector at the back of a room even
      // with zero data — traffic makes them bigger and brighter, it must never be what makes
      // them visible at all. Range widened: idle 4.0 → busiest ~15.0 (base +11*heat),
      // giving a ~3.8× ratio between "nobody's been here" and "everybody's been here",
      // sharpening the visual signal without pushing labels off-screen.
      const r=(4.0+heat*11.0)*(this.opts.role==="tablet"?1.2:1)*focusScale;

      if(this.opts.showAggregate && heat>0.05 && !this.opts.interactive){
        const ph=((this.pulse*0.5)+(n.id*0.137))%1;
        ctx.save(); ctx.globalAlpha=(1-ph)*0.22*heat*em;
        ctx.strokeStyle=col; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(s.x,s.y,r+ph*26,0,7); ctx.stroke(); ctx.restore();
      }
      if(active||hot){
        ctx.save(); ctx.globalAlpha=hot&&!active?.35:.75;
        ctx.strokeStyle=col; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.arc(s.x,s.y,r+8+(active?Math.sin(this.pulse*4)*1.5:0),0,7); ctx.stroke(); ctx.restore();
      }
      ctx.save();
      // a faint permanent tint under the ring — idle stations still read as filled markers,
      // not empty holes, before any data exists
      ctx.beginPath(); ctx.arc(s.x,s.y,r,0,7);
      ctx.fillStyle = (active||heat>0.5) ? col : this.css("--node-fill");
      ctx.globalAlpha=em; ctx.fill();
      if(!(active||heat>0.5)){
        ctx.beginPath(); ctx.arc(s.x,s.y,r,0,7);
        ctx.fillStyle=col; ctx.globalAlpha=em*(dark?0.16:0.12); ctx.fill();
      }
      ctx.globalAlpha=em;
      ctx.lineWidth=2.1; ctx.strokeStyle=col; ctx.stroke();
      ctx.restore();

      if(this.opts.labels){
        const L=this.labelRect(n, ctx, lm);
        ctx.save();
        ctx.textBaseline="top";
        const my=L.ly+L.h/2, gap=Math.abs(my-s.y);
        if(gap > r+lm.fs*1.1){
          ctx.globalAlpha=em*.32; ctx.strokeStyle=col; ctx.lineWidth=1;
          const above = my < s.y;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y+(above?-r-1:r+1));
          ctx.lineTo(s.x, above?L.ly+L.h+1:L.ly-1);
          ctx.stroke();
        }
        // Slightly stronger background plate so the label sits crisp on top
        // of arteries + starfield instead of blending into them.
        ctx.globalAlpha=em*(dark?.82:.92);
        ctx.fillStyle=bg;
        ctx.fillRect(L.x0, L.ly-1, L.tw+6, L.h);
        // Every station name now uses full ink (was ink-2 for non-focused),
        // giving the wall a much stronger read from across the room.
        ctx.globalAlpha=em;
        ctx.fillStyle=ink;
        ctx.textAlign="left";
        ctx.fillText(L.txt, L.x0+3, L.ly);
        ctx.restore();
      }
    }

    if(this.draft && this.draft.nodes.length){
      // The pointer tail (live cursor while dragging) has no station and no colour.
      // Treat it as the same colour as the current tip so the visible rubber-band
      // extends the last segment cleanly — the gradient completes AT the last
      // placed station and the tail carries that station's colour outward.
      const worldPts = this.draft.nodes.map(i=>({x:NODES[i].x,y:NODES[i].y}));
      const cats = this.draft.nodes.map(i=>NODES[i].c);
      if(this.draft.pointer){
        worldPts.push(this.draft.pointer);
        cats.push(cats[cats.length-1]);
      }
      const sp=splinePoints(worldPts,null).map(q=>this.toScreen(q));
      strokeGradientPath(ctx, sp, cats, theme, {lineWidth:3, alpha:.95});
    }

    if(inj && this.opts.showAggregate){
      const e=(ts-inj.t0)/1000;
      const pts=splinePoints(pathPts(inj.path), null).map(q=>this.toScreen(q));
      const cats=inj.path.nodes.map(i=>NODES[i].c);
      // colour cues at the head/ring use the tip's colour (the station the reveal
      // is currently arriving at), matching the last-drawn segment's end.
      const prog=Math.max(0,Math.min(1,(e-0.3)/1.9));
      const cut=Math.floor(prog*(pts.length-1));
      const tipCat = cats[Math.min(cats.length-1, Math.floor(cut/SPLINE_STEPS)+1)];
      const tipCol = catColor(tipCat, theme);
      const alpha = e>2.6 ? Math.max(0,1-(e-2.6)/1.0) : 1;
      strokeGradientPath(ctx, pts, cats, theme, {
        lineWidth:3.4, alpha, composite: dark?"lighter":"source-over", lastCutIndex: cut
      });
      ctx.save();
      ctx.globalCompositeOperation=dark?"lighter":"source-over";
      if(prog<1 && pts[cut]){
        const h=pts[cut];
        ctx.globalAlpha = alpha;
        ctx.beginPath(); ctx.arc(h.x,h.y,5.5,0,7); ctx.fillStyle=dark?"#fff":tipCol; ctx.fill();
        ctx.globalAlpha=.35*alpha; ctx.beginPath(); ctx.arc(h.x,h.y,16,0,7); ctx.fillStyle=tipCol; ctx.fill();
      }
      if(prog>=1){
        const rr=(e-2.2)*230;
        if(rr>0&&rr<420){
          const last=pts[pts.length-1];
          ctx.globalAlpha=Math.max(0,.6-rr/420*.6);
          ctx.strokeStyle=tipCol; ctx.lineWidth=2;
          ctx.beginPath(); ctx.arc(last.x,last.y,rr,0,7); ctx.stroke();
        }
      }
      ctx.restore();
    }
    requestAnimationFrame(this.loop);
  }
  playInjection(path){ this.inject={path, t0:performance.now()}; }
  setFocus(f){
    this.focus=f;
    // reset the motion clock so every new bulletin starts its animation at t=0,
    // otherwise a cascade of 8 paths joined mid-cycle would show whatever path was
    // "current" in the previous bulletin's timeline.
    this.focusT0=performance.now();
    this.dirty=true;
  }

  /* --------------------------------------------------------------------------
     MOTIONS — overlays that sit on top of the dimmed aggregate. Each motion
     type is a canvas draw call driven by (ts - focusT0), so they animate
     continuously as long as the same focus is active. No state between frames.
     -------------------------------------------------------------------------- */
  drawMotion(ctx, ts, theme, dark){
    const f = this.focus; if(!f || !f.motion) return;
    // Suppress motion overlays while an injection animation is running — the
    // injection is the sole animation during a cast and we don't want a
    // traversing token, pulse ring or cascade drawing over it. (The projection's
    // Store.sub already delays the insight bulletin until injection is done;
    // this guard covers any other scenario that sets focus mid-injection.)
    if(this.inject) return;
    const T = (ts - (this.focusT0||ts)) / 1000;
    // Motion overlays draw with null gravity too — same catmull-rom shape as
    // the aggregate paths below and as view.html's constellation, so a focused
    // traverse or cascade doesn't visually drift from the underlying artery.
    const g = null;

    // -- helpers ----------------------------------------------------------
    const traverseAlong = (worldIds, cycleSec, col) => {
      if(!worldIds || worldIds.length<2) return;
      // Filter out any bad station IDs before mapping to coordinates. A cast
      // that references a station no longer in NODES (renamed, edge race with
      // a path removal, corrupt sync payload) used to produce undefined entries
      // that later crashed at sp[idx].x — killing the whole render loop.
      const wp = worldIds.map(i=>NODES[i]).filter(Boolean);
      if(wp.length < 2) return;
      const sp = splinePoints(wp.map(p=>({x:p.x,y:p.y})), g).map(q=>this.toScreen(q));
      if(!sp.length) return;
      const t = (T % cycleSec) / cycleSec;
      const idx = Math.max(0, Math.min(sp.length-1, Math.floor(t * (sp.length-1))));
      const trailLen = Math.min(28, idx);
      ctx.save();
      ctx.globalCompositeOperation = dark?"lighter":"source-over";
      ctx.strokeStyle = col; ctx.lineCap="round"; ctx.lineJoin="round"; ctx.lineWidth = 3.4;
      for(let i=idx-trailLen; i<idx; i++){
        if(i<0 || i+1>=sp.length) continue;
        const p0 = sp[i], p1 = sp[i+1];
        if(!p0 || !p1) continue;
        const a = (i - (idx-trailLen))/trailLen;
        ctx.globalAlpha = a*a * (dark?0.95:0.7);
        ctx.beginPath(); ctx.moveTo(p0.x,p0.y); ctx.lineTo(p1.x,p1.y); ctx.stroke();
      }
      const h = sp[idx];
      if(!h){ ctx.restore(); return; }        // last-line-of-defence
      ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.arc(h.x, h.y, 16, 0, 7);
      ctx.fillStyle = col; ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(h.x, h.y, 5.5, 0, 7);
      ctx.fillStyle = dark?"#fff":col; ctx.fill();
      ctx.restore();
    };

    if(f.motion === "traverse"){
      let ids = null;
      if(f.type === "edge") ids = [f.e.a, f.e.b];
      else if(f.type === "path"){
        const p = activePaths().find(x=>x.id===f.id);
        if(p) ids = p.nodes;
      }
      if(!ids) return;
      const col = catColor(NODES[ids[0]].c, theme);
      traverseAlong(ids, ids.length<=2 ? 2.2 : 3.2, col);
    }
    else if(f.motion === "pulse"){
      if(f.type !== "node") return;
      const n = NODES[f.id]; const s = this.toScreen(n);
      const col = catColor(n.c, theme);
      // two out-of-phase rings so there's always something visibly expanding
      for(const off of [0, 0.5]){
        const t = ((T*0.55)+off) % 1;
        ctx.save();
        ctx.globalAlpha = (1-t) * (dark?0.7:0.5);
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(s.x, s.y, 14 + t*68, 0, 7); ctx.stroke();
        ctx.restore();
      }
      // and a solid core scaling with the beat so the station itself grows
      const beat = 0.5 + 0.5*Math.sin(T*3);
      ctx.save();
      ctx.globalAlpha = 0.28*beat;
      ctx.beginPath(); ctx.arc(s.x, s.y, 22, 0, 7);
      ctx.fillStyle = col; ctx.fill();
      ctx.restore();
    }
    else if(f.motion === "glow"){
      if(f.type !== "cat") return;
      const cs = NODES.filter(n=>n.c === f.c);
      const col = catColor(f.c, theme);
      for(const n of cs){
        const sp = this.toScreen(n);
        // staggered per node so the whole line "breathes"
        const t = ((T*0.6) + n.id*0.07) % 1;
        ctx.save();
        ctx.globalAlpha = (1-t) * (dark?0.55:0.4);
        ctx.strokeStyle = col; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(sp.x, sp.y, 10 + t*44, 0, 7); ctx.stroke();
        ctx.restore();
      }
    }
    else if(f.motion === "cascade"){
      const ids = f.ids || []; if(!ids.length) return;
      const per = 1.7;                          // seconds per path
      const total = per * ids.length;
      const t = T % total;
      const idx = Math.min(ids.length-1, Math.floor(t / per));
      const phase = (t - idx*per) / per;        // 0..1 within one path's window
      const p = activePaths().find(x=>x.id===ids[idx]); if(!p) return;
      const wp = p.nodes.map(i=>NODES[i]);
      const cats = p.nodes.map(i=>NODES[i].c);
      const sp = splinePoints(wp.map(pt=>({x:pt.x,y:pt.y})), g).map(q=>this.toScreen(q));
      // reveal from head to tail, hold, then fade out — makes each path feel drawn
      const REV=0.55, HOLD=0.82;
      let visN, alpha;
      if(phase < REV){ visN = Math.floor(sp.length * (phase/REV)); alpha = 0.92 }
      else if(phase < HOLD){ visN = sp.length; alpha = 0.92 }
      else { visN = sp.length; alpha = 0.92 * (1 - (phase-HOLD)/(1-HOLD)) }
      strokeGradientPath(ctx, sp, cats, theme, {
        lineWidth:3.2, alpha, composite: dark?"lighter":"source-over",
        lastCutIndex: Math.max(0, visN-1)
      });
      // token at the moving head during the reveal phase — coloured by the segment
      // the head is currently arriving at
      if(phase < REV && visN > 0 && visN < sp.length){
        const h = sp[visN];
        const tipCat = cats[Math.min(cats.length-1, Math.floor(visN/SPLINE_STEPS)+1)];
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(h.x, h.y, 4.5, 0, 7);
        ctx.fillStyle = dark?"#fff":catColor(tipCat, theme); ctx.fill();
        ctx.restore();
      }
    }
    else if(f.motion === "counts"){
      // Numeric pill per station, sequenced reveal — biggest counts first.
      // Sort once by descending count, then reveal them across the first
      // ~5 s of the bulletin so the busy stations lead and the quieter ones
      // filter in behind. Each pill fades in over its own ~0.35 s window.
      const counts = f.counts || [];
      const items = [];
      for(let i=0; i<NODES.length; i++){
        const c = counts[i]|0;
        if(c <= 0) continue;
        items.push({id:i, c});
      }
      if(!items.length) return;
      items.sort((a,b)=> b.c - a.c);
      const REVEAL_DUR = 5.0;                 // seconds to reveal every pill
      const FADE = 0.35;                       // per-pill fade-in duration
      const step = items.length > 1 ? (REVEAL_DUR - FADE) / (items.length - 1) : 0;

      const PILL_FS = 11;
      ctx.save();
      ctx.font = `700 ${PILL_FS}px 'Martian Mono',monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for(let rank=0; rank<items.length; rank++){
        const {id, c} = items[rank];
        const revealAt = rank * step;
        const localT = T - revealAt;
        if(localT <= 0) continue;              // not revealed yet
        const alpha = Math.min(1, localT / FADE);
        const n = NODES[id]; const s = this.toScreen(n);
        const txt = String(c);
        const tw = ctx.measureText(txt).width;
        const padX = 5, padY = 2, w = tw + padX*2, h = PILL_FS + padY*2 + 2;
        // Also grow the pill from a small centre while fading in — reads as
        // "the number popped into place" rather than just appearing.
        const scale = 0.65 + 0.35 * alpha;
        const cx = s.x + 10 + w/2, cy = s.y - h - 6 + h/2;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(cx, cy); ctx.scale(scale, scale); ctx.translate(-cx, -cy);
        const px = s.x + 10, py = s.y - h - 6;
        const bg = catColor(n.c, theme);
        ctx.fillStyle = bg;
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.beginPath();
        const rad = 3;
        ctx.moveTo(px+rad, py);
        ctx.lineTo(px+w-rad, py);
        ctx.quadraticCurveTo(px+w, py, px+w, py+rad);
        ctx.lineTo(px+w, py+h-rad);
        ctx.quadraticCurveTo(px+w, py+h, px+w-rad, py+h);
        ctx.lineTo(px+rad, py+h);
        ctx.quadraticCurveTo(px, py+h, px, py+h-rad);
        ctx.lineTo(px, py+rad);
        ctx.quadraticCurveTo(px, py, px+rad, py);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.fillText(txt, px + w/2, py + h/2 + 0.5);
        ctx.restore();
      }
      ctx.restore();
    }
  }
}
