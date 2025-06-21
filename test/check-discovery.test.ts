import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { discoverCodeBlocks } from '../src/sync.js';
import { handler } from '../src/commands/check.js';

describe('discovery functionality', () => {
  const testDir = './test-discovery';

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

  it('should discover code blocks in markdown files', async () => {
    const markdownContent = `# Test

\`\`\`typescript
export function hello() {
  return "Hello, World!";
}
\`\`\`

Some text here.

\`\`\`json
{
  "name": "test",
  "version": "1.0.0"
}
\`\`\``;

    writeFileSync(join(testDir, 'README.md'), markdownContent);

    const result = await discoverCodeBlocks(`${testDir}/**/*.md`);

    expect(result.markdownFiles).toHaveLength(1);
    expect(result.totalCodeBlocks).toBe(2);
    expect(result.fileDetails[0]?.filePath).toContain('README.md');
    expect(result.fileDetails[0]?.codeBlocks).toBe(2);
    expect(result.fileDetails[0]?.languages).toEqual(['typescript', 'json']);
  });

  it('should ignore files without code blocks', async () => {
    const markdownContent = `# Test

Just some text without code blocks.

More text here.`;

    writeFileSync(join(testDir, 'README.md'), markdownContent);

    const result = await discoverCodeBlocks(`${testDir}/**/*.md`);

    expect(result.markdownFiles).toHaveLength(0);
    expect(result.totalCodeBlocks).toBe(0);
    expect(result.fileDetails).toHaveLength(0);
  });

  it('should handle multiple files', async () => {
    const markdown1 = `# File 1

\`\`\`javascript
console.log('file 1');
\`\`\``;

    const markdown2 = `# File 2

\`\`\`python
print('file 2')
\`\`\`

\`\`\`bash
echo "bash command"
\`\`\``;

    writeFileSync(join(testDir, 'file1.md'), markdown1);
    writeFileSync(join(testDir, 'file2.md'), markdown2);

    const result = await discoverCodeBlocks(`${testDir}/**/*.md`);

    expect(result.markdownFiles).toHaveLength(2);
    expect(result.totalCodeBlocks).toBe(3);
    expect(result.fileDetails).toHaveLength(2);

    const file1Details = result.fileDetails.find(f => f.filePath.includes('file1.md'));
    const file2Details = result.fileDetails.find(f => f.filePath.includes('file2.md'));

    expect(file1Details?.codeBlocks).toBe(1);
    expect(file1Details?.languages).toEqual(['javascript']);

    expect(file2Details?.codeBlocks).toBe(2);
    expect(file2Details?.languages).toEqual(['python', 'bash']);
  });

  it('should not trigger discovery mode when snippet directives exist', async () => {
    const markdownWithSnippets = `# Test

\`\`\`typescript snippet=hello.ts
export function hello() {
  return "Hello, World!";
}
\`\`\``;

    const markdownWithoutSnippets = `# Test

\`\`\`typescript
export function hello() {
  return "Hello, World!";
}
\`\`\``;

    writeFileSync(join(testDir, 'with-snippets.md'), markdownWithSnippets);
    writeFileSync(join(testDir, 'without-snippets.md'), markdownWithoutSnippets);

    const result = await discoverCodeBlocks(`${testDir}/**/*.md`);

    expect(result.totalCodeBlocks).toBe(1);
    expect(result.fileDetails[0]?.filePath).toContain('without-snippets.md');
  });
}); 