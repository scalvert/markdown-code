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
      expect(updatedMarkdown).toContain('export function hello()');
      expect(updatedMarkdown).toContain('return "Hello, World!"');
      expect(updatedMarkdown).not.toContain('old content');
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
      expect(updatedMarkdown).toContain('line 2');
      expect(updatedMarkdown).toContain('line 3');
      expect(updatedMarkdown).toContain('line 4');
      expect(updatedMarkdown).not.toContain('line 1');
      expect(updatedMarkdown).not.toContain('line 5');
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
      expect(updatedMarkdown).toContain('const value2 = 2;');
      expect(updatedMarkdown).not.toContain('const value1 = 1;');
      expect(updatedMarkdown).not.toContain('const value3 = 3;');
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
      expect(updatedMarkdown).toContain('function one() {}');
      expect(updatedMarkdown).toContain('function two() {}');
      expect(updatedMarkdown).not.toContain('old one');
      expect(updatedMarkdown).not.toContain('old two');
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
      expect(updatedMarkdown).toContain('export const helper = () => {};');
    });

    it('should warn about missing files', async () => {
      const markdownContent = `# Test

\`\`\`js snippet=missing.js
old content
\`\`\``;

      writeFileSync(join(testDir, 'README.md'), markdownContent);

      const result = await syncMarkdownFiles(config);

      expect(result.updated).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('missing.js');
      expect(result.errors).toHaveLength(0);

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

      expect(result.updated).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
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
      const sourceContent = 'const value = "test";';
      
      const markdownContent = `# Test

\`\`\`js snippet=test.js
  const value = "test";  
\`\`\``;

      writeFileSync(join(testDir, 'test.js'), sourceContent);
      writeFileSync(join(testDir, 'README.md'), markdownContent);

      const result = await checkMarkdownFiles(config);

      expect(result.inSync).toBe(false);
      expect(result.outOfSync).toHaveLength(1);
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
      expect(result.errors.length).toBeGreaterThan(0);
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