import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Project } from 'fixturify-project';
import { syncMarkdownFiles, checkMarkdownFiles } from '../src/sync.js';
import type { RuntimeConfig } from '../src/types.js';

describe('integration tests', () => {
  let project: Project;
  let config: RuntimeConfig;

  beforeEach(() => {
    project = new Project();
    config = {
      snippetRoot: '.',
      markdownGlob: '*.md',
      includeExtensions: ['.ts', '.js', '.py', '.json'],
      excludeGlob: ['node_modules/**', 'test/**'],
      workingDir: project.baseDir,
    };
  });

  afterEach(() => {
    project.dispose();
  });

  describe('full sync workflow', () => {
    it('should sync simple snippet', async () => {
      const sourceContent = `export function hello() {
  return "Hello, World!";
}`;

      const markdownContent = `# Test

\`\`\`ts snippet=hello.ts
old content
\`\`\``;

      await project.write({
        'hello.ts': sourceContent,
        'README.md': markdownContent,
      });

      const result = await syncMarkdownFiles(config);

      expect(result.updated).toHaveLength(1);
      expect(result.updated[0]).toContain('README.md');
      expect(result.errors).toHaveLength(0);

      const updatedMarkdown = readFileSync(
        join(project.baseDir, 'README.md'),
        'utf-8',
      );
      expect(updatedMarkdown).toMatchInlineSnapshot(`
        "# Test

        \`\`\`ts snippet=hello.ts
        export function hello() {
          return "Hello, World!";
        }
        \`\`\`"
      `);
    });

    it('should sync with line ranges', async () => {
      const sourceContent = `line 1
line 2
line 3
line 4
line 5`;

      const markdownContent = `# Test

\`\`\`text snippet=lines.txt#L2-L4
old content
\`\`\``;

      await project.write({
        'lines.txt': sourceContent,
        'README.md': markdownContent,
      });

      const result = await syncMarkdownFiles(config);

      expect(result.updated).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const updatedMarkdown = readFileSync(
        join(project.baseDir, 'README.md'),
        'utf-8',
      );
      expect(updatedMarkdown).toMatchInlineSnapshot(`
        "# Test

        \`\`\`text snippet=lines.txt#L2-L4
        line 2
        line 3
        line 4
        \`\`\`"
      `);
    });

    it('should sync single line', async () => {
      const sourceContent = `const value1 = 1;
const value2 = 2;
const value3 = 3;`;

      const markdownContent = `# Test

\`\`\`js snippet=values.js#L2
old content
\`\`\``;

      await project.write({
        'values.js': sourceContent,
        'README.md': markdownContent,
      });

      const result = await syncMarkdownFiles(config);

      expect(result.updated).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const updatedMarkdown = readFileSync(
        join(project.baseDir, 'README.md'),
        'utf-8',
      );
      expect(updatedMarkdown).toMatchInlineSnapshot(`
        "# Test

        \`\`\`js snippet=values.js#L2
        const value2 = 2;
        \`\`\`"
      `);
    });

    it('should handle multiple snippets in one file', async () => {
      const sourceContent1 = 'function one() {}';
      const sourceContent2 = 'function two() {}';

      const markdownContent = `# Test

\`\`\`js snippet=one.js
old one
\`\`\`

\`\`\`js snippet=two.js
old two
\`\`\``;

      await project.write({
        'one.js': sourceContent1,
        'two.js': sourceContent2,
        'README.md': markdownContent,
      });

      const result = await syncMarkdownFiles(config);

      expect(result.updated).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const updatedMarkdown = readFileSync(
        join(project.baseDir, 'README.md'),
        'utf-8',
      );
      expect(updatedMarkdown).toMatchInlineSnapshot(`
        "# Test

        \`\`\`js snippet=one.js
        function one() {}
        \`\`\`

        \`\`\`js snippet=two.js
        function two() {}
        \`\`\`"
      `);
    });

    it('should handle nested directories', async () => {
      const sourceContent = 'export const helper = () => {};';

      const markdownContent = `# Test

\`\`\`ts snippet=src/utils/helper.ts
old content
\`\`\``;

      await project.write({
        src: {
          utils: {
            'helper.ts': sourceContent,
          },
        },
        'README.md': markdownContent,
      });

      const result = await syncMarkdownFiles(config);

      expect(result.updated).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const updatedMarkdown = readFileSync(
        join(project.baseDir, 'README.md'),
        'utf-8',
      );
      expect(updatedMarkdown).toMatchInlineSnapshot(`
        "# Test

        \`\`\`ts snippet=src/utils/helper.ts
        export const helper = () => {};
        \`\`\`"
      `);
    });

    it('should warn about missing files', async () => {
      const markdownContent = `# Test

\`\`\`js snippet=missing.js
old content
\`\`\``;

      await project.write({
        'README.md': markdownContent,
      });

      const result = await syncMarkdownFiles(config);

      expect(result.updated).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.fileIssues).toMatchObject([
        {
          filePath: expect.stringContaining('README.md'),
          issues: [
            {
              column: 1,
              line: 3,
              message: expect.stringContaining('Snippet file not found'),
              ruleId: 'snippet-not-found',
              type: 'file-missing',
            },
          ],
        },
      ]);

      const markdownAfter = readFileSync(
        join(project.baseDir, 'README.md'),
        'utf-8',
      );
      expect(markdownAfter).toContain('old content');
    });

    it('should preserve already synced content', async () => {
      const sourceContent = 'const synced = true;';

      const markdownContent = `# Test

\`\`\`js snippet=synced.js
const synced = true;
\`\`\``;

      await project.write({
        'synced.js': sourceContent,
        'README.md': markdownContent,
      });

      const result = await syncMarkdownFiles(config);

      expect(result.updated).toHaveLength(0);
      expect(result.errors).toHaveLength(0);

      const markdownAfter = readFileSync(
        join(project.baseDir, 'README.md'),
        'utf-8',
      );
      expect(markdownAfter).toBe(markdownContent);
    });
  });

  describe('check functionality', () => {
    it('should detect out-of-sync content', async () => {
      const sourceContent = 'const updated = true;';
      const markdownContent = `# Test

\`\`\`js snippet=test.js
const old = true;
\`\`\``;

      await project.write({
        'test.js': sourceContent,
        'README.md': markdownContent,
      });

      const result = await checkMarkdownFiles(config);

      expect(result.outOfSync).toHaveLength(1);
      expect(result.outOfSync[0]).toContain('README.md');
      expect(result.errors).toHaveLength(0);
    });

    it('should pass for in-sync content', async () => {
      const sourceContent = 'const synced = true;';
      const markdownContent = `# Test

\`\`\`js snippet=test.js
const synced = true;
\`\`\``;

      await project.write({
        'test.js': sourceContent,
        'README.md': markdownContent,
      });

      const result = await checkMarkdownFiles(config);

      expect(result.outOfSync).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle line range checks', async () => {
      const sourceContent = `line 1
line 2
line 3
line 4`;

      const markdownContent = `# Test

\`\`\`text snippet=lines.txt#L2-L3
wrong content
\`\`\``;

      await project.write({
        'lines.txt': sourceContent,
        'README.md': markdownContent,
      });

      const result = await checkMarkdownFiles(config);

      expect(result.outOfSync).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle multiple files', async () => {
      const source1 = 'const file1 = true;';
      const source2 = 'const file2 = true;';

      const markdown1 = `# File 1

\`\`\`js snippet=file1.js
const file1 = true;
\`\`\``;

      const markdown2 = `# File 2

\`\`\`js snippet=file2.js
const file2 = false;
\`\`\``;

      await project.write({
        'file1.js': source1,
        'file2.js': source2,
        'doc1.md': markdown1,
        'doc2.md': markdown2,
      });

      const result = await checkMarkdownFiles(config);

      expect(result.outOfSync).toHaveLength(1);
      expect(result.outOfSync[0]).toContain('doc2.md');
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('complex scenarios', () => {
    it('should handle mixed sync states', async () => {
      const source1 = 'const synced = true;';
      const source2 = 'const updated = true;';

      const markdownContent = `# Mixed

\`\`\`js snippet=synced.js
const synced = true;
\`\`\`

\`\`\`js snippet=updated.js
const old = true;
\`\`\``;

      await project.write({
        'synced.js': source1,
        'updated.js': source2,
        'README.md': markdownContent,
      });

      const result = await syncMarkdownFiles(config);

      expect(result.updated).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const updatedMarkdown = readFileSync(
        join(project.baseDir, 'README.md'),
        'utf-8',
      );
      expect(updatedMarkdown).toContain('const synced = true;');
      expect(updatedMarkdown).toContain('const updated = true;');
    });

    it('should handle complex directory structures', async () => {
      const componentContent = `export function Button() {
  return <button>Click me</button>;
}`;

      const utilContent = `export function apiCall() {
  return fetch('/api');
}`;

      const markdownContent = `# Complex

\`\`\`tsx snippet=src/components/Button.tsx
old button
\`\`\`

\`\`\`ts snippet=src/utils/api.ts
old api
\`\`\``;

      await project.write({
        src: {
          components: {
            'Button.tsx': componentContent,
          },
          utils: {
            'api.ts': utilContent,
          },
        },
        docs: {
          'README.md': markdownContent,
        },
      });

      config.markdownGlob = '**/*.md';
      const result = await syncMarkdownFiles(config);

      expect(result.updated).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const updatedMarkdown = readFileSync(
        join(project.baseDir, 'docs', 'README.md'),
        'utf-8',
      );
      expect(updatedMarkdown).toContain('export function Button()');
      expect(updatedMarkdown).toContain('export function apiCall()');
    });

    it('should handle non-existent snippet files gracefully', async () => {
      const markdownContent = `# Test

\`\`\`js snippet=missing.js
old content
\`\`\`

\`\`\`js snippet=exists.js
old content
\`\`\``;

      await project.write({
        'exists.js': 'const exists = true;',
        'README.md': markdownContent,
      });

      const result = await syncMarkdownFiles(config);

      expect(result.updated).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.fileIssues).toHaveLength(1);

      const updatedMarkdown = readFileSync(
        join(project.baseDir, 'README.md'),
        'utf-8',
      );
      expect(updatedMarkdown).toContain('const exists = true;');
      expect(updatedMarkdown).toContain('old content');
    });
  });

  describe('mixed snippet sources', () => {
    it('should resolve snippets from project root when not in snippetRoot', async () => {
      const sourceContent = `export function hello() {
  return "Hello from source!";
}`;

      const extractedContent = `export function extracted() {
  return "Hello from extracted!";
}`;

      const markdownContent = `# Mixed Sources Test

## Source file reference
\`\`\`ts snippet=src/utils/helper.ts
old content
\`\`\`

## Extracted snippet reference
\`\`\`ts snippet=snippets/extracted-example.ts
old content
\`\`\``;

      await project.write({
        src: {
          utils: {
            'helper.ts': sourceContent,
          },
        },
        snippets: {
          'extracted-example.ts': extractedContent,
        },
        'README.md': markdownContent,
      });

      config.snippetRoot = 'snippets';
      const result = await syncMarkdownFiles(config);

      expect(result.updated).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.fileIssues).toHaveLength(0);

      const updatedMarkdown = readFileSync(
        join(project.baseDir, 'README.md'),
        'utf-8',
      );

      expect(updatedMarkdown).toContain('Hello from source!');
      expect(updatedMarkdown).toContain('Hello from extracted!');
    });

    it('should prioritize project root files over snippetRoot files', async () => {
      const projectFileContent = `console.log("From project root");`;
      const snippetFileContent = `console.log("From snippet root");`;

      const markdownContent = `# Priority Test

\`\`\`js snippet=same-name.js
old content
\`\`\``;

      await project.write({
        'same-name.js': projectFileContent,
        snippets: {
          'same-name.js': snippetFileContent,
        },
        'README.md': markdownContent,
      });

      config.snippetRoot = 'snippets';
      const result = await syncMarkdownFiles(config);

      expect(result.updated).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const updatedMarkdown = readFileSync(
        join(project.baseDir, 'README.md'),
        'utf-8',
      );

      expect(updatedMarkdown).toContain('From project root');
      expect(updatedMarkdown).not.toContain('From snippet root');
    });

    it('should handle relative paths from markdown file location', async () => {
      const helperContent = `export const helper = () => "Helper";`;
      const utilContent = `export const util = () => "Util";`;

      const markdownContent = `# Relative Paths Test

## Relative to markdown file
\`\`\`ts snippet=../src/helper.ts
old content
\`\`\`

## Another relative path
\`\`\`ts snippet=./utils/util.ts
old content
\`\`\``;

      await project.write({
        src: {
          'helper.ts': helperContent,
        },
        docs: {
          utils: {
            'util.ts': utilContent,
          },
          'guide.md': markdownContent,
        },
      });

      config.snippetRoot = 'snippets';
      config.markdownGlob = '**/*.md';
      const result = await syncMarkdownFiles(config);

      expect(result.updated).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.fileIssues).toHaveLength(0);

      const updatedMarkdown = readFileSync(
        join(project.baseDir, 'docs/guide.md'),
        'utf-8',
      );

      expect(updatedMarkdown).toContain('Helper');
      expect(updatedMarkdown).toContain('Util');
    });

    it('should fall back to snippetRoot when file not found at project root', async () => {
      const snippetContent = `console.log("Only in snippets");`;

      const markdownContent = `# Fallback Test

\`\`\`js snippet=only-in-snippets.js
old content
\`\`\``;

      await project.write({
        snippets: {
          'only-in-snippets.js': snippetContent,
        },
        'README.md': markdownContent,
      });

      config.snippetRoot = 'snippets';
      const result = await syncMarkdownFiles(config);

      expect(result.updated).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const updatedMarkdown = readFileSync(
        join(project.baseDir, 'README.md'),
        'utf-8',
      );

      expect(updatedMarkdown).toContain('Only in snippets');
    });
  });
});
