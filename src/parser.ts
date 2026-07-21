import { readFile, realpath } from 'node:fs/promises';
import { resolve, dirname, isAbsolute } from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdx from 'remark-mdx';
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


/**
 * Builds the unified processor for a given file. `.mdx` files are parsed with
 * remark-mdx (JSX, import/export, expressions) plus remark-frontmatter —
 * frontmatter must be registered so `{...}` inside YAML is never handed to the
 * MDX expression parser. `.md` files keep the exact historical parser so
 * existing behavior (and byte offsets) are unchanged.
 */
export function createMarkdownProcessor(filePath: string) {
  if (filePath.toLowerCase().endsWith('.mdx')) {
    return unified().use(remarkParse).use(remarkFrontmatter).use(remarkMdx);
  }
  return unified().use(remarkParse);
}

export async function parseMarkdownFile(
  filePath: string,
): Promise<MarkdownFile> {
  const content = await readFile(filePath, 'utf-8');
  const tree = createMarkdownProcessor(filePath).parse(content);
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
  const tree = createMarkdownProcessor(filePath).parse(content);
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
  if (startLine === undefined && endLine === undefined) {
    return trimBlankLines(content);
  }

  const lines = content.split('\n');
  let extractedLines: Array<string>;

  if (startLine !== undefined && endLine !== undefined) {
    extractedLines = lines.slice(startLine - 1, endLine);
  } else if (startLine !== undefined) {
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
  const { start, end } = codeBlock.position;
  const blockText = markdownContent.slice(start, end);

  const firstNewlineIndex = blockText.indexOf('\n');
  if (firstNewlineIndex === -1) {
    return markdownContent;
  }

  const lastNewlineIndex = blockText.lastIndexOf('\n');
  const openingFence = blockText.slice(0, firstNewlineIndex);
  const closingFence = blockText.slice(lastNewlineIndex + 1);

  // Fences indented inside lists or (in MDX) JSX elements store DEDENTED
  // content in the mdast node; the parser strips up to the opening fence's
  // indentation from every line. Re-apply that indentation when splicing so
  // the fence body stays aligned with its fence markers. Fences at column 1
  // get an empty prefix, keeping historical output byte-identical.
  const indent = ' '.repeat(Math.max(0, (codeBlock.columnNumber ?? 1) - 1));
  const indentedContent =
    indent === ''
      ? newContent
      : newContent
          .split('\n')
          .map((line) => (line === '' ? line : indent + line))
          .join('\n');

  const newBlock = `${openingFence}\n${indentedContent}\n${closingFence}`;
  return markdownContent.slice(0, start) + newBlock + markdownContent.slice(end);
}
