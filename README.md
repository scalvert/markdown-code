# markdown-code

Keep code examples in Markdown synchronized with actual source files, preventing documentation drift.

## Features

- **Automatic Sync**: Replace fenced code blocks with contents from real files
- **Extract Mode**: Create snippet files from existing code blocks in markdown
- **Line Range Support**: Extract specific line ranges using `#Lx-Ly` syntax
- **Check Mode**: Verify documentation is in sync without making changes
- **Multi-language**: Support for any programming language
- **Configurable**: Flexible configuration via `.markdown-coderc.json`

## Installation

```bash
npm install -g markdown-code
```

## Usage

### Commands

```bash
# Update markdown files with snippet content (default)
markdown-code
markdown-code sync

# Check if files are in sync (exit non-zero on mismatch)
markdown-code check

# Create default configuration file
markdown-code init

# Extract code blocks from markdown to snippet files
markdown-code extract

# Create config and extract snippets in one step
markdown-code init --extract
```

### Global Options

```bash
# Use custom configuration
markdown-code --config path/to/.markdown-coderc.json

# Override settings
markdown-code --snippet-root ./src --markdown-glob "docs/**/*.md"
markdown-code --include-extensions .ts,.js,.py
```

### Extract Workflow

The `extract` command helps you migrate existing documentation to use snippet files:

```bash
# 1. Create configuration
markdown-code init

# 2. Extract code blocks to files (creates directories based on markdown names)
markdown-code extract

# 3. Modify extracted files as needed
# 4. Keep in sync
markdown-code sync
```

**Extract Example**: If you have `user-guide.md` with code blocks, `extract` will:
- Create `user-guide/` directory
- Generate `snippet1.js`, `snippet2.ts`, etc.
- Update markdown to reference these files
- Only process languages in `includeExtensions`

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
  "snippetRoot": "./snippets",
  "markdownGlob": "**/*.md",
  "includeExtensions": [
    ".ts",
    ".js",
    ".py",
    ".java",
    ".cpp",
    ".c",
    ".go",
    ".rs",
    ".php",
    ".rb",
    ".swift",
    ".kt"
  ]
}
```

### Configuration Options

- **snippetRoot**: Base directory for resolving snippet paths (default: `"."`)
- **markdownGlob**: Glob pattern to find Markdown files (default: `"**/*.md"`)
- **includeExtensions**: File extensions to consider for snippets and extraction

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

## Command Reference

### `sync` (default)
Updates markdown files with content from snippet files.

```bash
markdown-code sync
# or just
markdown-code
```

### `check`
Validates that markdown files are in sync with snippet files. Exits with non-zero code if differences are found.

```bash
markdown-code check
```

### `init`
Creates a default `.markdown-coderc.json` configuration file and `snippets/` directory.

```bash
markdown-code init

# Also extract snippets from existing code blocks
markdown-code init --extract
```

### `extract`
Extracts code blocks from markdown files to create snippet files. Only processes languages listed in `includeExtensions`.

```bash
markdown-code extract
```

**Extract Behavior**:
- Creates directories using lowercase markdown filename (e.g., `user-guide.md` → `user-guide/`)
- Generates numbered snippet files (`snippet1.js`, `snippet2.ts`, etc.)
- Handles naming collisions by incrementing numbers
- Updates markdown to reference new snippet files
- Ignores blocks without language tags or existing snippet references

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
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see the [LICENSE](LICENSE) file for details.
