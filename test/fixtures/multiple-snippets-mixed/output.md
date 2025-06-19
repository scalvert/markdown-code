# Complex Multi-Snippet Example

This document demonstrates various snippet usage patterns.

## JavaScript Utilities

Here's the complete utility file:

```js snippet=utils.js
// Utility functions
function add(a, b) {
  return a + b;
}

function subtract(a, b) {
  return a - b;
}

function multiply(a, b) {
  return a * b;
}

function divide(a, b) {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}
```

But sometimes you only need specific functions. Here's just the add function:

```js snippet=utils.js#L2-L4
function add(a, b) {
  return a + b;
}
```

And here's a single line for the error message:

```js snippet=utils.js#L14
throw new Error('Division by zero');
```

## Configuration

Our app uses this configuration:

```json snippet=config.json
  "name": "markdown-code-demo",
  "version": "1.0.0",
  "settings": {
    "debug": false,
    "maxRetries": 3,
```

But you might only need the database config:

```json snippet=config.json#L2-L6
  "database": {
    "host": "localhost",
    "port": 5432,
    "name": "myapp"
  },
```

## Python Server

Here's the request handler class:

```python snippet=server.py#L7-L13
class RequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()

        response = {'message': 'Hello, World!', 'status': 'ok'}
```

And the main function:

```python snippet=server.py#L15-L18
def main():
    server = HTTPServer(('localhost', 8000), RequestHandler)
    print('Server running on http://localhost:8000')
    server.serve_forever()
```

## Mixed Content

Sometimes we reference files that don't exist:

```js snippet=nonexistent.js
// This file doesn't exist
```

Or use invalid line ranges:

```js snippet=utils.js#L999-L1000
// Invalid line range
```
