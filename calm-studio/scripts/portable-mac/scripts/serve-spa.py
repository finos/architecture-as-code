#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 CalmStudio Contributors
# SPDX-License-Identifier: Apache-2.0
from __future__ import annotations
#
# Minimal SPA static file server for macOS. No admin rights required.
# Listens on 127.0.0.1 only. SPA fallback → /index.html.

import argparse
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

ROOT = ""
MIME = {
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".map": "application/json",
    ".txt": "text/plain; charset=utf-8",
    ".wasm": "application/wasm",
}


def safe_path(url_path: str) -> str | None:
    rel = unquote(url_path.split("?", 1)[0])
    root_real = os.path.realpath(ROOT)
    if rel in ("", "/"):
        return os.path.join(root_real, "index.html")
    rel = rel.lstrip("/")
    full = os.path.realpath(os.path.join(root_real, rel))
    if full != root_real and not full.startswith(root_real + os.sep):
        return None
    return full


class SpaHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        path = safe_path(self.path)
        if path is None:
            body = b"Bad request"
            self.send_response(400)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if not os.path.isfile(path):
            path = os.path.join(os.path.realpath(ROOT), "index.html")
        if not os.path.isfile(path):
            body = b"Not found"
            self.send_response(404)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        ext = os.path.splitext(path)[1].lower()
        with open(path, "rb") as handle:
            body = handle.read()
        self.send_response(200)
        self.send_header("Content-Type", MIME.get(ext, "application/octet-stream"))
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt: str, *args: object) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main() -> None:
    global ROOT
    parser = argparse.ArgumentParser(description="CalmStudio localhost SPA server")
    parser.add_argument("--root", required=True)
    parser.add_argument("--port", type=int, default=17890)
    parser.add_argument("--pid-file", default="")
    args = parser.parse_args()
    ROOT = os.path.realpath(args.root)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), SpaHandler)
    if args.pid_file:
        parent = os.path.dirname(args.pid_file)
        if parent:
            os.makedirs(parent, exist_ok=True)
        with open(args.pid_file, "w", encoding="ascii") as handle:
            handle.write(str(os.getpid()))
    print(f"CalmStudio server: http://127.0.0.1:{args.port}/", flush=True)
    print(f"Root: {ROOT}", flush=True)
    print(f"PID: {os.getpid()}", flush=True)
    print("Ukončení: ./Stop-CalmStudio.command nebo Ctrl+C", flush=True)
    try:
        server.serve_forever()
    finally:
        server.server_close()
        if args.pid_file and os.path.exists(args.pid_file):
            try:
                os.remove(args.pid_file)
            except OSError:
                pass


if __name__ == "__main__":
    main()
