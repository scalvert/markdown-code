import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { Project } from 'fixturify-project';
import { MarkdownDocument } from '../src/markdown-document.js';
import {
  isManagedCodeBlock,
  loadSnippetContent,
  resolveSnippet,
  type ManagedCodeBlock,
  type SnippetResolution,
} from '../src/snippet-source.js';
import type { RuntimeConfig } from '../src/types.js';

function managedBlock(directive: string, lineEnding = '\n'): ManagedCodeBlock {
  const markdown = ['```js ' + directive, 'old', '```', ''].join(lineEnding);
  const [codeBlock] = MarkdownDocument.parse(markdown).codeBlocks;
  if (!codeBlock || !isManagedCodeBlock(codeBlock)) {
    throw new Error(`Expected a managed code block for ${directive}`);
  }
  return codeBlock;
}

describe('resolveSnippet', () => {
  let project: Project;
  let outside: Project;
  let config: RuntimeConfig;
  let markdownFilePath: string;

  beforeEach(async () => {
    project = new Project();
    outside = new Project();
    await project.write({
      'README.md': '',
      'app.js': '\nconst a = 1;\nconst b = 2;\nconst c = 3;\n\n',
      folder: { 'nested.js': 'nested' },
      docs: { 'guide.md': '', 'local.js': 'next to guide' },
      snippets: { 'only-in-root.js': 'from snippet root' },
    });
    await outside.write({ 'secret.js': 'secret' });
    config = {
      workingDir: project.baseDir,
      snippetRoot: 'snippets',
      markdownGlob: '**/*.md',
      excludeGlob: [],
      includeExtensions: ['.js'],
    };
    markdownFilePath = join(project.baseDir, 'README.md');
  });

  afterEach(() => {
    project.dispose();
    outside.dispose();
    vi.unstubAllGlobals();
  });

  function resolveFor(
    directive: string,
    overrides: Partial<RuntimeConfig> = {},
    lineEnding = '\n',
  ): Promise<SnippetResolution> {
    return resolveSnippet(managedBlock(directive, lineEnding), {
      config: { ...config, ...overrides },
      markdownFilePath,
    });
  }

  function withoutTmp(resolution: SnippetResolution): SnippetResolution {
    return JSON.parse(
      JSON.stringify(resolution)
        .replaceAll(project.baseDir, '<TMP>')
        .replaceAll(outside.baseDir, '<OUTSIDE>'),
    );
  }

  describe('resolved', () => {
    it('trims blank lines around a whole file', async () => {
      expect(await resolveFor('snippet=app.js')).toEqual({
        status: 'resolved',
        content: 'const a = 1;\nconst b = 2;\nconst c = 3;',
      });
    });

    it('selects a line range', async () => {
      expect(await resolveFor('snippet=app.js#L3-L4')).toEqual({
        status: 'resolved',
        content: 'const b = 2;\nconst c = 3;',
      });
    });

    it("converts content to the code block's line ending", async () => {
      expect(await resolveFor('snippet=app.js#L2-L3', {}, '\r\n')).toEqual({
        status: 'resolved',
        content: 'const a = 1;\r\nconst b = 2;',
      });
    });

    it('resolves ./ paths against the Markdown file', async () => {
      markdownFilePath = join(project.baseDir, 'docs', 'guide.md');

      expect(await resolveFor('snippet=./local.js')).toEqual({
        status: 'resolved',
        content: 'next to guide',
      });
    });

    it('falls back to the snippet root', async () => {
      expect(await resolveFor('snippet=only-in-root.js')).toEqual({
        status: 'resolved',
        content: 'from snippet root',
      });
    });

    it('fetches remote snippets and selects lines', async () => {
      const fetchMock = vi.fn(async () => new Response('one\ntwo\nthree\n'));
      vi.stubGlobal('fetch', fetchMock);

      expect(
        await resolveFor('snippet=https://example.com/app.js#L2-L3'),
      ).toEqual({ status: 'resolved', content: 'two\nthree' });
      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com/app.js',
        expect.anything(),
      );
    });
  });

  describe('no-lines', () => {
    it('reports a range past the end of the file as no-lines', async () => {
      expect(await resolveFor('snippet=app.js#L99-L100')).toEqual({
        status: 'no-lines',
      });
    });
  });

  describe('failed', () => {
    it('reports a missing snippet as an error by default', async () => {
      expect(await resolveFor('snippet=missing.js')).toMatchInlineSnapshot(`
        {
          "issue": {
            "column": 1,
            "line": 1,
            "message": "Snippet file not found: missing.js",
            "ruleId": "snippet-not-found",
            "severity": "error",
            "type": "file-missing",
          },
          "status": "failed",
        }
      `);
    });

    it('applies missingSnippetSeverity to missing snippets', async () => {
      const resolution = await resolveFor('snippet=missing.js', {
        missingSnippetSeverity: 'warning',
      });

      expect(resolution).toMatchObject({
        status: 'failed',
        issue: { ruleId: 'snippet-not-found', severity: 'warning' },
      });
    });

    it('rejects absolute paths outside the allowed roots', async () => {
      const resolution = await resolveFor(
        `snippet=${join(outside.baseDir, 'secret.js')}`,
      );

      expect(withoutTmp(resolution)).toMatchInlineSnapshot(`
        {
          "issue": {
            "column": 1,
            "line": 1,
            "message": "Path traversal attempt detected: <OUTSIDE>/secret.js",
            "ruleId": "path-traversal",
            "severity": "error",
            "type": "invalid-path",
          },
          "status": "failed",
        }
      `);
    });

    it('rejects symlinks that escape the allowed roots', async () => {
      symlinkSync(
        join(outside.baseDir, 'secret.js'),
        join(project.baseDir, 'link.js'),
      );

      expect(await resolveFor('snippet=link.js')).toMatchObject({
        status: 'failed',
        issue: { ruleId: 'path-traversal' },
      });
    });

    it('reports a path that cannot be accessed', async () => {
      const resolution = await resolveFor(
        `snippet=${join(project.baseDir, 'app.js', 'child.js')}`,
      );

      expect(withoutTmp(resolution)).toMatchObject({
        status: 'failed',
        issue: {
          type: 'load-failed',
          ruleId: 'snippet-load-error',
          message: expect.stringMatching(
            /^Error accessing snippet <TMP>\/app\.js\/child\.js: ENOTDIR/,
          ),
        },
      });
    });

    it('reports a snippet that cannot be read', async () => {
      const resolution = await resolveFor('snippet=folder');

      expect(withoutTmp(resolution)).toMatchObject({
        status: 'failed',
        issue: {
          ruleId: 'snippet-load-error',
          message: expect.stringMatching(
            /^Error loading snippet <TMP>\/folder: Error: EISDIR/,
          ),
        },
      });
    });

    it('reports relative paths without a Markdown file as path-validation', async () => {
      markdownFilePath = '';

      expect(await resolveFor('snippet=./local.js')).toMatchInlineSnapshot(`
        {
          "issue": {
            "column": 1,
            "line": 1,
            "message": "Error resolving path ./local.js: Error: Markdown file path required for relative snippet paths",
            "ruleId": "path-validation",
            "severity": "error",
            "type": "load-failed",
          },
          "status": "failed",
        }
      `);
    });

    it('reports remote fetch failures', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('', { status: 500 })),
      );

      expect(await resolveFor('snippet=https://example.com/app.js'))
        .toMatchInlineSnapshot(`
        {
          "issue": {
            "column": 1,
            "line": 1,
            "message": "Error fetching remote snippet: Failed to fetch remote file: https://example.com/app.js (HTTP 500)",
            "ruleId": "remote-fetch-error",
            "severity": "error",
            "type": "remote-error",
          },
          "status": "failed",
        }
      `);
    });
  });
});

describe('loadSnippetContent', () => {
  let project: Project;
  let outside: Project;
  let config: RuntimeConfig;

  beforeEach(async () => {
    project = new Project();
    outside = new Project();
    await project.write({ 'app.js': 'app' });
    await outside.write({ 'secret.js': 'secret' });
    config = {
      workingDir: project.baseDir,
      snippetRoot: '.',
      markdownGlob: '**/*.md',
      excludeGlob: [],
      includeExtensions: ['.js'],
    };
  });

  afterEach(() => {
    project.dispose();
    outside.dispose();
  });

  it('returns the raw file content', async () => {
    expect(await loadSnippetContent('app.js', config)).toBe('app');
  });

  it('throws the filesystem error for missing files', async () => {
    await expect(
      loadSnippetContent('missing.js', config),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('throws on paths outside the allowed roots', async () => {
    const secret = join(outside.baseDir, 'secret.js');

    await expect(loadSnippetContent(secret, config)).rejects.toThrow(
      `Path traversal attempt detected: ${secret}`,
    );
  });
});
