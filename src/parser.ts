import { readFile, realpath } from 'node:fs/promises';
import { resolve, dirname, isAbsolute } from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import type { Code } from 'mdast';
import type {
  MarkdownFile,
  CodeBlock,
  SnippetDirective,
  RuntimeConfig,
} from './types.js';
import { fileExists, isInWorkingDir } from './utils.js';
import { isRemoteUrl, fetchRemoteContent } from './remote.js';

export function parseSnippetDirective(
  info: string,
): SnippetDirective | undefined {
  const snippetMatch = info.match(/snippet=([^\s]+)/);

  if (!snippetMatch?.[1]) {
    return undefined;
  }

  const snippetPath = snippetMatch[1];
  const isRemote = isRemoteUrl(snippetPath);
  const lastHashIndex = snippetPath.lastIndexOf('#');

  if (lastHashIndex === -1) {
    return { filePath: snippetPath, isRemote };
  }

  const filePath = snippetPath.substring(0, lastHashIndex);
  const lineSpec = snippetPath.substring(lastHashIndex + 1);

  if (lineSpec.startsWith('L')) {
    const lineRange = lineSpec.substring(1);
    const rangeParts = lineRange.split('-');

    if (rangeParts.length === 1) {
      const line = parseInt(rangeParts[0]!, 10);
      if (isNaN(line) || line < 0 || rangeParts[0] === '') {
        return { filePath: snippetPath, isRemote };
      }
      return {
        filePath,
        startLine: line,
        endLine: line,
        isRemote,
      };
    }

    if (rangeParts.length === 2) {
      if (rangeParts[0] === '') {
        return { filePath: snippetPath, isRemote };
      }

      const startLine = parseInt(rangeParts[0]!, 10);

      if (isNaN(startLine) || startLine < 0) {
        return { filePath: snippetPath, isRemote };
      }

      if (rangeParts[1] === '') {
        return {
          filePath,
          startLine,
          isRemote,
        };
      }

      const endLine = parseInt(rangeParts[1]!.replace(/^L/, ''), 10);

      if (isNaN(endLine) || endLine < 0) {
        return {
          filePath,
          startLine,
          isRemote,
        };
      }

      return {
        filePath,
        startLine,
        endLine,
        isRemote,
      };
    }

    if (rangeParts.length > 2) {
      return { filePath: snippetPath, isRemote };
    }
  } else {
    const lineNumber = parseInt(lineSpec, 10);
    if (!isNaN(lineNumber)) {
      return {
        filePath,
        startLine: lineNumber,
        endLine: lineNumber,
        isRemote,
      };
    }
  }

  return { filePath: snippetPath, isRemote };
}

export async function parseMarkdownFile(
  filePath: string,
): Promise<MarkdownFile> {
  const content = await readFile(filePath, 'utf-8');
  const tree = unified().use(remarkParse).parse(content);
  const codeBlocks: Array<CodeBlock> = [];

  visit(tree, 'code', (node: Code) => {
    if (!node.lang || !node.meta) {
      return;
    }

    const snippet = parseSnippetDirective(node.meta);

    if (!snippet) {
      return;
    }

    codeBlocks.push({
      language: node.lang,
      content: node.value,
      snippet,
      position: {
        start: node.position?.start.offset ?? 0,
        end: node.position?.end.offset ?? 0,
      },
      lineNumber: node.position?.start.line ?? 1,
      columnNumber: node.position?.start.column ?? 1,
    });
  });

  return {
    filePath,
    content,
    codeBlocks,
  };
}

export async function parseMarkdownForExtraction(
  filePath: string,
): Promise<MarkdownFile> {
  const content = await readFile(filePath, 'utf-8');
  const tree = unified().use(remarkParse).parse(content);
  const codeBlocks: Array<CodeBlock> = [];

  visit(tree, 'code', (node: Code) => {
    if (!node.lang) {
      return;
    }

    const hasSnippetDirective = node.meta && parseSnippetDirective(node.meta);

    if (hasSnippetDirective) {
      return;
    }

    codeBlocks.push({
      language: node.lang,
      content: node.value,
      position: {
        start: node.position?.start.offset ?? 0,
        end: node.position?.end.offset ?? 0,
      },
    });
  });

  return {
    filePath,
    content,
    codeBlocks,
  };
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
  const lines = content.split('\n');

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

  return lines.slice(start, end + 1).join('\n');
}

export function extractLines(
  content: string,
  startLine?: number,
  endLine?: number,
): string {
  if (!startLine && !endLine) {
    return trimBlankLines(content);
  }

  const lines = content.split('\n');
  let extractedLines: Array<string>;

  if (startLine && endLine) {
    extractedLines = lines.slice(startLine - 1, endLine);
  } else if (startLine) {
    extractedLines = lines.slice(startLine - 1);
  } else {
    extractedLines = lines;
  }

  return trimBlankLines(extractedLines.join('\n'));
}

export function replaceCodeBlock(
  markdownContent: string,
  codeBlock: CodeBlock,
  newContent: string,
): string {
  const lines = markdownContent.split('\n');
  let inCodeBlock = false;
  let codeBlockStart = -1;
  let codeBlockEnd = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (!line) {
      continue;
    }

    if (
      line.startsWith('```') &&
      codeBlock.snippet &&
      line.includes('snippet=')
    ) {
      // Extract the snippet directive from the line
      const snippetMatch = line.match(/snippet=([^\s]+)/);
      if (snippetMatch?.[0]) {
        const lineSnippet = parseSnippetDirective(snippetMatch[0]);
        // Match if the parsed snippet directives are equivalent
        if (
          lineSnippet &&
          lineSnippet.filePath === codeBlock.snippet.filePath &&
          lineSnippet.startLine === codeBlock.snippet.startLine &&
          lineSnippet.endLine === codeBlock.snippet.endLine
        ) {
          inCodeBlock = true;
          codeBlockStart = i;
          continue;
        }
      }
    }

    if (inCodeBlock && line.trim() === '```') {
      codeBlockEnd = i;
      break;
    }
  }

  if (codeBlockStart === -1 || codeBlockEnd === -1) {
    return markdownContent;
  }

  const beforeBlock = lines.slice(0, codeBlockStart + 1);
  const afterBlock = lines.slice(codeBlockEnd);
  const newContentLines = newContent.split('\n');

  return [...beforeBlock, ...newContentLines, ...afterBlock].join('\n');
}
