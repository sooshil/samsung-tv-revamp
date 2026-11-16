#!/usr/bin/env python3
"""Temporary LAN listener for the probe app. Appends each JSON report to the output file.
Usage: python3 scripts/probe-receiver.py <out.jsonl> [port]   (Ctrl-C to stop)"""
import json, sys
from http.server import BaseHTTPRequestHandler, HTTPServer

OUT = sys.argv[1]
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8765

class H(BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        try:
            rec = json.loads(body)
        except ValueError:
            rec = {"raw": body.decode(errors="replace")}
        rec["from"] = self.client_address[0]
        with open(OUT, "a") as f:
            f.write(json.dumps(rec) + "\n")
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
    def log_message(self, *a):
        pass

HTTPServer(("0.0.0.0", PORT), H).serve_forever()
