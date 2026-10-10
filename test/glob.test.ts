import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Project } from 'fixturify-project';
import { findMarkdownFiles, toGlobPattern } from '../src/glob.js';

describe('toGlobPattern', () => {
  it('turns Windows separators into glob separators on Windows', () => {
    expect(toGlobPattern('docs\\**\\*.md', 'win32')).toBe('docs/**/*.md');
    expect(toGlobPattern('C:\\work\\**\\*.md', 'win32')).toBe(
      'C:/work/**/*.md',
    );
  });

  it('leaves patterns alone elsewhere, where a backslash is an escape', () => {
    expect(toGlobPattern('docs/\\[draft\\].md', 'linux')).toBe(
      'docs/\\[draft\\].md',
    );
    expect(toGlobPattern('docs/**/*.md', 'darwin')).toBe('docs/**/*.md');
  });
});

describe('findMarkdownFiles', () => {
  let project: Project;

  beforeEach(async () => {
    project = new Project();
    await project.write({
      'README.md': '',
      docs: { 'guide.md': '', 'draft.md': '' },
      'notes.txt': '',
    });
  });

  afterEach(() => {
    project.dispose();
  });

  it('returns absolute, platform-native paths', async () => {
    const files = await findMarkdownFiles({
      markdownGlob: '**/*.md',
      excludeGlob: ['docs/draft.md'],
      workingDir: project.baseDir,
    });

    expect(files.sort()).toEqual(
      [
        join(project.baseDir, 'README.md'),
        join(project.baseDir, 'docs', 'guide.md'),
      ].sort(),
    );
  });

  it('includes the working directory itself in a ../ pattern', async () => {
    const files = await findMarkdownFiles({
      markdownGlob: '../**/*.md',
      excludeGlob: [],
      workingDir: join(project.baseDir, 'docs'),
    });

    expect(files).toEqual([
      join(project.baseDir, 'README.md'),
      join(project.baseDir, 'docs', 'draft.md'),
      join(project.baseDir, 'docs', 'guide.md'),
    ]);
  });

  it('follows symlinked directories under a symlinked absolute root', async () => {
    const outside = new Project();
    await outside.write({ 'linked.md': '' });
    try {
      mkdirSync(join(project.baseDir, 'tree'));
      writeFileSync(join(project.baseDir, 'tree', 'own.md'), '');
      symlinkSync(
        outside.baseDir,
        join(project.baseDir, 'tree', 'link'),
        'junction',
      );
      const alias = join(project.baseDir, 'alias');
      symlinkSync(join(project.baseDir, 'tree'), alias, 'junction');

      const files = await findMarkdownFiles({
        markdownGlob: join(alias, '**', '*.md'),
        excludeGlob: [],
        workingDir: alias,
      });

      expect(files).toEqual([
        join(alias, 'link', 'linked.md'),
        join(alias, 'own.md'),
      ]);
    } finally {
      outside.dispose();
    }
  });

  it('accepts an absolute pattern built with platform paths', async () => {
    const files = await findMarkdownFiles({
      markdownGlob: join(project.baseDir, 'docs', '*.md'),
      excludeGlob: [],
      workingDir: project.baseDir,
    });

    expect(files.sort()).toEqual(
      [
        join(project.baseDir, 'docs', 'draft.md'),
        join(project.baseDir, 'docs', 'guide.md'),
      ].sort(),
    );
  });
});
