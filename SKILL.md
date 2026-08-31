---
name: markdown-code
description: 'Keep README and documentation code blocks automatically synchronized with real source files. Use when adding markdown-code to a project, updating existing snippet files, or setting up CI drift detection.'
---

# markdown-code

Keeps markdown code blocks in sync with real, runnable source files. The `snippet=` directive in a fenced code block points to a source file; `sync` populates the block from that file; `check` fails if they've drifted.

## Critical: Do Not Do This Manually

**Do not create snippet files by hand. Do not add `snippet=` directives to markdown yourself.**

The `extract` command does both — it reads the existing code blocks, writes them to snippet files, and rewrites the markdown with the correct directives. Doing it manually bypasses the tool entirely and is exactly what it exists to prevent.

## Two Workflows

### Workflow A — Existing markdown (most common)

Use this when a project already has markdown files with inline code blocks.

```bash
# 1. Fix the code examples in the markdown until they are correct
#    (edit README.md directly — this is the last time you touch it by hand)

# 2. Initialize
npx markdown-code init

# 3. Extract: creates snippet files AND inserts snippet= directives
npx markdown-code extract

# 4. Verify
npx markdown-code check
```

After extraction, the snippet files in `snippets/` are the source of truth. All future edits go there, not in the markdown.

### Workflow B — Starting from source files

Use this when you have existing source files you want to reference directly (e.g., actual project source code, not dedicated example files).

```bash
# 1. Initialize
npx markdown-code init

# 2. Add snippet= directives manually to markdown, referencing the source files
#    (this is the one case where you add directives yourself)

# 3. Sync: populates the markdown code blocks from the referenced files
npx markdown-code sync

# 4. Verify
npx markdown-code check
```

## Snippet Directive Syntax

Use a fence info string with a `snippet=` metadata token:

````markdown
```bash snippet=path/to/file.sh
```

```ts snippet=src/utils/auth.ts#L10-L20
```

```ts snippet=src/utils/auth.ts#L5
```

```ts snippet=src/utils/auth.ts#L5-
```
````

Paths are relative to `snippetRoot` in `.markdown-coderc.json` (the runtime default is the project root; `init` writes `./snippets`). For Workflow B referencing source files, use paths relative to the project root. Use `markdownGlob: "**/*.{md,mdx}"` when both Markdown and MDX files should be discovered.

## Commands

| Command | Description |
|---------|-------------|
| `npx markdown-code init` | Create `.markdown-coderc.json` and `snippets/` directory |
| `npx markdown-code extract` | Extract code blocks to snippet files and insert directives (Workflow A) |
| `npx markdown-code sync` | Populate markdown code blocks from snippet files (Workflow B) |
| `npx markdown-code check` | Verify markdown matches snippet files — exits non-zero if drift or an error-severity missing snippet is detected |
| `npx markdown-code eject` | Remove snippet directives, snippets, and config after confirmation |

## CI Integration

Add to your CI pipeline to catch drift before it merges:

```bash
npx markdown-code check
```

Missing local snippets are errors by default. To allow them without failing CI,
opt in explicitly with `npx markdown-code check --missing-snippet-severity warning`.

## Configuration

`.markdown-coderc.json` at the project root:

```json
{
  "snippetRoot": "./snippets",
  "markdownGlob": "**/*.md",
  "excludeGlob": ["node_modules/**", ".git/**", "dist/**"],
  "includeExtensions": [".ts", ".js", ".go", ".sh", ".py"],
  "missingSnippetSeverity": "error"
}
```

`includeExtensions` must include the file extension of your snippet files or `extract` will not process them. `missingSnippetSeverity` accepts `error` (the default, making `check` fail) or `warning` (an explicit warning-only policy). The CLI equivalent is `--missing-snippet-severity error|warning`.

## Updating Examples

Once set up, the workflow for updating a code example is:

1. Edit the file in `snippets/` (or the referenced source file for Workflow B)
2. Run `npx markdown-code sync` to update the markdown
3. Run `npx markdown-code check` to verify
