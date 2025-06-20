import path from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createBinTester, BinTesterProject } from '@scalvert/bin-tester';
import { loadScenario } from './fixtures/index.js';

describe('CLI', () => {
  let project: BinTesterProject;

  const { setupProject, teardownProject, runBin } = createBinTester({
    binPath: fileURLToPath(new URL('../dist/cli.js', import.meta.url)),
  });

  beforeEach(async () => {
    project = await setupProject();
  });

  afterEach(() => {
    teardownProject();
  });

  describe('help and version', () => {
    it('shows help output', async () => {
      const result = await runBin('--help');

      expect(result.exitCode).toEqual(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toMatchInlineSnapshot(`
        "Keep code examples in Markdown synchronized with actual source files

        Commands:
          markdown-code check    Check if markdown files are in sync (exit non-zero on
                                 mismatch)
          markdown-code extract  Extract code blocks from markdown to snippet files
          markdown-code init     Create a default configuration file
          markdown-code sync     Update markdown files with snippet content (default)
                                                                               [default]

        Options:
              --config              Path to configuration file                  [string]
              --snippet-root        Directory containing source files (default: ".")
                                                                                [string]
              --markdown-glob       Glob pattern for markdown files (default: "**/*.md")
                                                                                [string]
              --include-extensions  Comma-separated list of file extensions to include
                                                                                [string]
          -h, --help                Show help                                  [boolean]
          -v, --version             Show version number                        [boolean]"
      `);
    });

    it('shows version information', async () => {
      const result = await runBin('--version');

      expect(result.exitCode).toEqual(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('0.2.0');
    });
  });

  describe('init mode', () => {
    it('creates default configuration and snippets directory', async () => {
      const result = await runBin('init');

      expect(result.exitCode).toEqual(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toMatchInlineSnapshot(`
        "Created .markdown-coderc.json with default configuration
        Created snippets/ directory for your source files

        Next steps:
        1. Place your source files in the snippets/ directory
        2. Add snippet directives to your markdown files: \`\`\`js snippet=example.js
        3. Run \`markdown-code\` to sync your code examples"
      `);

      const configContent = readFileSync(path.join(project.baseDir, '.markdown-coderc.json'), 'utf-8');
      const config = JSON.parse(configContent);
      
      expect(config).toMatchInlineSnapshot(`
        {
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
            ".kt",
          ],
          "markdownGlob": "**/*.md",
          "snippetRoot": "./snippets",
        }
      `);

      expect(existsSync(path.join(project.baseDir, 'snippets'))).toBe(true);
    });

    it('does not overwrite existing configuration', async () => {
      const existingConfig = {
        snippetRoot: './custom',
        markdownGlob: '*.md',
        includeExtensions: ['.js'],
      };

      await project.write({
        '.markdown-coderc.json': JSON.stringify(existingConfig),
      });

      const result = await runBin('init');

      expect(result.exitCode).toEqual(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toMatchInlineSnapshot(`
        "Configuration file already exists at .markdown-coderc.json"
      `);

      const configContent = readFileSync(path.join(project.baseDir, '.markdown-coderc.json'), 'utf-8');
      const config = JSON.parse(configContent);
      
      expect(config).toEqual(existingConfig);
    });

    it('does not create snippets directory if it already exists', async () => {
      await project.write({
        'snippets': {
          'example.js': 'console.log("existing");',
        },
      });

      const result = await runBin('init');

      expect(result.exitCode).toEqual(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Created .markdown-coderc.json with default configuration');
      expect(result.stdout).not.toContain('Created snippets/ directory');

      const existingFile = readFileSync(path.join(project.baseDir, 'snippets', 'example.js'), 'utf-8');
      expect(existingFile).toMatchInlineSnapshot(`"console.log("existing");"`);
    });
  });

  describe('sync mode (default)', () => {
      it('syncs files successfully with default behavior', async () => {
    const scenario = loadScenario('sync-basic');

    await project.write({
      'hello.ts': scenario.sources['hello.ts'],
      'README.md': scenario.input,
    });

    const result = await runBin();

    expect(result.exitCode).toEqual(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toMatchInlineSnapshot(`
      "Syncing markdown files...
      All files are already in sync."
    `);

    const updatedMarkdown = readFileSync(path.join(project.baseDir, 'README.md'), 'utf-8');
    expect(updatedMarkdown).toMatchInlineSnapshot(`
      "# Test

      \`\`\`ts snippet=hello.ts
      export function hello() {
        return "Hello, World!";
      } 
      \`\`\`
      "
    `);
    expect(updatedMarkdown).not.toContain('old content');
  });

    it('reports when files are already in sync', async () => {
      const sourceContent = 'const synced = true;';
      
      const markdownContent = `# Test

\`\`\`js snippet=synced.js
const synced = true;
\`\`\``;

      await project.write({
        'synced.js': sourceContent,
        'README.md': markdownContent,
      });

      const result = await runBin();

      expect(result.exitCode).toEqual(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toMatchInlineSnapshot(`
        "Syncing markdown files...
        All files are already in sync."
      `);
    });

      it('handles line ranges', async () => {
    const scenario = loadScenario('line-ranges-basic');

    await project.write({
      'lines.txt': scenario.sources['lines.txt'],
      'README.md': scenario.input,
    });

    const result = await runBin();

    expect(result.exitCode).toEqual(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('Updated files:');

    const updatedMarkdown = readFileSync(path.join(project.baseDir, 'README.md'), 'utf-8');
    expect(updatedMarkdown).toMatchInlineSnapshot(`
      "# Test

      \`\`\`text snippet=lines.txt#L2-L4
      line 2
      line 3
      line 4
      \`\`\`
      "
    `);
    expect(updatedMarkdown).not.toContain('line 1');
  });

    it('warns about missing files', async () => {
      const markdownContent = `# Test

\`\`\`js snippet=missing.js
old content
\`\`\``;

      await project.write({
        'README.md': markdownContent,
      });

      const result = await runBin();

      expect(result.exitCode).toEqual(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toMatchInlineSnapshot(`
        "Syncing markdown files...
        Warnings:
          Snippet file not found: missing.js
        All files are already in sync."
      `);
    });
  });

  describe('check mode', () => {
    it('passes when files are in sync', async () => {
      const sourceContent = 'const value = "same";';
      
      const markdownContent = `# Test

\`\`\`js snippet=test.js
const value = "same";
\`\`\``;

      await project.write({
        'test.js': sourceContent,
        'README.md': markdownContent,
      });

      const result = await runBin('check');

      expect(result.exitCode).toEqual(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toMatchInlineSnapshot(`
        "Checking markdown files...
        All markdown files are in sync."
      `);
    });

    it('fails when files are out of sync', async () => {
      const sourceContent = 'const updated = "new";';
      
      const markdownContent = `# Test

\`\`\`js snippet=test.js
const updated = "old";
\`\`\``;

      await project.write({
        'test.js': sourceContent,
        'README.md': markdownContent,
      });

      const result = await runBin('check');

      expect(result.exitCode).toEqual(1);
      expect(result.stderr).toMatchInlineSnapshot(`
        "The following files are out of sync:
          README.md"
      `);
    });

    it('uses check command', async () => {
      const sourceContent = 'const test = true;';
      
      const markdownContent = `# Test

\`\`\`js snippet=test.js
const test = true;
\`\`\``;

      await project.write({
        'test.js': sourceContent,
        'README.md': markdownContent,
      });

      const result = await runBin('check');

      expect(result.exitCode).toEqual(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toMatchInlineSnapshot(`
        "Checking markdown files...
        All markdown files are in sync."
      `);
    });

    it('detects whitespace differences', async () => {
      const sourceContent = 'const value = "test";';
      
      const markdownContent = `# Test

\`\`\`js snippet=test.js
  const value = "test";  
\`\`\``;

      await project.write({
        'test.js': sourceContent,
        'README.md': markdownContent,
      });

      const result = await runBin('check');

      expect(result.exitCode).toEqual(1);
      expect(result.stderr).toMatchInlineSnapshot(`
        "The following files are out of sync:
          README.md"
      `);
    });

    it('warns about missing files in check mode', async () => {
      const markdownContent = `# Test

\`\`\`js snippet=missing.js
old content
\`\`\``;

      await project.write({
        'README.md': markdownContent,
      });

      const result = await runBin('check');

      expect(result.exitCode).toEqual(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toMatchInlineSnapshot(`
        "Checking markdown files...
        Warnings:
          Snippet file not found: missing.js
        All markdown files are in sync."
      `);
    });
  });

  describe('configuration', () => {
    it('uses custom config file', async () => {
      const configContent = {
        snippetRoot: './src',
        markdownGlob: '**/*.md',
        includeExtensions: ['.ts'],
      };

      const sourceContent = 'export const custom = "config";';
      
      const markdownContent = `# Test

\`\`\`ts snippet=test.ts
old content
\`\`\``;

      await project.write({
        'custom.json': JSON.stringify(configContent),
        'src': {
          'test.ts': sourceContent,
        },
        'README.md': markdownContent,
      });

      const result = await runBin('--config', 'custom.json');

      expect(result.exitCode).toEqual(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toMatchInlineSnapshot(`
        "Syncing markdown files...
        Updated files:
          README.md"
      `);

      const updatedMarkdown = readFileSync(path.join(project.baseDir, 'README.md'), 'utf-8');
      expect(updatedMarkdown).toContain('export const custom = "config";');
    });

    it('handles invalid config file', async () => {
      const result = await runBin('--config', 'nonexistent.json');

      expect(result.exitCode).toEqual(1);
      expect(result.stderr).toMatchInlineSnapshot(`"Config file not found: nonexistent.json"`);
    });

    it('uses .markdown-coderc.json when present', async () => {
      const configContent = {
        snippetRoot: './examples',
        markdownGlob: '**/*.md',
        includeExtensions: ['.js'],
      };

      const sourceContent = 'const fromConfig = true;';
      
      const markdownContent = `# Test

\`\`\`js snippet=config.js
old content
\`\`\``;

      await project.write({
        '.markdown-coderc.json': JSON.stringify(configContent),
        'examples': {
          'config.js': sourceContent,
        },
        'README.md': markdownContent,
      });

      const result = await runBin();

      expect(result.exitCode).toEqual(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Updated files:');

      const updatedMarkdown = readFileSync(path.join(project.baseDir, 'README.md'), 'utf-8');
      expect(updatedMarkdown).toContain('const fromConfig = true;');
    });

    it('CLI flags override config file settings', async () => {
      const configContent = {
        snippetRoot: './wrong-dir',
        markdownGlob: '*.wrong',
        includeExtensions: ['.wrong'],
      };

      const sourceContent = 'const override = "test";';
      
      const markdownContent = `# Test

\`\`\`js snippet=example.js
old content
\`\`\``;

      await project.write({
        '.markdown-coderc.json': JSON.stringify(configContent),
        'custom-source': {
          'example.js': sourceContent,
        },
        'test.md': markdownContent,
      });

      const result = await runBin(
        '--snippet-root', 'custom-source',
        '--markdown-glob', 'test.md',
        '--include-extensions', '.js'
      );

      expect(result.exitCode).toEqual(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toMatchInlineSnapshot(`
        "Syncing markdown files...
        Updated files:
          test.md"
      `);

      const updatedMarkdown = readFileSync(path.join(project.baseDir, 'test.md'), 'utf-8');
      expect(updatedMarkdown).toContain('const override = "test";');
    });

    it('supports comma-separated include-extensions', async () => {
      const jsContent = 'const js = "file";';
      const tsContent = 'const ts: string = "file";';
      
      const markdownContent = `# Test

\`\`\`js snippet=example.js
old js content
\`\`\`

\`\`\`ts snippet=example.ts
old ts content
\`\`\``;

      await project.write({
        'source': {
          'example.js': jsContent,
          'example.ts': tsContent,
        },
        'README.md': markdownContent,
      });

      const result = await runBin(
        '--snippet-root', 'source',
        '--include-extensions', '.js,.ts'
      );

      expect(result.exitCode).toEqual(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toMatchInlineSnapshot(`
        "Syncing markdown files...
        Updated files:
          README.md"
      `);

      const updatedMarkdown = readFileSync(path.join(project.baseDir, 'README.md'), 'utf-8');
      expect(updatedMarkdown).toContain('const js = "file";');
      expect(updatedMarkdown).toContain('const ts: string = "file";');
    });

    it('uses default values when no config or flags provided', async () => {
      const sourceContent = 'const defaultTest = true;';
      
      const markdownContent = `# Test

\`\`\`js snippet=example.js
old content
\`\`\``;

      await project.write({
        'example.js': sourceContent,
        'README.md': markdownContent,
      });

      const result = await runBin();

      expect(result.exitCode).toEqual(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toMatchInlineSnapshot(`
        "Syncing markdown files...
        Updated files:
          README.md"
      `);

      const updatedMarkdown = readFileSync(path.join(project.baseDir, 'README.md'), 'utf-8');
      expect(updatedMarkdown).toContain('const defaultTest = true;');
    });
  });

  describe('error handling', () => {
    it('handles file system errors gracefully', async () => {
      const markdownContent = `# Test

\`\`\`js snippet=../../../etc/passwd
malicious content
\`\`\``;

      await project.write({
        'README.md': markdownContent,
      });

      const result = await runBin();

      expect(result.exitCode).toEqual(1);
      expect(result.stderr).toContain('Errors:');
    });

    it('handles malformed config gracefully', async () => {
      await project.write({
        'bad.json': 'invalid json{',
      });

      const result = await runBin('--config', 'bad.json');

      expect(result.exitCode).toEqual(1);
      expect(result.stderr).toContain('Failed to load config from bad.json');
    });

    it('handles no markdown files gracefully', async () => {
      const result = await runBin();

      expect(result.exitCode).toEqual(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('All files are already in sync.');
    });
  });

  describe('complex scenarios', () => {
    it('handles multiple files with mixed results', async () => {
      const scenario = loadScenario('multi-file-mixed');

      const inSyncMarkdown = `# Test 2

\`\`\`js snippet=file2.js
${scenario.sources['file2.js']}
\`\`\``;

      await project.write({
        'file1.js': scenario.sources['file1.js'],
        'file2.js': scenario.sources['file2.js'],
        'doc1.md': scenario.input,
        'doc2.md': inSyncMarkdown,
        'doc3.md': scenario.input,
      });

      const result = await runBin();

      expect(result.exitCode).toEqual(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toMatchInlineSnapshot(`
        "Syncing markdown files...
        Warnings:
          Snippet file not found: missing.js
          Snippet file not found: missing.js
        Updated files:
          doc1.md
          doc3.md"
      `);
      expect(result.stdout).not.toContain('doc2.md');
    });

    it('handles nested directory structure', async () => {
      const sourceContent = 'export const helper = () => {};';
      
      const markdownContent = `# Test

\`\`\`ts snippet=src/utils/helper.ts
old content
\`\`\``;

      await project.write({
        'src': {
          'utils': {
            'helper.ts': sourceContent,
          },
        },
        'README.md': markdownContent,
      });

      const result = await runBin();

      expect(result.exitCode).toEqual(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Updated files:');

      const updatedMarkdown = readFileSync(path.join(project.baseDir, 'README.md'), 'utf-8');
      expect(updatedMarkdown).toContain('export const helper = () => {};');
    });

    it('handles multiple snippets with mixed languages and line ranges', async () => {
      const scenario = loadScenario('multiple-snippets-mixed');

      await project.write({
        'utils.js': scenario.sources['utils.js'],
        'config.json': scenario.sources['config.json'],
        'server.py': scenario.sources['server.py'],
        'README.md': scenario.input,
      });

      const result = await runBin();

      expect(result.exitCode).toEqual(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toMatchInlineSnapshot(`
        "Syncing markdown files...
        Warnings:
          Snippet file not found: nonexistent.js
        Updated files:
          README.md"
      `);

      const updatedMarkdown = readFileSync(path.join(project.baseDir, 'README.md'), 'utf-8');
      
      expect(updatedMarkdown).toMatchInlineSnapshot(`
        "# Complex Multi-Snippet Example

        This document demonstrates various snippet usage patterns.

        ## JavaScript Utilities

        Here's the complete utility file:

        \`\`\`js snippet=utils.js
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
        \`\`\`

        But sometimes you only need specific functions. Here's just the add function:

        \`\`\`js snippet=utils.js#L2-L4
        function add(a, b) {
          return a + b;
        }
        \`\`\`

        And here's a single line for the error message:

        \`\`\`js snippet=utils.js#L16
            throw new Error('Division by zero');
        \`\`\`

        ## Configuration

        Our app uses this configuration:

        \`\`\`json snippet=config.json
        {
          "database": {
            "host": "localhost",
            "port": 5432,
            "name": "myapp"
          },
          "api": {
            "version": "v1",
            "timeout": 5000
          }
        } 
        \`\`\`

        But you might only need the database config:

        \`\`\`json snippet=config.json#L2-L6
          "database": {
            "host": "localhost",
            "port": 5432,
            "name": "myapp"
          },
        \`\`\`

        ## Python Server

        Here's the request handler class:

        \`\`\`python snippet=server.py#L7-L14
        class RequestHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                
                response = {'message': 'Hello, World!', 'status': 'ok'}
                self.wfile.write(json.dumps(response).encode())
        \`\`\`

        And the main function:

        \`\`\`python snippet=server.py#L16-L19
        def main():
            server = HTTPServer(('localhost', 8000), RequestHandler)
            print('Server running on http://localhost:8000')
            server.serve_forever()
        \`\`\`

        ## Mixed Content

        Sometimes we reference files that don't exist:

        \`\`\`js snippet=nonexistent.js
        // This file doesn't exist
        \`\`\`

        Or use invalid line ranges:

        \`\`\`js snippet=utils.js#L999-L1000
        // Invalid line range
        \`\`\`
        "
      `);
    });

    it('handles complex nested directory structure', async () => {
      const scenario = loadScenario('nested-complex');

      await project.write({
        'src': {
          'components': {
            'Button.tsx': scenario.sources['src/components/Button.tsx'],
          },
          'utils': {
            'api.ts': scenario.sources['src/utils/api.ts'],
          },
        },
        'README.md': scenario.input,
      });

      const result = await runBin();

      expect(result.exitCode).toEqual(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Updated files:');

      const updatedMarkdown = readFileSync(path.join(project.baseDir, 'README.md'), 'utf-8');
      
      expect(updatedMarkdown).toMatchInlineSnapshot(`
        "# Nested Directory Documentation

        This demonstrates snippets from various nested directories.

        ## Components

        ### Button Component

        Here's the interface definition:

        \`\`\`tsx snippet=src/components/Button.tsx#L3-L8
        interface ButtonProps {
          children: React.ReactNode;
          onClick?: () => void;
          variant?: 'primary' | 'secondary';
          disabled?: boolean;
        }
        \`\`\`

        And here's the main component function:

        \`\`\`tsx snippet=src/components/Button.tsx#L10-L15
        export function Button({ 
          children, 
          onClick, 
          variant = 'primary', 
          disabled = false 
        }: ButtonProps) {
        \`\`\`

        ## API Utilities

        The base URL configuration:

        \`\`\`ts snippet=src/utils/api.ts#L1
        const BASE_URL = 'https://api.example.com';
        \`\`\`

        Here's the complete fetchUser function:

        \`\`\`ts snippet=src/utils/api.ts#L3-L9
        export async function fetchUser(id: string) {
          const response = await fetch(\`\${BASE_URL}/users/\${id}\`);
          if (!response.ok) {
            throw new Error(\`Failed to fetch user: \${response.statusText}\`);
          }
          return response.json();
        }
        \`\`\`

        And just the error handling part:

        \`\`\`ts snippet=src/utils/api.ts#L5-L6
          if (!response.ok) {
            throw new Error(\`Failed to fetch user: \${response.statusText}\`);
        \`\`\`
        "
      `);
    });

    it('handles complex line range patterns', async () => {
      const scenario = loadScenario('line-ranges-complex');

      await project.write({
        'data.txt': scenario.sources['data.txt'],
        'README.md': scenario.input,
      });

      const result = await runBin();

      expect(result.exitCode).toEqual(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Updated files:');

      const updatedMarkdown = readFileSync(path.join(project.baseDir, 'README.md'), 'utf-8');
      
      expect(updatedMarkdown).toMatchInlineSnapshot(`
        "# Complex Line Range Patterns

        This demonstrates various line range patterns.

        ## Single Line

        Just the header:

        \`\`\`text snippet=data.txt#L1
        Header line
        \`\`\`

        ## Range from Start

        From line 2 to 6:

        \`\`\`text snippet=data.txt#L2-L6
        Section 1 start
          Item 1.1
          Item 1.2
          Item 1.3
        Section 1 end
        \`\`\`

        ## Single Line in Middle

        Just item 2.2:

        \`\`\`text snippet=data.txt#L9
          Item 2.2
        \`\`\`

        ## Range to End

        From line 12 to end:

        \`\`\`text snippet=data.txt#L12-
        Section 3 start
          Item 3.1
          Item 3.2
          Item 3.3
        Section 3 end
        Footer line 
        \`\`\`

        ## Large Range

        Multiple sections:

        \`\`\`text snippet=data.txt#L7-L11
        Section 2 start
          Item 2.1
          Item 2.2
          Item 2.3
        Section 2 end
        \`\`\`
        "
      `);
    });

    it('handles mixed sync states correctly', async () => {
      const scenario = loadScenario('mixed-sync-states');

      await project.write({
        'file1.js': scenario.sources['file1.js'],
        'file2.js': scenario.sources['file2.js'],
        'README.md': scenario.input,
      });

      const result = await runBin();

      expect(result.exitCode).toEqual(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toMatchInlineSnapshot(`
        "Syncing markdown files...
        Warnings:
          Snippet file not found: missing.js
        Updated files:
          README.md"
      `);

      const updatedMarkdown = readFileSync(path.join(project.baseDir, 'README.md'), 'utf-8');
      
      expect(updatedMarkdown).toMatchInlineSnapshot(`
        "# Mixed Sync States

        Some snippets are in sync, others are not.

        ## Out of Sync

        \`\`\`js snippet=file1.js
        const updated = "new content"; 
        \`\`\`

        ## In Sync

        \`\`\`js snippet=file2.js
        const inSync = "already correct"; 
        \`\`\`

        ## Missing File

        \`\`\`js snippet=missing.js
        const missing = 'file';
        \`\`\`
        "
      `);
      expect(updatedMarkdown).not.toContain('const updated = "old content";');
    });
  });
}); 