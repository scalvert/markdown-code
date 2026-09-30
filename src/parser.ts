import { readFile, realpath } from 'node:fs/promises';
import { resolve, dirname, isAbsolute } from 'node:path';
import type { MarkdownFile, CodeBlock, RuntimeConfig } from './types.js';
import { fileExists, isInWorkingDir } from './utils.js';
import { isRemoteUrl, fetchRemoteContent } from './remote.js';
import {
  MarkdownDocument,
  isMdxPath,
  renderBlock,
  toLegacyCodeBlocks,
} from './markdown-document.js';
import { getLineEnding } from './line-endings.js';

export { parseSnippetDirective } from './snippet-directive.js';
export {
  getLineEnding,
  normalizeLineEndings,
  type LineEnding,
} from './line-endings.js';

export async function readMarkdownDocument(
  filePath: string,
): Promise<{ content: string; document: MarkdownDocument }> {
  const content = await readFile(filePath, 'utf-8');
  const document = MarkdownDocument.parse(content, {
    mdx: isMdxPath(filePath),
  });
  return { content, document };
}

async function readLegacyCodeBlocks(
  filePath: string,
): Promise<{ content: string; codeBlocks: Array<CodeBlock> }> {
  const { content, document } = await readMarkdownDocument(filePath);
  return { content, codeBlocks: toLegacyCodeBlocks(document) };
}

/**
 * @deprecated Use `MarkdownDocument.parse` and filter `codeBlocks` by
 * `directive`. Will be removed in 2.0.
 */
export async function parseMarkdownFile(
  filePath: string,
): Promise<MarkdownFile> {
  const { content, codeBlocks } = await readLegacyCodeBlocks(filePath);
  return {
    filePath,
    content,
    codeBlocks: codeBlocks.filter((block) => block.snippet),
  };
}

/**
 * @deprecated Use `MarkdownDocument.parse` and filter `codeBlocks` by
 * `!directive`. Will be removed in 2.0.
 */
export async function parseMarkdownForExtraction(
  filePath: string,
): Promise<MarkdownFile> {
  const { content, codeBlocks } = await readLegacyCodeBlocks(filePath);
  return {
    filePath,
    content,
    codeBlocks: codeBlocks
      .filter((block) => !block.snippet)
      .map(({ language, content: body, position }) => ({
        language,
        content: body,
        position,
      })),
  };
}

/**
 * @deprecated Use `MarkdownDocument#setBody` followed by `toString()`.
 * Will be removed in 2.0.
 */
export function replaceCodeBlock(
  markdownContent: string,
  codeBlock: CodeBlock,
  newContent: string,
): string {
  const { start, end } = codeBlock.position;
  const rendered = renderBlock(
    markdownContent.slice(start, end),
    codeBlock.columnNumber ?? 1,
    { content: newContent },
  );
  return (
    markdownContent.slice(0, start) + rendered + markdownContent.slice(end)
  );
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

  const snippetRootPath = resolve(snippetRoot, snippetPath);
  if (await fileExists(snippetRootPath)) {
    return snippetRootPath;
  }

  return snippetRootPath;
}

export async function loadSnippetContent(
  snippetPath: string,
  config: RuntimeConfig,
  markdownFilePath?: string,
): Promise<string> {
  if (isRemoteUrl(snippetPath)) {
    return await fetchRemoteContent(snippetPath, {
      timeout: config.remoteTimeout,
      allowInsecureHttp: config.allowInsecureHttp,
    });
  }

  const resolvedPath = await resolveSnippetPath(
    snippetPath,
    config,
    markdownFilePath,
  );

  const workingDir = resolve(config.workingDir);
  const snippetRoot = resolve(workingDir, config.snippetRoot || '.');

  // Resolve symlinks to get the real path
  const realResolvedPath = await realpath(resolvedPath);

  // Check if the resolved path is within allowed directories
  // Allow access to both workingDir and snippetRoot
  const allowedRoots = [workingDir];
  // Only add snippetRoot if it's different from workingDir
  if (snippetRoot !== workingDir) {
    allowedRoots.push(snippetRoot);
  }

  if (!isInWorkingDir(realResolvedPath, allowedRoots)) {
    throw new Error(`Path traversal attempt detected: ${snippetPath}`);
  }

  return await readFile(realResolvedPath, 'utf-8');
}

export function trimBlankLines(content: string): string {
  const lineEnding = getLineEnding(content);
  const lines = content.split(/\r\n|\n|\r/);

  // Find first non-blank line
  let start = 0;
  while (start < lines.length && lines[start]!.trim() === '') {
    start++;
  }

  // Find last non-blank line
  let end = lines.length - 1;
  while (end >= 0 && lines[end]!.trim() === '') {
    end--;
  }

  // If all lines are blank, return empty string
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
