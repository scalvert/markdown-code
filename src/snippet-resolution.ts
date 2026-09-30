import { readFile, realpath } from 'node:fs/promises';
import { resolve, dirname, isAbsolute } from 'node:path';
import type { Issue, RuntimeConfig, SnippetDirective } from './types.js';
import type { DocumentCodeBlock } from './markdown-document.js';
import { fileExists, isInWorkingDir } from './utils.js';
import { isRemoteUrl, fetchRemoteContent } from './remote.js';
import { getLineEnding, normalizeLineEndings } from './line-endings.js';
import { createIssue } from './issues.js';

export type ManagedCodeBlock = DocumentCodeBlock & {
  readonly directive: SnippetDirective;
};

export interface SnippetContext {
  config: RuntimeConfig;
  markdownFilePath: string;
}

export type SnippetResolution =
  | { status: 'resolved'; content: string }
  | { status: 'failed'; issue: Issue }
  | { status: 'no-lines' };

type LocalRead =
  | { ok: true; content: string }
  | { ok: false; step: 'path'; error: unknown }
  | { ok: false; step: 'access'; error: NodeJS.ErrnoException }
  | { ok: false; step: 'contain' }
  | { ok: false; step: 'read'; error: unknown; resolvedPath: string };

export function isManagedCodeBlock(
  codeBlock: DocumentCodeBlock,
): codeBlock is ManagedCodeBlock {
  return codeBlock.directive !== undefined;
}

function allowedSnippetRoots(config: RuntimeConfig): Array<string> {
  const workingDir = resolve(config.workingDir);
  const snippetRoot = resolve(workingDir, config.snippetRoot || '.');
  return snippetRoot !== workingDir ? [workingDir, snippetRoot] : [workingDir];
}

export function trimBlankLines(content: string): string {
  const lineEnding = getLineEnding(content);
  const lines = content.split(/\r\n|\n|\r/);

  let start = 0;
  while (start < lines.length && lines[start]!.trim() === '') {
    start++;
  }

  let end = lines.length - 1;
  while (end >= 0 && lines[end]!.trim() === '') {
    end--;
  }

  if (start > end) {
    return '';
  }

  return lines.slice(start, end + 1).join(lineEnding);
}

export function extractLines(
  content: string,
  startLine?: number,
  endLine?: number,
): string {
  if (startLine === undefined && endLine === undefined) {
    return trimBlankLines(content);
  }

  const lineEnding = getLineEnding(content);
  const lines = content.split(/\r\n|\n|\r/);
  let extractedLines: Array<string>;

  if (startLine !== undefined && endLine !== undefined) {
    extractedLines = lines.slice(startLine - 1, endLine);
  } else if (startLine !== undefined) {
    extractedLines = lines.slice(startLine - 1);
  } else {
    extractedLines = lines;
  }

  return trimBlankLines(extractedLines.join(lineEnding));
}

export async function resolveSnippetPath(
  snippetPath: string,
  config: RuntimeConfig,
  markdownFilePath?: string,
): Promise<string> {
  if (isRemoteUrl(snippetPath)) {
    return snippetPath;
  }

  const workingDir = config.workingDir;
  const snippetRoot = resolve(workingDir, config.snippetRoot || '.');

  if (snippetPath.startsWith('./') || snippetPath.startsWith('../')) {
    if (!markdownFilePath) {
      throw new Error('Markdown file path required for relative snippet paths');
    }
    const markdownDir = dirname(resolve(markdownFilePath));
    return resolve(markdownDir, snippetPath);
  }

  if (isAbsolute(snippetPath)) {
    return snippetPath;
  }

  const workingDirRelativePath = resolve(workingDir, snippetPath);
  if (await fileExists(workingDirRelativePath)) {
    return workingDirRelativePath;
  }

  return resolve(snippetRoot, snippetPath);
}

