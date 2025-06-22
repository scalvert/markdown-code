import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { syncMarkdownFiles, checkMarkdownFiles } from '../src/sync.js';
import type { Config } from '../src/types.js';

describe('integration tests', () => {
  const testDir = './test-integration';
  const config: Config = {
    snippetRoot: testDir,
    markdownGlob: `${testDir}/**/*.md`,
    includeExtensions: ['.ts', '.js', '.py', '.json'],
    excludeGlob: ['node_modules/**'],
  };

  beforeEach(() => {
    try {
      rmSync(testDir, { recursive: true });
    } catch {}
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true });
    } catch {}
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

      writeFileSync(join(testDir, 'hello.ts'), sourceContent);
      writeFileSync(join(testDir, 'README.md'), markdownContent);

      const result = await syncMarkdownFiles(config);

      expect(result.updated).toHaveLength(1);
      expect(result.updated[0]).toContain('README.md');
      expect(result.errors).toHaveLength(0);

      const updatedMarkdown = readFileSync(join(testDir, 'README.md'), 'utf-8');
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

      writeFileSync(join(testDir, 'lines.txt'), sourceContent);
      writeFileSync(join(testDir, 'README.md'), markdownContent);

      const result = await syncMarkdownFiles(config);

      expect(result.updated).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const updatedMarkdown = readFileSync(join(testDir, 'README.md'), 'utf-8');
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

      writeFileSync(join(testDir, 'values.js'), sourceContent);
      writeFileSync(join(testDir, 'README.md'), markdownContent);

      const result = await syncMarkdownFiles(config);

      expect(result.updated).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const updatedMarkdown = readFileSync(join(testDir, 'README.md'), 'utf-8');
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

      writeFileSync(join(testDir, 'one.js'), sourceContent1);
      writeFileSync(join(testDir, 'two.js'), sourceContent2);
      writeFileSync(join(testDir, 'README.md'), markdownContent);

      const result = await syncMarkdownFiles(config);

      expect(result.updated).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const updatedMarkdown = readFileSync(join(testDir, 'README.md'), 'utf-8');
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
      const nestedDir = join(testDir, 'src', 'utils');
      mkdirSync(nestedDir, { recursive: true });

      const sourceContent = 'export const helper = () => {};';
      
      const markdownContent = `# Test

\`\`\`ts snippet=src/utils/helper.ts
old content
\`\`\``;

      writeFileSync(join(nestedDir, 'helper.ts'), sourceContent);
      writeFileSync(join(testDir, 'README.md'), markdownContent);

      const result = await syncMarkdownFiles(config);

      expect(result.updated).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const updatedMarkdown = readFileSync(join(testDir, 'README.md'), 'utf-8');
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

      writeFileSync(join(testDir, 'README.md'), markdownContent);

      const result = await syncMarkdownFiles(config);

      expect(result.updated).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.fileIssues).toMatchInlineSnapshot(`
        [
          {
            "filePath": "./test-integration/README.md",
            "issues": [
              {
                "column": 1,
                "line": 3,
                "message": "Snippet file not found: test-integration/missing.js",
                "ruleId": "snippet-not-found",
                "type": "file-missing",
              },
            ],
          },
        ]
      `);

      const markdownAfter = readFileSync(join(testDir, 'README.md'), 'utf-8');
      expect(markdownAfter).toContain('old content');
    });

    it('should preserve already synced content', async () => {
      const sourceContent = 'const synced = true;';
      
      const markdownContent = `# Test

\`\`\`js snippet=synced.js
const synced = true;
\`\`\``;

      writeFileSync(join(testDir, 'synced.js'), sourceContent);
      writeFileSync(join(testDir, 'README.md'), markdownContent);

      const result = await syncMarkdownFiles(config);

      expect(result).toMatchInlineSnapshot(`
        {
          "errors": [],
          "fileIssues": [],
          "updated": [],
          "warnings": [],
        }
      `);
    });
  });

  describe('check mode workflow', () => {
    it('should detect out of sync files', async () => {
      const sourceContent = 'const updated = "new";';
      
      const markdownContent = `# Test

\`\`\`js snippet=test.js
const updated = "old";
\`\`\``;

      writeFileSync(join(testDir, 'test.js'), sourceContent);
      writeFileSync(join(testDir, 'README.md'), markdownContent);

      const result = await checkMarkdownFiles(config);

      expect(result.inSync).toBe(false);
      expect(result.outOfSync).toHaveLength(1);
      expect(result.outOfSync[0]).toContain('README.md');
      expect(result.errors).toHaveLength(0);
    });

    it('should detect in sync files', async () => {
      const sourceContent = 'const value = "same";';
      
      const markdownContent = `# Test

\`\`\`js snippet=test.js
const value = "same";
\`\`\``;

      writeFileSync(join(testDir, 'test.js'), sourceContent);
      writeFileSync(join(testDir, 'README.md'), markdownContent);

      const result = await checkMarkdownFiles(config);

      expect(result.inSync).toBe(true);
      expect(result.outOfSync).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle whitespace differences', async () => {
      const sourceContent = 'const test = "value";';
      const markdownContent = `# Test

\`\`\`js snippet=test.js
const test = "different";
\`\`\``;

      writeFileSync(join(testDir, 'test.js'), sourceContent);
      writeFileSync(join(testDir, 'README.md'), markdownContent);

      const result = await checkMarkdownFiles(config);

      expect(result.inSync).toBe(false);
      expect(result.outOfSync).toHaveLength(1);
      expect(result.outOfSync[0]).toContain('README.md');
    });

    it('should handle line range check', async () => {
      const sourceContent = `line 1
line 2
line 3`;
      
      const markdownContent = `# Test

\`\`\`text snippet=lines.txt#L2-L3
line 2
line 3
\`\`\``;

      writeFileSync(join(testDir, 'lines.txt'), sourceContent);
      writeFileSync(join(testDir, 'README.md'), markdownContent);

      const result = await checkMarkdownFiles(config);

      expect(result.inSync).toBe(true);
      expect(result.outOfSync).toHaveLength(0);
    });

    it('should trim leading and trailing blank lines', async () => {
      const sourceContent = '\n\n\nconst clean = "code";\nconsole.log("test");\n\n\n';
      const markdownContent = `# Test

\`\`\`js snippet=test.js
old content
\`\`\``;

      writeFileSync(join(testDir, 'test.js'), sourceContent);
      writeFileSync(join(testDir, 'README.md'), markdownContent);

      const result = await syncMarkdownFiles(config);

      expect(result.updated).toHaveLength(1);
      expect(result.updated[0]).toContain('README.md');
      expect(result.errors).toHaveLength(0);

      const updatedContent = readFileSync(join(testDir, 'README.md'), 'utf-8');
      expect(updatedContent).toMatchInlineSnapshot(`
        "# Test

        \`\`\`js snippet=test.js
        const clean = "code";
        console.log("test");
        \`\`\`"
      `);
    });
  });

  describe('error handling', () => {
    it('should handle file read errors gracefully', async () => {
      const markdownContent = `# Test

\`\`\`js snippet=../../../etc/passwd
malicious content
\`\`\``;

      writeFileSync(join(testDir, 'README.md'), markdownContent);

      const result = await syncMarkdownFiles(config);

      expect(result.updated).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.fileIssues).toMatchInlineSnapshot(`
        [
          {
            "filePath": "./test-integration/README.md",
            "issues": [
              {
                "column": 1,
                "line": 3,
                "message": "Path traversal attempt detected: ../../../etc/passwd",
                "ruleId": "path-traversal",
                "type": "invalid-path",
              },
            ],
          },
        ]
      `);
    });

    it('should handle malformed markdown gracefully', async () => {
      const malformedMarkdown = `# Test

\`\`\`js snippet=test.js
unclosed code block`;

      const sourceContent = 'const test = true;';

      writeFileSync(join(testDir, 'test.js'), sourceContent);
      writeFileSync(join(testDir, 'malformed.md'), malformedMarkdown);

      const result = await syncMarkdownFiles(config);

      expect(result.errors).toHaveLength(0);
    });
  });
}); 