#!/usr/bin/env python3
"""Simple HTTP server example"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json

class RequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        
        response = {'message': 'Hello, World!', 'status': 'ok'}
        self.wfile.write(json.dumps(response).encode())

def main():
    server = HTTPServer(('localhost', 8000), RequestHandler)
    print('Server running on http://localhost:8000')
    server.serve_forever()

if __name__ == '__main__':
    main() 
