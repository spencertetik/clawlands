#!/usr/bin/env python3
"""Simple HTTP server for development"""

import http.server
import socketserver
import os

PORT = 8080
DIRECTORY = "client"

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

os.chdir(os.path.dirname(os.path.abspath(__file__)))

with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
    print(f"🦞 ClawWorld Server running at http://localhost:{PORT}/")
    print(f"Serving files from: {os.path.abspath(DIRECTORY)}")
    print("Press Ctrl+C to stop")
    httpd.serve_forever()
