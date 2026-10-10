import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Project } from 'fixturify-project';
import {
  failedIssues,
  planSync,
  type FilePlan,
  type SyncPlan,
} from '../src/sync-plan.js';
import { syncMarkdownFiles } from '../src/sync.js';
import type { RuntimeConfig } from '../src/types.js';

vi.mock('fast-glob', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fast-glob')>();
  const sortedGlob = async (...args: Parameters<typeof actual.default>) =>
    (await actual.default(...args)).sort();
  return { default: sortedGlob };
});

async function collect(plan: SyncPlan): Promise<Array<FilePlan>> {
  if (plan.status !== 'planned') {
    throw new Error(`Expected a plan, got ${plan.error}`);
  }
  const files: Array<FilePlan> = [];
  for await (const file of plan.files) {
    files.push(file);
  }
  return files;
}

const README = [
  '```js snippet=same.js',
  'same',
  '```',
  '',
  '```js snippet=missing.js',
  'old',
  '```',
  '',
  '```js snippet=changed.js',
  'old',
  '```',
  '',
  '```js',
  'unmanaged',
  '```',
  '',
].join('\n');

describe('planSync', () => {
  let project: Project;
  let config: RuntimeConfig;

  beforeEach(async () => {
    project = new Project();
    await project.write({
      'README.md': README,
      'same.js': 'same',
      'changed.js': 'new',
    });
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
  });

  it('plans each managed code block in document order', async () => {
    const [file] = await collect(await planSync(config));

    expect(file?.status).toBe('planned');
    if (file?.status !== 'planned') return;
    expect(
      file.blocks.map((block) => [block.status, block.codeBlock.line]),
    ).toEqual([
      ['in-sync', 1],
      ['failed', 5],
      ['out-of-sync', 9],
    ]);
    expect(failedIssues(file.blocks).map((issue) => issue.ruleId)).toEqual([
      'snippet-not-found',
    ]);
  });

  it('computes updated content without writing it', async () => {
    const [file] = await collect(await planSync(config));

    if (file?.status !== 'planned') throw new Error('expected a plan');
    expect(file.content).toBe(README);
    expect(file.updatedContent).toBe(
      README.replace('snippet=changed.js\nold', 'snippet=changed.js\nnew'),
    );
    expect(readFileSync(join(project.baseDir, 'README.md'), 'utf-8')).toBe(
      README,
    );
  });

  it('plans files lazily, so earlier writes are visible to later files', async () => {
    await project.write({
      'a.md': '```md snippet=b.md\nold\n```\n',
      'b.md': 'first\n',
    });
    const plan = await planSync({ ...config, markdownGlob: '{a,b}.md' });
    if (plan.status !== 'planned') throw new Error(plan.error);

    const iterator = plan.files[Symbol.asyncIterator]();
    const first = (await iterator.next()).value as FilePlan;
    const otherPath = join(
      project.baseDir,
      first.filePath.endsWith('a.md') ? 'b.md' : 'a.md',
    );
    writeFileSync(otherPath, 'changed after the first plan\n');
    const second = (await iterator.next()).value as FilePlan;

    expect(second.status === 'planned' && second.content).toBe(
      'changed after the first plan\n',
    );
  });

  it('lets sync write each file before planning the next', async () => {
    await project.write({
      'a.md': '```md snippet=a-source.md\nold\n```\n',
      'a-source.md': 'new\n',
      'z.md': '````md snippet=a.md\nstale\n````\n',
    });

    const result = await syncMarkdownFiles({
      ...config,
      markdownGlob: '{a,z}.md',
    });

    expect(result.updated.map((file) => file.slice(-4))).toEqual([
      'a.md',
      'z.md',
    ]);
    expect(readFileSync(join(project.baseDir, 'z.md'), 'utf-8')).toBe(
      '````md snippet=a.md\n```md snippet=a-source.md\nnew\n```\n````\n',
    );
  });

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'reports files that cannot be read (needs chmod; POSIX and non-root only)',
    async () => {
      const readme = join(project.baseDir, 'README.md');
      chmodSync(readme, 0o000);

      try {
        const [file] = await collect(await planSync(config));

        expect(file).toMatchObject({
          filePath: readme,
          status: 'error',
          error: expect.stringMatching(
            new RegExp(`^Error processing ${readme}: Error: EACCES`),
          ),
        });
      } finally {
        chmodSync(readme, 0o644);
      }
    },
  );

  it('reports a glob that cannot be listed', async () => {
    const plan = await planSync({
      ...config,
      markdownGlob: '',
    });

    expect(plan).toMatchInlineSnapshot(`
      {
        "error": "Error finding markdown files: TypeError: Patterns must be a string (non empty) or an array of strings",
        "status": "error",
      }
    `);
  });
});
