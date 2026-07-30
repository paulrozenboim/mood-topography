/* ============================================================
   THE TOPOGRAPHY OF US — store & sync
   Store holds all state. Sync is the transport underneath it — swappable without
   touching Store or any page logic. See README "Making this real" for wiring in a
   real-time backend so separate devices (not just separate tabs) stay in sync.
   ============================================================ */
"use strict";

const uid = ()=> Math.random().toString(36).slice(2,9);

/* ---------------- Sync transport -----------------------------------------
   LOCAL MODE (default, zero config): BroadcastChannel keeps every open tab on this
   ONE device in sync — exactly how you've been testing so far (tablet + projection
   open side by side, or in two windows). It does NOT reach other devices: a phone
   and a laptop each get their own isolated copy. Fine for rehearsal on one machine;
   not sufficient for a real tablet-plus-projector setup on two devices.

   REMOTE MODE: wire in window.TOPO_REMOTE = { send(msg), subscribe(fn) } from a
   small config script (see firebase-config.example.js) to sync across real devices.
   Everything above this line — Store, MapView, both bulletin logic — is unaware of
   which transport is active.
--------------------------------------------------------------------------- */
const Sync = (()=>{
  const me = uid();
  let mode = "local", remote = null, statusListeners = new Set();

  let ch=null;
  try{ ch = new BroadcastChannel("topography-of-us"); }catch(e){}
  if(ch){
    ch.onmessage = ev=>{
      const m = ev.data; if(!m || m.from===me) return;
      Sync._receive(m);
    };
  }

  function setStatus(s){ mode=s; statusListeners.forEach(fn=>fn(mode)) }

  // if a page defines window.TOPO_REMOTE before this script loads, use it instead
  if(typeof window!=="undefined" && window.TOPO_REMOTE && typeof window.TOPO_REMOTE.send==="function"){
    remote = window.TOPO_REMOTE;
    remote.subscribe(m=> Sync._receive(m));
    setStatus("remote");
  }

  return {
    get mode(){ return mode },
    onStatus(fn){ statusListeners.add(fn); fn(mode); return ()=>statusListeners.delete(fn) },
    send(m){
      const withFrom={...m, from:me};
      if(remote) remote.send(withFrom);
      else if(ch) try{ ch.postMessage(withFrom) }catch(e){}
    },
    hello(){ this.send({k:"hello"}) },
    _receive(m){
      if(m.k==="path")   Store.addPath(m.p,{broadcast:false});
      if(m.k==="filter") Store.setFilter(m.f,{broadcast:false});
      if(m.k==="auto")   Store.setAuto(m.v,{broadcast:false});
      if(m.k==="theme")  Store.setTheme(m.which,m.val,{broadcast:false});
      if(m.k==="clear")  Store.clear({broadcast:false});
      if(m.k==="clearSeeded") Store.clearSeeded({broadcast:false});
      if(m.k==="hello")  this.send({k:"state",paths:Store.paths,filter:Store.filter,auto:Store.auto,theme:Store.theme});
      if(m.k==="state" && Store.paths.length===0){
        Store.replaceAll(m.paths); Store.filter=m.filter; Store.auto=m.auto; Store.theme=m.theme;
        Store.emit({type:"reset"});
      }
    }
  };
})();

/* ---------------- Store ---------------------------------------------------- */
const Store = {
  paths:[],
  filter:{type:"all"},
  auto:true,
  theme:{projection:"dark", tablet:"light"},
  listeners:new Set(),
  version:0,
  sub(fn){this.listeners.add(fn); return ()=>this.listeners.delete(fn)},
  emit(evt){this.version++; this.listeners.forEach(fn=>fn(evt))},

  addPath(p, {broadcast=true, animate=true}={}){
    if(this.paths.some(x=>x.id===p.id)) return;
    this.paths.push(p);
    if(broadcast) Sync.send({k:"path", p});
    this.emit({type:"path", path:p, animate});
  },
  setFilter(f,{broadcast=true}={}){
    this.filter=f; if(broadcast) Sync.send({k:"filter", f});
    this.emit({type:"filter"});
  },
  setAuto(v,{broadcast=true}={}){
    this.auto=v; if(broadcast) Sync.send({k:"auto", v});
    this.emit({type:"auto"});
  },
  setTheme(which,val,{broadcast=true}={}){
    this.theme[which]=val; if(broadcast) Sync.send({k:"theme", which, val});
    this.emit({type:"theme"});
  },
  clear({broadcast=true}={}){
    this.paths=[]; if(broadcast) Sync.send({k:"clear"});
    this.emit({type:"reset"});
  },
  clearSeeded({broadcast=true}={}){
    this.paths=this.paths.filter(p=>!p.seeded);
    if(broadcast) Sync.send({k:"clearSeeded"});
    this.emit({type:"reset"});
  },
  replaceAll(paths){ this.paths=paths.slice(); this.emit({type:"reset"}) }
};

Store.sub(()=>{ if(typeof document!=="undefined") document.documentElement.dataset.theme = Store.theme.projection });
if(typeof document!=="undefined") document.documentElement.dataset.theme = Store.theme.projection;
