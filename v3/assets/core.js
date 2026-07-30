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
const catColor = (c,theme)=> theme==="light" ? CATS_LIGHT[c] : CATS[c].color;

// Solved by relax2.js: each of the four lines fills its own region of the field with a
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

  let totalStops=0, longest=null, minimalCount=0, maximalCount=0, recentCount=0;
  const now=Date.now();
  for(const p of paths){
    totalStops += p.nodes.length;
    if(!longest || p.nodes.length>longest.nodes.length) longest=p;
    if(p.nodes.length===MIN_STOPS) minimalCount++;
    if(p.nodes.length===MAX_STOPS) maximalCount++;
    if(now-p.t < 15*60*1000) recentCount++;
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
          longest, minimalCount, maximalCount, recentCount,
          repeatTop, repeatExample};
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
      sub:"The most walked segment in this room", focus:{type:"edge", e}});
  }
  if(A.topNode){
    out.push({tag:"Interchange", accent:A.topNode.c,
      line:`{${A.topNode.n}} is the busiest station tonight.`,
      sub:`Crossed by ${A.traffic[A.topNode.id]} of ${A.total} journeys`, focus:{type:"node", id:A.topNode.id}});
  }
  if(A.topAnchor && A.topEnd && A.topAnchor.id!==A.topEnd.id){
    out.push({tag:"Direction of travel", accent:A.topEnd.c,
      line:`Most of you started at {${A.topAnchor.n}}. Most of you are heading to {${A.topEnd.n}}.`,
      sub:"Anchor and destination, aggregated"});
  }
  const cats=Object.entries(A.catEnd).sort((a,b)=>b[1]-a[1]);
  if(cats[0][1]>0){
    out.push({tag:"Destination", accent:cats[0][0],
      line:`${pct(cats[0][1])}% of journeys end in {${CATS[cats[0][0]].name}}.`,
      sub:`${cats[0][1]} of ${A.total} paths`, focus:{type:"cat", c:cats[0][0]}});
  }
  if(A.outlier && A.outlierScore<0.35){
    const names=A.outlier.nodes.map(i=>NODES[i].n);
    out.push({tag:"Sole traveller", accent:NODES[A.outlier.nodes[0]].c,
      line:`One person went this way. Nobody else did.`,
      sub:names.join("  →  "), focus:{type:"path", id:A.outlier.id}, hold:true});
  }
  if(A.untouched.length){
    const u=A.untouched[Math.floor(Math.random()*A.untouched.length)];
    out.push({tag:"No service", accent:u.c,
      line:`No one has passed through {${u.n}} tonight.`,
      sub:"Station open, unvisited", focus:{type:"node", id:u.id}});
  }
  if(A.avgLen>0){
    out.push({tag:"Average journey", line:`The average journey tonight visits {${A.avgLen.toFixed(1)}} stations.`,
      sub:`Across ${A.total} paths cast`});
  }
  if(A.longest && A.longest.nodes.length>=6){
    out.push({tag:"Longest journey", accent:NODES[A.longest.nodes[0]].c,
      line:`The longest journey tonight ran {${A.longest.nodes.length}} stations, starting at {${NODES[A.longest.nodes[0]].n}}.`,
      sub:A.longest.nodes.map(i=>NODES[i].n).join("  →  "), focus:{type:"path", id:A.longest.id}});
  }
  if(A.minimalCount>0){
    out.push({tag:"Kept it short", line:`${A.minimalCount} of you kept it to the minimum — just {${MIN_STOPS}} stations.`,
      sub:"Sometimes the shortest read is the truest one"});
  }
  if(A.maximalCount>0){
    out.push({tag:"Went the distance", line:`${A.maximalCount} of you used every stop available — all {${MAX_STOPS}} stations.`,
      sub:"The long way round, on purpose"});
  }
  const catT=Object.entries(A.catTraffic).sort((a,b)=>b[1]-a[1]);
  if(catT[0][1]>0){
    out.push({tag:"Heaviest line", accent:catT[0][0],
      line:`{${CATS[catT[0][0]].name}} carries the most foot traffic tonight.`,
      sub:`${catT[0][1]} station crossings on that line alone`, focus:{type:"cat", c:catT[0][0]}});
  }
  if(A.recentCount>0){
    out.push({tag:"Just now", line:`${A.recentCount} journeys have joined the wall in the last 15 minutes.`,
      sub:"The map is still moving"});
  }
  if(A.repeatTop && A.repeatExample){
    out.push({tag:"Well-worn path", accent:NODES[A.repeatExample.nodes[0]].c,
      line:`${A.repeatTop.count} of you traced the exact same route.`,
      sub:A.repeatExample.nodes.map(i=>NODES[i].n).join("  →  "), focus:{type:"path", id:A.repeatExample.id}});
  }
  if(A.edgeList[1] && A.edgeList[1].v>1){
    const e=A.edgeList[1];
    out.push({tag:"Also well-travelled", accent:NODES[e.a].c,
      line:`${e.v} more of you walked between {${NODES[e.a].n}} and {${NODES[e.b].n}}.`,
      sub:"The second most walked segment in this room", focus:{type:"edge", e}});
  }
  out.push({tag:"Network status", line:`${A.total} journeys cast. ${A.distinct} of them unrepeated.`,
    sub:"Every line on this wall was drawn by someone in this room"});
  return out;
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
    cv.addEventListener("wheel",ev=>{ ev.preventDefault(); this.zoomAt(at(ev), ev.deltaY<0?1.12:1/1.12) },{passive:false});
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
    const ctx=this.ctx, dot=9.8;   // matches the larger station radius (base 4.6 + up to 5.0 heat)
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
    const f=Store.filter, ps=Store.paths;
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
    const g=this.gravity();
    const paths=this.visiblePaths();
    const focus=this.focus;
    const solo = Store.filter.type==="outlier";
    for(const p of paths){
      const pts=splinePoints(pathPts(p), g).map(q=>this.toScreen(q));
      const col=catColor(NODES[p.nodes[0]].c, theme);
      let a = p.seeded ? (dark?0.19:0.14) : (dark?0.36:0.27);
      let lw = p.seeded?1.1:1.9;
      if(solo){ a = dark?0.95:0.78; lw = 3.6 }
      else if(Store.filter.type==="heaviest"){ a*=1.5; lw+=0.5 }
      if(focus && focus.type==="path"){ const on=focus.id===p.id; a=on?(dark?.95:.8):a*.18; lw=on?3.4:lw }
      if(focus && focus.type==="cat"){ const on=p.nodes.some(i=>NODES[i].c===focus.c); if(!on) a*=.16 }
      if(focus && focus.type==="node"){ const on=p.nodes.includes(focus.id); if(!on) a*=.2; else a*=1.7 }
      c.globalAlpha=a; c.strokeStyle=col; c.lineWidth=lw; c.lineCap="round"; c.lineJoin="round";
      c.beginPath(); pts.forEach((q,i)=> i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y)); c.stroke();
    }
    c.globalCompositeOperation="source-over"; c.globalAlpha=1;
    this.dirty=false;
  }
  loop(ts){
    this.A = analyse(Store.paths);
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

    if(this.opts.showAggregate && this.focus && this.focus.type==="edge"){
      const e=this.focus.e;
      const pts=splinePoints([NODES[e.a],NODES[e.b]].map(n=>({x:n.x,y:n.y})), this.gravity()).map(q=>this.toScreen(q));
      ctx.save(); ctx.globalCompositeOperation=dark?"lighter":"source-over";
      ctx.strokeStyle=catColor(NODES[e.a].c,theme); ctx.lineWidth=4; ctx.globalAlpha=.55+Math.sin(this.pulse*2.4)*.2;
      ctx.beginPath(); pts.forEach((q,i)=> i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)); ctx.stroke(); ctx.restore();
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
        if(this.focus.type==="path"){const p=Store.paths.find(x=>x.id===this.focus.id); em=p&&p.nodes.includes(n.id)?1:.22}
      }
      const active = this.draft && this.draft.nodes.includes(n.id);
      const hot = this.hot===n.id;
      // stations must read clearly as "stations" from a projector at the back of a room even
      // with zero data — traffic makes them bigger and brighter, it must never be what makes
      // them visible at all.
      const r=(4.6+heat*5.0)*(this.opts.role==="tablet"?1.2:1);

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
        ctx.globalAlpha=em*(dark?.7:.86);
        ctx.fillStyle=bg;
        ctx.fillRect(L.x0, L.ly-1, L.tw+6, L.h);
        ctx.globalAlpha=em*(active||hot?1:.92);
        ctx.fillStyle=(active||hot)?ink:ink2;
        ctx.textAlign="left";
        ctx.fillText(L.txt, L.x0+3, L.ly);
        ctx.restore();
      }
    }

    if(this.draft && this.draft.nodes.length){
      const pts=[...this.draft.nodes.map(i=>({x:NODES[i].x,y:NODES[i].y}))];
      if(this.draft.pointer) pts.push(this.draft.pointer);
      const sp=splinePoints(pts,null).map(q=>this.toScreen(q));
      ctx.save();
      ctx.strokeStyle=catColor(NODES[this.draft.nodes[0]].c,theme);
      ctx.lineWidth=3; ctx.lineCap="round"; ctx.lineJoin="round"; ctx.globalAlpha=.95;
      ctx.beginPath(); sp.forEach((q,i)=> i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)); ctx.stroke();
      ctx.restore();
    }

    if(inj && this.opts.showAggregate){
      const e=(ts-inj.t0)/1000;
      const pts=splinePoints(pathPts(inj.path), this.gravity()).map(q=>this.toScreen(q));
      const col=catColor(NODES[inj.path.nodes[0]].c,theme);
      const prog=Math.max(0,Math.min(1,(e-0.3)/1.9));
      const cut=Math.floor(prog*(pts.length-1));
      ctx.save();
      ctx.globalCompositeOperation=dark?"lighter":"source-over";
      ctx.strokeStyle=col; ctx.lineWidth=3.4; ctx.lineCap="round"; ctx.lineJoin="round";
      ctx.globalAlpha= e>2.6 ? Math.max(0,1-(e-2.6)/1.0) : 1;
      ctx.beginPath(); for(let i=0;i<=cut;i++){ i?ctx.lineTo(pts[i].x,pts[i].y):ctx.moveTo(pts[i].x,pts[i].y) } ctx.stroke();
      if(prog<1 && pts[cut]){
        const h=pts[cut];
        ctx.beginPath(); ctx.arc(h.x,h.y,5.5,0,7); ctx.fillStyle=dark?"#fff":col; ctx.fill();
        ctx.globalAlpha=.35; ctx.beginPath(); ctx.arc(h.x,h.y,16,0,7); ctx.fillStyle=col; ctx.fill();
      }
      if(prog>=1){
        const rr=(e-2.2)*230;
        if(rr>0&&rr<420){
          const last=pts[pts.length-1];
          ctx.globalAlpha=Math.max(0,.6-rr/420*.6);
          ctx.strokeStyle=col; ctx.lineWidth=2;
          ctx.beginPath(); ctx.arc(last.x,last.y,rr,0,7); ctx.stroke();
        }
      }
      ctx.restore();
    }
    requestAnimationFrame(this.loop);
  }
  playInjection(path){ this.inject={path, t0:performance.now()}; }
  setFocus(f){ this.focus=f; this.dirty=true }
}
