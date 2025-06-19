# Complex Multi-Snippet Example

This document demonstrates various snippet usage patterns.

## JavaScript Utilities

Here's the complete utility file:

```js snippet=utils.js
// OLD: Complete file content
```

But sometimes you only need specific functions. Here's just the add function:

```js snippet=utils.js#L2-L4
// OLD: Just the add function
```

And here's a single line for the error message:

```js snippet=utils.js#L16
// OLD: Error message line
```

## Configuration

Our app uses this configuration:

```json snippet=config.json
{
  "old": "config"
}
```

But you might only need the database config:

```json snippet=config.json#L2-L6
{
  "old": "database config"
}
```

## Python Server

Here's the request handler class:

```python snippet=server.py#L7-L14
# OLD: Request handler class
```

And the main function:

```python snippet=server.py#L16-L19
# OLD: Main function
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
