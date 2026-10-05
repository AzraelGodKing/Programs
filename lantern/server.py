#!/usr/bin/env python3
"""Serve Lantern and the shared table the DM screen watches."""

import json
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

from room import Table, TableError

ROOT = Path(__file__).resolve().parent
TABLE = Table()
PORT = 5173


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/rooms":
            self.send_json(405, {"error": "Open a table with POST."})
            return
        if path.startswith("/api/rooms/"):
            code = path.removeprefix("/api/rooms/").strip("/")
            view = TABLE.view(code)
            if view is None:
                self.send_json(404, {"error": "No table with that code."})
                return
            self.send_json(200, view)
            return
        if path.startswith("/api/"):
            self.send_json(404, {"error": "Not found."})
            return
        super().do_GET()

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/rooms":
            self.send_json(201, {"code": TABLE.create()})
            return
        if path.startswith("/api/rooms/") and path.endswith("/shop"):
            code = path.removeprefix("/api/rooms/").removesuffix("/shop").strip("/")
            try:
                payload = self.read_json()
                open_ = payload.get("open")
                updated = TABLE.set_shop(code, open_)
            except TableError as error:
                self.send_json(400, {"error": str(error)})
                return
            except json.JSONDecodeError:
                self.send_json(400, {"error": "That was not JSON."})
                return
            if updated is None:
                self.send_json(404, {"error": "No table with that code."})
                return
            self.send_json(200, {"ok": True, "shop": open_ is True})
            return
        if path.startswith("/api/rooms/"):
            code = path.removeprefix("/api/rooms/").strip("/")
            try:
                payload = self.read_json()
                updated = TABLE.update(code, payload)
            except TableError as error:
                self.send_json(400, {"error": str(error)})
                return
            except json.JSONDecodeError:
                self.send_json(400, {"error": "That was not JSON."})
                return
            if updated is None:
                self.send_json(404, {"error": "No table with that code."})
                return
            view = TABLE.view(code)
            self.send_json(200, {"ok": True, "shop": bool(view and view["shop"])})
            return
        self.send_json(404, {"error": "Not found."})

    def read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length < 0 or length > 300_000:
            raise TableError("That update is too large.")
        raw = self.rfile.read(length) if length else b""
        if not raw:
            return {}
        data = json.loads(raw.decode("utf-8"))
        if not isinstance(data, dict):
            raise TableError("Expected an object.")
        return data

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        if self.path.startswith("/api/rooms/") and args and str(args[1]).startswith("2"):
            return
        super().log_message(fmt, *args)


def main():
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Lantern at http://127.0.0.1:{PORT}/")
    print(f"Player seat at http://127.0.0.1:{PORT}/player.html")
    print(f"DM screen at http://127.0.0.1:{PORT}/dm.html")
    server.serve_forever()


if __name__ == "__main__":
    main()
