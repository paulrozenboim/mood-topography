#!/usr/bin/env python3
"""
The Topography of Us — local sync relay + static server for event night.

Serves the /docs folder as a static site AND acts as the message relay between
the tablet and the projection. Uses only the Python standard library — no pip
install needed.

USAGE
    python sync-server.py

Then, on any device on the same network as this laptop (join its hotspot):
    open  http://<this-laptop-LAN-IP>:8765/tablet.html      on the tablet
    open  http://<this-laptop-LAN-IP>:8765/projection.html  on the projection

The server prints its LAN address on startup — bookmark it on both devices.
No internet required at any point; the app auto-detects local mode via /health.

ENDPOINTS
    GET  /health   -> {"status":"ok"}         (probe used by remote-config.js)
    POST /send     -> append msg to log, broadcast to all subscribers
    GET  /sub      -> Server-Sent Events stream: replays log, streams new msgs
    GET  /*        -> static files from ./docs (index.html by default)
"""

import http.server
import json
import queue
import socket
import socketserver
import threading
from collections import deque
from pathlib import Path
from urllib.parse import urlparse

PORT = 8765
DOCS_DIR = Path(__file__).parent / "docs"
MAX_LOG = 5000                        # cap replay length so hydration stays snappy

_log = deque()
_subscribers = []
_lock = threading.Lock()


def _broadcast(msg):
    """Push msg to every open SSE subscriber's queue. Dead queues are pruned lazily."""
    with _lock:
        for q in list(_subscribers):
            try:
                q.put_nowait(msg)
            except Exception:
                pass


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DOCS_DIR), **kwargs)

    # ---- CORS + preflight ------------------------------------------------
    # Same-origin is the normal case here (Python server serves the app AND
    # the sync endpoints from the same port), but if the operator loads the
    # GitHub Pages copy in one browser and points at local sync from another,
    # CORS keeps that flexible.
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    # ---- POST /send ------------------------------------------------------
    def do_POST(self):
        if self.path != "/send":
            self.send_error(404); return
        n = int(self.headers.get("Content-Length", 0))
        try:
            msg = json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            self.send_error(400); return
        with _lock:
            _log.append(msg)
            while len(_log) > MAX_LOG:
                _log.popleft()
            # A "clear" wipes the durable log too — otherwise the next client
            # to join would re-hydrate every path we just cleared.
            if msg.get("k") == "clear":
                _log.clear()
                _log.append(msg)
        _broadcast(msg)
        self.send_response(204); self._cors(); self.end_headers()

    # ---- GET /health, /sub, /* ------------------------------------------
    def do_GET(self):
        path = urlparse(self.path).path

        if path == "/health":
            body = b'{"status":"ok"}'
            self.send_response(200); self._cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers(); self.wfile.write(body); return

        if path == "/sub":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self._cors()
            self.end_headers()
            q = queue.Queue()
            # take snapshot of history INSIDE the lock so we don't race with a
            # concurrent /send appending mid-replay
            with _lock:
                past = list(_log)
                _subscribers.append(q)
            try:
                # replay history — client tags these as _historical via a
                # timestamp check on its side; here we mark it explicitly
                # so even mangled ts's don't confuse the hydration path
                for m in past:
                    payload = json.dumps({**m, "_historical": True})
                    self.wfile.write(f"data: {payload}\n\n".encode())
                self.wfile.flush()
                # stream new messages; ping every 25s so intermediaries don't
                # close the idle connection
                while True:
                    try:
                        m = q.get(timeout=25)
                        self.wfile.write(f"data: {json.dumps(m)}\n\n".encode())
                        self.wfile.flush()
                    except queue.Empty:
                        self.wfile.write(b": ping\n\n")
                        self.wfile.flush()
            except (ConnectionResetError, BrokenPipeError, OSError):
                pass
            finally:
                with _lock:
                    if q in _subscribers:
                        _subscribers.remove(q)
            return

        # otherwise: static file from docs/
        if path == "/":
            self.path = "/index.html"
        return super().do_GET()

    def log_message(self, fmt, *args):
        # keep the console output tidy
        print(f"  {self.address_string():16}  {fmt % args}")


class ThreadedServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def _lan_ip():
    """Best-effort LAN IP so we can print the URL the tablet should visit."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # UDP "connect" doesn't send packets — it just picks the outbound iface
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


if __name__ == "__main__":
    if not DOCS_DIR.exists():
        print(f"ERROR: docs/ folder not found at {DOCS_DIR}")
        raise SystemExit(1)

    ip = _lan_ip()
    banner = "=" * 66
    print(banner)
    print("  The Topography of Us — local sync relay + static server")
    print(banner)
    print(f"  Serving from : {DOCS_DIR}")
    print(f"  Port         : {PORT}")
    print()
    print(f"  On THIS laptop        ->  http://localhost:{PORT}/")
    print(f"  From tablet/phone     ->  http://{ip}:{PORT}/")
    print()
    print(f"  Join this laptop's hotspot on the tablet, then open the URL")
    print(f"  above. The app auto-detects local mode — no internet needed.")
    print(f"  Ctrl+C to stop.")
    print(banner)

    with ThreadedServer(("0.0.0.0", PORT), Handler) as srv:
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")