async function readLocalSnippet(
  snippetPath: string,
  config: RuntimeConfig,
  markdownFilePath?: string,
): Promise<LocalRead> {
  let resolvedPath: string;
  try {
    resolvedPath = await resolveSnippetPath(
      snippetPath,
      config,
      markdownFilePath,
    );
  } catch (error) {
    return { ok: false, step: 'path', error };
  }

  let realPath: string;
  try {
    realPath = await realpath(resolvedPath);
  } catch (error) {
    return {
      ok: false,
      step: 'access',
      error: error as NodeJS.ErrnoException,
    };
  }

  if (!isInWorkingDir(realPath, allowedSnippetRoots(config))) {
    return { ok: false, step: 'contain' };
  }

  try {
    return { ok: true, content: await readFile(realPath, 'utf-8') };
  } catch (error) {
    return { ok: false, step: 'read', error, resolvedPath };
  }
}

function fetchSnippet(url: string, config: RuntimeConfig): Promise<string> {
  return fetchRemoteContent(url, {
    timeout: config.remoteTimeout,
    allowInsecureHttp: config.allowInsecureHttp,
  });
}

export async function loadSnippetContent(
  snippetPath: string,
  config: RuntimeConfig,
  markdownFilePath?: string,
): Promise<string> {
  if (isRemoteUrl(snippetPath)) {
    return await fetchSnippet(snippetPath, config);
  }

  const read = await readLocalSnippet(snippetPath, config, markdownFilePath);
  if (read.ok) {
    return read.content;
  }
  if (read.step === 'contain') {
    throw new Error(`Path traversal attempt detected: ${snippetPath}`);
  }
  throw read.error;
}

function localReadIssue(
  read: Exclude<LocalRead, { ok: true }>,
  codeBlock: ManagedCodeBlock,
  config: RuntimeConfig,
): Issue {
  const { filePath } = codeBlock.directive;

  if (read.step === 'path') {
    return createIssue(
      'path-validation',
      codeBlock,
      `Error resolving path ${filePath}: ${read.error}`,
    );
  }
  if (read.step === 'contain') {
    return createIssue(
      'path-traversal',
      codeBlock,
      `Path traversal attempt detected: ${filePath}`,
    );
  }
  if (read.step === 'read') {
    return createIssue(
      'snippet-load-error',
      codeBlock,
      `Error loading snippet ${read.resolvedPath}: ${read.error}`,
    );
  }
  if (read.error.code === 'ENOENT') {
    return createIssue(
      'snippet-not-found',
      codeBlock,
      `Snippet file not found: ${filePath}`,
      { severity: config.missingSnippetSeverity },
    );
  }
  return createIssue(
    'snippet-load-error',
    codeBlock,
    `Error accessing snippet ${filePath}: ${read.error.message}`,
  );
}

async function loadForCodeBlock(
  codeBlock: ManagedCodeBlock,
  { config, markdownFilePath }: SnippetContext,
): Promise<{ content: string } | { issue: Issue }> {
  const { filePath, isRemote } = codeBlock.directive;

  if (isRemote) {
    try {
      return { content: await fetchSnippet(filePath, config) };
    } catch (error) {
      const reason = error instanceof Error ? error.message : error;
      return {
        issue: createIssue(
          'remote-fetch-error',
          codeBlock,
          `Error fetching remote snippet: ${reason}`,
        ),
      };
    }
  }

  const read = await readLocalSnippet(filePath, config, markdownFilePath);
  return read.ok
    ? { content: read.content }
    : { issue: localReadIssue(read, codeBlock, config) };
}

export async function resolveSnippet(
  codeBlock: ManagedCodeBlock,
  context: SnippetContext,
): Promise<SnippetResolution> {
  const loaded = await loadForCodeBlock(codeBlock, context);
  if ('issue' in loaded) {
    return { status: 'failed', issue: loaded.issue };
  }

  const { startLine, endLine } = codeBlock.directive;
  const extracted = extractLines(loaded.content, startLine, endLine);
  if (extracted === '' && (startLine ?? endLine)) {
    return { status: 'no-lines' };
  }

  return {
    status: 'resolved',
    content: normalizeLineEndings(extracted, codeBlock.lineEnding),
  };
}
