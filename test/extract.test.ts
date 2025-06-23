import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Project } from 'fixturify-project';
import { extractSnippets } from '../src/sync.js';
import type { Config } from '../src/types.js';

describe('extractSnippets', () => {
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

  it('extracts snippets and updates markdown', async () => {
    const md = `# Example\n\n\`\`\`ts\nconsole.log('ts');\n\`\`\`\n\n\`\`\`js\nconsole.log('js');\n\`\`\``;
    const filePath = join(testDir, 'example.md');
    await project.write({ 'example.md': md });

    const result = await extractSnippets(baseConfig);

    expect(result).toMatchInlineSnapshot(`
      {
        "errors": [],
        "extracted": [
          "${filePath}",
        ],
        "snippetsCreated": 2,
        "warnings": [],
      }
    `);

    const snippetDir = join(snippetRoot, 'example');
    expect(readFileSync(join(snippetDir, 'snippet1.ts'), 'utf-8')).toBe(
      "console.log('ts');\n",
    );
    expect(readFileSync(join(snippetDir, 'snippet2.js'), 'utf-8')).toBe(
      "console.log('js');\n",
    );

    const updated = readFileSync(filePath, 'utf-8');
    expect(updated).toContain('```ts snippet=example/snippet1.ts');
    expect(updated).toContain('```js snippet=example/snippet2.js');
  });

  it('skips languages not in includeExtensions', async () => {
    const md = `\`\`\`ts\nconsole.log('ts');\n\`\`\`\n\n\`\`\`py\nprint('py')\n\`\`\``;
    const filePath = join(testDir, 'skip.md');
    await project.write({ 'skip.md': md });

    const config = {
      ...baseConfig,
      markdownGlob: filePath,
      includeExtensions: ['.ts'],
    };
    const result = await extractSnippets(config);

    expect(result).toMatchInlineSnapshot(`
      {
        "errors": [],
        "extracted": [
          "${filePath}",
        ],
        "snippetsCreated": 1,
        "warnings": [],
      }
    `);
    expect(existsSync(join(snippetRoot, 'skip', 'snippet1.ts'))).toBe(true);
    expect(existsSync(join(snippetRoot, 'skip', 'snippet2.py'))).toBe(false);
  });

  it('ensures all snippet files have trailing newlines', async () => {
    const md = `# Newline Test

Content without newline:
\`\`\`js
console.log('no newline')
\`\`\`

Content with newline:
\`\`\`js
console.log('has newline');
\`\`\``;
    
    const filePath = join(testDir, 'newlines.md');
    await project.write({ 'newlines.md': md });

    await extractSnippets(baseConfig);

    const snippetDir = join(snippetRoot, 'newlines');
    const snippet1 = readFileSync(join(snippetDir, 'snippet1.js'), 'utf-8');
    const snippet2 = readFileSync(join(snippetDir, 'snippet2.js'), 'utf-8');

    expect(snippet1).toBe("console.log('no newline')\n");
    expect(snippet2).toBe("console.log('has newline');\n");
    
    expect(snippet1.endsWith('\n')).toBe(true);
    expect(snippet2.endsWith('\n')).toBe(true);
  });
});
