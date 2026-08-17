/* ============================================================
   Shared quick-nav — a small always-present handle at the top edge; tapping or
   clicking it reveals links to the other pages (plus, on pages that pass them,
   page-specific actions like Projection's Fit/Theme). It auto-closes on its own
   after a few seconds, or immediately on Escape / a click elsewhere — it never
   reveals itself from general page activity, so it doesn't fight with drawing
   a path on the tablet or dragging to pan the projection.
   ============================================================ */
"use strict";
function initQuickNav({current, actions=[]}={}){
  /* "Results" is the site root: the public read-out is index.html, so that a
     bare ".../mood-topography/" lands a stranger on the map and not on this
     menu. The operator landing moved to backstage.html — this nav is the only
     thing that links to it, and this nav only exists on operator pages. */
  const PAGES=[
    ["backstage.html","Backstage","backstage"],
    ["tablet.html","Cast Path","tablet"],
    ["projection.html","Projection","projection"],
    ["landscape.html","Landscape","landscape"],
    ["archive.html","Archive","archive"],
    ["./","Results","results"],
    ["settings.html","Settings","settings"]
  ];
  const handle=document.createElement("button");
  handle.className="nav-handle"; handle.type="button";
  handle.setAttribute("aria-label","Open menu"); handle.setAttribute("aria-expanded","false");

  const bar=document.createElement("nav"); bar.className="quicknav";
  PAGES.forEach(([href,label,role])=>{
    const a=document.createElement("a"); a.href=href; a.textContent=label;
    if(role===current) a.className="current";
    bar.appendChild(a);
  });
  if(actions.length){
    // No explicit nav-div separator between pages and actions — the
    // border-right on each item already provides a visual break, and the
    // extra vertical bar read as a mistake.
    actions.forEach(({label, html, onClick, title})=>{
      const b=document.createElement("button"); b.type="button"; b.className="nav-action";
      // Prefer html (for SVG icons); fall back to plain text label.
      if(html) b.innerHTML = html; else b.textContent = label;
      if(title) b.title = title;
      if(title) b.setAttribute("aria-label", title);
      b.addEventListener("click", onClick);
      bar.appendChild(b);
    });
  }
  document.body.appendChild(handle);
  document.body.appendChild(bar);

  let hideTimer=null;
  function open(){
    bar.classList.add("on"); handle.setAttribute("aria-expanded","true");
    clearTimeout(hideTimer); hideTimer=setTimeout(close, 4000);
  }
  function close(){ bar.classList.remove("on"); handle.setAttribute("aria-expanded","false") }
  function toggle(){ bar.classList.contains("on") ? close() : open() }

  handle.addEventListener("click", toggle);
  // While the pointer is over the bar the menu stays open indefinitely — no
  // auto-close timer runs. Clicking a link/action does NOT re-arm the timer
  // either, so multi-click flows (theme + fit + navigate) don't close the bar
  // mid-use. Close only fires when the pointer actually leaves the bar.
  bar.addEventListener("pointerenter", ()=>clearTimeout(hideTimer));
  bar.addEventListener("pointerleave", ()=>{ hideTimer=setTimeout(close, 1200) });
  document.addEventListener("keydown", e=>{
    if(e.key==="Escape") close();
    if(e.key==="m" && !bar.classList.contains("on")) open();
  });
  document.addEventListener("pointerdown", e=>{
    if(bar.classList.contains("on") && !bar.contains(e.target) && e.target!==handle) close();
  });
  return {open, close};
}
