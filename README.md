# md-code

**Stop copy-pasting code into documentation.** Keep your markdown examples automatically synchronized with real source files.

## The Problem

Your documentation has code examples, but they get outdated:

- ❌ You update your source code but forget to update the docs
- ❌ Code examples in README/docs become stale and misleading  
- ❌ Copy-paste errors introduce bugs in documentation
- ❌ Maintaining multiple copies of the same code is painful

## The Solution

`md-code` keeps your documentation in sync automatically:

- ✅ **Single source of truth**: Code examples come from real files
- ✅ **Always accurate**: Documentation updates when code changes
- ✅ **Zero maintenance**: Sync happens automatically in CI/CD
- ✅ **Extract existing**: Migrate current docs with one command

## Example

❌ Before: Manual copy-paste (gets outdated)

````markdown
```js
function greet(name) {
  return "Hello " + name;  // Oops, code changed but docs didn't!
}
```
````

✅ After: Automatic sync from real files

````markdown
```js snippet=src/utils/greet.js
function greet(name) {
  return `Hello, ${name}! Welcome to our app.`;  // Always current!
}
```
````

**Result**: Your documentation stays accurate as your code evolves.

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

## Quick Start

### Extract from Existing Documentation (Most Common)

If you already have markdown files with code blocks:

1. Install globally

  ```bash
  npm install -g markdown-code
  ```

2. Navigate to your project

  ```bash
  cd your-project
  ```

3. One-command setup: create config + extract all code blocks

  ```bash
  md-code init --extract
  ```

That's it! `md-code` will:

- ✅ Create `.markdown-coderc.json` configuration
- ✅ Create `snippets/` directory  
- ✅ Extract code blocks from your markdown to snippet files
- ✅ Update markdown to reference the new snippet files

#### Extract Workflow Details

When you run `md-code extract`, here's what happens:

**For each markdown file** (e.g., `user-guide.md`):

- ✅ Creates directory using lowercase filename (`user-guide/`)
- ✅ Generates numbered snippet files (`snippet1.js`, `snippet2.ts`, etc.)
- ✅ Handles naming collisions by incrementing numbers
- ✅ Updates markdown to reference new snippet files
- ❌ Ignores blocks without language tags
- ❌ Ignores existing snippet references

### Start from Scratch

If you're starting fresh:

1. Install and setup

  ```bash
  npm install -g markdown-code
  md-code init
  ```

2. Add source files to snippets/ directory
3. Reference them in markdown:

````markdown
```js snippet=hello.js
// This will be replaced with hello.js content
```
````

```bash
# 4. Sync content
md-code sync
```

## Commands

| Command | Description | Example |
|---------|-------------|---------|
| `md-code` | Update markdown with snippet content (default) | `md-code` |
| `md-code sync` | Same as above, explicit | `md-code sync` |
| `md-code check` | Verify files are in sync (CI-friendly) | `md-code check` |
| `md-code init` | Create config and snippets directory | `md-code init` |
| `md-code extract` | Extract code blocks to snippet files | `md-code extract` |
| `md-code init --extract` | Setup + extract in one step | `md-code init --extract` |

### Global Options

| Option | Description | Example |
|--------|-------------|---------|
| `--config` | Custom configuration file | `md-code --config custom.json` |
| `--snippet-root` | Override snippet directory | `md-code --snippet-root ./src` |
| `--markdown-glob` | Override markdown file pattern | `md-code --markdown-glob "docs/**/*.md"` |
| `--include-extensions` | Override file extensions | `md-code --include-extensions .ts,.js,.py` |

## How It Works

### Example: Code Snippets in Action

Here's a TypeScript function that greets users:

````markdown
```ts snippet=examples/hello.ts#L1-L3
export function greetUser(name: string): string {
  return `Hello, ${name}! Welcome to md-code.`;
}
```
````

And here's an async function for fetching user data:

````markdown
```ts snippet=examples/fetch_users.ts#L7-L14
export async function fetchUsers(): Promise<Array<User>> {
  const response = await fetch('/api/users');
  
  if (!response.ok) {
    throw new Error(`Failed to fetch users: ${response.statusText}`);
  }

  return response.json() as Promise<Array<User>>;
```
````

You can also include entire files:

````markdown
```json snippet=examples/config.json
{
  "name": "md-code-demo",
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
````

### Snippet Syntax

Use the `snippet=` directive in your fenced code blocks:

````markdown
```ts snippet=path/to/file.ts
// This content will be replaced
```

```ts snippet=path/to/file.ts#L10-L20
// This will include lines 10-20 only
```

```ts snippet=path/to/file.ts#L5
// This will include from line 5 to end of file
```

````

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

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and contribution guidelines.

## License

MIT License - see the [LICENSE](LICENSE) file for details.
