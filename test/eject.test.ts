import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Project } from 'fixturify-project';
import { extractSnippets } from '../src/sync.js';
import type { Config } from '../src/types.js';

// Test individual functions without readline interaction
describe('eject command functionality', () => {
  let project: Project;
  let testDir: string;
  let snippetRoot: string;
  let baseConfig: Config;

  beforeEach(() => {
    project = new Project();
    testDir = project.baseDir;
    snippetRoot = join(testDir, 'snippets');
    baseConfig = {
      snippetRoot,
      markdownGlob: join(testDir, '**/*.md'),
      excludeGlob: [],
      includeExtensions: ['.ts', '.js', '.py'],
    };
  });

  afterEach(() => {
    project.dispose();
  });

  describe('snippet directive removal', () => {
    it('should remove snippet directives from markdown files', async () => {
      const markdownWithDirectives = `# Test Project

## JavaScript Example

\`\`\`javascript snippet=example/snippet-01.js
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

## TypeScript Example

\`\`\`typescript snippet=example/snippet-02.ts
interface User {
  name: string;
  age: number;
}
\`\`\`

## Regular Code Block

\`\`\`javascript
console.log("no snippet directive");
\`\`\``;

      await project.write({
        'README.md': markdownWithDirectives,
      });

      // Manually import the internal function for testing
      const { parseMarkdownFile } = await import('../src/parser.js');
      const fg = await import('fast-glob');

      // Test the core removal logic
      const markdownFiles = await fg.default(baseConfig.markdownGlob);
      const filePath = markdownFiles[0];
      const markdownFile = await parseMarkdownFile(filePath);
      const codeBlocksWithSnippets = markdownFile.codeBlocks.filter(
        (cb) => cb.snippet,
      );

      expect(codeBlocksWithSnippets).toHaveLength(2);

      let updatedContent = markdownFile.content;
      let hasChanges = false;

      for (const codeBlock of codeBlocksWithSnippets) {
        const originalHeader = `\`\`\`${codeBlock.language} snippet=${
          codeBlock.snippet!.filePath
        }`;
        const newHeader = `\`\`\`${codeBlock.language}`;

        if (updatedContent.includes(originalHeader)) {
          updatedContent = updatedContent.replace(originalHeader, newHeader);
          hasChanges = true;
        }
      }

      expect(hasChanges).toBe(true);
      expect(updatedContent).not.toContain('snippet=');
      expect(updatedContent).toMatchInlineSnapshot(`
        "# Test Project

        ## JavaScript Example

        \`\`\`javascript
        function greet(name) {
          return \`Hello, \${name}!\`;
        }
        \`\`\`

        ## TypeScript Example

        \`\`\`typescript
        interface User {
          name: string;
          age: number;
        }
        \`\`\`

        ## Regular Code Block

        \`\`\`javascript
        console.log("no snippet directive");
        \`\`\`"
      `);
    });

    it('should handle markdown files with no snippet directives', async () => {
      const markdownWithoutDirectives = `# Test

\`\`\`javascript
console.log("no directives");
\`\`\``;

      await project.write({
        'README.md': markdownWithoutDirectives,
      });

      const { parseMarkdownFile } = await import('../src/parser.js');
      const fg = await import('fast-glob');

      const markdownFiles = await fg.default(baseConfig.markdownGlob);
      const filePath = markdownFiles[0];
      const markdownFile = await parseMarkdownFile(filePath);
      const codeBlocksWithSnippets = markdownFile.codeBlocks.filter(
        (cb) => cb.snippet,
      );

      expect(codeBlocksWithSnippets).toHaveLength(0);
    });

    it('should handle multiple files with snippet directives', async () => {
      const readme = `# README

\`\`\`javascript snippet=shared/utils.js
function helper() {}
\`\`\``;

      const docs = `# Documentation

\`\`\`typescript snippet=shared/types.ts
interface Config {}
\`\`\``;

      await project.write({
        'README.md': readme,
        'docs.md': docs,
      });

      const { parseMarkdownFile } = await import('../src/parser.js');
      const fg = await import('fast-glob');

      const markdownFiles = await fg.default(baseConfig.markdownGlob);
      expect(markdownFiles).toHaveLength(2);

      for (const filePath of markdownFiles) {
        const markdownFile = await parseMarkdownFile(filePath);
        const codeBlocksWithSnippets = markdownFile.codeBlocks.filter(
          (cb) => cb.snippet,
        );
        expect(codeBlocksWithSnippets).toHaveLength(1);
      }
    });

    it('should handle complex snippet directives with line ranges', async () => {
      const markdownWithRanges = `# Test

\`\`\`javascript snippet=example/snippet-01.js#L1-L5
console.log("test");
\`\`\`

\`\`\`typescript snippet=example/snippet-02.ts#L10
interface Test {}
\`\`\``;

      await project.write({
        'README.md': markdownWithRanges,
      });

      const { parseMarkdownFile } = await import('../src/parser.js');
      const fg = await import('fast-glob');

      const markdownFiles = await fg.default(baseConfig.markdownGlob);
      const filePath = markdownFiles[0];
      const markdownFile = await parseMarkdownFile(filePath);

      // The parser should handle line ranges correctly
      const codeBlocksWithSnippets = markdownFile.codeBlocks.filter(
        (cb) => cb.snippet,
      );

      expect(codeBlocksWithSnippets).toHaveLength(2);
      expect(codeBlocksWithSnippets[0].snippet?.filePath).toBe(
        'example/snippet-01.js',
      );
      expect(codeBlocksWithSnippets[1].snippet?.filePath).toBe(
        'example/snippet-02.ts',
      );
    });

    it('should preserve code block content exactly', async () => {
      const markdownWithSpecialChars = `# Test

\`\`\`javascript snippet=test.js
function test() {
  const str = "Hello \\"World\\"";
  const template = \`Template \${str}\`;
  return { str, template };
}
\`\`\``;

      await project.write({
        'README.md': markdownWithSpecialChars,
      });

      const { parseMarkdownFile } = await import('../src/parser.js');
      const fg = await import('fast-glob');

      const markdownFiles = await fg.default(baseConfig.markdownGlob);
      const filePath = markdownFiles[0];
      const markdownFile = await parseMarkdownFile(filePath);
      const codeBlocksWithSnippets = markdownFile.codeBlocks.filter(
        (cb) => cb.snippet,
      );

      expect(codeBlocksWithSnippets).toHaveLength(1);

      let updatedContent = markdownFile.content;
      for (const codeBlock of codeBlocksWithSnippets) {
        const originalHeader = `\`\`\`${codeBlock.language} snippet=${
          codeBlock.snippet!.filePath
        }`;
        const newHeader = `\`\`\`${codeBlock.language}`;
        updatedContent = updatedContent.replace(originalHeader, newHeader);
      }

      expect(updatedContent).toMatchInlineSnapshot(`
        "# Test

        \`\`\`javascript
        function test() {
          const str = "Hello \\"World\\"";
          const template = \`Template \${str}\`;
          return { str, template };
        }
        \`\`\`"
      `);
      expect(updatedContent).not.toContain('snippet=');
    });
  });

  describe('complete workflow simulation', () => {
    it('should reverse the init --extract workflow', async () => {
      const originalMarkdown = `# Test Project

## JavaScript Example

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet("World"));
\`\`\`

## TypeScript Example

\`\`\`typescript
interface User {
  name: string;
  age: number;
}

function createUser(name: string, age: number): User {
  return { name, age };
}
\`\`\``;

      const configContent = JSON.stringify(baseConfig, null, 2);

      await project.write({
        'README.md': originalMarkdown,
        '.markdown-coderc.json': configContent,
      });

      // Step 1: Run extract to create snippets and directives
      const extractResult = await extractSnippets(baseConfig);

      expect(extractResult).toMatchInlineSnapshot(`
        {
          "errors": [],
          "extracted": [
            "${testDir}/README.md",
          ],
          "snippetsCreated": 2,
          "warnings": [],
        }
      `);

      const markdownAfterExtract = readFileSync(
        join(testDir, 'README.md'),
        'utf-8',
      );
      expect(markdownAfterExtract).toContain('snippet=readme/snippet-01.js');
      expect(markdownAfterExtract).toContain('snippet=readme/snippet-02.ts');
      expect(existsSync(join(snippetRoot, 'readme'))).toBe(true);
      expect(existsSync(join(testDir, '.markdown-coderc.json'))).toBe(true);

      // Step 2: Simulate the eject process (without readline interaction)
      const { parseMarkdownFile } = await import('../src/parser.js');
      const { writeFile, rm, unlink } = await import('node:fs/promises');
      const { resolve } = await import('node:path');
      const { fileExists } = await import('../src/utils.js');
      const fg = await import('fast-glob');

      // Remove snippet directives
      const markdownFiles = await fg.default(baseConfig.markdownGlob);
      for (const filePath of markdownFiles) {
        const markdownFile = await parseMarkdownFile(filePath);
        const codeBlocksWithSnippets = markdownFile.codeBlocks.filter(
          (cb) => cb.snippet,
        );

        if (codeBlocksWithSnippets.length === 0) continue;

        let updatedContent = markdownFile.content;
        let hasChanges = false;

        for (const codeBlock of codeBlocksWithSnippets) {
          const originalHeader = `\`\`\`${codeBlock.language} snippet=${
            codeBlock.snippet!.filePath
          }`;
          const newHeader = `\`\`\`${codeBlock.language}`;

          if (updatedContent.includes(originalHeader)) {
            updatedContent = updatedContent.replace(originalHeader, newHeader);
            hasChanges = true;
          }
        }

        if (hasChanges) {
          await writeFile(filePath, updatedContent, 'utf-8');
        }
      }

      // Delete snippet directory
      const resolvedSnippetPath = resolve(snippetRoot);
      if (await fileExists(resolvedSnippetPath)) {
        await rm(resolvedSnippetPath, { recursive: true, force: true });
      }

      // Delete config file
      const configPath = resolve(join(testDir, '.markdown-coderc.json'));
      if (await fileExists(configPath)) {
        await unlink(configPath);
      }

      // Step 3: Verify the eject was successful
      const markdownAfterEject = readFileSync(
        join(testDir, 'README.md'),
        'utf-8',
      );
      expect(markdownAfterEject).toMatchInlineSnapshot(`
        "# Test Project

        ## JavaScript Example

        \`\`\`javascript
        function greet(name) {
          return \`Hello, \${name}!\`;
        }

        console.log(greet("World"));
        \`\`\`

        ## TypeScript Example

        \`\`\`typescript
        interface User {
          name: string;
          age: number;
        }

        function createUser(name: string, age: number): User {
          return { name, age };
        }
        \`\`\`"
      `);
      expect(markdownAfterEject).not.toContain('snippet=');
      expect(existsSync(join(snippetRoot))).toBe(false);
      expect(existsSync(join(testDir, '.markdown-coderc.json'))).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle missing snippet directories gracefully', async () => {
      const { fileExists } = await import('../src/utils.js');
      const nonExistentPath = join(testDir, 'does-not-exist');

      expect(await fileExists(nonExistentPath)).toBe(false);
    });

    it('should handle missing config files gracefully', async () => {
      const { configExists } = await import('../src/config.js');
      const nonExistentConfig = join(testDir, '.does-not-exist.json');

      expect(await configExists(nonExistentConfig)).toBe(false);
    });

    it('should handle multiple code blocks in one file', async () => {
      const markdownWithMultipleBlocks = `# Test

\`\`\`javascript snippet=utils.js
function helper1() {}
\`\`\`

Some text in between.

\`\`\`javascript snippet=components.js
function helper2() {}
\`\`\`

\`\`\`typescript snippet=types.ts
interface MyType {}
\`\`\``;

      await project.write({
        'README.md': markdownWithMultipleBlocks,
      });

      const { parseMarkdownFile } = await import('../src/parser.js');
      const fg = await import('fast-glob');

      const markdownFiles = await fg.default(baseConfig.markdownGlob);
      const filePath = markdownFiles[0];
      const markdownFile = await parseMarkdownFile(filePath);
      const codeBlocksWithSnippets = markdownFile.codeBlocks.filter(
        (cb) => cb.snippet,
      );

      expect(codeBlocksWithSnippets).toHaveLength(3);
      expect(codeBlocksWithSnippets[0].snippet?.filePath).toBe('utils.js');
      expect(codeBlocksWithSnippets[1].snippet?.filePath).toBe('components.js');
      expect(codeBlocksWithSnippets[2].snippet?.filePath).toBe('types.ts');

      // Test removal
      let updatedContent = markdownFile.content;
      for (const codeBlock of codeBlocksWithSnippets) {
        const originalHeader = `\`\`\`${codeBlock.language} snippet=${
          codeBlock.snippet!.filePath
        }`;
        const newHeader = `\`\`\`${codeBlock.language}`;
        updatedContent = updatedContent.replace(originalHeader, newHeader);
      }

      expect(updatedContent).toMatchInlineSnapshot(`
        "# Test

        \`\`\`javascript
        function helper1() {}
        \`\`\`

        Some text in between.

        \`\`\`javascript
        function helper2() {}
        \`\`\`

        \`\`\`typescript
        interface MyType {}
        \`\`\`"
      `);
      expect(updatedContent).not.toContain('snippet=');
    });
  });
});
