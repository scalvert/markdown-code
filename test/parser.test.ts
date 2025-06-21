import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { extractLines, parseMarkdownFile, loadSnippetContent, replaceCodeBlock, trimBlankLines } from '../src/parser.js';

describe('parser', () => {
  const testDir = './test-temp';

  beforeEach(() => {
    try {
      rmSync(testDir, { recursive: true });
    } catch {}
    mkdirSync(testDir, { recursive: true });
  });

  describe('extractLines', () => {
    const testContent = `line 1
line 2
line 3
line 4
line 5`;

    it('should return full content when no line numbers specified', () => {
      const result = extractLines(testContent);
      expect(result).toBe(testContent);
    });

    it('should extract specific line range', () => {
      const result = extractLines(testContent, 2, 4);
      expect(result).toBe('line 2\nline 3\nline 4');
    });

    it('should extract from start line to end', () => {
      const result = extractLines(testContent, 3);
      expect(result).toBe('line 3\nline 4\nline 5');
    });

    it('should handle single line extraction', () => {
      const result = extractLines(testContent, 2, 2);
      expect(result).toBe('line 2');
    });

    it('should handle first line extraction', () => {
      const result = extractLines(testContent, 1, 1);
      expect(result).toBe('line 1');
    });

    it('should handle last line extraction', () => {
      const result = extractLines(testContent, 5, 5);
      expect(result).toBe('line 5');
    });

    it('should handle line range beyond content length', () => {
      const result = extractLines(testContent, 3, 10);
      expect(result).toBe('line 3\nline 4\nline 5');
    });

    it('should handle start line beyond content length', () => {
      const result = extractLines(testContent, 10);
      expect(result).toBe('');
    });
  });

  describe('parseMarkdownFile', () => {
    it('should parse markdown file with snippet directive', () => {
      const markdownContent = `# Test

Here's some code:

\`\`\`ts snippet=test.ts
old content
\`\`\`

More text here.`;

      const filePath = join(testDir, 'test.md');
      writeFileSync(filePath, markdownContent);

      const result = parseMarkdownFile(filePath);

      expect(result.filePath).toBe(filePath);
      expect(result.content).toBe(markdownContent);
      expect(result.codeBlocks).toHaveLength(1);
      expect(result.codeBlocks[0]).toMatchInlineSnapshot(`
        {
          "columnNumber": 1,
          "content": "old content",
          "language": "ts",
          "lineNumber": 5,
          "position": {
            "end": 64,
            "start": 27,
          },
          "snippet": {
            "filePath": "test.ts",
          },
        }
      `);
    });

    it('should parse snippet directive with line range', () => {
      const markdownContent = `\`\`\`js snippet=utils.js#L5-L10
old content
\`\`\``;

      const filePath = join(testDir, 'test.md');
      writeFileSync(filePath, markdownContent);

      const result = parseMarkdownFile(filePath);

      expect(result.codeBlocks[0].snippet).toMatchInlineSnapshot(`
        {
          "endLine": 10,
          "filePath": "utils.js",
          "startLine": 5,
        }
      `);
    });

    it('should parse snippet directive with single line', () => {
      const markdownContent = `\`\`\`py snippet=main.py#L15
old content
\`\`\``;

      const filePath = join(testDir, 'test.md');
      writeFileSync(filePath, markdownContent);

      const result = parseMarkdownFile(filePath);

      expect(result.codeBlocks[0].snippet).toMatchInlineSnapshot(`
        {
          "endLine": 15,
          "filePath": "main.py",
          "startLine": 15,
        }
      `);
    });

    it('should parse snippet directive with start line only', () => {
      const markdownContent = `\`\`\`cpp snippet=main.cpp#L20-
old content
\`\`\``;

      const filePath = join(testDir, 'test.md');
      writeFileSync(filePath, markdownContent);

      const result = parseMarkdownFile(filePath);

      expect(result.codeBlocks[0].snippet).toMatchInlineSnapshot(`
        {
          "filePath": "main.cpp",
          "startLine": 20,
        }
      `);
    });

    it('should ignore code blocks without snippet directive', () => {
      const markdownContent = `\`\`\`ts
regular code block
\`\`\`

\`\`\`js snippet=test.js
snippet block
\`\`\``;

      const filePath = join(testDir, 'test.md');
      writeFileSync(filePath, markdownContent);

      const result = parseMarkdownFile(filePath);

      expect(result.codeBlocks).toHaveLength(1);
      expect(result.codeBlocks[0].snippet?.filePath).toBe('test.js');
    });

    it('should ignore code blocks without language', () => {
      const markdownContent = `\`\`\` snippet=test.js
no language
\`\`\``;

      const filePath = join(testDir, 'test.md');
      writeFileSync(filePath, markdownContent);

      const result = parseMarkdownFile(filePath);

      expect(result.codeBlocks).toHaveLength(0);
    });

    it('should handle multiple snippet blocks', () => {
      const markdownContent = `\`\`\`ts snippet=file1.ts
content 1
\`\`\`

\`\`\`js snippet=file2.js#L1-L5
content 2
\`\`\`

\`\`\`py snippet=file3.py#L10
content 3
\`\`\``;

      const filePath = join(testDir, 'test.md');
      writeFileSync(filePath, markdownContent);

      const result = parseMarkdownFile(filePath);

      expect(result.codeBlocks).toHaveLength(3);
      expect(result.codeBlocks[0].snippet?.filePath).toBe('file1.ts');
      expect(result.codeBlocks[1].snippet?.filePath).toBe('file2.js');
      expect(result.codeBlocks[2].snippet?.filePath).toBe('file3.py');
    });

    it('should handle complex file paths', () => {
      const markdownContent = `\`\`\`ts snippet=src/components/Button.tsx#L15-L25
button content
\`\`\``;

      const filePath = join(testDir, 'test.md');
      writeFileSync(filePath, markdownContent);

      const result = parseMarkdownFile(filePath);

      expect(result.codeBlocks[0].snippet).toEqual({
        filePath: 'src/components/Button.tsx',
        startLine: 15,
        endLine: 25,
      });
    });
  });

  describe('loadSnippetContent', () => {
    it('should load content from file', () => {
      const content = 'export const test = "hello";';
      const filePath = join(testDir, 'test.ts');
      writeFileSync(filePath, content);

      const result = loadSnippetContent('test.ts', testDir);

      expect(result).toBe(content);
    });

    it('should handle nested paths', () => {
      const content = 'nested file content';
      const nestedDir = join(testDir, 'nested');
      mkdirSync(nestedDir);
      const filePath = join(nestedDir, 'file.js');
      writeFileSync(filePath, content);

      const result = loadSnippetContent('nested/file.js', testDir);

      expect(result).toBe(content);
    });
  });

  describe('replaceCodeBlock', () => {
    it('should replace code block content', () => {
      const markdownContent = `# Title

\`\`\`ts snippet=test.ts
old content
\`\`\`

End text.`;

      const codeBlock = {
        language: 'ts',
        content: 'old content',
        snippet: { filePath: 'test.ts' },
        position: { start: 0, end: 0 },
      };

      const newContent = 'new content line 1\nnew content line 2';

      const result = replaceCodeBlock(markdownContent, codeBlock, newContent);

      expect(result).toContain('```ts snippet=test.ts');
      expect(result).toContain('new content line 1');
      expect(result).toContain('new content line 2');
      expect(result).not.toContain('old content');
    });

    it('should handle multiline replacements', () => {
      const markdownContent = `\`\`\`js snippet=utils.js
function old() {
  return "old";
}
\`\`\``;

      const codeBlock = {
        language: 'js',
        content: 'function old() {\n  return "old";\n}',
        snippet: { filePath: 'utils.js' },
        position: { start: 0, end: 0 },
      };

      const newContent = `function updated() {
  const value = "new";
  return value;
}`;

      const result = replaceCodeBlock(markdownContent, codeBlock, newContent);

      expect(result).toContain('function updated()');
      expect(result).toContain('const value = "new"');
      expect(result).not.toContain('function old()');
    });

    it('should preserve surrounding content', () => {
      const markdownContent = `# Before

Some text before.

\`\`\`ts snippet=test.ts
old
\`\`\`

Some text after.

## After`;

      const codeBlock = {
        language: 'ts',
        content: 'old',
        snippet: { filePath: 'test.ts' },
        position: { start: 0, end: 0 },
      };

      const result = replaceCodeBlock(markdownContent, codeBlock, 'new');

      expect(result).toContain('# Before');
      expect(result).toContain('Some text before.');
      expect(result).toContain('Some text after.');
      expect(result).toContain('## After');
      expect(result).toContain('new');
      expect(result).not.toContain('old');
    });
  });

  describe('trimBlankLines', () => {
    it('removes leading blank lines', () => {
      const content = '\n\n\nconsole.log("hello");';
      const result = trimBlankLines(content);
      expect(result).toBe('console.log("hello");');
    });

    it('removes trailing blank lines', () => {
      const content = 'console.log("hello");\n\n\n';
      const result = trimBlankLines(content);
      expect(result).toBe('console.log("hello");');
    });

    it('removes both leading and trailing blank lines', () => {
      const content = '\n\n\nconsole.log("hello");\nconsole.log("world");\n\n\n';
      const result = trimBlankLines(content);
      expect(result).toBe('console.log("hello");\nconsole.log("world");');
    });

    it('preserves blank lines in the middle', () => {
      const content = 'function test() {\n\n  return true;\n}';
      const result = trimBlankLines(content);
      expect(result).toBe('function test() {\n\n  return true;\n}');
    });

    it('handles content with only blank lines', () => {
      const content = '\n\n\n';
      const result = trimBlankLines(content);
      expect(result).toBe('');
    });

    it('handles content with only whitespace lines', () => {
      const content = '   \n\t\n  \n';
      const result = trimBlankLines(content);
      expect(result).toBe('');
    });

    it('handles empty string', () => {
      const content = '';
      const result = trimBlankLines(content);
      expect(result).toBe('');
    });

    it('handles single line with no blank lines', () => {
      const content = 'const x = 1;';
      const result = trimBlankLines(content);
      expect(result).toBe('const x = 1;');
    });

    it('handles content with mixed whitespace', () => {
      const content = '\n  \n\nconst x = 1;\nconst y = 2;\n\t\n  \n';
      const result = trimBlankLines(content);
      expect(result).toBe('const x = 1;\nconst y = 2;');
    });
  });

  describe('extractLines with trimming', () => {
    const testContent = '\n\nfunction test() {\n  return "hello";\n}\n\n';

    it('trims blank lines when extracting whole file', () => {
      const result = extractLines(testContent);
      expect(result).toBe('function test() {\n  return "hello";\n}');
    });

    it('trims blank lines when extracting line ranges', () => {
      const contentWithBlanks = '\n\nline 1\nline 2\nline 3\n\n';
      const result = extractLines(contentWithBlanks, 2, 4);
      expect(result).toBe('line 1\nline 2');
    });

    it('trims blank lines when extracting from start line', () => {
      const contentWithBlanks = 'line 1\nline 2\n\n\nline 5\n\n';
      const result = extractLines(contentWithBlanks, 3);
      expect(result).toBe('line 5');
    });

    it('handles extracted content that is all blank lines', () => {
      const contentWithBlanks = 'line 1\n\n\n\nline 5';
      const result = extractLines(contentWithBlanks, 2, 4);
      expect(result).toBe('');
    });
  });
}); 