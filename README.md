# markdown-code

![CI Build](https://github.com/scalvert/markdown-code/actions/workflows/ci.yml/badge.svg)
[![npm version](https://badge.fury.io/js/markdown-code.svg)](https://badge.fury.io/js/markdown-code)
[![License](https://img.shields.io/npm/l/markdown-code.svg)](https://github.com/scalvert/markdown-code/blob/main/LICENSE)

**Stop copy-pasting code into documentation.** Keep your markdown examples automatically synchronized with real source files.

## The Problem

Your documentation has code examples, but they get outdated:

- You update your source code but forget to update the docs
- Code examples in README/docs become stale and misleading
- Copy-paste errors introduce bugs in documentation
- Code examples can't be validated, linted, or tested like real source code
- Maintaining multiple copies of the same code is painful

## The Solution

markdown-code keeps your documentation in sync automatically:

- **Single source of truth**: Code examples come from real files
- **Always accurate**: Documentation updates when code changes
- **Validated code**: Snippets can be linted, type-checked, and tested like any source file
- **Zero maintenance**: Sync happens automatically in CI/CD
- **Extract existing**: Migrate current docs with one command

## Example

### Before: Manual copy-paste (gets outdated)

````markdown
```js
function greet(name) {
  return 'Hello ' + name; // Oops, code changed but docs didn't!
}
```
````

### After: Automatic sync from real files

````markdown
```js snippet=src/utils/greet.js
function greet(name) {
  return `Hello, ${name}! Welcome to our app.`; // Always current!
}
```
````

**Result**: Your documentation stays accurate as your code evolves.

## Installation

No installation required - use it directly:

```bash
npx markdown-code --help
npx markdown-code init --extract
```

Or install once, then use the shorter `md-code` command:

```bash
npm install -g markdown-code
```

Now you can use the convenient `md-code` binary:

```bash
md-code --help
md-code init --extract
```

> **Note**: All examples in this README show both `npx markdown-code` and `md-code` variants.

## How It Works

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

## Usage

markdown-code provides two powerful workflows for keeping your documentation in sync with your code:

1. **Extract from existing docs** - Convert unmanaged code blocks into manageable snippets
2. **Reference source files** - Keep documentation in sync with your actual codebase

### Workflows

#### Workflow 1: Extract from Existing Documentation

Perfect for projects with existing markdown documentation that contains code blocks.

**Use this when:**

- You have markdown files with unmanaged code blocks
- You want to extract code examples into separate files
- You need to start managing existing documentation

**How it works:**

1. Run `npx markdown-code check` (or `md-code check`) to discover manageable code blocks
2. Run `npx markdown-code init --extract` (or `md-code init --extract`) to extract them into snippet files
3. Your markdown is updated to reference the new snippet files
4. Future changes to snippets automatically sync to documentation

#### Workflow 2: Reference Existing Source Files

Perfect for keeping documentation in sync with your actual project source code.

**Use this when:**

- You want documentation to reference your actual source files
- You need line-range extraction from existing code
- You want living documentation that stays current with code changes

**How it works:**

1. Add snippet directives to reference source files with line ranges
2. Run `npx markdown-code sync` (or `md-code sync`) to populate markdown with current source content
3. When source files change, `npx markdown-code check` (or `md-code check`) detects drift
4. Run `npx markdown-code sync` (or `md-code sync`) to update documentation with latest changes

## Features

- **Automatic Sync**: Replace fenced code blocks with contents from real files
- **Extract Mode**: Create snippet files from existing code blocks in markdown
- **Line Range Support**: Extract specific line ranges using `#Lx-Ly` syntax
- **Check Mode**: Verify documentation is in sync without making changes
- **Multi-language**: Support for any programming language
- **Configurable**: Flexible configuration via `.markdown-coderc.json`

## Commands

| Command                                                       | Description                                    | Example                                                        |
| ------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| `npx markdown-code` / `md-code`                               | Update markdown with snippet content (default) | `npx markdown-code` or `md-code`                               |
| `npx markdown-code sync` / `md-code sync`                     | Same as above, explicit                        | `npx markdown-code sync` or `md-code sync`                     |
| `npx markdown-code check` / `md-code check`                   | Verify files are in sync (CI-friendly)         | `npx markdown-code check` or `md-code check`                   |
| `npx markdown-code init` / `md-code init`                     | Create config and snippets directory           | `npx markdown-code init` or `md-code init`                     |
| `npx markdown-code extract` / `md-code extract`               | Extract code blocks to snippet files           | `npx markdown-code extract` or `md-code extract`               |
| `npx markdown-code init --extract` / `md-code init --extract` | Setup + extract in one step                    | `npx markdown-code init --extract` or `md-code init --extract` |

### Global Options

| Option                 | Description                    | Example                                                                                                            |
| ---------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `--config`             | Custom configuration file      | `npx markdown-code --config custom.json` or `md-code --config custom.json`                                         |
| `--snippet-root`       | Override snippet directory     | `npx markdown-code --snippet-root ./src` or `md-code --snippet-root ./src`                                         |
| `--markdown-glob`      | Override markdown file pattern | `npx markdown-code --markdown-glob "docs/**/*.md"` or `md-code --markdown-glob "docs/**/*.md"`                     |
| `--exclude-glob`       | Override exclusion patterns    | `npx markdown-code --exclude-glob "node_modules/**,dist/**"` or `md-code --exclude-glob "node_modules/**,dist/**"` |
| `--include-extensions` | Override file extensions       | `npx markdown-code --include-extensions .ts,.js,.py` or `md-code --include-extensions .ts,.js,.py`                 |

## Configuration

Create a `.markdown-coderc.json` file in your project root:

```json
{
  "snippetRoot": "./snippets",
  "markdownGlob": "**/*.md",
  "excludeGlob": [
    "node_modules/**",
    ".git/**",
    "dist/**",
    "build/**",
    "coverage/**",
    ".next/**",
    ".nuxt/**",
    "out/**",
    "target/**",
    "vendor/**"
  ],
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

| Option                | Description                                             | Default                                                                                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **snippetRoot**       | Base directory for resolving snippet paths              | `"."`                                                                                                                                                                                                                                    |
| **markdownGlob**      | Glob pattern to find Markdown files                     | `"**/*.md"`                                                                                                                                                                                                                              |
| **excludeGlob**       | Array of glob patterns to exclude from processing       | Common build/dependency directories                                                                                                                                                                                                      |
| **includeExtensions** | File extensions to consider for snippets and extraction | `[".ts", ".js", ".tsx", ".jsx", ".py", ".rb", ".go", ".rs", ".java", ".cpp", ".c", ".cs", ".php", ".sh", ".bash", ".zsh", ".fish", ".json", ".yaml", ".yml", ".toml", ".xml", ".html", ".css", ".scss", ".less", ".sql", ".md", ".txt"]` |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and contribution guidelines.

## License

MIT License - see the [LICENSE](LICENSE) file for details.
