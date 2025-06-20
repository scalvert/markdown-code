# markdown-code

Keep code examples in Markdown synchronized with actual source files, preventing documentation drift.

## Features

- **Automatic Sync**: Replace fenced code blocks with contents from real files
- **Line Range Support**: Extract specific line ranges using `#Lx-Ly` syntax
- **Check Mode**: Verify documentation is in sync without making changes
- **Multi-language**: Support for any programming language
- **Configurable**: Flexible configuration via `.markdown-coderc.json`

## Installation

```bash
npm install -g markdown-code
```

## Usage

### Basic Commands

```bash
# Update all snippet blocks (default behavior)
markdown-code

# Check if files are in sync (exit non-zero on mismatch)
markdown-code --check

# Use custom configuration
markdown-code --config path/to/.markdown-coderc.json
```

### Example Usage

Here's a TypeScript function that greets users:

```ts snippet=examples/hello.ts#L1-L3
export function greetUser(name: string): string {
  return `Hello, ${name}! Welcome to markdown-code.`;
}
```

And here's an async function for fetching user data:

```ts snippet=examples/fetch_users.ts#L7-L14
export async function fetchUsers(): Promise<Array<User>> {
  const response = await fetch('/api/users');
  
  if (!response.ok) {
    throw new Error(`Failed to fetch users: ${response.statusText}`);
  }

  return response.json() as Promise<Array<User>>;
```

You can also include entire files:

```json snippet=examples/config.json
{
  "name": "markdown-code-demo",
  "version": "1.0.0",
  "settings": {
    "debug": false,
    "maxRetries": 3,
    "timeout": 5000
  },
  "features": [
    "syntax-highlighting",
    "line-numbers",
    "auto-sync"
  ]
} 
```

## Configuration

Create a `.markdown-coderc.json` file in your project root:

```json
{
  "snippetRoot": "./src",
  "markdownGlob": "**/*.md",
  "includeExtensions": [".ts", ".js", ".py", ".java"]
}
```

### Configuration Options

- **snippetRoot**: Base directory for resolving snippet paths (default: `"."`)
- **markdownGlob**: Glob pattern to find Markdown files (default: `"**/*.md"`)
- **includeExtensions**: File extensions to consider for snippets

## Snippet Syntax

Use the `snippet=` directive in your fenced code blocks:

````markdown
```ts snippet=path/to/file.ts
// This content will be replaced
```
````

```ts snippet=path/to/file.ts#L10-L20
// This will include lines 10-20 only
```

```ts snippet=path/to/file.ts#L5
// This will include from line 5 to end of file
```

````

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Lint code
npm run lint
````

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see the [LICENSE](LICENSE) file for details.
