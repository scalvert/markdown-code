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
