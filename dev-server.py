#!/usr/bin/env python3
"""BoatBoard local static server + wildlife CORS proxy.

  python3 dev-server.py
  → http://localhost:8080/

GET /wild-proxy?url=<encoded https URL> re-serves allowlisted APIs with CORS *.
"""
from __future__ import annotations

import json
import ssl
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ALLOW_HOSTS = {"api.whaledata.org", "api.inaturalist.org"}
PORT = 8080


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):
        if self.path.startswith("/wild-proxy"):
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            return
        self.send_error(404)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/wild-proxy":
            return self._wild_proxy(parsed)
        return super().do_GET()

    def _wild_proxy(self, parsed):
        qs = parse_qs(parsed.query)
        target = (qs.get("url") or [None])[0]
        if not target:
            body = b"BoatBoard wild proxy - pass ?url=<encoded https URL>\n"
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        try:
            dest = urlparse(target)
        except Exception:
            return self._json_err(400, "Invalid url")
        if dest.scheme != "https" or dest.hostname not in ALLOW_HOSTS:
            return self._json_err(403, "Host not allowlisted")
        try:
            req = urllib.request.Request(
                target,
                headers={"Accept": "application/json", "User-Agent": "BoatBoard-wild-proxy/1"},
            )
            ctx = ssl.create_default_context()
            with urllib.request.urlopen(req, context=ctx, timeout=20) as resp:
                data = resp.read()
                ctype = resp.headers.get("Content-Type") or "application/json"
                status = resp.status
        except urllib.error.HTTPError as e:
            data = e.read()
            ctype = e.headers.get("Content-Type") or "application/json"
            status = e.code
        except Exception as e:
            return self._json_err(502, "Upstream failed: " + str(e))
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "public, max-age=120")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _json_err(self, status, msg):
        body = json.dumps({"error": msg}).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        # Quieter than default for map tile noise
        if args and isinstance(args[0], str) and (
            ".png" in args[0] or "tile" in args[0].lower()
        ):
            return
        super().log_message(fmt, *args)


if __name__ == "__main__":
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"BoatBoard → http://localhost:{PORT}/  (wild proxy: /wild-proxy?url=…)")
    httpd.serve_forever()
