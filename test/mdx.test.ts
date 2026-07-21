import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Project } from 'fixturify-project';
import { extractSnippets, syncMarkdownFiles, checkMarkdownFiles } from '../src/sync.js';
import { parseMarkdownFile, parseMarkdownForExtraction } from '../src/parser.js';
import type { Config } from '../src/types.js';

/**
 * MDX support tests. The invariants under test:
 *
 * 1. Fence detection in .mdx matches the MDX grammar exactly — fences nested
 *    inside JSX elements are found; JSX-indented prose never produces phantom
 *    code nodes; `{...}` in YAML frontmatter never reaches the MDX expression
 *    parser.
 * 2. Extraction is NON-DESTRUCTIVE BY CONSTRUCTION: the only bytes that may
 *    change in the markdown are the inserted ` snippet=<ref>` annotations on
 *    opening fence lines. Stripping those annotations must reproduce the
 *    original file byte-for-byte.
 * 3. Extraction is immediately idempotent: a sync right after extract makes
 *    zero changes, and check passes.
 * 4. Sync into an indented (JSX-nested) fence re-applies the fence's own
 *    indentation to the new content.
 */

const MDX_DOC = `---
title: Widget guide
description: Uses {braces} that would break a bare MDX expression parser
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Widgets

Some text with an {/* mdx comment */} expression.

\`\`\`ts title="plain.ts"
const topLevel = 1;
\`\`\`

<Tabs>
  <TabItem value="a" label="A">

    \`\`\`ts
    const nested = 2;
    \`\`\`

  </TabItem>
</Tabs>

<CardGroup cols={2}>
  <Card title="Indented prose that plain remark would misread as code" />
</CardGroup>
`;

function stripAnnotations(content: string): string {
  return content.replace(/ snippet=[^\s\n]+/g, '');
}

describe('MDX support', () => {
  let project: Project;
  let testDir: string;
  let baseConfig: Config;

  beforeEach(() => {
    project = new Project();
    testDir = project.baseDir;
    baseConfig = {
      snippetRoot: join(testDir, 'snippets'),
      markdownGlob: join(testDir, '**/*.mdx'),
      excludeGlob: [],
      includeExtensions: ['.ts', '.js', '.py'],
      workingDir: testDir,
    };
  });

  afterEach(() => {
    project.dispose();
  });

  describe('parsing', () => {
    it('finds fences nested inside JSX and ignores JSX-indented prose', async () => {
      await project.write({ 'doc.mdx': MDX_DOC });
      const parsed = await parseMarkdownForExtraction(join(testDir, 'doc.mdx'));

      expect(parsed.codeBlocks).toHaveLength(2);
      expect(parsed.codeBlocks[0]!.content).toBe('const topLevel = 1;');
      expect(parsed.codeBlocks[1]!.content).toBe('const nested = 2;');
    });

    it('parses frontmatter containing braces without an acorn error', async () => {
      await project.write({ 'doc.mdx': MDX_DOC });
      await expect(
        parseMarkdownForExtraction(join(testDir, 'doc.mdx')),
      ).resolves.toBeDefined();
    });

    it('keeps .md parsing on the historical plain-remark path', async () => {
      const md = '# Title\n\n    indented code block\n';
      await project.write({ 'doc.md': md });
      const parsed = await parseMarkdownForExtraction(join(testDir, 'doc.md'));
      // Plain remark still treats 4-space indentation as (lang-less) indented
      // code, which the lang filter drops — historical behavior preserved.
      expect(parsed.codeBlocks).toHaveLength(0);
    });
  });

  describe('extraction non-destructiveness', () => {
    it('only adds snippet annotations; stripping them restores the original byte-for-byte', async () => {
      await project.write({ 'doc.mdx': MDX_DOC });
      const filePath = join(testDir, 'doc.mdx');

      const result = await extractSnippets(baseConfig);
      expect(result.errors).toEqual([]);
      expect(result.snippetsCreated).toBe(2);

      const after = readFileSync(filePath, 'utf-8');
      expect(after).not.toBe(MDX_DOC);
      expect(stripAnnotations(after)).toBe(MDX_DOC);
    });

    it('appends to fence meta instead of replacing it', async () => {
      await project.write({ 'doc.mdx': MDX_DOC });
      const filePath = join(testDir, 'doc.mdx');

      await extractSnippets(baseConfig);

      const after = readFileSync(filePath, 'utf-8');
      expect(after).toContain('```ts title="plain.ts" snippet=doc/');
    });

    it('annotates the correct fence when multiple same-language fences exist', async () => {
      await project.write({ 'doc.mdx': MDX_DOC });
      const filePath = join(testDir, 'doc.mdx');

      await extractSnippets(baseConfig);

      const after = readFileSync(filePath, 'utf-8');
      // The nested, indented fence must carry its own annotation.
      expect(after).toMatch(/ {4}```ts snippet=doc\//);
    });

    it('is idempotent: sync after extract changes nothing and check passes', async () => {
      await project.write({ 'doc.mdx': MDX_DOC });
      const filePath = join(testDir, 'doc.mdx');

      await extractSnippets(baseConfig);
      const afterExtract = readFileSync(filePath, 'utf-8');

      const syncResult = await syncMarkdownFiles(baseConfig);
      expect(syncResult.errors).toEqual([]);
      expect(syncResult.updated).toEqual([]);
      expect(readFileSync(filePath, 'utf-8')).toBe(afterExtract);

      const checkResult = await checkMarkdownFiles(baseConfig);
      expect(checkResult.inSync).toBe(true);
    });
  });

  describe('sync indentation', () => {
    it('re-applies fence indentation when syncing new content into a JSX-nested fence', async () => {
      await project.write({ 'doc.mdx': MDX_DOC });
      const filePath = join(testDir, 'doc.mdx');

      await extractSnippets(baseConfig);

      // Change the nested snippet's source file, then sync.
      const after = readFileSync(filePath, 'utf-8');
      const nestedRef = after.match(/ {4}```ts snippet=([^\s\n]+)/)![1]!;
      const snippetPath = join(baseConfig.snippetRoot, nestedRef);
      const updated = "const nested = 2;\nconst added = 'line';\n";
      writeFileSync(snippetPath, updated, 'utf-8');

      const syncResult = await syncMarkdownFiles(baseConfig);
      expect(syncResult.errors).toEqual([]);
      expect(syncResult.fileIssues).toEqual([]);
      expect(syncResult.updated).toHaveLength(1);

      const synced = readFileSync(filePath, 'utf-8');
      expect(synced).toContain("    const nested = 2;\n    const added = 'line';");

      // And the file must re-parse with the fence still intact.
      const reparsed = await parseMarkdownFile(filePath);
      const nested = reparsed.codeBlocks.find((cb) =>
        cb.content.includes('added'),
      );
      expect(nested).toBeDefined();
      expect(nested!.content).toBe("const nested = 2;\nconst added = 'line';");
    });
  });
});
