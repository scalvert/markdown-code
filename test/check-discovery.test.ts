import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { Project } from 'fixturify-project';
import { discoverCodeBlocks } from '../src/sync.js';
import { handler } from '../src/commands/check.js';

describe('discovery functionality', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project();
  });

  afterEach(() => {
    project.dispose();
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

    await project.write({
      'README.md': markdownContent,
    });

    const result = await discoverCodeBlocks(`${project.baseDir}/**/*.md`);

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

    await project.write({
      'README.md': markdownContent,
    });

    const result = await discoverCodeBlocks(`${project.baseDir}/**/*.md`);

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

    await project.write({
      'file1.md': markdown1,
      'file2.md': markdown2,
    });

    const result = await discoverCodeBlocks(`${project.baseDir}/**/*.md`);

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

    await project.write({
      'with-snippets.md': markdownWithSnippets,
      'without-snippets.md': markdownWithoutSnippets,
    });

    const result = await discoverCodeBlocks(`${project.baseDir}/**/*.md`);

    expect(result.totalCodeBlocks).toBe(1);
    expect(result.fileDetails[0]?.filePath).toContain('without-snippets.md');
  });
}); 